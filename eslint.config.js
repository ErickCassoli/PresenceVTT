// ESLint flat config for PresenceVTT.
//
// The app is vanilla JS with state shared as globals across plain <script>
// files (no ES modules — they break on file://). That makes `no-undef`
// unusable: every cross-file reference would trip it. So we disable the
// style/undefined noise and keep only rules that catch GENUINE bugs. A working
// build won't trip the "error" rules; a regression that does is worth a red CI.
'use strict';

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'lib/**', // vendored minified libs (pixi, howler)
      '**/*.min.js',
      'fonts/**',
      'build/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script', // no ES modules by design
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      // Noise for this architecture — intentionally off.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-control-regex': 'off',

      // Real bugs, but sometimes idiomatic here → warn (visible, non-fatal).
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-fallthrough': 'warn',
      'no-sparse-arrays': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-unexpected-multiline': 'warn',
      'no-compare-neg-zero': 'warn',
      'no-self-assign': 'warn',
      'no-async-promise-executor': 'warn',

      // Definite bugs — fail CI.
      'no-cond-assign': ['error', 'except-parens'],
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-func-assign': 'error',
      'no-obj-calls': 'error',
      'no-const-assign': 'error',
      'no-class-assign': 'error',
      'no-import-assign': 'error',
      'no-setter-return': 'error',
      'getter-return': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-finally': 'error',
    },
  },
];
