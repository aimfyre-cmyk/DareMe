import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

export function FloatingMessageButton() {
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUnreadCount(0);
        return;
      }

      // 1) Pending message requests
      const { count: requestCount, error: requestError } =
        await supabase
          .from('message_requests')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('status', 'pending');

      if (requestError) throw requestError;

      // 2) Conversations where the current user is a member
      const { data: memberRows, error: memberError } =
        await supabase
          .from('direct_conversation_members')
          .select('conversation_id')
          .eq('user_id', user.id)
          .is('deleted_at', null);

      if (memberError) throw memberError;

      const conversationIds = [
        ...new Set(
          (memberRows ?? []).map((row) => String(row.conversation_id)),
        ),
      ];

      let unreadMessages = 0;

      if (conversationIds.length > 0) {
        const { data: messages, error: messageError } =
          await supabase
            .from('direct_messages')
            .select('conversation_id, sender_id, created_at')
            .in('conversation_id', conversationIds)
            .neq('sender_id', user.id)
            .is('deleted_at', null);

        if (messageError) throw messageError;

        const { data: readRows, error: readError } =
          await supabase
            .from('direct_message_reads')
            .select('conversation_id, last_read_at')
            .eq('user_id', user.id)
            .in('conversation_id', conversationIds);

        if (readError) throw readError;

        const readAtByConversation = new Map<string, number>();

        for (const row of readRows ?? []) {
          readAtByConversation.set(
            String(row.conversation_id),
            row.last_read_at ? new Date(row.last_read_at).getTime() : 0,
          );
        }

        for (const message of messages ?? []) {
          const lastReadAt =
            readAtByConversation.get(String(message.conversation_id)) ?? 0;

          const messageTime = new Date(message.created_at).getTime();

          if (messageTime > lastReadAt) unreadMessages += 1;
        }
      }

      // 3) Pending Private Shots are also inbox notifications.
      const { count: pendingShotCount, error: shotError } = await supabase
        .from('private_shots')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'sent');

      if (shotError) throw shotError;

      setUnreadCount(
        Math.min(
          99,
          Number(requestCount ?? 0) +
            unreadMessages +
            Number(pendingShotCount ?? 0),
        ),
      );
    } catch (error) {
      console.error('[FloatingMessageButton] Unread count error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUnreadCount();
    }, [loadUnreadCount]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const setupRealtime = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active || !user) return;

        if (channelRef.current) {
          void supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`floating-message-button:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'private_shots',
              filter: `receiver_id=eq.${user.id}`,
            },
            () => {
              void loadUnreadCount();
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'direct_messages',
            },
            (payload) => {
              const message = payload.new as { sender_id?: string };
              if (message.sender_id !== user.id) void loadUnreadCount();
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'message_requests',
              filter: `recipient_id=eq.${user.id}`,
            },
            () => {
              void loadUnreadCount();
            },
          )
          .subscribe();

        channelRef.current = channel;
      };

      void setupRealtime();

      return () => {
        active = false;
        if (channelRef.current) {
          void supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    }, [loadUnreadCount]),
  );

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Pressable
        onPress={() => router.push('/messages')}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? `Open messages, ${unreadCount} unread`
            : 'Open messages'
        }
        hitSlop={8}
      >
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={23}
          color={colors.primaryText}
        />

        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
    bottom: 82,
    zIndex: 100,
    elevation: 100,
  },
  button: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 21, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.95 }],
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 77, 90, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'rgba(255, 255, 255, 0.96)',
    fontSize: 10,
    fontWeight: '900',
  },
});
