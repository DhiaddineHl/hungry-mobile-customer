import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Fonts, FontSize, Palette, Spacing } from '@/constants/theme';
import { PressableScale } from '@/components/ui/pressable-scale';

/** One selectable menu category. `id` is the category name the sections use. */
export interface MenuTab {
  id: string;
  label: string;
}

interface MenuFilterTabsProps {
  /**
   * The restaurant's own categories. The strip previously hardcoded
   * "Promotions" / "Special Menu" / "Top Seller"; NONE of those exist in the
   * backend — there is no promotion, featured or best-seller concept anywhere
   * in the product model — and mapping them onto real categories would label
   * dishes with something they do not mean.
   */
  tabs: MenuTab[];
  /** `null` shows every section. */
  selectedTab?: string | null;
  onTabPress?: (tabId: string | null) => void;
  /** Slim variant for the sticky header — hides the title and trims padding. */
  compact?: boolean;
}

const ALL_TAB_LABEL = 'All';

export function MenuFilterTabs({
  tabs,
  selectedTab = null,
  onTabPress,
  compact,
}: MenuFilterTabsProps) {
  // An empty bar is worse than no bar: it takes up the same room and offers
  // nothing. A single category is equally pointless — it filters to itself.
  if (tabs.length < 2) return null;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {!compact && <Text style={styles.title}>Explore Menu</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        <Tab
          label={ALL_TAB_LABEL}
          selected={selectedTab === null}
          onPress={() => onTabPress?.(null)}
        />
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            label={tab.label}
            selected={selectedTab === tab.id}
            onPress={() => onTabPress?.(tab.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface TabProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Tab({ label, selected, onPress }: TabProps) {
  return (
    <PressableScale
      style={[styles.tab, selected && styles.tabSelected]}
      onPress={onPress}
      scaleTo={0.97}
      accessibilityLabel={label}
    >
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
  },
  containerCompact: {
    paddingVertical: 6,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  tabsContainer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xxl,
  },
  tab: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: {
    borderBottomColor: Palette.warning,
  },
  tabText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
  },
  tabTextSelected: {
    color: Palette.textPrimary,
    fontFamily: Fonts.semiBold,
  },
});
