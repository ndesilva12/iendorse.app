/**
 * Business Claim Service
 *
 * Handles business ownership claims for Google Places businesses
 */

import { db } from '@/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
  deleteField,
} from 'firebase/firestore';

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export interface BusinessClaim {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  placeId: string;
  placeName: string;
  placeAddress: string;
  placeCategory: string;
  status: ClaimStatus;
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewNotes?: string;
  // Additional verification info
  verificationDetails?: string;
  businessRole?: string; // owner, manager, etc.
  businessPhone?: string;
  businessEmail?: string;
}

/**
 * Submit a new business claim
 */
export const submitBusinessClaim = async (claim: {
  userId: string;
  userEmail: string;
  userName: string;
  placeId: string;
  placeName: string;
  placeAddress: string;
  placeCategory: string;
  verificationDetails?: string;
  businessRole?: string;
  businessPhone?: string;
  businessEmail?: string;
}): Promise<string> => {
  try {
    // Check if user already has a pending claim for this place
    const existingClaim = await getClaimByUserAndPlace(claim.userId, claim.placeId);
    if (existingClaim && existingClaim.status === 'pending') {
      throw new Error('You already have a pending claim for this business');
    }

    // Check if place is already claimed by someone else
    const approvedClaim = await getApprovedClaimForPlace(claim.placeId);
    if (approvedClaim) {
      throw new Error('This business has already been claimed by another user');
    }

    const claimsRef = collection(db, 'businessClaims');
    const docRef = await addDoc(claimsRef, {
      ...claim,
      status: 'pending',
      submittedAt: Timestamp.now(),
    });

    console.log('[BusinessClaimService] Claim submitted:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[BusinessClaimService] Error submitting claim:', error);
    throw error;
  }
};

/**
 * Get all pending claims (for admin)
 */
