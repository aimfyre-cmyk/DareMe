import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing, touchTarget } from '../constants/theme';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
};

/**
 * The one primary action per screen — e.g. "⚡ TAKE THE DARE", "⚡ DARE",
 * "Publish Dare". Accent lime fill, used sparingly by design (one per screen).
 */
export function PrimaryButton({ label, onPress, disabled, accessibilityHint }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.minSize,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  label: {
    color: colors.background,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
  },
});
