/* eslint-disable indent */
import Ember from 'ember';
import Service from '@ember/service';
import ENV from 'pass-ember/config/environment';
import Ajv from 'ajv'; // https://github.com/epoberezkin/ajv
import _ from 'lodash';

/**
 * Service to manipulate Alpaca schemas
 */
export default Service.extend({
  ajax: Ember.inject.service('ajax'),
  schemaService: ENV.schemaService,

  // JSON schema validator
  validator: undefined,

  init() {
    this._super(...arguments);
    /**
     * We can adjust logging for the JSON schema validator here.
     *
     * Currently, logging is simply disabled.
     *
     * We could set 'logger' to an object with `log`, `warn`, and `error` functions
     * to handle these things, if there is a need.
     */
    this.set('validator', new Ajv({
      logger: false
    }));
  },

  /**
   *
   * @param {array} repositories list of repository URIs
   * @returns {array} list of schemas relevant to the given repositories
   */
  getMetadataSchemas(repositories) {
    const areObjects = repositories.map(repos => typeof repos).includes('object');
    if (areObjects) {
      // If we've gotten repository objects, map them to their IDs
      repositories = repositories.map(repo => repo.get('id'));
    }
    const url = this.get('schemaService.url');

    return this.get('ajax').request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      processData: false,
      data: repositories
    });
  },

  /**
   * Add data to a metadata form schema to be prepopulated in the rendered form. Optionally
   * force these fields to be read-only.
   *
   * @param {object} schema metadata (form) schema
   * @param {object} data display data to add to the schema
   * @param {boolean} setReadOnly force updated fields to be read-only in the generated form
   * @Returns {object} the modified schema
   */
  addDisplayData(schema, data, setReadOnly) {
    if (!schema.data) {
      schema.data = {};
    }
    schema.data = Object.assign(schema.data, data);

    if (setReadOnly) {
      Object.keys(data).forEach((key) => {
        if (schema.options.fields.hasOwnProperty(key)) {
          schema.options.fields[key].readonly = true;
        }
      });
    }

    return schema;
  },

  /**
   * Map a JSON schema to on that Alpaca will recognize.
   *
   * @param {object} schema JSON schema from the schema service
   */
  alpacafySchema(schema) {
    if (!schema.hasOwnProperty('definitions')) {
      return schema;
    }
    return {
      schema: schema.definitions.form,
      options: schema.definitions.options || schema.definitions.form.options
    };
  },

  validate(schema, data) {
    return this.get('validator').validate(schema, data);
  },

  getErrors() {
    return this.get('validator').errors;
  },

  /**
   * Get all unique field names across a set of schema. For each schema,
   *
   * @param {array} schemas array of schemas
   */
  getFields(schemas) {
    let fields = [];

    schemas.map(schema => this.alpacafySchema(schema))
      .forEach((schema) => {
        Object.keys(schema.schema.properties)
          .filter(key => !fields.includes(key))
          .forEach(key => fields.push(key));
      });

    /**
     * Add fields from properties defined in schema.allOf
     * Make sure the top level `schema.additionalProperties` is not explicitly set to FALSE
     */
    schemas.filter(schema => (schema.additionalProperties !== false) && schema.allOf)
      .map(schema => schema.allOf)
      .forEach((allOf) => {
        allOf.filter(schema => schema.properties)
          .map(schema => schema.properties)
          .forEach((props) => {
            Object.keys(props).filter(key => !fields.includes(key))
              .forEach(key => fields.push(key));
          });
      });

    return fields;
  },

  /**
   * Return map from field key to field title. Use title from the schema or
   * just munge the key.
   *
   * @param {array} schemas array of schemas
   */
  getFieldTitleMap(schemas) {
    let map = {};

    schemas.forEach((schema) => {
      let props = schema.definitions.form.properties;

      Object.keys(props).forEach((key) => {
        let title = props[key].title;

        if (!title) {
          title = _.capitalize(key.replace('-', ' '));
        }

        map[key] = title;
      });
    });

    return map;
  },

  /**
   * Merge data from metadata blob2 into metadata blob1 and output the result as a new
   * object (this operation will not mutate either input objects). Broken out here in
   * case special logic needs to be assigned.
   *
   * Impl note: each blob now has a default value set of an empty object because
   * Object.assign will die if any arguments is undefined
   *
   * @param {object} blob1 arbitrary JSON object representing metadata for a submission
   * @param {object} blob2 arbitrary JSON object representing metadata for a submission
   */
  mergeBlobs(blob1 = {}, blob2 = {}) {
    let blob = Object.assign(blob1, blob2);
    Object.keys(blob).filter(key => !blob[key]).forEach(key => delete blob[key]);
    return blob;
  },

  /**
   * Get a metadata blob containing information about repository agreements. The resulting
   * object can be merged into the larger metadata blob with #mergeBlobs.
   *
   * @param {object} repositories list of Repository model objects
   * @returns {
   *    'agreements': [
   *      {
   *        Repository.name: Repository.agreementText
   *      }
   *    ]
   * }
   */
  getAgreementsBlob(repositories) {
    const result = [];

    repositories.filter(repo => repo.get('agreementText')).forEach(repo => result.push({
      [repo.get('name')]: repo.get('agreementText')
    }));

    return {
      agreements: result
    };
  },

  /**
   * Returns an array of values suitable to display the metadata asscoiated with a
   * submission.
   *
   * @param {*} submission
   * @returns [{label, value, isArray}]
   */
  async displayMetadata(submission) {
      // Metadata keys to ignore (not display)
    const ignoreList = ['agent_information', '$schema'];

    const schemas = await this.getMetadataSchemas(submission.get('repositories'));
    const titleMap = this.getFieldTitleMap(schemas);
    const metadata = JSON.parse(submission.get('metadata'));

    const result = [];

    Object.keys(metadata).filter(key => !ignoreList.includes(key)).forEach((key) => {
      let value = metadata[key];
      const isArray = Array.isArray(value);

      if (!value || (isArray && value.length === 0)) {
        return;
      } else if (isArray && value.hasOwnProperty('toArray')) {
        value = value.toArray();
      }

      result.push({
        label: titleMap[key],
        value,
        isArray
      });
    });

    return result;
  }
});
