import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../constants/theme';
import { Chip } from './Chip';

export type MockDare = {
  id: string;
  title: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xpValue: number;
  proofType: 'Photo' | 'Video' | 'Text';
};

type DareCardProps = {
  dare: MockDare;
  onPress?: () => void;
  onPrimaryAction?: () => void;
};

const difficultyVariant: Record<
  MockDare['difficulty'],
  'success' | 'accent' | 'danger'
> = {
  Easy: 'success',
  Medium: 'accent',
  Hard: 'danger',
};

export function DareCard({
  dare,
  onPress,
  onPrimaryAction,
}: DareCardProps) {
  const handlePrimaryPress = () => {
    console.log('[DareCard] TAKE THE DARE:', dare.id);

    if (onPrimaryAction) {
      onPrimaryAction();
      return;
    }

    onPress?.();
  };

  return (
    <View style={styles.card}>
      {/* Tags */}
      <View style={styles.tagRow}>
        <Chip
          label={dare.category}
          variant="neutral"
        />

        <Chip
          label={dare.difficulty}
          variant={difficultyVariant[dare.difficulty]}
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>
        {dare.title}
      </Text>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          +{dare.xpValue} XP
        </Text>

        <Text style={styles.metaDot}>
          ·
        </Text>

        <Text style={styles.meta}>
          {dare.proofType} proof
        </Text>
      </View>

      {/* CTA */}
      <Pressable
        onPress={handlePrimaryPress}
        accessibilityRole="button"
        accessibilityLabel={`Take the dare: ${dare.title}`}
        testID={`take-dare-${dare.id}`}
        style={({ pressed }) => [
          styles.cta,
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>
          ⚡ TAKE THE DARE
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  meta: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  metaDot: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginHorizontal: spacing.xs,
  },

  cta: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },

  ctaPressed: {
    opacity: 0.75,
  },

  ctaLabel: {
    color: '#000000',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});