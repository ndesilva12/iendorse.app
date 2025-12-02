import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { UserProfile, Cause, Charity, AccountType, BusinessInfo, UserDetails } from '@/types';

// Helper function to remove undefined fields from an object
function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Record<string, any> = {};

  for (const key in obj) {
    if (obj[key] !== undefined) {
      // Recursively clean arrays of objects
      if (Array.isArray(obj[key])) {
        cleaned[key] = obj[key].map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            return removeUndefinedFields(item);
          }
          return item;
        });
      }
      // Recursively clean nested objects
      else if (typeof obj[key] === 'object' && obj[key] !== null) {
        cleaned[key] = removeUndefinedFields(obj[key]);
      } else {
        cleaned[key] = obj[key];
      }
    }
  }

  return cleaned as Partial<T>;
}

// Clean user profile to ensure no undefined fields
function cleanUserProfile(profile: UserProfile): Partial<UserProfile> {
  // Use removeUndefinedFields to recursively clean everything
  const cleaned = removeUndefinedFields({
    causes: profile.causes || [],
    searchHistory: profile.searchHistory || [],
    donationAmount: profile.donationAmount ?? 0,
    totalSavings: profile.totalSavings ?? 0,
    selectedCharities: profile.selectedCharities || [],
    ...(profile.promoCode !== undefined && { promoCode: profile.promoCode }),
    ...(profile.accountType !== undefined && { accountType: profile.accountType }),
    ...(profile.businessInfo !== undefined && { businessInfo: profile.businessInfo }),
    ...(profile.userDetails !== undefined && { userDetails: profile.userDetails }),
    ...(profile.codeSharing !== undefined && { codeSharing: profile.codeSharing }),
    ...(profile.consentGivenAt !== undefined && { consentGivenAt: profile.consentGivenAt }),
    ...(profile.consentVersion !== undefined && { consentVersion: profile.consentVersion }),
    ...(profile.isPublicProfile !== undefined && { isPublicProfile: profile.isPublicProfile }),
    ...(profile.alignedListPublic !== undefined && { alignedListPublic: profile.alignedListPublic }),
    ...(profile.unalignedListPublic !== undefined && { unalignedListPublic: profile.unalignedListPublic }),
    ...(profile.isVerified !== undefined && { isVerified: profile.isVerified }),
    ...(profile.isCelebrityAccount !== undefined && { isCelebrityAccount: profile.isCelebrityAccount }),
  });

  console.log('[Firebase cleanUserProfile] Cleaned profile:', JSON.stringify(cleaned, null, 2));

  return cleaned as Partial<UserProfile>;
}

/**
 * Save user profile to Firebase Firestore
 * @param userId - The Clerk user ID
 * @param profile - The user profile data
 */
