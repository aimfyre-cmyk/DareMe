import { useLocalSearchParams, useRouter } from 'expo-router';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,

  Alert,

  Image,

  Pressable,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  View,
} from 'react-native';



import { AppHeader } from '../components/AppHeader';

import { Screen as AppScreen } from '../components/Screen';

import { colors } from '../constants/theme';

import { supabase } from '../lib/supabase';



type DareRow = {

  id: string;

  title: string;

  description: string | null;

  category: string | null;

  difficulty: string | null;

  xp_value: number | null;

  proof_type: string | null;

  voting_starts_at: string | null;

  voting_ends_at: string | null;

};



type ParticipantRow = {

  id: string;

  user_id: string;

  state: string;

};



type ProfileRow = {

  id: string;

  username: string | null;

  display_name: string | null;

  avatar_url: string | null;

};



type ProofRow = {

  id: string;

  participant_id: string;

  type: string;

  storage_path: string | null;

  text_content: string | null;

};



type ResponseItem = {

  participantId: string;

  userId: string;

  username: string | null;

  displayName: string;

  avatarUrl: string | null;

  proofId: string | null;

  proofType: string | null;

  proofPath: string | null;

  proofText: string | null;

  voteCount: number;

  isCurrentUser: boolean;

  hasVoted: boolean;

};



const getDisplayName = (profile?: ProfileRow | null) =>

  profile?.display_name?.trim() ||

  profile?.username?.trim() ||

  'Dare Player';



const getInitials = (name: string) => {

  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.length

    ? parts.map((part) => part.charAt(0).toUpperCase()).join('')

    : 'D';

};



const isImageProof = (type: string | null | undefined) => {

  const normalized = (type ?? '').toLowerCase();

  return (

    normalized === 'photo' ||

    normalized === 'image' ||

    normalized.includes('photo') ||

    normalized.includes('image')

  );

};



const isVideoProof = (type: string | null | undefined) => {

  const normalized = (type ?? '').toLowerCase();

  return normalized === 'video' || normalized.includes('video');

};



