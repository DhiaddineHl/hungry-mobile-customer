import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Fonts } from '@/constants/theme';

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

export function TimingsModal({ visible, timings, onClose }: TimingsModalProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="65%">
      <Text style={styles.title}>Timings</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {timings.map((timing, index) => (
          <View key={index} style={styles.row}>
            <Text style={[
              styles.day,
              timing.isToday && styles.todayDay,
              timing.isClosed && styles.closedDay,
            ]}>
              {timing.day}:
            </Text>
            <Text style={[
              styles.hours,
              timing.isClosed && styles.closedHours,
            ]}>
              {timing.hours}
            </Text>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 16,
  },
  day: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    minWidth: 130,
  },
  todayDay: {
    color: '#F5A623',
  },
  closedDay: {
    color: '#F5A623',
  },
  hours: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#444444',
    flex: 1,
    textAlign: 'right',
  },
  closedHours: {
    color: '#AAAAAA',
  },
});
