import { SettingsRow } from '@/components/profile';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useNotificationPreference } from '@/hooks/use-notification-preference';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, useTranslation, type Language } from '@/i18n';
import { useSettingsStore } from '@/store/settings-store';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  Bell,
  BellOff,
  FileText,
  Flag,
  Languages,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The profile tab: who is signed in, the device preferences (language, order
 * notifications), the help & legal pages both stores expect to find from
 * here, and — kept apart from everything else — sign-out and account deletion.
 *
 * Account deletion lives on its own screen (`/delete-account`) rather than
 * behind a single confirmation: the stores require it to be easy to find but
 * deliberate, and the screen is where the customer is told what goes and what
 * is kept before they confirm.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const notifications = useNotificationPreference();

  const fullName =
    user?.name ??
    [user?.given_name, user?.family_name].filter(Boolean).join(' ') ??
    user?.preferred_username ??
    t('profile.defaultName');
  const initials =
    [user?.given_name, user?.family_name]
      .filter(Boolean)
      .map((part) => part!.charAt(0).toUpperCase())
      .join('') || fullName.charAt(0).toUpperCase();

  const confirmLogout = () => {
    Alert.alert(
      t('profile.logout.confirmTitle'),
      t('profile.logout.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
      ],
      { cancelable: true }
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={styles.screenTitle}>{t('profile.title')}</Text>

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

        <Text style={styles.sectionLabel}>{t('profile.section.account')}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<UserCog size={22} color={Palette.primary} />}
            label={t('profile.accountManagement')}
            onPress={() => router.push('/account-settings')}
          />
        </View>

        <Text style={styles.sectionLabel}>{t('profile.section.preferences')}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<Languages size={22} color={Palette.primary} />}
            label={t('profile.language')}
            trailing={
              <LanguagePicker value={language} onChange={setLanguage} />
            }
          />
          <SettingsRow
            divider
            icon={
              notifications.enabled && !notifications.blocked ? (
                <Bell size={22} color={Palette.primary} />
              ) : (
                <BellOff size={22} color={Palette.textMuted} />
              )
            }
            label={t('profile.notifications')}
            caption={
              notifications.enabled && notifications.blocked
                ? t('profile.notifications.blocked')
                : t('profile.notifications.hint')
            }
            trailing={
              // The OS is the obstacle, not the preference: a switch that is
              // ON while nothing arrives is the misleading state the stores
              // flag, so the control becomes the one action that helps.
              notifications.enabled && notifications.blocked ? (
                <PressableScale
                  style={styles.settingsButton}
                  onPress={notifications.openSystemSettings}
                  scaleTo={0.95}
                  haptic
                  accessibilityLabel={t('common.openSettings')}
                >
                  <Text style={styles.settingsButtonText}>{t('common.openSettings')}</Text>
                </PressableScale>
              ) : (
                <Switch
                  value={notifications.enabled}
                  onValueChange={notifications.toggle}
                  trackColor={{ false: Palette.border, true: Palette.primary }}
                  thumbColor={Palette.white}
                  ios_backgroundColor={Palette.border}
                  accessibilityLabel={t('profile.notifications')}
                />
              )
            }
          />
        </View>

        <Text style={styles.sectionLabel}>{t('profile.section.helpLegal')}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<LifeBuoy size={22} color={Palette.primary} />}
            label={t('profile.help')}
            onPress={() => router.push('/help/support')}
          />
          <SettingsRow
            divider
            icon={<Flag size={22} color={Palette.primary} />}
            label={t('profile.report')}
            onPress={() => router.push('/help/report')}
          />
          <SettingsRow
            divider
            icon={<FileText size={22} color={Palette.primary} />}
            label={t('profile.terms')}
            onPress={() => router.push('/legal/terms')}
          />
          <SettingsRow
            divider
            icon={<ShieldCheck size={22} color={Palette.primary} />}
            label={t('profile.privacy')}
            onPress={() => router.push('/legal/privacy')}
          />
        </View>

        <Text style={styles.sectionLabel}>{t('profile.section.session')}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<LogOut size={22} color={Palette.danger} />}
            label={t('profile.logout')}
            danger
            trailing={null}
            onPress={confirmLogout}
          />
        </View>

        <Text style={[styles.sectionLabel, styles.sectionLabelDanger]}>
          {t('profile.section.danger')}
        </Text>
        <View style={[styles.card, styles.cardDanger]}>
          <SettingsRow
            icon={<Trash2 size={22} color={Palette.danger} />}
            label={t('profile.deleteAccount')}
            caption={t('profile.deleteAccount.hint')}
            danger
            onPress={() => router.push('/delete-account')}
          />
        </View>

        <Text style={styles.version}>{t('profile.version', { version })}</Text>
      </ScrollView>
    </View>
  );
}

/**
 * Segmented EN / FR control. Shows each language's own name — a picker that
 * says "French" in English is useless to the person who needs it.
 */
function LanguagePicker({
  value,
  onChange,
}: {
  value: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {SUPPORTED_LANGUAGES.map((option) => {
        const selected = option === value;
        return (
          <PressableScale
            key={option}
            style={[styles.segmentOption, selected && styles.segmentOptionSelected]}
            onPress={() => onChange(option)}
            scaleTo={0.95}
            haptic
            accessibilityLabel={LANGUAGE_NAMES[option]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {LANGUAGE_NAMES[option]}
            </Text>
          </PressableScale>
        );
      })}
    </View>
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
  sectionLabelDanger: {
    color: Palette.danger,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.xxl,
    overflow: 'hidden',
  },
  cardDanger: {
    borderWidth: 1,
    borderColor: Palette.dangerSoft,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radius.pill,
    padding: 3,
  },
  segmentOption: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  segmentOptionSelected: {
    backgroundColor: Palette.surface,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Palette.textSecondary,
  },
  segmentTextSelected: {
    color: Palette.ink,
  },
  settingsButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
  },
  settingsButtonText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Palette.primary,
  },
  version: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
