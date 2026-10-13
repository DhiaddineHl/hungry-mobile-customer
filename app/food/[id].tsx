import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ImageSource } from 'expo-image';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddonGroup, AddToCartBar } from '@/components/food';
import {
  Badge,
  BottomBar,
  Counter,
  Divider,
  ErrorBanner,
  HeroHeader,
  IconButton,
  InfoNote,
  PriceLine,
  Screen,
  Skeleton,
  StateView,
  Text,
  TextField,
  TopBar,
  toast,
  useBottomBarInset,
  useFlyToCart,
} from '@/components/ds';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/constants/images';
import {
  useAddonAmounts,
  useAddonGroups,
  useProduct,
  useProductConfiguration,
  useProductImageUrl,
} from '@/hooks/use-products';
import { useRestaurantImageSourceFromPath } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import { formatAmount, selectPrice, toggleAddonSelection } from '@/services/api/product-view-model';
import {
  lineSignature,
  selectCartItemCount,
  type CartAddon,
  type NewCartLine,
  useCartStore,
} from '@/store/cart-store';
import { useFavoritesStore, useIsFavorite } from '@/store/favorites-store';
import { createStyles, useTheme } from '@/theme';

/** Scroll distance after which the sticky TopBar replaces the photo (F2/F3). */
const STICKY_REVEAL = 150;

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * F1–F3 Dish. Price first: name, price with the old one struck through, the
 * discount badge on the photo. Each option group states its rule and whether
 * it is required; until a required group is filled the button names what is
 * missing. Quantity and Add share the bottom bar with the running total.
 */
