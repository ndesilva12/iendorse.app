/**
 * Migration script to add isVerified: true to all existing users
 *
 * This script updates all existing user profiles to have isVerified = true
 * to mark them as organic/verified accounts (shows blue filled badge).
 *
 * Run with: npx ts-node --esm scripts/addVerifiedToAllUsers.ts
 * Or: node --loader ts-node/esm scripts/addVerifiedToAllUsers.ts
 */

// Use require for CommonJS compatibility
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addVerifiedToAllUsers() {
  console.log('Starting verification migration...');
  console.log('This will add isVerified: true to all existing users.\n');

  try {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    let totalUsers = 0;
    let updatedUsers = 0;
    let alreadyVerified = 0;
    let celebrityAccounts = 0;

    for (const userDoc of usersSnapshot.docs) {
      totalUsers++;
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Skip celebrity accounts (they should keep isCelebrityAccount flag)
      if (userData.isCelebrityAccount === true) {
        celebrityAccounts++;
        console.log(`[SKIP] User ${userId} - celebrity account`);
        continue;
      }

      // Check if already verified
      if (userData.isVerified === true) {
        alreadyVerified++;
        console.log(`[SKIP] User ${userId} - already verified`);
        continue;
      }

      // Update user to be verified
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isVerified: true,
      });

      updatedUsers++;
      const userName = userData.userDetails?.name || userData.fullName || userData.email || 'Unknown';
      console.log(`[UPDATED] User ${userId} (${userName}) - now verified`);
    }

    console.log(`\n========================================`);
    console.log(`Migration complete!`);
    console.log(`========================================`);
    console.log(`Total users processed: ${totalUsers}`);
    console.log(`Users updated to verified: ${updatedUsers}`);
    console.log(`Users already verified: ${alreadyVerified}`);
    console.log(`Celebrity accounts (skipped): ${celebrityAccounts}`);
    console.log(`\nAll organic users now have isVerified: true and will show blue badges.`);

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// Run the migration
addVerifiedToAllUsers()
  .then(() => {
    console.log('\nMigration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
