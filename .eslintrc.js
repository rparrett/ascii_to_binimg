module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['airbnb-base', 'prettier'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    'no-console': ['warn', { allow: ['error'] }],
    'no-bitwise': 'off',
    'no-param-reassign': ['error', { props: false }],
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    'comma-dangle': 'off',
    'import/prefer-default-export': 'off',
  },
};
