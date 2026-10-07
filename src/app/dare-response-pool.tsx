import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    useCallback,
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Screen } from '../components/Screen';
import { supabase } from '../lib/supabase';

type ResponseItem = {
  participantId: string;
  userId: string;
  resultPostId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string | null;
};

type DareInfo = {
  id: string;
  title: string;
  description: string | null;
  votingEnabled: boolean;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
};

type ParticipantRow = {
  id: string;
  user_id: string;
  result_post_id: string | null;
  result_posted: boolean;
  result_posted_at: string | null;
};

type PostRow = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  dare_id: string | null;
  created_at: string | null;
};

const getParamValue = (
  value:
    | string
    | string[]
    | undefined,
): string => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

const formatDate = (
  value: string | null,
): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
};

const isImageMedia = (
  mediaType: string | null,
): boolean => {
  if (!mediaType) {
    return false;
  }

  return mediaType
    .toLowerCase()
    .startsWith('image');
};

const isVideoMedia = (
  mediaType: string | null,
): boolean => {
  if (!mediaType) {
    return false;
  }

  return mediaType
    .toLowerCase()
    .startsWith('video');
};

export default function DareResponsePoolScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    dareId?: string;
  }>();

  const dareId = getParamValue(
    params.dareId,
  );

  const [
    dare,
    setDare,
  ] = useState<DareInfo | null>(null);

  const [
    responses,
    setResponses,
  ] = useState<ResponseItem[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const loadResponsePool = useCallback(
    async () => {
      if (!dareId) {
        setErrorMessage(
          'Dare ID is missing.',
        );
        setLoading(false);
        return;
      }

      setErrorMessage(null);

      try {
        /*
         * =================================================
         * LOAD DARE
         * =================================================
         */

        const {
          data: dareData,
          error: dareError,
        } = await supabase
          .from('dares')
          .select(
            [
              'id',
              'title',
              'description',
              'voting_enabled',
              'voting_starts_at',
              'voting_ends_at',
            ].join(','),
          )
          .eq('id', dareId)
          .maybeSingle();

        if (dareError) {
          throw dareError;
        }

        if (!dareData) {
          throw new Error(
            'Dare not found.',
          );
        }

        const dareRecord =
  dareData as unknown as {
    id: string;
    title: string;
    description: string | null;
    voting_enabled: boolean;
    voting_starts_at: string | null;
    voting_ends_at: string | null;
  };

setDare({
  id: dareRecord.id,
  title: dareRecord.title,
  description:
    dareRecord.description ?? null,
  votingEnabled:
    dareRecord.voting_enabled === true,
  votingStartsAt:
    dareRecord.voting_starts_at ?? null,
  votingEndsAt:
    dareRecord.voting_ends_at ?? null,
});

        /*
         * =================================================
         * LOAD COMPLETED RESULT PARTICIPANTS
         * =================================================
         */

        const {
          data: participantData,
          error: participantError,
        } = await supabase
          .from('dare_participants')
          .select(
            [
              'id',
              'user_id',
              'result_post_id',
              'result_posted',
              'result_posted_at',
            ].join(','),
          )
          .eq('dare_id', dareId)
          .eq('result_posted', true)
          .not(
            'result_post_id',
            'is',
            null,
          )
          .order(
            'result_posted_at',
            {
              ascending: false,
            },
          );

        if (participantError) {
          throw participantError;
        }

        const participants =
  (participantData ??
    []) as unknown as ParticipantRow[];

        if (
          participants.length === 0
        ) {
          setResponses([]);
          return;
        }

        /*
         * =================================================
         * LOAD RESULT POSTS
         * =================================================
         */

        const resultPostIds =
          participants
            .map(
              (
                participant,
              ) =>
                participant.result_post_id,
            )
            .filter(
              (
                postId,
              ): postId is string =>
                Boolean(postId),
            );

        if (
          resultPostIds.length === 0
        ) {
          setResponses([]);
          return;
        }

        const {
          data: postData,
          error: postError,
        } = await supabase
          .from('posts')
          .select(
            [
              'id',
              'user_id',
              'content',
              'media_url',
              'media_type',
              'dare_id',
              'created_at',
            ].join(','),
          )
          .in(
            'id',
            resultPostIds,
          )
          .eq(
            'dare_id',
            dareId,
          );

        if (postError) {
          throw postError;
        }

        const posts =
  (postData ??
    []) as unknown as PostRow[];

        /*
         * =================================================
         * COMBINE PARTICIPANT + POST
         * =================================================
         */

        const postMap =
          new Map<
            string,
            PostRow
          >();

        posts.forEach(
          (post) => {
            postMap.set(
              post.id,
              post,
            );
          },
        );

        const mappedResponses =
          participants
            .map(
              (
                participant,
              ): ResponseItem | null => {
                if (
                  !participant.result_post_id
                ) {
                  return null;
                }

                const post =
                  postMap.get(
                    participant.result_post_id,
                  );

                if (!post) {
                  return null;
                }

                return {
                  participantId:
                    participant.id,
                  userId:
                    participant.user_id,
                  resultPostId:
                    post.id,
                  content:
                    post.content ??
                    null,
                  mediaUrl:
                    post.media_url ??
                    null,
                  mediaType:
                    post.media_type ??
                    null,
                  createdAt:
                    post.created_at ??
                    participant.result_posted_at ??
                    null,
                };
              },
            )
            .filter(
              (
                item,
              ): item is ResponseItem =>
                item !== null,
            );

        setResponses(
          mappedResponses,
        );
      } catch (error) {
        console.error(
          'Load Dare Response Pool error:',
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not load Dare responses.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dareId],
  );

  useEffect(() => {
    loadResponsePool();
  }, [
    loadResponsePool,
  ]);

  const handleRefresh =
    useCallback(() => {
      setRefreshing(true);
      loadResponsePool();
    }, [
      loadResponsePool,
    ]);

  const handleOpenResult = (
    response: ResponseItem,
  ) => {
    /*
     * Result post viewer/navigation
     * can be connected to the existing
     * post detail screen later.
     */
    console.log(
      'Open Dare result:',
      response.resultPostId,
    );
  };

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (loading) {
    return (
      <Screen>
        <View
          style={
            styles.centerContainer
          }
        >
          <ActivityIndicator
            size="large"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading responses...
          </Text>
        </View>
      </Screen>
    );
  }

  /*
   * =====================================================
   * ERROR
   * =====================================================
   */

  if (
    errorMessage &&
    !dare
  ) {
    return (
      <Screen>
        <View
          style={
            styles.centerContainer
          }
        >
          <Text
            style={styles.errorTitle}
          >
            Something went wrong
          </Text>

          <Text
            style={
              styles.errorMessage
            }
          >
            {errorMessage}
          </Text>

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={() => {
              setLoading(true);
              loadResponsePool();
            }}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  /*
   * =====================================================
   * MAIN UI
   * =====================================================
   */

  return (
    <Screen>
      <View style={styles.container}>
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
            hitSlop={10}
          >
            <Text
              style={styles.backText}
            >
              ‹ Back
            </Text>
          </Pressable>

          <Text
            style={styles.headerTitle}
            numberOfLines={1}
          >
            Response Pool
          </Text>

          <View
            style={styles.headerSpacer}
          />
        </View>

        <ScrollView
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                handleRefresh
              }
            />
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          {/* =================================================
              DARE INFO
              ================================================= */}

          {dare && (
            <View
              style={
                styles.dareHeader
              }
            >
              <Text
                style={
                  styles.dareTitle
                }
              >
                {dare.title}
              </Text>

              {!!dare.description && (
                <Text
                  style={
                    styles.dareDescription
                  }
                >
                  {dare.description}
                </Text>
              )}

              <View
                style={
                  styles.poolMeta
                }
              >
                <Text
                  style={
                    styles.poolMetaText
                  }
                >
                  {responses.length}{' '}
                  {responses.length ===
                  1
                    ? 'Result'
                    : 'Results'}
                </Text>

                <View
                  style={
                    styles.metaDot
                  }
                />

                <Text
                  style={
                    styles.poolMetaText
                  }
                >
                  {dare.votingEnabled
                    ? 'Voting enabled'
                    : 'Display only'}
                </Text>
              </View>
            </View>
          )}

          {/* =================================================
              VOTING STATUS
              ================================================= */}

          {dare?.votingEnabled && (
            <View
              style={
                styles.votingBanner
              }
            >
              <Text
                style={
                  styles.votingTitle
                }
              >
                Voting
              </Text>

              <Text
                style={
                  styles.votingText
                }
              >
                {dare.votingStartsAt &&
                dare.votingEndsAt
                  ? `Voting period: ${formatDate(
                      dare.votingStartsAt,
                    )} – ${formatDate(
                      dare.votingEndsAt,
                    )}`
                  : 'Voting is enabled for this Dare.'}
              </Text>
            </View>
          )}

          {/* =================================================
              EMPTY STATE
              ================================================= */}

          {responses.length ===
            0 && (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                ◇
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No results yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Completed Dare results
                will appear here once
                participants post them.
              </Text>
            </View>
          )}

          {/* =================================================
              RESPONSE CARDS
              ================================================= */}

          {responses.map(
            (response, index) => (
              <Pressable
                key={
                  response.participantId
                }
                style={
                  styles.responseCard
                }
                onPress={() =>
                  handleOpenResult(
                    response,
                  )
                }
              >
                <View
                  style={
                    styles.responseHeader
                  }
                >
                  <View
                    style={
                      styles.resultNumber
                    }
                  >
                    <Text
                      style={
                        styles.resultNumberText
                      }
                    >
                      {index + 1}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.resultHeaderText
                    }
                  >
                    <Text
                      style={
                        styles.resultLabel
                      }
                    >
                      Dare Result
                    </Text>

                    {!!response.createdAt && (
                      <Text
                        style={
                          styles.resultDate
                        }
                      >
                        {formatDate(
                          response.createdAt,
                        )}
                      </Text>
                    )}
                  </View>

                  {dare?.votingEnabled && (
                    <View
                      style={
                        styles.votePlaceholder
                      }
                    >
                      <Text
                        style={
                          styles.votePlaceholderText
                        }
                      >
                        Vote
                      </Text>
                    </View>
                  )}
                </View>

                {/* =================================================
                    MEDIA
                    ================================================= */}

                {!!response.mediaUrl &&
                  isImageMedia(
                    response.mediaType,
                  ) && (
                    <Image
                      source={{
                        uri: response.mediaUrl,
                      }}
                      style={
                        styles.resultImage
                      }
                      resizeMode="cover"
                    />
                  )}

                {!!response.mediaUrl &&
                  isVideoMedia(
                    response.mediaType,
                  ) && (
                    <View
                      style={
                        styles.videoPlaceholder
                      }
                    >
                      <Text
                        style={
                          styles.videoIcon
                        }
                      >
                        ▶
                      </Text>

                      <Text
                        style={
                          styles.videoText
                        }
                      >
                        Video Result
                      </Text>
                    </View>
                  )}

                {!!response.content && (
                  <Text
                    style={
                      styles.resultContent
                    }
                  >
                    {response.content}
                  </Text>
                )}

                {!response.mediaUrl &&
                  !response.content && (
                    <Text
                      style={
                        styles.noContentText
                      }
                    >
                      Result post
                    </Text>
                  )}
              </Pressable>
            ),
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    opacity: 0.65,
  },

  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9D9D9',
  },

  backText: {
    fontSize: 16,
    fontWeight: '600',
  },

  headerTitle: {
    flex: 1,
    marginHorizontal: 16,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },

  headerSpacer: {
    width: 48,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  dareHeader: {
    marginBottom: 16,
  },

  dareTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },

  dareDescription: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.72,
  },

  poolMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  poolMetaText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.65,
  },

  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
    backgroundColor: '#777777',
  },

  votingBanner: {
    padding: 14,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },

  votingTitle: {
    fontSize: 14,
    fontWeight: '800',
  },

  votingText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.7,
  },

  responseCard: {
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },

  responseHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  resultNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8D8D8',
  },

  resultNumberText: {
    fontSize: 14,
    fontWeight: '800',
  },

  resultHeaderText: {
    flex: 1,
    marginLeft: 10,
  },

  resultLabel: {
    fontSize: 15,
    fontWeight: '700',
  },

  resultDate: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0.55,
  },

  votePlaceholder: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },

  votePlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
  },

  resultImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#EEEEEE',
  },

  videoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEEEE',
  },

  videoIcon: {
    fontSize: 32,
    fontWeight: '800',
  },

  videoText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },

  resultContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    fontSize: 15,
    lineHeight: 21,
  },

  noContentText: {
    padding: 14,
    fontSize: 14,
    opacity: 0.55,
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 70,
  },

  emptyIcon: {
    fontSize: 34,
    opacity: 0.45,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '800',
  },

  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.62,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },

  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.65,
  },

  primaryButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111111',
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});