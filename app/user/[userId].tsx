import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, List, Globe, Lock, MapPin, User, TrendingUp, TrendingDown, Minus, MoreVertical, ExternalLink, UserPlus, UserMinus, Share2, X } from 'lucide-react-native';
import { UnifiedLibrary } from '@/components/Library';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  PanResponder,
  Linking,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { UserProfile } from '@/types';
import { getUserLists, resolveList, copyListToLibrary, getEndorsementList } from '@/services/firebase/listService';
import { UserList } from '@/types/library';
import EndorsedBadge from '@/components/EndorsedBadge';
import { getAllUserBusinesses, BusinessUser } from '@/services/firebase/businessService';
import { calculateSimilarityScore, getSimilarityLabel } from '@/lib/scoring';
import { followEntity, unfollowEntity, isFollowing, getFollowersCount, getFollowingCount } from '@/services/firebase/followService';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { isDarkMode, clerkUser, profile: currentUserProfile } = useUser();
  const { brands, valuesMatrix } = useData();
  const library = useLibrary();
  const colors = isDarkMode ? darkColors : lightColors;
  const scrollViewRef = useRef<ScrollView>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyingListId, setCopyingListId] = useState<string | null>(null);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [activeListMenuId, setActiveListMenuId] = useState<string | null>(null);
  const [userBusinesses, setUserBusinesses] = useState<BusinessUser[]>([]);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [selectedLibrarySection, setSelectedLibrarySection] = useState<'endorsement' | 'aligned' | 'unaligned' | 'following' | 'followers' | 'local'>('endorsement');
  const [showImageModal, setShowImageModal] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 100) {
          router.back();
        }
      },
    })
  ).current;

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  const loadUserProfile = async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get user profile
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        setError('User not found');
        setIsLoading(false);
        return;
      }

      const profileData = userDoc.data() as UserProfile;

      // Check if profile is public
      if (!profileData.isPublicProfile && userId !== clerkUser?.id) {
        setError('This profile is private');
        setIsLoading(false);
        return;
      }

      setUserProfile(profileData);

      // Get user's public lists (or all lists if viewing own profile)
      const lists = await getUserLists(userId);
      const publicLists = userId === clerkUser?.id
        ? lists
        : lists.filter(list => list.isPublic);

      // Resolve all lists to fetch live data for referenced lists
      const resolvedLists = await Promise.all(
        publicLists.map(list => resolveList(list))
      );

      setUserLists(resolvedLists);

      // Load follow status and counts
      if (clerkUser?.id && userId !== clerkUser.id) {
        const following = await isFollowing(clerkUser.id, userId, 'user');
        setIsFollowingUser(following);
      }

      const followers = await getFollowersCount(userId, 'user');
      const following = await getFollowingCount(userId);
      setFollowersCount(followers);
      setFollowingCount(following);
    } catch (err) {
      console.error('Error loading user profile:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyList = async (listId: string) => {
    if (!clerkUser?.id) {
      Alert.alert('Error', 'You must be logged in to copy lists');
      return;
    }

    if (userId === clerkUser.id) {
      Alert.alert('Info', 'This is already in your library');
      return;
    }

    setCopyingListId(listId);

    try {
      const fullNameFromFirebase = currentUserProfile?.userDetails?.name;
      const fullNameFromClerk = clerkUser?.unsafeMetadata?.fullName as string;
      const firstNameLastName = clerkUser?.firstName && clerkUser?.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : '';
      const firstName = clerkUser?.firstName;
      const userName = fullNameFromFirebase || fullNameFromClerk || firstNameLastName || firstName || 'My Library';

      // Get the original creator's profile image
      const profileImageUrl = userProfile?.userDetails?.profileImage;

      await copyListToLibrary(listId, clerkUser.id, userName, profileImageUrl);

      // Reload library to show the newly copied list with all its entries
      // Wait a brief moment to ensure Firestore has propagated the changes
      await new Promise(resolve => setTimeout(resolve, 500));

      if (clerkUser?.id) {
        await library.loadUserLists(clerkUser.id, true);
      }

      Alert.alert('Success', 'List copied to your library!');
    } catch (error: any) {
      console.error('Error copying list:', error);
      const errorMessage = error?.message || 'Could not copy list. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setCopyingListId(null);
    }
  };

  const handleFollow = async () => {
    if (!userProfile || !clerkUser?.id) {
      Alert.alert('Error', 'You must be logged in to follow users');
      return;
    }

    if (userId === clerkUser.id) {
      Alert.alert('Info', 'You cannot follow yourself');
      return;
    }

    try {
      if (isFollowingUser) {
        await unfollowEntity(clerkUser.id, userId, 'user');
        setIsFollowingUser(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        Alert.alert('Success', `Unfollowed ${userProfile.userDetails?.name || 'user'}`);
      } else {
        await followEntity(clerkUser.id, userId, 'user');
        setIsFollowingUser(true);
        setFollowersCount(prev => prev + 1);
        Alert.alert('Success', `Now following ${userProfile.userDetails?.name || 'user'}`);
      }
    } catch (error: any) {
      console.error('[UserProfile] Error following/unfollowing user:', error);
      Alert.alert('Error', error?.message || 'Could not follow user. Please try again.');
    }
  };

  // Fetch user businesses
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const businesses = await getAllUserBusinesses();
        setUserBusinesses(businesses);
      } catch (error) {
        console.error('[UserProfileScreen] Error fetching businesses:', error);
      }
    };
    fetchBusinesses();
  }, []);

  // Calculate aligned and unaligned brands based on viewed user's values
  const { allSupportFull, allAvoidFull, scoredBrands } = useMemo(() => {
    const csvBrands = brands || [];
    const localBizList = userBusinesses || [];

    const currentBrands = [...csvBrands, ...localBizList];

    if (!currentBrands || currentBrands.length === 0 || !userProfile || !userProfile.causes || userProfile.causes.length === 0) {
      return {
        allSupportFull: [],
        allAvoidFull: [],
        scoredBrands: new Map(),
      };
    }

    // Import scoring functions
    const { calculateBrandScore, normalizeBrandScores } = require('@/lib/scoring');

    // Calculate scores for all brands using the viewed user's values
    const brandsWithScores = currentBrands.map(brand => {
      const score = calculateBrandScore(brand.name, userProfile.causes || [], valuesMatrix);
      return { brand, score };
    });

    // Normalize scores to 1-99 range
    const normalizedBrands = normalizeBrandScores(brandsWithScores);

    // Create scored brands map
    const scoredMap = new Map(normalizedBrands.map(({ brand, score }) => [brand.id, score]));

    // Sort all brands by score
    const sortedByScore = [...normalizedBrands].sort((a, b) => b.score - a.score);

    // Top 50 highest-scoring brands (aligned)
    const alignedBrands = sortedByScore
      .slice(0, 50)
      .map(({ brand }) => brand);

    // Bottom 50 lowest-scoring brands (unaligned)
    const unalignedBrands = sortedByScore
      .slice(-50)
      .reverse()
      .map(({ brand }) => brand);

    return {
      allSupportFull: alignedBrands,
      allAvoidFull: unalignedBrands,
      scoredBrands: scoredMap,
    };
  }, [brands, userBusinesses, userProfile, valuesMatrix]);

  // Get endorsement list and count - must be before early returns to follow hooks rules
  const userEndorsementList = useMemo(() => {
    const userName = userProfile?.userDetails?.name || 'User';
    let endorsementList = userLists.find(list => list.name === userName);
    if (!endorsementList && userLists.length > 0) {
      const sortedByAge = [...userLists].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      endorsementList = sortedByAge[0];
    }
    return endorsementList || null;
  }, [userLists, userProfile]);
  const endorsementCount = userEndorsementList?.entries?.length || 0;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !userProfile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Profile Not Available</Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {error || 'This profile doesn\'t exist or is private.'}
          </Text>
          <TouchableOpacity
            style={[styles.homeButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/list')}
            activeOpacity={0.7}
          >
            <Text style={[styles.homeButtonText, { color: colors.white }]}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const userDetails = userProfile.userDetails;
  const userName = userDetails?.name || 'User';
  const isOwnProfile = userId === clerkUser?.id;
  const profileImageUrl = userDetails?.profileImage;

  // Calculate similarity score between current user and viewed user
  let similarityScore = 0;
  let similarityLabel = 'Different';
  if (!isOwnProfile && currentUserProfile?.causes && userProfile.causes) {
    similarityScore = calculateSimilarityScore(currentUserProfile.causes, userProfile.causes);
    similarityLabel = getSimilarityLabel(similarityScore);
  }

  let alignmentData = {
    isAligned: similarityScore >= 50,
    alignmentStrength: similarityScore
  };

  const alignmentColor = similarityScore >= 60 ? colors.success : similarityScore < 40 ? colors.danger : colors.textSecondary;
  const AlignmentIcon = similarityScore >= 60 ? TrendingUp : TrendingDown;

  const handleFollowUser = async () => {
    if (!clerkUser?.id) {
      Alert.alert('Error', 'You must be logged in to follow users');
      return;
    }

    if (userId === clerkUser.id) {
      Alert.alert('Info', 'You cannot follow yourself');
      return;
    }

    try {
      if (isFollowingUser) {
        await unfollowEntity(clerkUser.id, userId, 'user');
        setIsFollowingUser(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        Alert.alert('Success', `Unfollowed ${userName}`);
      } else {
        await followEntity(clerkUser.id, userId, 'user');
        setIsFollowingUser(true);
        setFollowersCount(prev => prev + 1);
        Alert.alert('Success', `Now following ${userName}`);
      }
    } catch (error: any) {
      console.error('Error following/unfollowing user:', error);
      Alert.alert('Error', error?.message || 'Could not follow user. Please try again.');
    }
  };

  const handleAddEndorseListToLibrary = async () => {
    if (!clerkUser?.id) {
      Alert.alert('Error', 'You must be logged in to add lists to your library');
      return;
    }

    if (userId === clerkUser.id) {
      Alert.alert('Info', 'This is already in your library');
      return;
    }

    try {
      // Get the user's endorsement list
      const endorsementList = await getEndorsementList(userId);

      if (!endorsementList) {
        Alert.alert('Error', 'This user does not have an endorsement list');
        return;
      }

      // Get current user's name
      const currentUserName = currentUserProfile?.userDetails?.name || clerkUser?.firstName || 'My Library';

      // Copy the list to the current user's library
      await copyListToLibrary(endorsementList.id, clerkUser.id, currentUserName, profileImageUrl);

      // Refresh library to show the new list
      await new Promise(resolve => setTimeout(resolve, 500));
      if (clerkUser?.id) {
        await library.loadUserLists(clerkUser.id, true);
      }

      Alert.alert('Success', `${userName}'s endorsement list added to your library!`);
    } catch (error: any) {
      console.error('Error adding endorsement list:', error);
      Alert.alert('Error', error?.message || 'Could not add list to library. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Web wrapper for centered content */}
      <View style={Platform.OS === 'web' ? styles.webWrapper : styles.fullWidth}>
      {/* Sticky Header Section - Does not scroll */}
      <View style={[styles.stickyHeader, { backgroundColor: colors.background }]}>
        {/* Hero Image Container */}
        <View style={styles.heroImageContainer}>
          <Image
            source={{ uri: profileImageUrl || 'https://via.placeholder.com/800x130/4A90E2/FFFFFF?text=Profile' }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            priority="high"
            placeholder={{ blurhash: 'LGF5?xoffQj[~qoffQof?bofj[ay' }}
          />

          {/* Back button on hero */}
          <TouchableOpacity
            style={[styles.backButtonOverlay, { backgroundColor: colors.backgroundSecondary + 'DD' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Header with profile image, user info, and alignment score */}
        <View style={[styles.stickyHeaderContent, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            {profileImageUrl ? (
              <TouchableOpacity
                onPress={() => setShowImageModal(true)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: profileImageUrl }}
                  style={styles.headerLogo}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </TouchableOpacity>
            ) : (
              <View style={[styles.headerLogoPlaceholder, { backgroundColor: colors.primary }]}>
                <User size={28} color={colors.white} strokeWidth={2} />
              </View>
            )}

            <View style={styles.titleContainer}>
              <View style={styles.nameRow}>
                <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
              </View>
              {userDetails?.location && (
                <View style={styles.locationRow}>
                  <MapPin size={14} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                    {userDetails.location}
                  </Text>
                </View>
              )}
            </View>

            {/* Show alignment score only when viewing another user's profile */}
            {!isOwnProfile && (
              <View style={[styles.scoreCircle, { borderColor: alignmentColor, backgroundColor: colors.background }]}>
                <Text style={[styles.scoreNumber, { color: alignmentColor }]}>
                  {alignmentData.alignmentStrength}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Scrollable Content Section */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' ? styles.webContent : undefined
        ]}
        showsVerticalScrollIndicator={false}
        {...panResponder.panHandlers}
      >
        <View style={styles.content}>
          {userDetails?.description && (
            <Text style={[styles.userDescription, { color: colors.textSecondary }]}>
              {userDetails.description}
            </Text>
          )}

          {/* Social Links - Above counters to match profile.tsx */}
          {(userDetails?.socialMedia?.twitter || userDetails?.socialMedia?.instagram || userDetails?.socialMedia?.facebook || userDetails?.socialMedia?.linkedin || userDetails?.website) && (
            <View style={styles.socialLinksContainer}>
              {userDetails.website && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => Linking.openURL(userDetails.website.startsWith('http') ? userDetails.website : `https://${userDetails.website}`)}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={14} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>Website</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.twitter && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => Linking.openURL(`https://x.com/${userDetails.socialMedia.twitter}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>𝕏</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.instagram && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => Linking.openURL(`https://instagram.com/${userDetails.socialMedia.instagram.replace('@', '')}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>Instagram</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.facebook && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => Linking.openURL(userDetails.socialMedia.facebook.startsWith('http') ? userDetails.socialMedia.facebook : `https://${userDetails.socialMedia.facebook}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>Facebook</Text>
                </TouchableOpacity>
              )}
              {userDetails.socialMedia?.linkedin && (
                <TouchableOpacity
                  style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => Linking.openURL(userDetails.socialMedia.linkedin.startsWith('http') ? userDetails.socialMedia.linkedin : `https://${userDetails.socialMedia.linkedin}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.socialButtonText, { color: colors.text }]}>LinkedIn</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Endorsements/Following/Followers Counts with Action Menu - Clickable to show lists */}
          <View style={styles.followStatsContainer}>
            <TouchableOpacity
              style={styles.followStat}
              onPress={() => setSelectedLibrarySection('endorsement')}
              activeOpacity={0.7}
            >
              <Text style={[styles.followStatNumber, { color: selectedLibrarySection === 'endorsement' ? colors.primary : colors.text }]}>{endorsementCount}</Text>
              <Text style={[styles.followStatLabel, { color: selectedLibrarySection === 'endorsement' ? colors.primary : colors.textSecondary }]}>Endorsements</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.followStat}
              onPress={() => setSelectedLibrarySection('following')}
              activeOpacity={0.7}
            >
              <Text style={[styles.followStatNumber, { color: selectedLibrarySection === 'following' ? colors.primary : colors.text }]}>{followingCount}</Text>
              <Text style={[styles.followStatLabel, { color: selectedLibrarySection === 'following' ? colors.primary : colors.textSecondary }]}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.followStat}
              onPress={() => setSelectedLibrarySection('followers')}
              activeOpacity={0.7}
            >
              <Text style={[styles.followStatNumber, { color: selectedLibrarySection === 'followers' ? colors.primary : colors.text }]}>{followersCount}</Text>
              <Text style={[styles.followStatLabel, { color: selectedLibrarySection === 'followers' ? colors.primary : colors.textSecondary }]}>Followers</Text>
            </TouchableOpacity>

            {/* Action menu button - inline with counters */}
            {!isOwnProfile && (
              <View style={styles.actionMenuContainer}>
                <TouchableOpacity
                  style={[styles.profileActionButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => setShowActionMenu(!showActionMenu)}
                  activeOpacity={0.7}
                >
                  <View style={{ transform: [{ rotate: '90deg' }] }}>
                    <MoreVertical size={18} color={colors.text} strokeWidth={2} />
                  </View>
                </TouchableOpacity>

                {/* Action Menu Dropdown */}
                {showActionMenu && (
                  <View style={[styles.profileActionDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.profileActionItem}
                      onPress={() => {
                        setShowActionMenu(false);
                        handleFollowUser();
                      }}
                      activeOpacity={0.7}
                    >
                      {isFollowingUser ? (
                        <UserMinus size={16} color={colors.text} strokeWidth={2} />
                      ) : (
                        <UserPlus size={16} color={colors.text} strokeWidth={2} />
                      )}
                      <Text style={[styles.profileActionText, { color: colors.text }]}>
                        {isFollowingUser ? 'Unfollow' : 'Follow'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.profileActionItem}
                      onPress={() => {
                        setShowActionMenu(false);
                        const shareUrl = `${Platform.OS === 'web' ? window.location.origin : 'https://iendorse.app'}/user/${userId}`;
                        if (Platform.OS === 'web') {
                          navigator.clipboard.writeText(shareUrl);
                          Alert.alert('Link Copied', 'Profile link copied to clipboard');
                        } else {
                          Alert.alert('Share', `Share ${userName}'s profile at ${shareUrl}`);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Share2 size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.profileActionText, { color: colors.text }]}>Share</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Library Section - Uses Unified Library Component */}
          <View style={styles.librarySection}>
            <UnifiedLibrary
              mode={isOwnProfile ? 'preview' : 'view'}
              currentUserId={clerkUser?.id}
              viewingUserId={userId}
              userLists={userLists}
              endorsementList={userEndorsementList}
              alignedItems={isOwnProfile ? allSupportFull : []}
              unalignedItems={isOwnProfile ? allAvoidFull : []}
              isDarkMode={isDarkMode}
              profileImage={profileImageUrl}
              userBusinesses={userBusinesses}
              scoredBrands={scoredBrands}
              userCauses={currentUserProfile?.causes || []}
              followingCount={followingCount}
              followersCount={followersCount}
              externalSelectedSection={selectedLibrarySection}
              onSectionChange={setSelectedLibrarySection}
            />
          </View>
        </View>
      </ScrollView>
      </View>

      {/* Full Screen Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
            activeOpacity={0.7}
          >
            <X size={28} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imageModalContent}
            activeOpacity={1}
            onPress={() => setShowImageModal(false)}
          >
            {profileImageUrl && (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.fullScreenImage}
                contentFit="contain"
                transition={200}
              />
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  webWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
  },
  fullWidth: {
    flex: 1,
    width: '100%',
  },
  stickyHeader: {
    zIndex: 10,
  },
  stickyHeaderContent: {
    padding: 16,
    paddingBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  webContent: {
    maxWidth: 768,
    alignSelf: 'center' as const,
    width: '100%',
  },
  heroImageContainer: {
    width: '100%',
    height: 130,
    position: 'relative' as const,
  },
  heroImage: {
    width: '100%',
    height: 130,
  },
  backButtonOverlay: {
    position: 'absolute' as const,
    bottom: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
    gap: 10,
  },
  headerLogo: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: '#FFFFFF',
  },
  headerLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  locationText: {
    fontSize: 12,
  },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  privacyBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  profileActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileActionDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 180,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  profileActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  profileActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  userDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
    marginTop: 4,
  },
  followStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 8,
    paddingVertical: 8,
    marginBottom: 4,
  },
  followStat: {
    alignItems: 'center',
  },
  actionMenuContainer: {
    marginLeft: 'auto' as const,
    position: 'relative' as const,
  },
  followStatNumber: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  followStatLabel: {
    fontSize: 13,
  },
  socialLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  socialButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  librarySection: {
    marginTop: 8,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  listsContainer: {
    gap: 12,
  },
  listWrapper: {
    marginBottom: 0,
  },
  listHeader: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  listIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeaderInfo: {
    flex: 1,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    flex: 1,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  listItemCount: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  publicIndicator: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateIndicator: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  listMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listMenuDropdown: {
    position: 'absolute' as const,
    top: 60,
    right: 10,
    minWidth: 150,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  listMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
  },
  listMenuText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  listItemsContainer: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  listItemNumber: {
    fontSize: 13,
    fontWeight: '600' as const,
    minWidth: 24,
  },
  listItemText: {
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  homeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  // Image Modal Styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute' as const,
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageModalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '90%',
    height: '80%',
  },
});
