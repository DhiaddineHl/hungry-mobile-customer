import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function ExploreScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>Coming soon...</Text>
      </View>
      <Text style={styles.description}>
        This section will contain restaurant discovery, categories, and search functionality.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A2B3D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FF8C00',
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
  },
});
