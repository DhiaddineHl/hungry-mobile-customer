import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import VerificationUpperSection from '@/assets/verification-upper-section.svg';
import { AuthButton } from '@/components/auth';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useAuth } from '@/contexts/auth-context';
import { isApiError } from '@/services/api/client';
import { confirmVerificationCode, sendVerificationCode } from '@/services/api/customer-service';
import { usePendingVerificationStore } from '@/store/pending-verification-store';
import { Duration, FontSize, Fonts, Palette, Radius, Spacing } from '@/constants/theme';

/**
 * Boxes drawn before the backend has said otherwise. Must match
 * `hungry.customer.verification.code-length` (default 6) in the backend
 * properties; a resend answers with the authoritative `codeLength`, which
 * replaces this.
 */
const DEFAULT_CODE_LENGTH = 6;

/**
 * Seconds the Resend button stays asleep after a code goes out. Mirrors
 * `hungry.customer.verification.resend-cooldown-seconds`; the backend is the
 * one that enforces it, this only keeps the button from being pressed into a
 * guaranteed 429.
 */
const DEFAULT_RESEND_COOLDOWN = 60;

export default function VerificationScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { user, isAuthenticated, login, reloadUser } = useAuth();
  const pending = usePendingVerificationStore();
  const clearPending = pending.clear;

  /**
   * Two ways in, one screen:
   *  - straight from sign-up, where the store holds the address and the
   *    password the confirmation will sign in with, and registration has
   *    already mailed a code;
   *  - from a session that is authenticated but unverified (an account that
   *    abandoned this step earlier and logged back in), where the address
   *    comes from the token and nothing has been sent yet.
   */
  const derivedEmail = pending.email ?? params.email ?? user?.email ?? null;
  const codeAlreadySent = !!pending.email;

  // Held in state rather than read straight from the store: clearing the
  // pending registration (which happens the moment a code is accepted) would
  // otherwise pull the address out from under a screen that is still on
  // display — and the screen has nothing to say without one.
  const [email, setEmail] = useState(derivedEmail);
  if (derivedEmail && derivedEmail !== email) {
    // Adjusting own state during render, the pattern React documents for
    // "derived from props, but sticky": it re-renders immediately with the new
    // value and never commits the intermediate one, unlike an effect.
    setEmail(derivedEmail);
  }

  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [code, setCode] = useState<string[]>(() => Array(DEFAULT_CODE_LENGTH).fill(''));
  const [timer, setTimer] = useState(codeAlreadySent ? DEFAULT_RESEND_COOLDOWN : 0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const fullCode = code.join('');
  const isComplete = fullCode.length === codeLength;

  const applyChallenge = useCallback(
    (challenge: { codeLength: number; resendAvailableInSeconds: number; delivered: boolean }) => {
      setCodeLength(challenge.codeLength);
      setCode(Array(challenge.codeLength).fill(''));
      setTimer(challenge.resendAvailableInSeconds || DEFAULT_RESEND_COOLDOWN);
      // A backend with no mail transport only logs the code (see the dev
      // properties). Saying so beats letting the user wait for an e-mail that
      // was never going to arrive.
      setNotice(
        challenge.delivered
          ? null
          : 'The server has no mail transport configured — the code is in its logs.'
      );
    },
    []
  );

  const requestCode = useCallback(
    async (address: string) => {
      setError(null);
      setIsResending(true);
      try {
        const challenge = await sendVerificationCode(address);
        if (challenge.alreadyVerified) {
          setNotice('This email is already verified. You can sign in.');
          setTimer(0);
          return;
        }
        applyChallenge(challenge);
        inputRefs.current[0]?.focus();
      } catch (err) {
        // 429 is the cool-down, and it tells us exactly how long is left —
        // adopt that instead of guessing, so the button and the server agree.
        if (isApiError(err, 429)) {
          const retryAfter = err.data?.retryAfterSeconds;
          if (typeof retryAfter === 'number') setTimer(Math.ceil(retryAfter));
        }
        setError(err instanceof Error ? err.message : 'Could not send the code. Please try again.');
      } finally {
        setIsResending(false);
      }
    },
    [applyChallenge]
  );

  // Arriving with a session but no code in flight (the abandoned-verification
  // case): send one, once.
  //
  // Seeded from codeAlreadySent, not false: on the sign-up path registration
  // has already mailed a code, and clearing the pending store after a
  // successful confirmation would otherwise make this look like a fresh
  // arrival and fire off a pointless new code on the way out.
  const autoSent = useRef(codeAlreadySent);
  useEffect(() => {
    if (codeAlreadySent || !email || autoSent.current) return;
    autoSent.current = true;
    requestCode(email);
  }, [codeAlreadySent, email, requestCode]);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleCodeChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '');
    if (!digits) {
      setCode((prev) => prev.map((digit, i) => (i === index ? '' : digit)));
      return;
    }

    // A pasted or autofilled code lands in one box: spread it across the rest
    // rather than keeping a single character and dropping the others.
    setCode((prev) => {
      const next = [...prev];
      for (let i = 0; i < digits.length && index + i < codeLength; i++) {
        next[index + i] = digits[i];
      }
      return next;
    });
    setError(null);

    const landed = Math.min(index + digits.length, codeLength - 1);
    inputRefs.current[landed]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    if (timer > 0 || isResending || !email) return;
    requestCode(email);
  };

  const handleVerify = async () => {
    if (!email || !isComplete || isVerifying) return;
    setError(null);
    setNotice(null);
    setIsVerifying(true);
    try {
      await confirmVerificationCode(email, fullCode);

      // Verified — but the app still needs a session. Signing in only happens
      // on the sign-up path; an already-authenticated user just needs their
      // userinfo re-read so `email_verified` stops sending them back here.
      if (pending.password) {
        const result = await login(email, pending.password);
        if (!result.success) {
          // The address is confirmed and the credentials are gone from memory
          // the moment we leave; the honest move is to send them to /login
          // rather than pretend the flow can continue.
          clearPending();
          setError(
            `${result.error ?? 'Sign-in failed'} — your email is verified, please log in to continue.`
          );
          return;
        }
        const destination = pending.needsAddress ? '/location' : '/(tabs)';
        clearPending();
        router.replace(destination);
        return;
      }

      await reloadUser({ email_verified: true });
      clearPending();
      // The root navigator owns where a verified session belongs (tabs, or the
      // address onboarding when the record has nowhere to deliver to).
      router.replace('/(tabs)');
    } catch (err) {
      // 410 (expired) and 429 (attempts used up) both mean the code is dead:
      // point at Resend instead of letting the user retype a corpse.
      if (isApiError(err, 410) || isApiError(err, 429)) {
        setTimer(0);
        setCode(Array(codeLength).fill(''));
      }
      setError(err instanceof Error ? err.message : 'Could not verify the code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangeEmail = () => {
    clearPending();
    router.replace('/signup');
  };

  const greeting = useMemo(
    () => (pending.firstName ? `Almost there, ${pending.firstName}!` : 'We sent a code to your email'),
    [pending.firstName]
  );

  // Nothing to verify — the store was cleared (app restart mid-flow) and no
  // session or param supplied an address.
  if (!email) {
    return (
      <View style={styles.emptyState}>
        <StatusBar style="dark" />
        <Text style={styles.emptyTitle}>Nothing to verify</Text>
        <Text style={styles.emptyBody}>
          We do not know which email to confirm. Sign in and we will pick the verification back up.
        </Text>
        <AuthButton
          title="GO TO LOGIN"
          onPress={() => router.replace('/login')}
          color={Palette.primaryDeep}
          shape="rounded"
          style={styles.emptyButton}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <VerificationUpperSection
            width="100%"
            style={styles.headerImage}
            preserveAspectRatio="xMidYMid slice"
          />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Verification</Text>
            <Text style={styles.headerSubtitle}>{greeting}</Text>
            <Text style={styles.headerEmail}>{email}</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <AnimatedEntrance>
            <Text style={styles.codeLabel}>Code</Text>

            <View style={styles.codeInputContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[styles.codeInput, !!digit && styles.codeInputFilled]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  // One box, but the OS autofills the whole SMS/email code into
                  // the first one — handleCodeChange spreads it from there.
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                  maxLength={codeLength}
                  editable={!isVerifying}
                  selectTextOnFocus
                  accessibilityLabel={`Digit ${index + 1} of ${codeLength}`}
                />
              ))}
            </View>
          </AnimatedEntrance>

          {error ? (
            <Animated.View
              entering={FadeInDown.duration(Duration.base).reduceMotion(ReduceMotion.System)}
              style={styles.errorBanner}
            >
              <Text style={styles.errorBannerText}>{error}</Text>
            </Animated.View>
          ) : null}

          {notice && !error ? (
            <Animated.View
              entering={FadeInDown.duration(Duration.base).reduceMotion(ReduceMotion.System)}
              style={styles.noticeBanner}
            >
              <Text style={styles.noticeBannerText}>{notice}</Text>
            </Animated.View>
          ) : null}

          <View style={styles.resendRow}>
            {isResending ? (
              <ActivityIndicator size="small" color={Palette.primary} />
            ) : (
              <PressableScale
                onPress={handleResend}
                disabled={timer > 0}
                scaleTo={0.94}
                accessibilityLabel="Resend the verification code"
              >
                <Text style={styles.resendLine}>
                  <Text style={[styles.resendText, timer === 0 && styles.resendTextActive]}>
                    Resend
                  </Text>
                  {timer > 0 ? <Text style={styles.timerText}> in {timer}s</Text> : null}
                </Text>
              </PressableScale>
            )}
          </View>

          <AuthButton
            title="VERIFY"
            onPress={handleVerify}
            loading={isVerifying}
            disabled={!isComplete || isResending}
            color={Palette.primaryDeep}
            shape="rounded"
            style={styles.verifyButton}
          />

          {/* Only meaningful before a session exists: once signed in, the
              address is the account and cannot be swapped from here. */}
          {!isAuthenticated ? (
            <PressableScale
              onPress={handleChangeEmail}
              scaleTo={0.96}
              accessibilityLabel="Use a different email"
            >
              <Text style={styles.changeEmail}>Wrong email? Sign up again</Text>
            </PressableScale>
          ) : null}

          <Text style={styles.termsText}>
            By continuing, you automatically accept our{' '}
            <Text style={styles.termsLink}>Terms & Conditions</Text>,{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text> and{' '}
            <Text style={styles.termsLink}>Cookies policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    height: 280,
    width: '100%',
    position: 'relative',
  },
  headerImage: {
    position: 'absolute',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxxl,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 36,
    color: Palette.textInverse,
    marginBottom: Spacing.lg,
  },
  headerSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.lg,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  headerEmail: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.lg,
    color: Palette.textInverse,
  },
  formContainer: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    marginTop: -Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxl,
  },
  codeLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
    marginBottom: Spacing.lg,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  codeInput: {
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
  codeInputFilled: {
    borderColor: Palette.primary,
  },
  errorBanner: {
    backgroundColor: Palette.dangerSoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.danger,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.danger,
    textAlign: 'center',
  },
  noticeBanner: {
    backgroundColor: Palette.primarySoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  noticeBannerText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.primaryDeep,
    textAlign: 'center',
  },
  resendRow: {
    alignSelf: 'flex-end',
    minHeight: 20,
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  resendLine: {
    fontSize: FontSize.md,
  },
  resendText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.textMuted,
  },
  resendTextActive: {
    color: Palette.primary,
  },
  timerText: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textMuted,
  },
  verifyButton: {
    marginBottom: Spacing.lg,
  },
  changeEmail: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: Palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xl,
  },
  termsLink: {
    color: Palette.primary,
    textDecorationLine: 'underline',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxxl,
    backgroundColor: Palette.surface,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.display,
    color: Palette.ink,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: Spacing.xxl,
  },
});
