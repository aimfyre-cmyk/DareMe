import * as FileSystem from 'expo-file-system/legacy';

/**
 * Exact byte size of a local file. r2-upload-url signs this value into
 * the presigned URL, so it must match the bytes that get uploaded.
 */
export async function getLocalFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists || info.isDirectory || info.size <= 0) {
    throw new Error('The selected file is empty or could not be read.');
  }

  return info.size;
}
