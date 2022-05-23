/* eslint-disable ember/no-get */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, get, set } from '@ember/object';
import { A } from '@ember/array';
import { inject as service } from '@ember/service';
import Bootstrap4Theme from 'ember-models-table/themes/bootstrap4';
import { task } from 'ember-concurrency-decorators';

/**
 * This component is responsible for displaying a table of grants that are relevant to
 * the current submission. The list of grants is loaded here and is determined by
 * the "submitter" of the current submission.
 *
 *
 */
export default class WorkflowGrants extends Component {
  @service store;
  @service workflow;
  @service appStaticConfig;

  @tracked contactUrl = null;
  @tracked workflowStep = 2;

  @tracked pageNumber = 1;
  @tracked pageCount = 0;
  @tracked pageSize = 10;
  @tracked submitterGrants = null;
  @tracked totalGrants = 0;
  @tracked themeInstance = Bootstrap4Theme.create();
  /** Grants already attached to the submission on component init */
  @tracked _selectedGrants = A();
  @tracked grantColumns = [
    {
      propertyName: 'awardNumber',
      title: 'Award Number',
      className: 'awardnum-column',
      component: 'grant-link-newtab-cell',
      disableSorting: true,
    },
    {
      title: 'Project name (funding period)',
      className: 'projectname-date-column',
      component: 'grant-title-date-cell',
      disableSorting: true,
    },
    {
      propertyName: 'primaryFunder.name',
      title: 'Funder',
      className: 'funder-column',
      disableSorting: true,
    },
    {
      component: 'select-row-toggle',
      mayBeHidden: false,
    },
  ];

  // Matches numbered starting at 1. Return number of first match on current page.
  get pageFirstMatchNumber() {
    return (this.pageNumber - 1) * this.pageSize + 1;
  }

  // Matches numbered starting at 1. Return number of last match on current page.
  get pageLastMatchNumber() {
    let result = this.pageNumber * this.pageSize;
    let total = this.totalGrants;

    if (result > total) {
      result = total;
    }

    return result;
  }

  get filteredGrants() {
    return this.submitterGrants.filter(
      (g) =>
        !get(this, 'submission.grants')
          .map((x) => x.id)
          .includes(g.get('id'))
    );
  }

  constructor() {
    super(...arguments);

    this.setup.perform();
  }

  @action
  setWorkflowStepHere() {
    this.workflow.setMaxStep(this.workflowStep);
  }

  @task
  setup = function* () {
    let config = yield this.appStaticConfig.getStaticConfig();
    this.contactUrl = config.branding.pages.contactUrl;

    if (this.args.preLoadedGrant) {
      this.initialAddGrant.perform(this.args.preLoadedGrant);
    }
    if (get(this, 'args.submission.submitter.id')) {
      yield this.updateGrants.perform();
    }

    // Init selected grants to grants already attached to submission

    this._selectedGrants.clear();
    this._selectedGrants.addObjects(get(this, 'args.submission.grants'));
  };

  @task
  updateGrants = function* () {
    let info = {};

    let results = yield this.store.query('grant', {
      query: {
        bool: {
          must: [
            { range: { endDate: { gte: '2011-01-01' } } },
            {
              bool: {
                should: [
                  { term: { pi: get(this, 'args.submission.submitter.id') } },
                  { term: { coPis: get(this, 'args.submission.submitter.id') } },
                ],
              },
            },
          ],
        },
      },
      from: (this.pageNumber - 1) * this.pageSize,
      size: this.pageSize,
      sort: [{ endDate: 'desc' }],
      info,
    });

    set(this, 'submitterGrants', results);
    set(this, 'totalGrants', info.total);
    set(this, 'pageCount', Math.ceil(info.total / this.pageSize));
  };

