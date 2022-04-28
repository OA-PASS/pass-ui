import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action, get, computed } from '@ember/object';
import ENV from 'pass-ember/config/environment';
import { inject as service } from '@ember/service';

export default class SubmissionsDetail extends Controller {
  @service currentUser;
  @service store;
  @service submissionHandler;
  @service searchHelper;

  constructor() {
    super(...arguments);

    let element = document.querySelector('[data-toggle="tooltip"]');
    if (element) element.tooltip();
  }

  @tracked submitted = get(this, 'model.sub.submitted');
  @tracked repositories = get(this, 'model.sub.repositories');
  @tracked externalRepoMap = {};
  @tracked _hasVisitedWeblink = null;

  @computed('model.sub', 'model.sub.submitter.firstName')
  get displaySubmitterName() {
    if (get(this, 'model.sub.submitter.displayName')) {
      return get(this, 'model.sub.submitter.displayName');
    } else if (get(this, 'model.sub.submitter.firstName')) {
      return `${get(this, 'model.sub.submitter.firstName')} ${get(this, 'model.sub.submitter.lastName')}`;
    } else if (get(this, 'model.sub.submitterName')) {
      return get(this, 'model.sub.submitterName');
    }

    return '';
  }

  @computed('model.sub', 'model.sub.submitter.email')
  get displaySubmitterEmail() {
    if (get(this, 'model.sub.submitter.email')) {
      return get(this, 'model.sub.submitter.email');
    } else if (get(this, 'model.sub.submitterEmail')) {
      return get(this, 'model.sub.submitterEmailDisplay');
    }

    return '';
  }

  get externalSubmission() {
    if (!this.submitted) {
      return [];
    }
    return this.externalSubmissionsMetadata || [];
  }

  /**
   * Ugly way to generate data for the template to use.
   * {
   *    'repository-id': {
   *      repo: { }, // repository obj
   *      deposit: {}, // related deposit, if exists
   *      repositoryCopy: {} // related repoCopy if exists
   *    }
   * }
   * This map is then turned into an array for use in the template
   */
  get hasVisitedWeblink() {
    if (this._hasVisitedWeblink) {
      return this._hasVisitedWeblink;
    }
    return Object.values(this.externalRepoMap).every(val => val === true);
  }

  set hasVisitedWeblink(value) {
    this._hasVisitedWeblink = value;
  }

  /**
   * Get enough information about 'web-link' repositories to display to a user.
   */
  get externalSubmissionsMetadata() {
    let result = [];

    this.repositories.filter(repo => repo._isWebLink)
      .forEach((repo) => {
        result.push({
          message: `Deposit into ${repo.name} was prompted`,
          name: repo.name,
          url: repo.url
        });
      });

    return result;
  }

  get weblinkRepos() {
    let md = this.externalSubmissionsMetadata;

    if (Array.isArray(md) && md.length > 0) {
      md.forEach((repo) => {
        this.externalRepoMap[repo.name] = false;
      });
      return md;
    }

    return [];
  }

  get mustVisitWeblink() {
    const weblinkExists = this.weblinkRepos.length > 0;
    const isSubmitter = get(this, 'currentUser.user.id') === get(this, 'model.sub.submitter.id');
    const isProxySubmission = get(this, 'model.sub.isProxySubmission');
    const isSubmitted = this.submitted;

    return weblinkExists && isSubmitter && isProxySubmission && !isSubmitted;
  }

  get disableSubmit() {
    const needsToVisitWeblink = this.mustVisitWeblink && !this.hasVisitedWeblink;

    return needsToVisitWeblink;
  }

  /**
   * Awkward object for use in the UI composing Repository objects with related
   * Deposit and RepositoryCopy objects.
   *
   * Explicitly exclude 'web-link' repositories.
   */
  get repoMap() {
    let hasStuff = false;
    const repos = get(this, 'model.repos');
    const deps = get(this, 'model.deposits');
    const repoCopies = get(this, 'model.repoCopies');
    if (!repos) {
      return null;
    }
    let map = {};
    repos.filter(repo => !repo._isWebLink).forEach((r) => {
      (map[r.id] = {
        repo: r
      });
    });

    if (deps) {
      deps.forEach((deposit) => {
        hasStuff = true;
        const repo = get(deposit, 'repository');
        const repoId = get(repo, 'id');
        if (!map.hasOwnProperty(repoId)) {
          map[repoId] = {
            repo,
            deposit
          };
        } else {
          map[repoId] = Object.assign(map[repoId], {
            deposit,
            repositoryCopy: get(deposit, 'repositoryCopy')
          });
        }
      });
    }
    if (repoCopies) {
      hasStuff = true;
      repoCopies.forEach((rc) => {
        const repo = rc.get('repository');
        const repoId = get(repo, 'id');
        if (!map.hasOwnProperty(repoId)) {
          map[repoId] = {
            repo,
            repositoryCopy: rc
          };
        } else {
          map[repoId] = Object.assign(map[repoId], {
            repositoryCopy: rc
          });
        }
      });
    }
    if (hasStuff) {
      let results = [];
      Object.keys(map).forEach(k => results.push(map[k]));
      return results;
    }

    return null;
  }

