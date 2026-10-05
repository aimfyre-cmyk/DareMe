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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const {
      fileName,
      contentType,
      folder,
    }: {
      fileName?: string;
      contentType?: string;
      folder?: "posts" | "avatars";
    } = await req.json();

    if (!fileName || !contentType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "fileName and contentType are required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/png",
      "image/webp",

      // Videos
      "video/mp4",
      "video/quicktime",
      "video/webm",

      // Voice / Audio
      "audio/m4a",
      "audio/mp4",
      "audio/webm",
      "audio/aac",
    ];

    if (!allowedTypes.includes(contentType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unsupported media type",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const accessKey = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const endpoint = Deno.env.get("R2_ENDPOINT");
    const bucket = Deno.env.get("R2_BUCKET_NAME");

    if (!accessKey || !secretKey || !endpoint || !bucket) {
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

    const extension =
      fileName.split(".").pop()?.toLowerCase() || "bin";

    const targetFolder =
      folder === "avatars" ? "avatars" : "posts";

    const key = `${targetFolder}/${crypto.randomUUID()}.${extension}`;

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

    return new Response(
      JSON.stringify({
        success: true,
        uploadUrl,
        key,
        contentType,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "R2 presigned URL error:",
      error,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});