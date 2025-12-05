import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, Dimensions } from 'react-native';
import React from 'react';
import { darkColors, lightColors } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/contexts/UserContext';
import { Users, Target, ListChecks, Search, Gift, QrCode, Sparkles, ChevronDown, ChevronUp, LogOut } from 'lucide-react-native';
import ContactModal from '@/components/ContactModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn, isLoaded: authLoaded, signOut } = useAuth();
  const router = useRouter();
  const { isDarkMode, clearAllStoredData } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [resetCode, setResetCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [resetStep, setResetStep] = React.useState<'email' | 'code' | 'password'>('email');
  const [showLearnMore, setShowLearnMore] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [showContactModal, setShowContactModal] = React.useState(false);

  // Handle force sign out
  const handleForceSignOut = async () => {
    setIsSigningOut(true);
    try {
      console.log('[Sign In] Force signing out...');
      await clearAllStoredData();
      await signOut();
      console.log('[Sign In] Sign out complete');
      // Force reload the page on web to clear any cached state
      if (Platform.OS === 'web') {
        window.location.reload();
      }
    } catch (error) {
      console.error('[Sign In] Sign out error:', error);
      // Try to reload anyway on web
      if (Platform.OS === 'web') {
        window.location.reload();
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  // Show loading state while auth is loading to prevent flash
  if (!authLoaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.alreadySignedInContainer}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  // If already signed in, redirect to home immediately
  if (isSignedIn) {
    router.replace('/');
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.alreadySignedInContainer}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  const onSignInPress = async () => {
    if (!isLoaded || isSubmitting) return;

    if (!emailAddress || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        console.log('[Sign In] Email sign-in successful, redirecting to index');
        router.replace('/');
      } else {
        console.error('[Sign In] Incomplete:', JSON.stringify(signInAttempt, null, 2));
        setError('Sign in incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error('[Sign In] Error:', JSON.stringify(err, null, 2));
      
      if (err?.errors?.[0]?.code === 'session_exists') {
        console.log('[Sign In] Session exists, redirecting to home');
        router.replace('/');
        return;
      }
      
      if (err?.errors?.[0]?.code === 'form_identifier_not_found') {
        setError("Account not found. Please check your email or sign up to create a new account.");
        return;
      }
      
      if (err?.errors?.[0]?.code === 'form_password_incorrect') {
        setError('Incorrect password. Please try again.');
        return;
      }
      
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'An error occurred during sign in';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotPasswordPress = async () => {
    if (!emailAddress) {
      setError('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress,
      });

      setShowForgotPassword(true);
      setResetStep('code');
    } catch (err: any) {
      console.error('[Forgot Password] Error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Failed to send reset code';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetCodeSubmit = async () => {
    if (!resetCode) {
      setError('Please enter the verification code');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
      });

      if (result.status === 'needs_new_password') {
        setResetStep('password');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error('[Reset Code] Error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Invalid verification code';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onNewPasswordSubmit = async () => {
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await signIn.resetPassword({
        password: newPassword,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        setShowForgotPassword(false);
        setResetStep('email');
        setResetCode('');
        setNewPassword('');
        router.replace('/');
      } else {
        setError('Password reset failed. Please try again.');
      }
    } catch (err: any) {
      console.error('[New Password] Error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Failed to reset password';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelForgotPassword = () => {
    setShowForgotPassword(false);
    setResetStep('email');
    setResetCode('');
    setNewPassword('');
    setError('');
  };

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
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Image
              source={require('@/assets/images/endorsing.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {!showForgotPassword ? (
            <>
              <View style={styles.taglineContainer}>
                <Text style={styles.taglineLine}>
                  <Text style={[styles.taglineFirstWord, { color: colors.text }]}>build </Text>
                  <Text style={[styles.taglineRest, { color: colors.text }]}>your endorsement list.</Text>
                </Text>
                <Text style={styles.taglineLine}>
                  <Text style={[styles.taglineFirstWord, { color: colors.text }]}>browse </Text>
                  <Text style={[styles.taglineRest, { color: colors.text }]}>people you trust.</Text>
                </Text>
                <Text style={styles.taglineLine}>
                  <Text style={[styles.taglineFirstWord, { color: colors.primary }]}>earn </Text>
                  <Text style={[styles.taglineRest, { color: colors.text }]}>discounts for your endorsements.</Text>
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  value={emailAddress}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textSecondary}
                  onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
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
              <TouchableOpacity onPress={onSignInPress} style={[styles.button, { backgroundColor: colors.primary }]} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </TouchableOpacity>
              <View style={styles.forgotPasswordContainer}>
                <TouchableOpacity
                  onPress={onForgotPasswordPress}
                  style={styles.forgotPasswordButton}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot password?</Text>
                </TouchableOpacity>
                <Text style={[styles.linkText, { color: colors.textSecondary }]}>  |  </Text>
                <TouchableOpacity onPress={() => setShowContactModal(true)}>
                  <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Contact</Text>
                </TouchableOpacity>
                <Text style={[styles.linkText, { color: colors.textSecondary }]}>  |  </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
                  <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Sign up</Text>
                </TouchableOpacity>
              </View>

              {/* Learn More Toggle */}
              <TouchableOpacity
                style={styles.learnMoreToggle}
                onPress={() => setShowLearnMore(!showLearnMore)}
                activeOpacity={0.7}
              >
                <Text style={styles.taglineLine}>
                  <Text style={[styles.learnMoreFirstWord, { color: colors.textSecondary }]}>
                    {showLearnMore ? 'hide ' : 'learn '}
                  </Text>
                  <Text style={[styles.learnMoreRest, { color: colors.textSecondary }]}>
                    {showLearnMore ? 'details.' : 'more.'}
                  </Text>
                </Text>
                {showLearnMore ? (
                  <ChevronUp size={24} color={colors.textSecondary} strokeWidth={2} />
                ) : (
                  <ChevronDown size={24} color={colors.textSecondary} strokeWidth={2} />
                )}
              </TouchableOpacity>

              {/* Expandable Landing Content */}
              {showLearnMore && (
                <View style={styles.landingContent}>
                  {/* Tagline */}
                  <Text style={[styles.landingTagline, { color: colors.primary }]}>
                    the personal business directory that pays
                  </Text>

                  {/* Who We Are Section */}
                  <View style={[styles.landingSection, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <Users size={24} color={colors.primary} strokeWidth={2} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>WHO WE ARE</Text>
                    </View>
                    <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                      Babson grads and MIT data engineers.
                    </Text>
                  </View>

                  {/* Our Mission Section */}
                  <View style={[styles.landingSection, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <Target size={24} color={colors.primary} strokeWidth={2} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>OUR MISSION</Text>
                    </View>

                    <View style={styles.missionPoint}>
                      <Sparkles size={18} color={colors.success} strokeWidth={2} style={styles.missionIcon} />
                      <View style={styles.missionTextContainer}>
                        <Text style={[styles.missionTitle, { color: colors.text }]}>Decentralize Endorsements</Text>
                        <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                          Endorsement deals require a person that has a large audience and the ability to create content. We make endorsements as simple as a public list. This reduces the cost of creation but also widens the target from a few loosely held together celebrity networks to a much larger collection of deeply personal individual networks. A referral from a trusted friend means more than one from a celebrity. With infrastructure this seamless, businesses can compensate anyone for their endorsement by offering verifiable discounts and rewards.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.missionPoint}>
                      <Sparkles size={18} color={colors.success} strokeWidth={2} style={styles.missionIcon} />
                      <View style={styles.missionTextContainer}>
                        <Text style={[styles.missionTitle, { color: colors.text }]}>Align Spending With Your Principles</Text>
                        <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                          In a world where real change feels out of reach, remember: you vote every day with your money. We provide AI tools that recommend and organize brands based on your values, interests, causes, ideology, or politics. Be thoughtful with your money - and your endorsements!
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* How It Works Section */}
                  <View style={[styles.landingSection, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <ListChecks size={24} color={colors.primary} strokeWidth={2} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>HOW IT WORKS</Text>
                    </View>

                    <View style={styles.stepContainer}>
                      <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <ListChecks size={20} color={colors.text} strokeWidth={2} />
                        <Text style={[styles.stepText, { color: colors.text }]}>
                          Users build their endorsement list of brands and businesses they support.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.stepContainer}>
                      <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Search size={20} color={colors.text} strokeWidth={2} />
                        <Text style={[styles.stepText, { color: colors.text }]}>
                          Users browse their friend's endorsements to discover new businesses or gift ideas.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.stepContainer}>
                      <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <QrCode size={20} color={colors.text} strokeWidth={2} />
                        <Text style={[styles.stepText, { color: colors.text }]}>
                          Businesses offer deals for placement on endorsement lists - verified by QR/promo code.
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* How To Get In Section */}
                  <View style={[styles.landingSection, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <Gift size={24} color={colors.primary} strokeWidth={2} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>HOW TO GET IN</Text>
                    </View>
                    <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                      It's free! Create an account at iendorse.app. Build your list of brands and local businesses you love.
                    </Text>
                    <Text style={[styles.sectionText, { color: colors.textSecondary, marginTop: 12 }]}>
                      <Text style={{ fontWeight: '600', color: colors.text }}>For individuals:</Text> See what deals businesses offer in exchange for your endorsement.
                    </Text>
                    <Text style={[styles.sectionText, { color: colors.textSecondary, marginTop: 8 }]}>
                      <Text style={{ fontWeight: '600', color: colors.text }}>For businesses:</Text> Set deals you want to offer for user endorsements - based on rank placement or time on list.
                    </Text>
                    <Text style={[styles.sectionText, { color: colors.textSecondary, marginTop: 12 }]}>
                      Share your lists with friends or family looking for the right gift or discovering new, trusted places!
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
              {resetStep === 'code' && (
                <>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    We sent a verification code to {emailAddress}
                  </Text>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Verification Code</Text>
                    <TextInput
                      value={resetCode}
                      placeholder="Enter the 6-digit code"
                      placeholderTextColor={colors.textSecondary}
                      onChangeText={setResetCode}
                      style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <TouchableOpacity onPress={onResetCodeSubmit} style={[styles.button, { backgroundColor: colors.primary }]} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Verify Code</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
              {resetStep === 'password' && (
                <>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Enter your new password
                  </Text>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>New Password</Text>
                    <TextInput
                      value={newPassword}
                      placeholder="Enter your new password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={true}
                      onChangeText={setNewPassword}
                      style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    />
                  </View>
                  <TouchableOpacity onPress={onNewPasswordSubmit} style={[styles.button, { backgroundColor: colors.primary }]} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
              <View style={styles.linkContainer}>
                <TouchableOpacity onPress={cancelForgotPassword}>
                  <Text style={[styles.link, { color: colors.primary }]}>Back to sign in</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Contact Modal */}
      <ContactModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        isDarkMode={isDarkMode}
        requireContactInfo={true}
      />
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
    padding: 20,
    paddingTop: 0,
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 0,
  },
  logo: {
    width: 200,
    height: 200,
    tintColor: undefined,
  },
  taglineContainer: {
    alignItems: 'center',
    marginTop: -15,
    marginBottom: 20,
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
  inputContainer: {
    marginBottom: 12,
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
    alignItems: 'baseline',
    marginTop: 16,
  },
  linkText: {
    color: darkColors.textSecondary,
    fontSize: 14,
  },
  link: {
    color: darkColors.primary,
    fontSize: 22,
    fontWeight: '700',
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
  forgotPasswordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  forgotPasswordButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Landing page styles
  learnMoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingVertical: 4,
    gap: 8,
  },
  learnMoreFirstWord: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  learnMoreRest: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  landingContent: {
    marginTop: 16,
    gap: 16,
  },
  landingTagline: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  landingSection: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  missionPoint: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  missionIcon: {
    marginTop: 2,
  },
  missionTextContainer: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
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
