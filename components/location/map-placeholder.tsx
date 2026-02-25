import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Fonts } from '@/constants/theme';

export function MapPlaceholder() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1A2B3D" />
      <Text style={styles.text}>Map available on mobile devices</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#E8E8E8',
  },
  text: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#8A8A8A',
  },
});
