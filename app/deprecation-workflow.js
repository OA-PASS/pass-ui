import setupDeprecationWorkflow from 'ember-cli-deprecation-workflow';

setupDeprecationWorkflow({
  workflow: [
    { handler: 'silence', matchId: 'ember-data:deprecate-promise-many-array-behaviors' },
    { handler: 'silence', matchId: 'ember-data:deprecate-array-like' },
    { handler: 'silence', matchId: 'ember-data:no-a-with-array-like' },
  ],
});
