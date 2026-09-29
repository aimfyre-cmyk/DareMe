import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ImageCropper } from '../components/ImageCropper';

import { router } from 'expo-router';

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Input } from '../components/Input';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import {
  colors,
  fontFamily,
  fontSize,
  spacing,
} from '../constants/theme';
import { supabase } from '../lib/supabase';


const visibilityOptions = [
  { label: 'Anyone', value: 'anyone' },
  { label: 'Followers', value: 'followers' },
  { label: 'Connections', value: 'connections' },
  { label: 'Only Me', value: 'nobody' },
] as const;

type Visibility = (typeof visibilityOptions)[number]['value'];

type SelectedMedia = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export default function CreatePostScreen() {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] =
    useState<Visibility>('anyone');

  const [media, setMedia] =
    useState<SelectedMedia | null>(null);
    const [selectedImageUri, setSelectedImageUri] =
  useState<string | null>(null);

const [cropVisible, setCropVisible] =
  useState(false);

  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Extra protection against double taps / duplicate posts.
  const publishLock = useRef(false);

  const pickPhoto = async () => {
    setErrorMessage('');

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Please allow photo library access to select a photo.',
        );
        return;
      }

      const result =
  await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 5],
    quality: 0.85,
  });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

setSelectedImageUri(asset.uri);
setCropVisible(true);
    } catch (error) {
      console.error('Pick photo error:', error);

      setErrorMessage(
        'Could not select the photo. Please try again.',
      );
    }
  };

  const removeMedia = () => {
    setMedia(null);
  };

  const publishPost = async () => {
    if (publishLock.current || publishing) {
      return;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent && !media) {
      setErrorMessage(
        'Write something or choose a photo before publishing.',
      );
      return;
    }

    publishLock.current = true;
    setPublishing(true);
    setErrorMessage('');

    let createdPostId: string | null = null;
    let uploadedStoragePath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          'Please log in before creating a post.',
        );
      }

      const postType = media ? 'photo' : 'text';

      // Create the database record first.
      const { data: post, error: postError } =
        await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            post_type: postType,
            content: trimmedContent || null,
            media_url: null,
            media_type: media ? 'image' : null,
            visibility,
            status: 'active',
          })
          .select('id')
          .single();

      if (postError || !post) {
        throw postError ?? new Error(
          'Could not create the post.',
        );
      }

      createdPostId = post.id;

      // Upload selected photo.
      if (media) {
        let arrayBuffer: ArrayBuffer;

if (Platform.OS === 'web') {
  const response = await fetch(media.uri);

  if (!response.ok) {
    throw new Error(
      'Could not read the selected photo.',
    );
  }

  arrayBuffer = await response.arrayBuffer();
} else {
  const file = new File(media.uri);

  if (!file.exists) {
    throw new Error(
      'Selected photo file could not be found.',
    );
  }

  arrayBuffer = await file.arrayBuffer();
}

        const extension = getFileExtension(
          media.fileName,
          media.mimeType,
        );

        const storagePath =
          `${user.id}/${post.id}.${extension}`;

        const contentType =
          media.mimeType || 'image/jpeg';

        const { error: uploadError } =
          await supabase.storage
            .from('post-media')
            .upload(
              storagePath,
              arrayBuffer,
              {
                contentType,
                upsert: false,
              },
            );

        if (uploadError) {
          throw uploadError;
        }

        uploadedStoragePath = storagePath;

        const { error: updateError } =
          await supabase
            .from('posts')
            .update({
              media_url: storagePath,
            })
            .eq('id', post.id)
            .eq('user_id', user.id);

        if (updateError) {
          throw updateError;
        }
      }

      /*
       * Publish succeeded.
       *
       * We do NOT use Alert here because Expo Web testing
       * can behave differently with native alerts.
       *
       * Directly return to Discover where the new post
       * will eventually appear.
       */
      router.replace('/(tabs)/discover');
    } catch (error) {
      console.error('Publish post error:', error);

      // Clean up uploaded media if database update failed.
      if (uploadedStoragePath) {
        await supabase.storage
          .from('post-media')
          .remove([uploadedStoragePath]);
      }

      // Clean up the post record if this publish attempt
      // failed after creating it.
      if (createdPostId) {
        await supabase
          .from('posts')
          .delete()
          .eq('id', createdPostId);
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while publishing your post.';

      setErrorMessage(message);
    } finally {
      setPublishing(false);
      publishLock.current = false;
    }
  };

  return (
    <Screen>
      {selectedImageUri && (
  <ImageCropper
    visible={cropVisible}
    imageUri={selectedImageUri}
    onCancel={() => {
      setCropVisible(false);
      setSelectedImageUri(null);
    }}
    onCropComplete={(croppedUri: string) => {
      setMedia({
        uri: croppedUri,
        fileName: 'dareme-post.jpg',
        mimeType: 'image/jpeg',
      });

      setCropVisible(false);
      setSelectedImageUri(null);
    }}
  />
)}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text
          style={styles.heading}
          accessibilityRole="header"
        >
          Create Post
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.subheading}>
        Share something with the DareMe community.
      </Text>

      <SectionHeader title="Caption" />

      <Input
        placeholder="What's happening?"
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={5}
      />

      <SectionHeader title="Photo" />

      {media ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: media.uri }}
            style={styles.preview}
            resizeMode="cover"
          />

          <Pressable
            onPress={removeMedia}
            style={styles.removeButton}
            accessibilityRole="button"
            accessibilityLabel="Remove selected photo"
          >
            <Text style={styles.removeText}>
              Remove Photo
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={pickPhoto}
          style={styles.mediaButton}
          accessibilityRole="button"
          accessibilityLabel="Choose a photo"
        >
          <Text style={styles.mediaIcon}>📸</Text>

          <Text style={styles.mediaTitle}>
            Choose Photo
          </Text>

          <Text style={styles.mediaDescription}>
            Select a photo from your device.
          </Text>
        </Pressable>
      )}

      <SectionHeader title="Who can see this?" />

      <View style={styles.visibilityWrap}>
        {visibilityOptions.map((option) => {
          const selected =
            visibility === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() =>
                setVisibility(option.value)
              }
              style={[
                styles.visibilityChip,
                selected &&
                  styles.visibilityChipSelected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.visibilityText,
                  selected &&
                    styles.visibilityTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.publishWrap}>
        <PrimaryButton
          label={
            publishing
              ? 'Publishing...'
              : 'Publish Post'
          }
          onPress={publishPost}
          disabled={publishing}
        />

        {publishing && (
          <ActivityIndicator
            style={styles.loader}
            color={colors.accent}
          />
        )}
      </View>
    </Screen>
  );
}

function getFileExtension(
  fileName?: string | null,
  mimeType?: string | null,
) {
  if (fileName?.includes('.')) {
    const parts = fileName.split('.');
    return parts[parts.length - 1].toLowerCase();
  }

  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';

  return 'jpg';
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },

  back: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  heading: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xl,
  },

  headerSpacer: {
    width: 50,
  },

  subheading: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  previewContainer: {
    marginBottom: spacing.md,
  },

  preview: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  removeButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
  },

  removeText: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  mediaButton: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  mediaIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },

  mediaTitle: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
  },

  mediaDescription: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  visibilityWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  visibilityChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  visibilityChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },

  visibilityText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  visibilityTextSelected: {
    color: colors.background,
  },

  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  errorText: {
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },

  publishWrap: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },

  loader: {
    marginTop: spacing.sm,
  },
});