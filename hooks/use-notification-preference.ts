import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/store/settings-store';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

/**
 * The "Order notifications" switch on the profile screen.
 *
 * Two things decide whether a push can reach this phone: the customer's own
 * choice (the in-app preference, persisted in `settings-store`) and the OS
 * permission. The switch owns the first; this hook reports the second as
 * `blocked`, so the screen can say "turned off in your phone settings" rather
 * than show an ON switch that does nothing — the state the stores flag as
 * misleading.
 *
 * Registration itself is not done here: `usePushNotifications` (root layout)
 * watches the preference and registers or unregisters the device. This hook
 * only records the choice and, when the OS is the obstacle, sends the customer
 * to the one place that can fix it.
 */
export function useNotificationPreference() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((state) => state.notificationsEnabled);
  const setEnabled = useSettingsStore((state) => state.setNotificationsEnabled);
  const [blocked, setBlocked] = useState(false);

  // Re-read the OS permission whenever the app comes back to the foreground —
  // that is exactly when a trip to the settings app has just ended.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    const check = () => {
      Notifications.getPermissionsAsync()
        .then((status) => {
          if (!cancelled) setBlocked(!status.granted && !status.canAskAgain);
        })
        .catch(() => {});
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const openSystemSettings = useCallback(() => {
    Alert.alert(
      t('profile.notifications.blockedTitle'),
      t('profile.notifications.blockedBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.openSettings'), onPress: () => Linking.openSettings().catch(() => {}) },
      ],
      { cancelable: true }
    );
  }, [t]);

  const toggle = useCallback(
    (next: boolean) => {
      setEnabled(next);
      // The preference is on but the OS will drop every push: say so now,
      // rather than let the customer wait for a notification that never comes.
      if (next && blocked) openSystemSettings();
    },
    [blocked, openSystemSettings, setEnabled]
  );

  return { enabled, blocked, toggle, openSystemSettings };
}
