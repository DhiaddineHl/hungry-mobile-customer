import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SecondaryButton, Text } from '@/components/ds';
import { ScreenHeader } from '@/components/profile/screen-header';
import { COMPANY_NAME, SUPPORT_EMAIL } from '@/constants/support';
import { formatDate, useTranslation } from '@/i18n';
import type { LegalDocument } from '@/i18n/legal';
import type { Language } from '@/store/settings-store';
import { createStyles } from '@/theme';

/**
 * One of the legal documents from `i18n/legal.ts` in the active language,
 * with the "Last updated" line the stores look for and an optional link to
 * the hosted copy. Long body text: `body` type, section titles.
 */
interface LegalDocumentScreenProps {
  document: Record<Language, LegalDocument>;
  /** Public URL of the same text, when one is configured. */
  onlineUrl?: string | null;
}

function fill(text: string): string {
  return text.replace('{{company}}', COMPANY_NAME).replace(/\{\{email\}\}/g, SUPPORT_EMAIL);
}

export function LegalDocumentScreen({ document, onlineUrl }: LegalDocumentScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const doc = document[language];

  return (
    <View style={styles.container}>
      <ScreenHeader title={doc.title} divider />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="caption" color="inkMuted">
          {t('common.lastUpdated', { date: formatDate(language, doc.updatedAt) })}
        </Text>
        <Text variant="body">{fill(doc.intro)}</Text>

        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {section.heading}
            </Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} variant="body" color="inkMuted">
                {fill(paragraph)}
              </Text>
            ))}
          </View>
        ))}

        {onlineUrl ? (
          <SecondaryButton
            label={t('common.viewOnline')}
            icon="terms"
            onPress={() => Linking.openURL(onlineUrl).catch(() => {})}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[16], gap: t.space[16] },
  section: { gap: t.space[10], marginTop: t.space[12] },
}));
