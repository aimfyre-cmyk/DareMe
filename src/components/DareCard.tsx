import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fontFamily, fontSize, radius, spacing } from '../constants/theme';
import { Chip } from './Chip';

export type MockDare = {
  id: string;
  title: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xpValue: number;
  proofType: 'Photo' | 'Video' | 'Text';
};

type DareCardProps = {
  dare: MockDare;
  onPress?: () => void;
  onPrimaryAction?: () => void;
};

const difficultyVariant: Record<MockDare['difficulty'], 'success' | 'accent' | 'danger'> = {
  Easy: 'success',
  Medium: 'accent',
  Hard: 'danger',
};

export function DareCard({ dare, onPress, onPrimaryAction }: DareCardProps) {
  const body = (
    <View style={styles.card}>
      <View style={styles.tagRow}>
        <Chip label={dare.category} variant="neutral" />
        <Chip label={dare.difficulty} variant={difficultyVariant[dare.difficulty]} />
      </View>
      <Text style={styles.title}>{dare.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>+{dare.xpValue} XP</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.meta}>{dare.proofType} proof</Text>
      </View>
      <Pressable
        onPress={onPrimaryAction ?? onPress}
        accessibilityRole="button"
        accessibilityLabel={`Take the dare: ${dare.title}`}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaLabel}>⚡ TAKE THE DARE</Text>
      </Pressable>
    </View>
  );

  if (!onPress || onPrimaryAction) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dare.title}, ${dare.category} category, ${dare.difficulty} difficulty`}
      style={({ pressed }) => [styles.wrapper, pressed && styles.cardPressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
    ...elevation.card,
  },
  cardPressed: { opacity: 0.9 },
  tagRow: { flexDirection: 'row', gap: spacing.sm },
  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
    marginTop: spacing.xs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { color: colors.secondaryText, fontFamily: fontFamily.body, fontSize: fontSize.sm },
  metaDot: { color: colors.secondaryText },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaPressed: { opacity: 0.85 },
  ctaLabel: { color: colors.background, fontFamily: fontFamily.headingMedium, fontSize: fontSize.sm },
});
