/**
 * Admin Panel - Users Management
 *
 * Edit ALL fields for user accounts
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCustomFields, CustomField } from '@/services/firebase/customFieldsService';
import { getUserLists, deleteList, removeEntryFromList, addEntryToList, updateEntryInList, getEndorsementList, createList, ensureEndorsementList } from '@/services/firebase/listService';
import { UserList, ListEntry } from '@/types/library';
import { getFollowing, getFollowers, followEntity, unfollowEntity, Follow, FollowableType } from '@/services/firebase/followService';
import { getCumulativeDays, updateEndorsementMetrics, handleBackdateEntry, migrateEndorsementHistory } from '@/services/firebase/endorsementHistoryService';
import { Picker } from '@react-native-picker/picker';
import { pickAndUploadImage } from '@/lib/imageUpload';
import { trpc } from '@/lib/trpc';

interface SocialMedia {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  yelp?: string;
  youtube?: string;
}

interface UserDetails {
  name?: string;
  description?: string;
  website?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  socialMedia?: SocialMedia;
}

interface Cause {
  id: string;
  name: string;
  category: string;
  type: 'support' | 'avoid';
}

interface Charity {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface UserData {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  userDetails?: UserDetails;
  causes: Cause[];
  searchHistory: string[];
  promoCode?: string;
  donationAmount?: number;
  selectedCharities?: Charity[];
  consentGivenAt?: string;
  consentVersion?: string;
  referralSource?: string; // QR code/location tracking for signups
  createdAt?: any; // Firestore Timestamp
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkData, setBulkData] = useState('');

  // Create user form state
  const [createUserId, setCreateUserId] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  const [createProfileImageUrl, setCreateProfileImageUrl] = useState('');
  const [createCoverImageUrl, setCreateCoverImageUrl] = useState('');
  const [createCauses, setCreateCauses] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Form state - Basic Info
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formFullName, setFormFullName] = useState('');

  // Form state - User Details
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formLatitude, setFormLatitude] = useState('');
  const [formLongitude, setFormLongitude] = useState('');
  const [formProfileImageUrl, setFormProfileImageUrl] = useState('');
  const [formCoverImageUrl, setFormCoverImageUrl] = useState('');

  // Upload states
  const [editProfileUploading, setEditProfileUploading] = useState(false);
  const [editCoverUploading, setEditCoverUploading] = useState(false);
  const [createProfileUploading, setCreateProfileUploading] = useState(false);
  const [createCoverUploading, setCreateCoverUploading] = useState(false);

  // Form state - Social Media
  const [formFacebook, setFormFacebook] = useState('');
  const [formInstagram, setFormInstagram] = useState('');
  const [formTwitter, setFormTwitter] = useState('');
  const [formLinkedin, setFormLinkedin] = useState('');
  const [formYelp, setFormYelp] = useState('');
  const [formYoutube, setFormYoutube] = useState('');

  // Form state - Other fields
  const [formCauses, setFormCauses] = useState('');
  const [formSearchHistory, setFormSearchHistory] = useState('');
  const [formConsentGivenAt, setFormConsentGivenAt] = useState('');
  const [formConsentVersion, setFormConsentVersion] = useState('');

  // List management state
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [newEntryBrandId, setNewEntryBrandId] = useState('');
  const [newEntryBusinessId, setNewEntryBusinessId] = useState('');
  const [editingEntryDateId, setEditingEntryDateId] = useState<string | null>(null);
  const [editingEntryDateValue, setEditingEntryDateValue] = useState('');

  // Followers/Following management state
  const [userFollowers, setUserFollowers] = useState<Follow[]>([]);
  const [userFollowing, setUserFollowing] = useState<Follow[]>([]);
  const [loadingFollows, setLoadingFollows] = useState(false);
  const [expandedFollowSection, setExpandedFollowSection] = useState<'followers' | 'following' | null>(null);
  const [addingFollowType, setAddingFollowType] = useState<'follower' | 'following' | null>(null);
  const [newFollowId, setNewFollowId] = useState('');
  const [newFollowEntityType, setNewFollowEntityType] = useState<FollowableType>('user');

  // Endorsement management state
  const [endorsementList, setEndorsementList] = useState<UserList | null>(null);
  const [loadingEndorsements, setLoadingEndorsements] = useState(false);
  const [expandedEndorsements, setExpandedEndorsements] = useState(false);
  const [addingEndorsement, setAddingEndorsement] = useState(false);
  const [newEndorsementType, setNewEndorsementType] = useState<'brand' | 'business'>('brand');
  const [newEndorsementId, setNewEndorsementId] = useState('');
  const [newEndorsementName, setNewEndorsementName] = useState('');
  const [endorsementMetrics, setEndorsementMetrics] = useState<Record<string, { totalDaysEndorsed: number; totalDaysInTop5: number; totalDaysInTop10: number }>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [editingMetricsEntityId, setEditingMetricsEntityId] = useState<string | null>(null);
  const [editingMetricsValues, setEditingMetricsValues] = useState<{ top5: string; top10: string }>({ top5: '', top10: '' });
  const [migratingHistory, setMigratingHistory] = useState(false);

  // Impersonation state
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  // Impersonation mutation
  const impersonateMutation = trpc.admin.impersonate.useMutation({
    onSuccess: (data) => {
      setImpersonatingUserId(null);
      if (data.signInUrl) {
        const message = `Impersonation link generated for ${data.targetUserName} (${data.targetUserEmail}).\n\nThe link will expire in 5 minutes.\n\nClick OK to open the sign-in link in a new tab. You will be logged in as this user.`;

        if (Platform.OS === 'web') {
          if (window.confirm(message)) {
            window.open(data.signInUrl, '_blank');
          }
        } else {
          Alert.alert(
            'Impersonation Ready',
            message,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Link', onPress: () => Linking.openURL(data.signInUrl) }
            ]
          );
        }
      }
    },
    onError: (error) => {
      setImpersonatingUserId(null);
      const errorMessage = error.message || 'Failed to generate impersonation link';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Impersonation Error', errorMessage);
      }
    },
  });

  const handleImpersonate = (user: UserData) => {
    const confirmMessage = `Are you sure you want to impersonate "${user.userDetails?.name || user.email}"?\n\nThis will generate a one-time sign-in link that lets you log in as this user.`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        setImpersonatingUserId(user.userId);
        impersonateMutation.mutate({ targetUserId: user.userId });
      }
    } else {
      Alert.alert(
        'Impersonate User',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Impersonate',
            onPress: () => {
              setImpersonatingUserId(user.userId);
              impersonateMutation.mutate({ targetUserId: user.userId });
            }
          }
        ]
      );
    }
  };

  useEffect(() => {
    loadUsers();
    loadCustomFields();
  }, []);

  const loadCustomFields = async () => {
    try {
      const fields = await getCustomFields('users');
      setCustomFields(fields);
    } catch (error) {
      console.error('Error loading custom fields:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('accountType', '==', 'individual'));
      const snapshot = await getDocs(q);

      const loadedUsers: UserData[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          userId: doc.id,
          email: data.email || 'No email',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          fullName: data.fullName || '',
          userDetails: data.userDetails || {},
          causes: data.causes || [],
          searchHistory: data.searchHistory || [],
          promoCode: data.promoCode || '',
          donationAmount: data.donationAmount || 0,
          selectedCharities: data.selectedCharities || [],
          consentGivenAt: data.consentGivenAt || '',
          consentVersion: data.consentVersion || '',
          referralSource: data.referralSource || '', // QR code/location tracking
          createdAt: data.createdAt || null,
        };
      });

      setUsers(loadedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users from Firebase');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);

    // Basic info
    setFormFirstName(user.firstName || '');
    setFormLastName(user.lastName || '');
    setFormFullName(user.fullName || '');

    // User details
    const details = user.userDetails || {};
    setFormName(details.name || '');
    setFormDescription(details.description || '');
    setFormWebsite(details.website || '');
    setFormLocation(details.location || '');
    setFormLatitude(details.latitude?.toString() || '');
    setFormLongitude(details.longitude?.toString() || '');
    setFormProfileImageUrl((details as any).profileImage || '');
    setFormCoverImageUrl((details as any).coverImage || '');

    // Social media
    const social = details.socialMedia || {};
    setFormFacebook(social.facebook || '');
    setFormInstagram(social.instagram || '');
    setFormTwitter(social.twitter || '');
    setFormLinkedin(social.linkedin || '');
    setFormYelp(social.yelp || '');
    setFormYoutube(social.youtube || '');

    // Causes (formatted as id|name|category|type)
    setFormCauses(
      user.causes?.map((c) => `${c.id}|${c.name}|${c.category}|${c.type}`).join('\n') || ''
    );

    // Search history (one per line)
    setFormSearchHistory(user.searchHistory?.join('\n') || '');

    // Consent
    setFormConsentGivenAt(user.consentGivenAt || '');
    setFormConsentVersion(user.consentVersion || '');

    // Load custom field values from user data
    const customValues: Record<string, any> = {};
    customFields.forEach((field) => {
      customValues[field.fieldName] = (user as any)[field.fieldName] || field.defaultValue || '';
    });
    setCustomFieldValues(customValues);

    setShowModal(true);

    // Load user's lists, follows, and endorsements
    if (user.userId) {
      loadUserLists(user.userId);
      loadUserFollows(user.userId);
      loadUserEndorsements(user.userId);
    }
  };

  const loadUserLists = async (userId: string) => {
    setLoadingLists(true);
    try {
      const lists = await getUserLists(userId);
      setUserLists(lists);
    } catch (error) {
      console.error('[Admin] Error loading user lists:', error);
      if (Platform.OS === 'web') {
        window.alert('Error loading user lists');
      } else {
        Alert.alert('Error', 'Could not load user lists');
      }
    } finally {
      setLoadingLists(false);
    }
  };

  // Load followers and following for a user
  const loadUserFollows = async (userId: string) => {
    setLoadingFollows(true);
    try {
      const [followers, following] = await Promise.all([
        getFollowers(userId, 'user'),
        getFollowing(userId),
      ]);
      setUserFollowers(followers);
      setUserFollowing(following);
    } catch (error) {
      console.error('[Admin] Error loading follows:', error);
      if (Platform.OS === 'web') {
        window.alert('Error loading followers/following');
      } else {
        Alert.alert('Error', 'Could not load followers/following');
      }
    } finally {
      setLoadingFollows(false);
    }
  };

  // Add a new follower to the user (someone follows this user)
  const handleAddFollower = async () => {
    if (!editingUser || !newFollowId.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a User ID');
      } else {
        Alert.alert('Error', 'Please enter a User ID');
      }
      return;
    }

    try {
      // The newFollowId is the person who will follow the editingUser
      await followEntity(newFollowId.trim(), editingUser.userId, 'user');
      await loadUserFollows(editingUser.userId);
      setNewFollowId('');
      setAddingFollowType(null);

      if (Platform.OS === 'web') {
        window.alert(`User ${newFollowId.trim()} now follows this user`);
      } else {
        Alert.alert('Success', `User ${newFollowId.trim()} now follows this user`);
      }
    } catch (error: any) {
      console.error('[Admin] Error adding follower:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message || 'Could not add follower'}`);
      } else {
        Alert.alert('Error', error.message || 'Could not add follower');
      }
    }
  };

  // Add a new following (this user follows someone/something)
  const handleAddFollowing = async () => {
    if (!editingUser || !newFollowId.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter an ID');
      } else {
        Alert.alert('Error', 'Please enter an ID');
      }
      return;
    }

    try {
      // The editingUser will follow the newFollowId entity
      await followEntity(editingUser.userId, newFollowId.trim(), newFollowEntityType);
      await loadUserFollows(editingUser.userId);
      setNewFollowId('');
      setNewFollowEntityType('user');
      setAddingFollowType(null);

      if (Platform.OS === 'web') {
        window.alert(`This user now follows ${newFollowEntityType} ${newFollowId.trim()}`);
      } else {
        Alert.alert('Success', `This user now follows ${newFollowEntityType} ${newFollowId.trim()}`);
      }
    } catch (error: any) {
      console.error('[Admin] Error adding following:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message || 'Could not add following'}`);
      } else {
        Alert.alert('Error', error.message || 'Could not add following');
      }
    }
  };

  // Remove a follower (someone stops following this user)
  const handleRemoveFollower = async (followerUserId: string) => {
    if (!editingUser) return;

    const confirmRemove = Platform.OS === 'web'
      ? window.confirm(`Remove ${followerUserId} as a follower of this user?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Remove Follower',
            `Remove ${followerUserId} as a follower of this user?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmRemove) return;

    try {
      await unfollowEntity(followerUserId, editingUser.userId, 'user');
      await loadUserFollows(editingUser.userId);

      if (Platform.OS === 'web') {
        window.alert('Follower removed');
      } else {
        Alert.alert('Success', 'Follower removed');
      }
    } catch (error) {
      console.error('[Admin] Error removing follower:', error);
      if (Platform.OS === 'web') {
        window.alert('Error removing follower');
      } else {
        Alert.alert('Error', 'Could not remove follower');
      }
    }
  };

  // Remove a following (this user stops following someone/something)
  const handleRemoveFollowing = async (follow: Follow) => {
    if (!editingUser) return;

    const confirmRemove = Platform.OS === 'web'
      ? window.confirm(`Stop this user from following ${follow.followedType} ${follow.followedId}?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Remove Following',
            `Stop this user from following ${follow.followedType} ${follow.followedId}?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmRemove) return;

    try {
      await unfollowEntity(editingUser.userId, follow.followedId, follow.followedType);
      await loadUserFollows(editingUser.userId);

      if (Platform.OS === 'web') {
        window.alert('Following removed');
      } else {
        Alert.alert('Success', 'Following removed');
      }
    } catch (error) {
      console.error('[Admin] Error removing following:', error);
      if (Platform.OS === 'web') {
        window.alert('Error removing following');
      } else {
        Alert.alert('Error', 'Could not remove following');
      }
    }
  };

  // Load endorsement list for a user
  const loadUserEndorsements = async (userId: string) => {
    setLoadingEndorsements(true);
    setLoadingMetrics(true);
    try {
      const endorsements = await getEndorsementList(userId);
      setEndorsementList(endorsements);

      // Fetch metrics for each endorsement entry
      if (endorsements?.entries?.length) {
        const metrics: Record<string, { totalDaysEndorsed: number; totalDaysInTop5: number; totalDaysInTop10: number }> = {};

        await Promise.all(
          endorsements.entries.map(async (entry) => {
            try {
              let entityId: string | undefined;
              let entityType: 'brand' | 'business' | 'place' | 'value' = 'brand';

              if (entry.type === 'brand') {
                entityId = (entry as any).brandId;
                entityType = 'brand';
              } else if (entry.type === 'business') {
                entityId = (entry as any).businessId;
                entityType = 'business';
              } else if (entry.type === 'place') {
                entityId = (entry as any).placeId;
                entityType = 'place';
              }

              if (entityId) {
                const result = await getCumulativeDays(userId, entityType, entityId);
                metrics[entityId] = {
                  totalDaysEndorsed: result.totalDaysEndorsed,
                  totalDaysInTop5: result.totalDaysInTop5,
                  totalDaysInTop10: result.totalDaysInTop10,
                };
              }
            } catch (err) {
              console.warn('[Admin] Error fetching metrics for entry:', err);
            }
          })
        );

        setEndorsementMetrics(metrics);
      } else {
        setEndorsementMetrics({});
      }
    } catch (error) {
      console.error('[Admin] Error loading endorsements:', error);
      setEndorsementList(null);
      setEndorsementMetrics({});
    } finally {
      setLoadingEndorsements(false);
      setLoadingMetrics(false);
    }
  };

  // Create endorsement list for user if it doesn't exist
  const handleCreateEndorsementList = async () => {
    if (!editingUser) return;

    try {
      const userName = editingUser.fullName || editingUser.userDetails?.name || editingUser.email;
      await ensureEndorsementList(editingUser.userId, userName);
      await loadUserEndorsements(editingUser.userId);
      await loadUserLists(editingUser.userId);

      if (Platform.OS === 'web') {
        window.alert('Endorsement list created');
      } else {
        Alert.alert('Success', 'Endorsement list created');
      }
    } catch (error: any) {
      console.error('[Admin] Error creating endorsement list:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message || 'Could not create endorsement list'}`);
      } else {
        Alert.alert('Error', error.message || 'Could not create endorsement list');
      }
    }
  };

  // Add endorsement (brand or business) to user's endorsement list
  const handleAddEndorsement = async () => {
    if (!editingUser || !endorsementList) {
      if (Platform.OS === 'web') {
        window.alert('No endorsement list found. Please create one first.');
      } else {
        Alert.alert('Error', 'No endorsement list found. Please create one first.');
      }
      return;
    }

    if (!newEndorsementId.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter an ID');
      } else {
        Alert.alert('Error', 'Please enter an ID');
      }
      return;
    }

    try {
      const entry: ListEntry = newEndorsementType === 'brand'
        ? {
            type: 'brand',
            brandId: newEndorsementId.trim(),
            name: newEndorsementName.trim() || newEndorsementId.trim(),
            website: '',
            logoUrl: '',
          }
        : {
            type: 'business',
            businessId: newEndorsementId.trim(),
            name: newEndorsementName.trim() || newEndorsementId.trim(),
            website: '',
            logoUrl: '',
          };

      await addEntryToList(endorsementList.id, entry);
      await loadUserEndorsements(editingUser.userId);
      await loadUserLists(editingUser.userId);

      setNewEndorsementId('');
      setNewEndorsementName('');
      setAddingEndorsement(false);

      if (Platform.OS === 'web') {
        window.alert('Endorsement added successfully');
      } else {
        Alert.alert('Success', 'Endorsement added successfully');
      }
    } catch (error: any) {
      console.error('[Admin] Error adding endorsement:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message || 'Could not add endorsement'}`);
      } else {
        Alert.alert('Error', error.message || 'Could not add endorsement');
      }
    }
  };

  // Remove endorsement from user's endorsement list
  const handleRemoveEndorsement = async (entryId: string, entryName: string) => {
    if (!editingUser || !endorsementList) return;

    const confirmRemove = Platform.OS === 'web'
      ? window.confirm(`Remove endorsement for "${entryName}"?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Remove Endorsement',
            `Remove endorsement for "${entryName}"?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmRemove) return;

    try {
      await removeEntryFromList(endorsementList.id, entryId);
      await loadUserEndorsements(editingUser.userId);
      await loadUserLists(editingUser.userId);

      if (Platform.OS === 'web') {
        window.alert('Endorsement removed');
      } else {
        Alert.alert('Success', 'Endorsement removed');
      }
    } catch (error) {
      console.error('[Admin] Error removing endorsement:', error);
      if (Platform.OS === 'web') {
        window.alert('Error removing endorsement');
      } else {
        Alert.alert('Error', 'Could not remove endorsement');
      }
    }
  };

  // Handle updating endorsement metrics (top 5/10 days)
  const handleUpdateMetrics = async (entityId: string, entityType: 'brand' | 'business' | 'place') => {
    if (!editingUser) return;

    const top5 = parseInt(editingMetricsValues.top5, 10);
    const top10 = parseInt(editingMetricsValues.top10, 10);

    if (isNaN(top5) || isNaN(top10) || top5 < 0 || top10 < 0) {
      if (Platform.OS === 'web') {
        window.alert('Please enter valid non-negative numbers for days.');
      } else {
        Alert.alert('Error', 'Please enter valid non-negative numbers for days.');
      }
      return;
    }

    if (top5 > top10) {
      if (Platform.OS === 'web') {
        window.alert('Top 5 days cannot exceed top 10 days (top 5 is a subset of top 10).');
      } else {
        Alert.alert('Error', 'Top 5 days cannot exceed top 10 days (top 5 is a subset of top 10).');
      }
      return;
    }

    try {
      await updateEndorsementMetrics(editingUser.userId, entityType, entityId, {
        totalDaysInTop5: top5,
        totalDaysInTop10: top10,
      });

      // Reload metrics
      await loadUserEndorsements(editingUser.userId);
      setEditingMetricsEntityId(null);
      setEditingMetricsValues({ top5: '', top10: '' });

      if (Platform.OS === 'web') {
        window.alert('Metrics updated successfully');
      } else {
        Alert.alert('Success', 'Metrics updated successfully');
      }
    } catch (error: any) {
      console.error('[Admin] Error updating metrics:', error);
      if (Platform.OS === 'web') {
        window.alert(error?.message || 'Error updating metrics');
      } else {
        Alert.alert('Error', error?.message || 'Could not update metrics');
      }
    }
  };

  // Migrate endorsement history for existing entries
  const handleMigrateHistory = async () => {
    if (!editingUser || !endorsementList || !endorsementList.entries) return;

    setMigratingHistory(true);
    try {
      // Build entries for migration
      const migrationEntries = endorsementList.entries
        .map((entry, index) => {
          let entityId: string | undefined;
          let entityName = 'Unknown';
          let entityType: 'brand' | 'business' | 'place' | 'value' | undefined;

          if (entry.type === 'brand') {
            entityId = (entry as any).brandId;
            entityName = (entry as any).brandName || entityId || 'Unknown Brand';
            entityType = 'brand';
          } else if (entry.type === 'business') {
            entityId = (entry as any).businessId;
            entityName = (entry as any).businessName || entityId || 'Unknown Business';
            entityType = 'business';
          } else if (entry.type === 'place') {
            entityId = (entry as any).placeId;
            entityName = (entry as any).placeName || entityId || 'Unknown Place';
            entityType = 'place';
          } else if (entry.type === 'value') {
            entityId = (entry as any).valueId;
            entityName = (entry as any).valueName || entityId || 'Unknown Value';
            entityType = 'value';
          }

          if (entityId && entityType) {
            return {
              type: entityType,
              entityId,
              entityName,
              createdAt: entry.createdAt,
              position: index + 1,
            };
          }
          return null;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      const result = await migrateEndorsementHistory(editingUser.userId, migrationEntries);

      // Reload metrics
      await loadUserEndorsements(editingUser.userId);

      const message = `Migration complete: ${result.created} records created, ${result.existing} already existed.`;
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Migration Complete', message);
      }
    } catch (error: any) {
      console.error('[Admin] Error migrating history:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message || 'Could not migrate history'}`);
      } else {
        Alert.alert('Error', error.message || 'Could not migrate history');
      }
    } finally {
      setMigratingHistory(false);
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!editingUser) return;

    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to delete the list "${listName}"? This action cannot be undone.`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete List',
            `Are you sure you want to delete "${listName}"? This action cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      await deleteList(listId);
      await loadUserLists(editingUser.userId);
      if (Platform.OS === 'web') {
        window.alert(`List "${listName}" deleted successfully`);
      } else {
        Alert.alert('Success', `List "${listName}" deleted successfully`);
      }
    } catch (error) {
      console.error('[Admin] Error deleting list:', error);
      if (Platform.OS === 'web') {
        window.alert('Error deleting list');
      } else {
        Alert.alert('Error', 'Could not delete list');
      }
    }
  };

  const handleRemoveEntry = async (listId: string, entryId: string, entryName: string) => {
    if (!editingUser) return;

    try {
      await removeEntryFromList(listId, entryId);
      await loadUserLists(editingUser.userId);
      if (Platform.OS === 'web') {
        window.alert(`Removed "${entryName}" from list`);
      } else {
        Alert.alert('Success', `Removed "${entryName}" from list`);
      }
    } catch (error) {
      console.error('[Admin] Error removing entry:', error);
      if (Platform.OS === 'web') {
        window.alert('Error removing entry');
      } else {
        Alert.alert('Error', 'Could not remove entry');
      }
    }
  };

  const handleAddEntry = async (listId: string) => {
    if (!newEntryBrandId && !newEntryBusinessId) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a Brand ID or Business ID');
      } else {
        Alert.alert('Error', 'Please enter a Brand ID or Business ID');
      }
      return;
    }

    if (newEntryBrandId && newEntryBusinessId) {
      if (Platform.OS === 'web') {
        window.alert('Please enter either a Brand ID OR a Business ID, not both');
      } else {
        Alert.alert('Error', 'Please enter either a Brand ID OR a Business ID, not both');
      }
      return;
    }

    try {
      const entry: ListEntry = newEntryBrandId
        ? {
            type: 'brand',
            brandId: newEntryBrandId,
            name: newEntryBrandId, // Admin should use actual brand name
            website: '',
            logoUrl: '',
          }
        : {
            type: 'business',
            businessId: newEntryBusinessId,
            name: newEntryBusinessId, // Admin should use actual business name
            website: '',
            logoUrl: '',
          };

      await addEntryToList(listId, entry);

      if (editingUser) {
        await loadUserLists(editingUser.userId);
      }

      setNewEntryBrandId('');
      setNewEntryBusinessId('');
      setEditingListId(null);

      if (Platform.OS === 'web') {
        window.alert('Entry added successfully');
      } else {
        Alert.alert('Success', 'Entry added successfully');
      }
    } catch (error) {
      console.error('[Admin] Error adding entry:', error);
      if (Platform.OS === 'web') {
        window.alert('Error adding entry');
      } else {
        Alert.alert('Error', 'Could not add entry');
      }
    }
  };

  // Helper to format date for display
  const formatDateForDisplay = (date: Date | string | undefined): string => {
    if (!date) return 'Not set';
    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (typeof date === 'object' && 'seconds' in date) {
      d = new Date((date as any).seconds * 1000);
    } else {
      return 'Invalid date';
    }
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // Helper to calculate days from date
  const calculateDaysFromDate = (date: Date | string | undefined): number => {
    if (!date) return 0;
    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (typeof date === 'object' && 'seconds' in date) {
      d = new Date((date as any).seconds * 1000);
    } else {
      return 0;
    }
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Handle updating entry's createdAt date
  const handleUpdateEntryDate = async (listId: string, entryId: string, newDateString: string, entry?: ListEntry) => {
    if (!editingUser) return;

    try {
      const newDate = new Date(newDateString);
      if (isNaN(newDate.getTime())) {
        if (Platform.OS === 'web') {
          window.alert('Invalid date format. Please use YYYY-MM-DD format.');
        } else {
          Alert.alert('Error', 'Invalid date format. Please use YYYY-MM-DD format.');
        }
        return;
      }

      // Check if this is backdating (new date is earlier than today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isBackdating = newDate < today;

      await updateEntryInList(listId, entryId, { createdAt: newDate });

      // If backdating an endorsement entry, update the endorsement history
      // so that backdated days don't count as top 5/10
      if (isBackdating && entry) {
        const entryAny = entry as any;
        let entityType: 'brand' | 'business' | 'place' | undefined;
        let entityId: string | undefined;
        let entityName: string = 'Unknown';

        if (entry.type === 'brand' && entryAny.brandId) {
          entityType = 'brand';
          entityId = entryAny.brandId;
          entityName = entryAny.brandName || entryAny.name || 'Unknown Brand';
        } else if (entry.type === 'business' && entryAny.businessId) {
          entityType = 'business';
          entityId = entryAny.businessId;
          entityName = entryAny.businessName || entryAny.name || 'Unknown Business';
        } else if (entry.type === 'place' && entryAny.placeId) {
          entityType = 'place';
          entityId = entryAny.placeId;
          entityName = entryAny.placeName || entryAny.name || 'Unknown Place';
        }

        if (entityType && entityId) {
          try {
            await handleBackdateEntry(
              editingUser.userId,
              entityType,
              entityId,
              entityName,
              newDate
            );
            console.log('[Admin] Updated endorsement history for backdating');
          } catch (historyError) {
            console.error('[Admin] Error updating endorsement history:', historyError);
            // Don't fail the whole operation if history update fails
          }
        }
      }

      await loadUserLists(editingUser.userId);

      setEditingEntryDateId(null);
      setEditingEntryDateValue('');

      if (Platform.OS === 'web') {
        window.alert('Entry date updated successfully' + (isBackdating ? ' (backdated days will not count for top 5/10 ranking)' : ''));
      } else {
        Alert.alert('Success', 'Entry date updated successfully' + (isBackdating ? ' (backdated days will not count for top 5/10 ranking)' : ''));
      }
    } catch (error) {
      console.error('[Admin] Error updating entry date:', error);
      if (Platform.OS === 'web') {
        window.alert('Error updating entry date');
      } else {
        Alert.alert('Error', 'Could not update entry date');
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const parseCauses = (text: string): Cause[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => {
        const [id, name, category, type] = line.split('|').map((s) => s.trim());
        return {
          id: id || '',
          name: name || '',
          category: category || '',
          type: (type as 'support' | 'avoid') || 'support',
        };
      })
      .filter((item) => item.id && item.name);
  };

  const handleSave = async () => {
    if (!editingUser) {
      console.log('[Admin Users] No editing user found');
      return;
    }

    console.log('[Admin Users] Starting save for user:', editingUser.userId);

    try {
      // Build social media object - only include non-empty values
      const socialMedia: SocialMedia = {};
      if (formFacebook?.trim()) socialMedia.facebook = formFacebook.trim();
      if (formInstagram?.trim()) socialMedia.instagram = formInstagram.trim();
      if (formTwitter?.trim()) socialMedia.twitter = formTwitter.trim();
      if (formLinkedin?.trim()) socialMedia.linkedin = formLinkedin.trim();
      if (formYelp?.trim()) socialMedia.yelp = formYelp.trim();
      if (formYoutube?.trim()) socialMedia.youtube = formYoutube.trim();

      // Build user details object - only include non-empty values
      const userDetails: Record<string, any> = {};
      if (formName?.trim()) userDetails.name = formName.trim();
      if (formDescription?.trim()) userDetails.description = formDescription.trim();
      if (formWebsite?.trim()) userDetails.website = formWebsite.trim();
      if (formLocation?.trim()) userDetails.location = formLocation.trim();
      if (formLatitude && !isNaN(parseFloat(formLatitude))) {
        userDetails.latitude = parseFloat(formLatitude);
      }
      if (formLongitude && !isNaN(parseFloat(formLongitude))) {
        userDetails.longitude = parseFloat(formLongitude);
      }
      if (formProfileImageUrl?.trim()) {
        userDetails.profileImage = formProfileImageUrl.trim();
      }
      if (formCoverImageUrl?.trim()) {
        userDetails.coverImage = formCoverImageUrl.trim();
      }
      if (Object.keys(socialMedia).length > 0) {
        userDetails.socialMedia = socialMedia;
      }

      // Parse search history - only include non-empty lines
      const searchHistory = formSearchHistory
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line);

      // Parse causes - only include valid ones
      const causes = parseCauses(formCauses);

      // Build update object - only include fields that have values
      const updatedData: Record<string, any> = {};

      // Basic info - always include even if empty
      if (formFirstName !== undefined) updatedData.firstName = formFirstName.trim();
      if (formLastName !== undefined) updatedData.lastName = formLastName.trim();
      if (formFullName !== undefined) updatedData.fullName = formFullName.trim();

      // User details - only include if has content
      if (Object.keys(userDetails).length > 0) {
        updatedData.userDetails = userDetails;
      }

      // Only include causes if there are valid ones
      if (causes.length > 0) {
        updatedData.causes = causes;
      }

      // Only include search history if there are items
      if (searchHistory.length > 0) {
        updatedData.searchHistory = searchHistory;
      }

      // Only include consent fields if not empty
      if (formConsentGivenAt?.trim()) {
        updatedData.consentGivenAt = formConsentGivenAt.trim();
      }
      if (formConsentVersion?.trim()) {
        updatedData.consentVersion = formConsentVersion.trim();
      }

      // Add custom field values
      customFields.forEach((field) => {
        const value = customFieldValues[field.fieldName];
        if (value !== undefined && value !== '') {
          // Convert value based on field type
          switch (field.fieldType) {
            case 'number':
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                updatedData[field.fieldName] = numValue;
              }
              break;
            case 'boolean':
              updatedData[field.fieldName] = value === 'true' || value === true;
              break;
            default:
              if (typeof value === 'string' && value.trim()) {
                updatedData[field.fieldName] = value.trim();
              } else if (typeof value !== 'string') {
                updatedData[field.fieldName] = value;
              }
          }
        }
      });

      console.log('[Admin Users] Updating user with data:', updatedData);

      // Check if there's actually anything to update
      if (Object.keys(updatedData).length === 0) {
        console.log('[Admin Users] No fields to update');
        if (Platform.OS === 'web') {
          window.alert('No changes to save');
        } else {
          Alert.alert('Info', 'No changes to save');
        }
        return;
      }

      const userRef = doc(db, 'users', editingUser.userId);
      console.log('[Admin Users] User ref:', userRef.path);
      console.log('[Admin Users] Data to save:', JSON.stringify(updatedData, null, 2));

      // Update all user fields
      try {
        await updateDoc(userRef, updatedData);
        console.log('[Admin Users] ✅ updateDoc completed successfully');
      } catch (updateError: any) {
        console.error('[Admin Users] ❌ updateDoc failed:', updateError);
        console.error('[Admin Users] Error code:', updateError.code);
        console.error('[Admin Users] Error message:', updateError.message);
        throw updateError; // Re-throw to be caught by outer try-catch
      }

      console.log('[Admin Users] User updated successfully');

      // Close modal and reload users first
      closeModal();
      await loadUsers();

      // Show success message
      if (Platform.OS === 'web') {
        window.alert(`User "${formName || editingUser.email}" updated successfully`);
      } else {
        Alert.alert(
          'Success',
          `User "${formName || editingUser.email}" updated successfully`
        );
      }
    } catch (error: any) {
      console.error('[Admin Users] ❌ Error updating user:', error);
      console.error('[Admin Users] Error type:', typeof error);
      console.error('[Admin Users] Error code:', error?.code);
      console.error('[Admin Users] Error message:', error?.message);
      console.error('[Admin Users] Full error:', JSON.stringify(error, null, 2));

      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      if (Platform.OS === 'web') {
        window.alert(`Failed to update user data: ${errorMessage}\n\nCheck console for details.`);
      } else {
        Alert.alert('Error', `Failed to update user data: ${errorMessage}`);
      }
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    // Confirm deletion
    const confirmMessage = `Are you sure you want to delete user "${user.userDetails?.name || user.email}"?\n\nThis will:\n- Delete all Firebase data for this user\n- Delete their lists, transactions, etc.\n\nThis action CANNOT be undone!\n\nNote: If this user still exists in Clerk, you'll need to delete them there separately.`;

    const confirmed = Platform.OS === 'web'
      ? window.confirm(confirmMessage)
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete User',
            confirmMessage,
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Delete', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });

    if (!confirmed) return;

    try {
      console.log('[Admin Users] Deleting user:', user.userId);

      // Delete user document from Firebase
      const userRef = doc(db, 'users', user.userId);
      await deleteDoc(userRef);
      console.log('[Admin Users] ✅ User document deleted from Firebase');

      // Delete user's lists
      try {
        const listsRef = collection(db, 'userLists');
        const listsQuery = query(listsRef, where('userId', '==', user.userId));
        const listsSnapshot = await getDocs(listsQuery);

        const deleteListPromises = listsSnapshot.docs.map(listDoc =>
          deleteDoc(doc(db, 'userLists', listDoc.id))
        );
        await Promise.all(deleteListPromises);
        console.log('[Admin Users] ✅ Deleted', listsSnapshot.docs.length, 'user lists');
      } catch (listError) {
        console.error('[Admin Users] Error deleting lists:', listError);
      }

      // Delete user's transactions
      try {
        const transactionsRef = collection(db, 'transactions');
        const transactionsQuery = query(transactionsRef, where('userId', '==', user.userId));
        const transactionsSnapshot = await getDocs(transactionsQuery);

        const deleteTransactionPromises = transactionsSnapshot.docs.map(txDoc =>
          deleteDoc(doc(db, 'transactions', txDoc.id))
        );
        await Promise.all(deleteTransactionPromises);
        console.log('[Admin Users] ✅ Deleted', transactionsSnapshot.docs.length, 'transactions');
      } catch (txError) {
        console.error('[Admin Users] Error deleting transactions:', txError);
      }

      // Reload users list
      await loadUsers();

      // Show success message
      const successMessage = `User deleted successfully!\n\nReminder: If this user still exists in Clerk, you'll need to delete them manually at:\nhttps://dashboard.clerk.com`;

      if (Platform.OS === 'web') {
        window.alert(successMessage);
      } else {
        Alert.alert('Success', successMessage);
      }
    } catch (error: any) {
      console.error('[Admin Users] ❌ Error deleting user:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';

      if (Platform.OS === 'web') {
        window.alert(`Failed to delete user: ${errorMessage}`);
      } else {
        Alert.alert('Error', `Failed to delete user: ${errorMessage}`);
      }
    }
  };

  const handleCreateUser = async () => {
    if (!createUserId.trim()) {
      if (Platform.OS === 'web') {
        window.alert('User ID is required');
      } else {
        Alert.alert('Error', 'User ID is required');
      }
      return;
    }

    if (!createEmail.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Email is required');
      } else {
        Alert.alert('Error', 'Email is required');
      }
      return;
    }

    setIsCreatingUser(true);

    try {
      const userRef = doc(db, 'users', createUserId.trim());

      // Parse causes from text (format: id|name|category|type per line)
      const parsedCauses = createCauses.trim()
        ? createCauses.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
              const [id, name, category, type] = line.split('|').map(s => s.trim());
              return {
                id: id || '',
                name: name || id || '',
                category: category || 'General',
                type: (type === 'avoid' ? 'avoid' : 'support') as 'support' | 'avoid',
              };
            })
            .filter(cause => cause.id)
        : [];

      const newUserData: Record<string, any> = {
        email: createEmail.trim(),
        accountType: 'individual',
        causes: parsedCauses,
        searchHistory: [],
        createdAt: new Date().toISOString(),
      };

      if (createFirstName.trim()) {
        newUserData.firstName = createFirstName.trim();
      }
      if (createLastName.trim()) {
        newUserData.lastName = createLastName.trim();
      }
      if (createFirstName.trim() || createLastName.trim()) {
        newUserData.fullName = `${createFirstName.trim()} ${createLastName.trim()}`.trim();
      }

      // Add userDetails if any profile fields are filled
      if (createName.trim() || createDescription.trim() || createLocation.trim() || createProfileImageUrl.trim() || createCoverImageUrl.trim()) {
        newUserData.userDetails = {};
        if (createName.trim()) {
          newUserData.userDetails.name = createName.trim();
        }
        if (createDescription.trim()) {
          newUserData.userDetails.description = createDescription.trim();
        }
        if (createLocation.trim()) {
          newUserData.userDetails.location = createLocation.trim();
        }
        if (createProfileImageUrl.trim()) {
          newUserData.userDetails.profileImage = createProfileImageUrl.trim();
        }
        if (createCoverImageUrl.trim()) {
          newUserData.userDetails.coverImage = createCoverImageUrl.trim();
        }
      }

      await setDoc(userRef, newUserData);

      // Reset form
      setCreateUserId('');
      setCreateEmail('');
      setCreateFirstName('');
      setCreateLastName('');
      setCreateName('');
      setCreateDescription('');
      setCreateLocation('');
      setCreateProfileImageUrl('');
      setCreateCoverImageUrl('');
      setCreateCauses('');
      setShowCreateModal(false);

      // Reload users
      await loadUsers();

      if (Platform.OS === 'web') {
        window.alert('User created successfully!');
      } else {
        Alert.alert('Success', 'User created successfully!');
      }
    } catch (error: any) {
      console.error('[Admin Users] Error creating user:', error);
      const errorMessage = error?.message || 'Unknown error';
      if (Platform.OS === 'web') {
        window.alert(`Failed to create user: ${errorMessage}`);
      } else {
        Alert.alert('Error', `Failed to create user: ${errorMessage}`);
      }
    } finally {
      setIsCreatingUser(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      (user.userDetails?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.userDetails?.location?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Users Management</Text>
        <Text style={styles.subtitle}>
          {users.length} user accounts ({filteredUsers.length} filtered)
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, styles.actionsBar]}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or location..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkButton} onPress={() => setShowBulkModal(true)}>
          <Text style={styles.bulkButtonText}>Bulk Create</Text>
        </TouchableOpacity>
      </View>

      {/* Users List */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.listContainer}>
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No users found matching your search' : 'No user accounts yet'}
              </Text>
            </View>
          ) : (
            filteredUsers.map((user) => (
              <View key={user.userId} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user.fullName || user.userDetails?.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User'}
                    </Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    {(user.firstName || user.lastName) && (
                      <Text style={styles.userDetail}>
                        👤 {user.firstName} {user.lastName}
                      </Text>
                    )}
                    {user.userDetails?.location && (
                      <Text style={styles.userLocation}>📍 {user.userDetails.location}</Text>
                    )}
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openEditModal(user)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.impersonateButton}
                      onPress={() => handleImpersonate(user)}
                      disabled={impersonatingUserId === user.userId}
                    >
                      <Text style={styles.impersonateButtonText}>
                        {impersonatingUserId === user.userId ? '...' : 'Login'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteUser(user)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Preview */}
                <View style={styles.previewSection}>
                  <Text style={styles.previewText}>
                    {user.causes?.length || 0} causes • {user.searchHistory?.length || 0} searches
                  </Text>
                  {user.referralSource && (
                    <Text style={[styles.previewText, styles.referralSourceTag]}>📍 Source: {user.referralSource}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Edit User - {editingUser?.userDetails?.name || editingUser?.email}
              </Text>

              <View style={styles.userDetails}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>{editingUser?.email}</Text>
                <Text style={styles.detailLabel}>User ID:</Text>
                <Text style={styles.detailValue}>{editingUser?.userId}</Text>
              </View>

              {/* BASIC INFO */}
              <Text style={styles.sectionTitle}>👤 Basic Information</Text>

              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="User's first name"
                value={formFirstName}
                onChangeText={setFormFirstName}
              />

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="User's last name"
                value={formLastName}
                onChangeText={setFormLastName}
              />

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="User's full name"
                value={formFullName}
                onChangeText={setFormFullName}
              />

              {/* USER DETAILS */}
              <Text style={styles.sectionTitle}>📋 User Details (Profile)</Text>

              <Text style={styles.label}>Name (userDetails.name)</Text>
              <TextInput
                style={styles.input}
                placeholder="User's profile name"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="User bio or description"
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Website</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com"
                value={formWebsite}
                onChangeText={setFormWebsite}
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., New York, NY"
                value={formLocation}
                onChangeText={setFormLocation}
              />

              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="40.7128"
                value={formLatitude}
                onChangeText={setFormLatitude}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="-74.0060"
                value={formLongitude}
                onChangeText={setFormLongitude}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Profile Image</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/photo.jpg"
                  value={formProfileImageUrl}
                  onChangeText={setFormProfileImageUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, editProfileUploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!editingUser?.userId) return;
                    setEditProfileUploading(true);
                    const url = await pickAndUploadImage(editingUser.userId, 'profile', [1, 1]);
                    if (url) {
                      setFormProfileImageUrl(url);
                    }
                    setEditProfileUploading(false);
                  }}
                  disabled={editProfileUploading}
                >
                  {editProfileUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {formProfileImageUrl ? (
                <Image source={{ uri: formProfileImageUrl }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12, alignSelf: 'center' }} />
              ) : null}

              <Text style={styles.label}>Cover Image</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/cover.jpg"
                  value={formCoverImageUrl}
                  onChangeText={setFormCoverImageUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, editCoverUploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!editingUser?.userId) return;
                    setEditCoverUploading(true);
                    const url = await pickAndUploadImage(editingUser.userId, 'cover', [16, 9]);
                    if (url) {
                      setFormCoverImageUrl(url);
                    }
                    setEditCoverUploading(false);
                  }}
                  disabled={editCoverUploading}
                >
                  {editCoverUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {formCoverImageUrl ? (
                <Image source={{ uri: formCoverImageUrl }} style={{ width: '100%', height: 80, borderRadius: 8, marginBottom: 12 }} />
              ) : null}

              {/* SOCIAL MEDIA */}
              <Text style={styles.sectionTitle}>📱 Social Media</Text>

              <Text style={styles.label}>Facebook</Text>
              <TextInput
                style={styles.input}
                placeholder="https://facebook.com/..."
                value={formFacebook}
                onChangeText={setFormFacebook}
              />

              <Text style={styles.label}>Instagram</Text>
              <TextInput
                style={styles.input}
                placeholder="https://instagram.com/..."
                value={formInstagram}
                onChangeText={setFormInstagram}
              />

              <Text style={styles.label}>Twitter</Text>
              <TextInput
                style={styles.input}
                placeholder="https://twitter.com/..."
                value={formTwitter}
                onChangeText={setFormTwitter}
              />

              <Text style={styles.label}>LinkedIn</Text>
              <TextInput
                style={styles.input}
                placeholder="https://linkedin.com/..."
                value={formLinkedin}
                onChangeText={setFormLinkedin}
              />

              <Text style={styles.label}>Yelp</Text>
              <TextInput
                style={styles.input}
                placeholder="https://yelp.com/..."
                value={formYelp}
                onChangeText={setFormYelp}
              />

              <Text style={styles.label}>YouTube</Text>
              <TextInput
                style={styles.input}
                placeholder="https://youtube.com/..."
                value={formYoutube}
                onChangeText={setFormYoutube}
              />

              {/* CAUSES / VALUES */}
              <Text style={styles.sectionTitle}>⭐ Causes / Values</Text>
              <Text style={styles.helpText}>
                Format: id|name|category|type (one per line). Type should be "support" or "avoid".
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="abortion|Abortion|social_issue|support&#10;climate|Climate Change|social_issue|avoid"
                value={formCauses}
                onChangeText={setFormCauses}
                multiline
                numberOfLines={10}
              />

              {/* SEARCH HISTORY */}
              <Text style={styles.sectionTitle}>🔍 Search History</Text>
              <Text style={styles.helpText}>
                One search term per line
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="nike&#10;starbucks&#10;apple"
                value={formSearchHistory}
                onChangeText={setFormSearchHistory}
                multiline
                numberOfLines={5}
              />

              {/* CONSENT */}
              <Text style={styles.sectionTitle}>✅ Consent Information</Text>

              <Text style={styles.label}>Consent Given At (ISO timestamp)</Text>
              <TextInput
                style={styles.input}
                placeholder="2024-01-01T00:00:00.000Z"
                value={formConsentGivenAt}
                onChangeText={setFormConsentGivenAt}
              />

              <Text style={styles.label}>Consent Version</Text>
              <TextInput
                style={styles.input}
                placeholder="1.0"
                value={formConsentVersion}
                onChangeText={setFormConsentVersion}
              />

              {/* CUSTOM FIELDS */}
              {customFields.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>🔧 Custom Fields</Text>
                  <Text style={styles.helpText}>
                    These are custom fields you've created for user documents.
                  </Text>
                  {customFields.map((field) => (
                    <View key={field.id}>
                      <Text style={styles.label}>
                        {field.fieldLabel} {field.required && '*'}
                      </Text>
                      {field.description && (
                        <Text style={styles.helpText}>{field.description}</Text>
                      )}
                      {field.fieldType === 'boolean' ? (
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={customFieldValues[field.fieldName]?.toString() || 'false'}
                            onValueChange={(value) =>
                              setCustomFieldValues({
                                ...customFieldValues,
                                [field.fieldName]: value === 'true',
                              })
                            }
                            style={styles.picker}
                          >
                            <Picker.Item label="False" value="false" />
                            <Picker.Item label="True" value="true" />
                          </Picker>
                        </View>
                      ) : field.fieldType === 'textarea' ? (
                        <TextInput
                          style={[styles.input, styles.textArea]}
                          placeholder={field.defaultValue || `Enter ${field.fieldLabel}`}
                          value={customFieldValues[field.fieldName]?.toString() || ''}
                          onChangeText={(value) =>
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.fieldName]: value,
                            })
                          }
                          multiline
                          numberOfLines={4}
                        />
                      ) : (
                        <TextInput
                          style={styles.input}
                          placeholder={field.defaultValue || `Enter ${field.fieldLabel}`}
                          value={customFieldValues[field.fieldName]?.toString() || ''}
                          onChangeText={(value) =>
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.fieldName]: value,
                            })
                          }
                          keyboardType={
                            field.fieldType === 'number'
                              ? 'numeric'
                              : field.fieldType === 'phone'
                              ? 'phone-pad'
                              : field.fieldType === 'email'
                              ? 'email-address'
                              : 'default'
                          }
                        />
                      )}
                    </View>
                  ))}
                </>
              )}

              {/* FOLLOWERS / FOLLOWING MANAGEMENT */}
              <Text style={styles.sectionTitle}>👥 Followers & Following</Text>
              <Text style={styles.helpText}>
                Manage who follows this user and who this user follows. You can add/remove followers and following relationships.
              </Text>

              {loadingFollows ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
              ) : (
                <>
                  {/* Followers Section */}
                  <View style={styles.followCard}>
                    <TouchableOpacity
                      style={styles.followHeader}
                      onPress={() => setExpandedFollowSection(expandedFollowSection === 'followers' ? null : 'followers')}
                    >
                      <Text style={styles.followTitle}>Followers ({userFollowers.length})</Text>
                      <Text style={styles.expandIcon}>{expandedFollowSection === 'followers' ? '▼' : '▶'}</Text>
                    </TouchableOpacity>

                    {expandedFollowSection === 'followers' && (
                      <View style={styles.followContent}>
                        <TouchableOpacity
                          style={styles.addFollowButton}
                          onPress={() => setAddingFollowType(addingFollowType === 'follower' ? null : 'follower')}
                        >
                          <Text style={styles.addFollowButtonText}>
                            {addingFollowType === 'follower' ? 'Cancel' : '+ Add Follower'}
                          </Text>
                        </TouchableOpacity>

                        {addingFollowType === 'follower' && (
                          <View style={styles.addFollowForm}>
                            <Text style={styles.label}>User ID (who will follow this user)</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Enter user ID..."
                              value={newFollowId}
                              onChangeText={setNewFollowId}
                              autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.submitFollowButton} onPress={handleAddFollower}>
                              <Text style={styles.submitFollowButtonText}>Add Follower</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {userFollowers.length === 0 ? (
                          <Text style={styles.emptyFollowText}>No followers</Text>
                        ) : (
                          userFollowers.map((follower) => (
                            <View key={follower.id} style={styles.followRow}>
                              <View style={styles.followInfo}>
                                <Text style={styles.followId}>{follower.followerId}</Text>
                                <Text style={styles.followDate}>
                                  Since: {follower.createdAt?.toLocaleDateString() || 'Unknown'}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.removeFollowButton}
                                onPress={() => handleRemoveFollower(follower.followerId)}
                              >
                                <Text style={styles.removeFollowButtonText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>

                  {/* Following Section */}
                  <View style={styles.followCard}>
                    <TouchableOpacity
                      style={styles.followHeader}
                      onPress={() => setExpandedFollowSection(expandedFollowSection === 'following' ? null : 'following')}
                    >
                      <Text style={styles.followTitle}>Following ({userFollowing.length})</Text>
                      <Text style={styles.expandIcon}>{expandedFollowSection === 'following' ? '▼' : '▶'}</Text>
                    </TouchableOpacity>

                    {expandedFollowSection === 'following' && (
                      <View style={styles.followContent}>
                        <TouchableOpacity
                          style={styles.addFollowButton}
                          onPress={() => setAddingFollowType(addingFollowType === 'following' ? null : 'following')}
                        >
                          <Text style={styles.addFollowButtonText}>
                            {addingFollowType === 'following' ? 'Cancel' : '+ Add Following'}
                          </Text>
                        </TouchableOpacity>

                        {addingFollowType === 'following' && (
                          <View style={styles.addFollowForm}>
                            <Text style={styles.label}>Entity Type</Text>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                selectedValue={newFollowEntityType}
                                onValueChange={(value) => setNewFollowEntityType(value)}
                                style={styles.picker}
                              >
                                <Picker.Item label="User" value="user" />
                                <Picker.Item label="Brand" value="brand" />
                                <Picker.Item label="Business" value="business" />
                              </Picker>
                            </View>

                            <Text style={styles.label}>
                              {newFollowEntityType === 'user' ? 'User ID' :
                               newFollowEntityType === 'brand' ? 'Brand ID' : 'Business ID'}
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder={`Enter ${newFollowEntityType} ID...`}
                              value={newFollowId}
                              onChangeText={setNewFollowId}
                              autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.submitFollowButton} onPress={handleAddFollowing}>
                              <Text style={styles.submitFollowButtonText}>Add Following</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {userFollowing.length === 0 ? (
                          <Text style={styles.emptyFollowText}>Not following anyone</Text>
                        ) : (
                          userFollowing.map((following) => (
                            <View key={following.id} style={styles.followRow}>
                              <View style={styles.followInfo}>
                                <Text style={styles.followId}>{following.followedId}</Text>
                                <Text style={styles.followType}>({following.followedType})</Text>
                                <Text style={styles.followDate}>
                                  Since: {following.createdAt?.toLocaleDateString() || 'Unknown'}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.removeFollowButton}
                                onPress={() => handleRemoveFollowing(following)}
                              >
                                <Text style={styles.removeFollowButtonText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* ENDORSEMENTS MANAGEMENT */}
              <Text style={styles.sectionTitle}>⭐ Endorsements</Text>
              <Text style={styles.helpText}>
                Manage this user's endorsements. Add or remove brands/businesses they endorse.
              </Text>

              {loadingEndorsements ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
              ) : !endorsementList ? (
                <View style={styles.endorsementCard}>
                  <Text style={styles.noEndorsementText}>This user has no endorsement list.</Text>
                  <TouchableOpacity style={styles.createEndorsementButton} onPress={handleCreateEndorsementList}>
                    <Text style={styles.createEndorsementButtonText}>Create Endorsement List</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.endorsementCard}>
                  <TouchableOpacity
                    style={styles.endorsementHeader}
                    onPress={() => setExpandedEndorsements(!expandedEndorsements)}
                  >
                    <Text style={styles.endorsementTitle}>
                      Endorsements ({endorsementList.entries?.length || 0})
                    </Text>
                    <Text style={styles.expandIcon}>{expandedEndorsements ? '▼' : '▶'}</Text>
                  </TouchableOpacity>

                  {expandedEndorsements && (
                    <View style={styles.endorsementContent}>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <TouchableOpacity
                          style={styles.addEndorsementButton}
                          onPress={() => setAddingEndorsement(!addingEndorsement)}
                        >
                          <Text style={styles.addEndorsementButtonText}>
                            {addingEndorsement ? 'Cancel' : '+ Add Endorsement'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.addEndorsementButton, { backgroundColor: '#6c757d' }]}
                          onPress={handleMigrateHistory}
                          disabled={migratingHistory}
                        >
                          <Text style={styles.addEndorsementButtonText}>
                            {migratingHistory ? 'Migrating...' : 'Migrate History'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {addingEndorsement && (
                        <View style={styles.addEndorsementForm}>
                          <Text style={styles.label}>Type</Text>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={newEndorsementType}
                              onValueChange={(value) => setNewEndorsementType(value)}
                              style={styles.picker}
                            >
                              <Picker.Item label="Brand" value="brand" />
                              <Picker.Item label="Business" value="business" />
                            </Picker>
                          </View>

                          <Text style={styles.label}>
                            {newEndorsementType === 'brand' ? 'Brand ID' : 'Business ID'}
                          </Text>
                          <TextInput
                            style={styles.input}
                            placeholder={newEndorsementType === 'brand' ? 'e.g., nike, starbucks' : 'Firebase Business ID'}
                            value={newEndorsementId}
                            onChangeText={setNewEndorsementId}
                            autoCapitalize="none"
                          />

                          <Text style={styles.label}>Display Name (Optional)</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Name to display in list"
                            value={newEndorsementName}
                            onChangeText={setNewEndorsementName}
                          />

                          <TouchableOpacity style={styles.submitEndorsementButton} onPress={handleAddEndorsement}>
                            <Text style={styles.submitEndorsementButtonText}>Add Endorsement</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {endorsementList.entries && endorsementList.entries.length > 0 ? (
                        endorsementList.entries.map((entry, index) => {
                          const entryId = entry.id || '';
                          const entryName = (entry as any).brandName || (entry as any).businessName || (entry as any).placeName || (entry as any).name || (entry as any).brandId || (entry as any).businessId || 'Unknown';
                          const entryType = entry.type || 'unknown';

                          // Get entity ID for metrics lookup
                          let entityId: string | undefined;
                          if (entry.type === 'brand') {
                            entityId = (entry as any).brandId;
                          } else if (entry.type === 'business') {
                            entityId = (entry as any).businessId;
                          } else if (entry.type === 'place') {
                            entityId = (entry as any).placeId;
                          }

                          // Get metrics from history or fall back to calculated days
                          const metrics = entityId ? endorsementMetrics[entityId] : null;
                          const daysEndorsed = metrics?.totalDaysEndorsed ?? calculateDaysFromDate(entry.createdAt);
                          const daysInTop5 = metrics?.totalDaysInTop5 ?? 0;
                          const daysInTop10 = metrics?.totalDaysInTop10 ?? 0;

                          const isEditingThisMetrics = editingMetricsEntityId === entityId;

                          return (
                            <View key={entryId} style={styles.endorsementRow}>
                              <View style={styles.endorsementInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={styles.endorsementRank}>#{index + 1}</Text>
                                  <Text style={styles.endorsementName}>{entryName}</Text>
                                  <Text style={styles.endorsementType}>({entryType})</Text>
                                </View>

                                {isEditingThisMetrics && entityId ? (
                                  <View style={styles.metricsEditContainer}>
                                    <Text style={styles.endorsementDays}>
                                      📅 {daysEndorsed} {daysEndorsed === 1 ? 'day' : 'days'} total
                                    </Text>
                                    <View style={styles.metricsEditRow}>
                                      <Text style={styles.metricsEditLabel}>🏆 Top 5 days:</Text>
                                      <TextInput
                                        style={styles.metricsEditInput}
                                        value={editingMetricsValues.top5}
                                        onChangeText={(text) => setEditingMetricsValues(prev => ({ ...prev, top5: text }))}
                                        keyboardType="numeric"
                                        placeholder={String(daysInTop5)}
                                      />
                                    </View>
                                    <View style={styles.metricsEditRow}>
                                      <Text style={styles.metricsEditLabel}>🥈 Top 10 days:</Text>
                                      <TextInput
                                        style={styles.metricsEditInput}
                                        value={editingMetricsValues.top10}
                                        onChangeText={(text) => setEditingMetricsValues(prev => ({ ...prev, top10: text }))}
                                        keyboardType="numeric"
                                        placeholder={String(daysInTop10)}
                                      />
                                    </View>
                                    <View style={styles.metricsEditButtons}>
                                      <TouchableOpacity
                                        style={styles.metricsSaveButton}
                                        onPress={() => handleUpdateMetrics(entityId, entryType as 'brand' | 'business' | 'place')}
                                      >
                                        <Text style={styles.metricsSaveButtonText}>Save</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={styles.metricsCancelButton}
                                        onPress={() => {
                                          setEditingMetricsEntityId(null);
                                          setEditingMetricsValues({ top5: '', top10: '' });
                                        }}
                                      >
                                        <Text style={styles.metricsCancelButtonText}>Cancel</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ) : (
                                  <View style={styles.endorsementMetricsRow}>
                                    <Text style={styles.endorsementDays}>
                                      📅 {daysEndorsed} {daysEndorsed === 1 ? 'day' : 'days'} total
                                    </Text>
                                    <Text style={[styles.endorsementDays, { color: '#FFD700' }]}>
                                      🏆 {daysInTop5}d top 5
                                    </Text>
                                    <Text style={[styles.endorsementDays, { color: '#C0C0C0' }]}>
                                      🥈 {daysInTop10}d top 10
                                    </Text>
                                    {entityId && (
                                      <TouchableOpacity
                                        style={styles.metricsEditButton}
                                        onPress={() => {
                                          setEditingMetricsEntityId(entityId);
                                          setEditingMetricsValues({
                                            top5: String(daysInTop5),
                                            top10: String(daysInTop10),
                                          });
                                        }}
                                      >
                                        <Text style={styles.metricsEditButtonText}>Edit</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                )}
                              </View>
                              <TouchableOpacity
                                style={styles.removeEndorsementButton}
                                onPress={() => handleRemoveEndorsement(entryId, entryName)}
                              >
                                <Text style={styles.removeEndorsementButtonText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.emptyEndorsementText}>No endorsements yet</Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* LIBRARY / LIST MANAGEMENT */}
              <Text style={styles.sectionTitle}>📚 Library / List Management</Text>
              <Text style={styles.helpText}>
                Manage this user's lists. Note: Endorsement lists, aligned/unaligned lists cannot be deleted.
              </Text>

              {loadingLists ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
              ) : userLists.length === 0 ? (
                <Text style={styles.helpText}>No lists found for this user.</Text>
              ) : (
                userLists.map((list) => {
                  const isProtected = list.isEndorsed ||
                                    list.name === 'Endorsements' ||
                                    list.name === 'Aligned' ||
                                    list.name === 'Unaligned';
                  const isExpanded = expandedListId === list.id;
                  const isEditing = editingListId === list.id;

                  return (
                    <View key={list.id} style={styles.listCard}>
                      <View style={styles.listHeader}>
                        <TouchableOpacity
                          style={styles.listTitleRow}
                          onPress={() => setExpandedListId(isExpanded ? null : list.id)}
                        >
                          <Text style={styles.listName}>{list.name}</Text>
                          <Text style={styles.listCount}>({list.entries?.length || 0} items)</Text>
                        </TouchableOpacity>

                        {!isProtected && (
                          <TouchableOpacity
                            style={styles.deleteListButton}
                            onPress={() => handleDeleteList(list.id, list.name)}
                          >
                            <Text style={styles.deleteListButtonText}>Delete List</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {isProtected && (
                        <Text style={styles.protectedText}>
                          🔒 Protected list - cannot be deleted
                        </Text>
                      )}

                      {isExpanded && (
                        <View style={styles.listEntries}>
                          <TouchableOpacity
                            style={styles.addEntryButton}
                            onPress={() => setEditingListId(isEditing ? null : list.id)}
                          >
                            <Text style={styles.addEntryButtonText}>
                              {isEditing ? 'Cancel' : '+ Add Brand/Business'}
                            </Text>
                          </TouchableOpacity>

                          {isEditing && (
                            <View style={styles.addEntryForm}>
                              <Text style={styles.label}>Brand ID</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="e.g., nike, starbucks"
                                value={newEntryBrandId}
                                onChangeText={setNewEntryBrandId}
                              />

                              <Text style={styles.label}>OR Business ID (Firebase ID)</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="e.g., abc123xyz"
                                value={newEntryBusinessId}
                                onChangeText={setNewEntryBusinessId}
                              />

                              <TouchableOpacity
                                style={styles.submitEntryButton}
                                onPress={() => handleAddEntry(list.id)}
                              >
                                <Text style={styles.submitEntryButtonText}>Add to List</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {list.entries && list.entries.length > 0 ? (
                            list.entries.map((entry) => {
                              const entryId = entry.id || '';
                              const entryName = (entry as any).brandName || (entry as any).businessName || (entry as any).name || (entry as any).brandId || (entry as any).businessId || 'Unknown';
                              const entryType = entry.type || 'unknown';
                              const isEditingDate = editingEntryDateId === entryId;
                              const daysEndorsed = calculateDaysFromDate(entry.createdAt);
                              const dateDisplay = formatDateForDisplay(entry.createdAt);

                              return (
                                <View key={entryId} style={styles.entryRow}>
                                  <View style={styles.entryInfo}>
                                    <Text style={styles.entryName}>{entryName}</Text>
                                    <Text style={styles.entryType}>({entryType})</Text>
                                    {list.isEndorsed && (
                                      <View style={styles.entryDateContainer}>
                                        <Text style={styles.entryDateText}>
                                          Endorsed for {daysEndorsed} {daysEndorsed === 1 ? 'day' : 'days'} (since {dateDisplay})
                                        </Text>
                                        {isEditingDate ? (
                                          <View style={styles.editDateContainer}>
                                            <TextInput
                                              style={styles.dateInput}
                                              value={editingEntryDateValue}
                                              onChangeText={setEditingEntryDateValue}
                                              placeholder="YYYY-MM-DD"
                                              placeholderTextColor="#999"
                                            />
                                            <TouchableOpacity
                                              style={styles.saveDateButton}
                                              onPress={() => handleUpdateEntryDate(list.id, entryId, editingEntryDateValue, entry)}
                                            >
                                              <Text style={styles.saveDateButtonText}>Save</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              style={styles.cancelDateButton}
                                              onPress={() => {
                                                setEditingEntryDateId(null);
                                                setEditingEntryDateValue('');
                                              }}
                                            >
                                              <Text style={styles.cancelDateButtonText}>Cancel</Text>
                                            </TouchableOpacity>
                                          </View>
                                        ) : (
                                          <TouchableOpacity
                                            style={styles.editDateButton}
                                            onPress={() => {
                                              setEditingEntryDateId(entryId);
                                              setEditingEntryDateValue(dateDisplay !== 'Not set' && dateDisplay !== 'Invalid date' ? dateDisplay : '');
                                            }}
                                          >
                                            <Text style={styles.editDateButtonText}>Edit Date</Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                  <TouchableOpacity
                                    style={styles.removeEntryButton}
                                    onPress={() => handleRemoveEntry(list.id, entryId, entryName)}
                                  >
                                    <Text style={styles.removeEntryButtonText}>Remove</Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            })
                          ) : (
                            <Text style={styles.emptyListText}>No entries in this list</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save All Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Create User Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New User</Text>
              <Text style={styles.helpText}>
                Create a new user account directly in Firebase. Note: This creates a database profile only.
                For full authentication, you may need to create the user in Clerk separately.
              </Text>

              <Text style={styles.sectionTitle}>🔑 Required Fields</Text>

              <Text style={styles.label}>User ID (Firebase Document ID)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., user_abc123 or clerk_user_id"
                value={createUserId}
                onChangeText={setCreateUserId}
                autoCapitalize="none"
              />
              <Text style={styles.helpText}>
                This will be the document ID in Firebase. Use the Clerk user ID if syncing with Clerk.
              </Text>

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="user@example.com"
                value={createEmail}
                onChangeText={setCreateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.sectionTitle}>👤 Basic Information</Text>

              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                value={createFirstName}
                onChangeText={setCreateFirstName}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Doe"
                value={createLastName}
                onChangeText={setCreateLastName}
                autoCapitalize="words"
              />

              <Text style={styles.sectionTitle}>📋 Profile Details</Text>

              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                value={createName}
                onChangeText={setCreateName}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="A short bio about this user..."
                value={createDescription}
                onChangeText={setCreateDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., New York, NY"
                value={createLocation}
                onChangeText={setCreateLocation}
              />

              <Text style={styles.label}>Profile Image</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/profile.jpg"
                  value={createProfileImageUrl}
                  onChangeText={setCreateProfileImageUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, createProfileUploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!createUserId.trim()) {
                      Alert.alert('User ID Required', 'Please enter a User ID first to upload images.');
                      return;
                    }
                    setCreateProfileUploading(true);
                    const url = await pickAndUploadImage(createUserId.trim(), 'profile', [1, 1]);
                    if (url) {
                      setCreateProfileImageUrl(url);
                    }
                    setCreateProfileUploading(false);
                  }}
                  disabled={createProfileUploading}
                >
                  {createProfileUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {createProfileImageUrl ? (
                <Image source={{ uri: createProfileImageUrl }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12, alignSelf: 'center' }} />
              ) : null}

              <Text style={styles.label}>Cover Image</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/cover.jpg"
                  value={createCoverImageUrl}
                  onChangeText={setCreateCoverImageUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, createCoverUploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!createUserId.trim()) {
                      Alert.alert('User ID Required', 'Please enter a User ID first to upload images.');
                      return;
                    }
                    setCreateCoverUploading(true);
                    const url = await pickAndUploadImage(createUserId.trim(), 'cover', [16, 9]);
                    if (url) {
                      setCreateCoverImageUrl(url);
                    }
                    setCreateCoverUploading(false);
                  }}
                  disabled={createCoverUploading}
                >
                  {createCoverUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {createCoverImageUrl ? (
                <Image source={{ uri: createCoverImageUrl }} style={{ width: '100%', height: 80, borderRadius: 8, marginBottom: 12 }} />
              ) : null}

              <Text style={styles.sectionTitle}>💡 Values (Optional)</Text>
              <Text style={styles.helpText}>
                Format: id|name|category|type (one per line). Type can be "support" or "avoid".
                {'\n'}Example: environment|Environment|Social|support
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="environment|Environment|Social|support&#10;animal-welfare|Animal Welfare|Social|support"
                value={createCauses}
                onChangeText={setCreateCauses}
                multiline
                numberOfLines={5}
              />

              <Text style={styles.sectionTitle}>🔐 Authentication Setup (IMPORTANT)</Text>
              <View style={[styles.authWarningBox, { backgroundColor: '#fff3cd', borderColor: '#ffc107' }]}>
                <Text style={[styles.authWarningTitle, { color: '#856404' }]}>⚠️ This Does NOT Create a Login</Text>
                <Text style={[styles.authWarningText, { color: '#856404' }]}>
                  Creating a user here only creates their Firebase profile data. The user will NOT be able to log in unless you also create them in Clerk.
                </Text>
              </View>
              <Text style={[styles.helpText, { marginTop: 12 }]}>
                <Text style={styles.boldText}>To create a fully authenticated user:</Text>
                {'\n\n'}1. Go to Clerk Dashboard (dashboard.clerk.com)
                {'\n'}2. Navigate to "Users" → "Create user"
                {'\n'}3. Enter their email and set a password
                {'\n'}4. Copy the Clerk User ID (starts with "user_")
                {'\n'}5. Use that EXACT Clerk User ID in the "User ID" field above
                {'\n'}6. The email should match in both Clerk and here
                {'\n\n'}<Text style={styles.boldText}>Why this matters:</Text>
                {'\n'}• Clerk handles all authentication (login, passwords, sessions)
                {'\n'}• Firebase stores profile data (name, bio, causes, etc.)
                {'\n'}• The Clerk User ID must match the Firebase document ID
                {'\n'}• Without matching IDs, the user can log in but won't see their profile
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreateModal(false);
                    setCreateUserId('');
                    setCreateEmail('');
                    setCreateFirstName('');
                    setCreateLastName('');
                    setCreateName('');
                    setCreateDescription('');
                    setCreateLocation('');
                    setCreateProfileImageUrl('');
                    setCreateCoverImageUrl('');
                    setCreateCauses('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isCreatingUser && { opacity: 0.6 }]}
                  onPress={handleCreateUser}
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Create User</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bulk Create Modal */}
      <Modal visible={showBulkModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Bulk Create User Profiles</Text>
              <Text style={styles.helpText}>
                <Text style={styles.boldText}>NOTE:</Text> This creates database profiles only. Authentication accounts must be created separately.
                {'\n\n'}
                <Text style={styles.boldText}>Basic Format:</Text> userId,email,name,location
                {'\n'}
                <Text style={styles.boldText}>All Available Fields:</Text>
                {'\n'}• Core: userId,email
                {'\n'}• Profile: name,description,website,location,latitude,longitude
                {'\n'}• Social: facebook,instagram,twitter,linkedin,yelp,youtube
                {'\n'}• Other: promoCode,donationAmount,consentGivenAt,consentVersion
                {'\n'}• Note: causes, searchHistory, selectedCharities are better managed through the edit interface
                {'\n\n'}
                <Text style={styles.boldText}>Format Details:</Text>
                {'\n'}• Coordinates: latitude and longitude as decimal numbers (e.g., 40.7128, -74.0060)
                {'\n'}• Social media: Full URLs (e.g., https://facebook.com/username)
                {'\n'}• Dates: ISO format (e.g., 2025-01-15T10:30:00Z)
                {'\n\n'}
                <Text style={styles.boldText}>Basic Example:</Text>
                {'\n'}userId,email,name,location
                {'\n'}user123,john@example.com,John Doe,New York NY
                {'\n\n'}
                <Text style={styles.boldText}>Full Example:</Text>
                {'\n'}userId,email,name,description,website,location,latitude,longitude,instagram,promoCode
                {'\n'}user456,jane@example.com,Jane Smith,Coffee enthusiast,https://jane.com,Brooklyn NY,40.6782,-73.9442,https://instagram.com/janesmith,WELCOME2025
              </Text>

              <TextInput
                style={[styles.input, styles.bulkTextArea]}
                placeholder="Paste CSV data here..."
                value={bulkData}
                onChangeText={setBulkData}
                multiline
                numberOfLines={15}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowBulkModal(false);
                    setBulkData('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={() => Alert.alert('Info', 'Bulk creation for users requires additional setup. Please use individual creation for now.')}>
                  <Text style={styles.saveButtonText}>Create All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchBar: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 12,
  },
  createButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  bulkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkTextArea: {
    height: 300,
    paddingTop: 12,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  userLocation: {
    fontSize: 12,
    color: '#666',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  impersonateButton: {
    backgroundColor: '#6f42c1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  impersonateButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  previewSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  previewText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  userDetails: {
    backgroundColor: '#f0f4f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginTop: 8,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '600',
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  uploadButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // List management styles
  listCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 8,
  },
  listCount: {
    fontSize: 14,
    color: '#6c757d',
  },
  protectedText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  deleteListButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteListButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listEntries: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  addEntryButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  addEntryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  addEntryForm: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  submitEntryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  submitEntryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  entryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entryName: {
    fontSize: 14,
    color: '#000',
    marginRight: 8,
  },
  entryType: {
    fontSize: 12,
    color: '#6c757d',
  },
  removeEntryButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  removeEntryButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyListText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  entryDateContainer: {
    marginTop: 4,
  },
  entryDateText: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
  },
  editDateButton: {
    marginTop: 4,
  },
  editDateButtonText: {
    fontSize: 11,
    color: '#6c757d',
    textDecorationLine: 'underline',
  },
  editDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    backgroundColor: '#fff',
  },
  saveDateButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  saveDateButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cancelDateButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cancelDateButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  authWarningBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  authWarningTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  authWarningText: {
    fontSize: 13,
    lineHeight: 18,
  },
  referralSourceTag: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  // Followers/Following management styles
  followCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  followHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  followTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  expandIcon: {
    fontSize: 14,
    color: '#6c757d',
  },
  followContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  addFollowButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  addFollowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  addFollowForm: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  submitFollowButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  submitFollowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  followRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  followInfo: {
    flex: 1,
  },
  followId: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  followType: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 2,
  },
  followDate: {
    fontSize: 11,
    color: '#6c757d',
    marginTop: 2,
  },
  removeFollowButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  removeFollowButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyFollowText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  // Endorsement management styles
  endorsementCard: {
    backgroundColor: '#fff9e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  noEndorsementText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 12,
  },
  createEndorsementButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  createEndorsementButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  endorsementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  endorsementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  endorsementContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ffd54f',
  },
  addEndorsementButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  addEndorsementButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  addEndorsementForm: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  submitEndorsementButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  submitEndorsementButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  endorsementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  endorsementInfo: {
    flex: 1,
  },
  endorsementName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  endorsementType: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 2,
  },
  endorsementDays: {
    fontSize: 11,
    color: '#28a745',
    marginTop: 2,
  },
  endorsementRank: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6c757d',
    minWidth: 28,
  },
  endorsementMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metricsEditButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  metricsEditButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  metricsEditContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  metricsEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metricsEditLabel: {
    fontSize: 12,
    color: '#495057',
    minWidth: 100,
  },
  metricsEditInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    width: 60,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  metricsEditButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metricsSaveButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  metricsSaveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  metricsCancelButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  metricsCancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeEndorsementButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  removeEndorsementButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyEndorsementText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
