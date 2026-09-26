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

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignup = async () => {
    setMessage('');
    setErrorMessage('');

    const cleanEmail = email.trim();

    if (!cleanEmail || !password || !confirmPassword) {
      setErrorMessage('Email, password aur confirm password enter karo.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password kam se kam 6 characters ka hona chahiye.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Dono passwords same hone chahiye.');
      return;
    }

    setLoading(true);
    setMessage('Creating your DareMe account...');

    console.log('[DareMe Auth] Signup started:', cleanEmail);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      console.log('[DareMe Auth] Signup response:', {
        hasUser: !!data.user,
        hasSession: !!data.session,
        error: error?.message ?? null,
      });

      if (error) {
        console.error('[DareMe Auth] Signup error:', error);
        setLoading(false);
        setMessage('');
        setErrorMessage(error.message);
        return;
      }

      setLoading(false);

      if (data.session) {
        setMessage('Account created successfully. Opening DareMe...');

        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);

        return;
      }

      setMessage(
        'Account created. Check your email and confirm your account before login.',
      );
    } catch (error) {
      console.error('[DareMe Auth] Unexpected signup error:', error);

      setLoading(false);
      setMessage('');

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Signup failed. Please try again.',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>DAREME</Text>

        <Text style={styles.title}>Create account.</Text>

        <Text style={styles.subtitle}>
          Join DareMe, take dares and make memories.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#77777F"
            value={email}
            onChangeText={setEmail}
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
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />

            <Pressable
              onPress={() => setShowPassword((current) => !current)}
              style={styles.eyeButton}
              accessibilityLabel={
                showPassword ? 'Hide password' : 'Show password'
              }
              disabled={loading}
            >
              <Text style={styles.eyeIcon}>
                {showPassword ? '🙈' : '👁️'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm password"
              placeholderTextColor="#77777F"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!loading}
            />

            <Pressable
              onPress={() =>
                setShowConfirmPassword((current) => !current)
              }
              style={styles.eyeButton}
              accessibilityLabel={
                showConfirmPassword
                  ? 'Hide confirm password'
                  : 'Show confirm password'
              }
              disabled={loading}
            >
              <Text style={styles.eyeIcon}>
                {showConfirmPassword ? '🙈' : '👁️'}
              </Text>
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {message ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0B0B0D" />
            ) : (
              <Text style={styles.buttonText}>⚡ CREATE ACCOUNT</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('./login')}
            style={styles.linkButton}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.linkAccent}>Login</Text>
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
    marginBottom: 32,
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