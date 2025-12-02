/**
 * Top Rankings Service
 * Calculates most endorsed brands and businesses across all users
 * with position-weighted scoring
 */

import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { Product } from '@/types';
import { BusinessUser } from './businessService';

interface RankedItem {
  id: string;
  name: string;
  category?: string;
  website?: string;
  logoUrl?: string;
  score: number;
  endorsementCount: number;
}

/**
 * Calculate position weight
 * Position 1 = 100 points, Position 2 = 95 points, etc.
 * Diminishing returns after position 10
 */
function getPositionWeight(position: number): number {
  if (position === 1) return 100;
  if (position === 2) return 95;
  if (position === 3) return 90;
  if (position === 4) return 85;
  if (position === 5) return 80;
  if (position === 6) return 75;
  if (position === 7) return 70;
  if (position === 8) return 65;
  if (position === 9) return 60;
  if (position === 10) return 55;
  // After position 10, diminishing returns
  if (position <= 20) return 50 - ((position - 10) * 2);
  if (position <= 50) return 30 - ((position - 20));
  return Math.max(1, 10 - (position - 50) / 10);
}

/**
 * Fetch top endorsed brands globally
 * @param limit - Number of top brands to return
 * @returns Array of top ranked brands with scores
 */
export async function getTopBrands(limit: number = 50): Promise<RankedItem[]> {
  try {
    console.log('[TopRankings] Fetching top brands...');

    // Fetch all brands from the brands collection to get accurate names and logos
    const brandsRef = collection(db, 'brands');
    const brandsSnapshot = await getDocs(brandsRef);
    const brandsMap = new Map<string, { name: string; category?: string; website?: string; logoUrl?: string }>();

    brandsSnapshot.forEach((doc) => {
      const brandData = doc.data();
      brandsMap.set(doc.id, {
        name: brandData.name || brandData.brand || 'Unknown Brand',
        category: brandData.category,
        website: brandData.website,
        logoUrl: brandData.logoUrl || brandData.logo,
      });
    });

    console.log(`[TopRankings] Loaded ${brandsMap.size} brands from database`);

    // Fetch all user lists from Firebase (all lists now in userLists collection)
    const userListsRef = collection(db, 'userLists');
    const userListsQuery = query(userListsRef);
    const userListsSnapshot = await getDocs(userListsQuery);

    // Map to track brand scores: brandId -> { score, count, name, etc }
    const brandScores = new Map<string, {
      score: number;
      count: number;
      name: string;
      category?: string;
      website?: string;
      logoUrl?: string;
    }>();

    // Process each list
    userListsSnapshot.forEach((docSnap) => {
      const listData = docSnap.data();

      // Only process lists that have entries
      if (!listData.entries || !Array.isArray(listData.entries)) return;

      // Process each entry with position weighting
      listData.entries.forEach((entry: any, index: number) => {
        // Only count brand entries
        if (entry.type !== 'brand' || !entry.brandId) return;

        const position = index + 1; // Position is 1-indexed
        const weight = getPositionWeight(position);

        // Look up brand details from the brands collection first, then fall back to entry data
        const brandDetails = brandsMap.get(entry.brandId);

        const existing = brandScores.get(entry.brandId);
        if (existing) {
          existing.score += weight;
          existing.count += 1;
        } else {
          brandScores.set(entry.brandId, {
            score: weight,
            count: 1,
            name: brandDetails?.name || entry.brandName || 'Unknown Brand',
            category: brandDetails?.category || entry.brandCategory,
            website: brandDetails?.website || entry.website,
            logoUrl: brandDetails?.logoUrl || entry.logoUrl,
          });
        }
      });
    });

    // Convert to array and sort by score
    const rankedBrands: RankedItem[] = Array.from(brandScores.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        category: data.category,
        website: data.website,
        logoUrl: data.logoUrl,
        score: data.score,
        endorsementCount: data.count,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`[TopRankings] Found ${rankedBrands.length} top brands`);
    return rankedBrands;
  } catch (error) {
    console.error('[TopRankings] Error fetching top brands:', error);
    return [];
  }
}

