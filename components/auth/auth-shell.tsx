import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomBar } from '@/components/ds';
import { createStyles, useTheme } from '@/theme';
import { AuthHeader } from './auth-header';

/**
 * Every auth step: AuthHeader, then the white AuthSheet overlapping it by 28
 * (top radius 28, padding 28×24, gap 20). `footer` pins an action to a
 * BottomBar (Sign up's Create account) instead of flowing in the sheet.
 */
export function AuthShell({
  children,
  compact,
  footer,
}: {
  children: ReactNode;
  compact?: boolean;
  footer?: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { space } = useTheme();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.grow}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AuthHeader compact={compact} />
          <View style={[styles.sheet, !footer && { paddingBottom: insets.bottom + space[28] }]}>{children}</View>
        </ScrollView>
        {footer ? <BottomBar absolute={false}>{footer}</BottomBar> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.surface },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  sheet: {
    flex: 1,
    marginTop: -t.size.authSheetOverlap,
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    paddingTop: t.space[28],
    paddingHorizontal: t.screenPadding,
    gap: t.space[20],
  },
}));
