import {
  AddonGroup,
  AddToCartBar,
  FoodHeader,
  SpecialInstructions,
} from "@/components/food";
import { QueryEmpty, QueryError } from "@/components/ui/query-state";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/constants/images";
import { Fonts, FontSize, Palette, Spacing } from "@/constants/theme";
import {
  useAddonAmounts,
  useAddonGroups,
  useProduct,
  useProductConfiguration,
  useProductImageUrl,
} from "@/hooks/use-products";
import { useRestaurantImageSourceFromPath } from "@/hooks/use-restaurant-image";
import { useRestaurant } from "@/hooks/use-restaurants";
import { formatAmount, selectPrice } from "@/services/api/product-view-model";
import { type CartAddon, useCartStore } from "@/store/cart-store";
import { useFavoritesStore, useIsFavorite } from "@/store/favorites-store";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ShoppingBag } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Banner height in FoodHeader; the sticky header reveals as it scrolls past.
const FOOD_IMAGE_HEIGHT = 240;
const COMPACT_BAR_HEIGHT = 56;

export default function FoodDetailsScreen() {
  // The restaurant comes from the route, not from a constant: a product
  // carries NO restaurant field anywhere in the backend (plan §2), so the
  // screen it was opened from is the only thing that knows which restaurant
  // this dish belongs to.
  const { id, restaurantId } = useLocalSearchParams<{
    id: string;
    restaurantId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: product, isPending, error, refetch } = useProduct(id);
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: imageUrl } = useProductImageUrl(id);

  // Only a configurable dish has anything to resolve here; for a standard one
  // the query never fires and `groups` stays empty.
  const {
    groups,
    isResolving: isResolvingConfig,
    error: configError,
  } = useProductConfiguration(product);

  const addonGroups = useAddonGroups(groups);
  const addonAmounts = useAddonAmounts(groups);

  const [quantity, setQuantity] = useState(1);
  const [specialNote, setSpecialNote] = useState("");
  const [validated, setValidated] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const addItem = useCartStore((s) => s.addItem);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useIsFavorite("food", id ?? "");

  // `imageUrl` is the raw relative `/files/...` path; this resolves it against
  // the current API base and attaches the bearer token that route requires.
  const toImageSource = useRestaurantImageSourceFromPath();

  // The sticky header appears once the banner has scrolled past the top.
  const threshold = FOOD_IMAGE_HEIGHT - insets.top - COMPACT_BAR_HEIGHT;
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
    runOnJS(setShowSticky)(event.contentOffset.y > threshold - 16);
  });

  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [threshold - 40, threshold - 4],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  /**
   * The base price, or `null` when nothing applies right now. `null` means
   * unorderable, NOT free — see `selectPrice`.
   */
  const basePrice = useMemo(
    () => (product ? selectPrice(product.prices, new Date()) : null),
    [product],
  );

  const handleToggle = useCallback((groupId: string, optionId: string) => {
    setSelections((prev) => {
      const current = prev[groupId] ?? [];
      // Every group is multi-select: the backend cannot express a
      // single-select group today (see UNBACKED_ADDON_FIELDS), and there is
      // no maxSelect to enforce either.
      return current.includes(optionId)
        ? { ...prev, [groupId]: current.filter((each) => each !== optionId) }
        : { ...prev, [groupId]: [...current, optionId] };
    });
  }, []);

  const requiredGroups = addonGroups.filter((group) => group.required);
  const allRequiredSatisfied = requiredGroups.every(
    (group) => (selections[group.id] ?? []).length > 0,
  );

  /**
   * A configurable dish whose groups have not arrived yet renders with NONE,
   * which would make `allRequiredSatisfied` vacuously true and let the customer
   * add it without the choices it requires. The groups arriving is therefore
   * part of the gate, not just a spinner.
   *
   * A dish whose configuration FAILED to load is blocked for the same reason:
   * what it requires is unknown, and guessing "nothing" is the one answer that
   * produces a wrong order.
   */
  const isConfigurationPending = !!product?.isConfigurable && isResolvingConfig;
  const isConfigurationBroken = !!product?.isConfigurable && !!configError;

  // Summed from the selectPrice amounts, never from the "+2.00 DT" labels —
  // re-parsing a formatted price means guessing its separator and symbol.
  const addonsAmount = Object.values(selections)
    .flat()
    .reduce((total, optionId) => total + (addonAmounts.get(optionId) ?? 0), 0);

  const unitAmount = (basePrice?.amount ?? 0) + addonsAmount;
  const totalLabel = formatAmount(unitAmount * quantity, basePrice?.currency);
  const priceLabel = basePrice?.formatted;

  const canAddToCart =
    !!basePrice &&
    !!product &&
    !!restaurant &&
    !isConfigurationPending &&
    !isConfigurationBroken;

  // Without a restaurant there is no per-restaurant cart to open; the tab
  // shows every cart instead.
  const handleGoToCart = () =>
    restaurant
      ? router.push(`/cart/${restaurant.id}`)
      : router.push("/(tabs)/cart");

  const handleAddToCart = () => {
    setValidated(true);
    if (!allRequiredSatisfied) return;
    // No applicable price, or no restaurant resolved from the route: the line
    // could not be priced or attributed, so it must not reach the cart.
    if (!canAddToCart || !product) return;

    const selectedAddons: CartAddon[] = addonGroups.flatMap((group) => {
      const selected = selections[group.id] ?? [];
      return group.options
        .filter((option) => selected.includes(option.id))
        .map((option) => ({
          id: option.id,
          name: option.name,
          price: addonAmounts.get(option.id) ?? 0,
        }));
    });

    addItem({
      foodId: product.id,
      name: product.name ?? "",
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
    });

    router.back();
  };

  const handleToggleFavorite = () => {
    if (!product) return;
    toggleFavorite({
      id: product.id,
      type: "food",
      name: product.name ?? "",
      image: imageUrl ?? undefined,
      subtitle: product.description ?? undefined,
      price: priceLabel,
      restaurantId: restaurant?.id,
    });
  };

  // Every hook above has already run, so these early returns are safe.
  if (isPending) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <QueryError error={error} onRetry={refetch} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, styles.centered]}>
        <QueryEmpty
          title="Dish not found"
          body="This item is no longer on the menu."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <FoodHeader
          name={product.name ?? ""}
          price={priceLabel ?? "Currently unavailable"}
          originalPrice={basePrice?.original}
          discount={basePrice?.discountLabel}
          description={product.description ?? undefined}
          image={
            imageUrl
              ? toImageSource(imageUrl)
              : { uri: PRODUCT_IMAGE_PLACEHOLDER }
          }
          isFavorite={isFavorite}
          onBack={() => router.back()}
          onFavorite={handleToggleFavorite}
        />

        {isConfigurationPending ? (
          <View style={styles.configNotice}>
            <ActivityIndicator size="small" color={Palette.primary} />
            <Text style={styles.configNoticeText}>Loading options…</Text>
          </View>
        ) : null}

        {isConfigurationBroken ? (
          <View style={styles.configNotice}>
            <Text style={styles.configNoticeText}>
              We couldn&apos;t load the choices for this dish. Pull to retry, or
              try again in a moment.
            </Text>
          </View>
        ) : null}

        {addonGroups.map((group) => (
          <AddonGroup
            key={group.id}
            group={group}
            selectedIds={selections[group.id] ?? []}
            isValidated={validated}
            onToggle={handleToggle}
          />
        ))}

        {/*
          Shown only after a rejected attempt: the per-group Required badges
          already turn red, but they can be scrolled off-screen, and the bar the
          customer just tapped is not where the reason lives.
        */}
        {validated && !allRequiredSatisfied ? (
          <View style={styles.validationNotice}>
            <Text style={styles.validationNoticeText}>
              Choose an option in every required section to continue.
            </Text>
          </View>
        ) : null}

        <SpecialInstructions
          value={specialNote}
          onChangeText={setSpecialNote}
        />

        {/*
          "Frequently bought together" was a hardcoded list. There is no
          recommendations source in the backend, so rather than dressing mock
          dishes up as suggestions the section is gone until one exists.
        */}

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>

      {/* Sticky header — name + price + quick cart access. */}
      <Animated.View
        style={[styles.stickyHeader, { paddingTop: insets.top }, stickyStyle]}
        pointerEvents={showSticky ? "auto" : "none"}
      >
        <View style={styles.stickyBar}>
          <TouchableOpacity
            style={styles.stickyBack}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Palette.textPrimary} />
          </TouchableOpacity>

          <View style={styles.stickyInfo}>
            <Text style={styles.stickyName} numberOfLines={1}>
              {product.name}
            </Text>
            {priceLabel ? (
              <Text style={styles.stickyPrice}>{priceLabel}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.cartBtn}
            onPress={handleGoToCart}
            activeOpacity={0.85}
            accessibilityLabel="Go to cart"
          >
            <ShoppingBag size={20} color={Palette.textInverse} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {canAddToCart ? (
        <AddToCartBar
          quantity={quantity}
          total={totalLabel}
          onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
          onIncrement={() => setQuantity((q) => q + 1)}
          onAddToCart={handleAddToCart}
        />
      ) : (
        // Unorderable rather than free: either no price applies right now, or
        // the dish was opened without the restaurant that serves it.
        <View
          style={[
            styles.unorderable,
            { paddingBottom: insets.bottom + Spacing.lg },
          ]}
        >
          <Text style={styles.unorderableText}>
            {isConfigurationPending
              ? "Loading this dish's options…"
              : isConfigurationBroken
                ? "We couldn't load the choices this dish needs, so it can't be ordered yet."
                : basePrice
                  ? "Open this dish from its restaurant to order it."
                  : "This dish isn't available to order right now."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  bottomSpacer: {
    height: 20,
  },
  unorderable: {
    borderTopWidth: 1,
    borderTopColor: Palette.borderSubtle,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  configNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  configNoticeText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
  },
  validationNotice: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  validationNoticeText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.danger,
  },
  unorderableText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
    textAlign: "center",
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderSubtle,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  stickyBar: {
    height: COMPACT_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  stickyBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyInfo: {
    flex: 1,
  },
  stickyName: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  stickyPrice: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Palette.warning,
    marginTop: 1,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.warning,
    alignItems: "center",
    justifyContent: "center",
  },
});
