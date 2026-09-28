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

type AccountRowProps = {
  title: string;
  description: string;
  value?: string;
  onPress?: () => void;
};

function AccountRow({
  title,
  description,
  value,
  onPress,
}: AccountRowProps) {
  return (
    <Pressable
      disabled={!onPress}
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

      <View style={styles.rowRight}>
        {value ? (
          <Text
            style={styles.value}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}

        {onPress ? (
          <Text style={styles.chevron}>›</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function AccountSettingsScreen() {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>

          <Text style={styles.title}>
            Account
          </Text>

          <Text style={styles.subtitle}>
            Manage your DareMe account information.
          </Text>
        </View>

        <View style={styles.card}>
          <AccountRow
            title="Mobile Number"
            description="Update and verify your mobile number"
            onPress={() =>
              router.push('/phone')
            }
          />

          <View style={styles.divider} />

          <AccountRow
            title="Email"
            description="Your email address is managed through authentication"
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            Security
          </Text>

          <Text style={styles.infoText}>
            Changes to your mobile number require OTP
            verification.
          </Text>
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

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  row: {
    minHeight: 82,
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

  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '45%',
  },

  value: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
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

  infoBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },

  infoTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.sm,
  },

  infoText: {
    marginTop: spacing.xs,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
});