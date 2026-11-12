import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const layer = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/domain/generated'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  // Layer boundaries (see openspec config: domain <- application <- infrastructure/ui)
  {
    files: ['src/domain/**/*.ts'],
    rules: layer(
      ['**/application/**', '**/infrastructure/**', '**/ui/**', 'react', 'react-dom'],
      'domain must stay pure: no imports from other layers or React.',
    ),
  },
  {
    files: ['src/application/**/*.ts'],
    rules: layer(
      ['**/infrastructure/**', '**/ui/**', 'react', 'react-dom'],
      'application may only depend on domain.',
    ),
  },
  {
    files: ['src/ui/atoms/**/*.{ts,tsx}', 'src/ui/molecules/**/*.{ts,tsx}'],
    rules: layer(
      ['**/application/**', '**/infrastructure/**', '**/organisms/**', '**/templates/**', '**/pages/**'],
      'atoms and molecules are props-only: no application/session access or higher atomic levels.',
    ),
  },
);
