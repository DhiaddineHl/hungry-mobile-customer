import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { FontSize, Fonts, Palette, Radius, Spacing } from '@/constants/theme';

/** What a screen can ask of the boxes from the outside. */
export interface OtpInputHandle {
  /** Puts the caret back in the first box — after a resend, say. */
  focusFirst(): void;
}

interface OtpInputProps {
  /** One entry per box; its length IS the code length. */
  value: string[];
  onChange: (next: string[]) => void;
  editable?: boolean;
}

/**
 * The boxed one-time-code field, shared by the sign-up verification screen and
 * the password reset. Both ask for the same thing in the same shape, and the
 * fiddly parts — spreading a pasted or autofilled code across the boxes,
 * walking backwards on an empty backspace — are exactly the parts worth
 * writing once.
 *
 * Controlled: the screen owns the digits (it has to, to know when the code is
 * complete and to clear them when the backend says the code is dead) and this
 * owns only the focus.
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { value, onChange, editable = true },
  ref
) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
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

    // A pasted or autofilled code lands in one box: spread it across the rest
    // rather than keeping a single character and dropping the others.
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
    <View style={styles.container}>
      {value.map((digit, index) => (
        <TextInput
          key={index}
          ref={(instance) => {
            inputRefs.current[index] = instance;
          }}
          style={[styles.input, !!digit && styles.inputFilled]}
          value={digit}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
          keyboardType="number-pad"
          // One box, but the OS autofills the whole SMS/email code into
          // the first one — handleChange spreads it from there.
          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={index === 0 ? 'sms-otp' : 'off'}
          maxLength={codeLength}
          editable={editable}
          selectTextOnFocus
          accessibilityLabel={`Digit ${index + 1} of ${codeLength}`}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  input: {
    flex: 1,
    height: 60,
    backgroundColor: Palette.primarySoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.display,
    textAlign: 'center',
    color: Palette.ink,
    padding: 0,
  },
  inputFilled: {
    borderColor: Palette.primary,
  },
});
