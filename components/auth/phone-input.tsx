import { Image } from 'expo-image';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import { Duration, FontSize, Fonts, Palette, Radius, Spacing } from '@/constants/theme';

interface PhoneInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  countryCode?: string;
  error?: string;
  placeholder?: string;
}

/**
 * Phone field: a static country pill beside the number input, both sharing the
 * `AuthInput` shell (56pt, `Radius.lg`, `Palette.border`). Only the number is
 * validated — the country code is fixed until multi-country support lands.
 */
export function PhoneInput({
  label,
  value,
  onChangeText,
  countryCode = '+216',
  error,
  placeholder = '22 222 222',
}: PhoneInputProps) {
  const focus = useSharedValue(0);

  const restColor = error ? Palette.danger : Palette.border;
  const activeColor = error ? Palette.danger : Palette.primaryDeep;

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.get(), [0, 1], [restColor, activeColor]),
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <View style={styles.countrySelector}>
          <Image
            source={require('@/assets/tunisia-icon.png')}
            style={styles.flag}
            contentFit="contain"
            accessibilityLabel="Tunisia"
          />
          <Text style={styles.countryCode}>{countryCode}</Text>
          <ChevronDown size={16} color={Palette.ink} />
        </View>
        <Animated.View style={[styles.phoneInputWrapper, borderStyle]}>
          <TextInput
            style={styles.phoneInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Palette.textPlaceholder}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            onFocus={() => focus.set(withTiming(1, { duration: Duration.fast }))}
            onBlur={() => focus.set(withTiming(0, { duration: Duration.base }))}
          />
        </Animated.View>
      </View>
      {error ? (
        <Animated.Text
          entering={FadeIn.duration(Duration.fast).reduceMotion(ReduceMotion.System)}
          style={styles.error}
        >
          {error}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  // The asset is square (512 x 512), so it is sized square too — the old
  // inline flag's 24 x 16 box would squash it.
  flag: {
    width: 22,
    height: 22,
  },
  countryCode: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
  },
  phoneInputWrapper: {
    flex: 1,
    justifyContent: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
  },
  phoneInput: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.lg,
    color: Palette.ink,
    padding: 0,
  },
  error: {
    fontFamily: Fonts.regular,
    color: Palette.danger,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
});
