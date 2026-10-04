import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  getProfile,
  saveProfile,
  uploadAvatar,
} from '../../features/onboarding/profileService';
import { getCurrentSession } from '../../lib/auth';

type Gender = 'Male' | 'Female';

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] =
    useState(false);

  const [avatarUrl, setAvatarUrl] =
    useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ageBracket, setAgeBracket] = useState('');
  const [bio, setBio] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const session = await getCurrentSession();

      if (!session?.user) {
        router.replace('/(auth)/login' as any);
        return;
      }

      const profile = await getProfile(
        session.user.id,
      );

      if (!profile) {
        setErrorMessage('Profile not found.');
        return;
      }

      setAvatarUrl(profile.avatar_url ?? null);
      setUsername(profile.username ?? '');
      setDisplayName(profile.display_name ?? '');
      setCountry(profile.country ?? '');
      setLanguage(profile.language ?? '');
      setGender(
        profile.gender === 'Male' ||
          profile.gender === 'Female'
          ? profile.gender
          : '',
      );
      setDateOfBirth(profile.date_of_birth ?? '');
      setAgeBracket(profile.age_bracket ?? '');
      setBio(profile.bio ?? '');
    } catch (error) {
      console.error(
        '[DareMe Edit Profile] Load failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load your profile.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    if (uploadingAvatar || saving) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setUploadingAvatar(true);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Please allow photo library access to choose a profile picture.',
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const session = await getCurrentSession();

      if (!session?.user) {
        setErrorMessage(
          'Your session has expired. Please log in again.',
        );
        return;
      }

      const selectedUri = result.assets[0].uri;

      const newAvatarUrl = await uploadAvatar(
        session.user.id,
        selectedUri,
      );

      setAvatarUrl(newAvatarUrl);
      setSuccessMessage(
        'Profile photo uploaded successfully.',
      );
    } catch (error) {
      console.error(
        '[DareMe Edit Profile] Avatar upload failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not upload your profile photo.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    const cleanUsername =
      username.trim().toLowerCase();

    const cleanDisplayName =
      displayName.trim();

    const cleanCountry = country.trim();
    const cleanLanguage = language.trim();
    const cleanBio = bio.trim();

    if (!cleanUsername) {
      setErrorMessage('Username is required.');
      return;
    }

    if (!cleanDisplayName) {
      setErrorMessage('Display name is required.');
      return;
    }

    if (!gender) {
      setErrorMessage('Gender is required.');
      return;
    }

    if (!dateOfBirth.trim()) {
      setErrorMessage(
        'Date of birth is required.',
      );
      return;
    }

    if (!ageBracket.trim()) {
      setErrorMessage(
        'Age bracket is required.',
      );
      return;
    }

    setSaving(true);

    try {
      const session = await getCurrentSession();

      if (!session?.user) {
        setErrorMessage(
          'Your session has expired. Please log in again.',
        );
        return;
      }

      await saveProfile(
        session.user.id,
        {
          username: cleanUsername,
          display_name: cleanDisplayName,
          country: cleanCountry,
          language: cleanLanguage,
          gender,
          date_of_birth: dateOfBirth.trim(),
          age_bracket: ageBracket.trim(),
          bio: cleanBio,
          avatar_url: avatarUrl,
        },
      );

      setSuccessMessage(
        'Profile updated successfully.',
      );
    } catch (error) {
      console.error(
        '[DareMe Edit Profile] Save failed:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not update your profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={colors.accent}
          />

          <Text style={styles.loadingText}>
            Loading profile...
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            PROFILE
          </Text>

          <Text style={styles.title}>
            Edit Profile
          </Text>

          <Text style={styles.subtitle}>
            Update the information people see on your
            DareShot profile.
          </Text>
        </View>

        <View style={styles.avatarSection}>
          <Pressable
            onPress={handlePickAvatar}
            disabled={
              uploadingAvatar || saving
            }
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.pressed,
              uploadingAvatar &&
                styles.disabled,
            ]}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.plus}>
                  +
                </Text>
              </View>
            )}

            <View style={styles.editBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator
                  size="small"
                  color={colors.background}
                />
              ) : (
                <Text style={styles.editBadgeText}>
                  EDIT
                </Text>
              )}
            </View>
          </Pressable>

          <Text style={styles.avatarTitle}>
            Profile photo
          </Text>

          <Text style={styles.avatarSubtitle}>
            Tap to change your photo
          </Text>
        </View>

        <Field
          label="Display name"
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          placeholder="Your name"
          editable={!saving}
        />

        <Field
          label="Username"
          value={username}
          onChangeText={(value) => {
            setUsername(
              value
                .toLowerCase()
                .replace(/\s/g, ''),
            );
            setErrorMessage('');
            setSuccessMessage('');
          }}
          placeholder="username"
          autoCapitalize="none"
          editable={!saving}
        />

        <Field
          label="Bio"
          value={bio}
          onChangeText={(value) => {
            setBio(value);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          placeholder="Tell people a little about yourself"
          multiline
          editable={!saving}
        />

        <Field
          label="Country"
          value={country}
          onChangeText={(value) => {
            setCountry(value);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          placeholder="India"
          editable={!saving}
        />

        <Field
          label="Language"
          value={language}
          onChangeText={(value) => {
            setLanguage(value);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          placeholder="English"
          editable={!saving}
        />

        <Text style={styles.fieldLabel}>
          Gender
        </Text>

        <View style={styles.optionRow}>
          <OptionButton
            label="Male"
            selected={gender === 'Male'}
            onPress={() => {
              setGender('Male');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            disabled={saving}
          />

          <OptionButton
            label="Female"
            selected={gender === 'Female'}
            onPress={() => {
              setGender('Female');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            disabled={saving}
          />
        </View>

        <Field
          label="Date of birth"
          value={dateOfBirth}
          onChangeText={(value) => {
            setDateOfBirth(value);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          placeholder="YYYY-MM-DD"
          editable={!saving}
        />

        <Field
          label="Age bracket"
          value={ageBracket}
          onChangeText={(value) => {
            setAgeBracket(value);
            setErrorMessage('');
            setSuccessMessage('');
          }}
          placeholder="18-24"
          editable={!saving}
        />

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              {successMessage}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator
              color={colors.background}
            />
          ) : (
            <Text style={styles.saveButtonText}>
              SAVE CHANGES
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={saving}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>
            Cancel
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  editable = true,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryText}
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
        multiline={multiline}
        textAlignVertical={
          multiline ? 'top' : 'center'
        }
        autoCapitalize={autoCapitalize}
        editable={editable}
      />
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.optionButton,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.optionText,
          selected && styles.optionSelectedText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
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
    fontSize: fontSize.sm,
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

  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  avatarButton: {
    width: 112,
    height: 112,
    borderRadius: radius.pill,
    position: 'relative',
  },

  avatar: {
    width: 112,
    height: 112,
    borderRadius: radius.pill,
  },

  avatarPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  plus: {
    color: colors.accent,
    fontFamily: fontFamily.headingMedium,
    fontSize: 42,
    lineHeight: 46,
  },

  editBadge: {
    position: 'absolute',
    right: -4,
    bottom: 2,
    minWidth: 34,
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editBadgeText: {
    color: colors.background,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },

  avatarTitle: {
    marginTop: spacing.md,
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
  },

  avatarSubtitle: {
    marginTop: spacing.xs,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  field: {
    marginBottom: spacing.lg,
  },

  fieldLabel: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },

  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.md,
  },

  multilineInput: {
    minHeight: 110,
    paddingTop: spacing.md,
  },

  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  optionButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  optionText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  optionSelectedText: {
    color: colors.background,
  },

  errorBox: {
    marginBottom: spacing.md,
    backgroundColor: '#2A1518',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  errorText: {
    color: '#FF7A84',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  successBox: {
    marginBottom: spacing.md,
    backgroundColor: '#12251A',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  successText: {
    color: colors.success,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  saveButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },

  saveButtonText: {
    color: colors.background,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.sm,
  },

  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },

  cancelText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  pressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.6,
  },
});