export default function DareVotingScreen() {

  const router = useRouter();

  const params = useLocalSearchParams<{ dareId?: string }>();

  const dareId = typeof params.dareId === 'string' ? params.dareId : null;



  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [dare, setDare] = useState<DareRow | null>(null);

  const [responses, setResponses] = useState<ResponseItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [votingParticipantId, setVotingParticipantId] = useState<string | null>(null);



  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const votingStartsAt = dare?.voting_starts_at ? new Date(dare.voting_starts_at) : null;
  const votingEndsAt = dare?.voting_ends_at ? new Date(dare.voting_ends_at) : null;
  const votingNotStarted = !!votingStartsAt && now.getTime() < votingStartsAt.getTime();
  const votingLive = !!votingStartsAt && !!votingEndsAt && now.getTime() >= votingStartsAt.getTime() && now.getTime() < votingEndsAt.getTime();
  const votingFinished = !!votingEndsAt && now.getTime() >= votingEndsAt.getTime();

  const formatRemaining = (target: Date | null) => {
    if (!target) return '';
    const diff = Math.max(0, target.getTime() - now.getTime());
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const isSingleWinner =
    votingFinished &&
    responses.length > 0 &&
    responses[0].voteCount > 0 &&
    (responses.length === 1 || responses[0].voteCount > responses[1].voteCount);

  const winner = isSingleWinner ? responses[0] : null;

  const loadVotingData = useCallback(async () => {

    if (!dareId) {

      setLoading(false);

      setDare(null);

      setResponses([]);

      return;

    }



    try {

      setLoading(true);



      const {

        data: { user },

      } = await supabase.auth.getUser();



      setCurrentUserId(user?.id ?? null);



      if (!user) {

        throw new Error('Please log in to view Dare voting.');

      }



      const { data: dareData, error: dareError } = await supabase

        .from('dares')

        .select('id,title,description,category,difficulty,xp_value,proof_type,voting_starts_at,voting_ends_at')

        .eq('id', dareId)

        .maybeSingle();



      if (dareError) throw dareError;

      if (!dareData) throw new Error('Dare not found.');



      setDare(dareData as DareRow);



      let blockedIds = new Set<string>();



      const { data: blockedData, error: blockedError } =

        await supabase.rpc('get_blocked_user_ids');



      if (!blockedError && blockedData) {

        blockedIds = new Set(

          (blockedData as { user_id: string }[])

            .map((row) => row.user_id)

            .filter(Boolean),

        );

      }



      const { data: participantData, error: participantError } =

        await supabase

          .from('dare_participants')

          .select('id,user_id,state')

          .eq('dare_id', dareId)

          .in('state', ['VERIFIED', 'COMPLETED'])

          .order('id', { ascending: true });



      if (participantError) throw participantError;



      const participants = (participantData as ParticipantRow[] | null) ?? [];

      const visibleParticipants = participants.filter(

        (participant) => !blockedIds.has(participant.user_id),

      );



      if (!visibleParticipants.length) {

        setResponses([]);

        return;

      }



      const participantIds = visibleParticipants.map(

        (participant) => participant.id,

      );



      const { data: proofData, error: proofError } = await supabase

        .from('dare_proofs')

        .select('id,participant_id,type,storage_path,text_content')

        .in('participant_id', participantIds)

        .order('id', { ascending: false });



      if (proofError) throw proofError;



      const proofs = (proofData as ProofRow[] | null) ?? [];

      const proofByParticipant = new Map<string, ProofRow>();



      for (const proof of proofs) {

        if (!proofByParticipant.has(proof.participant_id)) {

          proofByParticipant.set(proof.participant_id, proof);

        }

      }



      const userIds = [

        ...new Set(visibleParticipants.map((participant) => participant.user_id)),

      ];



      const { data: profileData, error: profileError } = await supabase

        .from('profiles')

        .select('id,username,display_name,avatar_url')

        .in('id', userIds);



      if (profileError) throw profileError;



      const profiles = (profileData as ProfileRow[] | null) ?? [];

      const profileMap = new Map<string, ProfileRow>();



      for (const profile of profiles) {

        profileMap.set(profile.id, profile);

      }



      const { data: voteData, error: voteError } = await supabase

        .from('dare_response_votes')

        .select('participant_id,voter_id')

        .eq('dare_id', dareId);



      if (voteError) throw voteError;



      const votes =

        (voteData as Array<{

          participant_id: string;

          voter_id: string;

        }> | null) ?? [];



      const voteCounts = new Map<string, number>();

      const votedParticipantIds = new Set<string>();



      for (const vote of votes) {

        voteCounts.set(

          vote.participant_id,

          (voteCounts.get(vote.participant_id) ?? 0) + 1,

        );



        if (vote.voter_id === user.id) {

          votedParticipantIds.add(vote.participant_id);

        }

      }



      const nextResponses: ResponseItem[] = visibleParticipants.map(

        (participant) => {

          const profile = profileMap.get(participant.user_id);

          const proof = proofByParticipant.get(participant.id);



          return {

            participantId: participant.id,

            userId: participant.user_id,

            username: profile?.username ?? null,

            displayName: getDisplayName(profile),

            avatarUrl: profile?.avatar_url ?? null,

            proofId: proof?.id ?? null,

            proofType: proof?.type ?? null,

            proofPath: proof?.storage_path ?? null,

            proofText: proof?.text_content ?? null,

            voteCount: voteCounts.get(participant.id) ?? 0,

            isCurrentUser: participant.user_id === user.id,

            hasVoted: votedParticipantIds.has(participant.id),

          };

        },

      );



      nextResponses.sort((a, b) => {

        if (b.voteCount !== a.voteCount) {

          return b.voteCount - a.voteCount;

        }

        return a.displayName.localeCompare(b.displayName);

      });



setResponses(nextResponses);

// Phase 2: Award winner bonus XP after voting has ended.
// The Supabase RPC re-validates the actual winner server-side,
// so the client result is only a trigger, not the source of truth.
const latestVotingEndsAt = dareData.voting_ends_at
  ? new Date(dareData.voting_ends_at)
  : null;

const topResponse = nextResponses[0] ?? null;
const secondResponse = nextResponses[1] ?? null;

const hasClearWinner =
  !!latestVotingEndsAt &&
  new Date().getTime() >= latestVotingEndsAt.getTime() &&
  !!topResponse &&
  topResponse.voteCount > 0 &&
  (!secondResponse ||
    topResponse.voteCount > secondResponse.voteCount);

if (hasClearWinner && topResponse) {
  const { error: winnerBonusError } = await supabase.rpc(
    'award_dare_winner_bonus_xp',
    {
      p_participant_id: topResponse.participantId,
      p_bonus_xp: 50,
    },
  );

  if (winnerBonusError) {
    console.warn(
      '[Dare Voting] Winner bonus XP was not awarded:',
      winnerBonusError,
    );
  }
}

// Phase 3: Award Dare Winner recognition reward.
if (hasClearWinner && topResponse) {
  const { error: winnerRewardError } = await supabase.rpc(
    'award_dare_winner_reward',
    {
      p_participant_id: topResponse.participantId,
    },
  );

  if (winnerRewardError) {
    console.warn(
      '[Dare Voting] Winner recognition reward was not awarded:',
      winnerRewardError,
    );
  }
}

    } catch (error) {

      console.error('[Dareshot Voting] Load error:', error);

      setDare(null);

      setResponses([]);



      Alert.alert(

        'Could not load voting',

        error instanceof Error

          ? error.message

          : 'Something went wrong while loading Dare responses.',

      );

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [dareId]);



  useEffect(() => {

    void loadVotingData();

  }, [loadVotingData]);



  const handleRefresh = useCallback(async () => {

    setRefreshing(true);

    await loadVotingData();

  }, [loadVotingData]);



  const handleVote = useCallback(

    async (response: ResponseItem) => {

      if (!dareId) return;



      if (!votingLive) {
        Alert.alert(
          votingNotStarted ? 'Voting not started' : 'Voting closed',
          votingNotStarted
            ? `Voting starts in ${formatRemaining(votingStartsAt)}.`
            : 'The voting period for this Dare has ended.',
        );
        return;
      }

      if (!currentUserId) {

        Alert.alert('Login required', 'Please log in to vote.');

        return;

      }



      if (response.isCurrentUser) {

        Alert.alert(

          'You cannot vote for yourself',

          'Choose another Dare response.',

        );

        return;

      }



      if (response.hasVoted) {

        Alert.alert(

          'Already voted',

          'You have already voted for this response.',

        );

        return;

      }



      const alreadyVotedForSomeone = responses.some(

        (item) => item.hasVoted && item.userId !== currentUserId,

      );



      if (alreadyVotedForSomeone) {

        Alert.alert(

          'Vote already used',

          'You can vote only once for this Dare.',

        );

        return;

      }



      try {

        setVotingParticipantId(response.participantId);



        const { data: blockedData, error: blockedError } =

          await supabase.rpc('get_blocked_user_ids');



        if (!blockedError && blockedData) {

          const blockedIds = new Set(

            (blockedData as { user_id: string }[]).map((row) => row.user_id),

          );



          if (blockedIds.has(response.userId)) {

            Alert.alert(

              'Response unavailable',

              'This response is no longer available.',

            );

            return;

          }

        }



        const { data: participant, error: participantError } =

          await supabase

            .from('dare_participants')

            .select('id,user_id,state')

            .eq('id', response.participantId)

            .eq('dare_id', dareId)

            .maybeSingle();



        if (participantError) throw participantError;



        if (!participant) {

          throw new Error('This response is no longer available.');

        }



        if (

          participant.state !== 'VERIFIED' &&

          participant.state !== 'COMPLETED'

        ) {

          throw new Error('This response is not eligible for voting.');

        }



        const { data: existingVote, error: existingVoteError } =

          await supabase

            .from('dare_response_votes')

            .select('participant_id')

            .eq('dare_id', dareId)

            .eq('voter_id', currentUserId)

            .maybeSingle();



        if (existingVoteError) throw existingVoteError;



        if (existingVote) {

          Alert.alert(

            'Vote already used',

            'You have already voted for this Dare.',

          );



          setResponses((current) =>

            current.map((item) => ({

              ...item,

              hasVoted:

                item.participantId === existingVote.participant_id

                  ? true

                  : item.hasVoted,

            })),

          );

          return;

        }



        const { error: insertError } = await supabase

          .from('dare_response_votes')

          .insert({

            dare_id: dareId,

            voter_id: currentUserId,

            participant_id: response.participantId,

          });



        if (insertError) {

          if (insertError.code === '23505') {

            Alert.alert(

              'Vote already used',

              'Your vote has already been recorded.',

            );

            await loadVotingData();

            return;

          }



          throw insertError;

        }



        setResponses((current) =>

          current

            .map((item) =>

              item.participantId === response.participantId

                ? {

                    ...item,

                    voteCount: item.voteCount + 1,

                    hasVoted: true,

                  }

                : item,

            )

            .sort((a, b) => {

              if (b.voteCount !== a.voteCount) {

                return b.voteCount - a.voteCount;

              }

              return a.displayName.localeCompare(b.displayName);

            }),

        );



        Alert.alert(

          '🗳️ Vote recorded',

          `Your vote was recorded for ${response.displayName}.`,

        );

      } catch (error) {

        console.error('[Dareshot Voting] Vote error:', error);



        Alert.alert(

          'Vote failed',

          error instanceof Error

            ? error.message

            : 'Could not record your vote.',

        );

      } finally {

        setVotingParticipantId(null);

      }

    },

    [currentUserId, dareId, loadVotingData, responses, votingLive, votingNotStarted, votingStartsAt],

  );



  const totalVotes = useMemo(

    () => responses.reduce((total, response) => total + response.voteCount, 0),

    [responses],

  );



  const leader = responses.length ? responses[0] : null;



  if (loading) {

    return (

      <AppScreen

  scroll={false}

  contentContainerStyle={{ flex: 1 }}

>

        <AppHeader

          title="Dare Voting"

          leftSlot={

            <Pressable

              onPress={() => router.back()}

              style={styles.headerButton}

              hitSlop={10}

            >

              <Text style={styles.backText}>‹</Text>

            </Pressable>

          }

        />



        <View style={styles.centerState}>

          <ActivityIndicator size="small" color={colors.accent} />

          <Text style={styles.stateText}>Loading responses...</Text>

        </View>

      </AppScreen>

    );

  }



  if (!dare) {

    return (

      <AppScreen

  scroll={false}

  contentContainerStyle={styles.screenContent}

>

        <AppHeader

          title="Dare Voting"

          leftSlot={

            <Pressable

              onPress={() => router.back()}

              style={styles.headerButton}

              hitSlop={10}

            >

              <Text style={styles.backText}>‹</Text>

            </Pressable>

          }

        />



        <View style={styles.centerState}>

          <Text style={styles.emptyTitle}>Dare unavailable</Text>

          <Text style={styles.emptyText}>

            This Dare could not be loaded.

          </Text>



          <Pressable

            onPress={() => void loadVotingData()}

            style={styles.retryButton}

          >

            <Text style={styles.retryText}>TRY AGAIN</Text>

          </Pressable>

        </View>

      </AppScreen>

    );

  }



  return (

  <View style={styles.screenRoot}>

      <AppHeader

        title="Dare Voting"

        leftSlot={

          <Pressable

            onPress={() => router.back()}

            style={styles.headerButton}

            hitSlop={10}

          >

            <Text style={styles.backText}>‹</Text>

          </Pressable>

        }

      />



      <ScrollView

      style={styles.votingScroll}

        contentContainerStyle={styles.scrollContent}

        showsVerticalScrollIndicator={false}

        refreshControl={

          <RefreshControl

            refreshing={refreshing}

            onRefresh={handleRefresh}

            tintColor={colors.accent}

          />

        }

      >

        <View style={styles.dareHeader}>

          <Text style={styles.eyebrow}>🗳️ COMMUNITY VOTING</Text>



          <Text style={styles.dareTitle}>{dare.title}</Text>



          {!!dare.description && (

            <Text style={styles.dareDescription}>{dare.description}</Text>

          )}



          <View style={styles.metaRow}>

            {!!dare.category && (

              <View style={styles.metaChip}>

                <Text style={styles.metaText}>{dare.category}</Text>

              </View>

            )}



            {!!dare.difficulty && (

              <View style={styles.metaChip}>

                <Text style={styles.metaText}>{dare.difficulty}</Text>

              </View>

            )}



            {typeof dare.xp_value === 'number' && (

              <View style={styles.metaChip}>

                <Text style={styles.metaText}>+{dare.xp_value} XP</Text>

              </View>

            )}

          </View>

        </View>



        <View style={styles.votingStatusCard}>
          <Text style={styles.votingStatusTitle}>VOTING STATUS</Text>
          {votingNotStarted && (
            <Text style={styles.votingStatusText}>Starts in {formatRemaining(votingStartsAt)}</Text>
          )}
          {votingLive && (
            <Text style={styles.votingStatusText}>Voting is LIVE • Ends in {formatRemaining(votingEndsAt)}</Text>
          )}
          {votingFinished && (
            <Text style={styles.votingStatusText}>Voting has ended</Text>
          )}
          {!votingStartsAt && !votingEndsAt && (
            <Text style={styles.votingStatusText}>Voting schedule is not configured.</Text>
          )}
        </View>

        {votingFinished && (
          <View style={styles.winnerCard}>
            <Text style={styles.winnerEyebrow}>DARE WINNER</Text>
            {winner ? (
              <>
                <Text style={styles.winnerName}>{winner.displayName}</Text>
                <Text style={styles.winnerVotes}>{winner.voteCount} {winner.voteCount === 1 ? 'vote' : 'votes'}</Text>
              </>
            ) : (
              <Text style={styles.noWinnerText}>No single winner — the Dare ended without a clear winner.</Text>
            )}
          </View>
        )}

        <View style={styles.summaryCard}>

          <View>

            <Text style={styles.summaryLabel}>RESPONSES</Text>

            <Text style={styles.summaryValue}>{responses.length}</Text>

          </View>



          <View style={styles.summaryDivider} />



          <View>

            <Text style={styles.summaryLabel}>TOTAL VOTES</Text>

            <Text style={styles.summaryValue}>{totalVotes}</Text>

          </View>



          {leader && (

            <>

              <View style={styles.summaryDivider} />



              <View style={styles.leaderSummary}>

                <Text style={styles.summaryLabel}>LEADING</Text>

                <Text numberOfLines={1} style={styles.leaderName}>

                  {leader.displayName}

                </Text>

              </View>

            </>

          )}

        </View>



        <View style={styles.ruleCard}>

          <Text style={styles.ruleTitle}>How voting works</Text>

          <Text style={styles.ruleText}>

            Watch the Dare responses and vote for the participant who performed

            the Dare best. You can vote only once for this Dare.

          </Text>

        </View>



        <View style={styles.sectionHeader}>

          <Text style={styles.sectionTitle}>Dare Responses</Text>

          <Text style={styles.sectionCount}>{responses.length}</Text>

        </View>



        {responses.length === 0 ? (

          <View style={styles.emptyCard}>

            <Text style={styles.emptyTitle}>No responses yet</Text>

            <Text style={styles.emptyText}>

              Completed Dare responses will appear here when they become

              eligible for voting.

            </Text>

          </View>

        ) : (

          responses.map((response, index) => {

            const isLeader = index === 0 && response.voteCount > 0;

            const isVoting =

              votingParticipantId === response.participantId;



            const hasUsedVote = responses.some(

              (item) => item.hasVoted && item.userId === currentUserId,

            );



            const canVote =
              !response.isCurrentUser &&
              !response.hasVoted &&
              !hasUsedVote &&
              votingLive;



            return (

              <View

                key={response.participantId}

                style={[

                  styles.responseCard,

                  isLeader && styles.responseCardLeader,

                ]}

              >

                <View style={styles.rankBox}>

                  <Text style={styles.rankText}>#{index + 1}</Text>

                </View>



                <View style={styles.userRow}>

                  {response.avatarUrl ? (

                    <Image

                      source={{ uri: response.avatarUrl }}

                      style={styles.avatar}

                    />

                  ) : (

                    <View style={styles.avatarFallback}>

                      <Text style={styles.avatarInitials}>

                        {getInitials(response.displayName)}

                      </Text>

                    </View>

                  )}



                  <View style={styles.userInfo}>

                    <Text numberOfLines={1} style={styles.displayName}>

                      {response.displayName}

                    </Text>



                    {!!response.username && (

                      <Text numberOfLines={1} style={styles.username}>

                        @{response.username}

                      </Text>

                    )}

                  </View>



                  {response.isCurrentUser && (

                    <View style={styles.youBadge}>

                      <Text style={styles.youBadgeText}>YOU</Text>

                    </View>

                  )}

                </View>



                {response.proofPath &&

                  isImageProof(response.proofType) && (

                    <Image

                      source={{ uri: response.proofPath }}

                      style={styles.proofImage}

                      resizeMode="cover"

                    />

                  )}



                {response.proofPath &&

                  isVideoProof(response.proofType) && (

                    <View style={styles.videoProof}>

                      <Text style={styles.videoProofIcon}>▶</Text>

                      <Text style={styles.videoProofText}>

                        VIDEO RESPONSE

                      </Text>

                    </View>

                  )}



                {!!response.proofText && (

                  <View style={styles.textProof}>

                    <Text style={styles.textProofLabel}>RESPONSE</Text>

                    <Text style={styles.textProofValue}>

                      {response.proofText}

                    </Text>

                  </View>

                )}



                {!response.proofPath && !response.proofText && (

                  <View style={styles.noProofBox}>

                    <Text style={styles.noProofText}>

                      Proof preview unavailable

                    </Text>

                  </View>

                )}



                <View style={styles.voteFooter}>

                  <View style={styles.voteInfo}>

                    <Text style={styles.voteCount}>

                      {response.voteCount}{' '}

                      {response.voteCount === 1 ? 'vote' : 'votes'}

                    </Text>



                    {isLeader && (

                      <Text style={styles.leadingText}>CURRENT LEADER</Text>

                    )}

                  </View>



                  {response.isCurrentUser ? (

                    <View style={styles.disabledVote}>

                      <Text style={styles.disabledVoteText}>

                        YOUR RESPONSE

                      </Text>

                    </View>

                  ) : response.hasVoted ? (

                    <View style={styles.votedButton}>

                      <Text style={styles.votedButtonText}>✓ VOTED</Text>

                    </View>

                  ) : (

                    <Pressable

                      disabled={!canVote || isVoting}

                      onPress={() => void handleVote(response)}

                      style={[

                        styles.voteButton,

                        (!canVote || isVoting) && styles.voteButtonDisabled,

                      ]}

                    >

                      {isVoting ? (

                        <ActivityIndicator

                          size="small"

                          color={colors.background}

                        />

                      ) : (

                        <Text style={styles.voteButtonText}>VOTE</Text>

                      )}

                    </Pressable>

                  )}

                </View>

              </View>

            );

          })

        )}



        <View style={styles.bottomSpace} />

      </ScrollView>

    </View>

  );

}



const styles = StyleSheet.create({

    screenContent: {

  flex: 1,

},

screenRoot: {

  flex: 1,

  backgroundColor: colors.background,

},

  scrollContent: {

    paddingHorizontal: 16,

    paddingTop: 8,

    paddingBottom: 40,

  },

votingScroll: {

  flex: 1,

},

  headerButton: {

    minWidth: 42,

    minHeight: 42,

    alignItems: 'center',

    justifyContent: 'center',

  },



  backText: {

    fontSize: 34,

    lineHeight: 36,

    color: colors.primaryText,

    fontWeight: '300',

  },



  centerState: {

    flex: 1,

    minHeight: 420,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,

  },



  stateText: {

    marginTop: 12,

    color: colors.secondaryText,

    fontSize: 14,

  },



  dareHeader: {

    paddingTop: 10,

    paddingBottom: 18,

  },



  eyebrow: {

    fontSize: 11,

    fontWeight: '800',

    letterSpacing: 1.2,

    color: colors.accent,

    marginBottom: 8,

  },



  dareTitle: {

    color: colors.primaryText,

    fontSize: 28,

    lineHeight: 34,

    fontWeight: '800',

  },



  dareDescription: {

    color: colors.secondaryText,

    fontSize: 14,

    lineHeight: 21,

    marginTop: 10,

  },



  metaRow: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 8,

    marginTop: 14,

  },



  metaChip: {

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 999,

    paddingHorizontal: 11,

    paddingVertical: 6,

    backgroundColor: 'transparent',

  },



  metaText: {

    color: colors.secondaryText,

    fontSize: 11,

    fontWeight: '700',

  },



  votingStatusCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'transparent',
    marginBottom: 12,
  },

  votingStatusTitle: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  votingStatusText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  winnerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'transparent',
    marginBottom: 12,
  },

  winnerEyebrow: {
    color: colors.secondaryText,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  winnerName: {
    color: colors.primaryText,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },

  winnerVotes: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },

  noWinnerText: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  summaryCard: {

    flexDirection: 'row',

    alignItems: 'center',

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 18,

    padding: 16,

    backgroundColor: 'transparent',

    marginBottom: 12,

  },



  summaryLabel: {

    color: colors.secondaryText,

    fontSize: 9,

    fontWeight: '800',

    letterSpacing: 1,

  },



  summaryValue: {

    color: colors.primaryText,

    fontSize: 22,

    fontWeight: '800',

    marginTop: 3,

  },



  summaryDivider: {

    width: 1,

    height: 34,

    backgroundColor: colors.border,

    marginHorizontal: 14,

  },



  leaderSummary: {

    flex: 1,

    minWidth: 0,

  },



  leaderName: {

    color: colors.primaryText,

    fontSize: 14,

    fontWeight: '800',

    marginTop: 4,

  },



  ruleCard: {

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 16,

    padding: 15,

    marginBottom: 22,

    backgroundColor: 'transparent',

  },



  ruleTitle: {

    color: colors.primaryText,

    fontSize: 14,

    fontWeight: '800',

  },



  ruleText: {

    color: colors.secondaryText,

    fontSize: 12,

    lineHeight: 18,

    marginTop: 6,

  },



  sectionHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 10,

  },



  sectionTitle: {

    color: colors.primaryText,

    fontSize: 18,

    fontWeight: '800',

  },



  sectionCount: {

    color: colors.secondaryText,

    fontSize: 13,

    fontWeight: '700',

  },



  responseCard: {

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 20,

    padding: 14,

    marginBottom: 14,

    backgroundColor: 'transparent',

    overflow: 'hidden',

  },



  responseCardLeader: {

    borderColor: colors.accent,

  },



  rankBox: {

    alignSelf: 'flex-start',

    minWidth: 42,

    paddingHorizontal: 8,

    paddingVertical: 5,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 999,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 10,

  },



  rankText: {

    color: colors.primaryText,

    fontSize: 11,

    fontWeight: '800',

  },



  userRow: {

    flexDirection: 'row',

    alignItems: 'center',

    minWidth: 0,

  },



  avatar: {

    width: 46,

    height: 46,

    borderRadius: 23,

    backgroundColor: 'transparent',

  },



  avatarFallback: {

    width: 46,

    height: 46,

    borderRadius: 23,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'transparent',

  },



  avatarInitials: {

    color: colors.primaryText,

    fontSize: 13,

    fontWeight: '800',

  },



  userInfo: {

    flex: 1,

    minWidth: 0,

    marginLeft: 11,

  },



  displayName: {

    color: colors.primaryText,

    fontSize: 15,

    fontWeight: '800',

  },



  username: {

    color: colors.secondaryText,

    fontSize: 12,

    marginTop: 2,

  },



  youBadge: {

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 999,

    paddingHorizontal: 8,

    paddingVertical: 5,

    backgroundColor: 'transparent',

  },



  youBadgeText: {

    color: colors.secondaryText,

    fontSize: 9,

    fontWeight: '800',

    letterSpacing: 0.8,

  },



  proofImage: {

    width: '100%',

    height: 300,

    borderRadius: 14,

    marginTop: 14,

    backgroundColor: 'transparent',

  },



  videoProof: {

    height: 150,

    borderRadius: 14,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 14,

    backgroundColor: 'transparent',

  },



  videoProofIcon: {

    color: colors.primaryText,

    fontSize: 28,

    marginBottom: 8,

  },



  videoProofText: {

    color: colors.secondaryText,

    fontSize: 10,

    fontWeight: '800',

    letterSpacing: 1,

  },



  textProof: {

    marginTop: 14,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 14,

    padding: 13,

    backgroundColor: 'transparent',

  },



  textProofLabel: {

    color: colors.secondaryText,

    fontSize: 9,

    fontWeight: '800',

    letterSpacing: 1,

    marginBottom: 6,

  },



  textProofValue: {

    color: colors.primaryText,

    fontSize: 14,

    lineHeight: 21,

  },



  noProofBox: {

    marginTop: 14,

    minHeight: 70,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 14,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'transparent',

  },



  noProofText: {

    color: colors.secondaryText,

    fontSize: 12,

  },



  voteFooter: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 14,

    paddingTop: 13,

    borderTopWidth: 1,

    borderTopColor: colors.border,

    gap: 12,

  },



  voteInfo: {

    flex: 1,

    minWidth: 0,

  },



  voteCount: {

    color: colors.primaryText,

    fontSize: 14,

    fontWeight: '800',

  },



  leadingText: {

    color: colors.accent,

    fontSize: 9,

    fontWeight: '800',

    letterSpacing: 0.8,

    marginTop: 3,

  },



  voteButton: {

    minWidth: 92,

    minHeight: 44,

    paddingHorizontal: 18,

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: colors.accent,

  },



  voteButtonDisabled: {

    opacity: 0.45,

  },



  voteButtonText: {

    color: colors.background,

    fontSize: 11,

    fontWeight: '900',

    letterSpacing: 0.8,

  },



  votedButton: {

    minWidth: 92,

    minHeight: 44,

    paddingHorizontal: 15,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: colors.accent,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'transparent',

  },



  votedButtonText: {

    color: colors.accent,

    fontSize: 10,

    fontWeight: '900',

    letterSpacing: 0.7,

  },



  disabledVote: {

    minHeight: 44,

    paddingHorizontal: 12,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'transparent',

  },



  disabledVoteText: {

    color: colors.secondaryText,

    fontSize: 9,

    fontWeight: '800',

    letterSpacing: 0.6,

  },



  emptyCard: {

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 18,

    padding: 22,

    alignItems: 'center',

    backgroundColor: 'transparent',

  },



  emptyTitle: {

    color: colors.primaryText,

    fontSize: 16,

    fontWeight: '800',

    textAlign: 'center',

  },



  emptyText: {

    color: colors.secondaryText,

    fontSize: 13,

    lineHeight: 19,

    textAlign: 'center',

    marginTop: 7,

  },



  retryButton: {

    marginTop: 16,

    minHeight: 44,

    paddingHorizontal: 20,

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: colors.accent,

  },



  retryText: {

    color: colors.background,

    fontSize: 11,

    fontWeight: '900',

    letterSpacing: 0.8,

  },



  bottomSpace: {

    height: 30,

  },

});
