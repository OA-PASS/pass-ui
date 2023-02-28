import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { module, skip } from 'qunit';
import { setupTest } from 'ember-qunit';

/**
 * These tests checking for the ignore list are no longer relevant after
 * switching to the JSON:API implementation
 */
module('Unit | Route | submissions/index', (hooks) => {
  setupTest(hooks);

  skip('Make sure ignore list is included in ES query for a submitter', async function (assert) {
    assert.expect(2);
    const route = this.owner.lookup('route:submissions/index');

    route.set(
      'currentUser',
      EmberObject.create({
        user: EmberObject.create({
          id: 'Moo',
          isSubmitter: true,
        }),
      })
    );
    route.set(
      'searchHelper',
      EmberObject.create({
        getIgnoreList: () => ['ID-3'],
        clearIgnore: () => {},
      })
    );
    route.set(
      'store',
      EmberObject.create({
        query: (type, query) => {
          const filter = query.query.bool.must_not;
          assert.strictEqual(filter.length, 2, 'Should be two "must_not" terms');
          assert.deepEqual(filter[1].terms, { '@id': ['ID-3'] });

          return Promise.resolve(A());
        },
      })
    );

    await route.model();
  });

  skip('Make sure ignore list is included in ES query for a admin', async function (assert) {
    assert.expect(2);
    const route = this.owner.lookup('route:submissions/index');

    route.set(
      'currentUser',
      EmberObject.create({
        user: EmberObject.create({
          id: 'Moo',
          isAdmin: true,
        }),
      })
    );
    route.set(
      'searchHelper',
      EmberObject.create({
        getIgnoreList: () => ['ID-3'],
        clearIgnore: () => {},
      })
    );
    route.set(
      'store',
      EmberObject.create({
        query: (type, query) => {
          const filter = query.query.must_not;
          assert.strictEqual(filter.length, 2, 'Should be two "must_not" terms');
          assert.deepEqual(filter[1].terms, { '@id': ['ID-3'] });

          return Promise.resolve(A());
        },
      })
    );

    await route.model();
  });
});
