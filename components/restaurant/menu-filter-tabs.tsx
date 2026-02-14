import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const MENU_TABS = [
  { id: 'promotions', label: 'Promotions' },
  { id: 'special', label: 'Special Menu' },
  { id: 'top', label: 'Top Seller' },
];

interface MenuFilterTabsProps {
  selectedTab?: string;
  onTabPress?: (tabId: string) => void;
}

export function MenuFilterTabs({ selectedTab = 'promotions', onTabPress }: MenuFilterTabsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore Menu</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {MENU_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, selectedTab === tab.id && styles.tabSelected]}
            onPress={() => onTabPress?.(tab.id)}
          >
            <Text style={[styles.tabText, selectedTab === tab.id && styles.tabTextSelected]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A2B3D',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    gap: 24,
  },
  tab: {
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: {
    borderBottomColor: '#F5A623',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8A8A8A',
  },
  tabTextSelected: {
    color: '#1A2B3D',
    fontWeight: '600',
  },
});
