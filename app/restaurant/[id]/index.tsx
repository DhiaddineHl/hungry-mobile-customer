import { SearchBar } from "@/components/home";
import {
  MenuFilterTabs,
  MenuSection,
  RestaurantHeader,
} from "@/components/restaurant";
import { TimingsModal } from "@/components/restaurant/timings-modal";
import { QueryEmpty, QueryError } from "@/components/ui/query-state";
import { Fonts, Palette } from "@/constants/theme";
import { useRestaurantImageSource } from "@/hooks/use-restaurant-image";
import { useRestaurant } from "@/hooks/use-restaurants";
import { imageAuthHeaders } from "@/services/api/image-url";
import { toTimingRows } from "@/services/api/restaurant-view-model";
import { useFavoritesStore, useIsFavorite } from "@/store/favorites-store";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
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

// Logo geometry shared with RestaurantHeader: banner height (190) + brandRow
// marginTop (-32) put the resting logo top at 158, left at the 16px gutter.
const LOGO_REST_TOP = 158;
const LOGO_REST_LEFT = 16;
const LOGO_REST_SIZE = 68;
// Where the logo lands inside the compact header (next to the back button).
const COMPACT_BAR_HEIGHT = 52;
const COMPACT_LOGO_SIZE = 40;
const COMPACT_LOGO_LEFT = 60;

const PROMOTIONS_PRODUCTS = [
  {
    id: "p1",
    name: "Double Crispy Deal",
    price: "24 DT",
    originalPrice: "30,9 DT",
    discount: "-10%",
    image: require("@/assets/products/product-1.png"),
  },
  {
    id: "p2",
    name: "Crispy Chicken",
    price: "9,68 DT",
    originalPrice: "12,9 DT",
    discount: "-25%",
    image: require("@/assets/products/product-2.png"),
  },
  {
    id: "p3",
    name: "Melty Crispy Chicken",
    price: "16,9 DT",
    image: require("@/assets/products/prodcut-3.png"),
  },
];

const PICKED_FOR_YOU = [
  {
    id: "pfy1",
    name: "Crispy Chicken Taco Bowl",
    price: "13,9 DT",
    rating: "66%",
    reviewCount: "12",
    image: require("@/assets/products/product-4.png"),
  },
  {
    id: "pfy2",
    name: "Melty Crispy Chicken",
    price: "16,9 DT",
    image: require("@/assets/products/prodcut-3.png"),
  },
  {
    id: "pfy3",
    name: "Double Crispy Deal",
    price: "24 DT",
    originalPrice: "30,9 DT",
    discount: "-10%",
    rating: "70%",
    reviewCount: "20",
    image: require("@/assets/products/product-1.png"),
  },
];

const CLASSIQUES = [
  {
    id: "c1",
    name: "Crispy Chicken",
    price: "9,68 DT",
    originalPrice: "12,9 DT",
    discount: "-25%",
    rating: "76%",
    reviewCount: "22",
    image: require("@/assets/products/product-2.png"),
  },
  {
    id: "c2",
    name: "Cordon Bleu",
    price: "12,9 DT",
    image: require("@/assets/products/product-5.png"),
  },
  {
    id: "c3",
    name: "Spicy Chicken",
    price: "12,9 DT",
    image: require("@/assets/products/product-1.png"),
  },
  {
    id: "c4",
    name: "Beef Tacoth",
    price: "12,9 DT",
    image: require("@/assets/products/product-4.png"),
  },
];

const SIGNATURES = [
  {
    id: "s1",
    name: "Epic Spicy Chicken",
    price: "17,5 DT",
    image: require("@/assets/products/product-2.png"),
  },
  {
    id: "s2",
    name: "Ultimate Beef",
    price: "17,5 DT",
    image: require("@/assets/products/product-5.png"),
  },
  {
    id: "s3",
    name: "Melty Crispy Chicken",
    price: "16,9 DT",
    image: require("@/assets/products/prodcut-3.png"),
  },
  {
    id: "s4",
    name: "Gourmand Cordon Bleu",
    price: "15,9 DT",
    image: require("@/assets/products/product-1.png"),
  },
];

const BOWLS = [
  {
    id: "b1",
    name: "Fajitas Taco Bowl",
    price: "14,9 DT",
    image: require("@/assets/products/product-4.png"),
  },
  {
    id: "b2",
    name: "Spicy Chicken Taco Bowl",
    price: "13,9 DT",
    image: require("@/assets/products/product-5.png"),
  },
  {
    id: "b3",
    name: "Crispy Chicken Taco Bown",
    price: "16,9 DT",
    image: require("@/assets/products/prodcut-3.png"),
  },
];

