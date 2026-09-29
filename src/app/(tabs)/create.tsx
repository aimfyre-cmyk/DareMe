import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import {
  colors,
  fontFamily,
  fontSize,
  spacing,
} from '../../constants/theme';

type CreateOptionProps = {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
};

export default function CreateScreen() {
  return (
    <Screen>
      <Text style={styles.heading}>Create</Text>
      <Text style={styles.subheading}>
        Share a dare, post, or reel with the DareMe community.
      </Text>

      <View style={styles.options}>
        <CreateOption
          icon="⚡"
          title="Create Dare"
          description="Challenge yourself or someone else."
          onPress={() => router.push('/(tabs)/create-dare' as any)}
        />

        <CreateOption
          icon="📸"
          title="Create Post"
          description="Share a photo or text with the community."
          onPress={() => router.push('/create-post' as any)}
        />

        <CreateOption
          icon="🎬"
          title="Create Reel"
          description="Share a short vertical video."
          onPress={() => router.push('/create-reel' as any)}
        />
      </View>
    </Screen>
  );
}

function CreateOption({
  icon,
  title,
  description,
  onPress,
}: CreateOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xxl,
    marginTop: spacing.lg,
  },

  subheading: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },

  options: {
    gap: spacing.md,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
  },

  cardPressed: {
    opacity: 0.7,
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  icon: {
    fontSize: 24,
  },

  textContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
  },

  description: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: 4,
  },

  arrow: {
    color: colors.secondaryText,
    fontSize: 28,
    marginLeft: spacing.sm,
  },
});