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
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp, Heart, Building2, Users, Globe, Shield, User as UserIcon, Tag, Trophy, Target, MapPin, Plus, UserPlus, UserMinus, Share2 } from 'lucide-react-native';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import MenuButton from '@/components/MenuButton';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { CauseCategory, Cause, Product } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { getAllUserBusinesses, BusinessUser } from '@/services/firebase/businessService';
import { calculateBrandScore, normalizeBrandScores } from '@/lib/scoring';
import { getLogoUrl } from '@/lib/logo';
import LocalBusinessView from '@/components/Library/LocalBusinessView';
import { useLibrary } from '@/contexts/LibraryContext';
import { followEntity, unfollowEntity, isFollowing as checkIsFollowing } from '@/services/firebase/followService';
import { addEntryToList, removeEntryFromList } from '@/services/firebase/listService';
import ItemOptionsModal from '@/components/ItemOptionsModal';

// ===== Types =====
type BrowseSection = 'global' | 'local' | 'values';

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

interface LocalValueState {
  id: string;
  name: string;
  category: string;
  type: 'support' | 'avoid';
  description?: string;
}

export default function BrowseScreen() {
  const router = useRouter();
  const { profile, isDarkMode, removeCauses, clerkUser, addCauses } = useUser();
  const { brands, valuesMatrix, values: firebaseValues } = useData();
  const library = useLibrary();
  const colors = isDarkMode ? darkColors : lightColors;

  // Section state
  const [selectedSection, setSelectedSection] = useState<BrowseSection>('global');

  // Values tab state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [localChanges, setLocalChanges] = useState<Map<string, LocalValueState | null>>(new Map());
  const hasUnsavedChanges = useRef(false);

  // Global section state
  const [globalSubsection, setGlobalSubsection] = useState<'aligned' | 'unaligned'>('aligned');
  const [alignedLoadCount, setAlignedLoadCount] = useState(10);
  const [unalignedLoadCount, setUnalignedLoadCount] = useState(10);
  const [followedBrands, setFollowedBrands] = useState<Set<string>>(new Set());

  // Item options modal state
  const [showItemOptionsModal, setShowItemOptionsModal] = useState(false);
  const [selectedBrandForOptions, setSelectedBrandForOptions] = useState<Product | null>(null);

  // Local section state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userBusinesses, setUserBusinesses] = useState<BusinessUser[]>([]);

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
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(`${window.location.origin}/brand/${brandId}`);
      Alert.alert('Success', 'Link copied to clipboard');
    } else {
      Alert.alert('Share', 'Share functionality coming soon');
    }
  };

  // Check if brand is endorsed
  const isBrandEndorsed = (brandId: string): boolean => {
    if (!library?.state?.userLists) return false;
    const endorsementList = library.state.userLists.find(list => list.isEndorsed);
    if (!endorsementList) return false;
    return endorsementList.entries?.some(
      (e: any) => e && e.type === 'brand' && e.brandId === brandId
    ) || false;
  };

  // Compute brand scores for Global section
  const { allSupport, allAvoid, scoredBrands } = useMemo(() => {
    const currentBrands = brands || [];

    if (!currentBrands || currentBrands.length === 0) {
      return {
        allSupport: [],
        allAvoid: [],
        scoredBrands: new Map(),
      };
    }

    const brandsWithScores = currentBrands.map(brand => {
      const score = calculateBrandScore(brand.name, profile.causes || [], valuesMatrix);
      return { brand, score };
    });

    const normalizedBrands = normalizeBrandScores(brandsWithScores);
    const scoredMap = new Map(normalizedBrands.map(({ brand, score }) => [brand.id, score]));
    const sortedByScore = [...normalizedBrands].sort((a, b) => b.score - a.score);

    const alignedBrands = sortedByScore.slice(0, 50).map(({ brand }) => brand);
    const unalignedBrands = sortedByScore.slice(-50).reverse().map(({ brand }) => brand);

    return {
      allSupport: alignedBrands,
      allAvoid: unalignedBrands,
      scoredBrands: scoredMap,
    };
  }, [brands, profile.causes, valuesMatrix]);

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

  const supportCauses = (profile.causes || [])
    .filter(c => c.type === 'support')
    .sort((a, b) => a.name.localeCompare(b.name));
  const avoidCauses = (profile.causes || [])
    .filter(c => c.type === 'avoid')
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedValueIds = new Set((profile.causes || []).map(c => c.id));

  const unselectedValuesByCategory: Record<string, any[]> = {};
  Object.keys(availableValues).forEach(category => {
    const values = availableValues[category] || [];
    unselectedValuesByCategory[category] = values.filter(v => !selectedValueIds.has(v.id));
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

  const getValueState = (valueId: string): 'unselected' | 'support' | 'avoid' => {
    if (localChanges.has(valueId)) {
      const localState = localChanges.get(valueId);
      if (localState === null) return 'unselected';
      return localState.type;
    }
    const profileCause = profile.causes.find(c => c.id === valueId);
    if (!profileCause) return 'unselected';
    return profileCause.type;
  };

  const savePendingChanges = async () => {
    if (!hasUnsavedChanges.current || localChanges.size === 0) return;

    try {
      const isBusiness = profile.accountType === 'business';
      const minValues = isBusiness ? 3 : 5;

      const finalCauses: Cause[] = [];
      const removedCauseIds: string[] = [];

      profile.causes.forEach(cause => {
        if (localChanges.has(cause.id)) {
          const localState = localChanges.get(cause.id);
          if (localState !== null) {
            finalCauses.push({
              id: cause.id,
              name: cause.name,
              category: cause.category,
              type: localState.type,
              description: cause.description,
            });
          } else {
            removedCauseIds.push(cause.id);
          }
        } else {
          finalCauses.push(cause);
        }
      });

      localChanges.forEach((localState, valueId) => {
        if (localState !== null && !profile.causes.find(c => c.id === valueId)) {
          finalCauses.push({
            id: localState.id,
            name: localState.name,
            category: localState.category as CauseCategory,
            type: localState.type,
            description: localState.description,
          });
        }
      });

      if (finalCauses.length < minValues) {
        return;
      }

      if (removedCauseIds.length > 0) {
        await removeCauses(removedCauseIds);
      }

      await addCauses(finalCauses);

      setLocalChanges(new Map());
      hasUnsavedChanges.current = false;
    } catch (error) {
      console.error('[Browse] Error saving changes:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        if (hasUnsavedChanges.current) {
          savePendingChanges();
        }
      };
    }, [localChanges, profile.causes])
  );

  const handleValueTap = (valueId: string) => {
    router.push(`/value/${valueId}`);
  };

  // Section colors
  const sectionColors = {
    global: { bg: colors.primary + '15', border: colors.primary },
    local: { bg: colors.success + '15', border: colors.success },
    values: { bg: colors.danger + '15', border: colors.danger },
  };

  // Render section blocks
  const renderSectionBlocks = () => {
    const globalCount = allSupport.length + allAvoid.length;
    const localCount = userBusinesses.length;
    const valuesCount = (profile.causes || []).length;

    const SectionBox = ({ section, label, count, Icon }: { section: BrowseSection; label: string; count: number; Icon: any }) => {
      const isSelected = selectedSection === section;
      const sectionColor = sectionColors[section];

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
          <Icon size={20} color={isSelected ? sectionColor.border : colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.sectionLabel, { color: isSelected ? sectionColor.border : colors.text }]}>
            {label}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {count}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.sectionSelector}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionThird}>
            <SectionBox section="global" label="Global" count={globalCount} Icon={Target} />
          </View>
          <View style={styles.sectionThird}>
            <SectionBox section="local" label="Local" count={localCount} Icon={MapPin} />
          </View>
          <View style={styles.sectionThird}>
            <SectionBox section="values" label="Values" count={valuesCount} Icon={Heart} />
          </View>
        </View>
      </View>
    );
  };

  // Render sticky section header
  const renderSectionHeader = () => {
    const titles: Record<BrowseSection, string> = {
      global: 'Recommendations',
      local: 'Recommendations',
      values: 'Browse by Values',
    };

    const icons: Record<BrowseSection, any> = {
      global: Target,
      local: MapPin,
      values: Heart,
    };

    const SectionIcon = icons[selectedSection];
    const title = titles[selectedSection];

    return (
      <View style={[styles.stickyHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.stickyHeaderLeft}>
          <SectionIcon size={20} color={sectionColors[selectedSection].border} strokeWidth={2} />
          <Text style={[styles.stickyHeaderTitle, { color: colors.text }]}>{title}</Text>
        </View>

        {/* Global section toggle */}
        {selectedSection === 'global' && (
          <View style={styles.globalToggle}>
            <TouchableOpacity
              style={[
                styles.globalToggleButton,
                globalSubsection === 'aligned' && { backgroundColor: colors.success + '20' },
              ]}
              onPress={() => setGlobalSubsection('aligned')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.globalToggleText,
                { color: globalSubsection === 'aligned' ? colors.success : colors.textSecondary }
              ]}>
                Aligned
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.globalToggleButton,
                globalSubsection === 'unaligned' && { backgroundColor: colors.danger + '20' },
              ]}
              onPress={() => setGlobalSubsection('unaligned')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.globalToggleText,
                { color: globalSubsection === 'unaligned' ? colors.danger : colors.textSecondary }
              ]}>
                Unaligned
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Values section - Update Values button */}
        {selectedSection === 'values' && (
          <TouchableOpacity
            style={[styles.updateValuesButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/onboarding')}
            activeOpacity={0.7}
          >
            <Text style={styles.updateValuesButtonText}>Update Values</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render brand card for Global section (matching Local list style)
  const renderBrandCard = (brand: Product, index: number) => {
    const score = scoredBrands.get(brand.id) || 0;
    const scoreColor = score >= 50 ? colors.primary : colors.danger;

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
            <View style={styles.brandLogoContainer}>
              <Image
                source={{ uri: getLogoUrl(brand.website) }}
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
            <View style={styles.brandScoreContainer}>
              <Text style={[styles.brandScore, { color: scoreColor }]}>
                {Math.round(score)}
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
              <View style={styles.plusIconCircle}>
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
    const items = globalSubsection === 'aligned' ? allSupport : allAvoid;
    const loadCount = globalSubsection === 'aligned' ? alignedLoadCount : unalignedLoadCount;
    const setLoadCount = globalSubsection === 'aligned' ? setAlignedLoadCount : setUnalignedLoadCount;

    if (items.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Target size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptySectionTitle, { color: colors.text }]}>No brands yet</Text>
          <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
            Set your values to see personalized brand recommendations
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.brandList}>
        {items.slice(0, loadCount).map((brand, index) => renderBrandCard(brand, index))}

        {items.length > loadCount && (
          <TouchableOpacity
            style={[styles.loadMoreButton, { borderColor: colors.border }]}
            onPress={() => setLoadCount(loadCount + 10)}
            activeOpacity={0.7}
          >
            <Text style={[styles.loadMoreText, { color: colors.primary }]}>
              Load More ({items.length - loadCount} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Local content
  const renderLocalContent = () => {
    return (
      <LocalBusinessView
        userBusinesses={userBusinesses}
        userLocation={userLocation}
        userCauses={profile.causes || []}
        isDarkMode={isDarkMode}
        onRequestLocation={requestLocation}
      />
    );
  };

  // Render Values content
  const renderValuesContent = () => {
    return (
      <View style={styles.valuesContent}>
        <Text style={[styles.valueHintText, { color: colors.textSecondary }]}>
          Tap any value to see related brands
        </Text>

        {supportCauses.length === 0 && avoidCauses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Values Selected</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Complete onboarding to add values
            </Text>
          </View>
        ) : (
          <>
            {supportCauses.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Support</Text>
                <View style={styles.valuesGrid}>
                  {supportCauses.map(cause => {
                    const currentState = getValueState(cause.id);
                    return (
                      <TouchableOpacity
                        key={cause.id}
                        style={[
                          styles.valueChip,
                          currentState === 'support' && { backgroundColor: colors.success, borderColor: colors.success },
                          currentState === 'avoid' && { backgroundColor: colors.danger, borderColor: colors.danger },
                          currentState === 'unselected' && { backgroundColor: 'transparent', borderColor: colors.neutral, borderWidth: 1.5 }
                        ]}
                        onPress={() => handleValueTap(cause.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.valueChipText,
                            currentState === 'support' && { color: colors.white },
                            currentState === 'avoid' && { color: colors.white },
                            currentState === 'unselected' && { color: colors.neutral, fontWeight: '500' as const }
                          ]}
                          numberOfLines={1}
                        >
                          {cause.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {avoidCauses.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Against</Text>
                <View style={styles.valuesGrid}>
                  {avoidCauses.map(cause => {
                    const currentState = getValueState(cause.id);
                    return (
                      <TouchableOpacity
                        key={cause.id}
                        style={[
                          styles.valueChip,
                          currentState === 'support' && { backgroundColor: colors.success, borderColor: colors.success },
                          currentState === 'avoid' && { backgroundColor: colors.danger, borderColor: colors.danger },
                          currentState === 'unselected' && { backgroundColor: 'transparent', borderColor: colors.neutral, borderWidth: 1.5 }
                        ]}
                        onPress={() => handleValueTap(cause.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.valueChipText,
                            currentState === 'support' && { color: colors.white },
                            currentState === 'avoid' && { color: colors.white },
                            currentState === 'unselected' && { color: colors.neutral, fontWeight: '500' as const }
                          ]}
                          numberOfLines={1}
                        >
                          {cause.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* Unselected Values Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Unselected Values</Text>

          {sortedCategories.map((category) => {
            const values = unselectedValuesByCategory[category];
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
                    {values.map(value => {
                      const currentState = getValueState(value.id);
                      return (
                        <TouchableOpacity
                          key={value.id}
                          style={[
                            styles.valueChip,
                            currentState === 'unselected' && styles.unselectedValueChip,
                            currentState === 'unselected' && { borderColor: colors.neutral, backgroundColor: 'transparent' },
                            currentState === 'support' && { backgroundColor: colors.success, borderColor: colors.success },
                            currentState === 'avoid' && { backgroundColor: colors.danger, borderColor: colors.danger }
                          ]}
                          onPress={() => handleValueTap(value.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.valueChipText,
                              currentState === 'unselected' && styles.unselectedValueText,
                              currentState === 'unselected' && { color: colors.neutral },
                              currentState === 'support' && { color: colors.white },
                              currentState === 'avoid' && { color: colors.white }
                            ]}
                            numberOfLines={1}
                          >
                            {value.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={[styles.infoSection, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>About Your Values</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your values help us recommend products and brands that match your beliefs and priorities.
          </Text>
        </View>
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
            source={require('@/assets/images/endorsemobile.png')}
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
    backgroundColor: '#2563EB',
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
});
