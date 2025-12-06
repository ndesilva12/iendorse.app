import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  TextInput,
  ActivityIndicator,
  Share as RNShare,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp, Heart, Building2, Users, Globe, Shield, User as UserIcon, Tag, Trophy, Target, MapPin, Plus, UserPlus, UserMinus, Share2, Search, X, MoreVertical, ChevronRight } from 'lucide-react-native';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import MenuButton from '@/components/MenuButton';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { Product, UserProfile } from '@/types';
import { getAllUserBusinesses, BusinessUser } from '@/services/firebase/businessService';
import { getLogoUrl } from '@/lib/logo';
import LocalBusinessView from '@/components/Library/LocalBusinessView';
import { getTopBrands } from '@/services/firebase/topRankingsService';
import { useLibrary } from '@/contexts/LibraryContext';
import { followEntity, unfollowEntity, isFollowing as checkIsFollowing, getFollowing } from '@/services/firebase/followService';
import { addEntryToList, removeEntryFromList, copyListToLibrary, getEndorsementList } from '@/services/firebase/listService';
import ItemOptionsModal from '@/components/ItemOptionsModal';
import { useReferralCode } from '@/hooks/useReferralCode';
import { appendReferralTracking } from '@/services/firebase/referralService';
import { searchPlaces, PlaceSearchResult, formatCategory } from '@/services/firebase/placesService';
import { getAllPublicUsers } from '@/services/firebase/userService';
import { searchProducts } from '@/mocks/products';

// ===== Types =====
type BrowseSection = 'global' | 'local' | 'values' | 'users' | 'following' | 'search';

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

const CATEGORY_ICONS: Record<string, any> = {
  social_issue: Heart,
  religion: Building2,
  ideology: Users,
  corporation: Building2,
  nation: Globe,
  organization: Shield,
  person: UserIcon,
  sports: Trophy,
  lifestyle: Heart,
};

const CATEGORY_LABELS: Record<string, string> = {
  social_issue: 'Social Issues',
  religion: 'Religion',
  ideology: 'Ideology',
  corporation: 'Corporations',
  nation: 'Places',
  nations: 'Places',
  places: 'Places',
  organization: 'Organizations',
  person: 'People',
  people: 'People',
  sports: 'Sports',
  lifestyle: 'Lifestyle',
};

// Normalize category names to handle case variations and synonyms
const normalizeCategory = (category: string): string => {
  const lower = category.toLowerCase().trim();
  if (lower === 'person' || lower === 'people') return 'person';
  if (lower === 'social_issue' || lower === 'social issues') return 'social_issue';
  if (lower === 'nation' || lower === 'nations' || lower === 'places') return 'nation';
  return lower;
};

// Define category display order
const CATEGORY_ORDER = [
  'ideology',
  'social_issue',
  'person',
  'lifestyle',
  'nation',
  'religion',
  'organization',
  'sports',
];

// Helper to get category icon, with fallback
const getCategoryIcon = (category: string) => {
  const normalized = normalizeCategory(category);
  return CATEGORY_ICONS[normalized] || Tag;
};

