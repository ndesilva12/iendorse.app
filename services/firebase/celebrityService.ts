/**
 * Celebrity Account Service
 *
 * Service for creating and managing celebrity accounts with endorsement lists.
 * Celebrity accounts have:
 * - Email format: celebrityname@iendorse.demo
 * - isCelebrityAccount: true flag (shows grey outlined badge)
 * - Auto-generated endorsement list with provided businesses
 */

import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { UserProfile, SocialMedia } from '@/types';
import { UserList, ListEntry } from '@/types/library';

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

    // Create the user profile
    const userProfile: Partial<UserProfile> = {
      id: userId,
      accountType: 'individual',
      causes: [],
      searchHistory: [],
      isPublicProfile: true,
      alignedListPublic: true,
      unalignedListPublic: true,
      hasSeenIntro: true,
      isCelebrityAccount: true, // Mark as celebrity account (grey badge)
      userDetails: {
        name: data.name,
        description: data.description || `${data.name}'s endorsements`,
        location: data.location,
        website: data.website,
        socialMedia,
      },
    };

    // If profile image is provided, add it
    if (data.profileImageUrl && userProfile.userDetails) {
      (userProfile.userDetails as any).profileImage = data.profileImageUrl;
    }

    // Create user document
    await setDoc(userRef, {
      ...userProfile,
      email,
      fullName: data.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Normalize and create the endorsement list
    const normalizedEndorsements = normalizeEndorsements(data.endorsements);
    const listId = `${userId}_endorsement`;
    const listRef = doc(db, 'lists', listId);

    const entries: ListEntry[] = normalizedEndorsements.map((endorsement, index) => ({
      id: `${listId}_entry_${index}`,
      brandId: endorsement.placeId || `manual_${endorsement.businessName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      brandName: endorsement.businessName,
      category: endorsement.category || 'Business',
      type: 'external' as const, // External business (not in our brand database)
      order: index,
      addedAt: new Date(),
      notes: endorsement.notes,
    }));

    const endorsementList: Partial<UserList> = {
      id: listId,
      userId,
      name: data.name, // List name is the celebrity's name
      description: `${data.name}'s endorsed businesses`,
      creatorName: data.name,
      creatorImage: data.profileImageUrl,
      entries,
      isPublic: true,
      isEndorsed: true, // This is their endorsement list
      order: 0,
    };

    await setDoc(listRef, {
      ...endorsementList,
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

      // Get endorsement count from their list
      const listRef = doc(db, 'lists', `${docSnap.id}_endorsement`);
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
    const listRef = doc(db, 'lists', `${userId}_endorsement`);
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
