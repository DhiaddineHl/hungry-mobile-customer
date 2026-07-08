import type { AddonGroupData } from "@/components/food";
import {
  AddonGroup,
  AddToCartBar,
  FoodHeader,
  FrequentlyBoughtTogether,
  SpecialInstructions,
} from "@/components/food";
import { Fonts } from "@/constants/theme";
import { type CartAddon, useCartStore } from "@/store/cart-store";
import { useFavoritesStore, useIsFavorite } from "@/store/favorites-store";
import type { ImageSource } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ShoppingBag } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

// This menu belongs to the Tacoth restaurant.
const RESTAURANT_ID = "1";
const RESTAURANT_NAME = "Tacoth";
const RESTAURANT_LOGO = require("@/assets/restaurants-images/restaurant-2.jpg");

const FOOD_DATA: Record<
  string,
  {
    id: string;
    name: string;
    price: number;
    originalPrice?: string;
    discount?: string;
    description?: string;
    rating?: string;
    reviewCount?: string;
    image: ImageSource | number;
    addonGroups: AddonGroupData[];
  }
> = {
  c1: {
    id: "c1",
    name: "Crispy Chicken",
    price: 9.68,
    originalPrice: "12,9 DT",
    discount: "-25%",
    description:
      "Breaded chicken escalope, bell peppers, caramelized onion, fries, cheddar sauce, choice sauce",
    rating: "76%",
    reviewCount: "22",
    image: require("@/assets/products/product-banner-1.jpg"),
    addonGroups: [
      {
        id: "extras",
        title: "Something Extra",
        subtitle: "Choose up to 6",
        type: "checkbox",
        required: false,
        maxSelect: 6,
        options: [
          { id: "egg", name: "Egg", price: "+1 DT", isPopular: true },
          { id: "mushrooms", name: "Mushrooms", price: "+3,5 DT" },
          { id: "ham", name: "Ham", price: "+1,5 DT" },
          { id: "cheddar_sauce", name: "Cheddar Cheese Sauce", price: "+2 DT" },
          {
            id: "cheddar_slice",
            name: "Cheddar Fromage Slice",
            price: "+1 DT",
          },
          { id: "but", name: "But", price: "+1 DT" },
        ],
      },
      {
        id: "sauce",
        title: "Add some sauce",
        subtitle: "Choose up to 3",
        type: "checkbox",
        required: true,
        maxSelect: 3,
        options: [
          { id: "bbq", name: "BBQ sauce", isPopular: true },
          { id: "garlic", name: "Garlic sauce" },
          { id: "harissa", name: "Harissa" },
          { id: "ketchup", name: "Ketchup" },
          { id: "mayo", name: "Mayonnaise" },
        ],
      },
      {
        id: "size",
        title: "Choose crispy chicken size",
        subtitle: "Choose up to 1",
        type: "radio",
        required: true,
        maxSelect: 1,
        options: [
          { id: "maxi", name: "Maxi crispy chicken", price: "+4,2 DT" },
          { id: "normal", name: "Normal" },
        ],
      },
    ],
  },
};

const DEFAULT_FOOD = FOOD_DATA["c1"];

const FREQUENTLY_BOUGHT = [
  {
    id: "fb1",
    name: "Boga - Lim (24Cl) Canette",
    price: "2,7 DT",
    image: require("@/assets/products/product-5.png"),
    isPopular: true,
  },
  {
    id: "fb2",
    name: "Nuggets (12 pcs)",
    description: "12 pieces of nuggets",
    price: "12,9 DT",
    image: require("@/assets/products/product-4.png"),
  },
  {
    id: "fb3",
    name: "Nuggets (12 pcs)",
    description: "12 pieces of nuggets",
    price: "12,9 DT",
    image: require("@/assets/products/prodcut-3.png"),
  },
];

