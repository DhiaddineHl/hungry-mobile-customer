import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  AUTH_LANDING_SHIFT_RATIO,
  AuthBackdrop,
  AuthButton,
  AuthHeading,
  AuthInput,
  AuthSwitchLink,
  GoogleButton,
  OrDivider,
  TermsFooter,
} from '@/components/auth';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { PressableScale } from '@/components/ui/pressable-scale';
import { loginSchema, LoginFormData } from '@/schemas/auth';
import { useAuth } from '@/contexts/auth-context';
import { Duration, FontSize, Fonts, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

/**
 * Module scope on purpose: the landing → login reveal plays once per app
 * session. A ref would reset when the user comes back from sign-up and the
 * intro would replay; a reload is the intended lifetime for replaying it.
 */
let introPlayed = false;

const INTRO_DELAY = 420;
/** Content starts arriving once the card is most of the way up. */
const CONTENT_DELAY = INTRO_DELAY + Math.round(Duration.reveal * 0.5);

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Read once at mount so the value can't flip mid-session and restage things.
  const [shouldPlayIntro] = useState(() => !introPlayed);

  // 0 = landing frame (artwork centred, card off-screen), 1 = login frame.
  // One shared value drives both layers so they can never desync.
  const progress = useSharedValue(shouldPlayIntro ? 0 : 1);
  const landingShift = width * AUTH_LANDING_SHIFT_RATIO;

  useEffect(() => {
    if (!shouldPlayIntro) return;
    introPlayed = true;
    progress.set(
      withDelay(
        INTRO_DELAY,
        withTiming(1, {
          duration: Duration.reveal,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          reduceMotion: ReduceMotion.System,
        })
      )
    );
  }, [shouldPlayIntro, progress]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.get(), [0, 1], [landingShift, 0]) },
      { scale: interpolate(progress.get(), [0, 1], [1.04, 1]) },
    ],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [height, 0]) }],
    // Held invisible for the first 40% of the travel so the card fades in on
    // approach instead of being a white slab dragged up the screen.
    opacity: interpolate(progress.get(), [0, 0.4, 1], [0, 0, 1]),
  }));

  const contentDelay = shouldPlayIntro ? CONTENT_DELAY : 0;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const result = await login(data.email, data.password);
      if (!result.success) {
        setAuthError(result.error ?? 'Login failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success && !result.error?.toLowerCase().includes('cancel')) {
        setAuthError(result.error ?? 'Google login failed');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AuthBackdrop heroStyle={heroStyle} />

      <Animated.View style={[styles.card, cardStyle]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.cardContent,
              { paddingBottom: insets.bottom + Spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <AnimatedEntrance delay={contentDelay}>
              <AuthHeading title="Welcome !" subtitle="Hungry? We got you !" />
            </AnimatedEntrance>

            {authError ? (
              <Animated.View
                entering={FadeInDown.duration(Duration.base).reduceMotion(ReduceMotion.System)}
                style={styles.errorBanner}
              >
                <Text style={styles.errorBannerText}>{authError}</Text>
              </Animated.View>
            ) : null}

            <AnimatedEntrance delay={contentDelay} index={1}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AuthInput
                    label="Email"
                    placeholder="Email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance delay={contentDelay} index={2}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AuthInput
                    label="Password"
                    placeholder="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    autoComplete="password"
                    textContentType="password"
                    isPassword
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance delay={contentDelay} index={3}>
              <PressableScale
                style={styles.forgotPassword}
                scaleTo={0.94}
                accessibilityLabel="Forgot Password"
              >
                <Text style={styles.forgotPasswordText}>Forgot Password</Text>
              </PressableScale>

              <AuthButton
                title="LOG IN"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting || isGoogleLoading}
                color={Palette.primaryDeep}
                shape="rounded"
                style={styles.submitButton}
              />
            </AnimatedEntrance>

            <AnimatedEntrance delay={contentDelay} index={4}>
              <AuthSwitchLink
                prompt="Don't have an account?"
                action="SIGN UP"
                onPress={() => router.push('/signup')}
              />

              <OrDivider />

              <GoogleButton
                onPress={handleGoogleLogin}
                loading={isGoogleLoading}
                disabled={isSubmitting}
              />

              <TermsFooter />
            </AnimatedEntrance>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.navy,
  },
  flex: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // A share of the screen (design: 69%), not a content-driven height — the
    // ScrollView inside needs a bounded box, and this is what keeps the logo in
    // the artwork visible above the card on every device.
    height: '72%',
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xxl + Spacing.xl,
    borderTopRightRadius: Radius.xxl + Spacing.xl,
    ...Shadows.lg,
  },
  cardContent: {
    paddingHorizontal: Spacing.xxxxl,
    paddingTop: Spacing.xxxl,
  },
  errorBanner: {
    backgroundColor: Palette.dangerSoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Palette.danger,
  },
  errorBannerText: {
    fontFamily: Fonts.medium,
    color: Palette.danger,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xxl,
  },
  forgotPasswordText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.md,
    color: Palette.navy,
  },
  submitButton: {
    marginBottom: Spacing.xl,
  },
});
