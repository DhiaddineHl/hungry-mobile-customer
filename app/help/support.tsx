import { useState } from 'react';
import { LayoutAnimation, Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, ErrorBanner, ListGroup, ListRow, Separated, Text, Touchable } from '@/components/ds';
import { ScreenHeader } from '@/components/profile';
import { SUPPORT_EMAIL } from '@/constants/support';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation, type TranslationKey } from '@/i18n';
import { createStyles, Icon } from '@/theme';

/**
 * Help and support: how to reach us, and the questions people actually ask.
 * Composed from ListGroup/ListRow (contact) and a Card of expandable rows (FAQ).
 */
const FAQ: { question: TranslationKey; answer: TranslationKey }[] = [
  { question: 'help.faq.q1', answer: 'help.faq.a1' },
  { question: 'help.faq.q2', answer: 'help.faq.a2' },
  { question: 'help.faq.q3', answer: 'help.faq.a3' },
  { question: 'help.faq.q4', answer: 'help.faq.a4' },
  { question: 'help.faq.q5', answer: 'help.faq.a5' },
];

export default function HelpSupportScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mailError, setMailError] = useState(false);

  const emailSupport = async () => {
    setMailError(false);
    const subject = encodeURIComponent(t('help.emailSubject'));
    const body = encodeURIComponent(user?.email ? `\n\n—\n${user.email}` : '');
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      setMailError(true);
    }
  };

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('help.title')} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <Text variant="bodySmall" color="inkMuted">
          {t('help.intro')}
        </Text>

        {mailError ? <ErrorBanner title={t('help.mailError', { email: SUPPORT_EMAIL })} /> : null}

        <ListGroup title={t('help.contact.title')}>
          <ListRow
            icon="mail"
            label={t('help.contact.email')}
            sub={`${SUPPORT_EMAIL} · ${t('help.contact.emailHint')}`}
            onPress={emailSupport}
          />
          <ListRow
            icon="report"
            label={t('help.contact.report')}
            sub={t('help.contact.reportHint')}
            onPress={() => router.push('/help/report')}
          />
        </ListGroup>

        <Text variant="overline" color="inkMuted" style={styles.overline} accessibilityRole="header">
          {t('help.faq.title')}
        </Text>
        <Card>
          <Separated>
            {FAQ.map((item, index) => {
              const open = openIndex === index;
              return (
                <View key={item.question}>
                  <Touchable
                    onPress={() => toggleFaq(index)}
                    scaleTo={1}
                    accessibilityLabel={t(item.question)}
                    accessibilityState={{ expanded: open }}
                    style={styles.question}
                  >
                    <Text variant="itemLabel" style={styles.flex}>
                      {t(item.question)}
                    </Text>
                    <Icon name={open ? 'chevronUp' : 'chevronDown'} size="row" color="inkMuted" />
                  </Touchable>
                  {open ? (
                    <Text variant="description" color="inkMuted" style={styles.answer}>
                      {t(item.answer)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </Separated>
        </Card>
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[8] },
  overline: { marginTop: t.space[28], marginBottom: t.space[8] },
  question: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], paddingVertical: t.space[14], paddingHorizontal: t.space[16], minHeight: t.size.listRow },
  answer: { paddingHorizontal: t.space[16], paddingBottom: t.space[16] },
}));