export default function FoodDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const food = FOOD_DATA[id] ?? DEFAULT_FOOD;

  const [quantity, setQuantity] = useState(1);
  const [specialNote, setSpecialNote] = useState("");
  const [validated, setValidated] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useIsFavorite("food", food.id);

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

  const handleGoToCart = () => router.push(`/cart/${RESTAURANT_ID}`);

  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    food.addonGroups.forEach((g) => {
      initial[g.id] = [];
    });
    return initial;
  });

  const handleToggle = useCallback(
    (groupId: string, optionId: string) => {
      setSelections((prev) => {
        const group = food.addonGroups.find((g) => g.id === groupId);
        if (!group) return prev;
        const current = prev[groupId] ?? [];

        if (group.type === "radio") {
          return { ...prev, [groupId]: [optionId] };
        }

        if (current.includes(optionId)) {
          return {
            ...prev,
            [groupId]: current.filter((id) => id !== optionId),
          };
        }

        if (group.maxSelect && current.length >= group.maxSelect) {
          return prev;
        }

        return { ...prev, [groupId]: [...current, optionId] };
      });
    },
    [food.addonGroups],
  );

  const requiredGroups = food.addonGroups.filter((g) => g.required);
  const allRequiredSatisfied = requiredGroups.every((g) => {
    const sel = selections[g.id] ?? [];
    return sel.length > 0;
  });

  const basePrice = food.price;
  const addonsPrice = food.addonGroups.reduce((total, group) => {
    const sel = selections[group.id] ?? [];
    return (
      total +
      group.options
        .filter((opt) => sel.includes(opt.id))
        .reduce((sum, opt) => {
          if (!opt.price) return sum;
          const match = opt.price.match(/[\d,]+/);
          if (!match) return sum;
          return sum + parseFloat(match[0].replace(",", "."));
        }, 0)
    );
  }, 0);

  const totalPrice =
    ((basePrice + addonsPrice) * quantity).toFixed(2).replace(".", ",") + " DT";
  const priceLabel = basePrice.toFixed(2).replace(".", ",") + " DT";

  const handleAddToCart = () => {
    setValidated(true);
    if (!allRequiredSatisfied) return;

    const selectedAddons: CartAddon[] = food.addonGroups.flatMap((group) => {
      const sel = selections[group.id] ?? [];
      return group.options
        .filter((opt) => sel.includes(opt.id))
        .map((opt) => {
          const match = opt.price?.match(/[\d,]+/);
          const price = match ? parseFloat(match[0].replace(",", ".")) : 0;
          return { id: opt.id, name: opt.name, price };
        });
    });

    addItem({
      foodId: food.id,
      name: food.name,
      image: food.image,
      unitPrice: basePrice + addonsPrice,
      basePrice,
      quantity,
      addons: selectedAddons,
      note: specialNote.trim() || undefined,
      restaurantId: RESTAURANT_ID,
      restaurantName: RESTAURANT_NAME,
      restaurantLogo: RESTAURANT_LOGO,
    });

    router.back();
  };

  const handleToggleFavorite = () => {
    toggleFavorite({
      id: food.id,
      type: "food",
      name: food.name,
      image: food.image,
      subtitle: food.description,
      price: priceLabel,
      rating: food.rating,
      reviewCount: food.reviewCount,
      restaurantId: RESTAURANT_ID,
    });
  };

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
          name={food.name}
          price={basePrice.toFixed(2).replace(".", ",") + " DT"}
          originalPrice={food.originalPrice}
          discount={food.discount}
          description={food.description}
          rating={food.rating}
          reviewCount={food.reviewCount}
          image={food.image}
          isFavorite={isFavorite}
          onBack={() => router.back()}
          onFavorite={handleToggleFavorite}
        />

        {food.addonGroups.map((group) => (
          <AddonGroup
            key={group.id}
            group={group}
            selectedIds={selections[group.id] ?? []}
            isValidated={validated}
            onToggle={handleToggle}
          />
        ))}

        <SpecialInstructions
          value={specialNote}
          onChangeText={setSpecialNote}
        />

        <FrequentlyBoughtTogether items={FREQUENTLY_BOUGHT} />

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
            <ChevronLeft size={24} color="#1A2B3D" />
          </TouchableOpacity>

          <View style={styles.stickyInfo}>
            <Text style={styles.stickyName} numberOfLines={1}>
              {food.name}
            </Text>
            <Text style={styles.stickyPrice}>{priceLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.cartBtn}
            onPress={handleGoToCart}
            activeOpacity={0.85}
            accessibilityLabel="Go to cart"
          >
            <ShoppingBag size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <AddToCartBar
        quantity={quantity}
        total={totalPrice}
        onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
        onIncrement={() => setQuantity((q) => q + 1)}
        onAddToCart={handleAddToCart}
      />

      {validated && !allRequiredSatisfied && (
        <View style={styles.validationBanner}>
          {requiredGroups
            .filter((g) => (selections[g.id] ?? []).length === 0)
            .slice(0, 1)
            .map((g) => (
              <View key={g.id} />
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
  validationBanner: {
    position: "absolute",
    bottom: 0,
  },
  stickyHeader: {
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
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: "#1A2B3D",
  },
  stickyPrice: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: "#F5A623",
    marginTop: 1,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
});
