import { TouchableOpacity, StyleSheet, Text, Image } from 'react-native';

interface GoogleButtonProps {
  onPress: () => void;
}

export function GoogleButton({ onPress }: GoogleButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{ uri: 'https://www.google.com/favicon.ico' }}
        style={styles.icon}
      />
      <Text style={styles.text}>LOG IN WITH GOOGLE</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 24,
    height: 24,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B3D',
    letterSpacing: 0.5,
  },
});
