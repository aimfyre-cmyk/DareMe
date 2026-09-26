import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { colors, fontFamily, fontSize, radius, spacing } from '../../constants/theme';
import { signOut } from '../../lib/auth';

/**
 * ME — Phase 2 shell + Phase 3 authentication logout.
 * Profile/gamification data remains placeholder until later phases.
 */
export default function MeScreen() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');

    try {
      await signOut();
      router.replace('/(auth)/login' as any);
    } catch (error) {
      console.error('[DareMe Auth] Logout error:', error);

      setLoggingOut(false);
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Logout failed. Please try again.',
      );
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <Avatar size={64} />

          <View>
            <Text style={styles.username}>Your name</Text>
            <Text style={styles.handle}>@username</Text>
          </View>
        </View>

        <IconButton
          accessibilityLabel="Open settings"
          variant="surface"
          onPress={() => {
            // Phase 4+: navigate to Settings
          }}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </IconButton>
      </View>

      <View style={styles.statRow}>
        <Stat label="Level" value="—" />
        <Stat label="XP" value="—" />
        <Stat label="Streak" value="—" />
      </View>

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

      {logoutError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{logoutError}</Text>
        </View>
      ) : null}

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
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.logoutText}>LOG OUT</Text>
        )}
      </Pressable>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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

  settingsIcon: {
    color: colors.primaryText,
    fontSize: 20,
  },

  statLabel: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
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

  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: '#2A1518',
    borderWidth: 1,
    borderColor: '#FF4D5A',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  errorText: {
    color: '#FF7A84',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
});