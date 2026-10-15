import { Image } from 'react-native';

import { supabase } from '../../../lib/supabase';

const URL_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_URL_CACHE_ENTRIES = 250;

type CachedUrl = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, CachedUrl>();
const pendingUrlResolutions = new Map<string, Promise<string | null>>();
const prefetchedImages = new Set<string>();

function trimCacheIfNeeded() {
  while (signedUrlCache.size > MAX_URL_CACHE_ENTRIES) {
    const oldestKey = signedUrlCache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    signedUrlCache.delete(oldestKey);
  }
}

export function isRemoteMediaUrl(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}

/**
 * Synchronous lookup: a remote URL as-is, or a still-valid cached signed URL.
 * Never returns a raw R2 key, so callers can use it as an initial source.
 */
export function peekFeedMediaUrl(
  rawValue: string | null | undefined,
): string | null {
  const raw = rawValue?.trim() ?? '';
  if (!raw) return null;

  if (isRemoteMediaUrl(raw)) return raw;

  const cached = signedUrlCache.get(raw);
  return cached && cached.expiresAt > Date.now() ? cached.url : null;
}

/**
 * Resolve an R2 object key once and reuse the signed URL for the feed cache
 * lifetime. This keeps Home/Discover from repeatedly invoking the Edge
 * Function while scrolling back through already-seen media.
 */
export async function resolveFeedMediaUrl(
  rawValue: string | null | undefined,
): Promise<string | null> {
  const raw = rawValue?.trim() ?? '';
  if (!raw) return null;

  if (isRemoteMediaUrl(raw)) return raw;

  const cached = signedUrlCache.get(raw);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const pending = pendingUrlResolutions.get(raw);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('r2-media-url', {
        body: { key: raw },
      });

      const signedData = data as {
        success?: boolean;
        signedUrl?: string | null;
        error?: string | null;
      } | null;

      if (error || !signedData?.success || !signedData.signedUrl) {
        console.error('[FeedMediaEngine] R2 media resolve failed:', {
          key: raw,
          error: error ?? signedData?.error ?? 'No signed URL',
        });
        return null;
      }

      signedUrlCache.set(raw, {
        url: signedData.signedUrl,
        expiresAt: Date.now() + URL_CACHE_TTL_MS,
      });
      trimCacheIfNeeded();

      return signedData.signedUrl;
    } catch (error) {
      console.error('[FeedMediaEngine] R2 media resolve exception:', {
        key: raw,
        error,
      });
      return null;
    } finally {
      pendingUrlResolutions.delete(raw);
    }
  })();

  pendingUrlResolutions.set(raw, request);
  return request;
}

/**
 * Warm the React Native image cache. Safe to call repeatedly; duplicate
 * requests are ignored for the lifetime of this process.
 */
export async function prefetchFeedImage(
  url: string | null | undefined,
): Promise<boolean> {
  const normalized = url?.trim() ?? '';
  if (!normalized || prefetchedImages.has(normalized)) return true;

  try {
    const result = await Image.prefetch(normalized);
    if (result) prefetchedImages.add(normalized);
    return result;
  } catch (error) {
    console.warn('[FeedMediaEngine] Image prefetch failed:', error);
    return false;
  }
}

/**
 * Resolve and warm an image without blocking initial feed rendering.
 */
export async function warmFeedImage(
  rawValue: string | null | undefined,
): Promise<string | null> {
  const url = await resolveFeedMediaUrl(rawValue);
  if (!url) return null;
  void prefetchFeedImage(url);
  return url;
}

export function clearFeedMediaCache() {
  signedUrlCache.clear();
  pendingUrlResolutions.clear();
  prefetchedImages.clear();
}
