import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import { ImageCropper } from '../components/ImageCropper';

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

type Visibility =
  (typeof visibilityOptions)[number]['value'];

type MediaKind = 'image' | 'video';

type SelectedMedia = {
  uri: string;
  kind: MediaKind;
  fileName?: string | null;
  mimeType?: string | null;
};

type DareProofType = 'photo' | 'video';

export default function CreatePostScreen() {
  /*
   * =====================================================
   * DARE PROOF MODE
   * =====================================================
   *
   * Normal Post:
   * /create-post
   *
   * Photo Dare Proof:
   * /create-post?dareParticipantId=XXXX&dareProofType=photo
   *
   * Video Dare Proof:
   * /create-post?dareParticipantId=XXXX&dareProofType=video
   */

  const {
    dareParticipantId,
    dareProofType,
  } =
    useLocalSearchParams<{
      dareParticipantId?: string;
      dareProofType?: string;
    }>();

  const isDareProof =
    typeof dareParticipantId === 'string' &&
    dareParticipantId.length > 0;

  const normalizedDareProofType: DareProofType =
    dareProofType === 'video'
      ? 'video'
      : 'photo';

  const [content, setContent] =
    useState('');

  const [visibility, setVisibility] =
    useState<Visibility>('anyone');

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
        'Pick photo error:',
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
          'dareme-video.mp4',
        mimeType:
          asset.mimeType ??
          'video/mp4',
      });
    } catch (error) {
      console.error(
        'Pick video error:',
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
    setMedia(null);
  };

  /*
   * =====================================================
   * PUBLISH POST
   * =====================================================
   */

  const publishPost = async () => {
    if (
      publishLock.current ||
      publishing
    ) {
      return;
    }

    const trimmedContent =
      content.trim();

    /*
     * ===================================================
     * VALIDATION
     * ===================================================
     *
     * Normal Post:
     * text OR photo OR video
     *
     * Photo Dare Proof:
     * photo required
     *
     * Video Dare Proof:
     * video required
     *
     * Caption is optional.
     */

    if (isDareProof) {
      if (
        normalizedDareProofType === 'photo' &&
        (!media || media.kind !== 'image')
      ) {
        setErrorMessage(
          'Please choose a photo for this Dare proof.',
        );
        return;
      }

      if (
        normalizedDareProofType === 'video' &&
        (!media || media.kind !== 'video')
      ) {
        setErrorMessage(
          'Please choose a video for this Dare proof.',
        );
        return;
      }
    }

    if (
      !isDareProof &&
      !trimmedContent &&
      !media
    ) {
      setErrorMessage(
        'Write something or choose a photo or video before publishing.',
      );
      return;
    }

    publishLock.current = true;
    setPublishing(true);
    setErrorMessage('');

    let createdPostId: string | null =
      null;

    let uploadedStoragePath:
      | string
      | null = null;

    let createdProofId:
      | string
      | null = null;

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
          'Please log in before creating a post.',
        );
      }

      /*
       * =================================================
       * POST TYPE
       * =================================================
       */

      const postType = !media
        ? 'text'
        : media.kind === 'video'
          ? 'video'
          : 'photo';

      const mediaType = media
        ? media.kind
        : null;

      /*
       * =================================================
       * CREATE POST RECORD
       * =================================================
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
          media_type: mediaType,

          /*
           * Dare proof posts are public.
           */
          visibility: isDareProof
            ? 'anyone'
            : visibility,

          status: 'active',
        })
        .select('id')
        .single();

      if (
        postError ||
        !post
      ) {
        throw (
          postError ??
          new Error(
            'Could not create the post.',
          )
        );
      }

      createdPostId = post.id;

      /*
       * =================================================
       * UPLOAD MEDIA
       * =================================================
       */

      if (media) {
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

        const {
          error: uploadError,
        } = await supabase.storage
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

        uploadedStoragePath =
          storagePath;

        /*
         * SAVE STORAGE PATH ON POST
         */

        const {
          error: updateError,
        } = await supabase
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
       * =================================================
       * DARE PROOF LINK
       * =================================================
       *
       * Current dare_proofs schema:
       * participant_id
       * type
       * storage_path
       *
       * The proof points to the DareMe Post.
       */

      if (
        isDareProof &&
        dareParticipantId
      ) {
        const {
          data: proof,
          error: proofError,
        } = await supabase
          .from('dare_proofs')
          .insert({
            participant_id:
              dareParticipantId,

            type:
              normalizedDareProofType,

            /*
             * The Dare proof is linked
             * to the created DareMe Post.
             */
            storage_path:
              `post:${post.id}`,

            text_content:
              trimmedContent || null,
          })
          .select('id')
          .single();

        if (
          proofError ||
          !proof
        ) {
          throw (
            proofError ??
            new Error(
              'Could not create Dare proof.',
            )
          );
        }

        createdProofId =
          proof.id;

        /*
         * =================================================
         * SUBMIT DARE
         * =================================================
         */

        const {
          data: transitionData,
          error: transitionError,
        } =
          await supabase.functions.invoke(
            'transition-dare',
            {
              body: {
                participant_id:
                  dareParticipantId,
                action: 'submit',
              },
            },
          );

        if (transitionError) {
          throw transitionError;
        }

        if (
          !transitionData?.success
        ) {
          throw new Error(
            transitionData?.error ||
              'Could not submit Dare proof.',
          );
        }

        /*
         * Proof submission succeeded.
         */

        router.replace(
          '/(tabs)/dares',
        );

        return;
      }

      /*
       * =================================================
       * NORMAL POST
       * =================================================
       */

      router.replace(
        '/(tabs)/discover',
      );
    } catch (error) {
      console.error(
        'Publish post error:',
        error,
      );

      /*
       * =================================================
       * CLEAN UP MEDIA
       * =================================================
       */

      if (uploadedStoragePath) {
        await supabase.storage
          .from('post-media')
          .remove([
            uploadedStoragePath,
          ]);
      }

      /*
       * =================================================
       * CLEAN UP PROOF
       * =================================================
       */

      if (createdProofId) {
        await supabase
          .from('dare_proofs')
          .delete()
          .eq(
            'id',
            createdProofId,
          );
      }

      /*
       * =================================================
       * CLEAN UP POST
       * =================================================
       */

      if (createdPostId) {
        await supabase
          .from('posts')
          .delete()
          .eq(
            'id',
            createdPostId,
          );
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

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <Screen>

      {/* =================================================
          IMAGE CROPPER
          ================================================= */}

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
                'dareme-post.jpg',
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
          onPress={() =>
            router.back()
          }
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
          {isDareProof
            ? 'Dare Proof'
            : 'Create Post'}
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>

      <Text style={styles.subheading}>
        {isDareProof
          ? normalizedDareProofType === 'video'
            ? 'Create a Video showing your Dare completion.'
            : 'Create a Post showing your Dare completion.'
          : 'Share something with the DareMe community.'}
      </Text>

      {/* =================================================
          DARE PROOF BANNER
          ================================================= */}

      {isDareProof && (
        <View style={styles.dareProofBanner}>

          <Text
            style={styles.dareProofTitle}
          >
            {normalizedDareProofType ===
            'video'
              ? '🎥 Video Dare'
              : '📸 Photo / Post Dare'}
          </Text>

          <Text
            style={styles.dareProofText}
          >
            {normalizedDareProofType ===
            'video'
              ? 'Upload a video as proof. Only video proof is allowed for this Dare.'
              : 'Your Post will be attached to this Dare as proof.'}
          </Text>

        </View>
      )}

      {/* =================================================
          CAPTION
          ================================================= */}

      <SectionHeader title="Caption" />

      <Input
        placeholder={
          isDareProof
            ? normalizedDareProofType ===
              'video'
              ? 'Add a caption about your Dare...'
              : 'Add a caption about your Dare...'
            : "What's happening?"
        }
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={5}
      />

      {/* =================================================
          MEDIA
          ================================================= */}

      <SectionHeader
        title={
          isDareProof
            ? normalizedDareProofType ===
              'video'
              ? 'Proof Video'
              : 'Proof Photo'
            : 'Media'
        }
      />

      {/* =================================================
          SELECTED MEDIA
          ================================================= */}

      {media ? (
        <View
          style={
            styles.previewContainer
          }
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
              style={styles.videoPreview}
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
                Video selected and ready to upload.
              </Text>
            </View>
          )}

          <Pressable
            onPress={removeMedia}
            style={styles.removeButton}
            accessibilityRole="button"
            accessibilityLabel="Remove selected media"
          >
            <Text
              style={styles.removeText}
            >
              Remove {media.kind === 'video'
                ? 'Video'
                : 'Photo'}
            </Text>
          </Pressable>

        </View>
      ) : (
        <>

          {/* =============================================
              DARE PROOF MODE
              ============================================= */}

          {isDareProof ? (
            <Pressable
              onPress={
                normalizedDareProofType ===
                'video'
                  ? pickVideo
                  : pickPhoto
              }
              style={
                styles.mediaButton
              }
              accessibilityRole="button"
              accessibilityLabel={
                normalizedDareProofType ===
                'video'
                  ? 'Choose a video'
                  : 'Choose a photo'
              }
            >
              <Text
                style={styles.mediaIcon}
              >
                {normalizedDareProofType ===
                'video'
                  ? '🎥'
                  : '📸'}
              </Text>

              <Text
                style={styles.mediaTitle}
              >
                {normalizedDareProofType ===
                'video'
                  ? 'Choose Proof Video'
                  : 'Choose Proof Photo'}
              </Text>

              <Text
                style={
                  styles.mediaDescription
                }
              >
                {normalizedDareProofType ===
                'video'
                  ? 'Select a video from your device.'
                  : 'Select a photo from your device.'}
              </Text>
            </Pressable>
          ) : (
            /* ===========================================
               NORMAL POST MODE
               =========================================== */

            <View
              style={styles.normalMediaWrap}
            >

              <Pressable
                onPress={pickPhoto}
                style={
                  styles.mediaButton
                }
                accessibilityRole="button"
                accessibilityLabel="Choose a photo"
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
                  Select a photo from your device.
                </Text>
              </Pressable>

              <Pressable
                onPress={pickVideo}
                style={
                  styles.mediaButton
                }
                accessibilityRole="button"
                accessibilityLabel="Choose a video"
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
                  Select a video from your device.
                </Text>
              </Pressable>

            </View>
          )}

        </>
      )}

      {/* =================================================
          VISIBILITY
          ================================================= */}

      {!isDareProof && (
        <>
          <SectionHeader
            title="Who can see this?"
          />

          <View
            style={
              styles.visibilityWrap
            }
          >
            {visibilityOptions.map(
              (option) => {
                const selected =
                  visibility ===
                  option.value;

                return (
                  <Pressable
                    key={
                      option.value
                    }
                    onPress={() =>
                      setVisibility(
                        option.value,
                      )
                    }
                    style={[
                      styles.visibilityChip,
                      selected &&
                        styles.visibilityChipSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                    }}
                  >
                    <Text
                      style={[
                        styles.visibilityText,
                        selected &&
                          styles.visibilityTextSelected,
                      ]}
                    >
                      {
                        option.label
                      }
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>
        </>
      )}

      {/* =================================================
          ERROR
          ================================================= */}

      {errorMessage ? (
        <View
          style={styles.errorBox}
        >
          <Text
            style={styles.errorText}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* =================================================
          PUBLISH
          ================================================= */}

      <View
        style={styles.publishWrap}
      >
        <PrimaryButton
          label={
            publishing
              ? 'Publishing...'
              : isDareProof
                ? 'Submit Dare Proof'
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

  dareProofBanner: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
    backgroundColor:
      colors.surfaceElevated,
    padding: spacing.md,
    marginBottom:
      spacing.md,
  },

  dareProofTitle: {
    color: colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginBottom: 4,
  },

  dareProofText: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
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
    borderWidth: 1,
    borderColor:
      colors.border,
  },

  videoPreviewIcon: {
    fontSize: 52,
    marginBottom:
      spacing.md,
  },

  videoPreviewTitle: {
    color: colors.primaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom:
      spacing.xs,
  },

  videoPreviewText: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  removeButton: {
    alignSelf:
      'flex-end',
    marginTop:
      spacing.sm,
  },

  removeText: {
    color: colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  normalMediaWrap: {
    gap: spacing.sm,
  },

  mediaButton: {
    minHeight: 150,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 16,
    backgroundColor:
      colors.surface,
    alignItems: 'center',
    justifyContent:
      'center',
    padding: spacing.lg,
    marginBottom:
      spacing.md,
  },

  mediaIcon: {
    fontSize: 32,
    marginBottom:
      spacing.sm,
  },

  mediaTitle: {
    color: colors.primaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.md,
  },

  mediaDescription: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  visibilityWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  visibilityChip: {
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 999,
    paddingHorizontal:
      spacing.md,
    paddingVertical:
      spacing.sm,
  },

  visibilityChipSelected: {
    borderColor:
      colors.accent,
    backgroundColor:
      colors.accent,
  },

  visibilityText: {
    color: colors.secondaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  visibilityTextSelected: {
    color: colors.background,
  },

  errorBox: {
    marginTop:
      spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 12,
    backgroundColor:
      colors.surface,
  },

  errorText: {
    color: colors.primaryText,
    fontFamily:
      fontFamily.body,
    fontSize: fontSize.sm,
  },

  publishWrap: {
    marginTop:
      spacing.xxl,
    marginBottom:
      spacing.xl,
  },

  loader: {
    marginTop:
      spacing.sm,
  },
});