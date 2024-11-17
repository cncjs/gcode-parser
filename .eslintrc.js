module.exports = {
  extends: 'eslint:recommended',
  parser: '@babel/eslint-parser',
  env: {
    browser: true,
    node: true,
    jest: true,
  },
  plugins: [
    '@babel',
  ],
  rules: {
  },
};
