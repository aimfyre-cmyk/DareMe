import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import { AppHeader } from '../../components/AppHeader';
import { DareCard, MockDare } from '../../components/DareCard';
import { EmptyState } from '../../components/EmptyState';
import { FloatingMessageButton } from '../../components/FloatingMessageButton';
import { HomeMenu } from '../../components/HomeMenu';
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


type LikeUser = {
  id: string;
  displayName: string;
  username: string | null;
};

type SharePerson = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

type DareComment = {
  id: string;
  dareId: string;
  userId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  displayName: string;
  username: string | null;
  likeCount: number;
  likedByMe: boolean;
};

export default function HomeScreen() {
  const [dares, setDares] = useState<HomeDare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takingDare, setTakingDare] = useState<string | null>(null);
  const [inProgressDares, setInProgressDares] = useState<Set<string>>(
    new Set(),
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [savedDares, setSavedDares] = useState<Set<string>>(
  new Set(),
);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedDares, setLikedDares] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentDareId, setCommentDareId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [comments, setComments] = useState<DareComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyToComment, setReplyToComment] = useState<DareComment | null>(null);
  const [likeUsers, setLikeUsers] = useState<LikeUser[]>([]);
  const [likeUsersDareId, setLikeUsersDareId] = useState<string | null>(null);
  const [likeUsersLoading, setLikeUsersLoading] = useState(false);
  const [shareDareId, setShareDareId] = useState<string | null>(null);
  const [sharePeople, setSharePeople] = useState<SharePerson[]>([]);
  const [shareSelectedIds, setShareSelectedIds] = useState<Set<string>>(new Set());
  const [shareSearch, setShareSearch] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSending, setShareSending] = useState(false);

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
  const loadSavedDares = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSavedDares(new Set());
        return;
      }

      const { data, error } = await supabase
        .from('saved_dares')
        .select('dare_id')
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setSavedDares(
        new Set(
          (data ?? []).map(
            (item) => item.dare_id,
          ),
        ),
      );
    } catch (error) {
      console.error(
        '[Home] Failed to load saved dares:',
        error,
      );

      setSavedDares(new Set());
    }
  };

  loadSavedDares();
}, []);
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


  const hasDares = dares.length > 0;
  const handleSaveDare = async (dareId: string) => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        'Please log in before saving a dare.',
      );
    }

    const isSaved = savedDares.has(dareId);

    if (isSaved) {
      const { error } = await supabase
        .from('saved_dares')
        .delete()
        .eq('dare_id', dareId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setSavedDares((current) => {
        const next = new Set(current);
        next.delete(dareId);
        return next;
      });

      return;
    }

    const { error } = await supabase
      .from('saved_dares')
      .insert({
        dare_id: dareId,
        user_id: user.id,
      });

    if (error) {
      throw error;
    }

    setSavedDares((current) => {
      const next = new Set(current);
      next.add(dareId);
      return next;
    });
  } catch (error) {
    console.error(
      '[Home] Save dare error:',
      error,
    );
  }
};
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

  const loadDareComments = useCallback(
    async (dareId: string) => {
      try {
        setCommentsLoading(true);

        const { data: commentRows, error: commentsError } = await supabase
          .from('dare_comments')
          .select(
            'id,dare_id,user_id,content,parent_comment_id,created_at',
          )
          .eq('dare_id', dareId)
          .order('created_at', { ascending: true });

        if (commentsError) {
          throw commentsError;
        }

        const rows = commentRows ?? [];
        const userIds = [...new Set(rows.map((row) => row.user_id))];
        const commentIds = rows.map((row) => row.id);

        const profilesResult =
          userIds.length > 0
            ? await supabase
                .from('profiles')
                .select('id,username,display_name')
                .in('id', userIds)
            : { data: [], error: null };

        if (profilesResult.error) {
          throw profilesResult.error;
        }

        const likesResult =
          commentIds.length > 0
            ? await supabase
                .from('dare_comment_likes')
                .select('comment_id,user_id')
                .in('comment_id', commentIds)
            : { data: [], error: null };

        if (likesResult.error) {
          throw likesResult.error;
        }

        const profileMap = new Map<string, { username: string | null; display_name: string | null }>();
        for (const profile of (profilesResult.data ?? []) as Array<{
          id: string;
          username: string | null;
          display_name: string | null;
        }>) {
          profileMap.set(profile.id, profile);
        }

        const likeRows = likesResult.data ?? [];
        const mappedComments: DareComment[] = rows.map((row) => {
          const profile = profileMap.get(row.user_id);
          const commentLikes = likeRows.filter(
            (like) => like.comment_id === row.id,
          );

          return {
            id: row.id,
            dareId: row.dare_id,
            userId: row.user_id,
            content: row.content,
            parentCommentId: row.parent_comment_id ?? null,
            createdAt: row.created_at,
            displayName:
              profile?.display_name ||
              profile?.username ||
              'DareMe User',
            username: profile?.username ?? null,
            likeCount: commentLikes.length,
            likedByMe:
              currentUserId !== null &&
              commentLikes.some(
                (like) => like.user_id === currentUserId,
              ),
          };
        });

        setComments(mappedComments);
        setCommentCounts((current) => ({
          ...current,
          [dareId]: mappedComments.length,
        }));
      } catch (error) {
        console.error('[Home] Load dare comments error:', error);
        Alert.alert('Comments unavailable', 'Could not load comments right now.');
      } finally {
        setCommentsLoading(false);
      }
    },
    [currentUserId],
  );

  const handleLikeCountPress = async (dareId: string) => {
    try {
      setLikeUsersLoading(true);
      setLikeUsersDareId(dareId);

      const { data: likes, error: likesError } = await supabase
        .from('dare_likes')
        .select('user_id')
        .eq('dare_id', dareId);

      if (likesError) {
        throw likesError;
      }

      const userIds = Array.from(
        new Set<string>(
          (likes ?? []).map(
            (like: { user_id: string }) => like.user_id,
          ),
        ),
      );

      if (userIds.length === 0) {
        setLikeUsers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id,username,display_name')
        .in('id', userIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map<string, {
        id: string;
        username: string | null;
        display_name: string | null;
      }>();

      for (const profile of (profiles ?? []) as Array<{
        id: string;
        username: string | null;
        display_name: string | null;
      }>) {
        profileMap.set(profile.id, profile);
      }

      setLikeUsers(
        userIds.map((userId) => {
          const profile = profileMap.get(userId);
          return {
            id: userId,
            displayName:
              profile?.display_name ||
              profile?.username ||
              'DareMe User',
            username: profile?.username ?? null,
          };
        }),
      );
    } catch (error) {
      console.error('[Home] Load dare like users error:', error);
      Alert.alert('Likes unavailable', 'Could not load the people who liked this dare.');
      setLikeUsersDareId(null);
    } finally {
      setLikeUsersLoading(false);
    }
  };

  const handleComment = (dareId: string) => {
    setCommentDareId(dareId);
    setCommentText('');
    setReplyToComment(null);
    void loadDareComments(dareId);
  };

  const handleReply = (comment: DareComment) => {
    setReplyToComment(comment);
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
          parent_comment_id: replyToComment?.id ?? null,
        });

      if (insertError) {
        throw insertError;
      }

      setCommentText('');
      setReplyToComment(null);
      await loadDareComments(commentDareId);
    } catch (error) {
      console.error('[Home] Dare comment error:', error);
      Alert.alert('Comment failed', 'Please try again.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!currentUserId) {
      Alert.alert('Login required', 'Please log in to like a comment.');
      return;
    }

    const target = comments.find((comment) => comment.id === commentId);
    if (!target) {
      return;
    }

    const alreadyLiked = target.likedByMe;

    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              likedByMe: !alreadyLiked,
              likeCount: Math.max(
                0,
                comment.likeCount + (alreadyLiked ? -1 : 1),
              ),
            }
          : comment,
      ),
    );

    const result = alreadyLiked
      ? await supabase
          .from('dare_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId)
      : await supabase.from('dare_comment_likes').insert({
          comment_id: commentId,
          user_id: currentUserId,
        });

    if (result.error) {
      console.error('[Home] Dare comment like error:', result.error);
      await loadDareComments(commentDareId ?? target.dareId);
      Alert.alert('Like failed', 'Please try again.');
    }
  };

  const handleShare = async (dare: MockDare) => {
    if (!currentUserId) {
      Alert.alert('Login required', 'Please log in to share a dare.');
      return;
    }

    setShareDareId(dare.id);
    setSharePeople([]);
    setShareSelectedIds(new Set());
    setShareSearch('');
    setShareLoading(true);

    try {
      const [followersResult, followingResult] = await Promise.all([
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', currentUserId),
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId),
      ]);

      if (followersResult.error) {
        throw followersResult.error;
      }

      if (followingResult.error) {
        throw followingResult.error;
      }

      const personIds = Array.from(
        new Set([
          ...(followersResult.data ?? []).map(
            (row: { follower_id: string }) => row.follower_id,
          ),
          ...(followingResult.data ?? []).map(
            (row: { following_id: string }) => row.following_id,
          ),
        ]),
      ).filter((id) => id !== currentUserId);

      if (personIds.length === 0) {
        setSharePeople([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .in('id', personIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map(
        ((profiles ?? []) as Array<{
          id: string;
          display_name: string | null;
          username: string | null;
          avatar_url: string | null;
        }>).map((profile) => [profile.id, profile]),
      );

      const people = personIds
        .map((id) => profileMap.get(id))
        .filter(Boolean)
        .map((profile) => ({
          id: profile!.id,
          displayName:
            profile!.display_name ||
            profile!.username ||
            'DareMe User',
          username: profile!.username ?? null,
          avatarUrl: profile!.avatar_url ?? null,
        }));

      setSharePeople(people);
    } catch (error) {
      console.error('[Home] Load share people error:', error);
      Alert.alert(
        'Share unavailable',
        'Could not load your followers and following right now.',
      );
      setShareDareId(null);
    } finally {
      setShareLoading(false);
    }
  };

  const toggleShareRecipient = (userId: string) => {
    setShareSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSendShare = async () => {
    if (!shareDareId || !currentUserId || shareSelectedIds.size === 0) {
      return;
    }

    try {
      setShareSending(true);

      const rows = Array.from(shareSelectedIds).map((recipientId) => ({
        dare_id: shareDareId,
        sender_id: currentUserId,
        recipient_id: recipientId,
      }));

      const { error } = await supabase
        .from('dare_shares')
        .upsert(rows, {
          onConflict: 'dare_id,recipient_id',
          ignoreDuplicates: true,
        });

      if (error) {
        throw error;
      }

      setShareDareId(null);
      setShareSelectedIds(new Set());
      setShareSearch('');
      Alert.alert('Shared successfully', 'The dare was sent successfully.');
    } catch (error) {
      console.error('[Home] Dare share send error:', error);
      Alert.alert('Share failed', 'Could not share this dare. Please try again.');
    } finally {
      setShareSending(false);
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
      onPress={() => setMenuVisible(true)}
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
<HomeMenu
  visible={menuVisible}
  onClose={() => setMenuVisible(false)}
  items={[
    {
      title: 'My Dares',
      subtitle: 'Dares you created',
      icon: '',
      onPress: () => router.replace('/(tabs)/dares'),
    },
    {
      title: 'Saved',
      subtitle: 'Your saved content',
      icon: '',
      onPress: () => router.push('/saved'),
    },
    {
  title: 'My Activity',
  subtitle: 'Your DareMe activity',
  icon: '',
  onPress: () => router.push('/my-activity'),
},
    {
  title: 'Dare Circle',
  subtitle: 'People you follow and connect with',
  icon: '',
  onPress: () => router.push('/dare-circle'),
},
    {
  title: 'Invite Friends',
  subtitle: 'Invite people to DareMe',
  icon: '',
  onPress: () => router.push('/invite-friends'),
},
    {
      title: 'Leaderboard',
      subtitle: 'Compete in DareMe',
      icon: '🏆',
      onPress: () => router.push('/leaderboard'),
    },
    {
  title: 'Global Ranking',
  subtitle: 'See your worldwide XP rank',
  icon: '',
  onPress: () => router.push('/global-ranking'),
},
    {
  title: 'Rewards',
  subtitle: 'XP, badges and rewards',
  icon: '',
  onPress: () => router.push('/rewards'),
},
  ]}
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
              onLikeCountPress={() => handleLikeCountPress(dare.id)}
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
              savedByMe={savedDares.has(dare.id)}
onSave={() => handleSaveDare(dare.id)}
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
          <FloatingMessageButton />

    <Modal
      visible={commentDareId !== null}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setCommentDareId(null);
        setReplyToComment(null);
      }}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.modalBackdropPressable}
          onPress={() => {
            setCommentDareId(null);
            setReplyToComment(null);
          }}
        />

        <View style={styles.commentSheet}>
          <View style={styles.commentHandle} />
          <View style={styles.commentHeaderRow}>
            <Text style={styles.commentTitle}>Comments</Text>
            <Pressable
              onPress={() => {
                if (commentDareId) {
                  void loadDareComments(commentDareId);
                }
              }}
              hitSlop={10}
            >
              <Ionicons
                name="refresh-outline"
                size={21}
                color={colors.primaryText}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {commentsLoading ? (
              <View style={styles.commentsState}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.commentsStateText}>Loading comments...</Text>
              </View>
            ) : comments.filter((comment) => !comment.parentCommentId).length === 0 ? (
              <View style={styles.commentsState}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={30}
                  color={colors.secondaryText}
                />
                <Text style={styles.commentsStateText}>
                  No comments yet. Be the first.
                </Text>
              </View>
            ) : (
              comments
                .filter((comment) => !comment.parentCommentId)
                .map((comment) => (
                  <DareCommentItem
                    key={comment.id}
                    comment={comment}
                    allComments={comments}
                    onLike={handleCommentLike}
                    onReply={handleReply}
                  />
                ))
            )}
          </ScrollView>

          {replyToComment ? (
            <View style={styles.replyingBar}>
              <Text style={styles.replyingText} numberOfLines={1}>
                Replying to {replyToComment.displayName}
              </Text>
              <Pressable
                onPress={() => setReplyToComment(null)}
                hitSlop={10}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.secondaryText}
                />
              </Pressable>
            </View>
          ) : null}

          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder={
              replyToComment ? 'Write a reply...' : 'Write a comment...'
            }
            placeholderTextColor={colors.secondaryText}
            multiline
            maxLength={1000}
            style={styles.commentInput}
          />

          <View style={styles.commentActions}>
            <Pressable
              onPress={() => {
                setCommentDareId(null);
                setReplyToComment(null);
              }}
              style={styles.commentCancelButton}
            >
              <Text style={styles.commentCancelText}>Close</Text>
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
                {commentSubmitting
                  ? 'Posting...'
                  : replyToComment
                    ? 'Post Reply'
                    : 'Post Comment'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal
      visible={shareDareId !== null}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!shareSending) {
          setShareDareId(null);
          setShareSelectedIds(new Set());
          setShareSearch('');
        }
      }}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.modalBackdropPressable}
          onPress={() => {
            if (!shareSending) {
              setShareDareId(null);
              setShareSelectedIds(new Set());
              setShareSearch('');
            }
          }}
        />

        <View style={styles.shareSheet}>
          <View style={styles.commentHandle} />

          <View style={styles.commentHeaderRow}>
            <View>
              <Text style={styles.commentTitle}>Share Dare</Text>
              <Text style={styles.shareSubtitle}>
                Send this dare to people you follow or who follow you.
              </Text>
            </View>

            <Pressable
              onPress={() => {
                if (!shareSending) {
                  setShareDareId(null);
                  setShareSelectedIds(new Set());
                  setShareSearch('');
                }
              }}
              hitSlop={10}
              disabled={shareSending}
            >
              <Ionicons
                name="close"
                size={24}
                color={colors.primaryText}
              />
            </Pressable>
          </View>

          <View style={styles.shareSearchBox}>
            <Ionicons
              name="search-outline"
              size={19}
              color={colors.secondaryText}
            />
            <TextInput
              value={shareSearch}
              onChangeText={setShareSearch}
              placeholder="Search people..."
              placeholderTextColor={colors.secondaryText}
              style={styles.shareSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {shareLoading ? (
            <View style={styles.commentsState}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.commentsStateText}>
                Loading people...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.sharePeopleList}
              contentContainerStyle={styles.sharePeopleListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {sharePeople.filter((person) => {
                const query = shareSearch.trim().toLowerCase();
                if (!query) {
                  return true;
                }

                return (
                  person.displayName.toLowerCase().includes(query) ||
                  (person.username ?? '').toLowerCase().includes(query)
                );
              }).length === 0 ? (
                <View style={styles.commentsState}>
                  <Ionicons
                    name="people-outline"
                    size={30}
                    color={colors.secondaryText}
                  />
                  <Text style={styles.commentsStateText}>
                    No people to share with yet
                  </Text>
                </View>
              ) : (
                sharePeople
                  .filter((person) => {
                    const query = shareSearch.trim().toLowerCase();
                    if (!query) {
                      return true;
                    }

                    return (
                      person.displayName.toLowerCase().includes(query) ||
                      (person.username ?? '').toLowerCase().includes(query)
                    );
                  })
                  .map((person) => {
                    const selected = shareSelectedIds.has(person.id);

                    return (
                      <Pressable
                        key={person.id}
                        onPress={() => toggleShareRecipient(person.id)}
                        style={[
                          styles.sharePersonRow,
                          selected && styles.sharePersonRowSelected,
                        ]}
                        disabled={shareSending}
                      >
                        <View style={styles.sharePersonAvatar}>
                          {person.avatarUrl ? (
                            <Image
                              source={{ uri: person.avatarUrl }}
                              style={styles.sharePersonAvatarImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={styles.sharePersonAvatarText}>
                              {person.displayName.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View style={styles.sharePersonInfo}>
                          <Text style={styles.sharePersonName}>
                            {person.displayName}
                          </Text>
                          {person.username ? (
                            <Text style={styles.sharePersonUsername}>
                              @{person.username}
                            </Text>
                          ) : null}
                        </View>

                        <View
                          style={[
                            styles.shareSelectButton,
                            selected && styles.shareSelectButtonSelected,
                          ]}
                        >
                          <Ionicons
                            name={selected ? 'checkmark' : 'paper-plane-outline'}
                            size={18}
                            color={
                              selected
                                ? colors.background
                                : colors.primaryText
                            }
                          />
                          <Text
                            style={[
                              styles.shareSelectText,
                              selected && styles.shareSelectTextSelected,
                            ]}
                          >
                            {selected ? 'Selected' : 'Send'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
              )}
            </ScrollView>
          )}

          <View style={styles.shareFooter}>
            <Text style={styles.shareSelectedCount}>
              {shareSelectedIds.size} selected
            </Text>

            <Pressable
              onPress={handleSendShare}
              disabled={shareSending || shareSelectedIds.size === 0}
              style={[
                styles.shareSendButton,
                (shareSending || shareSelectedIds.size === 0) &&
                  styles.shareSendButtonDisabled,
              ]}
            >
              <Text style={styles.shareSendButtonText}>
                {shareSending ? 'Sharing...' : 'Share'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal
      visible={likeUsersDareId !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setLikeUsersDareId(null)}
    >
      <View style={styles.likeUsersBackdrop}>
        <Pressable
          style={styles.likeUsersBackdropPressable}
          onPress={() => setLikeUsersDareId(null)}
        />
        <View style={styles.likeUsersSheet}>
          <View style={styles.commentHeaderRow}>
            <Text style={styles.commentTitle}>Liked by</Text>
            <Pressable
              onPress={() => setLikeUsersDareId(null)}
              hitSlop={10}
            >
              <Ionicons
                name="close"
                size={24}
                color={colors.primaryText}
              />
            </Pressable>
          </View>

          {likeUsersLoading ? (
            <View style={styles.commentsState}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.commentsStateText}>Loading...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.likeUsersList}
              contentContainerStyle={styles.likeUsersListContent}
              showsVerticalScrollIndicator={false}
            >
              {likeUsers.length === 0 ? (
                <Text style={styles.commentsStateText}>No likes yet.</Text>
              ) : (
                likeUsers.map((user) => (
                  <View key={user.id} style={styles.likeUserRow}>
                    <View style={styles.likeUserAvatar}>
                      <Text style={styles.likeUserAvatarText}>
                        {user.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.likeUserInfo}>
                      <Text style={styles.likeUserName}>
                        {user.displayName}
                      </Text>
                      {user.username ? (
                        <Text style={styles.likeUserUsername}>
                          @{user.username}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="heart"
                      size={18}
                      color="#FF4D67"
                    />
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}


function DareCommentItem({
  comment,
  allComments,
  onLike,
  onReply,
  depth = 0,
}: {
  comment: DareComment;
  allComments: DareComment[];
  onLike: (commentId: string) => void | Promise<void>;
  onReply: (comment: DareComment) => void;
  depth?: number;
}) {
  const replies = allComments.filter(
    (item) => item.parentCommentId === comment.id,
  );

  return (
    <View
      style={[
        styles.commentBlock,
        depth > 0 && styles.nestedCommentBlock,
      ]}
    >
      <View style={styles.commentRow}>
        <View
          style={[
            styles.commentAvatar,
            depth > 0 && styles.replyAvatar,
          ]}
        >
          <Text
            style={[
              styles.commentAvatarText,
              depth > 0 && styles.replyAvatarText,
            ]}
          >
            {comment.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.commentBody}>
          <Text style={styles.commentUserName}>
            {comment.displayName}
          </Text>

          {comment.username ? (
            <Text style={styles.commentUsername}>
              @{comment.username}
            </Text>
          ) : null}

          <Text style={styles.commentContent}>
            {comment.content}
          </Text>

          <View style={styles.commentMetaRow}>
            <Pressable
              onPress={() => onLike(comment.id)}
              style={styles.commentMetaButton}
              hitSlop={6}
            >
              <Ionicons
                name={comment.likedByMe ? 'heart' : 'heart-outline'}
                size={17}
                color={
                  comment.likedByMe
                    ? '#FF4D67'
                    : colors.secondaryText
                }
              />

              {comment.likeCount > 0 ? (
                <Text
                  style={[
                    styles.commentMetaText,
                    comment.likedByMe && styles.commentLikedText,
                  ]}
                >
                  {comment.likeCount}
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => onReply(comment)}
              style={styles.commentMetaButton}
              hitSlop={6}
            >
              <Ionicons
                name="return-down-forward-outline"
                size={17}
                color={colors.secondaryText}
              />

              <Text style={styles.commentMetaText}>
                Reply
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {replies.length > 0 ? (
        <View
          style={[
            styles.repliesContainer,
            depth > 0 && styles.nestedRepliesContainer,
          ]}
        >
          {replies.map((reply) => (
            <DareCommentItem
              key={reply.id}
              comment={reply}
              allComments={allComments}
              onLike={onLike}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </View>
      ) : null}
    </View>
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
    ...StyleSheet.absoluteFill,
  },

  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  commentsList: {
    maxHeight: 390,
  },

  commentsListContent: {
    paddingBottom: spacing.sm,
  },

  commentsState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },

  commentsStateText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  commentBlock: {
    paddingVertical: spacing.sm,
  },

  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  commentAvatarText: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  commentBody: {
    flex: 1,
  },

  commentUserName: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  commentUsername: {
    color: colors.secondaryText,
    fontSize: 11,
    marginTop: 1,
  },

  commentContent: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },

  commentMetaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  commentMetaText: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },

  commentLikedText: {
    color: '#FF4D67',
  },

  repliesContainer: {
    marginLeft: 46,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
    marginTop: spacing.xs,
  },

  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },

  replyAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  replyAvatarText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '700',
  },

  nestedCommentBlock: {
    paddingVertical: spacing.xs,
  },

  nestedRepliesContainer: {
    marginLeft: 36,
    paddingLeft: spacing.sm,
  },

  shareSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '82%',
  },

  shareSubtitle: {
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    maxWidth: 280,
  },

  shareSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },

  shareSearchInput: {
    flex: 1,
    color: colors.primaryText,
    fontSize: fontSize.sm,
    marginLeft: spacing.xs,
  },

  sharePeopleList: {
    maxHeight: 390,
  },

  sharePeopleListContent: {
    paddingBottom: spacing.sm,
  },

  sharePersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
  },

  sharePersonRowSelected: {
    backgroundColor: colors.surfaceElevated,
  },

  sharePersonAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  sharePersonAvatarText: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  sharePersonAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  sharePersonInfo: {
    flex: 1,
    minWidth: 0,
  },

  sharePersonName: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  sharePersonUsername: {
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },

  shareSelectButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  shareSelectButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  shareSelectText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '700',
  },

  shareSelectTextSelected: {
    color: colors.background,
  },

  shareFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },

  shareSelectedCount: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },

  shareSendButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareSendButtonDisabled: {
    opacity: 0.45,
  },

  shareSendButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },

  replyingText: {
    flex: 1,
    color: colors.secondaryText,
    fontSize: 12,
    marginRight: spacing.sm,
  },

  likeUsersBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },

  likeUsersBackdropPressable: {
    ...StyleSheet.absoluteFill,
  },

  likeUsersSheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  likeUsersList: {
    maxHeight: 420,
  },

  likeUsersListContent: {
    paddingTop: spacing.sm,
  },

  likeUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  likeUserAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  likeUserAvatarText: {
    color: colors.primaryText,
    fontWeight: '700',
  },

  likeUserInfo: {
    flex: 1,
  },

  likeUserName: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  likeUserUsername: {
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },

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
