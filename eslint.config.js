import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const formattingRules = {
  'array-bracket-spacing': ['error', 'never'],
  'comma-dangle': ['error', 'always-multiline'],
  'eol-last': ['error', 'always'],
  indent: ['error', 2, { SwitchCase: 1 }],
  'object-curly-spacing': ['error', 'always'],
  quotes: ['error', 'single', { avoidEscape: true }],
  semi: ['error', 'always'],
}

export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules']),
  {
    files: ['frontend/**/*.{ts,tsx}', 'backend/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: formattingRules,
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['backend/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
