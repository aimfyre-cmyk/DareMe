import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    colors,
    fontFamily,
    fontSize,
    spacing,
} from '../constants/theme';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  xp_total: number | null;
  level: number | null;
  streak_count: number | null;
};

type UserPost = {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  post_type: string;
  created_at: string;
  signedMediaUrl?: string | null;
};

export default function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string | string[];
  }>();

  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [posts, setPosts] =
    useState<UserPost[]>([]);

  const [followersCount, setFollowersCount] =
    useState(0);

  const [followingCount, setFollowingCount] =
    useState(0);

  const [isFollowing, setIsFollowing] =
    useState(false);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [followLoading, setFollowLoading] =
    useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);

      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id,username,display_name,avatar_url,xp_total,level,streak_count',
          )
          .eq('id', userId)
          .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(profileData as Profile);

      const [
        followersResult,
        followingResult,
        postsResult,
      ] = await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', userId),

        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId),

        supabase
          .from('posts')
          .select(
            'id,content,media_url,media_type,post_type,created_at',
          )
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', {
            ascending: false,
          })
          .limit(50),
      ]);

      if (followersResult.error) {
        throw followersResult.error;
      }

      if (followingResult.error) {
        throw followingResult.error;
      }

      if (postsResult.error) {
        throw postsResult.error;
      }

      setFollowersCount(
        followersResult.count ?? 0,
      );

      setFollowingCount(
        followingResult.count ?? 0,
      );

      const userPosts =
        (postsResult.data ?? []) as UserPost[];

      const postsWithMedia: UserPost[] = [];

      for (const post of userPosts) {
        let signedMediaUrl: string | null = null;

        if (
          post.media_url &&
          post.media_type === 'image'
        ) {
          const { data: signedData } =
            await supabase.storage
              .from('post-media')
              .createSignedUrl(
                post.media_url,
                60 * 60,
              );

          signedMediaUrl =
            signedData?.signedUrl ?? null;
        }

        postsWithMedia.push({
          ...post,
          signedMediaUrl,
        });
      }

      setPosts(postsWithMedia);

      if (user?.id && user.id !== userId) {
        const { data: followData, error: followError } =
          await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', userId)
            .maybeSingle();

        if (followError) {
          throw followError;
        }

        setIsFollowing(!!followData);
      } else {
        setIsFollowing(false);
      }
    } catch (error) {
      console.error(
        'Public profile load error:',
        error,
      );

      Alert.alert(
        'Could not load profile',
        'This profile could not be loaded right now.',
      );

      router.back();
    } finally {
      setLoading(false);
    }
  }, [router, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollowToggle = async () => {
    if (!userId || !currentUserId) {
      Alert.alert(
        'Login required',
        'Please log in to follow users.',
      );
      return;
    }

    if (currentUserId === userId) {
      return;
    }

    if (followLoading) {
      return;
    }

    setFollowLoading(true);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);

        if (error) {
          throw error;
        }

        setIsFollowing(false);
        setFollowersCount((count) =>
          Math.max(0, count - 1),
        );
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: userId,
          });

        if (error) {
          throw error;
        }

        setIsFollowing(true);
        setFollowersCount(
          (count) => count + 1,
        );
      }
    } catch (error) {
      console.error(
        'Follow toggle error:',
        error,
      );

      Alert.alert(
        'Could not update follow',
        'Please try again.',
      );
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />

        <Text style={styles.loadingText}>
          Loading profile...
        </Text>
      </View>
    );
  }

  if (!profile) {
    return null;
  }

  const displayName =
    profile.display_name ||
    profile.username ||
    'DareMe User';

  const username = profile.username
    ? `@${profile.username}`
    : '';

  const isOwnProfile =
    currentUserId === profile.id;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Profile
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Profile identity */}
        <View style={styles.profileSection}>
          {profile.avatar_url ? (
            <Image
              source={{
                uri: profile.avatar_url,
              }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={styles.avatarFallback}
            >
              <Text
                style={styles.avatarLetter}
              >
                {displayName
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.displayName}>
            {displayName}
          </Text>

          {username ? (
            <Text style={styles.username}>
              {username}
            </Text>
          ) : null}

          {/* Follow */}
          {!isOwnProfile ? (
            <Pressable
              onPress={handleFollowToggle}
              disabled={followLoading}
              style={[
                styles.followButton,
                isFollowing &&
                  styles.followingButton,
              ]}
              accessibilityRole="button"
            >
              {followLoading ? (
                <ActivityIndicator
                  size="small"
                  color={
                    isFollowing
                      ? colors.primaryText
                      : colors.background
                  }
                />
              ) : (
                <Text
                  style={[
                    styles.followText,
                    isFollowing &&
                      styles.followingText,
                  ]}
                >
                  {isFollowing
                    ? 'Following'
                    : 'Follow'}
                </Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.youBadge}>
              <Text style={styles.youText}>
                Your Profile
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Stat
            value={posts.length}
            label="POSTS"
          />

          <Stat
            value={followersCount}
            label="FOLLOWERS"
          />

          <Stat
            value={followingCount}
            label="FOLLOWING"
          />
        </View>

        {/* XP */}
        <View style={styles.levelCard}>
          <Stat
            value={profile.level ?? 1}
            label="LEVEL"
          />

          <Stat
            value={profile.xp_total ?? 0}
            label="XP"
          />

          <Stat
            value={profile.streak_count ?? 0}
            label="STREAK"
          />
        </View>

        {/* Posts */}
        <Text style={styles.sectionTitle}>
          Posts
        </Text>

        {posts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyTitle}>
              No posts yet
            </Text>

            <Text style={styles.emptyText}>
              This user has not shared any
              posts yet.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {posts.map((post) => {
              const isPhoto =
                post.media_type ===
                  'image' &&
                !!post.signedMediaUrl;

              return (
                <View
                  key={post.id}
                  style={styles.gridItem}
                >
                  {isPhoto ? (
                    <Image
                      source={{
                        uri:
                          post.signedMediaUrl!,
                      }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={
                        styles.textPost
                      }
                    >
                      <Text
                        style={
                          styles.textPostContent
                        }
                        numberOfLines={5}
                      >
                        {post.content ||
                          'Shared a post'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  backText: {
    color: colors.primaryText,
    fontSize: 38,
    fontFamily: fontFamily.body,
    lineHeight: 42,
  },

  headerTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.lg,
  },

  headerSpacer: {
    width: 44,
  },

  profileSection: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.accent,
  },

  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarLetter: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 36,
  },

  displayName: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 24,
    marginTop: spacing.md,
  },

  username: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: 4,
  },

  followButton: {
    minWidth: 140,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },

  followingButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  followText: {
    color: colors.background,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  followingText: {
    color: colors.primaryText,
  },

  youBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  youText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },

  levelCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 24,
  },

  statLabel: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: 10,
    marginTop: 5,
    letterSpacing: 0.5,
  },

  sectionTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 22,
    marginBottom: spacing.md,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },

  gridItem: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 2,
  },

  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },

  textPost: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },

  textPostContent: {
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: 12,
    textAlign: 'center',
  },

  emptyPosts: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },

  emptyTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
  },

  emptyText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});