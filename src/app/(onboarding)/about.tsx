import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
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

export default function AboutScreen() {
  const params = useLocalSearchParams<{
    displayName?: string;
    username?: string;
  }>();

  const displayName = Array.isArray(params.displayName)
    ? params.displayName[0]
    : params.displayName ?? '';

  const username = Array.isArray(params.username)
    ? params.username[0]
    : params.username ?? '';

  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [ageBracket, setAgeBracket] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    setError('');

    const cleanCountry = country.trim();
    const cleanLanguage = language.trim();
    const cleanAgeBracket = ageBracket.trim();
    const cleanBio = bio.trim();

    if (!cleanCountry) {
      setError('Country is required.');
      return;
    }

    if (!cleanLanguage) {
      setError('Language is required.');
      return;
    }

    if (!cleanAgeBracket) {
      setError('Age bracket is required.');
      return;
    }

    if (!displayName || !username) {
      setError('Identity information is missing. Please go back.');
      return;
    }

    router.push({
      pathname: '/(onboarding)/interests',
      params: {
        displayName,
        username,
        country: cleanCountry,
        language: cleanLanguage,
        ageBracket: cleanAgeBracket,
        bio: cleanBio,
      },
    });
  };

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

        <Text style={styles.step}>02 / 05</Text>

        <View style={styles.header}>
          <Text style={styles.title}>A little more about you.</Text>

          <Text style={styles.subtitle}>
            This helps DareMe understand your profile and keep future dare
            experiences age-appropriate.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Country"
            placeholder="e.g. India"
            value={country}
            onChangeText={setCountry}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
          />

          <Input
            label="Language"
            placeholder="e.g. English"
            value={language}
            onChangeText={setLanguage}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
          />

          <Input
            label="Age bracket"
            placeholder="e.g. 18-24"
            value={ageBracket}
            onChangeText={setAgeBracket}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />

          <Input
            label="Bio"
            placeholder="Tell people a little about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={160}
            style={styles.bioInput}
          />

          <Text style={styles.characterCount}>
            {bio.length}/160
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            label="CONTINUE"
            onPress={handleContinue}
          />

          <Text style={styles.footerHint}>
            You can update your profile details later.
          </Text>

          <Text
            style={styles.backButton}
            onPress={() => router.back()}
          >
            Back
          </Text>
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
    width: '40%',
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
    marginBottom: spacing.xl,
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

  bioInput: {
    minHeight: 120,
  },

  characterCount: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'right',
    marginTop: -spacing.sm,
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

  footerHint: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  backButton: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});