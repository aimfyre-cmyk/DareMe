import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { colors, fontFamily, fontSize, radius, spacing } from '../../constants/theme';

const tabs = ['Received', 'Sent', 'Active', 'Completed'] as const;
type DaresTab = (typeof tabs)[number];

const emptyCopy: Record<DaresTab, { title: string; description: string }> = {
  Received: {
    title: 'No dares received yet',
    description: 'When someone dares you, it will show up here.',
  },
  Sent: {
    title: 'No dares sent yet',
    description: 'Challenge someone from a dare or your profile.',
  },
  Active: {
    title: 'No active dares yet',
    description: 'Accept a dare from Home or Discover to get started.',
  },
  Completed: {
    title: 'No completed dares yet',
    description: 'Finished dares and their proof will appear here.',
  },
};

/**
 * DARES — Phase 2 shell only. Tabbed UI with empty states; no real
 * dare-participant data is wired up until Phase 6 (Dare Engine).
 */
export default function DaresScreen() {
  const [activeTab, setActiveTab] = useState<DaresTab>('Active');
  const copy = emptyCopy[activeTab];

  return (
    <Screen>
      <AppHeader title="Dares" />

      <View style={styles.tabRow} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const selected = tab === activeTab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${tab} dares`}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>

      <EmptyState title={copy.title} description={copy.description} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabLabel: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  tabLabelSelected: {
    color: colors.background,
  },
});
