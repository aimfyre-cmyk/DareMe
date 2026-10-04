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
import { colors, fontSize, spacing } from '../constants/theme';
import { supabase } from '../lib/supabase';

type CircleTab = 'following' | 'followers';

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  xp_total: number | null;
  level: number | null;
};

type CircleUser = ProfileRow & {
  isFollowing: boolean;
};

export default function DareCircleScreen() {
  const [activeTab, setActiveTab] =
    useState<CircleTab>('following');

  const [users, setUsers] = useState<CircleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] =
    useState<string | null>(null);

  const loadCircle = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/(auth)/login' as any);
        return;
      }

      if (activeTab === 'following') {
        const { data: followRows, error: followError } =
          await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id)
            .order('created_at', {
              ascending: false,
            });

        if (followError) {
          throw followError;
        }

        const ids =
          (followRows ?? []).map(
            (row) => row.following_id,
          );

        if (ids.length === 0) {
          setUsers([]);
          return;
        }

        const { data: profiles, error: profilesError } =
          await supabase
            .from('profiles')
            .select(
              'id, username, display_name, avatar_url, xp_total, level',
            )
            .in('id', ids);

        if (profilesError) {
          throw profilesError;
        }

        const profileMap = new Map(
          ((profiles ?? []) as ProfileRow[]).map(
            (profile) => [profile.id, profile],
          ),
        );

        setUsers(
          ids
            .map((id) => profileMap.get(id))
            .filter(
              (profile): profile is ProfileRow =>
                Boolean(profile),
            )
            .map((profile) => ({
              ...profile,
              isFollowing: true,
            })),
        );

        return;
      }

      const { data: followRows, error: followError } =
        await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)
          .order('created_at', {
            ascending: false,
          });

      if (followError) {
        throw followError;
      }

      const ids =
        (followRows ?? []).map(
          (row) => row.follower_id,
        );

      if (ids.length === 0) {
        setUsers([]);
        return;
      }

      const { data: profiles, error: profilesError } =
        await supabase
          .from('profiles')
          .select(
            'id, username, display_name, avatar_url, xp_total, level',
          )
          .in('id', ids);

      if (profilesError) {
        throw profilesError;
      }

      const { data: myFollowingRows, error: followingError } =
        await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', ids);

      if (followingError) {
        throw followingError;
      }

      const followingIds = new Set(
        (myFollowingRows ?? []).map(
          (row) => row.following_id,
        ),
      );

      const profileMap = new Map(
        ((profiles ?? []) as ProfileRow[]).map(
          (profile) => [profile.id, profile],
        ),
      );

      setUsers(
        ids
          .map((id) => profileMap.get(id))
          .filter(
            (profile): profile is ProfileRow =>
              Boolean(profile),
          )
          .map((profile) => ({
            ...profile,
            isFollowing: followingIds.has(profile.id),
          })),
      );
    } catch (err) {
      console.error(
        '[Dare Circle] Failed to load:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load Dare Circle.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadCircle();
  }, [loadCircle]);

  const handleFollowToggle = async (
    targetUserId: string,
    currentlyFollowing: boolean,
  ) => {
    if (actionUserId) return;

    try {
      setActionUserId(targetUserId);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/(auth)/login' as any);
        return;
      }

      if (currentlyFollowing) {
        const { error: deleteError } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });

        if (insertError) {
          throw insertError;
        }
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === targetUserId
            ? {
                ...item,
                isFollowing: !currentlyFollowing,
              }
            : item,
        ),
      );
    } catch (err) {
      console.error(
        '[Dare Circle] Follow toggle failed:',
        err,
      );
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Dare Circle"
        leftSlot={
          <Pressable
            onPress={() =>
              router.replace('/(tabs)')
            }
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={10}
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
        }
      />

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setActiveTab('following')}
          style={[
            styles.tab,
            activeTab === 'following' &&
              styles.activeTab,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'following' &&
                styles.activeTabText,
            ]}
          >
            Following
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('followers')}
          style={[
            styles.tab,
            activeTab === 'followers' &&
              styles.activeTab,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'followers' &&
                styles.activeTabText,
            ]}
          >
            Followers
          </Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>
        {activeTab === 'following'
          ? 'People you follow'
          : 'People following you'}
      </Text>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />
          <Text style={styles.stateText}>
            Loading Dare Circle...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadCircle}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {activeTab === 'following'
              ? 'Your Dare Circle is empty'
              : 'No followers yet'}
          </Text>

          <Text style={styles.emptyText}>
            {activeTab === 'following'
              ? 'Discover people and follow them to build your circle.'
              : 'When people follow you, they will appear here.'}
          </Text>

          {activeTab === 'following' ? (
            <Pressable
              onPress={() =>
                router.push('/search')
              }
              style={styles.discoverButton}
            >
              <Text style={styles.discoverButtonText}>
                Find People
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.list}>
          {users.map((item) => {
            const displayName =
              item.display_name ||
              item.username ||
              'DareShot User';

            const username = item.username
              ? `@${item.username}`
              : '';

            const isProcessing =
              actionUserId === item.id;

            return (
              <View
                key={item.id}
                style={styles.userCard}
              >
                <Pressable
                  style={styles.userInfo}
                  onPress={() =>
                    router.push({
                      pathname: '/public-profile',
                      params: {
                        userId: item.id,
                      },
                    })
                  }
                >
                  {item.avatar_url ? (
                    <Image
                      source={{
                        uri: item.avatar_url,
                      }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View
                      style={
                        styles.avatarFallback
                      }
                    >
                      <Text
                        style={
                          styles.avatarLetter
                        }
                      >
                        {displayName
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View
                    style={styles.userText}
                  >
                    <Text
                      style={styles.displayName}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>

                    {username ? (
                      <Text
                        style={styles.username}
                        numberOfLines={1}
                      >
                        {username}
                      </Text>
                    ) : null}

                    <Text
                      style={styles.levelText}
                    >
                      Level {item.level ?? 1} ·{' '}
                      {item.xp_total ?? 0} XP
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() =>
                    handleFollowToggle(
                      item.id,
                      item.isFollowing,
                    )
                  }
                  disabled={isProcessing}
                  style={[
                    styles.followButton,
                    item.isFollowing &&
                      styles.followingButton,
                  ]}
                >
                  {isProcessing ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        item.isFollowing
                          ? colors.primaryText
                          : colors.background
                      }
                    />
                  ) : (
                    <Text
                      style={[
                        styles.followButtonText,
                        item.isFollowing &&
                          styles.followingButtonText,
                      ]}
                    >
                      {item.isFollowing
                        ? 'Following'
                        : 'Follow'}
                    </Text>
                  )}
                </Pressable>
              </View>
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

  tabs: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  activeTab: {
    borderBottomColor: colors.accent,
  },

  tabText: {
    color: colors.secondaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  activeTabText: {
    color: colors.primaryText,
  },

  heading: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },

  list: {
    gap: spacing.sm,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },

  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
  },

  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },

  avatarLetter: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },

  userText: {
    flex: 1,
    marginLeft: spacing.md,
  },

  displayName: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  username: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  levelText: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  followButton: {
    minWidth: 92,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },

  followingButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },

  followButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  followingButtonText: {
    color: colors.primaryText,
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

  discoverButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },

  discoverButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});