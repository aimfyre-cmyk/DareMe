import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../../constants/theme';
import { getProfile } from '../../features/onboarding/profileService';
import { getCurrentSession, signOut } from '../../lib/auth';
import { transitionDare } from '../../lib/dareTransitions';

type Profile = {
  username: string;
  display_name: string;
  avatar_url: string | null;
  xp_total: number;
  level: number;
  streak_count: number;
};

type TestState =
  | 'idle'
  | 'testing'
  | 'success'
  | 'error';

const TEST_PARTICIPANT_ID =
  '063dccd4-e4b9-45a4-8389-06e7138506b4';

export default function MeScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [testingDare, setTestingDare] =
    useState<TestState>('idle');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const session = await getCurrentSession();

      if (!session) {
        router.replace('/(auth)/login' as any);
        return;
      }

      const data = await getProfile(session.user.id);

      if (!data) {
        setErrorMessage('Profile not found.');
        return;
      }

      setProfile({
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url ?? null,
        xp_total: data.xp_total ?? 0,
        level: data.level ?? 1,
        streak_count: data.streak_count ?? 0,
      });
    } catch (error) {
      console.error(
        '[DareMe Profile] Failed to load profile:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load your profile.',
      );
    } finally {
      setLoading(false);
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
      console.error(
        '[DareMe Auth] Logout error:',
        error,
      );

      setLoggingOut(false);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Logout failed. Please try again.',
      );
    }
  };

  /**
   * TEMPORARY PHASE 6 QA TEST
   *
   * Current test participant:
   * ACCEPTED
   *
   * Expected transition:
   * ACCEPTED → IN_PROGRESS
   *
   * This verifies:
   * Expo client
   * → authenticated Supabase session
   * → Edge Function
   * → backend wrapper
   * → state machine
   * → database
   *
   * Remove this test UI after Phase 6 verification.
   */
  const handleTestDareTransition = async () => {
    if (testingDare === 'testing') return;

    setTestingDare('testing');
    setErrorMessage('');

    try {
      const result = await transitionDare(
        TEST_PARTICIPANT_ID,
        'complete',
      );

      console.log(
        '[DareMe] Edge Function test result:',
        result,
      );

      setTestingDare('success');

      setErrorMessage(
        `Dare transition successful: ${result.state}`,
      );
    } catch (error) {
      console.error(
        '[DareMe] Edge Function test failed:',
        error,
      );

      setTestingDare('error');

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Dare transition test failed.',
      );
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={colors.accent}
          />

          <Text style={styles.loadingText}>
            Loading profile...
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.profileAvatar}
              resizeMode="cover"
            />
          ) : (
            <Avatar size={64} />
          )}

          <View>
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
          onPress={() => {
            // Settings will be added in a later phase.
          }}
        >
          <Text style={styles.settingsIcon}>
            ⚙
          </Text>
        </IconButton>
      </View>

      <View style={styles.statRow}>
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
        <View
          style={[
            styles.messageBox,
            testingDare === 'success'
              ? styles.successBox
              : styles.errorBox,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              testingDare === 'success'
                ? styles.successText
                : styles.errorText,
            ]}
          >
            {errorMessage}
          </Text>

          {testingDare !== 'success' ? (
            <Pressable onPress={loadProfile}>
              <Text style={styles.retryText}>
                TRY AGAIN
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <SectionHeader title="Badges" />

      <EmptyState
        title="No badges yet"
        description="Complete dares to start earning badges."
      />

      <SectionHeader title="Completed Dares" />

      <EmptyState
        title="No completed dares yet"
        description="Your finished dares will show up here."
      />

      {/* TEMPORARY PHASE 6 QA BUTTON */}
      <Pressable
        style={({ pressed }) => [
          styles.testButton,
          pressed && styles.testButtonPressed,
          testingDare === 'testing' &&
            styles.testButtonDisabled,
        ]}
        onPress={handleTestDareTransition}
        disabled={testingDare === 'testing'}
      >
        {testingDare === 'testing' ? (
          <ActivityIndicator
            color={colors.accent}
          />
        ) : (
          <Text style={styles.testButtonText}>
            TEST DARE ENGINE
          </Text>
        )}
      </Pressable>

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
          <ActivityIndicator
            color={colors.primaryText}
          />
        ) : (
          <Text style={styles.logoutText}>
            LOG OUT
          </Text>
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
  },

  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
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
  },

  statRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
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

  settingsIcon: {
    color: colors.primaryText,
    fontSize: 20,
  },

  messageBox: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  errorBox: {
    backgroundColor: '#2A1518',
    borderColor: colors.danger,
  },

  successBox: {
    backgroundColor: '#12251A',
    borderColor: colors.success,
  },

  messageText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  errorText: {
    color: '#FF7A84',
  },

  successText: {
    color: colors.success,
  },

  retryText: {
    color: colors.accent,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xs,
  },

  testButton: {
    minHeight: 52,
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  testButtonPressed: {
    opacity: 0.7,
  },

  testButtonDisabled: {
    opacity: 0.6,
  },

  testButtonText: {
    color: colors.accent,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.sm,
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