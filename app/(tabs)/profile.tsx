import { useState } from 'react';
import { Alert, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  Avatar,
  Badge,
  Card,
  ListGroup,
  ListRow,
  PillButton,
  Screen,
  SegmentedControl,
  Text,
  Toggle,
  TopBar,
  Touchable,
} from '@/components/ds';
import { useAuth } from '@/contexts/auth-context';
import { useCustomerOrders } from '@/hooks/use-customer-orders';
import { useNotificationPreference } from '@/hooks/use-notification-preference';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, useTranslation } from '@/i18n';
import { useSettingsStore } from '@/store/settings-store';
import { createStyles, Icon } from '@/theme';

/** Scroll distance after which the centred title bar appears (P2). */
const TITLE_BAR_AT = 48;

/**
 * P1–P2 Profile. Grouped lists: navy icons on neutral wells; orange kept for
 * signals (the in-progress count); red only for log out and account deletion.
 *
 * Account deletion lives on its own screen (`/delete-account`) rather than
 * behind a single confirmation: the stores require it to be easy to find but
 * deliberate.
 */
export default function ProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const notifications = useNotificationPreference();
  const { active } = useCustomerOrders();
  const [scrolled, setScrolled] = useState(false);

  const fullName =
    user?.name ??
    ([user?.given_name, user?.family_name].filter(Boolean).join(' ') || user?.preferred_username) ??
    t('profile.defaultName');

  const confirmLogout = () => {
    Alert.alert(
      t('profile.logout.confirmTitle'),
      t('profile.logout.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
      ],
      { cancelable: true },
    );
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > TITLE_BAR_AT;
    if (next !== scrolled) setScrolled(next);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const notificationsBlocked = notifications.enabled && notifications.blocked;

  return (
    <Screen>
      {scrolled ? <TopBar title={t('profile.title')} center divider /> : null}
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          {t('profile.title')}
        </Text>

        <Touchable onPress={() => router.push('/account-settings')} scaleTo={0.99} accessibilityLabel={`${fullName}, ${t('profile.accountManagement')}`}>
          <Card padded style={styles.profileCard}>
            <Avatar name={fullName} />
            <View style={styles.flex}>
              <Text variant="rowTitle" numberOfLines={1}>
                {fullName}
              </Text>
              {user?.email ? (
                <Text variant="meta" color="inkMuted" numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
            <Icon name="chevronRight" size="row" color="inkMuted" />
          </Card>
        </Touchable>

        <ListGroup title={t('profile.section.account')}>
          <ListRow icon="accountSettings" label={t('profile.accountManagement')} onPress={() => router.push('/account-settings')} />
          <ListRow
            icon="receipt"
            label={t('profile.myOrders')}
            onPress={() => router.push('/orders')}
            trailing={
              active.length > 0 ? <Badge label={t('profile.ordersInProgress', { count: String(active.length) })} variant="status" /> : undefined
            }
          />
        </ListGroup>

        <ListGroup title={t('profile.section.preferences')}>
          {/* Each language in its own name — a picker that says "French" in
              English is useless to the person who needs it. */}
          <ListRow
            icon="language"
            label={t('profile.language')}
            trailing={
              <SegmentedControl
                size="small"
                segments={SUPPORTED_LANGUAGES.map((option) => ({ key: option, label: LANGUAGE_NAMES[option] }))}
                value={language}
                onChange={setLanguage}
              />
            }
          />
          <ListRow
            icon={notifications.enabled && !notifications.blocked ? 'bell' : 'bellOff'}
            label={t('profile.notifications')}
            sub={notificationsBlocked ? t('profile.notifications.blocked') : t('profile.notifications.hint')}
            trailing={
              // The OS is the obstacle, not the preference: a switch that is ON
              // while nothing arrives is misleading, so the control becomes the
              // one action that helps.
              notificationsBlocked ? (
                <PillButton label={t('common.openSettings')} variant="outline" onPress={notifications.openSystemSettings} />
              ) : (
                <Toggle value={notifications.enabled} onValueChange={notifications.toggle} accessibilityLabel={t('profile.notifications')} />
              )
            }
          />
        </ListGroup>

        <ListGroup title={t('profile.section.helpLegal')}>
          <ListRow icon="help" label={t('profile.help')} onPress={() => router.push('/help/support')} />
          <ListRow icon="report" label={t('profile.report')} onPress={() => router.push('/help/report')} />
          <ListRow icon="terms" label={t('profile.terms')} onPress={() => router.push('/legal/terms')} />
          <ListRow icon="privacy" label={t('profile.privacy')} onPress={() => router.push('/legal/privacy')} />
        </ListGroup>

        <ListGroup title={t('profile.section.session')}>
          <ListRow icon="logout" label={t('profile.logout')} destructive chevron={false} onPress={confirmLogout} />
        </ListGroup>

        <ListGroup title={t('profile.section.danger')} danger>
          <ListRow
            icon="delete"
            label={t('profile.deleteAccount')}
            sub={t('profile.deleteAccount.hint')}
            destructive
            onPress={() => router.push('/delete-account')}
          />
        </ListGroup>

        <Text variant="caption" color="inkMuted" align="center" style={styles.version}>
          {t('profile.version', { version })}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: t.screenPadding, paddingBottom: t.space[32] },
  title: { marginTop: t.space[16], marginBottom: t.space[20] },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: t.space[14] },
  version: { marginTop: t.space[28] },
}));
