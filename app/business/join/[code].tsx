/**
 * Team Invitation Accept Page (Phase 0)
 * This page is accessed when someone clicks an invitation link
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser as useClerkUser } from '@clerk/clerk-expo';
import { Building2, Users, CheckCircle } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { getTeamMemberByInviteCode, acceptTeamInvitation } from '@/services/firebase/businessTeamService';
import { BusinessTeamMember } from '@/types';

export default function JoinTeamPage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isSignedIn } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const { profile, isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  const [isLoading, setIsLoading] = useState(true);
  const [invitation, setInvitation] = useState<BusinessTeamMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load invitation details
  useEffect(() => {
    const loadInvitation = async () => {
      if (!code) {
        setError('Invalid invitation link');
        setIsLoading(false);
        return;
      }

      try {
        const invite = await getTeamMemberByInviteCode(code);
        if (!invite) {
          setError('This invitation is invalid or has expired');
        } else if (invite.status === 'active') {
          setError('This invitation has already been used');
        } else {
          setInvitation(invite);
        }
      } catch (err) {
        console.error('[JoinTeam] Error loading invitation:', err);
        setError('Failed to load invitation details');
      } finally {
        setIsLoading(false);
      }
    };

    loadInvitation();
  }, [code]);

  const handleAcceptInvitation = async () => {
    if (!clerkUser || !invitation) return;

    setIsAccepting(true);
    try {
      const userName = clerkUser.fullName || clerkUser.firstName || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Team Member';
      const userEmail = clerkUser.primaryEmailAddress?.emailAddress || '';

      const membership = await acceptTeamInvitation(
        invitation.inviteCode,
        clerkUser.id,
        userName,
        userEmail
      );

      if (membership) {
        setSuccess(true);
        // Redirect to home after 2 seconds
        setTimeout(() => {
          router.replace('/(tabs)/list');
        }, 2000);
      } else {
        setError('Failed to accept invitation. Please try again.');
      }
    } catch (err) {
      console.error('[JoinTeam] Error accepting invitation:', err);
      setError('Failed to accept invitation. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignIn = () => {
    // Store the invitation code so we can redirect back here after sign-in
    router.push({
      pathname: '/(auth)/sign-in',
      params: { redirect: `/business/join/${code}` },
    });
  };

  const handleSignUp = () => {
    router.push({
      pathname: '/(auth)/sign-up',
      params: { redirect: `/business/join/${code}` },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading invitation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={styles.centered}>
          <View style={[styles.successIcon, { backgroundColor: '#28a745' + '20' }]}>
            <CheckCircle size={64} color="#28a745" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Welcome to the team!</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            You've successfully joined {invitation?.businessId}. Redirecting to home...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={styles.centered}>
          <View style={[styles.errorIcon, { backgroundColor: '#dc3545' + '20' }]}>
            <Building2 size={64} color="#dc3545" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Invitation Error</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, { color: colors.white }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={styles.centered}>
          <View style={[styles.icon, { backgroundColor: colors.primary + '20' }]}>
            <Users size={64} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Join Team</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            You've been invited to join a business team on Endorse Money!
          </Text>
          <Text style={[styles.businessName, { color: colors.text }]}>
            {invitation?.email}
          </Text>
          <Text style={[styles.instructions, { color: colors.textSecondary }]}>
            Sign in or create an account to accept this invitation.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleSignUp}
          >
            <Text style={[styles.buttonText, { color: colors.white }]}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleSignIn}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // User is signed in - show invitation details
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.centered}>
        <View style={[styles.icon, { backgroundColor: colors.primary + '20' }]}>
          <Users size={64} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Team Invitation</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          You've been invited to join:
        </Text>
        <Text style={[styles.businessName, { color: colors.text }]}>
          {invitation?.businessId}
        </Text>
        <Text style={[styles.role, { color: colors.textSecondary }]}>
          Role: Team Member
        </Text>
        <View style={[styles.permissionsBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.permissionsTitle, { color: colors.text }]}>What you'll be able to do:</Text>
          <Text style={[styles.permissionItem, { color: colors.textSecondary }]}>• Confirm customer transactions</Text>
          <Text style={[styles.permissionItem, { color: colors.textSecondary }]}>• Access the Money tab</Text>
          <Text style={[styles.permissionsDivider, { color: colors.textSecondary }]}>───────</Text>
          <Text style={[styles.permissionItem, { color: colors.textSecondary }]}>✗ View customer data</Text>
          <Text style={[styles.permissionItem, { color: colors.textSecondary }]}>✗ Edit business settings</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleAcceptInvitation}
          disabled={isAccepting}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.white }]}>Accept Invitation</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
          disabled={isAccepting}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Decline</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  businessName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  role: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionsBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 400,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  permissionItem: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  permissionsDivider: {
    fontSize: 12,
    marginVertical: 8,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
