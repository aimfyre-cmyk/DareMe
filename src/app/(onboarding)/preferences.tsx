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

const DIFFICULTY_OPTIONS = [
  {
    key: 'easy',
    label: 'Easy',
    description: 'Light and comfortable',
  },
  {
    key: 'medium',
    label: 'Medium',
    description: 'A little outside your comfort zone',
  },
  {
    key: 'hard',
    label: 'Hard',
    description: 'Push yourself',
  },
] as const;

const PROOF_OPTIONS = [
  {
    key: 'photo',
    label: 'Photo',
    description: 'Show it with a photo',
  },
  {
    key: 'video',
    label: 'Video',
    description: 'Capture the moment',
  },
  {
    key: 'text',
    label: 'Text',
    description: 'Describe what happened',
  },
] as const;

export default function PreferencesScreen() {
  const params = useLocalSearchParams<{
    displayName?: string;
    username?: string;
    country?: string;
    language?: string;
    ageBracket?: string;
    bio?: string;
    interests?: string;
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

  const ageBracket = Array.isArray(params.ageBracket)
    ? params.ageBracket[0]
    : params.ageBracket ?? '';

  const bio = Array.isArray(params.bio)
    ? params.bio[0]
    : params.bio ?? '';

  const interests = Array.isArray(params.interests)
    ? params.interests[0]
    : params.interests ?? '[]';

  const [difficulty, setDifficulty] = useState('');
  const [proofTypes, setProofTypes] = useState<string[]>([]);
  const [error, setError] = useState('');

  const toggleProofType = (type: string) => {
    setError('');

    setProofTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  };

  const handleContinue = () => {
    setError('');

    if (!difficulty) {
      setError('Choose how comfortable you are with dare difficulty.');
      return;
    }

    if (proofTypes.length === 0) {
      setError('Choose at least one preferred proof type.');
      return;
    }

    if (!displayName || !username || !country || !language || !ageBracket) {
      setError('Some profile information is missing. Please go back.');
      return;
    }

    router.push({
      pathname: '/(onboarding)/preview',
      params: {
        displayName,
        username,
        country,
        language,
        ageBracket,
        bio,
        interests,
        difficulty,
        proofTypes: JSON.stringify(proofTypes),
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

        <Text style={styles.step}>04 / 05</Text>

        <View style={styles.header}>
          <Text style={styles.title}>Set your dare comfort zone.</Text>

          <Text style={styles.subtitle}>
            Choose what feels right for you. You can change these preferences
            later.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Difficulty comfort</Text>

        <View style={styles.options}>
          {DIFFICULTY_OPTIONS.map((option) => {
            const selected = difficulty === option.key;

            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  setError('');
                  setDifficulty(option.key);
                }}
                style={[
                  styles.option,
                  selected && styles.optionSelected,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabel,
                      selected && styles.optionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>

                  <Text
                    style={[
                      styles.optionDescription,
                      selected && styles.optionDescriptionSelected,
                    ]}
                  >
                    {option.description}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radio,
                    selected && styles.radioSelected,
                  ]}
                >
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Preferred proof types</Text>

        <View style={styles.proofGrid}>
          {PROOF_OPTIONS.map((option) => {
            const selected = proofTypes.includes(option.key);

            return (
              <Pressable
                key={option.key}
                onPress={() => toggleProofType(option.key)}
                style={[
                  styles.proofOption,
                  selected && styles.proofOptionSelected,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text
                  style={[
                    styles.proofLabel,
                    selected && styles.proofLabelSelected,
                  ]}
                >
                  {selected ? '✓ ' : ''}
                  {option.label}
                </Text>

                <Text
                  style={[
                    styles.proofDescription,
                    selected && styles.proofDescriptionSelected,
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
    width: '80%',
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

  sectionTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  options: {
    gap: spacing.sm,
  },

  option: {
    minHeight: 76,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },

  optionContent: {
    flex: 1,
    paddingRight: spacing.md,
  },

  optionLabel: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
  },

  optionLabelSelected: {
    color: colors.accent,
  },

  optionDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  optionDescriptionSelected: {
    color: colors.primaryText,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: colors.accent,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },

  proofGrid: {
    gap: spacing.sm,
  },

  proofOption: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  proofOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },

  proofLabel: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
  },

  proofLabelSelected: {
    color: colors.accent,
  },

  proofDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  proofDescriptionSelected: {
    color: colors.primaryText,
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