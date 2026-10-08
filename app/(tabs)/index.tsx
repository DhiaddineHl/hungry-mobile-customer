import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AccentHeadline,
  FilterChip,
  RestaurantCard,
  RestaurantCardSkeleton,
  Screen,
  SearchField,
  SectionHeader,
  StateView,
  Text,
  TextLink,
} from '@/components/ds';
import { CATEGORIES, CategoriesSlider } from '@/components/home/categories-slider';
import { HomeHeader } from '@/components/home/home-header';
import { PopularRestaurants } from '@/components/home/popular-restaurants';
import {
  FILTERS,
  matchesCategory,
  matchesFilters,
  openFirst,
  type FilterId,
} from '@/components/home/restaurant-filters';
import { useAuth } from '@/contexts/auth-context';
import { useDeliveryAddress } from '@/hooks/use-delivery-address';
import { useRestaurants } from '@/hooks/use-restaurants';
import { selectUnreadCount, useNotificationStore } from '@/store/notification-store';
import { createStyles, useTheme } from '@/theme';

/** Scroll distance after which the search field pins under the header (H2). */
const PIN_SEARCH_AT = 96;

/**
 * H1–H3 Home. Address first, then "Hungry, {name}?" and search, then browse:
 * categories and filters combine (active filters show a × so they are easy to
 * clear), popular tiles, and the restaurant list.
 */
export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { customer } = useDeliveryAddress();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterId[]>([]);
  const [searchPinned, setSearchPinned] = useState(false);

  // The home screen owns the restaurant query; every section reads this one
  // cache entry.
  const { data: restaurants, isPending, error, refetch, isRefetching } = useRestaurants({ sort: 'name' });

  // Unread rows in the device inbox; the notifications screen clears them.
  const unreadNotifications = useNotificationStore(selectUnreadCount);

  const firstName = customer?.fullname?.firstName?.trim() || user?.given_name?.trim() || '';
  const filtering = categoryId !== null || filters.length > 0;
  const category = CATEGORIES.find((c) => c.id === categoryId);

  const visible = useMemo(
    () =>
      (restaurants ?? [])
        .filter((r) => matchesCategory(r, categoryId) && matchesFilters(r, filters))
        .sort(openFirst),
    [restaurants, categoryId, filters],
  );
  const openCount = visible.filter((r) => r.isOpen !== false).length;

  const toggleFilter = (id: FilterId) =>
    setFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const clearAll = () => {
    setCategoryId(null);
    setFilters([]);
  };

  const openSearch = () => router.push('/search');
  const openRestaurant = (id: string) => router.push(`/restaurant/${id}`);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pinned = e.nativeEvent.contentOffset.y > PIN_SEARCH_AT;
    if (pinned !== searchPinned) setSearchPinned(pinned);
  };

  const filteredSummary = [
    `${visible.length} ${category ? category.name.toLowerCase() : ''} ${visible.length === 1 ? 'place' : 'places'}`
      .replace(/\s+/g, ' ')
      .trim(),
    filters.includes('open') ? 'open now' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const renderList = () => {
    if (isPending) {
      return (
        <View style={styles.list}>
          <RestaurantCardSkeleton />
          <RestaurantCardSkeleton />
        </View>
      );
    }
    if (error) {
      return (
        <StateView
          icon="offline"
          title="Couldn't load restaurants"
          body="Check your connection, then try again."
          actions={[{ label: 'Try again', onPress: () => refetch(), loading: isRefetching }]}
          style={styles.state}
        />
      );
    }
    if (visible.length === 0) {
      return filtering ? (
        <StateView
          icon="noResults"
          title="Nothing matches yet"
          body="Try another category or clear the filters."
          actions={[{ label: 'Clear filters', onPress: clearAll, variant: 'secondary' }]}
          style={styles.state}
        />
      ) : (
        <StateView
          icon="store"
          title="No restaurants yet"
          body="There are no restaurants to show right now. Check back soon."
          style={styles.state}
        />
      );
    }
    return (
      <View style={styles.list}>
        {visible.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} onPress={() => openRestaurant(restaurant.id)} />
        ))}
      </View>
    );
  };

  return (
    <Screen>
      <HomeHeader notificationCount={unreadNotifications} onNotificationPress={() => router.push('/notifications')} />
      {searchPinned ? (
        <View style={styles.pinned}>
          <SearchField placeholder="Restaurants, dishes, cuisines" onPress={openSearch} />
        </View>
      ) : null}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.ink} />}
      >
        <View style={styles.intro}>
          <AccentHeadline text={firstName ? `Hungry, ${firstName}` : 'Hungry'} accent="?" />
          <SearchField placeholder="Restaurants, dishes, cuisines" onPress={openSearch} />
        </View>

        <SectionHeader title="Categories" style={styles.padded} />
        <CategoriesSlider selectedId={categoryId} onSelect={setCategoryId} />

        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} selected={filters.includes(f.id)} onPress={() => toggleFilter(f.id)} />
          ))}
        </View>

        {!filtering ? (
          <PopularRestaurants
            restaurants={restaurants ?? []}
            isLoading={isPending}
            onRestaurantPress={openRestaurant}
          />
        ) : null}

        <View style={styles.padded}>
          {filtering ? (
            <View style={styles.filteredHeader}>
              <Text variant="meta" color="inkMuted" style={styles.flex}>
                <Text variant="meta" style={styles.bold}>
                  {filteredSummary}
                </Text>
              </Text>
              <TextLink label="Clear all" onPress={clearAll} />
            </View>
          ) : (
            <SectionHeader
              title="Open now"
              meta={restaurants ? `${openCount} ${openCount === 1 ? 'place' : 'places'}` : undefined}
            />
          )}
          {renderList()}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  bold: { fontFamily: t.typography.itemTitle.fontFamily, color: t.colors.ink },
  content: { paddingBottom: t.space[32] },
  intro: { paddingHorizontal: t.screenPadding, paddingTop: t.space[12], gap: t.space[16] },
  padded: { paddingHorizontal: t.screenPadding },
  pinned: { paddingHorizontal: t.screenPadding, paddingBottom: t.space[12], backgroundColor: t.colors.background },
  chips: { flexDirection: 'row', gap: t.space[8], paddingHorizontal: t.screenPadding, marginTop: t.space[16] },
  filteredHeader: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], marginTop: t.space[28], marginBottom: t.space[14] },
  list: { gap: t.space[24] },
  state: { paddingVertical: t.space[32] },
}));
