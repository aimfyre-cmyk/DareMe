import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Chip } from '../../components/Chip';
import { DareCard, MockDare } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { spacing } from '../../constants/theme';
import { transitionDare } from '../../lib/dareTransitions';
import { supabase } from '../../lib/supabase';

type RealDare = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  xp_value: number;
  proof_type: string;
  visibility: string;
  status: string;
};

const categories = [
  'Funny',
  'Creative',
  'Adventure',
  'Brain',
  'Fitness',
  'Social',
  'Photography',
  'Music',
  'Content',
] as const;

function mapDare(dare: RealDare): MockDare {
  const difficulty =
    dare.difficulty.toLowerCase() === 'hard'
      ? 'Hard'
      : dare.difficulty.toLowerCase() === 'medium'
        ? 'Medium'
        : 'Easy';

  const proofType =
    dare.proof_type.toLowerCase() === 'video'
      ? 'Video'
      : dare.proof_type.toLowerCase() === 'photo'
        ? 'Photo'
        : 'Text';

  return {
    id: dare.id,
    title: dare.title,
    category: dare.category,
    difficulty,
    xpValue: dare.xp_value,
    proofType,
  };
}

export default function DiscoverScreen() {
  const [dares, setDares] = useState<RealDare[]>([]);
  const [loading, setLoading] = useState(true);
  const [takingDare, setTakingDare] = useState<string | null>(null);

  const loadDares = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('dares')
      .select(
        'id,title,description,category,difficulty,xp_value,proof_type,visibility,status',
      )
      .eq('status', 'active')
      .eq('visibility', 'anyone')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Discover dares error:', error);
      Alert.alert('Error', 'Could not load dares right now.');
      setDares([]);
    } else {
      setDares((data ?? []) as RealDare[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDares();
  }, [loadDares]);

  const handleTakeDare = async (dareId: string) => {
    Alert.alert('TEST', 'TAKE THE DARE button clicked');
    if (takingDare) return;

    setTakingDare(dareId);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in before taking a dare.');
      }

      // Check whether this user already has a participant row.
      const { data: existingParticipant, error: existingError } = await supabase
        .from('dare_participants')
        .select('id,state')
        .eq('dare_id', dareId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      let participantId: string;

      if (existingParticipant) {
        participantId = existingParticipant.id;

        if (existingParticipant.state === 'ACCEPTED') {
          Alert.alert('Already accepted', 'You have already accepted this dare.');
          return;
        }

        if (existingParticipant.state !== 'SENT') {
          Alert.alert(
            'Dare unavailable',
            `This dare is currently ${existingParticipant.state}.`,
          );
          return;
        }
      } else {
        // RLS requires:
        // user_id = auth.uid()
        // state = SENT
        const { data: participant, error: participantError } = await supabase
          .from('dare_participants')
          .insert({
            dare_id: dareId,
            user_id: user.id,
            state: 'SENT',
          })
          .select('id')
          .single();

        if (participantError || !participant) {
          throw participantError ?? new Error('Could not create participant.');
        }

        participantId = participant.id;
      }

      // Backend owns the actual state transition.
      const result = await transitionDare(participantId, 'accept');

      if (result.state !== 'ACCEPTED') {
        throw new Error(`Unexpected dare state: ${result.state}`);
      }

      Alert.alert(
        '⚡ Dare Accepted!',
        'The dare is now active for you.',
      );
    } catch (error) {
      console.error('Take dare error:', error);

      Alert.alert(
        'Could not take dare',
        error instanceof Error
          ? error.message
          : 'Something went wrong while taking the dare.',
      );
    } finally {
      setTakingDare(null);
    }
  };

  return (
    <Screen>
      <AppHeader title="Discover" />

      <Input
        placeholder="Search dares, people, categories"
        editable={false}
      />

      <SectionHeader title="Categories" />

      <View style={styles.chipWrap}>
        {categories.map((category) => (
          <Chip key={category} label={category} />
        ))}
      </View>

      <SectionHeader title="Featured Dares" />

      {loading ? (
        <Text style={styles.statusText}>Loading dares...</Text>
      ) : dares.length > 0 ? (
        <View>
          {dares.map((dare) => (
            <View key={dare.id} style={styles.dareWrapper}>
              <DareCard
                dare={mapDare(dare)}
                onPrimaryAction={() => handleTakeDare(dare.id)}
              />

              {takingDare === dare.id && (
                <Text style={styles.takingText}>
                  Accepting dare...
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No dares available"
          description="New challenges will appear here."
        />
      )}

      <SectionHeader title="People to Follow" />

      <EmptyState
        title="Discover people soon"
        description="Recommendations arrive once the community grows."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  dareWrapper: {
    marginBottom: spacing.md,
  },

  statusText: {
    marginBottom: spacing.lg,
    opacity: 0.7,
  },

  takingText: {
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
    opacity: 0.7,
  },
});