export async function saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
  try {
    console.log('[Firebase] 🔄 Saving profile for user:', userId);
    console.log('[Firebase] Profile data:', JSON.stringify(profile, null, 2));

    // Auto-verify organic users: set isVerified: true for non-celebrity accounts
    // This ensures all organic users get the blue verification badge
    if (profile.isCelebrityAccount !== true && profile.isVerified !== true) {
      profile.isVerified = true;
      console.log('[Firebase] 🔧 Auto-setting isVerified: true for organic user');
    }

    // Clean the profile to remove any undefined fields
    const cleanedProfile = cleanUserProfile(profile);
    console.log('[Firebase] Cleaned profile:', JSON.stringify(cleanedProfile, null, 2));

    const userRef = doc(db, 'users', userId);
    const dataToSave = {
      ...cleanedProfile,
      updatedAt: serverTimestamp(),
    };

    console.log('[Firebase] About to call setDoc with merge:true for user:', userId);
    await setDoc(userRef, dataToSave, { merge: true });
    console.log('[Firebase] ✅ setDoc completed successfully');

    // Verify the save by reading back
    const savedDoc = await getDoc(userRef);
    if (savedDoc.exists()) {
      console.log('[Firebase] ✅ Verified - document exists with data:', JSON.stringify(savedDoc.data(), null, 2));
    } else {
      console.error('[Firebase] ⚠️ Document does not exist after save!');
    }
  } catch (error) {
    console.error('[Firebase] ❌ Error saving profile:', error);
    if (error instanceof Error) {
      console.error('[Firebase] Error code:', (error as any).code);
      console.error('[Firebase] Error message:', error.message);
      console.error('[Firebase] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Update specific user profile fields without overwriting other data
 * This is safe to call even before the full profile is loaded
 * @param userId - The Clerk user ID
 * @param fields - Only the fields to update
 */
export async function updateUserProfileFields(
  userId: string,
  fields: Partial<UserProfile>
): Promise<void> {
  try {
    console.log('[Firebase] 🔄 Updating specific fields for user:', userId);
    console.log('[Firebase] Fields to update:', JSON.stringify(fields, null, 2));

    const userRef = doc(db, 'users', userId);

    // Only update the specified fields + updatedAt timestamp
    const dataToUpdate = {
      ...fields,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(userRef, dataToUpdate);
    console.log('[Firebase] ✅ updateDoc completed successfully');
  } catch (error) {
    console.error('[Firebase] ❌ Error updating profile fields:', error);
    throw error;
  }
}

/**
 * Update user metadata (email, name, location, etc.)
 * @param userId - The Clerk user ID
 * @param metadata - User metadata to update
 */
export async function updateUserMetadata(
  userId: string,
  metadata: {
    email?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    imageUrl?: string;
    location?: {
      city?: string;
      state?: string;
      country?: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
  }
): Promise<void> {
  try {
    console.log('[Firebase] Updating user metadata for:', userId);

    const userRef = doc(db, 'users', userId);

    // Build update object with only defined fields
    const updateData: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (metadata.email !== undefined) updateData.email = metadata.email;
    if (metadata.firstName !== undefined) updateData.firstName = metadata.firstName;
    if (metadata.lastName !== undefined) updateData.lastName = metadata.lastName;
    if (metadata.fullName !== undefined) {
      updateData.fullName = metadata.fullName;
      // Also store as 'name' for backward compatibility
      updateData.name = metadata.fullName;
    }
    if (metadata.imageUrl !== undefined) updateData.imageUrl = metadata.imageUrl;
    if (metadata.location !== undefined) {
      updateData.location = removeUndefinedFields(metadata.location);
    }

    // If we have firstName and lastName but no fullName was provided, create name from them
    if (metadata.fullName === undefined && metadata.firstName && metadata.lastName) {
      const fullName = `${metadata.firstName} ${metadata.lastName}`;
      updateData.fullName = fullName;
      updateData.name = fullName;
    }

    await setDoc(userRef, updateData, { merge: true });

    console.log('[Firebase] ✅ User metadata updated successfully');
  } catch (error) {
    console.error('[Firebase] ❌ Error updating user metadata:', error);
    throw error;
  }
}

/**
 * Get user profile from Firebase Firestore
 * @param userId - The Clerk user ID
 * @returns The user profile or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    console.log('[Firebase getUserProfile] 🔄 Fetching profile for user:', userId);

    if (!db) {
      console.error('[Firebase getUserProfile] ❌ db is null or undefined!');
      throw new Error('Firebase db not initialized');
    }

    const userRef = doc(db, 'users', userId);
    console.log('[Firebase getUserProfile] 📍 Document reference created');

    const userSnap = await getDoc(userRef);
    console.log('[Firebase getUserProfile] 📦 Document snapshot received, exists:', userSnap.exists());

    if (userSnap.exists()) {
      const data = userSnap.data();
      console.log('[Firebase getUserProfile] ✅ Document data:', JSON.stringify(data, null, 2));

      // Ensure required fields have defaults
      const profile = {
        causes: data.causes || [],
        searchHistory: data.searchHistory || [],
        promoCode: data.promoCode,
        donationAmount: data.donationAmount ?? 0,
        totalSavings: data.totalSavings ?? 0,
        selectedCharities: data.selectedCharities || [],
        accountType: data.accountType,
        businessInfo: data.businessInfo,
        userDetails: data.userDetails,
        codeSharing: data.codeSharing ?? true, // Default to true if not set
        consentGivenAt: data.consentGivenAt,
        consentVersion: data.consentVersion,
      };

      console.log('[Firebase getUserProfile] 📤 Returning profile with', profile.causes.length, 'causes');
      return profile;
    } else {
      console.log('[Firebase getUserProfile] ⚠️ No document found for user:', userId);
      return null;
    }
  } catch (error) {
    console.error('[Firebase getUserProfile] ❌ Error fetching profile:', error);
    if (error instanceof Error) {
      console.error('[Firebase getUserProfile] Error message:', error.message);
      console.error('[Firebase getUserProfile] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Create a new user in Firebase Firestore
 * @param userId - The Clerk user ID
 * @param userData - User data including email, name, referral source, etc.
 * @param initialProfile - Initial profile data (optional)
 */
export async function createUser(
  userId: string,
  userData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    imageUrl?: string;
    referralSource?: string; // Track which QR code/location the user signed up from
  },
  initialProfile?: Partial<UserProfile>
): Promise<void> {
  try {
    console.log('[Firebase] Creating new user:', userId);

    const userRef = doc(db, 'users', userId);

    // Default profile with no undefined fields
    const defaultProfile: UserProfile = {
      causes: [],
      searchHistory: [],
      donationAmount: 0,
      selectedCharities: [],
      isPublicProfile: true, // Default to public profile
      alignedListPublic: true, // Default aligned list to public
      unalignedListPublic: true, // Default unaligned list to public
    };

    const profile = { ...defaultProfile, ...initialProfile };
    const cleanedProfile = cleanUserProfile(profile);

    // Build user document with only defined fields
    const userDoc: Record<string, any> = {
      ...cleanedProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add user data fields only if they're defined
    if (userData.email) userDoc.email = userData.email;
    if (userData.firstName) userDoc.firstName = userData.firstName;
    if (userData.lastName) userDoc.lastName = userData.lastName;
    if (userData.fullName) {
      userDoc.fullName = userData.fullName;
      // Also save to userDetails.name for individual accounts
      if (!userDoc.accountType || userDoc.accountType === 'individual') {
        if (!userDoc.userDetails) {
          userDoc.userDetails = {};
        }
        userDoc.userDetails.name = userData.fullName;
      }
    }
    if (userData.imageUrl) userDoc.imageUrl = userData.imageUrl;
    if (userData.referralSource) userDoc.referralSource = userData.referralSource; // QR code/location tracking

    await setDoc(userRef, userDoc);

    console.log('[Firebase] ✅ User created successfully');
  } catch (error) {
    console.error('[Firebase] ❌ Error creating user:', error);
    throw error;
  }
}

/**
 * Aggregate transaction data for a user
 * @param userId - The Clerk user ID
 * @returns Object with totalSavings and totalDonations
 */
export async function aggregateUserTransactions(userId: string): Promise<{
  totalSavings: number;
  totalDonations: number;
}> {
  try {
    console.log('[Firebase] Aggregating transactions for user:', userId);

    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('customerId', '==', userId), where('status', '==', 'completed'));

    const querySnapshot = await getDocs(q);

    let totalSavings = 0;
    let totalDonations = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      totalSavings += data.discountAmount || 0;
      totalDonations += data.donationAmount || 0;
    });

    console.log('[Firebase] ✅ Aggregated transactions:', {
      totalSavings,
      totalDonations,
      transactionCount: querySnapshot.size
    });

    return { totalSavings, totalDonations };
  } catch (error) {
    console.error('[Firebase] ❌ Error aggregating transactions:', error);
    throw error;
  }
}

/**
 * Aggregate transaction data for a business
 * @param businessId - The Clerk user ID of the business
 * @returns Object with business metrics
 */
export async function aggregateBusinessTransactions(businessId: string): Promise<{
  totalDonated: number;
  totalDiscountGiven: number;
  transactionCount: number;
  totalRevenue: number;
}> {
  try {
    console.log('[Firebase] Aggregating business transactions for:', businessId);

    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('merchantId', '==', businessId), where('status', '==', 'completed'));

    const querySnapshot = await getDocs(q);

    let totalDonated = 0;
    let totalDiscountGiven = 0;
    let totalRevenue = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      totalDonated += data.donationAmount || 0;
      totalDiscountGiven += data.discountAmount || 0;
      totalRevenue += data.purchaseAmount || 0;
    });

    console.log('[Firebase] ✅ Aggregated business transactions:', {
      totalDonated,
      totalDiscountGiven,
      totalRevenue,
      transactionCount: querySnapshot.size
    });

    return {
      totalDonated,
      totalDiscountGiven,
      transactionCount: querySnapshot.size,
      totalRevenue
    };
  } catch (error) {
    console.error('[Firebase] ❌ Error aggregating business transactions:', error);
    throw error;
  }
}

