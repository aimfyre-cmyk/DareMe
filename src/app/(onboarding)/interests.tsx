import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../../constants/theme';

const INTERESTS = [
  { key: 'funny', label: 'Funny' },
  { key: 'creative', label: 'Creative' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'brain', label: 'Brain' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'social', label: 'Social' },
  { key: 'photography', label: 'Photography' },
  { key: 'music', label: 'Music' },
  { key: 'content', label: 'Content' },
] as const;

export default function InterestsScreen() {
  const params = useLocalSearchParams<{
    displayName?: string;
    username?: string;
    country?: string;
    language?: string;
    gender?: string;
    dateOfBirth?: string;
    ageBracket?: string;
    bio?: string;
  }>();

  const displayName = Array.isArray(params.displayName)
    ? params.displayName[0]
    : params.displayName ?? '';

  const username = Array.isArray(params.username)
    ? params.username[0]
    : params.username ?? '';

  const country = Array.isArray(params.country)
    ? params.country[0]
    : params.country ?? '';

  const language = Array.isArray(params.language)
    ? params.language[0]
    : params.language ?? '';

  const gender = Array.isArray(params.gender)
    ? params.gender[0]
    : params.gender ?? '';

  const dateOfBirth = Array.isArray(params.dateOfBirth)
    ? params.dateOfBirth[0]
    : params.dateOfBirth ?? '';

  const ageBracket = Array.isArray(params.ageBracket)
    ? params.ageBracket[0]
    : params.ageBracket ?? '';

  const bio = Array.isArray(params.bio)
    ? params.bio[0]
    : params.bio ?? '';

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [error, setError] = useState('');

  const toggleInterest = (interest: string) => {
    setError('');

    setSelectedInterests((current) => {
      if (current.includes(interest)) {
        return current.filter((item) => item !== interest);
      }

      return [...current, interest];
    });
  };

  const handleContinue = () => {
    setError('');

    if (selectedInterests.length === 0) {
      setError('Choose at least one interest to continue.');
      return;
    }

    if (
      !displayName ||
      !username ||
      !country ||
      !language ||
      !gender ||
      !dateOfBirth ||
      !ageBracket
    ) {
      setError('Some profile information is missing. Please go back.');
      return;
    }

    router.push({
      pathname: '/(onboarding)/preferences',
      params: {
        displayName,
        username,
        country,
        language,
        gender,
        dateOfBirth,
        ageBracket,
        bio,
        interests: JSON.stringify(selectedInterests),
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

        <Text style={styles.step}>03 / 05</Text>

        <View style={styles.header}>
          <Text style={styles.title}>What are you into?</Text>

          <Text style={styles.subtitle}>
            Pick the things you enjoy. We'll use these to shape your DareMe
            experience.
          </Text>
        </View>

        <View style={styles.interestsGrid}>
          {INTERESTS.map((interest) => {
            const selected = selectedInterests.includes(interest.key);

            return (
              <Pressable
                key={interest.key}
                onPress={() => toggleInterest(interest.key)}
                style={[
                  styles.interestChip,
                  selected && styles.interestChipSelected,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={interest.label}
              >
                <Text
                  style={[
                    styles.interestText,
                    selected && styles.interestTextSelected,
                  ]}
                >
                  {selected ? '✓ ' : ''}
                  {interest.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.selectionCount}>
          {selectedInterests.length} selected
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.bottom}>
          <PrimaryButton
            label="CONTINUE"
            onPress={handleContinue}
          />

          <Pressable
            onPress={() => router.back()}
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
    width: '60%',
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

  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  interestChip: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  interestChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  interestText: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  interestTextSelected: {
    color: colors.background,
  },

  selectionCount: {
    marginTop: spacing.lg,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  errorBox: {
    marginTop: spacing.md,
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