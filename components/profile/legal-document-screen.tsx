import { ScreenHeader } from '@/components/profile/screen-header';
import { PressableScale } from '@/components/ui/pressable-scale';
import { COMPANY_NAME, SUPPORT_EMAIL } from '@/constants/support';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate, useTranslation } from '@/i18n';
import type { LegalDocument } from '@/i18n/legal';
import type { Language } from '@/store/settings-store';
import { ExternalLink } from 'lucide-react-native';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Renders one of the legal documents from `i18n/legal.ts` in the active
 * language, with the "Last updated" line the stores look for and an optional
 * link to the hosted copy.
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
  const { t, language } = useTranslation();
  const doc = document[language];

  return (
    <View style={styles.container}>
      <ScreenHeader title={doc.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>
          {t('common.lastUpdated', { date: formatDate(language, doc.updatedAt) })}
        </Text>
        <Text style={styles.intro}>{fill(doc.intro)}</Text>

        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} style={styles.paragraph}>
                {fill(paragraph)}
              </Text>
            ))}
          </View>
        ))}

        {onlineUrl ? (
          <PressableScale
            style={styles.onlineLink}
            onPress={() => Linking.openURL(onlineUrl).catch(() => {})}
            scaleTo={0.98}
            dimTo={0.7}
            accessibilityLabel={t('common.viewOnline')}
          >
            <ExternalLink size={18} color={Palette.primary} />
            <Text style={styles.onlineLinkText}>{t('common.viewOnline')}</Text>
          </PressableScale>
        ) : null}
      </ScrollView>
    </View>
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
  updated: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Palette.textMuted,
    marginBottom: Spacing.md,
  },
  intro: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Palette.textPrimary,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  heading: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.lg,
    color: Palette.ink,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Palette.textSecondary,
    marginBottom: Spacing.sm,
  },
  onlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Palette.primarySoft,
  },
  onlineLinkText: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.primary,
  },
});
