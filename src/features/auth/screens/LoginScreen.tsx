import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CountryPicker, {
  Country,
  CountryCode,
  Flag,
} from 'react-native-country-picker-modal';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {appicon} from '../../../assets/images';
import {setUserProfile} from '../../profile/service';
import {otpService} from '../service';

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
  navigation: LoginNavProp;
};

const heroItems = [
  {label: 'Vegetables', color: '#e8fbef', accent: '#3ea857', detail: '#78cc7e', type: 'vegetables'},
  {label: 'Fruits', color: '#fff2d8', accent: '#ffbe2e', detail: '#ff7a45', type: 'fruits'},
  {label: 'Groceries', color: '#ecebff', accent: '#6b57d8', detail: '#31b58d', type: 'groceries'},
  {label: 'Vegetables', color: '#e9fbfb', accent: '#49a451', detail: '#7fd38a', type: 'vegetables'},
  {label: 'Fruits', color: '#fff1dc', accent: '#ffd247', detail: '#ff8d54', type: 'fruits'},
  {label: 'Groceries', color: '#eef5ff', accent: '#4c7bd9', detail: '#f4b63d', type: 'groceries'},
  {label: 'Vegetables', color: '#eefbea', accent: '#4cab4d', detail: '#92d86b', type: 'vegetables'},
  {label: 'Fruits', color: '#fff0d6', accent: '#ffc136', detail: '#ff7457', type: 'fruits'},
  {label: 'Groceries', color: '#ecf7ff', accent: '#4f8ee2', detail: '#ffcf4e', type: 'groceries'},
  {label: 'Vegetables', color: '#eafbf6', accent: '#32a56f', detail: '#66d39c', type: 'vegetables'},
  {label: 'Fruits', color: '#fff3de', accent: '#ffca4b', detail: '#ff7d4f', type: 'fruits'},
  {label: 'Groceries', color: '#f0ecff', accent: '#7860df', detail: '#36b897', type: 'groceries'},
];

const heroRows = [
  heroItems.slice(0, 4),
  heroItems.slice(4, 8),
  heroItems.slice(8, 12),
];

const HERO_CARD_WIDTH = 92;
const HERO_CARD_GAP = 12;
const HERO_LOOP_DISTANCE = (HERO_CARD_WIDTH + HERO_CARD_GAP) * 4;

