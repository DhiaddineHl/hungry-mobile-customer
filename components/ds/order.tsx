import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/constants/images';
import { createStyles, Icon } from '@/theme';
import { Stepper } from './selection';
import { Text } from './text';
import { Touchable } from './touchable';

type Source = ImageSource | number | undefined;

/** 40 logo tile, radius 12, divider border. */
export function LogoTile({ source, size = 40 }: { source: Source; size?: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.logo, { width: size, height: size }]}>
      {source ? (
        <Image source={source} style={styles.fill} contentFit="cover" />
      ) : (
        <Icon name="store" size="row" color="inkMuted" />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// RestaurantGroupHeader (cart, checkout, orders): logo tile + name + meta;
// trailing "Add items" pill, a total, or a status badge.
// ---------------------------------------------------------------------------

export function RestaurantGroupHeader({
  logo,
  name,
  meta,
  trailing,
  onPress,
  style,
}: {
  logo: Source;
  name: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const body = (
    <>
      <LogoTile source={logo} />
      <View style={styles.flex}>
        <Text variant="rowTitle" numberOfLines={1}>
          {name}
        </Text>
        {meta ? (
          <Text variant="meta" color="inkMuted" numberOfLines={1} tabular>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  if (!onPress) return <View style={[styles.group, style]}>{body}</View>;
  return (
    <Touchable onPress={onPress} scaleTo={1} accessibilityLabel={name} style={[styles.group, style]}>
      {body}
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// CartItem — 64 thumb (radius 16), name, options, compact stepper on the left
// of the bottom line (Trash2 at quantity 1), line total on the right.
// ---------------------------------------------------------------------------

export function CartItem({
  name,
  options,
  total,
  quantity,
  image,
  onIncrement,
  onDecrement,
}: {
  name: string;
  /** Selected options / note, one line (`Arbi, Chawerma`). */
  options?: string;
  /** Line total (`17 DT`). */
  total: string;
  quantity: number;
  image: Source;
  onIncrement: () => void;
  /** At quantity 1 this removes the line. */
  onDecrement: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.item}>
      <View style={styles.thumb}>
        <Image source={image ?? { uri: PRODUCT_IMAGE_PLACEHOLDER }} style={styles.fill} contentFit="cover" />
      </View>
      <View style={styles.itemBody}>
        <View>
          <Text variant="itemTitle" numberOfLines={2}>
            {name}
          </Text>
          {options ? (
            <Text variant="meta" color="inkMuted" numberOfLines={2}>
              {options}
            </Text>
          ) : null}
        </View>
        <View style={styles.itemBottom}>
          <Stepper
            size="compact"
            value={quantity}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            trashAtMin
            itemName={name}
          />
          <Text variant="price">{total}</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  logo: {
    borderRadius: t.radius.control,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.colors.divider,
    backgroundColor: t.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
  item: { flexDirection: 'row', gap: t.space[14], paddingVertical: t.space[14] },
  thumb: {
    width: t.size.cartThumb,
    height: t.size.cartThumb,
    borderRadius: t.radius.thumb,
    overflow: 'hidden',
    backgroundColor: t.colors.skeleton,
  },
  itemBody: { flex: 1, gap: t.space[8] },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[12] },
}));
