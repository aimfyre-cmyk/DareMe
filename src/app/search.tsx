import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    colors,
    fontFamily,
    fontSize,
    radius,
    spacing,
} from '../constants/theme';
import { supabase } from '../lib/supabase';

type SearchTab = 'People' | 'Dares';

type PersonResult = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
};

type DareResult = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  xp_value: number;
};

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] =
    useState<SearchTab>('People');

  const [people, setPeople] = useState<PersonResult[]>([]);
  const [dares, setDares] = useState<DareResult[]>([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const cleanQuery = query.trim();

  useEffect(() => {
    if (!cleanQuery) {
      setPeople([]);
      setDares([]);
      setSearched(false);
      setError('');
    }
  }, [cleanQuery]);

  const runSearch = async () => {
    if (!cleanQuery) {
      setError('Type something to search.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    setError('');

    try {
      const searchTerm = `%${cleanQuery}%`;

      if (activeTab === 'People') {
        const { data, error: searchError } =
          await supabase
            .from('profiles')
            .select(
              'id,username,display_name,bio,avatar_url',
            )
            .eq('profile_visibility', 'anyone')
            .or(
              `username.ilike.${searchTerm},display_name.ilike.${searchTerm},bio.ilike.${searchTerm}`,
            )
            .order('display_name', {
              ascending: true,
            })
            .limit(30);

        if (searchError) {
          throw searchError;
        }

        setPeople((data ?? []) as PersonResult[]);
      } else {
        const { data, error: searchError } =
          await supabase
            .from('dares')
            .select(
              'id,title,description,category,difficulty,xp_value',
            )
            .eq('status', 'active')
            .or(
              `title.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm}`,
            )
            .order('created_at', {
              ascending: false,
            })
            .limit(30);

        if (searchError) {
          throw searchError;
        }

        setDares((data ?? []) as DareResult[]);
      }
    } catch (err) {
      console.error(
        '[DareMe Search] Search failed:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Search failed. Please try again.',
      );

      setPeople([]);
      setDares([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    setPeople([]);
    setDares([]);
    setSearched(false);
    setError('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people or dares..."
            placeholderTextColor={colors.secondaryText}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={runSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            onPress={runSearch}
            disabled={loading}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
              />
            ) : (
              <Text style={styles.searchButtonText}>
                Search
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {(['People', 'Dares'] as SearchTab[]).map(
            (tab) => (
              <Pressable
                key={tab}
                onPress={() => handleTabChange(tab)}
                style={[
                  styles.tab,
                  activeTab === tab && styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab &&
                      styles.activeTabText,
                  ]}
                >
                  {tab}
                </Text>
              </Pressable>
            ),
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        {!searched && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Discover something new
            </Text>

            <Text style={styles.emptyText}>
              Search for people, usernames, dares or
              categories.
            </Text>
          </View>
        ) : null}

        {searched && !loading && activeTab === 'People' ? (
          <View>
            <Text style={styles.sectionTitle}>
              PEOPLE
            </Text>

            {people.length === 0 ? (
              <EmptyResult
                text={`No people found for "${cleanQuery}".`}
              />
            ) : (
              people.map((person) => (
                <Pressable
                  key={person.id}
                  style={({ pressed }) => [
                    styles.resultCard,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() =>
                    router.push(
                      `/profile/${person.id}` as any,
                    )
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(
                        person.display_name ||
                        person.username ||
                        '?'
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.resultInfo}>
                    <Text
                      style={styles.resultTitle}
                      numberOfLines={1}
                    >
                      {person.display_name}
                    </Text>

                    <Text
                      style={styles.username}
                      numberOfLines={1}
                    >
                      @{person.username}
                    </Text>

                    {person.bio ? (
                      <Text
                        style={styles.resultDescription}
                        numberOfLines={2}
                      >
                        {person.bio}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {searched && !loading && activeTab === 'Dares' ? (
          <View>
            <Text style={styles.sectionTitle}>
              DARES
            </Text>

            {dares.length === 0 ? (
              <EmptyResult
                text={`No dares found for "${cleanQuery}".`}
              />
            ) : (
              dares.map((dare) => (
                <Pressable
                  key={dare.id}
                  style={({ pressed }) => [
                    styles.dareCard,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() =>
                    router.push(
                      `/dare/${dare.id}` as any,
                    )
                  }
                >
                  <View style={styles.dareTopRow}>
                    <View style={styles.categoryPill}>
                      <Text
                        style={styles.categoryText}
                      >
                        {dare.category}
                      </Text>
                    </View>

                    <Text style={styles.xp}>
                      +{dare.xp_value} XP
                    </Text>
                  </View>

                  <Text style={styles.dareTitle}>
                    {dare.title}
                  </Text>

                  <Text
                    style={styles.dareDescription}
                    numberOfLines={3}
                  >
                    {dare.description}
                  </Text>

                  <View style={styles.dareBottomRow}>
                    <Text style={styles.difficulty}>
                      {dare.difficulty}
                    </Text>

                    <Text style={styles.viewDare}>
                      View Dare ›
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function EmptyResult({
  text,
}: {
  text: string;
}) {
  return (
    <View style={styles.emptyResult}>
      <Text style={styles.emptyResultTitle}>
        Nothing found
      </Text>

      <Text style={styles.emptyResultText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  backText: {
    color: colors.primaryText,
    fontSize: 34,
    lineHeight: 36,
    fontFamily: fontFamily.body,
  },

  headerTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
  },

  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  input: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
  },

  searchButton: {
    minWidth: 82,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },

  searchButtonText: {
    color: colors.background,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  pressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.6,
  },

  tabs: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },

  tabText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  activeTabText: {
    color: colors.accent,
  },

  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
  },

  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  cardPressed: {
    opacity: 0.75,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  avatarText: {
    color: colors.background,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
  },

  resultInfo: {
    flex: 1,
  },

  resultTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
  },

  username: {
    color: colors.accent,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  resultDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    marginTop: spacing.xs,
  },

  chevron: {
    color: colors.secondaryText,
    fontSize: 28,
    marginLeft: spacing.sm,
  },

  dareCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  dareTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  categoryPill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },

  categoryText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },

  xp: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  dareTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
    marginTop: spacing.md,
  },

  dareDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  dareBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },

  difficulty: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
  },

  viewDare: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },

  emptyTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },

  emptyText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  emptyResult: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },

  emptyResultTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.md,
  },

  emptyResultText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  errorBox: {
    backgroundColor: '#241519',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  errorText: {
    color: colors.danger,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});