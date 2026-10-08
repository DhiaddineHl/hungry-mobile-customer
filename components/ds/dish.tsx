import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/constants/images';
import { createStyles, useTheme } from '@/theme';
import { Badge } from './badges';
import { IconButton } from './buttons';
import { Skeleton } from './feedback';
import { Text } from './text';
import { Touchable } from './touchable';

export type DishImage = ImageSource | number | undefined;

interface DishProps {
  name: string;
  /** Formatted price; absent when nothing applies right now (unorderable). */
  price?: string;
  oldPrice?: string;
  discount?: string;
  description?: string;
  /** `caption` line under the name on cards (`Taxi Pizza · 25–40 min`, `66% liked`). */
  meta?: string;
  image: DishImage;
  onPress?: () => void;
  /** The + button. Omitted when the dish cannot be added from here. */
  onAdd?: () => void;
  /** How many of this dish are in the cart — replaces + with a navy marker. */
  inCart?: number;
  /** Closed restaurant: greyed, no add button. */
  disabled?: boolean;
}

function PriceLine({ price, oldPrice, large }: { price?: string; oldPrice?: string; large?: boolean }) {
  const styles = useStyles();
  if (!price) {
    return (
      <Text variant="meta" color="inkMuted">
        Unavailable right now
      </Text>
    );
  }
  return (
    <View style={styles.priceLine}>
      <Text variant={large ? 'priceLarge' : 'price'}>{price}</Text>
      {oldPrice ? (
        <Text variant="caption" color="inkMuted" tabular style={styles.strike}>
          {oldPrice}
        </Text>
      ) : null}
    </View>
  );
}

/** Navy count of this dish already in the cart (MenuRow / DishCard). */
function QuantityMarker({ count, size }: { count: number; size: number }) {
  const styles = useStyles();
  return (
    <View
      style={[styles.marker, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={`${count} in cart`}
    >
      <Text variant="badge" color="onInk" tabular>
        {count}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DishCard — grid tile: 132 image (radius 16), discount badge top-left,
// 40 add button bottom-right; name, meta, price + old price.
// ---------------------------------------------------------------------------

export function DishCard({
  name,
  price,
  oldPrice,
  discount,
  meta,
  image,
  onPress,
  onAdd,
  inCart = 0,
  disabled,
  style,
}: DishProps & { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { opacity } = useTheme();
  return (
    <Touchable onPress={onPress} accessibilityLabel={`${name}${price ? `, ${price}` : ''}`} style={[styles.card, style]}>
      <View style={styles.cardImage}>
        <Image
          source={image ?? { uri: PRODUCT_IMAGE_PLACEHOLDER }}
          style={[styles.fill, disabled && { opacity: opacity.disabledImage }]}
          contentFit="cover"
          transition={150}
        />
        {discount && !disabled ? <Badge label={discount} variant="discount" style={styles.cardBadge} /> : null}
        {!disabled && inCart > 0 ? (
          <View style={styles.cardAdd}>
            <QuantityMarker count={inCart} size={40} />
          </View>
        ) : !disabled && onAdd ? (
          <IconButton icon="add" variant="add" onPress={onAdd} accessibilityLabel={`Add ${name}`} style={styles.cardAdd} />
        ) : null}
      </View>
      <View style={styles.cardText}>
        <Text variant="itemTitle" color={disabled ? 'inkMuted' : 'ink'} numberOfLines={1}>
          {name}
        </Text>
        {meta ? (
          <Text variant="caption" color="inkMuted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <PriceLine price={price} oldPrice={oldPrice} />
      </View>
    </Touchable>
  );
}

export function DishCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { radius } = useTheme();
  return (
    <View style={[styles.card, style]}>
      <Skeleton height={132} radius={radius.thumb} />
      <View style={styles.cardText}>
        <Skeleton width="80%" height={14} />
        <Skeleton width="40%" height={14} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MenuRow — text left (name 16/22, description 2 lines, price), 96 image
// right with a 32 add button or the in-cart quantity marker.
// ---------------------------------------------------------------------------

export function MenuRow({
  name,
  price,
  oldPrice,
  discount,
  description,
  image,
  onPress,
  onAdd,
  inCart = 0,
  disabled,
}: DishProps) {
  const styles = useStyles();
  const { opacity } = useTheme();
  return (
    <Touchable onPress={onPress} scaleTo={1} accessibilityLabel={`${name}${price ? `, ${price}` : ''}`} style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="rowTitle" color={disabled ? 'inkMuted' : 'ink'} numberOfLines={2}>
          {name}
        </Text>
        {description ? (
          <Text variant="meta" color="inkMuted" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        <View style={styles.rowPrice}>
          <PriceLine price={price} oldPrice={oldPrice} />
          {discount && !disabled ? <Badge label={discount} variant="discount" /> : null}
        </View>
      </View>
      <View style={styles.thumb}>
        <Image
          source={image ?? { uri: PRODUCT_IMAGE_PLACEHOLDER }}
          style={[styles.fill, disabled && { opacity: opacity.disabledImage }]}
          contentFit="cover"
          transition={150}
        />
        {!disabled && inCart > 0 ? (
          <View style={styles.thumbAdd}>
            <QuantityMarker count={inCart} size={32} />
          </View>
        ) : !disabled && onAdd ? (
          <IconButton icon="add" variant="addSmall" onPress={onAdd} accessibilityLabel={`Add ${name}`} style={styles.thumbAdd} />
        ) : null}
      </View>
    </Touchable>
  );
}

export function MenuRowSkeleton() {
  const styles = useStyles();
  const { radius } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowText, styles.skeletonText]}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="90%" height={12} />
        <Skeleton width="30%" height={14} />
      </View>
      <Skeleton width={96} height={96} radius={radius.thumb} />
    </View>
  );
}

export { PriceLine };

const useStyles = createStyles((t) => ({
  fill: { width: '100%', height: '100%' },
  strike: { textDecorationLine: 'line-through' },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: t.space[6] },
  marker: { backgroundColor: t.colors.ink, alignItems: 'center', justifyContent: 'center' },
  card: { gap: t.space[10] },
  cardImage: {
    height: t.size.dishCardImage,
    borderRadius: t.radius.thumb,
    overflow: 'hidden',
    backgroundColor: t.colors.skeleton,
  },
  cardBadge: { position: 'absolute', top: t.space[8], left: t.space[8] },
  cardAdd: { position: 'absolute', right: t.space[8], bottom: t.space[8] },
  cardText: { gap: 2 },
  row: { flexDirection: 'row', gap: t.space[14], paddingVertical: t.space[16] },
  rowText: { flex: 1, gap: t.space[4] },
  rowPrice: { flexDirection: 'row', alignItems: 'center', gap: t.space[8], marginTop: t.space[4] },
  skeletonText: { gap: t.space[8] },
  thumb: {
    width: t.size.menuThumb,
    height: t.size.menuThumb,
    borderRadius: t.radius.thumb,
    overflow: 'hidden',
    backgroundColor: t.colors.skeleton,
  },
  thumbAdd: { position: 'absolute', right: 6, bottom: 6 },
}));
