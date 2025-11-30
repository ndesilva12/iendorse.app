/**
 * UnifiedLibrary Component
 * EXACTLY matches Home tab's library visual appearance
 * Functionality controlled by mode prop
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Alert,
  Pressable,
  Share,
  Modal,
  Dimensions,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  GripVertical,
  User,
  Globe,
  Lock,
  MoreVertical,
  Target,
  ExternalLink,
  Plus,
  Edit,
  Trash2,
  Share2,
  UserPlus,
  List as ListIcon,
  Search,
  X,
  Check,
  BookOpen,
  Compass,
  Heart,
  Home,
  MapPin,
} from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { UserList, ListEntry } from '@/types/library';
import { useLibrary } from '@/contexts/LibraryContext';
import { useData } from '@/contexts/DataContext';
import EndorsedBadge from '@/components/EndorsedBadge';
import { getLogoUrl } from '@/lib/logo';
import { Product, Cause } from '@/types';
import { BusinessUser, getAllUserBusinesses } from '@/services/firebase/businessService';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'expo-router';
import { updateListMetadata, copyListToLibrary } from '@/services/firebase/listService';
import { followEntity, unfollowEntity, isFollowing as checkIsFollowing } from '@/services/firebase/followService';
import AddToLibraryModal from '@/components/AddToLibraryModal';
import EditListModal from '@/components/EditListModal';
import ShareOptionsModal from '@/components/ShareOptionsModal';
import ConfirmModal from '@/components/ConfirmModal';
import ItemOptionsModal from '@/components/ItemOptionsModal';
import FollowingFollowersList from '@/components/FollowingFollowersList';
import LocalBusinessView from '@/components/Library/LocalBusinessView';
import EndorsementMapView, { MapEntry } from '@/components/EndorsementMapView';
import { geocodeAndSaveBrandLocation } from '@/services/geocodingService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { reorderListEntries } from '@/services/firebase/listService';
import { getTopBrands, getTopBusinesses } from '@/services/firebase/topRankingsService';
import { getCumulativeDays } from '@/services/firebase/endorsementHistoryService';
import { searchPlaces, getPlaceDetails, PlaceSearchResult, getPlacePhotoUrl, formatCategory } from '@/services/firebase/placesService';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ===== Custom Categories =====
// These are the predefined categories for filtering endorsements
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

// Map any category string to one of our custom categories
const mapToCustomCategory = (category: string | undefined): string => {
  if (!category) return 'other';
  const lower = category.toLowerCase().replace(/[_\s&]+/g, ' ').trim();

  // Technology
  if (lower.includes('tech') || lower.includes('software') || lower.includes('computer') ||
      lower.includes('electron') || lower.includes('telecom') || lower.includes('it ') ||
      lower.includes('internet') || lower.includes('digital') || lower.includes('mobile') ||
      lower.includes('app') || lower.includes('cloud') || lower.includes('data')) {
    return 'technology';
  }

  // Retail
  if (lower.includes('retail') || lower.includes('store') || lower.includes('shop') ||
      lower.includes('supermarket') || lower.includes('department') || lower.includes('mall') ||
      lower.includes('grocery') || lower.includes('convenience') || lower.includes('hardware store') ||
      lower.includes('home improvement') || lower.includes('furniture')) {
    return 'retail';
  }

  // Food & Beverage
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe') ||
      lower.includes('coffee') || lower.includes('bakery') || lower.includes('bar') ||
      lower.includes('beverage') || lower.includes('pizza') || lower.includes('burger') ||
      lower.includes('fast food') || lower.includes('dining') || lower.includes('eatery') ||
      lower.includes('bistro') || lower.includes('grill') || lower.includes('deli') ||
      lower.includes('ice cream') || lower.includes('donut') || lower.includes('sandwich') ||
      lower.includes('sushi') || lower.includes('thai') || lower.includes('chinese') ||
      lower.includes('mexican') || lower.includes('italian') || lower.includes('indian') ||
      lower.includes('brewery') || lower.includes('winery') || lower.includes('pub')) {
    return 'food_beverage';
  }

  // Finance
  if (lower.includes('bank') || lower.includes('financ') || lower.includes('insurance') ||
      lower.includes('invest') || lower.includes('credit') || lower.includes('loan') ||
      lower.includes('mortgage') || lower.includes('accounting') || lower.includes('tax')) {
    return 'finance';
  }

  // Automotive
  if (lower.includes('auto') || lower.includes('car') || lower.includes('vehicle') ||
      lower.includes('motor') || lower.includes('dealer') || lower.includes('garage') ||
      lower.includes('tire') || lower.includes('gas station') || lower.includes('fuel') ||
      lower.includes('parking') || lower.includes('repair') || lower.includes('mechanic')) {
    return 'automotive';
  }

  // Entertainment
  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('theater') ||
      lower.includes('cinema') || lower.includes('music') || lower.includes('concert') ||
      lower.includes('game') || lower.includes('gaming') || lower.includes('casino') ||
      lower.includes('amusement') || lower.includes('theme park') || lower.includes('bowling') ||
      lower.includes('arcade') || lower.includes('club') || lower.includes('night') ||
      lower.includes('media') || lower.includes('streaming') || lower.includes('studio')) {
    return 'entertainment';
  }

  // Health & Wellness
  if (lower.includes('health') || lower.includes('medical') || lower.includes('hospital') ||
      lower.includes('clinic') || lower.includes('doctor') || lower.includes('dentist') ||
      lower.includes('pharmacy') || lower.includes('drug') || lower.includes('wellness') ||
      lower.includes('fitness') || lower.includes('gym') || lower.includes('spa') ||
      lower.includes('yoga') || lower.includes('therapy') || lower.includes('care') ||
      lower.includes('vitamin') || lower.includes('supplement') || lower.includes('optical') ||
      lower.includes('veterinar') || lower.includes('pet')) {
    return 'health_wellness';
  }

  // Fashion
  if (lower.includes('fashion') || lower.includes('clothing') || lower.includes('apparel') ||
      lower.includes('shoe') || lower.includes('jewelry') || lower.includes('accessori') ||
      lower.includes('watch') || lower.includes('cosmetic') || lower.includes('beauty') ||
      lower.includes('salon') || lower.includes('barber') || lower.includes('hair') ||
      lower.includes('nail') || lower.includes('boutique') || lower.includes('dress') ||
      lower.includes('wear') || lower.includes('tailor') || lower.includes('dry clean')) {
    return 'fashion';
  }

  // Travel
  if (lower.includes('travel') || lower.includes('hotel') || lower.includes('motel') ||
      lower.includes('resort') || lower.includes('airline') || lower.includes('airport') ||
      lower.includes('flight') || lower.includes('cruise') || lower.includes('tour') ||
      lower.includes('vacation') || lower.includes('lodging') || lower.includes('hostel') ||
      lower.includes('rental car') || lower.includes('transportation') || lower.includes('taxi') ||
      lower.includes('rideshare') || lower.includes('bus') || lower.includes('train')) {
    return 'travel';
  }

  // Check if it's already a custom category
  const customIds = CUSTOM_CATEGORIES.map(c => c.id);
  if (customIds.includes(lower.replace(/\s/g, '_'))) {
    return lower.replace(/\s/g, '_');
  }

  return 'other';
};

// Get the display label for a custom category
const getCustomCategoryLabel = (categoryId: string): string => {
  const category = CUSTOM_CATEGORIES.find(c => c.id === categoryId);
  return category?.label || 'Other';
};

// ===== Types =====

type LibrarySectionType = 'endorsement' | 'aligned' | 'unaligned' | 'alignedTop' | 'following' | 'followers' | 'local' | 'localTop';

interface UnifiedLibraryProps {
  mode: 'edit' | 'preview' | 'view';
  // 'edit' = Home tab - full editing
  // 'preview' = Profile tab - view only (what others see)
  // 'view' = Profile details - can add/share

  currentUserId?: string;
  viewingUserId?: string;
  userLists?: UserList[];
  endorsementList?: UserList | null;
  alignedItems?: Product[];  // Changed from any[] to Product[]
  unalignedItems?: Product[];  // Changed from any[] to Product[]
  isDarkMode?: boolean;
  profileImage?: string;
  // Additional props for score calculation
  userBusinesses?: BusinessUser[];
  scoredBrands?: Map<string, number>;
  userCauses?: Cause[];
  // Location data for Local view
  userLocation?: { latitude: number; longitude: number } | null;
  onRequestLocation?: () => void;
  // Following/Followers counts
  followingCount?: number;
  followersCount?: number;
  // External section control
  externalSelectedSection?: LibrarySectionType;
  onSectionChange?: (section: LibrarySectionType) => void;
  // Show only endorsement section (hides section selector)
  endorsementOnly?: boolean;
}

export default function UnifiedLibrary({
  mode,
  currentUserId,
  viewingUserId,
  userLists: propsUserLists,
  endorsementList: propsEndorsementList,
  alignedItems = [],
  unalignedItems = [],
  isDarkMode = false,
  profileImage,
  userBusinesses = [],
  scoredBrands = new Map(),
  userCauses = [],
  userLocation = null,
  onRequestLocation,
  followingCount = 0,
  followersCount = 0,
  externalSelectedSection,
  onSectionChange,
  endorsementOnly = false,
}: UnifiedLibraryProps) {
  const colors = (isDarkMode ? darkColors : lightColors) || lightColors;
  const library = useLibrary();
  const { profile, clerkUser } = useUser();
  const router = useRouter();
  const { brands } = useData();

  // Use context's expandedListId for persistent state across navigation
  const openedListId = library.state.expandedListId;
  const [activeListOptionsId, setActiveListOptionsId] = useState<string | null>(null);
  const [showAddToLibraryModal, setShowAddToLibraryModal] = useState(false);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<ListEntry | null>(null);

  // Edit List Modal state
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editingList, setEditingList] = useState<UserList | null>(null);

  // Share Options Modal state
  const [showShareOptionsModal, setShowShareOptionsModal] = useState(false);
  const [sharingItem, setSharingItem] = useState<{type: 'list' | 'entry', data: UserList | ListEntry} | null>(null);

  // Action Menu Modal state
  const [showActionOptionsModal, setShowActionOptionsModal] = useState(false);
  const [selectedItemForOptions, setSelectedItemForOptions] = useState<ListEntry | null>(null);
  const [isFollowingSelectedItem, setIsFollowingSelectedItem] = useState(false);
  const [checkingFollowStatus, setCheckingFollowStatus] = useState(false);

  // Confirm Modal state (for copying lists and deleting)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDanger?: boolean;
  } | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  // Pagination state for each list
  const [endorsementLoadCount, setEndorsementLoadCount] = useState(25);
  const [alignedLoadCount, setAlignedLoadCount] = useState(10);
  const [unalignedLoadCount, setUnalignedLoadCount] = useState(10);
  const [customListLoadCounts, setCustomListLoadCounts] = useState<Record<string, number>>({});

  // Top rankings state
  const [topBrands, setTopBrands] = useState<any[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<any[]>([]);
  const [loadingTopBrands, setLoadingTopBrands] = useState(false);
  const [loadingTopBusinesses, setLoadingTopBusinesses] = useState(false);
  const [topBrandsLoadCount, setTopBrandsLoadCount] = useState(10);
  const [topBusinessesLoadCount, setTopBusinessesLoadCount] = useState(10);

  // Map modal state
  const [showMapModal, setShowMapModal] = useState(false);
  const [geocodedBrandLocations, setGeocodedBrandLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [isGeocodingBrands, setIsGeocodingBrands] = useState(false);
  const geocodingStartedRef = useRef(false); // Track if geocoding has started for current modal session

  // Detect larger screens for responsive text display
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // Use props if provided, otherwise use context (MUST be before defaultSection calculation)
  const endorsementList = propsEndorsementList !== undefined ? propsEndorsementList : library.state.endorsementList;
  const userLists = propsUserLists !== undefined ? propsUserLists : library.state.userLists;

  // Reorder mode state
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderingListId, setReorderingListId] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState<ListEntry[]>([]);

  // Cumulative days endorsed state (keyed by entityId)
  const [cumulativeDaysMap, setCumulativeDaysMap] = useState<Record<string, number>>({});

  // Scroll ref for sticky header and scroll-to-top
  const scrollViewRef = useRef<ScrollView>(null);

  // Action menu state for endorsed section header
  const [showEndorsedActionMenu, setShowEndorsedActionMenu] = useState(false);

  // Add to endorsement search modal state
  const [showAddEndorsementModal, setShowAddEndorsementModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [allBusinesses, setAllBusinesses] = useState<BusinessUser[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());

  // External places search state (Google Places API)
  const [placesResults, setPlacesResults] = useState<PlaceSearchResult[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesSearchDebounce, setPlacesSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Endorsement list filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [localFilter, setLocalFilter] = useState<'all' | 'local'>('all');

  // Section selection state
  // Profile views (preview/view) ALWAYS default to endorsement
  // Home tab (edit) defaults to endorsement, or aligned if endorsement is empty
  // endorsementOnly mode always forces endorsement section
  const defaultSection: LibrarySectionType = (() => {
    if (endorsementOnly) {
      return 'endorsement'; // endorsementOnly always shows endorsement
    }
    const isProfileView = mode === 'preview' || mode === 'view';
    if (isProfileView) {
      return 'endorsement'; // Profile ALWAYS shows endorsement by default
    }
    // Home tab: default to endorsement if it has entries, otherwise aligned
    return (endorsementList && endorsementList.entries && endorsementList.entries.length > 0)
      ? 'endorsement'
      : 'aligned';
  })();
  const [internalSelectedSection, setInternalSelectedSection] = useState<LibrarySectionType>(defaultSection);

  // Use external section if provided, otherwise use internal
  // endorsementOnly mode overrides everything to 'endorsement'
  const selectedSection = endorsementOnly ? 'endorsement' : (externalSelectedSection ?? internalSelectedSection);
  const setSelectedSection = (section: LibrarySectionType) => {
    if (onSectionChange) {
      onSectionChange(section);
    }
    setInternalSelectedSection(section);
  };

  // Drag-and-drop sensors for list reordering
  // PointerSensor for desktop (mouse), TouchSensor for mobile (long press)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag only after moving 8px (prevents accidental drags)
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Long press for 300ms to start drag
        tolerance: 5, // Allow 5px of movement during the delay
      },
    })
  );

  // Mode-based permissions
  const canEdit = mode === 'edit';
  const canInteract = mode !== 'preview'; // Can add/share in view mode
  const canBrowse = true; // All modes can expand/collapse to browse

  // Navigate into a list (replaces expand/collapse)
  const handleListClick = (listId: string) => {
    if (!canBrowse) return;
    library.setExpandedList(listId);
  };

  // Navigate back to list overview
  const handleBackToLibrary = () => {
    library.setExpandedList(null);
  };

  // Filter out endorsement list from custom lists
  const customLists = userLists.filter(list => list.id !== endorsementList?.id);


  // Check follow status when item is selected for options modal
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!selectedItemForOptions || !currentUserId) {
        setIsFollowingSelectedItem(false);
        setCheckingFollowStatus(false);
        return;
      }

      const canFollow = selectedItemForOptions.type === 'brand' || selectedItemForOptions.type === 'business';
      if (!canFollow) {
        setIsFollowingSelectedItem(false);
        setCheckingFollowStatus(false);
        return;
      }

      const accountId = selectedItemForOptions.type === 'brand'
        ? (selectedItemForOptions as any).brandId
        : (selectedItemForOptions as any).businessId;

      if (!accountId) {
        setIsFollowingSelectedItem(false);
        setCheckingFollowStatus(false);
        return;
      }

      try {
        setCheckingFollowStatus(true);
        const following = await checkIsFollowing(currentUserId, accountId, selectedItemForOptions.type as 'brand' | 'business');
        setIsFollowingSelectedItem(following);
      } catch (error) {
        console.error('[UnifiedLibrary] Error checking follow status:', error);
        setIsFollowingSelectedItem(false);
      } finally {
        setCheckingFollowStatus(false);
      }
    };

    checkFollowStatus();
  }, [selectedItemForOptions, currentUserId]);

  // Fetch top brands when alignedTop section is selected
  useEffect(() => {
    const fetchTopBrands = async () => {
      if (selectedSection !== 'alignedTop') return;
      if (topBrands.length > 0) return; // Only fetch once

      setLoadingTopBrands(true);
      try {
        console.log('[UnifiedLibrary] Fetching top brands...');
        const rankings = await getTopBrands(100); // Fetch top 100
        setTopBrands(rankings);
        console.log('[UnifiedLibrary] Loaded', rankings.length, 'top brands');
      } catch (error) {
        console.error('[UnifiedLibrary] Error fetching top brands:', error);
      } finally {
        setLoadingTopBrands(false);
      }
    };

    fetchTopBrands();
  }, [selectedSection]);

  // Fetch top businesses when localTop section is selected
  useEffect(() => {
    const fetchTopBusinesses = async () => {
      if (selectedSection !== 'localTop') return;

      setLoadingTopBusinesses(true);
      try {
        console.log('[UnifiedLibrary] Fetching top businesses...');
        // Default to 100 mile radius for local top
        const rankings = await getTopBusinesses(100, userLocation, 100);
        setTopBusinesses(rankings);
        console.log('[UnifiedLibrary] Loaded', rankings.length, 'top businesses');
      } catch (error) {
        console.error('[UnifiedLibrary] Error fetching top businesses:', error);
      } finally {
        setLoadingTopBusinesses(false);
      }
    };

    fetchTopBusinesses();
  }, [selectedSection, userLocation]);

  // Fetch all businesses when add endorsement modal opens
  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!showAddEndorsementModal) return;
      if (allBusinesses.length > 0) return; // Only fetch once

      setLoadingBusinesses(true);
      try {
        console.log('[UnifiedLibrary] Fetching all businesses for search...');
        const businesses = await getAllUserBusinesses();
        setAllBusinesses(businesses);
        console.log('[UnifiedLibrary] Loaded', businesses.length, 'businesses for search');
      } catch (error) {
        console.error('[UnifiedLibrary] Error fetching businesses:', error);
      } finally {
        setLoadingBusinesses(false);
      }
    };

    fetchBusinesses();
  }, [showAddEndorsementModal]);

  // Helper to calculate days from createdAt (fallback for entries without history)
  const calculateDaysFromCreatedAt = (createdAt: Date | string | undefined): number => {
    if (!createdAt) return 0;

    let date: Date;
    if (createdAt instanceof Date) {
      date = createdAt;
    } else if (typeof createdAt === 'string') {
      date = new Date(createdAt);
    } else if (typeof createdAt === 'object' && 'seconds' in createdAt) {
      // Firestore Timestamp
      date = new Date((createdAt as any).seconds * 1000);
    } else {
      return 0;
    }

    if (isNaN(date.getTime())) return 0;

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Fetch cumulative days endorsed for all endorsement entries
  useEffect(() => {
    const fetchCumulativeDays = async () => {
      if (!endorsementList?.entries?.length) return;

      const entries = endorsementList.entries.filter(e => e != null);
      const daysMap: Record<string, number> = {};

      // Fetch cumulative days for each entry
      await Promise.all(
        entries.map(async (entry) => {
          try {
            const entityId = entry.type === 'brand'
              ? (entry as any).brandId
              : (entry as any).businessId;

            if (!entityId) return;

            // Try to get cumulative days from history service if user is logged in
            if (currentUserId) {
              const entityType = entry.type === 'brand' ? 'brand' : 'business';
              const result = await getCumulativeDays(currentUserId, entityType, entityId);
              // Use history days if available, otherwise fall back to createdAt calculation
              if (result.totalDaysEndorsed > 0) {
                daysMap[entityId] = result.totalDaysEndorsed;
                return;
              }
            }

            // Fallback: calculate from entry's createdAt date
            daysMap[entityId] = calculateDaysFromCreatedAt(entry.createdAt);
          } catch (error) {
            console.error('[UnifiedLibrary] Error fetching cumulative days:', error);
            // Fallback on error: calculate from createdAt
            const entityId = entry.type === 'brand'
              ? (entry as any).brandId
              : (entry as any).businessId;
            if (entityId) {
              daysMap[entityId] = calculateDaysFromCreatedAt(entry.createdAt);
            }
          }
        })
      );

      setCumulativeDaysMap(daysMap);
    };

    fetchCumulativeDays();
  }, [currentUserId, endorsementList?.entries]);

  // Search external places when query changes (with debounce)
  useEffect(() => {
    // Clear previous timeout
    if (placesSearchDebounce) {
      clearTimeout(placesSearchDebounce);
    }

    const query = addSearchQuery.trim();

    // Only search if query is long enough
    if (query.length < 2) {
      setPlacesResults([]);
      setLoadingPlaces(false);
      return;
    }

    // Get IDs of already endorsed places
    const entries = endorsementList?.entries || [];
    const safeEntries = Array.isArray(entries) ? entries.filter(e => e != null && typeof e === 'object') : [];
    const endorsedPlaceIds = new Set(
      safeEntries
        .filter(e => e.type === 'place')
        .map(e => (e as any).placeId)
        .filter(id => id != null)
    );

    // Debounce the API call
    const timeout = setTimeout(async () => {
      setLoadingPlaces(true);
      try {
        const results = await searchPlaces(query);
        // Filter out already endorsed places
        const filteredResults = results.filter(p => !endorsedPlaceIds.has(p.placeId));
        setPlacesResults(filteredResults);
      } catch (error) {
        console.error('[UnifiedLibrary] Error searching places:', error);
        setPlacesResults([]);
      } finally {
        setLoadingPlaces(false);
      }
    }, 500); // 500ms debounce

    setPlacesSearchDebounce(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [addSearchQuery, endorsementList?.entries]);

  // Search results for add endorsement modal
  const addSearchResults = useMemo(() => {
    if (!addSearchQuery.trim()) return { brands: [], businesses: [] };

    const query = addSearchQuery.toLowerCase().trim();

    // Get IDs of already endorsed items (with robust null checks)
    const entries = endorsementList?.entries || [];
    const safeEntries = Array.isArray(entries) ? entries.filter(e => e != null && typeof e === 'object') : [];

    const endorsedBrandIds = new Set(
      safeEntries
        .filter(e => e.type === 'brand')
        .map(e => (e as any).brandId)
        .filter(id => id != null)
    );
    const endorsedBusinessIds = new Set(
      safeEntries
        .filter(e => e.type === 'business')
        .map(e => (e as any).businessId)
        .filter(id => id != null)
    );

    // Search brands
    const matchingBrands = (brands || [])
      .filter(brand => {
        const nameMatch = brand.name?.toLowerCase().includes(query);
        const notEndorsed = !endorsedBrandIds.has(brand.id);
        return nameMatch && notEndorsed;
      })
      .slice(0, 10);

    // Search businesses
    const matchingBusinesses = allBusinesses
      .filter(business => {
        const nameMatch = business.businessInfo?.name?.toLowerCase().includes(query);
        const notEndorsed = !endorsedBusinessIds.has(business.id);
        return nameMatch && notEndorsed;
      })
      .slice(0, 10);

    return { brands: matchingBrands, businesses: matchingBusinesses };
  }, [addSearchQuery, brands, allBusinesses, endorsementList]);

  // Convert endorsement entries to map entries (only entries with location data)
  // Applies the same filters as the list view
  const mapEntries = useMemo((): MapEntry[] => {
    if (!endorsementList?.entries) return [];

    // Helper to get entry category (same logic as in render)
    const getEntryCategory = (entry: ListEntry): string => {
      let rawCategory: string | undefined;
      if (entry.type === 'brand') rawCategory = (entry as any).brandCategory;
      else if (entry.type === 'business') rawCategory = (entry as any).businessCategory;
      else if (entry.type === 'place') rawCategory = (entry as any).placeCategory;
      return mapToCustomCategory(rawCategory);
    };

    // Helper to check if entry is local (has location data)
    const isLocalEntry = (entry: ListEntry): boolean => {
      if (entry.type === 'place') return true;
      if (entry.type === 'business' && (entry as any).location) return true;
      return false;
    };

    // Apply local filter first
    let filteredList = endorsementList.entries;
    if (localFilter === 'local') {
      filteredList = filteredList.filter(entry => entry && isLocalEntry(entry));
    }

    // Then apply category filter
    if (categoryFilter !== 'all') {
      filteredList = filteredList.filter(entry => {
        const categoryId = getEntryCategory(entry);
        return categoryId === categoryFilter;
      });
    }

    const entries: MapEntry[] = [];

    filteredList.forEach((entry) => {
      if (entry.type === 'place') {
        const placeEntry = entry as any;
        if (placeEntry.location?.lat && placeEntry.location?.lng) {
          entries.push({
            id: placeEntry.placeId,
            name: placeEntry.placeName,
            category: placeEntry.placeCategory,
            address: placeEntry.placeAddress,
            logoUrl: placeEntry.logoUrl,
            location: {
              lat: placeEntry.location.lat,
              lng: placeEntry.location.lng,
            },
            type: 'place',
            originalEntry: entry,
          });
        }
      } else if (entry.type === 'business') {
        const businessEntry = entry as any;
        // Try to find full business data to get location
        const fullBusiness = allBusinesses.find(b => b.id === businessEntry.businessId);
        const businessInfo = fullBusiness?.businessInfo;
        const location = businessInfo?.locations?.[0] ||
          (businessInfo?.latitude && businessInfo?.longitude
            ? { latitude: businessInfo.latitude, longitude: businessInfo.longitude, address: businessInfo.location }
            : null);

        if (location?.latitude && location?.longitude) {
          entries.push({
            id: businessEntry.businessId,
            name: businessEntry.businessName || businessInfo?.name,
            category: businessEntry.businessCategory || businessInfo?.category,
            address: location.address || businessInfo?.location,
            logoUrl: businessEntry.logoUrl || businessInfo?.logoUrl,
            location: {
              lat: location.latitude,
              lng: location.longitude,
            },
            type: 'business',
            originalEntry: entry,
          });
        }
      } else if (entry.type === 'brand') {
        const brandEntry = entry as any;
        // Try to find full brand data to get location
        const fullBrand = brands?.find(b => b.id === brandEntry.brandId);

        // Check for coordinates: first from brand data, then from geocoded cache
        let coords: { lat: number; lng: number } | null = null;
        if (fullBrand?.latitude && fullBrand?.longitude) {
          coords = { lat: fullBrand.latitude, lng: fullBrand.longitude };
        } else if (brandEntry.brandId && geocodedBrandLocations[brandEntry.brandId]) {
          coords = geocodedBrandLocations[brandEntry.brandId];
        }

        if (coords) {
          entries.push({
            id: brandEntry.brandId,
            name: brandEntry.brandName || fullBrand?.name,
            category: brandEntry.brandCategory || fullBrand?.category,
            address: fullBrand?.location,
            logoUrl: brandEntry.logoUrl,
            location: coords,
            type: 'brand',
            originalEntry: entry,
          });
        }
      }
    });

    return entries;
  }, [endorsementList?.entries, allBusinesses, brands, geocodedBrandLocations, categoryFilter, localFilter]);

  // Reset geocoding flag when modal closes
  useEffect(() => {
    if (!showMapModal) {
      geocodingStartedRef.current = false;
    }
  }, [showMapModal]);

  // Geocode brands without coordinates when map modal opens (runs only once per modal session)
  useEffect(() => {
    if (!showMapModal || !endorsementList?.entries || !brands) return;

    // Only run geocoding once per modal session
    if (geocodingStartedRef.current) return;
    geocodingStartedRef.current = true;

    const geocodeBrands = async () => {
      const brandsToGeocode: Array<{ brandId: string; location: string }> = [];

      // Find brands that need geocoding
      endorsementList.entries.forEach((entry) => {
        if (entry.type === 'brand') {
          const brandEntry = entry as any;
          const fullBrand = brands?.find(b => b.id === brandEntry.brandId);

          // If brand has location string but no coordinates
          if (
            fullBrand?.location &&
            !fullBrand.latitude &&
            !fullBrand.longitude
          ) {
            brandsToGeocode.push({
              brandId: brandEntry.brandId,
              location: fullBrand.location,
            });
          }
        }
      });

      if (brandsToGeocode.length === 0) return;

      setIsGeocodingBrands(true);

      // Geocode brands in parallel and save to Firebase
      const newGeocodedLocations: Record<string, { lat: number; lng: number }> = {};

      await Promise.all(
        brandsToGeocode.map(async ({ brandId, location }) => {
          // This geocodes and saves to Firebase so future lookups don't need geocoding
          const coords = await geocodeAndSaveBrandLocation(brandId, location);
          if (coords) {
            newGeocodedLocations[brandId] = coords;
          }
        })
      );

      // Update state once with all results
      if (Object.keys(newGeocodedLocations).length > 0) {
        setGeocodedBrandLocations(prev => ({ ...prev, ...newGeocodedLocations }));
      }
      setIsGeocodingBrands(false);
    };

    geocodeBrands();
  }, [showMapModal, endorsementList?.entries, brands]); // Removed geocodedBrandLocations from deps

  // Handle adding a brand, business, or place to endorsement list
  const handleAddToEndorsement = useCallback(async (item: any, type: 'brand' | 'business' | 'place') => {
    if (!endorsementList?.id || !currentUserId) {
      Alert.alert('Error', 'Unable to add to endorsements. Please try again.');
      return;
    }

    const itemId = type === 'place' ? item.placeId : item.id;
    setAddingItemId(itemId);

    try {
      let entry: Omit<ListEntry, 'id'>;

      if (type === 'brand') {
        entry = {
          type: 'brand',
          brandId: item.id,
          brandName: item.name,
          brandCategory: item.category,
          website: item.website,
          logoUrl: item.exampleImageUrl || getLogoUrl(item.website || ''),
          createdAt: new Date(),
        };
      } else if (type === 'business') {
        entry = {
          type: 'business',
          businessId: item.id,
          businessName: item.businessInfo?.name || 'Business',
          businessCategory: item.businessInfo?.category,
          website: item.businessInfo?.website,
          logoUrl: item.businessInfo?.logoUrl || getLogoUrl(item.businessInfo?.website || ''),
          createdAt: new Date(),
        };
      } else {
        // External place from Google Places API
        // Fetch full details to get website for logo.dev
        let website: string | undefined;
        let logoUrl: string | undefined;

        try {
          const placeDetails = await getPlaceDetails(item.placeId);
          if (placeDetails?.website) {
            website = placeDetails.website;
            // Use logo.dev for brand logo (great for franchises like Shake Shack)
            logoUrl = getLogoUrl(website, { size: 128 });
          }
        } catch (e) {
          console.log('[UnifiedLibrary] Could not fetch place details for logo:', e);
        }

        // Fall back to Google photo if no website/logo
        if (!logoUrl && item.photoReference) {
          logoUrl = getPlacePhotoUrl(item.photoReference);
        }

        // Build entry with only defined values to avoid Firestore issues
        const placeEntry: any = {
          type: 'place',
          placeId: item.placeId,
          placeName: item.name || 'Unknown Place',
        };

        // Only add optional fields if they have values
        if (item.category) placeEntry.placeCategory = item.category;
        if (item.address) placeEntry.placeAddress = item.address;
        if (website) placeEntry.website = website;
        if (item.photoReference) placeEntry.photoReference = item.photoReference;
        if (logoUrl) placeEntry.logoUrl = logoUrl;
        if (item.rating !== undefined && item.rating !== null) placeEntry.rating = item.rating;
        if (item.location && item.location.lat !== undefined && item.location.lng !== undefined) {
          placeEntry.location = { lat: item.location.lat, lng: item.location.lng };
        }

        entry = placeEntry;
      }

      await library.addEntry(endorsementList.id, entry);
      console.log('[UnifiedLibrary] Added', type, 'to endorsement list:', type === 'place' ? item.name : (entry as any).name);
      // Track this item as added
      setAddedItemIds(prev => new Set(prev).add(itemId));
      // Force reload library to ensure state is synced
      if (currentUserId) {
        await library.loadUserLists(currentUserId, true);
      }
    } catch (error) {
      console.error('[UnifiedLibrary] Error adding to endorsement:', error);
      Alert.alert('Error', 'Failed to add to endorsements. Please try again.');
    } finally {
      setAddingItemId(null);
    }
  }, [endorsementList, currentUserId, library]);

  // Navigate to brand, business, or place details
  const handleNavigateToDetails = useCallback((item: any, type: 'brand' | 'business' | 'place') => {
    setShowAddEndorsementModal(false);
    setAddSearchQuery('');
    if (type === 'brand') {
      router.push(`/brand/${item.id}`);
    } else if (type === 'business') {
      router.push(`/business/${item.id}`);
    } else {
      // Navigate to place details page
      router.push(`/place/${item.placeId}`);
    }
  }, [router]);

  // Share handlers - Open ShareOptionsModal first
  const handleShareList = (list: UserList) => {
    setSharingItem({ type: 'list', data: list });
    setShowShareOptionsModal(true);
  };

  // Generate share URL for lists
  const getListShareUrl = (list: UserList): string => {
    if (Platform.OS === 'web') {
      return `${window.location.origin}/list/${list.id}`;
    }
    // For mobile, use a deep link format (can be updated with actual deep link scheme)
    return `iendorse://list/${list.id}`;
  };

  const getItemShareUrl = (entry: ListEntry): string => {
    if (entry.type === 'brand') {
      const brandId = (entry as any).brandId;
      if (Platform.OS === 'web') {
        return `${window.location.origin}/brand/${brandId}`;
      }
      return `iendorse://brand/${brandId}`;
    } else if (entry.type === 'business') {
      const businessId = (entry as any).businessId;
      if (Platform.OS === 'web') {
        return `${window.location.origin}/business/${businessId}`;
      }
      return `iendorse://business/${businessId}`;
    }
    // For other types (value, link, text), no URL
    return '';
  };

  const performShareList = async (list: UserList) => {
    try {
      const message = `Check out my list "${list.name}" on Endorse Money!\n${list.description || ''}`;
      await Share.share({
        message,
        title: list.name,
      });
    } catch (error) {
      console.error('Error sharing list:', error);
    }
  };

  const handleShareItem = (entry: ListEntry) => {
    setSharingItem({ type: 'entry', data: entry });
    setShowShareOptionsModal(true);
  };

  const handleFollow = async (entry: ListEntry, isCurrentlyFollowing: boolean) => {
    if (!currentUserId) {
      Alert.alert('Error', 'You must be logged in to follow');
      return;
    }

    const accountId = (entry.type === 'brand' ? (entry as any).brandId : (entry as any).businessId) as string;
    const accountType = entry.type as 'brand' | 'business';
    const accountName = (entry as any).brandName || (entry as any).businessName || (entry as any).name || 'Account';

    if (!accountId) {
      console.error('[UnifiedLibrary] No account ID found for entry:', entry);
      Alert.alert('Error', 'Cannot follow this item');
      return;
    }

    try {
      if (isCurrentlyFollowing) {
        await unfollowEntity(currentUserId, accountId, accountType);
        Alert.alert('Success', `Unfollowed ${accountName}`);
      } else {
        await followEntity(currentUserId, accountId, accountType);
        Alert.alert('Success', `Now following ${accountName}`);
      }

      // Force refresh to update UI
      if (currentUserId) {
        await library.loadUserLists(currentUserId, true);
      }
    } catch (error) {
      console.error('[UnifiedLibrary] Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  const performShareItem = async (entry: ListEntry) => {
    try {
      let message = '';
      let title = '';

      switch (entry.type) {
        case 'brand':
          const brandName = (entry as any).brandName || (entry as any).name || 'Brand';
          title = brandName;
          message = `Check out ${brandName} on Endorse Money!`;
          break;
        case 'business':
          const businessName = (entry as any).businessName || (entry as any).name || 'Business';
          title = businessName;
          message = `Check out ${businessName} on Endorse Money!`;
          break;
        case 'value':
          const valueName = (entry as any).valueName || (entry as any).name || 'Value';
          title = valueName;
          message = `I value ${valueName}`;
          break;
        case 'link':
          const linkTitle = (entry as any).title || (entry as any).name || 'Link';
          title = linkTitle;
          message = `${linkTitle}\n${(entry as any).url}`;
          break;
        case 'text':
          const textContent = (entry as any).content || (entry as any).text || '';
          title = 'Shared Note';
          message = textContent;
          break;
      }

      await Share.share({
        message,
        title,
      });
    } catch (error) {
      console.error('Error sharing item:', error);
    }
  };

  // Edit List handler - Open EditListModal
  const handleEditList = (list: UserList) => {
    setEditingList(list);
    setShowEditListModal(true);
  };

  const performEditList = async (name: string, description: string) => {
    if (!editingList) return;

    try {
      await updateListMetadata(editingList.id, {
        name,
        description,
      });
      // Reload lists to reflect the change
      if (currentUserId) {
        await library.loadUserLists(currentUserId, true);
      }
    } catch (error) {
      console.error('Error updating list:', error);
      Alert.alert('Error', 'Failed to update list. Please try again.');
    }
  };

  // ===== Reorder Handlers =====

  // Move item up in the list (mobile)
  const handleMoveUp = (index: number) => {
    if (index === 0) return; // Already at top
    const newEntries = [...localEntries];
    [newEntries[index - 1], newEntries[index]] = [newEntries[index], newEntries[index - 1]];
    setLocalEntries(newEntries);
  };

  // Move item down in the list (mobile)
  const handleMoveDown = (index: number) => {
    if (index === localEntries.length - 1) return; // Already at bottom
    const newEntries = [...localEntries];
    [newEntries[index], newEntries[index + 1]] = [newEntries[index + 1], newEntries[index]];
    setLocalEntries(newEntries);
  };

  // Handle drag end (desktop)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localEntries.findIndex((entry) => entry.id === active.id);
    const newIndex = localEntries.findIndex((entry) => entry.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newEntries = arrayMove(localEntries, oldIndex, newIndex);
    setLocalEntries(newEntries);
  };

  // Save reordered entries to Firebase
  const handleSaveReorder = async () => {
    if (!reorderingListId) return;

    try {
      await reorderListEntries(reorderingListId, localEntries);

      // Reload lists to reflect changes
      if (currentUserId) {
        await library.loadUserLists(currentUserId, true);
      }

      setIsReorderMode(false);
      setReorderingListId(null);
      setLocalEntries([]);
      Alert.alert('Success', 'List reordered successfully!');
    } catch (error) {
      console.error('[UnifiedLibrary] Error reordering list:', error);
      Alert.alert('Error', 'Failed to save new order. Please try again.');
    }
  };

  // Cancel reordering
  const handleCancelReorder = () => {
    setIsReorderMode(false);
    setReorderingListId(null);
    setLocalEntries([]);
  };

  // Privacy toggle handler
  const handleTogglePrivacy = async (listId: string, currentStatus: boolean) => {
    try {
      // Handle aligned/unaligned system lists differently
      if (listId === 'aligned' || listId === 'unaligned') {
        if (!currentUserId) return;

        // Update user profile field
        const userRef = doc(db, 'users', currentUserId);
        const fieldName = listId === 'aligned' ? 'alignedListPublic' : 'unalignedListPublic';
        await updateDoc(userRef, {
          [fieldName]: !currentStatus
        });

        // Reload lists to reflect the change
        await library.loadUserLists(currentUserId, true);
      } else {
        // Handle regular user lists
        await updateListMetadata(listId, { isPublic: !currentStatus });
        // Reload lists to reflect the change
        if (currentUserId) {
          await library.loadUserLists(currentUserId, true);
        }
      }

      // Show success feedback
      const newStatus = !currentStatus ? 'Public' : 'Private';
      if (Platform.OS === 'web') {
        // Brief success message on web
        console.log(`List is now ${newStatus}`);
      } else {
        Alert.alert('Success', `List is now ${newStatus}`);
      }
    } catch (error) {
      console.error('Error toggling privacy:', error);
      Alert.alert('Error', 'Failed to update privacy setting. Please try again.');
    }
  };

  // Check if an item is already endorsed
  const isItemEndorsed = (entry: ListEntry): boolean => {
    if (!endorsementList?.entries) return false;

    const itemId = entry.brandId || entry.businessId || entry.valueId || (entry as any).placeId;
    if (!itemId) return false;

    return endorsementList.entries.filter(e => e).some(e => {
      const endorsedId = e.brandId || e.businessId || e.valueId || (e as any).placeId;
      return endorsedId === itemId;
    });
  };

  // Add to Library handler - directly adds to endorsement list
  const handleAddToLibrary = async (entry: ListEntry) => {
    if (!endorsementList?.id) {
      Alert.alert('Error', 'Endorsement list not found');
      return;
    }

    try {
      await library.addEntry(endorsementList.id, entry);

      // Force refresh library to show the new entry immediately
      if (currentUserId) {
        await library.loadUserLists(currentUserId, true);
      }

      const itemName = getItemName(entry);
      Alert.alert('Success', `${itemName} endorsed!`);
      setSelectedItemForOptions(null);
    } catch (error: any) {
      console.error('Error endorsing item:', error);
      Alert.alert('Error', error?.message || 'Failed to endorse item');
    }
  };

  // Remove from endorsement list handler
  const handleRemoveFromLibrary = async (entry: ListEntry) => {
    if (!endorsementList?.id) {
      Alert.alert('Error', 'Endorsement list not found');
      return;
    }

    try {
      // Find the entry in the endorsement list
      const itemId = entry.brandId || entry.businessId || entry.valueId || (entry as any).placeId;
      const endorsedEntry = endorsementList.entries.filter(e => e).find(e => {
        const endorsedId = e.brandId || e.businessId || e.valueId || (e as any).placeId;
        return endorsedId === itemId;
      });

      if (!endorsedEntry) {
        Alert.alert('Error', 'Item not found in endorsement list');
        return;
      }

      await library.removeEntry(endorsementList.id, endorsedEntry.id);

      // Force refresh library to show the removal immediately
      if (currentUserId) {
        await library.loadUserLists(currentUserId, true);
      }

      const itemName = getItemName(entry);
      Alert.alert('Success', `${itemName} unendorsed!`);
      setSelectedItemForOptions(null);
    } catch (error: any) {
      console.error('Error unendorsing item:', error);
      Alert.alert('Error', error?.message || 'Failed to unendorse item');
    }
  };

  // Alias for handleAddToLibrary - used by action menu
  const handleEndorseItem = handleAddToLibrary;

  // Toggle follow status for brand or business
  const handleToggleFollow = async (itemId: string, itemType: 'brand' | 'business') => {
    if (!currentUserId) {
      Alert.alert('Error', 'You must be logged in to follow');
      return;
    }

    try {
      const isCurrentlyFollowing = await checkIsFollowing(currentUserId, itemId, itemType);

      if (isCurrentlyFollowing) {
        await unfollowEntity(currentUserId, itemId, itemType);
        Alert.alert('Success', 'Unfollowed successfully');
      } else {
        await followEntity(currentUserId, itemId, itemType);
        Alert.alert('Success', 'Now following');
      }

      // Update the isFollowingSelectedItem state
      setIsFollowingSelectedItem(!isCurrentlyFollowing);
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleSelectList = async (listId: string) => {
    if (!selectedItemToAdd) return;

    try {
      await library.addEntry(listId, selectedItemToAdd);

      // Force refresh library to show the new entry immediately
      if (currentUserId) {
        await library.loadUserLists(currentUserId, true);
      }

      const listName = library.state.userLists.find(l => l.id === listId)?.name ||
                       library.state.endorsementList?.name || 'list';
      Alert.alert('Success', `Added to "${listName}"`);
    } catch (error: any) {
      throw error; // Let modal handle it
    }
  };

  const handleCreateNewList = async (listName: string) => {
    if (!currentUserId || !selectedItemToAdd) return;

    try {
      const newList = await library.createNewList(currentUserId, listName.trim());
      await library.addEntry(newList.id, selectedItemToAdd);
      Alert.alert('Success', `Created "${listName}" and added item`);
    } catch (error: any) {
      throw error; // Let modal handle it
    }
  };

  const getAddToLibraryLists = () => {
    const myEndorsementList = library.state.endorsementList;
    const myCustomLists = library.state.userLists.filter(list => list.id !== myEndorsementList?.id);

    // Only show lists that the current user owns (created) AND not copied from others
    // Lists with originalListId are copies from other users and should not be modifiable
    const ownedEndorsementList = myEndorsementList && myEndorsementList.userId === currentUserId && !myEndorsementList.originalListId ? myEndorsementList : null;
    const ownedCustomLists = myCustomLists.filter(list => list.userId === currentUserId && !list.originalListId);

    return [
      ...(ownedEndorsementList ? [ownedEndorsementList] : []),
      ...ownedCustomLists,
    ];
  };

  const getItemName = (entry: ListEntry): string => {
    switch (entry.type) {
      case 'brand':
        return (entry as any).brandName || (entry as any).name || 'Brand';
      case 'business':
        return (entry as any).businessName || (entry as any).name || 'Business';
      case 'value':
        return (entry as any).valueName || (entry as any).name || 'Value';
      case 'link':
        return (entry as any).title || (entry as any).name || 'Link';
      case 'text':
        return 'Note';
      default:
        return 'Item';
    }
  };

  // Open action options modal for an entry
  const handleOpenActionModal = async (entry: ListEntry) => {
    setSelectedItemForOptions(entry);
    setShowActionOptionsModal(true);

    // Check follow status for the item
    if (currentUserId) {
      const itemId = entry.brandId || entry.businessId;
      const itemType = entry.type === 'brand' ? 'brand' : 'business';
      if (itemId && (itemType === 'brand' || itemType === 'business')) {
        setCheckingFollowStatus(true);
        try {
          const following = await checkIsFollowing(currentUserId, itemId, itemType);
          setIsFollowingSelectedItem(following);
        } catch (error) {
          console.error('[UnifiedLibrary] Error checking follow status:', error);
        } finally {
          setCheckingFollowStatus(false);
        }
      }
    }
  };

  // Get action options for the modal
  const getActionModalOptions = () => {
    if (!selectedItemForOptions) return [];

    const isEndorsed = endorsementList?.entries?.some(e => {
      const entryId = selectedItemForOptions.brandId || selectedItemForOptions.businessId || selectedItemForOptions.valueId || (selectedItemForOptions as any).placeId;
      const endorsedId = e?.brandId || e?.businessId || e?.valueId || (e as any)?.placeId;
      return endorsedId === entryId;
    });

    return [
      {
        icon: Heart,
        label: isEndorsed ? 'Unendorse' : 'Endorse',
        onPress: () => {
          if (isEndorsed) {
            handleRemoveFromLibrary(selectedItemForOptions);
          } else {
            handleEndorseItem(selectedItemForOptions);
          }
        },
      },
      {
        icon: UserPlus,
        label: isFollowingSelectedItem ? 'Unfollow' : 'Follow',
        onPress: () => {
          const itemId = selectedItemForOptions.brandId || selectedItemForOptions.businessId;
          const itemType = selectedItemForOptions.type === 'brand' ? 'brand' : 'business';
          if (itemId && (itemType === 'brand' || itemType === 'business')) {
            handleToggleFollow(itemId, itemType);
          }
        },
      },
      {
        icon: Share2,
        label: 'Share',
        onPress: () => {
          setSharingItem({ type: 'entry', data: selectedItemForOptions });
          setShowShareOptionsModal(true);
        },
      },
    ];
  };

  // Render brand card with score (for Product type)
  const renderBrandCard = (product: Product, type: 'support' | 'avoid') => {
    const isSupport = type === 'support';
    const alignmentScore = scoredBrands.get(product.id);
    const scoreColor = alignmentScore !== undefined
      ? (alignmentScore >= 50 ? colors.primary : colors.danger)
      : colors.textSecondary;

    // Create a pseudo-entry for action menu
    const pseudoEntry: ListEntry = {
      type: 'brand',
      id: `brand_${product.id}`,
      brandId: product.id,
      brandName: product.name || 'Unknown Brand',
      brandCategory: product.category,
      website: product.website,
      logoUrl: getLogoUrl(product.website || ''),
      createdAt: new Date()
    } as ListEntry;

    return (
      <View>
        <TouchableOpacity
          style={[
            styles.brandCard,
            { backgroundColor: 'transparent' },
          ]}
          onPress={() => {
            router.push({
              pathname: '/brand/[id]',
              params: { id: product.id },
            });
          }}
          activeOpacity={0.7}
        >
        <View style={styles.brandCardInner}>
          <View style={styles.brandLogoContainer}>
            <Image
              source={{ uri: getLogoUrl(product.website || '') }}
              style={[styles.brandLogo, { backgroundColor: '#FFFFFF' }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.brandCardContent}>
            <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={2}>
              {product.name || 'Unknown Brand'}
            </Text>
            <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
              {product.category || 'Uncategorized'}
            </Text>
          </View>
          {alignmentScore !== undefined && (
            <View style={styles.brandScoreContainer}>
              <Text style={[styles.brandScore, { color: scoreColor }]}>
                {Math.round(alignmentScore)}
              </Text>
            </View>
          )}
          {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
            <TouchableOpacity
              style={[styles.quickAddButton, { backgroundColor: colors.background }]}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenActionModal(pseudoEntry);
              }}
              activeOpacity={0.7}
            >
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
      </View>
    );
  };

  // Helper function to get cumulative days endorsed for an entry
  const getCumulativeDaysForEntry = (entry: ListEntry): number => {
    const entityId = entry.type === 'brand'
      ? (entry as any).brandId
      : (entry as any).businessId;
    return cumulativeDaysMap[entityId] || 0;
  };

  // Helper function to get card background color based on position
  const getEntryCardBackgroundColor = (index: number): string => {
    // Use app blue with different opacities
    // Light mode: rgb(3, 68, 102), Dark mode: rgb(0, 170, 250)
    if (index < 5) {
      // Top 5: 35% opacity
      return isDarkMode ? 'rgba(0, 170, 250, 0.35)' : 'rgba(3, 68, 102, 0.35)';
    } else if (index < 10) {
      // 6-10: 20% opacity
      return isDarkMode ? 'rgba(0, 170, 250, 0.20)' : 'rgba(3, 68, 102, 0.20)';
    }
    // 11+: 10% opacity
    return isDarkMode ? 'rgba(0, 170, 250, 0.10)' : 'rgba(3, 68, 102, 0.10)';
  };

  // EXACT copy of Home tab's renderListEntry with score calculation
  const renderListEntry = (entry: ListEntry, isEndorsementSection: boolean = false, entryIndex?: number) => {
    if (!entry) return null;

    switch (entry.type) {
      case 'brand':
        if ('brandId' in entry) {
          const brand = alignedItems.find(b => b.id === entry.brandId) ||
                       unalignedItems.find(b => b.id === entry.brandId);
          // Don't use renderBrandCard for endorsement section - it shows scores
          // Always render manually for endorsement to show days endorsed instead
          if (brand && !isEndorsementSection) {
            // Brand found - render with full data and score (only for non-endorsement sections)
            return renderBrandCard(brand, 'support');
          }

          // Brand not in aligned/unaligned arrays (middle-scoring brands)
          // Look up full brand data from Firebase brands array
          let fullBrand = brands.find(b => b.id === entry.brandId);

          // If not found by ID, try to find by website (for brands that may have been updated)
          if (!fullBrand && entry.website) {
            fullBrand = brands.find(b => b.website && b.website.toLowerCase() === entry.website?.toLowerCase());
          }

          // If not found by website, try to find by name (case-insensitive)
          if (!fullBrand && entry.brandName) {
            fullBrand = brands.find(b => b.name.toLowerCase() === entry.brandName.toLowerCase());
          }

          // Use data from fullBrand if found, otherwise use stored entry data
          const brandName = fullBrand?.name || entry.brandName || 'Unknown Brand';
          const brandCategory = fullBrand?.category || entry.brandCategory || 'Uncategorized';
          const website = fullBrand?.website || entry.website || '';
          const logoUrl = entry.logoUrl || (entry as any).logo || getLogoUrl(website);
          const alignmentScore = scoredBrands.get(entry.brandId) || 50;
          const scoreColor = alignmentScore >= 50 ? colors.primary : colors.danger;

          // Use fullBrand.id if found, otherwise use entry.brandId for navigation
          const navigationId = fullBrand?.id || entry.brandId;

          // Endorsement section: render as card with position-based background
          if (isEndorsementSection && entryIndex !== undefined) {
            const cardBgColor = getEntryCardBackgroundColor(entryIndex);
            return (
              <TouchableOpacity
                style={[
                  styles.endorsementEntryCard,
                  { backgroundColor: cardBgColor },
                ]}
                onPress={() => {
                  router.push({
                    pathname: '/brand/[id]',
                    params: { id: navigationId },
                  });
                }}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: logoUrl }}
                  style={styles.endorsementEntryCardImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={styles.endorsementEntryCardContent}>
                  <View style={styles.endorsementEntryCardFirstLine}>
                    <Text style={[styles.endorsementEntryCardNumber, { color: colors.text }]}>{entryIndex + 1}.</Text>
                    <Text style={[styles.endorsementEntryCardName, { color: colors.text }]} numberOfLines={1}>
                      {brandName}
                    </Text>
                  </View>
                  <Text style={[styles.endorsementEntryCardCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                    endorsed for {getCumulativeDaysForEntry(entry)} {getCumulativeDaysForEntry(entry) === 1 ? 'day' : 'days'}
                  </Text>
                </View>
                {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                  <TouchableOpacity
                    style={styles.endorsementEntryOptionsButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenActionModal(entry);
                    }}
                    activeOpacity={0.7}
                  >
                    <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }

          // Non-endorsement section: render original style
          return (
            <View>
              <TouchableOpacity
                style={[
                  styles.brandCard,
                  { backgroundColor: 'transparent' },
                ]}
                onPress={() => {
                  router.push({
                    pathname: '/brand/[id]',
                    params: { id: navigationId },
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.brandCardInner}>
                  <View style={styles.brandLogoContainer}>
                    <Image
                      source={{ uri: logoUrl }}
                      style={[styles.brandLogo, { backgroundColor: '#FFFFFF' }]}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <View style={styles.brandCardContent}>
                    <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={2}>
                      {brandName}
                    </Text>
                    <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                      {brandCategory}
                    </Text>
                  </View>
                  <View style={styles.brandScoreContainer}>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </View>
                  {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenActionModal(entry);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        }
        break;

      case 'business':
        if ('businessId' in entry) {
          // Get business score from scoredBrands map
          const alignmentScore = scoredBrands.get(entry.businessId) || 50;
          const scoreColor = alignmentScore >= 50 ? colors.primary : colors.danger;

          // Look up full business data from userBusinesses or allBusinesses
          const fullBusiness = userBusinesses.find(b => b.id === entry.businessId)
            || allBusinesses.find(b => b.id === entry.businessId);

          // Get business name from multiple possible fields - prefer actual business data
          const businessName = fullBusiness?.businessInfo?.name || (entry as any).businessName || (entry as any).name || 'Unknown Business';
          const businessCategory = fullBusiness?.businessInfo?.category || (entry as any).businessCategory || (entry as any).category;
          // Use actual business logoUrl first, then entry data, fallback to generated logo from website
          const businessWebsite = fullBusiness?.businessInfo?.website || (entry as any).website || '';
          const logoUrl = fullBusiness?.businessInfo?.logoUrl || (entry as any).logoUrl || (entry as any).logo || (businessWebsite ? getLogoUrl(businessWebsite) : getLogoUrl(''));
          // Get discount percentage if available
          const discountPercent = fullBusiness?.businessInfo?.endorsementDiscountPercent || fullBusiness?.businessInfo?.customerDiscountPercent;

          // Endorsement section: render as card with position-based background
          if (isEndorsementSection && entryIndex !== undefined) {
            const cardBgColor = getEntryCardBackgroundColor(entryIndex);
            return (
              <TouchableOpacity
                style={[
                  styles.endorsementEntryCard,
                  { backgroundColor: cardBgColor },
                ]}
                onPress={() => {
                  router.push({
                    pathname: '/business/[id]',
                    params: { id: entry.businessId },
                  });
                }}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: logoUrl }}
                  style={styles.endorsementEntryCardImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={styles.endorsementEntryCardContent}>
                  <View style={styles.endorsementEntryCardFirstLine}>
                    <Text style={[styles.endorsementEntryCardNumber, { color: colors.text }]}>{entryIndex + 1}.</Text>
                    <Text style={[styles.endorsementEntryCardName, { color: colors.text }]} numberOfLines={1}>
                      {businessName}
                    </Text>
                  </View>
                  <Text style={[styles.endorsementEntryCardCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                    endorsed for {getCumulativeDaysForEntry(entry)} {getCumulativeDaysForEntry(entry) === 1 ? 'day' : 'days'}
                  </Text>
                </View>
                {discountPercent !== undefined && discountPercent > 0 && (
                  <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.discountBadgeText, { color: '#FFFFFF' }]}>{discountPercent.toFixed(0)}%</Text>
                  </View>
                )}
                {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                  <TouchableOpacity
                    style={styles.endorsementEntryOptionsButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenActionModal(entry);
                    }}
                    activeOpacity={0.7}
                  >
                    <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }

          // Non-endorsement section: render original style
          return (
            <View>
              <TouchableOpacity
                style={[
                  styles.brandCard,
                  { backgroundColor: 'transparent' },
                ]}
                onPress={() => {
                  router.push({
                    pathname: '/business/[id]',
                    params: { id: entry.businessId },
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.brandCardInner}>
                  <View style={styles.brandLogoContainer}>
                    <Image
                      source={{ uri: logoUrl }}
                      style={[styles.brandLogo, { backgroundColor: '#FFFFFF' }]}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <View style={styles.brandCardContent}>
                    <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={2}>
                      {businessName}
                    </Text>
                    <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                      {businessCategory || 'Business'}
                    </Text>
                  </View>
                  <View style={styles.brandScoreContainer}>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </View>
                  {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenActionModal(entry);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        }
        break;

      case 'value':
        if ('valueId' in entry) {
          const isSupport = entry.mode !== 'maxPain';
          const iconColor = isSupport ? colors.primary : colors.danger;
          const valueName = (entry as any).valueName || (entry as any).name || 'Unknown Value';

          return (
            <View>
              <View style={[
                styles.brandCard,
                { backgroundColor: 'transparent' },
              ]}>
                <View style={styles.brandCardInner}>
                  <View style={[
                    styles.brandLogoContainer,
                    {
                      backgroundColor: isSupport ? colors.primary + '20' : colors.danger + '20',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }
                  ]}>
                    <Target size={32} color={iconColor} strokeWidth={2} />
                  </View>
                  <View style={styles.brandCardContent}>
                    <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={2}>
                      {valueName}
                    </Text>
                    <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                      {entry.mode === 'maxPain' ? 'Avoid' : 'Support'}
                    </Text>
                  </View>
                  {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenActionModal(entry);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }
        break;

      case 'link':
        if ('url' in entry) {
          const linkTitle = (entry as any).title || (entry as any).name || 'Link';
          return (
            <View>
              <TouchableOpacity
                style={[
                  styles.brandCard,
                  { backgroundColor: 'transparent', borderColor: 'transparent' }
                ]}
                onPress={() => canInteract && Linking.openURL(entry.url)}
                activeOpacity={0.7}
                disabled={!canInteract}
              >
                <View style={styles.brandCardInner}>
                  <View style={styles.brandCardContent}>
                    <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={1}>
                      {linkTitle}
                    </Text>
                    {(entry as any).description && (
                      <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={2}>
                        {(entry as any).description}
                      </Text>
                    )}
                  </View>
                  <ExternalLink size={16} color={colors.textSecondary} strokeWidth={2} />
                  {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenActionModal(entry);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        }
        break;

      case 'text':
        if ('content' in entry) {
          const textContent = (entry as any).content || (entry as any).text || 'No content';
          return (
            <View>
              <View style={[
                styles.brandCard,
                { backgroundColor: 'transparent', borderColor: 'transparent' }
              ]}>
                <View style={styles.brandCardInner}>
                  <View style={styles.brandCardContent}>
                    <Text style={[styles.brandName, { color: colors.white }]}>
                      {textContent}
                    </Text>
                  </View>
                  {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenActionModal(entry);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }
        break;

      case 'place':
        if ('placeId' in entry) {
          const placeName = (entry as any).placeName || (entry as any).name || 'Unknown Place';
          const placeCategory = (entry as any).placeCategory || 'Business';
          const placeAddress = (entry as any).placeAddress || '';
          const placeWebsite = (entry as any).website;
          // Prefer logo.dev (from website) over Google photo
          let logoUrl = (entry as any).logoUrl;
          if (!logoUrl && placeWebsite) {
            // Try logo.dev if we have a website but no stored logoUrl
            logoUrl = getLogoUrl(placeWebsite, { size: 128 });
          } else if (!logoUrl && (entry as any).photoReference) {
            // Fall back to Google photo
            logoUrl = getPlacePhotoUrl((entry as any).photoReference);
          }

          // Endorsement section: render as card with position-based background
          if (isEndorsementSection && entryIndex !== undefined) {
            const cardBgColor = getEntryCardBackgroundColor(entryIndex);
            return (
              <TouchableOpacity
                style={[
                  styles.endorsementEntryCard,
                  { backgroundColor: cardBgColor },
                ]}
                onPress={() => {
                  router.push({
                    pathname: '/place/[id]',
                    params: { id: (entry as any).placeId },
                  });
                }}
                activeOpacity={0.7}
              >
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={styles.endorsementEntryCardImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.endorsementEntryCardImage, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                    <Globe size={32} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.endorsementEntryCardContent}>
                  <View style={styles.endorsementEntryCardFirstLine}>
                    <Text style={[styles.endorsementEntryCardNumber, { color: colors.text }]}>{entryIndex + 1}.</Text>
                    <Text style={[styles.endorsementEntryCardName, { color: colors.text }]} numberOfLines={1}>
                      {placeName}
                    </Text>
                  </View>
                  <Text style={[styles.endorsementEntryCardCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                    endorsed for {getCumulativeDaysForEntry(entry)} {getCumulativeDaysForEntry(entry) === 1 ? 'day' : 'days'}
                  </Text>
                </View>
                {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                  <TouchableOpacity
                    style={styles.endorsementEntryOptionsButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenActionModal(entry);
                    }}
                    activeOpacity={0.7}
                  >
                    <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }

          // Non-endorsement section: render original style
          return (
            <View>
              <TouchableOpacity
                style={[
                  styles.brandCard,
                  { backgroundColor: 'transparent' },
                ]}
                onPress={() => {
                  router.push({
                    pathname: '/place/[id]',
                    params: { id: (entry as any).placeId },
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.brandCardInner}>
                  <View style={styles.brandLogoContainer}>
                    {logoUrl ? (
                      <Image
                        source={{ uri: logoUrl }}
                        style={[styles.brandLogo, { backgroundColor: '#FFFFFF' }]}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[styles.brandLogo, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                        <Globe size={24} color={colors.textSecondary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.brandCardContent}>
                    <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={2}>
                      {placeName}
                    </Text>
                    <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                      {formatCategory(placeCategory)}
                    </Text>
                  </View>
                  <View style={styles.brandScoreContainer}>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </View>
                  {(mode === 'edit' || mode === 'view' || mode === 'preview') && (
                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenActionModal(entry);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        }
        break;
    }

    return null;
  };

  // EXACT copy of Home tab's renderCollapsibleListHeader
  // Render list card for navigation (overview mode)
  const renderListCard = (
    listId: string,
    title: string,
    itemCount: number,
    isEndorsed: boolean = false,
    attribution?: string,
    description?: string,
    isPublic?: boolean,
    creatorProfileImage?: string,
    useAppIcon?: boolean
  ) => {
    const isOptionsOpen = activeListOptionsId === listId;

    return (
      <View style={{ position: 'relative', overflow: 'visible', zIndex: isOptionsOpen ? 9999 : 1 }}>
        <TouchableOpacity
          style={styles.collapsibleListHeader}
          onPress={() => handleListClick(listId)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {/* Profile Image */}
          <View style={[styles.listProfileImageContainer, { backgroundColor: 'transparent', borderColor: colors.border }]}>
            {useAppIcon ? (
              <Image
                source={require('@/assets/images/endorseofficialicon.png')}
                style={styles.listProfileImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : creatorProfileImage ? (
              <Image
                source={{ uri: creatorProfileImage }}
                style={styles.listProfileImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <User size={24} color={colors.textSecondary} strokeWidth={2} />
            )}
          </View>

          <View style={styles.collapsibleListHeaderContent}>
            <View style={styles.collapsibleListInfo}>
              <View style={styles.collapsibleListTitleRow}>
                <Text style={[styles.collapsibleListTitle, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
                {isEndorsed && <EndorsedBadge isDarkMode={isDarkMode} size="small" showText={isLargeScreen} />}
              </View>
              <View style={styles.collapsibleListMeta}>
                <Text style={[styles.collapsibleListCount, { color: colors.textSecondary }]}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Text>
                {isPublic !== undefined && (
                  <View style={styles.privacyIndicator}>
                    {isPublic ? (
                      <>
                        <Globe size={14} color={colors.primary} strokeWidth={2} />
                        {isLargeScreen && <Text style={[styles.privacyText, { color: colors.primary }]}>Public</Text>}
                      </>
                    ) : (
                      <>
                        <Lock size={14} color={colors.textSecondary} strokeWidth={2} />
                        {isLargeScreen && <Text style={[styles.privacyText, { color: colors.textSecondary }]}>Private</Text>}
                      </>
                    )}
                  </View>
                )}
              </View>
              {description && (
                <Text style={[styles.collapsibleListDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {description}
                </Text>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
          </View>
        </TouchableOpacity>

        {/* Options dropdown - show in edit mode AND view mode */}
        {(canEdit || mode === 'view') && isOptionsOpen && (
          <View style={[styles.listOptionsDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            {(() => {
              // Determine which options to show based on list type
              const isEndorsementList = listId === 'endorsement';
              const isSystemList = listId === 'aligned' || listId === 'unaligned';
              const currentList = isEndorsementList ? endorsementList : userLists.find(l => l.id === listId);
              const isCopiedList = currentList?.originalListId !== undefined; // List was copied from another user

              const canEditMeta = !isSystemList && !isCopiedList && canEdit;
              // Allow removing copied lists - users should be able to remove lists they've added to their library
              const canRemove = !isEndorsementList && !isSystemList && canEdit;
              // REMOVED: Privacy toggle removed from all lists
              const canTogglePrivacy = false;
              const canCopyList = mode === 'view'; // Only in view mode (other users)

              return (
                <>
                  {canEditMeta && currentList && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        handleEditList(currentList);
                      }}
                      activeOpacity={0.7}
                    >
                      <Edit size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  {canCopyList && currentList && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        if (!currentUserId) {
                          Alert.alert('Error', 'You must be logged in to copy lists');
                          return;
                        }

                        // Show confirmation modal
                        setConfirmModalData({
                          title: 'Add to Your Library',
                          message: `Add "${currentList.name}" to your library? This will create a live reference that updates when the original author modifies it.`,
                          onConfirm: async () => {
                            setIsConfirmLoading(true);
                            try {
                              // Create a reference list (NOT a copy) - no entries are duplicated
                              // This list will display the original list's current data
                              const newList = await library.createNewList(
                                currentUserId,
                                currentList.name,
                                currentList.description,
                                profile?.userDetails?.name, // Current user as creator (who added it)
                                false, // not endorsed
                                currentList.id, // original list ID - this makes it a reference
                                currentList.creatorName || currentList.userId, // original creator
                                profile?.userDetails?.profileImage, // current user's image
                                currentList.creatorImage // original creator's image
                              );

                              // DO NOT copy entries - this is a live reference, not a snapshot
                              // Entries will be fetched from the original list when displayed

                              setShowConfirmModal(false);
                              setConfirmModalData(null);
                              Alert.alert('Success', `Added "${currentList.name}" to your library. This list will update automatically when the original author makes changes.`);
                            } catch (error: any) {
                              console.error('Error adding list reference:', error);
                              Alert.alert('Error', error.message || 'Failed to add list');
                            } finally {
                              setIsConfirmLoading(false);
                            }
                          },
                        });
                        setShowConfirmModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Plus size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Add to My Library</Text>
                    </TouchableOpacity>
                  )}

                  {currentList && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        handleShareList(currentList);
                      }}
                      activeOpacity={0.7}
                    >
                      <Share2 size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Share</Text>
                    </TouchableOpacity>
                  )}

                  {canTogglePrivacy && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        handleTogglePrivacy(listId, isPublic || false);
                      }}
                      activeOpacity={0.7}
                    >
                      {isPublic ? (
                        <>
                          <Lock size={16} color={colors.text} strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: colors.text }]}>Make Private</Text>
                        </>
                      ) : (
                        <>
                          <Globe size={16} color={colors.text} strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: colors.text }]}>Make Public</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {canRemove && currentList && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        setConfirmModalData({
                          title: 'Delete List',
                          message: `Are you sure you want to delete "${currentList.name}"? This cannot be undone.`,
                          onConfirm: () => {
                            library.removeList(currentList.id);
                            setShowConfirmModal(false);
                            setConfirmModalData(null);
                          },
                          confirmText: 'Delete',
                          isDanger: true,
                        });
                        setShowConfirmModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: '#EF4444', fontWeight: '700' }]}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        )}
      </View>
    );
  };

  // Render content for Endorsement list
  const renderEndorsementContent = () => {
    if (!endorsementList) return null;

    if (!endorsementList.entries || endorsementList.entries.length === 0) {
      return (
        <View style={styles.listContentContainer}>
          <View style={[styles.emptyEndorsementContainer, { backgroundColor: colors.backgroundSecondary }]}>
            {/* List Icon with transparent background and blue outline */}
            <View style={[styles.emptyEndorsementIconCircle, { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary }]}>
              <ListIcon size={48} color={colors.primary} strokeWidth={1.5} />
            </View>

            {/* Title */}
            <Text style={[styles.emptyEndorsementTitle, { color: colors.text }]}>
              Build Your Endorsement List
            </Text>

            {/* Description with tab icons */}
            <Text style={[styles.emptyEndorsementDescription, { color: colors.textSecondary }]}>
              Add brands directly from the
            </Text>

            {/* Tab options */}
            <View style={styles.emptyEndorsementTabs}>
              <View style={styles.emptyEndorsementTabItem}>
                <Home size={18} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.emptyEndorsementTabText, { color: colors.text }]}>Home Tab</Text>
              </View>
              <View style={styles.emptyEndorsementTabItem}>
                <BookOpen size={18} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.emptyEndorsementTabText, { color: colors.text }]}>Browse Tab</Text>
              </View>
              <View style={styles.emptyEndorsementTabItem}>
                <Compass size={18} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.emptyEndorsementTabText, { color: colors.text }]}>Explore Tab</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Determine if we're in reorder mode for this list
    const isReordering = isReorderMode && reorderingListId === endorsementList.id;

    // Apply filter to entries
    const allEntries = isReordering ? localEntries : endorsementList.entries;

    // Helper to get category from entry (maps to custom categories)
    const getEntryCategory = (entry: ListEntry): string => {
      let rawCategory: string | undefined;
      if (entry.type === 'brand') rawCategory = (entry as any).brandCategory;
      else if (entry.type === 'business') rawCategory = (entry as any).businessCategory;
      else if (entry.type === 'place') rawCategory = (entry as any).placeCategory;
      // Map to custom category
      return mapToCustomCategory(rawCategory);
    };

    // Get display label for category
    const getCategoryLabel = (categoryId: string): string => {
      return getCustomCategoryLabel(categoryId);
    };

    // Helper to check if entry is local (has location data)
    const isLocalEntry = (entry: ListEntry): boolean => {
      // Places always have location data
      if (entry.type === 'place') return true;
      // Businesses may have location
      if (entry.type === 'business' && (entry as any).location) return true;
      return false;
    };

    // Apply local filter first
    const localFilteredEntries = localFilter === 'all'
      ? allEntries
      : allEntries.filter(entry => entry && isLocalEntry(entry));

    // Then apply category filter (uses custom category IDs)
    const filteredEntries = categoryFilter === 'all'
      ? localFilteredEntries
      : localFilteredEntries.filter(entry => {
          const categoryId = getEntryCategory(entry);
          return categoryId === categoryFilter;
        });
    const entriesToDisplay = filteredEntries;

    // Check if there are local entries to show the local filter
    const hasLocalEntries = allEntries.some(e => e && isLocalEntry(e));
    const hasNonLocalEntries = allEntries.some(e => e && !isLocalEntry(e));
    const showLocalFilter = hasLocalEntries && hasNonLocalEntries;

    // Get categories that have entries (using custom category system)
    const categoryCounts = new Map<string, number>();
    localFilteredEntries.forEach(entry => {
      const categoryId = getEntryCategory(entry);
      if (categoryId) {
        categoryCounts.set(categoryId, (categoryCounts.get(categoryId) || 0) + 1);
      }
    });

    // Only show categories that have at least one entry, in predefined order
    const uniqueCategories = CUSTOM_CATEGORIES
      .filter(cat => categoryCounts.has(cat.id))
      .map(cat => ({ id: cat.id, label: cat.label, count: categoryCounts.get(cat.id) || 0 }));

    // Render filter buttons
    const renderFilterButtons = () => {
      if (isReordering || allEntries.length < 2) return null;

      // Show category filter if there are categories to filter by
      const showCategoryFilter = uniqueCategories.length > 1;

      if (!showLocalFilter && !showCategoryFilter) return null;

      return (
        <View style={styles.filterButtonsContainer}>
          {/* Local/All filter row + Category filters combined */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterButtonsScroll}>
            {/* All filter */}
            <TouchableOpacity
              key="all"
              style={[
                styles.filterButton,
                localFilter === 'all' && categoryFilter === 'all'
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }
              ]}
              onPress={() => {
                setLocalFilter('all');
                setCategoryFilter('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterButtonText,
                { color: localFilter === 'all' && categoryFilter === 'all' ? '#FFFFFF' : colors.text }
              ]}>
                All
              </Text>
            </TouchableOpacity>

            {/* Local filter */}
            {showLocalFilter && (
              <TouchableOpacity
                key="local"
                style={[
                  styles.filterButton,
                  localFilter === 'local' && categoryFilter === 'all'
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }
                ]}
                onPress={() => {
                  setLocalFilter('local');
                  setCategoryFilter('all');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: localFilter === 'local' && categoryFilter === 'all' ? '#FFFFFF' : colors.text }
                ]}>
                  Local
                </Text>
              </TouchableOpacity>
            )}

            {/* Category filters */}
            {showCategoryFilter && uniqueCategories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterButton,
                  categoryFilter === cat.id
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }
                ]}
                onPress={() => {
                  setLocalFilter('all'); // Reset local filter when selecting category
                  setCategoryFilter(cat.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: categoryFilter === cat.id ? '#FFFFFF' : colors.text }
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    };

    // Render Save/Cancel buttons when in reorder mode
    const renderReorderControls = () => {
      if (!isReordering) return null;

      return (
        <View style={[styles.reorderControls, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.reorderTitle, { color: colors.text }]}>
            {isLargeScreen ? 'Drag items to reorder' : 'Long press & drag to reorder'}
          </Text>
          <View style={styles.reorderButtons}>
            <TouchableOpacity
              style={[styles.reorderButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={handleCancelReorder}
              activeOpacity={0.7}
            >
              <Text style={[styles.reorderButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reorderButton, styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveReorder}
              activeOpacity={0.7}
            >
              <Text style={[styles.reorderButtonText, { color: colors.white }]}>Save Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    // Render entry with reorder controls
    const renderEntryWithControls = (entry: ListEntry, index: number) => {
      const isFirst = index === 0;
      const isLast = index === entriesToDisplay.length - 1;

      if (isReordering) {
        // Sortable entry for both mobile (long press) and desktop (drag handle)
        const SortableEntry = () => {
          const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
          } = useSortable({ id: entry.id });

          const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.8 : 1,
            zIndex: isDragging ? 1000 : 1,
          };

          return (
            <View
              ref={setNodeRef}
              style={[styles.reorderEntryRow, style]}
              {...attributes}
              {...listeners}
            >
              <View style={styles.forYouItemRow}>
                <Text style={[styles.forYouItemNumber, { color: colors.textSecondary }]}>
                  {index + 1}
                </Text>
                <View style={styles.forYouCardWrapper}>
                  {renderListEntry(entry, true)}
                </View>
              </View>
              {/* Drag handle/indicator - on far right */}
              <View style={[styles.dragHandle, { backgroundColor: colors.backgroundSecondary }]}>
                <GripVertical size={20} color={colors.textSecondary} strokeWidth={2} />
              </View>
            </View>
          );
        };

        return <SortableEntry key={entry.id} />;
      }

      // Normal (non-reorder) mode - render card directly with index for styling
      return (
        <View key={entry.id} style={styles.endorsementEntryWrapper}>
          {renderListEntry(entry, true, index)}
        </View>
      );
    };

    const validEntries = entriesToDisplay.filter(entry => entry != null);
    // Show all entries when reordering, otherwise respect the load count limit
    const displayedEntries = isReordering ? validEntries : validEntries.slice(0, endorsementLoadCount);

    // Separate top 5, items 6-10, and the rest
    const top5Entries = displayedEntries.slice(0, 5);
    const next5Entries = displayedEntries.slice(5, 10); // Items 6-10
    const remainingEntries = displayedEntries.slice(10); // Items 11+

    const top5Content = top5Entries.map((entry, index) => renderEntryWithControls(entry, index));
    const next5Content = next5Entries.map((entry, index) => renderEntryWithControls(entry, index + 5));
    const remainingContent = remainingEntries.map((entry, index) => renderEntryWithControls(entry, index + 10));

    // Wrap with DndContext for drag-and-drop (desktop and mobile via long press)
    const contentWithDnd = isReordering ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localEntries.map(e => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {top5Content}
          {next5Content}
          {remainingContent}
        </SortableContext>
      </DndContext>
    ) : (
      <>
        {/* All entries render as individual cards with position-based colors */}
        {top5Content}
        {next5Content}
        {remainingContent}
      </>
    );

    return (
      <View style={styles.listContentContainer}>
        {renderReorderControls()}
        {renderFilterButtons()}
        <View style={styles.brandsContainer}>
          {contentWithDnd}
          {!isReordering && endorsementLoadCount < validEntries.length && (
            <TouchableOpacity
              style={[styles.loadMoreButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setEndorsementLoadCount(endorsementLoadCount + 25)}
              activeOpacity={0.7}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                Load More ({validEntries.length - endorsementLoadCount} remaining)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render content for Aligned list
  const renderAlignedContent = () => {
    if (alignedItems.length === 0) return null;

    return (
      <View style={styles.listContentContainer}>
        <View style={styles.brandsContainer}>
          {alignedItems.slice(0, alignedLoadCount).map((product, index) => (
            <View key={product.id} style={styles.forYouItemRow}>
              <Text style={[styles.forYouItemNumber, { color: colors.textSecondary }]}>
                {index + 1}
              </Text>
              <View style={styles.forYouCardWrapper}>
                {renderBrandCard(product, 'support')}
              </View>
            </View>
          ))}
          {alignedLoadCount < alignedItems.length && (
            <TouchableOpacity
              style={[styles.loadMoreButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setAlignedLoadCount(alignedLoadCount + 10)}
              activeOpacity={0.7}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                Load More ({alignedItems.length - alignedLoadCount} remaining)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render content for Unaligned list
  const renderUnalignedContent = () => {
    if (unalignedItems.length === 0) return null;

    return (
      <View style={styles.listContentContainer}>
        <View style={styles.brandsContainer}>
          {unalignedItems.slice(0, unalignedLoadCount).map((product, index) => (
            <View key={product.id} style={styles.forYouItemRow}>
              <Text style={[styles.forYouItemNumber, { color: colors.textSecondary }]}>
                {index + 1}
              </Text>
              <View style={styles.forYouCardWrapper}>
                {renderBrandCard(product, 'avoid')}
              </View>
            </View>
          ))}
          {unalignedLoadCount < unalignedItems.length && (
            <TouchableOpacity
              style={[styles.loadMoreButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setUnalignedLoadCount(unalignedLoadCount + 10)}
              activeOpacity={0.7}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                Load More ({unalignedItems.length - unalignedLoadCount} remaining)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render content for Top Aligned (most endorsed brands globally)
  const renderAlignedTopContent = () => {
    if (loadingTopBrands) {
      return (
        <View style={styles.listContentContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading top endorsed brands...
            </Text>
          </View>
        </View>
      );
    }

    if (topBrands.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
            No top endorsed brands yet
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.listContentContainer}>
        <View style={styles.brandsContainer}>
          {topBrands.slice(0, topBrandsLoadCount).map((item, index) => (
            <View key={item.id} style={styles.forYouItemRow}>
              <Text style={[styles.forYouItemNumber, { color: colors.textSecondary }]}>
                {index + 1}
              </Text>
              <View style={styles.forYouCardWrapper}>
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[
                      styles.brandCard,
                      { backgroundColor: 'transparent' },
                    ]}
                    onPress={() => {
                      router.push({
                        pathname: '/brand/[id]',
                        params: { id: item.id },
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.brandCardInner}>
                      <View style={styles.brandLogoContainer}>
                        <Image
                          source={{ uri: item.logoUrl || getLogoUrl(item.website || '') }}
                          style={styles.brandLogo}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
                      </View>
                      <View style={styles.brandCardContent}>
                        <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.endorsementCount} {item.endorsementCount === 1 ? 'endorsement' : 'endorsements'}
                        </Text>
                      </View>
                      <View style={styles.brandScoreContainer}>
                        <Text style={[styles.brandScore, { color: colors.primary }]}>
                          {Math.round(item.score)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          {topBrandsLoadCount < topBrands.length && (
            <TouchableOpacity
              style={[styles.loadMoreButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setTopBrandsLoadCount(topBrandsLoadCount + 10)}
              activeOpacity={0.7}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                Load More ({topBrands.length - topBrandsLoadCount} remaining)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render content for Top Local (most endorsed businesses within distance)
  const renderLocalTopContent = () => {
    if (loadingTopBusinesses) {
      return (
        <View style={styles.listContentContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading top local businesses...
            </Text>
          </View>
        </View>
      );
    }

    if (topBusinesses.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
            No top businesses in your area yet
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.listContentContainer}>
        <View style={styles.brandsContainer}>
          {topBusinesses.slice(0, topBusinessesLoadCount).map((item, index) => (
            <View key={item.id} style={styles.forYouItemRow}>
              <Text style={[styles.forYouItemNumber, { color: colors.textSecondary }]}>
                {index + 1}
              </Text>
              <View style={styles.forYouCardWrapper}>
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[
                      styles.brandCard,
                      { backgroundColor: 'transparent' },
                    ]}
                    onPress={() => {
                      router.push({
                        pathname: '/business/[id]',
                        params: { id: item.id },
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.brandCardInner}>
                      <View style={styles.brandLogoContainer}>
                        <Image
                          source={{ uri: item.logoUrl || getLogoUrl(item.website || '') }}
                          style={styles.brandLogo}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
                      </View>
                      <View style={styles.brandCardContent}>
                        <Text style={[styles.brandName, { color: colors.white }]} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.endorsementCount} {item.endorsementCount === 1 ? 'endorsement' : 'endorsements'}
                        </Text>
                      </View>
                      <View style={styles.brandScoreContainer}>
                        <Text style={[styles.brandScore, { color: colors.primary }]}>
                          {Math.round(item.score)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          {topBusinessesLoadCount < topBusinesses.length && (
            <TouchableOpacity
              style={[styles.loadMoreButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setTopBusinessesLoadCount(topBusinessesLoadCount + 10)}
              activeOpacity={0.7}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                Load More ({topBusinesses.length - topBusinessesLoadCount} remaining)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render content for custom lists
  const renderCustomListContent = (list: UserList) => {
    if (!list.entries || list.entries.length === 0) {
      return (
        <View style={styles.listContentContainer}>
          <View style={[styles.placeholderContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
              This list is empty
            </Text>
          </View>
        </View>
      );
    }

    const loadCount = customListLoadCounts[list.id] || 10;

    return (
      <View style={styles.listContentContainer}>
        <View style={styles.brandsContainer}>
          {list.entries
            .filter(entry => entry != null) // Filter out null/undefined entries
            .slice(0, loadCount)
            .map((entry, index) => {
              const itemId = entry.brandId || entry.businessId || entry.valueId || entry.id;
              return (
                <View key={entry.id}>
                  <View style={styles.forYouItemRow}>
                    <Text style={[styles.forYouItemNumber, { color: colors.textSecondary }]}>
                      {index + 1}
                    </Text>
                    <View style={styles.forYouCardWrapper}>
                      {renderListEntry(entry, false)}
                    </View>
                  </View>
                </View>
              );
            })}
          {loadCount < list.entries.length && (
            <TouchableOpacity
              style={[styles.loadMoreButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setCustomListLoadCounts({ ...customListLoadCounts, [list.id]: loadCount + 10 })}
              activeOpacity={0.7}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                Load More ({list.entries.length - loadCount} remaining)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render list detail header (when inside a list)
  const renderListDetailHeader = (
    listId: string,
    title: string,
    itemCount: number,
    isEndorsed: boolean = false,
    attribution?: string,
    description?: string,
    isPublic?: boolean,
    creatorProfileImage?: string,
    useAppIcon?: boolean
  ) => {
    const isOptionsOpen = activeListOptionsId === listId;

    return (
      <View style={{ marginBottom: 20 }}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToLibrary}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={colors.primary} strokeWidth={2} />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Library</Text>
        </TouchableOpacity>

        {/* List header card */}
        <View style={styles.listDetailHeader}>
          {/* Profile Image */}
          <View style={[styles.listDetailImageContainer, { backgroundColor: 'transparent', borderColor: colors.border }]}>
            {useAppIcon ? (
              <Image
                source={require('@/assets/images/endorseofficialicon.png')}
                style={styles.listDetailImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : creatorProfileImage ? (
              <Image
                source={{ uri: creatorProfileImage }}
                style={styles.listDetailImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <User size={48} color={colors.textSecondary} strokeWidth={2} />
            )}
          </View>

          <View style={styles.listDetailInfo}>
            <View style={styles.listDetailTitleRow}>
              <Text style={[styles.listDetailTitle, { color: colors.text }]}>
                {title}
              </Text>
              {isEndorsed && <EndorsedBadge isDarkMode={isDarkMode} size="medium" showText={true} />}
            </View>

            <Text style={[styles.listDetailCount, { color: colors.textSecondary }]}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>

            {isPublic !== undefined && (
              <View style={[styles.privacyIndicator, { marginTop: 8 }]}>
                {isPublic ? (
                  <>
                    <Globe size={16} color={colors.primary} strokeWidth={2} />
                    <Text style={[styles.privacyText, { color: colors.primary, fontSize: 14 }]}>Public</Text>
                  </>
                ) : (
                  <>
                    <Lock size={16} color={colors.textSecondary} strokeWidth={2} />
                    <Text style={[styles.privacyText, { color: colors.textSecondary, fontSize: 14 }]}>Private</Text>
                  </>
                )}
              </View>
            )}

            {attribution && (
              <Text style={[styles.listDetailAttribution, { color: colors.textSecondary }]}>
                {attribution}
              </Text>
            )}

            {description && (
              <Text style={[styles.listDetailDescription, { color: colors.text }]}>
                {description}
              </Text>
            )}
          </View>

          {/* Action Menu Button */}
          {(canEdit || mode === 'view') && (
            <TouchableOpacity
              style={styles.listDetailOptionsButton}
              onPress={() => setActiveListOptionsId(isOptionsOpen ? null : listId)}
              activeOpacity={0.7}
            >
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <MoreVertical size={24} color={colors.textSecondary} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Options dropdown */}
        {(canEdit || mode === 'view') && isOptionsOpen && (
          <View style={[styles.listOptionsDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, top: 60, right: 16 }]}>
            {(() => {
              const isEndorsementList = listId === 'endorsement';
              const isSystemList = listId === 'aligned' || listId === 'unaligned';
              const currentList = isEndorsementList ? endorsementList : userLists.find(l => l.id === listId);
              const isCopiedList = currentList?.originalListId !== undefined;

              const canEditMeta = !isSystemList && !isCopiedList && canEdit;
              const canRemove = !isEndorsementList && !isSystemList && canEdit;
              // REMOVED: Privacy toggle removed from all lists
              const canTogglePrivacy = false;
              const canCopyList = mode === 'view';

              return (
                <>
                  {/* Reorder button - only for endorsement list */}
                  {canEdit && currentList && currentList.entries && currentList.entries.length > 1 && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        setIsReorderMode(true);
                        setReorderingListId(listId);
                        setLocalEntries([...currentList.entries]);
                      }}
                      activeOpacity={0.7}
                    >
                      <ListIcon size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Reorder</Text>
                    </TouchableOpacity>
                  )}

                  {(currentList || isSystemList) && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        if (isSystemList) {
                          // Create a mock list object for system lists
                          const systemListName = listId === 'aligned' ? 'Aligned' : 'Unaligned';
                          const systemListDescription = listId === 'aligned'
                            ? 'Brands and businesses aligned with your values'
                            : 'Brands and businesses not aligned with your values';
                          const mockList = {
                            id: listId,
                            name: systemListName,
                            description: systemListDescription,
                            isPublic: false, // System lists are always private
                          } as UserList;
                          handleShareList(mockList);
                        } else if (currentList) {
                          handleShareList(currentList);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Share2 size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Share</Text>
                    </TouchableOpacity>
                  )}

                  {canCopyList && currentList && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        if (!currentUserId) {
                          Alert.alert('Error', 'You must be logged in to copy lists');
                          return;
                        }

                        // Show confirmation modal
                        setConfirmModalData({
                          title: 'Add to Your Library',
                          message: `Add "${currentList.name}" to your library? This will create a live reference that updates when the original author modifies it.`,
                          onConfirm: async () => {
                            setIsConfirmLoading(true);
                            try {
                              const userName = profile?.userName || 'User';
                              const profileImageUrl = profile?.userDetails?.profileImage;
                              await copyListToLibrary(currentList.id, currentUserId, userName, profileImageUrl);

                              // Wait for Firestore propagation
                              await new Promise(resolve => setTimeout(resolve, 500));

                              // Reload lists to show the newly copied list
                              if (currentUserId) {
                                await library.loadUserLists(currentUserId, true);
                              }

                              Alert.alert('Success', `"${currentList.name}" added to your library!`);
                              setShowConfirmModal(false);
                              setConfirmModalData(null);
                            } catch (error: any) {
                              console.error('Error copying list:', error);
                              Alert.alert('Error', error?.message || 'Failed to copy list');
                            } finally {
                              setIsConfirmLoading(false);
                            }
                          },
                          confirmText: 'Add to Library',
                          isDanger: false,
                        });
                        setShowConfirmModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <UserPlus size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: colors.text }]}>Add to Library</Text>
                    </TouchableOpacity>
                  )}

                  {canTogglePrivacy && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        handleTogglePrivacy(listId, isPublic || false);
                      }}
                      activeOpacity={0.7}
                    >
                      {isPublic ? (
                        <>
                          <Lock size={16} color={colors.text} strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: colors.text }]}>Make Private</Text>
                        </>
                      ) : (
                        <>
                          <Globe size={16} color={colors.text} strokeWidth={2} />
                          <Text style={[styles.listOptionText, { color: colors.text }]}>Make Public</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {canRemove && currentList && (
                    <TouchableOpacity
                      style={styles.listOptionItem}
                      onPress={() => {
                        setActiveListOptionsId(null);
                        setConfirmModalData({
                          title: 'Delete List',
                          message: `Are you sure you want to delete "${currentList.name}"? This cannot be undone.`,
                          onConfirm: () => {
                            library.removeList(currentList.id);
                            setShowConfirmModal(false);
                            setConfirmModalData(null);
                            handleBackToLibrary(); // Go back to library after deleting
                          },
                          confirmText: 'Delete',
                          isDanger: true,
                        });
                        setShowConfirmModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                      <Text style={[styles.listOptionText, { color: '#EF4444', fontWeight: '700' }]}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        )}
      </View>
    );
  };

  // Render section selector - 6 boxes in grid layout
  const renderSectionSelector = () => {
    const endorsementCount = endorsementList?.entries?.length || 0;
    const alignedCount = alignedItems.length;
    const unalignedCount = unalignedItems.length;
    const localCount = userBusinesses.length;

    // Define section colors (border colors only, no background tints)
    const sectionColors = {
      local: {
        border: isDarkMode ? 'rgb(132, 204, 22)' : 'rgb(101, 163, 13)', // lime green
      },
      following: {
        border: isDarkMode ? 'rgb(167, 139, 250)' : 'rgb(124, 58, 237)',
      },
      followers: {
        border: isDarkMode ? 'rgb(167, 139, 250)' : 'rgb(124, 58, 237)',
      },
      endorsement: {
        border: isDarkMode ? 'rgb(0, 170, 250)' : 'rgb(3, 68, 102)',
      },
      aligned: {
        border: '#FF1F7A', // red/pink for global (aligned)
      },
      unaligned: {
        border: '#FF1F7A', // red/pink for global (unaligned)
      },
    };

    const SectionBox = ({ section, label, count }: { section: LibrarySection; label: string; count: number }) => {
      const isSelected = selectedSection === section;
      const sectionColor = sectionColors[section as keyof typeof sectionColors] || { border: colors.primary };

      return (
        <TouchableOpacity
          style={[
            styles.sectionBox,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: isSelected ? sectionColor.border : colors.border,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
          onPress={() => setSelectedSection(section)}
          activeOpacity={0.7}
        >
          <Text style={[styles.sectionLabel, { color: isSelected ? sectionColor.border : colors.text }]}>
            {label}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {count}
          </Text>
        </TouchableOpacity>
      );
    };

    const EndorsedSectionBox = () => {
      const isSelected = selectedSection === 'endorsement';
      const sectionColor = sectionColors.endorsement;

      return (
        <TouchableOpacity
          style={[
            styles.sectionBox,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: isSelected ? sectionColor.border : colors.border,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
          onPress={() => setSelectedSection('endorsement')}
          activeOpacity={0.7}
        >
          <Text style={[styles.sectionLabel, { color: isSelected ? sectionColor.border : colors.text }]}>
            Endorsed
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {endorsementCount}
          </Text>
        </TouchableOpacity>
      );
    };

    // For profile views (preview/view modes), don't show section selector
    // Followers/following counters are now in the profile header
    // Also hide when endorsementOnly is true (Home tab now shows only endorsements)
    const isProfileView = mode === 'preview' || mode === 'view';

    if (isProfileView || endorsementOnly) {
      return null;
    }

    // Global section box (combines aligned + unaligned)
    const GlobalSectionBox = () => {
      const isSelected = selectedSection === 'aligned' || selectedSection === 'unaligned';
      const sectionColor = sectionColors.aligned; // red/pink
      const globalCount = alignedCount + unalignedCount;

      return (
        <TouchableOpacity
          style={[
            styles.sectionBox,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: isSelected ? sectionColor.border : colors.border,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
          onPress={() => setSelectedSection('aligned')}
          activeOpacity={0.7}
        >
          <Text style={[styles.sectionLabel, { color: isSelected ? sectionColor.border : colors.text }]}>
            Global
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {globalCount}
          </Text>
        </TouchableOpacity>
      );
    };

    // For home tab (edit mode), show Global, Local, and Endorsed (full width)
    return (
      <View style={styles.sectionSelector}>
        {/* Header: recommendations */}
        <Text style={[styles.sectionGroupHeader, { color: colors.textSecondary }]}>recommendations</Text>

        {/* Top row: Global | Local */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionHalf}>
            <GlobalSectionBox />
          </View>
          <View style={styles.sectionHalf}>
            <SectionBox section="local" label="Local" count={localCount} />
          </View>
        </View>

        {/* Header: your list */}
        <Text style={[styles.sectionGroupHeader, { color: colors.textSecondary }]}>your list</Text>

        {/* Bottom row: Endorsed (full width) */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionFull}>
            <EndorsedSectionBox />
          </View>
        </View>
      </View>
    );
  };

  // Render section header (sticky)
  const renderSectionHeader = () => {
    const sectionTitles: Record<LibrarySectionType, string> = {
      endorsement: 'Endorsements',
      aligned: 'Global',
      unaligned: 'Global',
      alignedTop: 'Global',
      following: 'Following',
      followers: 'Followers',
      local: 'Local',
      localTop: 'Local',
    };

    const sectionIcons: Record<LibrarySectionType, any> = {
      endorsement: UserPlus,
      aligned: Target,
      unaligned: Target,
      alignedTop: Target,
      following: User,
      followers: User,
      local: Globe,
      localTop: Globe,
    };

    const title = sectionTitles[selectedSection];
    const SectionIcon = sectionIcons[selectedSection];
    const isGlobalSection = selectedSection === 'aligned' || selectedSection === 'unaligned' || selectedSection === 'alignedTop';
    const isEndorsed = selectedSection === 'endorsement';
    const canReorder = isEndorsed && canEdit && endorsementList && endorsementList.entries && endorsementList.entries.length > 1;

    return (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.sectionHeaderTitleContainer}
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
          activeOpacity={0.7}
        >
          <SectionIcon size={20} color={colors.primary} strokeWidth={2} style={styles.sectionHeaderIcon} />
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
            {title}
          </Text>
        </TouchableOpacity>

        {/* Toggle for Global section (aligned/unaligned/top) */}
        {isGlobalSection && (
          <View style={styles.globalToggle}>
            <TouchableOpacity
              style={[
                styles.globalToggleButton,
                selectedSection === 'aligned' && { backgroundColor: colors.success + '20' },
              ]}
              onPress={() => setSelectedSection('aligned')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.globalToggleText,
                { color: selectedSection === 'aligned' ? colors.success : colors.textSecondary }
              ]}>
                Aligned
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.globalToggleButton,
                selectedSection === 'unaligned' && { backgroundColor: colors.danger + '20' },
              ]}
              onPress={() => setSelectedSection('unaligned')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.globalToggleText,
                { color: selectedSection === 'unaligned' ? colors.danger : colors.textSecondary }
              ]}>
                Unaligned
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.globalToggleButton,
                selectedSection === 'alignedTop' && {
                  backgroundColor: isDarkMode ? 'rgba(0, 170, 250, 0.12)' : 'rgba(3, 68, 102, 0.12)'
                },
              ]}
              onPress={() => setSelectedSection('alignedTop')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.globalToggleText,
                { color: selectedSection === 'alignedTop' ? colors.white : colors.textSecondary }
              ]}>
                Top
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Toggle for Local section (for you/top) */}
        {(selectedSection === 'local' || selectedSection === 'localTop') && (
          <View style={styles.globalToggle}>
            <TouchableOpacity
              style={[
                styles.globalToggleButton,
                selectedSection === 'local' && {
                  backgroundColor: isDarkMode ? 'rgba(0, 170, 250, 0.12)' : 'rgba(3, 68, 102, 0.12)'
                },
              ]}
              onPress={() => setSelectedSection('local')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.globalToggleText,
                { color: selectedSection === 'local' ? colors.white : colors.textSecondary }
              ]}>
                For You
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.globalToggleButton,
                selectedSection === 'localTop' && {
                  backgroundColor: isDarkMode ? 'rgba(0, 170, 250, 0.12)' : 'rgba(3, 68, 102, 0.12)'
                },
              ]}
              onPress={() => setSelectedSection('localTop')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.globalToggleText,
                { color: selectedSection === 'localTop' ? colors.white : colors.textSecondary }
              ]}>
                Top
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons for endorsed section */}
        {isEndorsed && (
          <View style={styles.endorsedHeaderActions}>
            {/* Map button - show if there are mappable entries */}
            {mapEntries.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowMapModal(true)}
                style={[styles.headerActionButton, { backgroundColor: colors.backgroundSecondary }]}
                activeOpacity={0.7}
              >
                <MapPin size={20} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            )}

            {/* Action menu button - only show if there are items to reorder */}
            {canEdit && canReorder && (
              <View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowEndorsedActionMenu(!showEndorsedActionMenu);
                  }}
                  style={styles.headerActionButton}
                  activeOpacity={0.7}
                >
                  <View style={{ transform: [{ rotate: '90deg' }] }}>
                    <MoreVertical size={20} color={colors.text} strokeWidth={2} />
                  </View>
                </TouchableOpacity>

                {/* Action menu dropdown */}
                {showEndorsedActionMenu && (
                  <View style={[styles.endorsedActionDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.endorsedActionItem}
                      onPress={() => {
                        setShowEndorsedActionMenu(false);
                        setIsReorderMode(true);
                        setReorderingListId(endorsementList.id);
                        setLocalEntries([...endorsementList.entries]);
                      }}
                      activeOpacity={0.7}
                    >
                      <GripVertical size={16} color={colors.text} strokeWidth={2} />
                      <Text style={[styles.endorsedActionText, { color: colors.text }]}>Reorder</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Add button - on far right (only for edit mode) */}
            {canEdit && (
              <TouchableOpacity
                onPress={() => setShowAddEndorsementModal(true)}
                style={[styles.addEndorsementButton, { backgroundColor: colors.primary }]}
                activeOpacity={0.7}
              >
                <Plus size={24} color={colors.white} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // Render empty endorsement state with explainer
  const renderEmptyEndorsementExplainer = () => {
    // Check if this is the user's own profile
    const isOwnProfile = mode === 'edit' ||
      (mode === 'preview' && currentUserId && viewingUserId === currentUserId) ||
      (!viewingUserId && currentUserId);

    if (isOwnProfile) {
      // Show helpful explainer for user's own empty endorsement list
      return (
        <View style={styles.emptyEndorsementContainer}>
          <View style={[styles.emptyEndorsementIconCircle, { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary }]}>
            <ListIcon size={32} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={[styles.emptyEndorsementTitle, { color: colors.text }]}>
            Build Your Endorsement List
          </Text>
          <Text style={[styles.emptyEndorsementDescription, { color: colors.textSecondary }]}>
            Add brands directly from the
          </Text>
          <View style={styles.emptyEndorsementTabs}>
            <View style={styles.emptyEndorsementTabItem}>
              <Home size={18} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.emptyEndorsementTabText, { color: colors.text }]}>Home Tab</Text>
            </View>
            <View style={styles.emptyEndorsementTabItem}>
              <BookOpen size={18} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.emptyEndorsementTabText, { color: colors.text }]}>Browse Tab</Text>
            </View>
            <View style={styles.emptyEndorsementTabItem}>
              <Compass size={18} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.emptyEndorsementTabText, { color: colors.text }]}>Explore Tab</Text>
            </View>
          </View>
        </View>
      );
    }

    // For viewing others' empty endorsement lists, show simple message
    return (
      <View style={styles.emptySection}>
        <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
          No endorsements yet
        </Text>
      </View>
    );
  };

  // Render content for selected section
  const renderSectionContent = () => {
    // Profile views can ONLY show endorsement, following, or followers
    const isProfileView = mode === 'preview' || mode === 'view';
    const allowedProfileSections: LibrarySectionType[] = ['endorsement', 'following', 'followers'];

    if (isProfileView && !allowedProfileSections.includes(selectedSection)) {
      // Invalid section for profile view - show endorsement instead
      return endorsementList ? renderEndorsementContent() : renderEmptyEndorsementExplainer();
    }

    switch (selectedSection) {
      case 'endorsement':
        return endorsementList ? renderEndorsementContent() : renderEmptyEndorsementExplainer();

      case 'aligned':
        return alignedItems.length > 0 ? renderAlignedContent() : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              No aligned brands yet
            </Text>
          </View>
        );

      case 'unaligned':
        return unalignedItems.length > 0 ? renderUnalignedContent() : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              No unaligned brands yet
            </Text>
          </View>
        );

      case 'following':
        return currentUserId || viewingUserId ? (
          <FollowingFollowersList
            mode="following"
            userId={(viewingUserId || currentUserId)!}
            isDarkMode={isDarkMode}
            userCauses={userCauses || []}
          />
        ) : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              No following data available
            </Text>
          </View>
        );

      case 'followers':
        return currentUserId || viewingUserId ? (
          <FollowingFollowersList
            mode="followers"
            userId={(viewingUserId || currentUserId)!}
            entityType="user"
            isDarkMode={isDarkMode}
            userCauses={userCauses || []}
          />
        ) : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              No followers data available
            </Text>
          </View>
        );

      case 'alignedTop':
        return renderAlignedTopContent();

      case 'local':
        return (
          <LocalBusinessView
            userBusinesses={userBusinesses}
            userLocation={userLocation}
            userCauses={userCauses}
            isDarkMode={isDarkMode}
            onRequestLocation={onRequestLocation}
          />
        );

      case 'localTop':
        return renderLocalTopContent();

      default:
        return null;
    }
  };

  // Render library overview (all list cards)
  const renderLibraryOverview = () => {
    // Determine if viewing own profile
    const isOwnProfile = !viewingUserId || currentUserId === viewingUserId;
    // Use "Endorsements" for own profile, user name for others
    const endorsementTitle = isOwnProfile ? 'Endorsements' : (endorsementList?.name || 'Endorsements');

    return (
      <>
        {/* 1. Endorsement List - Always first, pinned */}
        {endorsementList && (
          <View style={[styles.individualListContainer, {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          }]}>
            {renderListCard(
              'endorsement',
              endorsementTitle,
              endorsementList.entries?.length || 0,
              true,
              `Endorsed by ${endorsementList.creatorName || 'you'}`,
              endorsementList.description,
              true, // Always public
              profileImage
            )}
          </View>
        )}

        {/* 2. Aligned List */}
        {alignedItems.length > 0 && (
          <View style={[styles.individualListContainer, {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          }]}>
            {renderListCard(
              'aligned',
              'Aligned',
              alignedItems.length,
              false,
              undefined,
              'Brands and businesses aligned with your values',
              false, // Always private
              undefined,
              true
            )}
          </View>
        )}

        {/* 3. Unaligned List */}
        {unalignedItems.length > 0 && (
          <View style={[styles.individualListContainer, {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          }]}>
            {renderListCard(
              'unaligned',
              'Unaligned',
              unalignedItems.length,
              false,
              undefined,
              'Brands and businesses not aligned with your values',
              false, // Always private
              undefined,
              true
            )}
          </View>
        )}

        {/* 4. Custom Lists */}
        {customLists.map(list => {
          const attribution = list.originalCreatorName
            ? `Originally created by ${list.originalCreatorName}`
            : list.creatorName
            ? `Created by ${list.creatorName}`
            : undefined;

          const listProfileImage = list.originalCreatorImage || list.creatorImage || profileImage;

          return (
            <React.Fragment key={list.id}>
              {renderListCard(
                list.id,
                list.name,
                list.entries.length,
                false,
                attribution,
                list.description,
                list.isPublic,
                listProfileImage
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  // Render list detail view (single list with items)
  const renderListDetailView = () => {
    if (!openedListId) return null;

    // Get list data based on openedListId
    let title = '';
    let itemCount = 0;
    let isEndorsed = false;
    let attribution = '';
    let description = '';
    let isPublic: boolean | undefined = undefined;
    let creatorImage: string | undefined = undefined;
    let useAppIcon = false;
    let renderContent = null;

    if (openedListId === 'endorsement' && endorsementList) {
      // Determine if viewing own profile
      const isOwnProfile = !viewingUserId || currentUserId === viewingUserId;
      // Use "Endorsements" for own profile, user name for others
      title = isOwnProfile ? 'Endorsements' : endorsementList.name;
      itemCount = endorsementList.entries?.length || 0;
      isEndorsed = true;
      attribution = `Endorsed by ${endorsementList.creatorName || 'you'}`;
      description = endorsementList.description || '';
      isPublic = endorsementList.isPublic;
      creatorImage = profileImage;
      renderContent = renderEndorsementContent();
    } else if (openedListId === 'aligned') {
      title = 'Aligned';
      itemCount = alignedItems.length;
      description = 'Brands and businesses aligned with your values';
      isPublic = false;
      useAppIcon = true;
      renderContent = renderAlignedContent();
    } else if (openedListId === 'unaligned') {
      title = 'Unaligned';
      itemCount = unalignedItems.length;
      description = 'Brands and businesses not aligned with your values';
      isPublic = false;
      useAppIcon = true;
      renderContent = renderUnalignedContent();
    } else {
      // Custom list
      const list = userLists.find(l => l.id === openedListId);
      if (list) {
        title = list.name;
        itemCount = list.entries.length;
        attribution = list.originalCreatorName
          ? `Originally created by ${list.originalCreatorName}`
          : list.creatorName
          ? `Created by ${list.creatorName}`
          : '';
        description = list.description || '';
        isPublic = list.isPublic;
        creatorImage = list.originalCreatorImage || list.creatorImage || profileImage;
        renderContent = renderCustomListContent(list);
      }
    }

    return (
      <>
        {renderListDetailHeader(
          openedListId,
          title,
          itemCount,
          isEndorsed,
          attribution,
          description,
          isPublic,
          creatorImage,
          useAppIcon
        )}
        {renderContent}
      </>
    );
  };

  // Check if any menu is open (only list options dropdown now, items use modal)
  const isAnyMenuOpen = activeListOptionsId !== null;

  // Close all menus
  const closeAllMenus = () => {
    setActiveListOptionsId(null);
  };

  return (
    <View style={styles.libraryDirectory}>
      {/* Backdrop to close menus when clicking outside */}
      {isAnyMenuOpen && (
        <Pressable
          style={styles.menuBackdrop}
          onPress={closeAllMenus}
        />
      )}

      {/* Add to Library Modal */}
      <AddToLibraryModal
        visible={showAddToLibraryModal}
        onClose={() => {
          setShowAddToLibraryModal(false);
          setSelectedItemToAdd(null);
        }}
        availableLists={getAddToLibraryLists()}
        onSelectList={handleSelectList}
        onCreateNewList={handleCreateNewList}
        itemName={selectedItemToAdd ? getItemName(selectedItemToAdd) : undefined}
        isDarkMode={isDarkMode}
      />

      {/* New 6-section library layout */}
      {renderSectionSelector()}

      {/* Sticky section header */}
      <View style={styles.stickyHeaderContainer}>
        {renderSectionHeader()}
      </View>

      {/* Section content */}
      {renderSectionContent()}

      {/* Modals */}
      <AddToLibraryModal
        visible={showAddToLibraryModal}
        onClose={() => setShowAddToLibraryModal(false)}
        availableLists={getAddToLibraryLists()}
        onSelectList={handleSelectList}
        onCreateNewList={handleCreateNewList}
        itemName={selectedItemToAdd ? getItemName(selectedItemToAdd) : ''}
        isDarkMode={isDarkMode}
      />

      <EditListModal
        visible={showEditListModal}
        onClose={() => {
          setShowEditListModal(false);
          setEditingList(null);
        }}
        onSave={performEditList}
        initialName={editingList?.name || ''}
        initialDescription={editingList?.description || ''}
        isDarkMode={isDarkMode}
      />

      <ShareOptionsModal
        visible={showShareOptionsModal}
        onClose={() => {
          setShowShareOptionsModal(false);
          setSharingItem(null);
        }}
        onShare={async () => {
          if (sharingItem) {
            if (sharingItem.type === 'list') {
              await performShareList(sharingItem.data as UserList);
            } else {
              await performShareItem(sharingItem.data as ListEntry);
            }
          }
        }}
        shareUrl={
          sharingItem?.type === 'list'
            ? getListShareUrl(sharingItem.data as UserList)
            : sharingItem?.type === 'entry'
            ? getItemShareUrl(sharingItem.data as ListEntry)
            : undefined
        }
        isDarkMode={isDarkMode}
      />

      <ConfirmModal
        visible={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setConfirmModalData(null);
          setIsConfirmLoading(false);
        }}
        onConfirm={() => {
          if (confirmModalData) {
            confirmModalData.onConfirm();
          }
        }}
        title={confirmModalData?.title || ''}
        message={confirmModalData?.message || ''}
        confirmText={confirmModalData?.confirmText || 'Confirm'}
        cancelText="Cancel"
        isDarkMode={isDarkMode}
        isLoading={isConfirmLoading}
        isDanger={confirmModalData?.isDanger}
      />

      {/* Action Options Modal for list entries */}
      <ItemOptionsModal
        visible={showActionOptionsModal}
        onClose={() => {
          setShowActionOptionsModal(false);
          setSelectedItemForOptions(null);
        }}
        options={getActionModalOptions()}
        isDarkMode={isDarkMode}
        itemName={selectedItemForOptions ? getItemName(selectedItemForOptions) : undefined}
      />

      {/* Add to Endorsement Search Modal */}
      <Modal
        visible={showAddEndorsementModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => {
          setShowAddEndorsementModal(false);
          setAddSearchQuery('');
          setAddedItemIds(new Set());
        }}
      >
        <View style={[
          styles.addEndorsementModalOverlay,
          isLargeScreen && styles.addEndorsementModalOverlayLarge
        ]}>
          <View style={[
            styles.addEndorsementModalContent,
            { backgroundColor: colors.background },
            isLargeScreen && styles.addEndorsementModalContentLarge
          ]}>
            {/* Modal Header */}
            <View style={[styles.addEndorsementModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.addEndorsementModalTitle, { color: colors.text }]}>Add Endorsement</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddEndorsementModal(false);
                  setAddSearchQuery('');
                  setAddedItemIds(new Set());
                }}
                style={styles.addEndorsementCloseButton}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={[styles.addEndorsementSearchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Search size={20} color={colors.primaryLight} strokeWidth={2} />
              <TextInput
                style={[styles.addEndorsementSearchInput, { color: colors.primary, outlineStyle: 'none' } as any]}
                placeholder="Search"
                placeholderTextColor={colors.textSecondary}
                value={addSearchQuery}
                onChangeText={setAddSearchQuery}
                autoFocus={true}
                autoCapitalize="none"
                autoCorrect={false}
                underlineColorAndroid="transparent"
              />
              <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TouchableOpacity
                  onPress={() => setAddSearchQuery('')}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#E5E5E5',
                    alignItems: 'center' as const,
                    justifyContent: 'center' as const,
                  }}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#666666" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Results */}
            <ScrollView style={styles.addEndorsementResultsContainer} showsVerticalScrollIndicator={false}>
              {loadingBusinesses && !addSearchQuery ? (
                <View style={styles.addEndorsementLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.addEndorsementLoadingText, { color: colors.textSecondary }]}>
                    Loading businesses...
                  </Text>
                </View>
              ) : addSearchQuery.trim() === '' ? (
                <View style={styles.addEndorsementEmptyContainer}>
                  <Search size={48} color={colors.textSecondary} strokeWidth={1.5} />
                  <Text style={[styles.addEndorsementEmptyText, { color: colors.textSecondary }]}>
                    Search for brands, businesses, or any local business
                  </Text>
                </View>
              ) : addSearchResults.brands.length === 0 && addSearchResults.businesses.length === 0 && placesResults.length === 0 && !loadingPlaces ? (
                <View style={styles.addEndorsementEmptyContainer}>
                  <Text style={[styles.addEndorsementEmptyText, { color: colors.textSecondary }]}>
                    No results found for "{addSearchQuery}"
                  </Text>
                </View>
              ) : (
                <>
                  {/* Brands Section */}
                  {addSearchResults.brands.length > 0 && (
                    <View style={styles.addEndorsementSection}>
                      <Text style={[styles.addEndorsementSectionTitle, { color: colors.textSecondary }]}>
                        Brands ({addSearchResults.brands.length})
                      </Text>
                      {addSearchResults.brands.map((brand) => (
                        <View
                          key={brand.id}
                          style={styles.addEndorsementResultItem}
                        >
                          <TouchableOpacity
                            style={styles.addEndorsementResultInfo}
                            onPress={() => handleNavigateToDetails(brand, 'brand')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.addEndorsementResultLogo}>
                              <Image
                                source={{ uri: brand.exampleImageUrl || getLogoUrl(brand.website || '') }}
                                style={styles.addEndorsementResultLogoImage}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="memory-disk"
                              />
                            </View>
                            <View style={styles.addEndorsementResultText}>
                              <Text style={[styles.addEndorsementResultName, { color: colors.text }]} numberOfLines={2}>
                                {brand.name}
                              </Text>
                              {brand.category && (
                                <Text style={[styles.addEndorsementResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {brand.category}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.addEndorsementTextButton,
                              { backgroundColor: addedItemIds.has(brand.id) ? colors.textSecondary : (addingItemId === brand.id ? colors.success : colors.primary) }
                            ]}
                            onPress={() => handleAddToEndorsement(brand, 'brand')}
                            disabled={addingItemId === brand.id || addedItemIds.has(brand.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.addEndorsementTextButtonLabel}>
                              {addedItemIds.has(brand.id) ? 'Added' : (addingItemId === brand.id ? 'Adding...' : 'Endorse')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Businesses Section */}
                  {addSearchResults.businesses.length > 0 && (
                    <View style={styles.addEndorsementSection}>
                      <Text style={[styles.addEndorsementSectionTitle, { color: colors.textSecondary }]}>
                        Businesses ({addSearchResults.businesses.length})
                      </Text>
                      {addSearchResults.businesses.map((business) => (
                        <View
                          key={business.id}
                          style={styles.addEndorsementResultItem}
                        >
                          <TouchableOpacity
                            style={styles.addEndorsementResultInfo}
                            onPress={() => handleNavigateToDetails(business, 'business')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.addEndorsementResultLogo}>
                              <Image
                                source={{ uri: business.businessInfo?.logo || getLogoUrl(business.businessInfo?.website) }}
                                style={styles.addEndorsementResultLogoImage}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="memory-disk"
                              />
                            </View>
                            <View style={styles.addEndorsementResultText}>
                              <Text style={[styles.addEndorsementResultName, { color: colors.text }]} numberOfLines={2}>
                                {business.businessInfo?.name || 'Business'}
                              </Text>
                              {business.businessInfo?.category && (
                                <Text style={[styles.addEndorsementResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {business.businessInfo.category}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.addEndorsementTextButton,
                              { backgroundColor: addedItemIds.has(business.id) ? colors.textSecondary : (addingItemId === business.id ? colors.success : colors.primary) }
                            ]}
                            onPress={() => handleAddToEndorsement(business, 'business')}
                            disabled={addingItemId === business.id || addedItemIds.has(business.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.addEndorsementTextButtonLabel}>
                              {addedItemIds.has(business.id) ? 'Added' : (addingItemId === business.id ? 'Adding...' : 'Endorse')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* External Places Section (Google Places API) */}
                  {loadingPlaces && (
                    <View style={styles.addEndorsementSection}>
                      <Text style={[styles.addEndorsementSectionTitle, { color: colors.textSecondary }]}>
                        Searching all businesses...
                      </Text>
                      <View style={styles.addEndorsementLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    </View>
                  )}

                  {!loadingPlaces && placesResults.length > 0 && (
                    <View style={styles.addEndorsementSection}>
                      <Text style={[styles.addEndorsementSectionTitle, { color: colors.textSecondary }]}>
                        All Businesses ({placesResults.length})
                      </Text>
                      {placesResults.map((place) => (
                        <View
                          key={place.placeId}
                          style={styles.addEndorsementResultItem}
                        >
                          <TouchableOpacity
                            style={styles.addEndorsementResultInfo}
                            onPress={() => handleNavigateToDetails(place, 'place')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.addEndorsementResultLogo}>
                              {place.photoReference ? (
                                <Image
                                  source={{ uri: getPlacePhotoUrl(place.photoReference) }}
                                  style={styles.addEndorsementResultLogoImage}
                                  contentFit="cover"
                                  transition={200}
                                  cachePolicy="memory-disk"
                                />
                              ) : (
                                <View style={[styles.addEndorsementResultLogoImage, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                                  <Globe size={24} color={colors.textSecondary} />
                                </View>
                              )}
                            </View>
                            <View style={styles.addEndorsementResultText}>
                              <Text style={[styles.addEndorsementResultName, { color: colors.text }]} numberOfLines={2}>
                                {place.name}
                              </Text>
                              <Text style={[styles.addEndorsementResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                                {formatCategory(place.category)}{place.rating ? ` · ${place.rating}★` : ''}
                              </Text>
                              {place.address && (
                                <Text style={[styles.addEndorsementResultCategory, { color: colors.textSecondary, fontSize: 11 }]} numberOfLines={1}>
                                  {place.address}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.addEndorsementTextButton,
                              { backgroundColor: addedItemIds.has(place.placeId) ? colors.textSecondary : (addingItemId === place.placeId ? colors.success : colors.primary) }
                            ]}
                            onPress={() => handleAddToEndorsement(place, 'place')}
                            disabled={addingItemId === place.placeId || addedItemIds.has(place.placeId)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.addEndorsementTextButtonLabel}>
                              {addedItemIds.has(place.placeId) ? 'Added' : (addingItemId === place.placeId ? 'Adding...' : 'Endorse')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Endorsement Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowMapModal(false)}
      >
        <TouchableOpacity
          style={styles.mapModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMapModal(false)}
        >
          <Pressable
            style={[
              styles.mapModalContainer,
              {
                backgroundColor: colors.background,
                width: isLargeScreen ? width * 0.8 : width * 0.95,
                height: isLargeScreen ? height * 0.8 : height * 0.95,
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <View style={[styles.mapModalHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <Text style={[styles.mapModalTitle, { color: colors.text }]}>
                Endorsement Map ({mapEntries.length} {mapEntries.length === 1 ? 'location' : 'locations'})
              </Text>
              <TouchableOpacity
                style={[styles.mapModalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowMapModal(false)}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Map Content */}
            <View style={styles.mapModalContent}>
              {isGeocodingBrands && (
                <View style={styles.geocodingIndicator}>
                  <ActivityIndicator size="small" color="#00aaff" />
                  <Text style={[styles.geocodingText, { color: colors.textSecondary }]}>
                    Loading brand locations...
                  </Text>
                </View>
              )}
              {mapEntries.length > 0 ? (
                <EndorsementMapView
                  entries={mapEntries}
                  mapId="endorsement-list-map"
                  onEntryPress={(entry) => {
                    setShowMapModal(false);
                    // Navigate based on entry type
                    if (entry.type === 'place') {
                      router.push({
                        pathname: '/place/[id]',
                        params: { id: entry.id },
                      });
                    } else if (entry.type === 'business') {
                      router.push({
                        pathname: '/business/[id]',
                        params: { id: entry.id },
                      });
                    } else if (entry.type === 'brand') {
                      router.push({
                        pathname: '/brand/[id]',
                        params: { id: entry.id },
                      });
                    }
                  }}
                />
              ) : !isGeocodingBrands ? (
                <View style={styles.mapModalEmpty}>
                  <MapPin size={48} color={colors.textSecondary} strokeWidth={1.5} />
                  <Text style={[styles.mapModalEmptyText, { color: colors.text }]}>
                    No mappable locations in this list
                  </Text>
                  <Text style={[styles.mapModalEmptySubtext, { color: colors.textSecondary }]}>
                    Add places or local businesses to see them on the map
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// EXACT copy of Home tab styles
const styles = StyleSheet.create({
  libraryDirectory: {
    flex: 1,
  },
  individualListContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
  },
  menuBackdrop: {
    position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  individualListContainer: {
    marginHorizontal: 0,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
    minHeight: 64,
  },
  collapsibleListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
    paddingHorizontal: 0,
    paddingRight: 12,
    marginHorizontal: 0,
    marginVertical: 0,
    minHeight: 64,
    backgroundColor: 'transparent',
  },
  listContentContainer: {
    marginHorizontal: Platform.OS === 'web' ? 0 : 4,
    marginBottom: 8,
    paddingTop: 8,
  },
  pinnedListHeader: {
    // No special styling for pinned headers
  },
  collapsibleListHeaderContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  listProfileImageContainer: {
    width: 64,
    height: 64,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  listProfileImage: {
    width: '100%',
    height: '100%',
  },
  collapsibleListRowLayout: {
    flexDirection: 'row',
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
    position: 'absolute',
    top: 42,
    right: 0,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 99999,
    zIndex: 99999999,
    opacity: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  itemOptionsDropdown: {
    position: 'absolute',
    right: 16,
    top: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 99999,
    zIndex: 99999999,
    opacity: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      },
    }),
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
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  collapsibleListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 26,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  collapsibleListCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  collapsibleListAttribution: {
    fontSize: 11,
    fontStyle: 'italic',
    marginLeft: 26,
    marginBottom: 2,
  },
  collapsibleListDescription: {
    fontSize: 12,
    marginLeft: 26,
    lineHeight: 16,
  },
  // Brand card and item row styles from Home tab
  brandsContainer: {
    gap: 8,
  },
  top5Container: {
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    marginBottom: 0,
    gap: 8,
  },
  forYouItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flex: 1,
  },
  forYouItemNumber: {
    fontSize: 12,
    fontWeight: '500',
    paddingTop: 20,
    minWidth: 20,
    textAlign: 'right',
    marginLeft: -4,
  },
  forYouCardWrapper: {
    flex: 1,
  },
  // New endorsement entry card styles
  endorsementEntryWrapper: {
    marginBottom: 2,
  },
  endorsementEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 72,
  },
  endorsementEntryCardImage: {
    width: 72,
    height: 72,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  endorsementEntryCardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  endorsementEntryCardFirstLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  endorsementEntryCardNumber: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  endorsementEntryCardName: {
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  endorsementEntryCardCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  endorsementEntryOptionsButton: {
    padding: 8,
    marginRight: 4,
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
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
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
    fontWeight: '700',
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  brandCategory: {
    fontSize: 11,
    opacity: 0.7,
  },
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
  // Action menu dropdown styles
  actionMenuDropdown: {
    position: 'absolute',
    right: 8,
    top: 64,
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 99999,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionMenuText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  placeholderContainer: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  placeholderText: {
    fontSize: 15,
    textAlign: 'center',
  },
  // Empty endorsement list explainer styles
  emptyEndorsementContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 8,
  },
  emptyEndorsementIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyEndorsementTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyEndorsementSteps: {
    width: '100%',
    gap: 16,
  },
  emptyEndorsementStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyEndorsementStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyEndorsementStepText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  emptyEndorsementDescription: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyEndorsementTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  emptyEndorsementTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  emptyEndorsementTabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // List detail view styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  listDetailHeader: {
    flexDirection: 'row',
    padding: Platform.OS === 'web' ? 8 : 20,
    borderRadius: 0,
    borderWidth: 0,
    gap: 16,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  listDetailImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 0,
    borderWidth: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDetailImage: {
    width: '100%',
    height: '100%',
  },
  listDetailInfo: {
    flex: 1,
    gap: 6,
  },
  listDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  listDetailTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  listDetailCount: {
    fontSize: 15,
    fontWeight: '500',
  },
  listDetailAttribution: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  listDetailDescription: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  listDetailOptionsButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  // Reorder styles
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  reorderTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reorderButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  reorderButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Filter button styles
  filterButtonsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonsScroll: {
    gap: 8,
    paddingHorizontal: 4,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reorderEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  reorderArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  // Section selector styles
  sectionSelector: {
    padding: 12,
    gap: 12,
  },
  sectionGroupHeader: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'lowercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionThird: {
    flex: 1,
  },
  sectionHalf: {
    flex: 1,
  },
  sectionFull: {
    flex: 1,
  },
  sectionBox: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  endorsedCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endorsedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endorsedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stickyHeaderContainer: {
    ...(Platform.OS === 'web' && {
      position: 'sticky' as any,
      top: 0,
      zIndex: 10,
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Platform.OS === 'web' ? 8 : 16,
    borderBottomWidth: 1,
  },
  sectionHeaderTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  sectionHeaderIcon: {
    marginRight: 0,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActionButton: {
    padding: 8,
  },
  endorsedActionDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
    minWidth: 150,
  },
  endorsedActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  endorsedActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  globalToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  globalToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  globalToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptySection: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Empty endorsement explainer styles
  emptyEndorsementContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEndorsementIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyEndorsementTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyEndorsementSteps: {
    alignItems: 'flex-start',
    gap: 12,
  },
  emptyEndorsementStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyEndorsementStepText: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptyEndorsementDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyEndorsementTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  emptyEndorsementTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  emptyEndorsementTabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  // Add endorsement button and header actions
  endorsedHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addEndorsementButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Add endorsement modal styles
  addEndorsementModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  addEndorsementModalOverlayLarge: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80,
  },
  addEndorsementModalContent: {
    borderRadius: 24,
    height: '85%',
    maxHeight: '85%',
    minHeight: '85%',
    marginHorizontal: 8,
  },
  addEndorsementModalContentLarge: {
    width: '50%',
    maxWidth: 600,
    height: '80%',
    minHeight: '80%',
    maxHeight: '80%',
    borderRadius: 24,
    marginHorizontal: 0,
  },
  addEndorsementModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  addEndorsementModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addEndorsementCloseButton: {
    padding: 4,
  },
  addEndorsementSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    height: 56,
  },
  addEndorsementSearchInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    borderWidth: 0,
    outlineWidth: 0,
  },
  addEndorsementClearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addEndorsementResultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  addEndorsementLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  addEndorsementLoadingText: {
    fontSize: 14,
  },
  addEndorsementEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  addEndorsementEmptyText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  addEndorsementSection: {
    marginBottom: 16,
  },
  addEndorsementSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addEndorsementResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    marginBottom: 4,
  },
  addEndorsementResultInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  addEndorsementResultLogo: {
    width: 64,
    height: 64,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  addEndorsementResultLogoImage: {
    width: '100%',
    height: '100%',
  },
  addEndorsementResultText: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addEndorsementResultName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  addEndorsementResultCategory: {
    fontSize: 11,
    opacity: 0.7,
  },
  addEndorsementAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  addEndorsementTextButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  addEndorsementTextButtonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // Map modal styles
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mapModalContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  mapModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  mapModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  mapModalContent: {
    flex: 1,
  },
  geocodingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    gap: 8,
  },
  geocodingText: {
    fontSize: 13,
  },
  mapModalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  mapModalEmptyText: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  mapModalEmptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
