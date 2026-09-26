import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '../constants/theme';

type AvatarProps = {
  size?: number;
  uri?: string | null;
  initial?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Avatar placeholder. Renders an image if `uri` is provided (future
 * backend-connected state); otherwise a neutral initial/circle placeholder.
 * Never fabricates a real user's photo or name.
 */
export function Avatar({ size = 48, uri, initial, onPress, accessibilityLabel }: AvatarProps) {
  const content = (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {!uri && (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
          {initial ?? '—'}
        </Text>
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Profile'}
      hitSlop={8}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: colors.secondaryText,
    fontFamily: fontFamily.headingMedium,
  },
});
