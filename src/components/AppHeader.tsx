import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '../constants/theme';
import { Avatar } from './Avatar';

type AppHeaderProps = {
  title: string;
  showAvatar?: boolean;
  onAvatarPress?: () => void;
  rightSlot?: React.ReactNode;
};

/**
 * Top-of-screen brand/context header. Used on Home for the DareMe
 * wordmark + avatar entry point; used on other screens with a plain title.
 */
export function AppHeader({ title, showAvatar = false, onAvatarPress, rightSlot }: AppHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.right}>
        {rightSlot}
        {showAvatar && (
          <Avatar
            size={36}
            onPress={onAvatarPress}
            accessibilityLabel="Open your profile"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xl,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
