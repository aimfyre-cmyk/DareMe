import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getR2MediaUrl } from '@/features/onboarding/profileService';

import { DareShotPanel } from '../components/DareShotPanel';
import { colors, fontSize, spacing } from '../constants/theme';
import { supabase } from '../lib/supabase';

type MessageType = 'text' | 'image' | 'video' | 'voice' | 'dare' | 'shared_post';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: MessageType | string;
  content: string | null;
  media_url: string | null;
  dare_id?: string | null;
  reply_to_message_id: string | null;
  created_at: string;
  expires_at?: string | null;
  edited_at: string | null;
  deleted_at: string | null;
};

type IncomingPrivateShot = {
  id: string;
  sender_id: string;
  receiver_id: string;
  shot_type: 'voice' | 'video' | 'mystery';
  status: 'sent' | 'accepted' | 'active' | 'completed' | 'rejected' | 'expired' | 'cancelled';
  title: string | null;
  challenge_text: string | null;
  difficulty: string;
  raise_level: number;
  created_at: string;
};

type SharedPost = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  signedMediaUrl?: string | null;
};

type OtherProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Reaction = {
  message_id: string;
  user_id: string;
  reaction: 'like' | 'laugh' | 'angry' | 'confuse';
};

type PresenceState = Record<string, Array<{ user_id?: string }>>;

const PAGE_SIZE = 40;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const reactionOptions: Array<{ value: Reaction['reaction']; emoji: string; label: string }> = [
  { value: 'like', emoji: '❤️', label: 'Like' },
  { value: 'laugh', emoji: '😂', label: 'Laugh' },
  { value: 'angry', emoji: '😡', label: 'Angry' },
  { value: 'confuse', emoji: '😵', label: 'Confuse' },
];

function nameOf(profile: OtherProfile | null) {
  return profile?.display_name?.trim() || profile?.username || 'DareShot User';
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function messagePreview(message: Message | null) {
  if (!message) return 'Message';
  if (message.message_type === 'image') return 'Photo';
  if (message.message_type === 'video') return 'Video';
  if (message.message_type === 'voice') return 'Voice message';
  if (message.message_type === 'dare') return 'DareShot';
  if (message.message_type === 'shared_post') return 'Shared a post';
  return message.content?.trim() || 'Message';
}

function VideoBubble({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.pause();
  });
return <VideoView player={player} style={styles.mediaVideo} contentFit="cover" />;}

function AudioBubble({ uri, mine }: { uri: string; mine: boolean }) {
  const player = useAudioPlayer(uri, { updateInterval: 250, downloadFirst: true });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || 0;
  const current = status.currentTime || 0;
  return (
    <Pressable
      onPress={() => {
        if (status.playing) player.pause();
        else {
          if (duration > 0 && current >= duration - 0.1) void player.seekTo(0);
          player.play();
        }
      }}
      style={styles.audioBubble}
    >
      <View style={[styles.audioPlay, mine && styles.audioPlayMine]}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={17} color={mine ? '#0B0B0D' : colors.primaryText} />
      </View>
      <View style={styles.audioTrackWrap}>
        <View style={styles.audioTrack}><View style={[styles.audioProgress, { width: duration ? `${Math.min(100, (current / duration) * 100)}%` : '0%' }]} /></View>
        <Text style={[styles.audioTime, mine && styles.audioTimeMine]}>{formatDuration(current)} / {formatDuration(duration)}</Text>
      </View>
    </Pressable>
  );
}



type FullscreenMedia = {
  type: 'image' | 'video' | 'voice';
  uri: string;
  title?: string;
};

function FullscreenVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.fullscreenVideo}
      contentFit="contain"
      nativeControls
    />
  );
}


