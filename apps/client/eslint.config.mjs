import baseConfig from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'lostarkHelper',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'lostark-helper',
          style: 'kebab-case',
        },
      ],
      '@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/prefer-inject': 'off',
      // Newly enabled by the angular-eslint 22 preset; components keep eager change detection on purpose.
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
      // Newly enabled by the ESLint 9 and typescript-eslint 8 recommended sets; not enforced before the upgrade.
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-constant-binary-expression': 'off',
    },
  },
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.html'],
    rules: {
      // ng-zorro's checkbox and radio are attributes on the label itself (<label nz-checkbox>), and the
      // component renders its input inside that label, so such a label counts as associated.
      '@angular-eslint/template/label-has-associated-control': [
        'error',
        {
          labelComponents: [
            { selector: 'label', inputs: ['for', 'htmlFor', 'nz-checkbox', 'nz-radio', 'nz-radio-button'] },
          ],
        },
      ],
    },
  },
];
