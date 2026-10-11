import * as DocumentPicker from 'expo-document-picker';

import { File } from 'expo-file-system';

import * as ImagePicker from 'expo-image-picker';

import { router, useFocusEffect } from 'expo-router';

import { useCallback, useState } from 'react';

import {
  ActivityIndicator,

  Alert,

  Platform,

  Pressable,

  Image as RNImage,

  StyleSheet,

  Text,

  View,
} from 'react-native';

import { Chip } from '../../components/Chip';

import { Input } from '../../components/Input';

import { PrimaryButton } from '../../components/PrimaryButton';

import { Screen } from '../../components/Screen';

import { SectionHeader } from '../../components/SectionHeader';

import {
  colors,

  fontFamily,

  fontSize,

  spacing,
} from '../../constants/theme';

import { discoverCategories } from '../../data/mockDares';

import { supabase } from '../../lib/supabase';

const visibilities = [

  'Followers',

  'Global',

] as const;

const proofTypes = [

  'Text',

  'Photo / Post',

  'Video',

] as const;

const participationDurations = [

  {

    label: '1h',

    minutes: 60,

  },

  {

    label: '6h',

    minutes: 360,

  },

  {

    label: '12h',

    minutes: 720,

  },

  {

    label: '24h',

    minutes: 1440,

  },

  {

    label: '3d',

    minutes: 4320,

  },

  {

    label: '7d',

    minutes: 10080,

  },

] as const;

const votingDurations = [

  {

    label: '1h',

    minutes: 60,

  },

  {

    label: '6h',

    minutes: 360,

  },

  {

    label: '12h',

    minutes: 720,

  },

  {

    label: '24h',

    minutes: 1440,

  },

  {

    label: '3d',

    minutes: 4320,

  },

  {

    label: '7d',

    minutes: 10080,

  },

] as const;

type DareMedia = {

  uri: string;

  type: 'image' | 'video';

  fileName?: string | null;

  mimeType?: string | null;

};

type DareMusic = {

  uri: string;

  name: string;

  mimeType?: string | null;

};

