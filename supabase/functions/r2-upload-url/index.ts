import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  PutObjectCommand,
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

type UploadFolder =
  | "posts"
  | "avatars"
  | "dares";

const allowedTypes = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",

  // Videos
  "video/mp4",
  "video/quicktime",
  "video/webm",

  // Audio / Music
  "audio/m4a",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);

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

function getExtension(fileName: string, contentType: string) {
  const originalExtension =
    fileName.split(".").pop()?.toLowerCase();

  if (
    originalExtension &&
    originalExtension.length <= 10 &&
    /^[a-z0-9]+$/.test(originalExtension)
  ) {
    return originalExtension;
  }

  const mimeExtensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",

    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",

    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "audio/aac": "aac",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
  };

  return mimeExtensions[contentType] || "bin";
}

function resolveFolder(
  requestedFolder: unknown,
  fileName: string,
): UploadFolder {
  // Explicit folder always wins.
  if (
    requestedFolder === "posts" ||
    requestedFolder === "avatars" ||
    requestedFolder === "dares"
  ) {
    return requestedFolder;
  }

  // Existing DareMe Create Dare code sends paths containing /dares/
  // but currently does not send a folder value.
  if (
    fileName.includes("/dares/") ||
    fileName.includes("\\dares\\")
  ) {
    return "dares";
  }

  // Existing avatar uploads can contain /avatars/
  if (
    fileName.includes("/avatars/") ||
    fileName.includes("\\avatars\\")
  ) {
    return "avatars";
  }

  // Preserve existing behavior for normal post uploads.
  return "posts";
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

    const fileName =
      typeof body?.fileName === "string"
        ? body.fileName.trim()
        : "";

    const contentType =
      typeof body?.contentType === "string"
        ? body.contentType.trim().toLowerCase()
        : "";

    const requestedFolder = body?.folder;

    if (!fileName || !contentType) {
      return jsonResponse(
        {
          success: false,
          error: "fileName and contentType are required",
        },
        400,
      );
    }

    if (!allowedTypes.has(contentType)) {
      return jsonResponse(
        {
          success: false,
          error: `Unsupported media type: ${contentType}`,
        },
        400,
      );
    }

    const accessKey = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const endpoint = Deno.env.get("R2_ENDPOINT");
    const bucket = Deno.env.get("R2_BUCKET_NAME");

    if (
      !accessKey ||
      !secretKey ||
      !endpoint ||
      !bucket
    ) {
      throw new Error("R2 configuration is missing");
    }

    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    const folder = resolveFolder(
      requestedFolder,
      fileName,
    );

    const extension = getExtension(
      fileName,
      contentType,
    );

    /*
     * Keep the R2 key simple and safe.
     *
     * Existing behavior:
     *   posts/<uuid>.<ext>
     *   avatars/<uuid>.<ext>
     *
     * New Dare behavior:
     *   dares/<uuid>.<ext>
     *
     * The original fileName is intentionally NOT used directly
     * as an R2 key so user supplied paths cannot create unsafe
     * object paths.
     */
    const key =
      `${folder}/${crypto.randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(
      client,
      command,
      {
        expiresIn: 60 * 10,
      },
    );

    return jsonResponse({
      success: true,
      uploadUrl,
      key,
      contentType,
      folder,
    });
  } catch (error) {
    console.error(
      "R2 presigned URL error:",
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