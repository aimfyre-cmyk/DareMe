import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
};

export default function DareDetailScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [dare, setDare] = useState<Dare | null>(null);
  const [loading, setLoading] = useState(true);
  const [takingDare, setTakingDare] = useState(false);

  useEffect(() => {
    const loadDare = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('dares')
          .select(
            'id,title,description,category,difficulty,xp_value,proof_type,visibility,status,time_limit_minutes',
          )
          .eq('id', id)
          .single();

        if (error) {
          console.error('[DareDetail] Load error:', error);
          setDare(null);
          return;
        }

        setDare(data as Dare);
      } catch (error) {
        console.error('[DareDetail] Load exception:', error);
        setDare(null);
      } finally {
        setLoading(false);
      }
    };

    loadDare();
  }, [id]);

  const goToDares = () => {
    console.log('[DareDetail] Going to Dares tab');
    router.replace('/(tabs)/dares');
  };

  const handleTakeDare = async () => {
    if (!dare || takingDare) {
      return;
    }

    console.log('[DareDetail] TAKE DARE CLICKED');

    setTakingDare(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log('[DareDetail] Current user:', user?.id);
      console.log('[DareDetail] Auth error:', userError);

      if (userError || !user) {
        throw new Error('Please log in before taking a dare.');
      }

      console.log('[DareDetail] Checking participant...');

      const {
        data: existingParticipant,
        error: existingError,
      } = await supabase
        .from('dare_participants')
        .select('id,state')
        .eq('dare_id', dare.id)
        .eq('user_id', user.id)
        .maybeSingle();

      console.log(
        '[DareDetail] Participant query finished:',
        existingParticipant,
        existingError,
      );

      if (existingError) {
        throw existingError;
      }

      let participantId: string;

      /*
       * USER ALREADY HAS THIS DARE
       */
      if (existingParticipant) {
        participantId = existingParticipant.id;

        console.log(
          '[DareDetail] Existing participant state:',
          existingParticipant.state,
        );

        /*
         * Already accepted / active:
         * directly open Active Dares.
         */
        if (
          existingParticipant.state === 'ACCEPTED' ||
          existingParticipant.state === 'IN_PROGRESS' ||
          existingParticipant.state === 'SUBMITTED' ||
          existingParticipant.state === 'VERIFIED'
        ) {
          console.log(
            '[DareDetail] Dare already active. Opening Dares.',
          );

          goToDares();
          return;
        }

        /*
         * SENT means it still needs acceptance.
         */
        if (existingParticipant.state !== 'SENT') {
          console.log(
            '[DareDetail] Dare unavailable:',
            existingParticipant.state,
          );

          setTakingDare(false);
          return;
        }
      }

      /*
       * CREATE PARTICIPANT
       */
      if (!existingParticipant) {
        console.log('[DareDetail] Creating participant...');

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
          .select('id')
          .single();

        if (participantError || !participant) {
          throw (
            participantError ??
            new Error('Could not create dare participant.')
          );
        }

        participantId = participant.id;

        console.log(
          '[DareDetail] Participant created:',
          participantId,
        );
      }

      /*
       * ACCEPT DARE
       */
      console.log(
        '[DareDetail] Accepting participant:',
        participantId,
      );

      const result = await transitionDare(
        participantId,
        'accept',
      );

      console.log(
        '[DareDetail] Accept result:',
        result,
      );

      if (!result?.success) {
        throw new Error(
          result?.error || 'Could not accept the dare.',
        );
      }

      if (result.state !== 'ACCEPTED') {
        throw new Error(
          `Unexpected dare state: ${result.state}`,
        );
      }

      /*
       * SUCCESS
       */
      console.log(
        '[DareDetail] DARE ACCEPTED SUCCESSFULLY',
      );

      goToDares();
    } catch (error) {
      console.error(
        '[DareDetail] Take dare error:',
        error,
      );

      setTakingDare(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />
      </View>
    );
  }

  if (!dare) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Dare not found.
        </Text>

        <Pressable
          onPress={() => router.replace('/')}
          style={styles.backButton}
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
          onPress={() => router.replace('/')}
          style={styles.back}
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
              'Complete this dare and prove what you did.'}
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

              <Text style={styles.metaValue}>
                {dare.visibility === 'anyone'
                  ? 'Anyone'
                  : dare.visibility ?? 'Anyone'}
              </Text>
            </View>
          </View>

          <View style={styles.challengeBox}>
            <Text style={styles.challengeTitle}>
              ⚡ Ready for the challenge?
            </Text>

            <Text style={styles.challengeText}>
              Accept this dare and it will appear in your Active Dares.
            </Text>
          </View>

          <Pressable
            onPress={handleTakeDare}
            disabled={takingDare}
            style={({ pressed }) => [
              styles.takeButton,
              pressed && styles.takeButtonPressed,
              takingDare && styles.takeButtonDisabled,
            ]}
          >
            {takingDare ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.takeButtonText}>
                ⚡ TAKE THE DARE
              </Text>
            )}
          </Pressable>
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

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 40,
  },

  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
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

  takeButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  takeButtonPressed: {
    opacity: 0.75,
  },

  takeButtonDisabled: {
    opacity: 0.6,
  },

  takeButtonText: {
    color: '#000000',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  errorText: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },

  backButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  backButtonText: {
    color: '#000000',
    fontFamily: fontFamily.bodyMedium,
  },
});