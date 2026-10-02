import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { DareCard, MockDare } from '../components/DareCard';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';

import {
    colors,
    fontSize,
    spacing,
} from '../constants/theme';

import { supabase } from '../lib/supabase';

type ActivityTab =
  | 'Overview'
  | 'Created'
  | 'Taken'
  | 'In Progress'
  | 'Completed';

type DareRow = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  xp_value: number;
  proof_type: string;
  creator_id: string;
  status: string;
  visibility: string;
  created_at: string;
};

type ParticipantRow = {
  id: string;
  dare_id: string;
  user_id: string;
  state: string;
  accepted_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  dare: DareRow | DareRow[] | null;
};

type ActivityDare = MockDare & {
  state?: string;
  completedAt?: string | null;
};

const tabs: ActivityTab[] = [
  'Overview',
  'Created',
  'Taken',
  'In Progress',
  'Completed',
];

function formatDifficulty(
  value: string,
): MockDare['difficulty'] {
  const normalized = value.toLowerCase();

  if (normalized === 'hard') {
    return 'Hard';
  }

  if (normalized === 'medium') {
    return 'Medium';
  }

  return 'Easy';
}

function formatProofType(
  value: string,
): MockDare['proofType'] {
  const normalized = value.toLowerCase();

  if (normalized === 'video') {
    return 'Video';
  }

  if (normalized === 'photo') {
    return 'Photo';
  }

  return 'Text';
}

function mapDare(dare: DareRow): ActivityDare {
  return {
    id: dare.id,
    title: dare.title,
    category: dare.category,
    difficulty: formatDifficulty(dare.difficulty),
    xpValue: dare.xp_value,
    proofType: formatProofType(dare.proof_type),
  };
}

