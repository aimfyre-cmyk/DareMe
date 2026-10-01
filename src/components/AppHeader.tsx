import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, fontSize, spacing } from '../constants/theme';
import { Avatar } from './Avatar';

type AppHeaderProps = {
  title: string;
  showAvatar?: boolean;
  onAvatarPress?: () => void;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
};

/**
 * Top-of-screen brand/context header.
 *
 * The title is visually centered independently of the left/right content,
 * so the DareMe wordmark stays centered even when the action groups have
 * different widths.
 *
 * Existing avatar/rightSlot behavior is preserved for other screens.
 */
export function AppHeader({
  title,
  showAvatar = false,
  onAvatarPress,
  rightSlot,
  leftSlot,
}: AppHeaderProps) {
    const insets = useSafeAreaInsets();
  return (
  <View
    style={[
      styles.row,
      {
        paddingTop: Math.max(insets.top, spacing.sm),
      },
    ]}
  >
      <View style={styles.left}>
        {leftSlot}
      </View>

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
    position: 'relative',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },

  left: {
    minWidth: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },

  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 35,
    textAlign: 'center',
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xl,
    zIndex: 1,
  },

  right: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 2,
  },
});