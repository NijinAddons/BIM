import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type Details,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  addAddress,
  updateAddress,
  useAddresses,
  type SavedAddress,
} from '../hooks/useAddresses';
import { setManualLocation, useLocation } from '../hooks/useLocation';
import {
  geocodeText,
  getCurrentCoords,
  requestLocationPermission,
  reverseGeocode,
  searchPlaces,
  stripPlusCode,
  type AddressParts,
  type PlacePrediction,
} from '../services/location';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const BORDER = '#E1E5EA';
const ACCENT_TEAL_TINT = '#E3F8F5';
const SHADOW = '#0F1B26';
const ERROR_RED = '#D64545';
const PIN_HEAD = 44;
const PIN_STEM = 12;

// A quiet, desaturated Google Maps style: roads and buildings stay legible
// (buildings matter for picking the exact drop-off) while shop/transit
// clutter is removed so the pin and the address are the focus.
const PREMIUM_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F4F5F7' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7684' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F4F5F7' }] },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.fill',
    stylers: [{ color: '#DADFE6' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#B9C2CD' }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#DCEFE3' }, { visibility: 'on' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E2E6EA' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#E9EEF3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#D5DCE3' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9AA3AE' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#CFE6EE' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7FA3B3' }],
  },
];

// Android's Modal reports onShow as its slide-in starts rather than when it
// ends, so the map waits roughly the animation's length before mounting.
const MAP_MOUNT_DELAY_MS = Platform.OS === 'android' ? 300 : 0;

const LABEL_CHOICES = [
  { label: 'Home', icon: 'home-outline' },
  { label: 'Work', icon: 'briefcase-outline' },
  { label: 'Other', icon: 'map-marker-outline' },
] as const;
type LabelChoice = (typeof LABEL_CHOICES)[number]['label'];

type DetailsField = 'address' | 'phone' | 'emirate';

/** A UAE number: 9 digits from 5…, optionally led by 0, 971 or +971. */
const UAE_PHONE = /^(?:\+?971|0)?(?:5\d{8}|[2-9]\d{7})$/;

const EMIRATES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];

const normalizeEmirate = (text: string) =>
  text.toLowerCase().replace(/[-\s]+/g, ' ');

/**
 * The emirate named in Google's region or address text ("Emirate of
 * Dubai", "Ras al-Khaimah - United Arab Emirates"), or null.
 */
function matchEmirate(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const lower = normalizeEmirate(text);
  return EMIRATES.find(name => lower.includes(normalizeEmirate(name))) ?? null;
}

// Zoom used whenever the map centers on a real location. Google Maps only
// draws building footprints from about zoom 17 up; this is roughly zoom 18,
// so every individual building is drawn and can be picked.
const BUILDING_ZOOM_DELTA = 0.0015;