/**
 * Get all public user profiles, sorted by endorsement count (highest first)
 * @returns Array of public user profiles with their IDs, sorted by endorsement count
 */
export async function getAllPublicUsers(): Promise<Array<{ id: string; profile: UserProfile; endorsementCount?: number }>> {
  try {
    console.log('[Firebase] Fetching all public users (excluding business accounts)');

    const usersRef = collection(db, 'users');
    // Only fetch individual accounts with public profiles (exclude business accounts)
    const q = query(
      usersRef,
      where('isPublicProfile', '==', true),
      where('accountType', '==', 'individual')
    );

    const querySnapshot = await getDocs(q);

    const usersWithCounts: Array<{ id: string; profile: UserProfile; endorsementCount: number }> = [];

    // Fetch endorsement counts for each user
    for (const userDoc of querySnapshot.docs) {
      const data = userDoc.data();
      const userId = userDoc.id;

      // Get endorsement list count for this user
      // Check both userLists (regular users) and lists (celebrity accounts) collections
      let endorsementCount = 0;
      try {
        // First check userLists collection (regular users)
        const userListsRef = collection(db, 'userLists');
        const userListQuery = query(
          userListsRef,
          where('userId', '==', userId),
          where('isEndorsed', '==', true)
        );
        const userListSnapshot = await getDocs(userListQuery);
        if (!userListSnapshot.empty) {
          const listData = userListSnapshot.docs[0].data();
          endorsementCount = listData.entries?.length || 0;
        }

        // If no count from userLists, check lists collection (celebrity accounts)
        if (endorsementCount === 0) {
          const listsRef = collection(db, 'lists');
          const listQuery = query(
            listsRef,
            where('userId', '==', userId),
            where('isEndorsed', '==', true)
          );
          const listSnapshot = await getDocs(listQuery);
          if (!listSnapshot.empty) {
            const listData = listSnapshot.docs[0].data();
            endorsementCount = listData.entries?.length || 0;
          }
        }
      } catch (e) {
        console.warn('[Firebase] Could not fetch endorsement count for user', userId);
      }

      const profile: UserProfile = {
        causes: data.causes || [],
        searchHistory: data.searchHistory || [],
        promoCode: data.promoCode,
        donationAmount: data.donationAmount ?? 0,
        totalSavings: data.totalSavings ?? 0,
        selectedCharities: data.selectedCharities || [],
        accountType: data.accountType,
        businessInfo: data.businessInfo,
        userDetails: data.userDetails,
        codeSharing: data.codeSharing ?? true,
        consentGivenAt: data.consentGivenAt,
        consentVersion: data.consentVersion,
        isPublicProfile: data.isPublicProfile,
        alignedListPublic: data.alignedListPublic,
        unalignedListPublic: data.unalignedListPublic,
        isVerified: data.isVerified,
        isCelebrityAccount: data.isCelebrityAccount,
      };

      usersWithCounts.push({ id: userId, profile, endorsementCount });
    }

    // Sort by endorsement count (highest first)
    usersWithCounts.sort((a, b) => b.endorsementCount - a.endorsementCount);

    console.log('[Firebase] ✅ Fetched and sorted', usersWithCounts.length, 'public users by endorsement count');
    return usersWithCounts;
  } catch (error) {
    console.error('[Firebase] ❌ Error fetching public users:', error);
    throw error;
  }
}

