import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, Heart, MoreHorizontal, Upload, ThumbsUp, Clock, Bike, ChevronDown, ChevronRight, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';

// Circular badge accents, shared with the home restaurant cards.
const StatBadge = {
  rating: '#FFE980', // amber
  time: '#F58D1D', // orange
  delivery: '#3A974C', // green
} as const;

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
  onOpenPress?: () => void;
  onNamePress?: () => void;
  /** Hide the in-banner logo (kept as a spacer) when an animated overlay logo is used. */
  hideLogo?: boolean;
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
  onOpenPress,
  onNamePress,
  hideLogo,
}: RestaurantHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.bannerContainer}>
        <Image source={bannerImage} style={styles.bannerImage} contentFit="cover" />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconButton} onPress={onBackPress} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconButton} onPress={onFavoritePress} activeOpacity={0.7}>
              <Heart
                size={20}
                color="#FFFFFF"
                fill={isFavorite ? '#FFFFFF' : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onMorePress} activeOpacity={0.7}>
              <MoreHorizontal size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.brandRow}>
        <View style={[styles.logoContainer, hideLogo && styles.logoHidden]}>
          <Image source={logoImage} style={styles.logo} contentFit="cover" />
        </View>

        <View style={styles.tagsRow}>
          {isTopRated && (
            <View style={[styles.tag, styles.topRatedTag]}>
              <Upload size={13} color="#1A2B3D" />
              <Text style={styles.tagText}>Top Rated</Text>
            </View>
          )}
          {discount && (
            <View style={[styles.tag, styles.discountTag]}>
              <Text style={styles.discountTagText}>{discount}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.minOrderText}>
        Min value in this restaurant is {minOrder}
      </Text>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <TouchableOpacity style={styles.nameTouch} onPress={onNamePress} activeOpacity={0.7}>
            <Text style={styles.restaurantName}>{name}</Text>
            <Text style={styles.distance}>{distance}</Text>
            <ChevronRight size={18} color="#8A8A8A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.statusRow} onPress={onOpenPress} activeOpacity={0.7}>
            <Text style={[styles.statusText, isOpen ? styles.openText : styles.closedText]}>
              {isOpen ? 'Open' : 'Closed'}
            </Text>
            <ChevronDown size={16} color={isOpen ? '#4CAF50' : '#FF5252'} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statCell}>
            <Info size={12} color="#C4C4C4" style={styles.statInfo} />
            <View style={[styles.statBadge, { backgroundColor: StatBadge.rating }]}>
              <ThumbsUp size={18} color="#1A2B3D" />
            </View>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{rating}</Text>
              <Text style={styles.statLabel}> ({reviewCount})</Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCell}>
            <Info size={12} color="#C4C4C4" style={styles.statInfo} />
            <View style={[styles.statBadge, { backgroundColor: StatBadge.time }]}>
              <Clock size={18} color="#1A2B3D" />
            </View>
            <Text style={styles.statValue}>{deliveryTime}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCell}>
            <Info size={12} color="#C4C4C4" style={styles.statInfo} />
            <View style={[styles.statBadge, { backgroundColor: StatBadge.delivery }]}>
              <Bike size={18} color="#FFFFFF" />
            </View>
            <View style={styles.statValueRow}>
              {isFreeDelivery && (
                <View style={styles.freePill}>
                  <Text style={styles.freeText}>Free</Text>
                </View>
              )}
              <Text style={[styles.statValue, isFreeDelivery && styles.strikeFee]}>
                {deliveryFee}
              </Text>
            </View>
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
    height: 190,
    position: 'relative',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
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
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: -32,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#F07D00',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  logoHidden: {
    opacity: 0,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  tagsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingBottom: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    gap: 5,
  },
  topRatedTag: {
    backgroundColor: '#FFE980',
    borderColor: '#E5C84D',
  },
  tagText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  discountTag: {
    backgroundColor: '#003049',
    borderColor: '#00202F',
  },
  discountTagText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  minOrderText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    paddingLeft: 96,
    paddingRight: 16,
    marginTop: 6,
    textAlign: 'right',
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  nameTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
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
  },
  statusText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  openText: {
    color: '#4CAF50',
  },
  closedText: {
    color: '#FF5252',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 16,
    paddingVertical: 12,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 4,
  },
  statInfo: {
    position: 'absolute',
    top: 0,
    left: 12,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 4,
  },
  statBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
  freePill: {
    backgroundColor: '#E6F5EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginRight: 6,
  },
  freeText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#2E9E5B',
  },
  strikeFee: {
    color: '#8A8A8A',
    fontFamily: Fonts.regular,
    textDecorationLine: 'line-through',
  },
});
