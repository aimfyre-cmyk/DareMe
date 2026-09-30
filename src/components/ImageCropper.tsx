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
  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
  });

  const [zoom, setZoom] = useState(1);

  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedAreaPixels | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setCrop({
      x: 0,
      y: 0,
    });

    setZoom(1);
    setCroppedAreaPixels(null);
    setSaving(false);
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

    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return imageUri;
    }

    const image = new window.Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();

      image.onerror = () =>
        reject(
          new Error(
            'Could not load image.',
          ),
        );

      image.src = imageUri;
    });

    const canvas =
      document.createElement('canvas');

    canvas.width = Math.round(
      croppedAreaPixels.width,
    );

    canvas.height = Math.round(
      croppedAreaPixels.height,
    );

    const context =
      canvas.getContext('2d');

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
      const croppedUri =
        await createCroppedImage();

      onCropComplete(croppedUri);
    } catch (error) {
      console.error(
        '[ImageCropper] Crop error:',
        error,
      );

      onCropComplete(imageUri);
    } finally {
      setSaving(false);
    }
  };

  /*
   * WEB
   */
  if (Platform.OS === 'web') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
      >
        <View
          style={styles.webRoot}
        >
          <View
            style={styles.webContainer}
          >
            {/* HEADER */}
            <View
              style={styles.webHeader}
            >
              <Pressable
                onPress={onCancel}
                disabled={saving}
                hitSlop={12}
                style={
                  styles.headerButton
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  CANCEL
                </Text>
              </Pressable>

              <Text
                style={styles.title}
              >
                Crop Photo
              </Text>

              <Pressable
                onPress={handleDone}
                disabled={saving}
                hitSlop={12}
                style={[
                  styles.headerButton,
                  styles.doneButton,
                  saving &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    styles.doneText
                  }
                >
                  {saving
                    ? 'SAVING...'
                    : 'USE PHOTO'}
                </Text>
              </Pressable>
            </View>

            {/* CROP AREA */}
            <View
              style={styles.webCropArea}
            >
              <Cropper
                image={imageUri}
                crop={crop}
                zoom={zoom}
                aspect={4 / 5}
                onCropChange={
                  setCrop
                }
                onZoomChange={
                  setZoom
                }
                onCropComplete={
                  handleCropComplete
                }
                objectFit="contain"
                showGrid
              />
            </View>

            {/* BOTTOM CONTROLS */}
            <View
              style={styles.webBottom}
            >
              <Pressable
                onPress={() =>
                  setZoom(
                    (value) =>
                      Math.max(
                        1,
                        value - 0.1,
                      ),
                  )
                }
                style={
                  styles.zoomButton
                }
              >
                <Text
                  style={
                    styles.zoomButtonText
                  }
                >
                  −
                </Text>
              </Pressable>

              <Text
                style={styles.zoomValue}
              >
                {zoom.toFixed(1)}×
              </Text>

              <Pressable
                onPress={() =>
                  setZoom(
                    (value) =>
                      Math.min(
                        3,
                        value + 0.1,
                      ),
                  )
                }
                style={
                  styles.zoomButton
                }
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

            {/* LARGE MOBILE-FRIENDLY DONE BUTTON */}
            <View
              style={
                styles.webActionArea
              }
            >
              <Pressable
                onPress={handleDone}
                disabled={saving}
                style={[
                  styles.usePhotoButton,
                  saving &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    styles.usePhotoButtonText
                  }
                >
                  {saving
                    ? 'PROCESSING PHOTO...'
                    : '✓ USE THIS PHOTO'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  /*
   * ANDROID / IOS
   */
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View
        style={
          styles.nativeContainer
        }
      >
        <View
          style={styles.nativeHeader}
        >
          <Pressable
            onPress={onCancel}
            disabled={saving}
          >
            <Text
              style={
                styles.cancelText
              }
            >
              CANCEL
            </Text>
          </Pressable>

          <Text
            style={styles.title}
          >
            Crop Photo
          </Text>

          <Pressable
            onPress={handleDone}
            disabled={saving}
          >
            <Text
              style={
                styles.doneText
              }
            >
              {saving
                ? 'SAVING...'
                : 'DONE'}
            </Text>
          </Pressable>
        </View>

        <View
          style={
            styles.nativeContent
          }
        >
          <Text
            style={styles.nativeText}
          >
            Photo ready
          </Text>

          <Pressable
            onPress={handleDone}
            disabled={saving}
            style={
              styles.nativeDone
            }
          >
            <Text
              style={
                styles.nativeDoneText
              }
            >
              {saving
                ? 'Saving...'
                : '✓ USE THIS PHOTO'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /*
   * WEB ROOT
   */
  webRoot: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  webContainer: {
    width: '100%',
    height: '100%',
    maxWidth: 900,
    backgroundColor: '#000',
    display: 'flex',
    flexDirection: 'column',
  },

  /*
   * HEADER
   */
  webHeader: {
    height: 70,
    minHeight: 70,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor:
      '#222',
    zIndex: 100,
  },

  headerButton: {
    minWidth: 100,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  doneButton: {
    alignItems: 'flex-end',
  },

  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  cancelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  doneText: {
    color: '#1FAE6B',
    fontSize: 14,
    fontWeight: '800',
  },

  /*
   * CROP AREA
   */
  webCropArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
    minHeight: 0,
  },

  /*
   * ZOOM
   */
  webBottom: {
    height: 70,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },

  zoomButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },

  zoomButtonText: {
    color: '#fff',
    fontSize: 25,
    lineHeight: 28,
  },

  zoomValue: {
    color: '#fff',
    fontSize: 14,
    minWidth: 45,
    textAlign: 'center',
  },

  /*
   * BIG ACTION
   */
  webActionArea: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: '#000',
  },

  usePhotoButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#1FAE6B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  usePhotoButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.55,
  },

  /*
   * NATIVE
   */
  nativeContainer: {
    flex: 1,
    backgroundColor: '#000',
  },

  nativeHeader: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    borderBottomWidth: 1,
    borderBottomColor:
      '#222',
  },

  nativeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nativeText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },

  nativeDone: {
    minHeight: 50,
    paddingHorizontal: 30,
    borderRadius: 25,
    backgroundColor: '#1FAE6B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  nativeDoneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});