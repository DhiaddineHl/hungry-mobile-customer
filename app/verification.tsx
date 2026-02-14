import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { AuthButton } from '@/components/auth';

const CODE_LENGTH = 4;

export default function VerificationScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [timer, setTimer] = useState(40);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    if (timer === 0) {
      setTimer(40);
      console.log('Resending code...');
    }
  };

  const handleVerify = () => {
    const fullCode = code.join('');
    console.log('Verifying code:', fullCode);
  };

  const displayEmail = email || 'ahmad.hamadi@gmail.com';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require('@/assets/verification-upper-section.svg')}
            style={styles.headerImage}
            contentFit="cover"
          />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Verification</Text>
            <Text style={styles.headerSubtitle}>We sent a code to your email</Text>
            <Text style={styles.headerEmail}>{displayEmail}</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.codeLabel}>Code</Text>

          <View style={styles.codeInputContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.codeInput}
                value={digit}
                onChangeText={(text) => handleCodeChange(text.slice(-1), index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={timer > 0}
          >
            <Text style={[styles.resendText, timer === 0 && styles.resendTextActive]}>
              Resend
            </Text>
            {timer > 0 && <Text style={styles.timerText}> in {timer}s</Text>}
          </TouchableOpacity>

          <AuthButton
            title="Verify"
            onPress={handleVerify}
            style={styles.verifyButton}
          />

          <Text style={styles.termsText}>
            By continuing, you automatically accept our{' '}
            <Text style={styles.termsLink}>Terms & Conditions</Text>,{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text> and{' '}
            <Text style={styles.termsLink}>Cookies policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    height: 280,
    width: '100%',
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  headerEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A2B3D',
    marginBottom: 16,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    height: 64,
    backgroundColor: '#FFF5E6',
    borderRadius: 12,
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1A2B3D',
  },
  resendButton: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#999999',
    fontWeight: '500',
  },
  resendTextActive: {
    color: '#F5A623',
  },
  timerText: {
    fontSize: 14,
    color: '#999999',
  },
  verifyButton: {
    marginBottom: 24,
  },
  termsText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#F5A623',
    textDecorationLine: 'underline',
  },
});
