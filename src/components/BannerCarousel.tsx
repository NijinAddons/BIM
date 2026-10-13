import React, {ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {banner1, banner2, banner3} from '../assets/images';

// Covers both bundled (`require`d, i.e. a number) and remote ({uri}) banner
// art — narrower than ImageSourcePropType so it's directly assignable to
// FastImage's source prop.
type BannerSource = number | {uri: string};

// Static, bundled banner art used when no remote banners are supplied.
const STATIC_BANNERS: BannerSource[] = [banner3, banner2, banner1];

const H_PADDING = 16;
const AUTOPLAY_MS = 3500;
// Pause autoplay briefly after the user touches the carousel.
const RESUME_DELAY_MS = 4000;
const DEFAULT_RATIO = 16 / 9;

/** A slide drawn in code (e.g. a feature promo) that opens a screen on tap. */
export type CustomBannerSlide = {
  id: string;
  content: ReactNode;
  onPress: () => void;
};

type Slide =
  | {id: string; source: BannerSource}
  | {id: string; custom: CustomBannerSlide};

type Props = {
  // Remote banner image URLs. When empty/omitted, the bundled art is shown.
  images?: string[];
  // Shown before the image banners.
  leadingSlides?: CustomBannerSlide[];
  style?: StyleProp<ViewStyle>;
};

const keyExtractor = (slide: Slide) => slide.id;

export default function BannerCarousel({images, leadingSlides, style}: Props) {
  const {width} = useWindowDimensions();
  const slideWidth = width || Dimensions.get('window').width;
  const insets = useSafeAreaInsets();

  const [viewerSource, setViewerSource] = useState<BannerSource | null>(null);

  const imageSlides = useMemo<Slide[]>(() => {
    if (images && images.length > 0) {
      return images.map((uri, i) => ({id: `${i}-${uri}`, source: {uri}}));
    }
    return STATIC_BANNERS.map((source, i) => ({id: `static-${i}`, source}));
  }, [images]);

  const slides = useMemo<Slide[]>(
    () => [
      ...(leadingSlides ?? []).map(custom => ({id: `custom-${custom.id}`, custom})),
      ...imageSlides,
    ],
    [imageSlides, leadingSlides],
  );

  // Derive the carousel height from the first banner's real aspect ratio so
  // images are shown whole instead of being cropped to a fixed ratio.
  const [ratio, setRatio] = useState(DEFAULT_RATIO);

  useEffect(() => {
    const first = imageSlides[0];
    const source = first && 'source' in first ? first.source : undefined;
    if (!source) {
      return;
    }

    let active = true;
    const apply = (w: number, h: number) => {
      if (active && w > 0 && h > 0) {
        setRatio(w / h);
      }
    };

    const uri =
      typeof source === 'object' && !Array.isArray(source)
        ? (source as {uri?: string}).uri
        : undefined;

    if (uri) {
      Image.getSize(uri, apply, () => undefined);
    } else {
      const resolved = Image.resolveAssetSource(source);
      if (resolved) {
        apply(resolved.width, resolved.height);
      }
    }

    return () => {
      active = false;
    };
  }, [imageSlides]);

  const imageHeight = Math.round((slideWidth - H_PADDING * 2) / ratio);

  const listRef = useRef<FlatList<Slide>>(null);
  const indexRef = useRef(0);
  const resumeAtRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    if (slides.length < 2) {
      return;
    }

    const timer = setInterval(() => {
      if (Date.now() < resumeAtRef.current) {
        return;
      }
      const next = (indexRef.current + 1) % slides.length;
      indexRef.current = next;
      listRef.current?.scrollToOffset({offset: next * slideWidth, animated: true});
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [slides.length, slideWidth]);

  const pauseAutoplay = useCallback(() => {
    resumeAtRef.current = Date.now() + RESUME_DELAY_MS;
  }, []);

  const syncIndex = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      indexRef.current = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    },
    [slideWidth],
  );

  const openViewer = useCallback(
    (source: BannerSource) => {
      pauseAutoplay();
      setViewerSource(source);
    },
    [pauseAutoplay],
  );

  const renderSlide = useCallback(
    ({item}: ListRenderItemInfo<Slide>) => (
      <View style={[styles.slide, {width: slideWidth}]}>
        {'custom' in item ? (
          <Pressable
            onPress={() => {
              pauseAutoplay();
              item.custom.onPress();
            }}
            style={[styles.card, {height: imageHeight}]}>
            {item.custom.content}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => openViewer(item.source)}
            style={[styles.card, {height: imageHeight}]}>
            <FastImage
              resizeMode={FastImage.resizeMode.contain}
              source={item.source}
              style={styles.image}
            />
          </Pressable>
        )}
      </View>
    ),
    [slideWidth, imageHeight, openViewer, pauseAutoplay],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Slide> | null | undefined, index: number) => ({
      length: slideWidth,
      offset: slideWidth * index,
      index,
    }),
    [slideWidth],
  );

  if (slides.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <FlatList
        data={slides}
        getItemLayout={getItemLayout}
        horizontal
        keyExtractor={keyExtractor}
        onMomentumScrollEnd={syncIndex}
        onScrollBeginDrag={pauseAutoplay}
        onScrollEndDrag={event => {
          pauseAutoplay();
          syncIndex(event);
        }}
        pagingEnabled
        ref={listRef}
        renderItem={renderSlide}
        showsHorizontalScrollIndicator={false}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setViewerSource(null)}
        statusBarTranslucent
        transparent
        visible={viewerSource !== null}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerSource(null)}>
          <StatusBar backgroundColor="rgba(0,0,0,0.92)" barStyle="light-content" />
          {viewerSource ? (
            <FastImage
              resizeMode={FastImage.resizeMode.contain}
              source={viewerSource}
              style={styles.viewerImage}
            />
          ) : null}
          <Pressable
            hitSlop={12}
            onPress={() => setViewerSource(null)}
            style={[styles.viewerClose, {top: insets.top + 12}]}>
            <MaterialCommunityIcons color="#ffffff" name="close" size={24} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  slide: {
    paddingHorizontal: H_PADDING,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E5EA',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  viewerBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.92)',
    flex: 1,
    justifyContent: 'center',
  },
  viewerImage: {
    height: '100%',
    width: '100%',
  },
  viewerClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 40,
  },
});
