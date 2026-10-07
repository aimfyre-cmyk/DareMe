import { AppHeader } from '@/components/AppHeader';



import { Screen } from '@/components/Screen';



import { colors as baseColors, fontSize, spacing } from '@/constants/theme';



const colors = {

  ...baseColors,

  primary: baseColors.accent,

  text: baseColors.primaryText,

  textSecondary: baseColors.secondaryText,

} as const;



import { supabase } from '@/lib/supabase';



import { useFocusEffect } from 'expo-router';



import { useCallback, useEffect, useMemo, useState } from 'react';



import { Ionicons } from '@expo/vector-icons';



import {
    ActivityIndicator,



    Pressable,



    RefreshControl,



    ScrollView,



    StyleSheet,



    Text,



    View,
} from 'react-native';







type Period = 'weekly' | 'monthly' | 'overall';







type ReceivedStats = {



  views: number;



  reactions: number;



  comments: number;



  shares: number;



  saves: number;



  votes: number;



};







type JourneyStats = {



  dares_created: number;



  dares_participated: number;



  dares_completed: number;



  xp_earned: number;



  current_streak: number;



  highest_streak: number;



};







type PreviousPeriod = {



  received: ReceivedStats;



  journey: {



    dares_created: number;



    dares_participated: number;



    dares_completed: number;



    xp_earned: number;



  };



};







type Badge = {



  key: string;



  name: string;



  description: string;



  icon_url?: string | null;



  earned_at?: string | null;



};







type Reward = {



  reward_id: string;



  reward_title: string;



  claimed_at?: string | null;



};







type BestDare = {



  id: string;



  title: string;



  reactions: number;



  comments: number;



  shares: number;



  saves: number;



  votes: number;



  score: number;



};







type DashboardData = {



  period: Period;







  received: ReceivedStats;







  journey: JourneyStats;







  previous_period?: PreviousPeriod;







  overall?: {



    lifetime_xp: number;



    global_rank: number | null;



    is_dare_master: boolean;



    current_streak: number;



    highest_streak: number;



    badges: Badge[];



    rewards: Reward[];



  };







  highlights?: {



    best_dare?: BestDare | null;



  };



};







const EMPTY_DATA: DashboardData = {



  period: 'weekly',







  received: {



    views: 0,



    reactions: 0,



    comments: 0,



    shares: 0,



    saves: 0,



    votes: 0,



  },







  journey: {



    dares_created: 0,



    dares_participated: 0,



    dares_completed: 0,



    xp_earned: 0,



    current_streak: 0,



    highest_streak: 0,



  },







  previous_period: {



    received: {



      views: 0,



      reactions: 0,



      comments: 0,



      shares: 0,



      saves: 0,



      votes: 0,



    },



    journey: {



      dares_created: 0,



      dares_participated: 0,



      dares_completed: 0,



      xp_earned: 0,



    },



  },







  overall: {



    lifetime_xp: 0,



    global_rank: null,



    is_dare_master: false,



    current_streak: 0,



    highest_streak: 0,



    badges: [],



    rewards: [],



  },







  highlights: {



    best_dare: null,



  },



};







function number(value: unknown): number {



  const n = Number(value);



  return Number.isFinite(n) ? n : 0;



}







