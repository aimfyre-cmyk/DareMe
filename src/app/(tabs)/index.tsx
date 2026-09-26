import { router } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { DareCard } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { mockHomeDares } from '../../data/mockDares';

/**
 * HOME / DARE FEED — Phase 2 shell only.
 * Static mock dares demonstrate layout; real feed composition arrives in
 * Phase 9 (Feed/Discovery), backed by the dare engine from Phase 6.
 */
export default function HomeScreen() {
  const hasDares = mockHomeDares.length > 0;

  return (
    <Screen>
      <AppHeader
        title="DareMe"
        showAvatar
        onAvatarPress={() => router.push('./me')}
      />

      <SectionHeader title="For You" />

      {hasDares ? (
        <View>
          {mockHomeDares.map((dare) => (
            <DareCard
              key={dare.id}
              dare={dare}
              onPress={() => {
                // Phase 5+: navigate to Dare Detail with dare.id
              }}
              onPrimaryAction={() => {
                // Phase 6: accept dare, move to Active Dare
              }}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="You're all caught up"
          description="Check back soon for new dares, or explore Discover."
        />
      )}
    </Screen>
  );
}
