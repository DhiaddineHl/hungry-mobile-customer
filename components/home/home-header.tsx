import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, Bell } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

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
      <TouchableOpacity style={styles.locationContainer} onPress={onLocationPress}>
        <Text style={styles.deliverLabel}>DELIVER TO</Text>
        <View style={styles.locationRow}>
          <Text style={styles.locationText}>{deliveryLocation}</Text>
          <ChevronDown size={16} color="#F5A623" />
        </View>
      </TouchableOpacity>

      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/logo-hungry.svg')}
          style={styles.logo}
          contentFit="contain"
        />
      </View>

      <TouchableOpacity style={styles.notificationContainer} onPress={onNotificationPress}>
        <Bell size={24} color="#1A2B3D" />
        {notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{notificationCount}</Text>
          </View>
        )}
      </TouchableOpacity>
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
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#F5A623',
    fontFamily: Fonts.medium,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 32,
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
    backgroundColor: '#F5A623',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
});
