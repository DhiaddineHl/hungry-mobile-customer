import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, Heart, MoreHorizontal, ThumbsUp, Clock, Bike, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';

interface RestaurantHeaderProps {
  name: string;
  distance: string;
  rating: string;
  reviewCount: string;
  deliveryTime: string;
  deliveryFee: string;
  isFreeDelivery: boolean;
  minOrder: string;
  isOpen: boolean;
  isNew?: boolean;
  isTopRated?: boolean;
  discount?: string;
  bannerImage: any;
  logoImage: any;
  isFavorite?: boolean;
  onBackPress?: () => void;
  onFavoritePress?: () => void;
  onMorePress?: () => void;
}

export function RestaurantHeader({
  name,
  distance,
  rating,
  reviewCount,
  deliveryTime,
  deliveryFee,
  isFreeDelivery,
  minOrder,
  isOpen,
  isNew,
  isTopRated,
  discount,
  bannerImage,
  logoImage,
  isFavorite,
  onBackPress,
  onFavoritePress,
  onMorePress,
}: RestaurantHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.bannerContainer}>
        <Image source={bannerImage} style={styles.bannerImage} contentFit="cover" />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconButton} onPress={onBackPress}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconButton} onPress={onFavoritePress}>
              <Heart
                size={22}
                color="#FFFFFF"
                fill={isFavorite ? '#FFFFFF' : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onMorePress}>
              <MoreHorizontal size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}

        <View style={styles.logoContainer}>
          <Image source={logoImage} style={styles.logo} contentFit="contain" />
        </View>

        <View style={styles.tagsContainer}>
          {isTopRated && (
            <View style={styles.tag}>
              <ThumbsUp size={12} color="#1A2B3D" />
              <Text style={styles.tagText}>Top Rated</Text>
            </View>
          )}
          {discount && (
            <View style={[styles.tag, styles.discountTag]}>
              <Text style={styles.discountTagText}>{discount}</Text>
            </View>
          )}
        </View>

        <Text style={styles.minOrderText}>Min value in this restaurant is {minOrder}</Text>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.restaurantName}>{name}</Text>
          <Text style={styles.distance}>{distance}</Text>
        </View>

        <TouchableOpacity style={styles.statusRow}>
          <Text style={[styles.statusText, isOpen ? styles.openText : styles.closedText]}>
            {isOpen ? 'Open' : 'Closed'}
          </Text>
          <ChevronDown size={16} color={isOpen ? '#4CAF50' : '#FF5252'} />
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThumbsUp size={18} color="#F5A623" />
            <Text style={styles.statValue}>{rating}</Text>
            <Text style={styles.statLabel}>({reviewCount})</Text>
          </View>
          <View style={styles.statItem}>
            <Clock size={18} color="#F5A623" />
            <Text style={styles.statValue}>{deliveryTime}</Text>
          </View>
          <View style={styles.statItem}>
            <Bike size={18} color="#F5A623" />
            <Text style={[styles.statValue, isFreeDelivery && styles.freeText]}>
              {isFreeDelivery ? 'Free' : deliveryFee}
            </Text>
            {!isFreeDelivery && <Text style={styles.statLabel}>{deliveryFee}</Text>}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  bannerContainer: {
    height: 220,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#F5A623',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  logoContainer: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: 50,
    height: 50,
  },
  tagsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 90,
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  discountTag: {
    backgroundColor: '#1A2B3D',
  },
  discountTagText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  minOrderText: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#FFFFFF',
  },
  infoContainer: {
    padding: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
  },
  distance: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  openText: {
    color: '#4CAF50',
  },
  closedText: {
    color: '#FF5252',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
  freeText: {
    color: '#4CAF50',
  },
});