export default function LoginScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const [countryCode, setCountryCode] = useState<CountryCode>('AE');
  const [callingCode, setCallingCode] = useState('971');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [mobile, setMobile] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const isValid = useMemo(() => mobile.length >= 6 && mobile.length <= 15, [mobile]);
  const rowAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(-HERO_LOOP_DISTANCE),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const loops = rowAnimations.map((animatedValue, index) => {
      const fromValue = index === 1 ? -HERO_LOOP_DISTANCE : 0;
      const toValue = index === 1 ? 0 : -HERO_LOOP_DISTANCE;

      animatedValue.setValue(fromValue);

      return Animated.loop(
        Animated.timing(animatedValue, {
          toValue,
          duration: 11000 + index * 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
    });

    loops.forEach(loop => loop.start());

    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [rowAnimations]);

  const onChangeMobile = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setMobile(digits.slice(0, 15));
  };

  const onSelectCountry = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0] ?? '');
    setCountryPickerVisible(false);
  };

  const onContinue = async () => {
    if (!isValid) {
      Alert.alert('Invalid Number', 'Please enter a valid mobile number.');
      return;
    }

    const phone = `+${callingCode}${mobile}`;

    try {
      setIsSendingOtp(true);
      await otpService.sendOtp(phone);
      navigation.navigate('Otp', {callingCode, mobile, phone});
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to send OTP. Please try again.';
      Alert.alert('OTP failed', errorMessage);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const skipLogin = async () => {
    await setUserProfile(
      {
        address: '',
        email: '',
        mobile: '',
        name: 'BIM User',
      },
      {profileCompleted: true},
    );
    navigation.replace('MainTabs');
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.container}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24},
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.heroSection}>
              <View style={styles.heroMarquee}>
                {heroRows.map((rowItems, rowIndex) => (
                  <View key={`hero-row-${rowIndex}`} style={styles.heroRowClip}>
                    <Animated.View
                      style={[
                        styles.heroRow,
                        {transform: [{translateX: rowAnimations[rowIndex]}]},
                      ]}>
                      {[...rowItems, ...rowItems].map((item, itemIndex) => (
                        <View
                          key={`${item.label}-${rowIndex}-${itemIndex}`}
                          style={[styles.heroTile, {backgroundColor: item.color}]}>
                          <View style={styles.productWrap}>
                            <View
                              style={[
                                styles.categoryArtwork,
                                item.type === 'vegetables' && styles.vegetablesArtwork,
                                item.type === 'fruits' && styles.fruitsArtwork,
                                item.type === 'groceries' && styles.groceriesArtwork,
                              ]}>
                              {item.type === 'vegetables' ? (
                                <>
                                  <View
                                    style={[
                                      styles.vegCircleLarge,
                                      {backgroundColor: item.accent},
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.vegCircleSmall,
                                      {backgroundColor: item.detail},
                                    ]}
                                  />
                                  <View style={styles.vegStem} />
                                </>
                              ) : null}

                              {item.type === 'fruits' ? (
                                <>
                                  <View
                                    style={[
                                      styles.fruitBanana,
                                      {backgroundColor: item.accent},
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.fruitOrange,
                                      {backgroundColor: item.detail},
                                    ]}
                                  />
                                  <View style={styles.fruitLeaf} />
                                </>
                              ) : null}

                              {item.type === 'groceries' ? (
                                <>
                                  <View
                                    style={[
                                      styles.groceryBag,
                                      {backgroundColor: item.accent},
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.groceryBottle,
                                      {backgroundColor: item.detail},
                                    ]}
                                  />
                                  <View style={styles.groceryHandle} />
                                </>
                              ) : null}
                            </View>
                            <Text style={styles.cardLabel}>{item.label}</Text>
                          </View>
                        </View>
                      ))}
                    </Animated.View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.brandSection}>
              <View style={styles.brandBadge}>
                <Image source={appicon} style={styles.brandBadgeIcon} />
              </View>
              <Text style={styles.title}>
                Your daily needs, delivered instantly.
              </Text>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setCountryPickerVisible(true)}
                  style={styles.countryPickerButton}>
                  <Flag
                    countryCode={countryCode}
                    flagSize={20}
                    withEmoji
                  />
                  <Text style={styles.countryCode}>+{callingCode}</Text>
                  <Text style={styles.countryPickerChevron}>▾</Text>
                </TouchableOpacity>
                <View style={styles.inputDivider} />
                <TextInput
                  keyboardType="number-pad"
                  maxLength={15}
                  onChangeText={onChangeMobile}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#8f8f8f"
                  style={styles.input}
                  value={mobile}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!isValid || isSendingOtp}
                onPress={onContinue}
                style={[
                  styles.continueButton,
                  isValid && !isSendingOtp && styles.continueButtonActive,
                ]}>
                <View style={styles.continueButtonContent}>
                  {isSendingOtp ? <ActivityIndicator color="#ffffff" size="small" /> : null}
                  <Text style={styles.continueText}>
                    {isSendingOtp ? 'Sending OTP...' : 'Continue'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                By continuing, you agree to our Terms of service &amp; Privacy policy
              </Text>
            </View>
          </View>
        </ScrollView>
          <TouchableOpacity
            onPress={skipLogin}
            style={[styles.skipButton, {top: insets.top + 16}]}>
            <Text style={styles.skipText}>Skip login</Text>
          </TouchableOpacity>
          <Modal
            animationType="slide"
            onRequestClose={() => setCountryPickerVisible(false)}
            transparent
            visible={countryPickerVisible}>
            <Pressable
              onPress={() => setCountryPickerVisible(false)}
              style={styles.countryModalOverlay}>
              <Pressable style={[styles.countryModalCard, {paddingBottom: insets.bottom}]}>
                <View style={styles.countryModalHandle} />
                <CountryPicker
                  countryCode={countryCode}
                  onSelect={onSelectCountry}
                  withCallingCode
                  withEmoji
                  withFilter
                  withFlag
                  withModal={false}
                />
              </Pressable>
            </Pressable>
          </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginHorizontal: -16,
  },
  heroMarquee: {
    gap: 12,
    width: '100%',
  },
  heroRowClip: {
    overflow: 'hidden',
    width: '100%',
  },
  heroRow: {
    flexDirection: 'row',
    width: HERO_LOOP_DISTANCE * 2,
  },
  heroTile: {
    alignItems: 'center',
    borderRadius: 24,
    height: 98,
    justifyContent: 'center',
    marginRight: HERO_CARD_GAP,
    overflow: 'hidden',
    width: HERO_CARD_WIDTH,
  },
  productWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryArtwork: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    position: 'relative',
  },
  vegetablesArtwork: {
    height: 34,
    width: 42,
  },
  fruitsArtwork: {
    height: 32,
    width: 44,
  },
  groceriesArtwork: {
    height: 36,
    width: 44,
  },
  vegCircleLarge: {
    borderRadius: 14,
    height: 22,
    left: 4,
    position: 'absolute',
    top: 8,
    width: 22,
  },
  vegCircleSmall: {
    borderRadius: 11,
    height: 18,
    position: 'absolute',
    right: 2,
    top: 12,
    width: 18,
  },
  vegStem: {
    backgroundColor: '#308944',
    borderRadius: 4,
    height: 8,
    position: 'absolute',
    top: 4,
    width: 10,
  },
  fruitBanana: {
    borderRadius: 16,
    height: 12,
    left: 4,
    position: 'absolute',
    top: 12,
    transform: [{rotate: '-25deg'}],
    width: 30,
  },
  fruitOrange: {
    borderRadius: 11,
    height: 22,
    position: 'absolute',
    right: 4,
    top: 10,
    width: 22,
  },
  fruitLeaf: {
    backgroundColor: '#48a751',
    borderRadius: 6,
    height: 6,
    position: 'absolute',
    right: 10,
    top: 4,
    transform: [{rotate: '-20deg'}],
    width: 10,
  },
  groceryBag: {
    borderRadius: 8,
    bottom: 2,
    height: 24,
    left: 5,
    position: 'absolute',
    width: 24,
  },
  groceryBottle: {
    borderRadius: 6,
    height: 20,
    position: 'absolute',
    right: 6,
    top: 10,
    width: 12,
  },
  groceryHandle: {
    borderColor: '#4c4c4c',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderTopWidth: 2,
    height: 8,
    left: 12,
    position: 'absolute',
    top: 4,
    width: 12,
  },
  cardLabel: {
    color: '#303030',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 10,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  brandBadge: {
    alignItems: 'center',
    borderRadius: 18,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  brandBadgeIcon: {
    borderRadius: 18,
    height: '100%',
    width: '100%',
  },
  title: {
    color: '#222222',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 18,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666666',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 6,
  },
  formSection: {
    marginTop: 20,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ededed',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  countryPickerButton: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  countryCode: {
    color: '#303030',
    fontSize: 15,
    fontWeight: '700',
  },
  countryPickerChevron: {
    color: '#606060',
    fontSize: 14,
    marginLeft: 6,
    marginTop: -2,
  },
  countryModalOverlay: {
    backgroundColor: 'rgba(17, 17, 17, 0.32)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  countryModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '50%',
    overflow: 'hidden',
    width: '100%',
  },
  countryModalHandle: {
    alignSelf: 'center',
    backgroundColor: '#d7d7d7',
    borderRadius: 999,
    height: 5,
    marginBottom: 8,
    marginTop: 10,
    width: 44,
  },
  inputDivider: {
    backgroundColor: '#e8e8e8',
    height: 22,
    marginHorizontal: 12,
    width: 1,
  },
  input: {
    color: '#202020',
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 14,
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: '#a2a8b9',
    borderRadius: 16,
    marginTop: 16,
    paddingVertical: 14,
  },
  continueButtonActive: {
    backgroundColor: '#171717',
  },
  continueButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  continueText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  termsText: {
    color: '#a6a6a6',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 28,
    textAlign: 'center',
  },
  skipButton: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
    right: 20,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  skipText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '500',
  },
});
