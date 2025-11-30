import { Tabs, useSegments, useRouter } from "expo-router";
import { BookOpen, DollarSign, Heart, Compass, User, Home } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Platform, useWindowDimensions, StyleSheet, StatusBar, View, Text, ActivityIndicator } from "react-native";
import { lightColors, darkColors } from "@/constants/colors";
import { useUser } from "@/contexts/UserContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsStandalone } from "@/hooks/useIsStandalone";
import { getClaimsByUser } from "@/services/firebase/businessClaimService";

export default function TabLayout() {
  const router = useRouter();
  const isStandalone = useIsStandalone();
  const { isDarkMode, profile, clerkUser, isLoading: isProfileLoading } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isCheckingBusinessClaims, setIsCheckingBusinessClaims] = useState(true);
  const [hasBusinessClaim, setHasBusinessClaim] = useState(false);

  // Check if business user has submitted a claim
  useEffect(() => {
    const checkBusinessClaims = async () => {
      // Only check for business accounts
      if (profile?.accountType !== 'business' || !clerkUser?.id) {
        setIsCheckingBusinessClaims(false);
        return;
      }

      try {
        const claims = await getClaimsByUser(clerkUser.id);
        setHasBusinessClaim(claims.length > 0);

        // If no claims, redirect to business-setup
        if (claims.length === 0) {
          console.log('[TabLayout] Business user has no claims, redirecting to business-setup');
          router.replace('/business-setup');
        }
      } catch (error) {
        console.error('[TabLayout] Error checking business claims:', error);
      } finally {
        setIsCheckingBusinessClaims(false);
      }
    };

    if (!isProfileLoading && clerkUser?.id) {
      checkBusinessClaims();
    }
  }, [profile?.accountType, clerkUser?.id, isProfileLoading]);

  const isTabletOrLarger = Platform.OS === 'web' && width >= 768;
  const tabBarHeight = isTabletOrLarger ? 64 : 64;

  // Show loading while checking business claims
  if (isProfileLoading || (profile?.accountType === 'business' && isCheckingBusinessClaims)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // On web (PWA or regular browser), don't use SafeAreaView edges - let browser/CSS handle it
  // On native mobile, use top and bottom safe areas normally
  const topInset = Platform.OS === 'web' ? 0 : (insets.top || 0);
  const bottomInset = (isStandalone && Platform.OS === 'web') ? 0 : (insets.bottom || 0);

  // helper to render icon + label beside it on wide screens
  const renderTabIconWithLabel = (Icon: React.ComponentType<any>, label: string, focusedColor: string) => {
    return ({ color, focused }: { color: string; focused?: boolean }) => {
      const active = Boolean(focused);
      if (isTabletOrLarger) {
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon size={22} color={active ? focusedColor : color} strokeWidth={2} />
            <Text style={{
              marginLeft: 8,
              fontSize: 13,
              fontWeight: active ? '700' : '600',
              color: active ? focusedColor : color,
            }}>
              {label}
            </Text>
          </View>
        );
      }
      // mobile: icon only
      return <Icon size={22} color={color} strokeWidth={2} />;
    };
  };

  // On web, don't use SafeAreaView edges (no safe area padding)
  // On native mobile, use both top and bottom edges
  const safeAreaEdges = Platform.OS === 'web' ? [] : ['top', 'bottom'] as const;

  return (
    <SafeAreaView edges={safeAreaEdges} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        // On web, make translucent so content bleeds under status bar
        // On native mobile, keep false to avoid issues
        translucent={Platform.OS === 'web'}
        backgroundColor={colors.background}
      />

      {/* Center and constrain the app content on wide screens so nothing stretches beyond 50% of the viewport */}
      <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background }}>
        {/* Ensure this inner container fills vertical space so Tabs layout behaves correctly */}
        <View style={{ width: '100%', maxWidth: isTabletOrLarger ? '50%' : 768, flex: 1, backgroundColor: colors.background }}>
          <Tabs
            screenOptions={{
              tabBarActiveTintColor: colors.primary,
              headerShown: false,
              tabBarPosition: isTabletOrLarger ? 'top' : 'bottom',
              // we'll render our own label next to icons on wide screens
              tabBarShowLabel: false,
              tabBarStyle: {
                position: isTabletOrLarger ? 'relative' : 'absolute',
                top: isTabletOrLarger ? 0 : undefined,
                bottom: isTabletOrLarger ? undefined : 0,
                left: 0,
                right: 0,
                height: tabBarHeight,
                // Remove bottom padding on web to eliminate gap
                paddingBottom: isTabletOrLarger ? 0 : (Platform.OS === 'web' ? 0 : 4),
                paddingTop: isTabletOrLarger ? 0 : 12,
                borderTopWidth: isTabletOrLarger ? 0 : 1,
                borderBottomWidth: 0,
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
                backgroundColor: colors.background,
                zIndex: isTabletOrLarger ? 10 : undefined,
                elevation: isTabletOrLarger ? 10 : undefined,
              },
              tabBarItemStyle: {
                paddingTop: isTabletOrLarger ? 0 : 4,
                // Remove bottom padding on web
                paddingBottom: isTabletOrLarger ? 0 : (Platform.OS === 'web' ? 0 : 12),
              },
              contentStyle: {
                // Reserve space for the top tab bar + system top inset on wide screens,
                // and reserve space for the bottom tab bar + bottom inset on mobile.
                paddingTop: isTabletOrLarger ? (tabBarHeight + topInset) : topInset,
                // In PWA standalone, use less bottom padding to eliminate excess space
                paddingBottom: isTabletOrLarger ? bottomInset :
                  (isStandalone && Platform.OS === 'web' ? tabBarHeight - 12 : (tabBarHeight + bottomInset)),
              },
            }}
          >
            <Tabs.Screen
              name="home"
              options={{
                title: "List",
                tabBarIcon: renderTabIconWithLabel(Home, "List", colors.primary),
              }}
            />
            <Tabs.Screen
              name="values"
              options={{
                title: "Browse",
                tabBarIcon: renderTabIconWithLabel(BookOpen, "Browse", colors.primary),
              }}
            />
            <Tabs.Screen
              name="search"
              options={{
                title: "Explore",
                tabBarIcon: renderTabIconWithLabel(Compass, "Explore", colors.primary),
              }}
            />
            <Tabs.Screen
              name="money"
              options={{
                title: "Money",
                tabBarIcon: renderTabIconWithLabel(DollarSign, "Money", colors.primary),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: "Profile",
                tabBarIcon: renderTabIconWithLabel(User, "Profile", colors.primary),
              }}
            />
          </Tabs>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
