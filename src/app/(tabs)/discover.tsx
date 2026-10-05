import { useEvent } from 'expo';



import {
  useFocusEffect,



  useRouter,
} from 'expo-router';







import { VideoView, useVideoPlayer } from 'expo-video';



import { useCallback, useEffect, useMemo, useRef, useState } from 'react';



import {
  Alert,



  Dimensions,



  Image,



  KeyboardAvoidingView,



  Modal,



  Platform,



  Pressable,



  ScrollView,



  StyleSheet,



  Text,



  TextInput,



  View,
} from 'react-native';







import { AppHeader } from '../../components/AppHeader';



import { Chip } from '../../components/Chip';



import { DareCard, MockDare } from '../../components/DareCard';



import { EmptyState } from '../../components/EmptyState';



import { Input } from '../../components/Input';



import { Screen } from '../../components/Screen';



import { SectionHeader } from '../../components/SectionHeader';



import {
  colors,



  fontFamily,



  fontSize,



  spacing,
} from '../../constants/theme';



import { getR2MediaUrl } from '../../features/onboarding/profileService';



import { transitionDare } from '../../lib/dareTransitions';



import { supabase } from '../../lib/supabase';







type RealDare = {



  id: string;



  title: string;



  description: string;



  category: string;



  difficulty: string;



  xp_value: number;



  proof_type: string;



  visibility: string;



  status: string;



};







type SocialPost = {



  id: string;



  user_id: string;



  post_type: string;



  content: string | null;



  media_url: string | null;



  media_type: string | null;



  visibility: string;



  status: string;



  created_at: string;



};







type PostProfile = {



  id: string;



  username: string | null;



  display_name: string | null;



  avatar_url: string | null;



  signedAvatarUrl?: string | null;



};







type PostLike = {



  post_id: string;



  user_id: string;



};







type PostComment = {



  id: string;



  post_id: string;



  user_id: string;



  content: string;



  created_at: string;



};







type CommentWithProfile = PostComment & {



  profile?: PostProfile;



};







type ShareRecipient = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ShareTab = 'following' | 'followers';

type FeedPost = SocialPost & {



  profile?: PostProfile;



  signedMediaUrl?: string | null;



  likeCount: number;



  likedByMe: boolean;



  commentCount: number;



};







const categories = [



  'Funny',



  'Creative',



  'Adventure',



  'Brain',



  'Fitness',



  'Social',



  'Photography',



  'Music',



  'Content',



] as const;







function mapDare(dare: RealDare): MockDare {



  const difficulty =



    dare.difficulty.toLowerCase() === 'hard'



      ? 'Hard'



      : dare.difficulty.toLowerCase() === 'medium'



        ? 'Medium'



        : 'Easy';







  const proofType =



    dare.proof_type.toLowerCase() === 'video'



      ? 'Video'



      : dare.proof_type.toLowerCase() === 'photo'



        ? 'Photo'



        : 'Text';







  return {



    id: dare.id,



    title: dare.title,



    category: dare.category,



    difficulty,



    xpValue: dare.xp_value,



    proofType,



  };



}







