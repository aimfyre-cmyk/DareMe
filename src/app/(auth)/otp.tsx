import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../../lib/supabase';

type OtpMode = 'signup' | 'phone_change';

export default function OtpScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    type?: string;
  }>();

  const phone = Array.isArray(params.phone)
    ? params.phone[0]
    : params.phone;

  const mode: OtpMode =
    params.type === 'phone_change'
      ? 'phone_change'
      : 'signup';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');

  const isPhoneChange = mode === 'phone_change';

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    setErrorMessage('');
    setMessage('');

    const cleanOtp = otp.trim();

    if (!phone) {
      setErrorMessage(
        isPhoneChange
          ? 'Mobile number missing hai. Please go back and try again.'
          : 'Mobile number missing hai. Signup dobara karo.',
      );
      return;
    }

    if (cleanOtp.length !== 6) {
      setErrorMessage('6 digit OTP enter karo.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.verifyOtp({
          phone,
          token: cleanOtp,
          type: isPhoneChange
            ? 'phone_change'
            : 'sms',
        });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (isPhoneChange) {
        setMessage(
          'Mobile number verified and updated successfully.',
        );

        setTimeout(() => {
          router.replace('/account');
        }, 700);

        return;
      }

      if (!data.session) {
        setErrorMessage(
          'OTP verify hua, lekin session create nahi hua.',
        );
        return;
      }

      setMessage(
        'Mobile verified. Setting up your profile...',
      );

      setTimeout(() => {
        router.replace('/(onboarding)/identity');
      }, 500);
    } catch (error) {
      console.error(
        '[DareMe OTP] Verification failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'OTP verification failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phone || countdown > 0 || resending) {
      return;
    }

    setErrorMessage('');
    setMessage('');
    setResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: isPhoneChange
          ? 'phone_change'
          : 'sms',
        phone,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setMessage('New OTP sent successfully.');
      setCountdown(60);
      setOtp('');
    } catch (error) {
      console.error(
        '[DareMe OTP] Resend failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not resend OTP.',
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <View style={styles.content}>
        <Text style={styles.logo}>DARESHOT</Text>

        <Text style={styles.title}>
          {isPhoneChange
            ? 'Verify your new number.'
            : 'Verify your number.'}
        </Text>

        <Text style={styles.subtitle}>
          {isPhoneChange
            ? 'We sent a 6-digit verification code to'
            : 'We sent a 6-digit verification code to'}
        </Text>

        <Text style={styles.phone}>
          {phone || 'your mobile number'}
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor="#77777F"
            value={otp}
            onChangeText={(value) => {
              setErrorMessage('');
              setOtp(
                value.replace(/\D/g, '').slice(0, 6),
              );
            }}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            editable={!loading}
            autoFocus
          />

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {message ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>
                {message}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0B0B0D" />
            ) : (
              <Text style={styles.buttonText}>
                ✓ VERIFY OTP
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={countdown > 0 || resending}
            style={styles.resendButton}
          >
            {resending ? (
              <ActivityIndicator color="#B7FF3C" />
            ) : (
              <Text
                style={[
                  styles.resendText,
                  countdown > 0 &&
                    styles.resendDisabled,
                ]}
              >
                {countdown > 0
                  ? `Resend OTP in ${countdown}s`
                  : 'Resend OTP'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={loading}
            style={styles.backButton}
          >
            <Text style={styles.backText}>
              {isPhoneChange
                ? 'Change mobile number'
                : 'Change mobile number'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0D',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },

  logo: {
    color: '#B7FF3C',
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    letterSpacing: 2,
    marginBottom: 24,
  },

  title: {
    color: '#FFFFFF',
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 36,
    marginBottom: 8,
  },

  subtitle: {
    color: '#A7A7AD',
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },

  phone: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginBottom: 32,
  },

  form: {
    gap: 14,
  },

  otpInput: {
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#29292E',
    borderRadius: 12,
    color: '#FFFFFF',
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 28,
    letterSpacing: 8,
    minHeight: 64,
    paddingHorizontal: 16,
  },

  errorBox: {
    backgroundColor: '#2A1518',
    borderWidth: 1,
    borderColor: '#FF4D5A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  errorText: {
    color: '#FF7A84',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
  },

  messageBox: {
    backgroundColor: '#162414',
    borderWidth: 1,
    borderColor: '#35D07F',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  messageText: {
    color: '#8BE8AE',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
  },

  button: {
    backgroundColor: '#B7FF3C',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#0B0B0D',
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 15,
  },

  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  resendText: {
    color: '#B7FF3C',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },

  resendDisabled: {
    color: '#77777F',
  },

  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  backText: {
    color: '#A7A7AD',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
});