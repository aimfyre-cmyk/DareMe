import { router } from 'expo-router';
import { useState } from 'react';
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

type RecoveryMethod = 'phone' | 'email';

export default function ForgotPasswordScreen() {
  const [method, setMethod] =
    useState<RecoveryMethod>('email');

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');
  const [message, setMessage] = useState('');

  const handleSendCode = async () => {
    setErrorMessage('');
    setMessage('');

    if (method === 'email') {
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail) {
        setErrorMessage(
          'Apna email address enter karo.',
        );
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          cleanEmail,
        )
      ) {
        setErrorMessage(
          'Valid email address enter karo.',
        );
        return;
      }

      setLoading(true);

      try {
        const { error } =
          await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: {
              shouldCreateUser: false,
            },
          });

        if (error) {
          console.error(
            '[DareMe Recovery] Email OTP error:',
            error,
          );

          setErrorMessage(error.message);
          return;
        }

        setMessage(
          'Verification code tumhare email par bhej diya gaya hai.',
        );

        setTimeout(() => {
          router.push({
            pathname: './otp',
            params: {
              email: cleanEmail,
              type: 'recovery',
              method: 'email',
            },
          });
        }, 400);
      } catch (error) {
        console.error(
          '[DareMe Recovery] Email recovery failed:',
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not send verification code. Please try again.',
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    const cleanPhone = phone
      .replace(/\D/g, '')
      .slice(0, 10);

    if (cleanPhone.length !== 10) {
      setErrorMessage(
        '10 digit mobile number enter karo.',
      );
      return;
    }

    const formattedPhone = `+91${cleanPhone}`;

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.signInWithOtp({
          phone: formattedPhone,
          options: {
            shouldCreateUser: false,
          },
        });

      if (error) {
        console.error(
          '[DareMe Recovery] Phone OTP error:',
          error,
        );

        setErrorMessage(error.message);
        return;
      }

      setMessage(
        'Verification code tumhare mobile par bhej diya gaya hai.',
      );

      setTimeout(() => {
        router.push({
          pathname: './otp',
          params: {
            phone: formattedPhone,
            type: 'recovery',
            method: 'phone',
          },
        });
      }, 400);
    } catch (error) {
      console.error(
        '[DareMe Recovery] Phone recovery failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not send verification code. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = (
    nextMethod: RecoveryMethod,
  ) => {
    if (loading) {
      return;
    }

    setMethod(nextMethod);
    setErrorMessage('');
    setMessage('');
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
        <Pressable
          onPress={() => router.replace('./login')}
          style={styles.backButton}
          disabled={loading}
        >
          <Text style={styles.backText}>
            ← Back to login
          </Text>
        </Pressable>

        <Text style={styles.logo}>
          DARESHOT
        </Text>

        <Text style={styles.title}>
          Forgot password.
        </Text>

        <Text style={styles.subtitle}>
          Apna registered email ya mobile number
          enter karo. Hum tumhe verification code
          bhejenge.
        </Text>

        <View style={styles.switcher}>
          <Pressable
            style={[
              styles.switchButton,
              method === 'email' &&
                styles.switchButtonActive,
            ]}
            onPress={() =>
              handleMethodChange('email')
            }
            disabled={loading}
          >
            <Text
              style={[
                styles.switchText,
                method === 'email' &&
                  styles.switchTextActive,
              ]}
            >
              Email
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.switchButton,
              method === 'phone' &&
                styles.switchButtonActive,
            ]}
            onPress={() =>
              handleMethodChange('phone')
            }
            disabled={loading}
          >
            <Text
              style={[
                styles.switchText,
                method === 'phone' &&
                  styles.switchTextActive,
              ]}
            >
              Mobile
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {method === 'email' ? (
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#77777F"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrorMessage('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSendCode}
            />
          ) : (
            <View style={styles.phoneInputContainer}>
              <Text style={styles.countryCode}>
                +91
              </Text>

              <TextInput
                style={styles.phoneInput}
                placeholder="Mobile number"
                placeholderTextColor="#77777F"
                value={phone}
                onChangeText={(value) => {
                  setPhone(
                    value
                      .replace(/\D/g, '')
                      .slice(0, 10),
                  );
                  setErrorMessage('');
                }}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                editable={!loading}
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
              />
            </View>
          )}

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
            onPress={handleSendCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0B0B0D" />
            ) : (
              <Text style={styles.buttonText}>
                SEND VERIFICATION CODE
              </Text>
            )}
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

  backButton: {
    marginBottom: 32,
  },

  backText: {
    color: '#A7A7AD',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
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
    marginBottom: 28,
  },

  switcher: {
    flexDirection: 'row',
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#29292E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },

  switchButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },

  switchButtonActive: {
    backgroundColor: '#B7FF3C',
  },

  switchText: {
    color: '#A7A7AD',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },

  switchTextActive: {
    color: '#0B0B0D',
    fontFamily: 'SpaceGrotesk-Bold',
  },

  form: {
    gap: 14,
  },

  input: {
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#29292E',
    borderRadius: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
  },

  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#29292E',
    borderRadius: 12,
    minHeight: 52,
  },

  countryCode: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    paddingLeft: 16,
    paddingRight: 8,
  },

  phoneInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 8,
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
});