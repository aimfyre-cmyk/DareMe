import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../components/Screen';
import { colors, fontSize, spacing } from '../constants/theme';
import { supabase } from '../lib/supabase';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: 'text' | 'image' | 'video' | 'dare';
  content: string | null;
  media_url: string | null;
  reply_to_message_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

type OtherProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    conversationId?: string;
    userId?: string;
  }>();

  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;

  const otherUserId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<OtherProfile | null>(null);
  const [input, setInput] = useState('');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionMessage, setReactionMessage] =
  useState<Message | null>(null);
  const [messageReactions, setMessageReactions] = useState<
  {
    message_id: string;
    user_id: string;
    reaction: 'like' | 'laugh' | 'angry' | 'confuse';
  }[]
>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<FlatList<Message>>(null);

  const loadChat = useCallback(async () => {
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
        throw new Error('You must be logged in to use messages.');
      }

      setCurrentUserId(user.id);

      if (!conversationId) {
        throw new Error('Conversation could not be found.');
      }

      const { data: messageRows, error: messagesError } =
        await supabase
          .from('direct_messages')
          .select(
            `
              id,
              conversation_id,
              sender_id,
              message_type,
              content,
              media_url,
              reply_to_message_id,
              created_at,
              edited_at,
              deleted_at
            `,
          )
          .eq('conversation_id', conversationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });

      if (messagesError) {
        throw messagesError;
      }

      const loadedMessages = (messageRows ?? []) as Message[];

setMessages(loadedMessages);

if (loadedMessages.length > 0) {
  const { data: reactionRows, error: reactionsError } =
    await supabase
      .from('direct_message_reactions')
      .select('message_id, user_id, reaction')
      .in(
        'message_id',
        loadedMessages.map((message) => message.id),
      );

  if (reactionsError) {
    console.warn(
      'Unable to load message reactions:',
      reactionsError,
    );
  } else {
    setMessageReactions(
      (reactionRows ?? []) as {
        message_id: string;
        user_id: string;
        reaction:
          | 'like'
          | 'laugh'
          | 'angry'
          | 'confuse';
      }[],
    );
  }
}

      if (otherUserId) {
        const { data: profileRow, error: profileError } =
          await supabase
            .from('profiles')
            .select(
              'id, display_name, username, avatar_url',
            )
            .eq('id', otherUserId)
            .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        setProfile(profileRow as OtherProfile | null);
      }

      await markConversationRead(user.id, conversationId);
    } catch (err: any) {
      console.error('Chat load error:', err);

      setError(
        err?.message ??
          'Unable to load this conversation right now.',
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId, otherUserId]);

  const markConversationRead = useCallback(
    async (userId: string, targetConversationId: string) => {
      const { error: readError } = await supabase
        .from('direct_message_reads')
        .upsert(
          {
            conversation_id: targetConversationId,
            user_id: userId,
            last_read_at: new Date().toISOString(),
          },
          {
            onConflict: 'conversation_id,user_id',
          },
        );

      if (readError) {
        console.warn(
          'Unable to update message read state:',
          readError,
        );
      }
    },
    [],
  );

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const channel = supabase
      .channel(`chat:${conversationId}`)

      // New messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage =
            payload.new as Message;

          setMessages((current) => {
            if (
              current.some(
                (message) =>
                  message.id ===
                  newMessage.id,
              )
            ) {
              return current;
            }

            return [...current, newMessage];
          });

          if (currentUserId) {
            markConversationRead(
              currentUserId,
              conversationId,
            );
          }
        },
      )

      // Reaction added
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_message_reactions',
        },
        (payload) => {
          const newReaction =
            payload.new as {
              message_id: string;
              user_id: string;
              reaction:
                | 'like'
                | 'laugh'
                | 'angry'
                | 'confuse';
            };

          setMessageReactions((current) => {
            const exists = current.some(
              (item) =>
                item.message_id ===
                  newReaction.message_id &&
                item.user_id ===
                  newReaction.user_id,
            );

            if (exists) {
              return current.map((item) =>
                item.message_id ===
                    newReaction.message_id &&
                  item.user_id ===
                    newReaction.user_id
                  ? newReaction
                  : item,
              );
            }

            return [...current, newReaction];
          });
        },
      )

      // Reaction changed
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_message_reactions',
        },
        (payload) => {
          const updatedReaction =
            payload.new as {
              message_id: string;
              user_id: string;
              reaction:
                | 'like'
                | 'laugh'
                | 'angry'
                | 'confuse';
            };

          setMessageReactions((current) =>
            current.map((item) =>
              item.message_id ===
                  updatedReaction.message_id &&
                item.user_id ===
                  updatedReaction.user_id
                ? updatedReaction
                : item,
            ),
          );
        },
      )

      // Reaction deleted
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'direct_message_reactions',
        },
        (payload) => {
          const deletedReaction =
            payload.old as {
              message_id: string;
              user_id: string;
            };

          setMessageReactions((current) =>
            current.filter(
              (item) =>
                !(
                  item.message_id ===
                    deletedReaction.message_id &&
                  item.user_id ===
                    deletedReaction.user_id
                ),
            ),
          );
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    conversationId,
    currentUserId,
    markConversationRead,
  ]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    });
  }, [messages.length]);

  const title = useMemo(() => {
    return (
      profile?.display_name ||
      profile?.username ||
      'DareMe User'
    );
  }, [profile]);

  const copyMessage = async (message: Message) => {
  if (!message.content) {
    return;
  }

  try {
    await Clipboard.setStringAsync(message.content);

    setReactionMessage(null);

    Alert.alert(
      'Copied',
      'Message copied to clipboard.',
    );
  } catch (err) {
    console.error('Copy message error:', err);

    Alert.alert(
      'Copy failed',
      'Unable to copy message.',
    );
  }
};

