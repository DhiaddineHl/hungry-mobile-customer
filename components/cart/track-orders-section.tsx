import { View, Text, StyleSheet } from 'react-native';
import { Fonts } from '@/constants/theme';
import DriverLogo from '@/assets/driver-logo.svg';

export function TrackOrdersSection() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Track your orders</Text>
      <View style={styles.imageContainer}>
        <DriverLogo width={240} height={200} />
      </View>
      <Text style={styles.description}>Track the orders you placed here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  imageContainer: {
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    textAlign: 'center',
  },
});
