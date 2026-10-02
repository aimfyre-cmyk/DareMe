import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';


import { AppHeader } from '../components/AppHeader';
import { Screen } from '../components/Screen';
import { colors, fontSize, spacing } from '../constants/theme';
import { supabase } from '../lib/supabase';

type Period = 'weekly' | 'monthly';

type LeaderboardUser = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  completed_dares: number;
};

export default function LeaderboardScreen() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc(
        'get_leaderboard',
        {
          p_period: period,
        },
      );

      if (rpcError) throw rpcError;

      setUsers((data ?? []) as LeaderboardUser[]);
    } catch (err) {
      console.error('[Leaderboard] Failed to load:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load leaderboard.',
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [loadLeaderboard]),
  );

  return (
    <Screen>
      <AppHeader
        title="Leaderboard"
        leftSlot={
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={10}
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
        }
      />

      <Text style={styles.subtitle}>
        Compete with DareMe players and climb the rankings.
      </Text>

      <View style={styles.periodTabs}>
        <Pressable
          onPress={() => setPeriod('weekly')}
          style={[
            styles.periodTab,
            period === 'weekly' && styles.activePeriodTab,
          ]}
        >
          <Text
            style={[
              styles.periodText,
              period === 'weekly' && styles.activePeriodText,
            ]}
          >
            Weekly
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setPeriod('monthly')}
          style={[
            styles.periodTab,
            period === 'monthly' && styles.activePeriodTab,
          ]}
        >
          <Text
            style={[
              styles.periodText,
              period === 'monthly' && styles.activePeriodText,
            ]}
          >
            Monthly
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.stateText}>
            Loading leaderboard...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable
            onPress={loadLeaderboard}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            No rankings yet
          </Text>

          <Text style={styles.emptyText}>
            Complete a Dare during this period to appear on the
            leaderboard.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {users.map((user, index) => {
            const rank = index + 1;

            return (
              <Pressable
                key={user.user_id}
                onPress={() =>
                  router.push({
                    pathname: '/public-profile',
                    params: { userId: user.user_id },
                  })
                }
                style={[
                  styles.userCard,
                  rank <= 3 && styles.topUserCard,
                ]}
              >
                <View style={styles.rankBox}>
                  <Text style={styles.rankText}>
                    {rank}
                  </Text>
                </View>

                {user.avatar_url ? (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>
                      {user.display_name
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.userInfo}>
                  <Text
                    style={styles.displayName}
                    numberOfLines={1}
                  >
                    {user.display_name}
                  </Text>

                  {user.username ? (
                    <Text
                      style={styles.username}
                      numberOfLines={1}
                    >
                      @{user.username}
                    </Text>
                  ) : null}

                  <Text style={styles.completedText}>
                    {user.completed_dares} completed{' '}
                    {user.completed_dares === 1
                      ? 'Dare'
                      : 'Dares'}
                  </Text>
                </View>

                <View style={styles.xpBox}>
                  <Text style={styles.xpValue}>
                    {user.xp}
                  </Text>
                  <Text style={styles.xpLabel}>XP</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backArrow: {
    color: colors.primaryText,
    fontSize: 32,
    lineHeight: 34,
  },

  subtitle: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },

  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 4,
    marginBottom: spacing.lg,
  },

  periodTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: 10,
  },

  activePeriodTab: {
    backgroundColor: colors.accent,
  },

  periodText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  activePeriodText: {
    color: colors.background,
  },

  list: {
    gap: spacing.sm,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },

  topUserCard: {
    borderColor: colors.accent,
  },

  rankBox: {
    width: 32,
    alignItems: 'center',
  },

  rankText: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },

  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },

  avatarLetter: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },

  displayName: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  username: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  completedText: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  xpBox: {
    minWidth: 54,
    alignItems: 'flex-end',
  },

  xpValue: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },

  xpLabel: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: 1,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
  },

  retryText: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  emptyTitle: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
});