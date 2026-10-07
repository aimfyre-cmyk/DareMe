import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';

import {
  colors,
  fontFamily,
  fontSize,
  spacing,
} from '../../constants/theme';

import { discoverCategories } from '../../data/mockDares';
import { supabase } from '../../lib/supabase';

const difficulties = ['Easy', 'Medium', 'Hard'] as const;

const visibilities = [
  'Followers',
  'Global',
] as const;

const proofTypes = [
  'Text',
  'Photo / Post',
  'Video',
] as const;

const participationDurations = [
  {
    label: '1h',
    minutes: 60,
  },
  {
    label: '6h',
    minutes: 360,
  },
  {
    label: '12h',
    minutes: 720,
  },
  {
    label: '24h',
    minutes: 1440,
  },
  {
    label: '3d',
    minutes: 4320,
  },
  {
    label: '7d',
    minutes: 10080,
  },
] as const;

const votingDurations = [
  {
    label: '1h',
    minutes: 60,
  },
  {
    label: '6h',
    minutes: 360,
  },
  {
    label: '12h',
    minutes: 720,
  },
  {
    label: '24h',
    minutes: 1440,
  },
  {
    label: '3d',
    minutes: 4320,
  },
  {
    label: '7d',
    minutes: 10080,
  },
] as const;

