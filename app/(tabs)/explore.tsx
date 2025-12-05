import { useRouter } from 'expo-router';
import { Search as SearchIcon, TrendingUp, TrendingDown, Minus, ScanBarcode, X, Heart, MessageCircle, Share2, ExternalLink, MoreVertical, UserPlus, UserMinus, List as ListIcon, Plus, Check, Globe } from 'lucide-react-native';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  StatusBar,
  ScrollView,
  Linking,
  Share as RNShare,
  Dimensions,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import MenuButton from '@/components/MenuButton';
import Colors, { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { searchProducts } from '@/mocks/products';
import { MOCK_PRODUCTS } from '@/mocks/products';
import { LOCAL_BUSINESSES } from '@/mocks/local-businesses';
import { Product } from '@/types';
import { lookupBarcode, findBrandInDatabase, getBrandProduct } from '@/mocks/barcode-products';
import { getLogoUrl } from '@/lib/logo';
import { getBusinessesAcceptingDiscounts, getAllUserBusinesses, BusinessUser, calculateAlignmentScore } from '@/services/firebase/businessService';
import { calculateBrandScore, normalizeBrandScores } from '@/lib/scoring';
import { getAllPublicUsers } from '@/services/firebase/userService';
import { UserProfile } from '@/types';
import { copyListToLibrary, getEndorsementList } from '@/services/firebase/listService';
import { useLibrary } from '@/contexts/LibraryContext';
import { followEntity, unfollowEntity, isFollowing, getFollowing } from '@/services/firebase/followService';
import { getTopBrands, getTopBusinesses } from '@/services/firebase/topRankingsService';
import { submitBrandRequest } from '@/services/firebase/brandRequestService';
import { searchPlaces, PlaceSearchResult, getPlacePhotoUrl, formatCategory } from '@/services/firebase/placesService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useReferralCode } from '@/hooks/useReferralCode';
import { appendReferralTracking } from '@/services/firebase/referralService';

interface Comment {
  id: string;
  userName: string;
  text: string;
  timestamp: Date;
}

// Following item interface to handle all entity types
interface FollowingItem {
  id: string;
  type: 'user' | 'business' | 'brand';
  name: string;
  description?: string;
  profileImage?: string;
  location?: string;
  category?: string;
  website?: string;
}

// Top business item interface (combined brands and businesses)
interface TopBusinessItem {
  id: string;
  type: 'brand' | 'business';
  name: string;
  category?: string;
  website?: string;
  logoUrl?: string;
  score: number;
  endorsementCount: number;
}

interface ProductInteraction {
  productId: string;
  isLiked: boolean;
  comments: Comment[];
  likesCount: number;
}

// ===== Custom Categories =====
const CUSTOM_CATEGORIES = [
  { id: 'technology', label: 'Technology', color: '#3B82F6' },
  { id: 'retail', label: 'Retail', color: '#10B981' },
  { id: 'food_beverage', label: 'Food & Beverage', color: '#F59E0B' },
  { id: 'finance', label: 'Finance', color: '#6366F1' },
  { id: 'automotive', label: 'Automotive', color: '#EF4444' },
  { id: 'entertainment', label: 'Entertainment', color: '#EC4899' },
  { id: 'health_wellness', label: 'Health & Wellness', color: '#14B8A6' },
  { id: 'fashion', label: 'Fashion', color: '#8B5CF6' },
  { id: 'travel', label: 'Travel', color: '#06B6D4' },
  { id: 'other', label: 'Other', color: '#6B7280' },
];

// Separate UserCard component to properly use hooks
const UserCard = ({ item, colors, router, clerkUser, profile, library }: {
  item: { id: string; profile: UserProfile };
  colors: any;
  router: any;
  clerkUser: any;
  profile: any;
  library: any;
}) => {
  const userName = item.profile.userDetails?.name || 'User';
  const userImage = item.profile.userDetails?.profileImage;
  const userLocation = item.profile.userDetails?.location;
  const userBio = item.profile.userDetails?.description;

  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [checkingFollowStatus, setCheckingFollowStatus] = useState(true);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const { referralCode } = useReferralCode();

  // Check follow status on mount
  useEffect(() => {
    const checkFollow = async () => {
      if (clerkUser?.id && item.id !== clerkUser.id) {
        const following = await isFollowing(clerkUser.id, item.id, 'user');
        setIsFollowingUser(following);
      }
      setCheckingFollowStatus(false);
    };
    checkFollow();
  }, [item.id, clerkUser?.id]);

  const handleFollowUser = async () => {
    if (!clerkUser?.id) {
      Alert.alert('Error', 'You must be logged in to follow users');
      return;
    }

    if (item.id === clerkUser.id) {
      Alert.alert('Info', 'You cannot follow yourself');
      return;
    }

    try {
      if (isFollowingUser) {
        await unfollowEntity(clerkUser.id, item.id, 'user');
        setIsFollowingUser(false);
        Alert.alert('Success', `Unfollowed ${userName}`);
      } else {
        await followEntity(clerkUser.id, item.id, 'user');
        setIsFollowingUser(true);
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

    if (item.id === clerkUser.id) {
      Alert.alert('Info', 'This is already in your library');
      return;
    }

    try {
      // Get the user's endorsement list
      const endorsementList = await getEndorsementList(item.id);

      if (!endorsementList) {
        Alert.alert('Error', 'This user does not have an endorsement list');
        return;
      }

      // Get current user's name
      const currentUserName = profile?.userDetails?.name || clerkUser?.firstName || 'My Library';

      // Copy the list to the current user's library
      await copyListToLibrary(endorsementList.id, clerkUser.id, currentUserName, userImage);

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

  const handleShare = () => {
    const baseUrl = `https://iendorse.app/user/${item.id}`;
    const shareUrl = appendReferralTracking(baseUrl, referralCode);
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(shareUrl);
      Alert.alert('Link Copied', 'Profile link copied to clipboard');
    } else {
      RNShare.share({
        message: `Check out ${userName}'s profile on iEndorse: ${shareUrl}`,
      });
    }
    setShowActionMenu(false);
  };

  return (
    <TouchableOpacity
      style={[
        styles.userCard,
        { backgroundColor: 'transparent', borderColor: 'transparent' }
      ]}
      onPress={() => router.push(`/user/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.userCardContent}>
        {userImage ? (
          <Image
            source={{ uri: userImage }}
            style={styles.userCardImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.userCardImagePlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={[styles.userCardImageText, { color: colors.white }]}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.userCardInfo}>
          <Text style={[styles.userCardName, { color: colors.text }]} numberOfLines={1}>
            {userName}
          </Text>
          {userLocation && (
            <Text style={[styles.userCardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
              {userLocation}
            </Text>
          )}
          {userBio && (
            <Text style={[styles.userCardBio, { color: colors.textSecondary }]} numberOfLines={2}>
              {userBio}
            </Text>
          )}
        </View>
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            style={[styles.userCardActionButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setShowActionMenu(!showActionMenu)}
            activeOpacity={0.7}
          >
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <MoreVertical size={18} color={colors.text} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* Action Menu Dropdown */}
          {showActionMenu && (
            <View style={[styles.userActionDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.userActionItem}
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
                <Text style={[styles.userActionText, { color: colors.text }]}>
                  {isFollowingUser ? 'Unfollow' : 'Follow'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.userActionItem}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Share2 size={16} color={colors.text} strokeWidth={2} />
                <Text style={[styles.userActionText, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function SearchScreen() {
  const router = useRouter();
  const { profile, addToSearchHistory, isDarkMode, clerkUser } = useUser();
  const library = useLibrary();
  const { values: firebaseValues, brands: firebaseBrands, valuesMatrix } = useData();
  const colors = isDarkMode ? darkColors : lightColors;
  const { width } = useWindowDimensions();
  const { referralCode } = useReferralCode();

  // Helper function to normalize category names to handle variations and synonyms
  const normalizeCategory = useCallback((category: string): string => {
    const lower = category.toLowerCase().trim();
    // Handle synonyms and variations
    if (lower === 'person' || lower === 'people') return 'person';
    if (lower === 'social_issue' || lower === 'social issues') return 'social_issue';
    if (lower === 'nation' || lower === 'nations' || lower === 'places') return 'nation';
    return lower;
  }, []);

  // Build available values from Firebase dynamically (same as values tab)
  const availableValuesByCategory = useMemo(() => {
    const valuesByCategory: Record<string, any[]> = {};

    firebaseValues.forEach(value => {
      // Normalize the category to handle case variations and synonyms
      const normalizedCategory = normalizeCategory(value.category || 'other');

      // Initialize category array if it doesn't exist
      if (!valuesByCategory[normalizedCategory]) {
        valuesByCategory[normalizedCategory] = [];
      }

      valuesByCategory[normalizedCategory].push({
        id: value.id,
        name: value.name,
        category: normalizedCategory,
      });
    });

    return valuesByCategory;
  }, [firebaseValues, normalizeCategory]);

  // Get all categories that have values
  const availableCategories = useMemo(() => {
    return Object.keys(availableValuesByCategory).sort();
  }, [availableValuesByCategory]);

  // Build categories with labels for dropdowns
  const categoriesWithLabels = useMemo(() => {
    const categoryLabels: Record<string, string> = {
      'ideology': 'Ideology',
      'social_issue': 'Social Issues',
      'person': 'People',
      'lifestyle': 'Lifestyle',
      'nation': 'Places',
      'religion': 'Religion',
      'organization': 'Organizations',
      'sports': 'Sports',
      'corporation': 'Corporations',
    };

    return availableCategories.map(key => ({
      key,
      label: categoryLabels[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }));
  }, [availableCategories]);

  // Helper function to normalize alignment scores to 0-100 range
  const normalizeScore = useCallback((score: number | undefined): number => {
    return Math.min(100, Math.max(0, Math.round(Math.abs(score ?? 50))));
  }, []);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [firebaseBusinesses, setFirebaseBusinesses] = useState<BusinessUser[]>([]);
  const [publicUsers, setPublicUsers] = useState<Array<{ id: string; profile: UserProfile }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [followingItems, setFollowingItems] = useState<FollowingItem[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [followingDisplayCount, setFollowingDisplayCount] = useState(10);
  const [topBusinessItems, setTopBusinessItems] = useState<TopBusinessItem[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingMoreBusinesses, setLoadingMoreBusinesses] = useState(false);
  const [showAllBusinesses, setShowAllBusinesses] = useState(false);
  const [activeTab, setActiveTab] = useState<'following' | 'topUsers'>('topUsers');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scannedInfo, setScannedInfo] = useState<{productName: string; brandName: string; imageUrl?: string; notInDatabase: boolean} | null>(null);
  const [scanning, setScanning] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Create business form state (replaces simple request form)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    category: '',
    description: '',
    website: '',
    location: '',
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [showCreateSuccess, setShowCreateSuccess] = useState(false);

  // Google Places search state
  const [placesResults, setPlacesResults] = useState<PlaceSearchResult[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesSearchDebounce, setPlacesSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Fetch Firebase businesses and public users on mount (limited to 10 initially)
  useEffect(() => {
    const fetchData = async () => {
      setLoadingUsers(true);
      try {
        const businesses = await getAllUserBusinesses();
        setFirebaseBusinesses(businesses);

        const users = await getAllPublicUsers(10);
        setPublicUsers(users);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchData();
  }, []);

  // Load more users when "Show More" is clicked
  const loadMoreUsers = async () => {
    setLoadingMoreUsers(true);
    try {
      const users = await getAllPublicUsers(50);
      setPublicUsers(users);
      setShowAllUsers(true);
    } catch (error) {
      console.error('Error loading more users:', error);
    } finally {
      setLoadingMoreUsers(false);
    }
  };

  // Fetch top businesses (combined brands and businesses) on mount (limited to 10 initially)
  useEffect(() => {
    const fetchTopBusinessItems = async () => {
      setLoadingBusinesses(true);
      console.log('[Search] Fetching top businesses...');
      try {
        // Fetch from both pools, then combine and take true top 10
        const [topBrands, topBusinessesList] = await Promise.all([
          getTopBrands(15),
          getTopBusinesses(15),
        ]);

        console.log('[Search] Got top brands:', topBrands.length, 'top businesses:', topBusinessesList.length);

        // Combine, sort by score, and take top 10
        const combined: TopBusinessItem[] = [
          ...topBrands.map(brand => ({
            ...brand,
            type: 'brand' as const,
          })),
          ...topBusinessesList.map(business => ({
            ...business,
            type: 'business' as const,
          })),
        ].sort((a, b) => b.score - a.score).slice(0, 10);

        console.log('[Search] Combined top items:', combined.length);
        setTopBusinessItems(combined);
      } catch (error) {
        console.error('Error fetching top businesses:', error);
      } finally {
        setLoadingBusinesses(false);
      }
    };
    fetchTopBusinessItems();
  }, []);

  // Load more businesses when "Show More" is clicked
  const loadMoreBusinesses = async () => {
    setLoadingMoreBusinesses(true);
    try {
      const [topBrands, topBusinessesList] = await Promise.all([
        getTopBrands(25),
        getTopBusinesses(25),
      ]);

      const combined: TopBusinessItem[] = [
        ...topBrands.map(brand => ({
          ...brand,
          type: 'brand' as const,
        })),
        ...topBusinessesList.map(business => ({
          ...business,
          type: 'business' as const,
        })),
      ].sort((a, b) => b.score - a.score);

      setTopBusinessItems(combined);
      setShowAllBusinesses(true);
    } catch (error) {
      console.error('Error loading more businesses:', error);
    } finally {
      setLoadingMoreBusinesses(false);
    }
  };

  // Fetch all following items when tab changes or user logs in
  useEffect(() => {
    const fetchFollowingItems = async () => {
      if (!clerkUser?.id || activeTab !== 'following') return;

      setLoadingFollowing(true);
      try {
        const followingEntities = await getFollowing(clerkUser.id);
        const items: FollowingItem[] = [];

        for (const entity of followingEntities) {
          try {
            if (entity.followedType === 'user') {
              // Fetch user/business account from Firebase
              const userRef = doc(db, 'users', entity.followedId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                // Check if this is a business account
                if (userData.accountType === 'business' && userData.businessInfo) {
                  // Use uploaded logoUrl first, fall back to generated logo from website
                  const logoImage = userData.businessInfo.logoUrl || (userData.businessInfo.website
                    ? getLogoUrl(userData.businessInfo.website)
                    : ''); // Empty string will show placeholder
                  items.push({
                    id: entity.followedId,
                    type: 'business',
                    name: userData.businessInfo.name || 'Unknown Business',
                    description: userData.businessInfo.description || '',
                    profileImage: logoImage,
                    category: userData.businessInfo.category,
                    website: userData.businessInfo.website,
                  });
                } else {
                  // Regular user account
                  items.push({
                    id: entity.followedId,
                    type: 'user',
                    name: userData.userDetails?.name || userData.name || userData.fullName || 'User',
                    description: userData.userDetails?.description || '',
                    profileImage: userData.userDetails?.profileImage || userData.profileImage || '',
                    location: userData.userDetails?.location || '',
                  });
                }
              }
            } else if (entity.followedType === 'business') {
              // Fetch business from users collection
              const businessRef = doc(db, 'users', entity.followedId);
              const businessSnap = await getDoc(businessRef);
              if (businessSnap.exists()) {
                const businessData = businessSnap.data();
                const businessInfo = businessData.businessInfo;
                if (businessInfo) {
                  // Use uploaded logoUrl first, fall back to generated logo from website
                  const logoImage = businessInfo.logoUrl || (businessInfo.website
                    ? getLogoUrl(businessInfo.website)
                    : ''); // Empty string will show placeholder
                  items.push({
                    id: entity.followedId,
                    type: 'business',
                    name: businessInfo.name || 'Unknown Business',
                    description: businessInfo.description || '',
                    profileImage: logoImage,
                    category: businessInfo.category,
                    website: businessInfo.website,
                  });
                }
              }
            } else if (entity.followedType === 'brand') {
              // Fetch brand from brands collection
              const brandRef = doc(db, 'brands', entity.followedId);
              const brandSnap = await getDoc(brandRef);
              if (brandSnap.exists()) {
                const brandData = brandSnap.data();
                items.push({
                  id: entity.followedId,
                  type: 'brand',
                  name: brandData.name || 'Unknown Brand',
                  description: brandData.description || '',
                  profileImage: brandData.website ? getLogoUrl(brandData.website) : '',
                  category: brandData.category,
                  website: brandData.website,
                });
              } else {
                // Brand might be in the brands data context
                const brand = firebaseBrands.find(b => b.id === entity.followedId || b.name === entity.followedId);
                if (brand) {
                  items.push({
                    id: entity.followedId,
                    type: 'brand',
                    name: brand.name,
                    description: '',
                    profileImage: brand.website ? getLogoUrl(brand.website) : '',
                    category: brand.category,
                    website: brand.website,
                  });
                }
              }
            }
          } catch (err) {
            console.error('Error fetching following item:', entity.followedId, err);
          }
        }
        setFollowingItems(items);
      } catch (error) {
        console.error('Error fetching following items:', error);
      } finally {
        setLoadingFollowing(false);
      }
    };
    fetchFollowingItems();
  }, [clerkUser?.id, activeTab, firebaseBrands]);

  // Responsive grid columns
  const numColumns = useMemo(() => width > 768 ? 3 : 2, [width]);

  // Explore feed state
  const [selectedPostProduct, setSelectedPostProduct] = useState<(Product & { matchingValues?: string[] }) | null>(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [interactions, setInteractions] = useState<Map<string, ProductInteraction>>(new Map());
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Calculate aligned products for Explore section
  const alignedProducts = useMemo(() => {
    if (!profile?.causes || !Array.isArray(profile.causes)) {
      return [];
    }

    const supportedCauses = profile.causes.filter(c => c.type === 'support').map(c => c.id);
    const avoidedCauses = profile.causes.filter(c => c.type === 'avoid').map(c => c.id);
    const totalUserValues = profile.causes.length;

    const allProducts = [...MOCK_PRODUCTS, ...LOCAL_BUSINESSES];

    const scored = allProducts.map(product => {
      let totalSupportScore = 0;
      let totalAvoidScore = 0;
      const matchingValues = new Set<string>();
      const positionSum: number[] = [];

      product.valueAlignments.forEach(alignment => {
        const isUserSupporting = supportedCauses.includes(alignment.valueId);
        const isUserAvoiding = avoidedCauses.includes(alignment.valueId);

        if (!isUserSupporting && !isUserAvoiding) return;

        matchingValues.add(alignment.valueId);
        positionSum.push(alignment.position);

        const score = alignment.isSupport ? (100 - alignment.position * 5) : -(100 - alignment.position * 5);

        if (isUserSupporting) {
          if (score > 0) {
            totalSupportScore += score;
          } else {
            totalAvoidScore += Math.abs(score);
          }
        }

        if (isUserAvoiding) {
          if (score < 0) {
            totalSupportScore += Math.abs(score);
          } else {
            totalAvoidScore += score;
          }
        }
      });

      const valuesWhereNotAppears = totalUserValues - matchingValues.size;
      const totalPositionSum = positionSum.reduce((a, b) => a + b, 0) + (valuesWhereNotAppears * 11);
      const avgPosition = totalUserValues > 0 ? totalPositionSum / totalUserValues : 11;

      const isPositivelyAligned = totalSupportScore > totalAvoidScore && totalSupportScore > 0;

      let alignmentStrength: number;
      if (isPositivelyAligned) {
        alignmentStrength = Math.round((1 - ((avgPosition - 1) / 10)) * 50 + 50);
      } else {
        alignmentStrength = Math.round(((avgPosition - 1) / 10) * 50);
      }

      return {
        product,
        totalSupportScore,
        totalAvoidScore,
        matchingValuesCount: matchingValues.size,
        matchingValues: Array.from(matchingValues),
        alignmentStrength,
        isPositivelyAligned
      };
    });

    const alignedSorted = scored
      .filter(s => s.isPositivelyAligned)
      .sort((a, b) => b.alignmentStrength - a.alignmentStrength)
      .map(s => ({ ...s.product, alignmentScore: s.alignmentStrength, matchingValues: s.matchingValues }));

    const shuffled: Product[] = [];
    const localItems = alignedSorted.filter(p => p.id.startsWith('local-'));
    const regularItems = alignedSorted.filter(p => !p.id.startsWith('local-'));

    const localInterval = regularItems.length > 0 ? Math.floor(regularItems.length / Math.max(localItems.length, 1)) : 1;

    let localIndex = 0;
    let regularIndex = 0;

    while (regularIndex < regularItems.length || localIndex < localItems.length) {
      for (let i = 0; i < localInterval && regularIndex < regularItems.length; i++) {
        shuffled.push(regularItems[regularIndex++]);
      }
      if (localIndex < localItems.length) {
        shuffled.push(localItems[localIndex++]);
      }
    }

    return shuffled.length > 0 ? shuffled : alignedSorted;
  }, [profile.causes]);

  const getProductInteraction = useCallback((productId: string): ProductInteraction => {
    return interactions.get(productId) || {
      productId,
      isLiked: false,
      comments: [],
      likesCount: Math.floor(Math.random() * 500) + 50
    };
  }, [interactions]);

  const handleLike = useCallback((productId: string) => {
    setInteractions(prev => {
      const newMap = new Map(prev);
      const interaction = getProductInteraction(productId);
      newMap.set(productId, {
        ...interaction,
        isLiked: !interaction.isLiked,
        likesCount: interaction.isLiked ? interaction.likesCount - 1 : interaction.likesCount + 1
      });
      return newMap;
    });
  }, [getProductInteraction]);

  const handleOpenComments = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setCommentModalVisible(true);
  }, []);

  const handleAddComment = useCallback(() => {
    if (!commentText.trim() || !selectedProductId) return;

    const userName = clerkUser?.firstName || clerkUser?.username || 'Anonymous';

    setInteractions(prev => {
      const newMap = new Map(prev);
      const interaction = getProductInteraction(selectedProductId);
      const newComment: Comment = {
        id: Date.now().toString(),
        userName,
        text: commentText.trim(),
        timestamp: new Date()
      };
      newMap.set(selectedProductId, {
        ...interaction,
        comments: [newComment, ...interaction.comments]
      });
      return newMap;
    });

    setCommentText('');
    setCommentModalVisible(false);
  }, [commentText, selectedProductId, clerkUser, getProductInteraction]);

  const handleShare = useCallback(async (product: Product) => {
    const baseUrl = `https://iendorse.app/brand/${product.id}`;
    const shareUrl = appendReferralTracking(baseUrl, referralCode);
    const message = `Check out ${product.name} on iEndorse!`;

    try {
      if (Platform.OS === 'web') {
        const textToCopy = `${message}\n${shareUrl}`;

        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
          Alert.alert('Copied!', 'Link copied to clipboard');
        } catch (execError) {
          console.error('Copy fallback error:', execError);
          Alert.alert('Error', 'Unable to copy to clipboard');
        } finally {
          textArea.remove();
        }
      } else {
        await RNShare.share({
          message: `${message}\n${shareUrl}`,
          title: product.name,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [referralCode]);

  const handleVisitBrand = useCallback(async (product: Product) => {
    try {
      let websiteUrl = product.website;

      // If no website or website is an internal app path, generate from brand name
      if (!websiteUrl || websiteUrl.startsWith('/') || websiteUrl.includes('iendorse')) {
        websiteUrl = `https://${product.brand.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '')}.com`;
      } else {
        // Ensure URL has proper http/https protocol
        if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
          websiteUrl = `https://${websiteUrl}`;
        }
      }

      const canOpen = await Linking.canOpenURL(websiteUrl);
      if (canOpen) {
        await Linking.openURL(websiteUrl);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  }, []);

  const getAlignmentReason = useCallback((matchingValues: string[]) => {
    if (!matchingValues || matchingValues.length === 0) return null;
    const allValues = Object.values(availableValuesByCategory).flat();
    const firstMatchingValue = allValues.find(v => v.id === matchingValues[0]);
    if (!firstMatchingValue) return null;
    return firstMatchingValue.name;
  }, [availableValuesByCategory]);

  const formatTimeAgo = useCallback((date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }, []);

  const handleSearch = (text: string) => {
    try {
      setQuery(text);
      if (text.trim().length > 0) {
        const userCauseIds = profile?.causes ? profile.causes.map(c => c.id) : [];
        const productResults = searchProducts(text, userCauseIds);

        // Search Firebase businesses
        const businessResults = firebaseBusinesses
          .filter(business => {
            const searchLower = text.toLowerCase();
            return (
              business.businessInfo.name.toLowerCase().includes(searchLower) ||
              business.businessInfo.category.toLowerCase().includes(searchLower) ||
              business.businessInfo.location?.toLowerCase().includes(searchLower) ||
              business.businessInfo.description?.toLowerCase().includes(searchLower)
            );
          })
          .map(business => {
            // Calculate alignment score using the same method as home tab
            const rawScore = business.causes && profile?.causes
              ? calculateAlignmentScore(profile.causes, business.causes)
              : 0;
            const alignmentScore = Math.round(50 + (rawScore * 0.8)); // Map to 10-90 range

            return {
              id: `firebase-business-${business.id}`,
              firebaseId: business.id, // Store original Firebase ID
              name: business.businessInfo.name,
              brand: business.businessInfo.name,
              category: business.businessInfo.category,
              description: business.businessInfo.description || '',
              alignmentScore,
              exampleImageUrl: business.businessInfo.logoUrl || (business.businessInfo.website ? getLogoUrl(business.businessInfo.website) : ''),
              website: business.businessInfo.website,
              location: business.businessInfo.location,
              valueAlignments: [],
              keyReasons: [
                business.businessInfo.acceptsStandDiscounts
                  ? `Accepts Endorse Discounts at ${business.businessInfo.name}`
                  : `Local business: ${business.businessInfo.name}`
              ],
              moneyFlow: { company: business.businessInfo.name, shareholders: [], overallAlignment: 0 },
              relatedValues: [],
              isFirebaseBusiness: true, // Flag to identify Firebase businesses
            } as Product & { firebaseId: string; isFirebaseBusiness: boolean };
          });

        // Search users
        const userResults = publicUsers
          .filter(user => {
            const searchLower = text.toLowerCase();
            const userName = user.profile.userDetails?.name || '';
            const userLocation = user.profile.userDetails?.location || '';
            const userBio = user.profile.userDetails?.description || '';

            return (
              userName.toLowerCase().includes(searchLower) ||
              userLocation.toLowerCase().includes(searchLower) ||
              userBio.toLowerCase().includes(searchLower)
            );
          })
          .map(user => ({
            id: `user-${user.id}`,
            userId: user.id, // Store original user ID
            name: user.profile.userDetails?.name || 'User',
            brand: user.profile.userDetails?.name || 'User',
            category: 'User',
            description: user.profile.userDetails?.description || '',
            alignmentScore: 50, // Default score for users
            exampleImageUrl: user.profile.userDetails?.profileImage || '',
            website: user.profile.userDetails?.website || '',
            location: user.profile.userDetails?.location || '',
            valueAlignments: [],
            keyReasons: ['User profile'],
            moneyFlow: { company: '', shareholders: [], overallAlignment: 0 },
            relatedValues: [],
            isUser: true, // Flag to identify users
          } as Product & { userId: string; isUser: boolean }));

        // Search Firebase brands (from DataContext)
        const brandResults = firebaseBrands
          .filter(brand => {
            const searchLower = text.toLowerCase();
            return (
              brand.name?.toLowerCase().includes(searchLower) ||
              brand.category?.toLowerCase().includes(searchLower) ||
              brand.description?.toLowerCase().includes(searchLower)
            );
          })
          .map(brand => ({
            id: `firebase-brand-${brand.id}`,
            brandId: brand.id, // Store original brand ID
            name: brand.name,
            brand: brand.name,
            category: brand.category || 'Brand',
            description: brand.description || '',
            alignmentScore: 50, // Default score for brands
            exampleImageUrl: brand.exampleImageUrl || (brand.website ? getLogoUrl(brand.website) : ''),
            website: brand.website || '',
            location: brand.location || '',
            valueAlignments: [],
            keyReasons: [brand.category ? `Category: ${brand.category}` : 'Brand'],
            moneyFlow: { company: brand.name, shareholders: [], overallAlignment: 0 },
            relatedValues: [],
            isFirebaseBrand: true, // Flag to identify Firebase brands
          } as Product & { brandId: string; isFirebaseBrand: boolean }));

        // Combine product, business, brand, and user results
        const combinedResults = [...(productResults || []), ...businessResults, ...brandResults, ...userResults];
        setResults(combinedResults);

        // Also search Google Places with debouncing
        if (placesSearchDebounce) {
          clearTimeout(placesSearchDebounce);
        }
        const timeoutId = setTimeout(async () => {
          if (text.trim().length >= 2) {
            setLoadingPlaces(true);
            try {
              const places = await searchPlaces(text.trim());
              setPlacesResults(places);
            } catch (error) {
              console.error('Error searching places:', error);
              setPlacesResults([]);
            } finally {
              setLoadingPlaces(false);
            }
          }
        }, 500);
        setPlacesSearchDebounce(timeoutId);
      } else {
        setResults([]);
        setPlacesResults([]);
        if (placesSearchDebounce) {
          clearTimeout(placesSearchDebounce);
        }
      }
    } catch (error) {
      console.error('Error during search:', error);
      setResults([]);
      setPlacesResults([]);
    }
  };

  // Handle business creation submission
  const handleCreateBusiness = async () => {
    if (!createFormData.name.trim() || !createFormData.category) {
      Alert.alert('Error', 'Please enter a name and select a category');
      return;
    }

    if (!clerkUser?.id) {
      Alert.alert('Error', 'Please sign in to create a business');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const userName = clerkUser?.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim()
        : clerkUser?.username || 'Anonymous';
      const userEmail = clerkUser?.primaryEmailAddress?.emailAddress;

      // Get logo from website if provided
      let logoUrl: string | undefined;
      if (createFormData.website) {
        logoUrl = getLogoUrl(createFormData.website, { size: 128 });
      }

      // Submit brand request with extended data for admin review
      await submitBrandRequest(
        createFormData.name.trim(),
        clerkUser.id,
        userName,
        userEmail,
        {
          category: createFormData.category,
          description: createFormData.description,
          website: createFormData.website,
          location: createFormData.location,
          logoUrl,
          source: 'manual_entry',
        }
      );

      // Show success state on button
      setShowCreateSuccess(true);

      // Reset and close after brief success display
      setTimeout(() => {
        setShowCreateSuccess(false);
        setShowCreateForm(false);
        setCreateFormData({
          name: '',
          category: '',
          description: '',
          website: '',
          location: '',
        });
      }, 1500);
    } catch (error) {
      console.error('Error creating business:', error);
      Alert.alert('Error', 'Failed to create business. Please try again.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleProductPress = (product: Product | (Product & { firebaseId: string; isFirebaseBusiness: boolean }) | (Product & { userId: string; isUser: boolean }) | (Product & { brandId: string; isFirebaseBrand: boolean })) => {
    if (query.trim().length > 0) {
      addToSearchHistory(query);
    }

    // Check if this is a user
    const userResult = product as Product & { userId?: string; isUser?: boolean };
    if (userResult.isUser && userResult.userId) {
      router.push({
        pathname: '/user/[userId]',
        params: { userId: userResult.userId },
      });
      return;
    }

    // Check if this is a Firebase business
    const fbBusiness = product as Product & { firebaseId?: string; isFirebaseBusiness?: boolean };
    if (fbBusiness.isFirebaseBusiness && fbBusiness.firebaseId) {
      router.push({
        pathname: '/business/[id]',
        params: { id: fbBusiness.firebaseId },
      });
      return;
    }

    // Check if this is a Firebase brand
    const fbBrand = product as Product & { brandId?: string; isFirebaseBrand?: boolean };
    if (fbBrand.isFirebaseBrand && fbBrand.brandId) {
      router.push({
        pathname: '/brand/[id]',
        params: {
          id: fbBrand.brandId,
          name: product.brand || product.name,
        },
      });
      return;
    }

    // Default: route to brand page
    router.push({
      pathname: '/brand/[id]',
      params: {
        id: product.id,
        name: product.brand || product.name, // Pass brand name as fallback for brand lookup
      },
    });
  };

  const handleGridCardPress = (product: Product & { matchingValues?: string[] }) => {
    setSelectedPostProduct(product);
    setPostModalVisible(true);
  };

  const handleOpenScanner = async () => {
    console.log('📷 Scanner button clicked');
    console.log('📷 Platform:', Platform.OS);
    console.log('📷 Permission status:', permission);
    console.log('📷 Request permission function:', typeof requestPermission);

    if (Platform.OS === 'web') {
      console.log('📷 Platform is web, showing alert');
      Alert.alert(
        'Scanner Not Available',
        'The barcode scanner is not available on web. Please use the mobile app to scan products.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!requestPermission) {
      console.error('📷 Camera permission hook not available');
      Alert.alert(
        'Camera Not Available',
        'Camera functionality is not available on this device.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('📷 Checking camera permission...');
    if (!permission?.granted) {
      console.log('📷 Permission not granted, requesting...');
      try {
        const result = await requestPermission();
        console.log('📷 Permission request result:', result);
        if (!result.granted) {
          console.log('📷 Permission denied, showing alert');
          Alert.alert(
            'Camera Permission Required',
            'Please allow camera access to scan barcodes',
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (error) {
        console.error('📷 Error requesting permission:', error);
        Alert.alert(
          'Error',
          'Failed to request camera permission. Please check your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    console.log('📷 Opening scanner modal');
    setScannerVisible(true);
  };

  const handleCloseScanner = () => {
    setScannerVisible(false);
    setScannedProduct(null);
    setScannedInfo(null);
    setScanning(true);
    setLookingUp(false);
  };

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (!scanning || lookingUp) return;

    console.log('Barcode scanned:', data);
    setScanning(false);
    setLookingUp(true);

    try {
      const productInfo = await lookupBarcode(data);

      if (!productInfo) {
        Alert.alert(
          'Product Not Found',
          'This barcode was not found in our database. Try searching manually.',
          [
            { text: 'OK', onPress: () => handleCloseScanner() },
            { text: 'Scan Again', onPress: () => { setScanning(true); setLookingUp(false); } }
          ]
        );
        return;
      }

      const matchedBrand = findBrandInDatabase(productInfo.brandName);

      if (!matchedBrand) {
        setScannedInfo({
          productName: productInfo.productName,
          brandName: productInfo.brandName,
          imageUrl: productInfo.imageUrl,
          notInDatabase: true
        });
        return;
      }

      const product = getBrandProduct(matchedBrand);

      if (product) {
        setScannedProduct(product);
      } else {
        setScannedInfo({
          productName: productInfo.productName,
          brandName: matchedBrand,
          imageUrl: productInfo.imageUrl,
          notInDatabase: true
        });
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert(
        'Error',
        'Failed to process barcode. Please try again.',
        [
          { text: 'OK', onPress: () => handleCloseScanner() },
          { text: 'Retry', onPress: () => { setScanning(true); setLookingUp(false); } }
        ]
      );
    } finally {
      setLookingUp(false);
    }
  };

  const handleViewScannedProduct = () => {
    if (scannedProduct) {
      handleCloseScanner();
      router.push({
        pathname: '/brand/[id]',
        params: { id: scannedProduct.id },
      });
    }
  };

  const getAlignmentColor = (score: number | undefined) => {
    const normalizedScore = score ?? 50;
    if (normalizedScore > 55) return colors.primary; // Blue for aligned
    if (normalizedScore >= 45) return Colors.neutral; // Grey for neutral (45-55)
    return Colors.danger; // Red/pink for unaligned
  };

  const getAlignmentIcon = (score: number | undefined) => {
    const normalizedScore = score ?? 50;
    if (normalizedScore >= 70) return TrendingUp;
    if (normalizedScore >= 40) return Minus;
    return TrendingDown;
  };

  const getAlignmentLabel = (score: number | undefined) => {
    const normalizedScore = score ?? 50;
    if (normalizedScore >= 70) return 'Strongly Aligned';
    if (normalizedScore >= 40) return 'Neutral';
    return 'Not Aligned';
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const alignmentColor = getAlignmentColor(item.alignmentScore);
    const score = normalizeScore(item.alignmentScore);
    const scoreColor = score >= 50 ? colors.primary : colors.danger;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.productCardInner}>
          <View style={styles.productLogoContainer}>
            <Image
              source={{ uri: getLogoUrl(item.website || '') }}
              style={styles.productLogo}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.productCardContent}>
            <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.productCategory, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.brand || item.category || 'Brand'}
            </Text>
          </View>
          <View style={styles.productScoreContainer}>
            <Text style={[styles.productScore, { color: scoreColor }]}>
              {score}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUserCard = ({ item }: { item: { id: string; profile: UserProfile } }) => {
    return (
      <UserCard
        item={item}
        colors={colors}
        router={router}
        clerkUser={clerkUser}
        profile={profile}
        library={library}
      />
    );
  };

  // Render function for following items (users, businesses, brands)
  const renderFollowingItem = ({ item }: { item: FollowingItem }) => {
    const handlePress = () => {
      if (item.type === 'user') {
        router.push(`/user/${item.id}`);
      } else if (item.type === 'business') {
        router.push({ pathname: '/business/[id]', params: { id: item.id } });
      } else if (item.type === 'brand') {
        router.push({ pathname: '/brand/[id]', params: { id: item.id } });
      }
    };

    const getTypeLabel = () => {
      switch (item.type) {
        case 'user': return 'User';
        case 'business': return 'Business';
        case 'brand': return 'Brand';
        default: return '';
      }
    };

    return (
      <TouchableOpacity
        style={[styles.userCard, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.userCardContent}>
          {item.profileImage ? (
            // Brands and businesses get white background to show logo transparency
            item.type === 'brand' || item.type === 'business' ? (
              <View style={[styles.userCardImage, { backgroundColor: '#FFFFFF' }]}>
                <Image
                  source={{ uri: item.profileImage }}
                  style={styles.userCardImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </View>
            ) : (
              <Image
                source={{ uri: item.profileImage }}
                style={styles.userCardImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            )
          ) : (
            <View style={[styles.userCardImagePlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={[styles.userCardImageText, { color: colors.white }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userCardInfo}>
            <Text style={[styles.userCardName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.userCardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
              {getTypeLabel()}{item.category ? ` • ${item.category}` : ''}{item.location ? ` • ${item.location}` : ''}
            </Text>
            {item.description && (
              <Text style={[styles.userCardBio, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render function for top business items (brands and businesses)
  const renderTopBusinessItem = ({ item, index }: { item: TopBusinessItem; index: number }) => {
    const handlePress = () => {
      if (item.type === 'business') {
        router.push({ pathname: '/business/[id]', params: { id: item.id } });
      } else if (item.type === 'brand') {
        router.push({ pathname: '/brand/[id]', params: { id: item.id } });
      }
    };

    const handleActionPress = () => {
      if (item.type === 'business') {
        router.push({ pathname: '/business/[id]', params: { id: item.id } });
      } else if (item.type === 'brand') {
        router.push({ pathname: '/brand/[id]', params: { id: item.id } });
      }
    };

    const logoUrl = item.logoUrl || getLogoUrl(item.website || '');

    return (
      <TouchableOpacity
        style={[styles.topBusinessCard, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.topBusinessCardContent}>
          <Text style={[styles.topBusinessRank, { color: colors.textSecondary }]}>
            {index + 1}
          </Text>
          <View style={[styles.topBusinessImage, { backgroundColor: '#FFFFFF' }]}>
            <Image
              source={{ uri: logoUrl }}
              style={styles.topBusinessImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.topBusinessInfo}>
            <Text style={[styles.topBusinessName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.topBusinessCategory, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.category || (item.type === 'brand' ? 'Brand' : 'Business')} • {item.endorsementCount} {item.endorsementCount === 1 ? 'endorsement' : 'endorsements'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.topBusinessActionButton}
            onPress={handleActionPress}
            activeOpacity={0.7}
          >
            <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionTitle = () => {
    if (query.trim().length > 0) return null;

    return (
      <View style={[styles.tabSelector, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'topUsers' && styles.activeTab,
            activeTab === 'topUsers' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('topUsers')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'topUsers' ? colors.primary : colors.textSecondary },
            activeTab === 'topUsers' && styles.activeTabText
          ]}>
            Top Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'following' && styles.activeTab,
            activeTab === 'following' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('following')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'following' ? colors.primary : colors.textSecondary },
            activeTab === 'following' && styles.activeTabText
          ]}>
            Following
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderResultListItem = ({ item }: { item: Product }) => {
    const alignmentColor = getAlignmentColor(item.alignmentScore);
    const normalizedScore = normalizeScore(item.alignmentScore);

    // Aligned items (blue) should be outlined only, unaligned (red) should have fill
    const isAligned = (item.alignmentScore ?? 50) > 55;
    const scoreBackgroundColor = isAligned ? 'transparent' : alignmentColor + '15';

    return (
      <TouchableOpacity
        style={[styles.resultListItem, { borderBottomColor: colors.border }]}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.resultListImageContainer}>
          <Image
            source={{ uri: getLogoUrl(item.website || '') }}
            style={styles.resultListImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        </View>
        <View style={styles.resultListInfo}>
          <Text style={[styles.resultListBrand, { color: colors.text }]}>
            {item.brand}
          </Text>
          <Text style={[styles.resultListName, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={[styles.resultListScore, { borderColor: alignmentColor, backgroundColor: scoreBackgroundColor }]}>
          <Text style={[styles.resultListScoreText, { color: alignmentColor }]}>
            {normalizedScore}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFullPost = () => {
    if (!selectedPostProduct) return null;

    const interaction = getProductInteraction(selectedPostProduct.id);
    const alignmentReason = getAlignmentReason(selectedPostProduct.matchingValues || []);

    return (
      <View style={[styles.postContainer, { backgroundColor: colors.background }]}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.brandInfo}
            onPress={() => {
              setPostModalVisible(false);
              handleProductPress(selectedPostProduct);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.brandAvatar, { backgroundColor: colors.backgroundSecondary }]}>
              <Image
                source={{ uri: getLogoUrl(selectedPostProduct.website || '') }}
                style={styles.brandAvatarImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            </View>
            <View style={styles.brandDetails}>
              <Text style={[styles.brandName, { color: colors.text }]}>{selectedPostProduct.brand}</Text>
              <Text style={[styles.brandCategory, { color: colors.textSecondary }]}>{selectedPostProduct.category}</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.postAlignmentBadge, { backgroundColor: colors.success + '15' }]}>
            <Text style={[styles.postAlignmentScore, { color: colors.success }]}>{normalizeScore(selectedPostProduct.alignmentScore)}</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => {
            setPostModalVisible(false);
            handleProductPress(selectedPostProduct);
          }}
        >
          <Image
            source={{ uri: selectedPostProduct.exampleImageUrl || getLogoUrl(selectedPostProduct.website || '') }}
            style={styles.postImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        </TouchableOpacity>

        {alignmentReason && (
          <View style={styles.alignmentReasonContainer}>
            <Text style={[styles.alignmentReasonText, { color: colors.textSecondary }]}>
              You're seeing this because you align with <Text style={{ fontWeight: '600', color: colors.text }}>{alignmentReason}</Text>
            </Text>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <View style={styles.leftActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLike(selectedPostProduct.id)}
              activeOpacity={0.7}
            >
              <Heart
                size={28}
                color={interaction.isLiked ? colors.danger : colors.text}
                fill={interaction.isLiked ? colors.danger : 'none'}
                strokeWidth={2}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenComments(selectedPostProduct.id)}
              activeOpacity={0.7}
            >
              <MessageCircle size={28} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShare(selectedPostProduct)}
              activeOpacity={0.7}
            >
              <Share2 size={28} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.visitButton, { backgroundColor: colors.primary }]}
            onPress={() => handleVisitBrand(selectedPostProduct)}
            activeOpacity={0.8}
          >
            <ExternalLink size={18} color={colors.white} strokeWidth={2} />
            <Text style={[styles.visitButtonText, { color: colors.white }]}>Shop</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.postContent}>
          {interaction.likesCount > 0 && (
            <Text style={[styles.likesText, { color: colors.text }]}>
              {interaction.likesCount.toLocaleString()} {interaction.likesCount === 1 ? 'like' : 'likes'}
            </Text>
          )}
          <View style={styles.descriptionContainer}>
            <Text style={[styles.postProductName, { color: colors.text }]}>
              <Text style={styles.brandNameBold}>{selectedPostProduct.brand}</Text> {selectedPostProduct.productDescription || selectedPostProduct.name}
            </Text>
          </View>
          {interaction.comments.length > 0 && (
            <TouchableOpacity
              onPress={() => handleOpenComments(selectedPostProduct.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewCommentsText, { color: colors.textSecondary }]}>
                View all {interaction.comments.length} {interaction.comments.length === 1 ? 'comment' : 'comments'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={[styles.stickyHeader, { backgroundColor: colors.background, borderBottomColor: 'rgba(0, 0, 0, 0.05)' }]}>
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <MenuButton />
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <SearchIcon size={20} color={colors.primaryLight} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: colors.primary, outlineStyle: 'none' } as any]}
            placeholder="Search"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setResults([]);
              }}
              style={{
                padding: 8,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
              }}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
        </View>
      </View>

      {renderSectionTitle()}

      {query.trim().length === 0 ? (
        activeTab === 'following' ? (
          <FlatList
            key="following-list"
            data={followingItems.slice(0, followingDisplayCount)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.userCard, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
                onPress={() => {
                  if (item.type === 'user') {
                    router.push(`/user/${item.id}`);
                  } else if (item.type === 'business') {
                    router.push(`/business/${item.id}`);
                  } else if (item.type === 'brand') {
                    router.push(`/brand/${item.id}`);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.userCardContent}>
                  {item.profileImage ? (
                    <Image
                      source={{ uri: item.profileImage }}
                      style={styles.userCardImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.userCardImagePlaceholder, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.userCardImageText, { color: colors.white }]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.userCardInfo}>
                    <Text style={[styles.userCardName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.userCardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.type === 'user' ? (item.location || 'User') : (item.category || item.type)}
                    </Text>
                    {item.description && (
                      <Text style={[styles.userCardBio, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={item => `${item.type}-${item.id}`}
            contentContainerStyle={[styles.userListContainer, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loadingFollowing ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <SearchIcon size={48} color={colors.primary} strokeWidth={1.5} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Not Following Anyone</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Follow users, businesses, and brands to see them here
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              followingItems.length > followingDisplayCount ? (
                <TouchableOpacity
                  style={[styles.showMoreButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => setFollowingDisplayCount(followingDisplayCount + 10)}
                >
                  <Text style={[styles.showMoreText, { color: colors.primary }]}>
                    Show More ({followingItems.length - followingDisplayCount} remaining)
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        ) : (
          <FlatList
            key="top-users-list"
            data={publicUsers}
            renderItem={renderUserCard}
            keyExtractor={item => item.id}
            contentContainerStyle={[styles.userListContainer, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loadingUsers ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <SearchIcon size={48} color={colors.primary} strokeWidth={1.5} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Users Yet</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Be one of the first to make your profile public!
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              !showAllUsers && publicUsers.length > 0 ? (
                <TouchableOpacity
                  style={[styles.showMoreButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={loadMoreUsers}
                  disabled={loadingMoreUsers}
                >
                  {loadingMoreUsers ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.showMoreText, { color: colors.primary }]}>Show More</Text>
                  )}
                </TouchableOpacity>
              ) : null
            }
          />
        )
      ) : showCreateForm ? (
        <ScrollView style={styles.createFormContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.createFormContent}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Create Business</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add a business that's not in our database yet
            </Text>
            <TextInput
              style={[styles.createFormInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
              placeholder="Business name *"
              placeholderTextColor={colors.textSecondary}
              value={createFormData.name}
              onChangeText={(text) => setCreateFormData({ ...createFormData, name: text })}
              autoFocus
            />
            <View style={[styles.createFormSelect, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={[styles.createFormSelectLabel, { color: createFormData.category ? colors.text : colors.textSecondary }]}>
                {createFormData.category ? CUSTOM_CATEGORIES.find(c => c.id === createFormData.category)?.label : 'Select category *'}
              </Text>
            </View>
            <View style={styles.createFormCategoryGrid}>
              {CUSTOM_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.createFormCategoryChip,
                    {
                      backgroundColor: createFormData.category === cat.id ? colors.primary : colors.backgroundSecondary,
                      borderColor: createFormData.category === cat.id ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setCreateFormData({ ...createFormData, category: cat.id })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.createFormCategoryChipText,
                    { color: createFormData.category === cat.id ? '#FFFFFF' : colors.text }
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.createFormInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
              placeholder="Website (optional)"
              placeholderTextColor={colors.textSecondary}
              value={createFormData.website}
              onChangeText={(text) => setCreateFormData({ ...createFormData, website: text })}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={[styles.createFormInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
              placeholder="Location (optional)"
              placeholderTextColor={colors.textSecondary}
              value={createFormData.location}
              onChangeText={(text) => setCreateFormData({ ...createFormData, location: text })}
            />
            <TextInput
              style={[styles.createFormInput, styles.createFormTextArea, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={createFormData.description}
              onChangeText={(text) => setCreateFormData({ ...createFormData, description: text })}
              multiline
              numberOfLines={3}
            />
            <View style={styles.createFormButtonRow}>
              <TouchableOpacity
                style={[styles.createFormCancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowCreateForm(false);
                  setCreateFormData({ name: query, category: '', description: '', website: '', location: '' });
                }}
              >
                <Text style={[styles.createFormCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createFormSubmitButton, { backgroundColor: showCreateSuccess ? '#22C55E' : colors.primary, opacity: isSubmittingCreate ? 0.6 : 1 }]}
                onPress={handleCreateBusiness}
                disabled={isSubmittingCreate || showCreateSuccess}
              >
                {showCreateSuccess ? (
                  <Check size={20} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text style={styles.createFormSubmitText}>
                    {isSubmittingCreate ? 'Creating...' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : results.length === 0 && placesResults.length === 0 && !loadingPlaces ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No results found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Try searching for a different product or brand
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setCreateFormData({ ...createFormData, name: query });
              setShowCreateForm(true);
            }}
          >
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
          <Text style={[styles.createSubtext, { color: colors.textSecondary }]}>
            Add this business to our database
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.searchResultsContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Database Results */}
          {results.length > 0 && (
            <View style={styles.searchResultsSection}>
              <Text style={[styles.searchResultsSectionTitle, { color: colors.textSecondary }]}>
                Results ({results.length})
              </Text>
              {results.map((item) => (
                <View key={item.id}>
                  {renderProduct({ item, index: 0 })}
                </View>
              ))}
            </View>
          )}

          {/* Google Places Results */}
          {loadingPlaces && (
            <View style={styles.searchResultsSection}>
              <Text style={[styles.searchResultsSectionTitle, { color: colors.textSecondary }]}>
                Searching all businesses...
              </Text>
            </View>
          )}

          {!loadingPlaces && placesResults.length > 0 && (
            <View style={styles.searchResultsSection}>
              <Text style={[styles.searchResultsSectionTitle, { color: colors.textSecondary }]}>
                All Businesses ({placesResults.length})
              </Text>
              {placesResults.map((place) => (
                <TouchableOpacity
                  key={place.placeId}
                  style={styles.placeResultItem}
                  onPress={() => router.push(`/place/${place.placeId}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.placeResultLogo}>
                    {/* Use app icon for all search results - photos load on detail page */}
                    <Image
                      source={require('@/assets/images/endorsing1.png')}
                      style={styles.placeResultLogoImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <View style={styles.placeResultText}>
                    <Text style={[styles.placeResultName, { color: colors.text }]} numberOfLines={2}>
                      {place.name}
                    </Text>
                    <Text style={[styles.placeResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                      {formatCategory(place.category)}{place.rating ? ` · ${place.rating}★` : ''}
                    </Text>
                    {place.address && (
                      <Text style={[styles.placeResultAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                        {place.address}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Create Button at bottom of results */}
          {query.trim() && !loadingPlaces && (
            <View style={styles.createButtonContainer}>
              <Text style={[styles.createButtonContainerText, { color: colors.textSecondary }]}>
                Can't find what you're looking for?
              </Text>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setCreateFormData({ ...createFormData, name: query });
                  setShowCreateForm(true);
                }}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Post Detail Modal */}
      <Modal
        visible={postModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPostModalVisible(false)}
      >
        <View style={styles.postModalOverlay}>
          <View style={[styles.postModalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.postModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.postModalTitle, { color: colors.text }]}>Post</Text>
              <TouchableOpacity onPress={() => setPostModalVisible(false)} activeOpacity={0.7}>
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {renderFullPost()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedProductId ? getProductInteraction(selectedProductId).comments : []}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={[styles.commentItem, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.commentUser, { color: colors.text }]}>{item.userName}</Text>
                  <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
                  <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                    {item.timestamp.toLocaleString()}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Text style={[styles.emptyCommentsText, { color: colors.textSecondary }]}>
                    No comments yet. Be the first to comment!
                  </Text>
                </View>
              }
              style={styles.commentsList}
            />

            <View style={[styles.commentInputContainer, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.commentInput, { color: colors.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textLight}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.commentSubmitButton,
                  { backgroundColor: commentText.trim() ? colors.primary : colors.neutralLight }
                ]}
                onPress={handleAddComment}
                disabled={!commentText.trim()}
                activeOpacity={0.7}
              >
                <Text style={[styles.commentSubmitText, { color: colors.white }]}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={handleCloseScanner}
      >
        <View style={styles.scannerContainer}>
          {!scannedProduct && !scannedInfo ? (
            <>
              <CameraView
                style={styles.camera}
                facing={'back' as CameraType}
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'qr',
                    'ean13',
                    'ean8',
                    'code128',
                    'code39',
                    'upc_a',
                    'upc_e',
                  ],
                }}
              >
                <View style={styles.scannerOverlay}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleCloseScanner}
                    activeOpacity={0.7}
                  >
                    <X size={24} color={colors.white} strokeWidth={2.5} />
                  </TouchableOpacity>

                  <View style={styles.scannerFrame}>
                    <View style={styles.scannerFrameCorner} />
                  </View>

                  <View style={styles.scannerTextContainer}>
                    <Text style={styles.scannerTitle}>
                      {lookingUp ? 'Looking Up Product...' : 'Scan Barcode'}
                    </Text>
                    <Text style={styles.scannerSubtitle}>
                      {lookingUp
                        ? 'Checking our database for brand information'
                        : 'Position the barcode within the frame'}
                    </Text>
                  </View>
                </View>
              </CameraView>
            </>
          ) : scannedProduct ? (
            <View style={[styles.resultContainer, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[styles.closeButton, styles.closeButtonResult]}
                onPress={handleCloseScanner}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.resultContent}>
                <View style={[styles.successBadge, { backgroundColor: Colors.success + '15' }]}>
                  <ScanBarcode size={32} color={Colors.success} strokeWidth={2} />
                </View>

                <Text style={[styles.resultTitle, { color: colors.text }]}>Product Found!</Text>

                <Image
                  source={{ uri: getLogoUrl(scannedProduct.website || '') }}
                  style={styles.resultImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />

                <Text style={[styles.resultBrand, { color: colors.primary }]}>
                  {scannedProduct.brand}
                </Text>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {scannedProduct.name}
                </Text>

                <View style={styles.alignmentContainer}>
                  {(() => {
                    const alignmentColor = getAlignmentColor(scannedProduct.alignmentScore);
                    const AlignmentIcon = getAlignmentIcon(scannedProduct.alignmentScore);
                    const alignmentLabel = getAlignmentLabel(scannedProduct.alignmentScore);

                    return (
                      <>
                        <View style={[styles.alignmentScore, { backgroundColor: alignmentColor + '15' }]}>
                          <AlignmentIcon size={24} color={alignmentColor} strokeWidth={2.5} />
                          <Text style={[styles.alignmentScoreText, { color: alignmentColor }]}>
                            {normalizeScore(scannedProduct.alignmentScore)}
                          </Text>
                        </View>
                        <Text style={[styles.alignmentLabel, { color: alignmentColor }]}>
                          {alignmentLabel}
                        </Text>
                      </>
                    );
                  })()}
                </View>

                <TouchableOpacity
                  style={[styles.viewDetailsButton, { backgroundColor: colors.primary }]}
                  onPress={handleViewScannedProduct}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.viewDetailsButtonText, { color: colors.white }]}>
                    View Details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scanAgainButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setScannedProduct(null);
                    setScanning(true);
                    setLookingUp(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scanAgainButtonText, { color: colors.text }]}>
                    Scan Another
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : scannedInfo ? (
            <View style={[styles.resultContainer, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[styles.closeButton, styles.closeButtonResult]}
                onPress={handleCloseScanner}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.resultContent}>
                <View style={[styles.successBadge, { backgroundColor: Colors.success + '15' }]}>
                  <ScanBarcode size={32} color={Colors.success} strokeWidth={2} />
                </View>

                <Text style={[styles.resultTitle, { color: colors.text }]}>Product Scanned!</Text>

                {scannedInfo.imageUrl && (
                  <Image
                    source={{ uri: scannedInfo.imageUrl }}
                    style={styles.resultImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                )}

                <Text style={[styles.resultBrand, { color: colors.primary }]}>
                  {scannedInfo.brandName}
                </Text>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {scannedInfo.productName}
                </Text>

                <View style={[styles.notInDbBadge, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
                  <Text style={[styles.notInDbText, { color: colors.warning }]}>
                    This brand is not in our values database yet
                  </Text>
                </View>

                <Text style={[styles.notInDbDescription, { color: colors.textSecondary }]}>
                  The barcode scanner is working correctly, but we don&apos;t have alignment information for this brand.
                </Text>

                <TouchableOpacity
                  style={[styles.scanAgainButton, { borderColor: colors.border, marginTop: 24 }]}
                  onPress={() => {
                    setScannedInfo(null);
                    setScanning(true);
                    setLookingUp(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scanAgainButtonText, { color: colors.text }]}>
                    Scan Another Product
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const { width } = Dimensions.get('window');
// Responsive grid: 3 columns on desktop (>768px), 2 columns on mobile
const isDesktop = width > 768;
const numColumns = isDesktop ? 3 : 2;
const maxGridWidth = Math.min(width, 900); // Max 900px for 3-column layout
const cardWidth = (maxGridWidth - (numColumns + 1) * 3) / numColumns; // Account for gaps

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stickyHeader: {
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 0 : 56,
    paddingBottom: 4,
  },
  headerLogo: {
    width: 161,
    height: 47,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    height: 56,
  },
  searchInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700' as const,
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    borderWidth: 0,
    outlineWidth: 0,
  },
  clearButton: {
    width: Platform.OS === 'web' ? 32 : 44, // Larger touch target on mobile
    height: Platform.OS === 'web' ? 32 : 44,
    borderRadius: Platform.OS === 'web' ? 16 : 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8, // Ensure spacing from input
  },

  // Explore Section
  exploreHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  exploreTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  exploreSubtitle: {
    fontSize: 14,
  },
  exploreGrid: {
    paddingHorizontal: 3,
    paddingTop: 0,
    alignSelf: 'center',
    maxWidth: 900,
    width: '100%',
  },
  exploreRow: {
    gap: 3,
  },
  exploreCard: {
    flex: 1,
    aspectRatio: 1,
    marginBottom: 3,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 0,
  },
  exploreCardImage: {
    width: '100%',
    height: '100%',
  },
  exploreCardOverlay: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
  },
  exploreCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exploreCardScore: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  exploreCardInfo: {
    padding: 8,
  },
  exploreCardBrand: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  exploreCardCategory: {
    fontSize: 11,
  },

  // Post Modal
  postModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  postModalContent: {
    minHeight: '70%',
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  postModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  postModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },

  // Full Post Styles
  postContainer: {
    paddingBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
  },
  brandAvatarImage: {
    width: '100%',
    height: '100%',
  },
  brandDetails: {
    flex: 1,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  brandCategory: {
    fontSize: 13,
  },
  postAlignmentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  postAlignmentScore: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  postImage: {
    width: '100%',
    height: 400,
  },
  alignmentReasonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alignmentReasonText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  visitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  visitButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  postContent: {
    paddingHorizontal: 16,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  descriptionContainer: {
    marginBottom: 8,
  },
  postProductName: {
    fontSize: 14,
    lineHeight: 20,
  },
  brandNameBold: {
    fontWeight: '600' as const,
  },
  viewCommentsText: {
    fontSize: 14,
  },

  // Comments Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  commentsList: {
    maxHeight: 400,
  },
  commentItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
  },
  emptyComments: {
    padding: 32,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 80,
  },
  commentSubmitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  commentSubmitText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },

  // Empty State & Search Results
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  showMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
  },
  showMoreText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Create button styles
  createButton: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createSubtext: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  createButtonContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginTop: 16,
  },
  createButtonContainerText: {
    fontSize: 14,
    marginBottom: 12,
  },

  // Create form styles
  createFormContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  createFormContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  createFormInput: {
    width: '100%',
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  createFormTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createFormSelect: {
    width: '100%',
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  createFormSelectLabel: {
    fontSize: 16,
  },
  createFormCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  createFormCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  createFormCategoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  createFormButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  createFormCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  createFormCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createFormSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createFormSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Search results styles
  searchResultsContainer: {
    flex: 1,
  },
  searchResultsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchResultsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Place result styles
  placeResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  placeResultLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  placeResultLogoImage: {
    width: 48,
    height: 48,
  },
  placeResultText: {
    flex: 1,
  },
  placeResultName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  placeResultCategory: {
    fontSize: 13,
  },
  placeResultAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: Platform.OS === 'web' ? 4 : 8,
    paddingTop: 4,
  },
  productCard: {
    borderRadius: 0,
    height: 64,
    overflow: 'visible',
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  productCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  productLogoContainer: {
    width: 64,
    height: 64,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  productLogo: {
    width: '100%',
    height: '100%',
  },
  productCardContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 11,
    opacity: 0.7,
    flexShrink: 1,
  },
  productScoreContainer: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productScore: {
    fontSize: 17,
    fontWeight: '700' as const,
  },

  // Barcode Scanner
  scannerContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    position: 'absolute' as const,
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonResult: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  scannerFrame: {
    position: 'absolute' as const,
    top: '30%',
    left: '10%',
    right: '10%',
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
  scannerFrameCorner: {
    position: 'absolute' as const,
    top: -2,
    left: -2,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#00ff88',
    borderTopLeftRadius: 12,
  },
  scannerTextContainer: {
    position: 'absolute' as const,
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  scannerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
  },
  resultContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 24,
  },
  resultImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginBottom: 24,
  },
  resultBrand: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  resultName: {
    fontSize: 22,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginBottom: 24,
  },
  alignmentContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  alignmentScore: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  alignmentScoreText: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  alignmentLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  viewDetailsButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewDetailsButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  scanAgainButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  scanAgainButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  notInDbBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 24,
    marginBottom: 12,
  },
  notInDbText: {
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  notInDbDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // User Cards
  userListContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  userCard: {
    borderRadius: 14,
    borderWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBusinessRank: {
    fontSize: 14,
    fontWeight: '600' as const,
    minWidth: 24,
    textAlign: 'center' as const,
  },
  topBusinessCard: {
    borderRadius: 14,
    borderWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  topBusinessCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBusinessImage: {
    width: 52,
    height: 52,
    borderRadius: 11,
  },
  topBusinessInfo: {
    flex: 1,
    gap: 3,
  },
  topBusinessName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  topBusinessCategory: {
    fontSize: 13,
  },
  topBusinessActionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCardImage: {
    width: 52,
    height: 52,
    borderRadius: 11,
  },
  userCardImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCardImageText: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  userCardInfo: {
    flex: 1,
    gap: 3,
  },
  userCardName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  userCardLocation: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  userCardBio: {
    fontSize: 13,
    lineHeight: 18,
  },
  userCardActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userActionDropdown: {
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
  userActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  userActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  userScoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  userScoreNumber: {
    fontSize: 12,
    fontWeight: '700' as const,
  },

  // Tab Selector
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 24,
    fontWeight: '600' as const,
  },
  activeTabText: {
    fontWeight: '700' as const,
  },

  // Value Machine
  valueMachineContainer: {
    flex: 1,
  },
  valueMachineHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  valueMachineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  valueMachineTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  valueMachineSubtitle: {
    fontSize: 13,
    marginTop: 0,
  },
  resetButton: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  categoryDropdownContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  categoryDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryDropdownText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  categoryContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  valuesPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  valuePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  valuePillText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  resultsModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'hidden',
    gap: 8,
  },
  resultsModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resultsModeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  generateContainer: {
    padding: 16,
    paddingTop: 24,
    alignItems: 'center',
  },
  generateButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  selectedCount: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadMoreButton: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  loadMoreText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },

  // List-style results
  resultListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  resultListImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resultListImage: {
    width: '100%',
    height: '100%',
  },
  resultListInfo: {
    flex: 1,
  },
  resultListBrand: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  resultListName: {
    fontSize: 13,
  },
  resultListScore: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultListScoreText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  categoryDropdownOverlay: {
    flex: 1,
  },
  categoryDropdownMenu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  categoryDropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  categoryDropdownItemText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },

  // Posts Feed Styles
  postsFeedContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 16,
    gap: 8,
  },
  createPostButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 15,
  },
  emptyPostsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyPostsTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  emptyPostsSubtitle: {
    fontSize: 15,
    textAlign: 'center' as const,
    paddingHorizontal: 24,
  },
  postCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  postCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  postAuthorImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  postAuthorImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAuthorInitial: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  postAuthorDetails: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  postTimestamp: {
    fontSize: 13,
  },
  businessBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  businessBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postMainImage: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 0,
  },
  postCaption: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  textOnlyPostBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  textOnlyPostContent: {
    fontSize: 17,
    lineHeight: 26,
  },
  linkedEntityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  linkedEntityImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  linkedEntityInfo: {
    flex: 1,
  },
  linkedEntityType: {
    fontSize: 12,
    marginBottom: 2,
  },
  linkedEntityName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 20,
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postActionText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },

  // Create Post Modal Styles - Centered
  createPostModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  createPostModalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  createPostModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  createPostModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  createPostModalBody: {
    padding: 16,
  },
  createPostAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  createPostAuthorImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  createPostAuthorImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPostAuthorInitial: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  createPostAuthorName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  createPostImageContainer: {
    position: 'relative',
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createPostImagePreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    marginVertical: 16,
    paddingVertical: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addImageText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  createPostTextOnlyInput: {
    minHeight: 180,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 18,
    lineHeight: 28,
    marginTop: 8,
  },
  createPostCaptionInput: {
    minHeight: 80,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  characterCount: {
    fontSize: 13,
    textAlign: 'right' as const,
    marginTop: 8,
    marginBottom: 8,
  },
  createPostModalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
