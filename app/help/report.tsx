import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import {
  BottomBar,
  ErrorBanner,
  FilterChip,
  InfoNote,
  PrimaryButton,
  Text,
  TextField,
  useBottomBarInset,
} from '@/components/ds';
import { ScreenHeader } from '@/components/profile';
import { SUPPORT_EMAIL } from '@/constants/support';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation, type TranslationKey } from '@/i18n';
import { createStyles } from '@/theme';

/**
 * Report a problem: a category, an optional order number and a description,
 * sent through the mail app with the account and app version attached.
 */
type Category = 'order' | 'delivery' | 'restaurant' | 'payment' | 'content' | 'app' | 'account' | 'other';

const CATEGORIES: Category[] = ['order', 'delivery', 'restaurant', 'payment', 'content', 'app', 'account', 'other'];

const MIN_DESCRIPTION_LENGTH = 20;

export default function ReportProblemScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { user } = useAuth();
  const bottomInset = useBottomBarInset();
  const params = useLocalSearchParams<{ orderId?: string }>();

  const [category, setCategory] = useState<Category>('order');
  const [orderRef, setOrderRef] = useState(params.orderId ?? '');
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [mailError, setMailError] = useState(false);

  const categoryLabel = (value: Category) => t(`report.category.${value}` as TranslationKey);

  const submit = async () => {
    // Validate on submit, then live while the user fixes it.
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      setDescriptionError(t('report.description.tooShort'));
      return;
    }
    setDescriptionError(null);
    setMailError(false);

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
      setMailError(true);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('report.title')} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="bodySmall" color="inkMuted">
            {t('report.intro')}
          </Text>

          <View style={styles.group}>
            <Text variant="label">{t('report.category')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {CATEGORIES.map((value) => (
                <FilterChip
                  key={value}
                  label={categoryLabel(value)}
                  selected={value === category}
                  showClear={false}
                  onPress={() => setCategory(value)}
                />
              ))}
            </View>
          </View>

          <TextField
            label={`${t('report.orderRef')} (${t('common.optional')})`}
            placeholder={t('report.orderRef.placeholder')}
            value={orderRef}
            onChangeText={setOrderRef}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TextField
            area
            label={t('report.description')}
            placeholder={t('report.description.placeholder')}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (descriptionError && text.trim().length >= MIN_DESCRIPTION_LENGTH) setDescriptionError(null);
            }}
            error={descriptionError}
            maxLength={2000}
            boxStyle={styles.area}
          />

          <InfoNote icon="privacy">{t('report.privacyNote')}</InfoNote>

          {mailError ? <ErrorBanner title={t('report.mailError', { email: SUPPORT_EMAIL })} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomBar>
        <PrimaryButton label={t('report.submit')} onPress={submit} style={styles.flex} />
      </BottomBar>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[8], gap: t.space[20] },
  group: { gap: t.space[10] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[8] },
  area: { minHeight: 140 },
}));
