import { View } from 'react-native';
import { Spinner, Text, TextLink } from '@/components/ds';
import type { CartSyncStatus } from '@/store/cart-store';
import { createStyles, Icon } from '@/theme';

/**
 * Whether the cart is saved to the account — one quiet caption line.
 *
 * `synced` is only ever set after the server calls have returned, never
 * optimistically. Every other state, including a cart not attempted because
 * the customer is signed out, reads "Not saved", because from the customer's
 * point of view that is exactly what it is.
 */
interface SyncBadgeProps {
  status: CartSyncStatus;
  /** Offered only on `error` — the failure is retryable, `idle` is not. */
  onRetry?: () => void;
}

export function SyncBadge({ status, onRetry }: SyncBadgeProps) {
  const styles = useStyles();
  if (status === 'syncing') {
    return (
      <View style={styles.line} accessibilityLiveRegion="polite">
        <Spinner size={14} />
        <Text variant="caption" color="inkMuted">
          Saving your cart…
        </Text>
      </View>
    );
  }

  if (status === 'synced') {
    return (
      <View style={styles.line}>
        <Icon name="check" size="inline" color="success" />
        <Text variant="caption" color="success">
          Saved to your account
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.line}>
      <Icon name={status === 'error' ? 'error' : 'info'} size="inline" color={status === 'error' ? 'danger' : 'inkMuted'} />
      <Text variant="caption" color={status === 'error' ? 'danger' : 'inkMuted'}>
        {status === 'error' ? "Couldn't save your cart." : 'Not saved to your account'}
      </Text>
      {status === 'error' && onRetry ? (
        <TextLink label="Try again" onPress={onRetry} accessibilityLabel="Retry saving this cart" />
      ) : null}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  line: { flexDirection: 'row', alignItems: 'center', gap: t.space[6] },
}));
