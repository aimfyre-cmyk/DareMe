import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { DareCard } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { colors, spacing } from '../../constants/theme';
import { mockHomeDares } from '../../data/mockDares';

/**
 * HOME / DARE FEED
 */
export default function HomeScreen() {
  const hasDares = mockHomeDares.length > 0;

  return (
    <Screen>
      <AppHeader
        title="DareMe"
        showAvatar
        onAvatarPress={() => router.push('./me')}
        rightSlot={
          <Pressable
            onPress={() => router.push('/search')}
            style={styles.searchButton}
            accessibilityRole="button"
            accessibilityLabel="Search"
            hitSlop={10}
          >
            <Text style={styles.searchIcon}>⌕</Text>
          </Pressable>
        }
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

const styles = StyleSheet.create({
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  searchIcon: {
    color: colors.primaryText,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
  },
});