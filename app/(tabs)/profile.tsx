import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Image,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import MenuButton from '@/components/MenuButton';
import EndorsedBadge from '@/components/EndorsedBadge';
import { UnifiedLibrary } from '@/components/Library';
import FollowingFollowersList from '@/components/FollowingFollowersList';
import { useLibrary } from '@/contexts/LibraryContext';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Globe, MapPin, Facebook, Instagram, Twitter, Linkedin, ExternalLink, Camera, Eye, EyeOff, ChevronDown, ChevronRight, MoreVertical, Plus, Edit, Trash2, Lock, X } from 'lucide-react-native';
import { pickAndUploadImage } from '@/lib/imageUpload';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { getLogoUrl } from '@/lib/logo';
import BusinessProfileEditor from '@/components/BusinessProfileEditor';

import { getAllUserBusinesses, BusinessUser } from '@/services/firebase/businessService';
import { getFollowersCount, getFollowingCount } from '@/services/firebase/followService';
import { getUserReferralCode, getReferralCount, getReferralLink } from '@/services/firebase/referralService';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { Gift, Copy, Share2 as ShareIcon } from 'lucide-react-native';

export default function ProfileScreen() {
  const { profile, isDarkMode, clerkUser, setUserDetails } = useUser();
  const { brands, valuesMatrix } = useData();
  const colors = isDarkMode ? darkColors : lightColors;
  const router = useRouter();

  // Fetch user businesses for scoring
  const [userBusinesses, setUserBusinesses] = useState<BusinessUser[]>([]);

  const userDetails = profile.userDetails || {
    name: '',
    description: '',
    website: '',
    location: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
    },
    profileImage: '',
  };

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userDetails.name || '');
  const [description, setDescription] = useState(userDetails.description || '');
  const [website, setWebsite] = useState(userDetails.website || '');
  const [location, setLocation] = useState(userDetails.location || '');
  const [latitude, setLatitude] = useState<number | undefined>(userDetails.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(userDetails.longitude);
  const [facebook, setFacebook] = useState(userDetails.socialMedia?.facebook || '');
  const [instagram, setInstagram] = useState(userDetails.socialMedia?.instagram || '');
  const [twitter, setTwitter] = useState(userDetails.socialMedia?.twitter || '');
  const [linkedin, setLinkedin] = useState(userDetails.socialMedia?.linkedin || '');
  const [profileImage, setProfileImage] = useState(userDetails.profileImage || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isPublicProfile, setIsPublicProfile] = useState(profile.isPublicProfile !== false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalMode, setFollowModalMode] = useState<'followers' | 'following'>('followers');
  const [selectedStatSection, setSelectedStatSection] = useState<'endorsements' | 'followers' | 'following'>('endorsements');
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Library context
  const library = useLibrary();

  const handleLocationSelect = (locationName: string, lat: number, lon: number) => {
    setLocation(locationName);
    setLatitude(lat);
    setLongitude(lon);
  };

  const handleUploadImage = async () => {
    if (!clerkUser?.id) {
      Alert.alert('Error', 'User not logged in. Please log in and try again.');
      return;
    }

    setUploadingImage(true);
    try {
      const downloadURL = await pickAndUploadImage(clerkUser.id, 'profile');

      if (downloadURL) {
        setProfileImage(downloadURL);
        Alert.alert('Success', 'Profile image uploaded! Remember to click "Save Changes" to save it to your profile.');
      } else {
        Alert.alert('Cancelled', 'Image upload was cancelled.');
      }
    } catch (error) {
      console.error('[ProfileScreen] Error uploading profile image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!clerkUser?.id) {
      Alert.alert('Error', 'User not logged in. Please log in and try again.');
      return;
    }

    const updateInfo: any = {
      name: name.trim(),
      description: description.trim(),
      website: website.trim(),
      socialMedia: {
        facebook: facebook.trim(),
        instagram: instagram.trim(),
        twitter: twitter.trim(),
        linkedin: linkedin.trim(),
      },
    };

    if (location.trim()) {
      updateInfo.location = location.trim();
    }
    if (latitude !== undefined) {
      updateInfo.latitude = latitude;
    }
    if (longitude !== undefined) {
      updateInfo.longitude = longitude;
    }
    if (profileImage) {
      updateInfo.profileImage = profileImage;
    }

    await setUserDetails(updateInfo);

    // Update profile privacy setting
    try {
      const userRef = doc(db, 'users', clerkUser.id);
      await updateDoc(userRef, {
        isPublicProfile,
      });
    } catch (error) {
      console.error('[ProfileScreen] Error updating profile privacy:', error);
    }

    setEditing(false);
    Alert.alert('Success', 'Profile updated successfully');
  };

  const handleCancel = () => {
    setName(userDetails.name || '');
    setDescription(userDetails.description || '');
    setWebsite(userDetails.website || '');
    setLocation(userDetails.location || '');
    setLatitude(userDetails.latitude);
    setLongitude(userDetails.longitude);
    setFacebook(userDetails.socialMedia?.facebook || '');
    setInstagram(userDetails.socialMedia?.instagram || '');
    setTwitter(userDetails.socialMedia?.twitter || '');
    setLinkedin(userDetails.socialMedia?.linkedin || '');
    setProfileImage(userDetails.profileImage || '');
    setIsPublicProfile(profile.isPublicProfile !== false);
    setEditing(false);
  };

  const handleListPress = (listId: string) => {
    router.push(`/list/${listId}`);
  };

  const userName = userDetails.name || clerkUser?.firstName || 'User';
  const profileImageUrl = profileImage || userDetails.profileImage || clerkUser?.imageUrl;

  // Handle copying referral link
  const handleCopyReferralLink = async () => {
    const link = getReferralLink(referralCode);
    await Clipboard.setStringAsync(link);
    Alert.alert('Copied!', 'Your invite link has been copied to clipboard.');
  };

  // Handle sharing referral link
  const handleShareReferral = async () => {
    const link = getReferralLink(referralCode);
    const message = `Join me on iEndorse! Use my invite link to sign up: ${link}`;

    try {
      await Share.share({
        message,
        url: link,
        title: 'Join iEndorse',
      });
    } catch (error) {
      console.error('[ProfileScreen] Error sharing:', error);
    }
  };

  // Fetch user businesses
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const businesses = await getAllUserBusinesses();
        setUserBusinesses(businesses);
      } catch (error) {
        console.error('[ProfileScreen] Error fetching businesses:', error);
      }
    };
    fetchBusinesses();
  }, []);

  // Load followers and following counts
  useEffect(() => {
    const loadFollowCounts = async () => {
      if (!clerkUser?.id) return;

      try {
        const followers = await getFollowersCount(clerkUser.id, 'user');
        const following = await getFollowingCount(clerkUser.id);
        setFollowersCount(followers);
        setFollowingCount(following);
      } catch (error) {
        console.error('[ProfileScreen] Error loading follow counts:', error);
      }
    };
    loadFollowCounts();
  }, [clerkUser?.id]);

  // Load referral data
  useEffect(() => {
    const loadReferralData = async () => {
      if (!clerkUser?.id) return;

      try {
        const code = await getUserReferralCode(clerkUser.id);
        const count = await getReferralCount(clerkUser.id);
        setReferralCode(code);
        setReferralCount(count);
      } catch (error) {
        console.error('[ProfileScreen] Error loading referral data:', error);
      }
    };
    loadReferralData();
  }, [clerkUser?.id]);

  // Calculate aligned and unaligned brands based on user's values
  const { allSupportFull, allAvoidFull, scoredBrands } = useMemo(() => {
    const csvBrands = brands || [];
    const localBizList = userBusinesses || [];

    const currentBrands = [...csvBrands, ...localBizList];

    if (!currentBrands || currentBrands.length === 0 || !profile.causes || profile.causes.length === 0) {
      return {
        allSupportFull: [],
        allAvoidFull: [],
        scoredBrands: new Map(),
      };
    }

    // Import scoring functions
    const { calculateBrandScore, calculateSimilarityScore, normalizeBrandScores } = require('@/lib/scoring');

    // Calculate scores for all entities (brands AND businesses)
    // Use the appropriate scoring function based on entity type
    const brandsWithScores = currentBrands.map(entity => {
      let score;

      // Check if this is a business (has businessInfo field)
      if ('businessInfo' in entity) {
        // For businesses, use similarity scoring based on shared causes
        score = calculateSimilarityScore(profile.causes || [], entity.causes || []);
      } else {
        // For brands, use brand scoring based on values matrix
        score = calculateBrandScore(entity.name, profile.causes || [], valuesMatrix);
      }

      return { brand: entity, score };
    });

    // Normalize scores to 1-99 range
    const normalizedBrands = normalizeBrandScores(brandsWithScores);

    // Create scored brands map
    const scoredMap = new Map(normalizedBrands.map(({ brand, score }) => [brand.id, score]));

    // Sort all entities by score
    const sortedByScore = [...normalizedBrands].sort((a, b) => b.score - a.score);

    // Top 50 highest-scoring entities (aligned)
    const alignedBrands = sortedByScore
      .slice(0, 50)
      .map(({ brand }) => brand);

    // Bottom 50 lowest-scoring entities (unaligned)
    const unalignedBrands = sortedByScore
      .slice(-50)
      .reverse()
      .map(({ brand }) => brand);

    return {
      allSupportFull: alignedBrands,
      allAvoidFull: unalignedBrands,
      scoredBrands: scoredMap,
    };
  }, [brands, userBusinesses, profile.causes, valuesMatrix]);

  // If this is a business account, show the business profile editor instead
  if (profile.accountType === 'business') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={[styles.stickyHeaderContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <View style={[styles.header, { backgroundColor: colors.background }]}>
            <Image
              source={require('@/assets/images/endorsing.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <MenuButton />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={Platform.OS === 'web' ? [styles.content, styles.webContent] : styles.content}
          showsVerticalScrollIndicator={false}
        >
          <BusinessProfileEditor />
        </ScrollView>
      </View>
    );
  }

  // Regular user profile
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={[styles.stickyHeaderContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <MenuButton />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={Platform.OS === 'web' ? [styles.content, styles.webContent] : styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - Matches Brand/Business Details Structure */}
        <View style={[styles.profileHeaderSection, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.profileHeader}>
            {/* Profile Image */}
            <View style={styles.profileImageContainer}>
              {profileImageUrl ? (
                <ExpoImage source={{ uri: profileImageUrl }} style={styles.profileImage} contentFit="cover" />
              ) : (
                <View style={[styles.profileIconContainer, { backgroundColor: colors.primary }]}>
                  <User size={40} color={colors.white} strokeWidth={1.5} />
                </View>
              )}
              {editing && (
                <TouchableOpacity
                  style={[styles.uploadImageButton, { backgroundColor: colors.primary }]}
                  onPress={handleUploadImage}
                  disabled={uploadingImage}
                  activeOpacity={0.7}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Camera size={20} color={colors.white} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Title Container */}
            <View style={styles.titleContainer}>
              <View style={styles.nameRow}>
                <Text style={[styles.profileName, { color: colors.text }]}>{userName}</Text>
                {!editing && (
                  <TouchableOpacity
                    onPress={() => setEditing(true)}
                    activeOpacity={0.7}
                    style={[styles.editIconButton, { backgroundColor: colors.background }]}
                  >
                    <Edit size={16} color={colors.primary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
              {userDetails.location && (
                <View style={styles.locationRow}>
                  <MapPin size={14} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                    {userDetails.location}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Description */}
          {!editing && userDetails.description && (
            <Text style={[styles.profileDescription, { color: colors.textSecondary }]}>
              {userDetails.description}
            </Text>
          )}

          {/* Social Links */}
          {!editing && (userDetails.socialMedia?.twitter || userDetails.socialMedia?.instagram || userDetails.socialMedia?.facebook || userDetails.socialMedia?.linkedin || userDetails.website) && (
            <View style={styles.socialLinksContainer}>
              {userDetails.website && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => Linking.openURL(userDetails.website.startsWith('http') ? userDetails.website : `https://${userDetails.website}`)}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={14} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>Website</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.twitter && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => Linking.openURL(`https://x.com/${userDetails.socialMedia.twitter}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>𝕏</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.instagram && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => Linking.openURL(`https://instagram.com/${userDetails.socialMedia.instagram.replace('@', '')}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>Instagram</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.facebook && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => Linking.openURL(userDetails.socialMedia.facebook.startsWith('http') ? userDetails.socialMedia.facebook : `https://${userDetails.socialMedia.facebook}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>Facebook</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.linkedin && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => Linking.openURL(userDetails.socialMedia.linkedin.startsWith('http') ? userDetails.socialMedia.linkedin : `https://${userDetails.socialMedia.linkedin}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>LinkedIn</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Endorsements/Following/Followers/Referrals Counters */}
          {!editing && (
            <View style={styles.followStatsContainer}>
              <TouchableOpacity
                style={styles.followStatButton}
                onPress={() => {
                  setSelectedStatSection('endorsements');
                  setFollowModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.followStatCount, { color: selectedStatSection === 'endorsements' ? colors.primary : colors.text }]}>{library.state.endorsementList?.entries?.length || 0}</Text>
                <Text style={[styles.followStatLabel, { color: selectedStatSection === 'endorsements' ? colors.primary : colors.textSecondary }]}>Endorsed</Text>
              </TouchableOpacity>
              <View style={[styles.followStatDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.followStatButton}
                onPress={() => {
                  setSelectedStatSection('following');
                  setFollowModalMode('following');
                  setFollowModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.followStatCount, { color: selectedStatSection === 'following' ? colors.primary : colors.text }]}>{followingCount}</Text>
                <Text style={[styles.followStatLabel, { color: selectedStatSection === 'following' ? colors.primary : colors.textSecondary }]}>Following</Text>
              </TouchableOpacity>
              <View style={[styles.followStatDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.followStatButton}
                onPress={() => {
                  setSelectedStatSection('followers');
                  setFollowModalMode('followers');
                  setFollowModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.followStatCount, { color: selectedStatSection === 'followers' ? colors.primary : colors.text }]}>{followersCount}</Text>
                <Text style={[styles.followStatLabel, { color: selectedStatSection === 'followers' ? colors.primary : colors.textSecondary }]}>Followers</Text>
              </TouchableOpacity>
              <View style={[styles.followStatDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.followStatButton}
                onPress={() => setShowInviteModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.followStatCount, { color: colors.text }]}>{referralCount}</Text>
                <Text style={[styles.followStatLabel, { color: colors.textSecondary }]}>Referrals</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Edit Form */}
          {editing && (
            <View style={styles.editForm}>
              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Your name"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              {/* Bio */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Tell people about yourself..."
                  placeholderTextColor={colors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Location */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Location</Text>
                <LocationAutocomplete
                  value={location}
                  onLocationSelect={handleLocationSelect}
                  isDarkMode={isDarkMode}
                />
              </View>

              {/* Website */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Website</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="https://your-website.com"
                  placeholderTextColor={colors.textSecondary}
                  value={website}
                  onChangeText={setWebsite}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              {/* Social Media */}
              <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Social Media</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Twitter/X</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="@username"
                  placeholderTextColor={colors.textSecondary}
                  value={twitter}
                  onChangeText={setTwitter}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Instagram</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="@username"
                  placeholderTextColor={colors.textSecondary}
                  value={instagram}
                  onChangeText={setInstagram}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Facebook</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="facebook.com/username"
                  placeholderTextColor={colors.textSecondary}
                  value={facebook}
                  onChangeText={setFacebook}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>LinkedIn</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="linkedin.com/in/username"
                  placeholderTextColor={colors.textSecondary}
                  value={linkedin}
                  onChangeText={setLinkedin}
                  autoCapitalize="none"
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionButtonText, { color: colors.white }]}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Library with integrated sections */}
        <View style={styles.contentSection}>
          {library.state.isLoading ? (
            <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your lists...</Text>
            </View>
          ) : (
            <UnifiedLibrary
              mode="preview"
              currentUserId={clerkUser?.id}
              viewingUserId={clerkUser?.id}
              alignedItems={allSupportFull}
              unalignedItems={allAvoidFull}
              isDarkMode={isDarkMode}
              profileImage={profileImageUrl}
              userBusinesses={userBusinesses}
              scoredBrands={scoredBrands}
              userCauses={profile?.causes || []}
              followingCount={followingCount}
              followersCount={followersCount}
            />
          )}
        </View>
      </ScrollView>

      {/* Followers/Following Modal */}
      <Modal
        visible={followModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setFollowModalVisible(false);
          setSelectedStatSection('endorsements');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {followModalMode === 'followers' ? 'Followers' : 'Following'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setFollowModalVisible(false);
                  setSelectedStatSection('endorsements');
                }}
                style={[styles.modalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {clerkUser?.id && (
              <FollowingFollowersList
                mode={followModalMode}
                userId={clerkUser.id}
                isDarkMode={isDarkMode}
                userCauses={profile?.causes || []}
                onNavigate={() => {
                  setFollowModalVisible(false);
                  setSelectedStatSection('endorsements');
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Invite/Referral Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.inviteModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Invite Friends</Text>
              <TouchableOpacity
                onPress={() => setShowInviteModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inviteContent}>
              {/* Referral Stats */}
              <View style={[styles.referralStatsCard, { backgroundColor: colors.backgroundSecondary }]}>
                <Gift size={32} color={colors.primary} strokeWidth={1.5} />
                <Text style={[styles.referralStatsTitle, { color: colors.text }]}>
                  You've invited {referralCount} {referralCount === 1 ? 'friend' : 'friends'}
                </Text>
                <Text style={[styles.referralStatsSubtitle, { color: colors.textSecondary }]}>
                  Share your unique link to invite more people to join iEndorse
                </Text>
              </View>

              {/* Referral Code Display */}
              <View style={[styles.referralCodeContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.referralCodeLabel, { color: colors.textSecondary }]}>Your Invite Code</Text>
                <Text style={[styles.referralCode, { color: colors.primary }]}>{referralCode}</Text>
              </View>

              {/* Referral Link */}
              <View style={[styles.referralLinkContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.referralLinkLabel, { color: colors.textSecondary }]}>Your Invite Link</Text>
                <Text style={[styles.referralLink, { color: colors.text }]} numberOfLines={1}>
                  {getReferralLink(referralCode)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={[styles.inviteActionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={handleCopyReferralLink}
                  activeOpacity={0.7}
                >
                  <Copy size={20} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.inviteActionText, { color: colors.text }]}>Copy Link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteActionButton, styles.shareButton, { backgroundColor: colors.primary }]}
                  onPress={handleShareReferral}
                  activeOpacity={0.7}
                >
                  <ShareIcon size={20} color={colors.white} strokeWidth={2} />
                  <Text style={[styles.inviteActionText, { color: colors.white }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  webContent: {
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 8, // Extend content closer to edges on mobile browsers
  },
  stickyHeaderContainer: {
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.OS === 'web' ? 16 : 12,
    paddingTop: Platform.OS === 'web' ? 0 : 56,
    paddingBottom: 4,
  },
  headerLogo: {
    width: 161,
    height: 47,
    marginTop: 8,
    alignSelf: 'flex-start',
  },

  // Profile Header Section (Matches Brand/Business Details)
  profileHeaderSection: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  profileIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  uploadImageButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
  },
  editIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
  },
  privacyBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  profileDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  socialLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  socialButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Tab Selector
  tabSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
  },
  tabTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Edit Form
  editForm: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  privacySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  privacyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Content Section (Library/Following/Followers)
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  emptyPlaceholder: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  listImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
  },
  listImage: {
    width: '100%',
    height: '100%',
  },
  listIconPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listCount: {
    fontSize: 13,
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  publicBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  privateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Follow stats styles
  followStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  followStatButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  followStatCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  followStatLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  followStatDivider: {
    width: 1,
    height: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  // Invite modal styles
  inviteModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  inviteContent: {
    gap: 16,
    paddingBottom: 16,
  },
  referralStatsCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    gap: 8,
  },
  referralStatsTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  referralStatsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  referralCodeContainer: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  referralCodeLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  referralCode: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 3,
  },
  referralLinkContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  referralLinkLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  referralLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  inviteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareButton: {
    borderWidth: 0,
  },
  inviteActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
