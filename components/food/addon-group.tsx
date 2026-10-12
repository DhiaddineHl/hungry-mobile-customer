import { View } from 'react-native';
import { Badge, Separated, Text } from '@/components/ds';
import { createStyles } from '@/theme';
import { AddonItem } from './addon-item';

export interface AddonOption {
  id: string;
  name: string;
  price?: string;
  isPopular?: boolean;
}

export interface AddonGroupData {
  id: string;
  title: string;
  subtitle?: string;
  /**
   * `radio` allows exactly one option; `checkbox` any number (up to
   * `maxSelect`). Decided by the backend's selection type — see
   * `addonGroupType`.
   */
  type: 'checkbox' | 'radio';
  required: boolean;
  /** Only meaningful for `checkbox`; a `radio` group allows exactly one. */
  maxSelect?: number;
  options: AddonOption[];
}

interface AddonGroupProps {
  group: AddonGroupData;
  selectedIds: string[];
  onToggle: (groupId: string, optionId: string) => void;
}

/** "Choose 1", "Choose up to 6", "Choose any" — the group's rule in words. */
function ruleOf(group: AddonGroupData): string {
  if (group.type === 'radio') return 'Choose 1';
  if (group.maxSelect) return `Choose up to ${group.maxSelect}`;
  return group.required ? 'Choose at least 1' : 'Choose any';
}

/**
 * OptionGroup (design system §6): title (`sectionTitle`) + rule, and a badge
 * that answers "is this settled?" at every moment — `Required` until an
 * option is picked, then `Done`; `Optional` otherwise. The Add button stays
 * disabled until every required group reads Done, so this badge is what tells
 * the customer what is still owed.
 */
export function AddonGroup({ group, selectedIds, onToggle }: AddonGroupProps) {
  const styles = useStyles();
  const isRadio = group.type === 'radio';
  const isSatisfied = !group.required || selectedIds.length > 0;
  const canSelectMore = isRadio || !group.maxSelect || selectedIds.length < group.maxSelect;

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text variant="sectionTitle" accessibilityRole="header">
            {group.title}
          </Text>
          <View style={styles.ruleLine}>
            <Text variant="meta" color="inkMuted">
              {group.subtitle || ruleOf(group)}
            </Text>
            {/* A count only says something where more than one option can be
                picked; in a radio group the selection shows in the row. */}
            {!isRadio && selectedIds.length > 0 ? (
              <Text variant="meta" color="inkMuted">
                {`${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'items'} selected`}
              </Text>
            ) : null}
          </View>
        </View>
        {group.required ? (
          <View accessibilityLabel={isSatisfied ? 'Required, answered' : 'Required, choose an option'}>
            <Badge label={isSatisfied ? 'Done' : 'Required'} variant={isSatisfied ? 'done' : 'required'} />
          </View>
        ) : (
          <Badge label="Optional" variant="optional" />
        )}
      </View>

      <View accessibilityRole={isRadio ? 'radiogroup' : undefined}>
        <Separated>
          {group.options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <AddonItem
                key={option.id}
                {...option}
                isSelected={isSelected}
                isDisabled={!isSelected && !canSelectMore}
                type={group.type}
                onToggle={(optId) => onToggle(group.id, optId)}
              />
            );
          })}
        </Separated>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  group: { paddingHorizontal: t.screenPadding, paddingTop: t.space[24], gap: t.space[6] },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space[12] },
  titleBlock: { flex: 1, gap: 2 },
  ruleLine: { flexDirection: 'row', flexWrap: 'wrap', columnGap: t.space[8] },
}));
