import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';

export type FollowableType = 'user' | 'brand' | 'business';

export interface Follow {
  id: string;
  followerId: string; // User who is following
  followedId: string; // ID of the entity being followed (user/brand/business)
  followedType: FollowableType; // Type of entity being followed
  createdAt: Date;
}

/**
 * Follow a user, brand, or business
 * Creates a follow record and updates both follower and followed counts
 */
export async function followEntity(
  followerId: string,
  followedId: string,
  followedType: FollowableType
): Promise<void> {
  if (!followerId || !followedId) {
    throw new Error('Follower ID and Followed ID are required');
  }

  if (followerId === followedId && followedType === 'user') {
    throw new Error('Cannot follow yourself');
  }

  try {
    // Check if already following
    const existingFollow = await isFollowing(followerId, followedId, followedType);
    if (existingFollow) {
      console.log('[followService] Already following this entity');
      return;
    }

    // Create follow record
    const followsRef = collection(db, 'follows');
    await addDoc(followsRef, {
      followerId,
      followedId,
      followedType,
      createdAt: Timestamp.now(),
    });

    console.log(`[followService] Successfully followed ${followedType} ${followedId}`);
  } catch (error) {
    console.error('[followService] Error following entity:', error);
    throw error;
  }
}

/**
 * Unfollow a user, brand, or business
 * Removes the follow record
 */
export async function unfollowEntity(
  followerId: string,
  followedId: string,
  followedType: FollowableType
): Promise<void> {
  if (!followerId || !followedId) {
    throw new Error('Follower ID and Followed ID are required');
  }

  try {
    // Find the follow record
    const followsRef = collection(db, 'follows');
    const q = query(
      followsRef,
      where('followerId', '==', followerId),
      where('followedId', '==', followedId),
      where('followedType', '==', followedType)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('[followService] No follow record found to delete');
      return;
    }

    // Delete all matching records (should only be one)
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    console.log(`[followService] Successfully unfollowed ${followedType} ${followedId}`);
  } catch (error) {
    console.error('[followService] Error unfollowing entity:', error);
    throw error;
  }
}

/**
 * Check if a user is following a specific entity
 */
export async function isFollowing(
  followerId: string,
  followedId: string,
  followedType: FollowableType
): Promise<boolean> {
  if (!followerId || !followedId) {
    return false;
  }

  try {
    const followsRef = collection(db, 'follows');
    const q = query(
      followsRef,
      where('followerId', '==', followerId),
      where('followedId', '==', followedId),
      where('followedType', '==', followedType)
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('[followService] Error checking follow status:', error);
    return false;
  }
}

/**
 * Get count of entities a user is following
 */
export async function getFollowingCount(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const followsRef = collection(db, 'follows');
    const q = query(followsRef, where('followerId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('[followService] Error getting following count:', error);
    return 0;
  }
}

/**
 * Get count of followers for an entity (user, brand, or business)
 */
export async function getFollowersCount(
  entityId: string,
  entityType: FollowableType
): Promise<number> {
  if (!entityId) return 0;

  try {
    const followsRef = collection(db, 'follows');
    const q = query(
      followsRef,
      where('followedId', '==', entityId),
      where('followedType', '==', entityType)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('[followService] Error getting followers count:', error);
    return 0;
  }
}

/**
 * Get all entities a user is following
 */
export async function getFollowing(userId: string): Promise<Follow[]> {
  if (!userId) return [];

  try {
    const followsRef = collection(db, 'follows');
    const q = query(followsRef, where('followerId', '==', userId));
    const querySnapshot = await getDocs(q);

    const following: Follow[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      following.push({
        id: doc.id,
        followerId: data.followerId,
        followedId: data.followedId,
        followedType: data.followedType,
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    });

    return following;
  } catch (error) {
    console.error('[followService] Error getting following:', error);
    return [];
  }
}

/**
 * Get all followers of an entity
 */
export async function getFollowers(
  entityId: string,
  entityType: FollowableType
): Promise<Follow[]> {
  if (!entityId) return [];

  try {
    const followsRef = collection(db, 'follows');
    const q = query(
      followsRef,
      where('followedId', '==', entityId),
      where('followedType', '==', entityType)
    );
    const querySnapshot = await getDocs(q);

    const followers: Follow[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      followers.push({
        id: doc.id,
        followerId: data.followerId,
        followedId: data.followedId,
        followedType: data.followedType,
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    });

    return followers;
  } catch (error) {
    console.error('[followService] Error getting followers:', error);
    return [];
  }
}

/**
 * Delete all follow relationships for a user (when user is deleted)
 * This removes:
 * - All follows where this user is following others
 * - All follows where others are following this user
 */
export async function deleteAllFollowsForUser(userId: string): Promise<{ deleted: number; errors: string[] }> {
  const result = { deleted: 0, errors: [] as string[] };

  if (!userId) {
    result.errors.push('User ID is required');
    return result;
  }

  try {
    const followsRef = collection(db, 'follows');
    const batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500; // Firestore limit

    // Find all follows where this user is the follower
    const followingQuery = query(followsRef, where('followerId', '==', userId));
    const followingSnapshot = await getDocs(followingQuery);

    for (const docSnapshot of followingSnapshot.docs) {
      batch.delete(docSnapshot.ref);
      batchCount++;
      result.deleted++;

      // Commit batch if we hit the limit
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Find all follows where this user is being followed
    const followersQuery = query(
      followsRef,
      where('followedId', '==', userId),
      where('followedType', '==', 'user')
    );
    const followersSnapshot = await getDocs(followersQuery);

    for (const docSnapshot of followersSnapshot.docs) {
      batch.delete(docSnapshot.ref);
      batchCount++;
      result.deleted++;

      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Commit any remaining deletes
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[followService] Deleted ${result.deleted} follow relationships for user ${userId}`);
    return result;
  } catch (error) {
    console.error('[followService] Error deleting follows for user:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

/**
 * Delete all follow relationships for an entity (brand or business)
 * This removes all follows where this entity is being followed
 */
export async function deleteAllFollowsForEntity(
  entityId: string,
  entityType: 'brand' | 'business'
): Promise<{ deleted: number; errors: string[] }> {
  const result = { deleted: 0, errors: [] as string[] };

  if (!entityId) {
    result.errors.push('Entity ID is required');
    return result;
  }

  try {
    const followsRef = collection(db, 'follows');
    const batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500;

    // Find all follows where this entity is being followed
    const followersQuery = query(
      followsRef,
      where('followedId', '==', entityId),
      where('followedType', '==', entityType)
    );
    const followersSnapshot = await getDocs(followersQuery);

    for (const docSnapshot of followersSnapshot.docs) {
      batch.delete(docSnapshot.ref);
      batchCount++;
      result.deleted++;

      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Commit any remaining deletes
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[followService] Deleted ${result.deleted} follow relationships for ${entityType} ${entityId}`);
    return result;
  } catch (error) {
    console.error(`[followService] Error deleting follows for ${entityType}:`, error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}
