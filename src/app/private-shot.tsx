import * as FileSystem from 'expo-file-system/legacy';







import { Ionicons } from '@expo/vector-icons';


import {
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';




import {
  AudioModule,







  RecordingPresets,







  setAudioModeAsync,







  useAudioRecorder,
} from 'expo-audio';







import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';







import { router, useLocalSearchParams } from 'expo-router';







import { useEffect, useMemo, useRef, useState } from 'react';







import {
  ActivityIndicator,







  Alert,







  Pressable,







  ScrollView,







  StyleSheet,







  Text,







  TextInput,


  View,
} from 'react-native';







import { Screen } from '../components/Screen';







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
  conversation_id?: string | null;
  sender_id: string;
  receiver_id: string;
  shot_type: ShotType;
  status: string;
  created_at: string;
  completed_at?: string | null;
  challenge_text?: string | null;
};

type DareShotStats = {
  completedCount: number;
  streak: number;
  streakState: 'active' | 'at-risk' | 'broken';
  turnUserId: string | null;
  lastCompletedAt: string | null;
};

type ShotResponse = {
  id: string;
  shot_id: string;
  responder_id: string;
  media_type: ResponseMediaType;
  media_key: string;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
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







  icon: string;







  title: string;







  description: string;







}> = [







  {







    type: 'voice',







    icon: '🎤',







    title: 'Voice Shot',







    description: 'Send a personal voice challenge.',







  },







  {







    type: 'video',







    icon: '🎥',







    title: 'Video Shot',







    description: 'Send a personal video challenge.',







  },







  {







    type: 'mystery',







    icon: '🎲',







    title: 'Mystery Shot',







    description: 'Hide the challenge until it is accepted.',







  },







];







function ProofVideo({
  uri,
  contentType,
}: {
  uri: string;
  contentType: 'hls' | 'progressive';
}) {
  // Cloudflare Stream proofs are HLS; iOS can't cache HLS sources.
  const player = useVideoPlayer({ uri, contentType, useCaching: false }, (instance) => {
    instance.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.proofVideo}
      contentFit="contain"
      nativeControls
    />
  );
}

function ProofAudio({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri, {
    updateInterval: 250,
    downloadFirst: true,
  });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || 0;
  const current = status.currentTime || 0;
  const progress = duration
    ? Math.min(100, (current / duration) * 100)
    : 0;

  return (
    <View style={styles.proofAudio}>
      <Pressable
        onPress={() => {
          if (status.playing) {
            player.pause();
          } else {
            if (duration > 0 && current >= duration - 0.1) {
              void player.seekTo(0);
            }
            player.play();
          }
        }}
        style={styles.proofAudioButton}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={17}
          color={colors.background}
        />
      </Pressable>

      <View style={styles.proofAudioTrack}>
        <View style={styles.proofAudioLine}>
          <View
            style={[
              styles.proofAudioProgress,
              { width: `${progress}%` },
            ]}
          />
        </View>
        <Text allowFontScaling={false} style={styles.proofAudioTime}>
          {formatDuration(current)} / {formatDuration(duration)}
        </Text>
      </View>
    </View>
  );
}


const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export type PrivateShotScreenProps = {
  embedded?: boolean;
  userId?: string;
  conversationId?: string;
  shotId?: string;
  onClose?: () => void;
};

