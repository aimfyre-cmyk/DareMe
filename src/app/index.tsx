import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  getCurrentSession,
  subscribeToAuthChanges,
} from '../lib/auth';

export default function Index() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const session = await getCurrentSession();

      if (!mounted) return;

      setLoading(false);

      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login' as any);
      }
    };

    checkSession();

    const subscription = subscribeToAuthChanges((session) => {
      if (!mounted || loading) return;

      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login' as any);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#B7FF3C" />
      </View>
    );
  }

  return <View style={styles.loading} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0B0B0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});