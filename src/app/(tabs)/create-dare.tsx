import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { colors, fontFamily, fontSize, spacing } from '../../constants/theme';
import { discoverCategories } from '../../data/mockDares';

const difficulties = ['Easy', 'Medium', 'Hard'] as const;
const visibilities = ['Anyone', 'Followers', 'Connections'] as const;

/**
 * CREATE — Phase 2 shell only. UI ONLY: no persistence, no API calls,
 * no AI generation. Selections are local component state so the screen
 * feels real, but nothing here survives navigating away. Real dare
 * creation (validation, safety check, publish) arrives in Phase 6.
 */
export default function CreateScreen() {
  const [category, setCategory] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number] | null>(null);
  const [visibility, setVisibility] = useState<(typeof visibilities)[number] | null>(null);

  return (
    <Screen>
      <Text style={styles.heading} accessibilityRole="header">
        Create a Dare
      </Text>
      <Text style={styles.subheading}>
        This screen is a preview — publishing isn&apos;t connected yet.
      </Text>

      <SectionHeader title="What's the dare?" />
      <Input placeholder="Describe the dare..." multiline numberOfLines={4} />

      <SectionHeader title="Category" />
      <View style={styles.chipWrap}>
        {discoverCategories.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </View>

      <SectionHeader title="Difficulty" />
      <View style={styles.chipWrap}>
        {difficulties.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={difficulty === item}
            onPress={() => setDifficulty(item)}
          />
        ))}
      </View>

      <SectionHeader title="Who can see this" />
      <View style={styles.chipWrap}>
        {visibilities.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={visibility === item}
            onPress={() => setVisibility(item)}
          />
        ))}
      </View>

      <View style={styles.ctaWrap}>
        <PrimaryButton label="Publish Dare" disabled />
        <Text style={styles.disabledNote}>Publishing arrives in a later phase.</Text>
      </View>
    </Screen>
  );
}

function SelectableChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Chip label={label} variant={selected ? 'accent' : 'neutral'} />
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
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ctaWrap: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  disabledNote: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});
