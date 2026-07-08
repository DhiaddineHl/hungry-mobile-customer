import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Returns a narrowed color scheme (`'light' | 'dark'`).
 *
 * React Native's `useColorScheme` can return `'unspecified' | null | undefined`;
 * we collapse anything that isn't explicitly dark to `'light'` so the value can
 * safely index theme token maps.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}
