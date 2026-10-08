import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Counter, IconButton, Text, Touchable } from '@/components/ds';
import { AddressPopover } from '@/components/home/address-popover';
import { formatAddressName, useDeliveryAddress } from '@/hooks/use-delivery-address';
import { useAddressDraftStore } from '@/store/address-draft-store';
import { createStyles, Icon } from '@/theme';

/** `Home · Sahloul` — the saved label, then the area it is in (design system §10). */
export function useDeliverToLabel(): string {
  const { selected } = useDeliveryAddress();
  if (!selected) return 'Choose an address';
  const area = selected.details.municipality ?? selected.details.state ?? null;
  const name = formatAddressName(selected.name);
  return area ? `${name} · ${area}` : name;
}

/**
 * Home header: "Deliver to" address switcher on the left (address first — it
 * decides what is available), the filled navy bell with its counter on the
 * right. Stays pinned while the page scrolls.
 */
export function HomeHeader({
  notificationCount = 0,
  onNotificationPress,
}: {
  notificationCount?: number;
  onNotificationPress?: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const { addresses, selectedName, select } = useDeliveryAddress();
  const label = useDeliverToLabel();
  const [popoverVisible, setPopoverVisible] = useState(false);

  // Starting a fresh single-address entry: clear any onboarding drafts so the
  // save screen commits just this new address, then jump into the map picker.
  const handleAddNew = () => {
    useAddressDraftStore.getState().clear();
    router.push('/map-select');
  };

  return (
    <View style={styles.header}>
      <Touchable
        onPress={() => setPopoverVisible(true)}
        scaleTo={0.98}
        accessibilityLabel={`Deliver to ${label}. Change address`}
        style={styles.address}
      >
        <Text variant="caption" color="inkMuted">
          Deliver to
        </Text>
        <View style={styles.addressLine}>
          <Text variant="rowTitle" numberOfLines={1} style={styles.shrink}>
            {label}
          </Text>
          <Icon name="chevronDown" size="row" />
        </View>
      </Touchable>

      <IconButton
        icon="bell"
        variant="filled"
        onPress={onNotificationPress}
        accessibilityLabel={notificationCount > 0 ? `Notifications, ${notificationCount} unread` : 'Notifications'}
        badge={notificationCount > 0 ? <Counter count={notificationCount} ring /> : undefined}
      />

      <AddressPopover
        visible={popoverVisible}
        addresses={addresses}
        selectedName={selectedName}
        onClose={() => setPopoverVisible(false)}
        onSelect={select}
        onAddNew={handleAddNew}
      />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[12],
    paddingHorizontal: t.screenPadding,
    paddingTop: t.space[8],
    paddingBottom: t.space[8],
    backgroundColor: t.colors.background,
  },
  address: { flex: 1, minHeight: t.size.minTouch, justifyContent: 'center' },
  addressLine: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
  shrink: { flexShrink: 1 },
}));
