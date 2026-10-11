import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
    GetObjectCommand,
    S3Client,
} from "npm:@aws-sdk/client-s3";

import {
    getSignedUrl,
} from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const body = await req.json();

    const key =
      typeof body?.key === "string"
        ? body.key.trim()
        : "";

    if (!key) {
      return jsonResponse(
        {
          success: false,
          error: "key is required",
        },
        400,
      );
    }

    /*
     * Never allow arbitrary URL generation.
     * Only R2 object keys are accepted.
     */
    if (
      key.startsWith("http://") ||
      key.startsWith("https://") ||
      key.includes("..")
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid R2 object key",
        },
        400,
      );
    }

    const accessKey = Deno.env.get(
      "R2_ACCESS_KEY_ID",
    );

    const secretKey = Deno.env.get(
      "R2_SECRET_ACCESS_KEY",
    );

    const endpoint = Deno.env.get(
      "R2_ENDPOINT",
    );

    const bucket = Deno.env.get(
      "R2_BUCKET_NAME",
    );

    if (
      !accessKey ||
      !secretKey ||
      !endpoint ||
      !bucket
    ) {
      throw new Error(
        "R2 configuration is missing",
      );
    }

    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    /*
     * Signed playback URL.
     *
     * 1 hour is enough for feed playback and
     * avoids unnecessarily long-lived URLs.
     */
    const signedUrl = await getSignedUrl(
      client,
      command,
      {
        expiresIn: 60 * 60,
      },
    );

    return jsonResponse({
      success: true,
      signedUrl,
      key,
    });
  } catch (error) {
    console.error(
      "R2 media URL error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
    );
  }
});