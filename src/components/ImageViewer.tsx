import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { bim } from '../assets/images';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

const DISMISS_DISTANCE = 120;

type ZoomableImageProps = {
  height: number;
  onClose: () => void;
  onZoomChange: (zoomed: boolean) => void;
  uri: string;
  width: number;
};

/**
 * One page of the viewer: pinch to zoom around the fingers, drag to pan while
 * zoomed, double-tap to toggle zoom, swipe down (unzoomed) to close. Panning
 * is clamped to the image edges.
 */
function ZoomableImage({
  height,
  onClose,
  onZoomChange,
  uri,
  width,
}: ZoomableImageProps) {
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dismissY = useSharedValue(0);

  const reportZoom = useCallback(
    (next: boolean) => {
      setZoomed(next);
      onZoomChange(next);
    },
    [onZoomChange],
  );

  const clampX = (x: number, s: number) => {
    'worklet';
    const max = (width * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, x));
  };
  const clampY = (y: number, s: number) => {
    'worklet';
    const max = (height * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, y));
  };

  const settle = (s: number, x: number, y: number) => {
    'worklet';
    scale.value = withTiming(s);
    translateX.value = withTiming(clampX(x, s));
    translateY.value = withTiming(clampY(y, s));
    savedScale.value = s;
    savedX.value = clampX(x, s);
    savedY.value = clampY(y, s);
    scheduleOnRN(reportZoom, s > MIN_SCALE);
  };

  // Focal point relative to the image centre, captured when the pinch starts.
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart(event => {
      savedScale.value = scale.value;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      focalX.value = event.focalX - width / 2;
      focalY.value = event.focalY - height / 2;
    })
    .onUpdate(event => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE * 0.7, savedScale.value * event.scale),
      );
      const ratio = next / savedScale.value;
      // Keep the point under the fingers fixed while scaling.
      scale.value = next;
      translateX.value = focalX.value - (focalX.value - savedX.value) * ratio;
      translateY.value = focalY.value - (focalY.value - savedY.value) * ratio;
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        settle(MIN_SCALE, 0, 0);
      } else {
        settle(scale.value, translateX.value, translateY.value);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onStart(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate(event => {
      translateX.value = savedX.value + event.translationX;
      translateY.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      settle(scale.value, translateX.value, translateY.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(event => {
      if (scale.value > MIN_SCALE) {
        settle(MIN_SCALE, 0, 0);
      } else {
        const fx = event.x - width / 2;
        const fy = event.y - height / 2;
        settle(
          DOUBLE_TAP_SCALE,
          fx - fx * DOUBLE_TAP_SCALE,
          fy - fy * DOUBLE_TAP_SCALE,
        );
      }
    });

  // Vertical drag while unzoomed; horizontal movement fails it so the list
  // can still page between images.
  const dismiss = Gesture.Pan()
    .enabled(!zoomed)
    .activeOffsetY(20)
    .failOffsetX([-15, 15])
    .onUpdate(event => {
      dismissY.value = Math.max(0, event.translationY);
    })
    .onEnd(event => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > 1000) {
        scheduleOnRN(onClose);
      } else {
        dismissY.value = withTiming(0);
      }
    });

  const gesture = Gesture.Race(
    doubleTap,
    Gesture.Simultaneous(pinch, pan, dismiss),
  );

  const pageStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(dismissY.value / (DISMISS_DISTANCE * 3), 0.5),
    transform: [{ translateY: dismissY.value }],
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, { height, width }, pageStyle]}>
        <Animated.View style={[styles.fill, animatedStyle]}>
          {failed ? (
            <View style={styles.fallbackWrap}>
              <Image
                resizeMode="contain"
                source={bim}
                style={styles.fallbackLogo}
              />
            </View>
          ) : (
            <FastImage
              onError={() => setFailed(true)}
              resizeMode={FastImage.resizeMode.contain}
              source={{ uri }}
              style={styles.fill}
            />
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

type Props = {
  images: string[];
  initialIndex: number;
  onClose: () => void;
  visible: boolean;
};

/**
 * Full-screen image gallery with pinch / double-tap zoom. Swiping between
 * images is paused while the current one is zoomed in.
 */
export default function ImageViewer({
  images,
  initialIndex,
  onClose,
  visible,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setZoomed(false);
    }
  }, [visible, initialIndex]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({ index: i, length: width, offset: width * i }),
    [width],
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <FlatList
          data={images}
          getItemLayout={getItemLayout}
          horizontal
          initialScrollIndex={Math.min(initialIndex, images.length - 1)}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          onMomentumScrollEnd={handleScroll}
          pagingEnabled
          renderItem={({ item: uri }) => (
            <ZoomableImage
              height={height}
              onClose={onClose}
              onZoomChange={setZoomed}
              uri={uri}
              width={width}
            />
          )}
          scrollEnabled={!zoomed && images.length > 1}
          showsHorizontalScrollIndicator={false}
        />

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          {images.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {index + 1}/{images.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            accessibilityLabel="Close image viewer"
            hitSlop={10}
            onPress={onClose}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons color="#ffffff" name="close" size={20} />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#000000',
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
  },
  fallbackWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  fallbackLogo: {
    height: '30%',
    width: '45%',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 16,
    position: 'absolute',
    right: 16,
  },
  counter: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    height: 38,
    paddingLeft: 10,
    paddingRight: 14,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
