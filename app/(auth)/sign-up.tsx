import * as React from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, Alert, Modal } from 'react-native';
import { useSignUp, useAuth } from '@clerk/clerk-expo';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { darkColors, lightColors } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/contexts/UserContext';
import { User, Building2, LogOut } from 'lucide-react-native';
import { AccountType } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findUserByReferralCode, recordReferral } from '@/services/firebase/referralService';

const REFERRAL_CODE_KEY = '@iendorse:referral_code';

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn, isLoaded: authLoaded, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string; source?: string }>();
  const { isDarkMode, setAccountType, isLoading: isProfileLoading, clerkUser: contextClerkUser, clearAllStoredData } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  // Capture referral source from URL params (supports ?ref=location1 or ?source=location1)
  const referralSource = params.ref || params.source || null;

  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showConsentModal, setShowConsentModal] = React.useState(false);
  const [consentChecked, setConsentChecked] = React.useState(false);
  const [selectedAccountType, setSelectedAccountType] = React.useState<AccountType>('individual');
  const [storedReferralCode, setStoredReferralCode] = React.useState<string | null>(null);
  const consentScrollRef = React.useRef<ScrollView>(null);

  // Check for stored referral code from invite link
  React.useEffect(() => {
    const checkReferralCode = async () => {
      try {
        const code = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
        if (code) {
          console.log('[Sign Up] Found stored referral code:', code);
          setStoredReferralCode(code);
        }
      } catch (error) {
        console.error('[Sign Up] Error checking referral code:', error);
      }
    };
    checkReferralCode();
  }, []);

  // Scroll consent modal to top when shown
  React.useEffect(() => {
    if (showConsentModal && consentScrollRef.current) {
      consentScrollRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [showConsentModal]);

  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const resetForm = React.useCallback(() => {
    setEmailAddress('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setCode('');
    setPendingVerification(false);
    setError('');
    setIsSubmitting(false);
  }, []);

  // Handle force sign out
  const handleForceSignOut = async () => {
    setIsSigningOut(true);
    try {
      console.log('[Sign Up] Force signing out...');
      await clearAllStoredData();
      await signOut();
      console.log('[Sign Up] Sign out complete');
      if (Platform.OS === 'web') {
        window.location.reload();
      }
    } catch (error) {
      console.error('[Sign Up] Sign out error:', error);
      if (Platform.OS === 'web') {
        window.location.reload();
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  // If already signed in, show option to sign out
  if (authLoaded && isSignedIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.alreadySignedInContainer}>
          <Image
            source={require('@/assets/images/endorsemulti1.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.alreadySignedInTitle, { color: colors.text }]}>
            You're already signed in
          </Text>
          <Text style={[styles.alreadySignedInSubtitle, { color: colors.textSecondary }]}>
            Sign out first to create a new account
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.buttonText}>Continue to App</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signOutButton, { backgroundColor: colors.danger }]}
            onPress={handleForceSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <LogOut size={20} color="#fff" strokeWidth={2} />
                <Text style={styles.buttonText}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const onSignUpPress = async () => {
    console.log('[Sign Up] Button pressed, isLoaded:', isLoaded, 'isSubmitting:', isSubmitting);

    if (!isLoaded) {
      console.log('[Sign Up] Clerk not loaded yet');
      setError('Please wait, loading...');
      return;
    }

    if (isSubmitting) {
      console.log('[Sign Up] Already submitting');
      return;
    }

    if (!emailAddress || !password || !fullName.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (!emailAddress.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError('');
    // Show consent modal before proceeding
    setShowConsentModal(true);
  };

  const handleConsentAccept = async () => {
    if (!consentChecked) {
      Alert.alert('Consent Required', 'Please check the consent box to proceed with sign up.');
      return;
    }

    setShowConsentModal(false);
    setIsSubmitting(true);

    try {
      console.log('[Sign Up] Creating account for:', emailAddress);
      console.log('[Sign Up] Current signUp status:', signUp?.status);
      
      if (!signUp) {
        throw new Error('Clerk SignUp not initialized');
      }
      
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const result = await signUp.create({
        emailAddress,
        password,
        firstName,
        lastName,
        unsafeMetadata: {
          consentGivenAt: new Date().toISOString(),
          consentVersion: '1.0',
          fullName: fullName.trim(),
          ...(referralSource && { referralSource }), // Track which QR code/location the user signed up from
        },
      });

      console.log('[Sign Up] Account created successfully');
      console.log('[Sign Up] Sign-up status:', result.status);
      console.log('[Sign Up] Verification needed:', result.verifications.emailAddress.status);
      
      if (result.status === 'complete') {
        console.log('[Sign Up] Sign-up complete automatically');
        if (result.createdSessionId) {
          console.log('[Sign Up] Setting active session:', result.createdSessionId);
          await setActive({ session: result.createdSessionId });
          console.log('[Sign Up] Session activated, waiting before redirect');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        // Try to set account type (may fail if context not ready)
        console.log('[Sign Up] Setting account type (auto-complete):', selectedAccountType);
        try {
          await setAccountType(selectedAccountType);
        } catch (e) {
          console.error('[Sign Up] Failed to set account type:', e);
        }
        // Process referral if a code was used
        if (storedReferralCode && result.createdUserId) {
          try {
            const referrer = await findUserByReferralCode(storedReferralCode);
            if (referrer) {
              await recordReferral(referrer.userId, referrer.userName, result.createdUserId, fullName.trim(), emailAddress, storedReferralCode);
              await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
            }
          } catch (e) { console.error('[Sign Up] Referral error:', e); }
        }
        // Pass account type as query param to ensure onboarding knows the user type
        console.log('[Sign Up] Redirecting to onboarding with accountType:', selectedAccountType);
        router.replace(`/onboarding?accountType=${selectedAccountType}`);
        return;
      }

      if (result.verifications.emailAddress.status === 'verified') {
        console.log('[Sign Up] Email already verified but status not complete');
        if (result.createdSessionId) {
          console.log('[Sign Up] Setting active session:', result.createdSessionId);
          await setActive({ session: result.createdSessionId });
          console.log('[Sign Up] Session activated, waiting before redirect');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        // Try to set account type (may fail if context not ready)
        console.log('[Sign Up] Setting account type (pre-verified):', selectedAccountType);
        try {
          await setAccountType(selectedAccountType);
        } catch (e) {
          console.error('[Sign Up] Failed to set account type:', e);
        }
        // Process referral if a code was used
        if (storedReferralCode && result.createdUserId) {
          try {
            const referrer = await findUserByReferralCode(storedReferralCode);
            if (referrer) {
              await recordReferral(referrer.userId, referrer.userName, result.createdUserId, fullName.trim(), emailAddress, storedReferralCode);
              await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
            }
          } catch (e) { console.error('[Sign Up] Referral error:', e); }
        }
        // Pass account type as query param to ensure onboarding knows the user type
        console.log('[Sign Up] Redirecting to onboarding with accountType:', selectedAccountType);
        router.replace(`/onboarding?accountType=${selectedAccountType}`);
        return;
      }
      
      console.log('[Sign Up] Preparing verification...');
      await result.prepareEmailAddressVerification({ strategy: 'email_code' });

      console.log('[Sign Up] Verification email sent');
      setPendingVerification(true);
      setIsSubmitting(false);
    } catch (err: any) {
      console.error('[Sign Up] Error:', JSON.stringify(err, null, 2));
      
      if (err?.errors?.[0]?.code === 'session_exists') {
        console.log('[Sign Up] Session exists, redirecting to home');
        setIsSubmitting(false);
        await new Promise(resolve => setTimeout(resolve, 500));
        router.replace('/');
        return;
      }
      
      if (err?.errors?.[0]?.code === 'form_identifier_exists') {
        console.log('[Sign Up] Email already exists, showing sign-in option');
        setPassword('');
        setConfirmPassword('');
        
        if (Platform.OS === 'web') {
          setError('This email is already registered. Please sign in instead.');
          setIsSubmitting(false);
        } else {
          setIsSubmitting(false);
          Alert.alert(
            'Email Already Registered',
            'This email address is already associated with an account. Would you like to sign in instead?',
            [
              {
                text: 'Stay Here',
                style: 'cancel',
                onPress: () => {
                  setError('This email is already registered. Please use a different email or sign in.');
                }
              },
              {
                text: 'Go to Sign In',
                onPress: () => {
                  router.push('/(auth)/sign-in');
                }
              }
            ]
          );
        }
        return;
      }
      
      if (err?.errors?.[0]?.code === 'client_state_invalid') {
        console.log('[Sign Up] Invalid client state - attempting to recover');
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsSubmitting(false);
        router.replace('/');
        return;
      }
      
      if (err?.errors?.[0]?.code === 'form_password_pwned') {
        const pwnedMessage = 'This password has been found in a data breach. Please use a different, more secure password.';
        console.error('[Sign Up] Password pwned error:', pwnedMessage);
        setPassword('');
        setConfirmPassword('');
        setError(pwnedMessage);
        setIsSubmitting(false);
        return;
      }
      
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'An error occurred during sign up';
      console.error('[Sign Up] Setting error message:', errorMessage);
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const onVerifyPress = async () => {
    if (!isLoaded || isSubmitting) return;
    
    if (!code || code.length < 6) {
      setError('Please enter a valid verification code');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      console.log('[Sign Up] Attempting verification with code:', code);
      
      if (!signUp) {
        console.error('[Sign Up] No signUp instance available');
        setError('Session expired. Please start sign up again.');
        setPendingVerification(false);
        setIsSubmitting(false);
        return;
      }
      
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      console.log('[Sign Up] Verification attempt result:', result.status);
      console.log('[Sign Up] Created session ID:', result.createdSessionId);

      if (result.status === 'complete' && result.createdSessionId) {
        console.log('[Sign Up] Verification complete, setting active session:', result.createdSessionId);
        await setActive({ session: result.createdSessionId });
        console.log('[Sign Up] Session set successfully, waiting for profile to load');

        // Wait for the UserContext to fully load the profile (up to 5 seconds)
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5 seconds
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
          // Check if UserContext has loaded and has the clerk user
          // Note: We need to check the current state, not the captured closure
          // So we'll just wait a reasonable amount of time
          if (attempts >= 15) { // At least 1.5 seconds
            break;
          }
        }

        console.log('[Sign Up] Profile load wait complete, attempts:', attempts);

        // Set the account type
        console.log('[Sign Up] Setting account type:', selectedAccountType);
        try {
          await setAccountType(selectedAccountType);
          console.log('[Sign Up] Account type set successfully');
        } catch (accountTypeError) {
          console.error('[Sign Up] Failed to set account type:', accountTypeError);
          // Continue anyway - the user can set up their business later
        }

        // Process referral if a code was used
        if (storedReferralCode && result.createdUserId) {
          console.log('[Sign Up] Processing referral with code:', storedReferralCode);
          try {
            const referrer = await findUserByReferralCode(storedReferralCode);
            if (referrer) {
              await recordReferral(
                referrer.userId,
                referrer.userName,
                result.createdUserId,
                fullName.trim(),
                emailAddress,
                storedReferralCode
              );
              console.log('[Sign Up] Referral recorded successfully');
              // Clear the stored referral code
              await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
            }
          } catch (referralError) {
            console.error('[Sign Up] Failed to record referral:', referralError);
            // Don't block sign-up for referral errors
          }
        }

        // Pass account type as query param to ensure onboarding knows the user type
        console.log('[Sign Up] Redirecting to onboarding with accountType:', selectedAccountType);
        router.replace(`/onboarding?accountType=${selectedAccountType}`);
      } else {
        console.error('[Sign Up] Verification incomplete:', JSON.stringify(result, null, 2));
        setError('Verification incomplete. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      console.error('[Sign Up] Verification error:', JSON.stringify(err, null, 2));
      
      if (err?.errors?.[0]?.code === 'client_state_invalid') {
        console.log('[Sign Up] Invalid client state during verification, redirecting to home');
        router.replace('/');
        return;
      }
      
      if (err?.errors?.[0]?.code === 'form_code_incorrect') {
        setError('Incorrect verification code. Please try again.');
      } else {
        setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Verification failed. Please check your code.');
      }
      setIsSubmitting(false);
    }
  };



  if (pendingVerification) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/endorsemulti1.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Verify your email</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Enter the verification code sent to your email</Text>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Verification Code</Text>
              <TextInput
                value={code}
                placeholder="Enter verification code"
                placeholderTextColor={colors.textSecondary}
                onChangeText={(code) => setCode(code)}
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                keyboardType="number-pad"
                autoCapitalize="none"
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity onPress={onVerifyPress} style={[styles.button, { backgroundColor: colors.primary }]} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/endorsemulti1.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.taglineContainer}>
            <Text style={styles.taglineLine}>
              <Text style={[styles.taglineFirstWord, { color: colors.text }]}>build </Text>
              <Text style={[styles.taglineRest, { color: colors.text }]}>your endorsement list.</Text>
            </Text>
            <Text style={styles.taglineLine}>
              <Text style={[styles.taglineFirstWord, { color: colors.text }]}>browse </Text>
              <Text style={[styles.taglineRest, { color: colors.text }]}>friends for gift ideas.</Text>
            </Text>
            <Text style={styles.taglineLine}>
              <Text style={[styles.taglineFirstWord, { color: colors.primary }]}>earn </Text>
              <Text style={[styles.taglineRest, { color: colors.text }]}>discounts for your endorsements.</Text>
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
            <TextInput
              autoCapitalize="words"
              value={fullName}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textSecondary}
              onChangeText={(name) => setFullName(name)}
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              onChangeText={(email) => setEmailAddress(email)}
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <TextInput
              value={password}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={true}
              onChangeText={(confirmPassword) => setConfirmPassword(confirmPassword)}
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
            />
          </View>

          {/* Account Type Toggle */}
          <View style={styles.accountTypeContainer}>
            <TouchableOpacity
              style={[
                styles.accountTypeOption,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: selectedAccountType === 'individual' ? colors.primary : colors.border,
                  borderWidth: selectedAccountType === 'individual' ? 2 : 1,
                }
              ]}
              onPress={() => setSelectedAccountType('individual')}
              activeOpacity={0.7}
            >
              <User size={20} color={selectedAccountType === 'individual' ? colors.primary : colors.textSecondary} strokeWidth={2} />
              <Text style={[
                styles.accountTypeText,
                { color: selectedAccountType === 'individual' ? colors.primary : colors.textSecondary }
              ]}>Individual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.accountTypeOption,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: selectedAccountType === 'business' ? colors.primary : colors.border,
                  borderWidth: selectedAccountType === 'business' ? 2 : 1,
                }
              ]}
              onPress={() => setSelectedAccountType('business')}
              activeOpacity={0.7}
            >
              <Building2 size={20} color={selectedAccountType === 'business' ? colors.primary : colors.textSecondary} strokeWidth={2} />
              <Text style={[
                styles.accountTypeText,
                { color: selectedAccountType === 'business' ? colors.primary : colors.textSecondary }
              ]}>Business</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onSignUpPress} style={[styles.button, { backgroundColor: colors.primary }]} disabled={isSubmitting || !isLoaded}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
          <View style={styles.linkContainer}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => {
              resetForm();
              router.push('/(auth)/sign-in');
            }}>
              <Text style={[styles.link, { color: colors.primary }]}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Consent Modal */}
      <Modal
        visible={showConsentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConsentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <ScrollView ref={consentScrollRef} style={styles.modalScroll} showsVerticalScrollIndicator={true}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Personalized Code Generation and Vendor Sharing Consent
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                By checking the box below and proceeding, you acknowledge and agree to the following:
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                I authorize Stand Corp (the "Company"), operator of the Stand App application (the "App"), to generate a personalized code for my use in shopping and making payments with participating vendors and companies. This code may be used to identify me and apply discounts or other benefits.
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                I understand that:
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                • To enable discounts or personalized offers, the Company will share my basic information (such as name, contact details, and relevant beliefs or preferences provided during sign-up) with the vendors where I use the code.
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                • The Company may also share insights derived from my spending habits and behavior (obtained from my App usage) with these vendors to facilitate tailored offers, or with other third parties for analytical or marketing purposes, in accordance with the Company's Privacy Policy available on our site or upon request.
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                • This sharing is necessary for the code's functionality and to provide value through vendor partnerships.
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                • I can stop using the code or request deletion of shared data by contacting the Company, though this may affect ongoing discounts or features.
              </Text>

              <Text style={[styles.consentText, { color: colors.text }]}>
                I have read and understand the Company's Privacy Policy and Terms of Service, and I consent to the generation of the code and the associated data sharing as described above.
              </Text>

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setConsentChecked(!consentChecked)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, { borderColor: colors.primary }]}>
                  {consentChecked && (
                    <View style={[styles.checkboxChecked, { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                  I consent to generating the personalized code and the associated data sharing.
                </Text>
              </TouchableOpacity>

              <Text style={[styles.consentDate, { color: colors.textSecondary }]}>
                Date: {new Date().toLocaleDateString()}
              </Text>

              <Text style={[styles.consentDate, { color: colors.textSecondary }]}>
                User: {emailAddress}
              </Text>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: colors.border }]}
                onPress={() => {
                  setShowConsentModal(false);
                  setConsentChecked(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary, opacity: consentChecked ? 1 : 0.5 }]}
                onPress={handleConsentAccept}
                activeOpacity={0.7}
                disabled={!consentChecked}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>
                  {isSubmitting ? 'Processing...' : 'Accept & Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 12,
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  logo: {
    width: 260,
    height: 260,
    tintColor: undefined,
  },
  taglineContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  taglineLine: {
    textAlign: 'center',
    marginBottom: 2,
  },
  taglineFirstWord: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  taglineRest: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  accountTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  accountTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    textAlign: 'left',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: darkColors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: darkColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: darkColors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: darkColors.text,
  },
  button: {
    backgroundColor: darkColors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  linkText: {
    color: darkColors.textSecondary,
    fontSize: 14,
  },
  link: {
    color: darkColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  // Consent Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalScroll: {
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 28,
  },
  consentText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  consentDate: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    borderWidth: 1,
  },
  modalButtonPrimary: {
    // backgroundColor set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Already signed in styles
  alreadySignedInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  alreadySignedInTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
  },
  alreadySignedInSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    width: '100%',
    maxWidth: 300,
  },
});
