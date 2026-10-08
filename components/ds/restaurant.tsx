import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useRestaurantImageSource } from '@/hooks/use-restaurant-image';
import type { RestaurantSummary } from '@/services/api/restaurant-view-model';
import { useFavoritesStore, useIsFavorite } from '@/store/favorites-store';
import { createStyles, Icon, useTheme } from '@/theme';
import { Badge, PromoTag } from './badges';
import { MetaRow } from './content';
import { Skeleton } from './feedback';
import { Text } from './text';
import { Touchable } from './touchable';

/** One text meta line for rows: `94% · 25–40 min · Free delivery`. */
function metaLine(r: RestaurantSummary): { liked?: string; rest: string } {
  const fee = r.isFreeDelivery ? 'Free delivery' : r.deliveryFee ? `${r.deliveryFee} delivery` : null;
  const rest = [r.deliveryTime, fee].filter(Boolean).join(' · ');
  return { liked: r.rating, rest };
}

/** Closed badge copy. The catalog has no "opens at" yet, so it says what it knows. */
export const CLOSED_LABEL = 'Closed';

/** Heart toggle shared by cards and rows — saves the relative logo path. */
function useFavouriteToggle(restaurant: RestaurantSummary) {
  const isFavorite = useIsFavorite('restaurant', restaurant.id);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const toggle = () =>
    toggleFavorite({
      id: restaurant.id,
      type: 'restaurant',
      name: restaurant.name,
      // The RELATIVE path, not the resolved URL: an absolute one would bake in
      // whatever API host was configured when the favorite was saved.
      image: restaurant.logoPath,
      subtitle: restaurant.categories,
      rating: restaurant.rating,
    });
  return { isFavorite, toggle };
}

// ---------------------------------------------------------------------------
// RestaurantCard — 172 image (radius 20) with the navy promo tag bottom-left
// and a white favourite button top-right; name (cardTitle), cuisine (meta),
// MetaRow.
// ---------------------------------------------------------------------------

