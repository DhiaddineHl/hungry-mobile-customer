import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
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
  type: 'checkbox' | 'radio';
  required: boolean;
  maxSelect?: number;
  options: AddonOption[];
}

interface AddonGroupProps {
  group: AddonGroupData;
  selectedIds: string[];
  isValidated: boolean;
  onToggle: (groupId: string, optionId: string) => void;
}

export function AddonGroup({ group, selectedIds, isValidated, onToggle }: AddonGroupProps) {
  const isSatisfied =
    !group.required ||
    (group.type === 'radio' && selectedIds.length > 0) ||
    (group.type === 'checkbox' && selectedIds.length > 0);

  const canSelectMore =
    !group.maxSelect || selectedIds.length < group.maxSelect;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{group.title}</Text>
          {group.subtitle && (
            <Text style={styles.subtitle}>{group.subtitle}</Text>
          )}
        </View>
        {group.required && (
          <View style={[
            styles.badge,
            isValidated && isSatisfied ? styles.badgeSatisfied : styles.badgeRequired,
          ]}>
            {isValidated && isSatisfied ? (
              <Check size={12} color="#4CAF50" strokeWidth={2.5} />
            ) : (
              <X size={12} color={isValidated && !isSatisfied ? '#FF4444' : '#FF4444'} strokeWidth={2.5} />
            )}
            <Text style={[
              styles.badgeText,
              isValidated && isSatisfied ? styles.badgeTextSatisfied : styles.badgeTextRequired,
            ]}>
              Required
            </Text>
          </View>
        )}
        {!group.required && selectedIds.length > 0 && (
          <View style={styles.selectedCountBadge}>
            <Text style={styles.selectedCountText}>{selectedIds.length} items selected</Text>
          </View>
        )}
      </View>

      <View style={styles.options}>
        {group.options.map((option, index) => {
          const isSelected = selectedIds.includes(option.id);
          const isDisabled = !isSelected && !canSelectMore && group.type === 'checkbox';
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
    backgroundColor: '#FFF0F0',
  },
  badgeSatisfied: {
    backgroundColor: '#F0FFF0',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },
  badgeTextRequired: {
    color: '#FF4444',
  },
  badgeTextSatisfied: {
    color: '#4CAF50',
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
