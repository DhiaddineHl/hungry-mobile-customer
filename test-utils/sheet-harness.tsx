import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * Renders a `BottomSheet`-based component under a `SafeAreaProvider`.
 *
 * `BottomSheet` calls `useSafeAreaInsets`, which throws outside a provider, so
 * every sheet test needs one. The metrics are a plain notched-phone frame —
 * nothing in these components reads them beyond the bottom inset.
 *
 * Lives outside `__tests__/` on purpose: jest-expo's `testMatch` treats every
 * file under a `__tests__` directory as a suite, so a helper placed there would
 * fail with "your test suite must contain at least one test".
 *
 * NOTE: `render` is ASYNC in RNTL 14 — `await` this, or the queries on `screen`
 * are still unbound and every assertion throws "render function has not been
 * called".
 */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderSheet(ui: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);
}
