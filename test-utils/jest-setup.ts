/**
 * Global jest setup.
 *
 * Reanimated 4 / Worklets have a native half that is not initialised under
 * jest, so importing either throws before a single assertion runs. Every
 * design-system primitive animates (press scale, skeleton pulse, spinner), so
 * both are swapped for their official mocks here once, instead of each suite
 * mocking the component that happens to import them.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // Not covered by the stock mock; the primitives read it to honour Reduce Motion.
  return { ...mock, useReducedMotion: () => false };
});
