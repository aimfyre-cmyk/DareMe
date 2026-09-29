import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { DareCard } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';
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
          <View style={styles.headerActions}>
            {/* Search */}
            <Pressable
              onPress={() => router.push('/search')}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Search"
              hitSlop={10}
            >
              <Text style={styles.searchIcon}>⌕</Text>
            </Pressable>

            {/* Notifications */}
            <NotificationBell />
          </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchIcon: {
    color: colors.primaryText,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
  },

  notificationIcon: {
    color: colors.primaryText,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '500',
  },
});