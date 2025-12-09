/**
 * Celebrity Account Service
 *
 * Service for creating and managing celebrity accounts with endorsement lists.
 * Celebrity accounts have:
 * - Email format: celebrityname@iendorse.demo
 * - isCelebrityAccount: true flag (shows grey outlined badge)
 * - Auto-generated endorsement list with provided businesses
 */

import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { UserProfile, SocialMedia } from '@/types';
import { UserList, ListEntry, BrandListEntry } from '@/types/library';
import { deleteAllFollowsForUser } from './followService';

/**
 * Remove undefined fields from an object (Firebase doesn't accept undefined)
 */
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
        result[key] = removeUndefined(obj[key]);
      } else if (Array.isArray(obj[key])) {
        result[key] = obj[key].map((item: any) =>
          typeof item === 'object' && item !== null ? removeUndefined(item) : item
        );
      } else {
        result[key] = obj[key];
      }
    }
  }
  return result as Partial<T>;
}

export interface CelebrityEndorsement {
  businessName: string;
  category?: string;
  placeId?: string; // Google Places ID if known
  notes?: string;
}

export interface CelebrityAccountData {
  name: string; // Display name (e.g., "Taylor Swift")
  description?: string; // Optional bio
  location?: string; // Optional location
  website?: string; // Optional website
  twitter?: string; // Twitter/X handle (without @)
  instagram?: string; // Instagram handle (without @)
  profileImageUrl?: string; // Optional profile image URL
  coverImageUrl?: string; // Optional cover/banner image URL
  endorsements: CelebrityEndorsement[] | string[]; // Can be full endorsement objects or just business names
}

/**
 * Generate a unique user ID for celebrity accounts
 */
const generateCelebrityUserId = (name: string): string => {
  // Convert name to lowercase, replace spaces with dashes, remove special chars
  const baseName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .trim();

  // Add a prefix to identify as celebrity account
  return `celeb_${baseName}`;
};

/**
 * Generate email for celebrity account
 */
const generateCelebrityEmail = (name: string): string => {
  const emailName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '.')
    .trim();

  return `${emailName}@iendorse.demo`;
};

/**
 * Normalize endorsements to CelebrityEndorsement objects
 */
const normalizeEndorsements = (endorsements: CelebrityEndorsement[] | string[]): CelebrityEndorsement[] => {
  return endorsements.map(e => {
    if (typeof e === 'string') {
      return { businessName: e };
    }
    return e;
  });
};

/**
 * Create a celebrity account with endorsement list
 */
