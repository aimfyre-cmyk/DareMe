import Ionicons from '@expo/vector-icons/Ionicons';

import { VideoView, useVideoPlayer } from 'expo-video';

import { useSegments } from 'expo-router';

import { useEffect, useState } from 'react';

import { peekFeedMediaUrl, prefetchFeedImage, resolveFeedMediaUrl } from '../features/onboarding/media/feedMediaEngine';

import {
  type LayoutChangeEvent,

  ImageBackground,

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

export type MockDare = {

  id: string;

  title: string;

  category: string;

  difficulty: 'Easy' | 'Medium' | 'Hard';

  xpValue: number;

  proofType: 'Photo' | 'Video' | 'Text';

  // Optional Cloudflare R2 Dare media resolved by Home.

  mediaType?: 'image' | 'video' | null;

  mediaUrl?: string | null;

  // Optional Home metadata shown inside the card.
  description?: string | null;
  createdAt?: string | null;
};

type DareCardProps = {

  dare: MockDare;

  isVideoActive?: boolean;

  /** Warm the next feed video without making it active. */

  preloadVideo?: boolean;

  /** Open the full Dare details popup from the card. */
  onViewMore?: () => void;

  /** Timestamp label prepared by Home. */
  timestampLabel?: string | null;

  onCardLayout?: (event: LayoutChangeEvent) => void;

  onPress?: () => void;

  onPrimaryAction?: () => void;

  loading?: boolean;

  inProgress?: boolean;

  /* Social actions */

  likeCount?: number;

  commentCount?: number;

  likedByMe?: boolean;

  onLike?: () => void;

  onLikeCountPress?: () => void;

  onComment?: () => void;

  onShare?: () => void;

  /* Save */

  savedByMe?: boolean;

  onSave?: () => void;

  /* Owner-only menu */

  isOwner?: boolean;

  onDelete?: () => void;

  /* Competition */

  competitionCount?: number;

  competitionLabel?: string;

};

export function DareCard({

  dare,

  isVideoActive = false,

  preloadVideo = false,

  onViewMore,

  timestampLabel = null,

  onCardLayout,

  onPress,

  onPrimaryAction,

  loading = false,

  inProgress = false,

  likeCount = 0,

  commentCount = 0,

  likedByMe = false,

  onLike,

  onLikeCountPress,

  onComment,

  onShare,

  savedByMe = false,

  onSave,

  isOwner = false,

  onDelete,

  competitionCount = 0,

  competitionLabel = 'Competition',

}: DareCardProps) {

  const handlePrimaryPress = () => {

    if (loading) {

      return;

    }

    if (inProgress) {

      onPress?.();

      return;

    }

    console.log('[DareCard] TAKE THE DARE:', dare.id);

    if (onPrimaryAction) {

      onPrimaryAction();

      return;

    }

    onPress?.();

  };

  // Start from a cached signed URL (or a remote URL), never the raw R2 key:

  // a key is not a loadable URL and fails until the effect below resolves it.

  const [resolvedMediaUrl, setResolvedMediaUrl] =

    useState<string | null>(() => peekFeedMediaUrl(dare.mediaUrl));

  // True while a stored R2 key is still being exchanged for a signed URL.

  const [isMediaPending, setIsMediaPending] = useState(

    () => !!dare.mediaUrl?.trim() && !peekFeedMediaUrl(dare.mediaUrl),

  );

  // Video audio starts muted. This state only controls the transparent

  // mute/unmute button shown over video media.

  const [isVideoMuted, setIsVideoMuted] = useState(true);

  useEffect(() => {

    let cancelled = false;

    const resolveMedia = async () => {

      const raw = dare.mediaUrl?.trim() ?? '';

      if (!raw) {

        if (!cancelled) {

          setResolvedMediaUrl(null);

          setIsMediaPending(false);

        }

        return;

      }

      const cached = peekFeedMediaUrl(raw);

      if (!cancelled) {

        setResolvedMediaUrl(cached);

        setIsMediaPending(!cached);

      }

      const resolved = await resolveFeedMediaUrl(raw);

      if (!cancelled) {

        setResolvedMediaUrl(resolved);

        setIsMediaPending(false);

      }

      if (dare.mediaType === 'image' && resolved) {

        void prefetchFeedImage(resolved);

      }

    };

    void resolveMedia();

    return () => {

      cancelled = true;

    };

  }, [dare.id, dare.mediaType, dare.mediaUrl]);

  const hasImageMedia =

    dare.mediaType === 'image' &&

    !!resolvedMediaUrl;

  const hasVideoMedia =

    dare.mediaType === 'video' &&

    !!resolvedMediaUrl;

  const segments = useSegments();

  // Expo Router includes the concrete tab route (usually `index`) in the

  // segment list. The previous length===1 check therefore treated Home as

  // inactive and paused every video. Keep this check tolerant of both shapes.

  const isHomeTab = segments[0] === '(tabs)';

  // Keep one stable player instance. R2 signed URLs are resolved after the

  // card mounts, so the source must be attached with replaceAsync(). Passing

  // null first and expecting useVideoPlayer() to hot-swap the source is not

  // reliable for this feed.

  const videoPlayer = useVideoPlayer(null, (player) => {

    player.loop = true;

    player.muted = true;

  });

  // Attach the resolved R2 URL to the native player. replaceAsync() is the

  // supported expo-video path for a player that was created with null.

  useEffect(() => {

    let cancelled = false;

    const loadVideoSource = async () => {

      if (!hasVideoMedia || !resolvedMediaUrl || (!isVideoActive && !preloadVideo)) {

        videoPlayer.pause();

        return;

      }

      try {

        await videoPlayer.replaceAsync(resolvedMediaUrl);

        if (!cancelled) {

          videoPlayer.muted = true;

          if (isHomeTab && isVideoActive) {

            videoPlayer.play();

          } else {

            videoPlayer.pause();

          }

        }

      } catch (error) {

        console.error('[DareCard] Video source load failed:', {

          dareId: dare.id,

          mediaUrl: resolvedMediaUrl,

          error,

        });

      }

    };

    void loadVideoSource();

    return () => {

      cancelled = true;

    };

  }, [dare.id, hasVideoMedia, resolvedMediaUrl, isHomeTab, isVideoActive, preloadVideo, videoPlayer]);

  // Playback is controlled only by Home's active-card state.

  useEffect(() => {

    if (!hasVideoMedia || !resolvedMediaUrl) {

      return;

    }

    if (isHomeTab && isVideoActive) {

      videoPlayer.play();

    } else {

      videoPlayer.pause();

    }

  }, [hasVideoMedia, resolvedMediaUrl, isHomeTab, isVideoActive, videoPlayer]);

  useEffect(() => {

    setIsVideoMuted(true);

    if (hasVideoMedia) {

      videoPlayer.muted = true;

    }

  }, [dare.id, dare.mediaType, resolvedMediaUrl, hasVideoMedia, videoPlayer]);

  const toggleVideoMute = () => {

    if (!hasVideoMedia) {

      return;

    }

    const nextMuted = !isVideoMuted;

    videoPlayer.muted = nextMuted;

    setIsVideoMuted(nextMuted);

  };

  const coverSource =

    dare.difficulty === 'Easy'

      ? require('../../assets/dare-covers/easy-cover.jpg')

      : dare.difficulty === 'Medium'

        ? require('../../assets/dare-covers/medium-cover.jpg')

        : require('../../assets/dare-covers/hard-cover.jpg');

  return (

    <View style={styles.card} onLayout={onCardLayout}>

      {/* ================================================= */}

      {/* CINEMATIC DARE COVER                              */}

      {/* ================================================= */}

      <View style={styles.cover}>

        {hasImageMedia ? (

          <ImageBackground

            source={{ uri: resolvedMediaUrl! }}

            style={styles.coverMedia}

            imageStyle={styles.coverImage}

          />

        ) : hasVideoMedia ? (

          <>

            <VideoView

              player={videoPlayer}

              style={styles.coverMedia}

              contentFit="cover"

              nativeControls={false}

            />

            <Pressable

              style={styles.videoMuteButton}

              onPress={toggleVideoMute}

              accessibilityRole="button"

              accessibilityLabel={

                isVideoMuted ? 'Unmute video' : 'Mute video'

              }

              hitSlop={10}

            >

              <Ionicons

                name={

                  isVideoMuted

                    ? 'volume-mute-outline'

                    : 'volume-high-outline'

                }

                size={24}

                color="#FFFFFF"

              />

            </Pressable>

          </>

        ) : isMediaPending ? (

          // Plain surface while the signed URL loads, so the stock cover

          // doesn't flash before the real media.

          <View style={[styles.coverMedia, styles.coverPending]} />

        ) : (

          <ImageBackground

            source={coverSource}

            style={styles.coverMedia}

            imageStyle={styles.coverImage}

          />

        )}

        <View style={styles.coverOverlay} />

        {(onViewMore || timestampLabel) ? (
          <View style={styles.coverMeta}>
            {onViewMore ? (
              <Pressable
                onPress={onViewMore}
                accessibilityRole="button"
                accessibilityLabel="View more Dare details"
                hitSlop={8}
                style={styles.coverMetaButton}
              >
                <Text style={styles.coverMetaLink}>View More</Text>
              </Pressable>
            ) : null}

            {timestampLabel ? (
              <Text style={styles.coverMetaTimestamp}>{timestampLabel}</Text>
            ) : null}
          </View>
        ) : null}

        {/* OWNER MENU */}

        {isOwner && onDelete ? (

          <View style={styles.menuWrapper}>

            <Pressable

              style={styles.menuButton}

              onPress={onDelete}

              accessibilityRole="button"

              accessibilityLabel="Delete dare"

              hitSlop={10}

            >

              <Ionicons

                name="ellipsis-horizontal"

                size={24}

                color="#FFFFFF"

              />

            </Pressable>

          </View>

        ) : null}

        <View style={styles.coverContent}>

          <Text

            style={styles.coverTitle}

            numberOfLines={3}

          >

            {dare.title}

          </Text>

          {dare.description?.trim() ? (

            <Text style={styles.coverDescription} numberOfLines={3}>

              {dare.description.trim()}

            </Text>

          ) : null}

        </View>

      </View>

      {/* ================================================= */}

      {/* META                                              */}

      {/* ================================================= */}

      <View style={styles.metaRow}>

        <Text style={styles.meta}>

          +{dare.xpValue} XP

        </Text>

        <Text style={styles.metaDot}>

          ·

        </Text>

        <Text style={styles.meta}>

          {dare.proofType} proof

        </Text>

      </View>

      {/* ================================================= */}

      {/* PUBLIC DARE STATUS                                */}

      {/* ================================================= */}

      {competitionCount > 0 ? (

        <View style={styles.publicStatusRow}>

          <View style={styles.statusPill}>

            <Ionicons

              name="trophy-outline"

              size={15}

              color={colors.secondaryText}

            />

            <Text style={styles.statusText}>

              {competitionCount}{' '}

              {competitionLabel}

            </Text>

          </View>

        </View>

      ) : null}

      {/* ================================================= */}

      {/* SOCIAL ACTIONS                                    */}

      {/* ================================================= */}

      <View style={styles.actions}>

        {/* LIKE */}

        <View style={styles.likeActionGroup}>

          <Pressable

            style={styles.likeIconButton}

            onPress={onLike}

            disabled={!onLike}

            accessibilityRole="button"

            accessibilityLabel={

              likedByMe

                ? 'Unlike dare'

                : 'Like dare'

            }

          >

            <Ionicons

              name={

                likedByMe

                  ? 'heart'

                  : 'heart-outline'

              }

              size={22}

              color={

                likedByMe

                  ? '#FF4D67'

                  : colors.primaryText

              }

            />

          </Pressable>

          <Pressable

            style={styles.likeCountButton}

            onPress={onLikeCountPress}

            disabled={

              !onLikeCountPress ||

              likeCount === 0

            }

            accessibilityRole="button"

            accessibilityLabel="View people who liked this dare"

          >

            <Text

              style={[

                styles.actionText,

                likedByMe && styles.likedText,

              ]}

            >

              {likeCount > 0

                ? likeCount

                : 'Like'}

            </Text>

          </Pressable>

        </View>

        {/* COMMENT */}

        <Pressable

          style={styles.actionButton}

          onPress={onComment}

          disabled={!onComment}

          accessibilityRole="button"

          accessibilityLabel="Open comments"

        >

          <Ionicons

            name="chatbubble-outline"

            size={21}

            color={colors.primaryText}

          />

          <Text style={styles.actionText}>

            {commentCount > 0

              ? commentCount

              : 'Comment'}

          </Text>

        </Pressable>

        {/* SHARE */}

        <Pressable

          style={styles.actionButton}

          onPress={onShare}

          disabled={!onShare}

          accessibilityRole="button"

          accessibilityLabel="Share dare"

        >

          <Ionicons

            name="paper-plane-outline"

            size={21}

            color={colors.primaryText}

          />

          <Text style={styles.actionText}>

            Share

          </Text>

        </Pressable>

        {/* SAVE */}

        <Pressable

          style={styles.actionButton}

          onPress={onSave}

          disabled={!onSave}

          accessibilityRole="button"

          accessibilityLabel={

            savedByMe

              ? 'Remove dare from saved'

              : 'Save dare'

          }

        >

          <Ionicons

            name={

              savedByMe

                ? 'bookmark'

                : 'bookmark-outline'

            }

            size={21}

            color={colors.primaryText}

          />

          <Text style={styles.actionText}>

            {savedByMe

              ? 'Saved'

              : 'Save'}

          </Text>

        </Pressable>

      </View>

      {/* ================================================= */}

      {/* CTA                                               */}

      {/* ================================================= */}

      <Pressable

        onPress={handlePrimaryPress}

        disabled={loading}

        accessibilityRole="button"

        accessibilityLabel={`Take the dare: ${dare.title}`}

        testID={`take-dare-${dare.id}`}

        style={({ pressed }) => [

          styles.cta,

          pressed && styles.ctaPressed,

        ]}

      >

        <Text style={styles.ctaLabel}>

          {loading

            ? 'Starting Dare...'

            : inProgress

              ? 'IN PROGRESS'

              : 'TAKE THE DARE'}

        </Text>

      </Pressable>

    </View>

  );

}

const styles = StyleSheet.create({

  card: {

    backgroundColor: colors.surface,

    borderRadius: radius.xl,

    padding: spacing.lg,

    marginBottom: spacing.lg,

    borderWidth: 1,

    borderColor: colors.border,

  },

  cover: {

    width: '100%',

    height: 330,

    borderRadius: radius.lg,

    marginBottom: spacing.lg,

    overflow: 'hidden',

    justifyContent: 'flex-end',

    alignSelf: 'stretch',

  },

  coverPending: {

    backgroundColor: colors.surfaceElevated,

  },

  coverMedia: {

    ...StyleSheet.absoluteFill,

    width: '100%',

    height: '100%',

  },

  coverImage: {

    borderRadius: radius.lg,

    resizeMode: 'cover',

  },

  videoMuteButton: {

    position: 'absolute',

    right: spacing.md,

    // Keep the mute control clearly above the View More + timestamp stack.
    bottom: 108,

    zIndex: 9,

    alignItems: 'center',

    justifyContent: 'center',

    padding: spacing.xs,

    backgroundColor: 'transparent',

  },

  coverOverlay: {

    position: 'absolute',

    top: 0,

    right: 0,

    bottom: 0,

    left: 0,

    backgroundColor: 'rgba(0, 0, 0, 0.22)',

  },

  coverMeta: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    zIndex: 10,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },

  coverMetaButton: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },

  coverMetaLink: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  coverMetaTimestamp: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },

  menuWrapper: {

    position: 'absolute',

    top: spacing.md,

    right: spacing.md,

    zIndex: 10,

  },

  menuButton: {

    width: 42,

    height: 42,

    borderRadius: 21,

    backgroundColor: 'rgba(0, 0, 0, 0.45)',

    alignItems: 'center',

    justifyContent: 'center',

  },

  coverContent: {

    padding: spacing.lg,

  },

  coverDescription: {
    marginTop: spacing.xs,
    color: 'rgba(255, 255, 255, 0.92)',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    maxWidth: '92%',
  },

  coverTitle: {

    color: '#FFFFFF',

    fontFamily: fontFamily.headingBold,

    fontSize: fontSize.xxl,

    lineHeight: 38,

  },

  metaRow: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: spacing.md,

  },

  meta: {

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.sm,

  },

  metaDot: {

    color: colors.secondaryText,

    fontFamily: fontFamily.body,

    fontSize: fontSize.sm,

    marginHorizontal: spacing.xs,

  },

  /* =====================================================

     PUBLIC DARE STATUS

     ===================================================== */

  publicStatusRow: {

    flexDirection: 'row',

    alignItems: 'center',

    flexWrap: 'wrap',

    gap: spacing.sm,

    marginBottom: spacing.md,

  },

  statusPill: {

    minHeight: 30,

    paddingHorizontal: spacing.sm,

    borderRadius: radius.md,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.background,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,

  },

  statusText: {

    color: colors.secondaryText,

    fontFamily: fontFamily.bodyMedium,

    fontSize: fontSize.xs,

  },

  /* =====================================================

     SOCIAL ACTION STYLES

     ===================================================== */

  actions: {

    flexDirection: 'row',

    alignItems: 'center',

    borderTopWidth: 1,

    borderTopColor: colors.border,

    paddingTop: spacing.sm,

    marginBottom: spacing.md,

    gap: spacing.lg,

  },

  likeActionGroup: {

    flexDirection: 'row',

    alignItems: 'center',

  },

  likeIconButton: {

    minHeight: 38,

    alignItems: 'center',

    justifyContent: 'center',

  },

  likeCountButton: {

    minHeight: 38,

    alignItems: 'center',

    justifyContent: 'center',

    marginLeft: spacing.xs,

  },

  actionButton: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.xs,

    minHeight: 38,

  },

  actionText: {

    color: colors.secondaryText,

    fontFamily: fontFamily.bodyMedium,

    fontSize: fontSize.sm,

  },

  likedText: {

    color: '#FF4D67',

  },

  /* =====================================================

     CTA

     ===================================================== */

  cta: {

    minHeight: 50,

    borderRadius: radius.md,

    backgroundColor: colors.accent,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: spacing.lg,

    marginTop: spacing.xs,

  },

  ctaPressed: {

    opacity: 0.75,

  },

  ctaLabel: {

    color: '#000000',

    fontFamily: fontFamily.bodyMedium,

    fontSize: fontSize.md,

    fontWeight: '700',

    letterSpacing: 0.2,

  },

});