function normalizeDashboard(raw: any, period: Period): DashboardData {



  const received = raw?.received ?? {};



  const journey = raw?.journey ?? {};



  const previous = raw?.previous_period ?? {};



  const previousReceived = previous?.received ?? {};



  const previousJourney = previous?.journey ?? {};



  const overall = raw?.overall ?? {};



  const highlights = raw?.highlights ?? {};







  return {



    period,







    received: {



      views: number(received.views),



      reactions: number(received.reactions),



      comments: number(received.comments),



      shares: number(received.shares),



      saves: number(received.saves),



      votes: number(received.votes),



    },







    journey: {



      dares_created: number(journey.dares_created),



      dares_participated: number(journey.dares_participated),



      dares_completed: number(journey.dares_completed),



      xp_earned: number(journey.xp_earned),



      current_streak: number(



        journey.current_streak ?? overall.current_streak,



      ),



      highest_streak: number(



        journey.highest_streak ?? overall.highest_streak,



      ),



    },







    previous_period: {



      received: {



        views: number(previousReceived.views),



        reactions: number(previousReceived.reactions),



        comments: number(previousReceived.comments),



        shares: number(previousReceived.shares),



        saves: number(previousReceived.saves),



        votes: number(previousReceived.votes),



      },







      journey: {



        dares_created: number(previousJourney.dares_created),



        dares_participated: number(previousJourney.dares_participated),



        dares_completed: number(previousJourney.dares_completed),



        xp_earned: number(previousJourney.xp_earned),



      },



    },







    overall: {



      lifetime_xp: number(overall.lifetime_xp),



      global_rank:



        overall.global_rank === null ||



        overall.global_rank === undefined



          ? null



          : number(overall.global_rank),



      is_dare_master: Boolean(overall.is_dare_master),



      current_streak: number(



        overall.current_streak ?? journey.current_streak,



      ),



      highest_streak: number(



        overall.highest_streak ?? journey.highest_streak,



      ),



      badges: Array.isArray(overall.badges) ? overall.badges : [],



      rewards: Array.isArray(overall.rewards) ? overall.rewards : [],



    },







    highlights: {



      best_dare: highlights.best_dare



        ? {



            id: String(highlights.best_dare.id ?? ''),



            title: String(highlights.best_dare.title ?? 'Untitled Dare'),



            reactions: number(highlights.best_dare.reactions),



            comments: number(highlights.best_dare.comments),



            shares: number(highlights.best_dare.shares),



            saves: number(highlights.best_dare.saves),



            votes: number(highlights.best_dare.votes),



            score: number(highlights.best_dare.score),



          }



        : null,



    },



  };



}







function formatNumber(value: number): string {



  return new Intl.NumberFormat('en-IN').format(number(value));



}







function getGrowth(current: number, previous: number): number {



  if (previous === 0) {



    if (current === 0) return 0;



    return 100;



  }







  return Math.round(((current - previous) / previous) * 100);



}







function GrowthText({



  current,



  previous,



}: {



  current: number;



  previous: number;



}) {



  const growth = getGrowth(current, previous);







  if (growth === 0) {



    return <Text style={styles.growthNeutral}>No change</Text>;



  }







  return (



    <Text



      style={[



        styles.growthText,



        growth > 0 ? styles.growthPositive : styles.growthNegative,



      ]}



    >



      {growth > 0 ? '+' : ''}



      {growth}% vs previous



    </Text>



  );



}







function MetricCard({

  icon,

  label,

  value,

  previous,

  showComparison = false,

}: {

  icon: string;

  label: string;

  value: number;

  previous?: number;

  showComparison?: boolean;

}) {

  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {

    '👀': 'eye-outline',

    '❤️': 'heart-outline',

    '💬': 'chatbubble-outline',

    '↗️': 'share-social-outline',

    '🔖': 'bookmark-outline',

    '🗳️': 'checkmark-circle-outline',

    '🎯': 'create-outline',

    '🔥': 'flame-outline',

    '✅': 'checkmark-circle-outline',

    '⚡': 'flash-outline',

    '🏆': 'ribbon-outline',

  };



  return (

    <View style={styles.metricCard}>

      <View style={styles.metricIconBox}>

        <Ionicons

          name={iconMap[icon] ?? 'stats-chart-outline'}

          size={22}

          color={colors.text}

        />

      </View>



      <Text style={styles.metricValue}>{formatNumber(value)}</Text>

      <Text style={styles.metricLabel}>{label}</Text>



      {showComparison && previous !== undefined ? (

        <GrowthText current={value} previous={previous} />

      ) : null}

    </View>

  );

}





