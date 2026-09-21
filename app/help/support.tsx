import { ScreenHeader, SettingsRow } from '@/components/profile';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SUPPORT_EMAIL } from '@/constants/support';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useRouter } from 'expo-router';
import { ChevronDown, Flag, Mail } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * Help & support: the ways to reach us, then the questions support answers
 * most. Both stores want a support contact reachable from inside the app;
 * email is that contact here, with the report form as the structured path.
 */

const FAQ: { question: TranslationKey; answer: TranslationKey }[] = [
  { question: 'help.faq.q1', answer: 'help.faq.a1' },
  { question: 'help.faq.q2', answer: 'help.faq.a2' },
  { question: 'help.faq.q3', answer: 'help.faq.a3' },
  { question: 'help.faq.q4', answer: 'help.faq.a4' },
  { question: 'help.faq.q5', answer: 'help.faq.a5' },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const emailSupport = async () => {
    const subject = encodeURIComponent(t('help.emailSubject'));
    const body = encodeURIComponent(user?.email ? `\n\n—\n${user.email}` : '');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('help.title'), t('help.mailError', { email: SUPPORT_EMAIL }));
    }
  };

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('help.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('help.intro')}</Text>

        <Text style={styles.sectionLabel}>{t('help.contact.title')}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<Mail size={22} color={Palette.primary} />}
            label={t('help.contact.email')}
            caption={`${SUPPORT_EMAIL} · ${t('help.contact.emailHint')}`}
            onPress={emailSupport}
          />
          <SettingsRow
            divider
            icon={<Flag size={22} color={Palette.primary} />}
            label={t('help.contact.report')}
            caption={t('help.contact.reportHint')}
            onPress={() => router.push('/help/report')}
          />
        </View>

        <Text style={styles.sectionLabel}>{t('help.faq.title')}</Text>
        <View style={styles.card}>
          {FAQ.map((item, index) => {
            const open = openIndex === index;
            return (
              <View key={item.question} style={index > 0 && styles.faqDivider}>
                <PressableScale
                  style={styles.faqQuestion}
                  onPress={() => toggleFaq(index)}
                  scaleTo={0.99}
                  dimTo={0.7}
                  accessibilityLabel={t(item.question)}
                  accessibilityHint={open ? undefined : t(item.answer)}
                >
                  <Text style={styles.faqQuestionText}>{t(item.question)}</Text>
                  <View style={open && styles.chevronOpen}>
                    <ChevronDown size={20} color={Palette.textMuted} />
                  </View>
                </PressableScale>
                {open ? <Text style={styles.faqAnswer}>{t(item.answer)}</Text> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.surfaceAlt,
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
  sectionLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.sm,
    color: Palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.xxl,
    overflow: 'hidden',
  },
  faqDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.borderSubtle,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  faqQuestionText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswer: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Palette.textSecondary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
