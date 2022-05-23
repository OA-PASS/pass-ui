/* eslint-disable ember/no-computed-properties-in-native-classes, ember/no-get, ember/require-computed-property-dependencies */
import Component from '@glimmer/component';
import { action, get, set, computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { A } from '@ember/array';
import { task } from 'ember-concurrency-decorators';

export default class WorkflowFiles extends Component {
  @service store;
  @service workflow;
  @service submissionHandler;
  @service currentUser;

  @computed('manuscript')
  get hasManuscript() {
    return !!get(this, 'manuscript');
  }

  @computed('args.newFiles.[]', 'previouslyUploadedFiles.[]')
  get manuscript() {
    const newFiles = get(this, 'args.newFiles') || A([]);
    const prevFiles = get(this, 'args.previouslyUploadedFiles') || A([]);

    return [...prevFiles.toArray(), ...newFiles.toArray()].find((file) => file.fileRole === 'manuscript');
  }

  /**
   * Any non-manuscript files
   */
  @computed('args.newFiles.[]', 'previouslyUploadedFiles.[]')
  get supplementalFiles() {
    const newFiles = get(this, 'args.newFiles') || A([]);
    const prevFiles = get(this, 'args.previouslyUploadedFiles') || A([]);

    return [...prevFiles.toArray(), ...newFiles.toArray()].filter((file) => file.fileRole !== 'manuscript');
  }

  _getFilesElement() {
    return document.getElementById('file-multiple-input');
  }

  @task
  handleExternalMs = function* (file) {
    const newFiles = get(this, 'args.newFiles');

    file.set('submission', get(this, 'args.submission'));
    if (!get(this, 'hasManuscript')) {
      file.set('fileRole', 'manuscript');
    } else {
      file.set('fileRole', 'supplemental');
    }

    newFiles.pushObject(file);
    yield file.save();
  };

  @action
  deleteExistingFile(file) {
    swal({
      title: 'Are you sure?',
      text: 'If you delete this file, it will be gone forever.',
      type: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'I Agree',
      cancelButtonText: 'Never mind',
    }).then((result) => {
      if (result.value) {
        const mFiles = get(this, 'args.previouslyUploadedFiles');
        // Remove the file from the model
        if (mFiles) {
          mFiles.removeObject(file);
        }

        const newFiles = get(this, 'args.newFiles');
        if (newFiles) {
          newFiles.removeObject(file);
        }

        this.submissionHandler.deleteFile(file);

        document.querySelector('#file-multiple-input').value = null;
      }
    });
  }

  @action
  getFiles() {
    const uploads = this._getFilesElement();
    if ('files' in uploads) {
      if (uploads.files.length !== 0) {
        for (let i = 0; i < uploads.files.length; i++) {
          const file = uploads.files[i];
          if (file) {
            if (file.size > 1024 * 1024 * 100) {
              toastr.error(
                `Your file '${file.name}' is ${Number.parseFloat(file.size / 1024 / 1024).toPrecision(
                  3
                )}MB. This exceeds the maximum upload size of 100MB and the file was not added to the submission.`
              );
              continue; // eslint-disable-line
            }
            const newFile = this.store.createRecord('file', {
              name: file.name,
              mimeType: file.type.substring(file.type.indexOf('/') + 1),
              description: file.description,
              fileRole: 'supplemental',
              _file: file,
            });
            if (!get(this, 'hasManuscript')) {
              newFile.set('fileRole', 'manuscript');
            }
            get(this, 'args.newFiles').pushObject(newFile);

            // Immediately upload file
            this.submissionHandler.uploadFile(this.args.submission, newFile);
          }
        }
      }
    }
  }

  @action
  removeFile(file) {
    let files = this.args.newFiles;
    files.removeObject(file);
    set(this, 'files', files);

    this.submissionHandler.deleteFile(file);
  }

  @action
  cancel() {
    this.abort();
  }
}
