import { SearchBar } from "@/components/home";
import { QueryState } from "@/components/ui/query-state";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { useSearchAll } from "@/hooks/use-search";
import type { SearchProductDocument, SearchRestaurantDocument } from "@/services/api/search-service";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, Percent, Search as SearchIcon, Star } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Search results: restaurants and dishes matching the query, as two separate rails - mirrors
 * `CombinedSearchResult`'s own grouped (not blended) shape on the backend. Reachable from the
 * home screen's search bar, which used to be a no-op stub (`onChangeText` only `console.log`ged).
 *
 * Every hit already carries its resolved price/currency/promotion fields from the search index
 * (see `schemas/search.ts`) - no per-card computation or a second request to price a dish.
 */
export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? "");
  const [submittedQuery, setSubmittedQuery] = useState(params.q ?? "");

  const { data, isPending, isFetching, error, refetch } = useSearchAll(submittedQuery);

  const restaurants = data?.restaurants.documents ?? [];
  const products = data?.products.documents ?? [];
  const hasQuery = submittedQuery.trim().length > 0;
  const isEmpty = hasQuery && !isPending && restaurants.length === 0 && products.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSubmittedQuery(query)}
          placeholder="Search restaurants or dishes"
          autoFocus={!params.q}
        />
      </View>

      {!hasQuery ? (
        <View style={styles.state}>
          <SearchIcon size={40} color={Palette.textPlaceholder} />
          <Text style={styles.stateTitle}>Search Hungry</Text>
          <Text style={styles.stateBody}>Find a restaurant or a dish by name.</Text>
        </View>
      ) : (
        <QueryState
          isLoading={isPending}
          error={error}
          isEmpty={isEmpty}
          loading={
            <View style={styles.state}>
              <ActivityIndicator color={Palette.primary} />
            </View>
          }
          emptyTitle="No results"
          emptyBody={`Nothing matched "${submittedQuery}".`}
          onRetry={refetch}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {isFetching && !isPending && (
              <ActivityIndicator style={styles.refreshSpinner} color={Palette.primary} />
            )}

            {restaurants.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Restaurants</Text>
                {restaurants.map((restaurant) => (
                  <RestaurantResultRow
                    key={restaurant.id}
                    restaurant={restaurant}
                    onPress={() => router.push({ pathname: "/restaurant/[id]", params: { id: restaurant.id } })}
                  />
                ))}
              </View>
            )}

            {products.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dishes</Text>
                {products.map((product) => (
                  <ProductResultRow
                    key={product.id}
                    product={product}
                    onPress={() =>
                      product.vendorId &&
                      router.push({ pathname: "/food/[id]", params: { id: product.id, restaurantId: product.vendorId } })
                    }
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </QueryState>
      )}
    </View>
  );
}

function RestaurantResultRow({ restaurant, onPress }: { restaurant: SearchRestaurantDocument; onPress: () => void }) {
  const cuisines = restaurant.cuisines.join(" · ");
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {restaurant.name ?? "Restaurant"}
        </Text>
        {!!cuisines && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {cuisines}
          </Text>
        )}
        <View style={styles.rowMetaLine}>
          {restaurant.ratingAverage != null && (
            <View style={styles.rowMetaItem}>
              <Star size={13} color={Palette.warning} fill={Palette.warning} />
              <Text style={styles.rowMetaText}>{restaurant.ratingAverage.toFixed(1)}</Text>
            </View>
          )}
          {!!restaurant.municipality && (
            <View style={styles.rowMetaItem}>
              <MapPin size={13} color={Palette.textMuted} />
              <Text style={styles.rowMetaText}>{restaurant.municipality}</Text>
            </View>
          )}
        </View>
      </View>
      {restaurant.hasActivePromotion && !!restaurant.promotionHeadline && (
        <View style={styles.promoBadge}>
          <Percent size={12} color={Palette.white} />
          <Text style={styles.promoBadgeText}>{restaurant.promotionHeadline}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ProductResultRow({ product, onPress }: { product: SearchProductDocument; onPress: () => void }) {
  const discounted = product.hasActivePromotion && product.effectivePrice != null && product.effectivePrice !== product.price;
  const symbol = product.currencySymbol ?? "";
  const decimals = product.currencyDecimalPlaces ?? 2;
  const formatted = (amount: number) =>
    product.currencyDisplayFormat === "PREFIX" ? `${symbol} ${amount.toFixed(decimals)}` : `${amount.toFixed(decimals)} ${symbol}`;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {product.name ?? "Dish"}
        </Text>
        {!!product.vendorName && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {product.vendorName}
          </Text>
        )}
        {!!product.promotionCode && (
          <Text style={styles.couponText}>Use code {product.promotionCode}</Text>
        )}
      </View>
      <View style={styles.priceColumn}>
        {discounted && product.price != null && <Text style={styles.priceStrike}>{formatted(product.price)}</Text>}
        {product.effectivePrice != null && (
          <Text style={[styles.priceText, discounted && styles.priceTextDiscounted]}>
            {formatted(product.effectivePrice)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.borderSubtle,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  refreshSpinner: {
    marginTop: Spacing.sm,
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  stateTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  stateBody: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: "center",
  },
  section: {
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.borderSubtle,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  rowSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
  },
  rowMetaLine: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: 4,
  },
  rowMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowMetaText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  promoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primaryDeep,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  promoBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Palette.white,
  },
  couponText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Palette.primaryDark,
    marginTop: 2,
  },
  priceColumn: {
    alignItems: "flex-end",
  },
  priceStrike: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textDecorationLine: "line-through",
  },
  priceText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  priceTextDiscounted: {
    color: Palette.danger,
  },
});
