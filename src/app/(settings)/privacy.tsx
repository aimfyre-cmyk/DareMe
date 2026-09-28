import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import { supabase } from '../../lib/supabase';

type PrivacyLevel =
  | 'anyone'
  | 'followers'
  | 'connections'
  | 'nobody';

type PrivacySettings = {
  profile_visibility: PrivacyLevel;
  dare_visibility: PrivacyLevel;
  completed_dares_visibility: PrivacyLevel;
};

const OPTIONS: {
  value: PrivacyLevel;
  label: string;
  description: string;
}[] = [
  {
    value: 'anyone',
    label: 'Anyone',
    description: 'Anyone on DareMe can see this.',
  },
  {
    value: 'followers',
    label: 'Followers',
    description: 'Only people who follow you can see this.',
  },
  {
    value: 'connections',
    label: 'Connections',
    description: 'Only your connections can see this.',
  },
  {
    value: 'nobody',
    label: 'Nobody',
    description: 'Keep this hidden from other users.',
  },
];

type PrivacyRowProps = {
  title: string;
  description: string;
  value: PrivacyLevel;
  onChange: (value: PrivacyLevel) => void;
};

function PrivacyRow({
  title,
  description,
  value,
  onChange,
}: PrivacyRowProps) {
  return (
    <View style={styles.settingBlock}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingDescription}>
        {description}
      </Text>

      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionLabel,
                    selected && styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>

                <Text
                  style={[
                    styles.optionDescription,
                    selected &&
                      styles.optionDescriptionSelected,
                  ]}
                >
                  {option.description}
                </Text>
              </View>

              <View
                style={[
                  styles.radio,
                  selected && styles.radioSelected,
                ]}
              >
                {selected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function PrivacyScreen() {
  const [settings, setSettings] =
    useState<PrivacySettings>({
      profile_visibility: 'anyone',
      dare_visibility: 'anyone',
      completed_dares_visibility: 'anyone',
    });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  async function loadPrivacySettings() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error('You must be logged in.');
      }

      const { data, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'profile_visibility, dare_visibility, completed_dares_visibility',
          )
          .eq('id', user.id)
          .single();

      if (profileError) throw profileError;

      setSettings({
        profile_visibility:
          data.profile_visibility ?? 'anyone',
        dare_visibility:
          data.dare_visibility ?? 'anyone',
        completed_dares_visibility:
          data.completed_dares_visibility ?? 'anyone',
      });
    } catch (err) {
      console.error(
        'Failed to load privacy settings:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load privacy settings.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function savePrivacySettings() {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error('You must be logged in.');
      }

      const { error: updateError } =
        await supabase
          .from('profiles')
          .update({
            profile_visibility:
              settings.profile_visibility,
            dare_visibility: settings.dare_visibility,
            completed_dares_visibility:
              settings.completed_dares_visibility,
          })
          .eq('id', user.id);

      if (updateError) throw updateError;

      setMessage('Privacy settings updated successfully.');
    } catch (err) {
      console.error(
        'Failed to save privacy settings:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not save privacy settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={colors.accent}
          />
          <Text style={styles.loadingText}>
            Loading privacy settings...
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DAREME</Text>

          <Text style={styles.title}>Privacy</Text>

          <Text style={styles.subtitle}>
            Control who can see your profile, dares and
            completed dares.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {message ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              {message}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <PrivacyRow
            title="Profile visibility"
            description="Choose who can view your profile."
            value={settings.profile_visibility}
            onChange={(value) =>
              setSettings((current) => ({
                ...current,
                profile_visibility: value,
              }))
            }
          />

          <View style={styles.divider} />

          <PrivacyRow
            title="Dare visibility"
            description="Choose who can see your public dares."
            value={settings.dare_visibility}
            onChange={(value) =>
              setSettings((current) => ({
                ...current,
                dare_visibility: value,
              }))
            }
          />

          <View style={styles.divider} />

          <PrivacyRow
            title="Completed dares"
            description="Choose who can see your completed dares."
            value={settings.completed_dares_visibility}
            onChange={(value) =>
              setSettings((current) => ({
                ...current,
                completed_dares_visibility: value,
              }))
            }
          />
        </View>

        <Pressable
          onPress={savePrivacySettings}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.saveButtonText}>
              SAVE PRIVACY SETTINGS
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    marginBottom: spacing.xl,
  },

  eyebrow: {
    color: colors.accent,
    fontFamily: fontFamily.headingBold,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: 30,
    marginBottom: spacing.sm,
  },

  subtitle: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: 22,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  settingBlock: {
    padding: spacing.md,
  },

  settingTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.lg,
    marginBottom: 4,
  },

  settingDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  options: {
    gap: spacing.sm,
  },

  option: {
    minHeight: 66,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },

  optionPressed: {
    opacity: 0.85,
  },

  optionText: {
    flex: 1,
    paddingRight: spacing.md,
  },

  optionLabel: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.md,
    marginBottom: 2,
  },

  optionLabelSelected: {
    color: '#000000',
  },

  optionDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },

  optionDescriptionSelected: {
    color: '#000000',
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.secondaryText,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: '#000000',
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  successBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(31, 174, 107, 0.12)',
    marginBottom: spacing.md,
  },

  successText: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  errorBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ff5c5c',
    backgroundColor: 'rgba(255, 92, 92, 0.10)',
    marginBottom: spacing.md,
  },

  errorText: {
    color: '#ff7777',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  saveButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },

  saveButtonPressed: {
    opacity: 0.85,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#000000',
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },

  cancelText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  loadingText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
  },
});

