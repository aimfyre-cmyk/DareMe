import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { DareCard, MockDare } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';

import { colors, fontSize, spacing } from '../../constants/theme';
import { transitionDare } from '../../lib/dareTransitions';
import { supabase } from '../../lib/supabase';

type DareRow = {
  id: string;
  creator_id: string;
  title: string;
  category: string;
  difficulty: string;
  xp_value: number;
  proof_type: string;
  status: string;
  visibility: string;
  created_at: string;
};

function formatDifficulty(value: string): MockDare['difficulty'] {
  const normalized = value.toLowerCase();

  if (normalized === 'hard') {
    return 'Hard';
  }

  if (normalized === 'medium') {
    return 'Medium';
  }

  return 'Easy';
}

type HomeDare = MockDare & {
  creatorId: string;
};

function formatProofType(value: string): MockDare['proofType'] {
  const normalized = value.toLowerCase();

  if (normalized === 'photo') {
    return 'Photo';
  }

  if (normalized === 'video') {
    return 'Video';
  }

  return 'Text';
}

export default function HomeScreen() {
  const [dares, setDares] = useState<HomeDare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takingDare, setTakingDare] = useState<string | null>(null);
  const [inProgressDares, setInProgressDares] = useState<Set<string>>(
    new Set(),
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedDares, setLikedDares] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentDareId, setCommentDareId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const loadDares = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('dares')
        .select(
          'id, creator_id, title, category, difficulty, xp_value, proof_type, status, visibility, created_at',
        )
        .eq('status', 'active')
        .eq('visibility', 'anyone')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);

      const mappedDares = ((data ?? []) as DareRow[]).map((dare) => ({
        id: dare.id,
        creatorId: dare.creator_id,
        title: dare.title,
        category: dare.category,
        difficulty: formatDifficulty(dare.difficulty),
        xpValue: dare.xp_value,
        proofType: formatProofType(dare.proof_type),
      }));

      const dareIds = mappedDares.map((dare) => dare.id);

      if (dareIds.length > 0) {
        const [likesResult, commentsResult] = await Promise.all([
          supabase
            .from('dare_likes')
            .select('dare_id, user_id')
            .in('dare_id', dareIds),
          supabase
            .from('dare_comments')
            .select('dare_id')
            .in('dare_id', dareIds),
        ]);

        if (likesResult.error) {
          throw likesResult.error;
        }

        if (commentsResult.error) {
          throw commentsResult.error;
        }

        const nextLikeCounts: Record<string, number> = {};
        const nextLikedDares = new Set<string>();

        for (const like of likesResult.data ?? []) {
          nextLikeCounts[like.dare_id] =
            (nextLikeCounts[like.dare_id] ?? 0) + 1;

          if (user && like.user_id === user.id) {
            nextLikedDares.add(like.dare_id);
          }
        }

        const nextCommentCounts: Record<string, number> = {};

        for (const comment of commentsResult.data ?? []) {
          nextCommentCounts[comment.dare_id] =
            (nextCommentCounts[comment.dare_id] ?? 0) + 1;
        }

        setLikeCounts(nextLikeCounts);
        setLikedDares(nextLikedDares);
        setCommentCounts(nextCommentCounts);
      } else {
        setLikeCounts({});
        setLikedDares(new Set());
        setCommentCounts({});
      }

      setDares(mappedDares);
    } catch (err) {
      console.error('[Home] Failed to load dares:', err);
      setError('Unable to load dares right now.');
      setDares([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDares();
  }, [loadDares]);

useEffect(() => {
  const loadInProgressDares = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setInProgressDares(new Set());
        return;
      }

      const { data, error } = await supabase
        .from('dare_participants')
        .select('dare_id')
        .eq('user_id', user.id)
        .eq('state', 'IN_PROGRESS');

      if (error) {
        throw error;
      }

      setInProgressDares(
        new Set(
          (data ?? []).map(
            (participant) => participant.dare_id,
          ),
        ),
      );
    } catch (error) {
      console.error(
        '[Home] Failed to load in-progress dares:',
        error,
      );

      setInProgressDares(new Set());
    }
  };

  loadInProgressDares();
}, []);

  const hasDares = dares.length > 0;
  const handleTakeDare = async (dareId: string) => {
  console.log('[Home] TAKE THE DARE:', dareId);
  setTakingDare(dareId);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Please log in before taking a dare.');
    }

    const { data: existingParticipant, error: existingError } =
      await supabase
        .from('dare_participants')
        .select('id,state')
        .eq('dare_id', dareId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }
    console.log(
  '[Home] EXISTING PARTICIPANT:',
  existingParticipant,
);

    let participantId: string;

    if (existingParticipant) {
      participantId = existingParticipant.id;

      if (existingParticipant.state === 'IN_PROGRESS') {
        return;
      }

      if (
        existingParticipant.state !== 'SENT' &&
        existingParticipant.state !== 'ACCEPTED'
      ) {
        throw new Error(
          `This dare is currently ${existingParticipant.state}.`,
        );
      }
    } else {
      const { data: participant, error: participantError } =
        await supabase
          .from('dare_participants')
          .insert({
            dare_id: dareId,
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
    }

    if (existingParticipant?.state !== 'ACCEPTED') {
      const acceptResult = await transitionDare(
        participantId,
        'accept',
      );

      if (acceptResult.state !== 'ACCEPTED') {
        throw new Error(
          `Unexpected state: ${acceptResult.state}`,
        );
      }
    }

    const startResult = await transitionDare(
      participantId,
      'start',
    );

    if (startResult.state !== 'IN_PROGRESS') {
      throw new Error(
        `Unexpected state: ${startResult.state}`,
      );
    }

    console.log('[Home] DARE STARTED:', participantId);
    setInProgressDares((current) => {
  const next = new Set(current);
  next.add(dareId);
  return next;
});
  } catch  (error) {
    
    console.error('[Home] Take dare error:', error);
  }
  finally {
  setTakingDare(null);
}
};

  const handleLike = async (dareId: string) => {
    if (!currentUserId) {
      Alert.alert('Login required', 'Please log in to like a dare.');
      return;
    }

    const alreadyLiked = likedDares.has(dareId);

    setLikedDares((current) => {
      const next = new Set(current);
      if (alreadyLiked) {
        next.delete(dareId);
      } else {
        next.add(dareId);
      }
      return next;
    });

    setLikeCounts((current) => ({
      ...current,
      [dareId]: Math.max(0, (current[dareId] ?? 0) + (alreadyLiked ? -1 : 1)),
    }));

    const query = supabase
      .from('dare_likes')
      .delete()
      .eq('dare_id', dareId)
      .eq('user_id', currentUserId);

    const result = alreadyLiked
      ? await query
      : await supabase.from('dare_likes').insert({
          dare_id: dareId,
          user_id: currentUserId,
        });

    if (result.error) {
      setLikedDares((current) => {
        const next = new Set(current);
        if (alreadyLiked) {
          next.add(dareId);
        } else {
          next.delete(dareId);
        }
        return next;
      });
      setLikeCounts((current) => ({
        ...current,
        [dareId]: Math.max(0, (current[dareId] ?? 0) + (alreadyLiked ? 1 : -1)),
      }));
      console.error('[Home] Dare like error:', result.error);
    }
  };

  const handleComment = (dareId: string) => {
    setCommentDareId(dareId);
    setCommentText('');
  };

  const handleSubmitComment = async () => {
    if (!commentDareId || !currentUserId) {
      return;
    }

    const content = commentText.trim();
    if (!content) {
      return;
    }

    try {
      setCommentSubmitting(true);

      const { error: insertError } = await supabase
        .from('dare_comments')
        .insert({
          dare_id: commentDareId,
          user_id: currentUserId,
          content,
        });

      if (insertError) {
        throw insertError;
      }

      setCommentCounts((current) => ({
        ...current,
        [commentDareId]: (current[commentDareId] ?? 0) + 1,
      }));
      setCommentText('');
      setCommentDareId(null);
    } catch (error) {
      console.error('[Home] Dare comment error:', error);
      Alert.alert('Comment failed', 'Please try again.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleShare = async (dare: MockDare) => {
    try {
      await Share.share({
        message: `🔥 DareMe Challenge: ${dare.title}\n\nTake this dare in DareMe!`,
      });
    } catch (error) {
      console.error('[Home] Dare share error:', error);
    }
  };

  const handleDelete = (dareId: string) => {
    Alert.alert(
      'Delete dare?',
      'This will permanently remove your dare and its social activity.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error: deleteError } = await supabase
              .from('dares')
              .delete()
              .eq('id', dareId)
              .eq('creator_id', currentUserId ?? '');

            if (deleteError) {
              console.error('[Home] Dare delete error:', deleteError);
              Alert.alert('Delete failed', 'Please try again.');
              return;
            }

            setDares((current) => current.filter((dare) => dare.id !== dareId));
            setLikeCounts((current) => {
              const next = { ...current };
              delete next[dareId];
              return next;
            });
            setCommentCounts((current) => {
              const next = { ...current };
              delete next[dareId];
              return next;
            });
            setLikedDares((current) => {
              const next = new Set(current);
              next.delete(dareId);
              return next;
            });
          },
        },
      ],
    );
  };

  return (
    <>
    <Screen>
      <AppHeader
  title="DareMe"
  leftSlot={
    <Pressable
      onPress={() => {
        // Menu will be connected in the next Home step.
      }}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={10}
    >
      <View style={styles.menuIcon}>
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
      </View>
    </Pressable>
  }
  rightSlot={
    <View style={styles.headerActions}>
      <NotificationBell />

      <Pressable
        onPress={() => router.push('/search')}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Search"
        hitSlop={10}
      >
        <View style={styles.searchIcon}>
          <View style={styles.searchCircle} />
          <View style={styles.searchHandle} />
        </View>
      </Pressable>
    </View>
  }
/>

      <SectionHeader title="For You" />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />

          <Text style={styles.stateText}>
            Loading dares...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadDares}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : hasDares ? (
        <View style={styles.feed}>
          <View style={styles.featuredHeader}>
            <Text style={styles.featuredLabel}>
              🔥 TODAY'S DARES
            </Text>

            <Text style={styles.featuredSubtitle}>
              Pick a dare. Take the challenge.
            </Text>
          </View>

          {dares.map((dare) => (
            <DareCard
              key={dare.id}
              dare={dare}
              loading={takingDare === dare.id}
              inProgress={inProgressDares.has(dare.id)}
              likeCount={likeCounts[dare.id] ?? 0}
              commentCount={commentCounts[dare.id] ?? 0}
              likedByMe={likedDares.has(dare.id)}
              onLike={() => handleLike(dare.id)}
              onComment={() => handleComment(dare.id)}
              onShare={() => handleShare(dare)}
              isOwner={dare.creatorId === currentUserId}
              onDelete={() => handleDelete(dare.id)}
              onPress={() => {
                if (inProgressDares.has(dare.id)) {
                  router.replace('/(tabs)/dares');
                  return;
                }

                router.push({
                  pathname: '/dare-detail',
                  params: { id: dare.id },
                });
              }}
              onPrimaryAction={() => {
                handleTakeDare(dare.id);
              }}
            />
          ))}

          <View style={styles.discoverSection}>
            <Text style={styles.discoverTitle}>
              Want to explore more?
            </Text>

            <Pressable
              onPress={() =>
                router.push('/(tabs)/discover')
              }
              style={styles.discoverButton}
              accessibilityRole="button"
              accessibilityLabel="Explore more dares"
            >
              <Text style={styles.discoverButtonText}>
                Explore Discover
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <EmptyState
          title="No new dares yet"
          description="Check back soon for fresh challenges, or explore Discover."
        />
      )}
    </Screen>

    <Modal
      visible={commentDareId !== null}
      transparent
      animationType="slide"
      onRequestClose={() => setCommentDareId(null)}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.modalBackdropPressable}
          onPress={() => setCommentDareId(null)}
        />

        <View style={styles.commentSheet}>
          <View style={styles.commentHandle} />
          <Text style={styles.commentTitle}>Add a comment</Text>

          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write something..."
            placeholderTextColor={colors.secondaryText}
            multiline
            maxLength={1000}
            style={styles.commentInput}
            autoFocus
          />

          <View style={styles.commentActions}>
            <Pressable
              onPress={() => setCommentDareId(null)}
              style={styles.commentCancelButton}
            >
              <Text style={styles.commentCancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmitComment}
              disabled={commentSubmitting || !commentText.trim()}
              style={[
                styles.commentSubmitButton,
                (commentSubmitting || !commentText.trim()) &&
                  styles.commentSubmitButtonDisabled,
              ]}
            >
              <Text style={styles.commentSubmitText}>
                {commentSubmitting ? 'Posting...' : 'Post Comment'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
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
  width: 22,
  height: 22,
  alignItems: 'center',
  justifyContent: 'center',
},

