import * as FileSystem from 'expo-file-system/legacy';

import { Ionicons } from '@expo/vector-icons';

import {
    AudioModule,

    RecordingPresets,

    setAudioModeAsync,

    useAudioRecorder,
} from 'expo-audio';

import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';

import { router } from 'expo-router';

import { useEffect, useRef, useState } from 'react';

import {
    ActivityIndicator,

    Alert,

    Pressable,

    ScrollView,

    StyleSheet,

    Text,

    View,
} from 'react-native';


import { colors } from '../constants/theme';

import { getLocalFileSize } from '../lib/fileSize';

import { toFunctionError } from '../lib/functionError';

import { supabase } from '../lib/supabase';

type ShotType = 'voice' | 'video' | 'mystery';

type ResponseMediaType = 'voice' | 'video';

type Profile = {

  id: string;

  display_name: string | null;

  username: string | null;

  avatar_url: string | null;

};

type Shot = {

  id: string;

  sender_id: string;

  receiver_id: string;

  shot_type: ShotType;

  status: string;

  created_at: string;

};

type CloudflareUploadResponse = {

  success?: boolean;

  uploadURL?: string;

  assetId?: string;

  error?: string;

};

type R2UploadResponse = {

  success?: boolean;

  uploadUrl?: string;

  key?: string;

  error?: string;

};

const MAX_RECORDING_SECONDS = 120;

const shotOptions: Array<{

  type: ShotType;

  icon: 'mic-outline' | 'videocam-outline' | 'dice-outline';

  title: string;

  description: string;

}> = [

  {

    type: 'voice',

    icon: 'mic-outline',

    title: 'Voice Shot',

    description: 'Send a personal voice challenge.',

  },

  {

    type: 'video',

    icon: 'videocam-outline',

    title: 'Video Shot',

    description: 'Send a personal video challenge.',

  },

  {

    type: 'mystery',

    icon: 'dice-outline',

    title: 'Mystery Shot',

    description: 'Hide the challenge until it is accepted.',

  },

];

export type DareShotPanelProps = {
  targetUserId: string;
  shotId?: string | null;
  onClose: () => void;
};

