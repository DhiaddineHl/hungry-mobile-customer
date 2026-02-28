import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.handle} />
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '65%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    textAlign: 'center',
    marginBottom: 24,
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