export default function FoodDetailsScreen() {
  const styles = useStyles();
  const { size } = useTheme();
  // The restaurant comes from the route: a product carries NO restaurant field
  // in the backend, so the screen it was opened from is the only thing that
  // knows which restaurant serves this dish.
  const { id, restaurantId } = useLocalSearchParams<{ id: string; restaurantId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomBarInset();

  const { data: product, isPending, error, refetch } = useProduct(id);
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: imageUrl } = useProductImageUrl(id);

  // Only a configurable dish has anything to resolve here.
  const { groups, isResolving: isResolvingConfig, error: configError } = useProductConfiguration(product);
  const addonGroups = useAddonGroups(groups);
  const addonAmounts = useAddonAmounts(groups);

  const [quantity, setQuantity] = useState(1);
  const [specialNote, setSpecialNote] = useState('');
  const [showSticky, setShowSticky] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const setLineQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const cartCount = useCartStore(selectCartItemCount);
  // Fly-to-cart: the photo shrinks into the cart button, then the screen closes.
  // Units still flying are held back so the counter ticks up when it lands.
  const { rootRef, cartPulseStyle, inFlightUnits, fly, isFlying, overlay: flightOverlay } = useFlyToCart();
  const shownCartCount = Math.max(0, cartCount - inFlightUnits);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useIsFavorite('food', id ?? '');

  // `imageUrl` is the raw relative `/files/...` path; this resolves it against
  // the current API base and attaches the bearer token that route requires.
  const toImageSource = useRestaurantImageSourceFromPath();

  const heroSource: ImageSource = imageUrl ? toImageSource(imageUrl) : { uri: PRODUCT_IMAGE_PLACEHOLDER };
  const heroRef = useRef<View>(null);
  const heroCartRef = useRef<View>(null);
  const stickyCartRef = useRef<View>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
    runOnJS(setShowSticky)(event.contentOffset.y > STICKY_REVEAL);
  });
  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [STICKY_REVEAL - 40, STICKY_REVEAL], [0, 1], Extrapolation.CLAMP),
  }));

  /** The base price, or `null` when nothing applies right now — unorderable, NOT free. */
  const basePrice = useMemo(() => (product ? selectPrice(product.prices, new Date()) : null), [product]);

  /**
   * Applies the tap under the group's own rule (SINGLE replaces, MULTIPLE
   * adds — see `toggleAddonSelection`). A tap in a group not on screen is
   * ignored: without the group there is no rule to apply.
   */
  const handleToggle = useCallback(
    (groupId: string, optionId: string) => {
      const group = addonGroups.find((each) => each.id === groupId);
      if (!group) return;
      setSelections((prev) => {
        const current = prev[groupId] ?? [];
        const next = toggleAddonSelection(group, current, optionId);
        return next === current ? prev : { ...prev, [groupId]: next };
      });
    },
    [addonGroups],
  );

  // The first required group with no answer — the button names it.
  const missingGroup = addonGroups.find((group) => group.required && (selections[group.id] ?? []).length === 0);
  const allRequiredSatisfied = !missingGroup;

  /**
   * A configurable dish whose groups have not arrived yet renders with NONE,
   * which would make `allRequiredSatisfied` vacuously true. Pending and failed
   * configurations are therefore part of the gate.
   */
  const isConfigurationPending = !!product?.isConfigurable && isResolvingConfig;
  const isConfigurationBroken = !!product?.isConfigurable && !!configError;

  // Summed from the selectPrice amounts, never from the "+2 DT" labels.
  const addonsAmount = Object.values(selections)
    .flat()
    .reduce((total, optionId) => total + (addonAmounts.get(optionId) ?? 0), 0);
  const unitAmount = (basePrice?.amount ?? 0) + addonsAmount;
  const totalLabel = formatAmount(unitAmount * quantity, basePrice?.currency);

  const canAddToCart = !!basePrice && !!product && !!restaurant && !isConfigurationPending && !isConfigurationBroken;

  const goToCart = () => router.push('/(tabs)/cart');

  const handleAddToCart = () => {
    // A second tap while the photo is flying would add the dish twice.
    if (isFlying()) return;
    // Checked again even though the button is disabled: what reaches the cart
    // must never depend on a control's enabled-ness alone.
    if (!allRequiredSatisfied || !canAddToCart || !product || !basePrice || !restaurant) return;

    const selectedAddons: CartAddon[] = addonGroups.flatMap((group) => {
      const selected = selections[group.id] ?? [];
      return group.options
        .filter((option) => selected.includes(option.id))
        .map((option) => ({ id: option.id, name: option.name, price: addonAmounts.get(option.id) ?? 0 }));
    });

    const line: NewCartLine = {
      foodId: product.id,
      name: product.name ?? '',
      image: imageUrl ?? undefined,
      unitPrice: unitAmount,
      basePrice: basePrice.amount,
      quantity,
      addons: selectedAddons,
      note: specialNote.trim() || undefined,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      // The RELATIVE path, resolved at render time so a stored line survives a
      // change of EXPO_PUBLIC_API_URL.
      restaurantLogo: restaurant.logoPath,
    };
    // Same dish + options + note merge into one line; Undo puts that line back
    // to what it held before this add.
    const lineId = lineSignature(line);
    const before = items.find((i) => i.lineId === lineId)?.quantity ?? 0;
    addItem(line);

    // Into whichever cart button is on screen: the hero's, or the sticky bar's once scrolled.
    fly({
      from: heroRef,
      to: showSticky ? stickyCartRef : heroCartRef,
      source: heroSource,
      units: quantity,
      onDone: () => {
        router.back();
        toast.show({
          message: quantity > 1 ? `Added ${quantity} × ${line.name} to cart` : `Added ${line.name} to cart`,
          actionLabel: 'Undo',
          onAction: () => (before > 0 ? setLineQuantity(lineId, before) : removeItem(lineId)),
          aboveBar: true,
        });
      },
    });
  };

  const handleToggleFavorite = () => {
    if (!product) return;
    toggleFavorite({
      id: product.id,
      type: 'food',
      name: product.name ?? '',
      image: imageUrl ?? undefined,
      subtitle: product.description ?? undefined,
      price: basePrice?.formatted,
      restaurantId: restaurant?.id,
    });
  };

  if (isPending) {
    return (
      <Screen edges={[]}>
        <HeroHeader source={undefined} height={size.dishHero} onBack={() => router.back()} />
        <View style={styles.titleBlock}>
          <Skeleton width="65%" height={26} />
          <Skeleton width="30%" height={20} />
          <Skeleton width="90%" height={14} />
          <Skeleton width="70%" height={14} />
        </View>
      </Screen>
    );
  }

  if (error || !product) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} />
        {error ? (
          <StateView
            icon="offline"
            title="Couldn't load this dish"
            body="Check your connection, then try again."
            actions={[{ label: 'Try again', onPress: () => refetch() }]}
          />
        ) : (
          <StateView icon="noResults" title="Dish not found" body="This dish is no longer on the menu." />
        )}
      </Screen>
    );
  }

  const unorderableReason = isConfigurationPending
    ? 'Loading the choices for this dish…'
    : isConfigurationBroken
      ? "We couldn't load the choices this dish needs, so it can't be ordered yet."
      : basePrice
        ? 'Open this dish from its restaurant to order it.'
        : "This dish isn't available to order right now.";

  return (
    <Screen edges={[]}>
      <View ref={rootRef} collapsable={false} style={styles.flex}>
        <Animated.ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          <View ref={heroRef} collapsable={false}>
            <HeroHeader
              source={heroSource}
              height={size.dishHero}
              onBack={() => router.back()}
              isFavorite={isFavorite}
              onFavorite={handleToggleFavorite}
              onCart={goToCart}
              cartRef={heroCartRef}
              cartStyle={cartPulseStyle}
              cartCount={shownCartCount}
            >
              {basePrice?.discountLabel ? (
                <Badge label={basePrice.discountLabel} variant="discount" style={styles.heroBadge} />
              ) : null}
            </HeroHeader>
          </View>

          <View style={styles.titleBlock}>
            <Text variant="title" accessibilityRole="header">
              {product.name}
            </Text>
            <PriceLine price={basePrice?.formatted} oldPrice={basePrice?.original} large />
            {product.description ? (
              <Text variant="description" color="inkMuted">
                {product.description}
              </Text>
            ) : null}
          </View>

          <Divider />

          {isConfigurationPending ? (
            <View style={styles.optionsLoading}>
              <Skeleton width="45%" height={18} />
              <Skeleton width="25%" height={12} />
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} height={44} radius={12} />
              ))}
            </View>
          ) : null}

          {isConfigurationBroken ? (
            <View style={styles.section}>
              <ErrorBanner
                title="Couldn't load the choices"
                body="This dish needs choices we couldn't load. Try again."
                actionLabel="Try again"
                onAction={() => refetch()}
              />
            </View>
          ) : null}

          {addonGroups.map((group) => (
            <AddonGroup key={group.id} group={group} selectedIds={selections[group.id] ?? []} onToggle={handleToggle} />
          ))}

          <View style={styles.section}>
            <View>
              <Text variant="sectionTitle" accessibilityRole="header">
                Special instructions
              </Text>
              <Text variant="meta" color="inkMuted">
                Allergies or anything the kitchen should know
              </Text>
            </View>
            <TextField
              area
              placeholder="Add a note"
              value={specialNote}
              onChangeText={setSpecialNote}
              accessibilityLabel="Special instructions"
              maxLength={200}
            />
          </View>

          {/* "Frequently bought together" needs a recommendations source the
              backend does not have; it returns when one exists. */}
        </Animated.ScrollView>

        {/* Sticky TopBar — replaces the photo once it has scrolled away. */}
        <Animated.View
          style={[styles.sticky, { paddingTop: insets.top }, stickyStyle]}
          pointerEvents={showSticky ? 'auto' : 'none'}
        >
          <TopBar
            title={product.name ?? ''}
            accent={false}
            onBack={() => router.back()}
            trailing={
              <View style={styles.stickyActions}>
                <IconButton
                  icon="favourite"
                  filled={isFavorite}
                  iconColor={isFavorite ? 'primary' : 'ink'}
                  onPress={handleToggleFavorite}
                  accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Favourite'}
                />
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
        </Animated.View>

        {canAddToCart ? (
          <AddToCartBar
            quantity={quantity}
            total={totalLabel}
            onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
            onIncrement={() => setQuantity((q) => q + 1)}
            onAddToCart={handleAddToCart}
            disabled={!allRequiredSatisfied}
            hint={missingGroup ? `Choose ${lowerFirst(missingGroup.title)}` : undefined}
          />
        ) : (
          <BottomBar>
            <InfoNote style={styles.flex}>{unorderableReason}</InfoNote>
          </BottomBar>
        )}

        {/* The photo flying into the cart button; above everything, untouchable. */}
        {flightOverlay}
      </View>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  heroBadge: { position: 'absolute', left: t.space[16], bottom: t.space[12] },
  titleBlock: { paddingHorizontal: t.screenPadding, paddingTop: t.space[20], paddingBottom: t.space[20], gap: t.space[8] },
  optionsLoading: { paddingHorizontal: t.screenPadding, paddingTop: t.space[24], gap: t.space[10] },
  section: { paddingHorizontal: t.screenPadding, paddingTop: t.space[28], gap: t.space[14] },
  stickyActions: { flexDirection: 'row', gap: t.space[8] },
  sticky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.divider,
  },
}));
