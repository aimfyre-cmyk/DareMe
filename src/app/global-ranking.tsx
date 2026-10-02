import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import {
    colors,
    fontSize,
    spacing,
} from '../constants/theme';
import { supabase } from '../lib/supabase';

type RankingUser = {
  rank: number;
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  completed_dares: number;
  is_dare_master: boolean;
};

export default function GlobalRankingScreen() {
  const [users, setUsers] = useState<RankingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRanking = useCallback(async () => {
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

      setCurrentUserId(user.id);

      const {
        data,
        error: rankingError,
      } = await supabase.rpc('get_global_ranking_all_time');

      if (rankingError) {
        throw rankingError;
      }

      setUsers(
        ((data ?? []) as Array<{
          rank: number | string;
          user_id: string;
          display_name: string;
          username: string | null;
          avatar_url: string | null;
          xp: number | string;
          completed_dares: number | string;
        }>).map((item) => {
          const rank = Number(item.rank);

          return {
            rank,
            user_id: item.user_id,
            display_name: item.display_name,
            username: item.username,
            avatar_url: item.avatar_url,
            xp: Number(item.xp),
            completed_dares: Number(item.completed_dares),
            is_dare_master: rank === 1,
          };
        }),
      );
    } catch (err) {
      console.error('[Global Ranking] Failed to load:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load Global Ranking.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const currentUser = users.find(
    (user) => user.user_id === currentUserId,
  );

  return (
    <Screen>
      <AppHeader
        title="Global Ranking"
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

      <View style={styles.intro}>
        <Text style={styles.title}>
          Worldwide DareMe Ranking
        </Text>

        <Text style={styles.subtitle}>
          Lifetime XP decides the global rank. Rank #1 holds the Dare Master title.
        </Text>
      </View>

      {currentUser ? (
        <View style={styles.myRankCard}>
          <View>
            <Text style={styles.myRankLabel}>
              YOUR GLOBAL RANK
            </Text>

            <Text style={styles.myRankNumber}>
              #{currentUser.rank}
            </Text>

            {currentUser.is_dare_master ? (
              <View style={styles.myMasterBadge}>
                <Text style={styles.myMasterBadgeText}>
                  👑 Dare Master
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.myRankRight}>
            <Text style={styles.myRankXp}>
              {currentUser.xp.toLocaleString()} XP
            </Text>

            <Text style={styles.myRankLevel}>
              {currentUser.completed_dares.toLocaleString()} completed
              {' '}
              {currentUser.completed_dares === 1 ? 'Dare' : 'Dares'}
            </Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />

          <Text style={styles.stateText}>
            Loading Global Ranking...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadRanking}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>
            No ranking data yet
          </Text>

          <Text style={styles.stateText}>
            Complete dares and earn XP to appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {users.map((item) => {
            const displayName =
              item.display_name ||
              item.username ||
              'DareMe User';

            const username = item.username
              ? `@${item.username}`
              : '';

            const isCurrentUser =
              item.user_id === currentUserId;

            return (
              <Pressable
                key={item.user_id}
                onPress={() =>
                  router.push({
                    pathname: '/public-profile',
                    params: {
                      userId: item.user_id,
                    },
                  })
                }
                style={[
                  styles.userCard,
                  isCurrentUser && styles.currentUserCard,
                  item.rank === 1 && styles.firstUserCard,
                ]}
              >
                <View style={styles.rankColumn}>
                  <Text
                    style={[
                      styles.rank,
                      item.rank === 1 && styles.firstRank,
                    ]}
                  >
                    #{item.rank}
                  </Text>
                </View>

                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>
                      {displayName
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text
                      style={styles.displayName}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>

                    {item.is_dare_master ? (
                      <View style={styles.masterBadge}>
                        <Text style={styles.masterBadgeText}>
                          👑 Dare Master
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {username ? (
                    <Text
                      style={styles.username}
                      numberOfLines={1}
                    >
                      {username}
                    </Text>
                  ) : null}

                  <Text style={styles.completedText}>
                    {item.completed_dares.toLocaleString()} completed
                    {' '}
                    {item.completed_dares === 1 ? 'Dare' : 'Dares'}
                  </Text>
                </View>

                <View style={styles.xpColumn}>
                  <Text style={styles.xpValue}>
                    {item.xp.toLocaleString()}
                  </Text>

                  <Text style={styles.xpLabel}>
                    XP
                  </Text>
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

  intro: {
    marginBottom: spacing.lg,
  },

  title: {
    color: colors.primaryText,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },

  subtitle: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 18,
  },

  myRankLabel: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  myRankNumber: {
    color: colors.primaryText,
    fontSize: fontSize.xl,
    fontWeight: '900',
    marginTop: 2,
  },

  myRankRight: {
    alignItems: 'flex-end',
  },

  myRankXp: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },

  myRankLevel: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: 2,
    textAlign: 'right',
  },

  myMasterBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },

  myMasterBadgeText: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: '900',
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

  currentUserCard: {
    borderColor: colors.accent,
  },

  firstUserCard: {
    borderColor: colors.accent,
  },

  rankColumn: {
    width: 42,
    alignItems: 'center',
  },

  rank: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },

  firstRank: {
    color: colors.accent,
    fontSize: fontSize.md,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },

  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },

  avatarLetter: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },

  userInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.md,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },

  displayName: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '800',
    maxWidth: 180,
  },

  masterBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },

  masterBadgeText: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: '900',
  },

  username: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  completedText: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: 3,
  },

  xpColumn: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },

  xpValue: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  xpLabel: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
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
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  emptyTitle: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '800',
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
});
