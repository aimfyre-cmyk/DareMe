import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, touchTarget } from '../constants/theme';

type IconButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: 'plain' | 'surface';
};

/**
 * Wraps a single icon in an accessible, appropriately sized touch target.
 * accessibilityLabel is required — icon-only buttons must always be labeled.
 */
export function IconButton({ children, onPress, accessibilityLabel, variant = 'plain' }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        variant === 'surface' && styles.surface,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: touchTarget.minSize,
    minHeight: touchTarget.minSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  surface: {
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
});
