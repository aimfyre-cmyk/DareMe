import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

/* ============================================================
 * GLOBAL SINGLE-PLAYER REGISTRY
 * ============================================================ */

let activePlayerId: string | null = null;

type PlayerControls = {
  pause: () => void;
};

const activePlayers = new Map<string, PlayerControls>();

/*
 * Native expo-video players can be released during unmount.
 * Never allow a stale/released player to crash the app.
 */
function safePause(player: {
  pause: () => void;
}) {
  try {
    player.pause();
  } catch {
    /*
     * The native player may already have been released.
     * Nothing needs to be done in that case.
     */
  }
}

function claimPlayer(id: string, pauseOthers: boolean) {
  if (!pauseOthers) {
    activePlayerId = id;
    return;
  }

  if (activePlayerId === id) {
    return;
  }

  activePlayers.forEach((controls, otherId) => {
    if (otherId !== id) {
      controls.pause();
    }
  });

  activePlayerId = id;
}

/* ============================================================
 * PROPS
 * ============================================================ */

export type FeedVideoProps = {
  uri: string;

  scrollY?: number;

  screenFocused?: boolean;

  /*
   * When supplied:
   *   true  = active video
   *   false = inactive video
   *
   * When undefined:
   *   FeedVideo uses its own visibility calculation.
   */
  active?: boolean;

  posterUri?: string | null;

  contentFit?: 'contain' | 'cover' | 'fill';

  /**
   * Existing Discover / DareCard compatibility.
   */
  mutedByDefault?: boolean;

  /**
   * Existing Discover / DareCard layout compatibility.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Existing DareCard compatibility.
   */
  onControlsReady?: (
    controls: {
      play: () => void;
      pause: () => void;
    } | null,
  ) => void;
};

/* ============================================================
 * COMPONENT
 * ============================================================ */

