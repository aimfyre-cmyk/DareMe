import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Notification count error:', error);
      return;
    }

    setUnreadCount(count ?? 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnreadCount();
    }, [loadUnreadCount]),
  );

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `${unreadCount} unread notifications`
          : 'Notifications'
      }
      hitSlop={10}
    >
<Ionicons
  name="notifications-outline"
  size={24}
  color={colors.primaryText}
/>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
 

  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: '800',
  },
});