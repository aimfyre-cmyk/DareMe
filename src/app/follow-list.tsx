import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '../components/Avatar';
import { Screen } from '../components/Screen';
import { colors, fontFamily, fontSize, radius, spacing } from '../constants/theme';
import { getCurrentSession } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type FollowRow = {
  follower_id: string;
  following_id: string;
};

export default function FollowListScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type = params.type === 'following' ? 'following' : 'followers';
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const title = type === 'following' ? 'Following' : 'Followers';

  useEffect(() => {
    loadList();
  }, [type]);

  const loadList = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const session = await getCurrentSession();

      if (!session?.user) {
        router.replace('/(auth)/login' as any);
        return;
      }

      const userId = session.user.id;

      const { data: followRows, error: followsError } = await supabase
        .from('follows')
        .select('follower_id,following_id')
        .eq(type === 'followers' ? 'following_id' : 'follower_id', userId);

      if (followsError) throw followsError;

      const rows = (followRows ?? []) as FollowRow[];

      if (rows.length === 0) {
        setProfiles([]);
        return;
      }

      const ids = rows.map((row) =>
        type === 'followers' ? row.follower_id : row.following_id,
      );

      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .in('id', ids);

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        ((profileRows ?? []) as Profile[]).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      setProfiles(
        ids
          .map((id) => profileMap.get(id))
          .filter((profile): profile is Profile => Boolean(profile)),
      );
    } catch (error) {
      console.error('[DareShot user Follow List] Failed to load:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `Could not load ${title.toLowerCase()}.`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>{title}</Text>

        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading {title.toLowerCase()}...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable onPress={loadList} style={styles.retryButton}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
          </Text>
          <Text style={styles.emptyText}>
            {type === 'followers'
              ? 'When someone follows you, they will appear here.'
              : 'People you follow will appear here.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {profiles.map((profile) => (
            <Pressable
              key={profile.id}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/public-profile',
                  params: { userId: profile.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Open ${profile.display_name || profile.username}'s profile`}
            >
              {profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <Avatar size={52} />
              )}

              <View style={styles.profileText}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {profile.display_name || 'DareShot user'}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{profile.username}
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: {
    color: colors.primaryText,
    fontSize: 32,
    lineHeight: 34,
    fontFamily: fontFamily.body,
  },
  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xl,
  },
  headerSpacer: {
    width: 44,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  profileText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  displayName: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
  },
  username: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  chevron: {
    color: colors.secondaryText,
    fontSize: 28,
    marginLeft: spacing.sm,
  },
  center: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
  errorText: {
    color: '#FF7A84',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.background,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.sm,
  },
  emptyTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 300,
  },
});
