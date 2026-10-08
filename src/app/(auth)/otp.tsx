import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

type OtpMethod = 'phone' | 'email';
type OtpMode = 'signup' | 'recovery' | 'phone_change';

export default function OtpScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    email?: string;
    type?: string;
    method?: string;
  }>();

  const phone = Array.isArray(params.phone)
    ? params.phone[0]
    : params.phone;

  const email = Array.isArray(params.email)
    ? params.email[0]
    : params.email;

  const mode: OtpMode =
    params.type === 'phone_change'
      ? 'phone_change'
      : params.type === 'recovery'
        ? 'recovery'
        : 'signup';

  const method: OtpMethod =
    params.method === 'email'
      ? 'email'
      : 'phone';

  const isPhoneChange = mode === 'phone_change';
  const isEmail = method === 'email';

  const identifier = useMemo(() => {
    if (isEmail) {
      return email || 'your email address';
    }

    return phone || 'your mobile number';
  }, [email, phone, isEmail]);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const clearFeedback = () => {
    setErrorMessage('');
    setMessage('');
  };

  const handleVerify = async () => {
    clearFeedback();

    const cleanOtp = otp.trim();

    if (isEmail && !email) {
      setErrorMessage(
        'Email address missing hai. Please go back and try again.',
      );
      return;
    }

    if (!isEmail && !phone) {
      setErrorMessage(
        isPhoneChange
          ? 'Mobile number missing hai. Please go back and try again.'
          : 'Mobile number missing hai. Signup dobara karo.',
      );
      return;
    }

    if (cleanOtp.length !== 6) {
      setErrorMessage('6 digit verification code enter karo.');
      return;
    }

    setLoading(true);

    try {
      let data;
      let error;

      if (isEmail) {
        const result = await supabase.auth.verifyOtp({
          email: email as string,
          token: cleanOtp,
          type:
            mode === 'recovery'
              ? 'recovery'
              : 'email',
        });

        data = result.data;
        error = result.error;
      } else {
        const result = await supabase.auth.verifyOtp({
          phone: phone as string,
          token: cleanOtp,
          type: isPhoneChange
            ? 'phone_change'
            : 'sms',
        });

        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error(
          '[DareMe OTP] Verification error:',
          error,
        );

        setErrorMessage(error.message);
        return;
      }

      /*
       * Existing phone number change flow.
       * This must remain separate from signup/recovery.
       */
      if (isPhoneChange) {
        setMessage(
          'Mobile number verified and updated successfully.',
        );

        setTimeout(() => {
          router.replace('/account');
        }, 700);

        return;
      }

      /*
       * Both signup and recovery need an authenticated
       * Supabase session before updateUser({ password }).
       */
      if (!data.session) {
        setErrorMessage(
          'Verification successful hua, lekin secure session create nahi hua. Please try again.',
        );
        return;
      }

      /*
       * Signup:
       * OTP verified → create password → onboarding.
       */
      if (mode === 'signup') {
        setMessage(
          isEmail
            ? 'Email verified. Now create your password.'
            : 'Mobile verified. Now create your password.',
        );

        setTimeout(() => {
          router.replace({
            pathname: './reset-password',
            params: {
              mode: 'signup',
            },
          });
        }, 500);

        return;
      }

      /*
       * Recovery:
       * OTP verified → create new password.
       */
      if (mode === 'recovery') {
        setMessage(
          isEmail
            ? 'Email verified. Now create your new password.'
            : 'Mobile verified. Now create your new password.',
        );

        setTimeout(() => {
          router.replace({
            pathname: './reset-password',
            params: {
              mode: 'recovery',
            },
          });
        }, 500);
      }
    } catch (error) {
      console.error(
        '[DareMe OTP] Verification failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Verification failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (
      countdown > 0 ||
      resending ||
      loading
    ) {
      return;
    }

    if (isEmail && !email) {
      setErrorMessage(
        'Email address missing hai. Please go back and try again.',
      );
      return;
    }

    if (!isEmail && !phone) {
      setErrorMessage(
        'Mobile number missing hai. Please go back and try again.',
      );
      return;
    }

    clearFeedback();
    setResending(true);

    try {
      let error;

      if (isEmail) {
        /*
         * Email signup/recovery uses email OTP.
         *
         * For recovery, the initial recovery request will
         * also use the email OTP authentication flow.
         */
        const result = await supabase.auth.signInWithOtp({
          email: email as string,
          options: {
            shouldCreateUser: mode === 'signup',
          },
        });

        error = result.error;
      } else {
        /*
         * Phone signup/recovery uses SMS OTP.
         * phone_change keeps the existing resend behavior.
         */
        const result = await supabase.auth.resend({
          type: isPhoneChange
            ? 'phone_change'
            : 'sms',
          phone: phone as string,
        });

        error = result.error;
      }

      if (error) {
        console.error(
          '[DareMe OTP] Resend error:',
          error,
        );

        setErrorMessage(error.message);
        return;
      }

      setMessage(
        'New verification code sent successfully.',
      );

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
          : 'Could not resend verification code.',
      );
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    if (loading || resending) {
      return;
    }

    router.back();
  };

  const title = isPhoneChange
    ? 'Verify your new number.'
    : mode === 'recovery'
      ? 'Verify your account.'
      : 'Verify your account.';

  const subtitle = isPhoneChange
    ? 'We sent a 6-digit verification code to'
    : mode === 'recovery'
      ? 'We sent a 6-digit verification code to'
      : 'We sent a 6-digit verification code to';

  const identifierType = isEmail
    ? 'email'
    : 'mobile number';

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
          {title}
        </Text>

        <Text style={styles.subtitle}>
          {subtitle}
        </Text>

        <Text
          style={styles.identifier}
          numberOfLines={2}
        >
          {identifier}
        </Text>

        <Text style={styles.identifierType}>
          {identifierType}
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
                value
                  .replace(/\D/g, '')
                  .slice(0, 6),
              );
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            textAlign="center"
            editable={!loading}
            autoFocus
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={handleVerify}
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
              pressed &&
                styles.buttonPressed,
              loading &&
                styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0B0B0D" />
            ) : (
              <Text style={styles.buttonText}>
                ✓ VERIFY CODE
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={
              countdown > 0 ||
              resending ||
              loading
            }
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
                  ? `Resend code in ${countdown}s`
                  : 'Resend code'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleBack}
            disabled={loading || resending}
            style={styles.backButton}
          >
            <Text style={styles.backText}>
              {isPhoneChange
                ? 'Change mobile number'
                : isEmail
                  ? 'Change email address'
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

  identifier: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginBottom: 4,
  },

  identifierType: {
    color: '#77777F',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
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