import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, UserCog } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const fullName =
    user?.name ??
    [user?.given_name, user?.family_name].filter(Boolean).join(' ') ??
    user?.preferred_username ??
    'Hungry user';
  const initials =
    [user?.given_name, user?.family_name]
      .filter(Boolean)
      .map((part) => part!.charAt(0).toUpperCase())
      .join('') || fullName.charAt(0).toUpperCase();

  const confirmLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => logout() },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={styles.screenTitle}>Profile</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {fullName}
            </Text>
            {!!user?.email && (
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <LinkRow
            icon={<UserCog size={22} color={Palette.primary} />}
            label="Account Management"
            onPress={() => router.push('/account-settings')}
          />
        </View>

        <Text style={styles.sectionLabel}>Session</Text>
        <View style={styles.card}>
          <LinkRow
            icon={<LogOut size={22} color={Palette.danger} />}
            label="Logout"
            danger
            showChevron={false}
            onPress={confirmLogout}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  danger = false,
  showChevron = true,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  showChevron?: boolean;
}) {
  return (
    <PressableScale
      style={styles.row}
      onPress={onPress}
      scaleTo={0.98}
      dimTo={0.6}
      haptic
      accessibilityLabel={label}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>{icon}</View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {showChevron && <ChevronRight size={20} color={Palette.textMuted} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: Spacing.xl,
  },
  screenTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.display,
    color: Palette.ink,
    marginBottom: Spacing.xl,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  avatarText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.xl,
    color: Palette.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.lg,
    color: Palette.ink,
  },
  userEmail: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.xxl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  rowIconDanger: {
    backgroundColor: Palette.dangerSoft,
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSize.lg,
    color: Palette.ink,
  },
  rowLabelDanger: {
    color: Palette.danger,
  },
});