/**
 * Fetch top endorsed businesses globally (or within distance)
 * @param limit - Number of top businesses to return
 * @param userLocation - Optional user location for distance filtering
 * @param maxDistance - Optional max distance in miles
 * @returns Array of top ranked businesses with scores
 */
export async function getTopBusinesses(
  limit: number = 50,
  userLocation?: { latitude: number; longitude: number } | null,
  maxDistance?: number
): Promise<RankedItem[]> {
  try {
    console.log('[TopRankings] Fetching top businesses...');

    // Fetch all business accounts from users collection to get accurate names and logos
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const businessesMap = new Map<string, { name: string; category?: string; website?: string; logoUrl?: string; location?: { latitude: number; longitude: number } }>();

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.accountType === 'business' && userData.businessInfo) {
        businessesMap.set(doc.id, {
          name: userData.businessInfo.name || 'Unknown Business',
          category: userData.businessInfo.category,
          website: userData.businessInfo.website,
          logoUrl: userData.businessInfo.logoUrl,
          location: userData.businessInfo.location,
        });
      }
    });

    console.log(`[TopRankings] Loaded ${businessesMap.size} businesses from database`);

    // Fetch all user lists from Firebase (all lists now in userLists collection)
    const userListsRef = collection(db, 'userLists');
    const userListsQuery = query(userListsRef);
    const userListsSnapshot = await getDocs(userListsQuery);

    // Map to track business scores: businessId -> { score, count, name, etc }
    const businessScores = new Map<string, {
      score: number;
      count: number;
      name: string;
      category?: string;
      website?: string;
      logoUrl?: string;
      location?: { latitude: number; longitude: number };
    }>();

    // Process each list
    userListsSnapshot.forEach((docSnap) => {
      const listData = docSnap.data();

      // Only process lists that have entries
      if (!listData.entries || !Array.isArray(listData.entries)) return;

      // Process each entry with position weighting
      listData.entries.forEach((entry: any, index: number) => {
        // Only count business entries
        if (entry.type !== 'business' || !entry.businessId) return;

        const position = index + 1; // Position is 1-indexed
        const weight = getPositionWeight(position);

        // Look up business details from the users collection first, then fall back to entry data
        const businessDetails = businessesMap.get(entry.businessId);

        const existing = businessScores.get(entry.businessId);
        if (existing) {
          existing.score += weight;
          existing.count += 1;
        } else {
          businessScores.set(entry.businessId, {
            score: weight,
            count: 1,
            name: businessDetails?.name || (entry as any).businessName || 'Unknown Business',
            category: businessDetails?.category || (entry as any).businessCategory,
            website: businessDetails?.website || (entry as any).website,
            logoUrl: businessDetails?.logoUrl || (entry as any).logoUrl,
            location: businessDetails?.location || (entry as any).location,
          });
        }
      });
    });

    // Convert to array
    let rankedBusinesses: RankedItem[] = Array.from(businessScores.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        category: data.category,
        website: data.website,
        logoUrl: data.logoUrl,
        score: data.score,
        endorsementCount: data.count,
      }));

    // Apply distance filter if location provided
    if (userLocation && maxDistance) {
      console.log(`[TopRankings] Filtering businesses within ${maxDistance} miles`);

      // Fetch business details to get locations
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);

      const businessLocations = new Map<string, { latitude: number; longitude: number }>();
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.accountType === 'business' && userData.businessInfo?.location) {
          businessLocations.set(doc.id, userData.businessInfo.location);
        }
      });

      // Filter by distance
      rankedBusinesses = rankedBusinesses.filter((business) => {
        const location = businessLocations.get(business.id);
        if (!location) return false;

        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          location.latitude,
          location.longitude
        );
        return distance <= maxDistance;
      });
    }

    // Sort by score and limit
    rankedBusinesses = rankedBusinesses
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`[TopRankings] Found ${rankedBusinesses.length} top businesses`);
    return rankedBusinesses;
  } catch (error) {
    console.error('[TopRankings] Error fetching top businesses:', error);
    return [];
  }
}

/**
 * Calculate distance between two coordinates in miles
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