export function RestaurantCard({
  restaurant,
  onPress,
  style,
}: {
  restaurant: RestaurantSummary;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { opacity } = useTheme();
  const imageSource = useRestaurantImageSource();
  const { isFavorite, toggle } = useFavouriteToggle(restaurant);
  const closed = restaurant.isOpen === false;

  return (
    <Touchable
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={`${restaurant.name}${restaurant.categories ? `, ${restaurant.categories}` : ''}${closed ? ', closed' : ''}`}
      style={[styles.card, style]}
    >
      <View style={styles.cardImageBox}>
        <Image
          source={imageSource(restaurant.bannerImage ?? restaurant.logoUrl)}
          style={[styles.fill, closed && { opacity: opacity.closedThumb }]}
          contentFit="cover"
          transition={150}
        />
        {restaurant.discount ? <PromoTag label={restaurant.discount} style={styles.promo} /> : null}
        <Touchable
          onPress={toggle}
          hitSlop={6}
          accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Save to favourites'}
          accessibilityState={{ selected: isFavorite }}
          style={styles.cardHeart}
        >
          <Icon name="favourite" size="row" filled={isFavorite} color={isFavorite ? 'primary' : 'ink'} />
        </Touchable>
      </View>
      <View style={styles.cardText}>
        <Text variant="cardTitle" color={closed ? 'inkMuted' : 'ink'} numberOfLines={1}>
          {restaurant.name}
        </Text>
        {restaurant.categories ? (
          <Text variant="meta" color="inkMuted" numberOfLines={1}>
            {restaurant.categories.replace(/ - /g, ' · ')}
          </Text>
        ) : null}
      </View>
      {closed ? (
        <Badge label={CLOSED_LABEL} variant="closed" />
      ) : (
        <MetaRow
          likedPercent={restaurant.rating ? Number.parseInt(restaurant.rating, 10) || null : null}
          time={restaurant.deliveryTime}
          fee={restaurant.isFreeDelivery ? 'free' : restaurant.deliveryFee}
        />
      )}
    </Touchable>
  );
}

export function RestaurantCardSkeleton() {
  const styles = useStyles();
  const { radius } = useTheme();
  return (
    <View style={styles.card}>
      <Skeleton height={172} radius={radius.card} />
      <View style={styles.cardText}>
        <Skeleton width="55%" height={18} />
        <Skeleton width="35%" height={12} />
      </View>
      <Skeleton width="70%" height={14} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// RestaurantRow — 64 thumb (radius 16, divider border), name (rowTitle),
// cuisine and a one-line meta. Closed: dimmed thumb, muted name, badge.
// ---------------------------------------------------------------------------

export function RestaurantRow({
  restaurant,
  onPress,
  showFavourite,
}: {
  restaurant: RestaurantSummary;
  onPress?: () => void;
  /** Filled heart on the right (Favourites list) — tapping removes it. */
  showFavourite?: boolean;
}) {
  const styles = useStyles();
  const { opacity } = useTheme();
  const imageSource = useRestaurantImageSource();
  const { isFavorite, toggle } = useFavouriteToggle(restaurant);
  const closed = restaurant.isOpen === false;
  const { liked, rest } = metaLine(restaurant);

  return (
    <Touchable
      onPress={onPress}
      scaleTo={1}
      accessibilityLabel={`${restaurant.name}${closed ? ', closed' : ''}`}
      style={styles.row}
    >
      <View style={[styles.thumb, closed && { opacity: opacity.closedThumb }]}>
        <Image source={imageSource(restaurant.logoUrl ?? restaurant.bannerImage)} style={styles.fill} contentFit="cover" />
      </View>
      <View style={styles.rowText}>
        <Text variant="rowTitle" color={closed ? 'inkMuted' : 'ink'} numberOfLines={1}>
          {restaurant.name}
        </Text>
        {restaurant.categories ? (
          <Text variant="meta" color="inkMuted" numberOfLines={1}>
            {restaurant.categories.replace(/ - /g, ' · ')}
          </Text>
        ) : null}
        {closed ? (
          <Badge label={CLOSED_LABEL} variant="closed" style={styles.closedBadge} />
        ) : liked || rest ? (
          <Text variant="meta" color="inkMuted" numberOfLines={1}>
            {liked ? <Text variant="meta" style={styles.semibold}>{liked}</Text> : null}
            {liked && rest ? ' · ' : ''}
            {rest}
          </Text>
        ) : null}
      </View>
      {showFavourite ? (
        <Touchable
          onPress={toggle}
          accessibilityLabel={isFavorite ? `Remove ${restaurant.name} from favourites` : `Save ${restaurant.name}`}
          style={styles.rowHeart}
        >
          <Icon name="favourite" size="field" color="primary" filled={isFavorite} />
        </Touchable>
      ) : null}
    </Touchable>
  );
}

export function RestaurantRowSkeleton() {
  const styles = useStyles();
  const { radius } = useTheme();
  return (
    <View style={styles.row}>
      <Skeleton width={64} height={64} radius={radius.thumb} />
      <View style={[styles.rowText, styles.skeletonText]}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="75%" height={12} />
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  fill: { width: '100%', height: '100%' },
  semibold: { fontFamily: t.typography.label.fontFamily },
  card: { gap: t.space[12] },
  cardImageBox: {
    height: t.size.restaurantCardImage,
    borderRadius: t.radius.card,
    overflow: 'hidden',
    backgroundColor: t.colors.skeleton,
  },
  promo: { position: 'absolute', left: t.space[12], bottom: t.space[12] },
  cardHeart: {
    position: 'absolute',
    top: t.space[12],
    right: t.space[12],
    width: t.size.addButton,
    height: t.size.addButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space[14], paddingVertical: t.space[10] },
  thumb: {
    width: t.size.restaurantRowThumb,
    height: t.size.restaurantRowThumb,
    borderRadius: t.radius.thumb,
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: t.colors.divider,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  skeletonText: { gap: t.space[6] },
  closedBadge: { marginTop: 2 },
  rowHeart: {
    width: t.size.addButton,
    height: t.size.addButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
