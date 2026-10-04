import {
  router,
  useFocusEffect,
} from 'expo-router';

import { useCallback, useState } from 'react';

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

import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../../constants/theme';

import { transitionDare } from '../../lib/dareTransitions';
import { supabase } from '../../lib/supabase';

type DareTab =
  | 'Received'
  | 'Sent'
  | 'Active'
  | 'Completed';

type DareData = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  xp_value: number;
  proof_type: string;
  time_limit_minutes: number | null;
};

type ActiveDare = {
  id: string;
  dare_id: string;
  state: string;
  dare: DareData;
};

type CompletedDare = {
  id: string;
  dare_id: string;
  state: string;
  completed_at: string | null;
  dare: DareData;
};

const tabs: DareTab[] = [
  'Received',
  'Sent',
  'Active',
  'Completed',
];

export default function DaresScreen() {
  const [activeTab, setActiveTab] =
    useState<DareTab>('Active');

  const [activeDares, setActiveDares] =
    useState<ActiveDare[]>([]);

  const [completedDares, setCompletedDares] =
    useState<CompletedDare[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [completedLoading, setCompletedLoading] =
    useState(false);

  const [startingId, setStartingId] =
    useState<string | null>(null);

  const [submittingId, setSubmittingId] =
    useState<string | null>(null);

  const [verifyingId, setVerifyingId] =
    useState<string | null>(null);

  const [completingId, setCompletingId] =
    useState<string | null>(null);

  const [selectedDareId, setSelectedDareId] =
    useState<string | null>(null);

  const [proofText, setProofText] =
    useState<Record<string, string>>({});

  /*
   * LOAD ACTIVE DARES
   */
  const loadActiveDares = useCallback(
    async () => {
      setLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setActiveDares([]);
          setSelectedDareId(null);
          return;
        }

        const {
          data: participants,
          error: participantError,
        } = await supabase
          .from('dare_participants')
          .select('id, dare_id, state')
          .eq('user_id', user.id)
          .in('state', [
            'ACCEPTED',
            'IN_PROGRESS',
            'SUBMITTED',
            'VERIFIED',
          ])
          .order('id', {
            ascending: false,
          });

        if (participantError) {
          throw participantError;
        }

        if (
          !participants ||
          participants.length === 0
        ) {
          setActiveDares([]);
          setSelectedDareId(null);
          return;
        }

        const dareIds = [
          ...new Set(
            participants.map(
              (participant) =>
                participant.dare_id,
            ),
          ),
        ];

        const {
          data: dares,
          error: dareError,
        } = await supabase
          .from('dares')
          .select(
            'id,title,description,category,difficulty,xp_value,proof_type,time_limit_minutes',
          )
          .in('id', dareIds);

        if (dareError) {
          throw dareError;
        }

        const dareMap = new Map(
          (dares ?? []).map((dare) => [
            dare.id,
            dare,
          ]),
        );

        const combined = participants
          .map((participant) => {
            const dare = dareMap.get(
              participant.dare_id,
            );

            if (!dare) {
              return null;
            }

            return {
              id: participant.id,
              dare_id: participant.dare_id,
              state: participant.state,
              dare,
            };
          })
          .filter(
            (item): item is ActiveDare =>
              item !== null,
          );

        setActiveDares(combined);

        setSelectedDareId((current) => {
          if (
            current &&
            combined.some(
              (item) =>
                item.id === current,
            )
          ) {
            return current;
          }

          const inProgress =
            combined.find(
              (item) =>
                item.state ===
                'IN_PROGRESS',
            );

          return inProgress?.id ?? null;
        });
      } catch (error) {
        console.error(
          '[Dares] Failed to load active dares:',
          error,
        );

        Alert.alert(
          'Could not load dares',
          'Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /*
   * LOAD COMPLETED DARES
   */
  const loadCompletedDares =
    useCallback(
      async () => {
        setCompletedLoading(true);

        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            setCompletedDares([]);
            return;
          }

          const {
            data: participants,
            error: participantError,
          } = await supabase
            .from('dare_participants')
            .select(
              'id,dare_id,state,completed_at',
            )
            .eq('user_id', user.id)
            .eq('state', 'COMPLETED')
            .order('completed_at', {
              ascending: false,
            });

          if (participantError) {
            throw participantError;
          }

          if (
            !participants ||
            participants.length === 0
          ) {
            setCompletedDares([]);
            return;
          }

          const dareIds = [
            ...new Set(
              participants.map(
                (participant) =>
                  participant.dare_id,
              ),
            ),
          ];

          const {
            data: dares,
            error: dareError,
          } = await supabase
            .from('dares')
            .select(
              'id,title,description,category,difficulty,xp_value,proof_type,time_limit_minutes',
            )
            .in('id', dareIds);

          if (dareError) {
            throw dareError;
          }

          const dareMap = new Map(
            (dares ?? []).map((dare) => [
              dare.id,
              dare,
            ]),
          );

          const combined = participants
            .map((participant) => {
              const dare = dareMap.get(
                participant.dare_id,
              );

              if (!dare) {
                return null;
              }

              return {
                id: participant.id,
                dare_id: participant.dare_id,
                state: participant.state,
                completed_at:
                  participant.completed_at,
                dare,
              };
            })
            .filter(
              (
                item,
              ): item is CompletedDare =>
                item !== null,
            );

          setCompletedDares(combined);
        } catch (error) {
          console.error(
            '[Dares] Failed to load completed dares:',
            error,
          );

          Alert.alert(
            'Could not load completed dares',
            'Please try again.',
          );
        } finally {
          setCompletedLoading(false);
        }
      },
      [],
    );

  /*
   * REFRESH WHEN SCREEN GETS FOCUS
   */
  useFocusEffect(
    useCallback(() => {
      loadActiveDares();
      loadCompletedDares();
    }, [
      loadActiveDares,
      loadCompletedDares,
    ]),
  );

  /*
   * START DARE
   */
  const handleStartDare = async (
    participantId: string,
  ) => {
    if (
      startingId ||
      submittingId ||
      verifyingId ||
      completingId
    ) {
      return;
    }

    setStartingId(participantId);

    try {
      const result = await transitionDare(
        participantId,
        'start',
      );

      if (result.state !== 'IN_PROGRESS') {
        throw new Error(
          `Unexpected state: ${result.state}`,
        );
      }

      setActiveDares((current) =>
        current.map((item) =>
          item.id === participantId
            ? {
                ...item,
                state: 'IN_PROGRESS',
              }
            : item,
        ),
      );

      setSelectedDareId(participantId);

      Alert.alert(
        'Dare Started ⚡',
        'Your dare is now in progress.',
      );
    } catch (error) {
      console.error(
        '[Dares] Failed to start dare:',
        error,
      );

      Alert.alert(
        'Could not start dare',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      );
    } finally {
      setStartingId(null);
    }
  };

  /*
   * SUBMIT TEXT PROOF
   */
  const handleSubmitProof = async (
    participantId: string,
  ) => {
    if (
      submittingId ||
      startingId ||
      verifyingId ||
      completingId
    ) {
      return;
    }

    const text =
      proofText[participantId]?.trim() ?? '';

    if (!text) {
      Alert.alert(
        'Proof required',
        'Please describe what you did before submitting.',
      );
      return;
    }

    if (text.length < 10) {
      Alert.alert(
        'Proof is too short',
        'Please provide a little more detail about what you did.',
      );
      return;
    }

    setSubmittingId(participantId);

    try {
      const {
        error: proofError,
      } = await supabase
        .from('dare_proofs')
        .insert({
          participant_id: participantId,
          type: 'text',
          text_content: text,
        });

      if (proofError) {
        throw proofError;
      }

      const result = await transitionDare(
        participantId,
        'submit',
      );

      if (result.state !== 'SUBMITTED') {
        throw new Error(
          `Unexpected state: ${result.state}`,
        );
      }

      setActiveDares((current) =>
        current.map((item) =>
          item.id === participantId
            ? {
                ...item,
                state: 'SUBMITTED',
              }
            : item,
        ),
      );

      Alert.alert(
        'Proof Submitted ✓',
        'Your proof has been submitted for verification.',
      );
    } catch (error) {
      console.error(
        '[Dares] Failed to submit proof:',
        error,
      );

      Alert.alert(
        'Could not submit proof',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      );
    } finally {
      setSubmittingId(null);
    }
  };

  /*
   * CREATE DARE PROOF
   *
   * Photo/Post:
   *   /create-post
   *   dareParticipantId
   *   dareProofType=photo
   *
   * Video:
   *   /create-post
   *   dareParticipantId
   *   dareProofType=video
   */
  const handleCreateProof = (
    participantId: string,
    proofType: 'photo' | 'video',
  ) => {
    if (
      submittingId ||
      startingId ||
      verifyingId ||
      completingId
    ) {
      return;
    }

    router.push({
      pathname: '/create-post',
      params: {
        dareParticipantId: participantId,
        dareProofType: proofType,
      },
    });
  };

  /*
   * VERIFY PROOF
   *
   * DEV / TEST FLOW
   */
  const handleVerifyDare = async (
    participantId: string,
  ) => {
    if (
      verifyingId ||
      completingId ||
      submittingId ||
      startingId
    ) {
      return;
    }

    setVerifyingId(participantId);

    try {
      const result = await transitionDare(
        participantId,
        'verify',
      );

      if (result.state !== 'VERIFIED') {
        throw new Error(
          `Unexpected state: ${result.state}`,
        );
      }

      setActiveDares((current) =>
        current.map((item) =>
          item.id === participantId
            ? {
                ...item,
                state: 'VERIFIED',
              }
            : item,
        ),
      );

      Alert.alert(
        'Proof Verified ✓',
        'Proof verified successfully.',
      );
    } catch (error) {
      console.error(
        '[Dares] Failed to verify proof:',
        error,
      );

      Alert.alert(
        'Could not verify proof',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      );
    } finally {
      setVerifyingId(null);
    }
  };

  /*
   * COMPLETE DARE
   */
  const handleCompleteDare = async (
    participantId: string,
  ) => {
    if (
      completingId ||
      verifyingId ||
      submittingId ||
      startingId
    ) {
      return;
    }

    setCompletingId(participantId);

    try {
      const result = await transitionDare(
        participantId,
        'complete',
      );

      if (result.state !== 'COMPLETED') {
        throw new Error(
          `Unexpected state: ${result.state}`,
        );
      }

      setActiveDares((current) =>
        current.filter(
          (item) =>
            item.id !== participantId,
        ),
      );

      if (
        selectedDareId === participantId
      ) {
        setSelectedDareId(null);
      }

      await loadCompletedDares();

      Alert.alert(
        'Dare Completed 🎉',
        'You completed the dare and earned XP.',
      );
    } catch (error) {
      console.error(
        '[Dares] Failed to complete dare:',
        error,
      );

      Alert.alert(
        'Could not complete dare',
        error instanceof Error
          ? error.message
          : 'Please try again.',
      );
    } finally {
      setCompletingId(null);
    }
  };

  /*
   * ACTIVE DARE CARD
   */
  const renderActiveDare = (
    item: ActiveDare,
  ) => {
    const isSelected =
      selectedDareId === item.id;

    const isStarting =
      startingId === item.id;

    const isSubmitting =
      submittingId === item.id;

    const isVerifying =
      verifyingId === item.id;

    const isCompleting =
      completingId === item.id;

    const proofType =
      item.dare.proof_type
        .toLowerCase()
        .trim();

    const canStart =
      item.state === 'ACCEPTED';

    const canSubmitText =
      item.state === 'IN_PROGRESS' &&
      proofType === 'text' &&
      isSelected;

    const isPhotoProof =
      proofType === 'photo';

    const isVideoProof =
      proofType === 'video';

    const currentProof =
      proofText[item.id] ?? '';

    return (
      <View
        key={item.id}
        style={[
          styles.card,
          isSelected &&
            styles.cardSelected,
        ]}
      >
        <Pressable
          onPress={() => {
            if (
              item.state ===
                'IN_PROGRESS' ||
              item.state ===
                'SUBMITTED' ||
              item.state ===
                'VERIFIED'
            ) {
              setSelectedDareId(
                item.id,
              );
            }
          }}
        >
          <View style={styles.topRow}>
            <Text style={styles.category}>
              {item.dare.category.toUpperCase()}
            </Text>

            <Text
              style={
                item.state ===
                'COMPLETED'
                  ? styles.completedState
                  : styles.state
              }
            >
              {item.state}
            </Text>
          </View>

          <Text style={styles.title}>
            {item.dare.title}
          </Text>

          <Text style={styles.description}>
            {item.dare.description}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              +{item.dare.xp_value} XP
            </Text>

            <Text style={styles.dot}>
              ·
            </Text>

            <Text style={styles.meta}>
              {proofType === 'photo'
                ? 'Photo / Post proof'
                : proofType === 'video'
                  ? 'Video proof'
                  : 'Text proof'}
            </Text>

            {item.dare
              .time_limit_minutes !==
              null && (
              <>
                <Text
                  style={styles.dot}
                >
                  ·
                </Text>

                <Text
                  style={styles.meta}
                >
                  {
                    item.dare
                      .time_limit_minutes
                  }{' '}
                  min
                </Text>
              </>
            )}
          </View>
        </Pressable>

        {canStart && (
          <Pressable
            onPress={() =>
              handleStartDare(
                item.id,
              )
            }
            disabled={isStarting}
            style={({ pressed }) => [
              styles.startButton,
              pressed &&
                !isStarting &&
                styles.buttonPressed,
              isStarting &&
                styles.buttonDisabled,
            ]}
          >
            {isStarting ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.background
                }
              />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                ⚡ START DARE
              </Text>
            )}
          </Pressable>
        )}

        {item.state ===
          'IN_PROGRESS' && (
          <View
            style={
              isSelected
                ? styles.selectedBox
                : styles.selectBox
            }
          >
            <Text
              style={
                isSelected
                  ? styles.selectedText
                  : styles.selectText
              }
            >
              {isSelected
                ? '✓ THIS DARE IS SELECTED'
                : 'Tap this Dare to select it'}
            </Text>
          </View>
        )}

        {canSubmitText && (
          <View
            style={
              styles.proofSection
            }
          >
            <Text
              style={
                styles.proofLabel
              }
            >
              Text proof
            </Text>

            <Text
              style={
                styles.proofHint
              }
            >
              Describe what you did for this Dare.
            </Text>

            <TextInput
              value={currentProof}
              onChangeText={(value) =>
                setProofText(
                  (current) => ({
                    ...current,
                    [item.id]:
                      value,
                  }),
                )
              }
              placeholder="Tell us what you did..."
              placeholderTextColor={
                colors.secondaryText
              }
              multiline
              textAlignVertical="top"
              maxLength={1000}
              style={
                styles.proofInput
              }
            />

            <Text
              style={
                styles.characterCount
              }
            >
              {currentProof.length}/1000
            </Text>

            <Pressable
              onPress={() =>
                handleSubmitProof(
                  item.id,
                )
              }
              disabled={
                isSubmitting
              }
              style={({ pressed }) => [
                styles.submitButton,
                pressed &&
                  !isSubmitting &&
                  styles.buttonPressed,
                isSubmitting &&
                  styles.buttonDisabled,
              ]}
            >
              {isSubmitting ? (
                <View
                  style={
                    styles.loadingRow
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.background
                    }
                  />

                  <Text
                    style={
                      styles.loadingText
                    }
                  >
                    SUBMITTING...
                  </Text>
                </View>
              ) : (
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  SUBMIT TEXT PROOF
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {item.state ===
          'IN_PROGRESS' &&
          isSelected &&
          isPhotoProof && (
            <View
              style={
                styles.proofSection
              }
            >
              <Text
                style={
                  styles.proofLabel
                }
              >
                Photo / Post proof
              </Text>

              <Text
                style={
                  styles.proofHint
                }
              >
                Create a DareShot. Post showing your Dare completion.
              </Text>

              <Pressable
                onPress={() =>
                  handleCreateProof(
                    item.id,
                    'photo',
                  )
                }
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
              >
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  📸 CREATE PROOF POST
                </Text>
              </Pressable>
            </View>
          )}

        {item.state ===
          'IN_PROGRESS' &&
          isSelected &&
          isVideoProof && (
            <View
              style={
                styles.proofSection
              }
            >
              <Text
                style={
                  styles.proofLabel
                }
              >
                Video proof
              </Text>

              <Text
                style={
                  styles.proofHint
                }
              >
                Select a video showing your Dare completion.
              </Text>

              <Pressable
                onPress={() =>
                  handleCreateProof(
                    item.id,
                    'video',
                  )
                }
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
              >
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  🎥 CREATE VIDEO PROOF
                </Text>
              </Pressable>
            </View>
          )}

        {item.state ===
          'SUBMITTED' && (
          <View
            style={
              styles.progressBox
            }
          >
            <Text
              style={
                styles.progressText
              }
            >
              ⏳ Proof submitted. Ready for verification.
            </Text>

            <Pressable
              onPress={() =>
                handleVerifyDare(
                  item.id,
                )
              }
              disabled={
                isVerifying
              }
              style={({ pressed }) => [
                styles.verifyButton,
                pressed &&
                  !isVerifying &&
                  styles.buttonPressed,
                isVerifying &&
                  styles.buttonDisabled,
              ]}
            >
              {isVerifying ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.background
                  }
                />
              ) : (
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  ✓ VERIFY PROOF
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {item.state ===
          'VERIFIED' && (
          <View
            style={
              styles.progressBox
            }
          >
            <Text
              style={
                styles.progressText
              }
            >
              ✓ Proof verified.
            </Text>

            <Pressable
              onPress={() =>
                handleCompleteDare(
                  item.id,
                )
              }
              disabled={
                isCompleting
              }
              style={({ pressed }) => [
                styles.completeButton,
                pressed &&
                  !isCompleting &&
                  styles.buttonPressed,
                isCompleting &&
                  styles.buttonDisabled,
              ]}
            >
              {isCompleting ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.background
                  }
                />
              ) : (
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  🎉 COMPLETE DARE
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  /*
   * COMPLETED CARD
   */
  const renderCompletedDare = (
    item: CompletedDare,
  ) => {
    const completedDate =
      item.completed_at
        ? new Date(
            item.completed_at,
          ).toLocaleDateString()
        : 'Completed';

    return (
      <View
        key={item.id}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <Text style={styles.category}>
            {item.dare.category.toUpperCase()}
          </Text>

          <Text
            style={
              styles.completedState
            }
          >
            ✓ COMPLETED
          </Text>
        </View>

        <Text style={styles.title}>
          {item.dare.title}
        </Text>

        <Text
          style={
            styles.description
          }
        >
          {item.dare.description}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.xpText}>
            +{item.dare.xp_value} XP
          </Text>

          <Text style={styles.dot}>
            ·
          </Text>

          <Text style={styles.meta}>
            {completedDate}
          </Text>
        </View>

        <View
          style={
            styles.completedBox
          }
        >
          <Text
            style={
              styles.completedMessage
            }
          >
            🎉 Dare completed successfully
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>
        Dares
      </Text>

      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const selected =
            activeTab === tab;

          return (
            <Pressable
              key={tab}
              onPress={() =>
                setActiveTab(tab)
              }
              style={[
                styles.tab,
                selected &&
                  styles.tabSelected,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  selected &&
                    styles.tabTextSelected,
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ACTIVE */}
        {activeTab ===
          'Active' &&
          (loading ? (
            <View
              style={
                styles.center
              }
            >
              <ActivityIndicator
                size="large"
                color={
                  colors.accent
                }
              />
            </View>
          ) : activeDares.length ===
            0 ? (
            <View
              style={
                styles.empty
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No active dares
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Accept a Dare from Home or Discover to see it here.
              </Text>
            </View>
          ) : (
            activeDares.map(
              renderActiveDare,
            )
          ))}

        {/* COMPLETED */}
        {activeTab ===
          'Completed' &&
          (completedLoading ? (
            <View
              style={
                styles.center
              }
            >
              <ActivityIndicator
                size="large"
                color={
                  colors.accent
                }
              />
            </View>
          ) : completedDares.length ===
            0 ? (
            <View
              style={
                styles.empty
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No completed dares
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Complete your first Dare and it will appear here.
              </Text>
            </View>
          ) : (
            completedDares.map(
              renderCompletedDare,
            )
          ))}

        {/* RECEIVED / SENT */}
        {(activeTab ===
          'Received' ||
          activeTab === 'Sent') && (
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              {activeTab} Dares
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              This section will be connected next.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  header: {
    paddingHorizontal:
      spacing.lg,
    paddingTop:
      spacing.lg,
    paddingBottom:
      spacing.md,
    color:
      colors.primaryText,
    fontFamily:
      fontFamily.headingBold,
    fontSize:
      fontSize.xl,
  },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor:
      colors.border,
    paddingHorizontal:
      spacing.md,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent:
      'center',
    paddingVertical:
      spacing.md,
    borderBottomWidth: 2,
    borderBottomColor:
      'transparent',
  },

  tabSelected: {
    borderBottomColor:
      colors.accent,
  },

  tabText: {
    color:
      colors.secondaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
  },

  tabTextSelected: {
    color:
      colors.accent,
  },

  content: {
    padding:
      spacing.md,
    paddingBottom:
      spacing.xl,
  },

  card: {
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius:
      radius.lg,
    padding:
      spacing.md,
    marginBottom:
      spacing.md,
  },

  cardSelected: {
    borderColor:
      colors.accent,
    borderWidth: 2,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    marginBottom:
      spacing.sm,
  },

  category: {
    color:
      colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.xs,
  },

  state: {
    color:
      colors.secondaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.xs,
  },

  completedState: {
    color:
      colors.success,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.xs,
  },

  title: {
    color:
      colors.primaryText,
    fontFamily:
      fontFamily.headingBold,
    fontSize:
      fontSize.lg,
    marginBottom:
      spacing.sm,
  },

  description: {
    color:
      colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize:
      fontSize.sm,
    lineHeight: 21,
    marginBottom:
      spacing.md,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems:
      'center',
    flexWrap: 'wrap',
    marginBottom:
      spacing.md,
  },

  meta: {
    color:
      colors.primaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
  },

  xpText: {
    color:
      colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
  },

  dot: {
    color:
      colors.secondaryText,
    marginHorizontal: 6,
  },

  startButton: {
    minHeight: 48,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.accent,
    alignItems:
      'center',
    justifyContent:
      'center',
    paddingHorizontal:
      spacing.md,
  },

  submitButton: {
    minHeight: 48,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.accent,
    alignItems:
      'center',
    justifyContent:
      'center',
    paddingHorizontal:
      spacing.md,
    marginTop:
      spacing.sm,
  },

  verifyButton: {
    minHeight: 48,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.accent,
    alignItems:
      'center',
    justifyContent:
      'center',
    paddingHorizontal:
      spacing.md,
    marginTop:
      spacing.md,
  },

  completeButton: {
    minHeight: 48,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.accent,
    alignItems:
      'center',
    justifyContent:
      'center',
    paddingHorizontal:
      spacing.md,
    marginTop:
      spacing.md,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color:
      colors.background,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
  },

  proofSection: {
    marginTop:
      spacing.sm,
  },

  proofLabel: {
    color:
      colors.primaryText,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
    marginBottom:
      spacing.sm,
  },

  proofHint: {
    color:
      colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize:
      fontSize.xs,
    lineHeight: 18,
    marginBottom:
      spacing.sm,
  },

  proofInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.surfaceElevated,
    color:
      colors.primaryText,
    fontFamily:
      fontFamily.body,
    fontSize:
      fontSize.sm,
    padding:
      spacing.md,
  },

  characterCount: {
    color:
      colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize:
      fontSize.xs,
    textAlign:
      'right',
    marginTop: 4,
  },

  selectedBox: {
    borderWidth: 1,
    borderColor:
      colors.accent,
    backgroundColor:
      colors.surfaceElevated,
    borderRadius:
      radius.md,
    padding:
      spacing.sm,
    marginTop:
      spacing.sm,
  },

  selectBox: {
    borderWidth: 1,
    borderColor:
      colors.border,
    backgroundColor:
      colors.surfaceElevated,
    borderRadius:
      radius.md,
    padding:
      spacing.sm,
    marginTop:
      spacing.sm,
  },

  selectedText: {
    color:
      colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.xs,
    textAlign:
      'center',
  },

  selectText: {
    color:
      colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize:
      fontSize.xs,
    textAlign:
      'center',
  },

  loadingRow: {
    flexDirection:
      'row',
    alignItems:
      'center',
    gap:
      spacing.sm,
  },

  loadingText: {
    color:
      colors.background,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
  },

  progressBox: {
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius:
      radius.md,
    padding:
      spacing.md,
    marginTop:
      spacing.sm,
  },

  progressText: {
    color:
      colors.accent,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
  },

  completedBox: {
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius:
      radius.md,
    padding:
      spacing.md,
  },

  completedMessage: {
    color:
      colors.success,
    fontFamily:
      fontFamily.bodyMedium,
    fontSize:
      fontSize.sm,
  },

  empty: {
    paddingVertical: 80,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  emptyTitle: {
    color:
      colors.primaryText,
    fontFamily:
      fontFamily.headingBold,
    fontSize:
      fontSize.lg,
    marginBottom:
      spacing.sm,
  },

  emptyText: {
    color:
      colors.secondaryText,
    fontFamily:
      fontFamily.body,
    fontSize:
      fontSize.sm,
    textAlign:
      'center',
  },

  center: {
    paddingVertical: 80,
    alignItems:
      'center',
    justifyContent:
      'center',
  },
});