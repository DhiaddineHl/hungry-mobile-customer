import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { useAuth } from '@/contexts/auth-context';
import { isApiError } from '@/services/api/client';
import { confirmVerificationCode, sendVerificationCode } from '@/services/api/customer-service';
import { usePendingVerificationStore } from '@/store/pending-verification-store';
import { createStyles } from '@/theme';

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
  // A refused code (S-A3) paints the boxes red; `error` is the request failing.
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const otpRef = useRef<OtpInputHandle>(null);
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

  const handleCodeChange = (next: string[]) => {
    setCode(next);
    setError(null);
    setCodeError(null);
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
      setCodeError(err instanceof Error ? err.message : "That code isn't right. Try again or resend it.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangeEmail = () => {
    clearPending();
    // Back to identification, not straight to sign-up: a different address may
    // well already have an account, and that screen is what decides.
    router.replace('/login');
  };

  const styles = useStyles();
  const subtitle = pending.firstName
    ? `Almost there, ${pending.firstName}. We sent a ${codeLength}-digit code to`
    : `We sent a ${codeLength}-digit code to`;

  // Nothing to verify — the store was cleared (app restart mid-flow) and no
  // session or param supplied an address.
  if (!email) {
    return (
      <Screen>
        <StateView
          icon="mail"
          title="Nothing to verify"
          body="We don't know which email to confirm. Log in and we'll pick the verification back up."
          actions={[{ label: 'Go to log in', onPress: () => router.replace('/login') }]}
        />
      </Screen>
    );
  }

  return (
    <AuthShell>
      <AnimatedEntrance>
        <AuthHeading title="Check your email" subtitle={subtitle} detail={email} />
      </AnimatedEntrance>

      {error ? <ErrorBanner title="Couldn't continue" body={error} /> : null}
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

      {/* Only meaningful before a session exists: once signed in, the address
          is the account and cannot be swapped from here. */}
      {!isAuthenticated ? (
        <AnimatedEntrance index={3}>
          <AuthPrompt prompt="Wrong email?" action="Go back" onPress={handleChangeEmail} disabled={isVerifying} />
        </AnimatedEntrance>
      ) : null}
    </AuthShell>
  );
}

const useStyles = createStyles((t) => ({
  codeBlock: { gap: t.space[8] },
}));
