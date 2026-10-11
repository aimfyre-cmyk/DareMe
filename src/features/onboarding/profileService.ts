import { File } from 'expo-file-system';
import { toFunctionError } from '../../lib/functionError';
import { supabase } from '../../lib/supabase';

export type ProfileData = {
  username: string;
  display_name: string;
  country: string;
  language: string;
  gender: string;
  date_of_birth: string;
  age_bracket: string;
  bio: string;
  avatar_url?: string | null;
};

export type DarePreferencesData = {
  difficulty_comfort: string;
  preferred_proof_types: ('photo' | 'video' | 'text')[];
};

/**
 * Check whether the requested username is available.
 *
 * Username uniqueness is checked through a secure database RPC
 * because Phase 4 profile RLS prevents users from reading
 * other users' profile rows.
 */
export async function isUsernameAvailable(
  username: string,
  _currentUserId?: string,
): Promise<boolean> {
  const cleanUsername = username.trim().toLowerCase();

  if (!cleanUsername) {
    return false;
  }

  const { data, error } = await supabase.rpc(
    'is_username_available',
    {
      check_username: cleanUsername,
    },
  );

  if (error) {
    throw error;
  }

  return Boolean(data);
}

/**
 * Upload a profile avatar to Supabase Storage.
 *
 * Files are stored inside a user-specific folder:
 *
 * avatars/{userId}/{timestamp}.jpg
 *
 * This matches the Storage INSERT policy:
 * the first folder must equal auth.uid().
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  if (!localUri) {
    throw new Error('Profile image is required.');
  }

  try {
    console.log(
      '[DareMe Avatar] Reading local file:',
      localUri,
    );

    const file = new File(localUri);
    const arrayBuffer =
      await file.arrayBuffer();

    if (
      !arrayBuffer ||
      arrayBuffer.byteLength === 0
    ) {
      throw new Error(
        'The selected profile photo is empty or could not be read.',
      );
    }

    const fileName =
      `${userId}/${Date.now()}.jpg`;

    const contentType = 'image/jpeg';

    console.log(
      '[DareMe Avatar] Requesting R2 upload URL:',
      fileName,
    );

    const {
      data: uploadUrlData,
      error: uploadUrlError,
    } = await supabase.functions.invoke(
      'r2-upload-url',
      {
        body: {
          fileName,
          contentType,
          folder: 'avatars',
          fileSize: arrayBuffer.byteLength,
        },
      },
    );

    if (uploadUrlError) {
      throw await toFunctionError(uploadUrlError);
    }

    if (
      !uploadUrlData?.success ||
      !uploadUrlData?.uploadUrl ||
      !uploadUrlData?.key
    ) {
      throw new Error(
        uploadUrlData?.error ??
          'Unable to create R2 avatar upload URL.',
      );
    }

    console.log(
      '[DareMe Avatar] Uploading to R2:',
      uploadUrlData.key,
    );

    const uploadResponse =
      await fetch(
        uploadUrlData.uploadUrl,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              contentType,
          },
          body: arrayBuffer,
        },
      );

    if (!uploadResponse.ok) {
      throw new Error(
        `R2 avatar upload failed: ${uploadResponse.status}`,
      );
    }

    console.log(
      '[DareMe Avatar] R2 upload successful:',
      uploadUrlData.key,
    );

    /*
     * Store the R2 key in profiles.avatar_url.
     *
     * The actual signed URL will be generated
     * when the avatar needs to be displayed.
     */
    return uploadUrlData.key;
  } catch (error) {
    console.error(
      '[DareMe Avatar] R2 upload failed:',
      error,
    );

    throw error instanceof Error
      ? error
      : new Error(
          'Could not upload the selected profile photo.',
        );
  }
}

/**
 * Create or update the authenticated user's profile.
 */
