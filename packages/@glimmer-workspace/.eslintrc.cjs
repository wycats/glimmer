const { resolve } = require('path');

const tsconfig = resolve(__dirname, 'tsconfig.json');

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  overrides: [
    {
      files: ['*/index.{js,ts,d.ts}', '*/lib/**/*.{js,ts,d.ts}', '*/test/**/*.{js,ts,d.ts}'],
      excludedFiles: ['node_modules', '*/node_modules'],
      parserOptions: {
        ecmaVersion: 'latest',
        project: [tsconfig],
      },
      plugins: ['@glimmer-workspace'],
      extends: ['plugin:@glimmer-workspace/recommended'],
    },
    // QUnit is a weird package, and there are some issues open about fixing it
    // - https://github.com/qunitjs/qunit/issues/1729
    // - https://github.com/qunitjs/qunit/issues/1727
    // - https://github.com/qunitjs/qunit/issues/1724
    {
      files: ['**/*-test.ts', '**/{test,integration-tests}/**/*.ts'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
      },
    },
  ],
};