function getSingleDare(
  value: DareRow | DareRow[] | null,
): DareRow | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MyActivityScreen() {
  const [activeTab, setActiveTab] =
    useState<ActivityTab>('Overview');

  const [createdDares, setCreatedDares] =
    useState<ActivityDare[]>([]);

  const [takenDares, setTakenDares] =
    useState<ActivityDare[]>([]);

  const [inProgressDares, setInProgressDares] =
    useState<ActivityDare[]>([]);

  const [completedDares, setCompletedDares] =
    useState<ActivityDare[]>([]);

  const [xpEarned, setXpEarned] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadActivity = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setCreatedDares([]);
          setTakenDares([]);
          setInProgressDares([]);
          setCompletedDares([]);
          setXpEarned(0);
          return;
        }

        /*
         * ============================================
         * CREATED DARES
         * ============================================
         */

        const {
          data: created,
          error: createdError,
        } = await supabase
          .from('dares')
          .select(
            'id, title, category, difficulty, xp_value, proof_type, creator_id, status, visibility, created_at',
          )
          .eq('creator_id', user.id)
          .order('created_at', {
            ascending: false,
          });

        if (createdError) {
          throw createdError;
        }

        const mappedCreated = (
          (created ?? []) as DareRow[]
        ).map(mapDare);

        setCreatedDares(mappedCreated);

        /*
         * ============================================
         * PARTICIPANT / TAKEN DARES
         * ============================================
         */

        const {
          data: participants,
          error: participantError,
        } = await supabase
          .from('dare_participants')
          .select(
            `
              id,
              dare_id,
              user_id,
              state,
              accepted_at,
              submitted_at,
              completed_at,
              created_at,
              dare:dares(
                id,
                title,
                category,
                difficulty,
                xp_value,
                proof_type,
                creator_id,
                status,
                visibility,
                created_at
              )
            `,
          )
          .eq('user_id', user.id)
          .order('created_at', {
            ascending: false,
          });

        if (participantError) {
          throw participantError;
        }

        const participantRows =
          (participants ??
            []) as ParticipantRow[];

        const taken: ActivityDare[] = [];
        const inProgress: ActivityDare[] = [];
        const completed: ActivityDare[] = [];

        let totalXp = 0;

        participantRows.forEach(
          (participant) => {
            const dare = getSingleDare(
              participant.dare,
            );

            if (!dare) {
              return;
            }

            const activityDare: ActivityDare = {
              ...mapDare(dare),
              state: participant.state,
              completedAt:
                participant.completed_at,
            };

            /*
             * Taken = every participant record
             */
            taken.push(activityDare);

            /*
             * In Progress
             *
             * Accepted, started, submitted or verified.
             */
            if (
              participant.state ===
                'ACCEPTED' ||
              participant.state ===
                'IN_PROGRESS' ||
              participant.state ===
                'SUBMITTED' ||
              participant.state ===
                'VERIFIED'
            ) {
              inProgress.push(activityDare);
            }

            /*
             * Completed
             */
            if (
              participant.state ===
              'COMPLETED'
            ) {
              completed.push(activityDare);

              totalXp +=
                Number(dare.xp_value) || 0;
            }
          },
        );

        setTakenDares(taken);
        setInProgressDares(inProgress);
        setCompletedDares(completed);
        setXpEarned(totalXp);
      } catch (err) {
        console.error(
          '[My Activity] Load error:',
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load your activity.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadActivity();
    }, [loadActivity]),
  );

  const renderDare = (
    dare: ActivityDare,
  ) => {
    return (
      <View
        key={dare.id}
        style={styles.dareWrapper}
      >
        <DareCard
          dare={dare}
          onPress={() => {
            router.push({
              pathname: '/dare-detail',
              params: {
                id: dare.id,
              },
            });
          }}
        />

        {dare.state && (
          <View style={styles.stateRow}>
            <Text style={styles.stateLabel}>
              {dare.state.replace(
                '_',
                ' ',
              )}
            </Text>

            {dare.completedAt && (
              <Text
                style={styles.dateText}
              >
                {formatDate(
                  dare.completedAt,
                )}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderList = (
    list: ActivityDare[],
    emptyTitle: string,
    emptyDescription: string,
  ) => {
    if (list.length === 0) {
      return (
        <EmptyState
          title={emptyTitle}
          description={
            emptyDescription
          }
        />
      );
    }

    return (
      <View style={styles.list}>
        {list.map(renderDare)}
      </View>
    );
  };

  return (
    <Screen>
      <AppHeader
        title="My Activity"
        leftSlot={
          <Pressable
            onPress={() =>
              router.replace('/(tabs)')
            }
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={10}
          >
            <Text
              style={styles.backArrow}
            >
              ‹
            </Text>
          </Pressable>
        }
      />

      {/* ============================================ */}
      {/* XP SUMMARY                                   */}
      {/* ============================================ */}

      <View style={styles.xpCard}>
        <View>
          <Text style={styles.xpLabel}>
            XP EARNED
          </Text>

          <Text style={styles.xpValue}>
            {xpEarned}
          </Text>

          <Text style={styles.xpSubtext}>
            From completed Dares
          </Text>
        </View>

        <View style={styles.xpStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {createdDares.length}
            </Text>

            <Text style={styles.statLabel}>
              Created
            </Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {takenDares.length}
            </Text>

            <Text style={styles.statLabel}>
              Taken
            </Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {completedDares.length}
            </Text>

            <Text style={styles.statLabel}>
              Completed
            </Text>
          </View>
        </View>
      </View>

      {/* ============================================ */}
      {/* TABS                                         */}
      {/* ============================================ */}

      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const selected =
            activeTab === tab;

          return (
            <Pressable
              key={tab}
              onPress={() =>
                setActiveTab(tab)
              }
              style={[
                styles.tab,
                selected &&
                  styles.tabSelected,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  selected &&
                    styles.tabTextSelected,
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ============================================ */}
      {/* CONTENT                                      */}
      {/* ============================================ */}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.accent}
          />

          <Text style={styles.loadingText}>
            Loading activity...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadActivity}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : activeTab ===
        'Overview' ? (
        <View style={styles.overview}>
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              In Progress
            </Text>

            {renderList(
              inProgressDares.slice(
                0,
                3,
              ),
              'Nothing in progress',
              'Accept a Dare and start your challenge.',
            )}

            {inProgressDares.length >
              3 && (
              <Pressable
                onPress={() =>
                  setActiveTab(
                    'In Progress',
                  )
                }
                style={styles.viewAllButton}
              >
                <Text
                  style={
                    styles.viewAllText
                  }
                >
                  View all
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Completed
            </Text>

            {renderList(
              completedDares.slice(
                0,
                3,
              ),
              'No completed Dares',
              'Complete your first Dare to see it here.',
            )}

            {completedDares.length >
              3 && (
              <Pressable
                onPress={() =>
                  setActiveTab(
                    'Completed',
                  )
                }
                style={styles.viewAllButton}
              >
                <Text
                  style={
                    styles.viewAllText
                  }
                >
                  View all
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Created Dares
            </Text>

            {renderList(
              createdDares.slice(
                0,
                3,
              ),
              'No Dares created',
              'Create your first Dare and challenge the community.',
            )}

            {createdDares.length >
              3 && (
              <Pressable
                onPress={() =>
                  setActiveTab(
                    'Created',
                  )
                }
                style={styles.viewAllButton}
              >
                <Text
                  style={
                    styles.viewAllText
                  }
                >
                  View all
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : activeTab ===
        'Created' ? (
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Created Dares
          </Text>

          {renderList(
            createdDares,
            'No Dares created',
            'Create your first Dare and challenge the community.',
          )}
        </View>
      ) : activeTab ===
        'Taken' ? (
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Taken Dares
          </Text>

          {renderList(
            takenDares,
            'No Dares taken',
            'Accept a Dare from Home or Discover.',
          )}
        </View>
      ) : activeTab ===
        'In Progress' ? (
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            In Progress
          </Text>

          {renderList(
            inProgressDares,
            'Nothing in progress',
            'Accept a Dare and start your challenge.',
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Completed
          </Text>

          {renderList(
            completedDares,
            'No completed Dares',
            'Complete your first Dare to see it here.',
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backArrow: {
    color: colors.primaryText,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '300',
  },

  xpCard: {
    backgroundColor:
      colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  xpLabel: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },

  xpValue: {
    color: colors.primaryText,
    fontSize: 36,
    fontWeight: '800',
    marginTop: spacing.xs,
  },

  xpSubtext: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  xpStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  stat: {
    flex: 1,
  },

  statValue: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },

  statLabel: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    marginRight: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabSelected: {
    borderBottomColor: colors.accent,
  },

  tabText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  tabTextSelected: {
    color: colors.accent,
    fontWeight: '800',
  },

  overview: {
    paddingBottom: spacing.xl,
  },

  section: {
    marginBottom: spacing.xl,
  },

  sectionTitle: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginBottom: spacing.md,
  },

  list: {
    gap: spacing.md,
  },

  dareWrapper: {
    marginBottom: spacing.sm,
  },

  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
    paddingHorizontal: spacing.sm,
  },

  stateLabel: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  dateText: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
  },

  viewAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },

  viewAllText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  loadingText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  retryText: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});