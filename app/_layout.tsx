import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { DataProvider } from "@/contexts/DataContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { trpc, trpcClient } from "@/lib/trpc";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { darkColors, lightColors } from "@/constants/colors";
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

// Platform-specific Stripe imports
let Elements: any;
let stripePromise: any;
let StripeProvider: any;

if (Platform.OS === 'web') {
  // Web: Use @stripe/react-stripe-js
  const { Elements: WebElements } = require('@stripe/react-stripe-js');
  const { loadStripe } = require('@stripe/stripe-js');
  Elements = WebElements;
  stripePromise = loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
} else {
  // Mobile: Use @stripe/stripe-react-native
  const { StripeProvider: NativeStripeProvider } = require('@stripe/stripe-react-native');
  StripeProvider = NativeStripeProvider;
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const createTokenCache = () => {
  if (Platform.OS === 'web') {
    return {
      async getToken(key: string) {
        try {
          return localStorage.getItem(key);
        } catch (err) {
          console.error("Error getting token:", err);
          return null;
        }
      },
      async saveToken(key: string, value: string) {
        try {
          if (value) {
            localStorage.setItem(key, value);
          } else {
            localStorage.removeItem(key);
          }
        } catch (err) {
          console.error("Error saving token:", err);
        }
      },
    };
  }
  
  return {
    async getToken(key: string) {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (err) {
        console.error("Error getting token:", err);
        return null;
      }
    },
    async saveToken(key: string, value: string) {
      try {
        if (value) {
          return await SecureStore.setItemAsync(key, value);
        } else {
          return await SecureStore.deleteItemAsync(key);
        }
      } catch (err) {
        console.error("Error saving token:", err);
      }
    },
  };
};

const tokenCache = createTokenCache();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_c2F2ZWQtbWFsYW11dGUtOTkuY2xlcmsuYWNjb3VudHMuZGV2JA";

if (!publishableKey) {
  throw new Error(
    "Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file"
  );
}

function RootLayoutNav() {
  const { isDarkMode, clerkUser, profile } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  // One-time celebrity batch import (checks flag to prevent re-running)
  useEffect(() => {
    const runCelebrityImport = async () => {
      try {
        const { runCelebrityBatch1Import } = await import('@/services/firebase/celebrityService');
        const result = await runCelebrityBatch1Import();
        if (!result.alreadyImported && result.success) {
          console.log(`[RootLayout] Celebrity batch imported: ${result.results?.successful} created, ${result.results?.failed} failed`);
        }
      } catch (error) {
        console.error('[RootLayout] Celebrity import error:', error);
      }
    };
    runCelebrityImport();
  }, []);

  // Construct userName for endorsement list creation
  const fullNameFromFirebase = profile?.userDetails?.name;
  const fullNameFromClerk = clerkUser?.unsafeMetadata?.fullName as string;
  const firstNameLastName = clerkUser?.firstName && clerkUser?.lastName
    ? `${clerkUser.firstName} ${clerkUser.lastName}`
    : '';
  const firstName = clerkUser?.firstName;
  const userName = fullNameFromFirebase || fullNameFromClerk || firstNameLastName || firstName || 'My Endorsements';

  return (
    <LibraryProvider userId={clerkUser?.id} userName={userName} autoLoad={true}>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
          },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="business-setup" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="value/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="customer-discount" options={{ headerShown: false }} />
        <Stack.Screen name="merchant/verify" options={{ headerShown: false }} />
        <Stack.Screen name="place/[id]" options={{ headerShown: false }} />
      </Stack>
    </LibraryProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Platform-specific Stripe wrapper
  const StripeWrapper = ({ children }: { children: React.ReactNode }) => {
    if (Platform.OS === 'web') {
      // Web: Use Elements provider
      return <Elements stripe={stripePromise}>{children}</Elements>;
    } else {
      // Mobile: Use StripeProvider
      return (
        <StripeProvider
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
          merchantIdentifier="merchant.com.stand.app"
        >
          {children}
        </StripeProvider>
      );
    }
  };

  return (
    <StripeWrapper>
      <SafeAreaProvider>
        <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
          <ClerkLoaded>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
              <QueryClientProvider client={queryClient}>
                <UserProvider>
                  <DataProvider>
                    <GestureHandlerRootView>
                      <RootLayoutNav />
                    </GestureHandlerRootView>
                  </DataProvider>
                </UserProvider>
              </QueryClientProvider>
            </trpc.Provider>
          </ClerkLoaded>
        </ClerkProvider>
      </SafeAreaProvider>
    </StripeWrapper>
  );
}
