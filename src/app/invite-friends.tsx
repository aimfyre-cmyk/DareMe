import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
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

export default function InviteFriendsScreen() {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;

    try {
      setSharing(true);

      await Share.share({
        title: 'Join me on DareShot',
        message:
          "I'm on DareShot 🔥 — a social app built around challenges, dares and real experiences. Join me and take the dare!",
      });
    } catch (error) {
      console.error(
        '[Invite Friends] Share failed:',
        error,
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Invite Friends"
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

      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>👥</Text>
        </View>

        <Text style={styles.title}>
          Bring your friends to DareShot
        </Text>

        <Text style={styles.description}>
          Invite your friends, take dares together,
          compete for XP and build your Dare Circle.
        </Text>

        <View style={styles.featureCard}>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🔥</Text>

            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                Take dares together
              </Text>

              <Text style={styles.featureDescription}>
                Challenge your friends and see who
                completes the dare.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>⚡</Text>

            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                Earn XP
              </Text>

              <Text style={styles.featureDescription}>
                Complete dares and climb the DareShot
                rankings.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>👑</Text>

            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                Build your circle
              </Text>

              <Text style={styles.featureDescription}>
                Follow friends and grow your Dare
                Circle.
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={[
            styles.shareButton,
            sharing && styles.shareButtonDisabled,
          ]}
        >
          {sharing ? (
            <ActivityIndicator
              size="small"
              color={colors.background}
            />
          ) : (
            <>
              <Text style={styles.shareIcon}>↗</Text>

              <Text style={styles.shareButtonText}>
                Invite Friends
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.note}>
          Your phone's share menu will open so you
          can choose how to invite your friends.
        </Text>
      </View>
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

  container: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },

  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },

  icon: {
    fontSize: 38,
  },

  title: {
    color: colors.primaryText,
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.lg,
  },

  description: {
    color: colors.secondaryText,
    fontSize: fontSize.md,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 380,
  },

  featureCard: {
    width: '100%',
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    gap: spacing.lg,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  featureIcon: {
    fontSize: 24,
    width: 38,
  },

  featureText: {
    flex: 1,
  },

  featureTitle: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  featureDescription: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    lineHeight: 19,
    marginTop: 3,
  },

  shareButton: {
    width: '100%',
    minHeight: 52,
    marginTop: spacing.xl,
    borderRadius: 26,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  shareButtonDisabled: {
    opacity: 0.7,
  },

  shareIcon: {
    color: colors.background,
    fontSize: 22,
    fontWeight: '700',
  },

  shareButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  note: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 320,
  },
});