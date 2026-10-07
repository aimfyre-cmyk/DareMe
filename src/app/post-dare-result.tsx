import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

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

import { ImageCropper } from '../components/ImageCropper';
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

type MediaKind = 'image' | 'video';

type SelectedMedia = {
  uri: string;
  kind: MediaKind;
  fileName?: string | null;
  mimeType?: string | null;
};

export default function PostDareResultScreen() {
  const { dareParticipantId, dareId } =
    useLocalSearchParams<{
      dareParticipantId?: string;
      dareId?: string;
    }>();

  const participantId =
    typeof dareParticipantId === 'string'
      ? dareParticipantId
      : '';

  const [content, setContent] = useState('');
  const [media, setMedia] =
    useState<SelectedMedia | null>(null);

  const [selectedImageUri, setSelectedImageUri] =
    useState<string | null>(null);

  const [cropVisible, setCropVisible] =
    useState(false);

  const [publishing, setPublishing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const publishLock = useRef(false);

  /*
   * =====================================================
   * PICK PHOTO
   * =====================================================
   */

  const pickPhoto = async () => {
    if (publishing) {
      return;
    }

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
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.85,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const asset = result.assets[0];

      setSelectedImageUri(asset.uri);
      setCropVisible(true);
    } catch (error) {
      console.error(
        'Post result photo error:',
        error,
      );

      setErrorMessage(
        'Could not select the photo. Please try again.',
      );
    }
  };

  /*
   * =====================================================
   * PICK VIDEO
   * =====================================================
   */

  const pickVideo = async () => {
    if (publishing) {
      return;
    }

    setErrorMessage('');

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Please allow video library access to select a video.',
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: false,
          quality: 0.8,
          videoMaxDuration: 300,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const asset = result.assets[0];

      setMedia({
        uri: asset.uri,
        kind: 'video',
        fileName:
          asset.fileName ??
          'dare-result-video.mp4',
        mimeType:
          asset.mimeType ??
          'video/mp4',
      });
    } catch (error) {
      console.error(
        'Post result video error:',
        error,
      );

      setErrorMessage(
        'Could not select the video. Please try again.',
      );
    }
  };

  /*
   * =====================================================
   * REMOVE MEDIA
   * =====================================================
   */

  const removeMedia = () => {
    if (publishing) {
      return;
    }

    setMedia(null);
  };

  /*
   * =====================================================
   * SKIP RESULT
   * =====================================================
   */

  const skipResult = () => {
    if (publishing) {
      return;
    }

    Alert.alert(
      'Skip Result Post?',
      'Your Dare will remain completed, but this result will not be posted to the Response Pool.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => {
            router.replace('/(tabs)/dares');
          },
        },
      ],
    );
  };

  /*
   * =====================================================
   * PUBLISH RESULT
   * =====================================================
   */

  const publishResult = async () => {
    if (
      publishLock.current ||
      publishing
    ) {
      return;
    }

    if (!participantId) {
      setErrorMessage(
        'Dare participant information is missing.',
      );
      return;
    }

    if (!media) {
      setErrorMessage(
        'Please choose a photo or video for your Dare result.',
      );
      return;
    }

    publishLock.current = true;
    setPublishing(true);
    setErrorMessage('');

    let createdPostId: string | null = null;

    try {
      /*
       * =================================================
       * CURRENT USER
       * =================================================
       */

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          'Please log in before posting your Dare result.',
        );
      }

      /*
       * =================================================
       * VERIFY PARTICIPANT
       * =================================================
       *
       * We verify ownership before creating the post.
       */

      const {
        data: participant,
        error: participantError,
      } = await supabase
        .from('dare_participants')
        .select(
          'id,user_id,dare_id,result_posted,result_post_id,state',
        )
        .eq('id', participantId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (participantError) {
        throw participantError;
      }

      if (!participant) {
        throw new Error(
          'Dare participation could not be found.',
        );
      }

      /*
       * =================================================
       * PREVENT DUPLICATE RESULT
       * =================================================
       */

      if (
        participant.result_posted &&
        participant.result_post_id
      ) {
        Alert.alert(
          'Result Already Posted',
          'You have already posted your result for this Dare.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(tabs)/dares');
              },
            },
          ],
        );

        return;
      }

      /*
       * =================================================
       * POST TYPE
       * =================================================
       */

      const postType =
        media.kind === 'video'
          ? 'video'
          : 'photo';

      const trimmedContent =
        content.trim();

      /*
       * =================================================
       * CREATE POST
       * =================================================
       *
       * Result posts use the existing posts system.
       * They are public because they belong to
       * the Response Pool.
       */

      const {
        data: post,
        error: postError,
      } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          post_type: postType,
          content:
            trimmedContent || null,
          media_url: null,
          media_type: media.kind,
          visibility: 'anyone',
          status: 'active',
        })
        .select('id')
        .single();

      if (postError || !post) {
        throw (
          postError ??
          new Error(
            'Could not create the Dare result post.',
          )
        );
      }

      createdPostId = post.id;

      /*
       * =================================================
       * READ MEDIA
       * =================================================
       */

      let arrayBuffer: ArrayBuffer;

      if (Platform.OS === 'web') {
        const response =
          await fetch(media.uri);

        if (!response.ok) {
          throw new Error(
            media.kind === 'video'
              ? 'Could not read the selected video.'
              : 'Could not read the selected photo.',
          );
        }

        arrayBuffer =
          await response.arrayBuffer();
      } else {
        const file =
          new File(media.uri);

        if (!file.exists) {
          throw new Error(
            media.kind === 'video'
              ? 'Selected video file could not be found.'
              : 'Selected photo file could not be found.',
          );
        }

        arrayBuffer =
          await file.arrayBuffer();
      }

      /*
       * =================================================
       * STORAGE PATH
       * =================================================
       */

      const extension =
        getFileExtension(
          media.fileName,
          media.mimeType,
          media.kind,
        );

      const storagePath =
        `${user.id}/${post.id}.${extension}`;

      const contentType =
        media.mimeType ||
        (media.kind === 'video'
          ? 'video/mp4'
          : 'image/jpeg');

      /*
       * =================================================
       * GET R2 UPLOAD URL
       * =================================================
       */

      const {
        data: uploadUrlData,
        error: uploadUrlError,
      } = await supabase.functions.invoke(
        'r2-upload-url',
        {
          body: {
            fileName: storagePath,
            contentType,
          },
        },
      );

      if (uploadUrlError) {
        throw uploadUrlError;
      }

      if (
        !uploadUrlData?.success ||
        !uploadUrlData?.uploadUrl ||
        !uploadUrlData?.key
      ) {
        throw new Error(
          uploadUrlData?.error ??
            'Unable to create R2 upload URL.',
        );
      }

      /*
       * =================================================
       * UPLOAD TO R2
       * =================================================
       */

      const uploadResponse =
        await fetch(
          uploadUrlData.uploadUrl,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                contentType,
            },
            body: arrayBuffer,
          },
        );

      if (!uploadResponse.ok) {
        throw new Error(
          `R2 upload failed: ${uploadResponse.status}`,
        );
      }

      const uploadedStoragePath =
        uploadUrlData.key;

      /*
       * =================================================
       * SAVE MEDIA PATH ON POST
       * =================================================
       */

      const {
        error: updatePostError,
      } = await supabase
        .from('posts')
        .update({
          media_url:
            uploadedStoragePath,
        })
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (updatePostError) {
        throw updatePostError;
      }

      /*
       * =================================================
       * LINK RESULT TO DARE PARTICIPANT
       * =================================================
       *
       * This is the important connection:
       *
       * result_posted = true
       * result_post_id = created post id
       *
       * Response Pool can later use these fields
       * to find only participants who posted results.
       */

      const {
        error: resultUpdateError,
      } = await supabase
        .from('dare_participants')
        .update({
          result_posted: true,
          result_post_id: post.id,
        })
        .eq('id', participantId)
        .eq('user_id', user.id);

      if (resultUpdateError) {
        throw resultUpdateError;
      }

      /*
       * =================================================
       * SUCCESS
       * =================================================
       */

      Alert.alert(
        'Result Posted 🎉',
        'Your Dare result has been posted and is now eligible for the Response Pool.',
        [
          {
            text: 'Done',
            onPress: () => {
              router.replace('/(tabs)/dares');
            },
          },
        ],
      );
    } catch (error) {
      console.error(
        'Publish Dare result error:',
        error,
      );

      /*
       * =================================================
       * CLEANUP POST
       * =================================================
       *
       * If anything failed after post creation,
       * remove the incomplete post.
       *
       * We intentionally do not touch the existing
       * Dare Proof record/system here.
       */

      if (createdPostId) {
  try {
    await supabase
      .from('posts')
      .delete()
      .eq('id', createdPostId);
  } catch {
    // Best-effort cleanup only.
  }
}

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while posting your Dare result.';

      setErrorMessage(message);
    } finally {
      setPublishing(false);
      publishLock.current = false;
    }
  };

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

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
          onCropComplete={(
            croppedUri: string,
          ) => {
            setMedia({
              uri: croppedUri,
              kind: 'image',
              fileName:
                'dare-result.jpg',
              mimeType:
                'image/jpeg',
            });

            setCropVisible(false);
            setSelectedImageUri(null);
          }}
        />
      )}

      {/* =================================================
          HEADER
          ================================================= */}

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (!publishing) {
              router.back();
            }
          }}
          disabled={publishing}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>
            ‹ Back
          </Text>
        </Pressable>

        <Text
          style={styles.heading}
          accessibilityRole="header"
        >
          Post Result
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>

      <Text style={styles.subheading}>
        Share your completed Dare with the
        community.
      </Text>

      {/* =================================================
          RESULT INFO
          ================================================= */}

      <View style={styles.resultBanner}>
        <Text
          style={styles.resultTitle}
        >
          🎉 Dare Completed
        </Text>

        <Text
          style={styles.resultText}
        >
          Your Dare is already completed.
          Posting your result is optional.
          If you post it, it can appear in
          the Response Pool.
        </Text>
      </View>

      {/* =================================================
          CAPTION
          ================================================= */}

      <SectionHeader title="Caption" />

      <Input
        placeholder="Add a caption about your Dare..."
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={5}
      />

      {/* =================================================
          MEDIA
          ================================================= */}

      <SectionHeader title="Result Media" />

      {media ? (
        <View
          style={styles.previewContainer}
        >
          {media.kind === 'image' ? (
            <Image
              source={{
                uri: media.uri,
              }}
              style={styles.preview}
              resizeMode="cover"
            />
          ) : (
            <View
              style={
                styles.videoPreview
              }
            >
              <Text
                style={
                  styles.videoPreviewIcon
                }
              >
                🎥
              </Text>

              <Text
                style={
                  styles.videoPreviewTitle
                }
                numberOfLines={2}
              >
                {media.fileName ||
                  'Selected video'}
              </Text>

              <Text
                style={
                  styles.videoPreviewText
                }
              >
                Video selected and ready
                to upload.
              </Text>
            </View>
          )}

          <Pressable
            onPress={removeMedia}
            style={styles.removeButton}
            disabled={publishing}
            accessibilityRole="button"
            accessibilityLabel="Remove selected media"
          >
            <Text
              style={styles.removeText}
            >
              Remove{' '}
              {media.kind === 'video'
                ? 'Video'
                : 'Photo'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={styles.mediaWrap}
        >
          <Pressable
            onPress={pickPhoto}
            style={styles.mediaButton}
            disabled={publishing}
            accessibilityRole="button"
            accessibilityLabel="Choose a result photo"
          >
            <Text
              style={styles.mediaIcon}
            >
              📸
            </Text>

            <Text
              style={styles.mediaTitle}
            >
              Choose Photo
            </Text>

            <Text
              style={
                styles.mediaDescription
              }
            >
              Share a photo showing your
              completed Dare.
            </Text>
          </Pressable>

          <Pressable
            onPress={pickVideo}
            style={styles.mediaButton}
            disabled={publishing}
            accessibilityRole="button"
            accessibilityLabel="Choose a result video"
          >
            <Text
              style={styles.mediaIcon}
            >
              🎥
            </Text>

            <Text
              style={styles.mediaTitle}
            >
              Choose Video
            </Text>

            <Text
              style={
                styles.mediaDescription
              }
            >
              Share a video showing your
              completed Dare.
            </Text>
          </Pressable>
        </View>
      )}

      {/* =================================================
          ERROR
          ================================================= */}

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text
            style={styles.errorText}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* =================================================
          POST
          ================================================= */}

      <View
        style={styles.publishWrap}
      >
        <PrimaryButton
          label={
            publishing
              ? 'Posting Result...'
              : 'Post Dare Result'
          }
          onPress={publishResult}
          disabled={publishing}
        />

        {publishing && (
          <ActivityIndicator
            style={styles.loader}
            color={colors.accent}
          />
        )}
      </View>

      {/* =================================================
          SKIP
          ================================================= */}

      <Pressable
        onPress={skipResult}
        disabled={publishing}
        style={styles.skipButton}
        accessibilityRole="button"
        accessibilityLabel="Skip posting Dare result"
      >
        <Text
          style={styles.skipText}
        >
          Skip — Don't Post Result
        </Text>
      </Pressable>

      <Text
        style={styles.skipHint}
      >
        Skipping will not undo your Dare
        completion.
      </Text>
    </Screen>
  );
}

