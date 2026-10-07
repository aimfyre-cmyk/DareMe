import Ionicons from '@expo/vector-icons/Ionicons';

import {
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

import { Chip } from './Chip';



export type MockDare = {

  id: string;

  title: string;

  category: string;

  difficulty: 'Easy' | 'Medium' | 'Hard';

  xpValue: number;

  proofType: 'Photo' | 'Video' | 'Text';

};



type DareCardProps = {

  dare: MockDare;



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



const difficultyVariant: Record<

  MockDare['difficulty'],

  'success' | 'accent' | 'danger'

> = {

  Easy: 'success',

  Medium: 'accent',

  Hard: 'danger',

};



export function DareCard({

  dare,

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



  const coverSource =

    dare.difficulty === 'Easy'

      ? require('../../assets/dare-covers/easy-cover.jpg')

      : dare.difficulty === 'Medium'

        ? require('../../assets/dare-covers/medium-cover.jpg')

        : require('../../assets/dare-covers/hard-cover.jpg');



  return (

    <View style={styles.card}>

      {/* ================================================= */}

      {/* CINEMATIC DARE COVER                              */}

      {/* ================================================= */}



      <ImageBackground

        source={coverSource}

        style={styles.cover}

        imageStyle={styles.coverImage}

      >

        <View style={styles.coverOverlay} />



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

          <Text style={styles.coverDifficulty}>

            {dare.difficulty.toUpperCase()}

          </Text>



          <Text

            style={styles.coverTitle}

            numberOfLines={3}

          >

            {dare.title}

          </Text>

        </View>

      </ImageBackground>



      {/* ================================================= */}

      {/* TAGS                                              */}

      {/* ================================================= */}



      <View style={styles.tagRow}>

        <Chip

          label={dare.category}

          variant="neutral"

        />



        <Chip

          label={dare.difficulty}

          variant={difficultyVariant[dare.difficulty]}

        />

      </View>



      {/* ================================================= */}

      {/* META                                              */}

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

      {/* PUBLIC DARE STATUS                                */}

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

      {/* SOCIAL ACTIONS                                    */}

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
      {/* CTA                                               */}

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



  coverImage: {

    borderRadius: radius.lg,

    resizeMode: 'cover',

  },



  coverOverlay: {

    position: 'absolute',

    top: 0,

    right: 0,

    bottom: 0,

    left: 0,

    backgroundColor: 'rgba(0, 0, 0, 0.22)',

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



  coverDifficulty: {

    color: '#FFFFFF',

    fontFamily: fontFamily.bodyMedium,

    fontSize: fontSize.sm,

    fontWeight: '700',

    letterSpacing: 1.5,

    marginBottom: spacing.sm,

  },



  coverTitle: {

    color: '#FFFFFF',

    fontFamily: fontFamily.headingBold,

    fontSize: fontSize.xxl,

    lineHeight: 38,

  },



  tagRow: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.sm,

    marginBottom: spacing.lg,

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
