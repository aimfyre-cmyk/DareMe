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

export function HomeMenu({
  visible,
  onClose,
  items,
}: HomeMenuProps) {
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
            {items.map((item) => (
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
                  <Text style={styles.icon}>
                    {item.icon}
                  </Text>
                </View>

                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>
                    {item.title}
                  </Text>

                  <Text style={styles.itemSubtitle}>
                    {item.subtitle}
                  </Text>
                </View>

                <Text style={styles.arrow}>›</Text>
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

  icon: {
    fontSize: 21,
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
    color: colors.secondaryText,
    fontSize: 28,
    marginLeft: spacing.sm,
  },
});