// Helper to get category label, with fallback
const getCategoryLabel = (category: string) => {
  const normalized = normalizeCategory(category);
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
  return category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function BrowseScreen() {
  const router = useRouter();
  // Note: addCauses/removeCauses removed - values no longer associated with users
  const { profile, isDarkMode, clerkUser } = useUser();
  const { brands, valuesMatrix, values: firebaseValues } = useData();
  const library = useLibrary();
  const colors = isDarkMode ? darkColors : lightColors;
  const { referralCode } = useReferralCode();

  // Section state
  const [selectedSection, setSelectedSection] = useState<BrowseSection>('global');

  // Values tab state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Global section state
  const [globalLoadCount, setGlobalLoadCount] = useState(10);
  const [followedBrands, setFollowedBrands] = useState<Set<string>>(new Set());

  // Item options modal state
  const [showItemOptionsModal, setShowItemOptionsModal] = useState(false);
  const [selectedBrandForOptions, setSelectedBrandForOptions] = useState<Product | null>(null);

  // Local section state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userBusinesses, setUserBusinesses] = useState<BusinessUser[]>([]);

  // Local search state
  const [showLocalSearch, setShowLocalSearch] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localSearchResults, setLocalSearchResults] = useState<PlaceSearchResult[]>([]);
  const [loadingLocalSearch, setLoadingLocalSearch] = useState(false);
  const localSearchDebounce = useRef<NodeJS.Timeout | null>(null);

  // Top brands for when user has no causes (order by endorsements)
  const [topBrandsData, setTopBrandsData] = useState<Map<string, number>>(new Map());
  const [loadingTopBrands, setLoadingTopBrands] = useState(true);

  // Users section state
  const [publicUsers, setPublicUsers] = useState<{ id: string; profile: UserProfile }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersDisplayCount, setUsersDisplayCount] = useState(10);

  // Following section state
  const [followingItems, setFollowingItems] = useState<FollowingItem[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [followingDisplayCount, setFollowingDisplayCount] = useState(10);

  // Search section state (matching explore tab functionality)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [placesResults, setPlacesResults] = useState<PlaceSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const searchDebounce = useRef<NodeJS.Timeout | null>(null);
  const placesSearchDebounce = useRef<NodeJS.Timeout | null>(null);

  // Fetch user businesses
  const fetchUserBusinesses = useCallback(async () => {
    try {
      const businesses = await getAllUserBusinesses();
      setUserBusinesses(businesses);
    } catch (error) {
      console.error('[Browse] Error fetching user businesses:', error);
    }
  }, []);

  useEffect(() => {
    fetchUserBusinesses();
  }, [fetchUserBusinesses]);

  // Fetch top brands for endorsement-based ordering (always fetch - values feature removed)
  useEffect(() => {
    const fetchTopBrandsForOrdering = async () => {
      setLoadingTopBrands(true);
      try {
        const topBrands = await getTopBrands(200);
        const endorsementMap = new Map<string, number>();
        topBrands.forEach((item) => {
          // Use the score as endorsement ranking (higher score = more endorsements)
          endorsementMap.set(item.id, item.score);
        });
        setTopBrandsData(endorsementMap);
      } catch (error) {
        console.error('[Browse] Error fetching top brands:', error);
      } finally {
        setLoadingTopBrands(false);
      }
    };
    fetchTopBrandsForOrdering();
  }, []);

  // Auto-fetch location on mount if permission already granted
  useEffect(() => {
    const checkAndGetLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('[Browse] Error auto-fetching location:', error);
      }
    };
    checkAndGetLocation();
  }, []);

  // Fetch public users for Users section
  useEffect(() => {
    const fetchPublicUsers = async () => {
      setLoadingUsers(true);
      try {
        const users = await getAllPublicUsers(50);
        setPublicUsers(users);
      } catch (error) {
        console.error('[Browse] Error fetching public users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchPublicUsers();
  }, []);

  // Fetch following items when Following section is selected
  useEffect(() => {
    const fetchFollowingItems = async () => {
      if (!clerkUser?.id || selectedSection !== 'following') return;

      setLoadingFollowing(true);
      try {
        const following = await getFollowing(clerkUser.id);
        const items: FollowingItem[] = [];
        const staleFollows: Array<{ id: string; type: 'user' | 'brand' | 'business' }> = [];

        for (const item of following) {
          // Use followedType and followedId (not entityType/entityId)
          if (item.followedType === 'user') {
            // Find user in publicUsers
            const user = publicUsers.find(u => u.id === item.followedId);
            if (user) {
              items.push({
                id: item.followedId,
                type: 'user',
                name: user.profile.userDetails?.name || 'User',
                description: user.profile.userDetails?.description,
                profileImage: user.profile.userDetails?.profileImage,
                location: user.profile.userDetails?.location,
              });
            } else {
              // User not found - mark for cleanup
              staleFollows.push({ id: item.followedId, type: 'user' });
            }
          } else if (item.followedType === 'business') {
            const business = userBusinesses.find(b => b.id === item.followedId);
            if (business) {
              items.push({
                id: item.followedId,
                type: 'business',
                name: business.businessInfo.name,
                description: business.businessInfo.description,
                profileImage: business.businessInfo.logoUrl,
                location: business.businessInfo.location,
                category: business.businessInfo.category,
              });
            } else {
              // Business not found - mark for cleanup
              staleFollows.push({ id: item.followedId, type: 'business' });
            }
          } else if (item.followedType === 'brand') {
            const brand = brands?.find(b => b.id === item.followedId);
            if (brand) {
              items.push({
                id: item.followedId,
                type: 'brand',
                name: brand.name,
                description: brand.description,
                profileImage: brand.exampleImageUrl,
                category: brand.category,
                website: brand.website,
              });
            } else {
              // Brand not found - mark for cleanup
              staleFollows.push({ id: item.followedId, type: 'brand' });
            }
          }
        }

        setFollowingItems(items);

        // Clean up stale follow records in background (entities that no longer exist)
        if (staleFollows.length > 0) {
          console.log('[Browse] Cleaning up', staleFollows.length, 'stale follow records');
          for (const stale of staleFollows) {
            try {
              await unfollowEntity(clerkUser.id, stale.id, stale.type);
            } catch (err) {
              console.error('[Browse] Error cleaning up stale follow:', err);
            }
          }
        }
      } catch (error) {
        console.error('[Browse] Error fetching following:', error);
      } finally {
        setLoadingFollowing(false);
      }
    };

    fetchFollowingItems();
  }, [clerkUser?.id, selectedSection, publicUsers, userBusinesses, brands]);

  // Handle search - matching explore tab functionality exactly
  const handleSearch = useCallback((text: string) => {
    try {
      setSearchQuery(text);

      if (text.trim().length > 0) {
        // Note: user values removed - pass empty array for neutral search
        const userCauseIds: string[] = [];
        const productResults = searchProducts(text, userCauseIds);

        // Search Firebase businesses
        const businessResults = userBusinesses
          .filter(business => {
            const searchLower = text.toLowerCase();
            return (
              business.businessInfo.name.toLowerCase().includes(searchLower) ||
              business.businessInfo.category.toLowerCase().includes(searchLower) ||
              business.businessInfo.location?.toLowerCase().includes(searchLower) ||
              business.businessInfo.description?.toLowerCase().includes(searchLower)
            );
          })
          .map(business => ({
            id: `firebase-business-${business.id}`,
            firebaseId: business.id,
            name: business.businessInfo.name,
            brand: business.businessInfo.name,
            category: business.businessInfo.category,
            description: business.businessInfo.description || '',
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
            isFirebaseBusiness: true,
          } as Product & { firebaseId: string; isFirebaseBusiness: boolean }));

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
            userId: user.id,
            name: user.profile.userDetails?.name || 'User',
            brand: user.profile.userDetails?.name || 'User',
            category: 'User',
            description: user.profile.userDetails?.description || '',
            exampleImageUrl: user.profile.userDetails?.profileImage || '',
            website: user.profile.userDetails?.website || '',
            location: user.profile.userDetails?.location || '',
            valueAlignments: [],
            keyReasons: ['User profile'],
            moneyFlow: { company: '', shareholders: [], overallAlignment: 0 },
            relatedValues: [],
            isUser: true,
          } as Product & { userId: string; isUser: boolean }));

        // Search Firebase brands (from DataContext)
        const brandResults = (brands || [])
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
            brandId: brand.id,
            name: brand.name,
            brand: brand.name,
            category: brand.category || 'Brand',
            description: brand.description || '',
            exampleImageUrl: brand.exampleImageUrl || (brand.website ? getLogoUrl(brand.website) : ''),
            website: brand.website || '',
            location: brand.location || '',
            valueAlignments: [],
            keyReasons: [brand.category ? `Category: ${brand.category}` : 'Brand'],
            moneyFlow: { company: brand.name, shareholders: [], overallAlignment: 0 },
            relatedValues: [],
            isFirebaseBrand: true,
          } as Product & { brandId: string; isFirebaseBrand: boolean }));

        // Combine product, business, brand, and user results
        const combinedResults = [...(productResults || []), ...businessResults, ...brandResults, ...userResults];
        setSearchResults(combinedResults);

        // Also search Google Places with debouncing
        if (placesSearchDebounce.current) {
          clearTimeout(placesSearchDebounce.current);
        }
        placesSearchDebounce.current = setTimeout(async () => {
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
      } else {
        setSearchResults([]);
        setPlacesResults([]);
        if (placesSearchDebounce.current) {
          clearTimeout(placesSearchDebounce.current);
        }
      }
    } catch (error) {
      console.error('Error during search:', error);
      setSearchResults([]);
      setPlacesResults([]);
    }
  }, [publicUsers, userBusinesses, brands]);

  // Request location permission
  const requestLocation = async () => {
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
      }

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to see local recommendations.',
          [{ text: 'OK' }]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('[Browse] Error getting location:', error);
      Alert.alert('Error', 'Could not get your location. Please try again.');
    }
  };

  // Auto-fetch location on mount if permission is already granted
  useEffect(() => {
    const checkAndFetchLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted' && !userLocation) {
          console.log('[Browse] Location permission already granted, fetching location...');
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          console.log('[Browse] ✅ Auto-fetched location');
        }
      } catch (error) {
        console.error('[Browse] Error auto-fetching location:', error);
      }
    };
    checkAndFetchLocation();
  }, []);

  // Brand action handlers
  const handleEndorseBrand = async (brandId: string, brandName: string) => {
    console.log('[Browse] handleEndorseBrand called:', brandId, brandName);
    console.log('[Browse] clerkUser?.id:', clerkUser?.id);
    if (!clerkUser?.id) {
      console.log('[Browse] No clerkUser.id - returning early');
      return;
    }

    try {
      // Find the endorsement list
      console.log('[Browse] library?.state?.userLists:', library?.state?.userLists?.length, 'lists');
      if (!library?.state?.userLists) {
        console.log('[Browse] No userLists - showing alert');
        Alert.alert('Error', 'Library not loaded yet. Please try again.');
        return;
      }
      const endorsementList = library.state.userLists.find(list => list.isEndorsed);
      console.log('[Browse] endorsementList:', endorsementList?.id);
      if (!endorsementList) {
        console.log('[Browse] No endorsement list found');
        Alert.alert('Error', 'Could not find endorsement list');
        return;
      }

      // Check if already endorsed
      const existingEntry = endorsementList.entries.find(
        (e: any) => e.type === 'brand' && e.brandId === brandId
      );
      console.log('[Browse] existingEntry:', existingEntry);

      if (existingEntry) {
        console.log('[Browse] Already endorsed');
        Alert.alert('Already Endorsed', `${brandName} is already in your endorsements`);
        return;
      }

      // Find the brand to get all info
      const brand = brands?.find(b => b.id === brandId);
      console.log('[Browse] Found brand:', brand?.name);

      // Add to endorsement list with all relevant data
      console.log('[Browse] Calling addEntryToList...');
      await addEntryToList(endorsementList.id, {
        type: 'brand',
        brandId: brandId,
        brandName: brandName,
        name: brandName,
        website: brand?.website || '',
        logoUrl: brand?.exampleImageUrl || getLogoUrl(brand?.website || ''),
      });
      console.log('[Browse] addEntryToList completed');

      // Reload the library to reflect changes (force refresh)
      console.log('[Browse] Reloading library...');
      await library.loadUserLists(clerkUser.id, true);
      console.log('[Browse] Library reloaded');

      Alert.alert('Success', `${brandName} added to endorsements`);
      console.log('[Browse] Success alert shown');
    } catch (error) {
      console.error('[Browse] Error endorsing brand:', error);
      Alert.alert('Error', 'Failed to endorse brand');
    }
  };

  const handleUnendorseBrand = async (brandId: string, brandName: string) => {
    if (!clerkUser?.id) return;

    try {
      // Find the endorsement list
      if (!library?.state?.userLists) {
        Alert.alert('Error', 'Library not loaded yet. Please try again.');
        return;
      }
      const endorsementList = library.state.userLists.find(list => list.isEndorsed);
      if (!endorsementList) {
        Alert.alert('Error', 'Could not find endorsement list');
        return;
      }

      // Find the entry for this brand
      const entry = endorsementList.entries.find(
        (e: any) => e.type === 'brand' && e.brandId === brandId
      );

      if (!entry) {
        Alert.alert('Not Endorsed', `${brandName} is not in your endorsements`);
        return;
      }

      // Remove the entry
      await removeEntryFromList(endorsementList.id, entry.id);

      // Reload the library to reflect changes (force refresh)
      await library.loadUserLists(clerkUser.id, true);

      Alert.alert('Success', `${brandName} removed from endorsements`);
    } catch (error) {
      console.error('Error removing brand from endorsements:', error);
      Alert.alert('Error', 'Failed to remove brand from endorsements');
    }
  };

  const handleFollowBrand = async (brandId: string, brandName: string) => {
    console.log('[Browse] handleFollowBrand called:', brandId, brandName);
    if (!clerkUser?.id) return;

    const isCurrentlyFollowing = followedBrands.has(brandId);

    try {
      if (isCurrentlyFollowing) {
        await unfollowEntity(clerkUser.id, brandId, 'brand');
        setFollowedBrands(prev => {
          const newSet = new Set(prev);
          newSet.delete(brandId);
          return newSet;
        });
        Alert.alert('Success', `Unfollowed ${brandName}`);
      } else {
        await followEntity(clerkUser.id, brandId, 'brand');
        setFollowedBrands(prev => new Set(prev).add(brandId));
        Alert.alert('Success', `Now following ${brandName}`);
      }
    } catch (error) {
      console.error('Error following/unfollowing brand:', error);
      Alert.alert('Error', `Failed to ${isCurrentlyFollowing ? 'unfollow' : 'follow'} brand`);
    }
  };

  // Check follow status when modal opens
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!selectedBrandForOptions || !clerkUser?.id) return;
      try {
        const isFollowing = await checkIsFollowing(clerkUser.id, selectedBrandForOptions.id, 'brand');
        if (isFollowing) {
          setFollowedBrands(prev => new Set(prev).add(selectedBrandForOptions.id));
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
    checkFollowStatus();
  }, [selectedBrandForOptions, clerkUser?.id]);

  const handleShareBrand = (brandId: string, brandName: string) => {
    console.log('[Browse] handleShareBrand called:', brandId, brandName);
    const baseUrl = `https://iendorse.app/brand/${brandId}`;
    const shareUrl = appendReferralTracking(baseUrl, referralCode);
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(shareUrl);
      Alert.alert('Success', 'Link copied to clipboard');
    } else {
      Alert.alert('Share', 'Share functionality coming soon');
    }
  };

  // Handle local search
  const handleLocalSearch = useCallback((text: string) => {
    setLocalSearchQuery(text);

    // Clear existing timeout
    if (localSearchDebounce.current) {
      clearTimeout(localSearchDebounce.current);
    }

    if (!text.trim() || text.trim().length < 2) {
      setLocalSearchResults([]);
      setLoadingLocalSearch(false);
      return;
    }

    // Debounce the search
    setLoadingLocalSearch(true);
    localSearchDebounce.current = setTimeout(async () => {
      try {
        const locationParam = userLocation
          ? { lat: userLocation.latitude, lng: userLocation.longitude }
          : undefined;
        const places = await searchPlaces(text.trim(), locationParam);
        setLocalSearchResults(places);
      } catch (error) {
        console.error('[Browse] Error searching places:', error);
        setLocalSearchResults([]);
      } finally {
        setLoadingLocalSearch(false);
      }
    }, 500);
  }, [userLocation]);

  // Handle closing local search
  const handleCloseLocalSearch = useCallback(() => {
    setShowLocalSearch(false);
    setLocalSearchQuery('');
    setLocalSearchResults([]);
    if (localSearchDebounce.current) {
      clearTimeout(localSearchDebounce.current);
    }
  }, []);

  // Check if brand is endorsed
  const isBrandEndorsed = (brandId: string): boolean => {
    if (!library?.state?.userLists) return false;
    const endorsementList = library.state.userLists.find(list => list.isEndorsed);
    if (!endorsementList) return false;
    return endorsementList.entries?.some(
      (e: any) => e && e.type === 'brand' && e.brandId === brandId
    ) || false;
  };

  // Compute brand rankings for Global section - always order by endorsements
  const { allSupport } = useMemo(() => {
    const currentBrands = brands || [];

    if (!currentBrands || currentBrands.length === 0) {
      return {
        allSupport: [],
      };
    }

    // Sort by endorsement score (higher = more endorsed)
    const sortedByEndorsements = [...currentBrands].sort((a, b) => {
      const scoreA = topBrandsData.get(a.id) || 0;
      const scoreB = topBrandsData.get(b.id) || 0;
      return scoreB - scoreA;
    });

    // Return top 50 brands by endorsements
    const topBrands = sortedByEndorsements.slice(0, 50);

    return {
      allSupport: topBrands,
    };
  }, [brands, topBrandsData]);

  // Transform Firebase values into the format expected by the UI
  const availableValues = useMemo(() => {
    const valuesByCategory: Record<string, any[]> = {};

    firebaseValues.forEach(value => {
      const normalizedCategory = normalizeCategory(value.category || 'other');
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
  }, [firebaseValues]);

  // Note: user values removed - values are just for browsing brands, not associated with user profiles
  // All values are now "unselected" from user perspective
  const unselectedValuesByCategory: Record<string, any[]> = {};
  Object.keys(availableValues).forEach(category => {
    const values = availableValues[category] || [];
    unselectedValuesByCategory[category] = values;
  });

  const allCategories = Object.keys(unselectedValuesByCategory);
  const knownCategories = CATEGORY_ORDER.filter(cat => allCategories.includes(cat));
  const unknownCategories = allCategories.filter(cat => !CATEGORY_ORDER.includes(cat)).sort();
  const sortedCategories = [...knownCategories, ...unknownCategories];

  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Note: user values removed - all values are now just for browsing, not user-associated
  const getValueState = (valueId: string): 'unselected' | 'support' | 'avoid' => {
    // Values are no longer associated with users - always return unselected
    return 'unselected';
  };

  // Note: savePendingChanges and useFocusEffect removed - values no longer associated with users

  const handleValueTap = (valueId: string) => {
    router.push(`/value/${valueId}`);
  };

  // Section colors
  const sectionColors: Record<BrowseSection, { bg: string; border: string }> = {
    global: { bg: colors.primary + '15', border: colors.primary },
    local: { bg: colors.success + '15', border: colors.success },
    values: { bg: colors.danger + '15', border: colors.danger },
    users: { bg: '#ADFF2F' + '15', border: '#ADFF2F' }, // neon lime green
    following: { bg: '#ADFF2F' + '15', border: '#ADFF2F' }, // neon lime green
    search: { bg: '#FFFFFF' + '15', border: '#FFFFFF' }, // white
  };

  // Render section blocks
  const renderSectionBlocks = () => {
    const SectionBox = ({ section, label, Icon }: { section: BrowseSection; label: string; Icon: any }) => {
      const isSelected = selectedSection === section;
      const sectionColor = sectionColors[section];

      return (
        <TouchableOpacity
          style={[
            styles.sectionBoxCompact,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: isSelected ? sectionColor.border : colors.border,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
          onPress={() => setSelectedSection(section)}
          activeOpacity={0.7}
        >
          <Icon size={22} color={isSelected ? sectionColor.border : colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.sectionLabelCompact, { color: isSelected ? sectionColor.border : colors.text }]} numberOfLines={1}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.sectionSelector}>
        {/* First row: Global, Local, Values */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionThird}>
            <SectionBox section="global" label="Global" Icon={Target} />
          </View>
          <View style={styles.sectionThird}>
            <SectionBox section="local" label="Local" Icon={MapPin} />
          </View>
          <View style={styles.sectionThird}>
            <SectionBox section="values" label="Values" Icon={Heart} />
          </View>
        </View>
        {/* Second row: Users, Following, Search */}
        <View style={[styles.sectionRow, { marginTop: 8 }]}>
          <View style={styles.sectionThird}>
            <SectionBox section="users" label="Users" Icon={Users} />
          </View>
          <View style={styles.sectionThird}>
            <SectionBox section="following" label="Following" Icon={UserPlus} />
          </View>
          <View style={styles.sectionThird}>
            <SectionBox section="search" label="Search" Icon={Search} />
          </View>
        </View>
      </View>
    );
  };

  // Render sticky section header
  const renderSectionHeader = () => {
    const titles: Record<BrowseSection, string> = {
      global: 'Top Brands',
      local: 'Local',
      values: 'Browse by Values',
      users: 'Top Users',
      following: 'Following',
      search: 'Search',
    };

    const icons: Record<BrowseSection, any> = {
      global: Target,
      local: MapPin,
      values: Heart,
      users: Users,
      following: UserPlus,
      search: Search,
    };

    const SectionIcon = icons[selectedSection];
    const title = titles[selectedSection];

    // Don't show header for search section (search bar is integrated in content)
    if (selectedSection === 'search') {
      return null;
    }

    return (
      <View style={[styles.stickyHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.stickyHeaderLeft}>
          <SectionIcon size={20} color={sectionColors[selectedSection].border} strokeWidth={2} />
          <Text style={[styles.stickyHeaderTitle, { color: colors.text }]}>{title}</Text>
        </View>

        {/* Local section - Search/Add button */}
        {selectedSection === 'local' && !showLocalSearch && (
          <TouchableOpacity
            style={[styles.searchIconButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowLocalSearch(true)}
            activeOpacity={0.7}
          >
            <Search size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render brand card for Global section (matching Local list style)
  const renderBrandCard = (brand: Product, index: number, showRank: boolean = false) => {
    return (
      <View key={brand.id} style={{ position: 'relative', marginBottom: 4 }}>
        <TouchableOpacity
          style={[
            styles.brandCard,
            { backgroundColor: 'transparent' },
          ]}
          onPress={() => router.push(`/brand/${brand.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.brandCardInner}>
            {/* Rank number */}
            {showRank && (
              <View style={styles.rankContainer}>
                <Text style={[styles.rankNumber, { color: colors.textSecondary }]}>
                  {index + 1}
                </Text>
              </View>
            )}
            <View style={styles.brandLogoContainer}>
              <Image
                source={{ uri: brand.exampleImageUrl || getLogoUrl(brand.website) }}
                style={styles.brandLogo}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            </View>
            <View style={styles.brandCardContent}>
              <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={2}>
                {brand.name}
              </Text>
              <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                {brand.category || 'Brand'}
              </Text>
            </View>
            {/* Action Menu Button - Opens Modal */}
            <TouchableOpacity
              style={styles.actionMenuButton}
              onPress={(e) => {
                e.stopPropagation();
                console.log('[Browse] Opening options modal for brand:', brand.name);
                setSelectedBrandForOptions(brand);
                setShowItemOptionsModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.plusIconCircle, { backgroundColor: colors.primary }]}>
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Global content
  const renderGlobalContent = () => {
    // Show loading spinner while fetching top brands data
    if (loadingTopBrands) {
      return (
        <View style={styles.loadingSection}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
            Loading top brands...
          </Text>
        </View>
      );
    }

    // Use allSupport which contains top brands ordered by endorsements
    const items = allSupport;

    if (items.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Target size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptySectionTitle, { color: colors.text }]}>No brands yet</Text>
          <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
            Check back later for top endorsed brands
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.brandList}>
        {items.slice(0, globalLoadCount).map((brand, index) => renderBrandCard(brand, index, true))}

        {items.length > globalLoadCount && (
          <TouchableOpacity
            style={[styles.loadMoreButton, { borderColor: colors.border }]}
            onPress={() => setGlobalLoadCount(globalLoadCount + 10)}
            activeOpacity={0.7}
          >
            <Text style={[styles.loadMoreText, { color: colors.primary }]}>
              Load More ({items.length - globalLoadCount} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Local content
  const renderLocalContent = () => {
    return (
      <View>
        {/* Search Bar - shown when search is active */}
        {showLocalSearch && (
          <View style={[styles.localSearchContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.localSearchBar, { backgroundColor: colors.backgroundSecondary, borderColor: 'transparent' }]}>
              <Search size={20} color={colors.primary} strokeWidth={2} />
              <TextInput
                style={[styles.localSearchInput, { color: colors.primary }]}
                placeholder="Search local businesses..."
                placeholderTextColor={colors.primary + '80'}
                value={localSearchQuery}
                onChangeText={handleLocalSearch}
                autoFocus
                returnKeyType="search"
              />
              {localSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleLocalSearch('')} activeOpacity={0.7}>
                  <X size={20} color={colors.primary} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.localSearchCloseButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={handleCloseLocalSearch}
              activeOpacity={0.7}
            >
              <Text style={[styles.localSearchCloseText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Results - shown when searching */}
        {showLocalSearch && localSearchQuery.trim().length >= 2 && (
          <View style={styles.localSearchResults}>
            {loadingLocalSearch && (
              <View style={styles.localSearchLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.localSearchLoadingText, { color: colors.textSecondary }]}>
                  Searching...
                </Text>
              </View>
            )}

            {!loadingLocalSearch && localSearchResults.length > 0 && (
              <View>
                <Text style={[styles.localSearchResultsTitle, { color: colors.textSecondary }]}>
                  Results ({localSearchResults.length})
                </Text>
                {localSearchResults.map((place) => (
                  <TouchableOpacity
                    key={place.placeId}
                    style={[styles.localSearchResultItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      handleCloseLocalSearch();
                      router.push(`/place/${place.placeId}`);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.localSearchResultLogo, { backgroundColor: colors.backgroundSecondary }]}>
                      <Image
                        source={require('@/assets/images/endorsing1.png')}
                        style={styles.localSearchResultLogoImage}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    </View>
                    <View style={styles.localSearchResultText}>
                      <Text style={[styles.localSearchResultName, { color: colors.text }]} numberOfLines={2}>
                        {place.name}
                      </Text>
                      <Text style={[styles.localSearchResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                        {formatCategory(place.category)}{place.rating ? ` · ${place.rating}★` : ''}
                      </Text>
                      {place.address && (
                        <Text style={[styles.localSearchResultAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                          {place.address}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!loadingLocalSearch && localSearchResults.length === 0 && localSearchQuery.trim().length >= 2 && (
              <View style={styles.localSearchEmpty}>
                <Text style={[styles.localSearchEmptyText, { color: colors.textSecondary }]}>
                  No businesses found for "{localSearchQuery}"
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Regular local content - hidden during active search with results */}
        {(!showLocalSearch || localSearchQuery.trim().length < 2) && (
          <LocalBusinessView
            userBusinesses={userBusinesses}
            userLocation={userLocation}
            userCauses={[]}
            isDarkMode={isDarkMode}
            onRequestLocation={requestLocation}
          />
        )}
      </View>
    );
  };

  // Render Values content - shows all values organized by category for browsing
  const renderValuesContent = () => {
    // Get all values organized by category
    const allValuesByCategory: Record<string, any[]> = {};
    Object.keys(availableValues).forEach(category => {
      const values = availableValues[category] || [];
      if (values.length > 0) {
        allValuesByCategory[category] = values;
      }
    });

    const allCategories = Object.keys(allValuesByCategory);
    const knownCats = CATEGORY_ORDER.filter(cat => allCategories.includes(cat));
    const unknownCats = allCategories.filter(cat => !CATEGORY_ORDER.includes(cat)).sort();
    const orderedCategories = [...knownCats, ...unknownCats];

    return (
      <View style={styles.valuesContent}>
        <Text style={[styles.valueHintText, { color: colors.textSecondary }]}>
          Tap any value to see related brands
        </Text>

        {/* All Values Section */}
        <View style={styles.section}>
          {orderedCategories.map((category) => {
            const values = allValuesByCategory[category];
            if (!values || values.length === 0) return null;

            const Icon = getCategoryIcon(category);
            const isExpanded = expandedCategories.has(category as CauseCategory);

            return (
              <View key={category} style={styles.categorySection}>
                <TouchableOpacity
                  style={[styles.collapsibleCategoryHeader, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => toggleCategoryExpanded(category)}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryHeaderLeft}>
                    <Icon size={18} color={colors.textSecondary} strokeWidth={2} />
                    <Text style={[styles.categoryTitle, { color: colors.text }]}>
                      {getCategoryLabel(category)}
                    </Text>
                    <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                      ({values.length})
                    </Text>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={20} color={colors.textSecondary} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={20} color={colors.textSecondary} strokeWidth={2} />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.valuesGrid, styles.expandedValuesGrid]}>
                    {values.map(value => (
                      <TouchableOpacity
                        key={value.id}
                        style={[
                          styles.valueChip,
                          styles.unselectedValueChip,
                          { borderColor: colors.border, backgroundColor: 'transparent' }
                        ]}
                        onPress={() => handleValueTap(value.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.valueChipText,
                            { color: colors.text }
                          ]}
                          numberOfLines={1}
                        >
                          {value.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Handle search result item press - matching explore tab
  const handleSearchItemPress = (item: any) => {
    if (item.isUser && item.userId) {
      router.push(`/user/${item.userId}`);
    } else if (item.isFirebaseBusiness && item.firebaseId) {
      router.push(`/business/${item.firebaseId}`);
    } else if (item.isFirebaseBrand && item.brandId) {
      router.push(`/brand/${item.brandId}`);
    } else if (item.id) {
      // Regular product/brand
      router.push(`/brand/${item.id}`);
    }
  };

  // Render Users content (Top Users) - matching explore tab
  const renderUsersContent = () => {
    if (loadingUsers) {
      return (
        <View style={styles.loadingSection}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
            Loading users...
          </Text>
        </View>
      );
    }

    if (publicUsers.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Users size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptySectionTitle, { color: colors.text }]}>No Users Yet</Text>
          <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
            Be one of the first to make your profile public!
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.usersList}>
        {publicUsers.slice(0, usersDisplayCount).map((user) => (
          <TouchableOpacity
            key={user.id}
            style={styles.userCard}
            onPress={() => router.push(`/user/${user.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.userCardContent}>
              {user.profile.userDetails?.profileImage ? (
                <Image
                  source={{ uri: user.profile.userDetails.profileImage }}
                  style={styles.userCardImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.userCardImagePlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.userCardImageText, { color: colors.white }]}>
                    {(user.profile.userDetails?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userCardInfo}>
                <Text style={[styles.userCardName, { color: colors.text }]} numberOfLines={1}>
                  {user.profile.userDetails?.name || 'User'}
                </Text>
                <Text style={[styles.userCardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                  {user.profile.userDetails?.location || 'User'}
                </Text>
                {user.profile.userDetails?.description && (
                  <Text style={[styles.userCardBio, { color: colors.textSecondary }]} numberOfLines={2}>
                    {user.profile.userDetails.description}
                  </Text>
                )}
              </View>
              <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        ))}

        {publicUsers.length > usersDisplayCount && (
          <TouchableOpacity
            style={[styles.loadMoreButton, { borderColor: colors.border }]}
            onPress={() => setUsersDisplayCount(usersDisplayCount + 10)}
            activeOpacity={0.7}
          >
            <Text style={[styles.loadMoreText, { color: colors.primary }]}>
              Show More ({publicUsers.length - usersDisplayCount} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Following content - matching explore tab
  const renderFollowingContent = () => {
    if (loadingFollowing) {
      return (
        <View style={styles.loadingSection}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
            Loading...
          </Text>
        </View>
      );
    }

    if (followingItems.length === 0) {
      return (
        <View style={styles.emptySection}>
          <UserPlus size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptySectionTitle, { color: colors.text }]}>Not Following Anyone</Text>
          <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
            Follow users, businesses, and brands to see them here
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.usersList}>
        {followingItems.slice(0, followingDisplayCount).map((item) => (
          <TouchableOpacity
            key={`${item.type}-${item.id}`}
            style={styles.userCard}
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
                <View style={[styles.userCardImage, item.type !== 'user' && { backgroundColor: '#FFFFFF' }]}>
                  <Image
                    source={{ uri: item.profileImage }}
                    style={styles.userCardImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                </View>
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
              <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        ))}

        {followingItems.length > followingDisplayCount && (
          <TouchableOpacity
            style={[styles.loadMoreButton, { borderColor: colors.border }]}
            onPress={() => setFollowingDisplayCount(followingDisplayCount + 10)}
            activeOpacity={0.7}
          >
            <Text style={[styles.loadMoreText, { color: colors.primary }]}>
              Show More ({followingItems.length - followingDisplayCount} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Search content - matching explore tab exactly
  const renderSearchContent = () => {
    return (
      <View style={styles.searchSection}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Search size={22} color={colors.primary} strokeWidth={2} />
            <TextInput
              style={[styles.searchInput, { color: colors.primary, outlineStyle: 'none' } as any]}
              placeholder="Search"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setPlacesResults([]);
                }}
                style={{ padding: 8 }}
                activeOpacity={0.7}
              >
                <X size={22} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results */}
        {searchQuery.trim().length === 0 ? (
          <View style={styles.emptySection}>
            <Search size={48} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={[styles.emptySectionTitle, { color: colors.text }]}>Search</Text>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              Search for users, businesses, and brands
            </Text>
          </View>
        ) : searchResults.length === 0 && placesResults.length === 0 && !loadingPlaces ? (
          <View style={styles.emptySection}>
            <Text style={[styles.emptySectionTitle, { color: colors.text }]}>No results found</Text>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              Try searching for a different product or brand
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.searchResultsScroll} showsVerticalScrollIndicator={false}>
            {/* Database Results */}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsSection}>
                <Text style={[styles.searchResultsSectionTitle, { color: colors.textSecondary }]}>
                  Results ({searchResults.length})
                </Text>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.searchResultItem}
                    onPress={() => handleSearchItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultInner}>
                      <View style={[styles.searchResultLogo, { backgroundColor: '#FFFFFF' }]}>
                        {item.exampleImageUrl ? (
                          <Image
                            source={{ uri: item.exampleImageUrl }}
                            style={styles.searchResultLogoImage}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View style={[styles.searchResultLogoPlaceholder, { backgroundColor: colors.primary }]}>
                            <Text style={styles.searchResultLogoText}>
                              {item.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.searchResultText}>
                        <Text style={[styles.searchResultName, { color: colors.text }]} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={[styles.searchResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.brand || item.category || 'Brand'}
                        </Text>
                      </View>
                      <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                    </View>
                  </TouchableOpacity>
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
                    style={styles.searchResultItem}
                    onPress={() => router.push(`/place/${place.placeId}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultInner}>
                      <View style={[styles.searchResultLogo, { backgroundColor: colors.backgroundSecondary }]}>
                        <Image
                          source={require('@/assets/images/endorsing1.png')}
                          style={styles.searchResultLogoImage}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
                      </View>
                      <View style={styles.searchResultText}>
                        <Text style={[styles.searchResultName, { color: colors.text }]} numberOfLines={2}>
                          {place.name}
                        </Text>
                        <Text style={[styles.searchResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                          {formatCategory(place.category)}{place.rating ? ` · ${place.rating}★` : ''}
                        </Text>
                        {place.address && (
                          <Text style={[styles.searchResultAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                            {place.address}
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  // Render section content based on selection
  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'global':
        return renderGlobalContent();
      case 'local':
        return renderLocalContent();
      case 'values':
        return renderValuesContent();
      case 'users':
        return renderUsersContent();
      case 'following':
        return renderFollowingContent();
      case 'search':
        return renderSearchContent();
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Main header */}
      <View style={[styles.mainHeaderContainer, { backgroundColor: colors.background, borderBottomColor: 'rgba(0, 0, 0, 0.05)' }]}>
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
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Section blocks */}
        {renderSectionBlocks()}

        {/* Sticky section header */}
        {renderSectionHeader()}

        {/* Section content */}
        {renderSectionContent()}
      </ScrollView>

      {/* Item Options Modal */}
      {selectedBrandForOptions && (
        <ItemOptionsModal
          visible={showItemOptionsModal}
          onClose={() => {
            setShowItemOptionsModal(false);
            setSelectedBrandForOptions(null);
          }}
          itemName={selectedBrandForOptions.name}
          isDarkMode={isDarkMode}
          options={[
            {
              icon: Heart,
              label: isBrandEndorsed(selectedBrandForOptions.id) ? 'Unendorse' : 'Endorse',
              onPress: () => {
                console.log('[Browse] Endorse option pressed');
                const brand = selectedBrandForOptions;
                if (isBrandEndorsed(brand.id)) {
                  handleUnendorseBrand(brand.id, brand.name);
                } else {
                  handleEndorseBrand(brand.id, brand.name);
                }
              },
            },
            {
              icon: followedBrands.has(selectedBrandForOptions.id) ? UserMinus : UserPlus,
              label: followedBrands.has(selectedBrandForOptions.id) ? 'Unfollow' : 'Follow',
              onPress: () => {
                console.log('[Browse] Follow option pressed');
                handleFollowBrand(selectedBrandForOptions.id, selectedBrandForOptions.name);
              },
            },
            {
              icon: Share2,
              label: 'Share',
              onPress: () => {
                console.log('[Browse] Share option pressed');
                handleShareBrand(selectedBrandForOptions.id, selectedBrandForOptions.name);
              },
            },
          ]}
        />
      )}
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
    paddingBottom: 20,
  },
  mainHeaderContainer: {
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

  // Section selector styles
  sectionSelector: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionThird: {
    flex: 1,
  },
  sectionBox: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  // Compact section box styles (2/3 size)
  sectionBoxCompact: {
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 60,
  },
  sectionBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLabelCompact: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sectionCountCompact: {
    fontSize: 10,
    fontWeight: '500' as const,
  },

  // Sticky header styles
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stickyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stickyHeaderTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  globalToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  globalToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  globalToggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  updateValuesButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  updateValuesButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  searchIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Brand card styles (matching Local list style)
  brandList: {
    paddingHorizontal: Platform.OS === 'web' ? 4 : 8,
    paddingTop: 4,
    overflow: 'visible',
  },
  brandCard: {
    borderRadius: 0,
    height: 64,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  brandCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  rankContainer: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  brandLogoContainer: {
    width: 64,
    height: 64,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandCardContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  brandCategory: {
    fontSize: 11,
    opacity: 0.7,
    flexShrink: 1,
  },
  brandScoreContainer: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandScore: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  actionMenuButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },

  // Empty section styles
  emptySection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptySectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySectionText: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
  },

  // Loading section styles
  loadingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center' as const,
  },

  // Values content styles
  valuesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  valueHintText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valueChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  unselectedValueChip: {
    borderWidth: 1.5,
  },
  unselectedValueText: {
    fontWeight: '500' as const,
  },
  expandedValuesGrid: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  categorySection: {
    marginBottom: 20,
  },
  collapsibleCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center' as const,
  },
  infoSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Local search styles
  localSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  localSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0,
    gap: 8,
  },
  localSearchInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600' as const,
    padding: 0,
    margin: 0,
  },
  localSearchCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  localSearchCloseText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  localSearchResults: {
    paddingHorizontal: 16,
  },
  localSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  localSearchLoadingText: {
    fontSize: 14,
  },
  localSearchResultsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
  },
  localSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  localSearchResultLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  localSearchResultLogoImage: {
    width: '100%',
    height: '100%',
  },
  localSearchResultText: {
    flex: 1,
  },
  localSearchResultName: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  localSearchResultCategory: {
    fontSize: 13,
    marginBottom: 2,
  },
  localSearchResultAddress: {
    fontSize: 12,
  },
  localSearchEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  localSearchEmptyText: {
    fontSize: 14,
    textAlign: 'center' as const,
  },

  // Users list styles
  usersList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  userCard: {
    marginBottom: 8,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  userCardImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  userCardImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCardImageText: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  userCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  userCardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  userCardLocation: {
    fontSize: 13,
    marginBottom: 2,
  },
  userCardBio: {
    fontSize: 12,
    lineHeight: 16,
  },

  // Search section styles
  searchSection: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 0,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600' as const,
    padding: 0,
    margin: 0,
  },
  searchResultsScroll: {
    flex: 1,
    paddingBottom: 100,
  },
  searchResultsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchResultsSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
  },
  searchResultItem: {
    marginBottom: 4,
  },
  searchResultInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  searchResultLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultLogoImage: {
    width: '100%',
    height: '100%',
  },
  searchResultLogoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  searchResultLogoText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  searchResultText: {
    flex: 1,
    minWidth: 0,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  searchResultCategory: {
    fontSize: 13,
    marginBottom: 2,
  },
  searchResultAddress: {
    fontSize: 12,
  },
});