export const getPendingClaims = async (): Promise<BusinessClaim[]> => {
  try {
    const claimsRef = collection(db, 'businessClaims');
    const q = query(
      claimsRef,
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as BusinessClaim[];
  } catch (error) {
    console.error('[BusinessClaimService] Error getting pending claims:', error);
    return [];
  }
};

/**
 * Get all claims (for admin)
 */
export const getAllClaims = async (): Promise<BusinessClaim[]> => {
  try {
    const claimsRef = collection(db, 'businessClaims');
    const q = query(claimsRef, orderBy('submittedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as BusinessClaim[];
  } catch (error) {
    console.error('[BusinessClaimService] Error getting all claims:', error);
    return [];
  }
};

/**
 * Get claims by user
 */
export const getClaimsByUser = async (userId: string): Promise<BusinessClaim[]> => {
  try {
    const claimsRef = collection(db, 'businessClaims');

    // Try with orderBy first (requires composite index)
    try {
      const q = query(
        claimsRef,
        where('userId', '==', userId),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      console.log('[BusinessClaimService] Found', snapshot.size, 'claims for user (with orderBy)');

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BusinessClaim[];
    } catch (indexError: any) {
      // If index doesn't exist, fall back to query without orderBy
      console.warn('[BusinessClaimService] Index query failed, trying without orderBy:', indexError?.message);

      const q = query(
        claimsRef,
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      console.log('[BusinessClaimService] Found', snapshot.size, 'claims for user (without orderBy)');

      // Sort client-side
      const claims = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BusinessClaim[];

      return claims.sort((a, b) => {
        const aTime = a.submittedAt?.seconds || 0;
        const bTime = b.submittedAt?.seconds || 0;
        return bTime - aTime; // Descending order
      });
    }
  } catch (error) {
    console.error('[BusinessClaimService] Error getting user claims:', error);
    return [];
  }
};

/**
 * Get a specific claim by user and place
 */
export const getClaimByUserAndPlace = async (
  userId: string,
  placeId: string
): Promise<BusinessClaim | null> => {
  try {
    const claimsRef = collection(db, 'businessClaims');
    const q = query(
      claimsRef,
      where('userId', '==', userId),
      where('placeId', '==', placeId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as BusinessClaim;
  } catch (error) {
    console.error('[BusinessClaimService] Error getting claim:', error);
    return null;
  }
};

/**
 * Get all approved claims (for admin - shows claimed businesses)
 */
export const getApprovedClaims = async (): Promise<BusinessClaim[]> => {
  try {
    const claimsRef = collection(db, 'businessClaims');

    // Try with orderBy first (requires composite index)
    try {
      const q = query(
        claimsRef,
        where('status', '==', 'approved'),
        orderBy('reviewedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      console.log('[BusinessClaimService] Found', snapshot.size, 'approved claims (with orderBy)');

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BusinessClaim[];
    } catch (indexError: any) {
      // If index doesn't exist, fall back to query without orderBy
      console.warn('[BusinessClaimService] Index query failed, trying without orderBy:', indexError?.message);

      const q = query(
        claimsRef,
        where('status', '==', 'approved')
      );
      const snapshot = await getDocs(q);
      console.log('[BusinessClaimService] Found', snapshot.size, 'approved claims (without orderBy)');

      // Sort client-side
      const claims = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BusinessClaim[];

      return claims.sort((a, b) => {
        const aTime = a.reviewedAt?.seconds || 0;
        const bTime = b.reviewedAt?.seconds || 0;
        return bTime - aTime; // Descending order
      });
    }
  } catch (error) {
    console.error('[BusinessClaimService] Error getting approved claims:', error);
    return [];
  }
};

/**
 * Revoke a business claim (detach user from business)
 * This changes the status back to 'pending' or deletes the claim entirely
 */
export const revokeClaim = async (
  claimId: string,
  revokedBy: string,
  reason: string,
  deleteCompletely: boolean = false
): Promise<void> => {
  try {
    if (deleteCompletely) {
      // Delete the claim entirely
      const claimRef = doc(db, 'businessClaims', claimId);
      await deleteDoc(claimRef);
      console.log('[BusinessClaimService] Claim deleted (revoked):', claimId);
    } else {
      // Change status to rejected
      const claimRef = doc(db, 'businessClaims', claimId);
      await updateDoc(claimRef, {
        status: 'rejected',
        reviewedAt: Timestamp.now(),
        reviewedBy: revokedBy,
        reviewNotes: `Claim revoked: ${reason}`,
        revokedAt: Timestamp.now(),
      });
      console.log('[BusinessClaimService] Claim revoked:', claimId);
    }
  } catch (error) {
    console.error('[BusinessClaimService] Error revoking claim:', error);
    throw error;
  }
};

/**
 * Get approved claim for a place
 */
export const getApprovedClaimForPlace = async (
  placeId: string
): Promise<BusinessClaim | null> => {
  try {
    const claimsRef = collection(db, 'businessClaims');
    const q = query(
      claimsRef,
      where('placeId', '==', placeId),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as BusinessClaim;
  } catch (error) {
    console.error('[BusinessClaimService] Error getting approved claim:', error);
    return null;
  }
};

/**
 * Approve a business claim (admin only)
 */
export const approveClaim = async (
  claimId: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<void> => {
  try {
    const claimRef = doc(db, 'businessClaims', claimId);
    await updateDoc(claimRef, {
      status: 'approved',
      reviewedAt: Timestamp.now(),
      reviewedBy,
      reviewNotes: reviewNotes || '',
    });

    console.log('[BusinessClaimService] Claim approved:', claimId);
  } catch (error) {
    console.error('[BusinessClaimService] Error approving claim:', error);
    throw error;
  }
};

/**
 * Reject a business claim (admin only)
 */
export const rejectClaim = async (
  claimId: string,
  reviewedBy: string,
  reviewNotes: string
): Promise<void> => {
  try {
    const claimRef = doc(db, 'businessClaims', claimId);
    await updateDoc(claimRef, {
      status: 'rejected',
      reviewedAt: Timestamp.now(),
      reviewedBy,
      reviewNotes,
    });

    console.log('[BusinessClaimService] Claim rejected:', claimId);
  } catch (error) {
    console.error('[BusinessClaimService] Error rejecting claim:', error);
    throw error;
  }
};

/**
 * Get a claim by ID
 */
export const getClaimById = async (claimId: string): Promise<BusinessClaim | null> => {
  try {
    const claimRef = doc(db, 'businessClaims', claimId);
    const claimDoc = await getDoc(claimRef);

    if (!claimDoc.exists()) return null;
    return {
      id: claimDoc.id,
      ...claimDoc.data(),
    } as BusinessClaim;
  } catch (error) {
    console.error('[BusinessClaimService] Error getting claim:', error);
    return null;
  }
};

/**
 * Delete a claim (for user cancellation or admin cleanup)
 */
export const deleteClaim = async (claimId: string): Promise<void> => {
  try {
    const claimRef = doc(db, 'businessClaims', claimId);
    await deleteDoc(claimRef);
    console.log('[BusinessClaimService] Claim deleted:', claimId);
  } catch (error) {
    console.error('[BusinessClaimService] Error deleting claim:', error);
    throw error;
  }
};

/**
 * Revert a business account back to a personal account
 * This removes all business info from the user's profile
 */
export const revertToPersonalAccount = async (
  userId: string,
  revokedBy: string,
  reason: string
): Promise<void> => {
  console.log('[BusinessClaimService] Reverting user to personal account:', userId);

  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    console.log('[BusinessClaimService] Current user data:', JSON.stringify(userData, null, 2));

    // Update user document to remove business info
    const updateData: any = {
      accountType: 'personal',
      businessInfo: deleteField(), // Remove business info entirely
    };

    // Also remove businessRole if it exists in userDetails
    if (userData.userDetails?.role) {
      updateData['userDetails.role'] = deleteField();
    }

    await updateDoc(userRef, updateData);
    console.log('[BusinessClaimService] User reverted to personal account:', userId);

    // Find and update any approved claims for this user to rejected
    const claimsRef = collection(db, 'businessClaims');
    const q = query(
      claimsRef,
      where('userId', '==', userId),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);

    for (const claimDoc of snapshot.docs) {
      await updateDoc(doc(db, 'businessClaims', claimDoc.id), {
        status: 'rejected',
        reviewedAt: Timestamp.now(),
        reviewedBy: revokedBy,
        reviewNotes: `Claim revoked and account reverted to personal: ${reason}`,
        revertedAt: Timestamp.now(),
      });
      console.log('[BusinessClaimService] Claim reverted:', claimDoc.id);
    }

    console.log('[BusinessClaimService] ✅ Account reversion complete');
  } catch (error) {
    console.error('[BusinessClaimService] ❌ Error reverting account:', error);
    throw error;
  }
};

/**
 * Convert an approved claim to a full business account
 * This creates/updates the user's profile with business info
 */
export const convertClaimToBusinessAccount = async (
  claimId: string,
  placeDetails: {
    name: string;
    address: string;
    category: string;
    phone?: string;
    website?: string;
    location?: { lat: number; lng: number };
    photoUrl?: string;
  }
): Promise<void> => {
  console.log('[BusinessClaimService] Starting conversion for claim:', claimId);
  console.log('[BusinessClaimService] Place details received:', JSON.stringify(placeDetails, null, 2));

  try {
    // Get the claim
    const claim = await getClaimById(claimId);
    console.log('[BusinessClaimService] Fetched claim:', claim ? JSON.stringify(claim, null, 2) : 'null');

    if (!claim) {
      throw new Error('Claim not found');
    }

    if (claim.status !== 'approved') {
      throw new Error(`Claim must be approved before conversion. Current status: ${claim.status}`);
    }

    console.log('[BusinessClaimService] Claim userId:', claim.userId);

    // Update the user's profile with business info
    const userRef = doc(db, 'users', claim.userId);
    const userDoc = await getDoc(userRef);
    console.log('[BusinessClaimService] User document exists:', userDoc.exists());
    if (userDoc.exists()) {
      console.log('[BusinessClaimService] Current user data:', JSON.stringify(userDoc.data(), null, 2));
    }

    const businessInfo = {
      name: placeDetails.name,
      category: placeDetails.category,
      location: placeDetails.address,
      latitude: placeDetails.location?.lat || 0,
      longitude: placeDetails.location?.lng || 0,
      phone: placeDetails.phone || claim.businessPhone || '',
      website: placeDetails.website || '',
      logoUrl: placeDetails.photoUrl || '',
      claimedPlaceId: claim.placeId,
      acceptsStandDiscounts: false,
      customerDiscountPercent: 5,
    };
    console.log('[BusinessClaimService] BusinessInfo to save:', JSON.stringify(businessInfo, null, 2));

    if (!userDoc.exists()) {
      // Create the user document if it doesn't exist yet
      // This handles cases where user submitted a claim before completing onboarding
      console.log('[BusinessClaimService] Creating NEW user document for business claim');
      const newUserDoc = {
        id: claim.userId,
        accountType: 'business',
        businessInfo: businessInfo,
        causes: [],
        searchHistory: [],
        userDetails: {
          name: claim.userName,
          role: claim.businessRole || 'owner',
        },
        email: claim.userEmail,
        fullName: claim.userName,
        isPublicProfile: true,
        createdAt: Timestamp.now(),
      };
      console.log('[BusinessClaimService] New user document:', JSON.stringify(newUserDoc, null, 2));
      await setDoc(userRef, newUserDoc);
      console.log('[BusinessClaimService] ✅ New user document created successfully');
    } else {
      // Update existing user document
      console.log('[BusinessClaimService] Updating EXISTING user document');
      const updateData = {
        accountType: 'business',
        businessInfo: businessInfo,
        'userDetails.role': claim.businessRole || 'owner',
      };
      console.log('[BusinessClaimService] Update data:', JSON.stringify(updateData, null, 2));
      await updateDoc(userRef, updateData);
      console.log('[BusinessClaimService] ✅ User document updated successfully');
    }

    // Verify the update
    const verifyDoc = await getDoc(userRef);
    if (verifyDoc.exists()) {
      const data = verifyDoc.data();
      console.log('[BusinessClaimService] ✅ Verification - accountType:', data.accountType);
      console.log('[BusinessClaimService] ✅ Verification - businessInfo.name:', data.businessInfo?.name);
    }

    // Update the claim to mark it as converted
    const claimRef = doc(db, 'businessClaims', claimId);
    await updateDoc(claimRef, {
      convertedToBusinessAt: Timestamp.now(),
    });

    console.log('[BusinessClaimService] ✅ Claim converted to business account successfully:', claimId);
  } catch (error) {
    console.error('[BusinessClaimService] ❌ Error converting claim to business:', error);
    throw error;
  }
};