const deleteMessage = async (message: Message) => {
  if (!currentUserId || message.sender_id !== currentUserId) {
    return;
  }

  try {
    const { error: deleteError } = await supabase
      .from('direct_messages')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', message.id)
      .eq('sender_id', currentUserId);

    if (deleteError) {
      throw deleteError;
    }

    setMessages((current) =>
      current.filter(
        (item) => item.id !== message.id,
      ),
    );

    setReactionMessage(null);
  } catch (err: any) {
    console.error(
      'Delete message error:',
      err,
    );

    Alert.alert(
      'Delete failed',
      err?.message ??
        'Unable to delete message.',
    );
  }
};

    const saveReaction = async (
    reaction: 'like' | 'laugh' | 'angry' | 'confuse',
  ) => {
    if (!reactionMessage || !currentUserId) {
      return;
    }

    try {
      const existingReaction =
        messageReactions.find(
          (item) =>
            item.message_id === reactionMessage.id &&
            item.user_id === currentUserId,
        );

      // Same reaction dobara press = remove
      if (
        existingReaction?.reaction === reaction
      ) {
        const { error: deleteError } =
          await supabase
            .from('direct_message_reactions')
            .delete()
            .eq(
              'message_id',
              reactionMessage.id,
            )
            .eq(
              'user_id',
              currentUserId,
            );

        if (deleteError) {
          throw deleteError;
        }

        setMessageReactions((current) =>
          current.filter(
            (item) =>
              !(
                item.message_id ===
                  reactionMessage.id &&
                item.user_id === currentUserId
              ),
          ),
        );

        setReactionMessage(null);
        return;
      }

      // Different reaction = change reaction
      const { data, error: reactionError } =
        await supabase
          .from('direct_message_reactions')
          .upsert(
            {
              message_id:
                reactionMessage.id,
              user_id: currentUserId,
              reaction,
            },
            {
              onConflict:
                'message_id,user_id',
            },
          )
          .select(
            'message_id, user_id, reaction',
          )
          .single();

      if (reactionError) {
        throw reactionError;
      }

      if (data) {
        setMessageReactions((current) => [
          ...current.filter(
            (item) =>
              !(
                item.message_id ===
                  reactionMessage.id &&
                item.user_id === currentUserId
              ),
          ),
          data as {
            message_id: string;
            user_id: string;
            reaction:
              | 'like'
              | 'laugh'
              | 'angry'
              | 'confuse';
          },
        ]);
      }

      setReactionMessage(null);
    } catch (err: any) {
      console.error(
        'Save reaction error:',
        err,
      );

      Alert.alert(
        'Reaction failed',
        err?.message ??
          'Unable to save reaction.',
      );
    }
  };
  const sendMessage = async () => {
    const content = input.trim();

    if (!content || !conversationId || !currentUserId) {
      return;
    }

    try {
      setSending(true);

      const { data, error: sendError } = await supabase
        .from('direct_messages')
        .insert({
  conversation_id: conversationId,
  sender_id: currentUserId,
  message_type: 'text',
  content,
  reply_to_message_id: replyingTo?.id ?? null,
})
        .select(
          `
            id,
            conversation_id,
            sender_id,
            message_type,
            content,
            media_url,
            reply_to_message_id,
            created_at,
            edited_at,
            deleted_at
          `,
        )
        .single();

      if (sendError) {
        throw sendError;
      }

      if (data) {
        setMessages((current) => {
          if (
            current.some(
              (message) => message.id === data.id,
            )
          ) {
            return current;
          }

          return [...current, data as Message];
        });
      }

      setInput('');
      setReplyingTo(null);
    } catch (err: any) {
      Alert.alert(
        'Message not sent',
        err?.message ??
          'Unable to send this message right now.',
      );
    } finally {
      setSending(false);
    }
  };

    const renderMessage = ({
    item,
  }: {
    item: Message;
  }) => {
    const mine = item.sender_id === currentUserId;

    const repliedMessage = item.reply_to_message_id
      ? messages.find(
          (message) =>
            message.id === item.reply_to_message_id,
        )
      : null;

    const reactionsForMessage =
      messageReactions.filter(
        (reaction) =>
          reaction.message_id === item.id,
      );

    return (
      <View
        style={[
          styles.messageRow,
          mine && styles.messageRowMine,
        ]}
      >
        <Pressable
          onLongPress={() => {
            setReactionMessage(item);
          }}
          style={[
            styles.messageBubble,
            mine && styles.messageBubbleMine,
          ]}
        >
          {repliedMessage ? (
            <View style={styles.quotedMessage}>
              <Text
                style={styles.quotedMessageSender}
              >
                {repliedMessage.sender_id === currentUserId
                  ? 'You'
                  : title}
              </Text>

              <Text
                numberOfLines={2}
                style={styles.quotedMessageText}
              >
                {repliedMessage.content ||
                  'Media message'}
              </Text>
            </View>
          ) : null}

          <Text
            style={[
              styles.messageText,
              mine && styles.messageTextMine,
            ]}
          >
            {item.content || ''}
          </Text>

          <Text
            style={[
              styles.messageTime,
              mine && styles.messageTimeMine,
            ]}
          >
            {new Date(
              item.created_at,
            ).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Pressable>

        {reactionsForMessage.length > 0 ? (
          <View style={styles.reactionSummary}>
            {(
              [
                'like',
                'laugh',
                'angry',
                'confuse',
              ] as const
            ).map((reactionType) => {
              const count =
                reactionsForMessage.filter(
                  (reaction) =>
                    reaction.reaction ===
                    reactionType,
                ).length;

              if (count === 0) {
                return null;
              }

              const emoji =
                reactionType === 'like'
                  ? '❤️'
                  : reactionType === 'laugh'
                    ? '😂'
                    : reactionType === 'angry'
                      ? '😡'
                      : '😕';

              return (
                <View
                  key={reactionType}
                  style={styles.reactionChip}
                >
                  <Text
                    style={
                      styles.reactionChipEmoji
                    }
                  >
                    {emoji}
                  </Text>

                  <Text
                    style={
                      styles.reactionChipCount
                    }
                  >
                    {count}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <Modal
  visible={!!reactionMessage}
  transparent
  animationType="fade"
  onRequestClose={() => setReactionMessage(null)}
>
  <Pressable
    style={styles.reactionOverlay}
    onPress={() => setReactionMessage(null)}
  >
    <Pressable
      style={styles.reactionPicker}
      onPress={(event) => event.stopPropagation()}
    >
      <Text style={styles.reactionPickerTitle}>
        React to message
      </Text>

      <View style={styles.reactionOptions}>
  <Pressable
    onPress={() => saveReaction('like')}
    style={styles.reactionOption}
  >
    <Text style={styles.reactionEmoji}>❤️</Text>
    <Text style={styles.reactionLabel}>Like</Text>
  </Pressable>

  <Pressable
    onPress={() => saveReaction('laugh')}
    style={styles.reactionOption}
  >
    <Text style={styles.reactionEmoji}>😂</Text>
    <Text style={styles.reactionLabel}>Laugh</Text>
  </Pressable>

  <Pressable
    onPress={() => saveReaction('angry')}
    style={styles.reactionOption}
  >
    <Text style={styles.reactionEmoji}>😡</Text>
    <Text style={styles.reactionLabel}>Angry</Text>
  </Pressable>

  <Pressable
    onPress={() => saveReaction('confuse')}
    style={styles.reactionOption}
  >
    <Text style={styles.reactionEmoji}>😕</Text>
    <Text style={styles.reactionLabel}>Confuse</Text>
  </Pressable>
  <Pressable
  onPress={() => {
    if (reactionMessage) {
      copyMessage(reactionMessage);
    }
  }}
  style={styles.reactionOption}
>
  <Ionicons
    name="copy-outline"
    size={24}
    color={colors.primaryText}
  />
  <Text style={styles.reactionLabel}>Copy</Text>
</Pressable>
{reactionMessage?.sender_id === currentUserId ? (
  <Pressable
    onPress={() => {
      if (reactionMessage) {
        deleteMessage(reactionMessage);
      }
    }}
    style={styles.reactionOption}
  >
    <Ionicons
      name="trash-outline"
      size={24}
      color="#FF4D4D"
    />
    <Text style={styles.reactionLabel}>
      Delete
    </Text>
  </Pressable>
) : null}
</View>
    </Pressable>
  </Pressable>
</Modal>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={
          Platform.OS === 'ios' ? 'padding' : undefined
        }
      >
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
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {title.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.headerNameBlock}>
              <Text
                numberOfLines={1}
                style={styles.headerTitle}
              >
                {title}
              </Text>

              {profile?.username ? (
                <Text
                  numberOfLines={1}
                  style={styles.headerUsername}
                >
                  @{profile.username}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.headerButton} />
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator
              size="small"
              color={colors.accent}
            />

            <Text style={styles.stateText}>
              Loading conversation...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={34}
              color={colors.secondaryText}
            />

            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              onPress={loadChat}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={28}
                      color={colors.secondaryText}
                    />
                  </View>

                  <Text style={styles.emptyTitle}>
                    Start the conversation
                  </Text>

                  <Text style={styles.emptySubtitle}>
                    Send your first message.
                  </Text>
                </View>
              }
            />

{emojiPickerVisible ? (
  <View style={styles.emojiPanel}>
    {[
      '😀', '😂', '😍', '🥰', '😎', '😭',
      '😡', '🤔', '😱', '🔥', '❤️', '👍',
      '👏', '🎉', '💯', '🤣', '😘', '🙏',
      '😈', '👀', '💀', '🤝', '💪', '✨',
    ].map((emoji) => (
      <Pressable
        key={emoji}
        onPress={() => {
          setInput((current) => `${current}${emoji}`);
        }}
        style={styles.emojiItem}
        hitSlop={4}
      >
        <Text style={styles.emojiText}>{emoji}</Text>
      </Pressable>
    ))}
  </View>
) : null}
{replyingTo ? (
  <View style={styles.replyPreview}>
    <View style={styles.replyPreviewContent}>
      <Text style={styles.replyPreviewLabel}>
        Replying to message
      </Text>

      <Text
        numberOfLines={1}
        style={styles.replyPreviewText}
      >
        {replyingTo.content || 'Media message'}
      </Text>
    </View>

    <Pressable
      onPress={() => setReplyingTo(null)}
      style={styles.replyCloseButton}
      hitSlop={8}
    >
      <Ionicons
        name="close"
        size={20}
        color={colors.secondaryText}
      />
    </Pressable>
  </View>
) : null}
            <View style={styles.composer}>
            <Pressable
  onPress={() => {
  setEmojiPickerVisible((current) => !current);
}}
  style={styles.emojiButton}
  hitSlop={6}
  accessibilityRole="button"
  accessibilityLabel="Add emoji"
>
  <Ionicons
    name="happy-outline"
    size={23}
    color={colors.primaryText}
  />
</Pressable>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Write a message..."
                placeholderTextColor={colors.secondaryText}
                style={styles.input}
                multiline
                maxLength={2000}
                editable={!sending}
              />

              <Pressable
                onPress={sendMessage}
                disabled={
                  sending || input.trim().length === 0
                }
                style={({ pressed }) => [
                  styles.sendButton,
                  (sending ||
                    input.trim().length === 0) &&
                    styles.sendButtonDisabled,
                  pressed && styles.sendButtonPressed,
                ]}
                hitSlop={6}
              >
                {sending ? (
                  <ActivityIndicator
                    size="small"
                    color="#0B0B0D"
                  />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={21}
                    color="#0B0B0D"
                  />
                )}
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardArea: {
    flex: 1,
  },

  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  headerAvatarText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },

  headerNameBlock: {
    maxWidth: '65%',
    marginLeft: spacing.sm,
  },

  headerTitle: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '800',
    textAlign: 'center',
  },

  headerUsername: {
    marginTop: 1,
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },

  messagesContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },

  messageRow: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },

  messageRowMine: {
    alignItems: 'flex-end',
  },

  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  messageBubbleMine: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 5,
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  quotedMessage: {
  marginBottom: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderLeftWidth: 3,
  borderLeftColor: colors.accent,
  borderRadius: 6,
  backgroundColor: 'rgba(255, 255, 255, 0.10)',
},

quotedMessageSender: {
  color: colors.accent,
  fontSize: fontSize.xs,
  fontWeight: '800',
},

quotedMessageText: {
  marginTop: 2,
  color: colors.secondaryText,
  fontSize: fontSize.xs,
  lineHeight: 16,
},

  messageText: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    lineHeight: 21,
  },

  messageTextMine: {
    color: '#0B0B0D',
  },

  messageTime: {
    marginTop: 4,
    color: colors.secondaryText,
    fontSize: 10,
    textAlign: 'right',
  },

  messageTimeMine: {
    color: 'rgba(11, 11, 13, 0.60)',
  },

  reactionSummary: {
  marginTop: 4,
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 4,
},

reactionChip: {
  minHeight: 24,
  paddingHorizontal: 6,
  borderRadius: 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
},

reactionChipEmoji: {
  fontSize: 13,
},

reactionChipCount: {
  marginLeft: 3,
  color: colors.primaryText,
  fontSize: 10,
  fontWeight: '800',
},

  emojiPanel: {
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  flexDirection: 'row',
  flexWrap: 'wrap',
  borderTopWidth: 1,
  borderTopColor: colors.border,
  backgroundColor: colors.surface,
},

emojiItem: {
  width: '12.5%',
  height: 42,
  alignItems: 'center',
  justifyContent: 'center',
},

emojiText: {
  fontSize: 24,
},

replyPreview: {
  minHeight: 58,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  flexDirection: 'row',
  alignItems: 'center',
  borderTopWidth: 1,
  borderTopColor: colors.border,
  backgroundColor: colors.surface,
},

replyPreviewContent: {
  flex: 1,
  marginRight: spacing.sm,
},

replyPreviewLabel: {
  color: colors.accent,
  fontSize: fontSize.xs,
  fontWeight: '800',
},

replyPreviewText: {
  marginTop: 2,
  color: colors.secondaryText,
  fontSize: fontSize.sm,
},

replyCloseButton: {
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: 'center',
  justifyContent: 'center',
},
  composer: {
    minHeight: 58,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  emojiButton: {
  width: 42,
  height: 42,
  borderRadius: 21,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
},

  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 22,
    color: colors.primaryText,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSize.md,
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  sendButtonPressed: {
    transform: [{ scale: 0.95 }],
  },

  reactionOverlay: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: spacing.xl,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
},

reactionPicker: {
  width: '100%',
  maxWidth: 360,
  padding: spacing.md,
  borderRadius: 20,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
},

reactionPickerTitle: {
  marginBottom: spacing.md,
  color: colors.primaryText,
  fontSize: fontSize.sm,
  fontWeight: '800',
  textAlign: 'center',
},

reactionOptions: {
  flexDirection: 'row',
  justifyContent: 'space-between',
},

reactionOption: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: spacing.sm,
},

reactionEmoji: {
  fontSize: 28,
},

reactionLabel: {
  marginTop: 4,
  color: colors.secondaryText,
  fontSize: fontSize.xs,
},

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  stateText: {
    marginTop: spacing.sm,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
  },

  errorText: {
    marginTop: spacing.md,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: spacing.md,
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },

  retryText: {
    color: '#0B0B0D',
    fontSize: fontSize.sm,
    fontWeight: '900',
  },

  emptyState: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyTitle: {
    marginTop: spacing.md,
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptySubtitle: {
    marginTop: spacing.xs,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});