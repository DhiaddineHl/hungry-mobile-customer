import { View } from 'react-native';
import { Checkbox, Radio, Text, Touchable } from '@/components/ds';
import { createStyles } from '@/theme';

interface AddonItemProps {
  id: string;
  name: string;
  price?: string;
  isPopular?: boolean;
  isSelected: boolean;
  /** A multi-select group at its cap: unselected rows cannot be picked. */
  isDisabled?: boolean;
  type: 'checkbox' | 'radio';
  onToggle: (id: string) => void;
}

/**
 * OptionRow (design system §6): min 56, name (`itemLabel`), a sub line with
 * the surcharge (`+1 DT`) and `Popular` in green, trailing checkbox or radio.
 * The whole row is the target and reports its own checked state.
 */
export function AddonItem({ id, name, price, isPopular, isSelected, isDisabled, type, onToggle }: AddonItemProps) {
  const styles = useStyles();
  const hasSub = !!price || !!isPopular;
  return (
    <Touchable
      onPress={() => onToggle(id)}
      disabled={isDisabled}
      scaleTo={1}
      accessibilityRole={type === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: isSelected, disabled: !!isDisabled }}
      accessibilityLabel={price ? `${name}, ${price}` : name}
      style={[styles.row, isDisabled && styles.disabled]}
    >
      <View style={styles.text}>
        <Text variant="itemLabel">{name}</Text>
        {hasSub ? (
          <View style={styles.sub}>
            {price ? (
              <Text variant="meta" color="inkMuted" tabular numberOfLines={1}>
                {price}
              </Text>
            ) : null}
            {isPopular ? (
              <Text variant="meta" color="success" style={styles.popular}>
                Popular
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {type === 'radio' ? <Radio selected={isSelected} /> : <Checkbox checked={isSelected} />}
    </Touchable>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    minHeight: t.size.optionRow,
    paddingVertical: t.space[8],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[14],
  },
  disabled: { opacity: t.opacity.lockedInput },
  text: { flex: 1, gap: 2 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: t.space[8] },
  popular: { fontFamily: t.typography.label.fontFamily },
}));
