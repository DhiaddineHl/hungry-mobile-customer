import {
  Modal,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 120;
const DISMISS_VELOCITY_THRESHOLD = 0.5;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string | number;
  contentStyle?: ViewStyle;
  showHandle?: boolean;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight = '65%',
  contentStyle,
  showHandle = true,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const lastDragY = useRef(0);

  const animateIn = useCallback(() => {
    dragY.setValue(0);
    lastDragY.current = 0;
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
  }, []);

  const animateOut = useCallback((onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dragY.setValue(0);
      lastDragY.current = 0;
      onDone?.();
    });
  }, []);

  useEffect(() => {
    if (visible) {
      animateIn();
    } else {
      animateOut();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        lastDragY.current = 0;
      },
      onPanResponderMove: (_, gestureState) => {
        const clampedDy = Math.max(0, gestureState.dy);
        dragY.setValue(clampedDy);
        lastDragY.current = clampedDy;

        const progress = Math.max(0, 1 - clampedDy / SCREEN_HEIGHT);
        backdropOpacity.setValue(progress);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldDismiss =
          lastDragY.current > DISMISS_THRESHOLD ||
          gestureState.vy > DISMISS_VELOCITY_THRESHOLD;

        if (shouldDismiss) {
          Animated.parallel([
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 220,
              useNativeDriver: true,
            }),
            Animated.timing(dragY, {
              toValue: SCREEN_HEIGHT,
              duration: 260,
              useNativeDriver: true,
            }),
          ]).start(() => {
            dragY.setValue(0);
            lastDragY.current = 0;
            onClose();
          });
        } else {
          Animated.parallel([
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.spring(dragY, {
              toValue: 0,
              damping: 20,
              stiffness: 260,
              mass: 0.6,
              useNativeDriver: true,
            }),
          ]).start();
          lastDragY.current = 0;
        }
      },
    })
  ).current;

  const combinedTranslateY = Animated.add(sheetTranslateY, dragY);

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
            { paddingBottom: Math.max(insets.bottom, 24), maxHeight },
            contentStyle,
            { transform: [{ translateY: combinedTranslateY }] },
          ]}
        >
          {showHandle && (
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
          )}

          {children}
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
    paddingTop: 0,
  },
  handleArea: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
});
