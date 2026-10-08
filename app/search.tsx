import { useMemo, useState } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AccentHeadline,
  FilterChip,
  IconButton,
  IconWell,
  RestaurantRow,
  RestaurantRowSkeleton,
  Screen,
  SearchField,
  SectionHeader,
  Separated,
  StateView,
  Text,
  TextLink,
  Touchable,
} from '@/components/ds';
import {
  FILTERS,
  cuisineCounts,
  matchesFilters,
  matchesQuery,
  normalize,
  openFirst,
  type FilterId,
} from '@/components/home/restaurant-filters';
import { useRestaurants } from '@/hooks/use-restaurants';
import { useRecentSearchStore } from '@/store/recent-search-store';
import { createStyles, withCount } from '@/theme';

/** The text with the typed letters in bold (S2). */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? normalize(text).indexOf(normalize(query)) : -1;
  if (at < 0) {
    return (
      <Text variant="itemLabel" numberOfLines={1}>
        {text}
      </Text>
    );
  }
  return (
    <Text variant="itemLabel" numberOfLines={1}>
      {text.slice(0, at)}
      <Text variant="itemTitle">{text.slice(at, at + query.length)}</Text>
      {text.slice(at + query.length)}
    </Text>
  );
}

/**
 * S1–S5 Search. Before typing: recent searches and what is popular, so it is
 * never empty. While typing: suggestions grouped by cuisine and restaurant.
 * Submitted: results with filters; closed places stay listed but greyed. No
 * match: suggestions instead of an empty screen.
 *
 * Runs over the loaded catalog on the device — the Solr search API is not
 * wired yet (docs/plans/home-search-migration-plan.md), so there are no dish
 * results to offer and the Dishes tab is left out rather than shown empty.
 */
