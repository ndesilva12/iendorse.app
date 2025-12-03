/**
 * Referral Service
 * Handles user referral tracking and invite system
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { addBonusDaysToAllEndorsements } from './endorsementHistoryService';

export interface Referral {
  id?: string;
  referrerId: string;       // User ID of the person who made the referral
  referrerName?: string;    // Name of referrer for display
  referredUserId: string;   // User ID of the new user who signed up
  referredUserName?: string; // Name of referred user
  referredUserEmail?: string;
  referralCode: string;     // The code that was used
  createdAt: Date;
  status: 'pending' | 'completed'; // pending = signed up, completed = verified/active
}

export interface UserReferralStats {
  referralCode: string;
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
}

const REFERRALS_COLLECTION = 'referrals';
const USERS_COLLECTION = 'users';

/**
 * Generate a unique referral code for a user
 * Format: first 4 chars of name (uppercase) + 4 random alphanumeric chars
 */
export function generateReferralCode(userName?: string): string {
  const namePrefix = (userName || 'USER')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .substring(0, 4)
    .padEnd(4, 'X');

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: 0, O, I, 1
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${namePrefix}${randomPart}`;
}

/**
 * Get or create a referral code for a user
 */
export async function getUserReferralCode(userId: string): Promise<string> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();

      // Return existing referral code if present
      if (userData.referralCode) {
        return userData.referralCode;
      }

      // Generate new code
      const userName = userData.userDetails?.name || userData.fullName || userData.firstName;
      const newCode = generateReferralCode(userName);

      // Save to user document
      await updateDoc(userRef, {
        referralCode: newCode,
        updatedAt: serverTimestamp(),
      });

      console.log('[Referral] Created referral code for user:', userId, newCode);
      return newCode;
    }

    // User doesn't exist yet, generate a code anyway
    const newCode = generateReferralCode();
    console.log('[Referral] Generated temporary referral code:', newCode);
    return newCode;
  } catch (error) {
    console.error('[Referral] Error getting/creating referral code:', error);
    throw error;
  }
}

/**
 * Find a user by their referral code
 */
export async function findUserByReferralCode(
  code: string
): Promise<{ userId: string; userName?: string } | null> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('referralCode', '==', code.toUpperCase()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('[Referral] No user found with code:', code);
      return null;
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    return {
      userId: userDoc.id,
      userName: userData.userDetails?.name || userData.fullName || userData.firstName,
    };
  } catch (error) {
    console.error('[Referral] Error finding user by referral code:', error);
    throw error;
  }
}

/**
 * Record a new referral when a user signs up with a referral code
 */
export async function recordReferral(
  referrerId: string,
  referrerName: string | undefined,
  referredUserId: string,
  referredUserName: string | undefined,
  referredUserEmail: string | undefined,
  referralCode: string
): Promise<string> {
  try {
    const referralData: Record<string, any> = {
      referrerId,
      referrerName: referrerName || '',
      referredUserId,
      referredUserName: referredUserName || '',
      referredUserEmail: referredUserEmail || '',
      referralCode: referralCode.toUpperCase(),
      status: 'completed', // Considered complete upon signup
      createdAt: Timestamp.now(),
    };

    // Create referral document
    const referralRef = doc(collection(db, REFERRALS_COLLECTION));
    await setDoc(referralRef, referralData);

    // Increment referral count on referrer's user document
    const referrerRef = doc(db, USERS_COLLECTION, referrerId);
    await updateDoc(referrerRef, {
      referralCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    // Store referrer info on the referred user's document
    const referredUserRef = doc(db, USERS_COLLECTION, referredUserId);
    await updateDoc(referredUserRef, {
      referredBy: referrerId,
      referredByCode: referralCode.toUpperCase(),
      updatedAt: serverTimestamp(),
    });

    // Add 7 bonus days to all endorsement items for the referrer
    const REFERRAL_BONUS_DAYS = 7;
    try {
      const updatedCount = await addBonusDaysToAllEndorsements(referrerId, REFERRAL_BONUS_DAYS);
      console.log(`[Referral] Added ${REFERRAL_BONUS_DAYS} bonus days to ${updatedCount} endorsement items for referrer:`, referrerId);
    } catch (bonusError) {
      // Don't fail the referral if bonus days fail to apply
      console.error('[Referral] Error adding bonus days, continuing:', bonusError);
    }

    console.log('[Referral] Recorded referral:', referralRef.id);
    return referralRef.id;
  } catch (error) {
    console.error('[Referral] Error recording referral:', error);
    throw error;
  }
}

/**
 * Get referral count for a user
 */
export async function getReferralCount(userId: string): Promise<number> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.referralCount || 0;
    }

    return 0;
  } catch (error) {
    console.error('[Referral] Error getting referral count:', error);
    return 0;
  }
}

/**
 * Get all referrals made by a user
 */
export async function getUserReferrals(userId: string): Promise<Referral[]> {
  try {
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    const q = query(
      referralsRef,
      where('referrerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        referrerId: data.referrerId,
        referrerName: data.referrerName,
        referredUserId: data.referredUserId,
        referredUserName: data.referredUserName,
        referredUserEmail: data.referredUserEmail,
        referralCode: data.referralCode,
        createdAt: data.createdAt?.toDate() || new Date(),
        status: data.status,
      };
    });
  } catch (error) {
    console.error('[Referral] Error getting user referrals:', error);
    return [];
  }
}

/**
 * Get referral statistics for a user
 */
export async function getUserReferralStats(userId: string): Promise<UserReferralStats> {
  try {
    const referralCode = await getUserReferralCode(userId);
    const referrals = await getUserReferrals(userId);

    const pendingReferrals = referrals.filter((r) => r.status === 'pending').length;
    const completedReferrals = referrals.filter((r) => r.status === 'completed').length;

    return {
      referralCode,
      totalReferrals: referrals.length,
      pendingReferrals,
      completedReferrals,
    };
  } catch (error) {
    console.error('[Referral] Error getting referral stats:', error);
    return {
      referralCode: '',
      totalReferrals: 0,
      pendingReferrals: 0,
      completedReferrals: 0,
    };
  }
}

/**
 * Get the referral invite link for a user
 */
export function getReferralLink(referralCode: string, baseUrl?: string): string {
  const base = baseUrl || 'https://iendorse.app';
  return `${base}/invite/${referralCode}`;
}

/**
 * Append referral tracking parameter to any URL
 * This allows tracking shares even to existing users
 */
export function appendReferralTracking(url: string, referralCode: string | null | undefined): string {
  if (!referralCode || !url) return url;

  try {
    // Handle URLs with existing query parameters
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}ref=${referralCode}`;
  } catch {
    return url;
  }
}