/*
 * =======================================================
 * FILE EXTENSION
 * =======================================================
 */

function getFileExtension(
  fileName?: string | null,
  mimeType?: string | null,
  kind?: MediaKind,
) {
  if (fileName?.includes('.')) {
    const parts =
      fileName.split('.');

    return parts[
      parts.length - 1
    ].toLowerCase();
  }

  if (
    mimeType === 'image/png'
  ) {
    return 'png';
  }

  if (
    mimeType === 'image/webp'
  ) {
    return 'webp';
  }

  if (
    mimeType === 'video/quicktime'
  ) {
    return 'mov';
  }

  if (
    mimeType === 'video/webm'
  ) {
    return 'webm';
  }

  if (
    mimeType === 'video/x-matroska'
  ) {
    return 'mkv';
  }

  if (
    kind === 'video' ||
    mimeType?.startsWith('video/')
  ) {
    return 'mp4';
  }

  return 'jpg';
}

/*
 * =======================================================
 * ERROR USER ID HELPER
 * =======================================================
 *
 * Cleanup needs the authenticated user id.
 * The actual post update/delete path is additionally
 * protected by Supabase RLS.
 *
 * This helper intentionally returns an empty string
 * when the error object does not carry user context.
 * In that case cleanup simply does nothing.
 */



