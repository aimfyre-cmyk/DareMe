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

type AuthMethod = 'phone' | 'email';

export default function SignupScreen() {
  const [method, setMethod] = useState<AuthMethod>('phone');

  // Phone state
  const [phone, setPhone] = useState('');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const clearFeedback = () => {
    setMessage('');
    setErrorMessage('');
  };

  const handleMethodChange = (nextMethod: AuthMethod) => {
    if (loading) {
      return;
    }

    setMethod(nextMethod);
    clearFeedback();
  };

  const handleSendOtp = async () => {
    clearFeedback();

    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.length !== 10) {
      setErrorMessage(
        'Valid 10-digit mobile number enter karo.',
      );
      return;
    }

    const formattedPhone = `+91${cleanPhone}`;

    setLoading(true);
    setMessage('Sending verification code...');

    try {
      const { error } =
        await supabase.auth.signInWithOtp({
          phone: formattedPhone,
          options: {
            shouldCreateUser: true,
          },
        });

      if (error) {
        console.error(
          '[DareMe Auth] OTP send error:',
          error,
        );
        setMessage('');
        setErrorMessage(error.message);
        return;
      }

      setMessage('OTP sent successfully.');

      router.push({
        pathname: './otp',
        params: {
          phone: formattedPhone,
        },
      });
    } catch (error) {
      console.error(
        '[DareMe Auth] Unexpected OTP error:',
        error,
      );

      setMessage('');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not send OTP. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async () => {
    clearFeedback();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Email address enter karo.');
      return;
    }

    if (!cleanEmail.includes('@')) {
      setErrorMessage(
        'Valid email address enter karo.',
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        'Password kam se kam 6 characters ka hona chahiye.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords match nahi kar rahe.');
      return;
    }

    setLoading(true);
    setMessage('Creating your account...');

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

      if (error) {
        console.error(
          '[DareMe Auth] Email signup error:',
          error,
        );

        setMessage('');
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        setMessage(
          'Account created successfully. Setting up your profile...',
        );

        setTimeout(() => {
          router.replace('/(onboarding)/identity');
        }, 500);

        return;
      }

      setMessage(
        'Account created. Check your email and confirm your account before continuing.',
      );
    } catch (error) {
      console.error(
        '[DareMe Auth] Unexpected email signup error:',
        error,
      );

      setMessage('');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not create your account. Please try again.',
      );
    } finally {
      setLoading(false);
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
        <Text style={styles.logo}>DAREME</Text>

        <Text style={styles.title}>
          Create account.
        </Text>

        <Text style={styles.subtitle}>
          Join DareMe, take dares and make memories.
        </Text>

        {/* Auth method switcher */}
        <View style={styles.methodSwitcher}>
          <Pressable
            onPress={() =>
              handleMethodChange('phone')
            }
            style={[
              styles.methodButton,
              method === 'phone' &&
                styles.methodButtonActive,
            ]}
            disabled={loading}
          >
            <Text
              style={[
                styles.methodText,
                method === 'phone' &&
                  styles.methodTextActive,
              ]}
            >
              📱 Mobile
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              handleMethodChange('email')
            }
            style={[
              styles.methodButton,
              method === 'email' &&
                styles.methodButtonActive,
            ]}
            disabled={loading}
          >
            <Text
              style={[
                styles.methodText,
                method === 'email' &&
                  styles.methodTextActive,
              ]}
            >
              ✉️ Email
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {method === 'phone' ? (
            <>
              <View style={styles.phoneContainer}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryFlag}>
                    🇮🇳
                  </Text>

                  <Text style={styles.countryCodeText}>
                    +91
                  </Text>
                </View>

                <TextInput
                  style={styles.phoneInput}
                  placeholder="Mobile number"
                  placeholderTextColor="#77777F"
                  value={phone}
                  onChangeText={(value) => {
                    clearFeedback();

                    setPhone(
                      value
                        .replace(/\D/g, '')
                        .slice(0, 10),
                    );
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!loading}
                />
              </View>

              <Text style={styles.helperText}>
                We'll send you a 6-digit OTP to verify
                your number.
              </Text>

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
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0B0B0D" />
                ) : (
                  <Text style={styles.buttonText}>
                    ⚡ SEND OTP
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#77777F"
                value={email}
                onChangeText={(value) => {
                  clearFeedback();
                  setEmail(value);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor="#77777F"
                  value={password}
                  onChangeText={(value) => {
                    clearFeedback();
                    setPassword(value);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Pressable
                  onPress={() =>
                    setShowPassword(
                      (current) => !current,
                    )
                  }
                  style={styles.eyeButton}
                  disabled={loading}
                >
                  <Text style={styles.eyeIcon}>
                    {showPassword
                      ? '🙈'
                      : '👁️'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm password"
                  placeholderTextColor="#77777F"
                  value={confirmPassword}
                  onChangeText={(value) => {
                    clearFeedback();
                    setConfirmPassword(value);
                  }}
                  secureTextEntry={
                    !showConfirmPassword
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Pressable
                  onPress={() =>
                    setShowConfirmPassword(
                      (current) => !current,
                    )
                  }
                  style={styles.eyeButton}
                  disabled={loading}
                >
                  <Text style={styles.eyeIcon}>
                    {showConfirmPassword
                      ? '🙈'
                      : '👁️'}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.helperText}>
                Password must contain at least 6
                characters.
              </Text>

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
                onPress={handleEmailSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0B0B0D" />
                ) : (
                  <Text style={styles.buttonText}>
                    ⚡ CREATE ACCOUNT
                  </Text>
                )}
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => router.replace('./login')}
            style={styles.linkButton}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.linkAccent}>
                Login
              </Text>
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
    marginBottom: 24,
  },

  methodSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#29292E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },

  methodButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },

  methodButtonActive: {
    backgroundColor: '#B7FF3C',
  },

  methodText: {
    color: '#A7A7AD',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },

  methodTextActive: {
    color: '#0B0B0D',
  },

  form: {
    gap: 14,
  },

  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#29292E',
    borderRadius: 12,
    minHeight: 52,
  },

  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#29292E',
    minHeight: 32,
  },

  countryFlag: {
    fontSize: 18,
    marginRight: 6,
  },

  countryCodeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 15,
  },

  phoneInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
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

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#29292E',
    borderRadius: 12,
    minHeight: 52,
  },

  passwordInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
  },

  eyeButton: {
    width: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyeIcon: {
    fontSize: 18,
  },

  helperText: {
    color: '#77777F',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4,
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

  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  linkText: {
    color: '#A7A7AD',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },

  linkAccent: {
    color: '#B7FF3C',
    fontFamily: 'Inter-Medium',
  },
});