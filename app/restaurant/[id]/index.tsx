import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View, type TextInput } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  BottomBar,
  Counter,
  DishCard,
  DishCardSkeleton,
  ErrorBanner,
  FilterChip,
  HeroHeader,
  HeroLogo,
  IconButton,
  InfoNote,
  MenuRow,
  MenuRowSkeleton,
  MetaRow,
  PrimaryButton,
  PromoTag,
  InfoTag,
  Screen,
  SearchField,
  SectionHeader,
  Separated,
  Skeleton,
  StateView,
  Text,
  TextLink,
  TopBar,
  toast,
  useBottomBarInset,
  heroTransition,
  useFlyToCart,
  useHeroTransition,
  type WindowRect,
} from '@/components/ds';
import { TimingsModal } from '@/components/restaurant/timings-modal';
import { normalize } from '@/components/home/restaurant-filters';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/constants/images';
import {
  productConfigurationQueryOptions,
  productQueryOptions,
  useProductImageSources,
  useRestaurantMenu,
} from '@/hooks/use-products';
import { useRestaurantImageSource } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import { productKeys } from '@/services/api/query-keys';
import { toAddonGroups, type MenuProduct, type MenuSectionData } from '@/services/api/product-view-model';
import { toTimingRows } from '@/services/api/restaurant-view-model';
import { formatDT, lineSignature, selectCartItemCount, useCartStore, type NewCartLine } from '@/store/cart-store';
import { useFavoritesStore, useIsFavorite } from '@/store/favorites-store';
import { createStyles, useTheme } from '@/theme';

/** Height of the sticky bar (TopBar + chip row) that replaces the hero on scroll. */
const STICKY_REVEAL = 160;

/** Hero hand-off: the catalog rises from this share of the screen height. */
const ENTER_OFFSET_RATIO = 0.4;
const ENTER_DELAY_MS = 120;
const ENTER_MS = 560;
/** Going back: the catalog drops away while the photo shrinks into the card. */
const EXIT_MS = 260;

/**
 * R1–R3 Restaurant. Header: photo, logo and name, the same meta row as the
 * card, the promo as the single navy tag. Menu: category chips that stay
 * pinned while scrolling; the first section as dish cards, longer lists as
 * rows with a description and a quantity marker. Closed: same layout, menu
 * browsable, add buttons hidden.
 */
