import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Screen } from '../components/Screen';
import { colors, fontSize, spacing } from '../constants/theme';
import { supabase } from '../lib/supabase';

type RequestRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  status: string;
  created_at: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

export default function MessageRequestsScreen() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
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
        setRequests([]);
        return;
      }

      const { data, error: requestError } = await supabase
        .from('message_requests')
        .select(
          `
            id,
            sender_id,
            recipient_id,
            message,
            status,
            created_at
          `,
        )
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', {
          ascending: false,
        });

      if (requestError) {
        throw requestError;
      }

      const rows = data ?? [];

      if (rows.length === 0) {
        setRequests([]);
        return;
      }

      const senderIds = Array.from(
        new Set(rows.map((item) => item.sender_id)),
      );

      const { data: profiles, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, display_name, username, avatar_url',
          )
          .in('id', senderIds);

      if (profileError) {
        throw profileError;
      }

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      const mapped: RequestRow[] = rows.map((request) => {
        const profile = profileMap.get(
          request.sender_id,
        );

        return {
          id: request.id,
          sender_id: request.sender_id,
          recipient_id: request.recipient_id,
          message: request.message,
          status: request.status,
          created_at: request.created_at,
          display_name:
            profile?.display_name ||
            profile?.username ||
            'DareMe User',
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
        };
      });

      setRequests(mapped);
    } catch (err: any) {
      console.error(
        'Message requests load error:',
        err,
      );

      setError(
        err?.message ??
          'Unable to load message requests.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const acceptRequest = async (
    request: RequestRow,
  ) => {
    try {
      setProcessingId(request.id);

      const { error: updateError } = await supabase
        .from('message_requests')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .eq('status', 'pending');

      if (updateError) {
        throw updateError;
      }

      const { data: conversationId, error: conversationError } =
        await supabase.rpc(
          'get_or_create_direct_conversation',
          {
            p_other_user_id: request.sender_id,
          },
        );

      if (conversationError) {
        throw conversationError;
      }

      if (!conversationId) {
        throw new Error(
          'Unable to create the conversation.',
        );
      }

      setRequests((current) =>
        current.filter(
          (item) => item.id !== request.id,
        ),
      );

      router.push({
        pathname: '/chat' as any,
        params: {
          conversationId,
          userId: request.sender_id,
        },
      });
    } catch (err: any) {
      console.error(
        'Accept request error:',
        err,
      );

      Alert.alert(
        'Unable to accept',
        err?.message ??
          'The request could not be accepted.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const declineRequest = async (
    request: RequestRow,
  ) => {
    try {
      setProcessingId(request.id);

      const { error: updateError } = await supabase
        .from('message_requests')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .eq('status', 'pending');

      if (updateError) {
        throw updateError;
      }

      setRequests((current) =>
        current.filter(
          (item) => item.id !== request.id,
        ),
      );
    } catch (err: any) {
      console.error(
        'Decline request error:',
        err,
      );

      Alert.alert(
        'Unable to decline',
        err?.message ??
          'The request could not be declined.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Screen>
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

        <Text style={styles.headerTitle}>
          Message Requests
        </Text>

        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />

          <Text style={styles.stateText}>
            Loading requests...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={34}
            color={colors.secondaryText}
          />

          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadRequests}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="person-add-outline"
              size={30}
              color={colors.secondaryText}
            />
          </View>

          <Text style={styles.emptyTitle}>
            No message requests
          </Text>

          <Text style={styles.emptySubtitle}>
            New message requests will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {requests.map((request) => {
            const initial =
              request.display_name
                .charAt(0)
                .toUpperCase() || 'D';

            const processing =
              processingId === request.id;

            return (
              <View
                key={request.id}
                style={styles.requestCard}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/public-profile' as any,
                      params: {
                        userId:
                          request.sender_id,
                      },
                    })
                  }
                  disabled={processing}
                >
                  {request.avatar_url ? (
                    <Image
                      source={{
                        uri: request.avatar_url,
                      }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View
                      style={styles.avatarFallback}
                    >
                      <Text
                        style={styles.avatarText}
                      >
                        {initial}
                      </Text>
                    </View>
                  )}
                </Pressable>

                <View style={styles.content}>
                  <Text
                    numberOfLines={1}
                    style={styles.displayName}
                  >
                    {request.display_name}
                  </Text>

                  {request.username ? (
                    <Text
                      numberOfLines={1}
                      style={styles.username}
                    >
                      @{request.username}
                    </Text>
                  ) : null}

                  {request.message ? (
                    <Text style={styles.requestMessage}>
                      {request.message}
                    </Text>
                  ) : (
                    <Text style={styles.requestMessage}>
                      Wants to message you.
                    </Text>
                  )}

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() =>
                        acceptRequest(request)
                      }
                      disabled={processing}
                      style={[
                        styles.acceptButton,
                        processing &&
                          styles.disabledButton,
                      ]}
                    >
                      {processing ? (
                        <ActivityIndicator
                          size="small"
                          color="#0B0B0D"
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark"
                            size={17}
                            color="#0B0B0D"
                          />

                          <Text
                            style={
                              styles.acceptText
                            }
                          >
                            Accept
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        declineRequest(request)
                      }
                      disabled={processing}
                      style={[
                        styles.declineButton,
                        processing &&
                          styles.disabledButton,
                      ]}
                    >
                      <Ionicons
                        name="close"
                        size={17}
                        color={colors.primaryText}
                      />

                      <Text
                        style={styles.declineText}
                      >
                        Decline
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: colors.primaryText,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },

  list: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  requestCard: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
  },

  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  avatarText: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '800',
  },

  content: {
    flex: 1,
    marginLeft: spacing.md,
  },

  displayName: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  username: {
    marginTop: 2,
    color: colors.secondaryText,
    fontSize: fontSize.xs,
  },

  requestMessage: {
    marginTop: spacing.sm,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  acceptButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.accent,
  },

  acceptText: {
    color: '#0B0B0D',
    fontSize: fontSize.sm,
    fontWeight: '900',
  },

  declineButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  declineText: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.5,
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

  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
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