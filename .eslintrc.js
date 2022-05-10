module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      legacyDecorators: true,
    },
  },
  plugins: ['ember'],
  extends: ['eslint:recommended', 'plugin:ember/recommended'],
  env: {
    browser: true,
  },

  rules: {
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'no-underscore-dangle': 'off',
    'no-undef': 'off',
    'func-names': 'off',
    eqeqeq: 'off',
    'one-var': 'off',
    'prefer-rest-params': 'off',
    // eventually re-enable these:
    'max-len': 'off',
    'prefer-destructuring': 'off',
    'no-plusplus': 'off',
    'no-prototype-builtins': 'off',
    'no-restricted-properties': 'off',
    'prefer-const': 'off',
    'block-scoped-var': 'off',
    'vars-on-top': 'off',
    'no-console': 'off',
    'no-shadow': 'off',
    'no-unused-vars': 'off',
    'no-var': 'off',
    'no-redeclare': 'off',
    'guard-for-in': 'off',
    'no-restricted-syntax': 'off',
    'no-param-reassign': 'off',
    'import/first': 'off',
    'no-mixed-operators': 'off',
    'no-throw-literal': 'off',
    'consistent-return': 'off',
    'import/no-extraneous-dependencies': 'off',
    'no-restricted-globals': 'off',
    'comma-dangle': 'off',
    'array-callback-return': 'off',
    'no-lonely-if': 'off',
    'no-useless-escape': 'off',
    'class-methods-use-this': 'off',
    'generator-star-spacing': 'off',
    // we're not enabling this yet
    // 'ember/no-jquery': 'error'
  },
  ignorePatterns: [
    '.eslintrc.js',
    '.prettierrc.js',
    '.template-lintrc.js',
    'ember-cli-build.js',
    'testem.js',
    'blueprints/*/index.js',
    'config/**/*.js',
    'lib/*/index.js',
    'server/**/*.js',
    'dist/**/*',
  ],
  overrides: [
    // node files
    {
      files: [
        '.template-lintrc.js',
        'ember-cli-build.js',
        'testem.js',
        'blueprints/*/index.js',
        'config/**/*.js',
        'lib/*/index.js',
      ],
      parserOptions: {
        sourceType: 'script',
      },
      env: {
        browser: false,
        node: true,
      },
    },
    // ember tests
    {
      files: ['**/tests/**/*-test.js'],
      rules: {
        'prefer-arrow-callback': 'off',
      },
    },
  ],
};
