/* eslint-disable ember/no-get */
/* eslint-disable no-debugger */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, get } from '@ember/object';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency-decorators';

/**
 * Some links in the navbar point to static pages hosted outside of Ember.
 */

export default class NavBar extends Component {
  @service currentUser;
  @service appStaticConfig;
  @service session;

  @tracked aboutUrl = null;
  @tracked contactUrl = null;
  @tracked faqUrl = null;

  constructor() {
    super(...arguments);

    this._setupAppStaticConfig.perform();
  }

  /**
   * Do we have a valid user loaded into the user service?
   */
  get hasAUser() {
    return !!get(this, 'currentUser.user');
  }

  @action
  scrollToAnchor() {
    if (window.location.search.indexOf('anchor=') == -1) {
      window.scrollTo(0, 0);
    }
  }

  @action
  async logOut() {
    await this.session.invalidate();
  }

  @task
  _setupAppStaticConfig = function* () {
    let config = yield this.appStaticConfig.getStaticConfig();
    if (config.branding.showPagesNavBar) {
      this.aboutUrl = config.branding.pages.aboutUrl;
      this.contactUrl = config.branding.pages.contactUrl;
      this.faqUrl = config.branding.pages.faqUrl;
    }
  };
}
