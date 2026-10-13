import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import {
  BORDER,
  CARD,
  GREEN,
  GREEN_TINT,
  HAIRLINE,
  MUTED,
  NAVY,
  SURFACE,
  TEAL,
  TEXT,
  TEXT_VARIANT,
} from '../theme/colors';

export type LocationPermissionVariant = 'ask' | 'servicesOff' | 'blocked';

type Props = {
  visible: boolean;
  variant: LocationPermissionVariant;
  onPrimaryPress: () => void;
  onDismiss: () => void;
};

// Light neutral tint for the "blocked" icon badge — the app's palette only
// defines tints for GREEN, so this one is derived from NAVY the same way.
const NAVY_TINT = '#E6E9EC';
const TEAL_TINT = '#DFF5F2';

function PinIcon({ color, slashed = false }: { color: string; slashed?: boolean }) {
  return (
    <Svg fill="none" height={30} viewBox="0 0 24 24" width={30}>
      <Path
        d="M12 21s7-7.58 7-12A7 7 0 0 0 5 9c0 4.42 7 12 7 12Z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <Circle cx={12} cy={9} r={2.5} stroke={color} strokeWidth={1.8} />
      {slashed ? (
        <Line
          stroke={color}
          strokeLinecap="round"
          strokeWidth={1.8}
          x1={4.5}
          x2={19.5}
          y1={19.5}
          y2={4.5}
        />
      ) : null}
    </Svg>
  );
}

function TargetIcon({ color }: { color: string }) {
  return (
    <Svg fill="none" height={30} viewBox="0 0 24 24" width={30}>
      <Circle cx={12} cy={12} r={7} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} fill={color} r={1.6} />
      <Line stroke={color} strokeLinecap="round" strokeWidth={1.8} x1={12} x2={12} y1={1.5} y2={4.5} />
      <Line stroke={color} strokeLinecap="round" strokeWidth={1.8} x1={12} x2={12} y1={19.5} y2={22.5} />
      <Line stroke={color} strokeLinecap="round" strokeWidth={1.8} x1={1.5} x2={4.5} y1={12} y2={12} />
      <Line stroke={color} strokeLinecap="round" strokeWidth={1.8} x1={19.5} x2={22.5} y1={12} y2={12} />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg fill="none" height={14} viewBox="0 0 24 24" width={14}>
      <Path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.4}
      />
    </Svg>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <Svg fill="none" height={18} viewBox="0 0 24 24" width={18}>
      <Path d="M12 8v4.5l3 2" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function BenefitRow({ label }: { label: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitBadge}>
        <CheckIcon color={GREEN} />
      </View>
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

function StepRow({ n, children }: { n: number; children: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNumber}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  );
}

/**
 * Branded bottom sheet used in place of a plain Alert for every location
 * prompt — asking permission the first time, GPS being off, and permission
 * being permanently blocked. Each variant matches the copy/flow decided for
 * that case (see HomeScreen's location effects).
 */
export default function LocationPermissionSheet({
  visible,
  variant,
  onPrimaryPress,
  onDismiss,
}: Props) {
  return (
    <Modal animationType="slide" onRequestClose={onDismiss} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={onDismiss} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {variant === 'ask' ? (
            <>
              <View style={[styles.iconBadge, { backgroundColor: GREEN_TINT }]}>
                <PinIcon color={GREEN} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.title}>Find your exact delivery spot</Text>
                <Text style={styles.body}>
                  We use your location to show nearby stores and get every order to the right building, every time.
                </Text>
              </View>
              <View style={styles.infoBox}>
                <BenefitRow label="Accurate delivery to your exact building" />
                <BenefitRow label="See stores and products actually near you" />
              </View>
              <TouchableOpacity activeOpacity={0.9} onPress={onPrimaryPress} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Allow Location Access</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={onDismiss} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Not now</Text>
              </TouchableOpacity>
              <Text style={styles.footnote}>You can change this anytime in Settings.</Text>
            </>
          ) : null}

          {variant === 'servicesOff' ? (
            <>
              <View style={[styles.iconBadge, { backgroundColor: TEAL_TINT }]}>
                <TargetIcon color={TEAL} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.title}>Turn on device location</Text>
                <Text style={styles.body}>
                  Location services are off. Turn them on so we can find stores and get accurate delivery near you.
                </Text>
              </View>
              <View style={styles.hintRow}>
                <ClockIcon color={TEAL} />
                <Text style={styles.hintText}>
                  Required to show accurate delivery options near you.
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.9} onPress={onPrimaryPress} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Turn On Location</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={onDismiss} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Not now</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {variant === 'blocked' ? (
            <>
              <View style={[styles.iconBadge, { backgroundColor: NAVY_TINT }]}>
                <PinIcon color={NAVY} slashed />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.title}>Location access is off</Text>
                <Text style={styles.body}>
                  You've turned off location permission for BIM. Turn it back on in Settings to see accurate delivery options near you.
                </Text>
              </View>
              <View style={styles.infoBox}>
                <StepRow n={1}>Tap Open Settings below</StepRow>
                <StepRow n={2}>Tap Permissions → Location</StepRow>
                <StepRow n={3}>Select Allow</StepRow>
              </View>
              <TouchableOpacity activeOpacity={0.9} onPress={onPrimaryPress} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Open Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={onDismiss} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Not now</Text>
              </TouchableOpacity>
              <Text style={styles.footnote}>We'll pick up right where you left off.</Text>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(8, 24, 40, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 16,
    gap: 18,
    paddingBottom: 34,
    paddingHorizontal: 24,
    paddingTop: 14,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: HAIRLINE,
    borderRadius: 2,
    height: 4,
    width: 40,
  },
  iconBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  textBlock: {
    gap: 6,
  },
  title: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: TEXT_VARIANT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    gap: 12,
    padding: 14,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  benefitBadge: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  benefitText: {
    color: TEXT,
    flexShrink: 1,
    fontSize: 13.5,
  },
  stepRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: BORDER,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginTop: 1,
    width: 20,
  },
  stepNumber: {
    color: NAVY,
    fontSize: 11,
    fontWeight: '700',
  },
  stepText: {
    color: TEXT_VARIANT,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  hintRow: {
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    padding: 12,
  },
  hintText: {
    color: TEXT_VARIANT,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: CARD,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  secondaryButtonText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '600',
  },
  footnote: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
  },
});
