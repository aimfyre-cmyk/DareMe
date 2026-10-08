import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type Reward = {
  id: string;
  icon: string;
  title: string;
  description: string;
  target: number;
};

type ClaimedReward = {
  reward_id: string;
  reward_title: string;
  claimed_at: string;
};

const rewardDefinitions: Reward[] = [
  {
    id: 'first-dare',
    icon: '🎯',
    title: 'First Dare',
    description: 'Complete your first dare.',
    target: 1,
  },
  {
    id: 'five-dares',
    icon: '🔥',
    title: 'Dare Starter',
    description: 'Complete 5 dares.',
    target: 5,
  },
  {
    id: 'ten-dares',
    icon: '⚡',
    title: 'Dare Runner',
    description: 'Complete 10 dares.',
    target: 10,
  },
  {
    id: 'fifty-dares',
    icon: '🏆',
    title: 'Dare Champion',
    description: 'Complete 50 dares.',
    target: 50,
  },
  {
    id: 'hundred-dares',
    icon: '👑',
    title: 'Dare Legend',
    description: 'Complete 100 dares.',
    target: 100,
  },
];

export default function RewardsScreen() {
  const [completedDares, setCompletedDares] = useState(0);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [isDareMaster, setIsDareMaster] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [claimedRewardIds, setClaimedRewardIds] = useState<string[]>([]);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);

  const loadRewardsProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error('You must be logged in to view rewards.');
      }

      /*
       * Completed Dare count
       *
       * The final Dare flow can use VERIFIED or COMPLETED,
       * so both completed states are counted.
       */
      const { count, error: countError } = await supabase
        .from('dare_participants')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('user_id', user.id)
        .in('state', ['VERIFIED', 'COMPLETED']);

      if (countError) {
        throw countError;
      }

      setCompletedDares(count ?? 0);

      /*
       * Claimed rewards
       */
      const {
        data: rewards,
        error: rewardsError,
      } = await supabase
        .from('user_rewards')
        .select('reward_id, reward_title, claimed_at')
        .eq('user_id', user.id)
        .order('claimed_at', {
          ascending: false,
        });

      if (rewardsError) {
        throw rewardsError;
      }

      const loadedRewards =
        (rewards ?? []) as ClaimedReward[];

      setClaimedRewards(loadedRewards);

      setClaimedRewardIds(
        loadedRewards.map(
          (reward) => reward.reward_id,
        ),
      );

      /*
       * Global rank
       */
      const {
        data: rankData,
        error: rankError,
      } = await supabase.rpc(
        'get_global_user_rank',
        {
          p_user_id: user.id,
        },
      );

      if (rankError) {
        throw rankError;
      }

      const rankRow = Array.isArray(rankData)
        ? rankData[0]
        : rankData;

      const rank =
        rankRow?.rank !== undefined &&
        rankRow?.rank !== null
          ? Number(rankRow.rank)
          : null;

      setGlobalRank(rank);

      setIsDareMaster(
        Boolean(rankRow?.is_dare_master) ||
          rank === 1,
      );
    } catch (err) {
      console.error(
        '[Rewards] Failed to load:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load rewards progress.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRewardsProgress();
    }, [loadRewardsProgress]),
  );

  const claimReward = async (reward: Reward) => {
    try {
      setClaimingReward(reward.id);
      setError(null);

      const {
        data: claimedReward,
        error: claimError,
      } = await supabase.rpc('claim_reward', {
        p_reward_id: reward.id,
        p_reward_title: reward.title,
        p_required_dares: reward.target,
      });

      if (claimError) {
        throw claimError;
      }

      setClaimedRewardIds((current) =>
        current.includes(reward.id)
          ? current
          : [...current, reward.id],
      );

      if (claimedReward) {
        const rewardRow =
          claimedReward as ClaimedReward;

        setClaimedRewards((current) => [
          rewardRow,
          ...current.filter(
            (item) =>
              item.reward_id !== reward.id,
          ),
        ]);
      } else {
        await loadRewardsProgress();
      }
    } catch (err) {
      console.error(
        '[Rewards] Claim failed:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not claim reward.',
      );
    } finally {
      setClaimingReward(null);
    }
  };

  const claimDareMaster = async () => {
    try {
      setClaimingReward('dare-master');
      setError(null);

      const {
        data: claimedReward,
        error: claimError,
      } = await supabase.rpc(
        'claim_dare_master_reward',
      );

      if (claimError) {
        throw claimError;
      }

      if (claimedReward) {
        const rewardRow =
          claimedReward as ClaimedReward;

        setClaimedRewards((current) => [
          rewardRow,
          ...current.filter(
            (item) =>
              item.reward_id !==
              rewardRow.reward_id,
          ),
        ]);

        setClaimedRewardIds((current) =>
          current.includes(
            rewardRow.reward_id,
          )
            ? current
            : [
                ...current,
                rewardRow.reward_id,
              ],
        );
      } else {
        await loadRewardsProgress();
      }
    } catch (err) {
      console.error(
        '[Rewards] Dare Master claim failed:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not claim Dare Master reward.',
      );
    } finally {
      setClaimingReward(null);
    }
  };

  const isDareMasterClaimed =
    claimedRewards.some(
      (reward) =>
        reward.reward_id === 'dare-master' ||
        reward.reward_title
          .toLowerCase()
          .includes('dare master'),
    );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>
            Rewards
          </Text>

          <Text style={styles.headerSubtitle}>
            Earn badges and unlock rewards
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>
              YOUR REWARDS
            </Text>

            <Text style={styles.summaryTitle}>
              {loading
                ? 'Loading progress...'
                : `${completedDares} Dare${
                    completedDares === 1
                      ? ''
                      : 's'
                  } completed`}
            </Text>

            <Text style={styles.summaryDescription}>
              Complete milestones to unlock
              exclusive rewards and badges.
            </Text>
          </View>

          <Text style={styles.summaryIcon}>
            🏆
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadRewardsProgress}
              activeOpacity={0.8}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Available Rewards */}
        <Text style={styles.sectionTitle}>
          Available Rewards
        </Text>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              size="small"
              color="#ffffff"
            />

            <Text style={styles.loadingText}>
              Loading reward progress...
            </Text>
          </View>
        ) : (
          <>
            {rewardDefinitions.map((reward) => {
              const progress = Math.min(
                completedDares /
                  reward.target,
                1,
              );

              const unlocked =
                completedDares >=
                reward.target;

              const claimed =
                claimedRewardIds.includes(
                  reward.id,
                );

              return (
                <View
                  key={reward.id}
                  style={styles.rewardCard}
                >
                  <View style={styles.rewardTop}>
                    <View style={styles.iconBox}>
                      <Text
                        style={styles.rewardIcon}
                      >
                        {reward.icon}
                      </Text>
                    </View>

                    <View style={styles.rewardInfo}>
                      <Text
                        style={styles.rewardTitle}
                      >
                        {reward.title}
                      </Text>

                      <Text
                        style={
                          styles.rewardDescription
                        }
                      >
                        {reward.description}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        unlocked &&
                          !claimed &&
                          styles.unlockedBadge,
                        claimed &&
                          styles.claimedBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          unlocked &&
                            !claimed &&
                            styles.unlockedStatusText,
                          claimed &&
                            styles.claimedStatusText,
                        ]}
                      >
                        {claimed
                          ? 'CLAIMED'
                          : unlocked
                            ? 'UNLOCKED'
                            : 'LOCKED'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressRow}>
                    <Text
                      style={styles.progressText}
                    >
                      {Math.min(
                        completedDares,
                        reward.target,
                      )}{' '}
                      / {reward.target}
                    </Text>

                    <Text
                      style={
                        styles.progressPercent
                      }
                    >
                      {Math.round(
                        progress * 100,
                      )}
                      %
                    </Text>
                  </View>

                  <View
                    style={
                      styles.progressBackground
                    }
                  >
                    <View
                      style={[
                        styles.progressFill,
                        unlocked &&
                          styles.unlockedProgressFill,
                        {
                          width: `${progress * 100}%`,
                        },
                      ]}
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      !unlocked &&
                        styles.lockedButton,
                      unlocked &&
                        !claimed &&
                        styles.unlockedButton,
                      claimed &&
                        styles.claimedButton,
                    ]}
                    disabled={
                      !unlocked ||
                      claimed ||
                      claimingReward ===
                        reward.id
                    }
                    onPress={() =>
                      claimReward(reward)
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        !unlocked &&
                          styles.lockedButtonText,
                        unlocked &&
                          !claimed &&
                          styles.unlockedButtonText,
                        claimed &&
                          styles.claimedButtonText,
                      ]}
                    >
                      {claimed
                        ? 'Claimed'
                        : claimingReward ===
                            reward.id
                          ? 'Claiming...'
                          : unlocked
                            ? 'Claim Reward'
                            : 'Locked'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Dare Master */}
            <View style={styles.rewardCard}>
              <View style={styles.rewardTop}>
                <View style={styles.iconBox}>
                  <Text style={styles.rewardIcon}>
                    👑
                  </Text>
                </View>

                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>
                    Dare Master
                  </Text>

                  <Text
                    style={
                      styles.rewardDescription
                    }
                  >
                    Reach #1 on the all-time global
                    ranking.
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    isDareMaster &&
                      styles.unlockedBadge,
                    isDareMasterClaimed &&
                      styles.claimedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isDareMaster &&
                        !isDareMasterClaimed &&
                        styles.unlockedStatusText,
                      isDareMasterClaimed &&
                        styles.claimedStatusText,
                    ]}
                  >
                    {isDareMasterClaimed
                      ? 'CLAIMED'
                      : isDareMaster
                        ? 'UNLOCKED'
                        : 'LOCKED'}
                  </Text>
                </View>
              </View>

              <View style={styles.progressRow}>
                <Text
                  style={styles.progressText}
                >
                  Your all-time rank
                </Text>

                <Text
                  style={styles.progressPercent}
                >
                  {globalRank
                    ? `#${globalRank}`
                    : '--'}
                </Text>
              </View>

              <View
                style={
                  styles.progressBackground
                }
              >
                <View
                  style={[
                    styles.progressFill,
                    isDareMaster &&
                      styles.unlockedProgressFill,
                    {
                      width: isDareMaster
                        ? '100%'
                        : '0%',
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  !isDareMaster &&
                    styles.lockedButton,
                  isDareMaster &&
                    !isDareMasterClaimed &&
                    styles.unlockedButton,
                  isDareMasterClaimed &&
                    styles.claimedButton,
                ]}
                disabled={
                  !isDareMaster ||
                  isDareMasterClaimed ||
                  claimingReward ===
                    'dare-master'
                }
                onPress={claimDareMaster}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    !isDareMaster &&
                      styles.lockedButtonText,
                    isDareMaster &&
                      !isDareMasterClaimed &&
                      styles.unlockedButtonText,
                    isDareMasterClaimed &&
                      styles.claimedButtonText,
                  ]}
                >
                  {isDareMasterClaimed
                    ? 'Claimed'
                    : claimingReward ===
                        'dare-master'
                      ? 'Claiming...'
                      : isDareMaster
                        ? 'Claim Reward'
                        : 'Locked'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* My Rewards */}
        <Text style={styles.sectionTitle}>
          My Rewards
        </Text>

        {claimedRewards.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              🎁
            </Text>

            <Text style={styles.emptyTitle}>
              No rewards claimed yet
            </Text>

            <Text
              style={styles.emptyDescription}
            >
              Your claimed rewards will appear
              here.
            </Text>
          </View>
        ) : (
          <View style={styles.claimedList}>
            {claimedRewards.map((reward) => (
              <View
                key={`${reward.reward_id}-${reward.claimed_at}`}
                style={styles.claimedCard}
              >
                <Text
                  style={styles.claimedIcon}
                >
                  {reward.reward_id === 'dare-master' ||
reward.reward_title.toLowerCase().includes('master')
  ? '👑'
  : reward.reward_id.startsWith('dare-winner-') ||
      reward.reward_title.toLowerCase().includes('dare winner')
    ? '🏆'
    : '🎁'}
                </Text>

                <View
                  style={styles.claimedInfo}
                >
                  <Text
                    style={styles.claimedTitle}
                  >
                    {reward.reward_title}
                  </Text>

                  <Text
                    style={
                      styles.claimedDescription
                    }
                  >
                    Reward claimed successfully
                  </Text>
                </View>

                <Text
                  style={styles.claimedCheck}
                >
                  ✓
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Reward History */}
        <Text style={styles.sectionTitle}>
          Reward History
        </Text>

        {claimedRewards.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              📜
            </Text>

            <Text style={styles.emptyTitle}>
              No reward history
            </Text>

            <Text
              style={styles.emptyDescription}
            >
              Your reward activity will appear
              here.
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {claimedRewards.map((reward) => (
              <View
                key={`${reward.reward_id}-${reward.claimed_at}`}
                style={styles.historyCard}
              >
                <View
                  style={styles.historyIconBox}
                >
                  <Text
                    style={styles.historyIcon}
                  >
                    {reward.reward_id === 'dare-master' ||
reward.reward_title.toLowerCase().includes('master')
  ? '👑'
  : reward.reward_id.startsWith('dare-winner-') ||
      reward.reward_title.toLowerCase().includes('dare winner')
    ? '🏆'
    : '🎁'}
                  </Text>
                </View>

                <View
                  style={styles.historyInfo}
                >
                  <Text
                    style={styles.historyTitle}
                  >
                    {reward.reward_title}
                  </Text>

                  <Text
                    style={styles.historyDate}
                  >
                    Claimed on{' '}
                    {new Date(
                      reward.claimed_at,
                    ).toLocaleDateString()}
                  </Text>
                </View>

                <Text
                  style={styles.historyCheck}
                >
                  ✓
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },

  header: {
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backText: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 32,
    marginTop: -3,
  },

  headerTitle: {
    color: '#ffffff',
    fontSize: 25,
    fontWeight: '800',
  },

  headerSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 2,
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  summaryCard: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#18181b',
    borderRadius: 18,
    padding: 18,
    marginBottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryLabel: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  summaryTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 5,
  },

  summaryDescription: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 270,
  },

  summaryIcon: {
    fontSize: 42,
  },

  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 4,
  },

  rewardCard: {
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  rewardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#1f1f22',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rewardIcon: {
    fontSize: 25,
  },

  rewardInfo: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },

  rewardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  rewardDescription: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },

  unlockedBadge: {
    backgroundColor: '#ffffff',
  },

  claimedBadge: {
    backgroundColor: '#27272a',
  },

  statusText: {
    color: '#a1a1aa',
    fontSize: 9,
    fontWeight: '900',
  },

  unlockedStatusText: {
    color: '#09090b',
  },

  claimedStatusText: {
    color: '#a1a1aa',
  },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 17,
    marginBottom: 7,
  },

  progressText: {
    color: '#a1a1aa',
    fontSize: 11,
  },

  progressPercent: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  progressBackground: {
    height: 7,
    borderRadius: 10,
    backgroundColor: '#27272a',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },

  unlockedProgressFill: {
    backgroundColor: '#ffffff',
  },

  actionButton: {
    marginTop: 14,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockedButton: {
    backgroundColor: '#1f1f22',
  },

  unlockedButton: {
    backgroundColor: '#ffffff',
  },

  claimedButton: {
    backgroundColor: '#27272a',
  },

  actionButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },

  lockedButtonText: {
    color: '#71717a',
  },

  unlockedButtonText: {
    color: '#09090b',
  },

  claimedButtonText: {
    color: '#a1a1aa',
  },

  claimedList: {
    marginBottom: 10,
  },

  claimedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },

  claimedIcon: {
    fontSize: 28,
  },

  claimedInfo: {
    flex: 1,
    marginLeft: 12,
  },

  claimedTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  claimedDescription: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 3,
  },

  claimedCheck: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },

  historyList: {
    marginBottom: 10,
  },

  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },

  historyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1f1f22',
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyIcon: {
    fontSize: 22,
  },

  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },

  historyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  historyDate: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 4,
  },

  historyCheck: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },

  loadingCard: {
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    backgroundColor: '#141416',
    paddingVertical: 30,
    alignItems: 'center',
    marginBottom: 26,
  },

  loadingText: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 10,
  },

  errorCard: {
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    backgroundColor: '#141416',
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },

  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#27272a',
  },

  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    backgroundColor: '#141416',
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 26,
  },

  emptyIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  emptyDescription: {
    color: '#71717a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
});