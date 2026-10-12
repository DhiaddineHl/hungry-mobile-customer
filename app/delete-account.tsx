import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  Checkbox,
  ErrorBanner,
  PrimaryButton,
  Text,
  TextField,
  TextLink,
  Touchable,
} from '@/components/ds';
import { ScreenHeader } from '@/components/profile';
import { SUPPORT_EMAIL } from '@/constants/support';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation, type TranslationKey } from '@/i18n';
import { createStyles, Icon } from '@/theme';

/**
 * Account deletion: easy to find, deliberate to do. The customer is told what
 * goes and what is kept, ticks an acknowledgement, types the confirmation word,
 * and confirms once more before anything is removed.
 */
const REMOVED: TranslationKey[] = [
  'delete.removed.profile',
  'delete.removed.addresses',
  'delete.removed.login',
  'delete.removed.devices',
  'delete.removed.local',
];

export default function DeleteAccountScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { deleteAccount } = useAuth();

  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const word = t('delete.word');
  const typedRight = confirmation.trim().toUpperCase() === word;
  const canDelete = acknowledged && typedRight && !isDeleting;

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

  // The last, explicit "are you sure" before an irreversible action.
  const confirm = () => {
    Alert.alert(
      t('delete.confirmTitle'),
      t('delete.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('delete.confirmAction'), style: 'destructive', onPress: performDeletion },
      ],
      { cancelable: true },
    );
  };

  const disabledReason = !acknowledged ? 'Tick the box to continue' : !typedRight ? `Type ${word} to continue` : undefined;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('delete.title')} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorBanner title={t('delete.warning')} />

          <View style={styles.group}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t('delete.removed.title')}
            </Text>
            <Card padded style={styles.list}>
              {REMOVED.map((key) => (
                <View key={key} style={styles.bullet}>
                  <Icon name="close" size="inline" color="danger" />
                  <Text variant="description" style={styles.flex}>
                    {t(key)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>

          <View style={styles.group}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t('delete.kept.title')}
            </Text>
            <Text variant="description" color="inkMuted">
              {t('delete.kept.body')}
            </Text>
            <TextLink label={t('profile.privacy')} onPress={() => router.push('/legal/privacy')} style={styles.selfStart} />
          </View>

          <Touchable
            onPress={() => setAcknowledged((value) => !value)}
            scaleTo={1}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            accessibilityLabel={t('delete.acknowledge')}
            disabled={isDeleting}
            style={styles.ack}
          >
            <Checkbox checked={acknowledged} />
            <Text variant="itemLabel" style={styles.flex}>
              {t('delete.acknowledge')}
            </Text>
          </Touchable>

          <TextField
            label={t('delete.typeToConfirm', { word })}
            placeholder={word}
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            locked={isDeleting}
          />

          {error ? <ErrorBanner title="Couldn't delete your account" body={error} /> : null}

          <PrimaryButton
            destructive={canDelete}
            label={error ? 'Try again' : (disabledReason ?? t('delete.submit'))}
            loadingLabel="Deleting your account…"
            onPress={confirm}
            loading={isDeleting}
            disabled={!canDelete}
            accessibilityLabel={t('delete.submit')}
            accessibilityHint={disabledReason}
          />

          <Text variant="caption" color="inkMuted" align="center">
            {t('delete.alt', { email: SUPPORT_EMAIL })}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[8], gap: t.space[20] },
  group: { gap: t.space[10] },
  list: { gap: t.space[10] },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space[10] },
  selfStart: { alignSelf: 'flex-start' },
  ack: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], minHeight: t.size.minTouch },
}));
