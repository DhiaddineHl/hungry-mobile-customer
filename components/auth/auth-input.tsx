import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BlurEvent, FocusEvent, TextInputProps } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Eye, EyeOff } from 'lucide-react-native';
import { Duration, FontSize, Fonts, Palette, Radius, Spacing } from '@/constants/theme';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
}

/**
 * Labelled auth field.
 *
 * The border colour animates on focus (and to danger when the field is in
 * error) on the UI thread — only a colour interpolation, never layout. Shared
 * values use `.get()/.set()` for React Compiler compatibility.
 */
export function AuthInput({
  label,
  error,
  isPassword = false,
  style,
  onFocus,
  onBlur,
  ...props
}: AuthInputProps) {
  const [hidden, setHidden] = useState(true);
  const focus = useSharedValue(0);

  const restColor = error ? Palette.danger : Palette.border;
  const activeColor = error ? Palette.danger : Palette.primaryDeep;

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.get(), [0, 1], [restColor, activeColor]),
  }));

  const handleFocus = (event: FocusEvent) => {
    focus.set(withTiming(1, { duration: Duration.fast }));
    onFocus?.(event);
  };

  const handleBlur = (event: BlurEvent) => {
    focus.set(withTiming(0, { duration: Duration.base }));
    onBlur?.(event);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputWrapper, borderStyle]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Palette.textPlaceholder}
          secureTextEntry={isPassword && hidden}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((prev) => !prev)}
            hitSlop={10}
            style={styles.eyeButton}
          >
            {hidden ? (
              <Eye size={20} color={Palette.textMuted} />
            ) : (
              <EyeOff size={20} color={Palette.textMuted} />
            )}
          </Pressable>
        ) : null}
      </Animated.View>
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSize.lg,
    color: Palette.ink,
    // Kills Android's default input padding so both platforms measure the same.
    padding: 0,
  },
  eyeButton: {
    paddingLeft: Spacing.sm,
  },
  error: {
    fontFamily: Fonts.regular,
    color: Palette.danger,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
});
