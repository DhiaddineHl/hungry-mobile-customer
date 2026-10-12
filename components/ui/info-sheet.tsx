import { View } from 'react-native';
import { SecondaryButton, Text } from '@/components/ds';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { createStyles } from '@/theme';

/**
 * Title + one paragraph + a Close button on the shared BottomSheet. The fee
 * explanations and the payment picker are this component with different
 * content, so the sheet chrome is written once here.
 */
interface InfoSheetProps {
  visible: boolean;
  title: string;
  /** Optional: the payment sheet is a title plus `children`, with no paragraph. */
  body?: string;
  onClose: () => void;
  /** Rendered between the paragraph and the Close button. */
  children?: React.ReactNode;
}

export function InfoSheet({ visible, title, body, onClose, children }: InfoSheetProps) {
  const styles = useStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="70%">
      <View style={styles.content}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {body ? (
          <Text variant="description" color="inkMuted" style={styles.body}>
            {body}
          </Text>
        ) : null}
        {children}
        <SecondaryButton label="Close" onPress={onClose} accessibilityLabel="Close" />
      </View>
    </BottomSheet>
  );
}

const useStyles = createStyles((t) => ({
  content: { gap: t.space[16] },
  body: { lineHeight: 21 },
}));