export async function createCelebrityAccount(data: CelebrityAccountData): Promise<{ userId: string; email: string; success: boolean; error?: string }> {
  const userId = generateCelebrityUserId(data.name);
  const email = generateCelebrityEmail(data.name);

  try {
    // Check if user already exists
    const userRef = doc(db, 'users', userId);
    const existingUser = await getDoc(userRef);

    if (existingUser.exists()) {
      return {
        userId,
        email,
        success: false,
        error: `Celebrity account for "${data.name}" already exists`,
      };
    }

    // Build social media object
    const socialMedia: SocialMedia = {};
    if (data.twitter) {
      socialMedia.twitter = data.twitter.replace('@', '');
    }
    if (data.instagram) {
      socialMedia.instagram = data.instagram.replace('@', '');
    }

    // Create the user profile - only include fields that have values
    const userDetails: Record<string, any> = {
      name: data.name,
      description: data.description || `${data.name}'s endorsements`,
      socialMedia,
    };

    // Only add optional fields if they have values
    if (data.location) userDetails.location = data.location;
    if (data.website) userDetails.website = data.website;
    if (data.profileImageUrl) userDetails.profileImage = data.profileImageUrl;
    if (data.coverImageUrl) userDetails.coverImage = data.coverImageUrl;

    const userProfile: Partial<UserProfile> = {
      id: userId,
      accountType: 'individual',
      causes: [],
      searchHistory: [],
      hasSeenIntro: true,
      isCelebrityAccount: true, // Mark as celebrity account (grey badge)
      userDetails: userDetails as any,
    };

    // Create user document (remove undefined fields)
    const userDoc = removeUndefined({
      ...userProfile,
      email,
      fullName: data.name,
    });
    await setDoc(userRef, {
      ...userDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create endorsement list entries - EXACTLY like regular users
    // For each endorsement, create a brand if it doesn't exist, then create a proper BrandListEntry
    const normalizedEndorsements = normalizeEndorsements(data.endorsements);
    const entries: ListEntry[] = [];

    for (let index = 0; index < normalizedEndorsements.length; index++) {
      const endorsement = normalizedEndorsements[index];

      // Search for existing brand by NAME (case-insensitive) to prevent duplicates
      let brandId: string | null = null;
      let existingBrandData: any = null;

      // First, search the brands collection for a matching name
      const brandsRef = collection(db, 'brands');
      const brandNameLower = endorsement.businessName.toLowerCase().trim();

      // Query for exact name match (Firestore is case-sensitive, so we also store lowercase)
      const brandQuery = query(brandsRef, where('nameLower', '==', brandNameLower));
      const brandQuerySnapshot = await getDocs(brandQuery);

      if (!brandQuerySnapshot.empty) {
        // Found existing brand by name
        const existingBrandDoc = brandQuerySnapshot.docs[0];
        brandId = existingBrandDoc.id;
        existingBrandData = existingBrandDoc.data();
        console.log(`[CelebrityService] Found existing brand by name: ${brandId} (${endorsement.businessName})`);
      } else {
        // No match by nameLower - try searching by original name field
        const brandQueryByName = query(brandsRef, where('name', '==', endorsement.businessName));
        const brandQueryByNameSnapshot = await getDocs(brandQueryByName);

        if (!brandQueryByNameSnapshot.empty) {
          const existingBrandDoc = brandQueryByNameSnapshot.docs[0];
          brandId = existingBrandDoc.id;
          existingBrandData = existingBrandDoc.data();
          console.log(`[CelebrityService] Found existing brand by exact name: ${brandId} (${endorsement.businessName})`);
        }
      }

      // If no existing brand found, create a new one
      if (!brandId) {
        // Generate a brand ID from the business name
        brandId = endorsement.businessName
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .trim();

        // Ensure the ID doesn't already exist (edge case)
        const brandRef = doc(db, 'brands', brandId);
        const existingByIdDoc = await getDoc(brandRef);

        if (existingByIdDoc.exists()) {
          // ID exists but name didn't match - use the existing brand
          brandId = existingByIdDoc.id;
          existingBrandData = existingByIdDoc.data();
          console.log(`[CelebrityService] Found existing brand by ID: ${brandId}`);
        } else {
          // Create the brand in the brands collection
          const brandData = removeUndefined({
            name: endorsement.businessName,
            nameLower: brandNameLower, // Store lowercase for case-insensitive matching
            category: endorsement.category || 'Business',
            description: `${endorsement.businessName}`,
            website: null,
            exampleImageUrl: null,
          });

          await setDoc(brandRef, {
            ...brandData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: 'celebrity-import',
          });

          console.log(`[CelebrityService] Created new brand: ${brandId} (${endorsement.businessName})`);
        }
      }

      // Create proper BrandListEntry (same as regular users)
      const entry: BrandListEntry = {
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'brand',
        brandId: brandId,
        brandName: existingBrandData?.name || endorsement.businessName,
        brandCategory: existingBrandData?.category || endorsement.category || 'Business',
        createdAt: new Date(),
      };

      entries.push(entry);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Create the endorsement list (same structure as regular users)
    const listId = `${userId}_endorsement`;
    const listRef = doc(db, 'userLists', listId);

    const endorsementList: Partial<UserList> = {
      id: listId,
      userId,
      name: data.name, // List name is the celebrity's name
      description: `${data.name}'s endorsed businesses`,
      creatorName: data.name,
      creatorImage: data.profileImageUrl || null, // Use null instead of undefined
      entries,
      isPublic: true,
      isEndorsed: true, // This is their endorsement list
      order: 0,
    };

    // Remove undefined fields before saving
    const listDoc = removeUndefined(endorsementList);
    await setDoc(listRef, {
      ...listDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`[CelebrityService] Created celebrity account for ${data.name} (${userId}) with ${entries.length} endorsements`);

    return {
      userId,
      email,
      success: true,
    };
  } catch (error) {
    console.error(`[CelebrityService] Error creating celebrity account:`, error);
    return {
      userId,
      email,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create multiple celebrity accounts in batch
 */
export async function createCelebrityAccountsBatch(celebrities: CelebrityAccountData[]): Promise<{
  successful: { name: string; userId: string; email: string }[];
  failed: { name: string; error: string }[];
}> {
  const successful: { name: string; userId: string; email: string }[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const celebrity of celebrities) {
    const result = await createCelebrityAccount(celebrity);

    if (result.success) {
      successful.push({
        name: celebrity.name,
        userId: result.userId,
        email: result.email,
      });
    } else {
      failed.push({
        name: celebrity.name,
        error: result.error || 'Unknown error',
      });
    }
  }

  console.log(`[CelebrityService] Batch complete: ${successful.length} successful, ${failed.length} failed`);

  return { successful, failed };
}

/**
 * Get all celebrity accounts
 */
export async function getAllCelebrityAccounts(): Promise<{ userId: string; name: string; email: string; endorsementCount: number }[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('isCelebrityAccount', '==', true));
    const querySnapshot = await getDocs(q);

    const celebrities: { userId: string; name: string; email: string; endorsementCount: number }[] = [];

    for (const docSnap of querySnapshot.docs) {
      const userData = docSnap.data();

      // Get endorsement count from their list (stored in userLists like regular users)
      const listRef = doc(db, 'userLists', `${docSnap.id}_endorsement`);
      const listDoc = await getDoc(listRef);
      const endorsementCount = listDoc.exists() ? (listDoc.data()?.entries?.length || 0) : 0;

      celebrities.push({
        userId: docSnap.id,
        name: userData.userDetails?.name || userData.fullName || 'Unknown',
        email: userData.email || '',
        endorsementCount,
      });
    }

    return celebrities;
  } catch (error) {
    console.error('[CelebrityService] Error getting celebrity accounts:', error);
    return [];
  }
}

/**
 * Add endorsements to an existing celebrity account
 */
export async function addEndorsementsToCelebrity(
  userId: string,
  newEndorsements: CelebrityEndorsement[]
): Promise<{ success: boolean; error?: string; newTotal?: number }> {
  try {
    const listRef = doc(db, 'userLists', `${userId}_endorsement`);
    const listDoc = await getDoc(listRef);

    if (!listDoc.exists()) {
      return { success: false, error: 'Endorsement list not found' };
    }

    const listData = listDoc.data() as UserList;
    const existingEntries = listData.entries || [];
    const nextOrder = existingEntries.length;

    const newEntries: ListEntry[] = newEndorsements.map((endorsement, index) => ({
      id: `${userId}_entry_${nextOrder + index}`,
      brandId: endorsement.placeId || `manual_${endorsement.businessName.toLowerCase().replace(/\s+/g, '_')}`,
      brandName: endorsement.businessName,
      category: endorsement.category || 'Business',
      type: 'external' as const,
      order: nextOrder + index,
      addedAt: new Date(),
      notes: endorsement.notes,
    }));

    await setDoc(listRef, {
      entries: [...existingEntries, ...newEntries],
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      newTotal: existingEntries.length + newEntries.length,
    };
  } catch (error) {
    console.error('[CelebrityService] Error adding endorsements:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Import celebrity batch - one-time import from batch data file
 * This checks a flag in Firestore to prevent duplicate imports
 */
export async function importCelebrityBatch(
  batchId: string,
  celebrities: CelebrityAccountData[]
): Promise<{
  success: boolean;
  alreadyImported: boolean;
  results?: { successful: number; failed: number };
  error?: string;
}> {
  try {
    // Check if this batch has already been imported
    const flagRef = doc(db, 'admin', 'celebrityImports');
    const flagDoc = await getDoc(flagRef);
    const importedBatches = flagDoc.exists() ? (flagDoc.data()?.batches || []) : [];

    if (importedBatches.includes(batchId)) {
      console.log(`[CelebrityService] Batch "${batchId}" already imported, skipping`);
      return {
        success: true,
        alreadyImported: true,
      };
    }

    console.log(`[CelebrityService] Starting import of batch "${batchId}" with ${celebrities.length} celebrities`);

    // Import all celebrities
    const results = await createCelebrityAccountsBatch(celebrities);

    // Mark batch as imported
    await setDoc(flagRef, {
      batches: [...importedBatches, batchId],
      lastImport: serverTimestamp(),
      [`${batchId}_results`]: {
        successful: results.successful.length,
        failed: results.failed.length,
        importedAt: new Date().toISOString(),
      },
    }, { merge: true });

    console.log(`[CelebrityService] Batch "${batchId}" import complete: ${results.successful.length} successful, ${results.failed.length} failed`);

    return {
      success: true,
      alreadyImported: false,
      results: {
        successful: results.successful.length,
        failed: results.failed.length,
      },
    };
  } catch (error) {
    console.error('[CelebrityService] Error importing batch:', error);
    return {
      success: false,
      alreadyImported: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run the first celebrity batch import
 * Call this from app initialization or an admin trigger
 */
export async function runCelebrityBatch1Import(): Promise<{
  success: boolean;
  alreadyImported: boolean;
  results?: { successful: number; failed: number };
  error?: string;
}> {
  // Dynamic import to avoid circular dependencies
  const { celebrityBatch1 } = await import('@/data/celebrityBatch');

  // Convert the data format
  const celebrities: CelebrityAccountData[] = celebrityBatch1.map(celeb => ({
    name: celeb.name,
    description: celeb.description,
    location: celeb.location,
    website: celeb.website,
    twitter: celeb.twitter,
    instagram: celeb.instagram,
    endorsements: celeb.endorsements,
  }));

  return importCelebrityBatch('batch1_2024', celebrities);
}

/**
 * Migrate celebrity lists from 'lists' collection to 'userLists' collection
 * This is a one-time migration to unify all user lists in one collection
 */
export async function migrateCelebrityListsToUserLists(): Promise<{
  success: boolean;
  migrated: number;
  alreadyMigrated: number;
  errors: string[];
}> {
  const results = {
    success: true,
    migrated: 0,
    alreadyMigrated: 0,
    errors: [] as string[],
  };

  try {
    // Check if migration already ran
    const flagRef = doc(db, 'admin', 'migrations');
    const flagDoc = await getDoc(flagRef);
    const migrations = flagDoc.exists() ? (flagDoc.data()?.completed || []) : [];

    if (migrations.includes('celebrity_lists_to_userLists')) {
      console.log('[CelebrityService] Migration already completed');
      return { ...results, success: true };
    }

    // Get all celebrity accounts
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('isCelebrityAccount', '==', true));
    const querySnapshot = await getDocs(q);

    console.log(`[CelebrityService] Found ${querySnapshot.size} celebrity accounts to migrate`);

    const batch = writeBatch(db);
    let batchCount = 0;

    for (const userDoc of querySnapshot.docs) {
      const userId = userDoc.id;
      const oldListId = `${userId}_endorsement`;

      // Check if list exists in old 'lists' collection
      const oldListRef = doc(db, 'lists', oldListId);
      const oldListDoc = await getDoc(oldListRef);

      if (!oldListDoc.exists()) {
        console.log(`[CelebrityService] No list found for ${userId} in 'lists' collection`);
        continue;
      }

      // Check if already exists in userLists
      const newListRef = doc(db, 'userLists', oldListId);
      const newListDoc = await getDoc(newListRef);

      if (newListDoc.exists()) {
        console.log(`[CelebrityService] List already exists in userLists for ${userId}`);
        results.alreadyMigrated++;
        continue;
      }

      // Copy to userLists
      const listData = oldListDoc.data();
      batch.set(newListRef, {
        ...listData,
        migratedAt: serverTimestamp(),
      });

      batchCount++;
      results.migrated++;

      // Firestore batch limit is 500
      if (batchCount >= 400) {
        await batch.commit();
        console.log(`[CelebrityService] Committed batch of ${batchCount} migrations`);
        batchCount = 0;
      }
    }

    // Commit any remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`[CelebrityService] Committed final batch of ${batchCount} migrations`);
    }

    // Mark migration as complete
    await setDoc(flagRef, {
      completed: [...migrations, 'celebrity_lists_to_userLists'],
      celebrity_lists_to_userLists: {
        completedAt: serverTimestamp(),
        migrated: results.migrated,
        alreadyMigrated: results.alreadyMigrated,
      },
    }, { merge: true });

    console.log(`[CelebrityService] Migration complete: ${results.migrated} migrated, ${results.alreadyMigrated} already existed`);
    return results;
  } catch (error) {
    console.error('[CelebrityService] Migration error:', error);
    results.success = false;
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return results;
  }
}

/**
 * Generate a claim token for a celebrity account
 * This token can be used by a real user to claim the celebrity profile
 */
export async function generateClaimToken(celebrityUserId: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    // Verify this is a celebrity account
    const userRef = doc(db, 'users', celebrityUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { success: false, error: 'Celebrity account not found' };
    }

    const userData = userDoc.data();
    if (!userData.isCelebrityAccount) {
      return { success: false, error: 'This is not a celebrity account' };
    }

    if (userData.claimedBy) {
      return { success: false, error: 'This account has already been claimed' };
    }

    // Generate a secure random token
    const token = `claim_${celebrityUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Store the token in the user document
    await setDoc(userRef, {
      claimToken: token,
      claimTokenCreatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`[CelebrityService] Generated claim token for ${celebrityUserId}`);

    return { success: true, token };
  } catch (error) {
    console.error('[CelebrityService] Error generating claim token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Claim a celebrity account using a claim token
 * This links the celebrity profile to a real Clerk user
 */
export async function claimCelebrityAccount(
  claimToken: string,
  clerkUserId: string,
  clerkEmail: string
): Promise<{
  success: boolean;
  celebrityUserId?: string;
  error?: string;
}> {
  try {
    // Find the celebrity account with this claim token
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('claimToken', '==', claimToken));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, error: 'Invalid or expired claim token' };
    }

    const celebrityDoc = querySnapshot.docs[0];
    const celebrityData = celebrityDoc.data();
    const celebrityUserId = celebrityDoc.id;

    if (celebrityData.claimedBy) {
      return { success: false, error: 'This account has already been claimed' };
    }

    // Check if the Clerk user already has an account
    const existingUserRef = doc(db, 'users', clerkUserId);
    const existingUserDoc = await getDoc(existingUserRef);

    if (existingUserDoc.exists()) {
      // User already has an account - we need to merge or reject
      return {
        success: false,
        error: 'You already have an account. Please contact support to merge accounts.',
      };
    }

    // Get the celebrity's endorsement list
    const listId = `${celebrityUserId}_endorsement`;
    const oldListRef = doc(db, 'userLists', listId);
    const oldListDoc = await getDoc(oldListRef);

    // Create the new user document with the Clerk user ID
    const newUserData = {
      ...celebrityData,
      id: clerkUserId,
      email: clerkEmail,
      claimedBy: clerkUserId,
      claimedAt: serverTimestamp(),
      claimToken: null, // Clear the token
      claimTokenCreatedAt: null,
      originalCelebrityId: celebrityUserId,
      // Keep isCelebrityAccount true so they keep the badge
    };

    // Create the new user document
    const newUserRef = doc(db, 'users', clerkUserId);
    await setDoc(newUserRef, newUserData);

    // Move the endorsement list to the new user ID
    if (oldListDoc.exists()) {
      const newListId = `${clerkUserId}_endorsement`;
      const newListRef = doc(db, 'userLists', newListId);
      const listData = oldListDoc.data();

      await setDoc(newListRef, {
        ...listData,
        id: newListId,
        userId: clerkUserId,
        transferredAt: serverTimestamp(),
        originalListId: listId,
      });
    }

    // Mark the old celebrity account as claimed (don't delete it for audit trail)
    await setDoc(doc(db, 'users', celebrityUserId), {
      claimedBy: clerkUserId,
      claimedAt: serverTimestamp(),
      claimToken: null,
      isActive: false, // Deactivate the old account
    }, { merge: true });

    console.log(`[CelebrityService] Celebrity account ${celebrityUserId} claimed by ${clerkUserId}`);

    return {
      success: true,
      celebrityUserId,
    };
  } catch (error) {
    console.error('[CelebrityService] Error claiming account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get claim info for a token (used to display who you're claiming)
 */
export async function getClaimInfo(claimToken: string): Promise<{
  success: boolean;
  name?: string;
  profileImage?: string;
  endorsementCount?: number;
  error?: string;
}> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('claimToken', '==', claimToken));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, error: 'Invalid or expired claim token' };
    }

    const celebrityDoc = querySnapshot.docs[0];
    const celebrityData = celebrityDoc.data();

    if (celebrityData.claimedBy) {
      return { success: false, error: 'This account has already been claimed' };
    }

    // Get endorsement count
    const listRef = doc(db, 'userLists', `${celebrityDoc.id}_endorsement`);
    const listDoc = await getDoc(listRef);
    const endorsementCount = listDoc.exists() ? (listDoc.data()?.entries?.length || 0) : 0;

    return {
      success: true,
      name: celebrityData.userDetails?.name || celebrityData.fullName || 'Unknown',
      profileImage: celebrityData.userDetails?.profileImage,
      endorsementCount,
    };
  } catch (error) {
    console.error('[CelebrityService] Error getting claim info:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Normalize all celebrity accounts to ensure they have accountType set
 * After running this, celebrity accounts will be found by the same queries as regular accounts
 */
export async function normalizeCelebrityAccounts(): Promise<{
  success: boolean;
  total: number;
  updated: number;
  alreadyNormalized: number;
  errors: string[];
}> {
  const results = {
    success: true,
    total: 0,
    updated: 0,
    alreadyNormalized: 0,
    errors: [] as string[],
  };

  try {
    console.log('[CelebrityService] Starting normalization of celebrity accounts...');

    // Get all celebrity accounts
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('isCelebrityAccount', '==', true));
    const querySnapshot = await getDocs(q);

    results.total = querySnapshot.size;
    console.log(`[CelebrityService] Found ${results.total} celebrity accounts to check`);

    for (const userDoc of querySnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Check if account needs normalization (ensure accountType is set)
      const needsUpdate = userData.accountType !== 'individual';

      if (!needsUpdate) {
        results.alreadyNormalized++;
        continue;
      }

      // Skip deactivated/claimed accounts
      if (userData.isActive === false) {
        console.log(`[CelebrityService] Skipping deactivated account: ${userId}`);
        continue;
      }

      try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
          accountType: 'individual',
        }, { merge: true });

        results.updated++;
        console.log(`[CelebrityService] Normalized account: ${userId} (${userData.userDetails?.name || userData.fullName})`);
      } catch (err) {
        const errorMsg = `Failed to update ${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[CelebrityService] ${errorMsg}`);
      }
    }

    console.log(`[CelebrityService] Normalization complete: ${results.updated} updated, ${results.alreadyNormalized} already normalized`);
    return results;
  } catch (error) {
    console.error('[CelebrityService] Normalization error:', error);
    results.success = false;
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return results;
  }
}

/**
 * Delete all celebrity accounts and their associated data
 * This removes:
 * - User documents from 'users' collection (where isCelebrityAccount=true OR id starts with 'celeb_')
 * - Their endorsement lists from 'userLists' collection
 */
export async function deleteAllCelebrityAccounts(): Promise<{
  success: boolean;
  deletedUsers: number;
  deletedLists: number;
  deletedFollows: number;
  errors: string[];
}> {
  const results = {
    success: true,
    deletedUsers: 0,
    deletedLists: 0,
    deletedFollows: 0,
    errors: [] as string[],
  };

  try {
    console.log('[CelebrityService] Starting deletion of all celebrity accounts...');

    // Find all celebrity accounts
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('isCelebrityAccount', '==', true));
    const querySnapshot = await getDocs(q);

    console.log(`[CelebrityService] Found ${querySnapshot.size} celebrity accounts to delete`);

    for (const userDoc of querySnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const userName = userData.userDetails?.name || userData.fullName || userId;

      try {
        // Delete all follow relationships for this user
        const followResult = await deleteAllFollowsForUser(userId);
        results.deletedFollows += followResult.deleted;
        console.log(`[CelebrityService] Deleted ${followResult.deleted} follow relationships for ${userName}`);

        // Delete the user's endorsement list
        const listId = `${userId}_endorsement`;
        const listRef = doc(db, 'userLists', listId);
        const listDoc = await getDoc(listRef);

        if (listDoc.exists()) {
          await deleteDoc(listRef);
          results.deletedLists++;
          console.log(`[CelebrityService] Deleted list: ${listId}`);
        }

        // Delete the user document
        await deleteDoc(doc(db, 'users', userId));
        results.deletedUsers++;
        console.log(`[CelebrityService] Deleted user: ${userId} (${userName})`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        const errorMsg = `Failed to delete ${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[CelebrityService] ${errorMsg}`);
      }
    }

    // Also clean up any orphaned lists with celeb_ prefix
    const listsRef = collection(db, 'userLists');
    const listsSnapshot = await getDocs(listsRef);

    for (const listDoc of listsSnapshot.docs) {
      if (listDoc.id.startsWith('celeb_')) {
        try {
          await deleteDoc(doc(db, 'userLists', listDoc.id));
          results.deletedLists++;
          console.log(`[CelebrityService] Deleted orphaned list: ${listDoc.id}`);
        } catch (err) {
          results.errors.push(`Failed to delete orphaned list ${listDoc.id}`);
        }
      }
    }

    console.log(`[CelebrityService] Deletion complete: ${results.deletedUsers} users, ${results.deletedLists} lists deleted`);
    return results;
  } catch (error) {
    console.error('[CelebrityService] Deletion error:', error);
    results.success = false;
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return results;
  }
}
