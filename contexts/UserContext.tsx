import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser as useClerkUser } from '@clerk/clerk-expo';
import { UserProfile, AccountType, BusinessInfo, UserDetails, BusinessMembership } from '@/types';
import { saveUserProfile, getUserProfile, updateUserMetadata, aggregateUserTransactions, aggregateBusinessTransactions, updateUserProfileFields } from '@/services/firebase/userService';
import { hasPermission as checkTeamPermission, initializeBusinessOwner } from '@/services/firebase/businessTeamService';

const PROFILE_KEY = '@user_profile';
const IS_NEW_USER_KEY = '@is_new_user';

// Generate a random 5-digit promo code
const generatePromoCode = (): string => {
  const digits = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `UP${digits}`;
};

export const [UserProvider, useUser] = createContextHook(() => {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser();
  const [profile, setProfile] = useState<UserProfile>({
    searchHistory: [],
    promoCode: generatePromoCode(), // Always generate a promo code immediately
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // No longer require values for onboarding
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!clerkUser) {
        console.log('[UserContext] ❌ No clerk user, resetting state');
        if (mounted) {
          setProfile({ searchHistory: [] });
          setHasCompletedOnboarding(true);
          setIsNewUser(null);
          setIsLoading(false);
        }
        return;
      }

      console.log('[UserContext] ====== LOADING PROFILE ======');
      console.log('[UserContext] Clerk User ID:', clerkUser.id);
      console.log('[UserContext] Clerk Email:', clerkUser.primaryEmailAddress?.emailAddress);

      try {
        const storageKey = `${PROFILE_KEY}_${clerkUser.id}`;
        const isNewUserKey = `${IS_NEW_USER_KEY}_${clerkUser.id}`;

        // Check if this is a new user
        const storedIsNewUser = await AsyncStorage.getItem(isNewUserKey);
        const isFirstTime = storedIsNewUser === null;

        console.log('[UserContext] 🔍 AsyncStorage check:');
        console.log('[UserContext]   - isNewUserKey value:', storedIsNewUser);
        console.log('[UserContext]   - isFirstTime:', isFirstTime);

        // Try to load from Firebase first (source of truth)
        console.log('[UserContext] 🔄 Attempting to load from Firebase...');
        let firebaseProfile: UserProfile | null = null;
        try {
          firebaseProfile = await getUserProfile(clerkUser.id);
          if (firebaseProfile) {
            console.log('[UserContext] ✅ Firebase profile found!');
            console.log('[UserContext]   - UserDetails:', !!firebaseProfile.userDetails);
            console.log('[UserContext]   - Promo Code:', firebaseProfile.promoCode);
            console.log('[UserContext]   - hasSeenIntro:', firebaseProfile.hasSeenIntro);
          } else {
            console.log('[UserContext] ⚠️ No Firebase profile found for user - getUserProfile returned null');
          }
        } catch (firebaseError) {
          console.error('[UserContext] ❌ CRITICAL: Failed to load from Firebase!');
          console.error('[UserContext]   Error:', firebaseError);
          console.error('[UserContext]   This means Firebase call threw an exception');
        }

        if (firebaseProfile && mounted) {
          // Firebase has the profile - use it
          console.log('[UserContext] 📥 Using Firebase profile');

          // Ensure promo code exists
          if (!firebaseProfile.promoCode) {
            firebaseProfile.promoCode = generatePromoCode();
            console.log('[UserContext] Generated new promo code:', firebaseProfile.promoCode);
          }

          // Auto-verify organic users: if they don't have isVerified set and are not a celebrity account
          // This ensures all existing organic users get the blue verification badge
          const needsVerification = firebaseProfile.isVerified !== true && firebaseProfile.isCelebrityAccount !== true;
          if (needsVerification) {
            console.log('[UserContext] 🔧 Organic user without verification. Setting isVerified: true...');
            firebaseProfile.isVerified = true;
            try {
              await saveUserProfile(clerkUser.id, firebaseProfile);
              console.log('[UserContext] ✅ User verified in Firebase');
            } catch (error) {
              console.error('[UserContext] ❌ Failed to verify user:', error);
            }
          }

          // Ensure required fields are initialized
          firebaseProfile.id = clerkUser.id;

          setProfile(firebaseProfile);
          setHasCompletedOnboarding(true); // No longer depends on causes

          // Update local cache
          await AsyncStorage.setItem(storageKey, JSON.stringify(firebaseProfile));
        } else {
          // No Firebase profile - check local storage or create new
          console.log('[UserContext] 🔍 No Firebase profile - checking AsyncStorage...');
          const storedProfile = await AsyncStorage.getItem(storageKey);

          if (storedProfile && mounted) {
            const parsedProfile = JSON.parse(storedProfile) as UserProfile;
            console.log('[UserContext] ✅ Loaded profile from AsyncStorage');

            // Generate promo code if it doesn't exist
            if (!parsedProfile.promoCode) {
              parsedProfile.promoCode = generatePromoCode();
              console.log('[UserContext] Generated new promo code:', parsedProfile.promoCode);
            }

            parsedProfile.id = clerkUser.id;

            setProfile(parsedProfile);
            setHasCompletedOnboarding(true);

            // Sync to Firebase
            try {
              await saveUserProfile(clerkUser.id, parsedProfile);
              console.log('[UserContext] ✅ Profile synced to Firebase');
            } catch (syncError) {
              console.error('[UserContext] Failed to sync to Firebase:', syncError);
            }
          } else if (mounted) {
            console.log('[UserContext] ⚠️ CREATING NEW PROFILE (no Firebase, no AsyncStorage)');
            console.log('[UserContext]   - This is a brand new user');
            const newProfile: UserProfile = {
              id: clerkUser.id,
              searchHistory: [],
              promoCode: generatePromoCode(),
            };
            setProfile(newProfile);
            setHasCompletedOnboarding(true);

            // Save to Firebase and local storage
            try {
              await saveUserProfile(clerkUser.id, newProfile);
              console.log('[UserContext] ✅ New profile saved to Firebase');
            } catch (error) {
              console.error('[UserContext] Failed to save new profile:', error);
            }
            await AsyncStorage.setItem(storageKey, JSON.stringify(newProfile));
          }
        }

        if (mounted) {
          if (isFirstTime) {
            console.log('[UserContext] 🆕 FIRST TIME USER - marking as new (isNewUser = true)');
            setIsNewUser(true);
            // Don't mark as false yet - wait until onboarding is complete
            // await AsyncStorage.setItem(isNewUserKey, 'false');
          } else {
            console.log('[UserContext] 👤 RETURNING USER - marking as existing (isNewUser = false)');
            setIsNewUser(false);
          }
          console.log('[UserContext] ====== PROFILE LOADING COMPLETE ======');
        }
      } catch (error) {
        console.error('[UserContext] Failed to load profile:', error);
        if (mounted) {
          const defaultProfile: UserProfile = {
            id: clerkUser.id,
            searchHistory: [],
            promoCode: generatePromoCode(),
          };
          setProfile(defaultProfile);
          setHasCompletedOnboarding(true);
          setIsNewUser(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [clerkUser]);

  // DEPRECATED: addCauses, removeCauses, toggleCauseType removed - values no longer associated with users

  const addToSearchHistory = useCallback(async (query: string) => {
    if (!clerkUser) {
      console.error('[UserContext] Cannot save search history: User not logged in');
      return;
    }
    const newHistory = [query, ...profile.searchHistory.filter(q => q !== query)].slice(0, 10);
    const newProfile = { ...profile, searchHistory: newHistory };
    setProfile(newProfile);

    try {
      const storageKey = `${PROFILE_KEY}_${clerkUser.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(newProfile));
      await saveUserProfile(clerkUser.id, newProfile);
    } catch (error) {
      console.error('[UserContext] Failed to save search history:', error);
    }
  }, [profile, clerkUser]);

  const resetProfile = useCallback(async () => {
    if (!clerkUser) {
      console.error('[UserContext] Cannot reset profile: User not logged in');
      return;
    }
    try {
      const emptyProfile: UserProfile = {
        id: clerkUser.id,
        searchHistory: [],
        promoCode: profile.promoCode || generatePromoCode(),
      };
      setProfile(emptyProfile);
      const storageKey = `${PROFILE_KEY}_${clerkUser.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(emptyProfile));
      await saveUserProfile(clerkUser.id, emptyProfile);
      console.log('[UserContext] ✅ Profile reset and synced to Firebase');
    } catch (error) {
      console.error('[UserContext] ❌ Failed to reset profile:', error);
    }
  }, [clerkUser, profile.promoCode]);

  const clearAllStoredData = useCallback(async () => {
    try {
      console.log('[UserContext] Clearing ALL AsyncStorage data');
      await AsyncStorage.clear();
      setProfile({
        searchHistory: [],
        promoCode: generatePromoCode(),
      });
      console.log('[UserContext] All data cleared successfully');
    } catch (error) {
      console.error('[UserContext] Failed to clear all data:', error);
    }
  }, []);

  const setAccountType = useCallback(async (accountType: AccountType) => {
    if (!clerkUser) {
      console.error('[UserContext] Cannot set account type: User not logged in');
      return;
    }

    console.log('[UserContext] Setting account type to:', accountType);

    let newProfile: UserProfile | null = null;
    setProfile((prevProfile) => {
      newProfile = { ...prevProfile, accountType };
      return newProfile;
    });

    if (!newProfile) return;

    try {
      const storageKey = `${PROFILE_KEY}_${clerkUser.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(newProfile));
      await saveUserProfile(clerkUser.id, newProfile);
      console.log('[UserContext] ✅ Account type saved and synced to Firebase');
    } catch (error) {
      console.error('[UserContext] ❌ Failed to save account type:', error);
    }
  }, [clerkUser]);

  const setBusinessInfo = useCallback(async (businessInfo: Partial<BusinessInfo>) => {
    if (!clerkUser) {
      console.error('[UserContext] Cannot set business info: User not logged in');
      return;
    }

    console.log('[UserContext] Updating business info');

    const isFirstTimeSetup = !profile.businessInfo;

    let newProfile: UserProfile | null = null;
    setProfile((prevProfile) => {
      newProfile = {
        ...prevProfile,
        businessInfo: {
          ...prevProfile.businessInfo,
          ...businessInfo,
        } as BusinessInfo,
      };
      return newProfile;
    });

    if (!newProfile) return;

    try {
      const storageKey = `${PROFILE_KEY}_${clerkUser.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(newProfile));
      await saveUserProfile(clerkUser.id, newProfile);
      console.log('[UserContext] ✅ Business info saved and synced to Firebase');

      // Initialize owner as team member on first setup (Phase 0)
      if (isFirstTimeSetup && businessInfo.name) {
        const email = clerkUser.primaryEmailAddress?.emailAddress || '';
        await initializeBusinessOwner(clerkUser.id, businessInfo.name, email);
        console.log('[UserContext] ✅ Business owner initialized in team');
      }
    } catch (error) {
      console.error('[UserContext] ❌ Failed to save business info:', error);
    }
  }, [clerkUser, profile.businessInfo]);

  const setUserDetails = useCallback(async (userDetails: Partial<UserDetails>) => {
    if (!clerkUser) {
      console.error('[UserContext] Cannot set user details: User not logged in');
      return;
    }

    console.log('[UserContext] Updating user details:', JSON.stringify(userDetails, null, 2));

    let newProfile: UserProfile | null = null;
    setProfile((prevProfile) => {
      newProfile = {
        ...prevProfile,
        userDetails: {
          ...prevProfile.userDetails,
          ...userDetails,
        } as UserDetails,
      };
      return newProfile;
    });

    if (!newProfile) return;

    try {
      const storageKey = `${PROFILE_KEY}_${clerkUser.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(newProfile));
      await saveUserProfile(clerkUser.id, newProfile);
      console.log('[UserContext] ✅ User details saved to profile');

      // Also update top-level user metadata in Firebase
      const metadata: any = {};

      // Extract name and location to top-level fields
      if (userDetails.name) {
        // Split name into first/last if possible
        const nameParts = userDetails.name.trim().split(' ');
        if (nameParts.length > 1) {
          metadata.firstName = nameParts[0];
          metadata.lastName = nameParts.slice(1).join(' ');
          metadata.fullName = userDetails.name.trim();
        } else {
          metadata.firstName = userDetails.name.trim();
          metadata.fullName = userDetails.name.trim();
        }
      }

      if (userDetails.location || userDetails.latitude) {
        metadata.location = {
          city: userDetails.location,
          ...(userDetails.latitude && userDetails.longitude ? {
            coordinates: {
              latitude: userDetails.latitude,
              longitude: userDetails.longitude,
            }
          } : {})
        };
      }

      if (Object.keys(metadata).length > 0) {
        await updateUserMetadata(clerkUser.id, metadata);
        console.log('[UserContext] ✅ User metadata updated in Firebase');
      }
    } catch (error) {
      console.error('[UserContext] ❌ Failed to save user details:', error);
    }
  }, [clerkUser]);

  const refreshTransactionTotals = useCallback(async () => {
    if (!clerkUser) {
      console.error('[UserContext] Cannot refresh transactions: User not logged in');
      return;
    }

    try {
      console.log('[UserContext] 🔄 Refreshing transaction totals for user:', clerkUser.id);

      const isBusiness = profile.accountType === 'business';

      if (isBusiness) {
        // For business accounts, aggregate business transactions
        const businessMetrics = await aggregateBusinessTransactions(clerkUser.id);

        // Update business info with total donated
        const updatedBusinessInfo = {
          ...profile.businessInfo,
          totalDonated: businessMetrics.totalDonated,
        };

        const newProfile = { ...profile, businessInfo: updatedBusinessInfo };
        setProfile(newProfile);

        // Save to Firebase
        await saveUserProfile(clerkUser.id, newProfile);
        console.log('[UserContext] ✅ Business transaction totals refreshed:', businessMetrics);
      } else {
        // For individual accounts, aggregate user transactions
        const { totalSavings } = await aggregateUserTransactions(clerkUser.id);

        const newProfile = {
          ...profile,
          totalSavings,
        };
        setProfile(newProfile);

        // Save to Firebase
        await saveUserProfile(clerkUser.id, newProfile);
        console.log('[UserContext] ✅ User transaction totals refreshed:', { totalSavings });
      }
    } catch (error) {
      console.error('[UserContext] ❌ Failed to refresh transaction totals:', error);
    }
  }, [clerkUser, profile]);

  // Team Management (Phase 0)
  const hasPermission = useCallback(async (permission: 'viewData' | 'editMoney' | 'confirmTransactions'): Promise<boolean> => {
    if (!clerkUser) return false;

    // If user is the business owner, they have all permissions
    if (profile.accountType === 'business' && profile.businessInfo) {
      return true;
    }

    // If user is a team member, check their permissions
    if (profile.businessMembership) {
      return await checkTeamPermission(clerkUser.id, permission);
    }

    return false;
  }, [clerkUser, profile]);

  const getBusinessId = useCallback((): string | null => {
    // If they own a business
    if (profile.accountType === 'business' && clerkUser) {
      return clerkUser.id;
    }

    // If they're a team member
    if (profile.businessMembership) {
      return profile.businessMembership.businessId;
    }

    return null;
  }, [profile, clerkUser]);

  const isBusinessOwner = useCallback((): boolean => {
    return profile.accountType === 'business' && !!profile.businessInfo;
  }, [profile]);

  const isTeamMember = useCallback((): boolean => {
    return !!profile.businessMembership && profile.businessMembership.role === 'team';
  }, [profile]);

  const markIntroAsSeen = useCallback(async () => {
    if (!clerkUser) return;

    try {
      // Only update hasSeenIntro field - don't spread the entire profile
      // This prevents overwriting causes/values with empty arrays before profile loads
      setProfile(prev => ({ ...prev, hasSeenIntro: true }));
      await updateUserProfileFields(clerkUser.id, { hasSeenIntro: true });
      console.log('[UserContext] ✅ Marked intro as seen (safe update)');
    } catch (error) {
      console.error('[UserContext] ❌ Failed to mark intro as seen:', error);
    }
  }, [clerkUser]);

  return useMemo(() => ({
    profile,
    isLoading: isLoading || !isClerkLoaded,
    hasCompletedOnboarding,
    isNewUser,
    addToSearchHistory,
    resetProfile,
    clearAllStoredData,
    isDarkMode,
    clerkUser,
    setAccountType,
    setBusinessInfo,
    setUserDetails,
    refreshTransactionTotals,
    // Team Management (Phase 0)
    hasPermission,
    getBusinessId,
    isBusinessOwner,
    isTeamMember,
    markIntroAsSeen,
  }), [profile, isLoading, isClerkLoaded, hasCompletedOnboarding, isNewUser, addToSearchHistory, resetProfile, clearAllStoredData, isDarkMode, clerkUser, setAccountType, setBusinessInfo, setUserDetails, refreshTransactionTotals, hasPermission, getBusinessId, isBusinessOwner, isTeamMember, markIntroAsSeen]);
});
