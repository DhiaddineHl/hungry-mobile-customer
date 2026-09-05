import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Fonts, Palette } from '@/constants/theme';
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
   * `radio` for a single-select group (one choice replaces the last),
   * `checkbox` for a multi-select one. Mapped from the backend's
   * `selectionType` — see `addonGroupType` in
   * `services/api/product-view-model.ts`.
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

export function AddonGroup({ group, selectedIds, onToggle }: AddonGroupProps) {
  const isRadio = group.type === 'radio';

  // One selection satisfies either kind of group; a radio group cannot hold
  // more than one, and no multi-select group carries a minimum.
  const isSatisfied = !group.required || selectedIds.length > 0;

  // A radio group is never capped this way: picking another option replaces
  // the current one rather than being blocked by it.
  const canSelectMore =
    isRadio || !group.maxSelect || selectedIds.length < group.maxSelect;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{group.title}</Text>
          {group.subtitle && (
            <Text style={styles.subtitle}>{group.subtitle}</Text>
          )}
        </View>
        {/*
          The badge answers "is this group settled?" at every moment, not only
          after a rejected attempt: it turns green the instant an option is
          picked. Waiting for a submit to say so left the customer looking at a
          red Required tag on a question they had already answered — and the
          Add button is now disabled until every one of these is green, so this
          is the only thing telling them what is still owed.
        */}
        {group.required && (
          <View
            style={[styles.badge, isSatisfied ? styles.badgeSatisfied : styles.badgeRequired]}
            accessibilityLabel={
              isSatisfied ? 'Required, answered' : 'Required, choose an option'
            }
          >
            {isSatisfied ? (
              <Check size={12} color={Palette.success} strokeWidth={2.5} />
            ) : (
              <X size={12} color={Palette.danger} strokeWidth={2.5} />
            )}
            <Text
              style={[
                styles.badgeText,
                isSatisfied ? styles.badgeTextSatisfied : styles.badgeTextRequired,
              ]}
            >
              Required
            </Text>
          </View>
        )}
        {/*
          A count only says something where more than one option can be picked;
          in a radio group the selection is visible in the row itself.
        */}
        {!group.required && !isRadio && selectedIds.length > 0 && (
          <View style={styles.selectedCountBadge}>
            <Text style={styles.selectedCountText}>
              {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'} selected
            </Text>
          </View>
        )}
      </View>

      <View
        style={styles.options}
        accessibilityRole={isRadio ? 'radiogroup' : undefined}
      >
        {group.options.map((option, index) => {
          const isSelected = selectedIds.includes(option.id);
          const isDisabled = !isSelected && !canSelectMore;
          return (
            <View key={option.id}>
              {index > 0 && <View style={styles.divider} />}
              <AddonItem
                {...option}
                isSelected={isSelected}
                isDisabled={isDisabled}
                type={group.type}
                onToggle={(optId) => onToggle(group.id, optId)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#F5A623',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 2,
  },
  badgeRequired: {
    backgroundColor: Palette.dangerSoft,
  },
  badgeSatisfied: {
    backgroundColor: Palette.successSoft,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },
  badgeTextRequired: {
    color: Palette.danger,
  },
  badgeTextSatisfied: {
    color: Palette.success,
  },
  selectedCountBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  selectedCountText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#F5A623',
  },
  options: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
});
