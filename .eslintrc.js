module.exports = {
  parser: '@typescript-eslint/parser',
  env: {
    es6: true,
    node: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  rules: {
    semi: [
      'error',
      'always'
    ],
    quotes: [
      'error',
      'single'
    ],
    "comma-dangle": ["error", "always-multiline"],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/indent': [
      'error',
      2
    ],
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': 'next' }],
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
  }
}
