// Configuración moderna ESLint con ESM 🔍

import eslintPluginNext from 'eslint-plugin-next';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    plugins: {
      next: eslintPluginNext,
      react: eslintPluginReact,
      jsxA11y: eslintPluginJsxA11y,
    },
    rules: {
      'react/react-in-jsx-scope': 'off', // Next.js no lo necesita
      'jsx-a11y/alt-text': 'warn',
      'next/no-img-element': 'warn',
    },
  },
];
