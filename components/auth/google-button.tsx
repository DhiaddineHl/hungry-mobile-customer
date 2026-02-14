import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface GoogleButtonProps {
  onPress: () => void;
  title?: string;
}

function GoogleIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 20 20">
      <Path
        d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z"
        fill="#4285F4"
      />
      <Path
        d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z"
        fill="#34A853"
      />
      <Path
        d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z"
        fill="#FBBC05"
      />
      <Path
        d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function GoogleButton({ onPress, title = 'LOG IN WITH GOOGLE' }: GoogleButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.content}>
        <GoogleIcon />
        <Text style={styles.text}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2B3D',
    letterSpacing: 0.5,
  },
});
