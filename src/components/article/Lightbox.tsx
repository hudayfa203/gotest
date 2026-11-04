import { Image } from 'expo-image';
import { Modal, Platform, StatusBar, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickImageUrl } from '../../lib/blocks';
import type { ImageRef } from '../../types';
import { Icon } from '../Icon';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

/** Full-screen image viewer: pinch to zoom, drag to pan, double-tap to zoom in/out, swipe down to close. */
export function Lightbox({ image, visible, onClose }: { image: ImageRef; visible: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    tx.value = withSpring(0);
    ty.value = withSpring(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.8, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      if (scale.value < 1) reset();
      else savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd((e) => {
      if (savedScale.value <= 1.01) {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      } else {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      }
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) reset();
      else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });
  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const ratio = image.width && image.height ? image.width / image.height : 16 / 9;
  const imgW = width;
  const imgH = Math.min(height * 0.8, width / ratio);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      {Platform.OS !== 'web' ? <StatusBar barStyle="light-content" /> : null}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
        <GestureDetector gesture={composed}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessibilityViewIsModal>
            <Animated.View style={[{ width: imgW, height: imgH }, style]}>
              <Image source={{ uri: pickImageUrl(image, 2048) }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityLabel={image.alt} />
            </Animated.View>
          </View>
        </GestureDetector>
        <View style={{ position: 'absolute', top: insets.top + 8, right: 12 }}>
          <Tap onPress={onClose} accessibilityLabel="Close image" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Tap>
        </View>
        {image.caption || image.credit ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 18, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            {image.caption ? (
              <Txt variant="serif" size={15} lineHeight={22} color="#FFFFFF">
                {image.caption}
              </Txt>
            ) : null}
            {image.credit ? (
              <Txt variant="ui" size={12} color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }}>
                {image.credit}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
