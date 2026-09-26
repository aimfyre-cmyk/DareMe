import { router, useLocalSearchParams } from 'expo-router';
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

import { AvatarPicker } from '../../components/AvatarPicker';
import { PrimaryButton } from '../../components/PrimaryButton';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../../constants/theme';
import { saveCompleteOnboarding } from '../../features/onboarding/profileService';
import { getCurrentSession } from '../../lib/auth';

const INTEREST_LABELS: Record<string, string> = {
  funny: 'Funny',
  creative: 'Creative',
  adventure: 'Adventure',
  brain: 'Brain',
  fitness: 'Fitness',
  social: 'Social',
  photography: 'Photography',
  music: 'Music',
  content: 'Content',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const PROOF_LABELS: Record<string, string> = {
  photo: 'Photo',
  video: 'Video',
  text: 'Text',
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function parseArrayParam(value: string) {
  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export default function PreviewScreen() {
  const params = useLocalSearchParams<{
    displayName?: string;
    username?: string;
    country?: string;
    language?: string;
    ageBracket?: string;
    bio?: string;
    interests?: string;
    difficulty?: string;
    proofTypes?: string;
  }>();

  const displayName = getParamValue(params.displayName);
  const username = getParamValue(params.username);
  const country = getParamValue(params.country);
  const language = getParamValue(params.language);
  const ageBracket = getParamValue(params.ageBracket);
  const bio = getParamValue(params.bio);
  const difficulty = getParamValue(params.difficulty);

  const interests = parseArrayParam(
    getParamValue(params.interests),
  );

  const proofTypes = parseArrayParam(
    getParamValue(params.proofTypes),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const handleComplete = async () => {
    if (saving) {
      return;
    }

    setError('');

    if (
      !displayName ||
      !username ||
      !country ||
      !language ||
      !ageBracket
    ) {
      setError('Some profile information is missing.');
      return;
    }

    if (interests.length === 0) {
      setError('Please select at least one interest.');
      return;
    }

    if (!difficulty) {
      setError('Please select your dare difficulty preference.');
      return;
    }

    if (proofTypes.length === 0) {
      setError('Please select at least one proof type.');
      return;
    }

    setSaving(true);
console.log('[DareMe Avatar] URI before save:', avatarUri);
    try {
      const session = await getCurrentSession();

      if (!session?.user) {
        setError('Your session has expired. Please log in again.');
        return;
      }

      await saveCompleteOnboarding(
  session.user.id,
  {
    username,
    display_name: displayName,
    country,
    language,
    age_bracket: ageBracket,
    bio,
  },
  interests,
  {
    difficulty_comfort: difficulty,
    preferred_proof_types: proofTypes as (
      | 'photo'
      | 'video'
      | 'text'
    )[],
  },
  avatarUri,
);

      router.replace('/(tabs)');
    } catch (err) {
      console.error('Onboarding completion failed:', err);

      if (
        err instanceof Error &&
        err.message.toLowerCase().includes('username')
      ) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save your profile. Please try again.',
        );
      }
    } finally {
      setSaving(false);
    }
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

        <Text style={styles.step}>05 / 05</Text>

        <View style={styles.header}>
          <Text style={styles.title}>You're all set.</Text>

          <Text style={styles.subtitle}>
            Take a quick look at your profile before entering DareMe.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <AvatarPicker
            value={avatarUri}
            onChange={setAvatarUri}
          />

          <Text style={styles.displayName}>
            {displayName}
          </Text>

          <Text style={styles.username}>
            @{username}
          </Text>

          {bio ? (
            <Text style={styles.bio}>
              {bio}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            About you
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Country
            </Text>

            <Text style={styles.infoValue}>
              {country}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Language
            </Text>

            <Text style={styles.infoValue}>
              {language}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Age bracket
            </Text>

            <Text style={styles.infoValue}>
              {ageBracket}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Interests
          </Text>

          <View style={styles.chipContainer}>
            {interests.map((interest) => (
              <View
                key={interest}
                style={styles.chip}
              >
                <Text style={styles.chipText}>
                  {INTEREST_LABELS[interest] ?? interest}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Dare preferences
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Difficulty
            </Text>

            <Text style={styles.infoValue}>
              {DIFFICULTY_LABELS[difficulty] ?? difficulty}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Proof
            </Text>

            <Text style={styles.infoValue}>
              {proofTypes
                .map(
                  (type) => PROOF_LABELS[type] ?? type,
                )
                .join(', ')}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.bottom}>
          <PrimaryButton
            label={
              saving
                ? 'SETTING UP...'
                : "⚡ LET'S GO"
            }
            onPress={handleComplete}
            disabled={saving}
          />

          {saving ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={styles.loader}
            />
          ) : null}

          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={styles.backButton}
          >
            <Text style={styles.backText}>
              Back
            </Text>
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
    width: '100%',
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

  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },

  displayName: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xl,
  },

  username: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  bio: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  section: {
    marginTop: spacing.xl,
  },

  sectionTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
  },

  infoRow: {
    minHeight: 48,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  infoLabel: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  infoValue: {
    flex: 1,
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'right',
  },

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  chipText: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  errorBox: {
    marginTop: spacing.xl,
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