export async function saveProfile(
  userId: string,
  profile: ProfileData,
) {
  const username = profile.username.trim().toLowerCase();

  if (!username) {
    throw new Error('Username is required.');
  }

  if (!profile.gender) {
    throw new Error('Gender is required.');
  }

  if (!profile.date_of_birth) {
    throw new Error('Date of birth is required.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        username,
        display_name: profile.display_name.trim(),
        country: profile.country.trim(),
        language: profile.language.trim(),
        gender: profile.gender,
        date_of_birth: profile.date_of_birth,
        age_bracket: profile.age_bracket,
        bio: profile.bio.trim(),
        avatar_url: profile.avatar_url ?? null,
      },
      {
        onConflict: 'id',
      },
    )
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('That username is already taken.');
    }

    throw error;
  }

  return data;
}

/**
 * Save the user's selected interests.
 *
 * Existing interests are replaced with the current selection.
 */
export async function saveInterests(
  userId: string,
  interests: string[],
) {
  const uniqueInterests = [...new Set(interests)];

  const { error: deleteError } = await supabase
    .from('user_interests')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw deleteError;
  }

  if (uniqueInterests.length === 0) {
    return [];
  }

  const rows = uniqueInterests.map((interest) => ({
    user_id: userId,
    interest,
  }));

  const { data, error } = await supabase
    .from('user_interests')
    .insert(rows)
    .select();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Save the user's dare preferences.
 */
export async function saveDarePreferences(
  userId: string,
  preferences: DarePreferencesData,
) {
  const { data, error } = await supabase
    .from('dare_preferences')
    .upsert(
      {
        user_id: userId,
        difficulty_comfort:
          preferences.difficulty_comfort,
        preferred_proof_types:
          preferences.preferred_proof_types,
      },
      {
        onConflict: 'user_id',
      },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Fetch the authenticated user's profile.
 */
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Fetch the authenticated user's interests.
 */
export async function getUserInterests(userId: string) {
  const { data, error } = await supabase
    .from('user_interests')
    .select('interest')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (
    data?.map((item) => item.interest) ?? []
  );
}

/**
 * Fetch the authenticated user's dare preferences.
 */
export async function getDarePreferences(
  userId: string,
) {
  const { data, error } = await supabase
    .from('dare_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Check whether onboarding has been completed.
 *
 * A profile row is the Phase 4 completion signal.
 */
export async function hasCompletedOnboarding(
  userId: string,
): Promise<boolean> {
  const profile = await getProfile(userId);

  return Boolean(profile);
}

/**
 * Save the complete onboarding payload.
 *
 * If an avatar URI is supplied, it is uploaded first.
 * The resulting public URL is then saved to profiles.avatar_url.
 */
export async function saveCompleteOnboarding(
  userId: string,
  profile: ProfileData,
  interests: string[],
  preferences: DarePreferencesData,
  avatarUri?: string | null,
) {
  let avatarUrl = profile.avatar_url ?? null;

  if (avatarUri) {
    avatarUrl = await uploadAvatar(
      userId,
      avatarUri,
    );
  }

  const savedProfile = await saveProfile(
    userId,
    {
      ...profile,
      avatar_url: avatarUrl,
    },
  );

  const savedInterests = await saveInterests(
    userId,
    interests,
  );

  const savedPreferences =
    await saveDarePreferences(
      userId,
      preferences,
    );

  return {
    profile: savedProfile,
    interests: savedInterests,
    preferences: savedPreferences,
  };
}
export async function getR2MediaUrl(
  key: string,
): Promise<string | null> {
  if (!key) {
    return null;
  }

  try {
    const {
      data,
      error,
    } = await supabase.functions.invoke(
      'r2-media-url',
      {
        body: {
          key,
        },
      },
    );

    if (error) {
      console.error(
        '[DareMe R2] Media URL failed:',
        error,
      );

      return null;
    }

    if (
      !data?.success ||
      !data?.signedUrl
    ) {
      console.error(
        '[DareMe R2] Invalid media URL response:',
        data,
      );

      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(
      '[DareMe R2] Media URL error:',
      error,
    );

    return null;
  }
}