  get isSubmitter() {
    return (
      get(this, 'model.sub.submitter.id') === get(this, 'currentUser.user.id')
    );
  }

  get isPreparer() {
    return get(this, 'model.sub.preparers')
      .map(x => x.id)
      .includes(get(this, 'currentUser.user.id'));
  }

  get submissionNeedsPreparer() {
    return get(this, 'model.sub.submissionStatus') === 'changes-requested';
  }

  get submissionNeedsSubmitter() {
    return (
      get(this, 'model.sub.submissionStatus') === 'approval-requested' ||
      get(this, 'model.sub.submissionStatus') === 'approval-requested-newuser'
    );
  }

  @action
  async openWeblinkAlert(repo) {
    let value = await swal({
      title: 'Notice!',
      text:
        'You are being sent to an external site. This will open a new tab.',
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Open new tab'
    });

    if (value.dismiss) {
      // Don't redirect
      return;
    }
    // Go to the weblink repo
    this.externalRepoMap[repo.name] = true;
    const allLinksVisited = Object.values(this.externalRepoMap).every(val => val === true);
    if (allLinksVisited) {
      this.hasVisitedWeblink = true;
    }
    $('#externalSubmission').modal('hide');

    var win = window.open(repo.url, '_blank');
    win.focus();
  }

  @action
  async requestMoreChanges() {
    let sub = get(this, 'model.sub');
    let message = this.message;

    if (!message) {
      swal(
        'Comment field empty',
        'Please add a comment before requesting changes.',
        'warning'
      );
    } else {
      $('.block-user-input').css('display', 'block');
      await this.submissionHandler.requestSubmissionChanges(sub, message);
      window.location.reload(true);
    }
  }

