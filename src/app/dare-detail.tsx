import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Chip } from '../components/Chip';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../constants/theme';
import { transitionDare } from '../lib/dareTransitions';
import { supabase } from '../lib/supabase';
type Dare = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  xp_value: number;
  proof_type: string | null;
  visibility: string | null;
  status: string | null;
  time_limit_minutes: number | null;
  participation_duration_minutes: number | null;
  participation_ends_at: string | null;
  voting_enabled: boolean;
  voting_duration_minutes: number | null;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
};
type ParticipantState =
  | 'SENT'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | null;
type ExistingParticipant = {
  id: string;
  state: ParticipantState;
};
export default function DareDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{
    id?: string;
  }>();
  const [dare, setDare] = useState<Dare | null>(null);
  const [loading, setLoading] = useState(true);
  const [takingDare, setTakingDare] = useState(false);
  const [participantState, setParticipantState] =
    useState<ParticipantState>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const goToDares = () => {
    router.replace('/(tabs)/dares');
  };
  const goHome = () => {
    router.replace('/');
  };
  useEffect(() => {
    let mounted = true;
    const loadDare = async () => {
      if (!id) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }
      try {
        if (mounted) {
          setLoading(true);
        }
        const { data, error } = await supabase
          .from('dares')
          .select(
            'id,title,description,category,difficulty,xp_value,proof_type,visibility,status,time_limit_minutes,participation_duration_minutes,participation_ends_at,voting_enabled,voting_duration_minutes,voting_starts_at,voting_ends_at',
          )
          .eq('id', id)
          .single();
        if (error) {
          console.error('[DareDetail] Load error:', error);
          if (mounted) {
            setDare(null);
          }
          return;
        }
        if (mounted) {
          setDare(data as Dare);
        }
        const { count: totalParticipants, error: countError } =
          await supabase
            .from('dare_participants')
            .select('id', { count: 'exact', head: true })
            .eq('dare_id', id);
        if (countError) {
          console.warn('[DareDetail] Participant count warning:', countError);
        } else if (mounted) {
          setParticipantCount(totalParticipants ?? 0);
        }
        /*
         * Load the current user's participant state as well.
         *
         * This does not change the existing Dare flow.
         * It only lets the detail screen show the correct
         * action when the user has already interacted with
         * this Dare.
         */
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) {
          return;
        }
        const { data: participant, error: participantError } =
          await supabase
            .from('dare_participants')
            .select('id,state')
            .eq('dare_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
        if (participantError) {
          /*
           * Participant state is an enhancement only.
           * A failure here must not make the Dare itself disappear.
           */
          console.warn(
            '[DareDetail] Participant state load warning:',
            participantError,
          );
          return;
        }
        if (mounted) {
          setParticipantState(
            (participant?.state as ParticipantState | undefined) ?? null,
          );
        }
      } catch (error) {
        console.error('[DareDetail] Load exception:', error);
        if (mounted) {
          setDare(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void loadDare();
    return () => {
      mounted = false;
    };
  }, [id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const participationEndsAt = dare?.participation_ends_at ? new Date(dare.participation_ends_at) : null;
  const votingStartsAt = dare?.voting_starts_at ? new Date(dare.voting_starts_at) : null;
  const votingEndsAt = dare?.voting_ends_at ? new Date(dare.voting_ends_at) : null;
  const participationOpen = !participationEndsAt || now.getTime() < participationEndsAt.getTime();
  const votingLive = dare?.voting_enabled === true && !!votingStartsAt && !!votingEndsAt && now.getTime() >= votingStartsAt.getTime() && now.getTime() < votingEndsAt.getTime();
  const votingFinished = dare?.voting_enabled === true && !!votingEndsAt && now.getTime() >= votingEndsAt.getTime();
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
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Not set';
    if (minutes % 1440 === 0) return `${minutes / 1440}d`;
    if (minutes % 60 === 0) return `${minutes / 60}h`;
    return `${minutes}m`;
  };

  const handleTakeDare = async () => {
    if (!dare || takingDare) {
      return;
    }
    if (!participantState && !participationOpen) {
      Alert.alert('Participation closed', 'The participation period for this Dare has ended.');
      return;
    }

    /*
     * If the Dare is already active/submitted/verified,
     * don't create another participant or run the state
     * machine again.
     */
    if (
      participantState === 'IN_PROGRESS' ||
      participantState === 'SUBMITTED' ||
      participantState === 'VERIFIED'
    ) {
      goToDares();
      return;
    }
    /*
     * A completed Dare should not be restarted from this screen.
     */
    if (participantState === 'COMPLETED') {
      Alert.alert(
        'Dare completed',
        'You have already completed this Dare.',
      );
      return;
    }
    if (
      participantState === 'REJECTED' ||
      participantState === 'DECLINED' ||
      participantState === 'EXPIRED' ||
      participantState === 'CANCELLED'
    ) {
      Alert.alert(
        'Dare unavailable',
        `This Dare is currently ${participantState.toLowerCase()}.`,
      );
      return;
    }
    console.log('[DareDetail] TAKE DARE CLICKED');
    setTakingDare(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert(
          'Login required',
          'Please log in before taking a Dare.',
        );
        return;
      }
      const {
        data: existingParticipant,
        error: existingError,
      } = await supabase
        .from('dare_participants')
        .select('id,state')
        .eq('dare_id', dare.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existingError) {
        throw existingError;
      }
      let participantId: string | null = null;
      if (existingParticipant) {
        participantId = existingParticipant.id;
        const state =
          existingParticipant.state as ParticipantState;
        console.log(
          '[DareDetail] Existing participant state:',
          state,
        );
        if (
          state === 'IN_PROGRESS' ||
          state === 'SUBMITTED' ||
          state === 'VERIFIED'
        ) {
          setParticipantState(state);
          goToDares();
          return;
        }
        if (state === 'COMPLETED') {
          setParticipantState(state);
          Alert.alert(
            'Dare completed',
            'You have already completed this Dare.',
          );
          return;
        }
        if (
          state === 'REJECTED' ||
          state === 'DECLINED' ||
          state === 'EXPIRED' ||
          state === 'CANCELLED'
        ) {
          setParticipantState(state);
          Alert.alert(
            'Dare unavailable',
            `This Dare is currently ${state.toLowerCase()}.`,
          );
          return;
        }
        if (state !== 'SENT' && state !== 'ACCEPTED') {
          throw new Error(
            `This Dare is currently ${state}.`,
          );
        }
      }
      /*
       * Public/open Dare:
       * create the participant if one does not already exist.
       *
       * Existing behavior is preserved.
       */
      if (!existingParticipant) {
        const {
          data: participant,
          error: participantError,
        } = await supabase
          .from('dare_participants')
          .insert({
            dare_id: dare.id,
            user_id: user.id,
            state: 'SENT',
          })
          .select('id,state')
          .single();
        if (participantError || !participant) {
          throw (
            participantError ??
            new Error('Could not create Dare participant.')
          );
        }
        participantId = participant.id;
      }
      if (!participantId) {
        throw new Error(
          'Dare participant could not be created.',
        );
      }
      console.log(
        '[DareDetail] Accepting participant:',
        participantId,
      );
      /*
       * Existing state-machine flow.
       *
       * We deliberately keep transitionDare() as the single
       * source of truth for Dare state transitions.
       */
      const acceptResult = await transitionDare(
        participantId,
        'accept',
      );
      if (!acceptResult.success) {
        throw new Error(
          acceptResult.error ||
            'Could not accept the Dare.',
        );
      }
      if (acceptResult.state !== 'ACCEPTED') {
        throw new Error(
          `Unexpected Dare state: ${acceptResult.state}`,
        );
      }
      setParticipantState('ACCEPTED');
      console.log(
        '[DareDetail] Dare accepted successfully.',
      );
      /*
       * Keep the existing product flow:
       * after accepting, user goes to Active Dares.
       */
      goToDares();
    } catch (error) {
      console.error(
        '[DareDetail] Take Dare error:',
        error,
      );
      const message =
        error instanceof Error
          ? error.message
          : 'Could not take this Dare right now.';
      Alert.alert(
        'Could not take Dare',
        message,
      );
    } finally {
      setTakingDare(false);
    }
  };
  const getActionLabel = () => {
    if (takingDare) {
      return '';
    }
    switch (participantState) {
      case 'IN_PROGRESS':
        return 'GO TO ACTIVE DARES';
      case 'SUBMITTED':
        return 'VIEW ACTIVE DARES';
      case 'VERIFIED':
        return 'VIEW ACTIVE DARES';
      case 'COMPLETED':
        return 'DARE COMPLETED';
      case 'REJECTED':
      case 'DECLINED':
      case 'EXPIRED':
      case 'CANCELLED':
        return 'DARE UNAVAILABLE';
      default:
        return participationOpen ? '⚡ TAKE THE DARE' : 'PARTICIPATION CLOSED';
    }
  };
  const isActionDisabled =
    takingDare ||
    participantState === 'COMPLETED' ||
    participantState === 'REJECTED' ||
    participantState === 'DECLINED' ||
    participantState === 'EXPIRED' ||
    participantState === 'CANCELLED' ||
    (!participantState && !participationOpen);
  const handleActionPress = () => {
    if (
      participantState === 'IN_PROGRESS' ||
      participantState === 'SUBMITTED' ||
      participantState === 'VERIFIED'
    ) {
      goToDares();
      return;
    }
    void handleTakeDare();
  };
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />
        <Text style={styles.loadingText}>
          Loading Dare...
        </Text>
      </View>
    );
  }
  if (!dare) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Dare not found
        </Text>
        <Text style={styles.errorText}>
          This Dare may have been removed, expired, or is no
          longer available.
        </Text>
        <Pressable
          onPress={goHome}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go Home"
        >
          <Text style={styles.backButtonText}>
            Go Home
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={goHome}
          style={({ pressed }) => [
            styles.back,
            pressed && styles.backPressed,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          Dare
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.tagRow}>
            <Chip
              label={(dare.category ?? 'SOCIAL').toUpperCase()}
              variant="neutral"
            />
            <Chip
              label={(dare.difficulty ?? 'EASY').toUpperCase()}
              variant="success"
            />
          </View>
          <Text style={styles.title}>
            {dare.title}
          </Text>
          <Text style={styles.description}>
            {dare.description ||
              'Complete this Dare and prove what you did.'}
          </Text>
          <View style={styles.divider} />
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>
                REWARD
              </Text>
              <Text style={styles.metaValue}>
                +{dare.xp_value} XP
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>
                PROOF
              </Text>
              <Text style={styles.metaValue}>
                {dare.proof_type ?? 'Text'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>
                TIME
              </Text>
              <Text style={styles.metaValue}>
                {dare.time_limit_minutes
                  ? `${dare.time_limit_minutes} min`
                  : 'No limit'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>
                VISIBILITY
              </Text>
              <Text
                style={styles.metaValue}
                numberOfLines={1}
              >
                {dare.visibility === 'anyone'
                  ? 'Anyone'
                  : dare.visibility ?? 'Anyone'}
              </Text>
            </View>
          </View>
          <View style={styles.lifecycleBox}>
            <Text style={styles.lifecycleTitle}>DARE STATUS</Text>
            <Text style={styles.lifecyclePrimary}>
              {participationOpen ? participationEndsAt ? `Participation is open • ${formatRemaining(participationEndsAt)} remaining` : 'Participation is open' : 'Participation is closed'}
            </Text>
            <Text style={styles.lifecycleSecondary}>
              {dare.voting_enabled ? votingLive ? `Voting is LIVE • ${formatRemaining(votingEndsAt)} remaining` : votingFinished ? 'Voting is CLOSED' : votingStartsAt ? `Voting starts in ${formatRemaining(votingStartsAt)}` : 'Voting is scheduled' : 'Voting is OFF'}
            </Text>
            <View style={styles.lifecycleStats}>
              <Text style={styles.lifecycleStat}>{participantCount} Participants</Text>
              <Text style={styles.lifecycleStat}>Participation {formatDuration(dare.participation_duration_minutes)}</Text>
              {dare.voting_enabled && <Text style={styles.lifecycleStat}>Voting {formatDuration(dare.voting_duration_minutes)}</Text>}
            </View>
          </View>

          {participantState &&
          participantState !== 'SENT' &&
          participantState !== 'ACCEPTED' ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>
                CURRENT STATUS
              </Text>
              <Text style={styles.statusValue}>
                {participantState.replace('_', ' ')}
              </Text>
              {participantState === 'IN_PROGRESS' ||
              participantState === 'SUBMITTED' ||
              participantState === 'VERIFIED' ? (
                <Text style={styles.statusText}>
                  Your Dare is already active. Continue from
                  Active Dares.
                </Text>
              ) : participantState === 'COMPLETED' ? (
                <Text style={styles.statusText}>
                  You have already completed this Dare.
                </Text>
              ) : (
                <Text style={styles.statusText}>
                  This Dare cannot currently be started again.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.challengeBox}>
              <Text style={styles.challengeTitle}>
                ⚡ Ready for the challenge?
              </Text>
              <Text style={styles.challengeText}>
                Accept this Dare and it will appear in your
                Active Dares.
              </Text>
            </View>
          )}
          <Pressable
            onPress={handleActionPress}
            disabled={isActionDisabled}
            style={({ pressed }) => [
              styles.takeButton,
              pressed && !isActionDisabled
                ? styles.takeButtonPressed
                : null,
              isActionDisabled
                ? styles.takeButtonDisabled
                : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={getActionLabel()}
          >
            {takingDare ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text
                style={[
                  styles.takeButtonText,
                  participantState === 'COMPLETED' &&
                    styles.completedButtonText,
                ]}
              >
                {getActionLabel()}
              </Text>
            )}
          </Pressable>
          {participantState === 'COMPLETED' && (
            <>
              <Pressable
                onPress={() => {
                  if (!dare.id) return;
                  router.push({
                    pathname: '/dare-response-pool',
                    params: { dareId: dare.id },
                  });
                }}
                style={({ pressed }) => [
                  styles.responsePoolButton,
                  pressed && styles.responsePoolButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open Dare Response Pool"
              >
                <Text style={styles.responsePoolButtonText}>
                  RESPONSE POOL
                </Text>
              </Pressable>
              <Text style={styles.bottomHint}>
                View submitted Dare results and voting responses.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    opacity: 0.6,
  },
  backIcon: {
    color: colors.primaryText,
    fontSize: 36,
    lineHeight: 36,
  },
  headerTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaItem: {
    width: '50%',
    marginBottom: spacing.md,
    paddingRight: spacing.sm,
  },
  metaLabel: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  metaValue: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
  },
  lifecycleBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  lifecycleTitle: { color: colors.secondaryText, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, marginBottom: spacing.xs },
  lifecyclePrimary: { color: colors.primaryText, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, marginBottom: spacing.xs },
  lifecycleSecondary: { color: colors.secondaryText, fontFamily: fontFamily.body, fontSize: fontSize.sm, marginBottom: spacing.sm },
  lifecycleStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  lifecycleStat: { color: colors.secondaryText, fontFamily: fontFamily.body, fontSize: fontSize.xs },

  challengeBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  challengeTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
  },
  challengeText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  statusBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  statusLabel: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  statusValue: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
  },
  statusText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  takeButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  takeButtonPressed: {
    opacity: 0.75,
  },
  takeButtonDisabled: {
    opacity: 0.55,
  },
  takeButtonText: {
    color: '#000000',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  completedButtonText: {
    opacity: 0.8,
  },
  responsePoolButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  responsePoolButtonPressed: {
    opacity: 0.7,
  },
  responsePoolButtonText: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  bottomHint: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  errorTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.75,
  },
  backButtonText: {
    color: '#000000',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});