export default function PrivateShotScreen({
  embedded = false,
  userId: embeddedUserId,
  conversationId: embeddedConversationId,
  shotId: embeddedShotId,
  onClose,
}: PrivateShotScreenProps = {}) {







  const params = useLocalSearchParams<{







    userId?: string;







    conversationId?: string;







    shotId?: string;







  }>();







  const targetUserId = useMemo(







    () => embedded
      ? (embeddedUserId ?? '')
      : (Array.isArray(params.userId) ? params.userId[0] : params.userId ?? ''),







    [embedded, embeddedUserId, params.userId],







  );







  const conversationId = useMemo(







    () => embedded
      ? (embeddedConversationId ?? '')
      : (Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId ?? ''),







    [embedded, embeddedConversationId, params.conversationId],







  );







  const existingShotId = useMemo(







    () => embedded
      ? (embeddedShotId ?? '')
      : (Array.isArray(params.shotId) ? params.shotId[0] : params.shotId ?? ''),







    [embedded, embeddedShotId, params.shotId],







  );







  const [currentUserId, setCurrentUserId] = useState<string | null>(null);







  const [profile, setProfile] = useState<Profile | null>(null);







  const [selectedType, setSelectedType] = useState<ShotType>('voice');
  const [challengeText, setChallengeText] = useState('');






  const [loading, setLoading] = useState(true);







  const [creating, setCreating] = useState(false);







  const [processing, setProcessing] = useState(false);







  const [shot, setShot] = useState<Shot | null>(null);

  const [shotStats, setShotStats] = useState<DareShotStats>({
    completedCount: 0,
    streak: 0,
    streakState: 'broken',
    turnUserId: null,
    lastCompletedAt: null,
  });
  const [shotProof, setShotProof] = useState<ShotResponse | null>(null);
  const [shotProofUrl, setShotProofUrl] = useState<string | null>(null);
  const [shotProofLoading, setShotProofLoading] = useState(false);
  const [shotProofContentType, setShotProofContentType] =
    useState<'hls' | 'progressive'>('progressive');
  // The shot whose proof is being loaded; older in-flight loads are ignored.
  const activeProofShotIdRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);







  const [recordingMode, setRecordingMode] = useState<ResponseMediaType | null>(null);







  const [recording, setRecording] = useState(false);
  const [recordReady, setRecordReady] = useState(false);
  const [selectedMysteryMode, setSelectedMysteryMode] = useState<ResponseMediaType | null>(null);







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







  const closeScreen = () => {
    if (embedded) {
      onClose?.();
    } else {
      router.back();
    }
  };

  useEffect(() => {







    void loadScreen();







    return () => {







      if (recordTimerRef.current) {







        clearInterval(recordTimerRef.current);







      }







    };







  }, [targetUserId, existingShotId]);

  useEffect(() => {
    if (shot?.status === 'completed') {
      void loadShotProof(shot.id);
    } else {
      activeProofShotIdRef.current = null;
      setShotProof(null);
      setShotProofUrl(null);
    }
  }, [shot?.id, shot?.status]);









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







          throw new Error('You cannot start a Private Shot with yourself.');







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







            'Private Shot is unavailable between these users.',







          );







        }







      }







      if (existingShotId) {







        await loadExistingShot(existingShotId, user.id);







      }







    } catch (err) {







      console.error('[Private Shot] Load failed:', err);







      setError(







        err instanceof Error ? err.message : 'Could not load Private Shot.',







      );







    } finally {







      setLoading(false);







    }







  };







  const loadShotStats = async (userId: string, otherUserId: string) => {
    try {
      let query = supabase
        .from('private_shots')
        .select(
          'id, conversation_id, sender_id, receiver_id, status, created_at, completed_at',
        )
        .order('created_at', { ascending: true });

      const conversationParam = conversationId;

      if (conversationParam) {
        query = query.eq('conversation_id', conversationParam);
      } else {
        query = query.or(
          `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
        );
      }

      const { data, error: statsError } = await query;
      if (statsError) throw statsError;

      const completed = (data ?? [])
        .filter((item) => item.status === 'completed')
        .sort(
          (a, b) =>
            new Date(a.completed_at ?? a.created_at).getTime() -
            new Date(b.completed_at ?? b.created_at).getTime(),
        );

      const completedCount = completed.length;
      const latest = completed[completed.length - 1];
      const lastCompletedAt = latest
        ? latest.completed_at ?? latest.created_at
        : null;

      let streak = 0;
      let streakState: DareShotStats['streakState'] = 'broken';

      if (completed.length > 1) {
        let cursor = completed.length - 1;

        while (cursor > 0) {
          const latestShot = completed[cursor];
          const previousShot = completed[cursor - 1];

          const latestTime = new Date(
            latestShot.completed_at ?? latestShot.created_at,
          ).getTime();
          const previousTime = new Date(
            previousShot.completed_at ?? previousShot.created_at,
          ).getTime();

          const gapHours =
            (latestTime - previousTime) / (1000 * 60 * 60);

          // One streak point is earned only after BOTH directions
          // complete one Private Shot: A -> B, then B -> A.
          if (
            gapHours <= 48 &&
            latestShot.sender_id === previousShot.receiver_id &&
            latestShot.receiver_id === previousShot.sender_id
          ) {
            streak += 1;
            cursor -= 2;
          } else {
            break;
          }
        }

        const latestAgeHours =
          (Date.now() - new Date(lastCompletedAt ?? Date.now()).getTime()) /
          (1000 * 60 * 60);

        if (latestAgeHours <= 24) {
          streakState = 'active';
        } else if (latestAgeHours <= 48) {
          streakState = 'at-risk';
        } else {
          streak = 0;
          streakState = 'broken';
        }
      }

      setShotStats({
        completedCount,
        streak,
        streakState,
        turnUserId: latest
          ? latest.sender_id === userId
            ? otherUserId
            : userId
          : userId,
        lastCompletedAt,
      });
    } catch (err) {
      console.warn('[Private Shot] Stats load failed:', err);
    }
  };

  const loadShotProof = async (shotId: string) => {
    activeProofShotIdRef.current = shotId;
    const isCurrent = () => activeProofShotIdRef.current === shotId;

    try {
      setShotProofLoading(true);
      setShotProof(null);
      setShotProofUrl(null);

      const { data: responseData, error: responseError } =
        await supabase.rpc('get_private_shot_response', {
          p_shot_id: shotId,
        });

      if (responseError) throw responseError;

      const response = responseData as ShotResponse | null;
      if (!response?.media_key || !isCurrent()) return;

      setShotProof(response);

      // The server re-checks access for this shot and turns the stored media
      // key (Cloudflare Stream UID or R2 key) into a playable URL.
      const { data: urlData, error: urlError } =
        await supabase.functions.invoke('private-shot-proof-url', {
          body: { shotId },
        });

      if (urlError) throw await toFunctionError(urlError);
      if (!isCurrent()) return;

      const proof = urlData as {
        status?: 'ready' | 'processing';
        playback?: { url?: string; contentType?: 'hls' | 'progressive' };
      } | null;

      // Still encoding on Cloudflare Stream: the card shows "not available yet".
      if (proof?.status === 'processing') return;

      if (!proof?.playback?.url) {
        throw new Error('Proof playback URL was not returned.');
      }

      setShotProofContentType(
        proof.playback.contentType === 'hls' ? 'hls' : 'progressive',
      );
      setShotProofUrl(proof.playback.url);
    } catch (err) {
      console.warn('[Private Shot] Proof load failed:', err);
    } finally {
      if (isCurrent()) setShotProofLoading(false);
    }
  };

const loadExistingShot = async (shotId: string, userId: string) => {  






    const { data, error: shotError } = await supabase







      .from('private_shots')







      .select(







        'id, conversation_id, sender_id, receiver_id, shot_type, status, challenge_text, created_at, completed_at',







      )







      .eq('id', shotId)







      .maybeSingle();







    if (shotError) throw shotError;







    if (!data) {







      throw new Error('Private Shot could not be found.');







    }







    if (data.sender_id !== userId && data.receiver_id !== userId) {







      throw new Error('You do not have access to this Private Shot.');







    }







    setShot(data as Shot);







    const otherUserId =







      data.sender_id === userId ? data.receiver_id : data.sender_id;

    await loadShotStats(userId, otherUserId);







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







          'You cannot start a Private Shot with this user.',







        );







      }







      const { data, error: insertError } = await supabase







        .from('private_shots')







        .insert({
          ...(conversationId ? { conversation_id: conversationId } : {}),







          sender_id: currentUserId,







          receiver_id: targetUserId,







          shot_type: selectedType,







          status: 'sent',







        })







        .select(







          'id, conversation_id, sender_id, receiver_id, shot_type, status, challenge_text, created_at, completed_at',







        )







        .single();







      if (insertError) throw insertError;







      setShot(data as Shot);
      setChallengeText(data.challenge_text ?? challengeText.trim());
      await loadShotStats(currentUserId, targetUserId);

      Alert.alert(







        'Shot Sent',







        'Your Private Shot has been sent.',







        [







          {







            text: 'Back to Chat',







            onPress: () => closeScreen(),







          },







        ],







      );







    } catch (err) {







      console.error('[Private Shot] Create failed:', err);







      setError(







        err instanceof Error







          ? err.message







          : 'Could not start Private Shot.',







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

        'This Private Shot is no longer available.',

      );

    }



    const rpcName =

      nextStatus === 'accepted'

        ? 'accept_private_shot'

        : 'reject_private_shot';



    const { data, error } = await supabase.rpc(rpcName, {

      p_shot_id: shot.id,

    });



    if (error) throw error;



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







          onPress: () => { setRecordReady(true); setSelectedMysteryMode('voice'); },







        },







        {







          text: 'Video',







          onPress: () => { setRecordReady(true); setSelectedMysteryMode('video'); },







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







          'Private Shot response was not created.',







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

      const otherUserId =
        shot.sender_id === currentUserId ? shot.receiver_id : shot.sender_id;
      await loadShotStats(currentUserId, otherUserId);







      Alert.alert(







        'Shot Completed',







        'Your Private Shot response has been submitted successfully.',







        [







          {







            text: 'Back to Chat',







            onPress: () => closeScreen(),







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







          : 'Could not submit Private Shot response.',







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







  const nextTurnUserId =
    shot &&
    (shot.status === 'sent' ||
      shot.status === 'accepted' ||
      shot.status === 'active')
      ? shot.receiver_id
      : shotStats.turnUserId;

  const hasPendingShot = Boolean(
    shot &&
      (shot.status === 'sent' || shot.status === 'accepted' || shot.status === 'active'),
  );
  const canStartNewShot = Boolean(
    currentUserId &&
      nextTurnUserId === currentUserId &&
      !hasPendingShot,
  );

  if (loading) {







    return (







      <Screen scroll={false}>







        <View style={styles.header}>







          <Pressable







            onPress={() => closeScreen()}







            style={styles.headerButton}







            hitSlop={8}







          >







            <Ionicons







              name="arrow-back"







              size={22}







              color={colors.primaryText}







            />







          </Pressable>







          <Text allowFontScaling={false}







            style={styles.headerTitle}







            numberOfLines={1}







          >







            Private Shot







          </Text>







          <View style={styles.headerSpacer} />







        </View>







        <View style={styles.center}>







          <ActivityIndicator







            size="small"







            color={colors.accent}







          />







          <Text allowFontScaling={false} style={styles.loadingText}>







            Loading Private Shot...







          </Text>







        </View>







      </Screen>







    );







  }







  return (







    <Screen scroll={false}>







      <View style={styles.header}>







        <Pressable







          onPress={() => closeScreen()}







          style={styles.headerButton}







          hitSlop={8}







        >







          <Ionicons







            name="arrow-back"







            size={22}







            color={colors.primaryText}







          />







        </Pressable>







        <Text allowFontScaling={false}







          style={styles.headerTitle}







          numberOfLines={1}







        >







          Private Shot







        </Text>







        <View style={styles.headerSpacer} />







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







        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text allowFontScaling={false} style={styles.statValue}>
              {shotStats.completedCount}
            </Text>
            <Text allowFontScaling={false} style={styles.statLabel}>
              Shots
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text allowFontScaling={false} style={styles.statValue}>
              {shotStats.streak}
            </Text>
            <Text allowFontScaling={false} style={styles.statLabel}>
              Streak
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text allowFontScaling={false} style={styles.statValue}>
              {nextTurnUserId === currentUserId ? 'YOU' : 'THEM'}
            </Text>
            <Text allowFontScaling={false} style={styles.statLabel}>
              Next Turn
            </Text>
          </View>
        </View>

        {shotStats.streakState === 'at-risk' ? (
          <Text allowFontScaling={false} style={styles.streakWarning}>
            🔥 Streak at risk — complete the next Shot within 24 hours.
          </Text>
        ) : null}

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







            {shot.challenge_text && !(shot.shot_type === 'mystery' && isIncoming && shot.status === 'sent') ? (
              <View style={styles.challengeDisplay}>
                <Text allowFontScaling={false} style={styles.challengeDisplayLabel}>
                  Challenge
                </Text>
                <Text allowFontScaling={false} style={styles.challengeDisplayText}>
                  {shot.challenge_text}
                </Text>
              </View>
            ) : null}

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







                    onPress={() => {
                      if (selectedMysteryMode === 'voice') {
                        if (!recordReady) {
                          setRecordReady(true);
                        } else {
                          void startVoiceRecording();
                        }
                      } else if (selectedMysteryMode === 'video') {
                        if (!recordReady) {
                          setRecordReady(true);
                        } else {
                          void startVideoRecording();
                        }
                      } else {
                        void startMysteryResponse();
                      }
                    }}







                  >







                    <Ionicons







                      name="sparkles"







                      size={18}







                      color={colors.background}







                    />







                    <Text allowFontScaling={false} style={styles.performButtonText}>







                      Choose Voice / Video







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







                    onPress={() => {
                      if (recording) {
                        void stopVoiceRecording();
                      } else if (!recordReady) {
                        setRecordReady(true);
                      } else {
                        void startVoiceRecording();
                      }
                    }}







                  >







                    <Ionicons







                      name={







                        recording
                          ? 'stop'
                          : recordReady
                            ? 'mic'
                            : 'play'







                      }







                      size={18}







                      color={colors.background}







                    />







                    <Text allowFontScaling={false} style={styles.performButtonText}>







                      {recording
                        ? `Stop • ${recordSeconds}s`
                        : recordReady
                          ? 'Start Voice Recording'
                          : 'Start Recording'}







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







                    onPress={() => {
                      if (recording) {
                        void stopVideoRecording();
                      } else if (!recordReady) {
                        setRecordReady(true);
                      } else {
                        void startVideoRecording();
                      }
                    }}







                  >







                    <Ionicons







                      name={







                        recording
                          ? 'stop'
                          : recordReady
                            ? 'videocam'
                            : 'play'







                      }







                      size={18}







                      color={colors.background}







                    />







                    <Text allowFontScaling={false} style={styles.performButtonText}>







                      {recording
                        ? `Stop • ${recordSeconds}s`
                        : recordReady
                          ? 'Start Video Recording'
                          : 'Start Recording'}







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







                        {shot.status === 'completed' && (shotProof || shotProofLoading) ? (
              <View style={styles.proofCard}>
                <View style={styles.proofHeader}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primaryText} />
                  <View style={styles.proofHeaderText}>
                    <Text allowFontScaling={false} style={styles.proofTitle}>Proof Submitted</Text>
                    <Text allowFontScaling={false} style={styles.proofSubtitle}>
                      {shotProof?.responder_id === currentUserId
                        ? 'Your submitted proof'
                        : 'Response proof from your partner'}
                    </Text>
                  </View>
                  {shotProof ? (
                    <View style={styles.proofBadge}>
                      <Text allowFontScaling={false} style={styles.proofBadgeText}>
                        {shotProof.media_type === 'video' ? 'VIDEO' : 'VOICE'}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {shotProofLoading ? (
                  <View style={styles.proofLoading}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text allowFontScaling={false} style={styles.proofLoadingText}>Loading proof...</Text>
                  </View>
                ) : shotProofUrl && shotProof?.media_type === 'video' ? (
                  <View style={styles.proofMediaWrap}>
                    <ProofVideo uri={shotProofUrl} contentType={shotProofContentType} />
                  </View>
                ) : shotProofUrl && shotProof?.media_type === 'voice' ? (
                  <ProofAudio uri={shotProofUrl} />
                ) : (
                  <Text allowFontScaling={false} style={styles.proofUnavailable}>
                    Proof is submitted, but the media is not available yet.
                  </Text>
                )}
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







                  This Private Shot was rejected.







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







              Private Shots are personal 1-to-1







              challenges inside your conversation.







            </Text>







            <TextInput
              value={challengeText}
              onChangeText={setChallengeText}
              placeholder="Write your challenge..."
              placeholderTextColor={colors.secondaryText}
              multiline
              maxLength={500}
              style={styles.challengeInput}
            />

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







                      <Text allowFontScaling={false}







                        style={







                          styles.optionEmoji







                        }







                      >







                        {option.icon}







                      </Text>







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







    </Screen>







  );







}







const styles = StyleSheet.create({







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







  subSectionTitle: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modeButtonSelected: {
    backgroundColor: colors.primaryText,
    borderColor: colors.primaryText,
  },
  modeButtonText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '800',
  },
  modeButtonTextSelected: {
    color: colors.background,
  },
  shotMetaRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
  },
  metaPill: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metaPillText: {
    color: colors.primaryText,
    fontSize: 9,
    fontWeight: '900',
  },
  startButtonDisabled: {
    opacity: 0.45,
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    color: colors.primaryText,
    fontSize: 17,
    fontWeight: '900',
  },

  statLabel: {
    color: colors.secondaryText,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  streakWarning: {
    color: colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 12,
  },

  proofCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },

  proofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  proofHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  proofTitle: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '900',
  },

  proofSubtitle: {
    color: colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  proofBadge: {
    marginLeft: 10,
  },
  proofBadgeText: {
    color: colors.primaryText,
    fontSize: 9,
    fontWeight: '900',
  },

  proofMediaWrap: {
    width: '100%',
    height: 230,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: colors.background,
  },

  proofVideo: {
    width: '100%',
    height: '100%',
  },

  proofAudio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  proofAudioButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryText,
  },

  proofAudioTrack: {
    flex: 1,
    minWidth: 0,
  },

  proofAudioLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },

  proofAudioProgress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryText,
  },

  proofAudioTime: {
    color: colors.secondaryText,
    fontSize: 10,
    marginTop: 5,
  },

  proofLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
  },

  proofLoadingText: {
    color: colors.secondaryText,
    fontSize: 11,
  },

  proofUnavailable: {
    color: colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
  },

  challengeInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.primaryText,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 14,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  challengeDisplay: {
    marginTop: 14,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  challengeDisplayLabel: {
    color: colors.secondaryText,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  challengeDisplayText: {
    color: colors.primaryText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
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
