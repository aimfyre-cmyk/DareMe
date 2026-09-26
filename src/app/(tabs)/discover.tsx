import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Chip } from '../../components/Chip';
import { DareCard } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { spacing } from '../../constants/theme';
import { discoverCategories, mockDiscoverDares } from '../../data/mockDares';

/**
 * DISCOVER — Phase 2 shell only.
 * Search field and category chips are UI-only; real search/backend logic
 * arrives in Phase 9.
 */
export default function DiscoverScreen() {
  return (
    <Screen>
      <AppHeader title="Discover" />

      <Input placeholder="Search dares, people, categories" editable={false} />

      <SectionHeader title="Categories" />
      <View style={styles.chipWrap}>
        {discoverCategories.map((category) => (
          <Chip key={category} label={category} />
        ))}
      </View>

      <SectionHeader title="Featured Dares" />
      {mockDiscoverDares.length > 0 ? (
        <View>
          {mockDiscoverDares.map((dare) => (
            <DareCard key={dare.id} dare={dare} />
          ))}
        </View>
      ) : (
        <EmptyState title="No featured dares right now" />
      )}

      <SectionHeader title="People to Follow" />
      <EmptyState
        title="Discover people soon"
        description="Recommendations arrive once the community grows."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