function SectionTitle({



  title,



  subtitle,



}: {



  title: string;



  subtitle?: string;



}) {



  return (



    <View style={styles.sectionHeader}>



      <Text style={styles.sectionTitle}>{title}</Text>







      {subtitle ? (



        <Text style={styles.sectionSubtitle}>{subtitle}</Text>



      ) : null}



    </View>



  );



}







function StatRow({



  label,



  value,



}: {



  label: string;



  value: string | number;



}) {



  return (



    <View style={styles.statRow}>



      <Text style={styles.statRowLabel}>{label}</Text>



      <Text style={styles.statRowValue}>{value}</Text>



    </View>



  );



}







export default function DashboardScreen() {



  const [selectedPeriod, setSelectedPeriod] =



    useState<Period>('weekly');







  const [data, setData] = useState<DashboardData>(EMPTY_DATA);







  const [loading, setLoading] = useState(true);



  const [refreshing, setRefreshing] = useState(false);



  const [error, setError] = useState<string | null>(null);







  const loadDashboard = useCallback(



    async (isRefresh = false) => {



      try {



        if (isRefresh) {



          setRefreshing(true);



        } else {



          setLoading(true);



        }







        setError(null);







        const { data: rpcData, error: rpcError } = await supabase.rpc(



          'get_dashboard_stats',



          {



            p_period: selectedPeriod,



          },



        );







        if (rpcError) {



          throw rpcError;



        }







        const normalized = normalizeDashboard(



          rpcData,



          selectedPeriod,



        );







        setData(normalized);



      } catch (err: any) {



        console.error(



          'Dashboard RPC error:',



          err,



        );







        setError(



          err?.message ||



            'Unable to load dashboard right now.',



        );



      } finally {



        setLoading(false);



        setRefreshing(false);



      }



    },



    [selectedPeriod],



  );







  useEffect(() => {



    loadDashboard();



  }, [loadDashboard]);







  useFocusEffect(



    useCallback(() => {



      loadDashboard(true);



    }, [loadDashboard]),



  );







  const previous = data.previous_period ?? EMPTY_DATA.previous_period!;







  const isOverall = selectedPeriod === 'overall';







  const overall = data.overall ?? EMPTY_DATA.overall!;







  const badges = overall.badges ?? [];







  const rewards = overall.rewards ?? [];







  const bestDare = data.highlights?.best_dare ?? null;







  const periodLabel = useMemo(() => {



    if (selectedPeriod === 'weekly') return 'This week';



    if (selectedPeriod === 'monthly') return 'This month';



    return 'All time';



  }, [selectedPeriod]);







  if (loading && !refreshing) {



    return (



      <Screen>



        <AppHeader title="Dashboard" />







        <View style={styles.loadingContainer}>



          <ActivityIndicator



            size="large"



            color={colors.primary}



          />







          <Text style={styles.loadingText}>



            Loading your dashboard...



          </Text>



        </View>



      </Screen>



    );



  }







  return (



    <Screen>



      <AppHeader title="Dashboard" />







      <ScrollView



        showsVerticalScrollIndicator={false}



        refreshControl={



          <RefreshControl



            refreshing={refreshing}



            onRefresh={() => loadDashboard(true)}



          />



        }



        contentContainerStyle={styles.container}



      >



        <View style={styles.intro}>



          <Text style={styles.title}>



            Your Performance



          </Text>







          <Text style={styles.subtitle}>



            See how your DareShot content is performing.



          </Text>



        </View>







        {/* PERIOD TABS */}







        <View style={styles.tabs}>



          {(['weekly', 'monthly', 'overall'] as Period[]).map(



            (period) => {



              const active =



                selectedPeriod === period;







              return (



                <Pressable



                  key={period}



                  onPress={() =>



                    setSelectedPeriod(period)



                  }



                  style={[



                    styles.tab,



                    active && styles.tabActive,



                  ]}



                >



                  <Text



                    style={[



                      styles.tabText,



                      active && styles.tabTextActive,



                    ]}



                  >



                    {period === 'weekly'



                      ? 'Weekly'



                      : period === 'monthly'



                        ? 'Monthly'



                        : 'Overall'}



                  </Text>



                </Pressable>



              );



            },



          )}



        </View>







        {error ? (



          <View style={styles.errorBox}>



            <Text style={styles.errorTitle}>



              Dashboard couldn't load



            </Text>







            <Text style={styles.errorText}>



              {error}



            </Text>







            <Pressable



              style={styles.retryButton}



              onPress={() => loadDashboard()}



            >



              <Text style={styles.retryText}>



                Retry



              </Text>



            </Pressable>



          </View>



        ) : null}







        {/* RECEIVED */}







        <SectionTitle



          title="Received"



          subtitle={`${periodLabel} engagement on your own Dares`}



        />







        <View style={styles.grid}>



          <MetricCard



                      icon="❤️"



                      label="Reactions Received"



                      value={data.received.reactions}



                      previous={previous.received.reactions}



                    />



          <MetricCard



                      icon="💬"



                      label="Comments Received"



                      value={data.received.comments}



                      previous={previous.received.comments}



                    />



          <MetricCard



                      icon="↗️"



                      label="Shares Received"



                      value={data.received.shares}



                      previous={previous.received.shares}



                    />



          <MetricCard



                      icon="🔖"



                      label="Saves Received"



                      value={data.received.saves}



                      previous={previous.received.saves}



                    />



          <MetricCard



                      icon="🗳️"



                      label="Votes Received"



                      value={data.received.votes}



                      previous={previous.received.votes}



                    />



          <MetricCard



                      icon="👀"



                      label="Views Received"



                      value={data.received.views}



                      previous={previous.received.views}



                    />



        </View>







        {/* JOURNEY */}







        <SectionTitle



          title="Your Journey"



          subtitle="Your own activity and progress"



        />







        <View style={styles.grid}>



          <MetricCard



            icon="🎯"



            label="Dares Created"



            value={data.journey.dares_created}



            previous={



              previous.journey.dares_created



            }



          />







          <MetricCard



            icon="🔥"



            label="Dares Participated"



            value={



              data.journey.dares_participated



            }



            previous={



              previous.journey.dares_participated



            }



          />







          <MetricCard



            icon="✅"



            label="Dares Completed"



            value={data.journey.dares_completed}



            previous={



              previous.journey.dares_completed



            }



          />







          <MetricCard



            icon="⚡"



            label="XP Earned"



            value={data.journey.xp_earned}



            previous={previous.journey.xp_earned}



          />







          <MetricCard



            icon="🔥"



            label="Current Streak"



            value={data.journey.current_streak}



            showComparison={false}



          />







          <MetricCard



            icon="🏆"



            label="Highest Streak"



            value={data.journey.highest_streak}



            showComparison={false}



          />



        </View>







        {/* OVERALL ACCOUNT */}







        {isOverall ? (



          <>



            <SectionTitle



              title="Overall"



              subtitle="Your complete DareMe profile performance"



            />







            <View style={styles.overallCard}>



              <View style={styles.rankHero}>



                <Text style={styles.rankIcon}>



                  🏆



                </Text>







                <View style={styles.rankContent}>



                  <Text style={styles.rankLabel}>



                    Global Rank



                  </Text>







                  <Text style={styles.rankValue}>



                    {overall.global_rank !== null



                      ? `#${formatNumber(



                          overall.global_rank,



                        )}`



                      : '—'}



                  </Text>







                  {overall.is_dare_master ? (



                    <View style={styles.masterBadge}>



                      <Text



                        style={



                          styles.masterBadgeText



                        }



                      >



                        👑 DARE MASTER



                      </Text>



                    </View>



                  ) : null}



                </View>



              </View>







              <View style={styles.divider} />







              <StatRow



                label="Lifetime XP"



                value={formatNumber(



                  overall.lifetime_xp,



                )}



              />







              <StatRow



                label="Current Streak"



                value={`${formatNumber(



                  overall.current_streak,



                )} days`}



              />







              <StatRow



                label="Highest Streak"



                value={`${formatNumber(



                  overall.highest_streak,



                )} days`}



              />



            </View>







            {/* BADGES */}







            <SectionTitle



              title="Badges"



              subtitle={



                badges.length



                  ? `${badges.length} earned`



                  : 'Earn badges by completing milestones'



              }



            />







            {badges.length > 0 ? (



              <View style={styles.badgesCard}>



                {badges.map((badge, index) => (



                  <View



                    key={`${badge.key}-${index}`}



                    style={styles.badgeItem}



                  >



                    <View style={styles.badgeIcon}>



                      <Text



                        style={



                          styles.badgeIconText



                        }



                      >



                        🏅



                      </Text>



                    </View>







                    <View style={styles.badgeContent}>



                      <Text



                        style={styles.badgeName}



                      >



                        {badge.name}



                      </Text>







                      {!!badge.description && (



                        <Text



                          style={



                            styles.badgeDescription



                          }



                          numberOfLines={2}



                        >



                          {badge.description}



                        </Text>



                      )}



                    </View>



                  </View>



                ))}



              </View>



            ) : (



              <View style={styles.emptyCard}>



                <Text style={styles.emptyIcon}>



                  🏅



                </Text>







                <Text style={styles.emptyTitle}>



                  No badges yet



                </Text>







                <Text style={styles.emptyText}>



                  Keep completing Dares to unlock



                  badges.



                </Text>



              </View>



            )}







            {/* REWARDS */}







            <SectionTitle



              title="Rewards"



              subtitle={



                rewards.length



                  ? `${rewards.length} claimed`



                  : 'Your claimed rewards will appear here'



              }



            />







            {rewards.length > 0 ? (



              <View style={styles.rewardsCard}>



                {rewards.map((reward, index) => (



                  <View



                    key={`${reward.reward_id}-${index}`}



                    style={styles.rewardItem}



                  >



                    <View style={styles.rewardIcon}>



                      <Text



                        style={



                          styles.rewardIconText



                        }



                      >



                        🎁



                      </Text>



                    </View>







                    <View style={styles.rewardContent}>



                      <Text



                        style={



                          styles.rewardTitle



                        }



                      >



                        {reward.reward_title}



                      </Text>







                      {reward.claimed_at ? (



                        <Text



                          style={



                            styles.rewardDate



                          }



                        >



                          Claimed



                        </Text>



                      ) : null}



                    </View>







                    <Text style={styles.claimedText}>



                      CLAIMED



                    </Text>



                  </View>



                ))}



              </View>



            ) : (



              <View style={styles.emptyCard}>



                <Text style={styles.emptyIcon}>



                  🎁



                </Text>







                <Text style={styles.emptyTitle}>



                  No rewards claimed



                </Text>







                <Text style={styles.emptyText}>



                  Earn and claim rewards to see



                  them here.



                </Text>



              </View>



            )}



          </>



        ) : null}







        {/* BEST DARE */}







        <SectionTitle



          title="Performance Highlight"



          subtitle="Your best-performing Dare"



        />







        {bestDare ? (



          <View style={styles.bestDareCard}>



            <View style={styles.bestDareTop}>



              <View style={styles.bestDareIcon}>



                <Text



                  style={styles.bestDareIconText}



                >



                  ⭐



                </Text>



              </View>







              <View style={styles.bestDareTitleWrap}>



                <Text



                  style={styles.bestDareLabel}



                >



                  BEST DARE



                </Text>







                <Text



                  style={styles.bestDareTitle}



                  numberOfLines={2}



                >



                  {bestDare.title}



                </Text>



              </View>







              <View style={styles.scoreBox}>



                <Text style={styles.scoreLabel}>



                  SCORE



                </Text>







                <Text style={styles.scoreValue}>



                  {formatNumber(bestDare.score)}



                </Text>



              </View>



            </View>







            <View style={styles.bestDareStats}>



              <View style={styles.bestStat}>



                <Text style={styles.bestStatIcon}>



                  ❤️



                </Text>







                <Text style={styles.bestStatValue}>



                  {formatNumber(



                    bestDare.reactions,



                  )}



                </Text>







                <Text style={styles.bestStatLabel}>



                  Reactions



                </Text>



              </View>







              <View style={styles.bestStat}>



                <Text style={styles.bestStatIcon}>



                  💬



                </Text>







                <Text style={styles.bestStatValue}>



                  {formatNumber(



                    bestDare.comments,



                  )}



                </Text>







                <Text style={styles.bestStatLabel}>



                  Comments



                </Text>



              </View>







              <View style={styles.bestStat}>



                <Text style={styles.bestStatIcon}>



                  ↗️



                </Text>







                <Text style={styles.bestStatValue}>



                  {formatNumber(



                    bestDare.shares,



                  )}



                </Text>







                <Text style={styles.bestStatLabel}>



                  Shares



                </Text>



              </View>







              <View style={styles.bestStat}>



                <Text style={styles.bestStatIcon}>



                  🔖



                </Text>







                <Text style={styles.bestStatValue}>



                  {formatNumber(



                    bestDare.saves,



                  )}



                </Text>







                <Text style={styles.bestStatLabel}>



                  Saves



                </Text>



              </View>







              <View style={styles.bestStat}>



                <Text style={styles.bestStatIcon}>



                  🗳️



                </Text>







                <Text style={styles.bestStatValue}>



                  {formatNumber(



                    bestDare.votes,



                  )}



                </Text>







                <Text style={styles.bestStatLabel}>



                  Votes



                </Text>



              </View>



            </View>



          </View>



        ) : (



          <View style={styles.emptyCard}>



            <Text style={styles.emptyIcon}>



              ⭐



            </Text>







            <Text style={styles.emptyTitle}>



              No performance highlight yet



            </Text>







            <Text style={styles.emptyText}>



              Create Dares and start receiving



              engagement.



            </Text>



          </View>



        )}







        {/* INFO */}







        <View style={styles.infoBox}>



          <Text style={styles.infoIcon}>



            ℹ️



          </Text>







          <Text style={styles.infoText}>



            Dashboard engagement counts only



            activity received on your own Dares.



            Actions you perform on other users'



            Dares are not counted as your received



            engagement.



          </Text>



        </View>







        <View style={styles.bottomSpace} />



      </ScrollView>



    </Screen>



  );



}







