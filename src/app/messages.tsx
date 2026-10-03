import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { Screen } from '../components/Screen';
import { colors, fontSize, spacing } from '../constants/theme';
import { supabase } from '../lib/supabase';

type ConversationMember = {
  conversation_id: string;
  user_id: string;
  pinned: boolean;
  muted: boolean;
};

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  created_at: string;
};

type InboxConversation = {
  id: string;
  otherUser: Profile | null;
  lastMessage: Message | null;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
};

function displayName(profile: Profile | null) {
  return profile?.display_name?.trim() || profile?.username || 'DareMe user';
}

function formatTime(value: string | null) {
  if (!value) return '';

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
}

function previewMessage(message: Message | null) {
  if (!message) return 'Start a private conversation';

  if (message.message_type === 'image') return 'Photo';
  if (message.message_type === 'video') return 'Video';
  if (message.message_type === 'dare') return 'DareShot';

  return message.content?.trim() || 'Message';
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [requestsCount, setRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadInbox = useCallback(async () => {
    setErrorMessage('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage('Please log in to view messages.');
      setLoading(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from('direct_conversation_members')
      .select('conversation_id, user_id, pinned, muted')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (memberError) {
      console.error('[Messages] Members:', memberError);
      setErrorMessage(memberError.message);
      setLoading(false);
      return;
    }

    const members = (memberRows ?? []) as ConversationMember[];
    const conversationIds = [
      ...new Set(members.map((item) => item.conversation_id)),
    ];

    if (conversationIds.length === 0) {
      setConversations([]);
    } else {
      const { data: allMembers, error: allMembersError } = await supabase
        .from('direct_conversation_members')
        .select('conversation_id, user_id, pinned, muted')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id)
        .is('deleted_at', null);

      if (allMembersError) {
        throw allMembersError;
      }

      const otherMembers = (allMembers ?? []) as ConversationMember[];
      const otherIds = [
        ...new Set(otherMembers.map((item) => item.user_id)),
      ];

      let profiles: Profile[] = [];

      if (otherIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', otherIds);

        if (profileError) throw profileError;
        profiles = (profileRows ?? []) as Profile[];
      }

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile]),
      );

      const { data: messageRows, error: messageError } = await supabase
        .from('direct_messages')
        .select(
          'id, conversation_id, sender_id, content, message_type, created_at',
        )
        .in('conversation_id', conversationIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (messageError) throw messageError;

      const messages = (messageRows ?? []) as Message[];
      const latestByConversation = new Map<string, Message>();

      for (const message of messages) {
        if (!latestByConversation.has(message.conversation_id)) {
          latestByConversation.set(message.conversation_id, message);
        }
      }

      const { data: readRows, error: readError } = await supabase
        .from('direct_message_reads')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds);

      if (readError) throw readError;

      const readAtByConversation = new Map<string, number>();

      for (const row of readRows ?? []) {
        const timestamp = row.last_read_at
          ? new Date(row.last_read_at).getTime()
          : 0;

        readAtByConversation.set(
          String(row.conversation_id),
          timestamp,
        );
      }

      const unreadByConversation = new Map<string, number>();

      for (const message of messages) {
        if (message.sender_id === user.id) {
          continue;
        }

        const lastReadAt =
          readAtByConversation.get(message.conversation_id) ?? 0;

        const messageTime = new Date(message.created_at).getTime();

        if (messageTime > lastReadAt) {
          unreadByConversation.set(
            message.conversation_id,
            (unreadByConversation.get(message.conversation_id) ?? 0) + 1,
          );
        }
      }

      const mapped = conversationIds.map((conversationId) => {
        const member = otherMembers.find(
          (item) => item.conversation_id === conversationId,
        );
        const lastMessage =
          latestByConversation.get(conversationId) ?? null;

        return {
          id: conversationId,
          otherUser: member
            ? profileMap.get(member.user_id) ?? null
            : null,
          lastMessage,
          unreadCount: unreadByConversation.get(conversationId) ?? 0,
          pinned:
            members.find(
              (item) => item.conversation_id === conversationId,
            )?.pinned ?? false,
          muted:
            members.find(
              (item) => item.conversation_id === conversationId,
            )?.muted ?? false,
        };
      });

      mapped.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

        const aTime = a.lastMessage?.created_at
          ? new Date(a.lastMessage.created_at).getTime()
          : 0;
        const bTime = b.lastMessage?.created_at
          ? new Date(b.lastMessage.created_at).getTime()
          : 0;

        return bTime - aTime;
      });

      setConversations(mapped);
    }

    const { count, error: requestError } = await supabase
      .from('message_requests')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('status', 'pending');

    if (requestError) {
      console.warn('[Messages] Requests:', requestError);
    }

    setRequestsCount(count ?? 0);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInbox();
    }, [loadInbox]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await loadInbox();
    setRefreshing(false);
  };

  return (
    <Screen>
      <AppHeader
        title="Messages"
          leftSlot={
    <Pressable
      onPress={() => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}}
      style={styles.headerButton}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={10}
    >
      <Ionicons
        name="arrow-back"
        size={22}
        color={colors.primaryText}
      />
    </Pressable>
  }
        rightSlot={
          <Pressable
            onPress={() => router.push('/message-requests')}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Message requests"
            hitSlop={10}
          >
            <Ionicons
              name="person-add-outline"
              size={21}
              color={colors.primaryText}
            />

            {requestsCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {requestsCount > 99 ? '99+' : requestsCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        }
      />

      <View style={styles.searchBar}>
        <Ionicons
          name="search-outline"
          size={19}
          color={colors.secondaryText}
        />
        <Text style={styles.searchPlaceholder}>
          Search chats
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.stateText}>
            Loading messages...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={32}
            color={colors.secondaryText}
          />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            onPress={loadInbox}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            conversations.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.accent}
            />
          }
        >
          {requestsCount > 0 ? (
            <Pressable
              onPress={() => router.push('/message-requests')}
              style={[
                styles.requestCard,
                styles.requestCardActive,
              ]}
            >
              <View style={styles.requestIcon}>
                <Ionicons
                  name="mail-unread-outline"
                  size={22}
                  color={colors.accent}
                />

                <View style={styles.requestIconBadge}>
                  <Text style={styles.requestIconBadgeText}>
                    {requestsCount > 99 ? '99+' : requestsCount}
                  </Text>
                </View>
              </View>

              <View style={styles.requestTextWrap}>
                <View style={styles.requestTitleRow}>
                  <Text style={styles.requestTitle}>
                    Message Requests
                  </Text>

                  <View style={styles.requestCountBadge}>
                    <Text style={styles.requestCountBadgeText}>
                      {requestsCount > 99 ? '99+' : requestsCount}
                    </Text>
                  </View>
                </View>

                <Text style={styles.requestSubtitle}>
                  {requestsCount} pending request
                  {requestsCount === 1 ? '' : 's'}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={colors.secondaryText}
              />
            </Pressable>
          ) : null}

          {conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={34}
                  color={colors.secondaryText}
                />
              </View>

              <Text style={styles.emptyTitle}>
                No messages yet
              </Text>

              <Text style={styles.emptyText}>
                Your private conversations will appear here.
              </Text>
            </View>
          ) : (
            conversations.map((conversation) => {
              const person = conversation.otherUser;
              const name = displayName(person);
              const initials = name.charAt(0).toUpperCase();

              return (
                <Pressable
                  key={conversation.id}
                  onPress={() =>
                    router.push({
                      pathname: '/chat',
                      params: {
                        conversationId: conversation.id,
                        userId: person?.id ?? '',
                      },
                    })
                  }
                  style={styles.conversationRow}
                >
                  <View style={styles.avatar}>
                    {person?.avatar_url ? (
                      <Image
                        source={{ uri: person.avatar_url }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarText}>
                        {initials}
                      </Text>
                    )}
                  </View>

                  <View style={styles.conversationBody}>
                    <View style={styles.nameRow}>
                      <Text
                        style={[
                          styles.name,
                          conversation.unreadCount > 0 &&
                            styles.nameUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>

                      <Text style={styles.time}>
                        {formatTime(
                          conversation.lastMessage?.created_at ?? null,
                        )}
                      </Text>
                    </View>

                    <View style={styles.previewRow}>
                      <Text
                        style={[
                          styles.preview,
                          conversation.unreadCount > 0 &&
                            styles.previewUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {previewMessage(
                          conversation.lastMessage,
                        )}
                      </Text>

                      <View style={styles.rowActions}>
                        {conversation.muted ? (
                          <Ionicons
                            name="notifications-off-outline"
                            size={15}
                            color={colors.secondaryText}
                          />
                        ) : null}

                        {conversation.unreadCount > 0 ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {conversation.unreadCount > 99
                                ? '99+'
                                : conversation.unreadCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  headerBadge: {
    position: 'absolute',
    top: -1,
    right: -2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBadgeText: {
    color: colors.primaryText,
    fontSize: 9,
    fontWeight: '800',
  },

  searchBar: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  searchPlaceholder: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
  },

  list: {
    paddingBottom: spacing.xl,
  },

  emptyList: {
    flexGrow: 1,
  },

  requestCard: {
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  requestIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#202522',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  requestTextWrap: {
    flex: 1,
  },

  requestCardActive: {
    borderColor: 'rgba(183, 255, 60, 0.42)',
    backgroundColor: 'rgba(21, 21, 24, 0.72)',
  },

  requestIconBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 77, 90, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  requestIconBadgeText: {
    color: 'rgba(255, 255, 255, 0.96)',
    fontSize: 9,
    fontWeight: '900',
  },

  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  requestCountBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(183, 255, 60, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(183, 255, 60, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  requestCountBadgeText: {
    color: 'rgba(255, 255, 255, 0.96)',
    fontSize: 10,
    fontWeight: '900',
  },

  requestTitle: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  requestSubtitle: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: 3,
  },

  conversationRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.md,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarText: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  conversationBody: {
    flex: 1,
    minWidth: 0,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  name: {
    flex: 1,
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  nameUnread: {
    fontWeight: '800',
  },

  time: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  preview: {
    flex: 1,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
  },

  previewUnread: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  unreadBadgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '900',
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
    marginTop: spacing.sm,
  },

  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  retryText: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  emptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },

  emptyTitle: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },

  emptyText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
    maxWidth: 280,
  },
});
