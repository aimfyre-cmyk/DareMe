import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1149.0";

import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1149.0";

/*
 * Playable URL for a private shot's proof (voice or video).
 *
 * The client sends only the shot id, never a media key. Access is decided
 * by the caller's own get_private_shot_response call (user-scoped client,
 * so the RPC's auth.uid() / participant checks apply). The proof's
 * media_key is then either:
 * - a Cloudflare Stream UID (32 hex chars) -> HLS manifest URL, signed
 *   with a short-lived token when the video requires signed URLs, or
 * - an R2 key (posts/... or private-shots/...) -> presigned GET URL.
 */

const URL_TTL_SECONDS = 60 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STREAM_UID_RE = /^[0-9a-f]{32}$/;

const R2_KEY_RE =
  /^(posts|private-shots)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

type ShotResponse = {
  media_type?: unknown;
  media_key?: unknown;
};

type StreamVideo = {
  readyToStream?: boolean;
  requireSignedURLs?: boolean;
  playback?: { hls?: string };
  status?: {
    state?: string;
    pctComplete?: string;
    errorReasonCode?: string;
  };
};

function errorResponse(error: string, status: number) {
  return Response.json(
    { success: false, error },
    { status },
  );
}

async function streamPlayback(uid: string) {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");

  if (!accountId || !apiToken) {
    console.error("Cloudflare Stream configuration is missing");
    return errorResponse("Media service is not configured", 500);
  }

  const base =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;
  const headers = { Authorization: `Bearer ${apiToken}` };

  const videoResponse = await fetch(base, { headers });
  const videoBody = await videoResponse.json().catch(() => null);

  if (videoResponse.status === 404) {
    return errorResponse("Proof media not found", 404);
  }

  if (!videoResponse.ok || !videoBody?.success || !videoBody?.result) {
    console.error("Cloudflare Stream video lookup failed:", {
      status: videoResponse.status,
      errors: videoBody?.errors,
    });
    return errorResponse("Unable to load proof media", 502);
  }

  const video = videoBody.result as StreamVideo;

  if (video.status?.state === "error") {
    return Response.json(
      {
        success: false,
        status: "failed",
        error: "This video could not be processed",
        reason: video.status.errorReasonCode ?? null,
      },
      { status: 422 },
    );
  }

  const hls = video.playback?.hls;

  if (video.readyToStream !== true || !hls) {
    return Response.json({
      success: true,
      status: "processing",
      retryAfterSeconds: 10,
    });
  }

  let url = hls;

  if (video.requireSignedURLs) {
    const exp = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;

    const tokenResponse = await fetch(`${base}/token`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ exp }),
    });
    const tokenBody = await tokenResponse.json().catch(() => null);
    const token = tokenBody?.result?.token;

    if (!tokenResponse.ok || typeof token !== "string" || !token) {
      console.error("Cloudflare Stream token request failed:", {
        status: tokenResponse.status,
        errors: tokenBody?.errors,
      });
      return errorResponse("Unable to load proof media", 502);
    }

    // The signed token replaces the UID in the manifest path.
    url = `${new URL(hls).origin}/${token}/manifest/video.m3u8`;
  }

  return Response.json({
    success: true,
    status: "ready",
    playback: {
      kind: "stream",
      url,
      contentType: "hls",
      expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString(),
    },
  });
}

async function r2Playback(key: string) {
  const accessKey = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const endpoint = Deno.env.get("R2_ENDPOINT");
  const bucket = Deno.env.get("R2_BUCKET_NAME");

  if (!accessKey || !secretKey || !endpoint || !bucket) {
    console.error("R2 configuration is missing");
    return errorResponse("Media service is not configured", 500);
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    // Keep presigned GETs free of SDK checksum query params.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: URL_TTL_SECONDS },
  );

  return Response.json({
    success: true,
    status: "ready",
    playback: {
      kind: "r2",
      url,
      contentType: "progressive",
      expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString(),
    },
  });
}

export default {
  fetch: withSupabase(
    { auth: "user", errors: { detailed: false } },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return errorResponse("Method not allowed", 405);
      }

      if (!ctx.userClaims?.id) {
        return errorResponse("Authenticated user not found", 401);
      }

      try {
        const body = await req.json().catch(() => null);
        const shotId = typeof body?.shotId === "string"
          ? body.shotId.trim()
          : "";

        if (!UUID_RE.test(shotId)) {
          return errorResponse("A valid shotId is required", 400);
        }

        // Runs as the caller: the RPC decides whether they may see it.
        const { data, error } = await ctx.supabase.rpc(
          "get_private_shot_response",
          { p_shot_id: shotId },
        );

        if (error) {
          console.warn("get_private_shot_response refused:", {
            code: error.code,
            message: error.message,
          });
          return errorResponse("You can't view this proof", 403);
        }

        const response = (Array.isArray(data) ? data[0] : data) as
          | ShotResponse
          | null
          | undefined;
        const mediaKey = typeof response?.media_key === "string"
          ? response.media_key.trim()
          : "";

        if (!mediaKey) {
          return errorResponse("Proof not found", 404);
        }

        if (STREAM_UID_RE.test(mediaKey)) {
          return await streamPlayback(mediaKey);
        }

        if (R2_KEY_RE.test(mediaKey)) {
          return await r2Playback(mediaKey);
        }

        console.error("Unsupported proof media key format", { shotId });
        return errorResponse("Unsupported proof media", 422);
      } catch (error) {
        console.error("Private shot proof URL error:", error);

        return errorResponse("Unable to load proof media", 500);
      }
    },
  ),
};
