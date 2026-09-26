import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { colors, fontFamily, fontSize, radius, spacing } from '../../constants/theme';

/**
 * ME — Phase 2 shell only. All values are neutral placeholders (no fake
 * XP, streaks, or achievements) — real data connects in Phase 4 (profile)
 * and Phase 11 (gamification).
 */
export default function MeScreen() {
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
      <EmptyState title="No badges yet" description="Complete dares to start earning badges." />

      <SectionHeader title="Completed Dares" />
      <EmptyState title="No completed dares yet" description="Your finished dares will show up here." />
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
});
