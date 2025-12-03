import { collection, query, where, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/firebase';
import { BusinessInfo, Cause } from '@/types';

export interface BusinessUser {
  id: string; // User ID
  email?: string;
  businessInfo: BusinessInfo;
  causes?: Cause[]; // Business's selected values
  distance?: number; // Calculated distance from user
  alignmentScore?: number; // Alignment score with viewing user (0-100)
}

/**
 * Get all businesses that accept Endorse discounts from Firebase
 * Only includes businesses with acceptsStandDiscounts=true AND (customerDiscountPercent > 0 OR customDiscount set)
 * This ensures businesses with discounts "turned off" don't appear in the money tab
 * @returns Array of business users
 */
export async function getBusinessesAcceptingDiscounts(): Promise<BusinessUser[]> {
  try {
    console.log('[Firebase businessService] 🔄 Fetching businesses accepting Endorse discounts');

    if (!db) {
      console.error('[Firebase businessService] ❌ db is null or undefined!');
      throw new Error('Firebase db not initialized');
    }

    // Query all business accounts and filter client-side for those offering discounts
    // (Firestore doesn't support OR conditions across different fields)
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('accountType', '==', 'business')
    );

    const querySnapshot = await getDocs(q);
    console.log('[Firebase businessService] 📦 Found', querySnapshot.size, 'business accounts total');

    const businesses: BusinessUser[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Validate that businessInfo exists and has required fields
      if (data.businessInfo && data.businessInfo.name) {
        const businessInfo = data.businessInfo;

        // Only include businesses that have discounts ENABLED (acceptsStandDiscounts === true)
        // AND have some discount configured (percentage or custom)
        const acceptsDiscounts = businessInfo.acceptsStandDiscounts === true;
        const hasDiscount = (businessInfo.customerDiscountPercent || 0) > 0;
        const hasCustomDiscount = businessInfo.customDiscount && businessInfo.customDiscount.trim();

        // Must have discounts enabled AND at least one discount configured
        if (acceptsDiscounts && (hasDiscount || hasCustomDiscount)) {
          businesses.push({
            id: doc.id,
            email: data.email,
            businessInfo: businessInfo as BusinessInfo,
            causes: data.causes as Cause[] || [], // Include causes for alignment scoring
          });
          console.log('[Firebase businessService] ✅ Including business:', businessInfo.name,
            '| acceptsDiscounts:', acceptsDiscounts,
            '| discountPercent:', businessInfo.customerDiscountPercent || 0,
            '| hasCustomDiscount:', !!hasCustomDiscount);
        }
      } else {
        console.warn('[Firebase businessService] ⚠️ Business missing businessInfo:', doc.id);
      }
    });

    console.log('[Firebase businessService] ✅ Returning', businesses.length, 'businesses offering discounts');
    console.log('[Firebase businessService] Sample business causes:', businesses[0]?.causes?.length || 0);
    return businesses;
  } catch (error) {
    console.error('[Firebase businessService] ❌ Error fetching businesses:', error);
    if (error instanceof Error) {
      console.error('[Firebase businessService] Error message:', error.message);
      console.error('[Firebase businessService] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get all user businesses (regardless of discount acceptance) from Firebase
 * @returns Array of all business users
 */
export async function getAllUserBusinesses(): Promise<BusinessUser[]> {
  try {
    console.log('[Firebase businessService] 🔄 Fetching all user businesses');

    if (!db) {
      console.error('[Firebase businessService] ❌ db is null or undefined!');
      throw new Error('Firebase db not initialized');
    }

    // Query users collection for all business accounts
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('accountType', '==', 'business')
    );

    const querySnapshot = await getDocs(q);
    console.log('[Firebase businessService] 📦 Found', querySnapshot.size, 'businesses');

    const businesses: BusinessUser[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Validate that businessInfo exists and has required fields
      if (data.businessInfo && data.businessInfo.name) {
        businesses.push({
          id: doc.id,
          email: data.email,
          businessInfo: data.businessInfo as BusinessInfo,
          causes: data.causes || [], // Include the business's selected values
        });
      } else {
        console.warn('[Firebase businessService] ⚠️ Business missing businessInfo:', doc.id);
      }
    });

    console.log('[Firebase businessService] ✅ Returning', businesses.length, 'valid businesses');
    return businesses;
  } catch (error) {
    console.error('[Firebase businessService] ❌ Error fetching all businesses:', error);
    if (error instanceof Error) {
      console.error('[Firebase businessService] Error message:', error.message);
      console.error('[Firebase businessService] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Calculate alignment score between user and business based on their selected values
 *
 * WEIGHTED Scoring method (focuses ONLY on shared positions with importance weighting):
 * - Only counts values where BOTH parties have taken a position (support or avoid)
 * - Ignores values where only one party has selected (neutral = doesn't count)
 * - Applies weights to values based on category and individual importance
 * - Perfect match: 100 (all shared positions align)
 * - Complete opposite: 0 (all shared positions conflict)
 * - No overlap: 50 (neutral - no shared positions to compare)
 *
 * Scoring rules:
 * - Both support same value: +weight points (alignment)
 * - Both avoid same value: +weight points (alignment)
 * - One supports, other avoids: -weight points (conflict)
 * - One has position, other neutral: 0 points (IGNORED - doesn't count)
 *
 * Final Score = (weighted_matches / (weighted_matches + weighted_conflicts)) * 100
 *
 * @param userCauses Array of user's selected causes
 * @param businessCauses Array of business's selected causes
 * @returns Alignment score from 0-100
 */
export function calculateAlignmentScore(
  userCauses: Cause[],
  businessCauses: Cause[]
): number {
  // Calculate raw alignment score - will be normalized later to create bell curve
  // Simple scoring: count matches, conflicts, and partial matches

  // Create sets for quick lookup
  const userSupportSet = new Set(userCauses.filter(c => c.type === 'support').map(c => c.id));
  const userAvoidSet = new Set(userCauses.filter(c => c.type === 'avoid').map(c => c.id));
  const bizSupportSet = new Set(businessCauses.filter(c => c.type === 'support').map(c => c.id));
  const bizAvoidSet = new Set(businessCauses.filter(c => c.type === 'avoid').map(c => c.id));

  // Get all unique value IDs from both user and business
  const allValueIds = new Set([
    ...userSupportSet,
    ...userAvoidSet,
    ...bizSupportSet,
    ...bizAvoidSet,
  ]);

  let matches = 0;      // Both agree (support-support or avoid-avoid)
  let conflicts = 0;    // Both disagree (support-avoid or avoid-support)
  let partialMatch = 0; // Only one has a position

  // Check alignment for each value where at least one has a position
  allValueIds.forEach(valueId => {
    const userSupports = userSupportSet.has(valueId);
    const userAvoids = userAvoidSet.has(valueId);
    const bizSupports = bizSupportSet.has(valueId);
    const bizAvoids = bizAvoidSet.has(valueId);

    const userHasPosition = userSupports || userAvoids;
    const bizHasPosition = bizSupports || bizAvoids;

    if (userHasPosition && bizHasPosition) {
      // Both have positions - check if they match or conflict
      if ((userSupports && bizSupports) || (userAvoids && bizAvoids)) {
        matches++;
      } else if ((userSupports && bizAvoids) || (userAvoids && bizSupports)) {
        conflicts++;
      }
    } else if (userHasPosition || bizHasPosition) {
      // Only one has a position
      partialMatch++;
    }
  });

  // Simple raw score calculation
  // Give weight to matches and conflicts, penalize partial matches
  const rawScore = (matches * 10) - (conflicts * 10) - (partialMatch * 3);

  return rawScore;
}

/**
 * Normalize scores to create a bell curve distribution
 * Maps scores to 10-90 range with midpoint at 50
 *
 * @param scores Array of raw scores
 * @returns Array of normalized scores (10-90 range)
 */
export function normalizeScores(scores: number[]): number[] {
  if (scores.length === 0) return [];
  if (scores.length === 1) return [50]; // Single score gets midpoint

  // Find min and max
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  // If all scores are the same, return midpoint
  if (minScore === maxScore) {
    return scores.map(() => 50);
  }

  // Normalize to 10-90 range with linear scaling
  return scores.map(score => {
    const normalized = ((score - minScore) / (maxScore - minScore)) * 80 + 10;
    return Math.round(normalized);
  });
}

/**
 * Check if a business has ANY location within the specified distance from user
 * @param business Business user object
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param maxDistance Maximum distance in miles
 * @returns Object with isWithinRange boolean and closest distance
 */
export function isBusinessWithinRange(
  business: BusinessUser,
  userLat: number,
  userLon: number,
  maxDistance: number
): { isWithinRange: boolean; closestDistance?: number; closestLocation?: string } {
  const businessInfo = business.businessInfo;

  // Check new locations array first (preferred)
  if (businessInfo.locations && businessInfo.locations.length > 0) {
    let closestDistance = Infinity;
    let closestAddress = '';

    for (const location of businessInfo.locations) {
      const distance = calculateDistance(userLat, userLon, location.latitude, location.longitude);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestAddress = location.address;
      }
    }

    return {
      isWithinRange: closestDistance <= maxDistance,
      closestDistance: closestDistance === Infinity ? undefined : closestDistance,
      closestLocation: closestAddress || undefined,
    };
  }

  // Fallback to old single location fields (backwards compatibility)
  if (businessInfo.latitude && businessInfo.longitude) {
    const distance = calculateDistance(userLat, userLon, businessInfo.latitude, businessInfo.longitude);
    return {
      isWithinRange: distance <= maxDistance,
      closestDistance: distance,
      closestLocation: businessInfo.location,
    };
  }

  // No location data available
  return {
    isWithinRange: false,
    closestDistance: undefined,
    closestLocation: undefined,
  };
}
