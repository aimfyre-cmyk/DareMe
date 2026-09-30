import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, SafeAreaView, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../constants/theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/**
 * Base screen wrapper: safe-area, background, consistent padding.
 * Every top-level route should render its content inside <Screen>.
 */
export function Screen({ children, scroll = true, style, contentContainerStyle, onScroll }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
});
