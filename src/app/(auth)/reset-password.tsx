import { router, useLocalSearchParams } from 'expo-router';
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

type PasswordMode = 'signup' | 'recovery';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
  }>();

  const mode: PasswordMode =
    params.mode === 'recovery'
      ? 'recovery'
      : 'signup';

  const isRecovery = mode === 'recovery';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] =
    useState('');

  const clearFeedback = () => {
    setMessage('');
    setErrorMessage('');
  };

  const handleUpdatePassword = async () => {
    clearFeedback();

    if (!password || !confirmPassword) {
      setErrorMessage(
        'New password aur confirm password enter karo.',
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
      setErrorMessage(
        'Dono passwords same hone chahiye.',
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * OTP verification ke baad Supabase session
       * already authenticated hona chahiye.
       */
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          '[DareMe Auth] Session check error:',
          sessionError,
        );

        setErrorMessage(
          sessionError.message,
        );
        setLoading(false);
        return;
      }

      if (!sessionData.session) {
        setErrorMessage(
          isRecovery
            ? 'Password reset session expire ho gaya. Please OTP dobara request karo.'
            : 'Signup session expire ho gaya. Please signup dobara karo.',
        );
        setLoading(false);
        return;
      }

      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        console.error(
          '[DareMe Auth] Password update error:',
          error,
        );

        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      /*
       * SIGNUP FLOW
       *
       * OTP → Password → Identity onboarding
       */
      if (!isRecovery) {
        setMessage(
          'Password created successfully. Setting up your profile...',
        );

        setTimeout(() => {
          router.replace('/(onboarding)/identity');
        }, 700);

        return;
      }

      /*
       * RECOVERY FLOW
       *
       * OTP → New Password → Sign out → Login
       *
       * User explicitly needs to sign in again
       * using the newly created password.
       */
      setMessage(
        'Password successfully updated. Redirecting to login...',
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace('./login');
      }, 900);
    } catch (error) {
      console.error(
        '[DareMe Auth] Unexpected password update error:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Password update failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (loading) {
      return;
    }

    router.back();
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
          onPress={handleBack}
          style={styles.backButton}
          disabled={loading}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </Pressable>

        <Text style={styles.logo}>
          DARESHOT
        </Text>

        <Text style={styles.title}>
          {isRecovery
            ? 'New password.'
            : 'Create password.'}
        </Text>

        <Text style={styles.subtitle}>
          {isRecovery
            ? 'Apna naya password set karo aur apne DareShot account mein wapas jao.'
            : 'Apne DareShot account ke liye secure password create karo.'}
        </Text>

        <View style={styles.form}>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="New password"
              placeholderTextColor="#77777F"
              value={password}
              onChangeText={(value) => {
                setErrorMessage('');
                setPassword(value);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="next"
            />

            <Pressable
              onPress={() =>
                setShowPassword(
                  (current) => !current,
                )
              }
              style={styles.eyeButton}
              disabled={loading}
              accessibilityLabel={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
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
              placeholder="Confirm new password"
              placeholderTextColor="#77777F"
              value={confirmPassword}
              onChangeText={(value) => {
                setErrorMessage('');
                setConfirmPassword(value);
              }}
              secureTextEntry={
                !showConfirmPassword
              }
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={
                handleUpdatePassword
              }
            />

            <Pressable
              onPress={() =>
                setShowConfirmPassword(
                  (current) => !current,
                )
              }
              style={styles.eyeButton}
              disabled={loading}
              accessibilityLabel={
                showConfirmPassword
                  ? 'Hide confirm password'
                  : 'Show confirm password'
              }
            >
              <Text style={styles.eyeIcon}>
                {showConfirmPassword
                  ? '🙈'
                  : '👁️'}
              </Text>
            </Pressable>
          </View>

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
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0B0B0D" />
            ) : (
              <Text style={styles.buttonText}>
                {isRecovery
                  ? '🔐 UPDATE PASSWORD'
                  : '🔐 CREATE PASSWORD'}
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
    marginBottom: 32,
  },

  form: {
    gap: 14,
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
    paddingLeft: 16,
    paddingRight: 8,
  },

  eyeButton: {
    minHeight: 52,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyeIcon: {
    fontSize: 20,
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