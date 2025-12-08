/**
 * Admin Panel - Businesses Management
 *
 * Edit ALL fields in business profiles
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
  Switch,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getUserLists, deleteList, removeEntryFromList, addEntryToList } from '@/services/firebase/listService';
import { UserList, ListEntry } from '@/types/library';
import { deleteAllFollowsForUser, deleteAllFollowsForEntity } from '@/services/firebase/followService';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { pickAndUploadImage } from '@/lib/imageUpload';
import { Image } from 'react-native';

// Helper function to extract just the referral code from a URL or return as-is if it's just a code
const sanitizeReferralCode = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Check if it looks like a URL
  if (trimmed.includes('?') || trimmed.includes('/')) {
    // Try to extract the ref or source parameter
    const refMatch = trimmed.match(/[?&]ref=([^&\s]+)/i);
    if (refMatch) return refMatch[1];

    const sourceMatch = trimmed.match(/[?&]source=([^&\s]+)/i);
    if (sourceMatch) return sourceMatch[1];

    // If it's a URL but no ref param found, try to get the last path segment
    const pathMatch = trimmed.match(/\/([^/?]+)(?:\?|$)/);
    if (pathMatch) return pathMatch[1];
  }

  // Return as-is (it's just a code)
  return trimmed;
};

interface Affiliate {
  name: string;
  relationship: string;
}

interface Partnership {
  name: string;
  relationship: string;
}

interface Ownership {
  name: string;
  relationship: string;
}

interface SocialMedia {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  yelp?: string;
  youtube?: string;
}

interface BusinessLocation {
  address: string;
  latitude: number;
  longitude: number;
  isPrimary?: boolean;
}

interface GalleryImage {
  imageUrl: string;
  caption: string;
}

interface BusinessData {
  userId: string;
  email: string;
  businessName: string;
  category: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  galleryImages?: GalleryImage[];
  locations?: BusinessLocation[];
  acceptsStandDiscounts: boolean;
  acceptsQRCode?: boolean;
  acceptsValueCode?: boolean;
  valueCodeDiscount?: number;
  customerDiscountPercent?: number;
  customDiscount?: string;
  socialMedia?: SocialMedia;
  affiliates?: Affiliate[];
  partnerships?: Partnership[];
  ownership?: Ownership[];
  ownershipSources?: string;
  referralCode?: string; // Unique referral code for tracking signups
  referralCount?: number; // Number of users who signed up via this business's referral
}

export default function BusinessesManagement() {
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [editingBusiness, setEditingBusiness] = useState<BusinessData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);

  // Create business form state
  const [createUserId, setCreateUserId] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createBusinessName, setCreateBusinessName] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createWebsite, setCreateWebsite] = useState('');
  const [createLogoUrl, setCreateLogoUrl] = useState('');
  const [createCoverImageUrl, setCreateCoverImageUrl] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createLatitude, setCreateLatitude] = useState('');
  const [createLongitude, setCreateLongitude] = useState('');
  const [createAcceptsDiscounts, setCreateAcceptsDiscounts] = useState(false);
  const [createDiscountPercent, setCreateDiscountPercent] = useState('');
  const [createCustomDiscount, setCreateCustomDiscount] = useState('');
  const [createFacebook, setCreateFacebook] = useState('');
  const [createInstagram, setCreateInstagram] = useState('');
  const [createTwitter, setCreateTwitter] = useState('');
  const [createLinkedin, setCreateLinkedin] = useState('');
  const [createReferralCode, setCreateReferralCode] = useState('');
  const [createLocationConfirmed, setCreateLocationConfirmed] = useState(false);
  const [createLogoUploading, setCreateLogoUploading] = useState(false);
  const [createCoverUploading, setCreateCoverUploading] = useState(false);

  // Form state - Basic Info
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formCoverImageUrl, setFormCoverImageUrl] = useState('');

  // Edit modal upload states
  const [editLogoUploading, setEditLogoUploading] = useState(false);
  const [editCoverUploading, setEditCoverUploading] = useState(false);
  const [editGallery1Uploading, setEditGallery1Uploading] = useState(false);
  const [editGallery2Uploading, setEditGallery2Uploading] = useState(false);
  const [editGallery3Uploading, setEditGallery3Uploading] = useState(false);

  // Form state - Gallery Images
  const [formGalleryImage1Url, setFormGalleryImage1Url] = useState('');
  const [formGalleryImage1Caption, setFormGalleryImage1Caption] = useState('');
  const [formGalleryImage2Url, setFormGalleryImage2Url] = useState('');
  const [formGalleryImage2Caption, setFormGalleryImage2Caption] = useState('');
  const [formGalleryImage3Url, setFormGalleryImage3Url] = useState('');
  const [formGalleryImage3Caption, setFormGalleryImage3Caption] = useState('');

  // Form state - Locations (as text fields for simplicity)
  const [formLocations, setFormLocations] = useState('');

  // Form state - Discounts
  const [formAcceptsStandDiscounts, setFormAcceptsStandDiscounts] = useState(false);
  const [formAcceptsQRCode, setFormAcceptsQRCode] = useState(false);
  const [formAcceptsValueCode, setFormAcceptsValueCode] = useState(false);
  const [formValueCodeDiscount, setFormValueCodeDiscount] = useState('');
  const [formCustomerDiscountPercent, setFormCustomerDiscountPercent] = useState('');
  const [formCustomDiscount, setFormCustomDiscount] = useState('');

  // Form state - Social Media
  const [formFacebook, setFormFacebook] = useState('');
  const [formInstagram, setFormInstagram] = useState('');
  const [formTwitter, setFormTwitter] = useState('');
  const [formLinkedin, setFormLinkedin] = useState('');
  const [formYelp, setFormYelp] = useState('');
  const [formYoutube, setFormYoutube] = useState('');

  // Form state - Money Flow
  const [formAffiliates, setFormAffiliates] = useState('');
  const [formPartnerships, setFormPartnerships] = useState('');
  const [formOwnership, setFormOwnership] = useState('');
  const [formOwnershipSources, setFormOwnershipSources] = useState('');

  // Form state - Referral
  const [formReferralCode, setFormReferralCode] = useState('');

  // List management state
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [newEntryBrandId, setNewEntryBrandId] = useState('');
  const [newEntryBusinessId, setNewEntryBusinessId] = useState('');

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      setIsLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('accountType', '==', 'business'));
      const snapshot = await getDocs(q);

      // First, load all businesses
      const loadedBusinesses: BusinessData[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          if (!data.businessInfo) return null;

          const biz = data.businessInfo;
          return {
            userId: doc.id,
            email: data.email || 'No email',
            businessName: biz.name || 'Unnamed Business',
            category: biz.category || 'Uncategorized',
            description: biz.description || '',
            website: biz.website || '',
            logoUrl: biz.logoUrl || '',
            coverImageUrl: biz.coverImageUrl || '',
            galleryImages: biz.galleryImages || [],
            locations: biz.locations || [],
            acceptsStandDiscounts: biz.acceptsStandDiscounts || false,
            acceptsQRCode: biz.acceptsQRCode || false,
            acceptsValueCode: biz.acceptsValueCode || false,
            valueCodeDiscount: biz.valueCodeDiscount || 0,
            customerDiscountPercent: biz.customerDiscountPercent || 0,
            customDiscount: biz.customDiscount || '',
            socialMedia: biz.socialMedia || {},
            affiliates: biz.affiliates || [],
            partnerships: biz.partnerships || [],
            ownership: biz.ownership || [],
            ownershipSources: biz.ownershipSources || '',
            referralCode: biz.referralCode || '',
            referralCount: 0, // Will be populated below
          };
        })
        .filter((b): b is BusinessData => b !== null);

      // Count referred users for each business that has a referral code
      const businessesWithReferrals = loadedBusinesses.filter(b => b.referralCode);
      if (businessesWithReferrals.length > 0) {
        // Get all users with referralSource
        const allUsersQuery = query(usersRef, where('referralSource', '!=', ''));
        const allUsersSnapshot = await getDocs(allUsersQuery);

        // Create a map of referralSource -> count
        const referralCounts = new Map<string, number>();
        allUsersSnapshot.docs.forEach((userDoc) => {
          const userData = userDoc.data();
          const source = userData.referralSource;
          if (source) {
            referralCounts.set(source, (referralCounts.get(source) || 0) + 1);
          }
        });

        // Update business referral counts
        loadedBusinesses.forEach((business) => {
          if (business.referralCode) {
            business.referralCount = referralCounts.get(business.referralCode) || 0;
          }
        });
      }

      setBusinesses(loadedBusinesses);
    } catch (error) {
      console.error('Error loading businesses:', error);
      Alert.alert('Error', 'Failed to load businesses from Firebase');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (business: BusinessData) => {
    setEditingBusiness(business);

    // Basic info
    setFormName(business.businessName);
    setFormCategory(business.category);
    setFormDescription(business.description || '');
    setFormWebsite(business.website || '');
    setFormLogoUrl(business.logoUrl || '');
    setFormCoverImageUrl(business.coverImageUrl || '');

    // Gallery images
    const gallery = business.galleryImages || [];
    setFormGalleryImage1Url(gallery[0]?.imageUrl || '');
    setFormGalleryImage1Caption(gallery[0]?.caption || '');
    setFormGalleryImage2Url(gallery[1]?.imageUrl || '');
    setFormGalleryImage2Caption(gallery[1]?.caption || '');
    setFormGalleryImage3Url(gallery[2]?.imageUrl || '');
    setFormGalleryImage3Caption(gallery[2]?.caption || '');

    // Locations (formatted as address|lat|lng|isPrimary)
    setFormLocations(
      business.locations
        ?.map((loc) => `${loc.address}|${loc.latitude}|${loc.longitude}|${loc.isPrimary ? 'primary' : ''}`)
        .join('\n') || ''
    );

    // Discounts
    setFormAcceptsStandDiscounts(business.acceptsStandDiscounts);
    setFormAcceptsQRCode(business.acceptsQRCode || false);
    setFormAcceptsValueCode(business.acceptsValueCode || false);
    setFormValueCodeDiscount(business.valueCodeDiscount?.toString() || '');
    setFormCustomerDiscountPercent(business.customerDiscountPercent?.toString() || '');
    setFormCustomDiscount(business.customDiscount || '');

    // Social media
    const social = business.socialMedia || {};
    setFormFacebook(social.facebook || '');
    setFormInstagram(social.instagram || '');
    setFormTwitter(social.twitter || '');
    setFormLinkedin(social.linkedin || '');
    setFormYelp(social.yelp || '');
    setFormYoutube(social.youtube || '');

    // Money flow
    setFormAffiliates(
      business.affiliates?.map((a) => `${a.name}|${a.relationship}`).join('\n') || ''
    );
    setFormPartnerships(
      business.partnerships?.map((p) => `${p.name}|${p.relationship}`).join('\n') || ''
    );
    setFormOwnership(
      business.ownership?.map((o) => `${o.name}|${o.relationship}`).join('\n') || ''
    );
    setFormOwnershipSources(business.ownershipSources || '');

    // Referral
    setFormReferralCode(business.referralCode || '');

    // Load user lists
    loadUserLists(business.userId);

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBusiness(null);
  };

  // List management functions
  const loadUserLists = async (userId: string) => {
    try {
      setLoadingLists(true);
      const lists = await getUserLists(userId);
      setUserLists(lists);
    } catch (error) {
      console.error('[Admin] Error loading user lists:', error);
      setUserLists([]);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!editingBusiness) return;

    const confirmDelete =
      Platform.OS === 'web'
        ? window.confirm(`Are you sure you want to delete "${listName}"? This cannot be undone.`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Delete List',
              `Are you sure you want to delete "${listName}"? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });

    if (!confirmDelete) return;

    try {
      await deleteList(listId);
      await loadUserLists(editingBusiness.userId);
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
    if (!editingBusiness) return;

    try {
      await removeEntryFromList(listId, entryId);
      await loadUserLists(editingBusiness.userId);
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

      if (editingBusiness) {
        await loadUserLists(editingBusiness.userId);
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

  const parseMoneyFlowSection = (text: string): { name: string; relationship: string }[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => {
        const [name, relationship] = line.split('|').map((s) => s.trim());
        return { name: name || '', relationship: relationship || '' };
      })
      .filter((item) => item.name);
  };

  const parseLocations = (text: string): BusinessLocation[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => {
        const [address, lat, lng, isPrimaryStr] = line.split('|').map((s) => s.trim());
        return {
          address: address || '',
          latitude: parseFloat(lat) || 0,
          longitude: parseFloat(lng) || 0,
          isPrimary: isPrimaryStr === 'primary',
        };
      })
      .filter((loc) => loc.address);
  };

  const handleSave = async () => {
    if (!editingBusiness) return;

    try {
      // Build gallery images array
      const galleryImages: GalleryImage[] = [];
      if (formGalleryImage1Url) {
        galleryImages.push({ imageUrl: formGalleryImage1Url, caption: formGalleryImage1Caption });
      }
      if (formGalleryImage2Url) {
        galleryImages.push({ imageUrl: formGalleryImage2Url, caption: formGalleryImage2Caption });
      }
      if (formGalleryImage3Url) {
        galleryImages.push({ imageUrl: formGalleryImage3Url, caption: formGalleryImage3Caption });
      }

      // Build social media object
      const socialMedia: SocialMedia = {};
      if (formFacebook) socialMedia.facebook = formFacebook;
      if (formInstagram) socialMedia.instagram = formInstagram;
      if (formTwitter) socialMedia.twitter = formTwitter;
      if (formLinkedin) socialMedia.linkedin = formLinkedin;
      if (formYelp) socialMedia.yelp = formYelp;
      if (formYoutube) socialMedia.youtube = formYoutube;

      const updatedBusinessInfo: any = {
        name: formName,
        category: formCategory,
        description: formDescription,
        website: formWebsite,
        logoUrl: formLogoUrl,
        coverImageUrl: formCoverImageUrl,
        galleryImages: galleryImages,
        locations: parseLocations(formLocations),
        acceptsStandDiscounts: formAcceptsStandDiscounts,
        acceptsQRCode: formAcceptsQRCode,
        acceptsValueCode: formAcceptsValueCode,
        valueCodeDiscount: parseFloat(formValueCodeDiscount) || 0,
        customerDiscountPercent: parseFloat(formCustomerDiscountPercent) || 0,
        customDiscount: formCustomDiscount,
        socialMedia: socialMedia,
        affiliates: parseMoneyFlowSection(formAffiliates),
        partnerships: parseMoneyFlowSection(formPartnerships),
        ownership: parseMoneyFlowSection(formOwnership),
        ownershipSources: formOwnershipSources.trim(),
      };

      // Only add referralCode if it's not empty (Firebase doesn't allow undefined)
      if (formReferralCode.trim()) {
        updatedBusinessInfo.referralCode = formReferralCode.trim();
      }

      const userRef = doc(db, 'users', editingBusiness.userId);

      // Update the entire businessInfo object
      await updateDoc(userRef, {
        businessInfo: updatedBusinessInfo,
      });

      Alert.alert(
        'Success',
        `Business "${formName}" updated successfully`
      );

      closeModal();
      loadBusinesses();
    } catch (error) {
      console.error('Error updating business:', error);
      Alert.alert('Error', 'Failed to update business data');
    }
  };

  const handleDeleteBusiness = async (business: BusinessData) => {
    // Confirm deletion
    const confirmMessage = `Are you sure you want to delete business "${business.businessName}"?\n\nThis will:\n- Delete the business account from Firebase\n- Delete all business data, transactions, etc.\n- Delete any business claims (allowing the place to be claimed again)\n\nThis action CANNOT be undone!`;

    let confirmed = false;

    if (Platform.OS === 'web') {
      confirmed = window.confirm(confirmMessage);
    } else {
      confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Delete Business',
          confirmMessage,
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Delete', onPress: () => resolve(true), style: 'destructive' }
          ],
          { cancelable: false }
        );
      });
    }

    if (!confirmed) return;

    try {
      console.log('[Admin Businesses] Deleting business:', business.userId);

      // Delete all follow relationships for this business (as a user and as a business entity)
      const userFollowResult = await deleteAllFollowsForUser(business.userId);
      const businessFollowResult = await deleteAllFollowsForEntity(business.userId, 'business');
      const totalDeletedFollows = userFollowResult.deleted + businessFollowResult.deleted;
      console.log(`[Admin Businesses] ✅ Deleted ${totalDeletedFollows} follow relationships`);

      // Remove this business from all users' endorsement lists
      try {
        const allListsRef = collection(db, 'userLists');
        const allListsSnapshot = await getDocs(allListsRef);
        let removedFromLists = 0;

        for (const listDoc of allListsSnapshot.docs) {
          const listData = listDoc.data();
          const entries = listData.entries || [];

          // Check if this list contains an entry for the deleted business
          const hasBusinessEntry = entries.some(
            (entry: any) => entry?.type === 'business' && entry?.businessId === business.userId
          );

          if (hasBusinessEntry) {
            // Filter out the deleted business entry
            const updatedEntries = entries.filter(
              (entry: any) => !(entry?.type === 'business' && entry?.businessId === business.userId)
            );

            // Update the list with filtered entries
            await updateDoc(doc(db, 'userLists', listDoc.id), {
              entries: updatedEntries,
              updatedAt: new Date()
            });
            removedFromLists++;
          }
        }
        console.log(`[Admin Businesses] ✅ Removed business from ${removedFromLists} user lists`);
      } catch (listCleanupError) {
        console.error('[Admin Businesses] Error cleaning up user lists:', listCleanupError);
      }

      // Delete the user document (which includes the business account)
      const userRef = doc(db, 'users', business.userId);
      await deleteDoc(userRef);
      console.log('[Admin Businesses] ✅ Business account deleted from Firebase');

      // Delete business's lists
      try {
        const listsRef = collection(db, 'userLists');
        const listsQuery = query(listsRef, where('userId', '==', business.userId));
        const listsSnapshot = await getDocs(listsQuery);

        const deleteListPromises = listsSnapshot.docs.map(listDoc =>
          deleteDoc(doc(db, 'userLists', listDoc.id))
        );
        await Promise.all(deleteListPromises);
        console.log('[Admin Businesses] ✅ Deleted', listsSnapshot.docs.length, 'business lists');
      } catch (listError) {
        console.error('[Admin Businesses] Error deleting lists:', listError);
      }

      // Delete business's transactions
      try {
        const transactionsRef = collection(db, 'transactions');
        const transactionsQuery = query(transactionsRef, where('userId', '==', business.userId));
        const transactionsSnapshot = await getDocs(transactionsQuery);

        const deleteTransactionPromises = transactionsSnapshot.docs.map(txDoc =>
          deleteDoc(doc(db, 'transactions', txDoc.id))
        );
        await Promise.all(deleteTransactionPromises);
        console.log('[Admin Businesses] ✅ Deleted', transactionsSnapshot.docs.length, 'transactions');
      } catch (txError) {
        console.error('[Admin Businesses] Error deleting transactions:', txError);
      }

      // Delete business claims for this user (so the place can be claimed again)
      try {
        const claimsRef = collection(db, 'businessClaims');
        const claimsQuery = query(claimsRef, where('userId', '==', business.userId));
        const claimsSnapshot = await getDocs(claimsQuery);

        const deleteClaimPromises = claimsSnapshot.docs.map(claimDoc =>
          deleteDoc(doc(db, 'businessClaims', claimDoc.id))
        );
        await Promise.all(deleteClaimPromises);
        console.log('[Admin Businesses] ✅ Deleted', claimsSnapshot.docs.length, 'business claims');
      } catch (claimError) {
        console.error('[Admin Businesses] Error deleting business claims:', claimError);
      }

      // Reload businesses list
      await loadBusinesses();

      // Show success message
      if (Platform.OS === 'web') {
        window.alert('Business deleted successfully!');
      } else {
        Alert.alert('Success', 'Business deleted successfully!');
      }
    } catch (error: any) {
      console.error('[Admin Businesses] ❌ Error deleting business:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';

      if (Platform.OS === 'web') {
        window.alert(`Failed to delete business: ${errorMessage}`);
      } else {
        Alert.alert('Error', `Failed to delete business: ${errorMessage}`);
      }
    }
  };

  const handleCreateBusiness = async () => {
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

    if (!createBusinessName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Business name is required');
      } else {
        Alert.alert('Error', 'Business name is required');
      }
      return;
    }

    if (!createCategory.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Category is required');
      } else {
        Alert.alert('Error', 'Category is required');
      }
      return;
    }

    setIsCreatingBusiness(true);

    try {
      const userRef = doc(db, 'users', createUserId.trim());

      // Build locations array if address provided
      const locations: BusinessLocation[] = [];
      if (createAddress.trim()) {
        locations.push({
          address: createAddress.trim(),
          latitude: parseFloat(createLatitude) || 0,
          longitude: parseFloat(createLongitude) || 0,
          isPrimary: true,
        });
      }

      // Build social media object
      const socialMedia: SocialMedia = {};
      if (createFacebook.trim()) socialMedia.facebook = createFacebook.trim();
      if (createInstagram.trim()) socialMedia.instagram = createInstagram.trim();
      if (createTwitter.trim()) socialMedia.twitter = createTwitter.trim();
      if (createLinkedin.trim()) socialMedia.linkedin = createLinkedin.trim();

      const businessInfo = {
        name: createBusinessName.trim(),
        category: createCategory.trim(),
        description: createDescription.trim() || '',
        website: createWebsite.trim() || '',
        logoUrl: createLogoUrl.trim() || '',
        coverImageUrl: createCoverImageUrl.trim() || '',
        locations: locations,
        acceptsStandDiscounts: createAcceptsDiscounts,
        acceptsQRCode: false,
        acceptsValueCode: false,
        valueCodeDiscount: 0,
        customerDiscountPercent: parseFloat(createDiscountPercent) || 0,
        customDiscount: createCustomDiscount.trim() || '',
        socialMedia: socialMedia,
        galleryImages: [],
        affiliates: [],
        partnerships: [],
        ownership: [],
        ownershipSources: '',
        referralCode: createReferralCode.trim() || undefined,
      };

      const newBusinessData = {
        email: createEmail.trim(),
        accountType: 'business',
        businessInfo: businessInfo,
        causes: [],
        searchHistory: [],
        createdAt: new Date().toISOString(),
      };

      await setDoc(userRef, newBusinessData);

      // Reset form
      setCreateUserId('');
      setCreateEmail('');
      setCreateBusinessName('');
      setCreateCategory('');
      setCreateDescription('');
      setCreateWebsite('');
      setCreateLogoUrl('');
      setCreateCoverImageUrl('');
      setCreateAddress('');
      setCreateLatitude('');
      setCreateLongitude('');
      setCreateAcceptsDiscounts(false);
      setCreateDiscountPercent('');
      setCreateCustomDiscount('');
      setCreateFacebook('');
      setCreateInstagram('');
      setCreateTwitter('');
      setCreateLinkedin('');
      setCreateReferralCode('');
      setCreateLocationConfirmed(false);
      setShowCreateModal(false);

      // Reload businesses
      await loadBusinesses();

      if (Platform.OS === 'web') {
        window.alert('Business created successfully!');
      } else {
        Alert.alert('Success', 'Business created successfully!');
      }
    } catch (error: any) {
      console.error('[Admin Businesses] Error creating business:', error);
      const errorMessage = error?.message || 'Unknown error';
      if (Platform.OS === 'web') {
        window.alert(`Failed to create business: ${errorMessage}`);
      } else {
        Alert.alert('Error', `Failed to create business: ${errorMessage}`);
      }
    } finally {
      setIsCreatingBusiness(false);
    }
  };

  const filteredBusinesses = businesses.filter(
    (business) =>
      business.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading businesses...</Text>
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
        <Text style={styles.title}>Businesses Management</Text>
        <Text style={styles.subtitle}>
          {businesses.length} business accounts ({filteredBusinesses.length} filtered)
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, styles.actionsBar]}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by business name, email, or category..."
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

      {/* Businesses List */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.listContainer}>
          {filteredBusinesses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No businesses found matching your search' : 'No business accounts yet'}
              </Text>
            </View>
          ) : (
            filteredBusinesses.map((business) => (
              <View key={business.userId} style={styles.businessCard}>
                <View style={styles.businessHeader}>
                  <View style={styles.businessInfo}>
                    <Text style={styles.businessName}>{business.businessName}</Text>
                    <Text style={styles.businessCategory}>{business.category}</Text>
                    <Text style={styles.businessEmail}>{business.email}</Text>
                  </View>
                  <View style={styles.businessActions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openEditModal(business)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteBusiness(business)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Preview */}
                {business.website && (
                  <Text style={styles.previewText}>🌐 {business.website}</Text>
                )}
                {business.locations && business.locations.length > 0 && (
                  <Text style={styles.previewText}>📍 {business.locations.length} location(s)</Text>
                )}
                {business.referralCode && (
                  <Text style={styles.referralTag}>🔗 Referral: {business.referralCode}</Text>
                )}
                {business.referralCount !== undefined && business.referralCount > 0 && (
                  <Text style={styles.referralCountTag}>👥 {business.referralCount} referral signup{business.referralCount !== 1 ? 's' : ''}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Business Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Business</Text>
              <Text style={styles.helpText}>
                Create a new business account directly in Firebase. Note: This creates a database profile only.
                For full authentication, you may need to create the user in Clerk separately.
              </Text>

              <Text style={styles.sectionTitle}>🔑 Required Fields</Text>

              <Text style={styles.label}>User ID (Firebase Document ID) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., biz_abc123 or clerk_user_id"
                value={createUserId}
                onChangeText={setCreateUserId}
                autoCapitalize="none"
              />
              <View style={[styles.authWarningBox, { backgroundColor: '#fff3cd', borderColor: '#ffc107' }]}>
                <Text style={[styles.authWarningTitle, { color: '#856404' }]}>⚠️ Important: Authentication Required</Text>
                <Text style={[styles.authWarningText, { color: '#856404' }]}>
                  This only creates the Firebase profile. To allow login, first create the business user in Clerk Dashboard, then use that Clerk User ID here.
                </Text>
              </View>

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="business@example.com"
                value={createEmail}
                onChangeText={setCreateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Joe's Coffee Shop"
                value={createBusinessName}
                onChangeText={setCreateBusinessName}
              />

              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Restaurant, Retail, Service"
                value={createCategory}
                onChangeText={setCreateCategory}
              />

              <Text style={styles.sectionTitle}>📋 Business Details</Text>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="A short description of the business..."
                value={createDescription}
                onChangeText={setCreateDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Website</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com"
                value={createWebsite}
                onChangeText={setCreateWebsite}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Logo Image</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/logo.png"
                  value={createLogoUrl}
                  onChangeText={setCreateLogoUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, createLogoUploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!createUserId) {
                      Alert.alert('User ID Required', 'Please enter a User ID first to upload images.');
                      return;
                    }
                    setCreateLogoUploading(true);
                    const url = await pickAndUploadImage(createUserId, 'business', [1, 1]);
                    if (url) {
                      setCreateLogoUrl(url);
                    }
                    setCreateLogoUploading(false);
                  }}
                  disabled={createLogoUploading}
                >
                  {createLogoUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {createLogoUrl ? (
                <Image source={{ uri: createLogoUrl }} style={{ width: 60, height: 60, borderRadius: 8, marginBottom: 12 }} />
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
                    if (!createUserId) {
                      Alert.alert('User ID Required', 'Please enter a User ID first to upload images.');
                      return;
                    }
                    setCreateCoverUploading(true);
                    const url = await pickAndUploadImage(createUserId, 'cover', [16, 9]);
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
                <Image source={{ uri: createCoverImageUrl }} style={{ width: '100%', height: 100, borderRadius: 8, marginBottom: 12 }} />
              ) : null}

              <Text style={styles.sectionTitle}>📍 Location (Optional)</Text>

              <Text style={styles.label}>Address</Text>
              <LocationAutocomplete
                value={createAddress}
                onLocationSelect={(address, lat, lng) => {
                  setCreateAddress(address);
                  setCreateLatitude(lat.toString());
                  setCreateLongitude(lng.toString());
                  setCreateLocationConfirmed(true);
                }}
                isDarkMode={false}
                placeholder="Type address and click search to verify"
                isConfirmed={createLocationConfirmed}
              />
              {createLocationConfirmed && createLatitude && createLongitude && (
                <Text style={[styles.helpText, { color: '#22C55E' }]}>
                  ✓ Location verified: {createLatitude}, {createLongitude}
                </Text>
              )}

              <Text style={styles.sectionTitle}>💳 Discounts</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Accepts Endorse Discounts</Text>
                <Switch
                  value={createAcceptsDiscounts}
                  onValueChange={setCreateAcceptsDiscounts}
                />
              </View>

              <Text style={styles.label}>Discount Percent (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                value={createDiscountPercent}
                onChangeText={setCreateDiscountPercent}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Custom Discount Text</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Buy one get one free"
                value={createCustomDiscount}
                onChangeText={setCreateCustomDiscount}
              />

              <Text style={styles.sectionTitle}>📱 Social Media (Optional)</Text>

              <Text style={styles.label}>Facebook</Text>
              <TextInput
                style={styles.input}
                placeholder="https://facebook.com/..."
                value={createFacebook}
                onChangeText={setCreateFacebook}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Instagram</Text>
              <TextInput
                style={styles.input}
                placeholder="@username or https://instagram.com/..."
                value={createInstagram}
                onChangeText={setCreateInstagram}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Twitter/X</Text>
              <TextInput
                style={styles.input}
                placeholder="@username or https://twitter.com/..."
                value={createTwitter}
                onChangeText={setCreateTwitter}
                autoCapitalize="none"
              />

              <Text style={styles.label}>LinkedIn</Text>
              <TextInput
                style={styles.input}
                placeholder="https://linkedin.com/..."
                value={createLinkedin}
                onChangeText={setCreateLinkedin}
                autoCapitalize="none"
              />

              <Text style={styles.sectionTitle}>🔗 Referral Tracking</Text>

              <Text style={styles.label}>Referral Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., joescoffee, downtown1"
                value={createReferralCode}
                onChangeText={(text) => setCreateReferralCode(sanitizeReferralCode(text))}
                autoCapitalize="none"
              />
              <Text style={styles.helpText}>
                Enter just the code (e.g., "joescoffee"). If you paste a full URL, it will be automatically extracted.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreateModal(false);
                    setCreateUserId('');
                    setCreateEmail('');
                    setCreateBusinessName('');
                    setCreateCategory('');
                    setCreateDescription('');
                    setCreateWebsite('');
                    setCreateLogoUrl('');
                    setCreateCoverImageUrl('');
                    setCreateAddress('');
                    setCreateLatitude('');
                    setCreateLongitude('');
                    setCreateAcceptsDiscounts(false);
                    setCreateDiscountPercent('');
                    setCreateCustomDiscount('');
                    setCreateFacebook('');
                    setCreateInstagram('');
                    setCreateTwitter('');
                    setCreateLinkedin('');
                    setCreateReferralCode('');
                    setCreateLocationConfirmed(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isCreatingBusiness && { opacity: 0.6 }]}
                  onPress={handleCreateBusiness}
                  disabled={isCreatingBusiness}
                >
                  {isCreatingBusiness ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Create Business</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Edit Business - {editingBusiness?.businessName}
              </Text>

              <View style={styles.businessDetails}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>{editingBusiness?.email}</Text>
              </View>

              {/* BASIC INFO */}
              <Text style={styles.sectionTitle}>📋 Basic Information</Text>

              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Business name"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Restaurant, Retail, Service"
                value={formCategory}
                onChangeText={setFormCategory}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Business description"
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

              <Text style={styles.label}>Logo Image</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/logo.png"
                  value={formLogoUrl}
                  onChangeText={setFormLogoUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, editLogoUploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!editingBusiness?.userId) return;
                    setEditLogoUploading(true);
                    const url = await pickAndUploadImage(editingBusiness.userId, 'business', [1, 1]);
                    if (url) {
                      setFormLogoUrl(url);
                    }
                    setEditLogoUploading(false);
                  }}
                  disabled={editLogoUploading}
                >
                  {editLogoUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {formLogoUrl ? (
                <Image source={{ uri: formLogoUrl }} style={{ width: 60, height: 60, borderRadius: 8, marginBottom: 12 }} />
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
                    if (!editingBusiness?.userId) return;
                    setEditCoverUploading(true);
                    const url = await pickAndUploadImage(editingBusiness.userId, 'cover', [16, 9]);
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
                <Image source={{ uri: formCoverImageUrl }} style={{ width: '100%', height: 100, borderRadius: 8, marginBottom: 12 }} />
              ) : null}

              {/* GALLERY IMAGES */}
              <Text style={styles.sectionTitle}>🖼️ Gallery Images (up to 3)</Text>

              <Text style={styles.label}>Gallery Image 1</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/gallery1.jpg"
                  value={formGalleryImage1Url}
                  onChangeText={setFormGalleryImage1Url}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, editGallery1Uploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!editingBusiness?.userId) return;
                    setEditGallery1Uploading(true);
                    const url = await pickAndUploadImage(editingBusiness.userId, 'gallery', [16, 9]);
                    if (url) {
                      setFormGalleryImage1Url(url);
                    }
                    setEditGallery1Uploading(false);
                  }}
                  disabled={editGallery1Uploading}
                >
                  {editGallery1Uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {formGalleryImage1Url ? (
                <Image source={{ uri: formGalleryImage1Url }} style={{ width: '100%', height: 80, borderRadius: 8, marginBottom: 8 }} />
              ) : null}
              <Text style={styles.label}>Gallery Image 1 Caption</Text>
              <TextInput
                style={styles.input}
                placeholder="Caption for image 1"
                value={formGalleryImage1Caption}
                onChangeText={setFormGalleryImage1Caption}
              />

              <Text style={styles.label}>Gallery Image 2</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/gallery2.jpg"
                  value={formGalleryImage2Url}
                  onChangeText={setFormGalleryImage2Url}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, editGallery2Uploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!editingBusiness?.userId) return;
                    setEditGallery2Uploading(true);
                    const url = await pickAndUploadImage(editingBusiness.userId, 'gallery', [16, 9]);
                    if (url) {
                      setFormGalleryImage2Url(url);
                    }
                    setEditGallery2Uploading(false);
                  }}
                  disabled={editGallery2Uploading}
                >
                  {editGallery2Uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {formGalleryImage2Url ? (
                <Image source={{ uri: formGalleryImage2Url }} style={{ width: '100%', height: 80, borderRadius: 8, marginBottom: 8 }} />
              ) : null}
              <Text style={styles.label}>Gallery Image 2 Caption</Text>
              <TextInput
                style={styles.input}
                placeholder="Caption for image 2"
                value={formGalleryImage2Caption}
                onChangeText={setFormGalleryImage2Caption}
              />

              <Text style={styles.label}>Gallery Image 3</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/gallery3.jpg"
                  value={formGalleryImage3Url}
                  onChangeText={setFormGalleryImage3Url}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadButton, editGallery3Uploading && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!editingBusiness?.userId) return;
                    setEditGallery3Uploading(true);
                    const url = await pickAndUploadImage(editingBusiness.userId, 'gallery', [16, 9]);
                    if (url) {
                      setFormGalleryImage3Url(url);
                    }
                    setEditGallery3Uploading(false);
                  }}
                  disabled={editGallery3Uploading}
                >
                  {editGallery3Uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {formGalleryImage3Url ? (
                <Image source={{ uri: formGalleryImage3Url }} style={{ width: '100%', height: 80, borderRadius: 8, marginBottom: 8 }} />
              ) : null}
              <Text style={styles.label}>Gallery Image 3 Caption</Text>
              <TextInput
                style={styles.input}
                placeholder="Caption for image 3"
                value={formGalleryImage3Caption}
                onChangeText={setFormGalleryImage3Caption}
              />

              {/* LOCATIONS */}
              <Text style={styles.sectionTitle}>📍 Locations</Text>
              <Text style={styles.helpText}>
                Format: address|latitude|longitude|primary (one per line). Add "primary" at the end for primary location.
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="123 Main St, New York, NY|40.7128|-74.0060|primary&#10;456 2nd Ave, Brooklyn, NY|40.6782|-73.9442|"
                value={formLocations}
                onChangeText={setFormLocations}
                multiline
                numberOfLines={5}
              />

              {/* DISCOUNTS & CODES */}
              <Text style={styles.sectionTitle}>💳 Discounts & Value Codes</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Accepts Endorse Discounts</Text>
                <Switch
                  value={formAcceptsStandDiscounts}
                  onValueChange={setFormAcceptsStandDiscounts}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Accepts QR Code</Text>
                <Switch
                  value={formAcceptsQRCode}
                  onValueChange={setFormAcceptsQRCode}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Accepts Value Code</Text>
                <Switch
                  value={formAcceptsValueCode}
                  onValueChange={setFormAcceptsValueCode}
                />
              </View>

              <Text style={styles.label}>Value Code Discount (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                value={formValueCodeDiscount}
                onChangeText={setFormValueCodeDiscount}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Customer Discount Percent (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                value={formCustomerDiscountPercent}
                onChangeText={setFormCustomerDiscountPercent}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Custom Discount Text</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Buy one get one free"
                value={formCustomDiscount}
                onChangeText={setFormCustomDiscount}
              />

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

              {/* MONEY FLOW */}
              <Text style={styles.sectionTitle}>💰 Money Flow Sections</Text>
              <Text style={styles.helpText}>
                Format: Name|Relationship (one per line)
              </Text>

              <Text style={styles.label}>Affiliates (celebrities/influencers)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Taylor Swift|Multi-million&#10;LeBron James|$5M endorsement"
                value={formAffiliates}
                onChangeText={setFormAffiliates}
                multiline
                numberOfLines={5}
              />

              <Text style={styles.label}>Partnerships (business partnerships)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="TSMC|Silicon Supply Chain/2010&#10;Foxconn|Manufacturing/2005"
                value={formPartnerships}
                onChangeText={setFormPartnerships}
                multiline
                numberOfLines={5}
              />

              <Text style={styles.label}>Ownership (shareholders/investors)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Vanguard Group|~9.5%&#10;BlackRock|~7.2%"
                value={formOwnership}
                onChangeText={setFormOwnership}
                multiline
                numberOfLines={5}
              />

              <Text style={styles.label}>Ownership Sources (citations)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="HQ: Official site; Stakes: Q3 2025 13F filings via SEC/Yahoo Finance"
                value={formOwnershipSources}
                onChangeText={setFormOwnershipSources}
                multiline
                numberOfLines={3}
              />

              {/* REFERRAL TRACKING */}
              <Text style={styles.sectionTitle}>🔗 Referral Tracking</Text>

              <Text style={styles.label}>Referral Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., joescoffee, downtown1"
                value={formReferralCode}
                onChangeText={(text) => setFormReferralCode(sanitizeReferralCode(text))}
              />
              <Text style={styles.helpText}>
                Enter just the code. Full URL: https://iendorse.app/sign-up?ref={formReferralCode || 'code'}
              </Text>
              {editingBusiness?.referralCount !== undefined && editingBusiness.referralCount > 0 && (
                <View style={styles.referralStatsBox}>
                  <Text style={styles.referralStatsText}>
                    👥 {editingBusiness.referralCount} user{editingBusiness.referralCount !== 1 ? 's' : ''} signed up using this referral code
                  </Text>
                </View>
              )}

              {/* LIBRARY / LIST MANAGEMENT */}
              <Text style={styles.sectionTitle}>📚 Library / List Management</Text>
              <Text style={styles.helpText}>
                Manage this business's lists. Note: Endorsement lists, aligned/unaligned lists cannot be deleted.
              </Text>

              {loadingLists ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
              ) : userLists.length === 0 ? (
                <Text style={styles.helpText}>No lists found for this business.</Text>
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
                              const entryName = entry.name || entry.brandId || entry.businessId || 'Unknown';
                              const entryType = entry.type || 'unknown';

                              return (
                                <View key={entryId} style={styles.entryRow}>
                                  <View style={styles.entryInfo}>
                                    <Text style={styles.entryName}>{entryName}</Text>
                                    <Text style={styles.entryType}>({entryType})</Text>
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

      {/* Bulk Create Modal */}
      <Modal visible={showBulkModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Bulk Create Business Profiles</Text>
              <Text style={styles.helpText}>
                <Text style={styles.boldText}>NOTE:</Text> This creates database profiles only. Authentication accounts must be created separately.
                {'\n\n'}
                <Text style={styles.boldText}>Basic Format:</Text> userId,email,businessName,category
                {'\n'}
                <Text style={styles.boldText}>All Available Fields:</Text>
                {'\n'}• Core: userId,email,businessName,category,description,website,logoUrl,coverImageUrl
                {'\n'}• Locations: locations (format: address|lat|lng|primary;address2|lat2|lng2|)
                {'\n'}• Gallery: galleryImage1Url,galleryImage1Caption,galleryImage2Url,galleryImage2Caption,galleryImage3Url,galleryImage3Caption
                {'\n'}• Discounts: acceptsStandDiscounts,acceptsQRCode,acceptsValueCode,valueCodeDiscount,customerDiscountPercent,customDiscount
                {'\n'}• Social: facebook,instagram,twitter,linkedin,yelp,youtube
                {'\n'}• Money Flow: affiliates,partnerships,ownership,ownershipSources
                {'\n\n'}
                <Text style={styles.boldText}>Format Details:</Text>
                {'\n'}• Boolean fields: true/false (acceptsStandDiscounts, acceptsQRCode, acceptsValueCode)
                {'\n'}• Numbers: valueCodeDiscount, customerDiscountPercent (e.g., 10 for 10%)
                {'\n'}• Locations: Use semicolons (;) to separate multiple locations, pipe (|) for address|lat|lng|primary
                {'\n'}• Money Flow: Use semicolons (;) to separate entries, pipe (|) for name|relationship
                {'\n\n'}
                <Text style={styles.boldText}>Basic Example:</Text>
                {'\n'}userId,email,businessName,category,description,website
                {'\n'}biz001,shop@example.com,Joe's Coffee,Restaurant,Best coffee in town,https://joescoffee.com
                {'\n\n'}
                <Text style={styles.boldText}>Full Example (wrapped for readability):</Text>
                {'\n'}Include all fields you want to populate. For money flow and locations, use the delimiters specified above.
                {'\n'}Example locations: "123 Main St|40.7128|-74.0060|primary;456 2nd Ave|40.6782|-73.9442|"
                {'\n'}Example affiliates: "Chef Gordon|Owner;Jamie Oliver|Consultant"
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
                <TouchableOpacity style={styles.saveButton} onPress={() => Alert.alert('Info', 'Bulk creation for businesses requires additional setup. Please use individual creation for now.')}>
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
  helpText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  uploadButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchInput: {
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
  businessCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  businessEmail: {
    fontSize: 12,
    color: '#888',
  },
  businessActions: {
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
  previewText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  businessDetails: {
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
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
  referralStatsBox: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  referralStatsText: {
    fontSize: 14,
    color: '#1565c0',
    fontWeight: '600',
  },
  referralTag: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
  },
  referralCountTag: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
  },
});
