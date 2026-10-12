// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'design system/**', 'scripts/web-preview/**'],
  },
  // Design-system guard (design system/handoff/DESIGN_SYSTEM.md §13): screens
  // and components read colours from the theme and render icons through
  // <Icon />. Hex values and Lucide live only in theme/.
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Use a colour token from useTheme()/createStyles instead of a hex literal.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'lucide-react-native', message: 'Render icons through <Icon name=… /> from @/theme.' },
            { name: '@expo/vector-icons', message: 'Render icons through <Icon name=… /> from @/theme.' },
          ],
        },
      ],
    },
  },
]);