const styles = StyleSheet.create({



  container: {



    paddingHorizontal: spacing.lg,



    paddingBottom: spacing.xl,



  },







  intro: {



    paddingTop: spacing.md,



    paddingBottom: spacing.lg,



  },







  title: {



    fontSize: 26,



    fontWeight: '800',



    color: colors.text,



  },







  subtitle: {



    marginTop: 6,



    fontSize: fontSize.sm,



    lineHeight: 20,



    color: colors.textSecondary,



  },







  tabs: {



    flexDirection: 'row',



    padding: 4,



    borderRadius: 14,



    backgroundColor: colors.surface,



    marginBottom: spacing.xl,



  },







  tab: {



    flex: 1,



    minHeight: 42,



    alignItems: 'center',



    justifyContent: 'center',



    borderRadius: 11,



  },







  tabActive: {



    backgroundColor: colors.primary,



  },







  tabText: {



    fontSize: fontSize.sm,



    fontWeight: '700',



    color: colors.textSecondary,



  },







  tabTextActive: {



    color: '#111111',



  },







  sectionHeader: {



    marginTop: spacing.md,



    marginBottom: spacing.md,



  },







  sectionTitle: {



    fontSize: 19,



    fontWeight: '800',



    color: colors.text,



  },







  sectionSubtitle: {



    marginTop: 3,



    fontSize: 12,



    color: colors.textSecondary,



  },







  grid: {



    flexDirection: 'row',



    flexWrap: 'wrap',



    gap: 10,



  },







  metricCard: {



    width: '48%',



    minHeight: 150,



    padding: 16,



    borderRadius: 16,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



  },







  metricIconBox: {



    width: 48,



    height: 48,



    borderRadius: 14,



    alignItems: 'center',



    justifyContent: 'center',



    backgroundColor: colors.background,



    marginBottom: 12,



  },







  metricLabel: {



    marginTop: 5,



    fontSize: 13,



    lineHeight: 18,



    fontWeight: '700',



    color: colors.textSecondary,



  },







  metricValue: {



    fontSize: 25,



    lineHeight: 30,



    fontWeight: '800',



    color: colors.text,



  },







  growthText: {



    marginTop: 5,



    fontSize: 10,



    fontWeight: '700',



  },







  growthPositive: {



    color: '#16A34A',



  },







  growthNegative: {



    color: '#DC2626',



  },







  growthNeutral: {



    marginTop: 5,



    fontSize: 10,



    fontWeight: '600',



    color: colors.textSecondary,



  },







  overallCard: {



    padding: 16,



    borderRadius: 18,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



  },







  rankHero: {



    flexDirection: 'row',



    alignItems: 'center',



  },







  rankIcon: {



    fontSize: 42,



    marginRight: 13,



  },







  rankContent: {



    flex: 1,



  },







  rankLabel: {



    fontSize: 12,



    fontWeight: '700',



    color: colors.textSecondary,



  },







  rankValue: {



    marginTop: 2,



    fontSize: 30,



    fontWeight: '900',



    color: colors.text,



  },







  masterBadge: {



    alignSelf: 'flex-start',



    marginTop: 6,



    paddingHorizontal: 9,



    paddingVertical: 4,



    borderRadius: 999,



    backgroundColor: '#111111',



  },







  masterBadgeText: {



    color: '#FFFFFF',



    fontSize: 9,



    fontWeight: '900',



    letterSpacing: 0.5,



  },







  divider: {



    height: 1,



    backgroundColor: colors.border,



    marginVertical: 14,



  },







  statRow: {



    flexDirection: 'row',



    justifyContent: 'space-between',



    alignItems: 'center',



    paddingVertical: 8,



  },







  statRowLabel: {



    fontSize: 13,



    color: colors.textSecondary,



  },







  statRowValue: {



    fontSize: 14,



    fontWeight: '800',



    color: colors.text,



  },







  badgesCard: {



    padding: 12,



    borderRadius: 18,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



  },







  badgeItem: {



    flexDirection: 'row',



    alignItems: 'center',



    paddingVertical: 10,



  },







  badgeIcon: {



    width: 46,



    height: 46,



    borderRadius: 23,



    alignItems: 'center',



    justifyContent: 'center',



    backgroundColor: colors.background,



  },







  badgeIconText: {



    fontSize: 24,



  },







  badgeContent: {



    flex: 1,



    marginLeft: 12,



  },







  badgeName: {



    fontSize: 14,



    fontWeight: '800',



    color: colors.text,



  },







  badgeDescription: {



    marginTop: 3,



    fontSize: 11,



    lineHeight: 16,



    color: colors.textSecondary,



  },







  rewardsCard: {



    padding: 12,



    borderRadius: 18,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



  },







  rewardItem: {



    flexDirection: 'row',



    alignItems: 'center',



    paddingVertical: 10,



  },







  rewardIcon: {



    width: 46,



    height: 46,



    borderRadius: 23,



    alignItems: 'center',



    justifyContent: 'center',



    backgroundColor: colors.background,



  },







  rewardIconText: {



    fontSize: 23,



  },







  rewardContent: {



    flex: 1,



    marginLeft: 12,



  },







  rewardTitle: {



    fontSize: 14,



    fontWeight: '800',



    color: colors.text,



  },







  rewardDate: {



    marginTop: 3,



    fontSize: 11,



    color: colors.textSecondary,



  },







  claimedText: {



    fontSize: 9,



    fontWeight: '900',



    color: '#16A34A',



  },







  bestDareCard: {



    padding: 16,



    borderRadius: 18,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



  },







  bestDareTop: {



    flexDirection: 'row',



    alignItems: 'center',



  },







  bestDareIcon: {



    width: 46,



    height: 46,



    borderRadius: 23,



    alignItems: 'center',



    justifyContent: 'center',



    backgroundColor: colors.background,



  },







  bestDareIconText: {



    fontSize: 23,



  },







  bestDareTitleWrap: {



    flex: 1,



    marginLeft: 12,



    marginRight: 10,



  },







  bestDareLabel: {



    fontSize: 9,



    fontWeight: '900',



    color: colors.textSecondary,



    letterSpacing: 0.7,



  },







  bestDareTitle: {



    marginTop: 3,



    fontSize: 15,



    lineHeight: 20,



    fontWeight: '800',



    color: colors.text,



  },







  scoreBox: {



    alignItems: 'center',



    minWidth: 48,



  },







  scoreLabel: {



    fontSize: 8,



    fontWeight: '800',



    color: colors.textSecondary,



  },







  scoreValue: {



    marginTop: 2,



    fontSize: 18,



    fontWeight: '900',



    color: colors.text,



  },







  bestDareStats: {



    flexDirection: 'row',



    justifyContent: 'space-between',



    marginTop: 18,



    paddingTop: 14,



    borderTopWidth: 1,



    borderTopColor: colors.border,



  },







  bestStat: {



    alignItems: 'center',



    flex: 1,



  },







  bestStatIcon: {



    fontSize: 14,



  },







  bestStatValue: {



    marginTop: 4,



    fontSize: 13,



    fontWeight: '800',



    color: colors.text,



  },







  bestStatLabel: {



    marginTop: 2,



    fontSize: 8,



    color: colors.textSecondary,



  },







  emptyCard: {



    alignItems: 'center',



    paddingVertical: 25,



    paddingHorizontal: 18,



    borderRadius: 18,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



  },







  emptyIcon: {



    fontSize: 30,



  },







  emptyTitle: {



    marginTop: 8,



    fontSize: 14,



    fontWeight: '800',



    color: colors.text,



  },







  emptyText: {



    marginTop: 4,



    textAlign: 'center',



    fontSize: 11,



    lineHeight: 17,



    color: colors.textSecondary,



  },







  infoBox: {



    flexDirection: 'row',



    marginTop: 20,



    padding: 13,



    borderRadius: 14,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



  },







  infoIcon: {



    fontSize: 15,



    marginRight: 8,



  },







  infoText: {



    flex: 1,



    fontSize: 10,



    lineHeight: 16,



    color: colors.textSecondary,



  },







  errorBox: {



    padding: 14,



    marginBottom: 16,



    borderRadius: 15,



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: '#DC2626',



  },







  errorTitle: {



    fontSize: 14,



    fontWeight: '800',



    color: '#DC2626',



  },







  errorText: {



    marginTop: 5,



    fontSize: 11,



    lineHeight: 16,



    color: colors.textSecondary,



  },







  retryButton: {



    alignSelf: 'flex-start',



    marginTop: 10,



    paddingHorizontal: 13,



    paddingVertical: 8,



    borderRadius: 9,



    backgroundColor: colors.primary,



  },







  retryText: {



    color: '#FFFFFF',



    fontSize: 11,



    fontWeight: '800',



  },







  loadingContainer: {



    flex: 1,



    alignItems: 'center',



    justifyContent: 'center',



    paddingBottom: 100,



  },







  loadingText: {



    marginTop: 12,



    fontSize: 13,



    color: colors.textSecondary,



  },







  bottomSpace: {



    height: 30,



  },



});