  @action
  async approveChanges() {
    let baseURL = window.location.href.replace(new RegExp(`${ENV.rootURL}.*`), '');
    // First, check if user has visited all required weblinks.
    if (this.disableSubmit) {
      if (!this.hasVisitedWeblink) {
        $('.fa-exclamation-triangle').css('color', '#f86c6b');
        $('.fa-exclamation-triangle').css('font-size', '2.2em');
        setTimeout(() => {
          $('.fa-exclamation-triangle').css('color', '#b0b0b0');
          $('.fa-exclamation-triangle').css('font-size', '2em');
        }, 4000);
        toastr.warning('Please visit the listed web portal(s) to submit your manuscript directly. Metadata displayed on this page can be used to help in the submission process.');
      }
      return;
    }

    // Validate manuscript files
    let manuscriptFiles = [].concat(this.filesTemp, get(this, 'model.files') && get(this, 'model.files').toArray())
      .filter(file => file && file.get('fileRole') === 'manuscript');

    if (manuscriptFiles.length == 0) {
      swal(
        'Manuscript is missing',
        'At least one manuscript file is required.  Please Edit the submission to add one',
        'warning'
      );
      return;
    } else if (manuscriptFiles.length > 1) {
      swal(
        'Incorrect manuscript count',
        `Only one file may be designated as the manuscript.  Instead, found ${manuscriptFiles.length}.  Please edit the file list`,
        'warning'
      );
      return;
    }

    let reposWithAgreementText = get(this, 'model.repos')
      .filter(repo => (!get(repo, '_isWebLink')) && get(repo, 'agreementText'))
      .map(repo => ({
        id: get(repo, 'name'),
        title: `Deposit requirements for ${get(repo, 'name')}`,
        html: `<textarea rows="16" cols="40" name="embargo" class="alpaca-control form-control disabled" disabled="" autocomplete="off">${get(repo, 'agreementText')}</textarea>`
      }));

    let reposWithoutAgreementText = get(this, 'model.repos')
      .filter(repo => !get(repo, '_isWebLink') && !get(repo, 'agreementText'))
      .map(repo => ({
        id: get(repo, 'name')
      }));

    let reposWithWebLink = get(this, 'model.repos')
      .filter(repo => get(repo, '_isWebLink'))
      .map(repo => ({
        id: get(repo, 'name')
      }));

    const result = await swal.mixin({
      input: 'checkbox',
      inputPlaceholder: 'I agree to the above statement on today\'s date ',
      confirmButtonText: 'Next &rarr;',
      showCancelButton: true,
      progressSteps: reposWithAgreementText.map((repo, index) => index + 1),
    }).queue(reposWithAgreementText);
    if (result.value) {
      let reposThatUserAgreedToDeposit = reposWithAgreementText.filter((repo, index) => {
        // if the user agreed to depost to this repo === 1
        if (result.value[index] === 1) {
          return repo;
        }
      });
      // make sure there are repos to submit to.
      if (get(this, 'model.sub.repositories.length') > 0) {
        if (reposWithoutAgreementText.length > 0 || reposThatUserAgreedToDeposit.length > 0 || reposWithWebLink.length > 0) {
          let swalMsg = 'Once you click confirm you will no longer be able to edit this submission or add repositories.<br/>';
          if (reposWithoutAgreementText.length > 0 || reposThatUserAgreedToDeposit.length) {
            swalMsg = `${swalMsg}You are about to submit your files to: <pre><code>${JSON.stringify(reposThatUserAgreedToDeposit.map(repo => repo.id)).replace(/[\[\]']/g, '')}${JSON.stringify(reposWithoutAgreementText.map(repo => repo.id)).replace(/[\[\]']/g, '')} </code></pre>`;
          }
          if (reposWithWebLink.length > 0) {
            swalMsg = `${swalMsg}You were prompted to submit to: <code><pre>${JSON.stringify(reposWithWebLink.map(repo => repo.id)).replace(/[\[\]']/g, '')}</code></pre>`;
          }

          let result = await swal({
            title: 'Confirm submission',
            html: swalMsg, // eslint-disable-line
            confirmButtonText: 'Confirm',
            showCancelButton: true,
          });

          if (result.value) {
            // Update repos to reflect repos that user agreed to deposit.
            // Must keep web-link repos.
            this.set('model.sub.repositories', get(this, 'model.sub.repositories').filter((repo) => {
              if (get(repo, '_isWebLink')) {
                return true;
              }
              let temp = reposWithAgreementText.map(x => x.id).includes(get(repo, 'name'));
              if (!temp) {
                return true;
              } else if (reposThatUserAgreedToDeposit.map(r => r.id).includes(get(repo, 'name'))) {
                return true;
              }
              return false;
            }));

            let sub = get(this, 'model.sub');
            let message = this.message;
            this.submissionHandler.approveSubmission(sub, message);
          }
        } else {
          // there were repositories, but the user didn't sign any of the agreements
          let reposUserDidNotAgreeToDeposit = reposWithAgreementText.filter((repo) => {
            if (!reposThatUserAgreedToDeposit.includes(repo)) {
              return true;
            }
          });
          let result = await swal({
            title: 'Your submission cannot be submitted.',
            html: `You declined to agree to the deposit agreement(s) for ${JSON.stringify(reposUserDidNotAgreeToDeposit.map(repo => repo.id)).replace(/[\[\]']/g, '')}. Therefore, this submission cannot be submitted. \n You can either (a) cancel the submission or (b) return to the submission to provide required input and try again.`,
            confirmButtonText: 'Cancel submission',
            showCancelButton: true,
            cancelButtonText: 'Go back to edit information'
          });

          if (result.value) {
            this.cancelSubmission();
          }
        }
      } else {
        // no repositories associated with the submission
        let result = await swal({
          title: 'Your submission cannot be submitted.',
          html: 'No repositories are associated with this submission. \n You can either (a) cancel the submission or (b) return to the submission and edit it to include a repository.',
          confirmButtonText: 'Cancel submission',
          showCancelButton: true,
          cancelButtonText: 'Go back to edit information'
        });

        if (result.value) {
          this.cancelSubmission();
        }
      }
    }
  }

  @action
  async cancelSubmission() {
    let message = this.message;
    let sub = get(this, 'model.sub');

    if (!message) {
      swal(
        'Comment field empty',
        'Please add a comment for your cancellation.',
        'warning'
      );
      return;
    }

    let result = await swal({
      title: 'Are you sure?',
      text: 'If you cancel this submission, it will not be able to be resumed.',
      confirmButtonText: 'Yes, cancel this submission',
      confirmButtonColor: '#f86c6b',
      cancelButtonText: 'Never mind',
      showCancelButton: true,
    });

    if (result.value) {
      $('.block-user-input').css('display', 'block');
      await this.submissionHandler.cancelSubmission(sub, message);
      window.location.reload(true);
    }
  }

  @action
  async deleteSubmission(submission) {
    let result = await swal({
      text: 'Are you sure you want to delete this draft submission? This cannot be undone.',
      confirmButtonText: 'Delete',
      confirmButtonColor: '#f86c6b',
      showCancelButton: true
    });

    if (result.value) {
      const ignoreList = this.searchHelper;

      await this.submissionHandler.deleteSubmission(submission);
      ignoreList.clearIgnore();
      ignoreList.ignore(submission.get('id'));
      this.transitionToRoute('submissions');
    }
  }
}
