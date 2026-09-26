import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '../constants/theme';

type InputProps = TextInputProps & {
  label?: string;
};

/**
 * Text input primitive. Applies the DareMe surface/border treatment and
 * a readable placeholder color; forwards all standard TextInput props.
 */
export function Input({ label, style, ...rest }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.secondaryText}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    minHeight: 44,
  },
});
