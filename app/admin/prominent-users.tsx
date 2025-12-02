import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  User,
  MapPin,
  Globe,
  Twitter,
  Instagram,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Link2,
  Database,
} from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import VerificationBadge from '@/components/VerificationBadge';
import {
  getAllCelebrityAccounts,
  createCelebrityAccount,
  CelebrityAccountData,
  importCelebrityBatch,
  generateClaimToken,
  migrateCelebrityListsToUserLists,
  normalizeCelebrityAccounts,
  deleteAllCelebrityAccounts,
} from '@/services/firebase/celebrityService';
import * as Clipboard from 'expo-clipboard';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { UserProfile } from '@/types';
import { pickAndUploadImage } from '@/lib/imageUpload';
import { Camera } from 'lucide-react-native';

interface CelebrityUser {
  userId: string;
  name: string;
  email: string;
  endorsementCount: number;
  location?: string;
  description?: string;
  website?: string;
  twitter?: string;
  instagram?: string;
  profileImage?: string;
  coverImage?: string;
}

export default function ProminentUsersAdmin() {
  const router = useRouter();
  const { isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;
  const contentMaxWidth = isLargeScreen ? windowWidth * 0.7 : undefined;

  const [celebrities, setCelebrities] = useState<CelebrityUser[]>([]);
  const [filteredCelebrities, setFilteredCelebrities] = useState<CelebrityUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CelebrityUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    website: '',
    twitter: '',
    instagram: '',
    endorsements: '',
    profileImage: '',
    coverImage: '',
  });
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);

  // Import state
  const [importData, setImportData] = useState('');
  const [importBatchId, setImportBatchId] = useState('');

  // Load celebrity accounts
  const loadCelebrities = useCallback(async () => {
    setIsLoading(true);
    try {
      const celebs = await getAllCelebrityAccounts();

      // Fetch additional details for each celebrity
      const detailedCelebs: CelebrityUser[] = await Promise.all(
        celebs.map(async (celeb) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', celeb.userId));
            const userData = userDoc.data() as UserProfile | undefined;
            return {
              ...celeb,
              location: userData?.userDetails?.location,
              description: userData?.userDetails?.description,
              website: userData?.userDetails?.website,
              twitter: userData?.userDetails?.socialMedia?.twitter,
              instagram: userData?.userDetails?.socialMedia?.instagram,
              profileImage: (userData?.userDetails as any)?.profileImage,
              coverImage: (userData?.userDetails as any)?.coverImage,
            };
          } catch {
            return celeb;
          }
        })
      );

      setCelebrities(detailedCelebs);
      setFilteredCelebrities(detailedCelebs);
    } catch (error) {
      console.error('[ProminentUsers] Error loading celebrities:', error);
      Alert.alert('Error', 'Failed to load prominent users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCelebrities();
  }, [loadCelebrities]);

  // Filter celebrities based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCelebrities(celebrities);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCelebrities(
        celebrities.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.email.toLowerCase().includes(query) ||
            c.location?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, celebrities]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      description: '',
      website: '',
      twitter: '',
      instagram: '',
      endorsements: '',
      profileImage: '',
      coverImage: '',
    });
  };

  // Handle upload profile image
  const handleUploadProfileImage = async () => {
    if (!selectedUser && !formData.name) {
      Alert.alert('Error', 'Please enter a name first');
      return;
    }

    setUploadingProfileImage(true);
    try {
      const userId = selectedUser?.userId || `admin_temp_${Date.now()}`;
      const downloadURL = await pickAndUploadImage(userId, 'profile');

      if (downloadURL) {
        setFormData({ ...formData, profileImage: downloadURL });
      }
    } catch (error) {
      console.error('[ProminentUsers] Error uploading profile image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploadingProfileImage(false);
    }
  };

  // Handle upload cover image
  const handleUploadCoverImage = async () => {
    if (!selectedUser && !formData.name) {
      Alert.alert('Error', 'Please enter a name first');
      return;
    }

    setUploadingCoverImage(true);
    try {
      const userId = selectedUser?.userId || `admin_temp_${Date.now()}`;
      const downloadURL = await pickAndUploadImage(userId, 'cover', [16, 9]);

      if (downloadURL) {
        setFormData({ ...formData, coverImage: downloadURL });
      }
    } catch (error) {
      console.error('[ProminentUsers] Error uploading cover image:', error);
      Alert.alert('Error', 'Failed to upload cover image');
    } finally {
      setUploadingCoverImage(false);
    }
  };

  // Handle add new user
  const handleAddUser = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const endorsementsList = formData.endorsements
        .split('\n')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      const result = await createCelebrityAccount({
        name: formData.name.trim(),
        location: formData.location.trim() || undefined,
        description: formData.description.trim() || undefined,
        website: formData.website.trim() || undefined,
        twitter: formData.twitter.trim() || undefined,
        instagram: formData.instagram.trim() || undefined,
        endorsements: endorsementsList,
        profileImageUrl: formData.profileImage || undefined,
      });

      // If we have a cover image, save it separately to the user document
      if (result.success && formData.coverImage) {
        try {
          const userRef = doc(db, 'users', result.userId);
          await updateDoc(userRef, {
            'userDetails.coverImage': formData.coverImage,
          });
        } catch (e) {
          console.warn('[ProminentUsers] Could not save cover image:', e);
        }
      }

      if (result.success) {
        Alert.alert('Success', `Created account for ${formData.name}`);
        setShowAddModal(false);
        resetForm();
        loadCelebrities();
      } else {
        Alert.alert('Error', result.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('[ProminentUsers] Error adding user:', error);
      Alert.alert('Error', 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', selectedUser.userId);
      const updateData: Record<string, any> = {
        'userDetails.name': formData.name.trim(),
        'userDetails.location': formData.location.trim() || null,
        'userDetails.description': formData.description.trim() || null,
        'userDetails.website': formData.website.trim() || null,
        'userDetails.socialMedia.twitter': formData.twitter.trim() || null,
        'userDetails.socialMedia.instagram': formData.instagram.trim() || null,
        fullName: formData.name.trim(),
      };

      // Add images if provided
      if (formData.profileImage) {
        updateData['userDetails.profileImage'] = formData.profileImage;
      }
      if (formData.coverImage) {
        updateData['userDetails.coverImage'] = formData.coverImage;
      }

      await updateDoc(userRef, updateData);

      Alert.alert('Success', `Updated ${formData.name}'s profile`);
      setShowEditModal(false);
      setSelectedUser(null);
      resetForm();
      loadCelebrities();
    } catch (error) {
      console.error('[ProminentUsers] Error updating user:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = (user: CelebrityUser) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.name}? This will remove their profile and endorsement list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete user document
              await deleteDoc(doc(db, 'users', user.userId));
              // Delete endorsement list (now in userLists)
              await deleteDoc(doc(db, 'userLists', `${user.userId}_endorsement`));

              Alert.alert('Success', `Deleted ${user.name}`);
              loadCelebrities();
            } catch (error) {
              console.error('[ProminentUsers] Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  // Handle generate claim link
  const handleGenerateClaimLink = async (user: CelebrityUser) => {
    try {
      const result = await generateClaimToken(user.userId);

      if (result.success && result.token) {
        // Build the claim URL
        const claimUrl = `https://iendorse.app/claim/${result.token}`;

        // Copy to clipboard
        await Clipboard.setStringAsync(claimUrl);

        Alert.alert(
          'Claim Link Generated',
          `A claim link for ${user.name} has been copied to your clipboard.\n\nShare this link with the person to allow them to claim this account.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to generate claim link');
      }
    } catch (error) {
      console.error('[ProminentUsers] Error generating claim link:', error);
      Alert.alert('Error', 'Failed to generate claim link');
    }
  };

  // Handle run migration
  const handleRunMigration = async () => {
    Alert.alert(
      'Run Migration',
      'This will migrate all celebrity lists from the old collection to the unified userLists collection. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          onPress: async () => {
            try {
              const result = await migrateCelebrityListsToUserLists();
              if (result.success) {
                Alert.alert(
                  'Migration Complete',
                  `Migrated: ${result.migrated}\nAlready existed: ${result.alreadyMigrated}`
                );
              } else {
                Alert.alert('Migration Failed', result.errors.join('\n'));
              }
            } catch (error) {
              console.error('[ProminentUsers] Migration error:', error);
              Alert.alert('Error', 'Migration failed');
            }
          },
        },
      ]
    );
  };

  // Handle normalize accounts (fix missing fields)
  const handleNormalize = async () => {
    Alert.alert(
      'Normalize Accounts',
      'This will ensure all prominent user accounts have the correct fields (isPublicProfile, accountType) so they appear in user listings and search. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Normalize',
          onPress: async () => {
            try {
              const result = await normalizeCelebrityAccounts();
              if (result.success) {
                Alert.alert(
                  'Normalization Complete',
                  `Total: ${result.total}\nUpdated: ${result.updated}\nAlready normalized: ${result.alreadyNormalized}`
                );
                loadCelebrities(); // Refresh the list
              } else {
                Alert.alert('Normalization Failed', result.errors.join('\n'));
              }
            } catch (error) {
              console.error('[ProminentUsers] Normalize error:', error);
              Alert.alert('Error', 'Normalization failed');
            }
          },
        },
      ]
    );
  };

  // Handle delete all celebrity accounts
  const handleDeleteAll = async () => {
    Alert.alert(
      'Delete All Prominent Users',
      'This will DELETE all prominent user accounts and their endorsement lists. This cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAllCelebrityAccounts();
              if (result.success) {
                Alert.alert(
                  'Deletion Complete',
                  `Deleted ${result.deletedUsers} users and ${result.deletedLists} lists`
                );
                loadCelebrities(); // Refresh the list
              } else {
                Alert.alert('Deletion Failed', result.errors.join('\n'));
              }
            } catch (error) {
              console.error('[ProminentUsers] Delete all error:', error);
              Alert.alert('Error', 'Deletion failed');
            }
          },
        },
      ]
    );
  };

  // Open edit modal with user data
  const openEditModal = (user: CelebrityUser) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      location: user.location || '',
      description: user.description || '',
      website: user.website || '',
      twitter: user.twitter || '',
      instagram: user.instagram || '',
      endorsements: '',
      profileImage: user.profileImage || '',
      coverImage: user.coverImage || '',
    });
    setShowEditModal(true);
  };

  // Handle batch import
  const handleImport = async () => {
    if (!importBatchId.trim()) {
      Alert.alert('Error', 'Please enter a batch ID');
      return;
    }

    if (!importData.trim()) {
      Alert.alert('Error', 'Please enter import data');
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse the import data (expecting JSON array or tab-separated)
      let celebrities: CelebrityAccountData[] = [];

      // Try JSON first
      try {
        celebrities = JSON.parse(importData);
      } catch {
        // Try tab-separated format
        const lines = importData.trim().split('\n');
        celebrities = lines.slice(1).map((line) => {
          const parts = line.split('\t');
          const endorsements = parts.slice(6).filter((e) => e.trim());
          return {
            name: parts[0]?.trim() || '',
            location: parts[1]?.trim() || undefined,
            description: parts[2]?.trim() || undefined,
            website: parts[3]?.trim() || undefined,
            twitter: parts[4]?.trim()?.replace('@', '') || undefined,
            instagram: parts[5]?.trim()?.replace('@', '') || undefined,
            endorsements,
          };
        }).filter((c) => c.name);
      }

      if (celebrities.length === 0) {
        Alert.alert('Error', 'No valid data found in import');
        return;
      }

      const result = await importCelebrityBatch(importBatchId.trim(), celebrities);

      if (result.success) {
        if (result.alreadyImported) {
          Alert.alert('Info', `Batch "${importBatchId}" was already imported`);
        } else {
          Alert.alert(
            'Success',
            `Imported ${result.results?.successful} users (${result.results?.failed} failed)`
          );
        }
        setShowImportModal(false);
        setImportData('');
        setImportBatchId('');
        loadCelebrities();
      } else {
        Alert.alert('Error', result.error || 'Import failed');
      }
    } catch (error) {
      console.error('[ProminentUsers] Import error:', error);
      Alert.alert('Error', 'Failed to parse import data. Use JSON array or tab-separated format.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render user card
  const renderUserCard = (user: CelebrityUser) => (
    <View
      key={user.userId}
      style={[styles.userCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
    >
      <View style={styles.userCardHeader}>
        <View style={styles.userAvatar}>
          {user.profileImage ? (
            <Image
              source={{ uri: user.profileImage }}
              style={styles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <User size={24} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
            <VerificationBadge type="celebrity" isDarkMode={isDarkMode} size="small" />
          </View>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
          {user.location && (
            <View style={styles.locationRow}>
              <MapPin size={12} color={colors.textSecondary} />
              <Text style={[styles.locationText, { color: colors.textSecondary }]}>{user.location}</Text>
            </View>
          )}
        </View>
        <View style={styles.endorsementBadge}>
          <Text style={[styles.endorsementCount, { color: colors.primary }]}>{user.endorsementCount}</Text>
          <Text style={[styles.endorsementLabel, { color: colors.textSecondary }]}>endorsements</Text>
        </View>
      </View>

      {user.description && (
        <Text style={[styles.userDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {user.description}
        </Text>
      )}

      <View style={styles.socialLinks}>
        {user.website && (
          <View style={styles.socialItem}>
            <Globe size={14} color={colors.primary} />
            <Text style={[styles.socialText, { color: colors.primary }]} numberOfLines={1}>
              {user.website}
            </Text>
          </View>
        )}
        {user.twitter && (
          <View style={styles.socialItem}>
            <Twitter size={14} color={colors.primary} />
            <Text style={[styles.socialText, { color: colors.primary }]}>@{user.twitter}</Text>
          </View>
        )}
        {user.instagram && (
          <View style={styles.socialItem}>
            <Instagram size={14} color={colors.primary} />
            <Text style={[styles.socialText, { color: colors.primary }]}>@{user.instagram}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push(`/user/${user.userId}`)}
          activeOpacity={0.7}
        >
          <User size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => openEditModal(user)}
          activeOpacity={0.7}
        >
          <Edit size={16} color={colors.text} />
          <Text style={[styles.actionButtonText, { color: colors.text }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#DBEAFE' }]}
          onPress={() => handleGenerateClaimLink(user)}
          activeOpacity={0.7}
        >
          <Link2 size={16} color="#3B82F6" />
          <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>Claim Link</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
          onPress={() => handleDeleteUser(user)}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Form modal content
  const renderFormModal = (isEdit: boolean) => (
    <Modal
      visible={isEdit ? showEditModal : showAddModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        isEdit ? setShowEditModal(false) : setShowAddModal(false);
        resetForm();
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: isLargeScreen ? 500 : '90%' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {isEdit ? 'Edit Profile' : 'Add Prominent User'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                isEdit ? setShowEditModal(false) : setShowAddModal(false);
                resetForm();
              }}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Image Upload Section */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Profile & Cover Images</Text>
              <View style={styles.imageUploadRow}>
                {/* Profile Image */}
                <View style={styles.imageUploadItem}>
                  {formData.profileImage ? (
                    <Image
                      source={{ uri: formData.profileImage }}
                      style={styles.previewImageSquare}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.imagePlaceholderSquare, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                      <User size={32} color={colors.textSecondary} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.imageUploadButton, { backgroundColor: colors.primary }]}
                    onPress={handleUploadProfileImage}
                    disabled={uploadingProfileImage}
                  >
                    {uploadingProfileImage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Camera size={14} color="#FFFFFF" />
                        <Text style={styles.imageUploadButtonText}>
                          {formData.profileImage ? 'Change' : 'Profile'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Cover Image */}
                <View style={[styles.imageUploadItem, { flex: 2 }]}>
                  {formData.coverImage ? (
                    <Image
                      source={{ uri: formData.coverImage }}
                      style={styles.previewImageWide}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.imagePlaceholderWide, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>Cover Image</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.imageUploadButton, { backgroundColor: colors.primary }]}
                    onPress={handleUploadCoverImage}
                    disabled={uploadingCoverImage}
                  >
                    {uploadingCoverImage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Camera size={14} color="#FFFFFF" />
                        <Text style={styles.imageUploadButtonText}>
                          {formData.coverImage ? 'Change' : 'Cover'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Name *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Full name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Location</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder="City, State"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Short bio (max 15 words)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Website</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={formData.website}
                onChangeText={(text) => setFormData({ ...formData, website: text })}
                placeholder="example.com"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Twitter/X</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  value={formData.twitter}
                  onChangeText={(text) => setFormData({ ...formData, twitter: text })}
                  placeholder="username"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Instagram</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  value={formData.instagram}
                  onChangeText={(text) => setFormData({ ...formData, instagram: text })}
                  placeholder="username"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {!isEdit && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Endorsements</Text>
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                  Enter business names, one per line
                </Text>
                <TextInput
                  style={[styles.formInput, styles.textAreaLarge, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  value={formData.endorsements}
                  onChangeText={(text) => setFormData({ ...formData, endorsements: text })}
                  placeholder="Nike&#10;Apple&#10;Starbucks"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={6}
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => {
                isEdit ? setShowEditModal(false) : setShowAddModal(false);
                resetForm();
              }}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={isEdit ? handleEditUser : handleAddUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" />
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                    {isEdit ? 'Save Changes' : 'Create User'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Import modal
  const renderImportModal = () => (
    <Modal
      visible={showImportModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setShowImportModal(false);
        setImportData('');
        setImportBatchId('');
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: isLargeScreen ? 600 : '90%' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Batch Import</Text>
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Batch ID *</Text>
              <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                Unique identifier to prevent duplicate imports (e.g., "batch2_2024")
              </Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={importBatchId}
                onChangeText={setImportBatchId}
                placeholder="batch2_2024"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Import Data *</Text>
              <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                Paste JSON array or tab-separated data (with header row: Name, Location, Description, Website, Twitter, Instagram, Endorsement1, Endorsement2, ...)
              </Text>
              <TextInput
                style={[styles.formInput, styles.textAreaXL, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={importData}
                onChangeText={setImportData}
                placeholder='[{"name": "Celebrity Name", "location": "City, ST", "endorsements": ["Brand1", "Brand2"]}]'
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={10}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => {
                setShowImportModal(false);
                setImportData('');
                setImportBatchId('');
              }}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleImport}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Upload size={18} color="#FFFFFF" />
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Import</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={28} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Prominent Users</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadCelebrities} activeOpacity={0.7}>
          <RefreshCw size={22} color={colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, email, or location..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.7}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.headerButtonText}>Add User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => setShowImportModal(true)}
            activeOpacity={0.7}
          >
            <Upload size={18} color={colors.text} />
            <Text style={[styles.headerButtonText, { color: colors.text }]}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1 }]}
            onPress={handleRunMigration}
            activeOpacity={0.7}
          >
            <Database size={18} color="#D97706" />
            <Text style={[styles.headerButtonText, { color: '#D97706' }]}>Migrate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: '#DCFCE7', borderColor: '#22C55E', borderWidth: 1 }]}
            onPress={handleNormalize}
            activeOpacity={0.7}
          >
            <Check size={18} color="#16A34A" />
            <Text style={[styles.headerButtonText, { color: '#16A34A' }]}>Normalize</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1 }]}
            onPress={handleDeleteAll}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color="#DC2626" />
            <Text style={[styles.headerButtonText, { color: '#DC2626' }]}>Delete All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.background }]}>
        <Text style={[styles.statsText, { color: colors.textSecondary }]}>
          {filteredCelebrities.length} prominent users
          {searchQuery && ` (filtered from ${celebrities.length})`}
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading prominent users...</Text>
        </View>
      ) : filteredCelebrities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <AlertCircle size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchQuery ? 'No matching users found' : 'No prominent users yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {searchQuery
              ? 'Try a different search term'
              : 'Add your first prominent user or import a batch'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            isLargeScreen && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
          ]}
        >
          {filteredCelebrities.map(renderUserCard)}
        </ScrollView>
      )}

      {/* Modals */}
      {renderFormModal(false)}
      {renderFormModal(true)}
      {renderImportModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 4,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  searchContainer: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsText: {
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
  },
  endorsementBadge: {
    alignItems: 'center',
  },
  endorsementCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  endorsementLabel: {
    fontSize: 10,
  },
  userDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  socialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialText: {
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  formHint: {
    fontSize: 12,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  textAreaXL: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
  // Image upload styles
  imageUploadRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageUploadItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewImageSquare: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  previewImageWide: {
    width: '100%',
    height: 80,
    borderRadius: 8,
  },
  imagePlaceholderSquare: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderWide: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    marginTop: 8,
  },
  imageUploadButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