export function FeedVideo({
  uri,
  scrollY = 0,
  screenFocused = true,
  active,
  posterUri,
  contentFit = 'contain',
  mutedByDefault = true,
  style,
  onControlsReady,
}: FeedVideoProps) {
  const idRef = useRef(
    `${uri}:${Math.random().toString(36).slice(2)}`,
  );

  /*
   * Critical lifecycle guard.
   *
   * Once the component starts unmounting, no delayed callback
   * is allowed to call the native player.
   */
  const mountedRef = useRef(true);

  const [muted, setMuted] = useState(mutedByDefault);

  const [showPoster, setShowPoster] = useState(
    Boolean(posterUri),
  );

  const containerRef = useRef<View>(null);

  /* ==========================================================
   * VIDEO PLAYER
   * ========================================================== */

  const player = useVideoPlayer(
    {
      uri,
      useCaching: true,
    },
    (videoPlayer) => {
      videoPlayer.loop = true;
      videoPlayer.muted = mutedByDefault;
    },
  );

  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const shouldUseVisibility = active === undefined;

  /* ==========================================================
   * SAFE PLAYER HELPERS
   * ========================================================== */

  const pauseCurrentPlayer = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    safePause(player);

    if (activePlayerId === idRef.current) {
      activePlayerId = null;
    }
  }, [player]);

  const playCurrentPlayer = useCallback(() => {
    if (!mountedRef.current || !screenFocused) {
      return;
    }

    claimPlayer(idRef.current, true);

    try {
      player.muted = muted;

      if (status === 'readyToPlay') {
        player.play();
      }
    } catch {
      /*
       * Player may have been released between the lifecycle
       * check and native call.
       */
    }
  }, [
    muted,
    player,
    screenFocused,
    status,
  ]);

  /* ==========================================================
   * PLAYBACK / VISIBILITY
   * ========================================================== */

  const updatePlayback = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (!screenFocused) {
      pauseCurrentPlayer();
      return;
    }

    /*
     * ========================================================
     * EXPLICIT ACTIVE MODE
     * ========================================================
     *
     * Home / Discover normally use this mode.
     */

    if (!shouldUseVisibility) {
      if (active) {
        playCurrentPlayer();
      } else {
        pauseCurrentPlayer();
      }

      return;
    }

    /*
     * ========================================================
     * VISIBILITY FALLBACK MODE
     * ========================================================
     */

    containerRef.current?.measureInWindow(
      (_x, y, _width, height) => {
        /*
         * The measurement callback can execute after unmount.
         */
        if (!mountedRef.current) {
          return;
        }

        const viewportHeight =
          Dimensions.get('window').height;

        if (height <= 0 || viewportHeight <= 0) {
          pauseCurrentPlayer();
          return;
        }

        const visibleHeight = Math.max(
          0,
          Math.min(
            y + height,
            viewportHeight,
          ) -
            Math.max(y, 0),
        );

        const visibleRatio =
          visibleHeight / height;

        const shouldPlay =
          visibleRatio >= 0.5;

        if (
          shouldPlay &&
          status === 'readyToPlay'
        ) {
          playCurrentPlayer();
        } else {
          pauseCurrentPlayer();
        }
      },
    );
  }, [
    active,
    pauseCurrentPlayer,
    playCurrentPlayer,
    screenFocused,
    shouldUseVisibility,
    status,
    scrollY,
  ]);

  /* ==========================================================
   * GLOBAL REGISTRATION
   * ========================================================== */

  useEffect(() => {
    mountedRef.current = true;

    const playerId = idRef.current;

    activePlayers.set(playerId, {
      pause: () => {
        /*
         * Important:
         * Never call a released native player.
         */
        if (!mountedRef.current) {
          return;
        }

        safePause(player);

        if (activePlayerId === playerId) {
          activePlayerId = null;
        }
      },
    });

    return () => {
      /*
       * Mark unmounted FIRST.
       *
       * This prevents any later global pause callback,
       * measurement callback, or effect from touching
       * the native player.
       */
      mountedRef.current = false;

      /*
       * Remove from global registry BEFORE native player
       * gets released by expo-video.
       */
      activePlayers.delete(playerId);

      if (activePlayerId === playerId) {
        activePlayerId = null;
      }

      /*
       * IMPORTANT:
       *
       * Do NOT call player.pause() here.
       *
       * expo-video releases the player automatically.
       * Calling pause() during teardown can hit the
       * "shared object already released" native error.
       */
    };
  }, [player]);

  /* ==========================================================
   * POSTER RESET
   * ========================================================== */

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    setShowPoster(Boolean(posterUri));
  }, [posterUri, uri]);

  /* ==========================================================
   * PLAYBACK SYNC
   * ========================================================== */

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    updatePlayback();
  }, [updatePlayback]);

  /* ==========================================================
   * PLAYER READY
   * ========================================================== */

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    if (status !== 'readyToPlay') {
      return;
    }

    setShowPoster(false);

    const timer = setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      updatePlayback();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [status, updatePlayback]);

  /* ==========================================================
   * MUTE / UNMUTE
   * ========================================================== */

  const toggleMute = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    const nextMuted = !muted;

    try {
      player.muted = nextMuted;
      setMuted(nextMuted);
    } catch {
      /*
       * Ignore native lifecycle race.
       */
    }
  }, [muted, player]);

  /* ==========================================================
   * EXTERNAL PLAY CONTROL
   * ========================================================== */

  const play = useCallback(() => {
    if (!mountedRef.current || !screenFocused) {
      return;
    }

    playCurrentPlayer();
  }, [
    playCurrentPlayer,
    screenFocused,
  ]);

  /* ==========================================================
   * EXTERNAL PAUSE CONTROL
   * ========================================================== */

  const pause = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    pauseCurrentPlayer();
  }, [pauseCurrentPlayer]);

  /* ==========================================================
   * CONTROLS CALLBACK
   * ========================================================== */

  useEffect(() => {
    if (!onControlsReady) {
      return;
    }

    if (!mountedRef.current) {
      return;
    }

    onControlsReady({
      play,
      pause,
    });

    return () => {
      /*
       * Don't invoke callback with stale native controls
       * after unmount.
       */
      try {
        onControlsReady(null);
      } catch {
        // Ignore parent teardown race.
      }
    };
  }, [
    onControlsReady,
    pause,
    play,
  ]);

  /* ==========================================================
   * UI
   * ========================================================== */

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        style,
      ]}
    >
      {showPoster && posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={StyleSheet.absoluteFill}
          resizeMode={
            contentFit === 'contain'
              ? 'contain'
              : 'cover'
          }
        />
      ) : null}

      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        nativeControls={false}
        playsInline
      />

      <Pressable
        onPress={toggleMute}
        style={styles.muteButton}
        accessibilityRole="button"
        accessibilityLabel={
          muted
            ? 'Unmute video'
            : 'Mute video'
        }
      >
        <View style={styles.muteGlyph} />
      </Pressable>
    </View>
  );
}

/* ============================================================
 * STYLES
 * ============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },

  video: {
    width: '100%',
    height: '100%',
  },

  muteButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  muteGlyph: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 2,
  },
});