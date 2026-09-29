import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '../../components/Avatar';
import { IconButton } from '../../components/IconButton';
import { Screen } from '../../components/Screen';
import { colors, fontFamily, fontSize, radius, spacing } from '../../constants/theme';
import { getProfile, uploadAvatar } from '../../features/onboarding/profileService';
import { getCurrentSession, signOut } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  xp_total: number;
  level: number;
  streak_count: number;
};

type UserPost = {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  signedMediaUrl: string | null;
};

export default function MeScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setPostsLoading(true);
    setErrorMessage('');

    try {
      const session = await getCurrentSession();

      if (!session?.user) {
        router.replace('/(auth)/login' as any);
        return;
      }

      const userId = session.user.id;

      const data = await getProfile(userId);

      if (!data) {
        setErrorMessage('Profile not found.');
        return;
      }

      setProfile({
        id: userId,
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url ?? null,
        xp_total: data.xp_total ?? 0,
        level: data.level ?? 1,
        streak_count: data.streak_count ?? 0,
      });

      await Promise.all([
        loadFollowCounts(userId),
        loadUserPosts(userId),
      ]);
    } catch (error) {
      console.error('[DareMe Profile] Failed to load profile:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load your profile.',
      );
    } finally {
      setLoading(false);
      setPostsLoading(false);
    }
  };

  const loadFollowCounts = async (userId: string) => {
    const [{ count: followers }, { count: following }] =
      await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', userId),
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId),
      ]);

    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
  };

  const loadUserPosts = async (userId: string) => {
    setPostsLoading(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id,content,media_url,media_type,created_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as Array<{
        id: string;
        content: string | null;
        media_url: string | null;
        media_type: string | null;
        created_at: string;
      }>;

      const withUrls = await Promise.all(
        rows.map(async (post) => {
          if (!post.media_url || post.media_type !== 'image') {
            return {
              ...post,
              signedMediaUrl: null,
            };
          }

          const { data: signed, error: signedError } =
            await supabase.storage
              .from('post-media')
              .createSignedUrl(post.media_url, 60 * 60);

          if (signedError) {
            console.error(
              '[DareMe Profile] Signed image URL failed:',
              signedError,
            );
          }

          return {
            ...post,
            signedMediaUrl: signed?.signedUrl ?? null,
          };
        }),
      );

      setPosts(withUrls);
    } catch (error) {
      console.error('[DareMe Profile] Failed to load posts:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load your posts.',
      );
    } finally {
      setPostsLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    if (uploadingAvatar) return;

    setErrorMessage('');
    setUploadingAvatar(true);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Please allow photo library access to choose a profile picture.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const selectedUri = result.assets[0].uri;
      const session = await getCurrentSession();

      if (!session?.user) {
        setErrorMessage(
          'Your session has expired. Please log in again.',
        );
        return;
      }

      const avatarUrl = await uploadAvatar(
        session.user.id,
        selectedUri,
      );

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (updateError) {
        throw updateError;
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              avatar_url: avatarUrl,
            }
          : current,
      );
    } catch (error) {
      console.error('[DareMe Avatar] Upload failed:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not update your profile photo.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setErrorMessage('');

    try {
      await signOut();
      router.replace('/(auth)/login' as any);
    } catch (error) {
      console.error('[DareMe Auth] Logout error:', error);
      setLoggingOut(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Logout failed. Please try again.',
      );
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.avatarPressed,
              uploadingAvatar && styles.avatarUploading,
            ]}
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.profileAvatar}
                resizeMode="cover"
              />
            ) : (
              <Avatar size={64} />
            )}

            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator
                  size="small"
                  color={colors.background}
                />
              ) : (
                <Text style={styles.avatarEditText}>EDIT</Text>
              )}
            </View>
          </Pressable>

          <View style={styles.identityText}>
            <Text style={styles.username}>
              {profile?.display_name || 'Your name'}
            </Text>

            <Text style={styles.handle}>
              {profile?.username
                ? `@${profile.username}`
                : '@username'}
            </Text>
          </View>
        </View>

        <IconButton
          accessibilityLabel="Open settings"
          variant="surface"
          onPress={() => router.push('/(settings)')}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </IconButton>
      </View>

      <View style={styles.followStats}>
        <Stat
          label="Posts"
          value={String(posts.length)}
        />
        <Pressable
          style={styles.stat}
          onPress={() => router.push('/follow-list?type=followers' as any)}
          accessibilityRole="button"
          accessibilityLabel={`View ${followersCount} followers`}
        >
          <Text style={styles.statValue}>{followersCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <Pressable
          style={styles.stat}
          onPress={() => router.push('/follow-list?type=following' as any)}
          accessibilityRole="button"
          accessibilityLabel={`View ${followingCount} following`}
        >
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </Pressable>
      </View>

      <View style={styles.gameStats}>
        <Stat
          label="Level"
          value={String(profile?.level ?? 1)}
        />
        <Stat
          label="XP"
          value={String(profile?.xp_total ?? 0)}
        />
        <Stat
          label="Streak"
          value={String(profile?.streak_count ?? 0)}
        />
      </View>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable onPress={loadProfile}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Posts</Text>
        <Text style={styles.sectionCount}>{posts.length}</Text>
      </View>

      {postsLoading ? (
        <View style={styles.postsLoading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyPosts}>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyDescription}>
            Share your first post with the DareMe community.
          </Text>

          <Pressable
            style={styles.createPostButton}
            onPress={() => router.push('/create-post' as any)}
          >
            <Text style={styles.createPostText}>CREATE POST</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.postGrid}>
          {posts.map((post) => {
            const isImage =
              post.media_type === 'image' &&
              !!post.signedMediaUrl;

            return (
              <View key={post.id} style={styles.postTile}>
                {isImage ? (
                  <Image
                    source={{ uri: post.signedMediaUrl! }}
                    style={styles.postTileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.textPostTile}>
                    <Text
                      style={styles.textPostContent}
                      numberOfLines={7}
                    >
                      {post.content || 'Shared a post'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutPressed,
          loggingOut && styles.logoutDisabled,
        ]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.logoutText}>LOG OUT</Text>
        )}
      </Pressable>
    </Screen>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  loadingText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },

  identityText: {
    flexShrink: 1,
  },

  avatarButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    position: 'relative',
  },

  avatarPressed: {
    opacity: 0.75,
  },

  avatarUploading: {
    opacity: 0.65,
  },

  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },

  avatarEditBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    minWidth: 30,
    minHeight: 22,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarEditText: {
    color: colors.background,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 8,
    letterSpacing: 0.4,
  },

  username: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
  },

  handle: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  settingsIcon: {
    color: colors.primaryText,
    fontSize: 20,
  },

  followStats: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },

  gameStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },

  statValue: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xl,
  },

  statLabel: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
  },

  errorBox: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#2A1518',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  errorText: {
    color: '#FF7A84',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  retryText: {
    color: colors.accent,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xs,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  sectionTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
  },

  sectionCount: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  postsLoading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  emptyPosts: {
    minHeight: 220,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  emptyTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
  },

  emptyDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },

  createPostButton: {
    marginTop: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  createPostText: {
    color: colors.background,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.sm,
  },

  postGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  postTile: {
    width: '31.8%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  postTileImage: {
    width: '100%',
    height: '100%',
  },

  textPostTile: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
  },

  textPostContent: {
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  logoutButton: {
    minHeight: 52,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutPressed: {
    opacity: 0.7,
  },

  logoutDisabled: {
    opacity: 0.6,
  },

  logoutText: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.sm,
  },
});
