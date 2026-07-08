import { View, Text, StyleSheet } from 'react-native';
import { ChevronDown, Bell } from 'lucide-react-native';
import { Fonts, FontSize, Palette, Radius } from '@/constants/theme';
import { PressableScale } from '@/components/ui/pressable-scale';
import LogoHungry from '@/assets/logo-hungry.svg';

interface HomeHeaderProps {
  deliveryLocation?: string;
  notificationCount?: number;
  onLocationPress?: () => void;
  onNotificationPress?: () => void;
}

export function HomeHeader({
  deliveryLocation = 'Home',
  notificationCount = 2,
  onLocationPress,
  onNotificationPress,
}: HomeHeaderProps) {
  return (
    <View style={styles.container}>
      <PressableScale
        style={styles.locationContainer}
        onPress={onLocationPress}
        scaleTo={0.97}
        accessibilityLabel={`Deliver to ${deliveryLocation}. Change address`}
      >
        <Text style={styles.deliverLabel}>DELIVER TO</Text>
        <View style={styles.locationRow}>
          <Text style={styles.locationText}>{deliveryLocation}</Text>
          <ChevronDown size={16} color={Palette.primary} />
        </View>
      </PressableScale>

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