searchCircle: {
  width: 13,
  height: 13,
  borderWidth: 2,
  borderColor: colors.primaryText,
  borderRadius: 7,
  position: 'absolute',
  top: 1,
  left: 1,
},

searchHandle: {
  width: 8,
  height: 2,
  backgroundColor: colors.primaryText,
  borderRadius: 1,
  position: 'absolute',
  transform: [{ rotate: '45deg' }],
  right: 0,
  bottom: 3,
},

menuIcon: {
  width: 22,
  height: 18,
  justifyContent: 'space-between',
},

menuLine: {
  width: 22,
  height: 2,
  backgroundColor: colors.primaryText,
  borderRadius: 1,
},
  feed: {
    paddingBottom: spacing.xl,
  },

  featuredHeader: {
    marginBottom: spacing.md,
  },

  featuredLabel: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  featuredSubtitle: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  stateText: {
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
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  retryText: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  discoverSection: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  discoverTitle: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  discoverButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  discoverButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },

  modalBackdropPressable: {
...StyleSheet.absoluteFill,  },

  commentSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  commentHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },

  commentTitle: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },

  commentInput: {
    minHeight: 110,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.primaryText,
    backgroundColor: colors.surfaceElevated,
    textAlignVertical: 'top',
    fontSize: fontSize.md,
  },

  commentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  commentCancelButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  commentCancelText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  commentSubmitButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  commentSubmitButtonDisabled: {
    opacity: 0.45,
  },

  commentSubmitText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});