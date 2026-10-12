import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconWell, Radio, SecondaryButton, Separated, Text, Touchable } from '@/components/ds';
import { formatAddressName } from '@/hooks/use-delivery-address';
import { CustomerAddress } from '@/services/api/types';
import { createStyles, type IconName } from '@/theme';

interface AddressPopoverProps {
  visible: boolean;
  addresses: CustomerAddress[];
  selectedName: string | null;
  onClose: () => void;
  onSelect: (name: string) => void;
  onAddNew: () => void;
}

/** Pick the glyph that best fits a saved address's label. */
function iconFor(name: string): IconName {
  const key = name.toLowerCase();
  if (key === 'home' || key === 'house') return 'home';
  if (key === 'work' || key === 'office') return 'office';
  return 'pin';
}

/**
 * "Deliver to" switcher: a bottom sheet over a scrim listing the saved
 * addresses (radio on the active one) and a shortcut to add a new one.
 */
export function AddressPopover({ visible, addresses, selectedName, onClose, onSelect, onAddNew }: AddressPopoverProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grabber} />
          <Text variant="heading" accessibilityRole="header">
            Deliver to
          </Text>

          {addresses.length === 0 ? (
            <Text variant="description" color="inkMuted">
              No saved addresses yet.
            </Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false} bounces={false}>
              <Separated>
                {addresses.map((address) => {
                  const isActive = address.name === selectedName;
                  return (
                    <Touchable
                      key={address.name}
                      scaleTo={1}
                      style={styles.row}
                      onPress={() => {
                        onSelect(address.name);
                        onClose();
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={formatAddressName(address.name)}
                    >
                      <IconWell icon={iconFor(address.name)} tone={isActive ? 'ink' : 'neutral'} />
                      <View style={styles.rowText}>
                        <Text variant="itemLabel">{formatAddressName(address.name)}</Text>
                        {address.details.formattedAddress ? (
                          <Text variant="meta" color="inkMuted" numberOfLines={1}>
                            {address.details.formattedAddress}
                          </Text>
                        ) : null}
                      </View>
                      <Radio selected={isActive} />
                    </Touchable>
                  );
                })}
              </Separated>
            </ScrollView>
          )}

          <SecondaryButton
            label="Add new address"
            icon="add"
            onPress={() => {
              onClose();
              onAddNew();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((t) => ({
  scrim: { flex: 1, backgroundColor: t.colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    paddingTop: t.space[10],
    paddingHorizontal: t.screenPadding,
    gap: t.space[16],
    ...t.shadow.sheet,
  },
  grabber: {
    alignSelf: 'center',
    width: t.size.sheetGrabber.w,
    height: t.size.sheetGrabber.h,
    borderRadius: 2,
    backgroundColor: t.colors.outline,
  },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space[14], paddingVertical: t.space[12] },
  rowText: { flex: 1 },
}));
