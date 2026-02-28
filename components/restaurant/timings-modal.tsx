import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 24,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 24) },
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