export default function CreateScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const [difficulty, setDifficulty] = useState<
    (typeof difficulties)[number] | null
  >(null);

  const [visibility, setVisibility] = useState<
    (typeof visibilities)[number] | null
  >(null);

  const [proofType, setProofType] = useState<
    (typeof proofTypes)[number] | null
  >(null);

  const [participationDuration, setParticipationDuration] = useState<
    (typeof participationDurations)[number] | null
  >(null);

  const [votingEnabled, setVotingEnabled] = useState(false);

  const [votingDuration, setVotingDuration] = useState<
    (typeof votingDurations)[number] | null
  >(null);

  const [publishing, setPublishing] = useState(false);

  const handlePublishDare = async () => {
    if (publishing) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      Alert.alert(
        'Dare required',
        'Please describe your dare first.',
      );
      return;
    }

    if (!category) {
      Alert.alert(
        'Category required',
        'Please select a category.',
      );
      return;
    }

    if (!difficulty) {
      Alert.alert(
        'Difficulty required',
        'Please select a difficulty.',
      );
      return;
    }

    if (!visibility) {
      Alert.alert(
        'Audience required',
        'Please select who can participate in this dare.',
      );
      return;
    }

    if (!proofType) {
      Alert.alert(
        'Proof required',
        'Please select how the dare must be proved.',
      );
      return;
    }

    if (!participationDuration) {
      Alert.alert(
        'Participation duration required',
        'Please select how long people can participate in this dare.',
      );
      return;
    }

    if (votingEnabled && !votingDuration) {
      Alert.alert(
        'Voting duration required',
        'Please select how long voting should remain open.',
      );
      return;
    }

    setPublishing(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          'Please log in before publishing a dare.',
        );
      }

      const dbVisibility =
        visibility === 'Global'
          ? 'anyone'
          : 'followers';

      const dbDifficulty = difficulty.toLowerCase();

      const dbProofType =
        proofType === 'Text'
          ? 'text'
          : proofType === 'Photo / Post'
            ? 'photo'
            : 'video';

      const participationMinutes =
        participationDuration.minutes;

      const votingMinutes = votingDuration?.minutes ?? null;

      const now = new Date();

      const participationEndsAt = new Date(
        now.getTime() +
          participationMinutes * 60 * 1000,
      );

      const votingStartsAt = votingEnabled
        ? participationEndsAt
        : null;

      const votingEndsAt =
        votingEnabled && votingMinutes
          ? new Date(
              participationEndsAt.getTime() +
                votingMinutes * 60 * 1000,
            )
          : null;

      const { data, error } = await supabase
        .from('dares')
        .insert({
          creator_id: user.id,
          type: 'p2p',
          title: trimmedTitle,
          description: trimmedTitle,
          category,
          difficulty: dbDifficulty,
          time_limit_minutes: 60,
          proof_type: dbProofType,
          visibility: dbVisibility,
          xp_value: 20,
          status: 'active',

          participation_duration_minutes:
            participationMinutes,

          participation_ends_at:
            participationEndsAt.toISOString(),

          voting_enabled: votingEnabled,

          voting_duration_minutes:
            votingEnabled
              ? votingMinutes
              : null,

          voting_starts_at:
            votingStartsAt?.toISOString() ?? null,

          voting_ends_at:
            votingEndsAt?.toISOString() ?? null,
        })
        .select('id')
        .single();

      if (error || !data) {
        throw (
          error ??
          new Error('Could not publish the dare.')
        );
      }

      console.log(
        '[CreateDare] Published:',
        data.id,
      );

      router.replace('/');
    } catch (error) {
      console.error(
        '[CreateDare] Publish error:',
        error,
      );

      Alert.alert(
        'Could not publish dare',
        error instanceof Error
          ? error.message
          : 'Something went wrong while publishing.',
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen>
      <Text
        style={styles.heading}
        accessibilityRole="header"
      >
        Create a Dare
      </Text>

      <Text style={styles.subheading}>
        Create a challenge and publish it to DareShot.
      </Text>

      <SectionHeader title="What's the dare?" />

      <Input
        placeholder="Describe the dare..."
        multiline
        numberOfLines={4}
        value={title}
        onChangeText={setTitle}
      />

      <SectionHeader title="Category" />

      <View style={styles.chipWrap}>
        {discoverCategories.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </View>

      <SectionHeader title="Difficulty" />

      <View style={styles.chipWrap}>
        {difficulties.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={difficulty === item}
            onPress={() => setDifficulty(item)}
          />
        ))}
      </View>

      <SectionHeader title="Proof Required" />

      <Text style={styles.helperText}>
        Choose how the person completing this dare must prove it.
      </Text>

      <View style={styles.chipWrap}>
        {proofTypes.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={proofType === item}
            onPress={() => setProofType(item)}
          />
        ))}
      </View>

      <SectionHeader title="Audience" />

      <Text style={styles.helperText}>
        Choose who can participate in this dare.
      </Text>

      <View style={styles.chipWrap}>
        {visibilities.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={visibility === item}
            onPress={() => setVisibility(item)}
          />
        ))}
      </View>

      <SectionHeader title="Participation Duration" />

      <Text style={styles.helperText}>
        New participants can join only while this period is open.
      </Text>

      <View style={styles.chipWrap}>
        {participationDurations.map((item) => (
          <SelectableChip
            key={item.label}
            label={item.label}
            selected={
              participationDuration?.minutes ===
              item.minutes
            }
            onPress={() =>
              setParticipationDuration(item)
            }
          />
        ))}
      </View>

      <SectionHeader title="Voting" />

      <Text style={styles.helperText}>
        Allow the community to vote on posted dare results.
      </Text>

      <View style={styles.chipWrap}>
        <SelectableChip
          label="OFF"
          selected={!votingEnabled}
          onPress={() => {
            setVotingEnabled(false);
            setVotingDuration(null);
          }}
        />

        <SelectableChip
          label="ON"
          selected={votingEnabled}
          onPress={() => setVotingEnabled(true)}
        />
      </View>

      {votingEnabled ? (
        <>
          <SectionHeader title="Voting Duration" />

          <Text style={styles.helperText}>
            Voting starts when the participation period ends.
          </Text>

          <View style={styles.chipWrap}>
            {votingDurations.map((item) => (
              <SelectableChip
                key={item.label}
                label={item.label}
                selected={
                  votingDuration?.minutes ===
                  item.minutes
                }
                onPress={() =>
                  setVotingDuration(item)
                }
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.ctaWrap}>
        <PrimaryButton
          label={
            publishing
              ? 'Publishing...'
              : 'Publish Dare'
          }
          onPress={handlePublishDare}
          disabled={publishing}
        />

        {publishing ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />
        ) : (
          <Text style={styles.note}>
            Your dare will appear on Home.
          </Text>
        )}
      </View>
    </Screen>
  );
}

function SelectableChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Chip
        label={label}
        variant={
          selected ? 'accent' : 'neutral'
        }
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xxl,
    marginTop: spacing.lg,
  },

  subheading: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },

  helperText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  ctaWrap: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },

  note: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});