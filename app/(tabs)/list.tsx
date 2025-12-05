import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ArrowLeft,
  Target,
  FolderOpen,
  MapPin,
  Fuel,
  Utensils,
  Coffee,
  ShoppingCart,
  Tv,
  Smartphone,
  Shield,
  Car,
  Laptop,
  Store,
  DollarSign,
  Shirt,
  X,
  Plus,
  List,
  Trash2,
  Edit,
  Search,
  MoreVertical,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Share2,
  Globe,
  Lock,
  User,
  UserPlus,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  PanResponder,
  StatusBar,
  Alert,
  Modal,
  Dimensions,
  TextInput,
  Pressable,
  TouchableWithoutFeedback,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import * as Clipboard from 'expo-clipboard';
import MenuButton from '@/components/MenuButton';
import ShareModal from '@/components/ShareModal';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { Product } from '@/types';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useIsStandalone } from '@/hooks/useIsStandalone';
import { trpc } from '@/lib/trpc';
import { LOCAL_BUSINESSES } from '@/mocks/local-businesses';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVAILABLE_VALUES } from '@/mocks/causes';
import { getLogoUrl } from '@/lib/logo';
import { calculateDistance, formatDistance } from '@/lib/distance';
import { calculateBrandScore, calculateSimilarityScore, normalizeBrandScores, normalizeSimilarityScores, normalizeBusinessScoresWithBrands } from '@/lib/scoring';
import { getAllUserBusinesses, isBusinessWithinRange, BusinessUser } from '@/services/firebase/businessService';
import { followEntity, unfollowEntity, isFollowing, getFollowingCount, getFollowersCount, getFollowing, getFollowers, Follow } from '@/services/firebase/followService';
import { getUserProfile } from '@/services/firebase/userService';
import { getBrandById } from '@/services/firebase/dataService';
import BusinessMapView from '@/components/BusinessMapView';
import { UserList, ListEntry, ValueListMode } from '@/types/library';
import { getUserLists, createList, deleteList, addEntryToList, removeEntryFromList, updateListMetadata, reorderListEntries, getEndorsementList, ensureEndorsementList } from '@/services/firebase/listService';
import { useReferralCode } from '@/hooks/useReferralCode';
import { submitBrandRequest } from '@/services/firebase/brandRequestService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { UnifiedLibrary } from '@/components/Library';
import { useLibrary } from '@/contexts/LibraryContext';

type MainView = 'forYou' | 'myLibrary' | 'local';
type ForYouSubsection = 'userList' | 'aligned' | 'unaligned';
type LocalDistanceOption = 1 | 5 | 10 | 25 | 50 | 100 | null;

type FolderCategory = {
  id: string;
  name: string;
  Icon: LucideIcon;
};

