import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../constants/theme';

/**
 * Primary destinations:
 * Home, Discover, Create, Me.
 *
 * Dares and create-dare remain available as routes,
 * but are hidden from the bottom navigation.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.secondaryText,

        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },

        tabBarItemStyle: {
          flex: 1,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 1,
        },
      }}
    >
      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size }) => (
            <Text
              style={{
                color,
                fontSize: size,
              }}
            >
              ⌂
            </Text>
          ),
        }}
      />

      {/* DISCOVER */}
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarAccessibilityLabel: 'Discover tab',
          tabBarIcon: ({ color, size }) => (
            <Text
              style={{
                color,
                fontSize: size,
              }}
            >
              ◉
            </Text>
          ),
        }}
      />

      {/* CREATE */}
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarAccessibilityLabel: 'Create a dare',
          tabBarIcon: ({ color, size }) => (
            <Text
              style={{
                color: colors.accent,
                fontSize: size + 10,
                fontWeight: '700',
              }}
            >
              ＋
            </Text>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            color: colors.accent,
          },
        }}
      />

      {/* HIDDEN CREATE-DARE ROUTE */}
      <Tabs.Screen
        name="create-dare"
        options={{
          href: null,
        }}
      />

      {/* HIDDEN DARES ROUTE */}
      <Tabs.Screen
        name="dares"
        options={{
          href: null,
        }}
      />

      {/* ME */}
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarAccessibilityLabel: 'Your profile tab',
          tabBarIcon: ({ color, size }) => (
            <Text
              style={{
                color,
                fontSize: size,
              }}
            >
              ●
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}