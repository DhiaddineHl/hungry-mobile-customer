import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Fonts } from '@/constants/theme';

interface SpecialInstructionsProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function SpecialInstructions({ value, onChangeText }: SpecialInstructionsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.sectionDivider} />
      <View style={styles.content}>
        <Text style={styles.title}>Special Instructions</Text>
        <Text style={styles.hint}>
          You can call for certain allergies or possible health related instructions
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Add a note"
          placeholderTextColor="#AAAAAA"
          value={value}
          onChangeText={onChangeText}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  sectionDivider: {
    height: 8,
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
  },
  hint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    lineHeight: 18,
  },
  input: {
    marginTop: 8,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
});
