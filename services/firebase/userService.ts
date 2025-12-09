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

      console.log('[Firebase getUserProfile] 📤 Returning profile with', profile.causes?.length || 0, 'causes');
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
      accountType: 'individual', // Default account type
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
 * Get all individual user profiles, sorted by follower count (highest first)
 * All profiles are public by default.
 * @returns Array of user profiles with their IDs, sorted by follower count
 */
export async function getAllUsers(limitCount?: number): Promise<Array<{ id: string; profile: UserProfile; endorsementCount?: number; followerCount?: number }>> {
  try {
    console.log('[Firebase] Fetching all individual users');

    const usersRef = collection(db, 'users');

    // Fetch all users - we filter client-side to include users without accountType field
    // (they should be treated as individuals) and exclude business accounts
    const querySnapshot = await getDocs(usersRef);
    console.log(`[Firebase] Found ${querySnapshot.size} total documents in users collection`);

    const queryDocs = querySnapshot.docs;

    // Also get all userLists to find users who might have endorsement lists
    // but missing user documents (or incomplete user data)
    const userListsRef = collection(db, 'userLists');
    const userListsQuery = query(userListsRef, where('isEndorsed', '==', true));
    const userListsSnapshot = await getDocs(userListsQuery);

    // Build a map of userId -> endorsement data from userLists
    const userListsMap = new Map<string, { endorsementCount: number; listData: any }>();
    userListsSnapshot.forEach((doc) => {
      const listData = doc.data();
      const userId = listData.userId;
      if (userId) {
        userListsMap.set(userId, {
          endorsementCount: listData.entries?.length || 0,
          listData: listData,
        });
      }
    });
    console.log(`[Firebase] Found ${userListsMap.size} users with endorsement lists`);

    // First, get all follow records in one query for efficiency
    const followsRef = collection(db, 'follows');
    const followsQuery = query(followsRef, where('followedType', '==', 'user'));
    const followsSnapshot = await getDocs(followsQuery);

    // Build a map of userId -> follower count
    const followerCountMap = new Map<string, number>();
    followsSnapshot.forEach((doc) => {
      const followedId = doc.data().followedId;
      followerCountMap.set(followedId, (followerCountMap.get(followedId) || 0) + 1);
    });

    // Build map of users from users collection
    const usersDataMap = new Map<string, any>();

    // First pass: build users with follower counts from users collection
    // Filter client-side: include users without accountType or with accountType === 'individual'
    // Exclude business accounts (accountType === 'business')
    const usersWithFollowers: Array<{ id: string; data: any; followerCount: number }> = [];

    for (const userDoc of queryDocs) {
      const data = userDoc.data();
      const userId = userDoc.id;

      // Store in map for later lookup
      usersDataMap.set(userId, data);

      // Skip business accounts - include all others (individual or undefined accountType)
      if (data.accountType === 'business') {
        console.log(`[Firebase] Skipping business account: ${userId}`);
        continue;
      }

      const followerCount = followerCountMap.get(userId) || 0;
      usersWithFollowers.push({ id: userId, data, followerCount });
    }

    console.log(`[Firebase] After filtering business accounts: ${usersWithFollowers.length} individual users from users collection`);

    // Add users who have endorsement lists but might be missing from users collection
    // or were filtered out for some reason
    const existingUserIds = new Set(usersWithFollowers.map(u => u.id));
    let addedFromUserLists = 0;

    for (const [userId, listInfo] of userListsMap) {
      if (!existingUserIds.has(userId)) {
        // Check if this user exists in users collection but was filtered out
        let existingData = usersDataMap.get(userId);

        if (existingData && existingData.accountType === 'business') {
          // It's a business account, skip it
          continue;
        }

        // If no data found in batch query, try fetching individual document
        if (!existingData) {
          try {
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              existingData = userDocSnap.data();
              console.log(`[Firebase] Found user document for ${userId} via individual fetch`);

              // Check again if it's a business account
              if (existingData.accountType === 'business') {
                continue;
              }
            }
          } catch (e) {
            console.warn(`[Firebase] Could not fetch individual user doc for ${userId}:`, e);
          }
        }

        // User has endorsement list but no user document (or wasn't included)
        // Create a basic entry for them
        const followerCount = followerCountMap.get(userId) || 0;
        usersWithFollowers.push({
          id: userId,
          data: existingData || {}, // Use existing data if available, else empty
          followerCount,
        });
        addedFromUserLists++;
        console.log(`[Firebase] Added user ${userId} from userLists (has ${listInfo.endorsementCount} endorsements)`);
      }
    }

    if (addedFromUserLists > 0) {
      console.log(`[Firebase] Added ${addedFromUserLists} users from userLists who were missing from initial query`);
    }

    console.log(`[Firebase] Total users to process: ${usersWithFollowers.length}`);

    // Sort by follower count first
    usersWithFollowers.sort((a, b) => b.followerCount - a.followerCount);

    // Apply limit if specified (before expensive endorsement count queries)
    const usersToProcess = limitCount ? usersWithFollowers.slice(0, limitCount) : usersWithFollowers;

    const usersWithCounts: Array<{ id: string; profile: UserProfile; endorsementCount: number; followerCount: number }> = [];

    // Fetch endorsement counts only for users we'll return
    for (const { id: userId, data, followerCount } of usersToProcess) {
      // Get endorsement count from our pre-fetched map, or query if not found
      let endorsementCount = 0;
      const cachedListInfo = userListsMap.get(userId);
      if (cachedListInfo) {
        endorsementCount = cachedListInfo.endorsementCount;
      } else {
        try {
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
        } catch (e) {
          console.warn('[Firebase] Could not fetch endorsement count for user', userId);
        }
      }

      // Build userDetails from existing userDetails or from root-level Clerk fields
      // Regular users have name stored at root level (fullName, name, firstName, lastName)
      // Celebrity users have it in userDetails
      let userDetails = data.userDetails;
      if (!userDetails || !userDetails.name) {
        // Build userDetails from root-level Clerk metadata fields
        const rootName = data.fullName || data.name ||
          (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : data.firstName || '');

        if (rootName || data.imageUrl || data.location) {
          userDetails = {
            ...userDetails, // Preserve any existing partial userDetails
            name: userDetails?.name || rootName || undefined,
            profileImage: userDetails?.profileImage || data.imageUrl || undefined,
            location: userDetails?.location || (data.location?.city && data.location?.state
              ? `${data.location.city}, ${data.location.state}`
              : data.location?.city || undefined),
          };
        }
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
        userDetails: userDetails,
        codeSharing: data.codeSharing ?? true,
        consentGivenAt: data.consentGivenAt,
        consentVersion: data.consentVersion,
        isVerified: data.isVerified,
        isCelebrityAccount: data.isCelebrityAccount,
      };

      usersWithCounts.push({ id: userId, profile, endorsementCount, followerCount });
    }

    // Sort by follower count (highest first), then by endorsement count as tiebreaker
    usersWithCounts.sort((a, b) => {
      if (b.followerCount !== a.followerCount) {
        return b.followerCount - a.followerCount;
      }
      return b.endorsementCount - a.endorsementCount;
    });

    console.log('[Firebase] ✅ Fetched and sorted', usersWithCounts.length, 'users by follower count');
    return usersWithCounts;
  } catch (error) {
    console.error('[Firebase] ❌ Error fetching users:', error);
    throw error;
  }
}

/**
 * @deprecated All profiles are now public by default. This function is kept for backwards compatibility.
 */
export const getAllPublicUsers = getAllUsers;