export default function CreateScreen() {

  const [title, setTitle] = useState('');

  // Dare media/music selection. Uploads use the existing Cloudflare R2 flow.

  const [media, setMedia] = useState<DareMedia | null>(null);

  const [music, setMusic] = useState<DareMusic | null>(null);

  const [pickingMedia, setPickingMedia] = useState(false);

  const [pickingMusic, setPickingMusic] = useState(false);

  const [category, setCategory] = useState<string | null>(null);

  const [visibility, setVisibility] = useState<

    (typeof visibilities)[number] | null

  >(null);

  const [proofType, setProofType] = useState<

    (typeof proofTypes)[number] | null

  >(null);

  const [participationDuration, setParticipationDuration] = useState<

    (typeof participationDurations)[number] | null

  >(null);

  const [votingEnabled, setVotingEnabled] = useState(false);

  const [votingDuration, setVotingDuration] = useState<

    (typeof votingDurations)[number] | null

  >(null);

  const [publishing, setPublishing] = useState(false);

  // Reset the form whenever Create Dare receives focus.

  useFocusEffect(

    useCallback(() => {

      setTitle('');

      setMedia(null);

      setMusic(null);

      setPickingMedia(false);

      setPickingMusic(false);

      setCategory(null);

      setVisibility(null);

      setProofType(null);

      setParticipationDuration(null);

      setVotingEnabled(false);

      setVotingDuration(null);

      setPublishing(false);

    }, []),

  );

  const handlePickMedia = async () => {

    if (pickingMedia) {

      return;

    }

    setPickingMedia(true);

    try {

      const permission =

        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {

        Alert.alert(

          'Permission required',

          'Please allow photo and video access to attach media to your dare.',

        );

        return;

      }

      const result = await ImagePicker.launchImageLibraryAsync({

        mediaTypes: ['images', 'videos'],

        allowsEditing: true,

        aspect: [4, 5],

        quality: 0.9,

      });

      if (result.canceled || !result.assets?.length) {

        return;

      }

      const asset = result.assets[0];

      const isVideo = asset.type === 'video';

      setMedia({

        uri: asset.uri,

        type: isVideo ? 'video' : 'image',

        fileName: asset.fileName ?? null,

        mimeType: asset.mimeType ?? null,

      });

    } catch (error) {

      console.error('[CreateDare] Media picker error:', error);

      Alert.alert(

        'Could not select media',

        'Please try selecting the photo or video again.',

      );

    } finally {

      setPickingMedia(false);

    }

  };

  const handlePickMusic = async () => {

    if (pickingMusic) {

      return;

    }

    setPickingMusic(true);

    try {

      const result = await DocumentPicker.getDocumentAsync({

        type: 'audio/*',

        copyToCacheDirectory: true,

        multiple: false,

      });

      if (result.canceled || !result.assets?.length) {

        return;

      }

      const asset = result.assets[0];

      setMusic({

        uri: asset.uri,

        name: asset.name,

        mimeType: asset.mimeType ?? null,

      });

    } catch (error) {

      console.error('[CreateDare] Music picker error:', error);

      Alert.alert(

        'Could not select music',

        'Please try selecting the audio file again.',

      );

    } finally {

      setPickingMusic(false);

    }

  };

  const removeMedia = () => {

    setMedia(null);

  };

  const removeMusic = () => {

    setMusic(null);

  };

  const handlePublishDare = async () => {

    if (publishing) {

      return;

    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {

      Alert.alert(

        'Dare required',

        'Please describe your dare first.',

      );

      return;

    }

    if (!category) {

      Alert.alert(

        'Category required',

        'Please select a category.',

      );

      return;

    }

    if (!visibility) {

      Alert.alert(

        'Audience required',

        'Please select who can participate in this dare.',

      );

      return;

    }

    if (!proofType) {

      Alert.alert(

        'Proof required',

        'Please select how the dare must be proved.',

      );

      return;

    }

    if (!participationDuration) {

      Alert.alert(

        'Participation duration required',

        'Please select how long people can participate in this dare.',

      );

      return;

    }

    if (votingEnabled && !votingDuration) {

      Alert.alert(

        'Voting duration required',

        'Please select how long voting should remain open.',

      );

      return;

    }

    setPublishing(true);

    try {

      const {

        data: { user },

        error: userError,

      } = await supabase.auth.getUser();

      if (userError || !user) {

        throw new Error(

          'Please log in before publishing a dare.',

        );

      }

      const dbVisibility =

        visibility === 'Global'

          ? 'anyone'

          : 'followers';

            const dbProofType =

        proofType === 'Text'

          ? 'text'

          : proofType === 'Photo / Post'

            ? 'photo'

            : 'video';

      const participationMinutes =

        participationDuration.minutes;

      const votingMinutes = votingDuration?.minutes ?? null;

      const now = new Date();

      const participationEndsAt = new Date(

        now.getTime() +

          participationMinutes * 60 * 1000,

      );

      const votingStartsAt = votingEnabled

        ? participationEndsAt

        : null;

      const votingEndsAt =

        votingEnabled && votingMinutes

          ? new Date(

              participationEndsAt.getTime() +

                votingMinutes * 60 * 1000,

            )

          : null;

      /* =====================================================

      /* =====================================================

         GENERATE DARE ID

         ===================================================== */

      const dareId = generateUUID();



      let uploadedMediaKey: string | null = null;

      let uploadedMusicKey: string | null = null;



      /* =====================================================

         UPLOAD DARE MEDIA TO CLOUDFLARE R2

         Upload first so the R2 key can be written directly into

         the initial Supabase INSERT. This avoids the previous

         zero-row UPDATE / PGRST116 problem.

         ===================================================== */

      if (media) {

        uploadedMediaKey = await uploadDareAssetToR2({

          userId: user.id,

          dareId,

          uri: media.uri,

          fileName: media.fileName,

          mimeType: media.mimeType,

          kind: media.type,

          assetName: 'media',

        });

      }



      /* =====================================================

         UPLOAD MUSIC TO CLOUDFLARE R2

         ===================================================== */

      if (music) {

        uploadedMusicKey = await uploadDareAssetToR2({

          userId: user.id,

          dareId,

          uri: music.uri,

          fileName: music.name,

          mimeType: music.mimeType,

          kind: 'audio',

          assetName: 'music',

        });

      }



      /* =====================================================

         CREATE DARE RECORD WITH R2 KEYS

         The media/music keys are saved in the same INSERT.

         No follow-up UPDATE is required.

         ===================================================== */

      const { error } = await supabase

        .from('dares')

        .insert({

          id: dareId,

          creator_id: user.id,

          type: 'p2p',

          title: trimmedTitle,

          description: trimmedTitle,

          category,

          difficulty: 'medium',

          time_limit_minutes: 60,

          proof_type: dbProofType,

          visibility: dbVisibility,

          xp_value: 20,

          status: 'active',

          participation_duration_minutes:

            participationMinutes,

          participation_ends_at:

            participationEndsAt.toISOString(),

          voting_enabled: votingEnabled,

          voting_duration_minutes:

            votingEnabled

              ? votingMinutes

              : null,

          voting_starts_at:

            votingStartsAt?.toISOString() ?? null,

          voting_ends_at:

            votingEndsAt?.toISOString() ?? null,

          media_type: media?.type ?? null,

          media_url: uploadedMediaKey,

          music_url: uploadedMusicKey,

          music_title: music?.name ?? null,

          music_artist: null,

          music_start_seconds: null,

          music_end_seconds: null,

        });



      if (error) {

        throw error;

      }



      console.log('[CreateDare] Published with R2 media:', {

        dareId,

        mediaKey: uploadedMediaKey,

        musicKey: uploadedMusicKey,

      });



      router.replace({
        pathname: '/',
        params: { refresh: Date.now().toString() },
      });

    } catch (error) {

      console.error(

        '[CreateDare] Publish error:',

        error,

      );

      Alert.alert(

        'Could not publish dare',

        error instanceof Error

          ? error.message

          : 'Something went wrong while publishing.',

      );

    } finally {

      setPublishing(false);

    }

  };

  return (

    <Screen>

      <Text

        style={styles.heading}

        accessibilityRole="header"

      >

        Create a Dare

      </Text>

      <Text style={styles.subheading}>

        Create a challenge and publish it to DareShot.

      </Text>

      <SectionHeader title="What's the dare?" />

      <Input

        placeholder="Describe the dare..."

        multiline

        numberOfLines={4}

        value={title}

        onChangeText={setTitle}

      />

      <SectionHeader title="Dare Media" />

      <Text style={styles.helperText}>

        Optional. Add a photo or video that will be used with your dare.

      </Text>

      {media ? (

        <View style={styles.mediaPreviewCard}>

          {media.type === 'image' ? (

            <RNImage

              source={{ uri: media.uri }}

              style={styles.mediaPreview}

              resizeMode="cover"

            />

          ) : (

            <View style={styles.videoPlaceholder}>

              <Text style={styles.videoIcon}>▶</Text>

              <Text style={styles.videoLabel}>Video selected</Text>

              <Text style={styles.videoFileName} numberOfLines={1}>

                {media.fileName ?? 'Selected video'}

              </Text>

            </View>

          )}

          <Pressable

            onPress={removeMedia}

            style={styles.removeMediaButton}

            accessibilityRole="button"

            accessibilityLabel="Remove dare media"

          >

            <Text style={styles.removeMediaText}>×</Text>

          </Pressable>

        </View>

      ) : (

        <Pressable

          onPress={handlePickMedia}

          disabled={pickingMedia}

          style={({ pressed }) => [

            styles.mediaPicker,

            pressed && styles.mediaPickerPressed,

          ]}

          accessibilityRole="button"

          accessibilityLabel="Add photo or video"

        >

          <Text style={styles.outlineIcon}>＋</Text>

          <View style={styles.mediaPickerText}>

            <Text style={styles.mediaPickerTitle}>

              {pickingMedia ? 'Opening gallery...' : 'Add Photo / Video'}

            </Text>

            <Text style={styles.mediaPickerSubtitle}>

              Optional • Photo or short video

            </Text>

          </View>

          <Text style={styles.mediaPickerArrow}>›</Text>

        </Pressable>

      )}

      <SectionHeader title="Music" />

      <Text style={styles.helperText}>

        Optional. Add an audio track to use with the dare media.

      </Text>

      {music ? (

        <View style={styles.musicRow}>

          <View style={styles.musicIconBox}>

            <Text style={styles.musicIcon}>♫</Text>

          </View>

          <View style={styles.musicInfo}>

            <Text style={styles.musicTitle} numberOfLines={1}>

              {music.name}

            </Text>

            <Text style={styles.musicSubtitle}>Audio selected</Text>

          </View>

          <Pressable

            onPress={removeMusic}

            style={styles.removeMusicButton}

            accessibilityRole="button"

            accessibilityLabel="Remove music"

          >

            <Text style={styles.removeMusicText}>×</Text>

          </Pressable>

        </View>

      ) : (

        <Pressable

          onPress={handlePickMusic}

          disabled={pickingMusic}

          style={({ pressed }) => [

            styles.musicPicker,

            pressed && styles.mediaPickerPressed,

          ]}

          accessibilityRole="button"

          accessibilityLabel="Add music"

        >

          <Text style={styles.outlineIcon}>♫</Text>

          <View style={styles.mediaPickerText}>

            <Text style={styles.mediaPickerTitle}>

              {pickingMusic ? 'Opening files...' : 'Add Music'}

            </Text>

            <Text style={styles.mediaPickerSubtitle}>

              Optional • Choose an audio file

            </Text>

          </View>

          <Text style={styles.mediaPickerArrow}>›</Text>

        </Pressable>

      )}

      <Text style={styles.mediaFootnote}>

        Music must be content you have the right to use. Music upload and

        Supabase storage saving will be connected in the next step.

      </Text>

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

      <SectionHeader title="Proof Required" />

      <Text style={styles.helperText}>

        Choose how the person completing this dare must prove it.

      </Text>

      <View style={styles.chipWrap}>

        {proofTypes.map((item) => (

          <SelectableChip

            key={item}

            label={item}

            selected={proofType === item}

            onPress={() => setProofType(item)}

          />

        ))}

      </View>

      <SectionHeader title="Audience" />

      <Text style={styles.helperText}>

        Choose who can participate in this dare.

      </Text>

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

      <SectionHeader title="Participation Duration" />

      <Text style={styles.helperText}>

        New participants can join only while this period is open.

      </Text>

      <View style={styles.chipWrap}>

        {participationDurations.map((item) => (

          <SelectableChip

            key={item.label}

            label={item.label}

            selected={

              participationDuration?.minutes ===

              item.minutes

            }

            onPress={() =>

              setParticipationDuration(item)

            }

          />

        ))}

      </View>

      <SectionHeader title="Voting" />

      <Text style={styles.helperText}>

        Allow the community to vote on posted dare results.

      </Text>

      <View style={styles.chipWrap}>

        <SelectableChip

          label="OFF"

          selected={!votingEnabled}

          onPress={() => {

            setVotingEnabled(false);

            setVotingDuration(null);

          }}

        />

        <SelectableChip

          label="ON"

          selected={votingEnabled}

          onPress={() => setVotingEnabled(true)}

        />

      </View>

      {votingEnabled ? (

        <>

          <SectionHeader title="Voting Duration" />

          <Text style={styles.helperText}>

            Voting starts when the participation period ends.

          </Text>

          <View style={styles.chipWrap}>

            {votingDurations.map((item) => (

              <SelectableChip

                key={item.label}

                label={item.label}

                selected={

                  votingDuration?.minutes ===

                  item.minutes

                }

                onPress={() =>

                  setVotingDuration(item)

                }

              />

            ))}

          </View>

        </>

      ) : null}

      <View style={styles.ctaWrap}>

        <PrimaryButton

          label={

            publishing

              ? 'Publishing...'

              : 'Publish Dare'

          }

          onPress={handlePublishDare}

          disabled={publishing}

        />

        {publishing ? (

          <ActivityIndicator

            size="small"

            color={colors.accent}

          />

        ) : (

          <Text style={styles.note}>

            Your dare will appear on Home.

          </Text>

        )}

      </View>

    </Screen>

  );

}

/* =======================================================

 * DARESHOT R2 UPLOAD HELPER

 * ======================================================= */

function generateUUID(): string {

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(

    /[xy]/g,

    (char) => {

      const random = Math.floor(Math.random() * 16);



      const value =

        char === 'x'

          ? random

          : (random & 0x3) | 0x8;



      return value.toString(16);

    },

  );

}



async function uploadDareAssetToR2({

  userId,

  dareId,

  uri,

  fileName,

  mimeType,

  kind,

  assetName,

}: {

  userId: string;

  dareId: string;

  uri: string;

  fileName?: string | null;

  mimeType?: string | null;

  kind: 'image' | 'video' | 'audio';

  assetName: 'media' | 'music';

}): Promise<string> {

  let arrayBuffer: ArrayBuffer;

  if (Platform.OS === 'web') {

    const response = await fetch(uri);

    if (!response.ok) {

      throw new Error(

        kind === 'audio'

          ? 'Could not read the selected music file.'

          : kind === 'video'

            ? 'Could not read the selected video.'

            : 'Could not read the selected photo.',

      );

    }

    arrayBuffer = await response.arrayBuffer();

  } else {

  if (kind === 'audio') {

    const response = await fetch(uri);

    if (!response.ok) {

      throw new Error('Could not read the selected music file.');

    }

    arrayBuffer = await response.arrayBuffer();

  } else {

    const file = new File(uri);

    if (!file.exists) {

      throw new Error(

        kind === 'video'

          ? 'Selected video file could not be found.'

          : 'Selected photo file could not be found.',

      );

    }

    arrayBuffer = await file.arrayBuffer();

  }

}

  const extension = getDareFileExtension(

    fileName,

    mimeType,

    kind,

  );

  const storagePath =

    `${userId}/dares/${dareId}/${assetName}.${extension}`;

  const contentType =

    mimeType ||

    (kind === 'audio'

      ? 'audio/mpeg'

      : kind === 'video'

        ? 'video/mp4'

        : 'image/jpeg');

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

  const uploadResponse = await fetch(

    uploadUrlData.uploadUrl,

    {

      method: 'PUT',

      headers: {

        'Content-Type': contentType,

      },

      body: arrayBuffer,

    },

  );

  if (!uploadResponse.ok) {

    throw new Error(

      `R2 upload failed: ${uploadResponse.status}`,

    );

  }

  return uploadUrlData.key;

}

function getDareFileExtension(

  fileName?: string | null,

  mimeType?: string | null,

  kind?: 'image' | 'video' | 'audio',

): string {

  if (fileName?.includes('.')) {

    const parts = fileName.split('.');

    return parts[parts.length - 1].toLowerCase();

  }

  if (mimeType === 'image/png') {

    return 'png';

  }

  if (mimeType === 'image/webp') {

    return 'webp';

  }

  if (mimeType === 'video/quicktime') {

    return 'mov';

  }

  if (mimeType === 'video/webm') {

    return 'webm';

  }

  if (mimeType === 'video/x-matroska') {

    return 'mkv';

  }

  if (mimeType === 'audio/mpeg') {

    return 'mp3';

  }

  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') {

    return 'm4a';

  }

  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {

    return 'wav';

  }

  if (mimeType === 'audio/ogg') {

    return 'ogg';

  }

  if (kind === 'audio' || mimeType?.startsWith('audio/')) {

    return 'mp3';

  }

  if (kind === 'video' || mimeType?.startsWith('video/')) {

    return 'mp4';

  }

  return 'jpg';

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

      <Chip

        label={label}

        variant={

          selected ? 'accent' : 'neutral'

        }

      />

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

  mediaPicker: {

    flexDirection: 'row',

    alignItems: 'center',

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 16,

    paddingHorizontal: spacing.md,

    paddingVertical: spacing.md,

    backgroundColor: colors.surface,

  },

  musicPicker: {

    flexDirection: 'row',

    alignItems: 'center',

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 16,

    paddingHorizontal: spacing.md,

    paddingVertical: spacing.md,

    backgroundColor: colors.surface,

  },

  mediaPickerPressed: {

    opacity: 0.7,

  },

  outlineIcon: {

    width: 42,

    height: 42,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 12,

    color: colors.primaryText,

    fontSize: 24,

    lineHeight: 38,

    textAlign: 'center',

  },

  mediaPickerText: {

    flex: 1,

    marginLeft: spacing.md,

  },

  mediaPickerTitle: {

    color: colors.primaryText,

    fontFamily: fontFamily.bodyMedium,

    fontSize: fontSize.md,

  },

  mediaPickerSubtitle: {

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.xs,

    marginTop: 3,

  },

  mediaPickerArrow: {

    color: colors.secondaryText,

    fontSize: 28,

    marginLeft: spacing.sm,

  },

  mediaPreviewCard: {

    position: 'relative',

    overflow: 'hidden',

    borderRadius: 16,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

  },

  mediaPreview: {

    width: '100%',

    height: 230,

  },

  videoPlaceholder: {

    height: 230,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: spacing.lg,

    backgroundColor: colors.background,

  },

  videoIcon: {

    color: colors.primaryText,

    fontSize: 30,

  },

  videoLabel: {

    color: colors.primaryText,

    fontFamily: fontFamily.bodyMedium,

    fontSize: fontSize.md,

    marginTop: spacing.sm,

  },

  videoFileName: {

    maxWidth: '80%',

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.xs,

    marginTop: 4,

  },

  removeMediaButton: {

    position: 'absolute',

    top: spacing.sm,

    right: spacing.sm,

    width: 34,

    height: 34,

    borderRadius: 17,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: 'rgba(0,0,0,0.55)',

    alignItems: 'center',

    justifyContent: 'center',

  },

  removeMediaText: {

    color: '#fff',

    fontSize: 25,

    lineHeight: 27,

  },

  musicRow: {

    flexDirection: 'row',

    alignItems: 'center',

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 16,

    padding: spacing.md,

    backgroundColor: colors.surface,

  },

  musicIconBox: {

    width: 42,

    height: 42,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: 'center',

    justifyContent: 'center',

  },

  musicIcon: {

    color: colors.primaryText,

    fontSize: 22,

  },

  musicInfo: {

    flex: 1,

    marginLeft: spacing.md,

  },

  musicTitle: {

    color: colors.primaryText,

    fontFamily: fontFamily.bodyMedium,

    fontSize: fontSize.sm,

  },

  musicSubtitle: {

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.xs,

    marginTop: 3,

  },

  removeMusicButton: {

    width: 34,

    height: 34,

    borderRadius: 17,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: 'center',

    justifyContent: 'center',

    marginLeft: spacing.sm,

  },

  removeMusicText: {

    color: colors.primaryText,

    fontSize: 23,

    lineHeight: 25,

  },

  mediaFootnote: {

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.xs,

    lineHeight: 17,

    marginTop: spacing.sm,

    marginBottom: spacing.sm,

  },

  helperText: {

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.xs,

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

  note: {

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.xs,

  },

});