export default function DiscoverScreen() {



  const [posts, setPosts] = useState<FeedPost[]>([]);



  const [dares, setDares] = useState<RealDare[]>([]);







  const [postsLoading, setPostsLoading] = useState(true);



  const [daresLoading, setDaresLoading] = useState(true);







  const [takingDare, setTakingDare] =



    useState<string | null>(null);



  const [scrollY, setScrollY] = useState(0);



  const [screenFocused, setScreenFocused] = useState(true);







  const [commentPost, setCommentPost] =



    useState<FeedPost | null>(null);



  const [comments, setComments] =



    useState<CommentWithProfile[]>([]);



  const [commentsLoading, setCommentsLoading] =



    useState(false);



  const [commentText, setCommentText] =



    useState('');



  const [commentSubmitting, setCommentSubmitting] =



    useState(false);



  const [currentUserId, setCurrentUserId] =

    useState<string | null>(null);

  const [likePost, setLikePost] =

    useState<FeedPost | null>(null);

  const [likeUsers, setLikeUsers] =

    useState<PostProfile[]>([]);

  const [likesLoading, setLikesLoading] =

    useState(false);







  const [sharePost, setSharePost] =
    useState<FeedPost | null>(null);
  const [shareLoading, setShareLoading] =
    useState(false);
  const [shareSendingUserId, setShareSendingUserId] =
    useState<string | null>(null);
  const [shareSearch, setShareSearch] =
    useState('');
  const [shareTab, setShareTab] =
    useState<ShareTab>('following');
  const [shareFollowing, setShareFollowing] =
    useState<ShareRecipient[]>([]);
  const [shareFollowers, setShareFollowers] =
    useState<ShareRecipient[]>([]);

  const loadShareRecipients = useCallback(async () => {
    try {
      setShareLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Login required', 'Please log in to share posts.');
        return;
      }

      const { data: blockedRows, error: blockedError } =
        await supabase.rpc('get_blocked_user_ids');

      if (blockedError) throw blockedError;

      const blockedUserIds = new Set(
        (blockedRows ?? [])
          .map((row: { user_id: string | null }) => row.user_id)
          .filter(
            (id: string | null): id is string =>
              typeof id === 'string' && id.length > 0,
          ),
      );

      const [followingResult, followersResult] = await Promise.all([
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id),
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id),
      ]);

      if (followingResult.error) throw followingResult.error;
      if (followersResult.error) throw followersResult.error;

      const followingIds = Array.from(
        new Set(
          ((followingResult.data ?? []) as Array<{ following_id: string }>)
            .map((row) => row.following_id)
            .filter((id) => id && id !== user.id && !blockedUserIds.has(id)),
        ),
      );

      const followerIds = Array.from(
        new Set(
          ((followersResult.data ?? []) as Array<{ follower_id: string }>)
            .map((row) => row.follower_id)
            .filter((id) => id && id !== user.id && !blockedUserIds.has(id)),
        ),
      );

      const allIds = Array.from(new Set([...followingIds, ...followerIds]));

      if (allIds.length === 0) {
        setShareFollowing([]);
        setShareFollowers([]);
            return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .in('id', allIds);

      if (profileError) throw profileError;

      const profileMap = new Map(
        (profileRows ?? []).map((profile) => [profile.id, profile as ShareRecipient]),
      );

      const hydrate = async (ids: string[]) =>
        Promise.all(
          ids
            .map((id) => profileMap.get(id))
            .filter((profile): profile is ShareRecipient => Boolean(profile))
            .map(async (profile) => ({
              ...profile,
              avatar_url: profile.avatar_url
                ? await getR2MediaUrl(profile.avatar_url)
                : null,
            })),
        );

      const followingProfiles = await hydrate(followingIds);
      const followerProfiles = await hydrate(followerIds);

      setShareFollowing(followingProfiles);
      setShareFollowers(followerProfiles);
    } catch (error) {
      console.error('Share recipients error:', error);
      Alert.alert('Could not load people', 'Followers and following could not be loaded right now.');
    } finally {
      setShareLoading(false);
    }
  }, [shareTab]);

  const openSharePost = (post: FeedPost) => {
    setSharePost(post);
    setShareSearch('');
    setShareTab('following');
    void loadShareRecipients();
  };

  const closeSharePost = () => {
    if (shareSendingUserId) return;
    setSharePost(null);
    setShareSearch('');
  };

  const sharePostToUser = async (recipient: ShareRecipient) => {
    if (!sharePost || shareSendingUserId) return;

    try {
      setShareSendingUserId(recipient.id);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in to share posts.');
      }

      const { data: blocked, error: blockedError } = await supabase.rpc(
        'is_blocked_between',
        { p_user_a: user.id, p_user_b: recipient.id },
      );

      if (blockedError) throw blockedError;
      if (blocked) {
        Alert.alert('Share unavailable', 'You cannot share with this user.');
        return;
      }

      const { data, error } = await supabase.rpc('share_post_to_user', {
        p_post_id: sharePost.id,
        p_recipient_id: recipient.id,
      });

      if (error) throw error;

      const conversationId =
        typeof data === 'string'
          ? data
          : data?.conversation_id ?? data?.[0]?.conversation_id;

      if (!conversationId) {
        throw new Error('Conversation was not returned.');
      }

      setSharePost(null);
      setShareSearch('');
      Alert.alert('Post shared', `Shared with ${recipient.display_name || recipient.username || 'this user'}.`);
    } catch (error: any) {
      console.error('Share post error:', error);
      Alert.alert('Share failed', error?.message ?? 'Unable to share this post right now.');
    } finally {
      setShareSendingUserId(null);
    }
  };

  const filteredShareRecipients = useMemo(() => {
    const source = shareTab === 'following' ? shareFollowing : shareFollowers;
    const query = shareSearch.trim().toLowerCase();
    if (!query) return source;
    return source.filter((person) =>
      `${person.display_name ?? ''} ${person.username ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [shareFollowers, shareFollowing, shareSearch, shareTab]);

  const loadPosts = useCallback(async () => {



    setPostsLoading(true);







    try {



      const { data, error } = await supabase



        .from('posts')



        .select(



          'id,user_id,post_type,content,media_url,media_type,visibility,status,created_at',



        )



        .eq('status', 'active')



        .order('created_at', {



          ascending: false,



        })



        .limit(30);







      if (error) {



        throw error;



      }







      const socialPosts =



        (data ?? []) as SocialPost[];







      if (socialPosts.length === 0) {



        setPosts([]);



        return;



      }







      const {



        data: { user },



      } = await supabase.auth.getUser();







      const currentUserId = user?.id ?? null;

      setCurrentUserId(currentUserId);



      // =====================================================

      // INSTAGRAM-STYLE BLOCK PROTECTION

      // Hide posts from users blocked by either side.

      // =====================================================



      const {

        data: blockedRows,

        error: blockedError,

      } = await supabase.rpc('get_blocked_user_ids');



      if (blockedError) {

        throw blockedError;

      }



      const blockedUserIds = new Set(

        (blockedRows ?? [])

          .map(

            (row: { user_id: string | null }) =>

              row.user_id,

          )

          .filter(

            (id: string | null): id is string =>

              typeof id === 'string' && id.length > 0,

          ),

      );



      const visiblePosts = socialPosts.filter(

        (post) =>

          !blockedUserIds.has(post.user_id),

      );



      if (visiblePosts.length === 0) {

        setPosts([]);

        return;

      }



      const postIds = visiblePosts.map(

  (post) => post.id,

);







      /* ============================= */



      /* LIKES                          */



      /* ============================= */







      const {



        data: likes,



        error: likesError,



      } = await supabase



        .from('post_likes')



        .select('post_id,user_id')



        .in('post_id', postIds);







      if (likesError) {



        throw likesError;



      }







      /* ============================= */



      /* COMMENTS                       */



      /* ============================= */







      const {



        data: comments,



        error: commentsError,



      } = await supabase



        .from('post_comments')



        .select('id,post_id,user_id,content,created_at')



        .in('post_id', postIds);







      if (commentsError) {



        throw commentsError;



      }







      /* ============================= */



      /* PROFILES                       */



      /* ============================= */







      const userIds = [

  ...new Set(

    visiblePosts.map((post) => post.user_id),

  ),

];







      const {



        data: profiles,



        error: profilesError,



      } = await supabase



        .from('profiles')



        .select(



          'id,username,display_name,avatar_url',



        )



        .in('id', userIds);







      if (profilesError) {



        throw profilesError;



      }







      const profileMap = new Map<



        string,



        PostProfile



     >();







      for (const profile of profiles ?? []) {



  let signedAvatarUrl: string | null = null;







  if (profile.avatar_url) {



    // First try Cloudflare R2



    signedAvatarUrl =



      await getR2MediaUrl(profile.avatar_url);







    // Fallback for old Supabase Storage avatars



    if (



  !signedAvatarUrl &&



  profile.avatar_url



) {



  if (



    profile.avatar_url.startsWith(



      'http\\://',



    ) ||



    profile.avatar_url.startsWith(



      'https\\://',



    )



  ) {



    signedAvatarUrl =



      profile.avatar_url;



  }



}



  }







  profileMap.set(profile.id, {



    ...(profile as PostProfile),



    signedAvatarUrl,



  });



}







      const feedPosts: FeedPost[] = [];







      for (const post of visiblePosts) {



        let signedMediaUrl: string | null = null;







        if (



  post.media_url &&



  (post.media_type === 'image' ||



    post.media_type === 'video')



) {



  const {



    data: signedData,



    error: signedError,



  } = await supabase.functions.invoke(



    'r2-media-url',



    {



      body: {



        key: post.media_url,



      },



    },



  );







  if (signedError) {



    console.error(



      '[DareMe] R2 media URL failed:',



      signedError,



    );



  } else if (



    signedData?.success &&



    signedData?.signedUrl



  ) {



    signedMediaUrl =



      signedData.signedUrl;



  }



}











        /* ============================= */



        /* LIKE COUNT                     */



        /* ============================= */







        const postLikes =



          (likes as PostLike[] | null)?.filter(



            (like) =>



              like.post_id === post.id,



          ) ?? [];







        const likeCount =



          postLikes.length;







        const likedByMe =



          currentUserId !== null &&



          postLikes.some(



            (like) =>



              like.user_id ===



              currentUserId,



          );







        /* ============================= */



        /* COMMENT COUNT                  */



        /* ============================= */







        const postComments =



          (comments as PostComment[] | null)?.filter(



            (comment) =>



              comment.post_id === post.id,



          ) ?? [];







        const commentCount =



          postComments.length;







        feedPosts.push({



          ...post,



          profile: profileMap.get(



            post.user_id,



          ),



          signedMediaUrl,



          likeCount,



          likedByMe,



          commentCount,



        });



      }







      setPosts(feedPosts);



    } catch (error) {



      console.error(



        'Discover posts error:',



        error,



      );







      setPosts([]);







      Alert.alert(



        'Could not load posts',



        'Social posts could not be loaded right now.',



      );



    } finally {



      setPostsLoading(false);



    }



  }, []);







  const loadDares = useCallback(async () => {



    setDaresLoading(true);







    const { data, error } = await supabase



      .from('dares')



      .select(



        'id,title,description,category,difficulty,xp_value,proof_type,visibility,status',



      )



      .eq('status', 'active')



      .eq('visibility', 'anyone')



      .order('created_at', {



        ascending: false,



      });







    if (error) {



      console.error(



        'Discover dares error:',



        error,



      );







      Alert.alert(



        'Error',



        'Could not load dares right now.',



      );







      setDares([]);



    } else {



      setDares(



        (data ?? []) as RealDare[],



      );



    }







    setDaresLoading(false);



  }, []);



useEffect(() => {



  loadPosts();



  loadDares();



}, [loadPosts, loadDares]);







  useFocusEffect(



    useCallback(() => {



      setScreenFocused(true);







      return () => {



        setScreenFocused(false);



      };



    }, []),



  );







  /* ===================================================== */



  /* LIKE                                                  */



  /* ===================================================== */



  /* ===================================================== */







  const handleLike = async (



    post: FeedPost,



  ) => {



    const {



      data: { user },



      error: userError,



    } = await supabase.auth.getUser();







    if (userError || !user) {



      Alert.alert(



        'Login required',



        'Please log in to like posts.',



      );



      return;



    }







    if (post.likedByMe) {



      const { error } = await supabase



        .from('post_likes')



        .delete()



        .eq('post_id', post.id)



        .eq('user_id', user.id);







      if (error) {



        console.error(



          'Unlike post error:',



          error,



        );







        Alert.alert(



          'Error',



          'Could not unlike this post.',



        );



        return;



      }







      setPosts((currentPosts) =>



        currentPosts.map((item) =>



          item.id === post.id



            ? {



                ...item,



                likeCount: Math.max(



                  0,



                  item.likeCount - 1,



                ),



                likedByMe: false,



              }



            : item,



        ),



      );







      return;



    }







    const { error } = await supabase



      .from('post_likes')



      .insert({



        post_id: post.id,



        user_id: user.id,



      });







    if (error) {



      console.error(



        'Like post error:',



        error,



      );







      Alert.alert(



        'Error',



        'Could not like this post.',



      );



      return;



    }







    setPosts((currentPosts) =>



      currentPosts.map((item) =>



        item.id === post.id



          ? {



              ...item,



              likeCount:



                item.likeCount + 1,



              likedByMe: true,



            }



          : item,



      ),



    );



  };







  /* ===================================================== */



  /* COMMENTS                                               */



  /* ===================================================== */







  const loadComments = async (post: FeedPost) => {



    setCommentPost(post);



    setComments([]);



    setCommentText('');



    setCommentsLoading(true);







    try {



      const { data, error } = await supabase



        .from('post_comments')



        .select(



          'id,post_id,user_id,content,created_at',



        )



        .eq('post_id', post.id)



        .order('created_at', {



          ascending: true,



        });







      if (error) throw error;







      const rows = (data ?? []) as PostComment[];



      const userIds = [



        ...new Set(rows.map((c) => c.user_id)),



      ];







      let profileMap = new Map<string, PostProfile>();







      if (userIds.length> 0) {



        const { data: profiles, error: profileError } =



          await supabase



            .from('profiles')



            .select(



              'id,username,display_name,avatar_url',



            )



            .in('id', userIds);







        if (profileError) throw profileError;







        profileMap = new Map(



          (profiles ?? []).map((profile) => [



            profile.id,



            profile as PostProfile,



          ]),



        );



      }







            const commentsWithProfiles: CommentWithProfile[] =

        await Promise.all(

          rows.map(async (comment) => {

            const profile = profileMap.get(comment.user_id);



            if (profile?.avatar_url) {

              const signedAvatarUrl =

                await getR2MediaUrl(profile.avatar_url);



              return {

                ...comment,

                profile: {

                  ...profile,

                  signedAvatarUrl,

                },

              };

            }



            return {

              ...comment,

              profile,

            };

          }),

        );



      setComments(commentsWithProfiles);



    } catch (error) {



      console.error('Load comments error:', error);



      Alert.alert(



        'Could not load comments',



        'Comments could not be loaded right now.',



      );



    } finally {



      setCommentsLoading(false);



    }



  };







  const handleSubmitComment = async () => {



    const text = commentText.trim();







    if (!commentPost || !text || commentSubmitting) {



      return;



    }







    setCommentSubmitting(true);







    try {



      const {



        data: { user },



        error: userError,



      } = await supabase.auth.getUser();







      if (userError || !user) {



        Alert.alert(



          'Login required',



          'Please log in to comment on posts.',



        );



        return;



      }







      const { data, error } = await supabase



        .from('post_comments')



        .insert({



          post_id: commentPost.id,



          user_id: user.id,



          content: text,



        })



        .select(



          'id,post_id,user_id,content,created_at',



        )



        .single();







      if (error || !data) {



        throw (



          error ?? new Error('Could not create comment.')



        );



      }







      let profile: PostProfile | undefined;







      const { data: profileData } = await supabase



        .from('profiles')



        .select(



          'id,username,display_name,avatar_url',



        )



        .eq('id', user.id)



        .maybeSingle();







      if (profileData) {



        profile = profileData as PostProfile;



      }







      setComments((current) => [



        ...current,



        {



          ...(data as PostComment),



          profile,



        },



      ]);







      setPosts((current) =>



        current.map((item) =>



          item.id === commentPost.id



            ? {



                ...item,



                commentCount: item.commentCount + 1,



              }



            : item,



        ),



      );







      setCommentText('');



    } catch (error) {



      console.error('Create comment error:', error);



      Alert.alert(



        'Could not comment',



        error instanceof Error



          ? error.message



          : 'Something went wrong while posting your comment.',



      );



    } finally {



      setCommentSubmitting(false);



    }



  };







  const handleDeleteComment = async (



    comment: CommentWithProfile,



  ) => {



    const {



      data: { user },



    } = await supabase.auth.getUser();







    if (!user || user.id !== comment.user_id) {



      return;



    }







    const { error } = await supabase



      .from('post_comments')



      .delete()



      .eq('id', comment.id)



      .eq('user_id', user.id);







    if (error) {



      console.error('Delete comment error:', error);



      Alert.alert(



        'Could not delete',



        'Your comment could not be deleted.',



      );



      return;



    }







    setComments((current) =>



      current.filter((item) => item.id !== comment.id),



    );







    if (commentPost) {



      setPosts((current) =>



        current.map((item) =>



          item.id === commentPost.id



            ? {



                ...item,



                commentCount: Math.max(



                  0,



                  item.commentCount - 1,



                ),



              }



            : item,



        ),



      );



    }



  };







  /* ===================================================== */

  /* LIKE DETAILS + POST DELETE                            */

  /* ===================================================== */



  const loadLikeUsers = async (post: FeedPost) => {

    setLikePost(post);

    setLikeUsers([]);

    setLikesLoading(true);



    try {

      const { data: likes, error: likesError } =

        await supabase

          .from('post_likes')

          .select('post_id,user_id')

          .eq('post_id', post.id);



      if (likesError) throw likesError;



      const userIds = [

        ...new Set(

          ((likes ?? []) as PostLike[]).map(

            (like) => like.user_id,

          ),

        ),

      ];



      if (userIds.length === 0) {

        setLikeUsers([]);

        return;

      }



      const { data: profiles, error: profilesError } =

        await supabase

          .from('profiles')

          .select('id,username,display_name,avatar_url')

          .in('id', userIds);



      if (profilesError) throw profilesError;



      const profileMap = new Map<string, PostProfile>();



      for (const profile of profiles ?? []) {

        const signedAvatarUrl = profile.avatar_url

          ? await getR2MediaUrl(profile.avatar_url)

          : null;



        profileMap.set(profile.id, {

          ...(profile as PostProfile),

          signedAvatarUrl,

        });

      }



      setLikeUsers(

        userIds

          .map((userId) => profileMap.get(userId))

          .filter(

            (profile): profile is PostProfile =>

              Boolean(profile),

          ),

      );

    } catch (error) {

      console.error('Load like users error:', error);

      Alert.alert(

        'Could not load likes',

        'Like details could not be loaded right now.',

      );

    } finally {

      setLikesLoading(false);

    }

  };



  const handleDeletePost = async (post: FeedPost) => {

    const {

      data: { user },

    } = await supabase.auth.getUser();



    if (!user || user.id !== post.user_id) {

      return;

    }



    Alert.alert(

      'Delete post?',

      'This post will be permanently deleted.',

      [

        {

          text: 'Cancel',

          style: 'cancel',

        },

        {

          text: 'Delete',

          style: 'destructive',

          onPress: async () => {

            try {

              const { error } = await supabase

                .from('posts')

                .delete()

                .eq('id', post.id)

                .eq('user_id', user.id);



              if (error) throw error;



              setPosts((current) =>

                current.filter((item) => item.id !== post.id),

              );



              if (commentPost?.id === post.id) {

                setCommentPost(null);

                setComments([]);

              }



              if (likePost?.id === post.id) {

                setLikePost(null);

                setLikeUsers([]);

              }

            } catch (error) {

              console.error('Delete post error:', error);

              Alert.alert(

                'Could not delete',

                'Your post could not be deleted.',

              );

            }

          },

        },

      ],

    );

  };



  /* ===================================================== */



  /* TAKE DARE                                             */



  /* ===================================================== */







  const handleTakeDare = async (



    dareId: string,



  ) => {



    if (takingDare) return;







    setTakingDare(dareId);







    try {



      const {



        data: { user },



        error: userError,



      } = await supabase.auth.getUser();







      if (userError || !user) {



        throw new Error(



          'Please log in before taking a dare.',



        );



      }







      const {



        data: existingParticipant,



        error: existingError,



      } = await supabase



        .from('dare_participants')



        .select('id,state')



        .eq('dare_id', dareId)



        .eq('user_id', user.id)



        .maybeSingle();







      if (existingError) {



        throw existingError;



      }







      let participantId: string;







      if (existingParticipant) {



        participantId =



          existingParticipant.id;







        if (



          existingParticipant.state ===



          'ACCEPTED'



        ) {



          Alert.alert(



            'Already accepted',



            'You have already accepted this dare.',



          );



          return;



        }







        if (



          existingParticipant.state !==



          'SENT'



        ) {



          Alert.alert(



            'Dare unavailable',



            `This dare is currently ${existingParticipant.state}.`,



          );



          return;



        }



      } else {



        const {



          data: participant,



          error: participantError,



        } = await supabase



          .from('dare_participants')



          .insert({



            dare_id: dareId,



            user_id: user.id,



            state: 'SENT',



          })



          .select('id')



          .single();







        if (



          participantError ||



          !participant



        ) {



          throw (



            participantError ??



            new Error(



              'Could not create participant.',



            )



          );



        }







        participantId =



          participant.id;



      }







      const result =



        await transitionDare(



          participantId,



          'accept',



        );







      if (result.state !== 'ACCEPTED') {



        throw new Error(



          `Unexpected dare state: ${result.state}`,



        );



      }







      Alert.alert(



        '⚡ Dare Accepted!',



        'The dare is now active for you.',



      );



    } catch (error) {



      console.error(



        'Take dare error:',



        error,



      );







      Alert.alert(



        'Could not take dare',



        error instanceof Error



          ? error.message



          : 'Something went wrong while taking the dare.',



      );



    } finally {



      setTakingDare(null);



    }



  };







  return (



    <Screen



      onScroll={(event) => {



        setScrollY(event.nativeEvent.contentOffset.y);



      }}



   >



      <AppHeader title="Discover" />







      {/* ================================================= */}



      {/* SOCIAL FEED                                      */}



      {/* ================================================= */}







      <SectionHeader title="Community" />







      {postsLoading ? (



        <Text style={styles.statusText}>



          Loading posts...



        </Text>



      ) : posts.length> 0 ? (



        <View style={styles.feed}>



                    {posts.map((post) => (



            <PostCard



              key={post.id}



              post={post}



              onLike={() => handleLike(post)}



              onLikeCountPress={() => loadLikeUsers(post)}



              onComment={() => loadComments(post)}



              onShare={() => openSharePost(post)}



              onDelete={() => handleDeletePost(post)}



              isOwner={currentUserId === post.user_id}



              scrollY={scrollY}



              screenFocused={screenFocused}



            />



          ))}



        </View>



      ) : (



        <EmptyState



          title="No posts yet"



          description="Be the first to share something with the DareShot community."



        />



      )}







      {/* ================================================= */}



      {/* DISCOVER CATEGORIES                               */}



      {/* ================================================= */}







      <Input



        placeholder="Search dares, people, categories"



        editable={false}



      />







      <SectionHeader title="Categories" />







      <View style={styles.chipWrap}>



        {categories.map((category) => (



          <Chip



            key={category}



            label={category}



          />



        ))}



      </View>







      {/* ================================================= */}



      {/* DARES                                             */}



      {/* ================================================= */}







      <SectionHeader title="Featured Dares" />







      {daresLoading ? (



        <Text style={styles.statusText}>



          Loading dares...



        </Text>



      ) : dares.length> 0 ? (



        <View>



          {dares.map((dare) => (



            <View



              key={dare.id}



              style={styles.dareWrapper}



           >



              <DareCard



                dare={mapDare(dare)}



                onPrimaryAction={() =>



                  handleTakeDare(dare.id)



                }



              />







              {takingDare === dare.id && (



                <Text



                  style={



                    styles.takingText



                  }



               >



                  Accepting dare...



                </Text>



              )}



            </View>



          ))}



        </View>



      ) : (



        <EmptyState



          title="No dares available"



          description="New challenges will appear here."



        />



      )}







      {/* ================================================= */}



      {/* PEOPLE                                            */}



      {/* ================================================= */}







      <SectionHeader title="People to Follow" />







      <EmptyState



        title="Discover people soon"



        description="Recommendations arrive once the community grows."



      />







      <SharePostModal
        visible={sharePost !== null}
        recipients={filteredShareRecipients}
        loading={shareLoading}
        sendingUserId={shareSendingUserId}
        search={shareSearch}
        tab={shareTab}
        onSearchChange={setShareSearch}
        onTabChange={(tab) => {
          setShareTab(tab);
        }}
        onShare={sharePostToUser}
        onClose={closeSharePost}
      />

      <LikeUsersModal
        visible={likePost !== null}

        post={likePost}

        users={likeUsers}

        loading={likesLoading}

        onClose={() => {

          if (!likesLoading) {

            setLikePost(null);

            setLikeUsers([]);

          }

        }}

      />



      <CommentModal



        visible={commentPost !== null}



        post={commentPost}



        comments={comments}



        commentsLoading={commentsLoading}



        commentText={commentText}



        commentSubmitting={commentSubmitting}



        onChangeText={setCommentText}



        onClose={() => {



          if (!commentSubmitting) {



            setCommentPost(null);



            setCommentText('');



            setComments([]);



          }



        }}



        onSubmit={handleSubmitComment}



      />



    </Screen>



  );



}







/* ======================================================= */



/* POST CARD                                               */



/* ======================================================= */







function PostCard({

  post,

  onLike,

  onLikeCountPress,

  onComment,

  onShare,

  onDelete,

  isOwner,

  scrollY,

  screenFocused,

}: {

  post: FeedPost;

  onLike: () => void;

  onLikeCountPress: () => void;

  onComment: () => void;

  onShare: () => void;

  onDelete: () => void;

  isOwner: boolean;

  scrollY: number;

  screenFocused: boolean;

}) {



  const router = useRouter();







  const displayName =



    post.profile?.display_name ||



    post.profile?.username ||



    'DareShot User';







  const username =



    post.profile?.username



      ? `@${post.profile.username}`



      : '';







  const isPhoto =



    post.media_type === 'image' &&



    !!post.signedMediaUrl;







    const isVideo =



  post.media_type === 'video' &&



  !!post.signedMediaUrl;







  const isText =



    post.post_type === 'text' ||



    !post.media_type;















  return (



    <View style={styles.postCard}>



      {/* Author */}



      <Pressable



        style={styles.postHeader}



        onPress={() => {



          if (post.profile?.id) {



            router.push({



              pathname: '/public-profile',



              params: {



                userId: post.profile.id,



              },



            });



          }



        }}



        accessibilityRole="button"



        accessibilityLabel={`Open ${displayName}'s profile`}



     >



        {post.profile?.signedAvatarUrl ? (



  <Image



    source={{



      uri: post.profile.signedAvatarUrl,



    }}



    style={styles.avatar}



  />



) : (



          <View



            style={



              styles.avatarFallback



            }



         >



            <Text



              style={



                styles.avatarLetter



              }



           >



              {displayName



                .charAt(0)



                .toUpperCase()}



            </Text>



          </View>



        )}







        <View style={styles.authorInfo}>



          <Text



            style={styles.authorName}



         >



            {displayName}



          </Text>







          {username ? (



            <Text



              style={styles.username}



           >



              {username}



            </Text>



          ) : null}



        </View>



        {isOwner ? (

          <Pressable

            onPress={onDelete}

            style={styles.deletePostButton}

            accessibilityRole="button"

            accessibilityLabel="Delete your post"

          >

            <Text style={styles.deletePostText}>•••</Text>

          </Pressable>

        ) : null}



      </Pressable>







      {/* Caption */}



      {post.content ? (



        <Text



          style={styles.postContent}



       >



          {post.content}



        </Text>



      ) : null}







      {/* Photo */}



      {isPhoto ? (



        <Image



          source={{



            uri: post.signedMediaUrl!,



          }}



          style={styles.postImage}



          resizeMode="contain"



        />



      ) : null}



      {isVideo ? (



  <PostVideo



  uri={post.signedMediaUrl!}



  scrollY={scrollY}



  screenFocused={screenFocused}



/>



) : null}







      {/* Text-only indicator */}



      {isText && !post.content ? (



        <Text



          style={styles.emptyPostText}



       >



          Shared a post



        </Text>



      ) : null}







      {/* Social actions */}



      <View style={styles.actions}>



        {/* LIKE */}



        <Pressable



          style={styles.actionButton}



          onPress={onLike}



          accessibilityRole="button"



          accessibilityLabel={



            post.likedByMe



              ? 'Unlike post'



              : 'Like post'



          }



       >



          <Text



            style={[



              styles.actionIcon,



              post.likedByMe &&



                styles.likedIcon,



            ]}



         >



            {post.likedByMe



              ? '♥'



              : '♡'}



          </Text>







          <Pressable

            onPress={

              post.likeCount > 0

                ? onLikeCountPress

                : undefined

            }

            disabled={post.likeCount === 0}

            accessibilityRole="button"

            accessibilityLabel="View people who liked this post"

          >

            <Text

              style={[

                styles.actionText,

                post.likedByMe &&

                  styles.likedText,

              ]}

            >

              {post.likeCount > 0

                ? post.likeCount

                : 'Like'}

            </Text>

          </Pressable>



        </Pressable>







        {/* COMMENT */}



        <Pressable



          style={styles.actionButton}



          onPress={onComment}



          accessibilityRole="button"



          accessibilityLabel="Open comments"



       >



          <Text style={styles.actionIcon}>○</Text>







          <Text style={styles.actionText}>



            {post.commentCount> 0



              ? post.commentCount



              : 'Comment'}



          </Text>



        </Pressable>







        {/* SHARE */}



        <Pressable
          style={styles.actionButton}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share post"
        >
          <Text style={styles.actionIcon}>↗</Text>
          <Text style={styles.actionText}>Share</Text>
        </Pressable>







        {/* SAVE */}



        <Pressable



          style={[



            styles.actionButton,



            styles.saveButton,



          ]}



       >



          <Text



            style={styles.actionIcon}



         >



            ♧



          </Text>







          <Text



            style={styles.actionText}



         >



            Save



          </Text>



        </Pressable>



      </View>



    </View>



  );



}







/* ======================================================= */

/* LIKE USERS MODAL                                        */

/* ======================================================= */



function SharePostModal({
  visible,
  recipients,
  loading,
  sendingUserId,
  search,
  tab,
  onSearchChange,
  onTabChange,
  onShare,
  onClose,
}: {
  visible: boolean;
  recipients: ShareRecipient[];
  loading: boolean;
  sendingUserId: string | null;
  search: string;
  tab: ShareTab;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: ShareTab) => void;
  onShare: (recipient: ShareRecipient) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.shareModal}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentTitle}>Share post</Text>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.shareSearchWrap}>
            <TextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder="Search people"
              placeholderTextColor={colors.secondaryText}
              style={styles.shareSearchInput}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.shareTabs}>
            {(['following', 'followers'] as ShareTab[]).map((value) => (
              <Pressable
                key={value}
                onPress={() => onTabChange(value)}
                style={[styles.shareTab, tab === value && styles.shareTabActive]}
              >
                <Text style={[styles.shareTabText, tab === value && styles.shareTabTextActive]}>
                  {value === 'following' ? 'Following' : 'Followers'}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <View style={styles.shareCenterState}>
              <Text style={styles.commentStatus}>Loading people...</Text>
            </View>
          ) : recipients.length === 0 ? (
            <View style={styles.shareCenterState}>
              <Text style={styles.commentStatus}>
                {search.trim() ? 'No people found.' : `No ${tab} yet.`}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.shareList} contentContainerStyle={styles.shareListContent} keyboardShouldPersistTaps="handled">
              {recipients.map((person) => {
                const name = person.display_name || person.username || 'DareShot User';
                const busy = sendingUserId === person.id;
                return (
                  <Pressable
                    key={person.id}
                    style={styles.sharePersonRow}
                    onPress={() => onShare(person)}
                    disabled={Boolean(sendingUserId)}
                  >
                    <View style={styles.shareAvatar}>
                      {person.avatar_url ? (
                        <Image source={{ uri: person.avatar_url }} style={styles.shareAvatarImage} />
                      ) : (
                        <Text style={styles.shareAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.sharePersonInfo}>
                      <Text style={styles.sharePersonName} numberOfLines={1}>{name}</Text>
                      {person.username ? <Text style={styles.sharePersonUsername} numberOfLines={1}>@{person.username}</Text> : null}
                    </View>
                    <View style={styles.shareSendButton}>
                      {busy ? <Text style={styles.shareSendText}>...</Text> : <Text style={styles.shareSendText}>Send</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function LikeUsersModal({

  visible,

  post,

  users,

  loading,

  onClose,

}: {

  visible: boolean;

  post: FeedPost | null;

  users: PostProfile[];

  loading: boolean;

  onClose: () => void;

}) {

  return (

    <Modal

      visible={visible}

      animationType="slide"

      transparent

      onRequestClose={onClose}

    >

      <View style={styles.modalOverlay}>

        <View style={styles.likeModal}>

          <View style={styles.commentHeader}>

            <Text style={styles.commentTitle}>Likes</Text>



            <Pressable

              onPress={onClose}

              style={styles.closeButton}

              accessibilityRole="button"

              accessibilityLabel="Close likes"

            >

              <Text style={styles.closeButtonText}>×</Text>

            </Pressable>

          </View>



          <View style={styles.commentDivider} />



          <ScrollView

            style={styles.commentsList}

            contentContainerStyle={styles.commentsContent}

          >

            {loading ? (

              <Text style={styles.commentStatus}>

                Loading likes...

              </Text>

            ) : users.length === 0 ? (

              <Text style={styles.commentStatus}>

                No likes yet.

              </Text>

            ) : (

              users.map((profile) => {

                const name =

                  profile.display_name ||

                  profile.username ||

                  'DareShot User';



                const username = profile.username

                  ? `@${profile.username}`

                  : '';



                return (

                  <View

                    key={profile.id}

                    style={styles.likeUserRow}

                  >

                    {profile.signedAvatarUrl ? (

                      <Image

                        source={{

                          uri: profile.signedAvatarUrl,

                        }}

                        style={styles.likeUserAvatar}

                      />

                    ) : (

                      <View

                        style={styles.likeUserAvatarFallback}

                      >

                        <Text

                          style={styles.commentAvatarLetter}

                        >

                          {name.charAt(0).toUpperCase()}

                        </Text>

                      </View>

                    )}



                    <View style={styles.likeUserInfo}>

                      <Text style={styles.commentName}>

                        {name}

                      </Text>



                      {username ? (

                        <Text

                          style={styles.commentUsername}

                        >

                          {username}

                        </Text>

                      ) : null}

                    </View>

                  </View>

                );

              })

            )}

          </ScrollView>

        </View>

      </View>

    </Modal>

  );

}



/* ======================================================= */

/* COMMENT MODAL                                           */

/* ======================================================= */







/* ======================================================= */



function PostVideo({



  uri,



  scrollY,



  screenFocused,



}: {



  uri: string;



  scrollY: number;



  screenFocused: boolean;



}) {



  const [muted, setMuted] = useState(true);







  const videoRef = useRef<View>(null);



  const isVisibleRef = useRef(false);







  const player = useVideoPlayer(uri, (videoPlayer) => {



    videoPlayer.loop = true;



    videoPlayer.muted = true;



  });







  const { status } = useEvent(player, 'statusChange', {



    status: player.status,



  });











  const updatePlayback = useCallback(() => {



    videoRef.current?.measureInWindow(



      (_x, y, _width, height) => {



        const viewportHeight =



          Dimensions.get('window').height;







        if (height <= 0 || viewportHeight <= 0) {



          player.pause();



          isVisibleRef.current = false;



          return;



        }







        const visibleTop = Math.max(y, 0);



        const visibleBottom = Math.min(



          y + height,



          viewportHeight,



        );







        const visibleHeight = Math.max(



          0,



          visibleBottom - visibleTop,



        );







        const visibleRatio =



          visibleHeight / height;







        const shouldPlay =



          visibleRatio>= 0.5;



          if (Platform.OS === 'web') {



  player.muted = true;



}







        isVisibleRef.current =



          shouldPlay;







        if (



          shouldPlay &&



          status === 'readyToPlay'



        ) {



          player.muted = muted;



          player.play();



        } else {



          player.pause();



        }



      },



    );



  }, [



    muted,



    player,



    status,



    scrollY,



  ]);







    useEffect(() => {



    if (!screenFocused) {



      player.pause();



      isVisibleRef.current = false;



      return;



    }







    updatePlayback();



  }, [



    screenFocused,



    player,



    updatePlayback,



  ]);



  useEffect(() => {



    const timer = setTimeout(() => {



      updatePlayback();



    }, 50);







    return () => {



      clearTimeout(timer);



    };



  }, [updatePlayback]);







  /*



   * When video becomes ready, immediately



   * check whether it is currently visible.



   */



  useEffect(() => {



    if (status === 'readyToPlay') {



      const timer = setTimeout(() => {



        updatePlayback();



      }, 50);







      return () => {



        clearTimeout(timer);



      };



    }



  }, [status, updatePlayback]);







  /*



   * Always pause when component unmounts.



   */











  const toggleMute = () => {



    const nextMuted = !muted;







    player.muted = nextMuted;



    setMuted(nextMuted);



  };







  return (



    <View



      ref={videoRef}



      style={styles.videoContainer}



   >



      <VideoView



        player={player}



        style={styles.postVideo}



        contentFit="contain"



        nativeControls={false}



        playsInline



      />







      <Pressable



        onPress={toggleMute}



        style={styles.videoMuteButton}



        accessibilityRole="button"



        accessibilityLabel={



          muted



            ? 'Unmute video'



            : 'Mute video'



        }



     >



        <Text



          style={styles.videoMuteText}



       >



          {muted ? '🔇' : '🔊'}



        </Text>



      </Pressable>



    </View>



  );



}



function CommentModal({



  visible,



  post,



  comments,



  commentsLoading,



  commentText,



  commentSubmitting,



  onChangeText,



  onClose,



  onSubmit,



}: {



  visible: boolean;



  post: FeedPost | null;



  comments: CommentWithProfile[];



  commentsLoading: boolean;



  commentText: string;



  commentSubmitting: boolean;



  onChangeText: (text: string) => void;



  onClose: () => void;



  onSubmit: () => void;



}) {



  return (



    <Modal



      visible={visible}



      animationType="slide"



      transparent



      onRequestClose={onClose}



   >



      <KeyboardAvoidingView



        style={styles.modalOverlay}



        behavior={



          Platform.OS === 'ios'



            ? 'padding'



            : undefined



        }



     >



        <View style={styles.commentModal}>



          <View style={styles.commentHeader}>



            <Text style={styles.commentTitle}>



              Comments



            </Text>







            <Pressable



              onPress={onClose}



              style={styles.closeButton}



              accessibilityRole="button"



              accessibilityLabel="Close comments"



           >



              <Text style={styles.closeButtonText}>



                ×



              </Text>



            </Pressable>



          </View>







          <View style={styles.commentDivider} />







          <ScrollView



            style={styles.commentsList}



            contentContainerStyle={



              styles.commentsContent



            }



            keyboardShouldPersistTaps="handled"



         >



            {commentsLoading ? (



              <Text style={styles.commentStatus}>



                Loading comments...



              </Text>



            ) : comments.length === 0 ? (



              <View style={styles.emptyComments}>



                <Text



                  style={styles.emptyCommentsTitle}



               >



                  No comments yet



                </Text>







                <Text



                  style={styles.emptyCommentsText}



               >



                  Be the first to comment.



                </Text>



              </View>



            ) : (



              comments.map((comment) => {



                const name =



                  comment.profile?.display_name ||



                  comment.profile?.username ||



                  'DareShot User';







                const username =



                  comment.profile?.username



                    ? `@${comment.profile.username}`



                    : '';







                return (



                  <View



                    key={comment.id}



                    style={styles.commentRow}



                 >



                    {comment.profile?.signedAvatarUrl ? (



                      <Image



                        source={{



                          uri: comment.profile.signedAvatarUrl,



                        }}



                        style={styles.commentAvatar}



                      />



                    ) : (



                      <View



                        style={



                          styles.commentAvatarFallback



                        }



                     >



                        <Text



                          style={



                            styles.commentAvatarLetter



                          }



                       >



                          {name



                            .charAt(0)



                            .toUpperCase()}



                        </Text>



                      </View>



                    )}







                    <View style={styles.commentBody}>



                      <View



                        style={styles.commentNameRow}



                     >



                        <Text



                          style={styles.commentName}



                       >



                          {name}



                        </Text>







                        {username ? (



                          <Text



                            style={



                              styles.commentUsername



                            }



                         >



                            {username}



                          </Text>



                        ) : null}



                      </View>







                      <Text



                        style={styles.commentContent}



                     >



                        {comment.content}



                      </Text>







                    </View>



                  </View>



                );



              })



            )}



          </ScrollView>







          <View style={styles.commentInputRow}>



            <TextInput



              value={commentText}



              onChangeText={onChangeText}



              placeholder="Write a comment..."



              placeholderTextColor={



                colors.secondaryText



              }



              style={styles.commentInput}



              multiline



              maxLength={500}



              editable={!commentSubmitting}



            />







            <Pressable



              onPress={onSubmit}



              disabled={



                commentSubmitting ||



                !commentText.trim()



              }



              style={[



                styles.commentSendButton,



                (commentSubmitting ||



                  !commentText.trim()) &&



                  styles.commentSendButtonDisabled,



              ]}



              accessibilityRole="button"



              accessibilityLabel="Post comment"



           >



              <Text style={styles.commentSendText}>



                {commentSubmitting ? '...' : '➤'}



              </Text>



            </Pressable>



          </View>



        </View>



      </KeyboardAvoidingView>



    </Modal>



  );



}







/* ======================================================= */



/* STYLES                                                  */



/* ======================================================= */







const styles = StyleSheet.create({



  modalOverlay: {



    flex: 1,



    justifyContent: 'flex-end',



    backgroundColor: 'rgba(0,0,0,0.45)',



  },







  likeModal: {

    height: '62%',

    backgroundColor: colors.surface,

    borderTopLeftRadius: 22,

    borderTopRightRadius: 22,

    overflow: 'hidden',

  },



  commentModal: {



    height: '78%',



    backgroundColor: colors.surface,



    borderTopLeftRadius: 22,



    borderTopRightRadius: 22,



    overflow: 'hidden',



  },

  shareModal: {
    height: '78%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },

  shareSearchWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 14,
  },

  shareSearchInput: {
    color: colors.primaryText,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },

  shareTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  shareTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  shareTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },

  shareTabText: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  shareTabTextActive: {
    color: colors.primaryText,
  },

  shareList: {
    flex: 1,
  },

  shareListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  sharePersonRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  shareAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.sm,
  },

  shareAvatarImage: {
    width: '100%',
    height: '100%',
  },

  shareAvatarText: {
    color: colors.primaryText,
    fontWeight: '800',
  },

  sharePersonInfo: {
    flex: 1,
    minWidth: 0,
  },

  sharePersonName: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  sharePersonUsername: {
    color: colors.secondaryText,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  shareSendButton: {
    minWidth: 62,
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareSendText: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },

  shareCenterState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },







  commentHeader: {



    flexDirection: 'row',



    alignItems: 'center',



    justifyContent: 'space-between',



    paddingHorizontal: spacing.md,



    paddingVertical: spacing.md,



  },







  commentTitle: {



    color: colors.primaryText,



    fontFamily: fontFamily.bodyMedium,



    fontSize: fontSize.lg,



  },







  closeButton: {



    width: 36,



    height: 36,



    alignItems: 'center',



    justifyContent: 'center',



    borderRadius: 18,



    backgroundColor: colors.background,



  },







  closeButtonText: {



    color: colors.primaryText,



    fontSize: 28,



    lineHeight: 30,



  },







  commentDivider: {



    height: 1,



    backgroundColor: colors.border,



  },







  commentsList: {



    flex: 1,



  },







  commentsContent: {



    padding: spacing.md,



    paddingBottom: spacing.lg,



  },







  commentStatus: {



    color: colors.secondaryText,



    textAlign: 'center',



    paddingVertical: spacing.xl,



  },







  emptyComments: {



    alignItems: 'center',



    justifyContent: 'center',



    paddingVertical: spacing.xl,



  },







  emptyCommentsTitle: {



    color: colors.primaryText,



    fontFamily: fontFamily.bodyMedium,



    fontSize: fontSize.md,



  },







  emptyCommentsText: {



    color: colors.secondaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.sm,



    marginTop: spacing.xs,



  },







  commentRow: {



    flexDirection: 'row',



    marginBottom: spacing.md,



  },







  commentAvatar: {



    width: 38,



    height: 38,



    borderRadius: 19,



  },







  commentAvatarFallback: {



    width: 38,



    height: 38,



    borderRadius: 19,



    alignItems: 'center',



    justifyContent: 'center',



    backgroundColor: colors.background,



    borderWidth: 1,



    borderColor: colors.border,



  },







  commentAvatarLetter: {



    color: colors.primaryText,



    fontFamily: fontFamily.bodyMedium,



    fontSize: fontSize.sm,



  },







  likeUserRow: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: spacing.md,

  },



  likeUserAvatar: {

    width: 42,

    height: 42,

    borderRadius: 21,

  },



  likeUserAvatarFallback: {

    width: 42,

    height: 42,

    borderRadius: 21,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: colors.border,

  },



  likeUserInfo: {

    flex: 1,

    marginLeft: spacing.sm,

  },



  commentBody: {



    flex: 1,



    marginLeft: spacing.sm,



    backgroundColor: colors.background,



    borderRadius: 14,



    paddingHorizontal: spacing.sm,



    paddingVertical: spacing.sm,



  },







  commentNameRow: {



    flexDirection: 'row',



    alignItems: 'center',



    flexWrap: 'wrap',



  },







  commentName: {



    color: colors.primaryText,



    fontFamily: fontFamily.bodyMedium,



    fontSize: fontSize.sm,



  },







  commentUsername: {



    color: colors.secondaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.xs,



    marginLeft: spacing.xs,



  },







  commentContent: {



    color: colors.primaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.sm,



    lineHeight: 20,



    marginTop: 3,



  },







  commentHint: {



    color: colors.secondaryText,



    fontFamily: fontFamily.body,



    fontSize: 10,



    marginTop: 4,



  },







  commentInputRow: {



    flexDirection: 'row',



    alignItems: 'flex-end',



    paddingHorizontal: spacing.sm,



    paddingVertical: spacing.sm,



    borderTopWidth: 1,



    borderTopColor: colors.border,



    backgroundColor: colors.surface,



  },







  commentInput: {



    flex: 1,



    minHeight: 44,



    maxHeight: 110,



    color: colors.primaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.sm,



    backgroundColor: colors.background,



    borderWidth: 1,



    borderColor: colors.border,



    borderRadius: 18,



    paddingHorizontal: spacing.md,



    paddingVertical: spacing.sm,



  },







  commentSendButton: {



    width: 44,



    height: 44,



    borderRadius: 22,



    alignItems: 'center',



    justifyContent: 'center',



    marginLeft: spacing.sm,



    backgroundColor: colors.primaryText,



  },







  commentSendButtonDisabled: {



    opacity: 0.45,



  },







  commentSendText: {



    color: colors.background,



    fontSize: 18,



    fontFamily: fontFamily.bodyMedium,



  },







  feed: {



    gap: spacing.md,



    marginBottom: spacing.lg,



  },







  postCard: {



    backgroundColor: colors.surface,



    borderWidth: 1,



    borderColor: colors.border,



    borderRadius: 16,



    overflow: 'hidden',



    marginBottom: spacing.md,



  },







  postHeader: {



    flexDirection: 'row',



    alignItems: 'center',



    padding: spacing.md,



  },







  deletePostButton: {

    width: 38,

    height: 38,

    alignItems: 'center',

    justifyContent: 'center',

    borderRadius: 19,

  },



  deletePostText: {

    color: colors.secondaryText,

    fontSize: 18,

    letterSpacing: 2,

  },



  avatar: {



    width: 42,



    height: 42,



    borderRadius: 21,



  },







  avatarFallback: {



    width: 42,



    height: 42,



    borderRadius: 21,



    alignItems: 'center',



    justifyContent: 'center',



    backgroundColor: colors.background,



    borderWidth: 1,



    borderColor: colors.border,



  },







  avatarLetter: {



    color: colors.primaryText,



    fontFamily: fontFamily.bodyMedium,



    fontSize: fontSize.md,



  },







  authorInfo: {



    flex: 1,



    marginLeft: spacing.sm,



  },







  authorName: {



    color: colors.primaryText,



    fontFamily: fontFamily.bodyMedium,



    fontSize: fontSize.sm,



  },







  username: {



    color: colors.secondaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.xs,



    marginTop: 2,



  },







  postContent: {



    color: colors.primaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.md,



    lineHeight: 22,



    paddingHorizontal: spacing.md,



    paddingBottom: spacing.md,



  },







  postImage: {



    width: '100%',



    aspectRatio: 4 / 5,



    backgroundColor: colors.background,



  },



  postVideo: {



  width: '100%',



  aspectRatio: 4 / 5,



  backgroundColor: colors.background,



},



videoContainer: {



  position: 'relative',



},







videoMuteButton: {



  position: 'absolute',



  right: 10,



  bottom: 10,



  width: 34,



  height: 34,



  borderRadius: 17,



  alignItems: 'center',



  justifyContent: 'center',



  backgroundColor: 'rgba(0,0,0,0.55)',



},







videoMuteText: {



  fontSize: 16,



},











  emptyPostText: {



    color: colors.secondaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.sm,



    padding: spacing.md,



  },







  actions: {



    flexDirection: 'row',



    alignItems: 'center',



    paddingHorizontal: spacing.sm,



    paddingVertical: spacing.sm,



    borderTopWidth: 1,



    borderTopColor: colors.border,



  },







  actionButton: {



    flexDirection: 'row',



    alignItems: 'center',



    paddingHorizontal: spacing.sm,



    paddingVertical: spacing.xs,



    marginRight: spacing.sm,



  },







  saveButton: {



    marginLeft: 'auto',



    marginRight: 0,



  },







  actionIcon: {



    color: colors.primaryText,



    fontSize: 18,



    marginRight: 4,



  },







  likedIcon: {



    color: colors.accent,



  },







  actionText: {



    color: colors.secondaryText,



    fontFamily: fontFamily.body,



    fontSize: fontSize.xs,



  },







  likedText: {



    color: colors.accent,



  },







  chipWrap: {



    flexDirection: 'row',



    flexWrap: 'wrap',



    gap: spacing.sm,



  },







  dareWrapper: {



    marginBottom: spacing.md,



  },







  statusText: {



    color: colors.secondaryText,



    marginBottom: spacing.lg,



  },







  takingText: {



    color: colors.secondaryText,



    marginTop: -spacing.sm,



    marginBottom: spacing.sm,



    marginLeft: spacing.sm,



  },



});