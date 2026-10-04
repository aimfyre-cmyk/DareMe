import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components/Screen';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type BlockedUser = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
};

type ReportItem = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function targetLabel(targetType: string) {
  switch (targetType.toLowerCase()) {
    case 'user':
      return 'User';
    case 'dare':
      return 'Dare';
    case 'post':
      return 'Post';
    case 'comment':
      return 'Comment';
    case 'reel':
      return 'Reel';
    default:
      return targetType;
  }
}

function statusLabel(status: string) {
  switch (status.toLowerCase()) {
    case 'open':
      return 'Open';
    case 'reviewing':
      return 'Under review';
    case 'resolved':
      return 'Resolved';
    case 'dismissed':
      return 'Dismissed';
    default:
      return status;
  }
}

export default function SafetyScreen() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadSafetyData = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: blockRows, error: blocksError } =
        await supabase
          .from('blocks')
          .select('id, blocked_id, created_at')
          .eq('blocker_id', user.id)
          .order('created_at', { ascending: false });

      if (blocksError) throw blocksError;

      const blockedIds =
        blockRows?.map((item) => item.blocked_id) ?? [];

      let users: BlockedUser[] = [];

      if (blockedIds.length > 0) {
        const { data: profileRows, error: profilesError } =
          await supabase
            .from('profiles')
            .select(
              'id, display_name, username, avatar_url',
            )
            .in('id', blockedIds);

        if (profilesError) throw profilesError;

        users = (profileRows ?? []) as BlockedUser[];
      }

      setBlockedUsers(users);

      const { data: reportRows, error: reportsError } =
        await supabase
          .from('reports')
          .select(
            'id, target_type, target_id, reason, status, created_at',
          )
          .eq('reporter_id', user.id)
          .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      setReports((reportRows ?? []) as ReportItem[]);
    } catch (error) {
      console.error('Failed to load safety settings:', error);

      Alert.alert(
        'Could not load safety data',
        'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  loadSafetyData();
}, [loadSafetyData]);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await loadSafetyData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleUnblock = (blockedUser: BlockedUser) => {
    Alert.alert(
      'Unblock user?',
      `You are about to unblock @${blockedUser.username}.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              setUnblockingId(blockedUser.id);

              const {
                data: { user },
                error: userError,
              } = await supabase.auth.getUser();

              if (userError) throw userError;

              if (!user) {
                router.replace('/(auth)/login');
                return;
              }

              const { error } = await supabase
                .from('blocks')
                .delete()
                .eq('blocker_id', user.id)
                .eq('blocked_id', blockedUser.id);

              if (error) throw error;

              setBlockedUsers((current) =>
                current.filter(
                  (item) => item.id !== blockedUser.id,
                ),
              );
            } catch (error) {
              console.error('Failed to unblock user:', error);

              Alert.alert(
                'Could not unblock user',
                'Please try again.',
              );
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DARESHOT</Text>

          <Text style={styles.title}>Safety</Text>

          <Text style={styles.subtitle}>
            Manage blocked users and review the reports
            you have submitted.
          </Text>
        </View>

        {/* BLOCKED USERS */}

        <Text style={styles.sectionTitle}>
          BLOCKED USERS
        </Text>

        <View style={styles.card}>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                Loading...
              </Text>
            </View>
          ) : blockedUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                No blocked users
              </Text>

              <Text style={styles.emptyText}>
                Users you block will appear here.
              </Text>
            </View>
          ) : (
            blockedUsers.map((user, index) => (
              <View key={user.id}>
                {index > 0 && (
                  <View style={styles.divider} />
                )}

                <View style={styles.blockedRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(
                        user.display_name ||
                        user.username ||
                        '?'
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <Text
                      style={styles.displayName}
                      numberOfLines={1}
                    >
                      {user.display_name ||
                        user.username}
                    </Text>

                    <Text
                      style={styles.username}
                      numberOfLines={1}
                    >
                      @{user.username}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleUnblock(user)}
                    disabled={unblockingId === user.id}
                    style={({ pressed }) => [
                      styles.unblockButton,
                      pressed &&
                        styles.buttonPressed,
                      unblockingId === user.id &&
                        styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.unblockText}>
                      {unblockingId === user.id
                        ? '...'
                        : 'Unblock'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* REPORT HISTORY */}

        <Text style={styles.sectionTitle}>
          REPORT HISTORY
        </Text>

        <View style={styles.card}>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                Loading...
              </Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                No reports yet
              </Text>

              <Text style={styles.emptyText}>
                Reports you submit will appear here.
              </Text>
            </View>
          ) : (
            reports.map((report, index) => (
              <View key={report.id}>
                {index > 0 && (
                  <View style={styles.divider} />
                )}

                <View style={styles.reportRow}>
                  <View style={styles.reportTop}>
                    <Text style={styles.reportTarget}>
                      {targetLabel(report.target_type)}
                    </Text>

                    <View
                      style={[
                        styles.statusBadge,
                        report.status.toLowerCase() ===
                          'resolved' &&
                          styles.statusResolved,
                      ]}
                    >
                      <Text
                        style={styles.statusText}
                      >
                        {statusLabel(report.status)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.reason}>
                    {report.reason}
                  </Text>

                  <Text style={styles.reportDate}>
                    Submitted {formatDate(report.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* INFO */}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            Stay safe on DARESHOT
          </Text>

          <Text style={styles.infoText}>
            Blocking limits interactions from that user.
            Reports are reviewed separately and do not
            automatically block the reported account.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },

  header: {
    marginBottom: spacing.xl,
  },

  eyebrow: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: 32,
    marginBottom: spacing.xs,
  },

  subtitle: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: 22,
  },

  sectionTitle: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  divider: {
    backgroundColor: colors.border,
    height: 1,
  },

  blockedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 82,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 48,
  },

  avatarText: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: 18,
  },

  userInfo: {
    flex: 1,
    minWidth: 0,
  },

  displayName: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
    marginBottom: 3,
  },

  username: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  unblockButton: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 84,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },

  unblockText: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  buttonPressed: {
    opacity: 0.7,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },

  emptyTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
  },

  emptyText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  reportRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  reportTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  reportTarget: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
  },

  statusBadge: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusResolved: {
    borderColor: colors.success,
  },

  statusText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },

  reason: {
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },

  reportDate: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },

  infoBox: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.md,
  },

  infoTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
  },

  infoText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});