async function uploadToR2(uri: string, fileName: string, contentType: string) {
  const { data, error } = await supabase.functions.invoke('r2-upload-url', {
    body: { fileName, contentType, folder: 'posts' },
  });
  if (error) throw error;
  const signedUrl = data?.uploadUrl as string | undefined;
  const key = data?.key as string | undefined;
  if (!signedUrl || !key) throw new Error('R2 upload URL was not returned.');

  const result = await FileSystem.uploadAsync(signedUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`R2 upload failed (${result.status}).`);
  }
  return key;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ conversationId?: string; userId?: string }>();
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const otherUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<OtherProfile | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionMessage, setReactionMessage] = useState<Message | null>(null);
  const [messageReactions, setMessageReactions] = useState<Reaction[]>([]);
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Spam or scam');
  const [online, setOnline] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showSharedMedia, setShowSharedMedia] = useState(false);
  const [sharedMedia, setSharedMedia] = useState<Message[]>([]);
  const [sharedMediaLoading, setSharedMediaLoading] = useState(false);
  const [sharedMediaFilter, setSharedMediaFilter] = useState<'all' | 'image' | 'video' | 'voice'>('all');
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [recordingError, setRecordingError] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<FullscreenMedia | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [sharedPosts, setSharedPosts] = useState<Record<string, SharedPost>>({});
const [incomingShots, setIncomingShots] = useState<IncomingPrivateShot[]>([]);
  const [shotActionLoading, setShotActionLoading] = useState<string | null>(null);
  const [showDareShotPanel, setShowDareShotPanel] = useState(false);
  const [activeDareShotId, setActiveDareShotId] = useState<string | null>(null);

  const listRef = useRef<FlatList<Message>>(null);
  const initialScrollDoneRef = useRef(false);
  const swipeValues = useRef<Record<string, Animated.Value>>({}).current;
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const markConversationRead = useCallback(async (userId: string, targetConversationId: string) => {
    const { error: readError } = await supabase.from('direct_message_reads').upsert(
      { conversation_id: targetConversationId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' },
    );
    if (readError) console.warn('[Chat] Read state:', readError);
  }, []);

  const resolveMediaForMessages = useCallback(async (rows: Message[]) => {
    const pairs = await Promise.all(rows.filter((row) => row.media_url).map(async (row) => {
      const signed = await getR2MediaUrl(row.media_url as string);
      return signed ? ([row.id, signed] as const) : null;
    }));
    setMediaUrls((current) => {
      const next = { ...current };
      pairs.forEach((pair) => { if (pair) next[pair[0]] = pair[1]; });
      return next;
    });
  }, []);

  const loadSharedMedia = useCallback(async () => {
    if (!conversationId) return;

    try {
      setSharedMediaLoading(true);

      const { data, error: sharedError } = await supabase
        .from('direct_messages')
        .select('id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .in('message_type', ['image', 'video', 'voice'])
        .order('created_at', { ascending: false })
        .range(0, 199);

      if (sharedError) throw sharedError;

      const rows = (data ?? []) as Message[];
      setSharedMedia(rows);
      void resolveMediaForMessages(rows);
    } catch (err: any) {
      console.error('[Chat] shared media:', err);
      Alert.alert('Shared media failed', err?.message ?? 'Unable to load shared media.');
    } finally {
      setSharedMediaLoading(false);
    }
  }, [conversationId, resolveMediaForMessages]);

  const openSharedMedia = () => {
    setShowMenu(false);
    setSharedMediaFilter('all');
    setShowSharedMedia(true);
    void loadSharedMedia();
  };

  const loadSharedPosts = useCallback(async (messageRows: Message[]) => {
    const sharedMessageIds = messageRows
      .filter((message) => message.message_type === 'shared_post')
      .map((message) => message.id);

    if (sharedMessageIds.length === 0) return;

    try {
      const { data: links, error: linkError } = await supabase
        .from('direct_message_shared_posts')
        .select('message_id, post_id')
        .in('message_id', sharedMessageIds);

      if (linkError) throw linkError;

      const postIds = Array.from(
        new Set((links ?? []).map((row) => row.post_id as string)),
      );

      if (postIds.length === 0) return;

      const { data: blockedRows, error: blockedError } =
        await supabase.rpc('get_blocked_user_ids');
      if (blockedError) throw blockedError;

      const blockedUserIds = new Set(
        (blockedRows ?? [])
          .map((row: { user_id: string | null }) => row.user_id)
          .filter(
            (id: string | null): id is string =>
              typeof id === 'string' && id.length > 0,
          ),
      );

      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id,user_id,content,media_url,media_type')
        .in('id', postIds)
        .eq('status', 'active');

      if (postsError) throw postsError;

      const visiblePosts = (posts ?? []).filter(
        (post) => !blockedUserIds.has(post.user_id),
      );

      const mediaPairs = await Promise.all(
        visiblePosts.map(async (post) => {
          const signedMediaUrl = post.media_url
            ? await getR2MediaUrl(post.media_url)
            : null;
          return [post.id, signedMediaUrl] as const;
        }),
      );

      const mediaMap = new Map<string, string | null>(mediaPairs);
      const postMap = new Map<string, SharedPost>();
      visiblePosts.forEach((post) => {
        postMap.set(post.id, {
          ...(post as SharedPost),
          signedMediaUrl: mediaMap.get(post.id) ?? null,
        });
      });

      const next: Record<string, SharedPost> = {};
      (links ?? []).forEach((link) => {
        const post = postMap.get(link.post_id as string);
        if (post) next[link.message_id as string] = post;
      });
      setSharedPosts((current) => ({ ...current, ...next }));
    } catch (error) {
      console.warn('[Chat] Shared posts:', error);
    }
  }, []);

const loadIncomingShots = useCallback(
  async (receiverId: string, senderId: string) => {
    try {
      const { data, error } = await supabase
        .from('private_shots')
        .select(
          'id, sender_id, receiver_id, shot_type, status, title, challenge_text, difficulty, raise_level, created_at',
        )
        .eq('receiver_id', receiverId)
        .eq('sender_id', senderId)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setIncomingShots((data ?? []) as IncomingPrivateShot[]);
    } catch (error) {
      console.warn('[Chat] Incoming Shots:', error);
      setIncomingShots([]);
    }
  },
  [],
);


  const loadInitial = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      setError(null);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('You must be logged in to use messages.');
      currentUserRef.current = user.id;
      setCurrentUserId(user.id);
      setSharedPosts({});

      const { data: memberCheck, error: memberError } = await supabase
        .from('direct_conversation_members')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!memberCheck) throw new Error('You are not a member of this conversation.');

      if (otherUserId) {
        const { data: blockRow, error: blockError } = await supabase
          .from('user_blocks')
          .select('id, blocker_id, blocked_id')
          .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`)
          .limit(2);

        if (blockError) {
          console.warn('[Chat] Block state:', blockError);
        } else {
          const rows = blockRow ?? [];
          setBlockedByMe(rows.some((row) => row.blocker_id === user.id && row.blocked_id === otherUserId));
          const blockedMe = rows.some((row) => row.blocker_id === otherUserId && row.blocked_id === user.id);
          const blockedThem = rows.some((row) => row.blocker_id === user.id && row.blocked_id === otherUserId);
          setBlockedByMe(blockedThem);
          setBlockedByOther(blockedMe);
          if (blockedThem || blockedMe) {
            setProfile((current) => current ? { ...current, avatar_url: null } : current);
          }
        }
      }

      const { data: rows, error: messagesError } = await supabase
        .from('direct_messages')
        .select('id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (messagesError) throw messagesError;
      const loaded = ((rows ?? []) as Message[]).reverse();
      setMessages(loaded);
      setHasMore((rows ?? []).length === PAGE_SIZE);
      void resolveMediaForMessages(loaded);
      void loadSharedPosts(loaded);

      if (otherUserId) {
        const [{ data: profileRow, error: profileError }, { data: otherReadRow, error: readError }] = await Promise.all([
          supabase.from('profiles').select('id, display_name, username, avatar_url').eq('id', otherUserId).maybeSingle(),
          supabase.from('direct_message_reads').select('last_read_at').eq('conversation_id', conversationId).eq('user_id', otherUserId).maybeSingle(),
        ]);
        if (profileError) throw profileError;
        if (readError) console.warn('[Chat] Other read state:', readError);
        setOtherUserLastReadAt(otherReadRow?.last_read_at ?? null);
        if (profileRow) {
          const nextProfile = { ...(profileRow as OtherProfile), avatar_url: profileRow.avatar_url ? await getR2MediaUrl(profileRow.avatar_url) : null };
          setProfile(nextProfile);
        }
      }

      if (loaded.length > 0) {
        const { data: reactionRows, error: reactionsError } = await supabase
          .from('direct_message_reactions')
          .select('message_id, user_id, reaction')
          .in('message_id', loaded.map((message) => message.id));
        if (!reactionsError) setMessageReactions((reactionRows ?? []) as Reaction[]);
      } else {
        setMessageReactions([]);
      }

      await markConversationRead(user.id, conversationId);
      if (otherUserId) {
  void loadIncomingShots(user.id, otherUserId);
}
    } catch (err: any) {
      console.error('[Chat] load:', err);
      setError(err?.message ?? 'Unable to load this conversation right now.');
    } finally {
      setLoading(false);
    }
}, [
  conversationId,
  loadIncomingShots,
  loadSharedPosts,
  markConversationRead,
  otherUserId,
  resolveMediaForMessages,
]);
  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const { data: rows, error: messagesError } = await supabase
        .from('direct_messages')
        .select('id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (messagesError) throw messagesError;
      const older = ((rows ?? []) as Message[]).reverse();
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      setMessages((current) => [...older, ...current]);
      setHasMore(older.length === PAGE_SIZE);
      void resolveMediaForMessages(older);
      void loadSharedPosts(older);
    } catch (err) {
      console.warn('[Chat] loadOlder:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId,loadIncomingShots,hasMore, loadSharedPosts, loadingOlder, messages, resolveMediaForMessages]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
    void loadInitial();
  }, [loadInitial]);

  const scrollToLatestMessage = useCallback(() => {
    if (messages.length === 0) return;

    // FlatList can finish measuring after onContentSizeChange fires.
    // Retry a few times so the first opening always lands on the latest message.
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 350);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 700);
    initialScrollDoneRef.current = true;
  }, [messages.length]);

  const handleInitialContentSizeChange = useCallback(() => {
    if (initialScrollDoneRef.current || messages.length === 0) return;
    scrollToLatestMessage();
  }, [messages.length, scrollToLatestMessage]);

  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDoneRef.current) {
      scrollToLatestMessage();
    }
  }, [loading, messages.length, scrollToLatestMessage]);


  useEffect(() => {
    return () => {
      if (presenceChannelRef.current) void supabase.removeChannel(presenceChannelRef.current);
    };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`chat:${conversationId}`);
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const incoming = payload.new as Message;
        if (incoming.sender_id === currentUserRef.current) return;
        setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming]);
        void resolveMediaForMessages([incoming]);
        if (incoming.message_type === 'shared_post') void loadSharedPosts([incoming]);
        requestAnimationFrame(() => {
          if (isNearBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
        });
        if (currentUserRef.current) void markConversationRead(currentUserRef.current, conversationId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const updated = payload.new as Message;
        setMessages((current) => updated.deleted_at ? current.filter((item) => item.id !== updated.id) : current.map((item) => item.id === updated.id ? updated : item));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_message_reactions' }, (payload) => {
        const reaction = payload.new as Reaction;
        if (!messages.some((message) => message.id === reaction.message_id)) return;
        setMessageReactions((current) => [...current.filter((item) => !(item.message_id === reaction.message_id && item.user_id === reaction.user_id)), reaction]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_message_reactions' }, (payload) => {
        const reaction = payload.new as Reaction;
        setMessageReactions((current) => current.map((item) => item.message_id === reaction.message_id && item.user_id === reaction.user_id ? reaction : item));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'direct_message_reactions' }, (payload) => {
        const old = payload.old as Reaction;
        setMessageReactions((current) => current.filter((item) => !(item.message_id === old.message_id && item.user_id === old.user_id)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_message_reads', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string };
        if (row.user_id === otherUserId) setOtherUserLastReadAt(row.last_read_at);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_message_reads', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string };
        if (row.user_id === otherUserId) setOtherUserLastReadAt(row.last_read_at);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, markConversationRead, otherUserId, resolveMediaForMessages]);

  useEffect(() => {
    if (!otherUserId || !currentUserId) return;

    const previousChannel = presenceChannelRef.current;
    if (previousChannel) {
      void supabase.removeChannel(previousChannel);
      presenceChannelRef.current = null;
    }

    const channelKey = conversationId
      ? `conversation:${conversationId}`
      : `users:${[currentUserId, otherUserId].sort().join(':')}`;

    const channel = supabase.channel(`presence:chat:${channelKey}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceChannelRef.current = channel;

    const sync = () => {
      const state = channel.presenceState() as PresenceState;
      const isPresent = Object.values(state).some((entries) =>
        entries.some((entry) => entry.user_id === otherUserId),
      );
      setOnline(isPresent);
    };

    // Register all callbacks BEFORE subscribe().
    channel.on('presence', { event: 'sync' }, sync);
    channel.on('presence', { event: 'join' }, sync);
    channel.on('presence', { event: 'leave' }, sync);

    let cancelled = false;

    void channel.subscribe(async (status) => {
      if (cancelled || status !== 'SUBSCRIBED') return;

      try {
        await channel.track({
          user_id: currentUserId,
          last_seen_at: new Date().toISOString(),
        });
        if (!cancelled) sync();
      } catch (error) {
        console.log('PRESENCE TRACK ERROR:', error);
      }
    });

    return () => {
      cancelled = true;
      if (presenceChannelRef.current === channel) {
        presenceChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, otherUserId]);

  const deleteMessage = async (message: Message) => {
    if (!currentUserId || message.sender_id !== currentUserId) return;

    try {
      const deletedAt = new Date().toISOString();

      const { data, error: deleteError } = await supabase
        .from('direct_messages')
        .update({ deleted_at: deletedAt })
        .eq('id', message.id)
        .eq('sender_id', currentUserId)
        .is('deleted_at', null)
        .select('id, deleted_at')
        .single();

      if (deleteError) throw deleteError;
      if (!data?.id) throw new Error('Message was not deleted. Check the message delete policy.');

      setMessages((current) => current.filter((item) => item.id !== message.id));
      setMessageReactions((current) => current.filter((item) => item.message_id !== message.id));
      setMediaUrls((current) => {
        const next = { ...current };
        delete next[message.id];
        return next;
      });
      setReactionMessage(null);
    } catch (err: any) {
      Alert.alert('Delete failed', err?.message ?? 'Unable to delete this message.');
    }
  };

  const toggleMessageSelection = (message: Message) => {
    if (message.sender_id !== currentUserId) return;

    setSelectedMessageIds((current) =>
      current.includes(message.id)
        ? current.filter((id) => id !== message.id)
        : [...current, message.id],
    );
  };

  const cancelMessageSelection = () => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
  };

  const startMessageSelection = (message: Message) => {
    if (message.sender_id !== currentUserId) return;

    setReactionMessage(null);
    setSelectionMode(true);
    setSelectedMessageIds([message.id]);
  };

  const deleteSelectedMessages = async () => {
    if (!currentUserId || selectedMessageIds.length === 0) return;

    const ids = [...selectedMessageIds];

    Alert.alert(
      'Delete messages?',
      `Delete ${ids.length} selected message${ids.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedAt = new Date().toISOString();

              const { data, error: deleteError } = await supabase
                .from('direct_messages')
                .update({ deleted_at: deletedAt })
                .eq('sender_id', currentUserId)
                .in('id', ids)
                .is('deleted_at', null)
                .select('id, deleted_at');

              if (deleteError) throw deleteError;

              const deletedIds = (data ?? []).map((row) => row.id as string);

              if (deletedIds.length !== ids.length) {
                throw new Error(
                  'Some messages were not deleted. Check the message delete policy.',
                );
              }

              setMessages((current) =>
                current.filter((item) => !deletedIds.includes(item.id)),
              );
              setMessageReactions((current) =>
                current.filter((item) => !deletedIds.includes(item.message_id)),
              );
              setMediaUrls((current) => {
                const next = { ...current };
                deletedIds.forEach((id) => delete next[id]);
                return next;
              });

              cancelMessageSelection();
            } catch (err: any) {
              Alert.alert(
                'Delete failed',
                err?.message ?? 'Unable to delete selected messages.',
              );
            }
          },
        },
      ],
    );
  };

  const saveReaction = async (reaction: Reaction['reaction']) => {
    if (!reactionMessage || !currentUserId) return;
    try {
      const existing = messageReactions.find((item) => item.message_id === reactionMessage.id && item.user_id === currentUserId);
      if (existing?.reaction === reaction) {
        const { error } = await supabase.from('direct_message_reactions').delete().eq('message_id', reactionMessage.id).eq('user_id', currentUserId);
        if (error) throw error;
        setMessageReactions((current) => current.filter((item) => !(item.message_id === reactionMessage.id && item.user_id === currentUserId)));
      } else {
        const { data, error } = await supabase.from('direct_message_reactions').upsert({ message_id: reactionMessage.id, user_id: currentUserId, reaction }, { onConflict: 'message_id,user_id' }).select('message_id, user_id, reaction').single();
        if (error) throw error;
        if (data) setMessageReactions((current) => [...current.filter((item) => !(item.message_id === reactionMessage.id && item.user_id === currentUserId)), data as Reaction]);
      }
      setReactionMessage(null);
    } catch (err: any) {
      Alert.alert('Reaction failed', err?.message ?? 'Unable to save reaction.');
    }
  };

  const sendTextMessage = async () => {
    const content = input.trim();
    if (!content || !conversationId || !currentUserId || sending || blockedByMe || blockedByOther) return;
    try {
      setSending(true);
      const { data, error: sendError } = await supabase.from('direct_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        message_type: 'text',
        content,
        reply_to_message_id: replyingTo?.id ?? null,
      }).select('id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at').single();
      if (sendError) throw sendError;
      if (data) {
        setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as Message]);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
      setInput('');
      setReplyingTo(null);
    } catch (err: any) {
      Alert.alert('Message not sent', err?.message ?? 'Unable to send this message right now.');
    } finally {
      setSending(false);
    }
  };

  const captureMedia = async () => {
    if (!conversationId || !currentUserId || uploading || blockedByMe || blockedByOther) return;

    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Allow camera access to take a photo or video.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.9,
        videoMaxDuration: 60,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > MAX_MEDIA_BYTES) {
        Alert.alert(
          'File too large',
          'Please choose a file smaller than 50 MB.',
        );
        return;
      }

      const type = asset.type === 'video' ? 'video' : 'image';
      const contentType =
        asset.mimeType ||
        (type === 'video' ? 'video/mp4' : 'image/jpeg');
      const extension =
        asset.fileName?.split('.').pop() ||
        (type === 'video' ? 'mp4' : 'jpg');

      setUploading(true);

      const key = await uploadToR2(
        asset.uri,
        `message-camera-${Date.now()}.${extension}`,
        contentType,
      );

      const { data, error: sendError } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          message_type: type,
          content: null,
          media_url: key,
          reply_to_message_id: replyingTo?.id ?? null,
        })
        .select(
          'id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at',
        )
        .single();

      if (sendError) throw sendError;

      if (data) {
        const message = data as Message;
        setMessages((current) =>
          current.some((item) => item.id === message.id)
            ? current
            : [...current, message],
        );
        void resolveMediaForMessages([message]);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }

      setReplyingTo(null);
    } catch (err: any) {
      console.error('[Chat] camera capture:', err);
      Alert.alert(
        'Camera upload failed',
        err?.message ?? 'Unable to send this photo or video.',
      );
    } finally {
      setUploading(false);
    }
  };

  const pickMedia = async () => {
    if (!conversationId || !currentUserId || uploading || blockedByMe || blockedByOther) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Allow photo and video access to attach media.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9, allowsEditing: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_MEDIA_BYTES) {
        Alert.alert('File too large', 'Please choose a file smaller than 50 MB.');
        return;
      }
      const type = asset.type === 'video' ? 'video' : 'image';
      const contentType = asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg');
      const extension = asset.fileName?.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg');
      setUploading(true);
      const key = await uploadToR2(asset.uri, `message-${Date.now()}.${extension}`, contentType);
      const { data, error: sendError } = await supabase.from('direct_messages').insert({ conversation_id: conversationId, sender_id: currentUserId, message_type: type, content: null, media_url: key, reply_to_message_id: replyingTo?.id ?? null }).select('id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at').single();
      if (sendError) throw sendError;
      if (data) {
        const message = data as Message;
        setMessages((current) => [...current, message]);
        void resolveMediaForMessages([message]);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
      setReplyingTo(null);
    } catch (err: any) {
      console.error('[Chat] media upload:', err);
      Alert.alert('Media upload failed', err?.message ?? 'Unable to send this media.');
    } finally {
      setUploading(false);
    }
  };

  const toggleRecording = async () => {
    if (blockedByMe || blockedByOther) return;
    try {
      setRecordingError('');
      if (recorderState.isRecording) {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri || !conversationId || !currentUserId) return;
        setUploading(true);
        const key = await uploadToR2(uri, `voice-${Date.now()}.m4a`, 'audio/m4a');
        const { data, error: sendError } = await supabase.from('direct_messages').insert({ conversation_id: conversationId, sender_id: currentUserId,   message_type: 'voice', content: null, media_url: key, reply_to_message_id: replyingTo?.id ?? null }).select('id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at').single();
        if (sendError) throw sendError;
        if (data) {
          const message = data as Message;
          setMessages((current) => [...current, message]);
          void resolveMediaForMessages([message]);
        }
        setReplyingTo(null);
        setUploading(false);
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setRecordingError('Microphone permission is required for voice messages.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err: any) {
      setUploading(false);
      setRecordingError(err?.message ?? 'Unable to record voice message.');
    }
  };

  const deleteConversation = async () => {
    if (!conversationId || !currentUserId) return;
    Alert.alert('Delete conversation?', 'This removes the conversation from your inbox. Messages are not deleted for the other person.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error: deleteError } = await supabase.from('direct_conversation_members').update({ deleted_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', currentUserId);
        if (deleteError) Alert.alert('Delete failed', deleteError.message);
        else router.replace('/messages');
      } },
    ]);
  };

  const blockUser = async () => {
    if (!currentUserId || !otherUserId || blockLoading) return;

    Alert.alert(
      'Block user?',
      `You will stop receiving messages from ${title}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              setBlockLoading(true);

              const { error: blockError } = await supabase
                .from('user_blocks')
                .insert({
                  blocker_id: currentUserId,
                  blocked_id: otherUserId,
                });

              if (blockError && blockError.code !== '23505') {
                throw blockError;
              }

              setBlockedByMe(true);
              setProfile((current) => current ? { ...current, avatar_url: null } : current);
              setShowMenu(false);
            } catch (err: any) {
              Alert.alert(
                'Block failed',
                err?.message || 'Unable to block this user.'
              );
            } finally {
              setBlockLoading(false);
            }
          },
        },
      ]
    );
  };

  const unblockUser = async () => {
    if (!currentUserId || !otherUserId || blockLoading) return;

    try {
      setBlockLoading(true);

      const { error: unblockError } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', otherUserId);

      if (unblockError) throw unblockError;

      setBlockedByMe(false);
    } catch (err: any) {
      Alert.alert(
        'Unblock failed',
        err?.message || 'Unable to unblock this user.'
      );
    } finally {
      setBlockLoading(false);
    }
  };

  const openMedia = (message: Message) => {
    const uri = mediaUrls[message.id];
    if (!uri) return;

    if (
      message.message_type === 'image' ||
      message.message_type === 'video' ||
      message.message_type === 'voice'
    ) {
      setSelectedMedia({
        type: message.message_type,
        uri,
        title: messagePreview(message),
      });
    }
  };

  const openSharedMediaItem = (message: Message) => {
    openMedia(message);
  };

  const openOtherUserProfile = () => {
    if (!otherUserId || blockedByMe || blockedByOther) return;
    router.push({
      pathname: '/public-profile',
      params: { userId: otherUserId },
    });
  };

  const submitReport = async () => {
  if (!currentUserId || !otherUserId) return;

  const { error: reportError } = await supabase
    .from('user_reports')
    .insert({
      reporter_id: currentUserId,
      reported_user_id: otherUserId,
      reason: reportReason,
    });

  if (reportError) {
    console.log('REPORT ERROR:', reportError);

    Alert.alert(
      'Report Error',
      `${reportError.code || 'NO_CODE'}\n${reportError.message || 'Unknown error'}`
    );

    return;
  }

  setShowReport(false);
  setShowMenu(false);

  Alert.alert(
    'Report submitted',
    'Thanks. We will review the report.'
  );
};

  const copyMessage = async (message: Message) => {
    if (!message.content) return;
    await Clipboard.setStringAsync(message.content);
    setReactionMessage(null);
    Alert.alert('Copied', 'Message copied to clipboard.');
  };

  const filteredMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => `${message.content ?? ''} ${messagePreview(message)}`.toLowerCase().includes(query));
  }, [messageSearch, messages]);

  const scrollToMessage = useCallback(async (messageId: string) => {
    let index = filteredMessages.findIndex((message) => message.id === messageId);

    if (index < 0 && conversationId) {
      const { data, error: targetError } = await supabase
        .from('direct_messages')
        .select('id, conversation_id, sender_id, message_type, content, media_url, dare_id, reply_to_message_id, created_at, expires_at, edited_at, deleted_at')
        .eq('id', messageId)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .maybeSingle();

      if (!targetError && data) {
        const target = data as Message;
        setMessages((current) => {
          if (current.some((message) => message.id === target.id)) return current;
          return [...current, target].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
        void resolveMediaForMessages([target]);
        setMessageSearch('');
        setShowSearch(false);
        setTimeout(() => {
          setMessages((current) => {
            const nextIndex = current.findIndex((message) => message.id === messageId);
            if (nextIndex >= 0) {
              listRef.current?.scrollToIndex({ index: nextIndex, animated: true, viewPosition: 0.5 });
            }
            return current;
          });
        }, 120);
        index = 0;
      }
    }

    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId((current) => current === messageId ? null : current);
      }, 1400);
    }
  }, [conversationId, filteredMessages, resolveMediaForMessages]);

  const title = useMemo(() => nameOf(profile), [profile]);

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.sender_id === currentUserId;
    const replied = item.reply_to_message_id
      ? messages.find((message) => message.id === item.reply_to_message_id)
      : null;
    const reactions = messageReactions.filter(
      (reaction) => reaction.message_id === item.id,
    );
    const mediaUrl = mediaUrls[item.id];
    const isSeen =
      mine &&
      !!otherUserLastReadAt &&
      new Date(otherUserLastReadAt).getTime() >=
        new Date(item.created_at).getTime();
    const selected = selectedMessageIds.includes(item.id);
    const swipe =
      swipeValues[item.id] ?? (swipeValues[item.id] = new Animated.Value(0));

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !selectionMode &&
        gesture.dx > 12 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderMove: (_, gesture) => {
        if (!selectionMode) {
          swipe.setValue(Math.max(0, Math.min(gesture.dx, 72)));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (!selectionMode && gesture.dx >= 50) {
          setReplyingTo(item);
        }
        Animated.spring(swipe, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(swipe, {
          toValue: 0,
          useNativeDriver: true,
        }).start(),
    });

    const showActionMenu = () => {
      if (selectionMode) {
        if (mine) toggleMessageSelection(item);
        return;
      }
      setReactionMessage(item);
    };

    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        {!mine ? (
          <Pressable
            onPress={openOtherUserProfile}
            style={styles.receiverAvatarButton}
            hitSlop={6}
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.receiverAvatarImage}
              />
            ) : (
              <View style={styles.receiverAvatarFallback}>
                <Text style={styles.receiverAvatarText}>
                  {title.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.messageSwipeTarget,
            mine
              ? styles.messageSwipeTargetMine
              : styles.messageSwipeTargetReceiver,
            { transform: [{ translateX: swipe }] },
          ]}
        >
          <Pressable
            onPress={() =>
              selectionMode ? toggleMessageSelection(item) : undefined
            }
            onLongPress={showActionMenu}
            delayLongPress={280}
            style={[
              styles.messageBubble,
              mine && styles.messageBubbleMine,
              selected && styles.messageBubbleSelected,
              highlightedMessageId === item.id && styles.messageBubbleHighlighted,
            ]}
          >
            {selectionMode && mine ? (
              <View style={styles.selectionBadge}>
                <Ionicons
                  name={selected ? 'checkmark' : 'ellipse-outline'}
                  size={16}
                  color={selected ? '#0B0B0D' : colors.primaryText}
                />
              </View>
            ) : null}

            {replied ? (
              <Pressable
                style={styles.quotedMessage}
                onPress={() => scrollToMessage(replied.id)}
                disabled={selectionMode}
              >
                <Text style={styles.quotedMessageSender}>
                  {replied.sender_id === currentUserId ? 'You' : title}
                </Text>
                <Text style={styles.quotedMessageText} numberOfLines={2}>
                  {messagePreview(replied)}
                </Text>
              </Pressable>
            ) : null}

            {item.message_type === 'shared_post' ? (() => {
              const sharedPost = sharedPosts[item.id];
              if (!sharedPost) {
                return (
                  <View style={styles.sharedPostUnavailable}>
                    <Ionicons name="link-outline" size={20} color={colors.secondaryText} />
                    <Text style={styles.sharedPostUnavailableText}>Shared post unavailable</Text>
                  </View>
                );
              }

              return (
                <Pressable
                  style={styles.sharedPostCard}
                  onPress={() => {
                    router.push({
                      pathname: '/public-profile',
                      params: { userId: sharedPost.user_id },
                    });
                  }}
                  disabled={selectionMode}
                >
                  <View style={styles.sharedPostHeader}>
                    <Ionicons name="share-social-outline" size={18} color={mine ? '#0B0B0D' : colors.accent} />
                    <Text style={[styles.sharedPostLabel, mine && styles.messageTextMine]}>Shared a post</Text>
                  </View>
                  {sharedPost.signedMediaUrl ? (
                    <Image source={{ uri: sharedPost.signedMediaUrl }} style={styles.sharedPostImage} resizeMode="cover" />
                  ) : null}
                  {sharedPost.content ? (
                    <Text style={[styles.sharedPostContent, mine && styles.messageTextMine]} numberOfLines={3}>
                      {sharedPost.content}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })() : null}

            {item.message_type === 'image' && mediaUrl ? (
              <Pressable
                onPress={() => openMedia(item)}
                onLongPress={showActionMenu}
                delayLongPress={280}
                disabled={selectionMode}
              >
                <Image
                  source={{ uri: mediaUrl }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
            {item.message_type === 'video' && mediaUrl ? (
              <Pressable
                onPress={() => openMedia(item)}
                onLongPress={showActionMenu}
                delayLongPress={280}
                disabled={selectionMode}
              >
                <VideoBubble uri={mediaUrl} />
                <View style={styles.inlineVideoPlayBadge}>
                  <Ionicons name="play" size={18} color="#FFFFFF" />
                </View>
              </Pressable>
            ) : null}
            {item.message_type === 'voice' && mediaUrl ? (
              <AudioBubble uri={mediaUrl} mine={mine} />
            ) : null}
            {item.message_type === 'dare' ? (
              <View style={styles.dareCard}>
                <Ionicons
                  name="flash"
                  size={20}
                  color={mine ? '#0B0B0D' : colors.accent}
                />
                <Text
                  style={[styles.dareText, mine && styles.messageTextMine]}
                >
                  {item.content || 'DareShot'}
                </Text>
              </View>
            ) : null}
            {item.message_type === 'text' ||
            (!['image', 'video', 'voice', 'dare', 'shared_post'].includes(item.message_type) &&
              item.content) ? (
              <Text
                style={[styles.messageText, mine && styles.messageTextMine]}
              >
                {item.content}
              </Text>
            ) : null}

            {reactions.length > 0 ? (
              <View style={styles.reactionSummary}>
                {Object.entries(
                  reactions.reduce<Record<string, number>>(
                    (acc, reaction) => {
                      acc[reaction.reaction] =
                        (acc[reaction.reaction] ?? 0) + 1;
                      return acc;
                    },
                    {},
                  ),
                ).map(([reaction, count]) => {
                  const emoji =
                    reactionOptions.find((item) => item.value === reaction)
                      ?.emoji ?? '❤️';
                  return (
                    <View key={reaction} style={styles.reactionChip}>
                      <Text style={styles.reactionChipEmoji}>{emoji}</Text>
                      <Text style={styles.reactionChipCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Text
              style={[
                styles.messageTime,
                mine && styles.messageTimeMine,
              ]}
            >
              {formatTime(item.created_at)}
            </Text>
          </Pressable>
          {mine && item.id === messages[messages.length - 1]?.id ? (
            <Text
              style={[
                styles.messageStatus,
                styles.messageStatusMine,
              ]}
            >
              {isSeen ? 'Seen' : 'Sent'}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    );
  };

  if (loading) {
    return <View style={[styles.root, { paddingTop: insets.top }]}><View style={styles.centerState}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.stateText}>Loading chat...</Text></View></View>;
  }

  if (error) {
    return <View style={[styles.root, { paddingTop: insets.top }]}><View style={styles.centerState}><Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.secondaryText} /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void loadInitial()} style={styles.retryButton}><Text style={styles.retryText}>Try Again</Text></Pressable></View></View>;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
<KeyboardAvoidingView
  style={styles.keyboardArea}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
>        {selectionMode ? (
          <View style={styles.selectionHeader}>
            <Pressable onPress={cancelMessageSelection} style={styles.headerButton} hitSlop={8}>
              <Ionicons name="close" size={25} color={colors.primaryText} />
            </Pressable>
            <Text style={styles.selectionHeaderTitle}>
              {selectedMessageIds.length} selected
            </Text>
            <Pressable
              onPress={() => void deleteSelectedMessages()}
              style={styles.headerButton}
              hitSlop={8}
              disabled={selectedMessageIds.length === 0}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={
                  selectedMessageIds.length === 0
                    ? colors.secondaryText
                    : colors.danger
                }
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.headerButton}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-back"
                size={25}
                color={colors.primaryText}
              />
            </Pressable>
            <View style={styles.headerUser}>
              <Pressable
                style={styles.headerAvatar}
                onPress={openOtherUserProfile}
                hitSlop={6}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.headerAvatarImage}
                  />
                ) : (
                  <Text style={styles.headerAvatarText}>
                    {title.charAt(0).toUpperCase()}
                  </Text>
                )}
                {online ? <View style={styles.headerOnlineDot} /> : null}
              </Pressable>
              <Pressable
                style={styles.headerNameBlock}
                onPress={openSharedMedia}
              >
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.headerUsername}>
                  {online
                    ? 'Active now'
                    : profile?.username
                      ? `@${profile.username}`
                      : 'Offline'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => setShowSearch((value) => !value)}
                style={styles.headerButton}
                hitSlop={8}
              >
                <Ionicons
                  name="search-outline"
                  size={21}
                  color={colors.primaryText}
                />
              </Pressable>
              <Pressable
                onPress={() => Alert.alert(
                  'Voice call',
                  'Voice calling screen is not connected yet.'
                )}
                style={styles.headerButton}
                hitSlop={8}
              >
                <Ionicons
                  name="call-outline"
                  size={21}
                  color={colors.primaryText}
                />
              </Pressable>
              <Pressable
                onPress={() => Alert.alert(
                  'Video call',
                  'Video calling screen is not connected yet.'
                )}
                style={styles.headerButton}
                hitSlop={8}
              >
                <Ionicons
                  name="videocam-outline"
                  size={21}
                  color={colors.primaryText}
                />
              </Pressable>

<Pressable
  onPress={() => { setActiveDareShotId(incomingShots[0]?.id ?? null); setShowDareShotPanel(true); }}
  style={styles.headerButton}
  hitSlop={8}
  accessibilityRole="button"
  accessibilityLabel="Open DareShot"
>
  <View style={styles.dareShotHeaderIconWrap}>
    <Ionicons
      name="flash-outline"
      size={21}
      color={colors.primaryText}
    />
    {incomingShots.length > 0 ? (
      <View style={styles.dareShotBadge}>
        <Text style={styles.dareShotBadgeText}>
          {incomingShots.length > 9 ? '9+' : incomingShots.length}
        </Text>
      </View>
    ) : null}
  </View>
</Pressable>

              <Pressable
                onPress={() => setShowMenu(true)}
                style={styles.headerButton}
                hitSlop={8}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={21}
                  color={colors.primaryText}
                />
              </Pressable>
            </View>
          </View>
        )}

        {showSearch ? (
          <View style={styles.searchBar}><Ionicons name="search-outline" size={18} color={colors.secondaryText} /><TextInput value={messageSearch} onChangeText={setMessageSearch} placeholder="Search messages" placeholderTextColor={colors.secondaryText} style={styles.searchInput} autoFocus /><Pressable onPress={() => { setMessageSearch(''); setShowSearch(false); }}><Ionicons name="close" size={19} color={colors.secondaryText} /></Pressable></View>
        ) : null}

        {loadingOlder ? <View style={styles.loadingOlder}><ActivityIndicator size="small" color={colors.accent} /></View> : null}
{showDareShotPanel && otherUserId ? (
          <Modal
            visible={showDareShotPanel}
            animationType="slide"
            transparent
            statusBarTranslucent
            onRequestClose={() => {
              setShowDareShotPanel(false);
              setActiveDareShotId(null);
            }}
          >
            <DareShotPanel
              targetUserId={
                activeDareShotId
                  ? (incomingShots.find((shot) => shot.id === activeDareShotId)?.sender_id ?? otherUserId)
                  : otherUserId
              }
              shotId={activeDareShotId}
              onClose={() => {
                setShowDareShotPanel(false);
                setActiveDareShotId(null);
                if (currentUserId && otherUserId) {
                  void loadIncomingShots(currentUserId, otherUserId);
                }
              }}
            />
          </Modal>
        ) : null}
        <FlatList
          ref={listRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.chatList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          inverted={false}
          onContentSizeChange={handleInitialContentSizeChange}
          onScroll={({ nativeEvent }) => {
            const distanceFromBottom = nativeEvent.contentSize.height - (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
            isNearBottomRef.current = distanceFromBottom < 140;
            if (nativeEvent.contentOffset.y < 80) void loadOlder();
          }}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 150);
          }}
          scrollEventThrottle={100}
          ListEmptyComponent={<View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={34} color={colors.secondaryText} /></View><Text style={styles.emptyTitle}>{messageSearch ? 'No messages found' : 'Start the conversation'}</Text><Text style={styles.emptySubtitle}>{messageSearch ? 'Try another keyword.' : 'Send a message, photo, video or voice note.'}</Text></View>}
        />

        {replyingTo ? <View style={styles.replyPreview}><View style={styles.replyPreviewContent}><Text style={styles.replyPreviewLabel}>Replying to {replyingTo.sender_id === currentUserId ? 'yourself' : title}</Text><Text style={styles.replyPreviewText} numberOfLines={1}>{messagePreview(replyingTo)}</Text></View><Pressable onPress={() => setReplyingTo(null)} style={styles.replyCloseButton}><Ionicons name="close" size={20} color={colors.secondaryText} /></Pressable></View> : null}

        {recordingError ? <Pressable onPress={() => setRecordingError('')} style={styles.recordingError}><Ionicons name="mic-outline" size={15} color={colors.danger} /><Text style={styles.recordingErrorText}>{recordingError}</Text></Pressable> : null}

        {blockedByMe || blockedByOther ? (
          <View style={[styles.blockedBar, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
            <View style={styles.blockedBarTextWrap}>
              <Ionicons name="ban-outline" size={20} color={colors.danger} />
              <View style={styles.blockedBarCopy}>
                <Text style={styles.blockedBarTitle}>{blockedByMe ? `You blocked ${title}` : `${title} has blocked you`}</Text>
                <Text style={styles.blockedBarSubtitle}>{blockedByMe ? 'Unblock to send messages again.' : 'You cannot send messages or open this profile.'}</Text>
              </View>
            </View>
            {blockedByMe ? (
            <Pressable
              onPress={() => void unblockUser()}
              disabled={blockLoading}
              style={styles.unblockButton}
            >
              {blockLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.unblockButtonText}>Unblock</Text>
              )}
            </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: Math.max(spacing.xs, insets.bottom) }]}>
          <Pressable
            onPress={() => {
              if (!uploading) {
                void captureMedia();
              }
            }}
            style={styles.iconButton}
            hitSlop={5}
            disabled={uploading}
          >
            <Ionicons
              name="camera-outline"
              size={23}
              color={uploading ? colors.secondaryText : colors.primaryText}
            />
          </Pressable>
          <Pressable onPress={() => void pickMedia()} style={styles.iconButton} hitSlop={5} disabled={uploading}><Ionicons name="attach-outline" size={23} color={uploading ? colors.secondaryText : colors.primaryText} /></Pressable>
          <TextInput value={input} onChangeText={setInput} placeholder={recorderState.isRecording ? `Recording ${formatDuration(recorderState.durationMillis / 1000)}` : 'Write a message...'} placeholderTextColor={colors.secondaryText} style={styles.input} multiline maxLength={2000} editable={!sending && !uploading && !recorderState.isRecording} />
          {input.trim().length > 0 ? (
            <Pressable onPress={() => void sendTextMessage()} disabled={sending || uploading} style={[styles.sendButton, (sending || uploading) && styles.sendButtonDisabled]}><Ionicons name="arrow-up" size={21} color="#0B0B0D" /></Pressable>
          ) : (
            <Pressable onPress={() => void toggleRecording()} disabled={uploading} style={[styles.sendButton, recorderState.isRecording && styles.recordingButton, uploading && styles.sendButtonDisabled]}><Ionicons name={recorderState.isRecording ? 'stop' : 'mic'} size={20} color="#0B0B0D" /></Pressable>
          )}
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={reactionMessage !== null} transparent animationType="fade" onRequestClose={() => setReactionMessage(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setReactionMessage(null)}>
          <Pressable style={styles.actionCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.actionTitle}>Message actions</Text>
            <View style={styles.reactionOptions}>{reactionOptions.map((option) => <Pressable key={option.value} onPress={() => void saveReaction(option.value)} style={styles.reactionOption}><Text style={styles.reactionEmoji}>{option.emoji}</Text><Text style={styles.reactionLabel}>{option.label}</Text></Pressable>)}</View>
            {(reactionMessage?.content || reactionMessage?.media_url) ? (
              <Pressable
                onPress={async () => {
                  if (reactionMessage.content) {
                    await copyMessage(reactionMessage);
                  } else if (reactionMessage.media_url) {
                    const uri = mediaUrls[reactionMessage.id];
                    if (uri) {
                      await Clipboard.setStringAsync(uri);
                      setReactionMessage(null);
                      Alert.alert('Copied', 'Media link copied to clipboard.');
                    }
                  }
                }}
                style={styles.actionRow}
              >
                <Ionicons name="copy-outline" size={20} color={colors.primaryText} />
                <Text style={styles.actionRowText}>Copy</Text>
              </Pressable>
            ) : null}
            {reactionMessage?.sender_id === currentUserId ? (
              <>
                <Pressable
                  onPress={() => startMessageSelection(reactionMessage)}
                  style={styles.actionRow}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={colors.primaryText}
                  />
                  <Text style={styles.actionRowText}>Select messages</Text>
                </Pressable>
                <Pressable
                  onPress={() => void deleteMessage(reactionMessage)}
                  style={styles.actionRow}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.danger}
                  />
                  <Text
                    style={[
                      styles.actionRowText,
                      { color: colors.danger },
                    ]}
                  >
                    Delete message
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={() => {
                setReplyingTo(reactionMessage);
                setReactionMessage(null);
              }}
              style={styles.actionRow}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={20}
                color={colors.primaryText}
              />
              <Text style={styles.actionRowText}>Reply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.modalOverlayBottom} onPress={() => setShowMenu(false)}>
          <Pressable style={styles.menuCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Pressable
              onPress={() => void blockUser()}
              style={styles.menuRow}
            >
              <Ionicons
                name="ban-outline"
                size={21}
                color={colors.danger}
              />
              <Text style={[styles.menuText, { color: colors.danger }]}>
                Block user
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowMenu(false);
                setShowReport(true);
              }}
              style={styles.menuRow}
            >
              <Ionicons
                name="flag-outline"
                size={21}
                color={colors.primaryText}
              />
              <Text style={styles.menuText}>Report user</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMenu(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showSharedMedia}
        animationType="slide"
        onRequestClose={() => setShowSharedMedia(false)}
      >
        <View style={[styles.sharedMediaRoot, { paddingTop: insets.top }]}>
          <View style={styles.sharedMediaHeader}>
            <Pressable
              onPress={() => setShowSharedMedia(false)}
              style={styles.headerButton}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-back"
                size={25}
                color={colors.primaryText}
              />
            </Pressable>
            <View style={styles.sharedMediaHeaderText}>
              <Text style={styles.sharedMediaTitle}>Shared media</Text>
              <Text style={styles.sharedMediaSubtitle}>{title}</Text>
            </View>
          </View>

          <View style={styles.sharedMediaTabs}>
            {[
              ['all', 'All'],
              ['image', 'Photos'],
              ['video', 'Videos'],
              ['voice', 'Audio'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() =>
                  setSharedMediaFilter(
                    value as 'all' | 'image' | 'video' | 'voice',
                  )
                }
                style={[
                  styles.sharedMediaTab,
                  sharedMediaFilter === value &&
                    styles.sharedMediaTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.sharedMediaTabText,
                    sharedMediaFilter === value &&
                      styles.sharedMediaTabTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {sharedMediaLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator
                size="small"
                color={colors.accent}
              />
              <Text style={styles.stateText}>Loading shared media...</Text>
            </View>
          ) : (
            <FlatList
              data={sharedMedia.filter(
                (item) =>
                  sharedMediaFilter === 'all' ||
                  item.message_type === sharedMediaFilter,
              )}
              keyExtractor={(item) => `shared-${item.id}`}
              key={`shared-media-${sharedMediaFilter}`}
              numColumns={sharedMediaFilter === 'voice' ? 1 : 2}
              contentContainerStyle={styles.sharedMediaContent}
              columnWrapperStyle={
                sharedMediaFilter === 'voice'
                  ? undefined
                  : styles.sharedMediaColumn
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="images-outline"
                      size={34}
                      color={colors.secondaryText}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    No shared {sharedMediaFilter === 'all' ? 'media' : sharedMediaFilter}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    Photos, videos and audio shared in this chat will appear here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const uri = mediaUrls[item.id];

                if (item.message_type === 'voice') {
                  return uri ? (
                    <Pressable
                      style={styles.sharedAudioItem}
                      onPress={() => openSharedMediaItem(item)}
                    >
                      <AudioBubble
                        uri={uri}
                        mine={item.sender_id === currentUserId}
                      />
                      <Text style={styles.sharedMediaTime}>
                        {formatTime(item.created_at)}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.sharedAudioLoading}>
                      <ActivityIndicator
                        size="small"
                        color={colors.accent}
                      />
                    </View>
                  );
                }

                if (!uri) {
                  return (
                    <View style={styles.sharedMediaPlaceholder}>
                      <ActivityIndicator
                        size="small"
                        color={colors.accent}
                      />
                    </View>
                  );
                }

                return (
                  <Pressable
                    style={styles.sharedMediaTile}
                    onPress={() => openSharedMediaItem(item)}
                  >
                    {item.message_type === 'image' ? (
                      <Image
                        source={{ uri }}
                        style={styles.sharedMediaImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View>
                        <VideoBubble uri={uri} />
                      </View>
                    )}
                    {item.message_type === 'video' ? (
                      <View style={styles.sharedVideoBadge}>
                        <Ionicons
                          name="play"
                          size={16}
                          color="#FFFFFF"
                        />
                      </View>
                    ) : null}
                    <Text style={styles.sharedMediaTime}>
                      {formatTime(item.created_at)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={selectedMedia !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.fullscreenMediaRoot}>
          <Pressable
            style={styles.fullscreenCloseButton}
            onPress={() => setSelectedMedia(null)}
            hitSlop={8}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>

          {selectedMedia?.type === 'image' ? (
            <Image
              source={{ uri: selectedMedia.uri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}

          {selectedMedia?.type === 'video' ? (
            <FullscreenVideo uri={selectedMedia.uri} />
          ) : null}

          {selectedMedia?.type === 'voice' ? (
            <View style={styles.fullscreenAudioCard}>
              <View style={styles.fullscreenAudioIcon}>
                <Ionicons name="mic-outline" size={34} color={colors.background} />
              </View>
              <Text style={styles.fullscreenAudioTitle}>Voice message</Text>
              <AudioBubble uri={selectedMedia.uri} mine={false} />
            </View>
          ) : null}

          {selectedMedia?.title ? (
            <Text style={styles.fullscreenMediaTitle}>{selectedMedia.title}</Text>
          ) : null}
        </View>
      </Modal>

      <Modal visible={showReport} transparent animationType="fade" onRequestClose={() => setShowReport(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowReport(false)}>
          <Pressable style={styles.reportCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.actionTitle}>Report {title}</Text>
            {['Spam or scam', 'Harassment', 'Inappropriate content', 'Other'].map((reason) => <Pressable key={reason} onPress={() => setReportReason(reason)} style={[styles.reportOption, reportReason === reason && styles.reportOptionSelected]}><Text style={[styles.reportOptionText, reportReason === reason && styles.reportOptionTextSelected]}>{reason}</Text></Pressable>)}
            <Pressable onPress={() => void submitReport()} style={styles.reportSubmit}><Text style={styles.reportSubmitText}>Submit report</Text></Pressable>
            <Pressable onPress={() => setShowReport(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  keyboardArea: { flex: 1 },
  header: { height: 56, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  selectionHeader: { height: 56, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  selectionHeaderTitle: { flex: 1, color: colors.primaryText, fontSize: fontSize.md, fontWeight: '800', marginLeft: spacing.xs },
  headerButton: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 0 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  headerAvatarImage: { width: '100%', height: '100%', borderRadius: 18 },
  headerAvatarText: { color: colors.primaryText, fontSize: 14, fontWeight: '800' },
  headerOnlineDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#35d07f', borderWidth: 2, borderColor: colors.background },
  headerNameBlock: { flex: 1, marginLeft: spacing.sm, minWidth: 0 },
  headerTitle: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: '800' },
  headerUsername: { marginTop: 1, color: colors.secondaryText, fontSize: fontSize.xs },
  searchBar: { height: 44, margin: spacing.sm, marginBottom: spacing.xs, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, color: colors.primaryText, fontSize: fontSize.sm, paddingVertical: 0 },
  loadingOlder: { height: 28, alignItems: 'center', justifyContent: 'center' },
  chatList: { flex: 1, minHeight: 0 },
  messagesContent: { flexGrow: 1, paddingTop: spacing.md, paddingBottom: spacing.md },
  messageRow: { width: '100%', paddingHorizontal: spacing.md, marginBottom: spacing.sm, alignItems: 'center', flexDirection: 'row' },
  receiverAvatarButton: { width: 30, height: 30, marginRight: spacing.xs, alignSelf: 'flex-end', borderRadius: 15, overflow: 'hidden' },
  receiverAvatarImage: { width: '100%', height: '100%', borderRadius: 15 },
  receiverAvatarFallback: { width: '100%', height: '100%', borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  receiverAvatarText: { color: colors.primaryText, fontSize: 12, fontWeight: '800' },
  messageRowMine: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  messageSwipeTarget: { maxWidth: '82%' },
  messageSwipeTargetMine: { alignSelf: 'flex-end' },
  messageSwipeTargetReceiver: { alignSelf: 'flex-start' },
  messageBubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 18, borderBottomLeftRadius: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  messageBubbleMine: { borderBottomLeftRadius: 18, borderBottomRightRadius: 5, backgroundColor: colors.accent, borderColor: colors.accent },
  messageBubbleHighlighted: { borderWidth: 2, borderColor: colors.accent },
  messageBubbleSelected: { borderWidth: 2, borderColor: colors.danger },
  selectionBadge: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, zIndex: 2 },
  messageText: { color: colors.primaryText, fontSize: fontSize.md, lineHeight: 21 },
  messageTextMine: { color: '#0B0B0D' },
  messageTime: { marginTop: 4, color: colors.secondaryText, fontSize: 10, textAlign: 'right' },
  messageTimeMine: { color: 'rgba(11, 11, 13, 0.60)' },
  messageStatus: { marginTop: 2, fontSize: 9, fontWeight: '700' },
  messageStatusMine: { color: colors.secondaryText, textAlign: 'right' },
  quotedMessage: { marginBottom: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.10)' },
  quotedMessageSender: { color: colors.accent, fontSize: fontSize.xs, fontWeight: '800' },
  quotedMessageText: { marginTop: 2, color: colors.secondaryText, fontSize: fontSize.xs },
  mediaImage: { width: 240, height: 300, borderRadius: 13, backgroundColor: colors.background },
  mediaVideo: { width: 250, height: 280, borderRadius: 13, backgroundColor: '#000' },
  inlineVideoPlayBadge: { position: 'absolute', top: '50%', left: '50%', marginLeft: -22, marginTop: -22, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.58)' },
  audioBubble: { width: 220, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  audioPlay: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  audioPlayMine: { backgroundColor: 'rgba(11,11,13,0.12)' },
  audioTrackWrap: { flex: 1 },
  audioTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  audioProgress: { height: '100%', backgroundColor: colors.accent },
  audioTime: { marginTop: 4, color: colors.secondaryText, fontSize: 9 },
  audioTimeMine: { color: 'rgba(11,11,13,0.60)' },
  sharedPostCard: {
    width: 250,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sharedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  sharedPostLabel: {
    color: colors.primaryText,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  sharedPostImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.background,
  },

dareShotHeaderIconWrap: { position: 'relative', width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  dareShotBadge: { position: 'absolute', top: -4, right: -7, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.background },
  dareShotBadgeText: { color: '#0B0B0D', fontSize: 8, fontWeight: '900' },
  dareShotPanelRoot: { flex: 1, backgroundColor: colors.background, paddingBottom: 18 },
  dareShotPanelHeader: { minHeight: 62, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  dareShotPanelClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dareShotPanelTitleWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  dareShotPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dareShotPanelTitle: { color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '900' },
  dareShotPanelSubtitle: { marginTop: 2, color: colors.secondaryText, fontSize: fontSize.xs },
  dareShotPanelHeaderSpacer: { width: 40, height: 40 },
  dareShotStatsRow: { margin: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dareShotStat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dareShotStatValue: { color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '900' },
  dareShotStatLabel: { marginTop: 2, color: colors.secondaryText, fontSize: fontSize.xs, fontWeight: '600' },
  dareShotPendingSection: { paddingHorizontal: spacing.md },
  dareShotSectionLabel: { marginBottom: spacing.sm, color: colors.secondaryText, fontSize: fontSize.xs, fontWeight: '900', letterSpacing: 0.7 },
  dareShotPendingCard: { minHeight: 78, marginBottom: spacing.sm, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dareShotPendingIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  dareShotPendingInfo: { flex: 1, minWidth: 0 },
  dareShotPendingTitle: { color: colors.primaryText, fontSize: fontSize.sm, fontWeight: '900' },
  dareShotPendingText: { marginTop: 3, color: colors.secondaryText, fontSize: fontSize.xs, lineHeight: 17 },
  dareShotOpenButton: { minWidth: 62, minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  dareShotOpenButtonText: { color: '#0B0B0D', fontSize: fontSize.xs, fontWeight: '900' },
  dareShotStartCard: { margin: spacing.md, marginTop: spacing.md, padding: spacing.lg, borderRadius: 20, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dareShotStartIcon: { width: 54, height: 54, marginBottom: spacing.sm, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  dareShotStartTitle: { color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '900', textAlign: 'center' },
  dareShotStartText: { marginTop: spacing.xs, color: colors.secondaryText, fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
  dareShotStartButton: { minHeight: 46, marginTop: spacing.md, paddingHorizontal: spacing.xl, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent },
  dareShotStartButtonText: { color: '#0B0B0D', fontSize: fontSize.sm, fontWeight: '900' },
  dareShotPrivacyText: { marginHorizontal: spacing.xl, color: colors.secondaryText, fontSize: fontSize.xs, lineHeight: 17, textAlign: 'center' },
  incomingShotWrap: {
  paddingHorizontal: spacing.sm,
  paddingTop: spacing.sm,
  paddingBottom: spacing.xs,
},

incomingShotCard: {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 16,
  backgroundColor: colors.surface,
  padding: spacing.md,
},

incomingShotTopRow: {
  flexDirection: 'row',
  alignItems: 'center',
},

incomingShotIcon: {
  width: 42,
  height: 42,
  alignItems: 'center',
  justifyContent: 'center',
},

incomingShotInfo: {
  flex: 1,
  marginLeft: spacing.sm,
},

incomingShotTitle: {
  color: colors.primaryText,
  fontSize: fontSize.md,
  fontWeight: '800',
},

incomingShotType: {
  marginTop: 2,
  color: colors.primaryText,
  fontSize: fontSize.sm,
  fontWeight: '700',
},

incomingShotSubtitle: {
  marginTop: 2,
  color: colors.secondaryText,
  fontSize: fontSize.xs,
},

incomingShotActions: {
  flexDirection: 'row',
  gap: spacing.sm,
  marginTop: spacing.md,
},

incomingShotAcceptButton: {
  flex: 1,
  minHeight: 42,
  borderRadius: 12,
  backgroundColor: colors.accent,
  alignItems: 'center',
  justifyContent: 'center',
},

incomingShotAcceptText: {
  color: '#0B0B0D',
  fontSize: fontSize.sm,
  fontWeight: '800',
},

incomingShotDismissButton: {
  width: 90,
  minHeight: 42,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
  alignItems: 'center',
  justifyContent: 'center',
},

incomingShotDismissText: {
  color: colors.secondaryText,
  fontSize: fontSize.sm,
  fontWeight: '700',
},

  sharedPostContent: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    lineHeight: 19,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sharedPostUnavailable: {
    minWidth: 220,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sharedPostUnavailableText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
  },
  dareCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dareText: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: '800' },
  reactionSummary: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  reactionChip: { minHeight: 24, paddingHorizontal: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reactionChipEmoji: { fontSize: 13 },
  reactionChipCount: { marginLeft: 3, color: colors.primaryText, fontSize: 10, fontWeight: '800' },
  replyPreview: { minHeight: 58, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  replyPreviewContent: { flex: 1, marginRight: spacing.sm },
  replyPreviewLabel: { color: colors.accent, fontSize: fontSize.xs, fontWeight: '800' },
  replyPreviewText: { marginTop: 2, color: colors.secondaryText, fontSize: fontSize.sm },
  replyCloseButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  composer: { minHeight: 58, paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  iconButton: { width: 40, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, maxHeight: 110, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 22, color: colors.primaryText, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.md },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  recordingButton: { backgroundColor: colors.danger },
  sendButtonDisabled: { opacity: 0.35 },
  recordingError: { minHeight: 34, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  recordingErrorText: { flex: 1, color: colors.danger, fontSize: fontSize.xs },
  blockedBar: { minHeight: 76, paddingHorizontal: spacing.md, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  blockedBarTextWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockedBarCopy: { flex: 1 },
  blockedBarTitle: { color: colors.primaryText, fontSize: fontSize.sm, fontWeight: '800' },
  blockedBarSubtitle: { marginTop: 2, color: colors.secondaryText, fontSize: fontSize.xs },
  unblockButton: { minWidth: 82, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  unblockButtonText: { color: colors.background, fontSize: fontSize.sm, fontWeight: '900' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalOverlayBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  actionCard: { width: '100%', maxWidth: 380, padding: spacing.md, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  menuCard: { padding: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border },
  actionTitle: { color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.md },
  reactionOptions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  reactionOption: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  reactionEmoji: { fontSize: 27 },
  reactionLabel: { marginTop: 4, color: colors.secondaryText, fontSize: fontSize.xs },
  actionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  actionRowText: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: '600' },
  menuRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuText: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: '700' },
  cancelButton: { marginTop: spacing.md, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: '700' },
  reportCard: { width: '100%', maxWidth: 380, padding: spacing.md, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reportOption: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 12, marginBottom: spacing.xs, backgroundColor: colors.background },
  reportOptionSelected: { backgroundColor: colors.accent },
  reportOptionText: { color: colors.primaryText, fontSize: fontSize.sm, fontWeight: '600' },
  reportOptionTextSelected: { color: colors.background, fontWeight: '800' },
  reportSubmit: { minHeight: 46, marginTop: spacing.sm, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  reportSubmitText: { color: colors.background, fontSize: fontSize.md, fontWeight: '900' },
  sharedMediaRoot: { flex: 1, backgroundColor: colors.background },
  sharedMediaHeader: { minHeight: 60, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  sharedMediaHeaderText: { flex: 1, minWidth: 0 },
  sharedMediaTitle: { color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '900' },
  sharedMediaSubtitle: { marginTop: 1, color: colors.secondaryText, fontSize: fontSize.xs },
  sharedMediaTabs: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, flexDirection: 'row', gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  sharedMediaTab: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sharedMediaTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sharedMediaTabText: { color: colors.secondaryText, fontSize: fontSize.xs, fontWeight: '700' },
  sharedMediaTabTextActive: { color: colors.background, fontWeight: '900' },
  sharedMediaContent: { padding: spacing.sm, paddingBottom: spacing.xl },
  sharedMediaColumn: { gap: spacing.sm },
  sharedMediaTile: { flex: 1, marginBottom: spacing.sm, minHeight: 180, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, position: 'relative' },
  sharedMediaImage: { width: '100%', height: 220, backgroundColor: colors.background },
  sharedVideoBadge: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)' },
  sharedMediaTime: { paddingHorizontal: spacing.sm, paddingVertical: 5, color: colors.secondaryText, fontSize: 9 },
  sharedMediaPlaceholder: { flex: 1, minHeight: 220, marginBottom: spacing.sm, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sharedAudioItem: { minHeight: 72, marginBottom: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sharedAudioLoading: { minHeight: 72, marginBottom: spacing.sm, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fullscreenMediaRoot: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  fullscreenCloseButton: { position: 'absolute', zIndex: 20, top: 52, right: 18, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  fullscreenImage: { width: '100%', height: '82%' },
  fullscreenVideo: { width: '100%', height: '82%', backgroundColor: '#000' },
  fullscreenAudioCard: { width: '100%', maxWidth: 420, padding: spacing.xl, borderRadius: 24, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fullscreenAudioIcon: { width: 72, height: 72, borderRadius: 36, marginBottom: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  fullscreenAudioTitle: { marginBottom: spacing.md, color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '900' },
  fullscreenMediaTitle: { position: 'absolute', bottom: 38, color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  stateText: { marginTop: spacing.sm, color: colors.secondaryText, fontSize: fontSize.sm },
  errorText: { marginTop: spacing.md, color: colors.secondaryText, fontSize: fontSize.sm, textAlign: 'center' },
  retryButton: { marginTop: spacing.md, minHeight: 42, paddingHorizontal: spacing.lg, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  retryText: { color: '#0B0B0D', fontSize: fontSize.sm, fontWeight: '900' },
  emptyState: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { marginTop: spacing.md, color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { marginTop: spacing.xs, color: colors.secondaryText, fontSize: fontSize.sm, textAlign: 'center' },
});
