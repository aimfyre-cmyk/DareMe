import { router } from 'expo-router';
import {
    Pressable,
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

type SettingsRowProps = {
  title: string;
  description: string;
  onPress: () => void;
};

function SettingsRow({
  title,
  description,
  onPress,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DAREME</Text>

          <Text style={styles.title}>Settings</Text>

          <Text style={styles.subtitle}>
            Manage your account, privacy and app preferences.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT</Text>

        <View style={styles.card}>
          <SettingsRow
  title="Edit Profile"
  description="Photo, name, username, bio and profile details"
  onPress={() => router.push('/edit-profile')}
/>

<View style={styles.divider} />

<SettingsRow
  title="Account"
  description="Mobile number and account information"
  onPress={() => router.push('/account')}
/>
        </View>

        <Text style={styles.sectionTitle}>PRIVACY & SAFETY</Text>

        <View style={styles.card}>
          <SettingsRow
            title="Privacy"
            description="Control who can see and interact with you"
            onPress={() => router.push('/privacy')}
          />

          <View style={styles.divider} />

          <SettingsRow
            title="Safety"
            description="Blocked users and reports"
            onPress={() => router.push('/safety')}
          />
        </View>

        <Text style={styles.sectionTitle}>APP</Text>

        <View style={styles.card}>
          <SettingsRow
            title="Notifications"
            description="Manage your DareMe notifications"
            onPress={() => {}}
          />

          <View style={styles.divider} />

          <SettingsRow
            title="Help & Support"
            description="Get help with DareMe"
            onPress={() => {}}
          />

          <View style={styles.divider} />

          <SettingsRow
            title="About DareMe"
            description="App information and legal documents"
            onPress={() => {}}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    marginBottom: spacing.xl,
  },

  eyebrow: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: 32,
    lineHeight: 38,
  },

  subtitle: {
    marginTop: spacing.sm,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },

  sectionTitle: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  row: {
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowPressed: {
    opacity: 0.7,
  },

  rowContent: {
    flex: 1,
    paddingRight: spacing.md,
  },

  rowTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.md,
  },

  rowDescription: {
    marginTop: spacing.xs,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },

  chevron: {
    color: colors.secondaryText,
    fontSize: 28,
    lineHeight: 30,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
});