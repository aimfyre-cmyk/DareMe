import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1149.0";

import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1149.0";

/*
 * Signed playback URL lifetime.
 *
 * 1 hour is enough for feed playback and
 * avoids unnecessarily long-lived URLs.
 */
const MEDIA_URL_TTL_SECONDS = 60 * 60;

// S3/R2 object keys are at most 1024 bytes.
const MAX_KEY_LENGTH = 1024;

function errorResponse(error: string, status: number) {
  return Response.json(
    { success: false, error },
    { status },
  );
}

function isValidObjectKey(key: string) {
  /*
   * Never allow arbitrary URL generation.
   * Only R2 object keys are accepted.
   */
  return key.length <= MAX_KEY_LENGTH &&
    !key.startsWith("/") &&
    !key.startsWith("http://") &&
    !key.startsWith("https://") &&
    !key.includes("..") &&
    // deno-lint-ignore no-control-regex
    !/[\u0000-\u001f\u007f]/.test(key);
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

        const key = typeof body?.key === "string" ? body.key.trim() : "";

        if (!key) {
          return errorResponse("key is required", 400);
        }

        if (!isValidObjectKey(key)) {
          return errorResponse("Invalid R2 object key", 400);
        }

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

        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        const signedUrl = await getSignedUrl(
          client,
          command,
          {
            expiresIn: MEDIA_URL_TTL_SECONDS,
          },
        );

        return Response.json({
          success: true,
          signedUrl,
          key,
        });
      } catch (error) {
        console.error("R2 media URL error:", error);

        return errorResponse("Unable to create media URL", 500);
      }
    },
  ),
};
