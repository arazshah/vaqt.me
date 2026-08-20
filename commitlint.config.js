module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0], // Allow any case
    'header-max-length': [2, 'always', 100],
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'ui', 'shared', 'db', 'infra', 'ci', 'docs'],
    ],
  },
};
