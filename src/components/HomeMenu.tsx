import {
  Ionicons,
} from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fontSize, spacing } from '../constants/theme';

type MenuItem = {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
};

type HomeMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
};

/**
 * Home Menu icon mapping
 *
 * Icons are controlled here so every menu item has
 * a consistent professional Ionicons icon.
 */
const menuIconMap: Record<
  string,
  keyof typeof Ionicons.glyphMap
> = {
  Dashboard: 'grid-outline',
  'My Dares': 'flame-outline',
  Saved: 'bookmark-outline',
  'My Activity': 'time-outline',
  'Dare Circle': 'people-outline',
  'Invite Friends': 'person-add-outline',
  Leaderboard: 'trophy-outline',
  'Global Ranking': 'podium-outline',
  Rewards: 'gift-outline',
  'My Profile': 'person-circle-outline',
  Settings: 'settings-outline',
  Notifications: 'notifications-outline',
  'Dare Shot': 'flash-outline',
};

export function HomeMenu({
  visible,
  onClose,
  items,
}: HomeMenuProps) {
  /**
   * Dashboard is intentionally added here so it always
   * stays at the TOP of the Home menu.
   *
   * Existing menu items and their functions remain untouched.
   *
   * Duplicate protection:
   * If Dashboard is already supplied from Home, we do not
   * show it twice.
   */
  const hasDashboard = items.some(
    (item) => item.title === 'Dashboard',
  );

  const menuItems: MenuItem[] = hasDashboard
    ? items
    : [
        {
          title: 'Dashboard',
          subtitle: 'Your DareShot performance',
          icon: 'grid-outline',
          onPress: () => {
            router.push('/dashboard');
          },
        },
        ...items,
      ];

  const getMenuIcon = (
    item: MenuItem,
  ): keyof typeof Ionicons.glyphMap => {
    return (
      menuIconMap[item.title] ??
      (item.icon as keyof typeof Ionicons.glyphMap) ??
      'ellipse-outline'
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={styles.menu}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>DareShot</Text>

              <Text style={styles.subtitle}>
                Your DareShot menu
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={10}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {menuItems.map((item) => (
              <Pressable
                key={item.title}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.itemPressed,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name={getMenuIcon(item)}
                    size={22}
                    color={colors.primaryText}
                  />
                </View>

                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>
                    {item.title}
                  </Text>

                  <Text style={styles.itemSubtitle}>
                    {item.subtitle}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward-outline"
                  size={20}
                  color={colors.secondaryText}
                  style={styles.arrow}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  menu: {
    width: '88%',
    maxWidth: 420,
    marginTop: 58,
    marginLeft: spacing.md,
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  title: {
    color: colors.primaryText,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },

  subtitle: {
    marginTop: 3,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },

  closeText: {
    color: colors.primaryText,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '400',
  },

  list: {
    padding: spacing.sm,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },

  itemPressed: {
    backgroundColor: colors.surfaceElevated,
  },

  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },

  itemContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  itemTitle: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  itemSubtitle: {
    marginTop: 3,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
  },

  arrow: {
    marginLeft: spacing.sm,
  },
});