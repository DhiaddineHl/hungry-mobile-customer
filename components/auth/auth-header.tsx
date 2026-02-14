import { View, StyleSheet, Image } from 'react-native';

export function AuthHeader() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/auth-page-upper-section.svg')}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
