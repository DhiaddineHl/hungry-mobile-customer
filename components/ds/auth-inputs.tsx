import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { createStyles, Icon, useTheme } from '@/theme';
import { MAX_FONT_SCALE, Text } from './text';
import { TextField, type TextFieldProps } from './text-field';
import { Touchable } from './touchable';

// ---------------------------------------------------------------------------
// EmailChip — the settled address, shown back on every later auth step.
// 48 h, 1 divider border, radius 14; mail icon, email, `Change` pill.
// ---------------------------------------------------------------------------

export function EmailChip({
  email,
  onChange,
  style,
}: {
  email: string;
  /** Omit when the address cannot be changed from here. */
  onChange?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.chip, style]}>
      <Icon name="mail" size="row" color="inkMuted" />
      <Text variant="itemLabel" numberOfLines={1} style={styles.flex}>
        {email}
      </Text>
      {onChange ? (
        <Touchable onPress={onChange} accessibilityLabel="Change email" style={styles.change}>
          <Text variant="label">Change</Text>
        </Touchable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PhoneField — country segment (+216, flag, chevron) + number TextField.
// ---------------------------------------------------------------------------

export function PhoneField({
  label = 'Phone number',
  countryCode = '+216',
  containerStyle,
  ...fieldProps
}: Omit<TextFieldProps, 'label'> & { label?: string; countryCode?: string }) {
  const styles = useStyles();
  const message = typeof fieldProps.error === 'string' ? fieldProps.error : null;
  return (
    <View style={[styles.phone, containerStyle]}>
      <Text variant="label">{label}</Text>
      <View style={styles.phoneRow}>
        <View style={styles.country} accessibilityLabel={`Tunisia ${countryCode}`}>
          <Image source={require('@/assets/tunisia-icon.png')} style={styles.flag} contentFit="cover" />
          <Text variant="input">{countryCode}</Text>
          <Icon name="chevronDown" size="inline" />
        </View>
        <TextField
          placeholder="22 222 222"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          accessibilityLabel={label}
          containerStyle={styles.flex}
          {...fieldProps}
          // The message spans the whole row, under both boxes.
          error={fieldProps.error ? true : undefined}
          helper={undefined}
        />
      </View>
      {message ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon name="error" size="inline" color="danger" />
          <Text variant="fieldMessage" color="danger" style={styles.flex}>
            {message}
          </Text>
        </View>
      ) : fieldProps.helper ? (
        <Text variant="caption" color="inkMuted">
          {fieldProps.helper}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// OtpInput — N boxes (flex 1, gap 8, 56 h, radius 14). Focused box: white,
// 2 ink border, focus ring, orange caret. Error: every box red.
// ---------------------------------------------------------------------------

export interface OtpInputHandle {
  /** Puts the caret back in the first box — after a resend, say. */
  focusFirst(): void;
}

interface OtpInputProps {
  /** One entry per box; its length IS the code length. */
  value: string[];
  onChange: (next: string[]) => void;
  editable?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

/**
 * Controlled: the screen owns the digits (to know when the code is complete
 * and to clear it when the backend says it is dead); this owns only focus.
 * A pasted or autofilled code is spread across the boxes; an empty backspace
 * walks back one box.
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { value, onChange, editable = true, error, autoFocus },
  ref,
) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const codeLength = value.length;

  useImperativeHandle(ref, () => ({
    focusFirst: () => inputRefs.current[0]?.focus(),
  }));

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '');
    if (!digits) {
      onChange(value.map((digit, i) => (i === index ? '' : digit)));
      return;
    }
    const next = [...value];
    for (let i = 0; i < digits.length && index + i < codeLength; i++) {
      next[index + i] = digits[i];
    }
    onChange(next);
    const landed = Math.min(index + digits.length, codeLength - 1);
    inputRefs.current[landed]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.otpRow}>
      {value.map((digit, index) => {
        const isFocused = focused === index && !error;
        return (
          <View key={index} style={[styles.otpRing, isFocused && styles.otpRingOn]}>
            <TextInput
              ref={(instance) => {
                inputRefs.current[index] = instance;
              }}
              style={[styles.otpBox, isFocused && styles.otpBoxFocused, error && styles.otpBoxError]}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              onFocus={() => setFocused(index)}
              onBlur={() => setFocused((f) => (f === index ? null : f))}
              keyboardType="number-pad"
              // The OS autofills the whole code into the first box —
              // handleChange spreads it from there.
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? 'sms-otp' : 'off'}
              autoFocus={autoFocus && index === 0}
              maxLength={codeLength}
              editable={editable}
              selectTextOnFocus
              cursorColor={colors.primary}
              selectionColor={colors.primary}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              accessibilityLabel={`Digit ${index + 1} of ${codeLength}`}
            />
          </View>
        );
      })}
    </View>
  );
});

/** Countdown / Resend line under the code boxes, right-aligned. */
export function ResendLine({
  seconds,
  onResend,
  busy,
  leading,
}: {
  seconds: number;
  onResend: () => void;
  busy?: boolean;
  /** Error message on the left, beside the resend link (S-A3). */
  leading?: ReactNode;
}) {
  const styles = useStyles();
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <View style={styles.resend}>
      <View style={styles.flex}>{leading}</View>
      {seconds > 0 ? (
        <Text variant="meta" color="inkMuted" tabular>{`Resend code in ${mm}:${ss}`}</Text>
      ) : (
        <Touchable onPress={onResend} disabled={busy} accessibilityRole="link" accessibilityLabel="Resend code" hitSlop={12}>
          <Text variant="link" style={busy && styles.busy}>
            Resend code
          </Text>
        </Touchable>
      )}
    </View>
  );
}

/** Error message used under the OTP boxes (field-message style). */
export function FieldMessage({ message }: { message: string }) {
  const styles = useStyles();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View style={styles.message} accessibilityLiveRegion="polite">
      <Icon name="error" size="inline" color="danger" />
      <Text variant="fieldMessage" color="danger" style={styles.flex}>
        {message}
      </Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  chip: {
    height: t.size.emailChip,
    borderWidth: 1,
    borderColor: t.colors.divider,
    borderRadius: t.radius.field,
    paddingLeft: t.space[14],
    paddingRight: t.space[8],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[10],
  },
  change: {
    height: 32,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceSunken,
    paddingHorizontal: t.space[12],
    justifyContent: 'center',
  },
  phone: { gap: t.space[6] },
  phoneRow: { flexDirection: 'row', gap: t.space[8], alignItems: 'flex-start' },
  country: {
    height: t.size.input,
    borderRadius: t.radius.field,
    backgroundColor: t.colors.surfaceMuted,
    paddingHorizontal: t.space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[6],
  },
  flag: { width: 20, height: 14, borderRadius: 2 },
  message: { flexDirection: 'row', alignItems: 'center', gap: t.space[6] },
  otpRow: { flexDirection: 'row', gap: t.space[8] },
  otpRing: { flex: 1, margin: -4, padding: 2, borderRadius: t.radius.field + 4, borderWidth: 2, borderColor: 'transparent' },
  otpRingOn: { borderColor: t.colors.focusRing },
  otpBox: {
    height: t.size.otpBox,
    borderRadius: t.radius.field,
    backgroundColor: t.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
    textAlign: 'center',
    color: t.colors.ink,
    padding: 0,
    ...t.typography.otpDigit,
  },
  otpBoxFocused: { backgroundColor: t.colors.surface, borderColor: t.colors.ink },
  otpBoxError: { backgroundColor: t.colors.surface, borderColor: t.colors.danger },
  resend: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space[12] },
  busy: { opacity: t.opacity.lockedInput },
}));
