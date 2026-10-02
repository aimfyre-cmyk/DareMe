import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { DareCard, MockDare } from '../components/DareCard';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';

import {
    colors,
    fontSize,
    spacing,
} from '../constants/theme';
import { supabase } from '../lib/supabase';

type SavedDareRow = {
  dare_id: string;
  created_at: string;
};

type DareRow = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  xp_value: number;
  proof_type: string;
};

function formatDifficulty(
  value: string,
): MockDare['difficulty'] {
  const normalized = value.toLowerCase();

  if (normalized === 'hard') {
    return 'Hard';
  }

  if (normalized === 'medium') {
    return 'Medium';
  }

  return 'Easy';
}

function formatProofType(
  value: string,
): MockDare['proofType'] {
  const normalized = value.toLowerCase();

  if (normalized === 'photo') {
    return 'Photo';
  }

  if (normalized === 'video') {
    return 'Video';
  }

  return 'Text';
}

export default function SavedScreen() {
  const [dares, setDares] = useState<MockDare[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadSavedDares = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace('/(auth)/login' as any);
        return;
      }

      const {
        data: savedRows,
        error: savedError,
      } = await supabase
        .from('saved_dares')
        .select('dare_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', {
          ascending: false,
        });

      if (savedError) {
        throw savedError;
      }

      const saved = (savedRows ?? []) as SavedDareRow[];

      if (saved.length === 0) {
        setDares([]);
        return;
      }

      const dareIds = saved.map(
        (item) => item.dare_id,
      );

      const {
        data: dareRows,
        error: dareError,
      } = await supabase
        .from('dares')
        .select(
          'id, title, category, difficulty, xp_value, proof_type',
        )
        .in('id', dareIds);

      if (dareError) {
        throw dareError;
      }

      const dareMap = new Map(
        ((dareRows ?? []) as DareRow[]).map(
          (dare) => [dare.id, dare],
        ),
      );

      const mappedDares: MockDare[] = saved
        .map((savedItem) => {
          const dare = dareMap.get(
            savedItem.dare_id,
          );

          if (!dare) {
            return null;
          }

          return {
            id: dare.id,
            title: dare.title,
            category: dare.category,
            difficulty: formatDifficulty(
              dare.difficulty,
            ),
            xpValue: dare.xp_value,
            proofType: formatProofType(
              dare.proof_type,
            ),
          };
        })
        .filter(
          (dare): dare is MockDare => dare !== null,
        );

      setDares(mappedDares);
    } catch (err) {
      console.error(
        '[DareMe Saved] Failed to load saved dares:',
        err,
      );

      setError(
        'Unable to load saved dares right now.',
      );
      setDares([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedDares();
    }, [loadSavedDares]),
  );

  const handleRemove = async (dareId: string) => {
    if (removingId) {
      return;
    }

    try {
      setRemovingId(dareId);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        return;
      }

      const { error: deleteError } = await supabase
        .from('saved_dares')
        .delete()
        .eq('dare_id', dareId)
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      setDares((current) =>
        current.filter(
          (dare) => dare.id !== dareId,
        ),
      );
    } catch (err) {
      console.error(
        '[DareMe Saved] Failed to remove saved dare:',
        err,
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Saved"
        leftSlot={
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={10}
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
        }
      />

      <View style={styles.heading}>
        <Text style={styles.headingTitle}>
          Saved Dares
        </Text>

        <Text style={styles.headingSubtitle}>
          Your saved challenges in one place.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />

          <Text style={styles.stateText}>
            Loading saved dares...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadSavedDares}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : dares.length === 0 ? (
        <EmptyState
          title="No saved dares yet"
          description="Save a dare when you want to come back to it later."
        />
      ) : (
        <View style={styles.list}>
          {dares.map((dare) => (
            <View key={dare.id}>
              <DareCard
                dare={dare}
                onPress={() =>
                  router.push({
                    pathname: '/dare-detail',
                    params: { id: dare.id },
                  })
                }
              />

              <Pressable
                onPress={() =>
                  handleRemove(dare.id)
                }
                disabled={removingId === dare.id}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>
                  {removingId === dare.id
                    ? 'Removing...'
                    : 'Remove from Saved'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backArrow: {
    color: colors.primaryText,
    fontSize: 34,
    lineHeight: 36,
  },

  heading: {
    marginBottom: spacing.lg,
  },

  headingTitle: {
    color: colors.primaryText,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },

  headingSubtitle: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  list: {
    paddingBottom: spacing.xl,
  },

  removeButton: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },

  removeText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    fontWeight: '600',
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
});