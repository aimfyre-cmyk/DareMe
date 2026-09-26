import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Email aur password enter karo.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Login failed', error.message);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>DAREME</Text>

        <Text style={styles.title}>Welcome back.</Text>

        <Text style={styles.subtitle}>
          Login karo aur apna next dare continue karo.
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
            />

            <Pressable
              onPress={() => setShowPassword((current) => !current)}
              style={styles.eyeButton}
              accessibilityLabel={
                showPassword ? 'Hide password' : 'Show password'
              }
            >
              <Text style={styles.eyeIcon}>
                {showPassword ? '🙈' : '👁️'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push('./forgot-password')}
            style={styles.forgotButton}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'LOGGING IN...' : '⚡ LOGIN'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('./signup')}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>
              New to DareMe?{' '}
              <Text style={styles.linkAccent}>Create account</Text>
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

  forgotButton: {
    alignItems: 'flex-end',
    paddingVertical: 4,
  },

  forgotText: {
    color: '#B7FF3C',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
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