/**
 * Make all user profiles public
 * This is an admin function to migrate existing users who don't have isPublicProfile set
 * Also ensures accountType is set to 'individual' for users without a business account
 * @returns Object with counts of updated and already public users
 */
export async function makeAllProfilesPublic(): Promise<{
  totalUsers: number;
  updatedUsers: number;
  alreadyPublic: number;
}> {
  try {
    console.log('[Firebase] Starting profile visibility migration...');

    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    let totalUsers = 0;
    let updatedUsers = 0;
    let alreadyPublic = 0;

    for (const userDoc of usersSnapshot.docs) {
      totalUsers++;
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Check current visibility status
      const currentlyPublic = userData.isPublicProfile === true;
      const hasAccountType = userData.accountType === 'individual' || userData.accountType === 'business';

      if (currentlyPublic && hasAccountType) {
        alreadyPublic++;
        continue;
      }

      // Update user to be public and ensure accountType is set
      const userRef = doc(db, 'users', userId);
      const updates: Record<string, any> = {};

      if (!currentlyPublic) {
        updates.isPublicProfile = true;
      }

      // Set accountType to 'individual' if not already set (and not a business)
      if (!hasAccountType) {
        updates.accountType = 'individual';
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        updatedUsers++;
        const userName = userData.userDetails?.name || userData.fullName || userData.email || 'Unknown';
        console.log(`[Firebase] Updated user ${userId} (${userName}):`, updates);
      }
    }

    console.log('[Firebase] ✅ Migration complete!');
    console.log(`[Firebase] Total: ${totalUsers}, Updated: ${updatedUsers}, Already public: ${alreadyPublic}`);

    return { totalUsers, updatedUsers, alreadyPublic };
  } catch (error) {
    console.error('[Firebase] ❌ Error making profiles public:', error);
    throw error;
  }
}
