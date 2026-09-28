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

import { Screen } from '../../components/Screen';
import {
    colors,
    fontFamily,
    fontSize,
    radius,
    spacing,
} from '../../constants/theme';
import { supabase } from '../../lib/supabase';

function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return '';
}

export default function PhoneSettingsScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSendOtp = async () => {
    if (loading) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    const normalizedPhone = normalizeIndianPhone(phone);

    if (!normalizedPhone) {
      setErrorMessage(
        'Please enter a valid 10-digit Indian mobile number.',
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        phone: normalizedPhone,
      });

      console.log('[DareMe Phone] Update phone response:', {
        hasUser: !!data.user,
        phone: data.user?.phone ?? null,
        error: error?.message ?? null,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage(
        'OTP has been requested. Enter the verification code sent to your new number.',
      );

      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone: normalizedPhone,
          type: 'phone_change',
        },
      });
    } catch (error) {
      console.error(
        '[DareMe Phone] Update phone failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not update your mobile number.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              MOBILE NUMBER
            </Text>

            <Text style={styles.title}>
              Update your number
            </Text>

            <Text style={styles.subtitle}>
              Enter your new mobile number. We will
              verify it with an OTP before changing
              your account number.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>
              Mobile Number
            </Text>

            <TextInput
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              placeholder="Enter 10-digit mobile number"
              placeholderTextColor={colors.secondaryText}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={13}
              style={styles.input}
              editable={!loading}
            />

            <Text style={styles.hint}>
              India +91 will be added automatically.
            </Text>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>
                  {successMessage}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottom}>
            <Pressable
              onPress={handleSendOtp}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed &&
                  !loading &&
                  styles.buttonPressed,
                loading &&
                  styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.background}
                />
              ) : (
                <Text style={styles.primaryButtonText}>
                  SEND OTP
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              disabled={loading}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>
                Back
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    marginBottom: spacing.xl,
  },

  eyebrow: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: 32,
    lineHeight: 38,
  },

  subtitle: {
    marginTop: spacing.sm,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },

  form: {
    gap: spacing.sm,
  },

  label: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.primaryText,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
  },

  hint: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },

  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#2A1518',
  },

  errorText: {
    color: '#FF7A84',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  successBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: '#12251A',
  },

  successText: {
    color: colors.success,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  bottom: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: colors.background,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  backButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  backButtonText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});