export function DareShotPanel({ targetUserId, shotId, onClose }: DareShotPanelProps) {

  const existingShotId = shotId ?? '';


  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [selectedType, setSelectedType] = useState<ShotType>('voice');

  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);

  const [processing, setProcessing] = useState(false);

  const [shot, setShot] = useState<Shot | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [recordingMode, setRecordingMode] = useState<ResponseMediaType | null>(null);

  const [recording, setRecording] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [recordSeconds, setRecordSeconds] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');

  const cameraRef = useRef<CameraView | null>(null);

  const recordStartedAtRef = useRef<number | null>(null);

  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [microphonePermission, requestMicrophonePermission] =

    useMicrophonePermissions();

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {

    void loadScreen();

    return () => {

      if (recordTimerRef.current) {

        clearInterval(recordTimerRef.current);

      }

    };

  }, [targetUserId, existingShotId]);

  useEffect(() => {

    if (!recording) return;

    recordTimerRef.current = setInterval(() => {

      const startedAt = recordStartedAtRef.current;

      if (!startedAt) return;

      const seconds = Math.min(

        MAX_RECORDING_SECONDS,

        Math.floor((Date.now() - startedAt) / 1000),

      );

      setRecordSeconds(seconds);

      if (seconds >= MAX_RECORDING_SECONDS && recordingMode === 'voice') {

        void stopVoiceRecording();

      }

    }, 250);

    return () => {

      if (recordTimerRef.current) {

        clearInterval(recordTimerRef.current);

        recordTimerRef.current = null;

      }

    };

  }, [recording, recordingMode]);

  const loadScreen = async () => {

    try {

      setLoading(true);

      setError(null);

      const {

        data: { user },

        error: authError,

      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {

        router.replace('/(auth)/login' as any);

        return;

      }

      setCurrentUserId(user.id);

      if (!targetUserId && !existingShotId) {

        throw new Error('No Shot recipient was selected.');

      }

      if (targetUserId) {

        if (targetUserId === user.id) {

          throw new Error('You cannot start a DareShot with yourself.');

        }

        const { data: profileData, error: profileError } = await supabase

          .from('profiles')

          .select('id, display_name, username, avatar_url')

          .eq('id', targetUserId)

          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {

          throw new Error('User profile could not be found.');

        }

        setProfile(profileData as Profile);

        const { data: blocked } = await supabase.rpc(

          'is_blocked_between',

          {

            p_user_a: user.id,

            p_user_b: targetUserId,

          },

        );

        if (blocked) {

          throw new Error(

            'DareShot is unavailable between these users.',

          );

        }

      }

      if (existingShotId) {

        await loadExistingShot(existingShotId, user.id);

      }

    } catch (err) {

      console.error('[Private Shot] Load failed:', err);

      setError(

        err instanceof Error ? err.message : 'Could not load DareShot.',

      );

    } finally {

      setLoading(false);

    }

  };

  const loadExistingShot = async (shotId: string, userId: string) => {

    const { data, error: shotError } = await supabase

      .from('private_shots')

      .select(

        'id, sender_id, receiver_id, shot_type, status, created_at',

      )

      .eq('id', shotId)

      .maybeSingle();

    if (shotError) throw shotError;

    if (!data) {

      throw new Error('DareShot could not be found.');

    }

    if (data.sender_id !== userId && data.receiver_id !== userId) {

      throw new Error('You do not have access to this DareShot.');

    }

    setShot(data as Shot);

    const otherUserId =

      data.sender_id === userId ? data.receiver_id : data.sender_id;

    if (!profile && otherUserId) {

      const { data: profileData } = await supabase

        .from('profiles')

        .select('id, display_name, username, avatar_url')

        .eq('id', otherUserId)

        .maybeSingle();

      if (profileData) {

        setProfile(profileData as Profile);

      }

    }

    if (

      data.shot_type === 'voice' ||

      data.shot_type === 'video' ||

      data.shot_type === 'mystery'

    ) {

      setSelectedType(data.shot_type as ShotType);

    }

  };

  const startShot = async () => {

    if (!currentUserId) return;

    if (!targetUserId) {

      Alert.alert(

        'Recipient required',

        'Select a person from the chat first.',

      );

      return;

    }

    try {

      setCreating(true);

      setError(null);

      const { data: blocked } = await supabase.rpc(

        'is_blocked_between',

        {

          p_user_a: currentUserId,

          p_user_b: targetUserId,

        },

      );

      if (blocked) {

        throw new Error(

          'You cannot start a DareShot with this user.',

        );

      }

      const { data, error: insertError } = await supabase

        .from('private_shots')

        .insert({

          sender_id: currentUserId,

          receiver_id: targetUserId,

          shot_type: selectedType,

          status: 'sent',

        })

        .select(

          'id, sender_id, receiver_id, shot_type, status, created_at',

        )

        .single();

      if (insertError) throw insertError;

      setShot(data as Shot);

      Alert.alert(

        'Shot Sent',

        'Your Private Shot has been sent.',

        [

          {

            text: 'Back to Chat',

            onPress: onClose,

          },

        ],

      );

    } catch (err) {

      console.error('[Private Shot] Create failed:', err);

      setError(

        err instanceof Error

          ? err.message

          : 'Could not start DareShot.',

      );

    } finally {

      setCreating(false);

    }

  };

  const updateShotStatus = async (

    nextStatus: 'accepted' | 'rejected',

  ) => {

    if (!shot || !currentUserId) return;

    if (shot.receiver_id !== currentUserId) return;

    try {

      setProcessing(true);

      setError(null);

      const { data: blocked } = await supabase.rpc(

        'is_blocked_between',

        {

          p_user_a: shot.sender_id,

          p_user_b: shot.receiver_id,

        },

      );

      if (blocked) {

        throw new Error(

          'This DareShot is no longer available.',

        );

      }

      const { data, error: updateError } = await supabase

        .from('private_shots')

        .update({ status: nextStatus })

        .eq('id', shot.id)

        .eq('receiver_id', currentUserId)

        .eq('status', 'sent')

        .select(

          'id, sender_id, receiver_id, shot_type, status, created_at',

        )

        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {

        throw new Error('This Shot is no longer pending.');

      }

      setShot(data as Shot);

    } catch (err) {

      console.error('[Private Shot] Status update failed:', err);

      setError(

        err instanceof Error

          ? err.message

          : 'Could not update Private Shot.',

      );

    } finally {

      setProcessing(false);

    }

  };

  const requestRecordingPermissions = async (

    mode: ResponseMediaType,

  ) => {

    if (mode === 'video') {

      let cameraGranted = cameraPermission?.granted ?? false;

      let microphoneGranted = microphonePermission?.granted ?? false;

      if (!cameraGranted) {

        const result = await requestCameraPermission();

        cameraGranted = result.granted;

      }

      if (!microphoneGranted) {

        const result = await requestMicrophonePermission();

        microphoneGranted = result.granted;

      }

      if (!cameraGranted || !microphoneGranted) {

        throw new Error(

          'Camera and microphone permission are required for a Video Shot.',

        );

      }

      return;

    }

    const result = await AudioModule.requestRecordingPermissionsAsync();

    if (!result.granted) {

      throw new Error(

        'Microphone permission is required for a Voice Shot.',

      );

    }

    await setAudioModeAsync({

      playsInSilentMode: true,

      allowsRecording: true,

    });

  };

  const startVoiceRecording = async () => {

    if (!shot || shot.receiver_id !== currentUserId) return;

    if (shot.status !== 'accepted' && shot.status !== 'active') return;

    try {

      setError(null);

      await requestRecordingPermissions('voice');

      await audioRecorder.prepareToRecordAsync();

      audioRecorder.record();

      recordStartedAtRef.current = Date.now();

      setRecordSeconds(0);

      setRecordingMode('voice');

      setRecording(true);

    } catch (err) {

      console.error('[Private Shot] Voice recording failed:', err);

      setError(

        err instanceof Error

          ? err.message

          : 'Could not start voice recording.',

      );

    }

  };

  const stopVoiceRecording = async () => {

    if (!recording || recordingMode !== 'voice') return;

    try {

      setRecording(false);

      await audioRecorder.stop();

      const uri = audioRecorder.uri;

      const startedAt = recordStartedAtRef.current;

      const durationSeconds = Math.max(

        1,

        Math.min(

          MAX_RECORDING_SECONDS,

          Math.round(

            ((Date.now() - (startedAt ?? Date.now())) / 1000),

          ),

        ),

      );

      recordStartedAtRef.current = null;

      setRecordingMode(null);

      if (!uri) {

        throw new Error('Voice recording file was not created.');

      }

      await submitRecordedResponse(

        'voice',

        uri,

        durationSeconds,

        'audio/m4a',

      );

    } catch (err) {

      console.error('[Private Shot] Voice stop failed:', err);

      setError(

        err instanceof Error

          ? err.message

          : 'Could not finish voice recording.',

      );

      setRecordingMode(null);

    }

  };

  const startVideoRecording = async () => {

    if (!shot || shot.receiver_id !== currentUserId) return;

    if (shot.status !== 'accepted' && shot.status !== 'active') return;

    try {

      setError(null);

      await requestRecordingPermissions('video');

      if (!cameraRef.current) {

        throw new Error('Camera is not ready yet.');

      }

      setRecordSeconds(0);

      recordStartedAtRef.current = Date.now();

      setRecordingMode('video');

      setRecording(true);

      void cameraRef.current

        .recordAsync({

          maxDuration: MAX_RECORDING_SECONDS,

        })

        .then(async (result) => {

          if (!result?.uri) {

            setRecording(false);

            setRecordingMode(null);

            return;

          }

          const startedAt = recordStartedAtRef.current;

          const durationSeconds = Math.max(

            1,

            Math.min(

              MAX_RECORDING_SECONDS,

              Math.round(

                ((Date.now() - (startedAt ?? Date.now())) / 1000),

              ),

            ),

          );

          recordStartedAtRef.current = null;

          setRecording(false);

          setRecordingMode(null);

          await submitRecordedResponse(

            'video',

            result.uri,

            durationSeconds,

            'video/mp4',

          );

        })

        .catch((err) => {

          console.error('[Private Shot] Video recording failed:', err);

          setRecording(false);

          setRecordingMode(null);

          setError(

            err instanceof Error

              ? err.message

              : 'Could not record video.',

          );

        });

    } catch (err) {

      console.error('[Private Shot] Video start failed:', err);

      setRecording(false);

      setRecordingMode(null);

      setError(

        err instanceof Error

          ? err.message

          : 'Could not start video recording.',

      );

    }

  };

  const stopVideoRecording = () => {

    if (!recording || recordingMode !== 'video') return;

    try {

      cameraRef.current?.stopRecording();

    } catch (err) {

      console.error('[Private Shot] Video stop failed:', err);

      setError(

        err instanceof Error

          ? err.message

          : 'Could not stop video recording.',

      );

    }

  };

  const startMysteryResponse = async () => {

    Alert.alert(

      'Mystery Shot',

      'Choose how you want to perform this Mystery Shot.',

      [

        {

          text: 'Voice',

          onPress: () => void startVoiceRecording(),

        },

        {

          text: 'Video',

          onPress: () => void startVideoRecording(),

        },

        { text: 'Cancel', style: 'cancel' },

      ],

    );

  };

  const uploadVoiceToR2 = async (

    uri: string,

    fileName: string,

    contentType: string,

  ) => {

    const fileSize = await getLocalFileSize(uri);

    const { data, error: uploadUrlError } =

      await supabase.functions.invoke('r2-upload-url', {

        body: {

          fileName,

          contentType,

          folder: 'private-shots',

          fileSize,

        },

      });

    if (uploadUrlError) throw await toFunctionError(uploadUrlError);

    const uploadData = data as R2UploadResponse | null;

    if (

      !uploadData?.success ||

      !uploadData.uploadUrl ||

      !uploadData.key

    ) {

      throw new Error(

        uploadData?.error ??

          'Unable to create R2 upload URL.',

      );

    }

    const result = await FileSystem.uploadAsync(
      uploadData.uploadUrl,
      uri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': contentType,
        },
      },
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `R2 upload failed (${result.status}).`,
      );
    }

    return uploadData.key;

  };

  const uploadVideoToR2 = async (uri: string, fileName: string, contentType: string) => {
    const fileSize = await getLocalFileSize(uri);
    const { data, error: uploadUrlError } = await supabase.functions.invoke('r2-upload-url', {
      body: { fileName, contentType, folder: 'private-shots', fileSize },
    });
    if (uploadUrlError) throw await toFunctionError(uploadUrlError);
    const uploadData = data as R2UploadResponse | null;
    if (!uploadData?.success || !uploadData.uploadUrl || !uploadData.key) {
      throw new Error(uploadData?.error ?? 'Unable to create video upload URL.');
    }
    const result = await FileSystem.uploadAsync(uploadData.uploadUrl, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Video R2 upload failed (${result.status}).`);
    }
    return uploadData.key;
  };


  const uploadVideoToCloudflare = async (

    uri: string,

    fileName: string,

    contentType: string,

  ) => {

    const { data, error: uploadUrlError } =

      await supabase.functions.invoke(

        'cloudflare-stream-upload-url',

        {

          body: {

            fileName,

            contentType,

          },

        },

      );

    if (uploadUrlError) throw uploadUrlError;

    const uploadData =

      data as CloudflareUploadResponse | null;

    if (

      !uploadData?.success ||

      !uploadData.uploadURL ||

      !uploadData.assetId

    ) {

      throw new Error(

        uploadData?.error ??

          'Unable to create Cloudflare Stream upload URL.',

      );

    }

    const formData = new FormData();

    formData.append(

      'file',

      {

        uri,

        name: fileName,

        type: contentType,

      } as any,

    );

    const response = await fetch(

      uploadData.uploadURL,

      {

        method: 'POST',

        body: formData,

      },

    );

    if (!response.ok) {

      const responseText = await response.text();

      throw new Error(

        `Cloudflare Stream upload failed (${response.status}). ${

          responseText || ''

        }`.trim(),

      );

    }

    return uploadData.assetId;

  };

  const submitRecordedResponse = async (

    mediaType: ResponseMediaType,

    uri: string,

    durationSeconds: number,

    contentType: string,

  ) => {

    if (!shot || !currentUserId) return;

    if (shot.receiver_id !== currentUserId) {

      throw new Error(

        'Only the Shot receiver can submit the response.',

      );

    }

    if (

      shot.status !== 'accepted' &&

      shot.status !== 'active'

    ) {

      throw new Error(

        'This Private Shot is not active.',

      );

    }

    try {

      setUploading(true);

      setError(null);

      const extension =

        mediaType === 'video' ? 'mp4' : 'm4a';

      const fileName =

        `private-shot/${currentUserId}/${shot.id}-${Date.now()}.${extension}`;

      let mediaKey: string;

      if (mediaType === 'video') {
        try {
          mediaKey = await uploadVideoToCloudflare(uri, `${shot.id}-${Date.now()}.mp4`, contentType);
        } catch (cloudflareError) {
          console.warn('[Private Shot] Cloudflare upload unavailable, using R2 fallback:', cloudflareError);
          mediaKey = await uploadVideoToR2(uri, fileName, contentType);
        }
      } else {

        mediaKey = await uploadVoiceToR2(

          uri,

          fileName,

          contentType,

        );

      }

      const { data: responseData, error: responseError } =

        await supabase.rpc(

          'submit_private_shot_response',

          {

            p_shot_id: shot.id,

            p_media_type: mediaType,

            p_media_key: mediaKey,

            p_duration_seconds: durationSeconds,

          },

        );

      if (responseError) {

        throw responseError;

      }

      if (!responseData) {

        throw new Error(

          'DareShot response was not created.',

        );

      }

      setShot((previous) =>

        previous

          ? {

              ...previous,

              status: 'completed',

            }

          : previous,

      );

      Alert.alert(

        'Shot Completed',

        'Your DareShot response has been submitted successfully.',

        [

          {

            text: 'Back to Chat',

            onPress: onClose,

          },

        ],

      );

    } catch (err) {

      console.error(

        '[Private Shot] Response submission failed:',

        err,

      );

      setError(

        err instanceof Error

          ? err.message

          : 'Could not submit DareShot response.',

      );

    } finally {

      setUploading(false);

    }

  };

  const profileName =

    profile?.display_name ||

    profile?.username ||

    'Dareshot User';

  const profileUsername = profile?.username

    ? `@${profile.username}`

    : '';

  const isIncoming = Boolean(

    shot &&

      currentUserId &&

      shot.receiver_id === currentUserId,

  );

  const isOutgoing = Boolean(

    shot &&

      currentUserId &&

      shot.sender_id === currentUserId,

  );

  const canPerform =

    Boolean(

      shot &&

        currentUserId &&

        shot.receiver_id === currentUserId &&

        (shot.status === 'accepted' ||

          shot.status === 'active'),

    );

  const statusLabel = shot?.status

    ? shot.status.toUpperCase()

    : '';

  const shotTypeLabel =

    shot?.shot_type === 'voice'

      ? '🎤 Voice Shot'

      : shot?.shot_type === 'video'

        ? '🎥 Video Shot'

        : '🎲 Mystery Shot';

  if (loading) {
    return (
      <View style={styles.sheetRoot}>
        <View style={styles.sheetHeader}>
          <Text allowFontScaling={false} style={styles.sheetHeaderTitle}>DareShot</Text>
          <Pressable
            onPress={onClose}
            style={styles.sheetCloseButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close DareShot"
          >
            <Ionicons name="close" size={22} color={colors.primaryText} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text allowFontScaling={false} style={styles.loadingText}>
            Loading DareShot...
          </Text>
        </View>
      </View>
    );
  }

  return (

    <View style={styles.sheetRoot}>
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHeaderTitleWrap}>
          <Ionicons name="flash-outline" size={21} color={colors.primaryText} />
          <Text allowFontScaling={false} style={styles.sheetHeaderTitle}>DareShot</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={styles.sheetCloseButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close DareShot"
        >
          <Ionicons name="close" size={22} color={colors.primaryText} />
        </Pressable>
      </View>
      <ScrollView

        style={styles.scroll}

        contentContainerStyle={styles.content}

        showsVerticalScrollIndicator={false}

        keyboardShouldPersistTaps="handled"

      >

        <View style={styles.recipientCard}>

          <View style={styles.avatar}>

            <Text allowFontScaling={false} style={styles.avatarText}>

              {profileName.charAt(0).toUpperCase()}

            </Text>

          </View>

          <View style={styles.recipientInfo}>

            <Text allowFontScaling={false} style={styles.recipientLabel}>

              PRIVATE SHOT WITH

            </Text>

            <Text allowFontScaling={false}

              style={styles.recipientName}

              numberOfLines={1}

            >

              {profileName}

            </Text>

            {profileUsername ? (

              <Text allowFontScaling={false} style={styles.username}>

                {profileUsername}

              </Text>

            ) : null}

          </View>

        </View>

        {shot ? (

          <View style={styles.statusCard}>

            <Text allowFontScaling={false} style={styles.sectionTitle}>

              Shot Status

            </Text>

            <View style={styles.statusRow}>

              <Text allowFontScaling={false} style={styles.statusType}>

                {shotTypeLabel}

              </Text>

              <View style={styles.statusBadge}>

                <Text allowFontScaling={false} style={styles.statusBadgeText}>

                  {statusLabel}

                </Text>

              </View>

            </View>

            {shot.status === 'sent' && isIncoming ? (

              <View>

                <Text allowFontScaling={false} style={styles.pendingText}>

                  This person sent you a Private Shot.

                </Text>

                <View style={styles.actionRow}>

                  <Pressable

                    style={styles.rejectButton}

                    disabled={processing}

                    onPress={() =>

                      void updateShotStatus('rejected')

                    }

                  >

                    <Text allowFontScaling={false} style={styles.rejectButtonText}>

                      Reject

                    </Text>

                  </Pressable>

                  <Pressable

                    style={styles.acceptButton}

                    disabled={processing}

                    onPress={() =>

                      void updateShotStatus('accepted')

                    }

                  >

                    {processing ? (

                      <ActivityIndicator

                        size="small"

                        color="#000000"

                      />

                    ) : (

                      <Text allowFontScaling={false}

                        style={

                          styles.acceptButtonText

                        }

                      >

                        Accept Shot

                      </Text>

                    )}

                  </Pressable>

                </View>

              </View>

            ) : null}

            {shot.status === 'sent' && isOutgoing ? (

              <Text allowFontScaling={false} style={styles.pendingText}>

                Waiting for {profileName} to accept the

                Shot.

              </Text>

            ) : null}

            {shot.status === 'accepted' ||

            shot.status === 'active' ? (

              <View style={styles.performBox}>

                <Text allowFontScaling={false} style={styles.performTitle}>

                  Perform Your Shot

                </Text>

                <Text allowFontScaling={false} style={styles.performDescription}>

                  Record your response. Maximum recording

                  time is 2 minutes.

                </Text>

                {shot.shot_type === 'mystery' ? (

                  <Pressable

                    style={styles.performButton}

                    disabled={

                      uploading ||

                      processing ||

                      recording

                    }

                    onPress={() =>

                      void startMysteryResponse()

                    }

                  >

                    <Ionicons

                      name="sparkles"

                      size={18}

                      color={colors.background}

                    />

                    <Text allowFontScaling={false} style={styles.performButtonText}>

                      Perform Mystery Shot

                    </Text>

                  </Pressable>

                ) : shot.shot_type === 'voice' ? (

                  <Pressable

                    style={[

                      styles.performButton,

                      recording &&

                        styles.stopButton,

                    ]}

                    disabled={uploading || processing}

                    onPress={() =>

                      recording

                        ? void stopVoiceRecording()

                        : void startVoiceRecording()

                    }

                  >

                    <Ionicons

                      name={

                        recording

                          ? 'stop'

                          : 'mic'

                      }

                      size={18}

                      color={colors.background}

                    />

                    <Text allowFontScaling={false} style={styles.performButtonText}>

                      {recording

                        ? `Stop • ${recordSeconds}s`

                        : 'Record Voice'}

                    </Text>

                  </Pressable>

                ) : (

                  <Pressable

                    style={[

                      styles.performButton,

                      recording &&

                        styles.stopButton,

                    ]}

                    disabled={uploading || processing}

                    onPress={() =>

                      recording

                        ? stopVideoRecording()

                        : void startVideoRecording()

                    }

                  >

                    <Ionicons

                      name={

                        recording

                          ? 'stop'

                          : 'videocam'

                      }

                      size={18}

                      color={colors.background}

                    />

                    <Text allowFontScaling={false} style={styles.performButtonText}>

                      {recording

                        ? `Stop • ${recordSeconds}s`

                        : 'Record Video'}

                    </Text>

                  </Pressable>

                )}

                {shot?.shot_type === 'video' || shot?.shot_type === 'mystery' ? (

                  <View style={styles.cameraWrap}>

                    <CameraView

                      ref={cameraRef}

                      style={styles.camera}

                      facing={cameraFacing}

                      mode="video"

                    />

                    <View

                      style={styles.cameraOverlay}

                    >
                      <Pressable
                        style={styles.cameraFlipButton}
                        onPress={() => setCameraFacing((previous) => previous === 'front' ? 'back' : 'front')}
                        disabled={recording || uploading || processing}
                      >
                        <Ionicons name="camera-reverse" size={20} color="#ffffff" />
                      </Pressable>

                      <View style={styles.recordingBadge}>

                        <View

                          style={

                            styles.recordingDot

                          }

                        />

                        <Text allowFontScaling={false}

                          style={

                            styles.recordingBadgeText

                          }

                        >

                          RECORDING {recordSeconds}s

                        </Text>

                      </View>

                    </View>

                  </View>

                ) : null}

                {uploading ? (

                  <View style={styles.uploadingBox}>

                    <ActivityIndicator

                      size="small"

                      color={colors.accent}

                    />

                    <Text allowFontScaling={false}

                      style={

                        styles.uploadingText

                      }

                    >

                      Uploading response...

                    </Text>

                  </View>

                ) : null}

              </View>

            ) : null}

            {shot.status === 'completed' ? (

              <View style={styles.completedBox}>

                <Text allowFontScaling={false} style={styles.completedIcon}>

                  ✓

                </Text>

                <Text allowFontScaling={false} style={styles.completedTitle}>

                  Shot Completed

                </Text>

                <Text allowFontScaling={false}

                  style={

                    styles.completedDescription

                  }

                >

                  The response has been submitted

                  successfully.

                </Text>

              </View>

            ) : null}

            {shot.status === 'rejected' ? (

              <View style={styles.rejectedBox}>

                <Text allowFontScaling={false} style={styles.rejectedTitle}>

                  Shot Rejected

                </Text>

                <Text allowFontScaling={false}

                  style={

                    styles.rejectedDescription

                  }

                >

                  This DareShot was rejected.

                </Text>

              </View>

            ) : null}

          </View>

        ) : (

          <View>

            <Text allowFontScaling={false} style={styles.sectionTitle}>

              Choose Shot Type

            </Text>

            <Text allowFontScaling={false} style={styles.subtitle}>

              DareShots are personal 1-to-1

              challenges inside your conversation.

            </Text>

            <View style={styles.options}>

              {shotOptions.map((option) => {

                const selected =

                  selectedType === option.type;

                return (

                  <Pressable

                    key={option.type}

                    onPress={() =>

                      setSelectedType(

                        option.type,

                      )

                    }

                    style={[

                      styles.optionCard,

                      selected &&

                        styles.selectedOption,

                    ]}

                  >

                    <View style={styles.optionIcon}>
                      <Ionicons
                        name={option.icon}
                        size={25}
                        color={colors.primaryText}
                      />
                    </View>

                    <View

                      style={

                        styles.optionInfo

                      }

                    >

                      <Text allowFontScaling={false}

                        style={

                          styles.optionTitle

                        }

                      >

                        {option.title}

                      </Text>

                      <Text allowFontScaling={false}

                        style={

                          styles.optionDescription

                        }

                      >

                        {option.description}

                      </Text>

                    </View>

                    <View

                      style={[

                        styles.radio,

                        selected &&

                          styles.radioSelected,

                      ]}

                    >

                      {selected ? (

                        <View

                          style={

                            styles.radioDot

                          }

                        />

                      ) : null}

                    </View>

                  </Pressable>

                );

              })}

            </View>

            <Pressable

              style={styles.startButton}

              disabled={creating}

              onPress={() => void startShot()}

            >

              {creating ? (

                <ActivityIndicator

                  size="small"

                  color="#000000"

                />

              ) : (

                <Text allowFontScaling={false}

                  style={

                    styles.startButtonText

                  }

                >

                  Start Shot

                </Text>

              )}

            </Pressable>

            <Text allowFontScaling={false} style={styles.helperText}>

              This Shot is private and only visible

              to you and {profileName}.

            </Text>

          </View>

        )}

        {error ? (

          <View style={styles.errorBox}>

            <Text allowFontScaling={false} style={styles.errorText}>

              {error}

            </Text>

          </View>

        ) : null}

      </ScrollView>
    </View>

  );

}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    marginTop: 78,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHeader: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetHeaderTitle: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '900',
  },
  sheetCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },

  header: {

    minHeight: 58,

    paddingHorizontal: 8,

    flexDirection: 'row',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: colors.border,

    backgroundColor: colors.background,

  },

  headerButton: {

    width: 40,

    height: 40,

    alignItems: 'center',

    justifyContent: 'center',

  },

  headerTitle: {

    flex: 1,

    color: colors.primaryText,

    fontSize: 17,

    fontWeight: '800',

    textAlign: 'center',

  },

  headerSpacer: {

    width: 40,

    height: 40,

  },

  scroll: {

    flex: 1,

  },

  content: {

    paddingHorizontal: 16,

    paddingTop: 10,

    paddingBottom: 40,

  },

  center: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

  },

  loadingText: {

    color: colors.secondaryText,

    fontSize: 13,

    marginTop: 10,

  },

  recipientCard: {

    flexDirection: 'row',

    alignItems: 'center',

    padding: 16,

    borderRadius: 18,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    marginBottom: 24,

  },

  avatar: {

    width: 52,

    height: 52,

    borderRadius: 26,

    backgroundColor: colors.surfaceElevated,

    alignItems: 'center',

    justifyContent: 'center',

  },

  avatarText: {

    color: colors.primaryText,

    fontSize: 21,

    fontWeight: '800',

  },

  recipientInfo: {

    flex: 1,

    marginLeft: 13,

  },

  recipientLabel: {

    color: colors.secondaryText,

    fontSize: 10,

    fontWeight: '800',

    letterSpacing: 0.8,

  },

  recipientName: {

    color: colors.primaryText,

    fontSize: 18,

    fontWeight: '800',

    marginTop: 2,

  },

  username: {

    color: colors.secondaryText,

    fontSize: 12,

    marginTop: 2,

  },

  sectionTitle: {

    color: colors.primaryText,

    fontSize: 19,

    fontWeight: '800',

    marginBottom: 7,

  },

  subtitle: {

    color: colors.secondaryText,

    fontSize: 13,

    lineHeight: 19,

    marginBottom: 18,

  },

  options: {

    gap: 12,

  },

  optionCard: {

    flexDirection: 'row',

    alignItems: 'center',

    padding: 15,

    borderRadius: 17,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

  },

  selectedOption: {

    borderColor: colors.accent,

  },

  optionIcon: {

    width: 46,

    height: 46,

    borderRadius: 14,

    backgroundColor: colors.surfaceElevated,

    alignItems: 'center',

    justifyContent: 'center',

  },

  optionEmoji: {

    fontSize: 23,

  },

  optionInfo: {

    flex: 1,

    marginLeft: 12,

    paddingRight: 10,

  },

  optionTitle: {

    color: colors.primaryText,

    fontSize: 15,

    fontWeight: '800',

  },

  optionDescription: {

    color: colors.secondaryText,

    fontSize: 12,

    lineHeight: 17,

    marginTop: 3,

  },

  radio: {

    width: 22,

    height: 22,

    borderRadius: 11,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: 'center',

    justifyContent: 'center',

  },

  radioSelected: {

    borderColor: colors.accent,

  },

  radioDot: {

    width: 10,

    height: 10,

    borderRadius: 5,

    backgroundColor: colors.accent,

  },

  startButton: {

    height: 50,

    borderRadius: 15,

    backgroundColor: colors.primaryText,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 24,

  },

  startButtonText: {

    color: colors.background,

    fontSize: 15,

    fontWeight: '900',

  },

  helperText: {

    color: colors.secondaryText,

    fontSize: 11,

    lineHeight: 17,

    textAlign: 'center',

    marginTop: 12,

  },

  statusCard: {

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    borderRadius: 18,

    padding: 16,

  },

  statusRow: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 8,

  },

  statusType: {

    color: colors.primaryText,

    fontSize: 15,

    fontWeight: '800',

  },

  statusBadge: {
    flexShrink: 0,

    paddingHorizontal: 9,

    paddingVertical: 5,

    borderRadius: 9,

    backgroundColor: colors.surfaceElevated,

  },

  statusBadgeText: {

    color: colors.primaryText,

    fontSize: 9,

    fontWeight: '900',

  },

  pendingText: {

    color: colors.secondaryText,

    fontSize: 13,

    lineHeight: 19,

    marginTop: 16,

  },

  actionRow: {

    flexDirection: 'row',

    gap: 10,

    marginTop: 18,

  },

  rejectButton: {

    flex: 1,

    height: 46,

    borderRadius: 13,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: 'center',

    justifyContent: 'center',

  },

  rejectButtonText: {
    flexShrink: 1,
    textAlign: 'center',

    color: colors.primaryText,

    fontSize: 13,

    fontWeight: '800',

  },

  acceptButton: {

    flex: 1,

    height: 46,

    borderRadius: 13,

    backgroundColor: colors.primaryText,

    alignItems: 'center',

    justifyContent: 'center',

  },

  acceptButtonText: {
    flexShrink: 1,
    textAlign: 'center',

    color: colors.background,

    fontSize: 13,

    fontWeight: '900',

  },

  performBox: {

    marginTop: 18,

    padding: 15,

    borderRadius: 16,

    backgroundColor: colors.surfaceElevated,

  },

  performTitle: {

    color: colors.primaryText,

    fontSize: 16,

    fontWeight: '900',

  },

  performDescription: {

    color: colors.secondaryText,

    fontSize: 12,

    lineHeight: 18,

    marginTop: 4,

    marginBottom: 14,

  },

  performButton: {

    minHeight: 48,

    paddingHorizontal: 16,

    borderRadius: 14,

    backgroundColor: colors.primaryText,

    alignItems: 'center',

    justifyContent: 'center',

    flexDirection: 'row',

    gap: 8,

  },

  stopButton: {

    opacity: 0.9,

  },

  performButtonText: {
    flexShrink: 1,
    textAlign: 'center',

    color: colors.background,

    fontSize: 14,

    fontWeight: '900',

  },

  cameraWrap: {

    height: 360,

    borderRadius: 16,

    overflow: 'hidden',

    marginTop: 14,

    backgroundColor: '#000000',

  },

  camera: {

    flex: 1,

  },

  cameraOverlay: {

    position: 'absolute',

    top: 12,

    left: 12,

    right: 12,

    alignItems: 'center',

  },

  cameraFlipButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordingBadge: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 7,

    paddingHorizontal: 10,

    paddingVertical: 7,

    borderRadius: 20,

    backgroundColor: 'rgba(0,0,0,0.65)',

  },

  recordingDot: {

    width: 8,

    height: 8,

    borderRadius: 4,

    backgroundColor: '#ff3b30',

  },

  recordingBadgeText: {

    color: '#ffffff',

    fontSize: 10,

    fontWeight: '900',

  },

  uploadingBox: {

    marginTop: 12,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

  },

  uploadingText: {

    color: colors.secondaryText,

    fontSize: 12,

    fontWeight: '700',

  },

  completedBox: {

    marginTop: 18,

    padding: 16,

    borderRadius: 15,

    backgroundColor: colors.surfaceElevated,

    alignItems: 'center',

  },

  completedIcon: {

    color: colors.primaryText,

    fontSize: 28,

    fontWeight: '900',

  },

  completedTitle: {

    color: colors.primaryText,

    fontSize: 16,

    fontWeight: '900',

    marginTop: 4,

  },

  completedDescription: {

    color: colors.secondaryText,

    fontSize: 12,

    marginTop: 4,

    textAlign: 'center',

  },

  rejectedBox: {

    marginTop: 18,

    padding: 15,

    borderRadius: 14,

    backgroundColor: colors.surfaceElevated,

  },

  rejectedTitle: {

    color: colors.primaryText,

    fontSize: 15,

    fontWeight: '800',

  },

  rejectedDescription: {

    color: colors.secondaryText,

    fontSize: 12,

    marginTop: 3,

  },

  errorBox: {

    marginTop: 18,

    padding: 14,

    borderRadius: 14,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

  },

  errorText: {

    color: colors.primaryText,

    fontSize: 12,

    lineHeight: 18,

  },

});
