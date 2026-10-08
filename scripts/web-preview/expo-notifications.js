// Web-preview stand-in for expo-notifications (its native APIs throw on web).
// Every export is a no-op; listeners return a removable subscription.
const subscription = { remove() {} };
const known = {
  getLastNotificationResponse: () => null,
  getLastNotificationResponseAsync: async () => null,
  useLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: () => subscription,
  addNotificationReceivedListener: () => subscription,
  addPushTokenListener: () => subscription,
  getPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: false }),
  requestPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: false }),
  getExpoPushTokenAsync: async () => ({ data: 'web-preview' }),
  getDevicePushTokenAsync: async () => ({ data: 'web-preview' }),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
};
module.exports = new Proxy(known, {
  get: (target, prop) => (prop in target ? target[prop] : prop === '__esModule' ? true : async () => null),
});
