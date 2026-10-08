// Theme-aware StyleSheet factory. Components read every value from the theme
// (design system §1 how-to) without rebuilding their styles on each render:
//   const useStyles = createStyles((t) => ({ box: { backgroundColor: t.colors.surface } }));
//   const styles = useStyles();
import { StyleSheet } from 'react-native';
import { useTheme, type Theme } from './theme';

export function createStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
