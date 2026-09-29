import { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type CroppedAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageCropperProps = {
  visible: boolean;
  imageUri: string;
  onCancel: () => void;
  onCropComplete: (croppedUri: string) => void;
};

export function ImageCropper({
  visible,
  imageUri,
  onCancel,
  onCropComplete,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedAreaPixels | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setSaving(false);
    }
  }, [visible, imageUri]);

  const handleCropComplete = (
    _croppedArea: unknown,
    croppedPixels: CroppedAreaPixels,
  ) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) {
      return imageUri;
    }

    const image = new window.Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('Could not load image.'));

      image.src = imageUri;
    });

    const canvas = document.createElement('canvas');

    canvas.width = Math.round(
      croppedAreaPixels.width,
    );

    canvas.height = Math.round(
      croppedAreaPixels.height,
    );

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'Could not create canvas.',
      );
    }

    context.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
    );

    return await new Promise<string>(
      (resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  'Could not create cropped image.',
                ),
              );
              return;
            }

            resolve(
              URL.createObjectURL(blob),
            );
          },
          'image/jpeg',
          0.9,
        );
      },
    );
  };

  const handleDone = async () => {
    if (saving) {
      return;
    }

    setSaving(true);

    try {
      if (Platform.OS === 'web') {
        const croppedUri =
          await createCroppedImage();

        onCropComplete(croppedUri);
      } else {
        onCropComplete(imageUri);
      }
    } catch (error) {
      console.error(
        'Crop error:',
        error,
      );

      onCropComplete(imageUri);
    } finally {
      setSaving(false);
    }
  };

  /*
   * WEB VERSION
   *
   * Don't use React Native Modal here.
   * Render the crop editor directly as a fixed overlay.
   */
  if (Platform.OS === 'web') {
    if (!visible) {
      return null;
    }

    return (
      <View style={styles.webOverlay}>
        <View style={styles.webHeader}>
          <Pressable
            onPress={onCancel}
            disabled={saving}
          >
            <Text style={styles.cancelText}>
              Cancel
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Crop Photo
          </Text>

          <Pressable
            onPress={handleDone}
            disabled={saving}
          >
            <Text style={styles.doneText}>
              {saving
                ? 'Saving...'
                : 'Done'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.webCropArea}>
          <Cropper
            image={imageUri}
            crop={crop}
            zoom={zoom}
            aspect={4 / 5}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={
              handleCropComplete
            }
            objectFit="contain"
          />
        </View>

        <View style={styles.webBottom}>
          <Pressable
            onPress={() =>
              setZoom((value) =>
                Math.max(
                  1,
                  value - 0.1,
                ),
              )
            }
            style={styles.zoomButton}
          >
            <Text
              style={
                styles.zoomButtonText
              }
            >
              −
            </Text>
          </Pressable>

          <Text style={styles.zoomValue}>
            {zoom.toFixed(1)}×
          </Text>

          <Pressable
            onPress={() =>
              setZoom((value) =>
                Math.min(
                  3,
                  value + 0.1,
                ),
              )
            }
            style={styles.zoomButton}
          >
            <Text
              style={
                styles.zoomButtonText
              }
            >
              +
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /*
   * ANDROID / IOS
   *
   * Native picker already handles the crop.
   */
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={styles.nativeContainer}>
        <Text style={styles.nativeText}>
          Photo ready
        </Text>

        <Pressable
          onPress={() =>
            onCropComplete(imageUri)
          }
          style={styles.nativeDone}
        >
          <Text
            style={
              styles.nativeDoneText
            }
          >
            Done
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /*
   * WEB
   */
  webOverlay: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    backgroundColor: '#000',
    display: 'flex',
    flexDirection: 'column',
  },

  webHeader: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000',
    zIndex: 10,
  },

  webCropArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
    minHeight: 0,
  },

  webBottom: {
    height: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: '#000',
  },

  /*
   * COMMON
   */
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  cancelText: {
    color: '#fff',
    fontSize: 16,
  },

  doneText: {
    color: '#1FAE6B',
    fontSize: 16,
    fontWeight: '700',
  },

  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },

  zoomButtonText: {
    color: '#fff',
    fontSize: 24,
  },

  zoomValue: {
    color: '#fff',
    fontSize: 14,
    minWidth: 45,
    textAlign: 'center',
  },

  /*
   * NATIVE
   */
  nativeContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  nativeText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },

  nativeDone: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#1FAE6B',
  },

  nativeDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});