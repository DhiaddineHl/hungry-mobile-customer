import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Preferences the customer sets from the profile screen. Per device, like
 * every other persisted store here — they describe how THIS phone behaves,
 * not the account.
 */

export type Language = 'en' | 'fr';

interface SettingsState {
  /**
   * The customer's explicit language choice. `null` means "follow the device
   * locale" (see `i18n/index.ts`), which is what everyone starts on.
   */
  language: Language | null;
  /**
   * Whether the customer wants order updates pushed to this device. Distinct
   * from the OS permission: this is the in-app switch the stores ask for, so
   * a customer can opt out without digging through system settings, and back
   * in without being re-prompted. `usePushNotifications` registers the device
   * only while this is on and unregisters it when it is switched off.
   */
  notificationsEnabled: boolean;
  setLanguage: (language: Language | null) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: null,
      notificationsEnabled: true,
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'hungry-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