const FOLDER_CATEGORIES: FolderCategory[] = [
  { id: 'gas', name: 'Gas & Energy', Icon: Fuel },
  { id: 'fast-food', name: 'Fast Food', Icon: Coffee },
  { id: 'restaurants', name: 'Restaurants', Icon: Utensils },
  { id: 'groceries', name: 'Groceries', Icon: ShoppingCart },
  { id: 'streaming', name: 'Streaming', Icon: Tv },
  { id: 'social-media', name: 'Social Media', Icon: Smartphone },
  { id: 'insurance', name: 'Insurance', Icon: Shield },
  { id: 'vehicles', name: 'Vehicles', Icon: Car },
  { id: 'technology', name: 'Technology', Icon: Laptop },
  { id: 'retail', name: 'Retail', Icon: Store },
  { id: 'financial', name: 'Financial Services', Icon: DollarSign },
  { id: 'fashion', name: 'Fashion', Icon: Shirt },
];

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile, isDarkMode, clerkUser, markIntroAsSeen, isLoading: isProfileLoading } = useUser();
  const library = useLibrary();
  const colors = isDarkMode ? darkColors : lightColors;
  const insets = useSafeAreaInsets();
  const { referralCode } = useReferralCode();
  const [mainView, setMainView] = useState<MainView>('myLibrary');
  const [forYouSubsection, setForYouSubsection] = useState<ForYouSubsection>('aligned');
  const [userPersonalList, setUserPersonalList] = useState<UserList | null>(null);
  const [activeExplainerStep, setActiveExplainerStep] = useState<0 | 1 | 2 | 3 | 4>(0); // 0 = none, 1-4 = explainer steps
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [showAllAligned, setShowAllAligned] = useState<boolean>(false);
  const [showAllLeast, setShowAllLeast] = useState<boolean>(false);
  const [alignedLoadCount, setAlignedLoadCount] = useState<number>(10);
  const [unalignedLoadCount, setUnalignedLoadCount] = useState<number>(10);
  const [myListLoadCount, setMyListLoadCount] = useState<number>(10);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'following' | 'followers'>('following');
  const [followingList, setFollowingList] = useState<Array<{ id: string; name: string; profileImage?: string; location?: string; type: 'user' | 'brand' | 'business' }>>([]);
  const [followersList, setFollowersList] = useState<Array<{ id: string; name: string; profileImage?: string; location?: string }>>([]);
  const [isLoadingFollowData, setIsLoadingFollowData] = useState(false);
  const [followersSearchQuery, setFollowersSearchQuery] = useState('');
  const [localDistance, setLocalDistance] = useState<LocalDistanceOption>(null);
  const [userBusinesses, setUserBusinesses] = useState<BusinessUser[]>([]);
  const [showMapModal, setShowMapModal] = useState(false);
  const [localSortDirection, setLocalSortDirection] = useState<'highToLow' | 'lowToHigh'>('highToLow');

  // Library state
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [expandedListId, setExpandedListId] = useState<string | null>(null); // 'endorsement', 'aligned', 'unaligned', or custom list ID
  const [selectedListId, setSelectedListId] = useState<string | null>(null); // Track which list is highlighted/selected
  const [hasSetDefaultExpansion, setHasSetDefaultExpansion] = useState(false); // Track if we've set default expansion
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [libraryView, setLibraryView] = useState<'overview' | 'detail'>('overview');
  const [selectedList, setSelectedList] = useState<UserList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [showListOptionsMenu, setShowListOptionsMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameListName, setRenameListName] = useState('');
  const [renameListDescription, setRenameListDescription] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [alignedListPublic, setAlignedListPublic] = useState(false);
  const [unalignedListPublic, setUnalignedListPublic] = useState(false);
  const [activeListOptionsId, setActiveListOptionsId] = useState<string | null>(null); // Track which list's options menu is open
  const [isLibraryEditMode, setIsLibraryEditMode] = useState(false);
  const [activeOptionsMenu, setActiveOptionsMenu] = useState<string | null>(null);
  const [activeItemOptionsMenu, setActiveItemOptionsMenu] = useState<string | null>(null);
  const [showEditDropdown, setShowEditDropdown] = useState(false);
  const [showListCreationTypeModal, setShowListCreationTypeModal] = useState(false);
  const [showNewListChoiceModal, setShowNewListChoiceModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [descriptionText, setDescriptionText] = useState('');
  const [showValuesSelectionModal, setShowValuesSelectionModal] = useState(false);
  const [selectedValuesForList, setSelectedValuesForList] = useState<Array<{ id: string; type: 'support' | 'avoid' }>>([]);
  const [valuesListName, setValuesListName] = useState('');
  const [valuesListDescription, setValuesListDescription] = useState('');

  // Quick-add state
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddItem, setQuickAddItem] = useState<{type: 'brand' | 'business' | 'value', id: string, name: string, website?: string, logoUrl?: string} | null>(null);
  const [selectedValueMode, setSelectedValueMode] = useState<ValueListMode | null>(null);
  const [showValueModeModal, setShowValueModeModal] = useState(false);

  // Add Item Modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showMyListOptionsModal, setShowMyListOptionsModal] = useState(false);
  const [addItemType, setAddItemType] = useState<'brand' | 'business' | 'value' | 'link' | 'text' | null>(null);
  const [addItemSearchQuery, setAddItemSearchQuery] = useState('');
  const [showAddItemRequest, setShowAddItemRequest] = useState(false);
  const [addItemRequestInput, setAddItemRequestInput] = useState('');
  const [showAddItemRequestSuccess, setShowAddItemRequestSuccess] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // Library reorder and card options state
  const [isLibraryReorderMode, setIsLibraryReorderMode] = useState(false);
  const [isMyListReorderMode, setIsMyListReorderMode] = useState(false);
  const [activeCardOptionsMenu, setActiveCardOptionsMenu] = useState<string | null>(null);
  const [showCardRenameModal, setShowCardRenameModal] = useState(false);
  const [cardRenameListId, setCardRenameListId] = useState<string | null>(null);
  const [cardRenameListName, setCardRenameListName] = useState('');
  const [cardRenameListDescription, setCardRenameListDescription] = useState('');

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; title: string; description?: string } | null>(null);

  // Card Action Menu state
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);
  const [cardMenuData, setCardMenuData] = useState<{ type: 'brand' | 'business', id: string, name: string, website?: string, logoUrl?: string, listId?: string } | null>(null);
  const [isFollowingCard, setIsFollowingCard] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // CRITICAL: Force mainView to myLibrary immediately on mount
  useEffect(() => {
    console.log('[HomeScreen] Forcing mainView to myLibrary on mount');
    setMainView('myLibrary');
  }, []);

  // Set up library view for first-time users
  useEffect(() => {
    // Don't run until profile is loaded to avoid race conditions
    if (isProfileLoading) return;

    // Set up the library view for first-time users
    if (clerkUser && profile.causes && profile.causes.length > 0 && profile.hasSeenIntro === false) {
      console.log('[HomeScreen] First time user, setting up aligned list view');
      setMainView('myLibrary');
      setExpandedListId('aligned');
      setSelectedListId('aligned');
      setLibraryView('detail');
      markIntroAsSeen();
    } else if (clerkUser && profile.hasSeenIntro === undefined) {
      // For existing users without this flag, mark as seen immediately and ensure library view
      console.log('[HomeScreen] Existing user, marking intro as seen and ensuring library view');
      markIntroAsSeen();
      setMainView('myLibrary');
    }
  }, [clerkUser, profile.causes, profile.hasSeenIntro, markIntroAsSeen, isProfileLoading]);

  // Fetch brands and values from Firebase via DataContext
  const { brands, values, valuesMatrix, isLoading, error } = useData();

  // Helper function to get brand website from brands array
  const getBrandWebsite = (brandId: string): string | undefined => {
    const brand = brands?.find(b => b.id === brandId);
    return brand?.website;
  };

  // Helper function to get brand name from brands array
  const getBrandName = (brandId: string): string => {
    const brand = brands?.find(b => b.id === brandId);
    return brand?.name || 'Unknown Brand';
  };

  // Helper function to get business name from businesses array
  const getBusinessName = (businessId: string): string => {
    const business = userBusinesses?.find(b => b.id === businessId);
    return business?.businessInfo?.name || 'Unknown Business';
  };

  // Helper function to get card background color based on position
  const getEntryCardBackgroundColor = (index: number): string => {
    if (index < 5) {
      // Top 5: Success/aligned color
      return colors.successLight;
    } else if (index < 10) {
      // 6-10: Neutral/secondary color
      return colors.neutralLight;
    }
    // 11+: Normal background
    return colors.backgroundSecondary;
  };

  // Drag-and-drop sensors for list reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag only after moving 8px (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event for list reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !selectedList) {
      return;
    }

    const list = selectedList;
    const oldIndex = list.entries.findIndex((entry) => entry.id === active.id);
    const newIndex = list.entries.findIndex((entry) => entry.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder locally first for immediate feedback
    const newEntries = arrayMove(list.entries, oldIndex, newIndex);
    setSelectedList({ ...list, entries: newEntries });

    // Save to Firebase
    try {
      await reorderListEntries(list.id, newEntries);
      // Reload lists to sync
      await loadUserLists();
      await reloadPersonalList();
    } catch (error) {
      console.error('[Home] Error reordering entries:', error);
      // Revert on error
      setSelectedList(list);
      
      
      Alert.alert('Error', 'Could not reorder items. Please try again.');
    }
  };

  // Request location permission and get user's location
  const requestLocation = async () => {
    try {
      console.log('[Home] Requesting location...');

      // Check if permission is already granted
      let { status } = await Location.getForegroundPermissionsAsync();
      console.log('[Home] Current permission status:', status);

      // If not granted, request permission
      if (status !== 'granted') {
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
        console.log('[Home] Permission request result:', status);
      }

      if (status !== 'granted') {
        console.log('[Home] ❌ Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to filter brands by distance.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('[Home] ✅ Permission granted, getting location...');
      const location = await Location.getCurrentPositionAsync({});
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(newLocation);
      console.log('[Home] ✅ Got location:', newLocation);
    } catch (error) {
      console.error('[Home] ❌ Error getting location:', error);
      Alert.alert('Error', 'Could not get your location. Please try again.');
    }
  };

  // Load user's personal list on mount and set default view
  useEffect(() => {
    const loadPersonalList = async () => {
      if (!clerkUser?.id) return;

      try {
        const lists = await getUserLists(clerkUser.id);

        // Try multiple sources to get the user's full name (prioritize Firebase data for existing users)
        const fullNameFromClerk = clerkUser?.unsafeMetadata?.fullName as string;
        const fullNameFromFirebase = profile?.userDetails?.name;
        const firstNameLastName = clerkUser?.firstName && clerkUser?.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : '';
        const firstName = clerkUser?.firstName;

        const userName = fullNameFromFirebase || fullNameFromClerk || firstNameLastName || firstName || 'My List';

        console.log('[Home] Looking for personal list with name:', userName);
        console.log('[Home] Available lists:', lists.map(l => l.name));

        // Try to find list by exact name match first
        let personalList = lists.find(list => list.name === userName);

        // If not found by name, use the oldest list (first created) as the personal list
        // This ensures we don't create duplicates when user names change or are fetched differently
        if (!personalList && lists.length > 0) {
          // Sort by creation date and take the oldest
          const sortedByAge = [...lists].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          personalList = sortedByAge[0];
          console.log('[Home] Using oldest list as personal list:', personalList.name);
        }

        // Only create a new list if user has NO lists at all
        if (!personalList) {
          console.log('[Home] No lists found, creating personal list...');
          try {
            const newListId = await createList(clerkUser.id, userName, 'Your personal collection of favorite businesses.', userName);
            // Reload lists to get the newly created one
            const updatedLists = await getUserLists(clerkUser.id);
            personalList = updatedLists.find(list => list.id === newListId);
            console.log('[Home] ✅ Personal list created:', newListId);
          } catch (createError) {
            console.error('[Home] ❌ Failed to create personal list:', createError);
          }
        }

        if (personalList) {
          setUserPersonalList(personalList);

          const hasEntries = personalList.entries && personalList.entries.length > 0;

          // Carousel only shows as part of onboarding flow (via hasSeenIntro === false)
          setActiveExplainerStep(0);

          // If personal list has entries, default to it. Otherwise, default to aligned.
          if (hasEntries) {
            setForYouSubsection('userList');
          }
        } else {
          console.log('[Home] ⚠️ Could not find or create personal list');
        }
      } catch (error) {
        console.error('[Home] Error loading personal list:', error);
      }
    };

    loadPersonalList();
  }, [clerkUser?.id, clerkUser?.unsafeMetadata?.fullName, clerkUser?.firstName, clerkUser?.lastName, profile?.userDetails?.name]);

  // Function to fetch user businesses
  const fetchUserBusinesses = useCallback(async () => {
    try {
      console.log('[Home] Fetching user businesses');
      const businesses = await getAllUserBusinesses();
      console.log('[Home] Fetched user businesses:', businesses.length);
      setUserBusinesses(businesses);
    } catch (error) {
      console.error('[Home] Error fetching user businesses:', error);
    }
  }, []);

  // Load following and followers counts
  useEffect(() => {
    const loadFollowCounts = async () => {
      if (!clerkUser?.id) return;

      try {
        const [following, followers] = await Promise.all([
          getFollowingCount(clerkUser.id),
          getFollowersCount(clerkUser.id, 'user')
        ]);
        setFollowingCount(following);
        setFollowersCount(followers);
      } catch (error) {
        console.error('[Home] Error loading follow counts:', error);
      }
    };

    loadFollowCounts();
  }, [clerkUser?.id]);

  // Load followers/following data for modal
  const loadFollowersData = async (tab: 'following' | 'followers') => {
    if (!clerkUser?.id) return;

    setIsLoadingFollowData(true);
    try {
      if (tab === 'following') {
        const follows = await getFollowing(clerkUser.id);
        const followingData: Array<{ id: string; name: string; profileImage?: string; location?: string; type: 'user' | 'brand' | 'business' }> = [];

        for (const follow of follows) {
          if (follow.followedType === 'user') {
            const userProfile = await getUserProfile(follow.followedId);
            if (userProfile) {
              followingData.push({
                id: follow.followedId,
                name: userProfile.userDetails?.name || userProfile.fullName || 'Unknown',
                profileImage: userProfile.userDetails?.profileImage,
                location: userProfile.userDetails?.location,
                type: 'user',
              });
            }
          } else if (follow.followedType === 'brand') {
            // Check if brand exists in database
            const brand = await getBrandById(follow.followedId);
            if (brand) {
              followingData.push({
                id: follow.followedId,
                name: brand.name || follow.followedId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type: 'brand',
              });
            }
          } else if (follow.followedType === 'business') {
            // Check if business exists (businesses are users with accountType='business')
            const businessProfile = await getUserProfile(follow.followedId);
            if (businessProfile && businessProfile.accountType === 'business') {
              followingData.push({
                id: follow.followedId,
                name: businessProfile.businessInfo?.name || 'Unknown Business',
                profileImage: businessProfile.businessInfo?.logoUrl,
                location: businessProfile.businessInfo?.location ?
                  `${businessProfile.businessInfo.location.city || ''}, ${businessProfile.businessInfo.location.state || ''}`.replace(/^, |, $/g, '') :
                  undefined,
                type: 'business',
              });
            }
          }
        }
        setFollowingList(followingData);
      } else {
        const follows = await getFollowers(clerkUser.id, 'user');
        const followerData: Array<{ id: string; name: string; profileImage?: string; location?: string }> = [];

        for (const follow of follows) {
          const userProfile = await getUserProfile(follow.followerId);
          if (userProfile) {
            followerData.push({
              id: follow.followerId,
              name: userProfile.userDetails?.name || userProfile.fullName || 'Unknown',
              profileImage: userProfile.userDetails?.profileImage,
              location: userProfile.userDetails?.location,
            });
          }
        }
        setFollowersList(followerData);
      }
    } catch (error) {
      console.error('[Home] Error loading follow data:', error);
    } finally {
      setIsLoadingFollowData(false);
    }
  };

  // Open followers modal
  const openFollowersModal = (tab: 'following' | 'followers') => {
    setFollowersModalTab(tab);
    setShowFollowersModal(true);
    loadFollowersData(tab);
  };

  // Fetch user businesses on mount
  useEffect(() => {
    fetchUserBusinesses();
  }, [fetchUserBusinesses]);

  // Reopen map if returning from business detail page
  useEffect(() => {
    if (params.fromMap === 'true') {
      // Clear the parameter and reopen the map
      router.setParams({ fromMap: undefined });
      setShowMapModal(true);
      // Ensure local view is active
      if (mainView !== 'local') {
        setMainView('local');
      }
    }
  }, [params.fromMap]);

  // Load system list privacy settings from profile
  useEffect(() => {
    if (profile) {
      setAlignedListPublic(profile.alignedListPublic || false);
      setUnalignedListPublic(profile.unalignedListPublic || false);
    }
  }, [profile]);

  const loadUserLists = useCallback(async () => {
    if (!clerkUser?.id) return;

    setIsLoadingLists(true);
    try {
      // Ensure endorsement list exists for user
      const fullNameFromFirebase = profile?.userDetails?.name;
      const fullNameFromClerk = clerkUser?.unsafeMetadata?.fullName as string;
      const firstNameLastName = clerkUser?.firstName && clerkUser?.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : '';
      const firstName = clerkUser?.firstName;
      const userName = fullNameFromFirebase || fullNameFromClerk || firstNameLastName || firstName || 'My Endorsements';

      await ensureEndorsementList(clerkUser.id, userName);

      // Load all lists
      const lists = await getUserLists(clerkUser.id);
      setUserLists(lists);
    } catch (error) {
      console.error('[Home] Error loading user lists:', error);
      Alert.alert('Error', 'Could not load your lists. Please try again.');
    } finally {
      setIsLoadingLists(false);
    }
  }, [clerkUser?.id, profile?.userDetails?.name, clerkUser?.unsafeMetadata?.fullName, clerkUser?.firstName, clerkUser?.lastName]);

  // Fetch user lists when library view is activated
  useEffect(() => {
    if ((mainView === 'myLibrary' || mainView === 'forYou') && clerkUser?.id) {
      loadUserLists();
    }
    // Reset to overview when leaving library
    if (mainView !== 'myLibrary') {
      setLibraryView('overview');
      setSelectedList(null);
    }
  }, [mainView, clerkUser?.id, loadUserLists]);

  // Reload personal list (used in For You view)
  const reloadPersonalList = async () => {
    if (!clerkUser?.id) return;

    try {
      const lists = await getUserLists(clerkUser.id);

      // Get user's full name to find their personal list
      const fullNameFromFirebase = profile?.userDetails?.name;
      const fullNameFromClerk = clerkUser?.unsafeMetadata?.fullName as string;
      const firstNameLastName = clerkUser?.firstName && clerkUser?.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : '';
      const firstName = clerkUser?.firstName;
      const userName = fullNameFromFirebase || fullNameFromClerk || firstNameLastName || firstName || 'My List';

      const personalList = lists.find(list => list.name === userName);
      if (personalList) {
        setUserPersonalList(personalList);
        console.log('[Home] ✅ Personal list reloaded');
      }
    } catch (error) {
      console.error('[Home] Error reloading personal list:', error);
    }
  };

  // Set default expanded/selected list when library loads (only once)
  useEffect(() => {
    const handleDefaultLibraryState = async () => {
      if (mainView === 'myLibrary' && !hasSetDefaultExpansion && userPersonalList && clerkUser?.id) {
        const firstTimeKey = `firstTimeLibraryVisit_${clerkUser.id}`;
        const isFirstTime = await AsyncStorage.getItem(firstTimeKey);

        if (isFirstTime === null) {
          // First time: expand aligned list
          setExpandedListId('aligned');
          setSelectedListId('aligned');
          await AsyncStorage.setItem(firstTimeKey, 'false'); // Mark as visited
        } else {
          // Not first time: select (highlight) endorsed list but keep collapsed
          setExpandedListId(null);
          setSelectedListId('endorsement');
        }
        setHasSetDefaultExpansion(true);
      }
    };
    handleDefaultLibraryState();
  }, [mainView, userPersonalList, hasSetDefaultExpansion, clerkUser?.id]);

  // Check follow status when card menu opens
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!cardMenuData || !clerkUser?.id) {
        setIsFollowingCard(false);
        return;
      }

      try {
        const entityType = cardMenuData.type === 'brand' ? 'brand' : 'business';
        const following = await isFollowing(clerkUser.id, cardMenuData.id, entityType);
        setIsFollowingCard(following);
      } catch (error) {
        console.error('[Home] Error checking follow status:', error);
        setIsFollowingCard(false);
      }
    };

    checkFollowStatus();
  }, [cardMenuData, clerkUser?.id]);

  const { topSupport, topAvoid, allSupport, allSupportFull, allAvoidFull, scoredBrands, brandDistances, rawBrandScores } = useMemo(() => {
    // Only use brands from Firebase (NOT businesses)
    // Businesses are handled separately in the Local view
    const currentBrands = brands || [];

    if (!currentBrands || currentBrands.length === 0) {
      return {
        topSupport: [],
        topAvoid: [],
        allSupport: [],
        allSupportFull: [],
        allAvoidFull: [],
        scoredBrands: new Map(),
        brandDistances: new Map(),
        rawBrandScores: [],
      };
    }

    // Calculate scores for brands using values matrix
    const brandsWithScores = currentBrands.map(brand => {
      const score = calculateBrandScore(brand.name, profile.causes || [], valuesMatrix);
      return { brand, score };
    });

    // Store raw scores for business score normalization
    const rawBrandScores = brandsWithScores.map(b => b.score);

    // Normalize scores to 1-99 range for better visual separation
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
      .reverse() // Reverse so most opposed is first
      .map(({ brand }) => brand);

    // All brands sorted alphabetically
    const sortedBrands = [...currentBrands].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    return {
      topSupport: alignedBrands.slice(0, 10),
      topAvoid: unalignedBrands.slice(0, 10),
      allSupport: alignedBrands,
      allSupportFull: sortedBrands,
      allAvoidFull: unalignedBrands,
      scoredBrands: scoredMap,
      brandDistances: new Map(),
      rawBrandScores,
    };
  }, [brands, profile.causes, valuesMatrix]);

  // Compute local businesses when "local" view is active
  const localBusinessData = useMemo(() => {
    if (mainView !== 'local' || !userLocation || userBusinesses.length === 0) {
      return {
        allBusinesses: [],
        alignedBusinesses: [],
        unalignedBusinesses: [],
      };
    }

    // Filter businesses by distance and calculate similarity scores
    const businessesWithScores = userBusinesses.map((business) => {
      // Only check distance if a filter is selected, otherwise show all
      let rangeResult;
      if (localDistance === null) {
        // No distance filter - calculate distance but consider all businesses in range
        const tempResult = isBusinessWithinRange(business, userLocation.latitude, userLocation.longitude, 999999);
        rangeResult = {
          ...tempResult,
          isWithinRange: true,
        };
      } else {
        rangeResult = isBusinessWithinRange(business, userLocation.latitude, userLocation.longitude, localDistance);
      }

      // Calculate similarity score with the business
      const similarityScore = calculateSimilarityScore(profile.causes || [], business.causes || []);

      return {
        business,
        alignmentScore: similarityScore,
        distance: rangeResult.closestDistance,
        closestLocation: rangeResult.closestLocation,
        isWithinRange: rangeResult.isWithinRange,
      };
    });

    // Filter by distance
    const businessesInRange = businessesWithScores.filter((b) => b.isWithinRange);

    // Normalize similarity scores using brand scores as reference distribution
    // This allows businesses to be compared on the same scale as brands
    const normalizedBusinesses = rawBrandScores.length > 0
      ? normalizeBusinessScoresWithBrands(businessesInRange, rawBrandScores)
      : normalizeSimilarityScores(businessesInRange);

    // Separate into aligned (>= 60) and unaligned (< 40)
    const alignedBusinesses = normalizedBusinesses
      .filter((b) => b.alignmentScore >= 60)
      .sort((a, b) => b.alignmentScore - a.alignmentScore); // Sort by score descending

    const unalignedBusinesses = normalizedBusinesses
      .filter((b) => b.alignmentScore < 40)
      .sort((a, b) => a.alignmentScore - b.alignmentScore); // Sort by score ascending

    // Sort all by similarity score based on direction
    const allBusinessesSorted = [...normalizedBusinesses].sort((a, b) => {
      if (localSortDirection === 'highToLow') {
        return b.alignmentScore - a.alignmentScore; // High to low
      } else {
        return a.alignmentScore - b.alignmentScore; // Low to high
      }
    });

    return {
      allBusinesses: allBusinessesSorted,
      alignedBusinesses,
      unalignedBusinesses,
    };
  }, [mainView, userLocation, userBusinesses, localDistance, profile.causes, localSortDirection, rawBrandScores]);

  // Normalize all business scores for library display using brand scores as reference
  const businessScoresMap = useMemo(() => {
    if (!profile.causes || userBusinesses.length === 0) {
      return new Map<string, number>();
    }

    // Calculate scores for all businesses
    const businessesWithScores = userBusinesses.map(b => ({
      ...b,
      alignmentScore: calculateSimilarityScore(profile.causes || [], b.causes || [])
    }));

    // Normalize similarity scores using brand scores as reference distribution
    // This allows businesses to be compared on the same scale as brands
    const normalizedBusinesses = rawBrandScores.length > 0
      ? normalizeBusinessScoresWithBrands(businessesWithScores, rawBrandScores)
      : normalizeSimilarityScores(businessesWithScores);

    // Create map of business ID to normalized score for quick lookup
    const scoresMap = new Map<string, number>();
    normalizedBusinesses.forEach(b => {
      scoresMap.set(b.id, b.alignmentScore);
    });

    return scoresMap;
  }, [userBusinesses, profile.causes, rawBrandScores]);

  const categorizedBrands = useMemo(() => {
    const categorized = new Map<string, Product[]>();

    allSupport.forEach((product) => {
      FOLDER_CATEGORIES.forEach((category) => {
        const productCategory = product.category?.toLowerCase() || '';
        const productBrand = product.name?.toLowerCase() || '';

        let match = false;

        if (
          category.id === 'gas' &&
          (productCategory.includes('energy') ||
            productCategory.includes('petroleum') ||
            productBrand.includes('exxon') ||
            productBrand.includes('chevron') ||
            productBrand.includes('shell') ||
            productBrand.includes('bp'))
        ) {
          match = true;
        } else if (
          category.id === 'fast-food' &&
          (productBrand.includes('mcdonald') ||
            productBrand.includes('burger king') ||
            productBrand.includes('wendy') ||
            productBrand.includes('kfc') ||
            productBrand.includes('taco') ||
            productBrand.includes('subway') ||
            productBrand.includes('chick-fil-a'))
        ) {
          match = true;
        } else if (category.id === 'restaurants' && (productCategory.includes('food') || productCategory.includes('restaurant'))) {
          match = true;
        } else if (
          category.id === 'groceries' &&
          (productBrand.includes('walmart') ||
            productBrand.includes('target') ||
            productBrand.includes('costco') ||
            productBrand.includes('kroger') ||
            productBrand.includes('whole foods') ||
            productBrand.includes('publix'))
        ) {
          match = true;
        } else if (
          category.id === 'streaming' &&
          (productBrand.includes('netflix') ||
            productBrand.includes('disney') ||
            productBrand.includes('hulu') ||
            productBrand.includes('spotify') ||
            productBrand.includes('youtube') ||
            productBrand.includes('amazon'))
        ) {
          match = true;
        } else if (
          category.id === 'social-media' &&
            (productBrand.includes('meta') ||
            productBrand.includes('facebook') ||
            productBrand.includes('instagram') ||
            productBrand.includes('tiktok') ||
            productBrand.includes('snapchat') ||
            productBrand.includes('x') ||
            productBrand.includes('twitter'))
        ) {
    match = true;
  } else if (
    category.id === 'insurance' &&
    (productCategory.includes('insurance') ||
      productBrand.includes('state farm') ||
      productBrand.includes('allstate') ||
      productBrand.includes('progressive') ||
      productBrand.includes('geico'))
  ) {
    match = true;
  } else if (
    category.id === 'vehicles' &&
    (productCategory.includes('auto') ||
      productBrand.includes('tesla') ||
      productBrand.includes('ford') ||
      productBrand.includes('toyota') ||
      productBrand.includes('honda') ||
      productBrand.includes('chevrolet'))
  ) {
    match = true;
  } else if (category.id === 'technology' && productCategory.includes('tech')) {
    match = true;
  } else if (category.id === 'retail' && (productCategory.includes('retail') || productCategory.includes('store'))) {
    match = true;
  } else if (category.id === 'financial' && productCategory.includes('financial')) {
    match = true;
  } else if (category.id === 'fashion' && productCategory.includes('fashion')) {
    match = true;
  }

        if (match) {
          if (!categorized.has(category.id)) {
            categorized.set(category.id, []);
          }
          const existing = categorized.get(category.id)!;
          if (!existing.find((p) => p.id === product.id)) {
            existing.push(product);
          }
        }
      });
    });

    return categorized;
  }, [allSupport]);

  const handleProductPress = (product: Product) => {
    router.push({
      pathname: '/brand/[id]',
      params: { id: product.id },
    });
  };

  const renderBrandCard = (product: Product, type: 'support' | 'avoid') => {
    const isSupport = type === 'support';
    const titleColor = colors.white;
    const alignmentScore = scoredBrands.get(product.id) || 0;

    return (
      <TouchableOpacity
        key={product.id}
        style={[
          styles.brandCard,
          { backgroundColor: 'transparent' },
        ]}
        onPress={() => handleProductPress(product)}
        activeOpacity={0.7}
      >
        <View style={styles.brandCardInner}>
          <View style={styles.brandLogoContainer}>
            <Image
              source={{ uri: getLogoUrl(product.website || '') }}
              style={styles.brandLogo}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.brandCardContent}>
            <Text style={[styles.brandName, { color: titleColor }]} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
              {product.category}
            </Text>
          </View>
          <View style={styles.brandScoreContainer}>
            <Text style={[styles.brandScore, { color: titleColor }]}>{alignmentScore}</Text>
          </View>
          <TouchableOpacity
            style={[styles.quickAddButton, { backgroundColor: colors.background }]}
            onPress={(e) => {
              e.stopPropagation();
              handleCardMenuOpen('brand', product.id, product.name, product.website, getLogoUrl(product.website || ''));
            }}
            activeOpacity={0.7}
          >
            <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const handleBusinessPress = (businessId: string) => {
    router.push({
      pathname: '/business/[id]',
      params: { id: businessId },
    });
  };

  const renderLocalBusinessCard = (
    businessData: { business: BusinessUser; alignmentScore: number; distance?: number; closestLocation?: string },
    type: 'aligned' | 'unaligned'
  ) => {
    const isAligned = type === 'aligned';
    const titleColor = colors.white;
    const { business, alignmentScore, distance, closestLocation } = businessData;

    // Determine score color based on alignment score
    // Neutral (gray) only for 45-55 range
    const scoreColor = alignmentScore >= 56
      ? colors.success
      : alignmentScore <= 44
      ? colors.danger
      : colors.textSecondary;

    return (
      <TouchableOpacity
        key={business.id}
        style={[
          styles.brandCard,
          { backgroundColor: 'transparent' },
        ]}
        onPress={() => handleBusinessPress(business.id)}
        activeOpacity={0.7}
      >
        <View style={styles.brandCardInner}>
          <View style={styles.brandLogoContainer}>
            <Image
              source={{ uri: business.businessInfo.logoUrl || getLogoUrl(business.businessInfo.website || '') }}
              style={styles.brandLogo}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.brandCardContent}>
            <Text style={[styles.brandName, { color: titleColor }]} numberOfLines={2}>
              {business.businessInfo.name}
            </Text>
            <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
              {business.businessInfo.category}
            </Text>
            {distance !== undefined && (
              <View style={styles.distanceContainer}>
                <MapPin size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                  {formatDistance(distance)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.brandScoreContainer}>
            <Text style={[styles.brandScore, { color: scoreColor }]}>{alignmentScore}</Text>
          </View>
          <TouchableOpacity
            style={[styles.quickAddButton, { backgroundColor: colors.background }]}
            onPress={(e) => {
              e.stopPropagation();
              handleCardMenuOpen('business', business.id, business.businessInfo.name, business.businessInfo.website, business.businessInfo.logoUrl || (business.businessInfo.website ? getLogoUrl(business.businessInfo.website) : ''));
            }}
            activeOpacity={0.7}
          >
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const localDistanceOptions: LocalDistanceOption[] = [100, 50, 10, 5, 1];

  // Helper function to toggle list expansion
  // Toggle privacy for a list (system or custom)
  const toggleListPrivacy = async (listId: string) => {
    try {
      if (!clerkUser?.id) return;

      // Handle system lists (Aligned, Unaligned)
      if (listId === 'aligned') {
        const newValue = !alignedListPublic;
        setAlignedListPublic(newValue);
        // Save to Firestore user profile
        const userRef = doc(db, 'users', clerkUser.id);
        await updateDoc(userRef, { alignedListPublic: newValue });
        return;
      }

      if (listId === 'unaligned') {
        const newValue = !unalignedListPublic;
        setUnalignedListPublic(newValue);
        // Save to Firestore user profile
        const userRef = doc(db, 'users', clerkUser.id);
        await updateDoc(userRef, { unalignedListPublic: newValue });
        return;
      }

      // Handle custom lists (including endorsement)
      const list = userLists.find(l => l.id === listId);
      if (list) {
        const newValue = !list.isPublic;
        await updateListMetadata(listId, { isPublic: newValue });
        // Reload lists to reflect change
        await loadUserLists();
      }
    } catch (error) {
      console.error('Error toggling list privacy:', error);
    }
  };

  // Helper function to render consistent header across all For You subsections
  const renderSubsectionHeader = (title: string, onAddPress: () => void, showModalButton: boolean = true) => {
    return (
      <View style={styles.listDetailHeader}>
        <View style={styles.listDetailTitleRow}>
          <View style={styles.listDetailTitleContainerHorizontal}>
            <Text style={[styles.listDetailTitle, { color: colors.text }]}>{title}</Text>
            {showModalButton && (
              <TouchableOpacity
                style={styles.listOptionsButtonHorizontal}
                onPress={() => setShowEditDropdown(!showEditDropdown)}
                activeOpacity={0.7}
              >
                <MoreVertical size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.createButtonContainer}>
            <TouchableOpacity
              style={[styles.addItemButton, { backgroundColor: colors.primary }]}
              onPress={onAddPress}
              activeOpacity={0.7}
            >
              <Plus size={20} color={colors.white} strokeWidth={2.5} />
            </TouchableOpacity>

            <Text style={[styles.createText, { color: colors.textSecondary }]}>create</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderForYouView = () => {
    // Render unified library component with endorsementOnly mode
    // Global and Local sections have been moved to Browse tab
    return (
      <UnifiedLibrary
        mode="edit"
        currentUserId={clerkUser?.id}
        alignedItems={allSupport}
        unalignedItems={allAvoidFull}
        isDarkMode={isDarkMode}
        profileImage={profile?.userDetails?.profileImage || clerkUser?.imageUrl}
        userBusinesses={userBusinesses}
        scoredBrands={scoredBrands}
        userCauses={profile?.causes || []}
        userLocation={userLocation}
        onRequestLocation={requestLocation}
        followingCount={followingCount}
        followersCount={followersCount}
        endorsementOnly={true}
        initialShowAddModal={params.openAddModal === 'true'}
      />
    );
  };
  // Library handler functions
  const handleCreateList = async () => {
    console.log('[Home] handleCreateList called');
    console.log('[Home] newListName:', newListName);
    console.log('[Home] clerkUser.id:', clerkUser?.id);

    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    if (!clerkUser?.id) {
      Alert.alert('Error', 'You must be logged in to create a list');
      return;
    }

    try {
      console.log('[Home] Creating list...');
      const fullNameFromClerk = clerkUser.fullName ||
        (clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : '');
      const creatorName = profile?.userDetails?.name || fullNameFromClerk || clerkUser.firstName || '';
      const creatorImage = profile?.userDetails?.profileImage || clerkUser?.imageUrl;

      const newList = await library.createNewList(
        clerkUser.id,
        newListName.trim(),
        newListDescription.trim(),
        creatorName,
        false, // not endorsed
        undefined, // no original list
        undefined, // no original creator
        creatorImage
      );

      setNewListName('');
      setNewListDescription('');
      setShowCreateListModal(false);

      // Expand the newly created list
      library.setExpandedList(newList.id);

      Alert.alert('Success', 'List created successfully!');
    } catch (error) {
      console.error('[Home] Error creating list:', error);
      Alert.alert('Error', 'Could not create list. Please try again.');
    }
  };

  const handleDeleteList = async (listId: string) => {
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this list? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteList(listId);
              await loadUserLists();
              handleBackToLibrary();
            Alert.alert('Success', 'List deleted successfully');
            } catch (error) {
              console.error('[Home] Error deleting list:', error);
            Alert.alert('Error', 'Could not delete list. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleShareList = async (list: UserList) => {
    const description = (list.creatorName ? `Created by: ${list.creatorName}. ` : '') +
      (list.description ? `${list.description}. ` : '') +
      `${list.entries.length} ${list.entries.length === 1 ? 'item' : 'items'}`;

    // Generate shareable link
    const shareLink = `https://iendorse.app/list/${list.id}`;

    // Show ShareModal with platform options (works for both web and mobile)
    setShareData({
      url: shareLink,
      title: list.name,
      description: description
    });
    setShowShareModal(true);
  };

  const handleOpenRenameModal = () => {
    if (selectedList) {
      const list = selectedList;
      setRenameListName(list.name);
      setRenameListDescription(list.description || '');
      setShowListOptionsMenu(false);
      setShowRenameModal(true);
    }
  };

  const handleRenameList = async () => {
    if (!renameListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    if (selectedList) {
      const list = selectedList;
      try {
        await updateListMetadata(list.id, {
          name: renameListName.trim(),
          description: renameListDescription.trim(),
        });
        setShowRenameModal(false);
        setRenameListName('');
        setRenameListDescription('');
        await loadUserLists();

        // Update selectedList with new data
        const updatedLists = await getUserLists(clerkUser?.id || '');
        const updatedList = updatedLists.find(l => l.id === list.id);
        if (updatedList) {
          setSelectedList(updatedList);
        }

        Alert.alert('Success', 'List renamed successfully!');
      } catch (error) {
        console.error('[Home] Error renaming list:', error);
        Alert.alert('Error', 'Could not rename list. Please try again.');
      }
    }
  };

  const handleUpdateDescription = async () => {
    if (selectedList) {
      const list = selectedList;
      try {
        await updateListMetadata(list.id, {
          description: descriptionText.trim(),
        });
        setShowDescriptionModal(false);
        setDescriptionText('');
        await loadUserLists();

        // Update selectedList with new data
        const updatedLists = await getUserLists(clerkUser?.id || '');
        const updatedList = updatedLists.find(l => l.id === list.id);
        if (updatedList) {
          setSelectedList(updatedList);
        }

        Alert.alert('Success', 'Description updated successfully!');
      } catch (error) {
        console.error('[Home] Error updating description:', error);
        Alert.alert('Error', 'Could not update description. Please try again.');
      }
    }
  };

  const handleDeleteCurrentList = () => {
    if (selectedList) {
      const list = selectedList;
      setShowListOptionsMenu(false);
      setShowEditDropdown(false);
      handleDeleteList(list.id);
    }
  };

  const handleCreateListFromValues = async () => {
    if (selectedValuesForList.length < 5) {
      Alert.alert('Error', 'Please select at least 5 values');
      return;
    }

    if (!clerkUser?.id || !brands || !valuesMatrix) return;

    try {
      // Calculate alignment scores for all brands based on selected values
      const scored = brands.map((brand) => {
        const brandName = brand.name;
        let totalSupportScore = 0;
        const alignedScores: number[] = [];

        // Check each selected value
        selectedValuesForList.forEach((selectedValue) => {
          const causeData = valuesMatrix[selectedValue.id];
          if (!causeData) {
            alignedScores.push(50);
            return;
          }

          // Check the appropriate list based on selection type
          const listToCheck = selectedValue.type === 'support' ? causeData.support : causeData.avoid;
          const arrayLength = listToCheck?.length || 0;
          const positionIndex = listToCheck?.indexOf(brandName);
          const position = positionIndex !== undefined && positionIndex >= 0
            ? positionIndex + 1
            : arrayLength + 1;

          if (positionIndex !== undefined && positionIndex >= 0) {
            // Brand found - calculate score
            const maxPosition = arrayLength > 0 ? arrayLength : 1;
            const score = Math.round(100 - ((position - 1) / maxPosition) * 50);
            alignedScores.push(score);
            totalSupportScore += 100;
          } else {
            alignedScores.push(50);
          }
        });

        // Calculate alignment strength based on average score
        let alignmentStrength = 50;
        if (totalSupportScore > 0) {
          alignmentStrength = Math.round(
            alignedScores.reduce((sum, score) => sum + score, 0) / alignedScores.length
          );
        }

        return {
          brand,
          totalSupportScore,
          alignmentStrength,
        };
      });

      // Get top 20 most aligned brands
      const topBrands = scored
        .filter((s) => s.totalSupportScore > 0)
        .sort((a, b) => b.alignmentStrength - a.alignmentStrength)
        .slice(0, 20);

      if (topBrands.length === 0) {
        Alert.alert('Error', 'No brands found that align with the selected values');
        return;
      }

      // Use custom name/description if provided, otherwise generate them
      let listName = valuesListName.trim();
      let listDescription = valuesListDescription.trim();

      if (!listName) {
        // Get value names for auto-generated list name
        const selectedValueNames = selectedValuesForList
          .map(sv => values.find(v => v.id === sv.id)?.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');

        listName = `Aligned with ${selectedValueNames}${selectedValuesForList.length > 3 ? ' +' + (selectedValuesForList.length - 3) : ''}`;
      }

      if (!listDescription) {
        const supportCount = selectedValuesForList.filter(sv => sv.type === 'support').length;
        const avoidCount = selectedValuesForList.filter(sv => sv.type === 'avoid').length;
        listDescription = `Auto-generated list based on ${supportCount} supported and ${avoidCount} avoided values`;
      }

      // Create the list using library context
      const fullNameFromClerk = clerkUser.fullName ||
        (clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : '');
      const creatorName = profile?.userDetails?.name || fullNameFromClerk || clerkUser.firstName || '';
      const creatorImage = profile?.userDetails?.profileImage || clerkUser?.imageUrl;

      const newList = await library.createNewList(
        clerkUser.id,
        listName,
        listDescription,
        creatorName,
        false, // not endorsed
        undefined, // no original list
        undefined, // no original creator
        creatorImage
      );

      // Add brands to the list
      for (const item of topBrands) {
        const entry: Omit<ListEntry, 'id'> = {
          type: 'brand',
          brandId: item.brand.id,
          brandName: item.brand.name,
          website: item.brand.website,
          createdAt: new Date(),
        };
        await library.addEntry(newList.id, entry);
      }

      // Close modal and reset state
      setShowValuesSelectionModal(false);
      setSelectedValuesForList([]);
      setValuesListName('');
      setValuesListDescription('');

      // Expand the newly created list
      library.setExpandedList(newList.id);

      Alert.alert('Success', `Created list with ${topBrands.length} aligned brands!`);
    } catch (error) {
      console.error('[Home] Error creating list from values:', error);
      Alert.alert('Error', 'Could not create list. Please try again.');
    }
  };

  const handleOpenList = (list: UserList) => {
    setSelectedList(list);
    setLibraryView('detail');
    // Scroll to top when opening a list
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleBackToLibrary = () => {
    setLibraryView('overview');
    setSelectedList(null);
    setShowListOptionsMenu(false);
    setIsEditMode(false);
    setActiveOptionsMenu(null);
    setActiveItemOptionsMenu(null);
    setShowEditDropdown(false);
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setActiveOptionsMenu(null);
    setActiveItemOptionsMenu(null);
    setShowEditDropdown(false);
  };

  const handleMoveListUp = (index: number) => {
    if (index > 0) {
      const newLists = [...userLists];
      const temp = newLists[index];
      newLists[index] = newLists[index - 1];
      newLists[index - 1] = temp;
      setUserLists(newLists);
    }
  };

  const handleMoveListDown = (index: number) => {
    if (index < userLists.length - 1) {
      const newLists = [...userLists];
      const temp = newLists[index];
      newLists[index] = newLists[index + 1];
      newLists[index + 1] = temp;
      setUserLists(newLists);
    }
  };

  const handleMoveEntryUp = async (entryIndex: number) => {
    if (selectedList && entryIndex > 0) {
      const list = selectedList;
      const newEntries = [...list.entries];
      const temp = newEntries[entryIndex];
      newEntries[entryIndex] = newEntries[entryIndex - 1];
      newEntries[entryIndex - 1] = temp;

      // Update in Firebase
      try {
        const listRef = doc(db, 'userLists', list.id);
        await updateDoc(listRef, { entries: newEntries });

        // Update local state
        const updatedList = { ...list, entries: newEntries };
        setSelectedList(updatedList);
        await loadUserLists();
      } catch (error) {
        console.error('[Home] Error moving entry:', error);
        Alert.alert('Error', 'Could not reorder entry. Please try again.');
      }
    }
  };

  const handleMoveEntryDown = async (entryIndex: number) => {
    if (selectedList) {
      const list = selectedList;
      if (entryIndex < list.entries.length - 1) {
        const newEntries = [...list.entries];
        const temp = newEntries[entryIndex];
        newEntries[entryIndex] = newEntries[entryIndex + 1];
        newEntries[entryIndex + 1] = temp;

        // Update in Firebase
        try {
          const listRef = doc(db, 'userLists', list.id);
          await updateDoc(listRef, { entries: newEntries });

          // Update local state
          const updatedList = { ...list, entries: newEntries };
          setSelectedList(updatedList);
          await loadUserLists();
        } catch (error) {
          console.error('[Home] Error moving entry:', error);
          Alert.alert('Error', 'Could not reorder entry. Please try again.');
        }
      }
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (selectedList) {
      const list = selectedList;
      setActiveItemOptionsMenu(null); // Close modal first

      // Use native confirm/alert for web, Alert.alert for mobile
      const performDelete = async () => {
        try {
          await removeEntryFromList(list.id, entryId);
          await loadUserLists();
          await reloadPersonalList(); // Also reload personal list for For You view

          // Update selected list
          const updatedLists = await getUserLists(clerkUser?.id || '');
          const updatedList = updatedLists.find(l => l.id === list.id);
          if (updatedList) {
            setSelectedList(updatedList);
          }

          Alert.alert('Success', 'Item removed from list');
        } catch (error) {
          console.error('[Home] Error removing entry:', error);
          Alert.alert('Error', 'Could not remove item. Please try again.');
        }
      };

      
        if (window.confirm('Are you sure you want to remove this item from the list?')) {
          await performDelete();
        }
      
      Alert.alert(
          'Remove Item',
          'Are you sure you want to remove this item from the list?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: performDelete,
            },
          ]
        );
    }
  };

  const handleEntryClick = (entry: ListEntry) => {
    if (isEditMode) return; // Don't navigate when in edit mode

    if (entry.type === 'brand' && 'brandId' in entry) {
      router.push(`/brand/${entry.brandId}`);
    } else if (entry.type === 'value' && 'valueId' in entry) {
      router.push(`/value/${entry.valueId}`);
    } else if (entry.type === 'link' && 'url' in entry) {
      // Open link in browser
      
        window.open(entry.url, '_blank');
      
        // For mobile, you might want to use Linking
        // Linking.openURL(entry.url);
    }
    // Text entries are not clickable
  };

  // Quick-add handler functions
  const handleQuickAdd = async (type: 'brand' | 'business' | 'value', id: string, name: string, website?: string, logoUrl?: string) => {
    // Load lists if not already loaded
    if (userLists.length === 0 && clerkUser?.id) {
      try {
        const lists = await getUserLists(clerkUser.id);
        setUserLists(lists);
      } catch (error) {
        console.error('[Home] Error loading lists for quick-add:', error);
      }
    }

    // For values, show mode selection first
    if (type === 'value') {
      setQuickAddItem({ type, id, name, website, logoUrl });
      setShowValueModeModal(true);
    } else {
      // For brands and businesses, go straight to list selection
      setQuickAddItem({ type, id, name, website, logoUrl });
      setShowQuickAddModal(true);
    }
  };

  // Card menu handler functions
  const handleCardMenuOpen = (type: 'brand' | 'business', id: string, name: string, website?: string, logoUrl?: string, listId?: string) => {
    setCardMenuData({ type, id, name, website, logoUrl, listId });
    setActiveCardMenuId(id);
  };

  // Check if an item is already endorsed
  const isItemEndorsed = (itemId: string, itemType: 'brand' | 'business'): boolean => {
    const endorsementList = library.state.endorsementList;
    if (!endorsementList?.entries) return false;

    return endorsementList.entries.filter(e => e).some(e => {
      if (itemType === 'brand') {
        return e.brandId === itemId;
      } else {
        return e.businessId === itemId;
      }
    });
  };

  const handleCardMenuAddTo = async () => {
    if (!cardMenuData) return;
    setActiveCardMenuId(null);

    // Get endorsement list
    const endorsementList = await library.getEndorsementList();
    if (!endorsementList) {
      Alert.alert('Error', 'Endorsement list not found');
      return;
    }

    const isEndorsed = isItemEndorsed(cardMenuData.id, cardMenuData.type);

    if (isEndorsed) {
      // Unendorse - remove from list
      try {
        const endorsedEntry = endorsementList.entries.find(e => {
          if (cardMenuData.type === 'brand') {
            return e.brandId === cardMenuData.id;
          } else {
            return e.businessId === cardMenuData.id;
          }
        });

        if (!endorsedEntry) {
          Alert.alert('Error', 'Item not found in endorsement list');
          return;
        }

        await library.removeEntry(endorsementList.id, endorsedEntry.id);
        Alert.alert('Success', `${cardMenuData.name} unendorsed!`);
      } catch (error: any) {
        console.error('Error unendorsing item:', error);
        Alert.alert('Error', error?.message || 'Failed to unendorse item');
      }
    } else {
      // Endorse - add to list
      try {
        const entry: Omit<ListEntry, 'id' | 'createdAt'> = cardMenuData.type === 'brand'
          ? {
              type: 'brand',
              brandId: cardMenuData.id,
              brandName: cardMenuData.name,
              website: cardMenuData.website,
              logoUrl: cardMenuData.logoUrl,
            }
          : {
              type: 'business',
              businessId: cardMenuData.id,
              businessName: cardMenuData.name,
              website: cardMenuData.website,
              logoUrl: cardMenuData.logoUrl,
            };

        await library.addEntry(endorsementList.id, entry as ListEntry);
        Alert.alert('Success', `${cardMenuData.name} endorsed!`);
      } catch (error: any) {
        console.error('Error endorsing item:', error);
        Alert.alert('Error', error?.message || 'Failed to endorse item');
      }
    }
  };

  const handleCardMenuRemove = async () => {
    if (!cardMenuData || !cardMenuData.listId) return;
    setActiveCardMenuId(null);

    // Find the entry in the current list
    if (selectedList) {
      const list = selectedList;
      const entry = list.entries.find(e =>
        (e.type === 'brand' && 'brandId' in e && e.brandId === cardMenuData.id) ||
        (e.type === 'business' && 'businessId' in e && e.businessId === cardMenuData.id)
      );
      if (entry) {
        handleDeleteEntry(entry.id);
      }
    }
  };

  const handleCardMenuShare = async () => {
    if (!cardMenuData) return;
    setActiveCardMenuId(null);

    const itemType = cardMenuData.type;
    const shareLink = `https://iendorse.app/${itemType}/${cardMenuData.id}`;

    // Show ShareModal with platform options
    setShareData({
      url: shareLink,
      title: cardMenuData.name,
      description: `Check out ${cardMenuData.name} on Endorse Money`
    });
    setShowShareModal(true);
  };

  const handleCardMenuFollow = async () => {
    if (!cardMenuData || !clerkUser?.id) return;
    setActiveCardMenuId(null);

    try {
      const entityType = cardMenuData.type === 'brand' ? 'brand' : 'business';

      if (isFollowingCard) {
        // Unfollow
        await unfollowEntity(clerkUser.id, cardMenuData.id, entityType);
        setIsFollowingCard(false);
        Alert.alert('Success', `Unfollowed ${cardMenuData.name}`);
      } else {
        // Follow
        await followEntity(clerkUser.id, cardMenuData.id, entityType);
        setIsFollowingCard(true);
        Alert.alert('Success', `Now following ${cardMenuData.name}`);
      }
    } catch (error: any) {
      console.error('[Home] Error following/unfollowing:', error);
      Alert.alert('Error', error?.message || 'Could not update follow status. Please try again.');
    }
  };

  const handleValueModeSelected = (mode: ValueListMode) => {
    setSelectedValueMode(mode);
    setShowValueModeModal(false);

    // If coming from Add Item modal, add directly to the current list
    if (selectedList && quickAddItem) {
      const list = selectedList;
      handleAddItemSubmit({ valueId: quickAddItem.id, name: quickAddItem.name, mode });
    } else {
      // Otherwise, show the quick add modal to select a list
      setShowQuickAddModal(true);
    }
  };

  const handleAddToList = async (listId: string) => {
    if (!quickAddItem) return;

    try {
      let entry: Omit<ListEntry, 'id' | 'createdAt'>;

      if (quickAddItem.type === 'brand') {
        entry = {
          type: 'brand',
          brandId: quickAddItem.id,
          brandName: quickAddItem.name,
          website: quickAddItem.website,
          logoUrl: quickAddItem.logoUrl,
        };
      } else if (quickAddItem.type === 'business') {
        entry = {
          type: 'business',
          businessId: quickAddItem.id,
          businessName: quickAddItem.name,
          website: quickAddItem.website,
          logoUrl: quickAddItem.logoUrl,
        };
      } else if (quickAddItem.type === 'value') {
        if (!selectedValueMode) {
        Alert.alert('Error', 'Please select Max Pain or Max Benefit');
          return;
        }

        // Add the top brands for this value instead of the value card
        const causeData = valuesMatrix[quickAddItem.id];
        if (!causeData) {
        Alert.alert('Error', 'Value data not found');
          return;
        }

        const brandList = selectedValueMode === 'maxBenefit' ? causeData.support : causeData.avoid;
        if (!brandList || brandList.length === 0) {
        Alert.alert('Error', 'No brands found for this value');
          return;
        }

        // Add top 10 brands (or all if less than 10)
        const brandsToAdd = brandList.slice(0, 10);
        let addedCount = 0;

        for (const brandName of brandsToAdd) {
          const brand = brands.find(b => b.name === brandName);
          if (brand) {
            const brandEntry: Omit<ListEntry, 'id' | 'createdAt'> = {
              type: 'brand',
              brandId: brand.id,
              brandName: brand.name,
              website: brand.website,
            };
            await addEntryToList(listId, brandEntry);
            addedCount++;
          }
        }

        setShowQuickAddModal(false);
        setQuickAddItem(null);
        setSelectedValueMode(null);

        // Always reload lists and personal list to keep For You and Library in sync
        await loadUserLists();
        await reloadPersonalList();

        Alert.alert('Success', `Added ${addedCount} brands from ${quickAddItem.name} to list!`);
        return;
      }

      await addEntryToList(listId, entry);
      setShowQuickAddModal(false);
      setQuickAddItem(null);
      setSelectedValueMode(null);

      // Always reload lists and personal list to keep For You and Library in sync
      await loadUserLists();
      await reloadPersonalList();

      Alert.alert('Success', `Added ${quickAddItem.name} to list!`);
    } catch (error: any) {
      console.error('[Home] Error adding to list:', error);
      const errorMessage = error?.message === 'This item is already in the list'
        ? 'This item is already in the list'
        : 'Could not add item to list. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleCreateAndAddToList = async () => {
    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    if (!clerkUser?.id || !quickAddItem) return;

    try {
      const fullNameFromClerk = clerkUser.fullName ||
        (clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : '');
      const creatorName = profile?.userDetails?.name || fullNameFromClerk || clerkUser.firstName || '';
      const creatorImage = profile?.userDetails?.profileImage || clerkUser?.imageUrl;

      const newList = await library.createNewList(
        clerkUser.id,
        newListName.trim(),
        newListDescription.trim(),
        creatorName,
        false, // not endorsed
        undefined, // no original list
        undefined, // no original creator
        creatorImage
      );

      // Add the item to the new list
      let entry: Omit<ListEntry, 'id'>;

      if (quickAddItem.type === 'brand') {
        entry = {
          type: 'brand',
          brandId: quickAddItem.id,
          brandName: quickAddItem.name,
          website: quickAddItem.website,
          logoUrl: quickAddItem.logoUrl,
          createdAt: new Date(),
        };
      } else if (quickAddItem.type === 'business') {
        entry = {
          type: 'business',
          businessId: quickAddItem.id,
          businessName: quickAddItem.name,
          website: quickAddItem.website,
          logoUrl: quickAddItem.logoUrl,
          createdAt: new Date(),
        };
      } else if (quickAddItem.type === 'value') {
        if (!selectedValueMode) {
        Alert.alert('Error', 'Please select Max Pain or Max Benefit');
          return;
        }

        // Add the top brands for this value instead of the value card
        const causeData = valuesMatrix[quickAddItem.id];
        if (!causeData) {
        Alert.alert('Error', 'Value data not found');
          return;
        }

        const brandList = selectedValueMode === 'maxBenefit' ? causeData.support : causeData.avoid;
        if (!brandList || brandList.length === 0) {
        Alert.alert('Error', 'No brands found for this value');
          return;
        }

        // Add top 10 brands (or all if less than 10)
        const brandsToAdd = brandList.slice(0, 10);
        let addedCount = 0;

        for (const brandName of brandsToAdd) {
          const brand = brands.find(b => b.name === brandName);
          if (brand) {
            const brandEntry: Omit<ListEntry, 'id'> = {
              type: 'brand',
              brandId: brand.id,
              brandName: brand.name,
              website: brand.website,
              createdAt: new Date(),
            };
            await library.addEntry(newList.id, brandEntry);
            addedCount++;
          }
        }

        setShowQuickAddModal(false);
        setQuickAddItem(null);
        setNewListName('');
        setNewListDescription('');
        setSelectedValueMode(null);

        // Expand the newly created list
        library.setExpandedList(newList.id);

        Alert.alert('Success', `Created list and added ${addedCount} brands from ${quickAddItem.name}!`);
        return;
      }

      await library.addEntry(newList.id, entry);

      // Clean up state
      setNewListName('');
      setNewListDescription('');
      setShowQuickAddModal(false);
      setQuickAddItem(null);
      setSelectedValueMode(null);

      // Expand the newly created list
      library.setExpandedList(newList.id);

      Alert.alert('Success', `Created list and added ${quickAddItem.name}!`);
    } catch (error: any) {
      console.error('[Home] Error creating list and adding item:', error);
      const errorMessage = error?.message === 'This item is already in the list'
        ? 'This item is already in the list'
        : 'Could not create list. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  // Library card handlers
  const handleOpenCardRenameModal = (listId: string, listName: string, listDescription: string) => {
    setCardRenameListId(listId);
    setCardRenameListName(listName);
    setCardRenameListDescription(listDescription);
    setShowCardRenameModal(true);
    setActiveCardOptionsMenu(null);
  };

  const handleCardRenameSubmit = async () => {
    if (!cardRenameListId || !cardRenameListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    try {
      await updateListMetadata(cardRenameListId, {
        name: cardRenameListName.trim(),
        description: cardRenameListDescription.trim()
      });
      await loadUserLists();
      setShowCardRenameModal(false);
      setCardRenameListId(null);
      setCardRenameListName('');
      setCardRenameListDescription('');
      Alert.alert('Success', 'List updated successfully');
    } catch (error) {
      console.error('[Home] Error updating list:', error);
      Alert.alert('Error', 'Could not update list. Please try again.');
    }
  };

  const handleToggleListPrivacy = async (listId: string, currentIsPublic: boolean) => {
    try {
      await updateListMetadata(listId, {
        isPublic: !currentIsPublic,
      });
      await loadUserLists();
      setActiveCardOptionsMenu(null);
      const message = !currentIsPublic ? 'List is now public' : 'List is now private';
      
      
      Alert.alert('Success', message);
    } catch (error) {
      console.error('[Home] Error toggling list privacy:', error);
      
      
      Alert.alert('Error', 'Could not update list privacy. Please try again.');
    }
  };

  const handleCardDeleteList = (listId: string) => {
    setActiveCardOptionsMenu(null);

    // Use native confirm/alert for web, Alert.alert for mobile
    const performDelete = async () => {
      try {
        await deleteList(listId);
        await loadUserLists();
        Alert.alert('Success', 'List deleted successfully');
      } catch (error) {
        console.error('[Home] Error deleting list:', error);
        Alert.alert('Error', 'Could not delete list. Please try again.');
      }
    };

    
      if (window.confirm('Are you sure you want to delete this list? This action cannot be undone.')) {
        performDelete();
    
      Alert.alert(
        'Delete List',
        'Are you sure you want to delete this list? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  // Add item modal handlers
  const handleOpenAddItemModal = () => {
    if (selectedList) {
      setShowAddItemModal(true);
      setAddItemType(null);
      setAddItemSearchQuery('');
      setLinkUrl('');
      setLinkTitle('');
      setTextContent('');
    }
  };

  const handleAddItemTypeSelected = (type: 'brand' | 'business' | 'value' | 'link' | 'text') => {
    setAddItemType(type);
    setAddItemSearchQuery('');
  };

  const handleAddItemSubmit = async (itemData: any) => {
    if (!selectedList) return;

    const list = selectedList;

    try {
      let entry: any;

      if (addItemType === 'brand' && itemData.brandId) {
        entry = {
          type: 'brand',
          brandId: itemData.brandId,
          brandName: itemData.name,
          website: itemData.website,
          logoUrl: itemData.logoUrl,
        };
      } else if (addItemType === 'business' && itemData.businessId) {
        entry = {
          type: 'business',
          businessId: itemData.businessId,
          businessName: itemData.name,
          website: itemData.website,
          logoUrl: itemData.logoUrl,
        };
      } else if (addItemType === 'value' && itemData.valueId && itemData.mode) {
        // Add the top brands for this value instead of the value card
        const causeData = valuesMatrix[itemData.valueId];
        if (!causeData) {
        Alert.alert('Error', 'Value data not found');
          return;
        }

        const brandList = itemData.mode === 'maxBenefit' ? causeData.support : causeData.avoid;
        if (!brandList || brandList.length === 0) {
        Alert.alert('Error', 'No brands found for this value');
          return;
        }

        // Add top 10 brands (or all if less than 10)
        const brandsToAdd = brandList.slice(0, 10);
        let addedCount = 0;

        for (const brandName of brandsToAdd) {
          const brand = brands?.find(b => b.name === brandName);
          if (brand) {
            const brandEntry: Omit<ListEntry, 'id' | 'createdAt'> = {
              type: 'brand',
              brandId: brand.id,
              brandName: brand.name,
              website: brand.website,
            };
            await addEntryToList(list.id, brandEntry);
            addedCount++;
          }
        }

        // Reload the list
        const updatedLists = await getUserLists(clerkUser?.id || '');
        setUserLists(updatedLists);
        const updatedList = updatedLists.find(l => l.id === list.id);
        if (updatedList) {
          setSelectedList(updatedList);
        }

        setShowAddItemModal(false);
        setAddItemType(null);
        setAddItemSearchQuery('');
      Alert.alert('Success', `Added ${addedCount} brands from ${itemData.name} to list!`);
        return;
      } else if (addItemType === 'link') {
        if (!linkUrl.trim()) {
        Alert.alert('Error', 'Please enter a URL');
          return;
        }
        entry = {
          type: 'link',
          url: linkUrl.trim(),
          title: linkTitle.trim() || linkUrl.trim(),
        };
      } else if (addItemType === 'text') {
        if (!textContent.trim()) {
        Alert.alert('Error', 'Please enter text content');
          return;
        }
        entry = {
          type: 'text',
          content: textContent.trim(),
        };
      }

      await addEntryToList(list.id, entry);
      await loadUserLists();
      await reloadPersonalList(); // Also reload personal list for For You view

      // Update selected list
      const updatedLists = await getUserLists(clerkUser?.id || '');
      const updatedList = updatedLists.find(l => l.id === list.id);
      if (updatedList) {
        setSelectedList(updatedList);
      }

      // Reset modal state
      setShowAddItemModal(false);
      setAddItemType(null);
      setAddItemSearchQuery('');
      setLinkUrl('');
      setLinkTitle('');
      setTextContent('');

      Alert.alert('Success', 'Item added to list');
    } catch (error) {
      console.error('[Home] Error adding item to list:', error);
      Alert.alert('Error', 'Could not add item. Please try again.');
    }
  };

  const renderListDetailView = () => {
    if (!selectedList) return null;

    // User list detail
    const list = selectedList;

    // Check if this list was generated from values
    const isValuesGeneratedList = list.metadata?.generatedFrom === 'values';

    return (
      <View style={styles.section}>
        <View style={styles.listDetailHeader}>
          {/* Back button above title */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToLibrary}
            activeOpacity={0.7}
          >
            <ArrowLeft
              size={20}
              color={colors.primary}
              strokeWidth={2.5}
            />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Library</Text>
          </TouchableOpacity>

          {/* Done button when in edit/reorder mode */}
          {isEditMode && (
            <View style={styles.libraryHeader}>
              <TouchableOpacity
                onPress={() => setIsEditMode(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.libraryDoneButton, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Title row with Action Menu and optional Add button */}
          {!isEditMode && (
          <View style={styles.listDetailTitleRow}>
            <Text style={[styles.listDetailTitle, { color: colors.text }]}>{list.name}</Text>

            <View style={styles.listHeaderButtons}>
              <TouchableOpacity
                style={styles.listOptionsButton}
                onPress={() => setShowEditDropdown(!showEditDropdown)}
                activeOpacity={0.7}
              >
                <MoreVertical size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>

              {/* Add button - hidden for values-generated lists */}
              {!isValuesGeneratedList && (
                <TouchableOpacity
                  style={[styles.addItemButtonLarge, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSelectedList(list);
                    setShowAddItemModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={34} color={colors.white} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          )}

          {/* Created by text */}
          {!isEditMode && list.creatorName && (
            <Text style={[styles.listCreatedBy, { color: colors.textSecondary }]}>
              created by {list.creatorName}
            </Text>
          )}

          {/* Description below title */}
          {!isEditMode && list.description && (
            <Text style={[styles.listDetailDescription, { color: colors.textSecondary }]}>
              {list.description}
            </Text>
          )}
        </View>

        {/* Action Menu options dropdown */}
        {!isEditMode && showEditDropdown && (() => {
          // Check if this is the user's personal list
          const fullNameFromFirebase = profile?.userDetails?.name;
          const fullNameFromClerk = clerkUser?.unsafeMetadata?.fullName as string;
          const firstNameLastName = clerkUser?.firstName && clerkUser?.lastName
            ? `${clerkUser.firstName} ${clerkUser.lastName}`
            : '';
          const firstName = clerkUser?.firstName;
          const userName = fullNameFromFirebase || fullNameFromClerk || firstNameLastName || firstName || '';
          const isUserNameList = list.name === userName;

          return (
            <View style={[styles.listEditDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {!isUserNameList && (
                <>
                  <TouchableOpacity
                    style={styles.listOptionItem}
                    onPress={() => {
                      setShowEditDropdown(false);
                      handleOpenRenameModal();
                    }}
                    activeOpacity={0.7}
                  >
                    <Edit size={18} color={colors.text} strokeWidth={2} />
                    <Text style={[styles.listOptionText, { color: colors.text }]}>Rename</Text>
                  </TouchableOpacity>
                  <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                </>
              )}
              <TouchableOpacity
                style={styles.listOptionItem}
                onPress={() => {
                  setShowEditDropdown(false);
                  toggleEditMode();
                }}
                activeOpacity={0.7}
              >
                <ChevronUp size={18} color={colors.text} strokeWidth={2} />
                <Text style={[styles.listOptionText, { color: colors.text }]}>Reorder</Text>
              </TouchableOpacity>
              <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.listOptionItem}
                onPress={() => {
                  setShowEditDropdown(false);
                  handleShareList(list);
                }}
                activeOpacity={0.7}
              >
                <Share2 size={18} color={colors.text} strokeWidth={2} />
                <Text style={[styles.listOptionText, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>
              <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.listOptionItem}
                onPress={() => {
                  setShowEditDropdown(false);
                  setDescriptionText(list.description || '');
                  setShowDescriptionModal(true);
                }}
                activeOpacity={0.7}
              >
                <Edit size={18} color={colors.text} strokeWidth={2} />
                <Text style={[styles.listOptionText, { color: colors.text }]}>Description</Text>
              </TouchableOpacity>
              {!isUserNameList && (
                <>
                  <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                  <TouchableOpacity
                    style={styles.listOptionItem}
                    onPress={() => {
                      setShowEditDropdown(false);
                      handleDeleteCurrentList();
                    }}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                    <Text style={[styles.listOptionText, { color: '#EF4444', fontWeight: '700' }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })()}

        <ScrollView style={styles.listDetailContent}>
          {list.entries.length === 0 ? (
            <View style={[styles.placeholderContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                No items in this list yet. Use the + button on brands, businesses, or values to add them here.
              </Text>
            </View>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={list.entries.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <View style={styles.listEntriesContainer}>
                  {list.entries.map((entry, entryIndex) => {
                    // Sortable Item Component
                    const SortableEntry = () => {
                      const {
                        attributes,
                        listeners,
                        setNodeRef,
                        transform,
                        transition,
                        isDragging,
                      } = useSortable({ id: entry.id, disabled: !isEditMode || isMobileScreen });

                      const style = {
                        transform: CSS.Transform.toString(transform),
                        transition,
                        opacity: isDragging ? 0.5 : 1,
                      };

                      // Render based on entry type
                      if (entry.type === 'brand' && 'brandId' in entry) {
                        // Get brand score and alignment
                        const brandScore = scoredBrands.get(entry.brandId) || 0;
                        const brand = allSupportFull.find(b => b.id === entry.brandId) || allAvoidFull.find(b => b.id === entry.brandId);
                        const isAligned = allSupportFull.some(b => b.id === entry.brandId);
                        const cardBgColor = getEntryCardBackgroundColor(entryIndex);

                        return (
                          <TouchableOpacity
                            key={entry.id}
                            ref={setNodeRef as any}
                            style={[
                              styles.listEntryCard,
                              { backgroundColor: cardBgColor },
                              style as any
                            ]}
                            onPress={() => !isEditMode && router.push(`/brand/${entry.brandId}`)}
                            activeOpacity={0.7}
                            disabled={isEditMode}
                          >
                            <Image
                              source={{ uri: entry.logoUrl || getLogoUrl(entry.website || (entry.type === 'brand' && 'brandId' in entry ? getBrandWebsite(entry.brandId) : '') || '') }}
                              style={styles.listEntryCardImage}
                              contentFit="cover"
                              transition={200}
                              cachePolicy="memory-disk"
                            />
                            <View style={styles.listEntryCardContent}>
                              <View style={styles.listEntryCardFirstLine}>
                                <Text style={[styles.listEntryCardNumber, { color: colors.text }]}>{entryIndex + 1}.</Text>
                                <Text style={[styles.listEntryCardName, { color: colors.text }]} numberOfLines={1}>
                                  {entry.brandName || getBrandName(entry.brandId)}
                                </Text>
                              </View>
                              <Text style={[styles.listEntryCardCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                                Brand
                              </Text>
                            </View>
                            {!isEditMode && (
                              <View style={styles.listEntryCardScore}>
                                <Text style={[styles.listEntryCardScoreText, { color: colors.text }]}>{brandScore}</Text>
                              </View>
                            )}
                            {!isEditMode && (
                              <TouchableOpacity
                                style={styles.listEntryOptionsButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setActiveItemOptionsMenu(activeItemOptionsMenu === entry.id ? null : entry.id);
                                }}
                                activeOpacity={0.7}
                              >
                                <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                              </TouchableOpacity>
                            )}
                            {isEditMode && isMobileScreen && (
                              <View style={styles.listCardRearrangeButtons}>
                                <TouchableOpacity
                                  onPress={() => handleMoveEntryUp(entryIndex)}
                                  disabled={entryIndex === 0}
                                  style={styles.rearrangeButton}
                                  activeOpacity={0.7}
                                >
                                  <ChevronUp
                                    size={20}
                                    color={entryIndex === 0 ? colors.textSecondary : colors.text}
                                    strokeWidth={2}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleMoveEntryDown(entryIndex)}
                                  disabled={entryIndex === list.entries.length - 1}
                                  style={styles.rearrangeButton}
                                  activeOpacity={0.7}
                                >
                                  <ChevronDown
                                    size={20}
                                    color={entryIndex === list.entries.length - 1 ? colors.textSecondary : colors.text}
                                    strokeWidth={2}
                                  />
                                </TouchableOpacity>
                              </View>
                            )}
                            {isEditMode && !isMobileScreen && (
                              <View
                                {...attributes}
                                {...listeners}
                                style={styles.dragHandle}
                              >
                                <GripVertical size={20} color={colors.textSecondary} strokeWidth={2} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                } else if (entry.type === 'business' && 'businessId' in entry) {
                  // Get normalized business score (matching business details page)
                  const alignmentScore = businessScoresMap.get(entry.businessId) || 50;
                  const isAligned = alignmentScore >= 50;
                  const cardBgColor = getEntryCardBackgroundColor(entryIndex);

                  return (
                    <TouchableOpacity
                      key={entry.id}
                      ref={setNodeRef as any}
                      style={[
                        styles.listEntryCard,
                        { backgroundColor: cardBgColor },
                        style as any
                      ]}
                      onPress={() => !isEditMode && handleBusinessPress(entry.businessId)}
                      activeOpacity={0.7}
                      disabled={isEditMode}
                    >
                      <Image
                        source={{ uri: entry.logoUrl || getLogoUrl(entry.website || '') }}
                        style={styles.listEntryCardImage}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                      <View style={styles.listEntryCardContent}>
                        <View style={styles.listEntryCardFirstLine}>
                          <Text style={[styles.listEntryCardNumber, { color: colors.text }]}>{entryIndex + 1}.</Text>
                          <Text style={[styles.listEntryCardName, { color: colors.text }]} numberOfLines={1}>
                            {entry.businessName || getBusinessName(entry.businessId)}
                          </Text>
                        </View>
                        <Text style={[styles.listEntryCardCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                          Business
                        </Text>
                      </View>
                      {!isEditMode && (
                        <View style={styles.listEntryCardScore}>
                          <Text style={[styles.listEntryCardScoreText, { color: colors.text }]}>{alignmentScore}</Text>
                        </View>
                      )}
                      {!isEditMode && (
                        <TouchableOpacity
                          style={styles.listEntryOptionsButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            setActiveItemOptionsMenu(activeItemOptionsMenu === entry.id ? null : entry.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>
                      )}
                      {isEditMode && isMobileScreen && (
                        <View style={styles.listCardRearrangeButtons}>
                          <TouchableOpacity
                            onPress={() => handleMoveEntryUp(entryIndex)}
                            disabled={entryIndex === 0}
                            style={styles.rearrangeButton}
                            activeOpacity={0.7}
                          >
                            <ChevronUp
                              size={20}
                              color={entryIndex === 0 ? colors.textSecondary : colors.text}
                              strokeWidth={2}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleMoveEntryDown(entryIndex)}
                            disabled={entryIndex === list.entries.length - 1}
                            style={styles.rearrangeButton}
                            activeOpacity={0.7}
                          >
                            <ChevronDown
                              size={20}
                              color={entryIndex === list.entries.length - 1 ? colors.textSecondary : colors.text}
                              strokeWidth={2}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                      {isEditMode && !isMobileScreen && (
                        <View
                          {...attributes}
                          {...listeners}
                          style={styles.dragHandle}
                        >
                          <GripVertical size={20} color={colors.textSecondary} strokeWidth={2} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                } else if (entry.type === 'value' && 'valueId' in entry && 'mode' in entry) {
                  const isMaxPain = entry.mode === 'maxPain';
                  const borderColor = isMaxPain ? colors.danger : colors.success;
                  return (
                    <View
                      key={entry.id}
                      ref={setNodeRef as any}
                      style={[styles.listEntryRow, style as any]}
                    >
                      <Text style={[styles.listEntryNumber, { color: colors.textSecondary }]}>
                        {entryIndex + 1}
                      </Text>
                      <View style={styles.listEntryWrapper}>
                      <TouchableOpacity
                        style={[styles.valueRow, { backgroundColor: colors.backgroundSecondary }]}
                        onPress={() => !isEditMode && router.push(`/value/${entry.valueId}`)}
                        activeOpacity={0.7}
                        disabled={isEditMode}
                      >
                        <View style={[styles.valueNameBox, { borderColor }]}>
                          <Text style={[styles.valueNameText, { color: borderColor }]} numberOfLines={1}>
                            {entry.valueName}
                          </Text>
                        </View>
                        <View style={styles.valueRowActions}>
                          {!isEditMode && (
                            <TouchableOpacity
                              style={styles.listEntryOptionsButton}
                              onPress={() => setActiveItemOptionsMenu(activeItemOptionsMenu === entry.id ? null : entry.id)}
                              activeOpacity={0.7}
                            >
                              <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                            </TouchableOpacity>
                          )}
                          {isEditMode && isMobileScreen && (
                            <View style={styles.listCardRearrangeButtons}>
                              <TouchableOpacity
                                onPress={() => handleMoveEntryUp(entryIndex)}
                                disabled={entryIndex === 0}
                                style={styles.rearrangeButton}
                                activeOpacity={0.7}
                              >
                                <ChevronUp
                                  size={20}
                                  color={entryIndex === 0 ? colors.textSecondary : colors.text}
                                  strokeWidth={2}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleMoveEntryDown(entryIndex)}
                                disabled={entryIndex === list.entries.length - 1}
                                style={styles.rearrangeButton}
                                activeOpacity={0.7}
                              >
                                <ChevronDown
                                  size={20}
                                  color={entryIndex === list.entries.length - 1 ? colors.textSecondary : colors.text}
                                  strokeWidth={2}
                                />
                              </TouchableOpacity>
                            </View>
                          )}
                          {isEditMode && !isMobileScreen && (
                            <View
                              {...attributes}
                              {...listeners}
                              style={styles.dragHandle}
                            >
                              <GripVertical size={20} color={colors.textSecondary} strokeWidth={2} />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                      </View>
                    </View>
                  );
                
                  // Default render for link and text entries
                  return (
                    <View
                      key={entry.id}
                      ref={setNodeRef as any}
                      style={[styles.listEntryRow, style as any]}
                    >
                      <Text style={[styles.listEntryNumber, { color: colors.textSecondary }]}>
                        {entryIndex + 1}
                      </Text>
                      <View style={styles.listEntryWrapper}>
                      <View style={[styles.listEntryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                        <TouchableOpacity
                          style={styles.listEntryClickable}
                          onPress={() => !isEditMode && handleEntryClick(entry)}
                          activeOpacity={0.7}
                          disabled={isEditMode}
                        >
                          <View style={styles.listEntryContent}>
                            <Text style={[styles.listEntryType, { color: colors.textSecondary }]}>
                              {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                            </Text>
                            <Text style={[styles.listEntryName, { color: colors.text }]}>
                              {'title' in entry ? entry.title :
                               'content' in entry ? entry.content : 'Entry'}
                            </Text>
                            {entry.type === 'link' && 'url' in entry && (
                              <View style={styles.linkUrlContainer}>
                                <ExternalLink size={14} color={colors.textSecondary} strokeWidth={2} />
                                <Text style={[styles.linkUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {entry.url}
                                </Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                        {!isEditMode && (
                          <TouchableOpacity
                            style={styles.listEntryOptionsButton}
                            onPress={() => setActiveItemOptionsMenu(activeItemOptionsMenu === entry.id ? null : entry.id)}
                            activeOpacity={0.7}
                          >
                            <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                          </TouchableOpacity>
                        )}
                        {isEditMode && isMobileScreen && (
                          <View style={styles.listCardRearrangeButtons}>
                            <TouchableOpacity
                              onPress={() => handleMoveEntryUp(entryIndex)}
                              disabled={entryIndex === 0}
                              style={styles.rearrangeButton}
                              activeOpacity={0.7}
                            >
                              <ChevronUp
                                size={20}
                                color={entryIndex === 0 ? colors.textSecondary : colors.text}
                                strokeWidth={2}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleMoveEntryDown(entryIndex)}
                              disabled={entryIndex === list.entries.length - 1}
                              style={styles.rearrangeButton}
                              activeOpacity={0.7}
                            >
                              <ChevronDown
                                size={20}
                                color={entryIndex === list.entries.length - 1 ? colors.textSecondary : colors.text}
                                strokeWidth={2}
                              />
                            </TouchableOpacity>
                          </View>
                        )}
                        {isEditMode && !isMobileScreen && (
                          <View
                            {...attributes}
                            {...listeners}
                            style={styles.dragHandle}
                          >
                            <GripVertical size={20} color={colors.textSecondary} strokeWidth={2} />
                          </View>
                        )}
                      </View>
                      </View>
                    </View>
                  );
                }

                return null;
              };

                    // Return the sortable entry component
                    return <SortableEntry key={entry.id} />;
                  })}
                </View>
              </SortableContext>
            </DndContext>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderMyLibraryView = () => {
    // Use UnifiedLibrary component with endorsementOnly mode
    // Global and Local sections have been moved to Browse tab
    return (
      <UnifiedLibrary
        mode="edit"
        currentUserId={clerkUser?.id}
        alignedItems={allSupport}
        unalignedItems={allAvoidFull}
        isDarkMode={isDarkMode}
        profileImage={profile?.userDetails?.profileImage || clerkUser?.imageUrl}
        userBusinesses={userBusinesses}
        scoredBrands={scoredBrands}
        userCauses={profile?.causes || []}
        userLocation={userLocation}
        onRequestLocation={requestLocation}
        followingCount={followingCount}
        followersCount={followersCount}
        endorsementOnly={true}
        initialShowAddModal={params.openAddModal === 'true'}
      />
    );
  };

  const renderMapView = () => {
    // Simple OpenStreetMap iframe embed — SSR-safe and dependency-free
    const defaultLat = 37.7749;
    const defaultLng = 122.4194; // <--- note: corrected to 122.4194 for marker/center; original file had -122.4194 in some versions
    const bbox = `${defaultLng - 0.05},${defaultLat - 0.03},${defaultLng + 0.05},${defaultLat + 0.03}`;
    const marker = `${defaultLat}%2C${defaultLng}`;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;

    return (
      <View style={{ marginBottom: 16 }}>
        {/* @ts-ignore */}
        <iframe
          title="map"
          src={src}
          style={{
            border: 0,
            width: '100%',
            height: 420,
            borderRadius: 12,
            overflow: 'hidden',
          }}
          loading="lazy"
        />
      </View>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <MenuButton />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Loading brands...</Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <MenuButton />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Error loading brands</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {error.message || 'Please try again later'}
          </Text>
        </View>
      </View>
    );
  }

  // Always show the library view - users no longer need values to use the app
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={[styles.stickyHeaderContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerCounters}>
            <TouchableOpacity style={styles.headerCounterButton} onPress={() => openFollowersModal('following')} activeOpacity={0.7}>
              <Text style={[styles.headerCounterNumber, { color: colors.text }]}>{followingCount}</Text>
              <Text style={[styles.headerCounterLabel, { color: colors.textSecondary }]}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerCounterButton} onPress={() => openFollowersModal('followers')} activeOpacity={0.7}>
              <Text style={[styles.headerCounterNumber, { color: colors.text }]}>{followersCount}</Text>
              <Text style={[styles.headerCounterLabel, { color: colors.textSecondary }]}>Followers</Text>
            </TouchableOpacity>
          </View>
          <MenuButton />
        </View>
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {mainView === 'forYou' && renderForYouView()}
        {mainView === 'myLibrary' && renderMyLibraryView()}

      </ScrollView>

      {/* Invisible overlay to close dropdown when clicking outside */}
      {/* Library Card Options Modal */}
      <Modal
        visible={activeCardOptionsMenu !== null && !isLibraryReorderMode}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveCardOptionsMenu(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActiveCardOptionsMenu(null)}>
          <View style={styles.dropdownModalOverlay}>
            <View style={[styles.dropdownModalContent, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {(() => {
                // Check if this is the User Name list (personal list)
                const activeList = userLists.find(l => l.id === activeCardOptionsMenu);
                if (!activeList) return null;

                // Get user's name to identify personal list
                const fullNameFromFirebase = profile?.userDetails?.name;
                const fullNameFromClerk = clerkUser?.unsafeMetadata?.fullName as string;
                const firstNameLastName = clerkUser?.firstName && clerkUser?.lastName
                  ? `${clerkUser.firstName} ${clerkUser.lastName}`
                  : '';
                const firstName = clerkUser?.firstName;
                const userName = fullNameFromFirebase || fullNameFromClerk || firstNameLastName || firstName || '';
                const isPersonalList = activeList.name === userName;

                // For personal list, only show Description option
                if (isPersonalList) {
                  return (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveCardOptionsMenu(null);
                        setDescriptionText(activeList.description || '');
                        setSelectedList(activeList);
                        setShowDescriptionModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Edit size={18} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Description</Text>
                    </TouchableOpacity>
                  );
                }

                // For other lists, show all options
                return (
                  <>
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        handleOpenCardRenameModal(activeList.id, activeList.name, activeList.description || '');
                      }}
                      activeOpacity={0.7}
                    >
                      <Edit size={18} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Rename</Text>
                    </TouchableOpacity>
                    <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveCardOptionsMenu(null);
                        setIsLibraryReorderMode(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <ChevronUp size={18} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Reorder</Text>
                    </TouchableOpacity>
                    <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveCardOptionsMenu(null);
                        setDescriptionText(activeList.description || '');
                        setSelectedList(activeList);
                        setShowDescriptionModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Edit size={18} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Description</Text>
                    </TouchableOpacity>
                    <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        if (activeCardOptionsMenu) {
                          handleToggleListPrivacy(activeCardOptionsMenu, activeList.isPublic);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {activeList.isPublic ? (
                        <Lock size={18} color={colors.text} strokeWidth={2} />
                      ) : (
                        <Globe size={18} color={colors.text} strokeWidth={2} />
                      )}
                      <Text style={[styles.listOptionText, { color: colors.text }]}>
                        Make {activeList.isPublic ? 'Private' : 'Public'}
                      </Text>
                    </TouchableOpacity>
                    <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        console.log('[Home] Delete list pressed, ID:', activeCardOptionsMenu);
                        if (activeCardOptionsMenu) {
                          handleCardDeleteList(activeCardOptionsMenu);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: '#EF4444', fontWeight: '700' }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* List Item Options Modal */}
      <Modal
        visible={activeItemOptionsMenu !== null && !isEditMode}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveItemOptionsMenu(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActiveItemOptionsMenu(null)}>
          <View style={styles.dropdownModalOverlay}>
            <View style={[styles.dropdownModalContent, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {(() => {
                // Find the entry to get its details
                if (!activeItemOptionsMenu || !selectedList) return null;
                const list = selectedList;
                const entry = list.entries.find(e => e.id === activeItemOptionsMenu);
                if (!entry) return null;

                return (
                  <>
                    {/* Add to option - only for brand/business entries */}
                    {(entry.type === 'brand' || entry.type === 'business') && (
                      <>
                        <TouchableOpacity
                          style={styles.listOptionItem}
                          onPress={() => {
                            if (entry.type === 'brand' && 'brandId' in entry) {
                              setActiveItemOptionsMenu(null);
                              handleQuickAdd('brand', entry.brandId, entry.brandName, entry.website, entry.logoUrl);
                            } else if (entry.type === 'business' && 'businessId' in entry) {
                              setActiveItemOptionsMenu(null);
                              handleQuickAdd('business', entry.businessId, entry.businessName, entry.website, entry.logoUrl);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Plus size={18} color={colors.text} strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: colors.text }]}>Add to</Text>
                        </TouchableOpacity>
                        <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                      </>
                    )}

                    {/* Reorder option - only for user's own lists */}
                    {list.userId === clerkUser?.id && (
                      <>
                        <TouchableOpacity
                          style={styles.listOptionItem}
                          onPress={() => {
                            setActiveItemOptionsMenu(null);
                            setIsEditMode(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <ChevronUp size={18} color={colors.text} strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: colors.text }]}>Reorder</Text>
                        </TouchableOpacity>
                        <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />

                        {/* Remove option - RED and only for user's own lists */}
                        <TouchableOpacity
                          style={styles.listOptionItem}
                          onPress={() => {
                            console.log('[Home] Delete entry pressed, ID:', activeItemOptionsMenu);
                            if (activeItemOptionsMenu) {
                              handleDeleteEntry(activeItemOptionsMenu);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: '#EF4444', fontWeight: '700' }]}>Remove</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {/* Share option - only for brand/business entries */}
                    {(entry.type === 'brand' || entry.type === 'business') && (
                      <>
                        {list.userId === clerkUser?.id && (
                          <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />
                        )}
                        <TouchableOpacity
                          style={styles.listOptionItem}
                          onPress={async () => {
                            setActiveItemOptionsMenu(null);
                            const itemType = entry.type;
                            const itemId = entry.type === 'brand' && 'brandId' in entry ? entry.brandId :
                                          entry.type === 'business' && 'businessId' in entry ? entry.businessId : '';
                            const itemName = entry.type === 'brand' && 'brandName' in entry ? entry.brandName :
                                           entry.type === 'business' && 'businessName' in entry ? entry.businessName : '';

                            const shareLink = `https://iendorse.app/${itemType}/${itemId}`;

                            // Show ShareModal with platform options
                            setShareData({
                              url: shareLink,
                              title: itemName,
                              description: `Check out ${itemName} on Endorse Money`
                            });
                            setShowShareModal(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Share2 size={18} color={colors.text} strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: colors.text }]}>Share</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                );
              })()}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Card Three-Dot Menu Modal (for brands/businesses in support/avoid sections) */}
      <Modal
        visible={activeCardMenuId !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveCardMenuId(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActiveCardMenuId(null)}>
          <View style={styles.dropdownModalOverlay}>
            <View style={[styles.dropdownModalContent, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {/* Endorse/Unendorse option */}
              {(() => {
                const isEndorsed = cardMenuData ? isItemEndorsed(cardMenuData.id, cardMenuData.type) : false;
                const endorseColor = isEndorsed ? colors.danger : colors.text;

                return (
                  <TouchableOpacity
                    style={styles.listOptionItem}
                    onPress={handleCardMenuAddTo}
                    activeOpacity={0.7}
                  >
                    <UserPlus size={18} color={endorseColor} strokeWidth={2} />
                    <Text style={[styles.listOptionText, { color: endorseColor }]}>
                      {isEndorsed ? 'Unendorse' : 'Endorse'}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
              <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />

              {/* Follow option - for both brands and businesses */}
              <TouchableOpacity
                style={styles.listOptionItem}
                onPress={handleCardMenuFollow}
                activeOpacity={0.7}
              >
                <UserPlus size={18} color={colors.text} strokeWidth={2} />
                <Text style={[styles.listOptionText, { color: colors.text }]}>
                  {isFollowingCard ? 'Unfollow' : 'Follow'}
                </Text>
              </TouchableOpacity>
              <View style={[styles.listOptionDivider, { backgroundColor: colors.border }]} />

              {/* Share option */}
              <TouchableOpacity
                style={styles.listOptionItem}
                onPress={handleCardMenuShare}
                activeOpacity={0.7}
              >
                <Share2 size={18} color={colors.text} strokeWidth={2} />
                <Text style={[styles.listOptionText, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Create List Modal */}
      <Modal
        visible={showCreateListModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreateListModal(false);
          setNewListName('');
          setNewListDescription('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowCreateListModal(false);
              setNewListName('');
              setNewListDescription('');
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.createListModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create New List</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateListModal(false);
                  setNewListName('');
                  setNewListDescription('');
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>List Name *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter list name"
                placeholderTextColor={colors.textSecondary}
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />

              <Text style={[styles.modalLabel, { color: colors.text }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalTextArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter list description"
                placeholderTextColor={colors.textSecondary}
                value={newListDescription}
                onChangeText={setNewListDescription}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  console.log('[Home] Create List button pressed!');
                  handleCreateList();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>Create List</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Rename List Modal */}
      <Modal
        visible={showRenameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowRenameModal(false);
          setRenameListName('');
          setRenameListDescription('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowRenameModal(false);
              setRenameListName('');
              setRenameListDescription('');
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.createListModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Rename List</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRenameModal(false);
                  setRenameListName('');
                  setRenameListDescription('');
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>List Name *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter list name"
                placeholderTextColor={colors.textSecondary}
                value={renameListName}
                onChangeText={setRenameListName}
                autoFocus
              />

              <Text style={[styles.modalLabel, { color: colors.text }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalTextArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter list description"
                placeholderTextColor={colors.textSecondary}
                value={renameListDescription}
                onChangeText={setRenameListDescription}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleRenameList}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Description Modal */}
      <Modal
        visible={showDescriptionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowDescriptionModal(false);
          setDescriptionText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowDescriptionModal(false);
              setDescriptionText('');
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.createListModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Description</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDescriptionModal(false);
                  setDescriptionText('');
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.modalTextArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter list description"
                placeholderTextColor={colors.textSecondary}
                value={descriptionText}
                onChangeText={setDescriptionText}
                multiline
                numberOfLines={3}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleUpdateDescription}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* List Creation Type Selection Modal */}
      <Modal
        visible={showListCreationTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowListCreationTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowListCreationTypeModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.quickAddModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create List</Text>
              <TouchableOpacity onPress={() => setShowListCreationTypeModal(false)}>
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowListCreationTypeModal(false);
                  setShowCreateListModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>Create Manually</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                onPress={() => {
                  setShowListCreationTypeModal(false);
                  setShowValuesSelectionModal(true);
                  setSelectedValuesForList([]);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Create from Values</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* New List Choice Modal - for Aligned/Unaligned/All Lists subsections */}
      <Modal
        visible={showNewListChoiceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewListChoiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowNewListChoiceModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.quickAddModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Options</Text>
              <TouchableOpacity onPress={() => setShowNewListChoiceModal(false)}>
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowNewListChoiceModal(false);
                  setShowCreateListModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>Blank List</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                onPress={() => {
                  setShowNewListChoiceModal(false);
                  setShowValuesSelectionModal(true);
                  setSelectedValuesForList([]);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>List from Values</Text>
              </TouchableOpacity>

              {/* Show these options only in For You view and if there's a selected list */}
              {mainView === 'forYou' && expandedListId && (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                    onPress={() => {
                      setShowNewListChoiceModal(false);
                      setShowAddItemModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.text }]}>Add to This List</Text>
                  </TouchableOpacity>

                  {(() => {
                    // Get the current list
                    let currentList: UserList | null = null;
                    if (expandedListId === 'endorsement') {
                      currentList = userPersonalList;
                    } else if (expandedListId !== 'aligned' && expandedListId !== 'unaligned') {
                      currentList = userLists.find(l => l.id === expandedListId) || null;
                    }

                    // Only show reorder and share for actual user lists (not Aligned/Unaligned)
                    if (currentList) {
                      return (
                        <>
                          <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                            onPress={() => {
                              setShowNewListChoiceModal(false);
                              setIsEditMode(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.modalButtonText, { color: colors.text }]}>Reorder</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                            onPress={() => {
                              setShowNewListChoiceModal(false);
                              handleShareList(currentList);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.modalButtonText, { color: colors.text }]}>Share</Text>
                          </TouchableOpacity>
                        </>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* My List Options Modal - for My List view */}
      <Modal
        visible={showMyListOptionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMyListOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowMyListOptionsModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.quickAddModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Options</Text>
              <TouchableOpacity onPress={() => setShowMyListOptionsModal(false)}>
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowMyListOptionsModal(false);
                  setShowCreateListModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>Blank List</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                onPress={() => {
                  setShowMyListOptionsModal(false);
                  setShowValuesSelectionModal(true);
                  setSelectedValuesForList([]);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>List from Values</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                onPress={() => {
                  setShowMyListOptionsModal(false);
                  setSelectedList(userPersonalList);
                  setShowAddItemModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Add to this List</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                onPress={() => {
                  setShowMyListOptionsModal(false);
                  setIsMyListReorderMode(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Reorder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary, marginTop: 12 }]}
                onPress={() => {
                  setShowMyListOptionsModal(false);
                  handleShareList(userPersonalList);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Value Mode Selection Modal */}
      <Modal
        visible={showValueModeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowValueModeModal(false);
          setQuickAddItem(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowValueModeModal(false);
              setQuickAddItem(null);
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.quickAddModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add to Library
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowValueModeModal(false);
                  setQuickAddItem(null);
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>
                Choose how to add {quickAddItem?.name}:
              </Text>

              <TouchableOpacity
                style={[styles.valueModeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={() => handleValueModeSelected('maxPain')}
                activeOpacity={0.7}
              >
                <View style={styles.valueModeContent}>
                  <Text style={[styles.valueModeTitle, { color: colors.danger }]}>Max Pain</Text>
                  <Text style={[styles.valueModeDescription, { color: colors.textSecondary }]}>
                    Add brands that are unaligned with this value
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.valueModeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={() => handleValueModeSelected('maxBenefit')}
                activeOpacity={0.7}
              >
                <View style={styles.valueModeContent}>
                  <Text style={[styles.valueModeTitle, { color: colors.success }]}>Max Benefit</Text>
                  <Text style={[styles.valueModeDescription, { color: colors.textSecondary }]}>
                    Add brands that are aligned with this value
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Quick Add Modal - Choose List */}
      <Modal
        visible={showQuickAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowQuickAddModal(false);
          setQuickAddItem(null);
          setSelectedValueMode(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowQuickAddModal(false);
              setQuickAddItem(null);
              setSelectedValueMode(null);
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.quickAddModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add to List
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowQuickAddModal(false);
                  setQuickAddItem(null);
                  setSelectedValueMode(null);
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={[styles.quickAddItemName, { color: colors.primary }]}>
                {quickAddItem?.name}
                {quickAddItem?.type === 'value' && selectedValueMode && (
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {' '}({selectedValueMode === 'maxPain' ? 'Max Pain' : 'Max Benefit'})
                  </Text>
                )}
              </Text>

              <Text style={[styles.modalLabel, { color: colors.text, marginTop: 16 }]}>
                Select a list:
              </Text>

              {userLists.length === 0 ? (
                <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                  You don't have any lists yet. Create one below!
                </Text>
              ) : (
                <View style={styles.quickAddListsContainer}>
                  {(() => {
                    // Find endorsement list (personal list) - matches user name or is oldest list
                    const userName = clerkUser?.firstName || clerkUser?.username || 'My List';
                    let endorsementList = userLists.find(list => list.name === userName);

                    // If not found by name, use the oldest list as the endorsement list
                    if (!endorsementList && userLists.length > 0) {
                      const sortedByAge = [...userLists].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                      endorsementList = sortedByAge[0];
                    }

                    // Separate endorsement list from other lists
                    const otherLists = userLists.filter(list => list.id !== endorsementList?.id);

                    return (
                      <>
                        {/* Endorsement List - Pinned at top */}
                        {endorsementList && (
                          <TouchableOpacity
                            key={endorsementList.id}
                            style={[styles.quickAddListItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary, borderWidth: 2 }]}
                            onPress={() => handleAddToList(endorsementList.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.listIconContainer, { backgroundColor: colors.primaryLight + '20' }]}>
                              <List size={18} color={colors.primary} strokeWidth={2} />
                            </View>
                            <View style={styles.quickAddListInfo}>
                              <Text style={[styles.quickAddListName, { color: colors.text }]} numberOfLines={1}>
                                {endorsementList.name}
                              </Text>
                              <Text style={[styles.quickAddListCount, { color: colors.textSecondary }]}>
                                {endorsementList.entries.length} {endorsementList.entries.length === 1 ? 'item' : 'items'}
                              </Text>
                            </View>
                            <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                          </TouchableOpacity>
                        )}

                        {/* Other Lists */}
                        {otherLists.map((list) => (
                          <TouchableOpacity
                            key={list.id}
                            style={[styles.quickAddListItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                            onPress={() => handleAddToList(list.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.listIconContainer, { backgroundColor: colors.primaryLight + '20' }]}>
                              <List size={18} color={colors.primary} strokeWidth={2} />
                            </View>
                            <View style={styles.quickAddListInfo}>
                              <Text style={[styles.quickAddListName, { color: colors.text }]} numberOfLines={1}>
                                {list.name}
                              </Text>
                              <Text style={[styles.quickAddListCount, { color: colors.textSecondary }]}>
                                {list.entries.length} {list.entries.length === 1 ? 'item' : 'items'}
                              </Text>
                            </View>
                            <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                          </TouchableOpacity>
                        ))}
                      </>
                    );
                  })()}
                </View>
              )}

              <View style={styles.dividerContainer}>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              </View>

              <Text style={[styles.modalLabel, { color: colors.text }]}>Create new list:</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="List name"
                placeholderTextColor={colors.textSecondary}
                value={newListName}
                onChangeText={setNewListName}
              />

              <TextInput
                style={[styles.modalTextArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textSecondary}
                value={newListDescription}
                onChangeText={setNewListDescription}
                multiline
                numberOfLines={2}
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateAndAddToList}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>
                  Create List & Add Item
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </View>
      </Modal>

      {/* Values Selection Modal */}
      <Modal
        visible={showValuesSelectionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowValuesSelectionModal(false);
          setSelectedValuesForList([]);
          setValuesListName('');
          setValuesListDescription('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowValuesSelectionModal(false);
              setSelectedValuesForList([]);
              setValuesListName('');
              setValuesListDescription('');
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.createListModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Values
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowValuesSelectionModal(false);
                  setSelectedValuesForList([]);
                  setValuesListName('');
                  setValuesListDescription('');
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                Select at least 5 values to create a list of the top 20 most aligned brands.
              </Text>

              {/* Custom Name and Description Fields */}
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  List Name (optional)
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  placeholder="Leave blank for auto-generated name"
                  placeholderTextColor={colors.textSecondary}
                  value={valuesListName}
                  onChangeText={setValuesListName}
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Description (optional)
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  placeholder="Leave blank for auto-generated description"
                  placeholderTextColor={colors.textSecondary}
                  value={valuesListDescription}
                  onChangeText={setValuesListDescription}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <Text style={[styles.selectedCountText, { color: colors.primary }]}>
                {selectedValuesForList.length} selected {selectedValuesForList.length >= 5 ? '✓' : `(${5 - selectedValuesForList.length} more needed)`}
              </Text>

              {/* Group values by category */}
              <View style={styles.valuesGrid}>
                {(['ideology', 'social_issue', 'person', 'religion', 'nation'] as const).map(category => {
                  const categoryValues = AVAILABLE_VALUES[category] || [];
                  if (categoryValues.length === 0) return null;

                  const categoryLabels = {
                    ideology: 'Ideology',
                    social_issue: 'Social Issues',
                    person: 'People',
                    religion: 'Religion',
                    nation: 'Nations & States'
                  };

                  return (
                    <View key={category} style={styles.valueCategory}>
                      <Text style={[styles.valueCategoryTitle, { color: colors.text }]}>
                        {categoryLabels[category]}
                      </Text>
                      <View style={styles.valuesButtonsContainer}>
                        {categoryValues.map((value) => {
                          const selectedValue = selectedValuesForList.find(sv => sv.id === value.id);
                          const selectionState = selectedValue ? selectedValue.type : null;

                          return (
                            <TouchableOpacity
                              key={value.id}
                              style={[
                                styles.valueChip,
                                {
                                  backgroundColor: selectionState === 'support' ? colors.success || colors.primary :
                                                 selectionState === 'avoid' ? colors.danger :
                                                 colors.backgroundSecondary,
                                  borderColor: selectionState === 'support' ? colors.success || colors.primary :
                                             selectionState === 'avoid' ? colors.danger :
                                             colors.border,
                                }
                              ]}
                              onPress={() => {
                                if (selectionState === null) {
                                  // Not selected -> Support
                                  setSelectedValuesForList(prev => [...prev, { id: value.id, type: 'support' }]);
                                } else if (selectionState === 'support') {
                                  // Support -> Avoid
                                  setSelectedValuesForList(prev =>
                                    prev.map(sv => sv.id === value.id ? { ...sv, type: 'avoid' } : sv)
                                  );
                                
                                  // Avoid -> Not selected
                                  setSelectedValuesForList(prev => prev.filter(sv => sv.id !== value.id));
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.valueChipText,
                                  { color: selectionState ? colors.white : colors.text }
                                ]}
                              >
                                {selectionState === 'support' ? '✓ ' : selectionState === 'avoid' ? '✗ ' : ''}{value.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: selectedValuesForList.length >= 5 ? colors.primary : colors.neutralLight,
                    marginTop: 24,
                  }
                ]}
                onPress={handleCreateListFromValues}
                disabled={selectedValuesForList.length < 5}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>
                  Create List
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </View>
      </Modal>

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMapModal(false)}
      >
        <TouchableOpacity
          style={styles.mapModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMapModal(false)}
        >
          <Pressable
            style={[styles.mapModalContainer, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <View style={[styles.mapModalHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <Text style={[styles.mapModalTitle, { color: colors.text }]}>
                {localDistance === null
                  ? 'All Local Businesses'
                  : `Local Businesses (${localDistance} mile${localDistance !== 1 ? 's' : ''})`}
              </Text>
              <TouchableOpacity
                style={[styles.mapModalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowMapModal(false)}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

          {/* Map */}
          <View style={styles.mapModalContent}>
            {userLocation && localBusinessData.alignedBusinesses.length + localBusinessData.unalignedBusinesses.length > 0 ? (
              <BusinessMapView
                businesses={[...localBusinessData.alignedBusinesses, ...localBusinessData.unalignedBusinesses]}
                userLocation={userLocation}
                distanceRadius={localDistance || 999999}
                onBusinessPress={(businessId) => {
                  setShowMapModal(false);
                  router.push({
                    pathname: '/business/[id]',
                    params: { id: businessId, fromMap: 'true' },
                  });
                }}
              />
            ) : (
              <View style={styles.mapModalEmpty}>
                <MapPin size={48} color={colors.textSecondary} strokeWidth={1.5} />
                <Text style={[styles.mapModalEmptyText, { color: colors.text }]}>
                  {!userLocation
                    ? 'Location access required to view map'
                    : 'No businesses found in this area'}
                </Text>
                {!userLocation && (
                  <TouchableOpacity
                    style={[styles.mapModalEmptyButton, { backgroundColor: colors.primary }]}
                    onPress={requestLocation}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.mapModalEmptyButtonText, { color: colors.white }]}>
                      Enable Location
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          </Pressable>
        </TouchableOpacity>
      </Modal>

      {/* Card Rename Modal - For renaming lists from library overview */}
      <Modal
        visible={showCardRenameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCardRenameModal(false);
          setCardRenameListId(null);
          setCardRenameListName('');
          setCardRenameListDescription('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowCardRenameModal(false);
              setCardRenameListId(null);
              setCardRenameListName('');
              setCardRenameListDescription('');
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.createListModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit List</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCardRenameModal(false);
                  setCardRenameListId(null);
                  setCardRenameListName('');
                  setCardRenameListDescription('');
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>List Name *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter list name"
                placeholderTextColor={colors.textSecondary}
                value={cardRenameListName}
                onChangeText={setCardRenameListName}
                autoFocus
              />

              <Text style={[styles.modalLabel, { color: colors.text }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalTextArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter list description"
                placeholderTextColor={colors.textSecondary}
                value={cardRenameListDescription}
                onChangeText={setCardRenameListDescription}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCardRenameSubmit}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Add Item Selection Modal - Shows 5 type options */}
      <Modal
        visible={showAddItemModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => {
          setShowAddItemModal(false);
          setAddItemType(null);
          setAddItemSearchQuery('');
          setLinkUrl('');
          setShowAddItemRequest(false);
          setAddItemRequestInput('');
          setShowAddItemRequestSuccess(false);
          setLinkTitle('');
          setTextContent('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowAddItemModal(false);
              setAddItemType(null);
              setAddItemSearchQuery('');
              setLinkUrl('');
              setShowAddItemRequest(false);
              setAddItemRequestInput('');
              setShowAddItemRequestSuccess(false);
              setLinkTitle('');
              setTextContent('');
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.createListModalContainer, styles.addItemModalFixed, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {!addItemType ? 'Add Item' : `Add ${addItemType.charAt(0).toUpperCase() + addItemType.slice(1)}`}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (addItemType) {
                    setAddItemType(null);
                    setAddItemSearchQuery('');
                    setLinkUrl('');
                    setLinkTitle('');
                    setShowAddItemRequest(false);
                    setAddItemRequestInput('');
                    setShowAddItemRequestSuccess(false);

                    setShowAddItemModal(false);
                  }
                }}
              >
                {addItemType ? <ArrowLeft size={24} color={colors.text} strokeWidth={2} /> : <X size={24} color={colors.text} strokeWidth={2} />}
              </TouchableOpacity>
            </View>

            {/* Fixed search input for brand/business/value */}
            {(addItemType === 'brand' || addItemType === 'business' || addItemType === 'value') && (
              <View style={styles.fixedSearchInputContainer}>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  placeholder={`Search ${addItemType}s...`}
                  placeholderTextColor={colors.textSecondary}
                  value={addItemSearchQuery}
                  onChangeText={setAddItemSearchQuery}
                  autoFocus
                />
              </View>
            )}

            <ScrollView style={styles.addItemScrollContainer} contentContainerStyle={styles.modalContentInner} keyboardShouldPersistTaps="handled">
              {!addItemType ? (
                // Show 5 type selection buttons
                <>
                  <TouchableOpacity
                    style={[styles.addItemTypeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => handleAddItemTypeSelected('brand')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addItemTypeText, { color: colors.text }]}>Brand</Text>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addItemTypeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => handleAddItemTypeSelected('business')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addItemTypeText, { color: colors.text }]}>Business</Text>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addItemTypeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => handleAddItemTypeSelected('value')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addItemTypeText, { color: colors.text }]}>Value</Text>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addItemTypeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => handleAddItemTypeSelected('link')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addItemTypeText, { color: colors.text }]}>Link</Text>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addItemTypeButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => handleAddItemTypeSelected('text')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addItemTypeText, { color: colors.text }]}>Text</Text>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                </>
              ) : addItemType === 'brand' ? (
                // Brand search results
                <View style={styles.searchResultsContainer}>
                  {(() => {
                    const filteredBrands = brands?.filter(b => b.name?.toLowerCase().includes(addItemSearchQuery.toLowerCase())).slice(0, 10) || [];
                    if (filteredBrands.length > 0) {
                      return filteredBrands.map(brand => (
                        <TouchableOpacity
                          key={brand.id}
                          style={[styles.searchResultItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                          onPress={() => handleAddItemSubmit({ brandId: brand.id, name: brand.name, website: brand.website, logoUrl: getLogoUrl(brand.website || '') })}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={{ uri: getLogoUrl(brand.website || '') }}
                            style={styles.searchResultLogo}
                            contentFit="cover"
                          />
                          <Text style={[styles.searchResultText, { color: colors.text }]}>{brand.name}</Text>
                        </TouchableOpacity>
                      ));
                    } else if (addItemSearchQuery.trim().length > 0) {
                      // Show request button when no results
                      return (
                        <View style={styles.addItemEmptyState}>
                          {showAddItemRequestSuccess ? (
                            <>
                              <Text style={[styles.addItemEmptyTitle, { color: colors.primary }]}>Request Submitted!</Text>
                              <Text style={[styles.addItemEmptySubtitle, { color: colors.textSecondary }]}>
                                Thank you for your suggestion. We'll review it soon.
                              </Text>
                            </>
                          ) : showAddItemRequest ? (
                            <>
                              <Text style={[styles.addItemEmptyTitle, { color: colors.text }]}>Request a Brand</Text>
                              <TextInput
                                style={[styles.addItemRequestInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                                placeholder="Enter brand name or description..."
                                placeholderTextColor={colors.textSecondary}
                                value={addItemRequestInput}
                                onChangeText={setAddItemRequestInput}
                                multiline
                                autoFocus
                              />
                              <TouchableOpacity
                                style={[styles.addItemRequestSubmitButton, { backgroundColor: colors.primary }]}
                                onPress={async () => {
                                  if (addItemRequestInput.trim() && user?.uid) {
                                    await submitBrandRequest(user.uid, addItemRequestInput.trim(), 'brand');
                                    setShowAddItemRequest(false);
                                    setAddItemRequestInput('');
                                    setShowAddItemRequestSuccess(true);
                                    setTimeout(() => setShowAddItemRequestSuccess(false), 3000);
                                  }
                                }}
                              >
                                <Text style={styles.addItemRequestSubmitText}>Submit Request</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <Text style={[styles.addItemEmptyTitle, { color: colors.text }]}>No brands found</Text>
                              <TouchableOpacity
                                style={[styles.addItemRequestButton, { backgroundColor: colors.primary }]}
                                onPress={() => setShowAddItemRequest(true)}
                              >
                                <Text style={styles.addItemRequestButtonText}>Request</Text>
                              </TouchableOpacity>
                              <Text style={[styles.addItemEmptySubtitle, { color: colors.textSecondary }]}>
                                Submit a brand that we should add
                              </Text>
                            </>
                          )}
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              ) : addItemType === 'business' ? (
                // Business search results
                <View style={styles.searchResultsContainer}>
                  {(() => {
                    const filteredBusinesses = userBusinesses?.filter(b => b.businessInfo?.name?.toLowerCase().includes(addItemSearchQuery.toLowerCase())).slice(0, 10) || [];
                    if (filteredBusinesses.length > 0) {
                      return filteredBusinesses.map(business => (
                        <TouchableOpacity
                          key={business.id}
                          style={[styles.searchResultItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                          onPress={() => handleAddItemSubmit({ businessId: business.id, name: business.businessInfo.name, website: business.businessInfo.website, logoUrl: business.businessInfo.logoUrl || (business.businessInfo.website ? getLogoUrl(business.businessInfo.website) : '') })}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={{ uri: business.businessInfo.logoUrl || (business.businessInfo.website ? getLogoUrl(business.businessInfo.website) : getLogoUrl('')) }}
                            style={styles.searchResultLogo}
                            contentFit="cover"
                          />
                          <Text style={[styles.searchResultText, { color: colors.text }]}>{business.businessInfo.name}</Text>
                        </TouchableOpacity>
                      ));
                    } else if (addItemSearchQuery.trim().length > 0) {
                      // Show request button when no results
                      return (
                        <View style={styles.addItemEmptyState}>
                          {showAddItemRequestSuccess ? (
                            <>
                              <Text style={[styles.addItemEmptyTitle, { color: colors.primary }]}>Request Submitted!</Text>
                              <Text style={[styles.addItemEmptySubtitle, { color: colors.textSecondary }]}>
                                Thank you for your suggestion. We'll review it soon.
                              </Text>
                            </>
                          ) : showAddItemRequest ? (
                            <>
                              <Text style={[styles.addItemEmptyTitle, { color: colors.text }]}>Request a Business</Text>
                              <TextInput
                                style={[styles.addItemRequestInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                                placeholder="Enter business name or description..."
                                placeholderTextColor={colors.textSecondary}
                                value={addItemRequestInput}
                                onChangeText={setAddItemRequestInput}
                                multiline
                                autoFocus
                              />
                              <TouchableOpacity
                                style={[styles.addItemRequestSubmitButton, { backgroundColor: colors.primary }]}
                                onPress={async () => {
                                  if (addItemRequestInput.trim() && user?.uid) {
                                    await submitBrandRequest(user.uid, addItemRequestInput.trim(), 'business');
                                    setShowAddItemRequest(false);
                                    setAddItemRequestInput('');
                                    setShowAddItemRequestSuccess(true);
                                    setTimeout(() => setShowAddItemRequestSuccess(false), 3000);
                                  }
                                }}
                              >
                                <Text style={styles.addItemRequestSubmitText}>Submit Request</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <Text style={[styles.addItemEmptyTitle, { color: colors.text }]}>No businesses found</Text>
                              <TouchableOpacity
                                style={[styles.addItemRequestButton, { backgroundColor: colors.primary }]}
                                onPress={() => setShowAddItemRequest(true)}
                              >
                                <Text style={styles.addItemRequestButtonText}>Request</Text>
                              </TouchableOpacity>
                              <Text style={[styles.addItemEmptySubtitle, { color: colors.textSecondary }]}>
                                Submit a business that we should add
                              </Text>
                            </>
                          )}
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              ) : addItemType === 'value' ? (
                // Value search results (with mode selection)
                <View style={styles.searchResultsContainer}>
                  {values?.filter(v => v.name?.toLowerCase().includes(addItemSearchQuery.toLowerCase())).slice(0, 10).map(value => (
                    <View key={value.id}>
                      <TouchableOpacity
                        style={[styles.searchResultItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        onPress={() => {
                          // Show mode selection
                          setQuickAddItem({ type: 'value', id: value.id, name: value.name });
                          setShowAddItemModal(false);
                          setShowValueModeModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.searchResultText, { color: colors.text }]}>{value.name}</Text>
                        <Text style={[styles.searchResultSubtext, { color: colors.textSecondary }]}>Select mode</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : addItemType === 'link' ? (
                // Link input interface
                <>
                  <Text style={[styles.modalLabel, { color: colors.text }]}>URL *</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                    placeholder="https://example.com"
                    placeholderTextColor={colors.textSecondary}
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                    autoFocus
                  />

                  <Text style={[styles.modalLabel, { color: colors.text }]}>Title (Optional)</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                    placeholder="Link title"
                    placeholderTextColor={colors.textSecondary}
                    value={linkTitle}
                    onChangeText={setLinkTitle}
                  />

                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleAddItemSubmit({})}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.white }]}>Add Link</Text>
                  </TouchableOpacity>
                </>
              ) : addItemType === 'text' ? (
                // Text input interface
                <>
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Text Content *</Text>
                  <TextInput
                    style={[styles.modalTextArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                    placeholder="Enter text note..."
                    placeholderTextColor={colors.textSecondary}
                    value={textContent}
                    onChangeText={setTextContent}
                    multiline
                    numberOfLines={5}
                    autoFocus
                  />

                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleAddItemSubmit({})}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.white }]}>Add Text</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </View>
      </Modal>

      {/* Explainer Overlay Modals */}
      {/* First Explainer */}
      <Modal
        visible={activeExplainerStep === 1}
        animationType="fade"
        transparent={true}
        onRequestClose={async () => {
          setActiveExplainerStep(2);
        }}
      >
        <View style={styles.explainerOverlay}>
          <TouchableWithoutFeedback onPress={async () => setActiveExplainerStep(2)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.explainerBubbleCentered, { backgroundColor: colors.primary }]}>
            <TouchableOpacity
              style={styles.explainerBubbleCloseButton}
              onPress={async () => setActiveExplainerStep(2)}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.white} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Progress Indicator */}
            <View style={styles.explainerProgress}>
              <Text style={[styles.explainerProgressNumber, styles.explainerProgressActive, { color: colors.white }]}>1</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>2</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>3</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>4</Text>
            </View>

            <Text style={[styles.explainerTextLarge, { color: colors.white }]}>
              We give you the best ways to vote with your money based on your values.
            </Text>

            <TouchableOpacity
              style={[styles.explainerBubbleButton, { backgroundColor: colors.white }]}
              onPress={async () => setActiveExplainerStep(2)}
              activeOpacity={0.8}
            >
              <Text style={[styles.explainerBubbleButtonText, { color: colors.primary, fontSize: 20 }]}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Second Explainer */}
      <Modal
        visible={activeExplainerStep === 2}
        animationType="fade"
        transparent={true}
        onRequestClose={async () => {
          setActiveExplainerStep(3);
        }}
      >
        <View style={styles.explainerOverlay}>
          <TouchableWithoutFeedback onPress={async () => setActiveExplainerStep(3)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.explainerBubbleCentered, { backgroundColor: colors.primary }]}>
            <TouchableOpacity
              style={styles.explainerBubbleCloseButton}
              onPress={async () => setActiveExplainerStep(3)}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.white} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Progress Indicator */}
            <View style={styles.explainerProgress}>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>1</Text>
              <Text style={[styles.explainerProgressNumber, styles.explainerProgressActive, { color: colors.white }]}>2</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>3</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>4</Text>
            </View>

            <Text style={[styles.explainerTextLarge, { color: colors.white }]}>
              Build your list of endorsements of brands and local businesses you support.
            </Text>

            <TouchableOpacity
              style={[styles.explainerBubbleButton, { backgroundColor: colors.white }]}
              onPress={async () => setActiveExplainerStep(3)}
              activeOpacity={0.8}
            >
              <Text style={[styles.explainerBubbleButtonText, { color: colors.primary, fontSize: 20 }]}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Third Explainer */}
      <Modal
        visible={activeExplainerStep === 3}
        animationType="fade"
        transparent={true}
        onRequestClose={async () => {
          setActiveExplainerStep(4);
        }}
      >
        <View style={styles.explainerOverlay}>
          <TouchableWithoutFeedback onPress={async () => setActiveExplainerStep(4)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.explainerBubbleCentered, { backgroundColor: colors.primary }]}>
            <TouchableOpacity
              style={styles.explainerBubbleCloseButton}
              onPress={async () => setActiveExplainerStep(4)}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.white} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Progress Indicator */}
            <View style={styles.explainerProgress}>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>1</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>2</Text>
              <Text style={[styles.explainerProgressNumber, styles.explainerProgressActive, { color: colors.white }]}>3</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>4</Text>
            </View>

            <Text style={[styles.explainerTextLarge, { color: colors.white }]}>
              Use the Value Machine or find your friends in order to discover new brands or gift ideas.
            </Text>

            <TouchableOpacity
              style={[styles.explainerBubbleButton, { backgroundColor: colors.white }]}
              onPress={async () => setActiveExplainerStep(4)}
              activeOpacity={0.8}
            >
              <Text style={[styles.explainerBubbleButtonText, { color: colors.primary, fontSize: 20 }]}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fourth Explainer */}
      <Modal
        visible={activeExplainerStep === 4}
        animationType="fade"
        transparent={true}
        onRequestClose={async () => {
          setActiveExplainerStep(0);
          if (clerkUser?.id) {
            await AsyncStorage.setItem(`userListExplainerDismissed_${clerkUser.id}`, 'true');
          }
        }}
      >
        <View style={styles.explainerOverlay}>
          <TouchableWithoutFeedback
            onPress={async () => {
              setActiveExplainerStep(0);
              if (clerkUser?.id) {
                await AsyncStorage.setItem(`userListExplainerDismissed_${clerkUser.id}`, 'true');
              }
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.explainerBubbleCentered, { backgroundColor: colors.primary }]}>
            <TouchableOpacity
              style={styles.explainerBubbleCloseButton}
              onPress={async () => {
                setActiveExplainerStep(0);
                if (clerkUser?.id) {
                  await AsyncStorage.setItem(`userListExplainerDismissed_${clerkUser.id}`, 'true');
                }
              }}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.white} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Progress Indicator */}
            <View style={styles.explainerProgress}>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>1</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>2</Text>
              <Text style={[styles.explainerProgressNumber, { color: 'rgba(255, 255, 255, 0.5)' }]}>3</Text>
              <Text style={[styles.explainerProgressNumber, styles.explainerProgressActive, { color: colors.white }]}>4</Text>
            </View>

            <Text style={[styles.explainerTextLarge, { color: colors.white }]}>
              Collect discounts at businesses in exchange for your endorsement, following or simply being on our app!
            </Text>

            <TouchableOpacity
              style={[styles.explainerBubbleButton, { backgroundColor: colors.white }]}
              onPress={async () => {
                setActiveExplainerStep(0);
                if (clerkUser?.id) {
                  await AsyncStorage.setItem(`userListExplainerDismissed_${clerkUser.id}`, 'true');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.explainerBubbleButtonText, { color: colors.primary, fontSize: 20 }]}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Followers/Following Modal */}
      <Modal
        visible={showFollowersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFollowersModal(false)}
      >
        <View style={styles.followersModalOverlay}>
          <View style={[styles.followersModalContent, { backgroundColor: colors.background }]}>
            {/* Header - add safe area padding for mobile */}
            <View style={[styles.followersModalHeader, { borderBottomColor: colors.border, paddingTop: isMobileScreen ? insets.top + 16 : 16 }]}>
              <Text style={[styles.followersModalTitle, { color: colors.text }]}>
                {followersModalTab === 'following' ? 'Following' : 'Followers'}
              </Text>
              <TouchableOpacity onPress={() => { setShowFollowersModal(false); setFollowersSearchQuery(''); }} activeOpacity={0.7}>
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.followersModalTabs, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.followersModalTab,
                  followersModalTab === 'following' && styles.followersModalTabActive,
                  followersModalTab === 'following' && { borderBottomColor: colors.primary }
                ]}
                onPress={() => {
                  setFollowersModalTab('following');
                  setFollowersSearchQuery('');
                  loadFollowersData('following');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.followersModalTabText,
                  { color: followersModalTab === 'following' ? colors.primary : colors.textSecondary }
                ]}>
                  Following ({followingCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.followersModalTab,
                  followersModalTab === 'followers' && styles.followersModalTabActive,
                  followersModalTab === 'followers' && { borderBottomColor: colors.primary }
                ]}
                onPress={() => {
                  setFollowersModalTab('followers');
                  setFollowersSearchQuery('');
                  loadFollowersData('followers');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.followersModalTabText,
                  { color: followersModalTab === 'followers' ? colors.primary : colors.textSecondary }
                ]}>
                  Followers ({followersCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={[styles.followersSearchContainer, { borderBottomColor: colors.border }]}>
              <View style={[styles.followersSearchInputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Search size={18} color={colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.followersSearchInput, { color: colors.text }]}
                  placeholder={`Search ${followersModalTab}...`}
                  placeholderTextColor={colors.textSecondary}
                  value={followersSearchQuery}
                  onChangeText={setFollowersSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {followersSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setFollowersSearchQuery('')} activeOpacity={0.7}>
                    <X size={18} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Content */}
            <ScrollView style={styles.followersModalList} showsVerticalScrollIndicator={false}>
              {isLoadingFollowData ? (
                <View style={styles.followersModalLoading}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.followersModalLoadingText, { color: colors.textSecondary }]}>Loading...</Text>
                </View>
              ) : (
                <>
                  {followersModalTab === 'following' ? (
                    (() => {
                      const filteredFollowing = followingList.filter(item =>
                        item.name.toLowerCase().includes(followersSearchQuery.toLowerCase()) ||
                        (item.location && item.location.toLowerCase().includes(followersSearchQuery.toLowerCase()))
                      );
                      return filteredFollowing.length === 0 ? (
                      <View style={styles.followersModalEmpty}>
                        <Text style={[styles.followersModalEmptyText, { color: colors.textSecondary }]}>
                          {followersSearchQuery ? 'No results found' : 'Not following anyone yet'}
                        </Text>
                      </View>
                    ) : (
                      filteredFollowing.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.followersModalItem, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            setShowFollowersModal(false);
                            setFollowersSearchQuery('');
                            if (item.type === 'user') {
                              router.push(`/user/${item.id}`);
                            } else if (item.type === 'brand') {
                              router.push(`/brand/${item.id}`);
                            } else if (item.type === 'business') {
                              router.push(`/business/${item.id}`);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.followersModalItemImage, { backgroundColor: colors.backgroundSecondary }]}>
                            {item.profileImage ? (
                              <Image
                                source={{ uri: item.profileImage }}
                                style={styles.followersModalItemImageInner}
                              />
                            ) : (
                              <User size={24} color={colors.textSecondary} strokeWidth={2} />
                            )}
                          </View>
                          <View style={styles.followersModalItemInfo}>
                            <Text style={[styles.followersModalItemName, { color: colors.text }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.location && (
                              <Text style={[styles.followersModalItemLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                                {item.location}
                              </Text>
                            )}
                            {item.type !== 'user' && (
                              <Text style={[styles.followersModalItemType, { color: colors.primary }]}>
                                {item.type === 'brand' ? 'Brand' : 'Business'}
                              </Text>
                            )}
                          </View>
                          <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>
                      ))
                    );
                    })()
                  ) : (
                    (() => {
                      const filteredFollowers = followersList.filter(item =>
                        item.name.toLowerCase().includes(followersSearchQuery.toLowerCase()) ||
                        (item.location && item.location.toLowerCase().includes(followersSearchQuery.toLowerCase()))
                      );
                      return filteredFollowers.length === 0 ? (
                      <View style={styles.followersModalEmpty}>
                        <Text style={[styles.followersModalEmptyText, { color: colors.textSecondary }]}>
                          {followersSearchQuery ? 'No results found' : 'No followers yet'}
                        </Text>
                      </View>
                    ) : (
                      filteredFollowers.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.followersModalItem, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            setShowFollowersModal(false);
                            setFollowersSearchQuery('');
                            router.push(`/user/${item.id}`);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.followersModalItemImage, { backgroundColor: colors.backgroundSecondary }]}>
                            {item.profileImage ? (
                              <Image
                                source={{ uri: item.profileImage }}
                                style={styles.followersModalItemImageInner}
                              />
                            ) : (
                              <User size={24} color={colors.textSecondary} strokeWidth={2} />
                            )}
                          </View>
                          <View style={styles.followersModalItemInfo}>
                            <Text style={[styles.followersModalItemName, { color: colors.text }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.location && (
                              <Text style={[styles.followersModalItemLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                                {item.location}
                              </Text>
                            )}
                          </View>
                          <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>
                      ))
                    );
                    })()
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Share Modal - With platform options */}
      <ShareModal
        visible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setShareData(null);
        }}
        shareUrl={shareData?.url || ''}
        title={shareData?.title || ''}
        description={shareData?.description}
        isDarkMode={isDarkMode}
        referralCode={referralCode}
      />
    </View>
  );
}

// Detect mobile screen size for responsive styling
const { width: screenWidth } = Dimensions.get('window');
const isMobileScreen = screenWidth < 768; // Mobile if width < 768px
const mobileScale = isMobileScreen ? 0.85 : 1; // Scale down elements on mobile by 15%

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 12,
    paddingTop: 4,
  },
  webContent: {
    maxWidth: 768,
    alignSelf: 'center' as const,
    width: '100%',
  },
  stickyHeaderContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 1000,
    position: 'relative' as const,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.OS === 'web' ? 16 : 12,
    paddingTop: Platform.OS === 'web' ? 0 : 56,
    paddingBottom: 0,
  },
  headerLogo: {
    width: 161,
    height: 47,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCreateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  showAllButton: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sectionTitle: {
    fontSize: 19 * mobileScale,
    fontWeight: '700' as const,
  },
  localBusinessesTitle: {
    fontSize: 24 * mobileScale,
    fontWeight: '700' as const,
  },
  localSectionHeaderRow: {
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 13 * mobileScale,
    marginBottom: 16 * mobileScale,
    lineHeight: 18 * mobileScale,
  },
  emptyText: {
    fontSize: 13 * mobileScale,
    textAlign: 'center' as const,
    paddingVertical: 24 * mobileScale,
    paddingHorizontal: 20 * mobileScale,
    lineHeight: 19 * mobileScale,
  },
  productsContainer: {
    gap: 10,
  },
  productCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    flexDirection: 'row',
    height: 80,
  },
  productImage: {
    width: 80,
    height: 80,
  },
  productContent: {
    padding: 10,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  productInfo: {
    marginRight: 8,
  },
  productName: {
    fontSize: 14 * mobileScale,
    fontWeight: '700' as const,
  },
  scorebadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6 * mobileScale,
    paddingVertical: 3 * mobileScale,
    borderRadius: 5 * mobileScale,
    gap: 3 * mobileScale,
  },
  scoreText: {
    fontSize: 12 * mobileScale,
    fontWeight: '700' as const,
  },
  valueTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    maxHeight: 28,
    overflow: 'hidden',
  },
  valueTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    maxWidth: 100,
  },
  valueTagText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  emptySection: {
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 13,
    textAlign: 'center',
  },
  searchPrompt: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    marginTop: 32,
    marginBottom: 16,
  },
  searchPromptContent: {},
  searchPromptTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  searchPromptSubtitle: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  mainViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 10,
  },
  mainViewSelector: {
    flexDirection: 'row',
    flex: 1,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
  },
  mainViewButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  mainViewText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  subsectionTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    marginTop: 4,
    gap: 20,
  },
  subsectionTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  subsectionTabText: {
    fontSize: 16,
    fontWeight: '600' as const,
    paddingBottom: 4,
  },
  subsectionTabUnderline: {
    height: 2,
    width: '130%',
    marginTop: 2,
    borderRadius: 1,
  },
  forYouItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  forYouItemNumber: {
    fontSize: 12,
    fontWeight: '500' as const,
    paddingTop: 20,
    minWidth: 20,
    textAlign: 'right',
    marginLeft: -4,
  },
  forYouCardWrapper: {
    flex: 1,
  },
  loadMoreButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  placeholderContainer: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 15,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  explainersContainer: {
    marginTop: 16,
    gap: 16,
  },
  explainerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginHorizontal: 16,
    position: 'relative' as const,
  },
  explainerCloseButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
  },
  explainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  explainerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explainerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    flex: 1,
  },
  explainerText: {
    fontSize: 15,
    lineHeight: 22,
    paddingLeft: 60,
  },
  distanceFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  distanceOptionsContainer: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  distanceFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceFilterText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  mapFilterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  mapFilterButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  compactSection: {
    marginBottom: 24,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  compactHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactHeaderTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  compactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactCard: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  compactImage: {
    width: '100%',
    height: 70,
  },
  compactContent: {
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactBrand: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  compactScore: {
    fontSize: 9,
    fontWeight: '700' as const,
  },
  brandsContainer: {
    gap: 8,
  },
  myListEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandCard: {
    borderRadius: 0,
    height: 64,
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'visible',
    width: '100%',
    backgroundColor: 'transparent',
  },
  brandCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    overflow: 'visible',
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  brandLogoContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
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
  brandScoreContainer: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandScore: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  brandCategory: {
    fontSize: 11,
    opacity: 0.7,
  },
  foldersContainer: {
    gap: 12,
  },
  folderCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  folderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  folderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 12,
  },
  folderContent: {
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  folderBrandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  folderBrandImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  folderBrandContent: {},
  folderBrandName: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  folderBrandCategory: {
    fontSize: 11,
  },
  folderBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  folderBrandScore: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  mapPlaceholder: {
    padding: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  mapWebContainer: {
    marginBottom: 16,
  },
  mapTitle: {
    fontSize: 24,
  fontWeight: '700' as const,
  marginBottom: 8,
  },
  mapSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  mapIframeContainer: {
    width: '100%',
    height: 500,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapPlaceholderTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  mapPlaceholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  mapLocationText: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  mapButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  mapContainer: {
    height: 500,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  filterCount: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
    position: 'relative' as const,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  modalScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginVertical: 4,
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  filterOptionCount: {
    fontSize: 14,
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  mapLegend: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  legendDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  legendCount: {
    fontSize: 11,
    marginTop: 4,
  },
  webView: {
    flex: 1,
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: isMobileScreen ? 'flex-start' : 'center',
    alignItems: isMobileScreen ? 'stretch' : 'center',
    padding: isMobileScreen ? 0 : 16,
  },
  mapModalContainer: {
    width: isMobileScreen ? '100%' : '90%',
    height: isMobileScreen ? '100%' : '87.5%',
    borderRadius: isMobileScreen ? 0 : 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: isMobileScreen ? (Platform.OS === 'ios' ? 48 : 16) : 16, // Safe area for mobile
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  mapModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  mapModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapModalContent: {
    flex: 1,
  },
  mapModalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  mapModalEmptyText: {
    fontSize: 16,
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  mapModalEmptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  mapModalEmptyButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  // Library styles
  listsContainer: {
    gap: 10,
    marginTop: 10,
    overflow: 'visible',
  },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'visible',
    flexDirection: 'row',
    width: '100%',
  },
  listCardClickable: {
    flex: 1,
  },
  listCardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  listCardContent: {
    flex: 1,
    padding: 12,
  },
  listCardReorderButtons: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 3,
  },
  reorderButton: {
    padding: 3,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardInfo: {
    flex: 1,
  },
  listCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 3,
  },
  listCardCount: {
    fontSize: 12,
  },
  listCardCreatedBy: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  listCardDescription: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  createListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
    marginBottom: 12,
  },
  createListButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  libraryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 6,
    gap: 10,
  },
  libraryEditButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  createListButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  listCardOptionsContainer: {
    position: 'relative' as const,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  listCardOptionsButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCardOptionsDropdown: {
    position: 'absolute' as const,
    top: 40,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1001,
  },
  listCardOptionsButtonAbsolute: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  listCardRearrangeButtonsAbsolute: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 3,
    zIndex: 10,
  },
  listCardOptionsDropdown: {
    position: 'absolute',
    top: 28,
    right: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 999,
    zIndex: 999999,
  },
  createListModalContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  addItemModalFixed: {
    position: 'absolute' as const,
    top: 80,
    left: 16,
    right: 16,
    height: '80%' as any,
    maxHeight: '80%' as any,
    minHeight: '80%' as any,
    flexDirection: 'column' as const,
    alignSelf: 'center',
  },
  fixedSearchInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexShrink: 0,
    flexGrow: 0,
  },
  addItemScrollContainer: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: 16,
  },
  modalContentInner: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  modalTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
  },
  modalButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedCountText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  valuesGrid: {
    gap: 20,
  },
  valueCategory: {
    marginBottom: 24,
  },
  valueCategoryTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  valuesCategorySection: {
    marginBottom: 8,
  },
  valuesCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  valuesButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  valueChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  // Quick-add styles
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  quickAddModalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  valueModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  valueModeContent: {
    flex: 1,
  },
  valueModeTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  valueModeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  quickAddItemName: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  quickAddListsContainer: {
    gap: 8,
    marginTop: 8,
  },
  quickAddListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  quickAddListInfo: {
    flex: 1,
  },
  quickAddListName: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  quickAddListCount: {
    fontSize: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  emptyListText: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 16,
    lineHeight: 20,
  },
  // List detail view styles
  listDetailHeader: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  listDetailTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  listDetailTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listDetailTitleContainerHorizontal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  listDetailTitle: {
    fontSize: 28 * mobileScale,
    fontWeight: '700' as const,
  },
  listOptionsButton: {
    padding: 4,
  },
  listOptionsButtonHorizontal: {
    padding: 4,
    marginLeft: 4,
  },
  createButtonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  listEditDropdown: {
    position: 'absolute',
    top: 48,
    left: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  addItemButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addItemButtonLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userListHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  userListSubheading: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  listOptionsDropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 999,
    zIndex: 999999,
  },
  listOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  listOptionDivider: {
    height: 1,
    marginVertical: 4,
  },
  listCreatedBy: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
  listDetailDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  listDetailActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative' as const,
    zIndex: 2, // Ensure buttons stay on top
  },
  listDetailEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  listDetailEditTextButton: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  listEditDropdownOverlay: {
    position: 'absolute',
    top: 88,
    right: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 999,
    zIndex: 999999,
  },
  listDetailEditButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  listEntryClickable: {
    flex: 1,
    padding: 12,
  },
  listEntryOptionsContainer: {
    position: 'relative' as const,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  listEntryOptionsButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listEntryOptionsDropdown: {
    position: 'absolute',
    top: 28,
    right: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 999,
    zIndex: 999999,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 998,
  },
  listEntryOptionsDropdownFixed: {
    position: 'absolute',
    top: 40,
    right: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    zIndex: 99999,
    shadowRadius: 12,
    elevation: 999,
    zIndex: 999999,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'visible',
  },
  valueNameBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderRadius: 7,
    marginRight: 10,
  },
  valueNameText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  valueRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listEntryReorderButtons: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 3,
  },
  dragHandle: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    cursor: 'grab' as any,
  },
  listDetailContent: {
    flex: 1,
  },
  listEntriesContainer: {
    gap: 8,
    overflow: 'visible',
  },
  listEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  listEntryNumber: {
    fontSize: 12,
    fontWeight: '500' as const,
    paddingTop: 16,
    minWidth: 20,
    textAlign: 'right',
  },
  listEntryWrapper: {
    position: 'relative' as const,
    overflow: 'visible',
    flex: 1,
  },
  listEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 0,
  },
  listEntryCardImage: {
    width: 56,
    height: 56,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  listEntryCardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  listEntryCardFirstLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listEntryCardNumber: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  listEntryCardName: {
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  listEntryCardCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  listEntryCardScore: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listEntryCardScoreText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  listEntryContent: {
    gap: 3,
  },
  listEntryType: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  listEntryName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  listEntryMode: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 3,
  },
  linkUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
  },
  linkUrl: {
    fontSize: 12,
    flex: 1,
  },
  // Library header styles
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
    marginBottom: 12,
  },
  libraryTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  libraryDoneButton: {
    position: 'absolute',
    right: 20,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  // List card wrapper and rearrange styles
  listCardWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  listCardRearrangeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rearrangeButton: {
    padding: 4,
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContent: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 999,
  },
  // List detail edit section styles
  listDetailEditSection: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  listDetailEditTextCentered: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  listEditDropdownCentered: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1000,
    minWidth: 180,
    marginBottom: 12,
  },
  // Add item modal styles
  addItemTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  addItemTypeText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  searchResultsContainer: {
    marginTop: 12,
    gap: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  searchResultLogo: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  searchResultText: {
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  searchResultSubtext: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  // Add item request styles
  addItemEmptyState: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  addItemEmptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  addItemEmptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  addItemRequestButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addItemRequestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addItemRequestInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  addItemRequestSubmitButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addItemRequestSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Explainer overlay styles
  explainerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  explainerBubbleCentered: {
    borderRadius: 24,
    padding: 40,
    paddingTop: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    width: '85%',
    maxWidth: 500,
    alignItems: 'center',
  },
  explainerBubbleCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  explainerNumber: {
    fontSize: 120,
    fontWeight: '900' as const,
    marginBottom: 20,
    textAlign: 'center',
  },
  explainerTextLarge: {
    fontSize: 32,
    lineHeight: 44,
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  explainerBubbleButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    minWidth: 140,
  },
  explainerBubbleButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  explainerProgress: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explainerProgressNumber: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  explainerProgressActive: {
    fontSize: 120,
    fontWeight: '900' as const,
  },
  // Share Modal Styles
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shareModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  shareModalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  shareModalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  shareModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  shareModalButtonPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  shareModalButtonSecondary: {
    borderWidth: 1,
  },
  shareModalButtonCancel: {
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  shareModalButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  shareModalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  // Collapsible Library Directory Styles
  libraryDirectory: {
    marginBottom: 8,
  },
  collapsibleListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: Platform.OS === 'web' ? 4 : 8, // Reduce padding on mobile browsers
    marginHorizontal: Platform.OS === 'web' ? 8 : 8, // Reduced mobile margin to half
    marginVertical: 3,
  },
  listContentContainer: {
    marginHorizontal: 8,
    marginBottom: 8,
  },
  pinnedListHeader: {
    // No special styling for pinned headers
  },
  collapsibleListHeaderContent: {
    flex: 1,
  },
  listProfileImageContainer: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, // Reduce margin for tighter spacing
    overflow: 'hidden',
  },
  listProfileImage: {
    width: '100%',
    height: '100%',
  },
  collapsibleListRowLayout: {
    flexDirection: 'row', // Horizontal layout for collapsed lists
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  collapsibleListMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listHeaderOptionsButton: {
    padding: 4,
    marginLeft: 8,
  },
  listOptionsDropdown: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  listOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  collapsibleListInfo: {
    flex: 1,
  },
  collapsibleListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  collapsibleListTitle: {
    fontSize: 16, // Smaller for mobile browsers
    fontWeight: '700',
    flexShrink: 1, // Allow text to shrink if needed
  },
  collapsibleListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 26, // Reduce left margin slightly
    marginBottom: 4,
    flexWrap: 'wrap', // Allow wrapping on small screens
  },
  collapsibleListCount: {
    fontSize: 12, // Smaller for mobile browsers
    fontWeight: '500',
  },
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    fontSize: 10, // Smaller for mobile browsers
    fontWeight: '600',
  },
  collapsibleListAttribution: {
    fontSize: 11, // Smaller for mobile browsers
    marginLeft: 26, // Reduce margin
    marginTop: 2,
    fontStyle: 'italic',
  },
  collapsibleListDescription: {
    fontSize: 12, // Smaller for mobile browsers
    marginLeft: 26, // Reduce margin
    marginTop: 6,
    lineHeight: 17,
  },
  // Header counters styles
  headerCounters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    justifyContent: 'center',
  },
  headerCounterButton: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerCounterNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerCounterLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Followers modal styles
  followersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isMobileScreen ? 0 : 20,
  },
  followersModalContent: {
    width: isMobileScreen ? '100%' : '50%',
    height: isMobileScreen ? '100%' : '80%',
    maxWidth: 600,
    borderRadius: isMobileScreen ? 0 : 16,
    overflow: 'hidden',
  },
  followersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  followersSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  followersSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  followersSearchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  followersModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  followersModalTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  followersModalTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  followersModalTabActive: {
    borderBottomWidth: 2,
  },
  followersModalTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followersModalList: {
    flex: 1,
  },
  followersModalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  followersModalLoadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  followersModalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  followersModalEmptyText: {
    fontSize: 14,
  },
  followersModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  followersModalItemImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  followersModalItemImageInner: {
    width: '100%',
    height: '100%',
  },
  followersModalItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  followersModalItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  followersModalItemLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  followersModalItemType: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
