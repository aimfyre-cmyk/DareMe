import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '../constants/theme';

type ChipVariant = 'neutral' | 'accent' | 'danger' | 'success';

type ChipProps = {
  label: string;
  variant?: ChipVariant;
};

const variantColor: Record<ChipVariant, string> = {
  neutral: colors.secondaryText,
  accent: colors.accent,
  danger: colors.danger,
  success: colors.success,
};

/**
 * Small tag/chip used for category, difficulty, and status labels
 * (e.g. dare category, "REVIEW" state, badge names).
 */
export function Chip({ label, variant = 'neutral' }: ChipProps) {
  const tint = variantColor[variant];
  return (
    <View style={[styles.chip, { borderColor: tint }]}>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
