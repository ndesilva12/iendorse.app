/**
 * Invite Landing Page
 * Handles referral links and redirects to sign-up with referral code
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gift, ArrowRight, Users, Star, Heart } from 'lucide-react-native';
import { findUserByReferralCode } from '@/services/firebase/referralService';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

const REFERRAL_CODE_KEY = '@iendorse:referral_code';

export default function InviteLandingPage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isSignedIn, isLoaded } = useAuth();
  const { isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  const [isValidating, setIsValidating] = useState(true);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [isValidCode, setIsValidCode] = useState(false);

  useEffect(() => {
    const validateCode = async () => {
      if (!code) {
        setIsValidating(false);
        return;
      }

      try {
        // Validate the referral code
        const referrer = await findUserByReferralCode(code);

        if (referrer) {
          setReferrerName(referrer.userName || 'A friend');
          setIsValidCode(true);

          // Store the referral code for later use during sign-up
          await AsyncStorage.setItem(REFERRAL_CODE_KEY, code.toUpperCase());
        }
      } catch (error) {
        console.error('[InviteLanding] Error validating code:', error);
      } finally {
        setIsValidating(false);
      }
    };

    validateCode();
  }, [code]);

  // If user is already signed in, redirect to home
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/(tabs)/list');
    }
  }, [isLoaded, isSignedIn]);

  const handleGetStarted = () => {
    router.push('/sign-up');
  };

  const handleSignIn = () => {
    router.push('/sign-in');
  };

  if (isValidating || !isLoaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your invite...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require('@/assets/images/endorsemulti1.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          {isValidCode ? (
            <>
              <View style={[styles.giftIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Gift size={48} color={colors.primary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.text }]}>
                You're Invited!
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                {referrerName} has invited you to join iEndorse
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.giftIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Users size={48} color={colors.primary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.text }]}>
                Welcome to iEndorse
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                {code ? "This invite link has expired or is invalid." : "Join the community of conscious consumers."}
              </Text>
            </>
          )}
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
              <Star size={20} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                Endorse What You Love
              </Text>
              <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                Build your personal endorsement list of brands and businesses
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
              <Heart size={20} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                Shop Your Values
              </Text>
              <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                Discover brands aligned with what matters most to you
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
              <Users size={20} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                Connect with Others
              </Text>
              <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                Follow friends and discover their favorite brands
              </Text>
            </View>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: colors.white }]}>
              Get Started
            </Text>
            <ArrowRight size={20} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSignIn}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </View>

        {/* Referral Code Display */}
        {isValidCode && (
          <View style={[styles.referralBadge, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Text style={[styles.referralBadgeText, { color: colors.primary }]}>
              Invite code: {code?.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  logo: {
    width: 180,
    height: 52,
    marginBottom: 32,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  giftIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaSection: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  referralBadge: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  referralBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
