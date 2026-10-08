import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { createStyles, Icon, useTheme } from '@/theme';
import { Text } from './text';
import { Touchable } from './touchable';

export interface ToastOptions {
  message: string;
  /** Optional action ("Undo", "View cart"). With an action the toast stays 6 s. */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Sit 104 pt from the bottom, above a tab bar / bottom bar. Off: 16 + safe
   * area (screens without bottom chrome).
   */
  aboveBar?: boolean;
}

interface ToastState {
  current: (ToastOptions & { id: number }) | null;
  show: (options: ToastOptions) => void;
  hide: (id?: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  show: (options) => set({ current: { ...options, id: nextId++ } }),
  hide: (id) => {
    if (id == null || get().current?.id === id) set({ current: null });
  },
}));

/**
 * Inline success (design system §7): cart add, address saved, profile saved.
 *   toast.show({ message: 'Added to cart', actionLabel: 'Undo', onAction: undo, aboveBar: true })
 */
export const toast = {
  show: (options: ToastOptions) => useToastStore.getState().show(options),
  hide: () => useToastStore.getState().hide(),
};

/** Mounted once at the root, above the navigator. */
export function ToastHost() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { motion } = useTheme();
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!current) return;
    AccessibilityInfo.announceForAccessibility(current.message);
    const ms = current.actionLabel ? motion.toastUndoMs : motion.toastMs;
    const timer = setTimeout(() => hide(current.id), ms);
    return () => clearTimeout(timer);
  }, [current, hide, motion.toastMs, motion.toastUndoMs]);

  if (!current) return null;
  const bottom = current.aboveBar ? 104 : 16 + insets.bottom;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
      <Animated.View
        key={current.id}
        entering={FadeInDown.duration(220)}
        exiting={FadeOutDown.duration(160)}
        style={styles.toast}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Icon name="success" color="onInk" />
        <Text variant="chip" color="onInk" style={styles.flex}>
          {current.message}
        </Text>
        {current.actionLabel && current.onAction ? (
          <Touchable
            hitSlop={12}
            accessibilityLabel={current.actionLabel}
            onPress={() => {
              current.onAction?.();
              hide(current.id);
            }}
          >
            <Text variant="chip" color="onInk" style={styles.action}>
              {current.actionLabel}
            </Text>
          </Touchable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  host: { position: 'absolute', left: t.chromePadding, right: t.chromePadding },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[12],
    backgroundColor: t.colors.toast,
    borderRadius: t.radius.field,
    paddingVertical: t.space[12],
    paddingHorizontal: t.space[14],
    ...t.shadow.toast,
  },
  flex: { flex: 1 },
  action: { fontFamily: t.typography.button.fontFamily, textDecorationLine: 'underline' },
}));