  /**
   * Only really triggered on #init by a pre-loaded grant...
   *
   * @param {Grant} grant
   * @param {object} event ?
   */
  @task
  initialAddGrant = function* (grant, event) {
    if (grant) {
      this.addGrant(grant);
    } else if (event && event.target.value) {
      let grant = yield this.store.findRecord('grant', event.target.value);

      grant.get('primaryFunder.policy'); // Make sure policy is loaded in memory
      this.addGrant(grant);
      document.querySelectorAll('select')[0].selectedIndex = 0;
    }
  };

  @action
  prevPage() {
    let i = this.pageNumber;

    if (i > 1) {
      set(this, 'pageNumber', i - 1);
      this.updateGrants.perform();
    }
  }

  @action
  nextPage() {
    let i = this.pageNumber;

    if (i < this.pageCount) {
      set(this, 'pageNumber', i + 1);
      this.updateGrants.perform();
    }
  }

  /**
   * Add a grant to the submission. Since this effects subsequent steps in the workflow,
   * make sure the user can't skip any step past this
   *
   * @param {Grant} grant
   */
  @action
  addGrant(grant) {
    const workflow = this.workflow;
    const submission = this.args.submission;

    if (!get(submission, 'grants').includes(grant)) {
      get(submission, 'grants').pushObject(grant);
    }
    if (!workflow.getAddedGrants().includes(grant)) {
      workflow.addGrant(grant);
    }
    if (!this._selectedGrants.includes(grant)) {
      this._selectedGrants.pushObject(grant);
    }

    this.setWorkflowStepHere();
  }

  /**
   * Remove a grant from the submission. If the grant was "pre-loaded" in the submission
   * workflow, make sure it is no longer marked that way (remove grant ID from URL param).
   * Since this effects subsequent steps, force the user to go through all steps again
   * to recalculate things like `effectivePolicies` and `repositories`
   *
   * @param {Grant} grant
   */
  @action
  removeGrant(grant) {
    const workflow = this.workflow;

    // if grant is grant passed in from grant detail page remove query parms
    if (grant === this.preLoadedGrant) {
      set(this, 'preLoadedGrant', null);
    }
    const submission = this.args.submission;
    get(submission, 'grants').removeObject(grant);
    workflow.removeGrant(grant);
    this._selectedGrants.removeObject(grant);

    this.setWorkflowStepHere();
  }

  /**
   * Since this action is only triggered from user interaction, we can be sure that
   * any Grants found selected (or deselected) in this action are not the result of
   * the previous state of the Submission. These grants should be tracked in 'workflow'
   *
   * This action catches user interactions that don't directly trigger #addGrant or
   * #removeGrant actions. These actions _will_ add or remove grants, just not through
   * the above actions. We need to know when this happens so we can track the Grants
   * in the workflow.
   */
  @action
  dataChange(options) {
    const selectedItems = options.selectedItems;

    /**
     * Compare `selectedItems` with `_selectedGrants`, which holds the previous
     * selection of grants. If these two differ, we know that some selection
     * has been made (though we don't know if it was an addition or removal).
     * This will weed out other display data changes, like table filtering.
     *
     * When we know grant selection has changed, we have to make sure all places
     * that Grants are tracked are updated (_selectedGrants, workflow.addedGrants,
     * and submission.grants). Also reset progress in the workflow, forcing
     * users to step through the workflow, without skipping steps.
     */
    const previousSelection = this._selectedGrants;

    const curLen = get(selectedItems, 'length');
    const prevLen = get(previousSelection, 'length');

    if (curLen > prevLen) {
      /**
       * Grant added. For each currently selected grant, check if it is
       * present in the previous selection state. If not, make sure it is
       * added everywhere appropriate.
       */
      selectedItems.filter((grant) => !previousSelection.includes(grant)).forEach((grant) => this.addGrant(grant));
    } else if (curLen < prevLen) {
      /**
       * Grant removed. For each previously selected grant, check if it is
       * present in current selection. If not, make sure it is removed where
       * appropriate.
       */
      previousSelection.filter((grant) => !selectedItems.includes(grant)).forEach((grant) => this.removeGrant(grant));
    }

    set(this, '_selectedGrants', selectedItems);
  }

  @action
  abortSubmission() {
    this.abort();
  }
}
