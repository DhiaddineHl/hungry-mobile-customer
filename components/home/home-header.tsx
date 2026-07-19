import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, Bell } from 'lucide-react-native';
import { Fonts, FontSize, Palette, Radius } from '@/constants/theme';
import { PressableScale } from '@/components/ui/pressable-scale';
import { AddressPopover } from '@/components/home/address-popover';
import { formatAddressName, useDeliveryAddress } from '@/hooks/use-delivery-address';
import { useAddressDraftStore } from '@/store/address-draft-store';
import LogoHungry from '@/assets/logo-hungry.svg';

interface HomeHeaderProps {
  notificationCount?: number;
  onNotificationPress?: () => void;
}

export function HomeHeader({
  notificationCount = 2,
  onNotificationPress,
}: HomeHeaderProps) {
  const router = useRouter();
  const { addresses, selected, selectedName, select } = useDeliveryAddress();
  const [popoverVisible, setPopoverVisible] = useState(false);

  const deliveryLocation = selected ? formatAddressName(selected.name) : 'Select location';

  // Starting a fresh single-address entry: clear any onboarding drafts so the
  // save screen commits just this new address, then jump into the map picker.
  const handleAddNew = () => {
    useAddressDraftStore.getState().clear();
    router.push('/map-select');
  };

  return (
    <View style={styles.container}>
      <PressableScale
        style={styles.locationContainer}
        onPress={() => setPopoverVisible(true)}
        scaleTo={0.97}
        accessibilityLabel={`Deliver to ${deliveryLocation}. Change address`}
      >
        <Text style={styles.deliverLabel}>DELIVER TO</Text>
        <View style={styles.locationRow}>
          <Text style={styles.locationText} numberOfLines={1}>
            {deliveryLocation}
          </Text>
          <ChevronDown size={16} color={Palette.primary} />
        </View>
      </PressableScale>

      <AddressPopover
        visible={popoverVisible}
        addresses={addresses}
        selectedName={selectedName}
        onClose={() => setPopoverVisible(false)}
        onSelect={select}
        onAddNew={handleAddNew}
      />

      <View style={styles.logoContainer}>
        <LogoHungry width={100} height={32} />
      </View>

      <PressableScale
        style={styles.notificationContainer}
        onPress={onNotificationPress}
        scaleTo={0.9}
        haptic
        accessibilityLabel={
          notificationCount > 0
            ? `Notifications, ${notificationCount} unread`
            : 'Notifications'
        }
      >
        <Bell size={24} color={Palette.ink} />
        {notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </Text>
          </View>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  locationContainer: {
    flex: 1,
  },
  deliverLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    flexShrink: 1,
    fontSize: FontSize.md,
    color: Palette.primary,
    fontFamily: Fonts.medium,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  notificationContainer: {
    flex: 1,
    alignItems: 'flex-end',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
