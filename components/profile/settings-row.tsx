import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { ChevronRight } from 'lucide-react-native';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * One row of a profile card: icon tile, label, optional caption, and either a
 * chevron (a link) or a custom trailing control (a switch, a language pill).
 *
 * `danger` paints the row in the danger colour — reserved for the actions the
 * stores want clearly separated from everything else (log out, delete account).
 */
interface SettingsRowProps {
  icon: ReactNode;
  label: string;
  caption?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Replaces the chevron. The row stays pressable when `onPress` is given. */
  trailing?: ReactNode;
  /** Hairline above the row, for the second row onwards in a card. */
  divider?: boolean;
  accessibilityHint?: string;
}

export function SettingsRow({
  icon,
  label,
  caption,
  onPress,
  danger = false,
  trailing,
  divider = false,
  accessibilityHint,
}: SettingsRowProps) {
  const content = (
    <>
      <View style={[styles.icon, danger && styles.iconDanger]}>{icon}</View>
      <View style={styles.text}>
        <Text style={[styles.label, danger && styles.labelDanger]} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={[styles.caption, danger && styles.captionDanger]}>{caption}</Text>
        ) : null}
      </View>
      {trailing !== undefined ? trailing : <ChevronRight size={20} color={Palette.textMuted} />}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, divider && styles.rowDivider]}>{content}</View>;
  }

  return (
    <PressableScale
      style={[styles.row, divider && styles.rowDivider]}
      onPress={onPress}
      scaleTo={0.98}
      dimTo={0.6}
      haptic
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.borderSubtle,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  iconDanger: {
    backgroundColor: Palette.dangerSoft,
  },
  text: {
    flex: 1,
    marginRight: Spacing.md,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.lg,
    color: Palette.ink,
  },
  labelDanger: {
    color: Palette.danger,
  },
  caption: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  captionDanger: {
    color: Palette.danger,
    opacity: 0.8,
  },
});
