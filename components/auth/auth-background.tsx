import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { ReactNode } from 'react';

interface AuthBackgroundProps {
  children: ReactNode;
}

export function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.foodIconsContainer}>
              <Text style={styles.foodIcon}>🍕</Text>
              <Text style={styles.foodIcon}>🍔</Text>
              <Text style={styles.foodIcon}>🍟</Text>
              <Text style={styles.foodIcon}>🌮</Text>
              <Text style={styles.foodIcon}>🍗</Text>
              <Text style={styles.foodIcon}>🥗</Text>
              <Text style={styles.foodIcon}>🍱</Text>
              <Text style={styles.foodIcon}>🥤</Text>
            </View>
            <Text style={styles.logo}>hungry</Text>
          </View>

          <View style={styles.contentCard}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A2B3D',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    minHeight: 280,
  },
  foodIconsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 20,
    gap: 16,
  },
  foodIcon: {
    fontSize: 40,
    opacity: 0.9,
  },
  logo: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    minHeight: 480,
  },
});
