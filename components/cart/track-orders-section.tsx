import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Fonts } from '@/constants/theme';

export function TrackOrdersSection() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Track your orders</Text>
      <View style={styles.imageContainer}>
        <Image
          source={require('@/assets/driver-logo.svg')}
          style={styles.image}
          contentFit="contain"
        />
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
    width: 240,
    height: 200,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    textAlign: 'center',
  },
});
