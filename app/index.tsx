import { Redirect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useEffect } from 'react';

export default function Index() {
  const { hasCompletedOnboarding, isLoading: userLoading, isDarkMode, isNewUser, profile } = useUser();
  const { isSignedIn, isLoaded } = useAuth();
  const colors = isDarkMode ? darkColors : lightColors;

  useEffect(() => {
    console.log('[Index] ====== RENDER STATE ======');
    console.log('[Index] isLoaded:', isLoaded);
    console.log('[Index] userLoading:', userLoading);
    console.log('[Index] isSignedIn:', isSignedIn);
    console.log('[Index] hasCompletedOnboarding:', hasCompletedOnboarding);
    console.log('[Index] isNewUser:', isNewUser, '(type:', typeof isNewUser, ')');
    console.log('[Index] causeCount:', profile.causes.length);
    console.log('[Index] accountType:', profile.accountType);
    console.log('[Index] promoCode:', profile.promoCode);
    console.log('[Index] ===========================');
  }, [isLoaded, userLoading, isSignedIn, hasCompletedOnboarding, isNewUser, profile.causes.length, profile.accountType, profile.promoCode]);

  useEffect(() => {
    if (isSignedIn && !userLoading && profile.causes.length > 0 && !hasCompletedOnboarding) {
      console.log('[Index] ⚠️ MISMATCH: has causes but hasCompletedOnboarding is false');
    }
  }, [isSignedIn, userLoading, profile.causes.length, hasCompletedOnboarding]);

  if (!isLoaded || userLoading) {
    console.log('[Index] 🔄 Showing loading state');
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    console.log('[Index] ➡️  Redirecting to sign-in (not signed in)');
    return <Redirect href="/(auth)/sign-in" />;
  }

  // If user has completed onboarding OR has causes, go to home
  // This ensures users with causes don't get stuck in onboarding loops
  if (hasCompletedOnboarding || profile.causes.length > 0) {
    console.log('[Index] ✅ User has completed onboarding or has causes, redirecting to home');
    return <Redirect href="/(tabs)/home" />;
  }

  console.log('[Index] 🔍 Checking onboarding flow... isNewUser =', isNewUser);

  if (isNewUser === true) {
    // Account type is now set during sign-up, redirect directly to onboarding
    // Business claim is handled within onboarding flow, not separately
    console.log('[Index] 🆕 NEW USER - Redirecting to onboarding');
    return <Redirect href="/onboarding" />;
  }

  if (isNewUser === null) {
    console.log('[Index] ⏳ isNewUser is null, still loading user state...');
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Loading profile...</Text>
      </View>
    );
  }

  console.log('[Index] 👤 EXISTING USER - No onboarding needed, redirecting to home');
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