// Default map center: Dubai, UAE.
const DEFAULT_REGION: Region = {
  latitude: 25.2048,
  longitude: 55.2708,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type Props = {
  visible: boolean;
  onClose: () => void;
  // When set, the map opens on this address's location (re-geocoded, since
  // saved addresses don't store coordinates) and the detail fields are
  // pre-filled from it; saving patches it in place instead of adding a new
  // entry.
  editing?: SavedAddress | null;
};

export default function AddressMapPicker({
  visible,
  onClose,
  editing = null,
}: Props) {
  const insets = useSafeAreaInsets();
  // `coords` is only set when the active location came from a live GPS fix.
  // A manually picked (search result / saved) address has no coords, so
  // `activeAddress` is used to re-geocode a real starting point for it
  // instead of falling back to a hardcoded city center.
  const { coords, address: activeAddress, label: activeLabel } = useLocation();
  const saved = useAddresses();

  const initialRegion: Region = coords
    ? {
        ...coords,
        latitudeDelta: BUILDING_ZOOM_DELTA,
        longitudeDelta: BUILDING_ZOOM_DELTA,
      }
    : DEFAULT_REGION;

  const mapRef = useRef<MapView | null>(null);
  const centerRef = useRef({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the latest reverse-geocode may update the address: an earlier,
  // slower response (e.g. for the default city center before the map moved)
  // must not overwrite the one for where the pin actually is.
  const resolveIdRef = useRef(0);
  // True while the sheet shows an address we already know (the active
  // location, or the one being edited) and the user hasn't moved the map —
  // re-geocoding the pin then would just swap it for a nearby approximation.
  const presetRef = useRef(false);

  const [address, setAddress] = useState<string | null>(null);
  const [shortLabel, setShortLabel] = useState<string | null>(null);
  // Street / emirate / building Google gave for `address`, for the form.
  const [addressParts, setAddressParts] = useState<AddressParts | null>(null);
  // What the form was last pre-filled with: those fields follow a new map
  // pick, ones the user typed are left alone.
  const autoFilledRef = useRef<{ street: string; emirate: string; note: string }>(
    { street: '', emirate: '', note: '' },
  );
  const [resolving, setResolving] = useState(true);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [phase, setPhase] = useState<'map' | 'details'>('map');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [emirate, setEmirate] = useState('');
  const [emirateOpen, setEmirateOpen] = useState(false);
  const [labelChoice, setLabelChoice] = useState<LabelChoice | null>(null);
  // The map's address, editable on the details form.
  const [addressDraft, setAddressDraft] = useState('');
  // Fields left (or submitted) at least once: their errors show from then on.
  const [touched, setTouched] = useState<Partial<Record<DetailsField, true>>>(
    {},
  );
  const detailsScrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const streetRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);
  const [note, setNote] = useState('');
  const [room, setRoom] = useState('');
  const roomRef = useRef<TextInput>(null);
  const [landmark, setLandmark] = useState('');
  const landmarkRef = useRef<TextInput>(null);
  // The native map is expensive to create; building it while the modal is
  // sliding in drops frames, so it mounts once the modal is on screen.
  const [mapMounted, setMapMounted] = useState(false);
  const mapMountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapOpacity = useRef(new Animated.Value(0)).current;
  // 0 = pin resting on the map, 1 = lifted while the user drags the map.
  const pinLift = useRef(new Animated.Value(0)).current;
  const pinLiftedRef = useRef(false);
  // Drives the address skeleton's shimmer while an address resolves.
  const shimmer = useRef(new Animated.Value(0)).current;
  const [locating, setLocating] = useState(false);

  // On close, only drop pending work. The state itself is left as-is so the
  // content doesn't change while the modal slides out; it's reset on the
  // next open instead.
  useEffect(() => {
    if (visible) {
      return;
    }
    resolveIdRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (mapMountTimerRef.current) {
      clearTimeout(mapMountTimerRef.current);
    }
  }, [visible]);

  const onShow = useCallback(() => {
    mapMountTimerRef.current = setTimeout(() => {
      setMapMounted(true);
      Animated.timing(mapOpacity, {
        duration: 200,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }, MAP_MOUNT_DELAY_MS);
  }, [mapOpacity]);

  // Debounced Google Places Autocomplete on the search query.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(q, controller.signal)
        .then(setPredictions)
        .catch(() => setPredictions([]))
        .finally(() => setSearching(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, visible]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const resolveAt = useCallback((latitude: number, longitude: number) => {
    const requestId = ++resolveIdRef.current;
    presetRef.current = false;
    setResolving(true);
    reverseGeocode({ latitude, longitude })
      .then(result => {
        if (requestId !== resolveIdRef.current) {
          return;
        }
        setAddress(result.address);
        setShortLabel(result.label);
        setAddressParts(result.parts ?? null);
      })
      .catch(() => {
        if (requestId !== resolveIdRef.current) {
          return;
        }
        setAddress(null);
        setShortLabel(null);
        setAddressParts(null);
      })
      .finally(() => {
        if (requestId === resolveIdRef.current) {
          setResolving(false);
        }
      });
  }, []);

  // On open, show the address the user already has — the one being edited,
  // or the active delivery location from the header — exactly as-is, rather
  // than reverse-geocoding the pin, which returns a nearby approximation
  // (a different building or street) instead of the same text. Only a map
  // move by the user re-resolves it.
  //
  // Saved addresses (and a manually-picked active location) have no stored
  // coordinates, so the text is geocoded just to center the map on it.
  //
  // Runs once per open: a location refresh landing while the picker is up
  // must not overwrite what the user is doing on the map.
  //
  // A layout effect, so the previous session's state is replaced before the
  // modal's first frame is painted.
  useLayoutEffect(() => {
    if (!visible) {
      return;
    }

    presetRef.current = false;
    setAddress(null);
    setShortLabel(null);
    setAddressParts(null);
    autoFilledRef.current = { street: '', emirate: '', note: '' };
    setResolving(true);
    setQuery('');
    setPredictions([]);
    setSearching(false);
    setPhase('map');
    setLabel('');
    setPhone('');
    setStreet('');
    setEmirate('');
    setEmirateOpen(false);
    setLabelChoice(null);
    setTouched({});
    setNote('');
    setRoom('');
    setLandmark('');
    setMapMounted(false);
    mapOpacity.setValue(0);
    centerRef.current = {
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
    };

    if (editing) {
      const preset = LABEL_CHOICES.find(
        choice =>
          choice.label !== 'Other' &&
          choice.label.toLowerCase() === editing.label.trim().toLowerCase(),
      );
      setLabelChoice(preset ? preset.label : editing.label ? 'Other' : null);
      setLabel(preset ? '' : editing.label);
      setPhone(editing.phone);
      setStreet(editing.street);
      setEmirate(editing.emirate);
      setNote(editing.note);
      setRoom(editing.room ?? '');
      setLandmark(editing.landmark ?? '');
    }

    const knownAddress = editing ? editing.address : activeAddress;
    if (knownAddress) {
      presetRef.current = true;
      // Older entries may still carry a Plus Code from before it was
      // stripped at geocoding time.
      setAddress(stripPlusCode(knownAddress) || knownAddress);
      setShortLabel(editing ? editing.label : activeLabel);
      setResolving(false);
    }

    const needsGeocode = editing ? true : !coords && !!activeAddress;
    if (!knownAddress) {
      return;
    }
    let cancelled = false;
    // Form pieces for the preset address; dropped if the user has moved the
    // pin since (that resolves its own).
    const presetParts = (parts: AddressParts | undefined) => {
      if (!cancelled && presetRef.current && parts) {
        setAddressParts(parts);
      }
    };
    if (!needsGeocode) {
      if (coords) {
        reverseGeocode(coords)
          .then(result => presetParts(result.parts))
          .catch(() => {});
      }
      return () => {
        cancelled = true;
      };
    }
    geocodeText(knownAddress).then(result => {
      if (cancelled || !result) {
        return;
      }
      presetParts(result.parts);
      centerRef.current = result.coords;
      mapRef.current?.animateToRegion(
        {
          ...result.coords,
          latitudeDelta: BUILDING_ZOOM_DELTA,
          longitudeDelta: BUILDING_ZOOM_DELTA,
        },
        350,
      );
    });
    return () => {
      cancelled = true;
    };
    // Snapshot the location on open only (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing]);

  const onMapReady = useCallback(() => {
    // Nudge the camera so Google Maps fetches tiles for the real viewport.
    mapRef.current?.animateToRegion(
      {
        latitude: centerRef.current.latitude,
        longitude: centerRef.current.longitude,
        latitudeDelta: BUILDING_ZOOM_DELTA,
        longitudeDelta: BUILDING_ZOOM_DELTA,
      },
      1,
    );
    if (!presetRef.current) {
      resolveAt(centerRef.current.latitude, centerRef.current.longitude);
    }
  }, [resolveAt]);

  const setPinLifted = useCallback(
    (lifted: boolean) => {
      if (pinLiftedRef.current === lifted) {
        return;
      }
      pinLiftedRef.current = lifted;
      Animated.spring(pinLift, {
        friction: 7,
        tension: 120,
        toValue: lifted ? 1 : 0,
        useNativeDriver: true,
      }).start();
    },
    [pinLift],
  );

  const onRegionChange = useCallback(
    (_region: Region, details?: Details) => {
      if (details?.isGesture) {
        setPinLifted(true);
      }
    },
    [setPinLifted],
  );

  const onRegionChangeComplete = useCallback(
    (region: Region, details?: Details) => {
      setPinLifted(false);
      centerRef.current = {
        latitude: region.latitude,
        longitude: region.longitude,
      };
      // Our own camera moves (opening, centering on a searched place) must
      // not replace the address already shown — only a user drag should.
      if (details?.isGesture === false) {
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        resolveAt(region.latitude, region.longitude);
      }, 300);
    },
    [resolveAt, setPinLifted],
  );

  useEffect(() => {
    if (!resolving) {
      shimmer.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          duration: 700,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          duration: 700,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [resolving, shimmer]);

  // Recenters on a fresh GPS fix (asking for permission if needed) and
  // resolves the address there, same as if the user had dragged to it.
  const goToCurrentLocation = useCallback(async () => {
    if (locating) {
      return;
    }
    setLocating(true);
    try {
      let current;
      try {
        current = await getCurrentCoords();
      } catch {
        await requestLocationPermission();
        current = await getCurrentCoords();
      }
      centerRef.current = current;
      mapRef.current?.animateToRegion(
        {
          ...current,
          latitudeDelta: BUILDING_ZOOM_DELTA,
          longitudeDelta: BUILDING_ZOOM_DELTA,
        },
        450,
      );
      resolveAt(current.latitude, current.longitude);
    } catch {
      // Permission refused or location off — the map just stays where it is.
    } finally {
      setLocating(false);
    }
  }, [locating, resolveAt]);

  const pickPrediction = useCallback((prediction: PlacePrediction) => {
    // Supersede any reverse-geocode still in flight for the old pin spot.
    resolveIdRef.current += 1;
    setQuery('');
    setPredictions([]);
    setResolving(true);
    geocodeText(prediction.description, prediction.primary)
      .then(result => {
        if (!result) {
          setResolving(false);
          return;
        }
        centerRef.current = result.coords;
        mapRef.current?.animateToRegion(
          {
            ...result.coords,
            latitudeDelta: BUILDING_ZOOM_DELTA,
            longitudeDelta: BUILDING_ZOOM_DELTA,
          },
          350,
        );
        setAddress(result.address);
        setShortLabel(prediction.primary);
        setAddressParts(result.parts);
        setResolving(false);
      })
      .catch(() => setResolving(false));
  }, []);

  // A saved address is already complete — set it as the active delivery
  // location and close, same as picking one from the old address list did.
  const chooseSaved = useCallback(
    (entry: SavedAddress) => {
      setManualLocation({ label: entry.label, address: entry.address });
      onClose();
    },
    [onClose],
  );

  const hasQuery = query.trim().length >= 2;
  const locationReady = !!address && !resolving;

  const phoneDigits = phone.replace(/[\s-]/g, '');
  const errors: Partial<Record<DetailsField, string>> = {};
  if (!addressDraft.trim()) {
    errors.address = 'Enter the delivery address.';
  }
  if (!phoneDigits) {
    errors.phone = 'Enter a contact number.';
  } else if (!UAE_PHONE.test(phoneDigits)) {
    errors.phone = 'Enter a valid UAE number, e.g. 50 123 4567.';
  }
  if (!emirate) {
    errors.emirate = 'Select an emirate.';
  }
  const formValid = Object.keys(errors).length === 0;
  const showError = (field: DetailsField) => !!touched[field] && !!errors[field];
  const touch = (field: DetailsField) =>
    setTouched(current => ({ ...current, [field]: true }));

  const openDetails = () => {
    setAddressDraft(address ?? '');
    // Pre-fill from the picked address, keeping anything the user typed.
    const filled = autoFilledRef.current;
    const next = {
      street: addressParts?.street ?? '',
      emirate:
        matchEmirate(addressParts?.emirate) ?? matchEmirate(address) ?? '',
      note: addressParts?.building ?? '',
    };
    if (!street.trim() || street === filled.street) {
      setStreet(next.street);
    } else {
      next.street = filled.street;
    }
    if (!emirate || emirate === filled.emirate) {
      setEmirate(next.emirate);
    } else {
      next.emirate = filled.emirate;
    }
    if (!note.trim() || note === filled.note) {
      setNote(next.note);
    } else {
      next.note = filled.note;
    }
    autoFilledRef.current = next;
    setEmirateOpen(false);
    setTouched({});
    setPhase('details');
  };

  const saveDetails = () => {
    if (!formValid) {
      Keyboard.dismiss();
      setTouched({ address: true, phone: true, emirate: true });
      detailsScrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const addressText = addressDraft.trim();
    const typedLabel = labelChoice === 'Other' ? label.trim() : labelChoice;
    const labelText =
      typedLabel ||
      (shortLabel ?? addressText.split(',')[0]).trim() ||
      addressText;
    const payload = {
      label: labelText,
      address: addressText,
      phone: phoneDigits,
      street: street.trim(),
      emirate,
      note: note.trim(),
      room: room.trim(),
      landmark: landmark.trim(),
    };

    if (editing) {
      updateAddress(editing.id, payload);
    } else {
      addAddress(payload);
    }
    onClose();
  };

  // Android back (routed to the Modal) steps out of the details form first,
  // then closes the picker.
  const onRequestClose = () => {
    if (phase === 'details') {
      setPhase('map');
      return;
    }
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onRequestClose}
      onShow={onShow}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}
    >
      {phase === 'details' ? (
        <View style={styles.overlay}>
          {/* The modal's translucent status bar stops Android resizing the
              window for the keyboard, so this shrinks the form itself. */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.detailsScreen}
          >
            <View
              style={[styles.detailsHeader, { paddingTop: insets.top + 8 }]}
            >
              <Pressable
                hitSlop={8}
                onPress={() => setPhase('map')}
                style={styles.detailsBack}
              >
                <MaterialCommunityIcons
                  color={BRAND_NAVY}
                  name="arrow-left"
                  size={22}
                />
              </Pressable>
              <Text style={styles.detailsTitle}>
                {editing ? 'Edit address' : 'Address details'}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.detailsBody}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              ref={detailsScrollRef}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, styles.fieldLabelInline]}>
                  Address
                </Text>
                <Pressable hitSlop={8} onPress={() => setPhase('map')}>
                  <Text style={styles.fieldLink}>Change on map</Text>
                </Pressable>
              </View>
              <View
                style={[
                  styles.addressRow,
                  styles.addressInputRow,
                  showError('address') && styles.inputError,
                ]}
              >
                <MaterialCommunityIcons
                  color={ACCENT_TEAL}
                  name="map-marker"
                  size={18}
                  style={styles.addressInputIcon}
                />
                <TextInput
                  multiline
                  onBlur={() => touch('address')}
                  onChangeText={setAddressDraft}
                  onFocus={() => setEmirateOpen(false)}
                  placeholder="Full address"
                  placeholderTextColor={MUTED}
                  style={styles.addressInput}
                  value={addressDraft}
                />
              </View>
              {showError('address') ? (
                <Text style={styles.errorText}>{errors.address}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Save as</Text>
              <View style={styles.chipRow}>
                {LABEL_CHOICES.map(choice => {
                  const selected = choice.label === labelChoice;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={choice.label}
                      onPress={() => {
                        setLabelChoice(choice.label);
                        setEmirateOpen(false);
                      }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <MaterialCommunityIcons
                        color={selected ? BRAND_NAVY : MUTED}
                        name={choice.icon}
                        size={16}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {choice.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {labelChoice === 'Other' ? (
                <TextInput
                  autoFocus={!label}
                  onChangeText={setLabel}
                  onFocus={() => setEmirateOpen(false)}
                  placeholder="e.g. Mom's place, Gym"
                  placeholderTextColor={MUTED}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  style={[styles.input, styles.otherLabelInput]}
                  value={label}
                />
              ) : null}

              <Text style={styles.fieldLabel}>Contact number *</Text>
              <TextInput
                autoComplete="tel"
                keyboardType="phone-pad"
                onBlur={() => touch('phone')}
                onChangeText={setPhone}
                onFocus={() => setEmirateOpen(false)}
                placeholder="e.g. 50 123 4567"
                placeholderTextColor={MUTED}
                ref={phoneRef}
                returnKeyType="next"
                onSubmitEditing={() => streetRef.current?.focus()}
                style={[styles.input, showError('phone') && styles.inputError]}
                textContentType="telephoneNumber"
                value={phone}
              />
              {showError('phone') ? (
                <Text style={styles.errorText}>{errors.phone}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Street / Road</Text>
              <TextInput
                onChangeText={setStreet}
                onFocus={() => setEmirateOpen(false)}
                placeholder="e.g. Al Wasl Road, 2B Street"
                placeholderTextColor={MUTED}
                ref={streetRef}
                returnKeyType="next"
                onSubmitEditing={() => {
                  if (!emirate) {
                    setEmirateOpen(true);
                  } else {
                    noteRef.current?.focus();
                  }
                }}
                style={styles.input}
                value={street}
              />

              <Text style={styles.fieldLabel}>Emirate *</Text>
              <Pressable
                accessibilityRole="combobox"
                accessibilityState={{ expanded: emirateOpen }}
                onPress={() => {
                  Keyboard.dismiss();
                  setEmirateOpen(open => !open);
                }}
                style={[
                  styles.input,
                  styles.emirateField,
                  emirateOpen && styles.emirateFieldOpen,
                  showError('emirate') && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.emirateFieldText,
                    !emirate && styles.emiratePlaceholder,
                  ]}
                >
                  {emirate || 'Select emirate'}
                </Text>
                <MaterialCommunityIcons
                  color={MUTED}
                  name={emirateOpen ? 'chevron-up' : 'chevron-down'}
                  size={22}
                />
              </Pressable>
              {emirateOpen ? (
                <View style={styles.emirateList}>
                  {EMIRATES.map((name, index) => {
                    const selected = name === emirate;
                    return (
                      <Pressable
                        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                        key={name}
                        onPress={() => {
                          setEmirate(name);
                          setEmirateOpen(false);
                          touch('emirate');
                        }}
                        style={[
                          styles.emirateRow,
                          index === EMIRATES.length - 1 &&
                            styles.emirateRowLast,
                        ]}
                      >
                        <Text
                          style={[
                            styles.emirateText,
                            selected && styles.emirateTextSelected,
                          ]}
                        >
                          {name}
                        </Text>
                        {selected ? (
                          <MaterialCommunityIcons
                            color={ACCENT_TEAL}
                            name="check"
                            size={20}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {showError('emirate') && !emirateOpen ? (
                <Text style={styles.errorText}>{errors.emirate}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>
                Apartment / Building / Villa details
              </Text>
              <TextInput
                onChangeText={setNote}
                onFocus={() => setEmirateOpen(false)}
                placeholder="e.g. Marina Heights, Villa 12"
                placeholderTextColor={MUTED}
                ref={noteRef}
                returnKeyType="next"
                onSubmitEditing={() => roomRef.current?.focus()}
                style={styles.input}
                value={note}
              />

              <Text style={styles.fieldLabel}>Room / Flat no.</Text>
              <TextInput
                autoCapitalize="characters"
                onChangeText={setRoom}
                onFocus={() => setEmirateOpen(false)}
                placeholder="e.g. 302, 14B"
                placeholderTextColor={MUTED}
                ref={roomRef}
                returnKeyType="next"
                onSubmitEditing={() => landmarkRef.current?.focus()}
                style={styles.input}
                value={room}
              />

              <Text style={styles.fieldLabel}>Landmark</Text>
              <TextInput
                onChangeText={setLandmark}
                onFocus={() => {
                  setEmirateOpen(false);
                  // Last field: keep it clear of the keyboard.
                  setTimeout(
                    () => detailsScrollRef.current?.scrollToEnd({ animated: true }),
                    250,
                  );
                }}
                placeholder="e.g. Near Lulu Hypermarket, opposite the mosque"
                placeholderTextColor={MUTED}
                ref={landmarkRef}
                returnKeyType="done"
                onSubmitEditing={saveDetails}
                style={styles.input}
                value={landmark}
              />
            </ScrollView>
          </KeyboardAvoidingView>
          {/* Pinned to the bottom: hidden while the keyboard is up instead
              of riding on top of it (the last field's Done key saves). */}
          {keyboardVisible ? null : (
            <View
              style={[
                styles.detailsFooter,
                { paddingBottom: insets.bottom + 16 },
              ]}
            >
              <Pressable
                onPress={saveDetails}
                style={({ pressed }) => [
                  styles.saveButton,
                  !formValid && styles.saveButtonDisabled,
                  pressed && styles.saveButtonPressed,
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {editing ? 'Save changes' : 'Save'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.overlay}>
          <View style={styles.container}>
            {mapMounted ? (
              <Animated.View style={[styles.map, { opacity: mapOpacity }]}>
                <MapView
                  ref={mapRef}
                  customMapStyle={PREMIUM_MAP_STYLE}
                  initialRegion={initialRegion}
                  loadingBackgroundColor="#F4F5F7"
                  loadingEnabled
                  onMapReady={onMapReady}
                  onRegionChange={onRegionChange}
                  onRegionChangeComplete={onRegionChangeComplete}
                  provider={PROVIDER_GOOGLE}
                  showsBuildings
                  showsCompass={false}
                  showsMyLocationButton={false}
                  showsUserLocation={!!coords}
                  style={styles.map}
                  toolbarEnabled={false}
                />
              </Animated.View>
            ) : null}

            {/* Ground shadow sits exactly on the map centre; it shrinks
                and fades as the pin lifts off. */}
            <View pointerEvents="none" style={styles.centerPin}>
              <Animated.View
                style={[
                  styles.pinShadow,
                  {
                    opacity: pinLift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 0.18],
                    }),
                    transform: [
                      {
                        scale: pinLift.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.6],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>

            <View pointerEvents="none" style={styles.centerPin}>
              <Animated.View
                style={[
                  styles.pin,
                  {
                    transform: [
                      {
                        translateY: pinLift.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            -(PIN_HEAD + PIN_STEM) / 2,
                            -(PIN_HEAD + PIN_STEM) / 2 - 14,
                          ],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.tooltip,
                    {
                      opacity: pinLift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                    },
                  ]}
                >
                  <Text style={styles.tooltipTitle}>
                    Your order will be delivered here
                  </Text>
                  <Text style={styles.tooltipSubtitle}>
                    Move the map to set the exact spot
                  </Text>
                  <View style={styles.tooltipCaret} />
                </Animated.View>
                <View style={styles.pinHead}>
                  <View style={styles.pinDot} />
                </View>
                <View style={styles.pinStem} />
              </Animated.View>
            </View>

            <View style={[styles.topBar, { top: insets.top + 10 }]}>
              <View style={styles.searchCard}>
                <Pressable
                  hitSlop={6}
                  onPress={onClose}
                  style={styles.backButton}
                >
                  <MaterialCommunityIcons
                    color={BRAND_NAVY}
                    name="arrow-left"
                    size={22}
                  />
                </Pressable>
                <View style={styles.searchDivider} />
                <MaterialCommunityIcons
                  color={MUTED}
                  name="magnify"
                  size={20}
                />
                <TextInput
                  autoCorrect={false}
                  onChangeText={setQuery}
                  placeholder="Search area, building, street"
                  placeholderTextColor={MUTED}
                  style={styles.searchInput}
                  value={query}
                />
                {query.length > 0 ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      setQuery('');
                      setPredictions([]);
                    }}
                    style={styles.clearButton}
                  >
                    <MaterialCommunityIcons
                      color={MUTED}
                      name="close-circle"
                      size={18}
                    />
                  </Pressable>
                ) : null}
              </View>

              {hasQuery ? (
                <View style={styles.dropdown}>
                  {searching ? (
                    <View style={styles.dropdownStatus}>
                      <ActivityIndicator color={ACCENT_TEAL} size="small" />
                      <Text style={styles.dropdownStatusText}>Searching…</Text>
                    </View>
                  ) : predictions.length === 0 ? (
                    <Text
                      style={[styles.dropdownStatusText, styles.dropdownEmpty]}
                    >
                      No matching places.
                    </Text>
                  ) : (
                    predictions.map((prediction, index) => (
                      <Pressable
                        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                        key={prediction.id}
                        onPress={() => pickPrediction(prediction)}
                        style={[
                          styles.dropdownRow,
                          index > 0 && styles.dropdownRowDivided,
                        ]}
                      >
                        <View style={styles.dropdownIcon}>
                          <MaterialCommunityIcons
                            color={BRAND_NAVY}
                            name="map-marker-outline"
                            size={18}
                          />
                        </View>
                        <View style={styles.dropdownRowText}>
                          <Text
                            numberOfLines={1}
                            style={styles.dropdownPrimary}
                          >
                            {prediction.primary}
                          </Text>
                          {prediction.secondary ? (
                            <Text
                              numberOfLines={1}
                              style={styles.dropdownSecondary}
                            >
                              {prediction.secondary}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              ) : !editing && saved.length > 0 ? (
                <View style={styles.dropdown}>
                  <Text style={styles.dropdownHeading}>Saved addresses</Text>
                  {saved.map((entry, index) => (
                    <Pressable
                      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                      key={entry.id}
                      onPress={() => chooseSaved(entry)}
                      style={[
                        styles.dropdownRow,
                        index > 0 && styles.dropdownRowDivided,
                      ]}
                    >
                      <View style={styles.dropdownIcon}>
                        <MaterialCommunityIcons
                          color={BRAND_NAVY}
                          name="bookmark-outline"
                          size={18}
                        />
                      </View>
                      <View style={styles.dropdownRowText}>
                        <Text numberOfLines={1} style={styles.dropdownPrimary}>
                          {entry.label}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={styles.dropdownSecondary}
                        >
                          {entry.address}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              pointerEvents="box-none"
              style={styles.sheetWrap}
            >
              <Pressable
                disabled={locating}
                onPress={goToCurrentLocation}
                style={styles.locateButton}
              >
                {locating ? (
                  <ActivityIndicator color={BRAND_NAVY} size="small" />
                ) : (
                  <MaterialCommunityIcons
                    color={BRAND_NAVY}
                    name="crosshairs-gps"
                    size={22}
                  />
                )}
              </Pressable>

              <View
                style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}
              >
                <Text style={styles.overline}>Delivery location</Text>

                <View style={styles.addressCard}>
                  <View style={styles.addressIcon}>
                    <MaterialCommunityIcons
                      color={ACCENT_TEAL}
                      name="map-marker"
                      size={22}
                    />
                  </View>
                  {resolving ? (
                    <Animated.View
                      style={[
                        styles.addressBody,
                        {
                          opacity: shimmer.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.45, 1],
                          }),
                        },
                      ]}
                    >
                      <View
                        style={[styles.skeletonBar, styles.skeletonTitle]}
                      />
                      <View style={styles.skeletonBar} />
                    </Animated.View>
                  ) : (
                    <View style={styles.addressBody}>
                      <Text numberOfLines={1} style={styles.addressTitle}>
                        {address
                          ? (shortLabel ?? address.split(',')[0]).trim()
                          : 'Address unavailable'}
                      </Text>
                      {address ? (
                        <Text numberOfLines={2} style={styles.addressSubtitle}>
                          {address}
                        </Text>
                      ) : (
                        <Text style={styles.addressSubtitle}>
                          Move the map or search for your area
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                <Pressable
                  disabled={!locationReady}
                  onPress={openDetails}
                  style={({ pressed }) => [
                    styles.saveButton,
                    styles.confirmButton,
                    !locationReady && styles.saveButtonDisabled,
                    pressed && styles.saveButtonPressed,
                  ]}
                >
                  <Text style={styles.saveButtonText}>
                    {editing ? 'Confirm & edit details' : 'Confirm location'}
                  </Text>
                  <MaterialCommunityIcons
                    color="#ffffff"
                    name="arrow-right"
                    size={18}
                  />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#E8ECEF',
    flex: 1,
  },
  container: {
    backgroundColor: '#E8ECEF',
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centerPin: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pinShadow: {
    backgroundColor: SHADOW,
    borderRadius: 999,
    height: 6,
    width: 18,
  },
  // Head + stem; translated up by half its height so the stem's tip lands
  // on the exact map centre.
  pin: {
    alignItems: 'center',
    height: PIN_HEAD + PIN_STEM,
  },
  pinHead: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderColor: '#ffffff',
    borderRadius: PIN_HEAD / 2,
    borderWidth: 3,
    elevation: 8,
    height: PIN_HEAD,
    justifyContent: 'center',
    shadowColor: SHADOW,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    width: PIN_HEAD,
  },
  pinDot: {
    backgroundColor: ACCENT_TEAL,
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  pinStem: {
    backgroundColor: BRAND_NAVY,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    height: PIN_STEM,
    width: 3,
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 12,
    bottom: PIN_HEAD + PIN_STEM + 12,
    elevation: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    position: 'absolute',
    shadowColor: SHADOW,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    width: 240,
  },
  tooltipTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tooltipSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  tooltipCaret: {
    backgroundColor: BRAND_NAVY,
    bottom: -5,
    height: 12,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  topBar: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  searchCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 6,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    paddingLeft: 6,
    paddingRight: 12,
    shadowColor: SHADOW,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  searchDivider: {
    backgroundColor: BORDER,
    height: 24,
    marginRight: 4,
    width: 1,
  },
  searchInput: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 2,
  },
  dropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 6,
    marginTop: 10,
    overflow: 'hidden',
    paddingVertical: 6,
    shadowColor: SHADOW,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  dropdownStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownStatusText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownHeading: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 10,
    textTransform: 'uppercase',
  },
  dropdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  dropdownRowDivided: {
    borderTopColor: '#F0F2F4',
    borderTopWidth: 1,
  },
  dropdownIcon: {
    alignItems: 'center',
    backgroundColor: '#F2F4F6',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  dropdownRowText: {
    flex: 1,
  },
  dropdownPrimary: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownSecondary: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  sheetWrap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  locateButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    elevation: 6,
    height: 48,
    justifyContent: 'center',
    marginBottom: 14,
    marginRight: 16,
    shadowColor: SHADOW,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    width: 48,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    shadowColor: SHADOW,
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  overline: {
    color: ACCENT_TEAL,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  addressCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
    minHeight: 52,
  },
  addressIcon: {
    alignItems: 'center',
    backgroundColor: ACCENT_TEAL_TINT,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  addressBody: {
    flex: 1,
    gap: 4,
  },
  addressTitle: {
    color: BRAND_NAVY,
    fontSize: 17,
    fontWeight: '800',
  },
  addressSubtitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  skeletonBar: {
    backgroundColor: '#EBEEF1',
    borderRadius: 6,
    height: 12,
    width: '85%',
  },
  skeletonTitle: {
    height: 16,
    marginBottom: 4,
    width: '50%',
  },
  // Address row on the details form.
  addressRow: {
    alignItems: 'center',
    backgroundColor: '#F6F8F9',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmButton: {
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  detailsScreen: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  detailsHeader: {
    alignItems: 'center',
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  detailsBack: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  detailsTitle: {
    color: BRAND_NAVY,
    fontSize: 17,
    fontWeight: '800',
  },
  detailsBody: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  fieldLabel: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 18,
  },
  fieldLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 18,
  },
  fieldLabelInline: {
    marginBottom: 0,
    marginTop: 0,
  },
  fieldLink: {
    color: '#0F9C8F',
    fontSize: 13,
    fontWeight: '700',
  },
  addressInputRow: {
    alignItems: 'flex-start',
    borderColor: 'transparent',
    borderWidth: 1,
    marginTop: 0,
  },
  addressInputIcon: {
    marginTop: 2,
  },
  addressInput: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
    maxHeight: 96,
    padding: 0,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: ERROR_RED,
  },
  errorText: {
    color: ERROR_RED,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    borderColor: '#C7CED6',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: ACCENT_TEAL_TINT,
    borderColor: ACCENT_TEAL,
  },
  chipText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: BRAND_NAVY,
    fontWeight: '800',
  },
  otherLabelInput: {
    marginTop: 10,
  },
  emirateField: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emirateFieldOpen: {
    borderColor: ACCENT_TEAL,
  },
  emirateFieldText: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '500',
  },
  emiratePlaceholder: {
    color: MUTED,
  },
  emirateList: {
    borderColor: '#C7CED6',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  emirateRow: {
    alignItems: 'center',
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emirateRowLast: {
    borderBottomWidth: 0,
  },
  emirateText: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '600',
  },
  emirateTextSelected: {
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#C7CED6',
    borderRadius: 12,
    borderWidth: 1,
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  detailsFooter: {
    backgroundColor: '#ffffff',
    borderTopColor: BORDER,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
