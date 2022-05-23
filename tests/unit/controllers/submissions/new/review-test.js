/* eslint-disable ember/no-classic-classes */
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Controller | submissions/new/review', (hooks) => {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function (assert) {
    let controller = this.owner.lookup('controller:submissions/new/review');
    assert.ok(controller);
  });

  test('loadPrevious triggers transition', function (assert) {
    const controller = this.owner.lookup('controller:submissions/new/review');
    const model = EmberObject.create({
      newSubmission: EmberObject.create({
        save: () => Promise.resolve(assert.ok(true))
      })
    });

    controller.set('model', model);

    let loadTabAccessed = false;
    controller.transitionToRoute = function (route) {
      loadTabAccessed = true;
      assert.equal('submissions.new.files', route);
    };
    controller.send('loadPrevious');
    assert.equal(loadTabAccessed, true);
  });

  test('parent properties are retrieved', function (assert) {
    let controller = this.owner.lookup('controller:submissions/new/review');
    let submitTriggered = false;
    this.owner.register('controller:submissions/new', EmberObject.extend({
      uploading: 'is uploading',
      comment: 'test comment',
      waitingMessage: 'test waiting message'
    }));

    assert.equal(controller.get('uploading'), 'is uploading');
    assert.equal(controller.get('waitingMessage'), 'test waiting message');
    assert.equal(controller.get('comment'), 'test comment');
    controller.set('comment', 'comment changed');
    assert.equal(controller.get('comment'), 'comment changed');
  });
});
