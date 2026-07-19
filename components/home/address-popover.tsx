import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefcase, Check, Home, MapPin, Plus } from 'lucide-react-native';
import { Fonts, FontSize, Palette, Radius, Shadows, Spacing } from '@/constants/theme';
import { formatAddressName } from '@/hooks/use-delivery-address';
import { CustomerAddress } from '@/services/api/types';

interface AddressPopoverProps {
  visible: boolean;
  addresses: CustomerAddress[];
  selectedName: string | null;
  onClose: () => void;
  onSelect: (name: string) => void;
  onAddNew: () => void;
}

/** Pick the glyph that best fits a saved address's label. */
function iconFor(name: string) {
  const key = name.toLowerCase();
  if (key === 'home' || key === 'house') return Home;
  if (key === 'work' || key === 'office') return Briefcase;
  return MapPin;
}

/**
 * Dropdown-style popover anchored under the home header's "Deliver to" control.
 * Lists the customer's saved addresses (the active one checked) and offers a
 * shortcut to add a new one.
 */
export function AddressPopover({
  visible,
  addresses,
  selectedName,
  onClose,
  onSelect,
  onAddNew,
}: AddressPopoverProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so taps inside the card don't dismiss it. */}
        <Pressable
          style={[styles.card, { marginTop: insets.top + 56 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Deliver to</Text>

          {addresses.length === 0 ? (
            <Text style={styles.empty}>No saved addresses yet.</Text>
          ) : (
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {addresses.map((address) => {
                const Icon = iconFor(address.name);
                const isActive = address.name === selectedName;
                return (
                  <Pressable
                    key={address.name}
                    style={styles.row}
                    onPress={() => {
                      onSelect(address.name);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={[styles.rowIcon, isActive && styles.rowIconActive]}>
                      <Icon
                        size={18}
                        color={isActive ? Palette.primary : Palette.textSecondary}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{formatAddressName(address.name)}</Text>
                      {!!address.details.formattedAddress && (
                        <Text style={styles.rowAddress} numberOfLines={1}>
                          {address.details.formattedAddress}
                        </Text>
                      )}
                    </View>
                    {isActive && <Check size={18} color={Palette.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.divider} />

          <Pressable
            style={styles.addRow}
            onPress={() => {
              onClose();
              onAddNew();
            }}
            accessibilityRole="button"
          >
            <View style={styles.addIcon}>
              <Plus size={18} color={Palette.primary} />
            </View>
            <Text style={styles.addText}>Add new address</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  title: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Palette.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  empty: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    paddingVertical: Spacing.sm,
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconActive: {
    backgroundColor: Palette.primarySoft,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  rowAddress: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.borderSubtle,
    marginVertical: Spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Palette.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.primary,
  },
});
