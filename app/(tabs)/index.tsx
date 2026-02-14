import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { CustomButton } from '@/components/auth/custom-button';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🍕</Text>
        <Text style={styles.title}>Welcome to Hungry!</Text>
        <Text style={styles.subtitle}>Your favorite food delivery app</Text>

        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.label}>Logged in as:</Text>
            <Text style={styles.email}>{user.email}</Text>
            {user.user_metadata?.name && (
              <Text style={styles.name}>{user.user_metadata.name}</Text>
            )}
          </View>
        )}

        <CustomButton
          title="LOG OUT"
          onPress={signOut}
          style={styles.logoutButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A2B3D',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 40,
    textAlign: 'center',
  },
  userInfo: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#1A2B3D',
    fontWeight: '600',
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    color: '#666666',
  },
  logoutButton: {
    width: '100%',
  },
});
