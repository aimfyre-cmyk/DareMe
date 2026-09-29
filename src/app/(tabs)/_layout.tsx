import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../constants/theme';

/**
 * The five primary destinations: Home, Discover, Create, Dares, Me.
 * expo-router's Tabs acts as our BottomNav — styled to the DareMe theme,
 * with Create visually emphasized per the design system.
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
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>⌂</Text>,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarAccessibilityLabel: 'Discover tab',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>◉</Text>,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarAccessibilityLabel: 'Create a dare',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color: colors.accent, fontSize: size + 10, fontWeight: '700' }}>＋</Text>
          ),
          tabBarLabelStyle: { fontSize: 11, color: colors.accent },
        }}
      />
      <Tabs.Screen
  name="create-dare"
  options={{
    href: null,
  }}
/>
      <Tabs.Screen
        name="dares"
        options={{
          title: 'Dares',
          tabBarAccessibilityLabel: 'Dares tab',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>ϟ</Text>,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarAccessibilityLabel: 'Your profile tab',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>●</Text>,
        }}
      />
    </Tabs>
  );
}
