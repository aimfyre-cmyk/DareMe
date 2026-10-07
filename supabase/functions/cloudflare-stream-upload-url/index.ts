import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        error: 'Method not allowed.',
      },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    const cloudflareAccountId = Deno.env.get(
      'CLOUDFLARE_ACCOUNT_ID',
    );
    const cloudflareStreamToken = Deno.env.get(
      'CLOUDFLARE_STREAM_API_TOKEN',
    );

    if (
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      return jsonResponse(
        {
          error: 'Supabase environment is not configured.',
        },
        500,
      );
    }

    if (
      !cloudflareAccountId ||
      !cloudflareStreamToken
    ) {
      return jsonResponse(
        {
          error:
            'Cloudflare Stream environment variables are not configured.',
        },
        500,
      );
    }

    const authHeader =
      req.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse(
        {
          error: 'Authentication required.',
        },
        401,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          error: 'Invalid authentication session.',
        },
        401,
      );
    }

    const body = await req.json().catch(() => null);

    const fileName =
      typeof body?.fileName === 'string'
        ? body.fileName.trim()
        : '';

    const contentType =
      typeof body?.contentType === 'string'
        ? body.contentType.trim()
        : 'video/mp4';

    if (!fileName) {
      return jsonResponse(
        {
          error: 'fileName is required.',
        },
        400,
      );
    }

    if (!contentType.startsWith('video/')) {
      return jsonResponse(
        {
          error: 'Only video uploads are allowed.',
        },
        400,
      );
    }

    const streamUrl =
      `https://api.cloudflare.com/client/v4/accounts/` +
      `${cloudflareAccountId}/stream/direct_upload`;

    const uploadResponse = await fetch(
      streamUrl,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${cloudflareStreamToken}`,
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 120,
          meta: {
            userId: user.id,
            fileName,
            source: 'dareshot-private-shot',
          },
        }),
      },
    );

    const uploadData =
      await uploadResponse.json();

    if (
      !uploadResponse.ok ||
      !uploadData?.success ||
      !uploadData?.result?.uploadURL ||
      !uploadData?.result?.uid
    ) {
      console.error(
        '[Cloudflare Stream] Direct upload failed:',
        uploadData,
      );

      return jsonResponse(
        {
          error:
            uploadData?.errors?.[0]?.message ||
            'Unable to create Cloudflare Stream upload URL.',
        },
        502,
      );
    }

    return jsonResponse({
      success: true,
      uploadURL:
        uploadData.result.uploadURL,
      assetId:
        uploadData.result.uid,
      fileName,
      contentType,
    });
  } catch (error) {
    console.error(
      '[Cloudflare Stream] unexpected error:',
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error.',
      },
      500,
    );
  }
});y