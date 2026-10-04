import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Input } from '../../components/Input';
import { PrimaryButton } from '../../components/PrimaryButton';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../../constants/theme';
import { isUsernameAvailable } from '../../features/onboarding/profileService';
import { getCurrentSession } from '../../lib/auth';

export default function IdentityScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  const [error, setError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    setError('');

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanDisplayName) {
      setError('Display name is required.');
      return;
    }

    if (!cleanUsername) {
      setError('Username is required.');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setError(
        'Username can contain only lowercase letters, numbers, and underscores.',
      );
      return;
    }

    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (cleanUsername.length > 20) {
      setError('Username must be 20 characters or less.');
      return;
    }

    setCheckingUsername(true);

    try {
      const session = await getCurrentSession();

      if (!session?.user) {
        setError('Your session has expired. Please log in again.');
        return;
      }

      const available = await isUsernameAvailable(
        cleanUsername,
        session.user.id,
      );

      if (!available) {
        setError('That username is already taken. Try another one.');
        return;
      }

      router.push({
        pathname: '/(onboarding)/about',
        params: {
          displayName: cleanDisplayName,
          username: cleanUsername,
        },
      });
    } catch (err) {
      console.error('Username check failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not check username. Please try again.',
      );
    } finally {
      setCheckingUsername(false);
    }
  };

  const buttonLoading = checkingUsername || submitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <Text style={styles.step}>01 / 05</Text>

        <View style={styles.header}>
          <Text style={styles.title}>Let's get you started.</Text>

          <Text style={styles.subtitle}>
            Tell us what people should call you on DareShot.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Display name"
            placeholder="e.g. Azam"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={40}
            editable={!buttonLoading}
          />

          <Input
            label="Username"
            placeholder="e.g. azam_dare"
            value={username}
            onChangeText={(value) =>
              setUsername(value.toLowerCase().replace(/\s/g, ''))
            }
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            editable={!buttonLoading}
          />

          <Text style={styles.usernameHint}>
            Your username will appear as @username.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            label={buttonLoading ? 'CHECKING...' : 'CONTINUE'}
            onPress={handleContinue}
            disabled={buttonLoading}
          />

          {buttonLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={styles.loader}
            />
          ) : null}

          <Pressable
            onPress={() => router.back()}
            disabled={buttonLoading}
            style={styles.backButton}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  progressFill: {
    width: '20%',
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },

  step: {
    marginTop: spacing.lg,
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },

  header: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xxl,
    lineHeight: 38,
  },

  subtitle: {
    marginTop: spacing.sm,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: 24,
  },

  form: {
    gap: spacing.md,
  },

  usernameHint: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: -spacing.xs,
  },

  errorBox: {
    backgroundColor: '#241519',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  errorText: {
    color: colors.danger,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  bottom: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },

  loader: {
    marginTop: spacing.md,
  },

  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },

  backText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});