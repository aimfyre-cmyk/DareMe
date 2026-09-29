import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '../constants/theme';

type NotificationRow = {
  id: string;
  recipient_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  deep_link: string | null;
  created_at: string;
};

type ActorProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type NotificationItem = NotificationRow & { actor: ActorProfile | null };

const actorIdOf = (n: NotificationRow) =>
  typeof n.payload?.actor_id === 'string' ? n.payload.actor_id : null;

function messageOf(n: NotificationItem) {
  const name = n.actor?.display_name || n.actor?.username || 'Someone';
  if (n.type === 'follow') return `${name} started following you.`;
  if (n.type === 'like') return `${name} liked your post.`;
  if (n.type === 'comment') return `${name} commented on your post.`;
  return `${name} interacted with you.`;
}

function iconOf(type: string) {
  if (type === 'follow') return '＋';
  if (type === 'like') return '♥';
  if (type === 'comment') return '◯';
  return '•';
}

function timeOf(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff) || diff < 0) return '';
  if (diff < 60000) return 'Just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadNotifications = useCallback(async () => {
    setErrorMessage('');

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setErrorMessage('Please log in to view notifications.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, recipient_id, type, payload, is_read, deep_link, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    const actorIds = Array.from(new Set(
      rows.map(actorIdOf).filter((id): id is string => Boolean(id)),
    ));

    let actors: ActorProfile[] = [];
    if (actorIds.length) {
      const { data: actorData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', actorIds);
      actors = (actorData ?? []) as ActorProfile[];
    }

    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
    setNotifications(rows.map((row) => ({
      ...row,
      actor: actorIdOf(row) ? actorMap.get(actorIdOf(row)!) ?? null : null,
    })));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadNotifications();
  }, [loadNotifications]));

  const refresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      if (error) console.warn('[DareMe Notifications] Mark read error:', error);
    }

    const actorId = actorIdOf(notification);
    if (actorId) {
      router.push({ pathname: '/public-profile', params: { userId: actorId } });
      return;
    }

    if (notification.deep_link === '/discover') {
      router.push('/(tabs)/discover');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/')}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go to Home"
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>Loading notifications...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.error}>{errorMessage}</Text>
          <Pressable onPress={loadNotifications} style={styles.retry}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>♧</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            Follows, likes, and comments will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => openNotification(notification)}
              style={[
                styles.card,
                !notification.is_read && styles.cardUnread,
              ]}
            >
              <View style={styles.iconCircle}>
                <Text style={styles.icon}>{iconOf(notification.type)}</Text>
              </View>

              <View style={styles.content}>
                <Text style={styles.message}>{messageOf(notification)}</Text>
                <Text style={styles.time}>{timeOf(notification.created_at)}</Text>
              </View>

              {!notification.is_read && <View style={styles.dot} />}
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.primaryText, fontSize: 36, lineHeight: 36 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.primaryText, fontSize: 22, fontWeight: '800' },
  badge: {
    minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent,
  },
  badgeText: { color: colors.background, fontSize: 12, fontWeight: '900' },
  headerSpacer: { width: 44 },
  list: { paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    backgroundColor: colors.surface,
  },
  cardUnread: { borderColor: colors.accent },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent,
  },
  icon: { color: colors.background, fontSize: 20, fontWeight: '900' },
  content: { flex: 1 },
  message: { color: colors.primaryText, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  time: { marginTop: 4, color: colors.secondaryText, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  chevron: { color: colors.secondaryText, fontSize: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  muted: { marginTop: spacing.md, color: colors.secondaryText, fontSize: 14 },
  emptyIcon: { color: colors.accent, fontSize: 42, marginBottom: spacing.md },
  emptyTitle: { color: colors.primaryText, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: spacing.sm, color: colors.secondaryText, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  error: { color: colors.primaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12, backgroundColor: colors.accent },
  retryText: { color: colors.background, fontWeight: '800' },
});
