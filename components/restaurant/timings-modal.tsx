import { ScrollView, View } from 'react-native';
import { Badge, Separated, Text } from '@/components/ds';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { createStyles } from '@/theme';

interface Timing {
  day: string;
  hours: string;
  isToday?: boolean;
  isClosed?: boolean;
}

interface TimingsModalProps {
  visible: boolean;
  timings: Timing[];
  onClose: () => void;
}

/** Opening hours, one row per day; today is marked, closed days muted. */
export function TimingsModal({ visible, timings, onClose }: TimingsModalProps) {
  const styles = useStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="65%">
      <Text variant="heading" accessibilityRole="header" style={styles.title}>
        Opening hours
      </Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Separated>
          {timings.map((timing) => (
            <View key={timing.day} style={styles.row}>
              <View style={styles.day}>
                <Text variant={timing.isToday ? 'itemTitle' : 'itemLabel'} color={timing.isClosed ? 'inkMuted' : 'ink'}>
                  {timing.day}
                </Text>
                {timing.isToday ? <Badge label="Today" variant="status" /> : null}
              </View>
              <Text variant="meta" color={timing.isClosed ? 'inkMuted' : 'ink'} tabular>
                {timing.hours}
              </Text>
            </View>
          ))}
        </Separated>
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = createStyles((t) => ({
  title: { marginBottom: t.space[8] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: t.space[12] },
  day: { flexDirection: 'row', alignItems: 'center', gap: t.space[8] },
}));