/*
 * =======================================================
 * STYLES
 * =======================================================
 */

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginTop: spacing.lg,
  },

  back: {
    color: colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  heading: {
    color: colors.primaryText,
    fontFamily:
      fontFamily.headingBold,
    fontSize: fontSize.xl,
  },

  headerSpacer: {
    width: 50,
  },

  subheading: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom:
      spacing.lg,
  },

  resultBanner: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
    backgroundColor:
      colors.surfaceElevated,
    padding: spacing.md,
    marginBottom:
      spacing.md,
  },

  resultTitle: {
    color: colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginBottom: 4,
  },

  resultText: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },

  mediaWrap: {
    gap: spacing.md,
  },

  mediaButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor:
      colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent:
      'center',
    minHeight: 145,
  },

  mediaIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },

  mediaTitle: {
    color: colors.primaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.md,
    marginBottom: 4,
  },

  mediaDescription: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },

  previewContainer: {
    marginBottom:
      spacing.md,
  },

  preview: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    backgroundColor:
      colors.surface,
  },

  videoPreview: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    backgroundColor:
      colors.surface,
    alignItems: 'center',
    justifyContent:
      'center',
    padding: spacing.lg,
  },

  videoPreviewIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },

  videoPreviewTitle: {
    color: colors.primaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: 4,
  },

  videoPreviewText: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },

  removeButton: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical:
      spacing.sm,
  },

  removeText: {
    color: colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  errorBox: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    backgroundColor:
      colors.surface,
    padding: spacing.md,
  },

  errorText: {
    color: colors.danger,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  publishWrap: {
    marginTop: spacing.lg,
  },

  loader: {
    marginTop: spacing.sm,
  },

  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical:
      spacing.sm,
  },

  skipText: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  skipHint: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
});