export default function RestaurantDetailsScreen() {
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedTab, setSelectedTab] = useState("promotions");
  const [searchQuery, setSearchQuery] = useState("");
  const [timingsVisible, setTimingsVisible] = useState(false);
  const [showCompact, setShowCompact] = useState(false);

  const {
    data: restaurant,
    isPending,
    error,
    refetch,
  } = useRestaurant(restaurantId);

  const imageSource = useRestaurantImageSource();

  // RestaurantHeader takes raw headers rather than a source object, because
  // the banner needs the placeholder fallback applied inside the component.
  // `null` until they resolve: handing the banner a `/files/...` URL before the
  // bearer token is attached would fire one request that can only 401.
  const [bannerHeaders, setBannerHeaders] = useState<Record<string, string> | null>(
    null
  );
  useEffect(() => {
    let active = true;
    imageAuthHeaders().then((headers) => {
      if (active) setBannerHeaders(headers);
    });
    return () => {
      active = false;
    };
  }, []);

  // One "now" per render pass keeps the sheet's "(Today)" marker consistent
  // with the open/closed badge above it.
  const timings = useMemo(
    () => (restaurant ? toTimingRows(restaurant.days, new Date()) : []),
    [restaurant]
  );

  // Distance the logo travels before it settles into the compact header.
  const compactLogoTop =
    insets.top + (COMPACT_BAR_HEIGHT - COMPACT_LOGO_SIZE) / 2;
  const threshold = LOGO_REST_TOP - compactLogoTop;

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
    runOnJS(setShowCompact)(event.contentOffset.y > threshold - 16);
  });

  // The floating logo glides from the banner into the compact header.
  const logoStyle = useAnimatedStyle(() => {
    const p = scrollY.get();
    return {
      top: interpolate(
        p,
        [0, threshold],
        [LOGO_REST_TOP, compactLogoTop],
        Extrapolation.CLAMP
      ),
      left: interpolate(
        p,
        [0, threshold],
        [LOGO_REST_LEFT, COMPACT_LOGO_LEFT],
        Extrapolation.CLAMP
      ),
      width: interpolate(
        p,
        [0, threshold],
        [LOGO_REST_SIZE, COMPACT_LOGO_SIZE],
        Extrapolation.CLAMP
      ),
      height: interpolate(
        p,
        [0, threshold],
        [LOGO_REST_SIZE, COMPACT_LOGO_SIZE],
        Extrapolation.CLAMP
      ),
      borderRadius: interpolate(p, [0, threshold], [18, 12], Extrapolation.CLAMP),
      borderWidth: interpolate(p, [0, threshold], [3, 2], Extrapolation.CLAMP),
    };
  });

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [threshold - 40, threshold - 4],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useIsFavorite("restaurant", restaurantId ?? "");

  const handleBackPress = () => router.back();
  const handleFavoritePress = () => {
    if (!restaurant) return;
    toggleFavorite({
      id: restaurant.id,
      type: "restaurant",
      // The RELATIVE path: resolved at render time so the stored favorite
      // survives a change of EXPO_PUBLIC_API_URL.
      image: restaurant.logoPath,
      name: restaurant.name,
      subtitle: restaurant.categories,
    });
  };
  const handleMorePress = () => {};
  const handleProductPress = (productId: string) =>
    router.push(`/food/${productId}`);
  const handleOpenPress = () => setTimingsVisible(true);
  const handleNamePress = () => router.push(`/restaurant/${restaurantId}/info`);

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

  if (!restaurant) {
    return (
      <View style={[styles.container, styles.centered]}>
        <QueryEmpty
          title="Restaurant not found"
          body="This restaurant is no longer available."
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
        <RestaurantHeader
          name={restaurant.name}
          isOpen={restaurant.isOpen}
          bannerImage={bannerHeaders ? restaurant.bannerImage : undefined}
          imageHeaders={bannerHeaders ?? undefined}
          hideLogo
          isFavorite={isFavorite}
          onBackPress={handleBackPress}
          onFavoritePress={handleFavoritePress}
          onMorePress={handleMorePress}
          onOpenPress={handleOpenPress}
          onNamePress={handleNamePress}
        />

        <View style={styles.toolbar}>
          <SearchBar
            value={searchQuery}
            placeholder="Search the menu"
            onChangeText={setSearchQuery}
          />
          <MenuFilterTabs selectedTab={selectedTab} onTabPress={setSelectedTab} />
        </View>

        <MenuSection
          title=""
          products={PROMOTIONS_PRODUCTS}
          onProductPress={handleProductPress}
        />
        <MenuSection
          title="Picked For You"
          products={PICKED_FOR_YOU}
          onProductPress={handleProductPress}
        />
        <MenuSection
          title="Les Tacoths Classiques"
          products={CLASSIQUES}
          onProductPress={handleProductPress}
        />
        <MenuSection
          title="Les Tacoths Signatures"
          products={SIGNATURES}
          onProductPress={handleProductPress}
        />
        <MenuSection
          title="Tacoth Bowls"
          products={BOWLS}
          onProductPress={handleProductPress}
        />
      </Animated.ScrollView>

      {/* Compact sticky header — fades in as the banner scrolls away. */}
      <Animated.View
        style={[styles.compactHeader, { paddingTop: insets.top }, compactStyle]}
        pointerEvents={showCompact ? "auto" : "none"}
      >
        <View style={styles.compactBar}>
          <TouchableOpacity
            style={styles.compactBack}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#1A2B3D" />
          </TouchableOpacity>
          <View style={styles.compactLogoSlot} />
          <Text style={styles.compactName} numberOfLines={1}>
            {restaurant.name}
          </Text>
        </View>
        <MenuFilterTabs
          compact
          selectedTab={selectedTab}
          onTabPress={setSelectedTab}
        />
      </Animated.View>

      {/* Logo that transitions from the banner into the compact header. */}
      <Animated.View
        style={[styles.floatingLogo, logoStyle]}
        pointerEvents="none"
      >
        <Image
          source={imageSource(restaurant.logoUrl)}
          style={styles.floatingLogoImage}
          contentFit="cover"
        />
      </Animated.View>

      <TimingsModal
        visible={timingsVisible}
        timings={timings}
        onClose={() => setTimingsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  toolbar: {
    backgroundColor: "#FFFFFF",
  },
  compactHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  compactBar: {
    height: COMPACT_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  compactBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  compactLogoSlot: {
    width: COMPACT_LOGO_SIZE,
    marginLeft: 8,
  },
  compactName: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: "#1A2B3D",
  },
  floatingLogo: {
    position: "absolute",
    backgroundColor: "#F07D00",
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  floatingLogoImage: {
    width: "100%",
    height: "100%",
  },
});
