import { AuthButton, AuthInput } from '@/components/auth';
import { ScreenHeader } from '@/components/profile';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SUPPORT_EMAIL } from '@/constants/support';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation, type TranslationKey } from '@/i18n';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Report a problem — the in-app reporting path both stores look for (and
 * Play's UGC policy requires for the "inappropriate content" case).
 *
 * The backend keeps no ticket queue, so a report is composed as an email to
 * the support address with a structured body: category, order number, the
 * account email (so support can reply and match the account), app version
 * and platform. The customer sees the mail before it leaves — nothing is
 * sent behind their back, which is also why the note under the form says
 * what goes in it.
 *
 * Accepts an optional `orderId` query param so an order screen can deep-link
 * here with the number pre-filled.
 */

type Category = 'order' | 'delivery' | 'restaurant' | 'payment' | 'content' | 'app' | 'account' | 'other';

const CATEGORIES: Category[] = [
  'order',
  'delivery',
  'restaurant',
  'payment',
  'content',
  'app',
  'account',
  'other',
];

const MIN_DESCRIPTION_LENGTH = 20;

export default function ReportProblemScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ orderId?: string }>();

  const [category, setCategory] = useState<Category>('order');
  const [orderRef, setOrderRef] = useState(params.orderId ?? '');
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const categoryLabel = (value: Category) => t(`report.category.${value}` as TranslationKey);

  const submit = async () => {
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      setDescriptionError(t('report.description.tooShort'));
      return;
    }
    setDescriptionError(null);

    const lines = [
      `${t('report.email.category')}: ${categoryLabel(category)}`,
      orderRef.trim() ? `${t('report.email.order')}: ${orderRef.trim()}` : null,
      user?.email ? `${t('report.email.account')}: ${user.email}` : null,
      `${t('report.email.app')}: Hungry ${Constants.expoConfig?.version ?? '?'} (${Platform.OS} ${Platform.Version})`,
      '',
      `${t('report.email.description')}:`,
      description.trim(),
    ].filter((line): line is string => line !== null);

    const subject = encodeURIComponent(t('report.emailSubject', { category: categoryLabel(category) }));
    const body = encodeURIComponent(lines.join('\n'));
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert(t('report.title'), t('report.mailError', { email: SUPPORT_EMAIL }));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title={t('report.title')} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>{t('report.intro')}</Text>

        <Text style={styles.label}>{t('report.category')}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {CATEGORIES.map((value) => {
            const selected = value === category;
            return (
              <PressableScale
                key={value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setCategory(value)}
                scaleTo={0.95}
                haptic
                accessibilityLabel={categoryLabel(value)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {categoryLabel(value)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <AuthInput
          label={`${t('report.orderRef')} (${t('common.optional')})`}
          placeholder={t('report.orderRef.placeholder')}
          value={orderRef}
          onChangeText={setOrderRef}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t('report.description')}</Text>
        <TextInput
          style={[styles.textArea, descriptionError && styles.textAreaError]}
          placeholder={t('report.description.placeholder')}
          placeholderTextColor={Palette.textPlaceholder}
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (descriptionError && text.trim().length >= MIN_DESCRIPTION_LENGTH) {
              setDescriptionError(null);
            }
          }}
          multiline
          textAlignVertical="top"
          maxLength={2000}
          accessibilityLabel={t('report.description')}
        />
        {descriptionError ? <Text style={styles.error}>{descriptionError}</Text> : null}

        <Text style={styles.note}>{t('report.privacyNote')}</Text>

        <AuthButton title={t('report.submit')} onPress={submit} style={styles.submit} />
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
  intro: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Palette.textSecondary,
    marginBottom: Spacing.xl,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
    marginBottom: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  chipSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primarySoft,
  },
  chipText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Palette.textSecondary,
  },
  chipTextSelected: {
    color: Palette.primaryDark,
  },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: FontSize.lg,
    color: Palette.ink,
  },
  textAreaError: {
    borderColor: Palette.danger,
  },
  error: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: Palette.danger,
    marginTop: Spacing.xs,
  },
  note: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    lineHeight: 18,
    color: Palette.textMuted,
    marginTop: Spacing.lg,
  },
  submit: {
    marginTop: Spacing.xl,
  },
});
