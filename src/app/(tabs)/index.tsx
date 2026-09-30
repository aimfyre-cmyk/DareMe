import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { DareCard, MockDare } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';

import { colors, fontSize, spacing } from '../../constants/theme';
import { transitionDare } from '../../lib/dareTransitions';
import { supabase } from '../../lib/supabase';

type DareRow = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  xp_value: number;
  proof_type: string;
  status: string;
  visibility: string;
  created_at: string;
};

function formatDifficulty(value: string): MockDare['difficulty'] {
  const normalized = value.toLowerCase();

  if (normalized === 'hard') {
    return 'Hard';
  }

  if (normalized === 'medium') {
    return 'Medium';
  }

  return 'Easy';
}

function formatProofType(value: string): MockDare['proofType'] {
  const normalized = value.toLowerCase();

  if (normalized === 'photo') {
    return 'Photo';
  }

  if (normalized === 'video') {
    return 'Video';
  }

  return 'Text';
}

export default function HomeScreen() {
  const [dares, setDares] = useState<MockDare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takingDare, setTakingDare] = useState<string | null>(null);
  const [inProgressDares, setInProgressDares] = useState<
  Set<string>
>(new Set());

  const loadDares = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('dares')
        .select(
          'id, title, category, difficulty, xp_value, proof_type, status, visibility, created_at',
        )
        .eq('status', 'active')
        .eq('visibility', 'anyone')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const mappedDares: MockDare[] = ((data ?? []) as DareRow[]).map(
        (dare) => ({
          id: dare.id,
          title: dare.title,
          category: dare.category,
          difficulty: formatDifficulty(dare.difficulty),
          xpValue: dare.xp_value,
          proofType: formatProofType(dare.proof_type),
        }),
      );

      setDares(mappedDares);
    } catch (err) {
      console.error('[Home] Failed to load dares:', err);
      setError('Unable to load dares right now.');
      setDares([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  loadDares();
}, [loadDares]);
useEffect(() => {
  loadDares();
}, [loadDares]);

useEffect(() => {
  const loadInProgressDares = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setInProgressDares(new Set());
        return;
      }

      const { data, error } = await supabase
        .from('dare_participants')
        .select('dare_id')
        .eq('user_id', user.id)
        .eq('state', 'IN_PROGRESS');

      if (error) {
        throw error;
      }

      setInProgressDares(
        new Set(
          (data ?? []).map(
            (participant) => participant.dare_id,
          ),
        ),
      );
    } catch (error) {
      console.error(
        '[Home] Failed to load in-progress dares:',
        error,
      );

      setInProgressDares(new Set());
    }
  };

  loadInProgressDares();
}, []);

  const hasDares = dares.length > 0;
  const handleTakeDare = async (dareId: string) => {
  console.log('[Home] TAKE THE DARE:', dareId);
  setTakingDare(dareId);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Please log in before taking a dare.');
    }

    const { data: existingParticipant, error: existingError } =
      await supabase
        .from('dare_participants')
        .select('id,state')
        .eq('dare_id', dareId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }
    console.log(
  '[Home] EXISTING PARTICIPANT:',
  existingParticipant,
);

    let participantId: string;

    if (existingParticipant) {
      participantId = existingParticipant.id;

      if (existingParticipant.state === 'IN_PROGRESS') {
        return;
      }

      if (
        existingParticipant.state !== 'SENT' &&
        existingParticipant.state !== 'ACCEPTED'
      ) {
        throw new Error(
          `This dare is currently ${existingParticipant.state}.`,
        );
      }
    } else {
      const { data: participant, error: participantError } =
        await supabase
          .from('dare_participants')
          .insert({
            dare_id: dareId,
            user_id: user.id,
            state: 'SENT',
          })
          .select('id')
          .single();

      if (participantError || !participant) {
        throw (
          participantError ??
          new Error('Could not create dare participant.')
        );
      }

      participantId = participant.id;
    }

    if (existingParticipant?.state !== 'ACCEPTED') {
      const acceptResult = await transitionDare(
        participantId,
        'accept',
      );

      if (acceptResult.state !== 'ACCEPTED') {
        throw new Error(
          `Unexpected state: ${acceptResult.state}`,
        );
      }
    }

    const startResult = await transitionDare(
      participantId,
      'start',
    );

    if (startResult.state !== 'IN_PROGRESS') {
      throw new Error(
        `Unexpected state: ${startResult.state}`,
      );
    }

    console.log('[Home] DARE STARTED:', participantId);
    setInProgressDares((current) => {
  const next = new Set(current);
  next.add(dareId);
  return next;
});
  } catch  (error) {
    
    console.error('[Home] Take dare error:', error);
  }
  finally {
  setTakingDare(null);
}
};

  return (
    <Screen>
      <AppHeader
        title="DareMe"
        showAvatar
        onAvatarPress={() => router.push('./me')}
        rightSlot={
          <View style={styles.headerActions}>
            {/* Search */}
            <Pressable
              onPress={() => router.push('/search')}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Search"
              hitSlop={10}
            >
              <Text style={styles.searchIcon}>⌕</Text>
            </Pressable>

            {/* Notifications */}
            <NotificationBell />
          </View>
        }
      />

      <SectionHeader title="For You" />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />

          <Text style={styles.stateText}>
            Loading dares...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadDares}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : hasDares ? (
        <View style={styles.feed}>
          <View style={styles.featuredHeader}>
            <Text style={styles.featuredLabel}>
              🔥 TODAY'S DARES
            </Text>

            <Text style={styles.featuredSubtitle}>
              Pick a dare. Take the challenge.
            </Text>
          </View>

          {dares.map((dare) => (
            <DareCard
              key={dare.id}
              dare={dare}
              loading={takingDare === dare.id}
              inProgress={inProgressDares.has(dare.id)}
              onPress={() => {
                router.push({
                  pathname: '/dare-detail',
                  params: {
                    id: dare.id,
                  },
                });
              }}
              onPrimaryAction={() => {
  handleTakeDare(dare.id);
}}
            />
          ))}

          <View style={styles.discoverSection}>
            <Text style={styles.discoverTitle}>
              Want to explore more?
            </Text>

            <Pressable
              onPress={() =>
                router.push('/(tabs)/discover')
              }
              style={styles.discoverButton}
              accessibilityRole="button"
              accessibilityLabel="Explore more dares"
            >
              <Text style={styles.discoverButtonText}>
                Explore Discover
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <EmptyState
          title="No new dares yet"
          description="Check back soon for fresh challenges, or explore Discover."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchIcon: {
    color: colors.primaryText,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
  },

  feed: {
    paddingBottom: spacing.xl,
  },

  featuredHeader: {
    marginBottom: spacing.md,
  },

  featuredLabel: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  featuredSubtitle: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  stateText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  retryText: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  discoverSection: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  discoverTitle: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  discoverButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  discoverButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});