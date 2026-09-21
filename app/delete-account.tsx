import { AuthButton } from '@/components/auth';
import { ScreenHeader } from '@/components/profile';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SUPPORT_EMAIL } from '@/constants/support';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useRouter } from 'expo-router';
import { Check, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Delete account.
 *
 * What the stores ask for (App Store Review 5.1.1(v), Play's account-deletion
 * policy) shapes this screen: the action is reachable from the profile in two
 * taps, it deletes rather than deactivates, it says what is removed and what
 * is legally retained, and an alternative (email) is given for someone who
 * cannot use the app. Three deliberate steps guard against an accidental tap:
 * an acknowledgement, typing the confirmation word, and a final alert.
 *
 * On success the session is gone; the root layout's auth gate routes to the
 * login screen on its own, so nothing is navigated here.
 */

const REMOVED: TranslationKey[] = [
  'delete.removed.profile',
  'delete.removed.addresses',
  'delete.removed.login',
  'delete.removed.devices',
  'delete.removed.local',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { deleteAccount } = useAuth();

  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const word = t('delete.word');
  const canDelete = acknowledged && confirmation.trim().toUpperCase() === word && !isDeleting;

  const performDeletion = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount();
      Alert.alert(t('delete.success.title'), t('delete.success.body'));
    } catch {
      setError(t('delete.error', { email: SUPPORT_EMAIL }));
      setIsDeleting(false);
    }
  };

  const confirm = () => {
    Alert.alert(
      t('delete.confirmTitle'),
      t('delete.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('delete.confirmAction'), style: 'destructive', onPress: performDeletion },
      ],
      { cancelable: true }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title={t('delete.title')} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warning}>
          <TriangleAlert size={22} color={Palette.danger} />
          <Text style={styles.warningText}>{t('delete.warning')}</Text>
        </View>

        <Text style={styles.heading}>{t('delete.removed.title')}</Text>
        <View style={styles.list}>
          {REMOVED.map((key) => (
            <View key={key} style={styles.bullet}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.heading}>{t('delete.kept.title')}</Text>
        <Text style={styles.body}>{t('delete.kept.body')}</Text>
        <PressableScale
          onPress={() => router.push('/legal/privacy')}
          scaleTo={0.98}
          dimTo={0.7}
          accessibilityLabel={t('profile.privacy')}
        >
          <Text style={styles.link}>{t('profile.privacy')}</Text>
        </PressableScale>

        <PressableScale
          style={styles.checkboxRow}
          onPress={() => setAcknowledged((value) => !value)}
          scaleTo={0.99}
          dimTo={0.8}
          haptic
          accessibilityLabel={t('delete.acknowledge')}
        >
          <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
            {acknowledged ? <Check size={16} color={Palette.white} strokeWidth={3} /> : null}
          </View>
          <Text style={styles.checkboxText}>{t('delete.acknowledge')}</Text>
        </PressableScale>

        <Text style={styles.label}>{t('delete.typeToConfirm', { word })}</Text>
        <TextInput
          style={styles.input}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={word}
          placeholderTextColor={Palette.textPlaceholder}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isDeleting}
          accessibilityLabel={t('delete.typeToConfirm', { word })}
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <AuthButton
          title={t('delete.submit')}
          onPress={confirm}
          loading={isDeleting}
          disabled={!canDelete}
          color={Palette.danger}
          style={styles.submit}
        />

        <Text style={styles.alt}>{t('delete.alt', { email: SUPPORT_EMAIL })}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.dangerSoft,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  warningText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Palette.danger,
  },
  heading: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.lg,
    color: Palette.ink,
    marginBottom: Spacing.sm,
  },
  list: {
    marginBottom: Spacing.xl,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.primary,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Palette.textSecondary,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Palette.textSecondary,
  },
  link: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.primary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: Palette.danger,
    backgroundColor: Palette.danger,
  },
  checkboxText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Palette.ink,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
    marginBottom: Spacing.sm,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.lg,
    letterSpacing: 1,
    color: Palette.ink,
  },
  errorBanner: {
    backgroundColor: Palette.dangerSoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  errorText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.danger,
    textAlign: 'center',
  },
  submit: {
    marginTop: Spacing.xl,
  },
  alt: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    lineHeight: 18,
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
