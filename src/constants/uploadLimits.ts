// Client-side mirror of the limits enforced by
// supabase/functions/r2-upload-url/index.ts. Keep the two in sync: the
// server is the source of truth; this only lets the app reject a file right
// after it's picked instead of after a long upload.

export const MB = 1024 * 1024;

export type UploadKind = 'image' | 'video' | 'audio';

export const MAX_UPLOAD_BYTES: Record<UploadKind, number> = {
  image: 50 * MB,
  video: 500 * MB,
  audio: 100 * MB,
};

const UPLOAD_KIND_BY_TYPE: Record<string, UploadKind> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',

  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',

  'audio/m4a': 'audio',
  'audio/mp4': 'audio',
  'audio/webm': 'audio',
  'audio/aac': 'audio',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/x-m4a': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/vnd.wave': 'audio',
  'audio/wave': 'audio',
  'audio/ogg': 'audio',
};

/** The upload kind a content type is accepted as, or null if it isn't. */
export function getUploadKind(
  contentType: string | null | undefined,
): UploadKind | null {
  const normalized = contentType?.trim().toLowerCase() ?? '';

  return Object.prototype.hasOwnProperty.call(UPLOAD_KIND_BY_TYPE, normalized)
    ? UPLOAD_KIND_BY_TYPE[normalized]
    : null;
}
