/**
 * Claim Account Page
 *
 * Allows users to claim a celebrity/prominent user account using a claim token.
 * The user must sign up or sign in first, then their Clerk account will be
 * linked to the celebrity profile.
 */

import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle, AlertCircle, User, Award } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useUser as useClerkUser, useAuth, SignedIn, SignedOut } from '@clerk/clerk-expo';
import { getClaimInfo, claimCelebrityAccount } from '@/services/firebase/celebrityService';
import VerificationBadge from '@/components/VerificationBadge';

export default function ClaimAccountPage() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const { width: windowWidth } = useWindowDimensions();
  const { user: clerkUser } = useClerkUser();
  const { isSignedIn } = useAuth();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;
  const contentMaxWidth = isLargeScreen ? 500 : undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimInfo, setClaimInfo] = useState<{
    name?: string;
    profileImage?: string;
    endorsementCount?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  // Load claim info on mount
  useEffect(() => {
    const loadClaimInfo = async () => {
      if (!token) {
        setError('Invalid claim link');
        setIsLoading(false);
        return;
      }

      try {
        const result = await getClaimInfo(token);
        if (result.success) {
          setClaimInfo({
            name: result.name,
            profileImage: result.profileImage,
            endorsementCount: result.endorsementCount,
          });
        } else {
          setError(result.error || 'Invalid or expired claim link');
        }
      } catch (err) {
        console.error('[ClaimAccount] Error loading claim info:', err);
        setError('Failed to load claim information');
      } finally {
        setIsLoading(false);
      }
    };

    loadClaimInfo();
  }, [token]);

  // Handle claim button press
  const handleClaim = async () => {
    if (!token || !clerkUser?.id || !clerkUser?.primaryEmailAddress?.emailAddress) {
      setError('You must be signed in to claim this account');
      return;
    }

    setIsClaiming(true);
    try {
      const result = await claimCelebrityAccount(
        token,
        clerkUser.id,
        clerkUser.primaryEmailAddress.emailAddress
      );

      if (result.success) {
        setClaimed(true);
      } else {
        setError(result.error || 'Failed to claim account');
      }
    } catch (err) {
      console.error('[ClaimAccount] Error claiming account:', err);
      setError('Failed to claim account. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Navigate to sign in
  const handleSignIn = () => {
    // Store the claim token so we can return after sign in
    router.push('/sign-in');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Claim Account</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading claim information...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={64} color="#EF4444" />
            <Text style={[styles.errorTitle, { color: colors.text }]}>
              Unable to Claim
            </Text>
            <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/')}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Go Home</Text>
            </TouchableOpacity>
          </View>
        ) : claimed ? (
          <View style={styles.successContainer}>
            <CheckCircle size={64} color="#10B981" />
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Account Claimed!
            </Text>
            <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
              You have successfully claimed the {claimInfo?.name} account.
              Your endorsement list and profile have been transferred.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>View Your Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.claimContainer}>
            {/* Profile Preview */}
            <View style={[styles.profileCard, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.profileImageContainer}>
                {claimInfo?.profileImage ? (
                  <Image
                    source={{ uri: claimInfo.profileImage }}
                    style={styles.profileImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.border }]}>
                    <User size={48} color={colors.textSecondary} />
                  </View>
                )}
              </View>

              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.profileName, { color: colors.text }]}>
                    {claimInfo?.name || 'Unknown'}
                  </Text>
                  <VerificationBadge type="celebrity" isDarkMode={isDarkMode} size="medium" />
                </View>

                <View style={styles.endorsementRow}>
                  <Award size={16} color={colors.primary} />
                  <Text style={[styles.endorsementText, { color: colors.textSecondary }]}>
                    {claimInfo?.endorsementCount || 0} endorsements
                  </Text>
                </View>
              </View>
            </View>

            {/* Claim Info */}
            <Text style={[styles.claimTitle, { color: colors.text }]}>
              Claim This Profile
            </Text>
            <Text style={[styles.claimDescription, { color: colors.textSecondary }]}>
              You've been invited to claim the {claimInfo?.name} profile on iEndorse.
              By claiming this profile, you'll take ownership of this account and its endorsement list.
            </Text>

            {/* Action Button */}
            <SignedIn>
              <View style={styles.signedInInfo}>
                <Text style={[styles.signedInText, { color: colors.textSecondary }]}>
                  Signed in as: {clerkUser?.primaryEmailAddress?.emailAddress}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleClaim}
                disabled={isClaiming}
                activeOpacity={0.7}
              >
                {isClaiming ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Claim Account</Text>
                )}
              </TouchableOpacity>
            </SignedIn>

            <SignedOut>
              <Text style={[styles.signInPrompt, { color: colors.textSecondary }]}>
                You need to sign in or create an account to claim this profile.
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleSignIn}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Sign In to Claim</Text>
              </TouchableOpacity>
            </SignedOut>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  claimContainer: {
    flex: 1,
    gap: 24,
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    alignItems: 'center',
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
  },
  endorsementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endorsementText: {
    fontSize: 14,
  },
  claimTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  claimDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  signedInInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  signedInText: {
    fontSize: 14,
  },
  signInPrompt: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
