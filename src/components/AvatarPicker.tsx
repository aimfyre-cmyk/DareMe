import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
    Alert,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    colors,
    fontFamily,
    fontSize,
    radius,
    spacing,
} from '../constants/theme';

type AvatarPickerProps = {
  value?: string | null;
  onChange: (uri: string) => void;
};

export function AvatarPicker({
  value,
  onChange,
}: AvatarPickerProps) {
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    try {
      setLoading(true);

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

      if (!result.canceled && result.assets?.length) {
        onChange(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Profile image picker failed:', error);

      Alert.alert(
        'Could not select photo',
        'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={pickImage}
        disabled={loading}
        style={styles.avatarButton}
      >
        {value ? (
          <Image
            source={{ uri: value }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.plus}>+</Text>
          </View>
        )}

        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {loading ? '...' : 'EDIT'}
          </Text>
        </View>
      </Pressable>

      <Text style={styles.title}>Profile photo</Text>

      <Text style={styles.subtitle}>
        Optional. Add a photo so people can recognize you.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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

  placeholder: {
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

  badge: {
    position: 'absolute',
    right: -4,
    bottom: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },

  badgeText: {
    color: colors.background,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },

  title: {
    marginTop: spacing.md,
    color: colors.primaryText,
    fontFamily: fontFamily.headingMedium,
    fontSize: fontSize.lg,
  },

  subtitle: {
    marginTop: spacing.xs,
    maxWidth: 280,
    textAlign: 'center',
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});