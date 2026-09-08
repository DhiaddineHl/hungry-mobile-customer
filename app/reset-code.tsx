import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import VerificationUpperSection from '@/assets/verification-upper-section.svg';
import { AuthButton, OtpInput, OtpInputHandle } from '@/components/auth';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { PressableScale } from '@/components/ui/pressable-scale';
import { isApiError } from '@/services/api/client';
import {
  sendPasswordResetCode,
  verifyPasswordResetCode,
} from '@/services/api/customer-service';
import { usePasswordResetStore } from '@/store/password-reset-store';
import { Duration, FontSize, Fonts, Palette, Radius, Spacing } from '@/constants/theme';

/**
 * Boxes drawn before the backend has said otherwise. Must match
 * `hungry.customer.password-reset.code-length` (default 6); a resend answers
 * with the authoritative `codeLength`, which replaces this.
 */
const DEFAULT_CODE_LENGTH = 6;

/**
 * Mirrors `hungry.customer.password-reset.resend-cooldown-seconds`. The
 * backend enforces it; this only keeps the button from being pressed into a
 * guaranteed 429.
 */
const DEFAULT_RESEND_COOLDOWN = 60;

/**
 * Step two of a forgotten-password reset: the code that proves the mailbox is
 * theirs.
 *
 * Only ever reached from `/forgot-password`, which has already sent a code —
 * so unlike the sign-up verification screen this one never sends on arrival,
 * and Resend is the single way another code goes out. An accepted code buys a
 * ticket, and the ticket is what the last screen spends.
 */
export default function ResetCodeScreen() {
  const email = usePasswordResetStore((state) => state.email);
  const setTicket = usePasswordResetStore((state) => state.setTicket);

  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [code, setCode] = useState<string[]>(() => Array(DEFAULT_CODE_LENGTH).fill(''));
  const [timer, setTimer] = useState(DEFAULT_RESEND_COOLDOWN);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const otpRef = useRef<OtpInputHandle>(null);
  const fullCode = code.join('');
  const isComplete = fullCode.length === codeLength;

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = useCallback(async () => {
    if (!email || timer > 0 || isResending) return;
    setError(null);
    setIsResending(true);
    try {
      const challenge = await sendPasswordResetCode(email);
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
      otpRef.current?.focusFirst();
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
  }, [email, timer, isResending]);

  const handleCodeChange = (next: string[]) => {
    setCode(next);
    setError(null);
  };

  const handleVerify = async () => {
    if (!email || !isComplete || isVerifying) return;
    setError(null);
    setNotice(null);
    setIsVerifying(true);
    try {
      const { ticket } = await verifyPasswordResetCode(email, fullCode);
      setTicket(ticket);
      router.push('/new-password');
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

  // The store was cleared (an app restart mid-flow), so there is no address to
  // check a code against and nothing was ever sent.
  if (!email) {
    return (
      <View style={styles.emptyState}>
        <StatusBar style="dark" />
        <Text style={styles.emptyTitle}>Nothing to reset</Text>
        <Text style={styles.emptyBody}>
          We do not know which account to reset. Start again and we will email you a new code.
        </Text>
        <AuthButton
          title="START AGAIN"
          onPress={() => router.replace('/forgot-password')}
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
            <Text style={styles.headerTitle}>Reset password</Text>
            <Text style={styles.headerSubtitle}>We sent a code to</Text>
            <Text style={styles.headerEmail}>{email}</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <AnimatedEntrance>
            <Text style={styles.codeLabel}>Code</Text>

            <OtpInput
              ref={otpRef}
              value={code}
              onChange={handleCodeChange}
              editable={!isVerifying}
            />
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
                accessibilityLabel="Resend the reset code"
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
            title="CONTINUE"
            onPress={handleVerify}
            loading={isVerifying}
            disabled={!isComplete || isResending}
            color={Palette.primaryDeep}
            shape="rounded"
            style={styles.verifyButton}
          />

          <PressableScale
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
            scaleTo={0.96}
            accessibilityLabel="Use a different email"
          >
            <Text style={styles.changeEmail}>Wrong email? Go back</Text>
          </PressableScale>
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
