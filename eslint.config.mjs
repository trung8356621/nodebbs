import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['**/node_modules/**', 'virtual-store/**', '**/.next/**', '.local/**', '**/dist/**'] },
  {
    files: ['apps/web/src/**/*.{js,jsx}', 'apps/api/src/**/*.js', 'scripts/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, React: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'no-undef': 'error', 'no-dupe-args': 'error', 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'react-hooks/rules-of-hooks': 'error' },
  },
];