export default function SearchScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { data: restaurants, isPending, error, refetch } = useRestaurants({ sort: 'name' });
  const recent = useRecentSearchStore((s) => s.queries);
  const addRecent = useRecentSearchStore((s) => s.add);
  const clearRecent = useRecentSearchStore((s) => s.clear);

  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterId[]>([]);

  const all = useMemo(() => restaurants ?? [], [restaurants]);
  const cuisines = useMemo(() => cuisineCounts(all), [all]);
  const typed = query.trim();

  const suggestions = useMemo(() => {
    if (!typed || submitted !== null) return null;
    const q = normalize(typed);
    return {
      cuisines: cuisines.filter((c) => normalize(c.name).includes(q)).slice(0, 3),
      restaurants: all.filter((r) => normalize(r.name).includes(q)).slice(0, 5),
    };
  }, [typed, submitted, cuisines, all]);

  const results = useMemo(
    () =>
      submitted === null
        ? []
        : all.filter((r) => matchesQuery(r, submitted) && matchesFilters(r, filters)).sort(openFirst),
    [submitted, all, filters],
  );

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    Keyboard.dismiss();
    setQuery(q);
    setSubmitted(q);
    addRecent(q);
  };

  const onChange = (text: string) => {
    setQuery(text);
    // Editing a submitted query goes back to suggestions.
    if (submitted !== null) setSubmitted(null);
  };

  const openRestaurant = (id: string, name?: string) => {
    if (name) addRecent(name);
    router.push(`/restaurant/${id}`);
  };

  const toggleFilter = (id: FilterId) =>
    setFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const renderIdle = () => (
    <>
      {recent.length > 0 ? (
        <>
          <SectionHeader title="Recent" action={<TextLink label="Clear" onPress={clearRecent} />} />
          <View style={styles.chips}>
            {recent.map((q) => (
              <FilterChip key={q} label={q} onPress={() => submit(q)} />
            ))}
          </View>
        </>
      ) : null}
      <SectionHeader title="Popular right now" />
      {isPending ? (
        <>
          <RestaurantRowSkeleton />
          <RestaurantRowSkeleton />
        </>
      ) : (
        all
          .filter((r) => r.isOpen !== false)
          .slice(0, 4)
          .map((r) => <RestaurantRow key={r.id} restaurant={r} onPress={() => openRestaurant(r.id)} />)
      )}
    </>
  );

  const renderSuggestions = () => {
    if (!suggestions) return null;
    const empty = suggestions.cuisines.length === 0 && suggestions.restaurants.length === 0;
    if (empty) {
      return (
        <Text variant="meta" color="inkMuted" style={styles.hint}>
          Press search to look for “{typed}”.
        </Text>
      );
    }
    return (
      <>
        {suggestions.cuisines.length > 0 ? (
          <View style={styles.group}>
            <Text variant="overline" color="inkMuted">
              Cuisine
            </Text>
            {suggestions.cuisines.map((c) => (
              <Touchable key={c.name} scaleTo={1} onPress={() => submit(c.name)} accessibilityLabel={c.name} style={styles.suggestion}>
                <IconWell icon="search" size={40} round />
                <View style={styles.flex}>
                  <Highlight text={c.name} query={typed} />
                  <Text variant="meta" color="inkMuted">
                    {`${c.count} ${c.count === 1 ? 'place' : 'places'} near you`}
                  </Text>
                </View>
              </Touchable>
            ))}
          </View>
        ) : null}
        {suggestions.restaurants.length > 0 ? (
          <View style={styles.group}>
            <Text variant="overline" color="inkMuted">
              Restaurants
            </Text>
            {suggestions.restaurants.map((r) => (
              <Touchable
                key={r.id}
                scaleTo={1}
                onPress={() => openRestaurant(r.id, r.name)}
                accessibilityLabel={r.name}
                style={styles.suggestion}
              >
                <IconWell icon="store" size={40} round />
                <View style={styles.flex}>
                  <Highlight text={r.name} query={typed} />
                  {r.categories ? (
                    <Text variant="meta" color="inkMuted" numberOfLines={1}>
                      {r.categories.replace(/ - /g, ' · ')}
                    </Text>
                  ) : null}
                </View>
              </Touchable>
            ))}
          </View>
        ) : null}
      </>
    );
  };

  const renderResults = () => {
    if (isPending) {
      return Array.from({ length: 5 }, (_, i) => <RestaurantRowSkeleton key={i} />);
    }
    if (error) {
      return (
        <StateView
          icon="offline"
          title="Couldn't search"
          body="Check your connection, then try again."
          actions={[{ label: 'Try again', onPress: () => refetch() }]}
          style={styles.state}
        />
      );
    }
    if (results.length === 0) {
      const tryInstead = cuisines.filter((c) => normalize(c.name) !== normalize(submitted ?? '')).slice(0, 4);
      return (
        <View style={styles.noResults}>
          <AccentHeadline text={`Nothing for “${submitted}” yet`} accent="." variant="display" />
          <Text variant="bodySmall" color="inkMuted">
            {filters.length > 0
              ? 'Clear the filters, check the spelling, or try something broader.'
              : 'Check the spelling, or try something broader.'}
          </Text>
          {tryInstead.length > 0 ? (
            <>
              <Text variant="itemTitle" style={styles.tryTitle}>
                Try instead
              </Text>
              <View style={styles.chips}>
                {tryInstead.map((c) => (
                  <FilterChip key={c.name} label={c.name} onPress={() => submit(c.name)} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      );
    }
    return (
      <>
        <Text variant="overline" color="inkMuted" style={styles.resultsCount}>
          {withCount('Restaurants', results.length)}
        </Text>
        <Separated>
          {results.map((r) => (
            <RestaurantRow key={r.id} restaurant={r} onPress={() => openRestaurant(r.id)} />
          ))}
        </Separated>
      </>
    );
  };

  return (
    <Screen>
      <View style={styles.bar}>
        <IconButton icon="back" onPress={() => router.back()} accessibilityLabel="Back" />
        <SearchField
          placeholder="Restaurants, dishes, cuisines"
          value={query}
          onChangeText={onChange}
          onSubmitEditing={() => submit(query)}
          onClear={() => onChange('')}
          autoFocus
          autoCorrect={false}
          containerStyle={styles.flex}
        />
      </View>

      {submitted !== null && results.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail} style={styles.filterBar}>
          {FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} selected={filters.includes(f.id)} onPress={() => toggleFilter(f.id)} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {submitted !== null ? renderResults() : typed ? renderSuggestions() : renderIdle()}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[10],
    paddingHorizontal: t.chromePadding,
    paddingVertical: t.space[4],
  },
  filterBar: { flexGrow: 0 },
  filterRail: { paddingHorizontal: t.screenPadding, paddingVertical: t.space[12], gap: t.space[8] },
  content: { paddingHorizontal: t.screenPadding, paddingBottom: t.space[32] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[8] },
  hint: { marginTop: t.space[20] },
  group: { marginTop: t.space[20], gap: t.space[4] },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: t.space[14], paddingVertical: t.space[10] },
  resultsCount: { marginTop: t.space[8], marginBottom: t.space[4] },
  noResults: { paddingTop: 72, gap: t.space[12] },
  tryTitle: { marginTop: t.space[16] },
  state: { paddingVertical: t.space[32] },
}));
