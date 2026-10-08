import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { TopBar } from '@/components/ds';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * The TopBar under the status bar, for the profile sub-screens that lay out
 * their own page: outlined back button + title (+ optional trailing).
 */
export function ScreenHeader({ title, trailing, divider }: { title: string; trailing?: ReactNode; divider?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <TopBar title={title} onBack={() => router.back()} backLabel={t('common.back')} trailing={trailing} divider={divider} />
    </View>
  );
}
