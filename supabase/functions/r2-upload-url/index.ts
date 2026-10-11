import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import { PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1149.0";

import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1149.0";

/*
 * Clients that send fileSize get a URL locked to that exact byte size
 * and content type. While this is false, older clients that do not send
 * fileSize yet still get a URL (login is still required) but without
 * the size/type lock. Flip to true once every client sends fileSize.
 */
const REQUIRE_FILE_SIZE = false;

const MB = 1024 * 1024;

// Max bytes a single presigned upload may write, per media kind.
const MAX_UPLOAD_BYTES = {
  image: 50 * MB,
  video: 500 * MB,
  audio: 100 * MB,
} as const;

type MediaKind = keyof typeof MAX_UPLOAD_BYTES;

type UploadFolder =
  | "posts"
  | "avatars"
  | "dares";

// Allowed content types, their size class, and the extension used when
// the client's file name does not carry a known extension.
const ALLOWED_TYPES: Record<string, { kind: MediaKind; extension: string }> = {
  // Images
  "image/jpeg": { kind: "image", extension: "jpg" },
  "image/png": { kind: "image", extension: "png" },
  "image/webp": { kind: "image", extension: "webp" },

  // Videos
  "video/mp4": { kind: "video", extension: "mp4" },
  "video/quicktime": { kind: "video", extension: "mov" },
  "video/webm": { kind: "video", extension: "webm" },

  // Audio / Music
  "audio/m4a": { kind: "audio", extension: "m4a" },
  "audio/mp4": { kind: "audio", extension: "m4a" },
  "audio/webm": { kind: "audio", extension: "webm" },
  "audio/aac": { kind: "audio", extension: "aac" },
  "audio/mpeg": { kind: "audio", extension: "mp3" },
  "audio/mp3": { kind: "audio", extension: "mp3" },
  "audio/x-m4a": { kind: "audio", extension: "m4a" },
  "audio/wav": { kind: "audio", extension: "wav" },
  "audio/x-wav": { kind: "audio", extension: "wav" },
  // iOS reports .wav as audio/vnd.wave (UTType preferredMIMEType).
  "audio/vnd.wave": { kind: "audio", extension: "wav" },
  "audio/wave": { kind: "audio", extension: "wav" },
  "audio/ogg": { kind: "audio", extension: "ogg" },
};

// A client-supplied extension is kept only when it matches the kind
// of the declared content type (no 500 MB video stored as ".png").
const EXTENSION_KINDS: Record<string, MediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  m4a: "audio",
  aac: "audio",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
};

const UPLOAD_URL_TTL_SECONDS = 60 * 10;

type UploadRequest = {
  fileName?: unknown;
  contentType?: unknown;
  folder?: unknown;
  fileSize?: unknown;
};

function errorResponse(error: string, status: number) {
  return Response.json(
    { success: false, error },
    { status },
  );
}

function getExtension(
  fileName: string,
  typeInfo: { kind: MediaKind; extension: string },
) {
  const requested = fileName.split(".").pop()?.toLowerCase() ?? "";

  return Object.hasOwn(EXTENSION_KINDS, requested) &&
      EXTENSION_KINDS[requested] === typeInfo.kind
    ? requested
    : typeInfo.extension;
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

  // Create Dare code sends paths containing /dares/ without a folder value.
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

export default {
  fetch: withSupabase(
    { auth: "user", errors: { detailed: false } },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return errorResponse("Method not allowed", 405);
      }

      const userId = ctx.userClaims?.id;

      if (!userId) {
        return errorResponse("Authenticated user not found", 401);
      }

      try {
        const body = (await req.json().catch(() => null)) as
          | UploadRequest
          | null;

        const fileName = typeof body?.fileName === "string"
          ? body.fileName.trim()
          : "";

        // Signed as-is: it must equal the Content-Type header the client
        // sends on the PUT. The lowercased form is only used for lookup.
        const contentType = typeof body?.contentType === "string"
          ? body.contentType.trim()
          : "";
        const normalizedType = contentType.toLowerCase();

        if (!fileName || !contentType) {
          return errorResponse("fileName and contentType are required", 400);
        }

        // Own-property lookup only: "constructor", "toString" etc. must not
        // resolve to Object.prototype members and skip the size limit.
        const typeInfo = Object.hasOwn(ALLOWED_TYPES, normalizedType)
          ? ALLOWED_TYPES[normalizedType]
          : undefined;

        if (!typeInfo) {
          return errorResponse(
            `Unsupported media type: ${normalizedType}`,
            400,
          );
        }

        let fileSize: number | null = null;

        if (body?.fileSize !== undefined && body?.fileSize !== null) {
          if (
            typeof body.fileSize !== "number" ||
            !Number.isSafeInteger(body.fileSize) ||
            body.fileSize <= 0
          ) {
            return errorResponse(
              "fileSize must be the exact file size in bytes",
              400,
            );
          }

          fileSize = body.fileSize;
        } else if (REQUIRE_FILE_SIZE) {
          return errorResponse(
            "fileSize is required. Please update the app.",
            400,
          );
        }

        const maxBytes = MAX_UPLOAD_BYTES[typeInfo.kind];

        if (fileSize !== null && fileSize > maxBytes) {
          return errorResponse(
            `File is too large. Max ${maxBytes / MB} MB for ${typeInfo.kind}.`,
            413,
          );
        }

        const accessKey = Deno.env.get("R2_ACCESS_KEY_ID");
        const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
        const endpoint = Deno.env.get("R2_ENDPOINT");
        const bucket = Deno.env.get("R2_BUCKET_NAME");

        if (!accessKey || !secretKey || !endpoint || !bucket) {
          console.error("R2 configuration is missing");
          return errorResponse("Upload service is not configured", 500);
        }

        const client = new S3Client({
          region: "auto",
          endpoint,
          credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
          },
          // SDK >= 3.729 otherwise signs an empty-body CRC32 checksum into
          // presigned PUT URLs, which breaks real uploads on R2.
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
        });

        const folder = resolveFolder(body?.folder, fileName);
        const extension = getExtension(fileName, typeInfo);

        /*
         * The client's fileName is never used as the key, so user supplied
         * paths cannot create or overwrite arbitrary objects.
         */
        const key = `${folder}/${crypto.randomUUID()}.${extension}`;

        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
          ...(fileSize !== null ? { ContentLength: fileSize } : {}),
        });

        // With a declared size, Content-Length and Content-Type are signed
        // into the URL, so the upload must match them exactly.
        const uploadUrl = await getSignedUrl(
          client,
          command,
          {
            expiresIn: UPLOAD_URL_TTL_SECONDS,
            ...(fileSize !== null
              ? { signableHeaders: new Set(["content-length", "content-type"]) }
              : {}),
          },
        );

        console.log("R2 upload URL issued", {
          userId,
          key,
          contentType: normalizedType,
          fileSize,
        });

        return Response.json({
          success: true,
          uploadUrl,
          key,
          // The exact value signed into the URL; the PUT must send this.
          contentType,
          folder,
        });
      } catch (error) {
        console.error("R2 presigned URL error:", error);

        return errorResponse("Unable to create upload URL", 500);
      }
    },
  ),
};
