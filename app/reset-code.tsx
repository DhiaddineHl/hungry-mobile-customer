import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  AuthHeading,
  AuthPrompt,
  AuthShell,
  FieldMessage,
  OtpInput,
  OtpInputHandle,
  ResendLine,
} from '@/components/auth';
import { ErrorBanner, InfoNote, PrimaryButton, Screen, StateView, Text } from '@/components/ds';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { isApiError } from '@/services/api/client';
import {
  sendPasswordResetCode,
  verifyPasswordResetCode,
} from '@/services/api/customer-service';
import { usePasswordResetStore } from '@/store/password-reset-store';
import { createStyles } from '@/theme';

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
  const styles = useStyles();
  const email = usePasswordResetStore((state) => state.email);
  const setTicket = usePasswordResetStore((state) => state.setTicket);

  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [code, setCode] = useState<string[]>(() => Array(DEFAULT_CODE_LENGTH).fill(''));
  const [timer, setTimer] = useState(DEFAULT_RESEND_COOLDOWN);
  const [error, setError] = useState<string | null>(null);
  // A refused code paints the boxes red; `error` is a resend failing.
  const [codeError, setCodeError] = useState<string | null>(null);
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
    setCodeError(null);
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
      setCodeError(err instanceof Error ? err.message : "That code isn't right. Try again or resend it.");
    } finally {
      setIsVerifying(false);
    }
  };

  // The store was cleared (an app restart mid-flow), so there is no address to
  // check a code against and nothing was ever sent.
  if (!email) {
    return (
      <Screen>
        <StateView
          icon="mail"
          title="Nothing to reset"
          body="We don't know which account to reset. Start again and we'll email you a new code."
          actions={[{ label: 'Start again', onPress: () => router.replace('/forgot-password') }]}
        />
      </Screen>
    );
  }

  return (
    <AuthShell>
      <AnimatedEntrance>
        <AuthHeading title="Check your email" subtitle={`We sent a ${codeLength}-digit code to`} detail={email} />
      </AnimatedEntrance>

      {error ? <ErrorBanner title="Couldn't send the code" body={error} /> : null}
      {notice && !error ? <InfoNote>{notice}</InfoNote> : null}

      <AnimatedEntrance index={1}>
        <View style={styles.codeBlock}>
          <Text variant="label">Code</Text>
          <OtpInput
            ref={otpRef}
            value={code}
            onChange={handleCodeChange}
            editable={!isVerifying}
            error={!!codeError}
            autoFocus
          />
          <ResendLine
            seconds={timer}
            onResend={handleResend}
            busy={isResending}
            leading={codeError ? <FieldMessage message={codeError} /> : null}
          />
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance index={2}>
        <PrimaryButton
          label="Continue"
          loadingLabel="Checking code…"
          onPress={handleVerify}
          loading={isVerifying}
          disabled={!isComplete || isResending}
        />
      </AnimatedEntrance>

      <AnimatedEntrance index={3}>
        <AuthPrompt
          prompt="Wrong email?"
          action="Go back"
          disabled={isVerifying}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
        />
      </AnimatedEntrance>
    </AuthShell>
  );
}

const useStyles = createStyles((t) => ({
  codeBlock: { gap: t.space[8] },
}));
