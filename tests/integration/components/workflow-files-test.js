import Service from '@ember/service';
import { A } from '@ember/array';
import EmberObject, { set } from '@ember/object';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import { module, test, skip } from 'qunit';
import { run } from '@ember/runloop';
import {
  click,
  render,
  triggerEvent,
  waitFor
} from '@ember/test-helpers';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';

module('Integration | Component | workflow files', (hooks) => {
  setupRenderingTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    let submission = EmberObject.create({
      repositories: [],
      grants: []
    });
    let files = [EmberObject.create({})];
    let newFiles = A([]);
    set(this, 'submission', submission);
    set(this, 'files', files);
    set(this, 'newFiles', newFiles);
    set(this, 'loadPrevious', (actual) => {});
    set(this, 'loadNext', (actual) => {});

    const mockStaticConfig = Service.extend({
      getStaticConfig: () => Promise.resolve({
        assetsUri: '',
        branding: {
          stylesheet: ''
        }
      }),
      addCss: () => {}
    });

    this.owner.register('service:app-static-config', mockStaticConfig);

    this.owner.register('service:workflow', Service.extend({
      getDoiInfo: () => ({ DOI: 'moo-doi' })
    }));

    this.owner.register('service:oa-manuscript-service', Service.extend({
      lookup: () => Promise.resolve([{
        name: 'This is a moo',
        url: 'http://example.com/moo.pdf'
      }]),
      downloadManuscript: {
        perform: () => Promise.resolve('Resting-place')
      }
    }));

    // Inline configure mirage to respond to File saves
    this.server.post('http://localhost:8080/fcrepo/rest/files', () => new Response(201, {
      Location: 'https://pass.local/fcrepo/rest/files/6a/e3/c0/91/6ae3c091-e87e-4249-a744-72cb93415a95',
      'Content-Type': 'text/plain; charset=UTF-8'
    }));
  });

  /**
   * Intent is to fake the file input element to make it look like a file is present,
   * then test the behavior of #getFiles().
   *
   * In this case, submission-handler#uploadFiles() should be called once for each
   * mock file
   */
  test('Files should upload immediately', function (assert) {
    assert.expect(6);

    this.owner.register('service:store', Service.extend({
      createRecord: () => Promise.resolve()
    }));
    this.owner.register('service:submission-handler', Service.extend({
      uploadFile: (submission, file) => {
        assert.ok(submission);
        assert.ok(file);

        assert.equal(file.get('name'), 'Fake-file-name');
        assert.equal(file.get('mimeType'), 'plain');
        assert.deepEqual(file.get('_file'), { size: 100, name: 'Fake-file-name', type: 'text/plain' });
      }
    }));

    run(() => {
      const component = this.owner.lookup('component:workflow-files');

      // Crappily mock this function on the component so we don't have to mess with
      // the 'document' object...
      component.set('_getFilesElement', () => {
        assert.ok(true);
        return ({
          files: [
            {
              size: 100,
              name: 'Fake-file-name',
              type: 'text/plain'
            }
          ]
        });
      });
      component.set('newFiles', A());
      component.set('submission', EmberObject.create());

      component.send('getFiles');
    });
  });

  /**
   * First upload a file, then click the 'Remove' button
   */
  test('Files removed from UI should no longer reference submission', async function (assert) {
    assert.expect(6);

    const submission = EmberObject.create({});
    this.set('submission', submission);

    this.set('previouslyUploadedFiles', A([
      EmberObject.create({
        name: 'File-for-test',
        fileRole: 'manuscript',
        submission,
        save() {
          // Should be called when "deleted" to persist changes
          assert.ok(true);
          return Promise.resolve();
        },
        unloadRecord() {
          assert.ok(true);
          return Promise.resolve();
        }
      })
    ]));

    // Bogus action so component actions don't complain
    this.set('moo', () => {});

    await render(hbs`
      <WorkflowFiles
        @submission={{this.submission}}
        @previouslyUploadedFiles={{this.previouslyUploadedFiles}}
        @next={{action this.moo}}
        @back={{action this.moo}}
        @abort={{action this.moo}}
      />
    `);

    const btn = this.element.querySelector('button');
    assert.ok(btn);
    assert.ok(btn.textContent.includes('Remove'));

    await click(btn);

    const sweetAlertBtn = document.querySelector('.swal2-container button.swal2-confirm');
    assert.ok(sweetAlertBtn);
    await click(sweetAlertBtn);

    const workflowFiles = this.get('previouslyUploadedFiles');
    assert.equal(workflowFiles.length, 0, 'Should have 0 files tracked');
  });

  /**
   * No files previously attached, the added file should be added as 'manuscript'. FoundManuscripts
   * component should no longer be visible
   */
  skip('You can add an external file from the oaManuscript service', async function (assert) {
    set(this, 'moo', () => {});
    set(this, 'submission', EmberObject.create({}));
    set(this, 'previouslyUploadedFiles', A([]));

    await render(hbs`<WorkflowFiles
      @submission={{this.submission}}
      @previouslyUploadedFiles={{this.previouslyUploadedFiles}}
      @newFiles={{this.newFiles}}
      @next={{this.moo}}
      @back={{this.moo}}
      @abort={{this.moo}}
    />`);

    assert.dom('[data-test-foundmss-component]').exists();

    assert.dom('[data-test-add-file-link]').exists();
    assert.dom('[data-test-add-file-link]').includesText('http://example.com/moo.pdf');

    await click('[data-test-add-file-link]');
    await waitFor('[data-test-added-manuscript-row]');

    assert.dom('[data-test-added-manuscript-row]').includesText('This is a moo');
    assert.dom('[data-test-added-manuscript-row]').includesText('Manuscript');

    assert.dom('[data-test-foundmss-component]').doesNotExist();
  });

  /**
   * When a manuscript is already attached to the submission, FoundManuscripts component
   * should not appear.
   *
   * User should still be able to manually upload supplemental files
   */
  test('Can\'t select oa mss when manuscript already attached to submission', async function (assert) {
    const submission = EmberObject.create({});

    const ms = EmberObject.create({
      name: 'This is the first moo',
      fileRole: 'manuscript'
    });

    set(this, 'submission', submission);
    set(this, 'previouslyUploadedFiles', A([ms]));
    set(this, 'moo', () => {});

    this.owner.register('service:submission-handler', Service.extend({
      uploadFile(submission, file) {
        assert.ok(submission, 'No submission found');
        assert.ok(file, 'No file specified for upload');
      }
    }));

    await render(hbs`<WorkflowFiles
      @submission={{this.submission}}
      @previouslyUploadedFiles={{this.previouslyUploadedFiles}}
      @newFiles={{this.newFiles}}
      @next={{this.moo}}
      @back={{this.moo}}
      @abort={{this.moo}}
    />`);

    assert.dom('[data-test-foundmss-component]').doesNotExist();
    assert.dom('[data-test-added-supplemental-row]').doesNotExist();
    assert.dom('#file-multiple-input').exists();

    const files2Add = {
      files: [
        new File([new Blob(['Moo!'])], 'Added_file.moo', { type: 'application/moo' })
      ]
    };

    await triggerEvent('#file-multiple-input', 'change', files2Add);

    assert.dom('[data-test-added-supplemental-row]').exists();
    assert.dom('[data-test-added-supplemental-row]').includesText('Added_file.moo');
  });

  test('Manually uploading a MS should hide FoundManuscript component', async function (assert) {
    set(this, 'moo', () => {});
    set(this, 'submission', EmberObject.create({}));
    set(this, 'previouslyUploadedFiles', A([]));

    this.owner.register('service:submission-handler', Service.extend({
      uploadFile(submission, file) {
        assert.ok(submission, 'No submission found');
        assert.ok(file, 'No file specified for upload');
      }
    }));

    await render(hbs`<WorkflowFiles
      @submission={{this.submission}}
      @previouslyUploadedFiles={{this.previouslyUploadedFiles}}
      @newFiles={{this.newFiles}}
      @next={{this.moo}}
      @back={{this.moo}}
      @abort={{this.moo}}
    />`);

    assert.dom('[data-test-added-manuscript-row]').doesNotExist();
    assert.dom('#file-multiple-input').exists();

    const files2Add = {
      files: [
        new File([new Blob(['Moo!'])], 'Added_file.moo', { type: 'application/moo' })
      ]
    };

    await triggerEvent('#file-multiple-input', 'change', files2Add);

    assert.dom('[data-test-added-manuscript-row]').exists();
    assert.dom('[data-test-added-manuscript-row]').includesText('Added_file.moo');
  });
});