/**
 * Record a share event for tracking purposes
 * This tracks when users share content (even to existing users)
 */
export async function recordShareEvent(
  sharerId: string,
  sharerReferralCode: string,
  contentType: 'brand' | 'business' | 'user' | 'list' | 'place' | 'value' | 'other',
  contentId: string,
  contentName?: string
): Promise<void> {
  try {
    const shareData = {
      sharerId,
      sharerReferralCode,
      contentType,
      contentId,
      contentName: contentName || '',
      createdAt: Timestamp.now(),
    };

    const shareRef = doc(collection(db, 'shareEvents'));
    await setDoc(shareRef, shareData);
    console.log('[Referral] Recorded share event:', contentType, contentId);
  } catch (error) {
    // Don't throw - sharing should still work even if tracking fails
    console.error('[Referral] Error recording share event:', error);
  }
}

/**
 * Get all referrals (admin function)
 */
export async function getAllReferrals(): Promise<Referral[]> {
  try {
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    const q = query(referralsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        referrerId: data.referrerId,
        referrerName: data.referrerName,
        referredUserId: data.referredUserId,
        referredUserName: data.referredUserName,
        referredUserEmail: data.referredUserEmail,
        referralCode: data.referralCode,
        createdAt: data.createdAt?.toDate() || new Date(),
        status: data.status,
      };
    });
  } catch (error) {
    console.error('[Referral] Error getting all referrals:', error);
    return [];
  }
}
