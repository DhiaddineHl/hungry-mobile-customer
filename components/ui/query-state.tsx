import { PressableScale } from "@/components/ui/pressable-scale";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { ApiError } from "@/services/api/client";
import { RefreshCw } from "lucide-react-native";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * Shared rendering for the three states every fetched list has to handle, so
 * a screen never falls through to a blank view when a request fails or a
 * collection comes back empty.
 */

interface QueryErrorProps {
  error: unknown;
  onRetry?: () => void;
}

/** Surfaces the message `ApiError` already extracted from the backend's payload. */
export function QueryError({ error, onRetry }: QueryErrorProps) {
  const message =
    error instanceof ApiError
      ? error.message
      : "Something went wrong. Please try again.";

  return (
    <View style={styles.state}>
      <Text style={styles.title}>Couldn&apos;t load restaurants</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry && (
        <PressableScale
          style={styles.retryButton}
          onPress={onRetry}
          scaleTo={0.95}
          haptic
          accessibilityLabel="Retry loading restaurants"
        >
          <RefreshCw size={16} color={Palette.textInverse} />
          <Text style={styles.retryText}>Retry</Text>
        </PressableScale>
      )}
    </View>
  );
}

interface QueryEmptyProps {
  title: string;
  body?: string;
}

export function QueryEmpty({ title, body }: QueryEmptyProps) {
  return (
    <View style={styles.state}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  /** Rendered while loading — a skeleton matching the real content's geometry. */
  loading: ReactNode;
  emptyTitle: string;
  emptyBody?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Picks between loading / error / empty / content. Error is checked before
 * empty so a failed request never reads as "no restaurants here".
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  loading,
  emptyTitle,
  emptyBody,
  onRetry,
  children,
}: QueryStateProps) {
  if (isLoading) return <>{loading}</>;
  if (error) return <QueryError error={error} onRetry={onRetry} />;
  if (isEmpty) return <QueryEmpty title={emptyTitle} body={emptyBody} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  state: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
    textAlign: "center",
  },
  body: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
  },
  retryText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
