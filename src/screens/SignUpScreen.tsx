/**
 * SignUpScreen.tsx
 *
 * Dedicated Athleo Athlete Registration Screen.
 * Clean, focused, and secure athlete onboarding gateway without extraneous options.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {PressableScale} from '../components/PressableScale';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {triggerHaptic} from '../services/haptics';
import {isSupabaseConfigured} from '../config/supabase';
import {signUpWithEmail} from '../services/auth';

// Defensive BlurView import
let BlurView: any = null;
try {
  const blurModule = require('@react-native-community/blur');
  BlurView = blurModule?.BlurView ?? blurModule?.default?.BlurView ?? null;
} catch {
  BlurView = null;
}

export interface SignUpScreenProps {
  onNavigateToLogin: (registeredEmail?: string) => void;
}

export function SignUpScreen({onNavigateToLogin}: SignUpScreenProps) {
  const [isUrdu, setIsUrdu] = useState(false);

  // Form input states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Terms & Privacy modal
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms');

  // Mount tracking
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  // Entrance animations
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    isMountedRef.current = true;

    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    return () => {
      isMountedRef.current = false;
      pulseLoop.stop();
    };
  }, [entranceAnim, pulseAnim]);

  const isValidEmail = (str: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
  };

  const handleSignUp = async () => {
    if (isSubmittingRef.current) { return; }

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedName) {
      triggerHaptic('notificationWarning');
      Alert.alert(
        isUrdu ? 'نام درج کریں' : 'Name Required',
        isUrdu
          ? 'براہ کرم اپنا پورا نام درج کریں۔'
          : 'Please enter your athlete full name to proceed.',
      );
      return;
    }

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      triggerHaptic('notificationWarning');
      Alert.alert(
        isUrdu ? 'درست ای میل درج کریں' : 'Invalid Email',
        isUrdu
          ? 'براہ کرم ایک درست ای میل پتہ درج کریں۔'
          : 'Please enter a valid email address.',
      );
      return;
    }

    if (trimmedPassword.length < 6) {
      triggerHaptic('notificationWarning');
      Alert.alert(
        isUrdu ? 'پاس ورڈ کم از کم 6 حروف' : 'Password Too Short',
        isUrdu
          ? 'پاس ورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔'
          : 'Password must be at least 6 characters long.',
      );
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      triggerHaptic('notificationError');
      Alert.alert(
        isUrdu ? 'پاس ورڈ مطابقت نہیں رکھتا' : 'Passwords Do Not Match',
        isUrdu
          ? 'دونوں پاس ورڈ فیلڈز ایک جیسی ہونی چاہئیں۔'
          : 'The confirmation password does not match. Please re-enter carefully.',
      );
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      if (!isSupabaseConfigured()) {
        // Offline demo fallback
        triggerHaptic('notificationSuccess');
        Alert.alert(
          isUrdu ? 'اکاؤنٹ بن گیا! 🎉' : 'Account Created Successfully! 🎉',
          isUrdu
            ? 'آپ کا اکاؤنٹ رجسٹر ہو گیا ہے۔ براہ کرم لاگ ان کریں۔'
            : 'Your athlete account has been registered. Please enter your credentials to log in.',
          [
            {
              text: isUrdu ? 'لاگ ان کی طرف جائیں' : 'Go to Login',
              onPress: () => onNavigateToLogin(trimmedEmail),
            },
          ],
        );
        return;
      }

      await signUpWithEmail(trimmedEmail, trimmedPassword, trimmedName, false);

      triggerHaptic('notificationSuccess');
      if (isMountedRef.current) {
        Alert.alert(
          isUrdu ? 'اکاؤنٹ کامیابی سے بن گیا! 🎉' : 'Account Created Successfully! 🎉',
          isUrdu
            ? `آپ کا اکاؤنٹ رجسٹر ہو گیا ہے۔ اب اپنی ای میل (${trimmedEmail}) اور پاس ورڈ سے لاگ ان کریں۔`
            : `Your account has been registered. Please enter your email (${trimmedEmail}) and password to log in.`,
          [
            {
              text: isUrdu ? 'لاگ ان کریں' : 'Proceed to Login',
              onPress: () => onNavigateToLogin(trimmedEmail),
            },
          ],
        );
      }
    } catch (err: any) {
      triggerHaptic('notificationError');
      const msg = err?.message || '';
      let displayError = msg;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already in use')) {
        displayError = isUrdu
          ? 'یہ ای میل پہلے سے رجسٹرڈ ہے۔ براہ کرم لاگ ان کریں یا دوسری ای میل استعمال کریں۔'
          : 'This email is already registered. Please log in or use a different email.';
      } else {
        displayError = isUrdu
          ? 'اکاؤنٹ نہیں بن سکا۔ براہ کرم دوبارہ کوشش کریں۔'
          : msg || 'Unable to create account. Please try again.';
      }

      if (isMountedRef.current) {
        Alert.alert(
          isUrdu ? 'رجسٹریشن کی خرابی' : 'Registration Failed',
          displayError,
        );
      }
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <Animated.View style={[styles.root, {opacity: entranceAnim}]}>
      {/* Top Ambient Aura Glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientAura,
          {
            transform: [{scale: pulseAnim}],
          },
        ]}
      />

      {/* Top Bar with Back Button & Language Switch */}
      <View style={styles.topBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onNavigateToLogin()}
          style={styles.backButton}>
          <Icon name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.backButtonText}>
            {isUrdu ? 'لاگ ان' : 'Login'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setIsUrdu(prev => !prev)}
          style={styles.langBadge}>
          <Icon name="globe-outline" size={14} color="#B1F746" style={{marginRight: 5}} />
          <Text style={styles.langBadgeText}>{isUrdu ? 'English' : 'اردو'}</Text>
        </TouchableOpacity>
      </View>

      <SmoothScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Brand Emblem & Headline */}
        <View style={styles.brandContainer}>
          <View style={styles.logoOrb}>
            <Image
              source={require('../assets/logo_master.png')}
              style={styles.realLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>JOIN ATHLEO</Text>
          <Text style={styles.brandSubtitle}>
            {isUrdu ? 'نیا ایتھلیٹ اکاؤنٹ بنائیں' : 'Create your athlete account & start training'}
          </Text>
        </View>

        {/* Registration Form Card */}
        <View style={styles.formCard}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isUrdu ? 'پورا نام' : 'FULL NAME'}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                nameFocused && styles.inputWrapperFocused,
              ]}>
              <Icon
                name="person-outline"
                size={20}
                color={nameFocused ? '#B1F746' : '#8C947C'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder={isUrdu ? 'اپنا نام درج کریں' : 'e.g. Alex Hunter'}
                placeholderTextColor="rgba(140, 148, 124, 0.6)"
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isUrdu ? 'ایتھلیٹ ای میل' : 'ATHLETE EMAIL'}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused,
              ]}>
              <Icon
                name="at-outline"
                size={20}
                color={emailFocused ? '#B1F746' : '#8C947C'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="athlete@athleo.app"
                placeholderTextColor="rgba(140, 148, 124, 0.6)"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password (NO forgot password link here!) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isUrdu ? 'پاس ورڈ (کم از کم 6 حروف)' : 'PASSKEY (MIN 6 CHARACTERS)'}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
              ]}>
              <Icon
                name="lock-closed-outline"
                size={20}
                color={passwordFocused ? '#B1F746' : '#8C947C'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder={isUrdu ? '••••••••' : 'Enter passkey'}
                placeholderTextColor="rgba(140, 148, 124, 0.6)"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowPassword(p => !p)}
                style={styles.passwordToggle}>
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color="#8C947C"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isUrdu ? 'پاس ورڈ کی تصدیق کریں' : 'CONFIRM PASSKEY'}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                confirmFocused && styles.inputWrapperFocused,
              ]}>
              <Icon
                name="shield-checkmark-outline"
                size={20}
                color={confirmFocused ? '#B1F746' : '#8C947C'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder={isUrdu ? '••••••••' : 'Re-enter passkey'}
                placeholderTextColor="rgba(140, 148, 124, 0.6)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowConfirmPassword(p => !p)}
                style={styles.passwordToggle}>
                <Icon
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color="#8C947C"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Create Account CTA */}
          <PressableScale
            onPress={handleSignUp}
            disabled={loading}
            style={[
              styles.primaryButton,
              loading && styles.primaryButtonDisabled,
            ]}>
            {loading ? (
              <ActivityIndicator color="#0B130E" size="small" />
            ) : (
              <View style={styles.primaryButtonInner}>
                <Text style={styles.primaryButtonText}>
                  {isUrdu ? 'اکاؤنٹ بنائیں' : 'CREATE ACCOUNT'}
                </Text>
                <Icon
                  name="arrow-forward"
                  size={18}
                  color="#0B130E"
                  style={styles.primaryButtonIcon}
                />
              </View>
            )}
          </PressableScale>

          {/* Link back to Login */}
          <View style={styles.loginPromptRow}>
            <Text style={styles.loginPromptText}>
              {isUrdu ? 'پہلے سے اکاؤنٹ ہے؟' : 'Already have an account?'}{' '}
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => onNavigateToLogin()}>
              <Text style={styles.loginLinkText}>
                {isUrdu ? 'لاگ ان کریں' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer / Legal info */}
        <View style={styles.footer}>
          <View style={styles.securityBadge}>
            <Icon name="lock-closed" size={13} color="#8C947C" />
            <Text style={styles.securityBadgeText}>
              {isUrdu ? '256-بٹ ہارڈویئر اینکرڈ انکرپشن' : '256-Bit Hardware Encryption'}
            </Text>
          </View>

          <View style={styles.legalNoticeWrap}>
            <Text style={styles.legalNotice}>
              {isUrdu ? 'رجسٹر کر کے آپ ہمارے ' : 'By creating an account, you agree to our '}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setLegalTab('terms');
                setLegalModalVisible(true);
              }}>
              <Text style={styles.legalHighlight}>
                {isUrdu ? 'قوانین' : 'Terms'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.legalNotice}> &amp; </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setLegalTab('privacy');
                setLegalModalVisible(true);
              }}>
              <Text style={styles.legalHighlight}>
                {isUrdu ? 'پرائیویسی پالیسی' : 'Privacy Protocol'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SmoothScrollView>

      {/* Legal Overlay Modal */}
      <Modal
        visible={legalModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setLegalModalVisible(false)}>
        <View style={styles.legalModalOverlay}>
          {BlurView && (
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="dark"
              blurAmount={20}
              reducedTransparencyFallbackColor="rgba(6, 10, 7, 0.94)"
            />
          )}
          <View style={styles.legalModalCard}>
            <View style={styles.legalModalHeader}>
              <View style={styles.legalTabs}>
                <TouchableOpacity
                  style={[styles.legalTabBtn, legalTab === 'terms' && styles.legalTabBtnActive]}
                  onPress={() => setLegalTab('terms')}>
                  <Text style={[styles.legalTabText, legalTab === 'terms' && styles.legalTabTextActive]}>
                    Terms of Service
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.legalTabBtn, legalTab === 'privacy' && styles.legalTabBtnActive]}
                  onPress={() => setLegalTab('privacy')}>
                  <Text style={[styles.legalTabText, legalTab === 'privacy' && styles.legalTabTextActive]}>
                    Privacy Protocol
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.legalCloseBtn}
                onPress={() => setLegalModalVisible(false)}>
                <Icon name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
              {legalTab === 'terms' ? (
                <View style={styles.legalBody}>
                  <Text style={styles.legalSectionTitle}>1. Athlete Responsibility & Health</Text>
                  <Text style={styles.legalParagraph}>
                    Athleo provides algorithmic physical conditioning, intelligent volume pacing, and macro telemetry. You understand that intense exercise carries inherent physical risk. Consult with a qualified physician prior to starting any new training protocol.
                  </Text>
                  <Text style={styles.legalSectionTitle}>2. Biomechanical & AI Guidance</Text>
                  <Text style={styles.legalParagraph}>
                    Dynamic biometric advice, 1RM estimations, and rep pacing generated by Athleo are computational recommendations and should never supersede personal physical sensations or certified medical guidance.
                  </Text>
                </View>
              ) : (
                <View style={styles.legalBody}>
                  <Text style={styles.legalSectionTitle}>1. Zero-Selling Data Guarantee</Text>
                  <Text style={styles.legalParagraph}>
                    Athleo never sells, licenses, or monetizes athlete training metrics, biometric heart rate series, or location records. All telemetry is encrypted.
                  </Text>
                  <Text style={styles.legalSectionTitle}>2. Local Device Enclave</Text>
                  <Text style={styles.legalParagraph}>
                    Biometric tokens, face ID sessions, and personal workout history are stored inside device-bound MMKV storage protected by AES-256 hardware encryption.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.legalDismissBtn}
              onPress={() => setLegalModalVisible(false)}>
              <Text style={styles.legalDismissBtnText}>I Understand &amp; Agree</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060A07',
  },
  ambientAura: {
    position: 'absolute',
    top: -90,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(177, 247, 70, 0.08)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1610',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(177, 247, 70, 0.3)',
  },
  langBadgeText: {
    color: '#B1F746',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoOrb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0D1610',
    borderWidth: 1.5,
    borderColor: 'rgba(177, 247, 70, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#B1F746',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  realLogoImage: {
    width: 48,
    height: 48,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  brandSubtitle: {
    color: '#8C947C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#0D1610',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#8C947C',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#070C08',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: '#B1F746',
    backgroundColor: '#09100B',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  passwordToggle: {
    padding: 6,
  },
  primaryButton: {
    backgroundColor: '#B1F746',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#B1F746',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#0B130E',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  primaryButtonIcon: {
    marginLeft: 2,
  },
  loginPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  loginPromptText: {
    color: '#8C947C',
    fontSize: 13,
    fontWeight: '600',
  },
  loginLinkText: {
    color: '#B1F746',
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    marginTop: 26,
    gap: 10,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityBadgeText: {
    color: '#8C947C',
    fontSize: 11,
    fontWeight: '600',
  },
  legalNoticeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalNotice: {
    color: 'rgba(140, 148, 124, 0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  legalHighlight: {
    color: '#B1F746',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Modal styles
  legalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  legalModalCard: {
    backgroundColor: '#0D1610',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(177, 247, 70, 0.3)',
    maxHeight: '80%',
    padding: 20,
  },
  legalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  legalTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  legalTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  legalTabBtnActive: {
    backgroundColor: '#B1F746',
  },
  legalTabText: {
    color: '#8C947C',
    fontSize: 12,
    fontWeight: '700',
  },
  legalTabTextActive: {
    color: '#0B130E',
    fontWeight: '900',
  },
  legalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalScroll: {
    marginBottom: 16,
  },
  legalBody: {
    gap: 12,
  },
  legalSectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  legalParagraph: {
    color: '#A0ABA1',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  legalDismissBtn: {
    backgroundColor: '#B1F746',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  legalDismissBtnText: {
    color: '#0B130E',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
