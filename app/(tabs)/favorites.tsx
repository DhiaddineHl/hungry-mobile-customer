import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  PageTitle,
  Screen,
  SectionHeader,
  Separated,
  StateView,
  Text,
  Touchable,
  toast,
} from '@/components/ds';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import { type FavoriteItem, useFavoritesStore } from '@/store/favorites-store';
import { createStyles, Icon } from '@/theme';

/**
 * V1 Favourites — saved restaurants (and dishes) as rows with the filled
 * orange heart that removes them. Removal is reversible, so it ends on a
 * toast with Undo rather than a confirmation.
 */
export default function FavoritesScreen() {
  const styles = useStyles();
  const router = useRouter();
  const items = useFavoritesStore((s) => s.items);
  const remove = useFavoritesStore((s) => s.remove);
  const toggle = useFavoritesStore((s) => s.toggle);

  const restaurants = items.filter((i) => i.type === 'restaurant');
  const foods = items.filter((i) => i.type === 'food');

  const openItem = (item: FavoriteItem) => {
    if (item.type === 'restaurant') router.push(`/restaurant/${item.id}`);
    // A dish opens with the restaurant that serves it, so it can be ordered.
    else router.push(item.restaurantId ? `/food/${item.id}?restaurantId=${item.restaurantId}` : `/food/${item.id}`);
  };

  const removeItem = (item: FavoriteItem) => {
    remove(item.type, item.id);
    toast.show({ message: `Removed ${item.name}`, actionLabel: 'Undo', onAction: () => toggle(item), aboveBar: true });
  };

  return (
    <Screen>
      <PageTitle title="Favourites" style={styles.header} />

      {items.length === 0 ? (
        // S-V1.
        <StateView
          icon="favourite"
          tone="warm"
          title="No favourites yet"
          body="Tap the heart on a restaurant to save it here."
          actions={[{ label: 'Browse restaurants', onPress: () => router.navigate('/') }]}
        />
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {restaurants.length > 0 ? (
            <View>
              <SectionHeader title="Restaurants" meta={`${restaurants.length} saved`} style={styles.section} />
              <Separated>
                {restaurants.map((item) => (
                  <FavouriteRow key={`restaurant:${item.id}`} item={item} onPress={() => openItem(item)} onRemove={() => removeItem(item)} />
                ))}
              </Separated>
            </View>
          ) : null}

          {foods.length > 0 ? (
            <View>
              <SectionHeader title="Dishes" meta={`${foods.length} saved`} />
              <Separated>
                {foods.map((item) => (
                  <FavouriteRow key={`food:${item.id}`} item={item} onPress={() => openItem(item)} onRemove={() => removeItem(item)} />
                ))}
              </Separated>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

/** RestaurantRow geometry from the stored favourite: 64 thumb, name, subtitle, heart. */
function FavouriteRow({ item, onPress, onRemove }: { item: FavoriteItem; onPress: () => void; onRemove: () => void }) {
  const styles = useStyles();
  const toImageSource = useStoredImageSource();
  const meta = [item.rating, item.price].filter(Boolean).join(' · ');
  return (
    <Touchable onPress={onPress} scaleTo={1} accessibilityLabel={item.name} style={styles.row}>
      <View style={styles.thumb}>
        <Image source={toImageSource(item.image)} style={styles.fill} contentFit="cover" />
      </View>
      <View style={styles.rowText}>
        <Text variant="rowTitle" numberOfLines={1}>
          {item.name}
        </Text>
        {item.subtitle ? (
          <Text variant="meta" color="inkMuted" numberOfLines={1}>
            {item.subtitle.replace(/ - /g, ' · ')}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="meta" color="inkMuted" numberOfLines={1} tabular>
            {meta}
          </Text>
        ) : null}
      </View>
      <Touchable onPress={onRemove} accessibilityLabel={`Remove ${item.name} from favourites`} style={styles.heart}>
        <Icon name="favourite" filled color="primary" />
      </Touchable>
    </Touchable>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  header: { paddingHorizontal: t.screenPadding },
  content: { paddingHorizontal: t.screenPadding, paddingBottom: t.space[32] },
  section: { marginTop: t.space[20] },
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
  heart: {
    width: t.size.addButton,
    height: t.size.addButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
