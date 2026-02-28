import { View, StyleSheet } from 'react-native';
import AuthPageUpperSection from '@/assets/auth-page-upper-section.svg';

export function AuthHeader() {
  return (
    <View style={styles.container}>
      <AuthPageUpperSection
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
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
});