export default function RestaurantDetailsScreen() {
  const styles = useStyles();
  const { size } = useTheme();
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const bottomInset = useBottomBarInset();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const searchRef = useRef<TextInput>(null);
  const heroCartRef = useRef<View>(null);
  const stickyCartRef = useRef<View>(null);

  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timingsVisible, setTimingsVisible] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const { data: restaurant, isPending, error, refetch } = useRestaurant(restaurantId);

  // The menu is the restaurant's own menu CATEGORY and the sections under it;
  // `unavailable` means the menu category was never created.
  const {
    data: sections,
    isPending: menuPending,
    error: menuError,
    refetch: refetchMenu,
    unavailable: menuUnavailable,
  } = useRestaurantMenu(restaurant);

  const tabs = useMemo(() => (sections ?? []).filter((s) => s.title).map((s) => s.title), [sections]);

  const query = searchQuery.trim();
  const visibleSections: MenuSectionData[] = useMemo(() => {
    const all = sections ?? [];
    if (query) {
      const q = normalize(query);
      const matches = all
        .flatMap((s) => s.products)
        .filter((p) => normalize(p.name).includes(q) || normalize(p.description ?? '').includes(q));
      return [{ title: '', products: matches }];
    }
    return selectedTab === null ? all : all.filter((s) => s.title === selectedTab);
  }, [sections, selectedTab, query]);

  // Artwork is a separate request per dish — only what is on screen resolves.
  const visibleProductIds = useMemo(
    () => visibleSections.flatMap((section) => section.products.map((p) => p.id)),
    [visibleSections],
  );
  const productImage = useProductImageSources(visibleProductIds);
  const imageSource = useRestaurantImageSource();

  // One "now" per render pass keeps the sheet's "Today" marker consistent with
  // the open/closed badge.
  const timings = useMemo(() => (restaurant ? toTimingRows(restaurant.days, new Date()) : []), [restaurant]);
  const todaysHours = timings.find((t) => t.isToday && !t.isClosed)?.hours;

  const scrollY = useSharedValue(0);

  // Opened from a home card: the card's photo is flying into the hero
  // (HeroTransitionHost). Our own photo stays hidden until it lands, and the
  // catalog slides up from below to take the page.
  const { height: windowHeight } = useWindowDimensions();
  const heroPhase = useHeroTransition(restaurantId);
  const [openedWithHero] = useState(() => heroPhase !== null);
  const enter = useSharedValue(openedWithHero ? 0 : 1);
  const heroReveal = useSharedValue(openedWithHero ? 0 : 1);
  // Set once the photo is flying back — nothing may re-show our copy after that.
  const closing = useRef(false);

  useEffect(() => {
    if (!openedWithHero) return;
    enter.set(withDelay(ENTER_DELAY_MS, withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) })));
  }, [openedWithHero, enter]);

  useEffect(() => {
    if (heroPhase !== 'flying' && !closing.current) heroReveal.set(withTiming(1, { duration: 160 }));
  }, [heroPhase, heroReveal]);

  // Going back to the card it was opened from: hand the photo (where it sits
  // now, scroll included) back to the host to shrink into the card, hide our
  // own copy, and drop the catalog. Only for a plain back (button, hardware,
  // swipe) — navigating to another tab also removes this screen, but the card
  // isn't on screen then.
  useEffect(() => {
    if (!openedWithHero || !restaurantId) return;
    return navigation.addListener('beforeRemove', (e) => {
      const type = e.data.action.type;
      if (type !== 'GO_BACK' && type !== 'POP') return;
      if (!heroTransition.close(restaurantId, Math.max(0, scrollY.get()))) return;
      closing.current = true;
      heroReveal.set(0);
      enter.set(withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }));
    });
  }, [openedWithHero, restaurantId, navigation, heroReveal, enter, scrollY]);

  const enterOffset = windowHeight * ENTER_OFFSET_RATIO;
  const contentEnterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.get(), [0, 0.35], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - enter.get()) * enterOffset }],
  }));
  const heroRevealStyle = useAnimatedStyle(() => ({ opacity: heroReveal.get() }));

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
    runOnJS(setShowSticky)(event.contentOffset.y > STICKY_REVEAL);
  });
  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [STICKY_REVEAL - 40, STICKY_REVEAL], [0, 1], Extrapolation.CLAMP),
  }));

  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useIsFavorite('restaurant', restaurantId ?? '');

  // THIS restaurant's share of the cart, for the View cart bar and the
  // per-dish quantity markers. Other restaurants' lines are not counted.
  const cartItems = useCartStore((s) => s.items);
  const cartCount = useCartStore(selectCartItemCount);
  const addItem = useCartStore((s) => s.addItem);
  const decrement = useCartStore((s) => s.decrement);
  const restaurantCart = useMemo(() => {
    const lines = cartItems.filter((line) => line.restaurantId === restaurantId);
    const perDish = new Map<string, number>();
    for (const line of lines) perDish.set(line.foodId, (perDish.get(line.foodId) ?? 0) + line.quantity);
    return {
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      total: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
      perDish,
    };
  }, [cartItems, restaurantId]);
  const showCartBar = restaurantCart.itemCount > 0;

  // Fly-to-cart: the dish photo shrinks into the cart button, as on the dish
  // screen. Units still flying are held back so the counter ticks up on landing.
  const { rootRef, cartPulseStyle, inFlightUnits, fly, overlay: flightOverlay } = useFlyToCart();
  const shownCartCount = Math.max(0, cartCount - inFlightUnits);
  // Configurable dishes whose choices are being looked up after a tap on +.
  const resolvingAdd = useRef(new Set<string>());

  const goToCart = () => router.push('/(tabs)/cart');
  const handleFavoritePress = () => {
    if (!restaurant) return;
    toggleFavorite({
      id: restaurant.id,
      type: 'restaurant',
      // The RELATIVE path: resolved at render time so the stored favorite
      // survives a change of EXPO_PUBLIC_API_URL.
      image: restaurant.logoPath,
      name: restaurant.name,
      subtitle: restaurant.categories,
    });
  };
  // The restaurant travels with the route: a product carries no restaurant
  // field on the backend, so the dish screen cannot work it out otherwise.
  const openDish = (productId: string) => router.push(`/food/${productId}?restaurantId=${restaurantId}`);

  /**
   * Whether a configurable dish has a choice the customer MUST make before it
   * can be ordered. The menu payload carries no groups, so they are read on
   * tap — into the same cache the dish screen reads, so opening it costs
   * nothing more. Anything that can't be confirmed (no configuration, no
   * groups, a failed read) counts as "yes": the dish screen then decides.
   */
  const needsChoices = async (productId: string): Promise<boolean> => {
    try {
      const detail = await queryClient.fetchQuery(productQueryOptions(productId));
      if (!detail) return true;
      if (!detail.isConfigurable) return false;
      const configuration = productConfigurationQueryOptions(detail);
      if (!configuration.enabled) return true;
      const groups = toAddonGroups(await queryClient.fetchQuery(configuration), new Date());
      return groups.length === 0 || groups.some((group) => group.required);
    } catch {
      return true;
    }
  };

  /**
   * The + on a dish. A dish with a required choice opens its page instead;
   * anything else goes straight into the cart (S-R2: toast with Undo), its
   * photo flying into the cart button on the cover — or the sticky bar's once
   * the cover has scrolled away.
   */
  const handleAdd = async (product: MenuProduct, image: WindowRect | null) => {
    if (!restaurant || !product.price) return;
    if (product.requiresConfiguration) {
      if (resolvingAdd.current.has(product.id)) return;
      resolvingAdd.current.add(product.id);
      const mustChoose = await needsChoices(product.id).finally(() => resolvingAdd.current.delete(product.id));
      if (mustChoose) {
        openDish(product.id);
        return;
      }
    }
    setAddError(null);
    try {
      const line: NewCartLine = {
        foodId: product.id,
        name: product.name,
        // The artwork path the menu already resolved, from cache — relative,
        // like every stored image.
        image: queryClient.getQueryData<string | null>(productKeys.image(product.id)) ?? undefined,
        unitPrice: product.price.amount,
        basePrice: product.price.amount,
        quantity: 1,
        addons: [],
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantLogo: restaurant.logoPath,
      };
      addItem(line);
      fly({
        from: image,
        to: showSticky ? stickyCartRef : heroCartRef,
        source: productImage(product.id) ?? { uri: PRODUCT_IMAGE_PLACEHOLDER },
        onDone: () =>
          toast.show({
            message: `Added ${product.name} to cart`,
            actionLabel: 'Undo',
            onAction: () => decrement(lineSignature(line)),
            aboveBar: true,
          }),
      });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const focusMenuSearch = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => searchRef.current?.focus(), 300);
  };

  // S-R1: skeleton in the page's own layout; the back button stays usable.
  if (isPending) {
    return (
      <Screen edges={[]}>
        <Animated.View style={heroRevealStyle}>
          <HeroHeader source={undefined} height={size.restaurantHero} onBack={() => router.back()} />
        </Animated.View>
        <Animated.View style={[styles.body, contentEnterStyle]}>
          <Skeleton width={size.restaurantLogo} height={size.restaurantLogo} radius={22} style={styles.logoSkeleton} />
          <Skeleton width="55%" height={28} />
          <Skeleton width="40%" height={14} />
          <Skeleton height={52} radius={14} />
          <View style={styles.grid}>
            <DishCardSkeleton style={styles.gridItem} />
            <DishCardSkeleton style={styles.gridItem} />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  if (error || !restaurant) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} />
        {error ? (
          <StateView
            icon="offline"
            title="Couldn't load this restaurant"
            body="Check your connection, then try again."
            actions={[{ label: 'Try again', onPress: () => refetch() }]}
          />
        ) : (
          <StateView icon="store" title="Restaurant not found" body="This restaurant is no longer available." />
        )}
      </Screen>
    );
  }

  const closed = restaurant.isOpen === false;
  const cuisine = restaurant.categories.replace(/ - /g, ' · ');
  const hasMeta = !!(restaurant.rating || restaurant.deliveryTime || restaurant.deliveryFee);

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <FilterChip label="All" selected={selectedTab === null} showClear={false} onPress={() => setSelectedTab(null)} />
      {tabs.map((tab) => (
        <FilterChip
          key={tab}
          label={tab}
          selected={selectedTab === tab}
          showClear={false}
          onPress={() => setSelectedTab(selectedTab === tab ? null : tab)}
        />
      ))}
    </ScrollView>
  );

  const dishProps = (product: MenuProduct) => ({
    name: product.name,
    price: product.price?.formatted,
    oldPrice: product.price?.original,
    discount: product.price?.discountLabel,
    image: productImage(product.id),
    onPress: () => openDish(product.id),
    onAdd: product.price ? (image: WindowRect | null) => void handleAdd(product, image) : undefined,
    inCart: restaurantCart.perDish.get(product.id) ?? 0,
    disabled: closed,
  });

  /**
   * Unavailable / loading / error / empty / content, in that order.
   * "No menu connected" and "no dishes yet" are different things to tell a
   * customer, and neither is a failed request.
   */
  const renderMenu = () => {
    if (menuUnavailable) {
      return <StateView icon="preparing" title="Menu coming soon" body="This restaurant hasn't put its menu online yet." style={styles.state} />;
    }
    if (menuPending) {
      return (
        <>
          <View style={styles.grid}>
            <DishCardSkeleton style={styles.gridItem} />
            <DishCardSkeleton style={styles.gridItem} />
          </View>
          <MenuRowSkeleton />
          <MenuRowSkeleton />
        </>
      );
    }
    if (menuError) {
      return (
        <ErrorBanner
          title="Couldn't load the menu"
          body="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetchMenu()}
        />
      );
    }
    if (query) {
      const results = visibleSections[0]?.products ?? [];
      return results.length === 0 ? (
        <StateView icon="noResults" title={`Nothing for “${query}”`} body="Check the spelling, or browse the categories." style={styles.state} />
      ) : (
        <>
          <SectionHeader title="Results" meta={`${results.length} ${results.length === 1 ? 'dish' : 'dishes'}`} />
          <Separated>
            {results.map((p) => (
              <MenuRow key={p.id} description={p.description} {...dishProps(p)} />
            ))}
          </Separated>
        </>
      );
    }
    if (visibleSections.every((s) => s.products.length === 0)) {
      return <StateView icon="preparing" title="Nothing on the menu yet" body="This restaurant hasn't published any dishes." style={styles.state} />;
    }
    return visibleSections.map((section, index) => {
      const count = `${section.products.length} ${section.products.length === 1 ? 'dish' : 'dishes'}`;
      const title = section.title || 'More dishes';
      // The first section reads as cards (the dish card from search); longer
      // lists switch to rows with a description and a quantity marker.
      if (index === 0) {
        return (
          <View key={title}>
            <SectionHeader title={title} meta={count} />
            <View style={styles.grid}>
              {section.products.map((p) => (
                <DishCard key={p.id} style={styles.gridItem} {...dishProps(p)} />
              ))}
            </View>
          </View>
        );
      }
      return (
        <View key={title}>
          <SectionHeader title={title} meta={count} />
          <Separated>
            {section.products.map((p) => (
              <MenuRow key={p.id} description={p.description} {...dishProps(p)} />
            ))}
          </Separated>
        </View>
      );
    });
  };

  return (
    <Screen edges={[]}>
      <View ref={rootRef} collapsable={false} style={styles.flex}>
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: showCartBar ? bottomInset + 24 : insets.bottom + 32 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={heroRevealStyle}>
            <HeroHeader
              source={imageSource(restaurant.bannerImage ?? restaurant.logoUrl)}
              height={size.restaurantHero}
              onBack={() => router.back()}
              isFavorite={isFavorite}
              onFavorite={handleFavoritePress}
              onCart={goToCart}
              cartRef={heroCartRef}
              cartStyle={cartPulseStyle}
              cartCount={shownCartCount}
            />
          </Animated.View>

          {/* Everything under the photo — rises into place on a hero hand-off. */}
          <Animated.View style={contentEnterStyle}>
            <View style={styles.body}>
              <HeroLogo source={imageSource(restaurant.logoUrl)} style={styles.logo} />

              <View style={styles.titleBlock}>
                <View style={styles.nameRow}>
                  <Text variant="display" numberOfLines={2} style={styles.flex} accessibilityRole="header">
                    {restaurant.name}
                  </Text>
                  {restaurant.isOpen === true ? (
                    <Text variant="meta" color="success" style={styles.semibold} onPress={() => setTimingsVisible(true)}>
                      Open
                    </Text>
                  ) : null}
                </View>
                {cuisine ? (
                  <Text variant="meta" color="inkMuted">
                    {cuisine}
                  </Text>
                ) : null}
                {closed ? <Badge label={todaysHours ? `Closed · Today ${todaysHours}` : 'Closed'} variant="closed" style={styles.closedBadge} /> : null}
              </View>

              {hasMeta ? (
                <MetaRow
                  likedPercent={restaurant.rating ? Number.parseInt(restaurant.rating, 10) || null : null}
                  time={restaurant.deliveryTime}
                  fee={restaurant.isFreeDelivery ? 'free' : restaurant.deliveryFee}
                />
              ) : null}

              {restaurant.discount || restaurant.isTopRated ? (
                <View style={styles.tags}>
                  {restaurant.discount ? <PromoTag label={restaurant.discount} /> : null}
                  {restaurant.isTopRated ? <InfoTag label="Top rated" icon="star" /> : null}
                </View>
              ) : null}

              <View style={styles.links}>
                <TextLink label="Opening hours" onPress={() => setTimingsVisible(true)} />
                <TextLink label="About" onPress={() => router.push(`/restaurant/${restaurantId}/info`)} />
              </View>

              {closed ? (
                <InfoNote>
                  {todaysHours
                    ? `You can browse the menu now. Ordering opens during today's hours (${todaysHours}).`
                    : 'You can browse the menu now. Ordering opens when the restaurant does.'}
                </InfoNote>
              ) : null}

              <SearchField
                ref={searchRef}
                placeholder={`Search ${restaurant.name}'s menu`}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onClear={() => setSearchQuery('')}
              />
            </View>

            {!query && tabs.length > 0 ? <View style={styles.chipsBlock}>{chips}</View> : null}

            <View style={styles.menu}>
              {addError ? (
                <ErrorBanner title="Couldn't add to cart" body={`${addError} Try again.`} />
              ) : null}
              {renderMenu()}
            </View>
          </Animated.View>
        </Animated.ScrollView>

        {/* Sticky header — fades in once the hero has scrolled away (R2). */}
        <Animated.View
          style={[styles.sticky, { paddingTop: insets.top }, stickyStyle]}
          pointerEvents={showSticky ? 'auto' : 'none'}
        >
          <TopBar
            title={restaurant.name}
            onBack={() => router.back()}
            trailing={
              <View style={styles.stickyActions}>
                <IconButton icon="search" onPress={focusMenuSearch} accessibilityLabel="Search the menu" />
                <Animated.View ref={stickyCartRef} collapsable={false} style={cartPulseStyle}>
                  <IconButton
                    icon="cart"
                    onPress={goToCart}
                    accessibilityLabel={
                      shownCartCount > 0
                        ? `Go to cart, ${shownCartCount} item${shownCartCount > 1 ? 's' : ''}`
                        : 'Go to cart'
                    }
                    badge={shownCartCount > 0 ? <Counter count={shownCartCount} ring /> : undefined}
                  />
                </Animated.View>
              </View>
            }
          />
          {!query && tabs.length > 0 ? <View style={styles.stickyChips}>{chips}</View> : null}
        </Animated.View>

        {showCartBar ? (
          <BottomBar>
            <PrimaryButton
              label={`View cart · ${restaurantCart.itemCount} ${restaurantCart.itemCount === 1 ? 'item' : 'items'}`}
              right={formatDT(restaurantCart.total)}
              onPress={goToCart}
              style={styles.flex}
            />
          </BottomBar>
        ) : null}

        {/* The dish photo flying into the cart button; above everything, untouchable. */}
        {flightOverlay}
      </View>

      <TimingsModal visible={timingsVisible} timings={timings} onClose={() => setTimingsVisible(false)} />
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  semibold: { fontFamily: t.typography.label.fontFamily },
  body: { paddingHorizontal: t.screenPadding, gap: t.space[16] },
  logo: { marginTop: -t.size.restaurantLogo / 2 },
  logoSkeleton: { marginTop: -40 },
  titleBlock: { gap: t.space[4] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
  closedBadge: { marginTop: t.space[4] },
  tags: { flexDirection: 'row', gap: t.space[8], flexWrap: 'wrap' },
  links: { flexDirection: 'row', gap: t.space[20] },
  chipsBlock: { marginTop: t.space[16] },
  chips: { paddingHorizontal: t.screenPadding, gap: t.space[8] },
  menu: { paddingHorizontal: t.screenPadding, gap: t.space[12] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: t.space[14], rowGap: t.space[20] },
  gridItem: { width: '47%', flexGrow: 1, maxWidth: '48.5%' },
  state: { paddingVertical: t.space[32] },
  sticky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.divider,
  },
  stickyActions: { flexDirection: 'row', gap: t.space[8] },
  stickyChips: { paddingBottom: t.space[12], paddingTop: t.space[4] },
}));
