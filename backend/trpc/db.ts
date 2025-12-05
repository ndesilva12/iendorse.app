import { UserProfile } from "@/types";

// Edge Runtime compatible in-memory storage
// Note: Data will be reset on cold starts. For production, consider using Vercel KV or another Edge-compatible database.
const userProfiles = new Map<string, UserProfile>();

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const profile = userProfiles.get(userId);
  if (!profile) {
    // Return default profile for new users
    return {
      causes: [],
      searchHistory: [],
    };
  }
  return profile;
}

export async function saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
  userProfiles.set(userId, profile);
  console.log('[DB] Saved profile for user:', userId, 'with', profile.causes?.length || 0, 'causes');
}
