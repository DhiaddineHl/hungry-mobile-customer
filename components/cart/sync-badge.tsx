import { PressableScale } from "@/components/ui/pressable-scale";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import type { CartSyncStatus } from "@/store/cart-store";
import { Check, CloudOff, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * Whether one restaurant's cart has reached the server.
 *
 * Deliberately only ever claims success for `synced`, which the sync engine
 * writes after a create has returned — never optimistically. Every other state,
 * including a cart that has not been attempted because the customer is signed
 * out, reads as "Not saved", because from the customer's point of view that is
 * exactly what it is.
 *
 * It says nothing about addons, notes or prices: those are never sent, so
 * "Saved" must not be read as covering them (see `cart-view-model.ts`).
 */
interface SyncBadgeProps {
  status: CartSyncStatus;
  /** Offered only on `error` — the failure is retryable, `idle` is not. */
  onRetry?: () => void;
}

export function SyncBadge({ status, onRetry }: SyncBadgeProps) {
  if (status === "syncing") {
    return (
      <View style={styles.badge}>
        <ActivityIndicator size="small" color={Palette.textMuted} />
        <Text style={styles.mutedLabel}>Saving…</Text>
      </View>
    );
  }

  if (status === "synced") {
    return (
      <View style={[styles.badge, styles.syncedBadge]}>
        <Check size={12} color={Palette.success} />
        <Text style={styles.syncedLabel}>Saved</Text>
      </View>
    );
  }

  return (
    <View style={styles.badge}>
      <CloudOff size={12} color={Palette.textMuted} />
      <Text style={styles.mutedLabel}>Not saved</Text>
      {status === "error" && onRetry ? (
        <PressableScale
          style={styles.retry}
          onPress={onRetry}
          scaleTo={0.94}
          accessibilityLabel="Retry saving this cart"
        >
          <RefreshCw size={12} color={Palette.primary} />
          <Text style={styles.retryLabel}>Retry</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
  },
  syncedBadge: {
    // No surface of its own: a success state should read as quietly as
    // possible next to the cart's own content.
    backgroundColor: "transparent",
  },
  mutedLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
  },
  syncedLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    color: Palette.success,
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    marginLeft: Spacing.xs,
  },
  retryLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Palette.primary,
  },
});
