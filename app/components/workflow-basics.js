import Component from '@ember/component';
import { inject as service } from '@ember/service';

/**
 * Any metadata field presented by Crossref is made read-only, preventing any changes
 * to those metadata fields. However, a user may enter extra metadata on top of the Crossref fields.
 * It is safe to lookup the DOI in Crossref, then always merge the metadata currently in the
 * submission with the Crossref results. Lookup Crossref whenever the user enters the submission
 * workflow lets us see which fields came from Crossref. With that record, we will have enough
 * information about specific fields to set to read-only in the subsequent metadata step.
 */
export default Component.extend({
  store: service('store'),
  workflow: service('workflow'),
  currentUser: service('current-user'),
  doiService: service('doi'),
  metadataService: service('metadata-schema'),

  inFlight: false,
  isShowingUserSearchModal: false,

  isProxySubmission: Ember.computed('submission.isProxySubmission', function () {
    return this.get('submission.isProxySubmission');
  }),
  inputSubmitterEmail: Ember.computed('submission.submitterEmail', {
    get(key) {
      return this.get('submission.submitterEmail').replace('mailto:', '');
    },
    set(key, value) {
      this.set('submission.submitterEmail', `mailto:${value}`);
      return value;
    }
  }),
  didRender() {
    this._super(...arguments);
    if (!this.get('isProxySubmission')) {
      this.set('submission.submitter', this.get('currentUser.user'));
      this.set('submission.preparers', Ember.A());
    }
  },
  didInsertElement() {
    this._super(...arguments);

    this.get('workflow').setFromCrossref(false);

    const publication = this.get('submission.publication');
    const hasPublication = !!(publication && publication.get('doi'));

    this.lookupDoiAndJournal(!hasPublication);
  },

  /**
   * Look up the known DOI in Crossref to get metadata, as well as the expected Publication object
   * and associated Journal.
   *
   * @param {boolean} setPublication DOI lookup should set the Publication object on the submission
   */
  lookupDoiAndJournal(setPublication) {
    this.send('lookupDOI', setPublication);
    /**
     * If a Journal object exists in the model, then we have loaded an existing Submission
     * with a Publication and a Journal. We need to make sure that this journal makes it
     * into 'doiInfo' so it can be used in later steps.
     *
     * Only do this if there is no publication DOI, as the DOI lookup will cover this case.
     */
    if (!this.get('publication.doi') && this.get('journal')) {
      this.send('selectJournal', this.get('journal'));
    }
  },

  hasKeyInfo: Ember.computed('publication.title', 'publication.journal', function () {
    return this.get('publication.title') && this.get('publication.journal') && this.get('publication.journal.journalName');
  }),

  isValidDOI: Ember.computed('publication.doi', function () {
    return this.get('doiService').isValidDOI(this.get('publication.doi'));
  }),
  titleClass: Ember.computed('flaggedFields', function () {
    return ((this.get('flaggedFields').indexOf('title') > -1) ? 'form-control is-invalid' : 'form-control');
  }),
  journalClass: Ember.computed('flaggedFields', function () {
    return ((this.get('flaggedFields').indexOf('journal') > -1) ? 'is-invalid' : 'is-valid');
  }),
  submitterEmailClass: Ember.computed('flaggedFields', function () {
    return ((this.get('flaggedFields').indexOf('submitterEmail') > -1) ? 'is-invalid' : '');
  }),
  doiClass: Ember.computed('isValidDOI', function () {
    let doi = this.get('publication.doi');
    if (doi == null || !doi) {
      return 'form-control';
    } else if (this.get('isValidDOI') === true) {
      return 'form-control is-valid';
    }
    return 'form-control is-invalid';
  }),

  clearDoiData(doi) {
    const workflow = this.get('workflow');

    if (workflow.isDataFromCrossref()) {
      this.get('workflow').setFromCrossref(false);
      this.set('doiInfo', {});
      this.set('submission.metadata', '{}');
      this.clearPublication(doi);
    }
  },

  /**
   * Remove all data from the current Publication
   */
  clearPublication(doi) {
    this.get('publication').setProperties({
      doi,
      title: '',
      abstract: '',
      volume: '',
      issue: '',
      pmid: '',
      journal: undefined
    });
  },

  actions: {
    proxyStatusToggled(isProxySubmission) {
      // do only if the values indicate a switch of proxy
      if (this.get('isProxySubmission') && !isProxySubmission || !this.get('isProxySubmission') && isProxySubmission) {
        this.send('changeSubmitter', isProxySubmission, null);
      }
    },
    toggleUserSearchModal() {
      this.toggleProperty('isShowingUserSearchModal');
    },
    pickSubmitter(submitter) {
      this.send('changeSubmitter', true, submitter);
      this.send('toggleUserSearchModal');
      this.set('userSearchTerm', '');
      this.sendAction('validateSubmitterEmail'); // remove red border if there is one
    },
    async changeSubmitter(isProxySubmission, submitter) {
      let hasGrants = this.get('submission.grants') && this.get('submission.grants.length') > 0;
      if (hasGrants) {
        swal({
          type: 'warning',
          title: 'Are you sure?',
          html: 'Changing the submitter will also <strong>remove any grants</strong> currently attached to your submission. Are you sure you want to proceed?',
          showCancelButton: true,
          cancelButtonText: 'Never mind',
          confirmButtonText: 'Yes, I\'m sure'
        }).then((result) => {
          if (result.value) {
            this.set('submission.grants', Ember.A());
            this.send('updateSubmitterModel', isProxySubmission, submitter);
            toastr.info('Submitter and related grants removed from submission.');
          }
        });
      } else {
        this.send('updateSubmitterModel', isProxySubmission, submitter);
      }
    },
    updateSubmitterModel(isProxySubmission, submitter) {
      this.get('workflow').setMaxStep(1);
      this.set('submission.submitterEmail', '');
      this.set('submission.submitterName', '');
      if (isProxySubmission) {
        this.set('submission.submitter', submitter);
        this.set('submission.preparers', Ember.A([this.get('currentUser.user')]));
      } else {
        this.set('submission.submitter', this.get('currentUser.user'));
        this.set('submission.preparers', Ember.A());
      }
    },

    /**
     * lookupDOI - Set publication, publication journal, and doiInfo based on DOI. The 'setPublication'
     * flag can be set to 'false' to avoid overwriting any current Publication data. However, this flag
     * WILL be overridden if the current Publication is not complete: i.e. if it lacks either a Title,
     * or if it lacks a Journal (with a journalName).
     *
     * @param {boolean} setPublication DOI lookup should set the Publication object on the submission
     *                  this flag is ignored if the current publication is "not valid"
     */
    lookupDOI(setPublication) {
      if (this.get('inFlight')) {
        console.log('%cA request is already in flight, ignoring this call', 'color:blue;');
        return;
      }

      const publication = this.get('publication');
      if (!publication || !publication.get('doi')) {
        // Note that any metadata now does NOT come from Xref
        this.clearDoiData();
        return;
      } else if (publication.get('doi') === this.get('workflow').getDoiInfo().DOI) {
        // Stop issuing requests when the current DOI is the same as the recorded DOI
        return;
      }

      const doiService = this.get('doiService');
      let doi = publication.get('doi');

      doi = doiService.formatDOI(doi);
      if (!doi || doi === '' || doiService.isValidDOI(doi) === false) {
        this.clearDoiData(doi); // Clear out title/Journal if user enters a valid DOI, then changes it to an invalid DOI
        return;
      }

      publication.set('doi', doi);
      this.set('inFlight', true);

      toastr.info('Please wait while we information about your DOI');
      doiService.resolveDOI(doi).then(async (result) => {
        if (setPublication || !this.get('hasKeyInfo')) {
          this.set('publication', result.publication);
        }

        this.set('doiInfo', result.doiInfo);
        this.get('workflow').setFromCrossref(true);

        toastr.remove();
        toastr.success("We've pre-populated information from the DOI provided!");
        this.sendAction('validateTitle');
        this.sendAction('validateJournal');
      }).catch((error) => {
        console.log(`DOI service request failed: ${error.payload.error}`);
        toastr.remove();
        toastr.error(`<i class="far fa-frown"></i><br>${error.payload.error}`);

        this.clearDoiData(doi);
        // this.set('isValidDOI', false);
      }).finally(() => this.set('inFlight', false));
    },

    /** Sets the selected journal for the current publication.
     * @param journal {DS.Model} The journal
     */
    selectJournal(journal) {
      let doiInfo = this.get('doiInfo');
      // Formats metadata and adds journal metadata
      let metadata = this.get('doiService').doiToMetadata(doiInfo, journal);
      metadata['journal-title'] = journal.get('journalName');
      doiInfo = this.get('metadataService').mergeBlobs(doiInfo, metadata);

      this.set('doiInfo', doiInfo);

      const publication = this.get('publication');
      publication.set('journal', journal);
      this.sendAction('validateJournal');
    },

    cancel() {
      this.sendAction('abort');
    }
  }
});
