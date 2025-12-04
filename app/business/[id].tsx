import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, MapPin, Navigation, Percent, X, Plus, ChevronRight, List, UserPlus, MoreVertical, Share2, Users, Star, Heart, Search, BookOpen, Compass } from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  PanResponder,
  Modal,
  Alert,
  TouchableWithoutFeedback,
  Share,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { lightColors, darkColors } from '@/constants/colors';
import { AVAILABLE_VALUES } from '@/mocks/causes';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { BusinessInfo, Cause } from '@/types';
import { getLogoUrl, getBusinessLogoUrl, isGooglePlacesPhotoUrl } from '@/lib/logo';
import { calculateAlignmentScore } from '@/services/firebase/businessService';
import { getUserLists, addEntryToList } from '@/services/firebase/listService';
import { calculateSimilarityScore, getSimilarityLabel, normalizeSimilarityScores, normalizeBusinessScoresWithBrands, calculateBrandScore } from '@/lib/scoring';
import { getAllUserBusinesses } from '@/services/firebase/businessService';
import { followEntity, unfollowEntity, isFollowing as checkIsFollowing, getFollowersCount, getFollowingCount } from '@/services/firebase/followService';
import FollowingFollowersList from '@/components/FollowingFollowersList';
import { useReferralCode } from '@/hooks/useReferralCode';
import { appendReferralTracking } from '@/services/firebase/referralService';
import { getBusinessEndorsementCount } from '@/services/firebase/topRankingsService';

interface BusinessUser {
  id: string;
  email?: string;
  fullName?: string;
  businessInfo: BusinessInfo;
  causes?: Cause[];
}

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, isDarkMode, clerkUser } = useUser();
  const { values, brands, valuesMatrix } = useData();
  const library = useLibrary();
  const colors = isDarkMode ? darkColors : lightColors;
  const scrollViewRef = useRef<ScrollView>(null);
  const { referralCode } = useReferralCode();

  const [business, setBusiness] = useState<BusinessUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<{ imageUrl: string; caption: string } | null>(null);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [userLists, setUserLists] = useState<any[]>([]);
  const [businessOwnerLists, setBusinessOwnerLists] = useState<any[]>([]);
  const [loadingBusinessLists, setLoadingBusinessLists] = useState(true);
  const [allBusinesses, setAllBusinesses] = useState<BusinessUser[]>([]);
  const [isFollowingBusiness, setIsFollowingBusiness] = useState(false);
  const [checkingFollowStatus, setCheckingFollowStatus] = useState(true);
  const [isEndorsingBusiness, setIsEndorsingBusiness] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [endorsementsVisibleCount, setEndorsementsVisibleCount] = useState(5);
  const [endorsementActionMenuTarget, setEndorsementActionMenuTarget] = useState<{ type: 'brand' | 'business'; id: string; name: string } | null>(null);
  const [businessEndorsementCount, setBusinessEndorsementCount] = useState(0);

  useEffect(() => {
    const fetchBusiness = async () => {
      if (!id) return;

      try {
        const docRef = doc(db, 'users', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.accountType === 'business' && data.businessInfo) {
            setBusiness({
              id: docSnap.id,
              email: data.email,
              fullName: data.fullName,
              businessInfo: data.businessInfo as BusinessInfo,
              causes: data.causes || [],
            });
          }
        }
      } catch (error) {
        console.error('Error fetching business:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [id]);

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

  const loadUserLists = async () => {
    if (!clerkUser?.id) return;
    try {
      const lists = await getUserLists(clerkUser.id);
      setUserLists(lists);
    } catch (error) {
      console.error('[BusinessDetail] Error loading user lists:', error);
    }
  };

  // Load business owner's lists to display their brands & businesses
  const loadBusinessOwnerLists = async () => {
    if (!id) return;
    try {
      setLoadingBusinessLists(true);
      const lists = await getUserLists(id as string);
      setBusinessOwnerLists(lists);
    } catch (error) {
      console.error('[BusinessDetail] Error loading business owner lists:', error);
    } finally {
      setLoadingBusinessLists(false);
    }
  };

  // Helper to extract endorsements from business owner's endorsement list
  const getEndorsements = () => {
    // Find the endorsement list (isEndorsed flag indicates endorsement list)
    const endorsementList = businessOwnerLists.find(list => list.isEndorsed === true);

    if (!endorsementList) {
      console.log('[BusinessDetail] No endorsement list found in businessOwnerLists:', businessOwnerLists.length, 'lists');
      return [];
    }

    console.log('[BusinessDetail] Found endorsement list with', endorsementList.entries?.length || 0, 'entries');

    const endorsements: { type: 'brand' | 'business'; id: string; name: string; logoUrl?: string; website?: string }[] = [];

    // Filter out null/undefined entries
    const validEntries = (endorsementList.entries || []).filter((e: any) => e != null);

    validEntries.forEach((entry: any) => {
      // Handle brand entries - check for brandId or fallback to id
      if (entry.type === 'brand') {
        const brandId = entry.brandId || entry.id;
        if (brandId) {
          endorsements.push({
            type: 'brand',
            id: brandId,
            name: entry.brandName || entry.name || brandId,
            logoUrl: entry.logoUrl || '',
            website: entry.website || '',
          });
        }
      }
      // Handle business entries - check for businessId or fallback to id
      else if (entry.type === 'business') {
        const businessId = entry.businessId || entry.id;
        if (businessId) {
          endorsements.push({
            type: 'business',
            id: businessId,
            name: entry.businessName || entry.name || 'Unknown Business',
            logoUrl: entry.logoUrl || '',
            website: entry.website || '',
          });
        }
      }
      // Handle entries without explicit type - try to infer
      else if (entry.brandId) {
        endorsements.push({
          type: 'brand',
          id: entry.brandId,
          name: entry.brandName || entry.name || entry.brandId,
          logoUrl: entry.logoUrl || '',
          website: entry.website || '',
        });
      } else if (entry.businessId) {
        endorsements.push({
          type: 'business',
          id: entry.businessId,
          name: entry.businessName || entry.name || 'Unknown Business',
          logoUrl: entry.logoUrl || '',
          website: entry.website || '',
        });
      }
    });

    console.log('[BusinessDetail] Extracted', endorsements.length, 'endorsements');
    return endorsements;
  };

  const handleAddToList = async (listId: string) => {
    if (!business || !clerkUser?.id) return;

    try {
      await addEntryToList(listId, {
        type: 'business',
        businessId: business.id,
        name: business.businessInfo.name,
        website: business.businessInfo.website || '',
        logoUrl: business.businessInfo.logoUrl || getLogoUrl(business.businessInfo.website || ''),
      });

      // Refresh library to show the new entry immediately
      await library.loadUserLists(clerkUser.id, true);

      setShowAddToListModal(false);
      Alert.alert('Success', `Added ${business.businessInfo.name} to your list`);
    } catch (error) {
      console.error('[BusinessDetail] Error adding to list:', error);
      Alert.alert('Error', 'Could not add to list. Please try again.');
    }
  };

  const handleOpenAddModal = async () => {
    if (userLists.length === 0) {
      await loadUserLists();
    }
    setShowAddToListModal(true);
  };

  const handleFollow = async () => {
    if (!business || !clerkUser?.id) {
      Alert.alert('Error', 'You must be logged in to follow businesses');
      return;
    }

    try {
      if (isFollowingBusiness) {
        await unfollowEntity(clerkUser.id, business.id, 'business');
        setIsFollowingBusiness(false);
        Alert.alert('Success', `Unfollowed ${business.businessInfo.name}`);
      } else {
        await followEntity(clerkUser.id, business.id, 'business');
        setIsFollowingBusiness(true);
        Alert.alert('Success', `Now following ${business.businessInfo.name}`);
      }
      setShowActionMenu(false);
    } catch (error: any) {
      console.error('[BusinessDetail] Error following/unfollowing business:', error);
      Alert.alert('Error', error?.message || 'Could not follow business. Please try again.');
    }
  };

  const handleEndorse = async () => {
    if (!business || !library.state.endorsementList?.id) {
      Alert.alert('Error', 'Endorsement list not found');
      return;
    }

    try {
      if (isEndorsingBusiness) {
        // Find the entry in the endorsement list and remove it
        const entryToRemove = library.state.endorsementList.entries.find(entry =>
          entry.type === 'business' && (entry as any).businessId === business.id
        );

        if (entryToRemove) {
          await library.removeEntry(library.state.endorsementList.id, entryToRemove.id);
          setIsEndorsingBusiness(false);
          Alert.alert('Success', `Unendorsed ${business.businessInfo.name}`);
        }
      } else {
        // Add to endorsement list
        await library.addEntry(library.state.endorsementList.id, {
          type: 'business',
          businessId: business.id,
          businessName: business.businessInfo.name,
          businessCategory: business.businessInfo.category,
          website: business.businessInfo.website || '',
          logoUrl: business.businessInfo.logoUrl || (business.businessInfo.website ? getLogoUrl(business.businessInfo.website) : ''),
        });
        setIsEndorsingBusiness(true);
        Alert.alert('Success', `${business.businessInfo.name} endorsed!`);
      }

      setShowActionMenu(false);

      // Refresh library to update UI
      if (clerkUser?.id) {
        await library.loadUserLists(clerkUser.id, true);
      }
    } catch (error: any) {
      console.error('Error toggling endorse:', error);
      Alert.alert('Error', error?.message || 'Failed to update endorsement');
    }
  };

  const handleShare = async () => {
    if (!business) return;

    try {
      const message = `Check out ${business.businessInfo.name} on iEndorse!`;
      const baseUrl = Platform.OS === 'web'
        ? `${window.location.origin}/business/${business.id}`
        : `https://iendorse.app/business/${business.id}`;
      const url = appendReferralTracking(baseUrl, referralCode);

      await Share.share({
        message: `${message}\n${url}`,
        title: business.businessInfo.name,
      });
      setShowActionMenu(false);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  useEffect(() => {
    loadUserLists();
  }, [clerkUser?.id]);

  useEffect(() => {
    loadBusinessOwnerLists();
  }, [id]);

  // Check follow status when business loads
  useEffect(() => {
    const checkFollow = async () => {
      if (!clerkUser?.id || !business?.id) {
        setCheckingFollowStatus(false);
        return;
      }
      try {
        const following = await checkIsFollowing(clerkUser.id, business.id, 'business');
        setIsFollowingBusiness(following);
      } catch (error) {
        console.error('[BusinessDetail] Error checking follow status:', error);
      } finally {
        setCheckingFollowStatus(false);
      }
    };
    checkFollow();
  }, [clerkUser?.id, business?.id]);

  // Check if business is endorsed when business or library loads
  useEffect(() => {
    if (!business?.id || !library.state.endorsementList) {
      setIsEndorsingBusiness(false);
      return;
    }

    const businessIsEndorsed = library.state.endorsementList.entries.filter(e => e).some(entry =>
      entry.type === 'business' && (entry as any).businessId === business.id
    );
    setIsEndorsingBusiness(businessIsEndorsed);
  }, [business?.id, library.state.endorsementList]);

  // Load all businesses for normalization
  useEffect(() => {
    const fetchAllBusinesses = async () => {
      try {
        const businesses = await getAllUserBusinesses();
        setAllBusinesses(businesses);
      } catch (error) {
        console.error('Error fetching all businesses:', error);
      }
    };
    fetchAllBusinesses();
  }, []);

  // Load follower/following counts when business loads
  useEffect(() => {
    const loadFollowCounts = async () => {
      if (!business?.id) return;

      try {
        const followers = await getFollowersCount(business.id, 'business');
        const following = await getFollowingCount(business.id);
        setFollowersCount(followers);
        setFollowingCount(following);
      } catch (error) {
        console.error('[BusinessDetail] Error loading follow counts:', error);
      }
    };
    loadFollowCounts();
  }, [business?.id]);

  // Load endorsement count for this business
  useEffect(() => {
    const loadEndorsementCount = async () => {
      if (!business?.id) return;

      try {
        const count = await getBusinessEndorsementCount(business.id);
        setBusinessEndorsementCount(count);
      } catch (error) {
        console.error('[BusinessDetail] Error loading endorsement count:', error);
      }
    };
    loadEndorsementCount();
  }, [business?.id]);

  const handleShopPress = async () => {
    if (!business?.businessInfo.website) return;
    try {
      const websiteUrl = business.businessInfo.website.startsWith('http')
        ? business.businessInfo.website
        : `https://${business.businessInfo.website}`;
      const canOpen = await Linking.canOpenURL(websiteUrl);
      if (canOpen) {
        await Linking.openURL(websiteUrl);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleSocialPress = async (platform: 'x' | 'instagram' | 'facebook' | 'linkedin' | 'yelp' | 'youtube') => {
    if (!business) return;
    try {
      const socialMedia = business.businessInfo.socialMedia;
      let url = '';

      switch (platform) {
        case 'x':
          url = socialMedia?.twitter ? `https://x.com/${socialMedia.twitter}` : '';
          break;
        case 'instagram':
          url = socialMedia?.instagram ? `https://instagram.com/${socialMedia.instagram}` : '';
          break;
        case 'facebook':
          url = socialMedia?.facebook ? `https://facebook.com/${socialMedia.facebook}` : '';
          break;
        case 'linkedin':
          url = socialMedia?.linkedin
            ? (socialMedia.linkedin.startsWith('http') ? socialMedia.linkedin : `https://${socialMedia.linkedin}`)
            : '';
          break;
        case 'yelp':
          url = socialMedia?.yelp
            ? (socialMedia.yelp.startsWith('http') ? socialMedia.yelp : `https://${socialMedia.yelp}`)
            : '';
          break;
        case 'youtube':
          url = socialMedia?.youtube
            ? (socialMedia.youtube.startsWith('http') ? socialMedia.youtube : `https://${socialMedia.youtube}`)
            : '';
          break;
      }

      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      }
    } catch (error) {
      console.error('Error opening social URL:', error);
    }
  };

  const handleViewOnMap = async () => {
    if (!business) return;

    // Get the primary location or first location
    let latitude: number | undefined;
    let longitude: number | undefined;
    let address: string | undefined;

    if (business.businessInfo.locations && business.businessInfo.locations.length > 0) {
      const primaryLocation = business.businessInfo.locations.find(loc => loc.isPrimary) || business.businessInfo.locations[0];
      latitude = primaryLocation.latitude;
      longitude = primaryLocation.longitude;
      address = primaryLocation.address;
    } else if (business.businessInfo.latitude && business.businessInfo.longitude) {
      latitude = business.businessInfo.latitude;
      longitude = business.businessInfo.longitude;
      address = business.businessInfo.location;
    }

    if (!latitude || !longitude) {
      return;
    }

    try {
      // Create Google Maps URL with coordinates
      const label = encodeURIComponent(business.businessInfo.name);
      const url = Platform.select({
        ios: `maps:0,0?q=${latitude},${longitude}(${label})`,
        android: `geo:0,0?q=${latitude},${longitude}(${label})`,
        default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      });

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening maps:', error);
    }
  };

  // Calculate alignment data
  let alignmentData = {
    isAligned: false,
    matchingValues: [] as string[],
    alignedValues: [] as { id: string; userStance: string; bizStance: string }[],
    unalignedValues: [] as { id: string; userStance: string; bizStance: string }[],
    alignmentStrength: 50
  };

  // Calculate similarity score using new scoring system with normalization
  // Match the normalization logic from home tab to ensure scores are consistent
  let similarityScore = 0;
  let similarityLabel = 'Different';
  let matchingValues: string[] = [];

  if (business && profile.causes && allBusinesses.length > 0) {
    // Calculate scores for all businesses
    const businessesWithScores = allBusinesses.map(b => ({
      ...b,
      alignmentScore: calculateSimilarityScore(profile.causes || [], b.causes || [])
    }));

    // Calculate raw brand scores for reference distribution
    const rawBrandScores = brands && valuesMatrix
      ? brands.map(brand => calculateBrandScore(brand.name, profile.causes || [], valuesMatrix))
      : [];

    // Normalize similarity scores using brand scores as reference distribution
    // This allows businesses to be compared on the same scale as brands
    const normalizedBusinesses = rawBrandScores.length > 0
      ? normalizeBusinessScoresWithBrands(businessesWithScores, rawBrandScores)
      : normalizeSimilarityScores(businessesWithScores);

    // Find the score for the current business
    const currentBusinessScore = normalizedBusinesses.find(b => b.id === business.id);
    similarityScore = currentBusinessScore?.alignmentScore || 50;
    similarityLabel = getSimilarityLabel(similarityScore);

    // Create maps of user and business values with their stances
    const userValueMap = new Map(profile.causes.map(c => [c.id, c.type]));
    const bizValueMap = new Map((business.causes || []).map(c => [c.id, c.type]));

    // Find all value IDs that either user or business has
    const allValueIds = new Set([...userValueMap.keys(), ...bizValueMap.keys()]);

    const alignedValues: { id: string; userStance: string; bizStance: string }[] = [];
    const unalignedValues: { id: string; userStance: string; bizStance: string }[] = [];

    allValueIds.forEach(valueId => {
      const userStance = userValueMap.get(valueId);
      const bizStance = bizValueMap.get(valueId);

      if (userStance && bizStance) {
        // Both have this value - check if same stance
        if (userStance === bizStance) {
          alignedValues.push({ id: valueId, userStance, bizStance });
        } else {
          unalignedValues.push({ id: valueId, userStance, bizStance });
        }
      }
    });

    // Legacy: values that both have (regardless of stance)
    const userValueIds = new Set(profile.causes.map(c => c.id));
    const bizValueIds = new Set((business.causes || []).map(c => c.id));
    matchingValues = [...userValueIds].filter(id => bizValueIds.has(id));

    const isAligned = similarityScore >= 50;

    alignmentData = {
      isAligned,
      matchingValues,
      alignedValues,
      unalignedValues,
      alignmentStrength: similarityScore
    };
  }

  const alignmentColor = similarityScore >= 60 ? colors.success : similarityScore < 40 ? colors.danger : colors.textSecondary;
  const AlignmentIcon = similarityScore >= 60 ? TrendingUp : TrendingDown;
  const alignmentLabel = alignmentData.isAligned ? 'Aligned' : 'Not Aligned';

  // Get primary location
  const getPrimaryLocation = () => {
    if (business?.businessInfo.locations && business.businessInfo.locations.length > 0) {
      const primary = business.businessInfo.locations.find(loc => loc.isPrimary);
      return primary?.address || business.businessInfo.locations[0].address;
    }
    return business?.businessInfo.location;
  };

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Loading business...</Text>
        </View>
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.text }]}>Business not found</Text>
        </View>
      </View>
    );
  }

  // Use cover image for hero, otherwise fall back to uploaded logo (avoiding Google Places photos), then generated logo
  const coverSource = business.businessInfo.coverImageUrl ||
    getBusinessLogoUrl(business.businessInfo.logoUrl, business.businessInfo.website);
  // Use uploaded logoUrl (avoiding Google Places photos), fallback to generated logo from website
  const logoSource = getBusinessLogoUrl(business.businessInfo.logoUrl, business.businessInfo.website);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={Platform.OS === 'web' ? styles.webWrapper : styles.fullWidth}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        {...panResponder.panHandlers}
      >
        <View style={styles.heroImageContainer}>
          <Image
            source={{ uri: coverSource }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            priority="high"
            placeholder={{ blurhash: 'LGF5?xoffQj[~qoffQof?bofj[ay' }}
          />
          {/* Back button on top left of cover photo */}
          <TouchableOpacity
            style={[styles.backButtonOverlay, { backgroundColor: colors.backgroundSecondary + 'DD' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>

          {business.businessInfo.website && (
            <TouchableOpacity
              style={[styles.visitButton, { backgroundColor: colors.primary }]}
              onPress={handleShopPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.visitButtonText, { color: colors.white }]}>Visit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          {/* Header with logo, business info, and score */}
          <View style={styles.header}>
            <Image
              source={{ uri: logoSource }}
              style={styles.headerLogo}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              placeholder={{ blurhash: 'LGF5?xoffQj[~qoffQof?bofj[ay' }}
            />

            <View style={styles.titleContainer}>
              <View style={styles.brandNameRow}>
                <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={2}>{business.businessInfo.name}</Text>
              </View>
              <View style={styles.categoryRow}>
                <Text style={[styles.category, { color: colors.primary }]}>{business.businessInfo.category}</Text>
              </View>
              {getPrimaryLocation() && (
                <View style={styles.locationRow}>
                  <MapPin size={14} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                    {getPrimaryLocation()}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.scoreContainer, { position: 'relative', zIndex: showActionMenu ? 1000 : 1 }]}>
              <View style={styles.endorsementBadgeContainer}>
                <View style={[styles.endorsementBadge, { backgroundColor: 'transparent', borderColor: colors.primary }]}>
                  <Users size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.endorsementBadgeText, { color: colors.primary }]}>
                    {businessEndorsementCount}
                  </Text>
                </View>
                <Text style={[styles.endorsementBadgeLabel, { color: colors.textSecondary }]}>
                  endorsements
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionMenuButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowActionMenu(!showActionMenu)}
                activeOpacity={0.7}
              >
                <View style={{ transform: [{ rotate: '90deg' }] }}>
                  <MoreVertical size={18} color={colors.text} strokeWidth={2} />
                </View>
              </TouchableOpacity>
              {/* Inline Action Menu Dropdown */}
              {showActionMenu && (
                <View style={[styles.actionMenuDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.actionMenuDropdownItem}
                    onPress={() => {
                      setShowActionMenu(false);
                      handleEndorse();
                    }}
                    activeOpacity={0.7}
                  >
                    <UserPlus size={16} color={colors.text} strokeWidth={2} />
                    <Text style={[styles.actionMenuDropdownText, { color: colors.text }]}>
                      {isEndorsingBusiness ? 'Unendorse' : 'Endorse'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionMenuDropdownItem}
                    onPress={() => {
                      setShowActionMenu(false);
                      handleFollow();
                    }}
                    activeOpacity={0.7}
                  >
                    <UserPlus size={16} color={colors.text} strokeWidth={2} />
                    <Text style={[styles.actionMenuDropdownText, { color: colors.text }]}>
                      {isFollowingBusiness ? 'Unfollow' : 'Follow'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionMenuDropdownItem}
                    onPress={() => {
                      setShowActionMenu(false);
                      handleShare();
                    }}
                    activeOpacity={0.7}
                  >
                    <Share2 size={16} color={colors.text} strokeWidth={2} />
                    <Text style={[styles.actionMenuDropdownText, { color: colors.text }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {business.businessInfo.description && (
            <Text style={[styles.brandDescription, { color: colors.textSecondary }]}>
              {business.businessInfo.description}
            </Text>
          )}

          {/* Gallery Images Section - Horizontal scroll above action buttons */}
          {business.businessInfo.galleryImages && business.businessInfo.galleryImages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.galleryHorizontalScroll}
              contentContainerStyle={styles.galleryHorizontalContent}
            >
              {business.businessInfo.galleryImages.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.galleryHorizontalCard, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => setSelectedGalleryImage(item)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.galleryHorizontalImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                    placeholder={{ blurhash: 'LGF5?xoffQj[~qoffQof?bofj[ay' }}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Action buttons row: Directions and Website */}
          <View style={styles.actionButtonsRow}>
            {/* View on Map Button */}
            {((business.businessInfo.locations && business.businessInfo.locations.length > 0) ||
              (business.businessInfo.latitude && business.businessInfo.longitude)) && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={handleViewOnMap}
                activeOpacity={0.7}
              >
                <Navigation size={18} color={colors.white} strokeWidth={2} />
                <Text style={[styles.actionButtonText, { color: colors.white }]}>Directions</Text>
              </TouchableOpacity>
            )}

            {/* Website Button */}
            {business.businessInfo.website && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={handleShopPress}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionButtonText, { color: colors.text }]}>Website</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.socialLinksContainer}>
            {business.businessInfo.socialMedia?.twitter && (
              <TouchableOpacity
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleSocialPress('x')}
                activeOpacity={0.7}
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>𝕏</Text>
              </TouchableOpacity>
            )}
            {business.businessInfo.socialMedia?.instagram && (
              <TouchableOpacity
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleSocialPress('instagram')}
                activeOpacity={0.7}
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>Instagram</Text>
              </TouchableOpacity>
            )}
            {business.businessInfo.socialMedia?.facebook && (
              <TouchableOpacity
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleSocialPress('facebook')}
                activeOpacity={0.7}
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>Facebook</Text>
              </TouchableOpacity>
            )}
            {business.businessInfo.socialMedia?.linkedin && (
              <TouchableOpacity
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleSocialPress('linkedin')}
                activeOpacity={0.7}
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>LinkedIn</Text>
              </TouchableOpacity>
            )}
            {business.businessInfo.socialMedia?.yelp && (
              <TouchableOpacity
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleSocialPress('yelp')}
                activeOpacity={0.7}
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>Yelp</Text>
              </TouchableOpacity>
            )}
            {business.businessInfo.socialMedia?.youtube && (
              <TouchableOpacity
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleSocialPress('youtube')}
                activeOpacity={0.7}
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>YouTube</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Follower/Following Counters */}
          <View style={styles.followCountsContainer}>
            <TouchableOpacity
              style={[styles.followCountButton, { borderColor: colors.border }]}
              onPress={() => setShowFollowersModal(true)}
              activeOpacity={0.7}
            >
              <Users size={16} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.followCountNumber, { color: colors.text }]}>
                {followersCount}
              </Text>
              <Text style={[styles.followCountLabel, { color: colors.textSecondary }]}>
                Followers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.followCountButton, { borderColor: colors.border }]}
              onPress={() => setShowFollowingModal(true)}
              activeOpacity={0.7}
            >
              <Users size={16} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.followCountNumber, { color: colors.text }]}>
                {followingCount}
              </Text>
              <Text style={[styles.followCountLabel, { color: colors.textSecondary }]}>
                Following
              </Text>
            </TouchableOpacity>
          </View>

          {/* Endorse Discount Section - Always visible */}
          <View style={[styles.standDiscountSection, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.discountHeader}>
              <Percent size={20} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.discountHeaderText, { color: colors.text }]}>Endorse Discount</Text>
            </View>

            {business.businessInfo.acceptsStandDiscounts ? (
              <View style={[styles.discountCard, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                {/* Discount Tiers - Uniform display: Tier name | Percentage | Type | Days */}
                {(() => {
                  const tiers = [];

                  // Tier 1 (base discount)
                  const tier1Percent = business.businessInfo.customerDiscountPercent || business.businessInfo.endorsementDiscountPercent || 0;
                  if (tier1Percent > 0) {
                    const tier1Type = business.businessInfo.endorsementType || 'any';
                    const tier1Days = business.businessInfo.endorsementMinDays || 0;
                    tiers.push({
                      name: 'Tier 1',
                      percent: tier1Percent,
                      type: tier1Type,
                      days: tier1Days,
                    });
                  }

                  // Tier 2
                  if (business.businessInfo.tier2Discount && business.businessInfo.tier2Discount > 0) {
                    tiers.push({
                      name: 'Tier 2',
                      percent: business.businessInfo.tier2Discount,
                      type: business.businessInfo.tier2Type || 'any',
                      days: business.businessInfo.tier2MinDays || 0,
                    });
                  }

                  // Tier 3
                  if (business.businessInfo.tier3Discount && business.businessInfo.tier3Discount > 0) {
                    tiers.push({
                      name: 'Tier 3',
                      percent: business.businessInfo.tier3Discount,
                      type: business.businessInfo.tier3Type || 'any',
                      days: business.businessInfo.tier3MinDays || 0,
                    });
                  }

                  const formatType = (type: string) => {
                    if (type === 'top5') return 'Top 5';
                    if (type === 'top10') return 'Top 10';
                    return 'Any Position';
                  };

                  if (tiers.length === 0) {
                    return (
                      <Text style={[styles.noDiscountText, { color: colors.textSecondary }]}>
                        Discount details not configured
                      </Text>
                    );
                  }

                  return tiers.map((tier, index) => (
                    <View key={tier.name}>
                      {index > 0 && <View style={[styles.discountDivider, { backgroundColor: colors.border }]} />}
                      <View style={styles.tierRow}>
                        <Text style={[styles.tierName, { color: colors.text }]}>{tier.name}</Text>
                        <View style={styles.tierDetails}>
                          <Text style={[styles.tierPercent, { color: colors.primary }]}>{tier.percent.toFixed(0)}% off</Text>
                          <Text style={[styles.tierMeta, { color: colors.textSecondary }]}>
                            {formatType(tier.type)}{tier.days > 0 ? ` · ${tier.days}+ days` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ));
                })()}

                {/* Custom discount if set */}
                {business.businessInfo.customDiscount && (
                  <>
                    <View style={[styles.discountDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.tierRow}>
                      <Text style={[styles.tierName, { color: colors.text }]}>Special</Text>
                      <View style={styles.tierDetails}>
                        <Text style={[styles.tierPercent, { color: colors.primary }]}>{business.businessInfo.customDiscount}</Text>
                        {(business.businessInfo.customDiscountType || business.businessInfo.customDiscountMinDays) && (
                          <Text style={[styles.tierMeta, { color: colors.textSecondary }]}>
                            {business.businessInfo.customDiscountType === 'top5' ? 'Top 5' :
                             business.businessInfo.customDiscountType === 'top10' ? 'Top 10' : ''}
                            {business.businessInfo.customDiscountMinDays > 0 && (business.businessInfo.customDiscountType ? ' · ' : '') + `${business.businessInfo.customDiscountMinDays}+ days`}
                          </Text>
                        )}
                      </View>
                    </View>
                  </>
                )}

                {/* Requirements section */}
                {(business.businessInfo.endorsementEnabled || business.businessInfo.followsEnabled ||
                  business.businessInfo.requireFollow || business.businessInfo.requireEndorse) && (
                  <>
                    <View style={[styles.discountDivider, { backgroundColor: colors.border }]} />
                    <Text style={[styles.requirementsHeader, { color: colors.textSecondary }]}>
                      Requirements:
                    </Text>

                    {/* Endorsement requirement */}
                    {business.businessInfo.endorsementEnabled && (
                      <View style={styles.requirementItem}>
                        <Star size={16} color={colors.text} strokeWidth={2} />
                        <Text style={[styles.requirementText, { color: colors.text }]}>
                          {business.businessInfo.endorsementType === 'any' && 'Endorse any value'}
                          {business.businessInfo.endorsementType === 'shared' && 'Endorse a shared value'}
                          {business.businessInfo.endorsementType === 'endorsed' && 'Endorse this business'}
                          {business.businessInfo.endorsementMinDays > 0 && ` for ${business.businessInfo.endorsementMinDays}+ days`}
                        </Text>
                      </View>
                    )}

                    {/* Following requirement */}
                    {business.businessInfo.followsEnabled && (
                      <View style={styles.requirementItem}>
                        <UserPlus size={16} color={colors.text} strokeWidth={2} />
                        <Text style={[styles.requirementText, { color: colors.text }]}>
                          Follow this business{business.businessInfo.followsMinDays > 0 && ` for ${business.businessInfo.followsMinDays}+ days`}
                        </Text>
                      </View>
                    )}

                    {/* Legacy requirements (backwards compatibility) */}
                    {!business.businessInfo.followsEnabled && business.businessInfo.requireFollow && (
                      <View style={styles.requirementItem}>
                        <UserPlus size={16} color={colors.text} strokeWidth={2} />
                        <Text style={[styles.requirementText, { color: colors.text }]}>
                          Must follow this business
                        </Text>
                      </View>
                    )}
                    {!business.businessInfo.endorsementEnabled && business.businessInfo.requireEndorse && (
                      <View style={styles.requirementItem}>
                        <List size={16} color={colors.text} strokeWidth={2} />
                        <Text style={[styles.requirementText, { color: colors.text }]}>
                          Must endorse this business
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : (
              <View style={[styles.discountCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.noDiscountText, { color: colors.textSecondary }]}>
                  This business has not enabled discounts yet. Check back later or endorse them to show your support!
                </Text>
              </View>
            )}
          </View>


          {/* Endorsements Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Endorsements</Text>

            <View style={[styles.endorsementsCard, { backgroundColor: colors.backgroundSecondary }]}>
              {loadingBusinessLists ? (
                <View style={styles.endorsementsLoading}>
                  <Text style={[styles.noDataText, { color: colors.textSecondary }]}>Loading...</Text>
                </View>
              ) : (() => {
                const endorsements = getEndorsements();

                if (endorsements.length === 0) {
                  // Check if this is the business owner viewing their own profile
                  const isOwnBusiness = clerkUser?.id === id;

                  if (isOwnBusiness) {
                    return (
                      <View style={styles.emptyEndorsementContainer}>
                        <View style={[styles.emptyEndorsementIconCircle, { backgroundColor: colors.primary + '20' }]}>
                          <Heart size={32} color={colors.primary} strokeWidth={2} />
                        </View>
                        <Text style={[styles.emptyEndorsementTitle, { color: colors.text }]}>
                          Build Your Endorsement List
                        </Text>
                        <View style={styles.emptyEndorsementSteps}>
                          <View style={styles.emptyEndorsementStep}>
                            <Search size={18} color={colors.primary} strokeWidth={2} />
                            <Text style={[styles.emptyEndorsementStepText, { color: colors.textSecondary }]}>
                              Search for businesses using the add button
                            </Text>
                          </View>
                          <View style={styles.emptyEndorsementStep}>
                            <BookOpen size={18} color={colors.primary} strokeWidth={2} />
                            <Text style={[styles.emptyEndorsementStepText, { color: colors.textSecondary }]}>
                              Browse our value-based recommendations
                            </Text>
                          </View>
                          <View style={styles.emptyEndorsementStep}>
                            <Compass size={18} color={colors.primary} strokeWidth={2} />
                            <Text style={[styles.emptyEndorsementStepText, { color: colors.textSecondary }]}>
                              Explore your friends' endorsement lists
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View style={styles.endorsementsLoading}>
                      <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                        No endorsements yet
                      </Text>
                    </View>
                  );
                }

                const visibleEndorsements = endorsements.slice(0, endorsementsVisibleCount);
                const hasMore = endorsements.length > endorsementsVisibleCount;
                const remainingCount = endorsements.length - endorsementsVisibleCount;

                return (
                  <View>
                    <View style={[styles.endorsementsHeader, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.endorsementsCount, { color: colors.text }]}>
                        {endorsements.length} {endorsements.length === 1 ? 'endorsement' : 'endorsements'}
                      </Text>
                    </View>

                    {visibleEndorsements.map((item, index) => {
                      // Look up actual logo from real data source
                      let realLogoUrl = item.logoUrl;
                      if (item.type === 'business') {
                        const fullBusiness = allBusinesses.find(b => b.id === item.id);
                        realLogoUrl = fullBusiness?.businessInfo?.logoUrl || item.logoUrl || (fullBusiness?.businessInfo?.website ? getLogoUrl(fullBusiness.businessInfo.website) : getLogoUrl(item.website || ''));
                      } else if (item.type === 'brand') {
                        const fullBrand = brands.find(b => b.id === item.id);
                        realLogoUrl = fullBrand?.exampleImageUrl || item.logoUrl || (fullBrand?.website ? getLogoUrl(fullBrand.website) : getLogoUrl(item.website || ''));
                      }

                      return (
                      <View
                        key={`${item.type}-${item.id}-${index}`}
                        style={[
                          styles.endorsementItem,
                          {
                            borderBottomColor: colors.border,
                            position: 'relative',
                            zIndex: endorsementActionMenuTarget?.id === item.id ? 1000 : 1
                          }
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.endorsementItemContent}
                          onPress={() => {
                            if (item.type === 'brand') {
                              router.push(`/brand/${item.id}`);
                            } else {
                              router.push(`/business/${item.id}`);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.endorsementLogo, { backgroundColor: '#FFFFFF' }]}>
                            <Image
                              source={{ uri: realLogoUrl || getLogoUrl('') }}
                              style={styles.endorsementLogoImage}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                          </View>
                          <View style={styles.endorsementInfo}>
                            <Text style={[styles.endorsementName, { color: colors.text }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={[styles.endorsementType, { color: colors.textSecondary }]}>
                              {item.type === 'brand' ? 'Brand' : 'Business'}
                            </Text>
                          </View>
                          <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.endorsementActionButton, { backgroundColor: colors.background }]}
                          onPress={() => setEndorsementActionMenuTarget(
                            endorsementActionMenuTarget?.id === item.id ? null : item
                          )}
                          activeOpacity={0.7}
                        >
                          <MoreVertical size={18} color={colors.text} strokeWidth={2} />
                        </TouchableOpacity>
                        {/* Inline Endorsement Action Dropdown */}
                        {endorsementActionMenuTarget?.id === item.id && (
                          <View style={[styles.endorsementActionDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                            <TouchableOpacity
                              style={styles.actionMenuDropdownItem}
                              onPress={async () => {
                                if (!library.state.endorsementList?.id || !clerkUser?.id) {
                                  Alert.alert('Error', 'Unable to endorse. Please make sure you are logged in.');
                                  setEndorsementActionMenuTarget(null);
                                  return;
                                }
                                try {
                                  if (item.type === 'brand') {
                                    await library.addEntry(library.state.endorsementList.id, {
                                      type: 'brand',
                                      brandId: item.id,
                                      brandName: item.name,
                                      website: '',
                                      logoUrl: '',
                                    });
                                  } else {
                                    await library.addEntry(library.state.endorsementList.id, {
                                      type: 'business',
                                      businessId: item.id,
                                      businessName: item.name,
                                      website: '',
                                      logoUrl: '',
                                    });
                                  }
                                  Alert.alert('Success', `${item.name} endorsed!`);
                                  await library.loadUserLists(clerkUser.id, true);
                                } catch (error: any) {
                                  Alert.alert('Error', error?.message || 'Failed to endorse');
                                }
                                setEndorsementActionMenuTarget(null);
                              }}
                              activeOpacity={0.7}
                            >
                              <UserPlus size={16} color={colors.text} strokeWidth={2} />
                              <Text style={[styles.actionMenuDropdownText, { color: colors.text }]}>Endorse</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionMenuDropdownItem}
                              onPress={async () => {
                                if (!clerkUser?.id) {
                                  Alert.alert('Error', 'You must be logged in to follow');
                                  setEndorsementActionMenuTarget(null);
                                  return;
                                }
                                try {
                                  const entityType = item.type === 'brand' ? 'brand' : 'business';
                                  await followEntity(clerkUser.id, item.id, entityType);
                                  Alert.alert('Success', `Now following ${item.name}`);
                                } catch (error: any) {
                                  Alert.alert('Error', error?.message || 'Failed to follow');
                                }
                                setEndorsementActionMenuTarget(null);
                              }}
                              activeOpacity={0.7}
                            >
                              <UserPlus size={16} color={colors.text} strokeWidth={2} />
                              <Text style={[styles.actionMenuDropdownText, { color: colors.text }]}>Follow</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionMenuDropdownItem}
                              onPress={async () => {
                                try {
                                  const targetType = item.type;
                                  const targetId = item.id;
                                  const message = `Check out ${item.name} on Endorse Money!`;
                                  const url = Platform.OS === 'web'
                                    ? `${window.location.origin}/${targetType}/${targetId}`
                                    : `iendorse://${targetType}/${targetId}`;
                                  await Share.share({
                                    message: `${message}\n${url}`,
                                    title: item.name,
                                  });
                                } catch (error) {
                                  console.error('Error sharing:', error);
                                }
                                setEndorsementActionMenuTarget(null);
                              }}
                              activeOpacity={0.7}
                            >
                              <Share2 size={16} color={colors.text} strokeWidth={2} />
                              <Text style={[styles.actionMenuDropdownText, { color: colors.text }]}>Share</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                    })}

                    {hasMore && (
                      <TouchableOpacity
                        style={[styles.showMoreButton, { borderColor: colors.border }]}
                        onPress={() => setEndorsementsVisibleCount(prev => prev + 10)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.showMoreText, { color: colors.primary }]}>
                          Show more ({remainingCount} remaining)
                        </Text>
                        <Plus size={16} color={colors.primary} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Money Flow</Text>

            {/* Ownership Section */}
            <View style={[styles.moneyFlowCard, { backgroundColor: colors.background, borderColor: colors.primary, marginBottom: 16 }]}>
              <View style={[styles.subsectionHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>Ownership</Text>
              </View>

              {business.businessInfo.ownership && business.businessInfo.ownership.length > 0 ? (
                <View style={styles.shareholdersContainer}>
                  {business.businessInfo.ownership.map((owner, index) => (
                    <View key={`owner-${index}`} style={[styles.shareholderItem, { borderBottomColor: colors.border }]}>
                      <View style={styles.tableRow}>
                        <Text style={[styles.affiliateName, { color: colors.text }]}>{owner.name}</Text>
                        <Text style={[styles.affiliateRelationship, { color: colors.textSecondary }]}>
                          {owner.relationship}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {business.businessInfo.ownershipSources && (
                    <View style={[styles.sourcesContainer, { borderTopColor: colors.border }]}>
                      <Text style={[styles.sourcesLabel, { color: colors.text }]}>Sources:</Text>
                      <Text style={[styles.sourcesText, { color: colors.textSecondary }]}>
                        {business.businessInfo.ownershipSources}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.shareholdersContainer}>
                  <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                    No ownership data available
                  </Text>
                </View>
              )}
            </View>

            {/* Affiliates Section */}
            <View style={[styles.moneyFlowCard, { backgroundColor: colors.background, borderColor: colors.primary, marginBottom: 16 }]}>
              <View style={[styles.subsectionHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>Affiliates</Text>
              </View>

              {business.businessInfo.affiliates && business.businessInfo.affiliates.length > 0 ? (
                <View style={styles.shareholdersContainer}>
                  {business.businessInfo.affiliates.map((affiliate, index) => (
                    <View key={`affiliate-${index}`} style={[styles.shareholderItem, { borderBottomColor: colors.border }]}>
                      <View style={styles.tableRow}>
                        <Text style={[styles.affiliateName, { color: colors.text }]}>{affiliate.name}</Text>
                        <Text style={[styles.affiliateRelationship, { color: colors.textSecondary }]}>
                          {affiliate.relationship}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.shareholdersContainer}>
                  <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                    No affiliates data available
                  </Text>
                </View>
              )}
            </View>

            {/* Partnerships Section */}
            <View style={[styles.moneyFlowCard, { backgroundColor: colors.background, borderColor: colors.primary }]}>
              <View style={[styles.subsectionHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>Partnerships</Text>
              </View>

              {business.businessInfo.partnerships && business.businessInfo.partnerships.length > 0 ? (
                <View style={styles.shareholdersContainer}>
                  {business.businessInfo.partnerships.map((partnership, index) => (
                    <View key={`partnership-${index}`} style={[styles.shareholderItem, { borderBottomColor: colors.border }]}>
                      <View style={styles.tableRow}>
                        <Text style={[styles.affiliateName, { color: colors.text }]}>{partnership.name}</Text>
                        <Text style={[styles.affiliateRelationship, { color: colors.textSecondary }]}>
                          {partnership.relationship}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.shareholdersContainer}>
                  <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                    No partnerships data available
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      </View>

      {/* Gallery Image Modal */}
      <Modal
        visible={selectedGalleryImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedGalleryImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setSelectedGalleryImage(null)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: colors.background }]}
                onPress={() => setSelectedGalleryImage(null)}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>

              {selectedGalleryImage && (
                <>
                  <Image
                    source={{ uri: selectedGalleryImage.imageUrl }}
                    style={styles.modalImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={200}
                    placeholder={{ blurhash: 'LGF5?xoffQj[~qoffQof?bofj[ay' }}
                  />
                  {selectedGalleryImage.caption ? (
                    <View style={[styles.modalCaptionContainer, { backgroundColor: colors.background }]}>
                      <Text style={[styles.modalCaptionText, { color: colors.text }]}>
                        {selectedGalleryImage.caption}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Add to List Modal */}
      <Modal
        visible={showAddToListModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddToListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowAddToListModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={[styles.quickAddModalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add to List</Text>
              <TouchableOpacity onPress={() => setShowAddToListModal(false)}>
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.listModalContent}>
              <Text style={[styles.quickAddItemName, { color: colors.primary }]}>
                {business?.businessInfo.name}
              </Text>

              <Text style={[styles.modalLabel, { color: colors.text, marginTop: 16 }]}>
                Select a list:
              </Text>

              {userLists.length === 0 ? (
                <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                  You don't have any lists yet. Create one on the Playbook tab!
                </Text>
              ) : (
                <View style={styles.quickAddListsContainer}>
                  {userLists.map((list) => (
                    <TouchableOpacity
                      key={list.id}
                      style={[styles.quickAddListItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                      onPress={() => handleAddToList(list.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.listIconContainer, { backgroundColor: colors.primary + '20' }]}>
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
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Followers Modal */}
      <Modal
        visible={showFollowersModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowFollowersModal(false)}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Followers</Text>
            <TouchableOpacity onPress={() => setShowFollowersModal(false)}>
              <X size={24} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, padding: 16 }}>
            {business?.id && (
              <FollowingFollowersList
                mode="followers"
                userId={business.id}
                entityType="business"
                isDarkMode={isDarkMode}
                userCauses={profile?.causes || []}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Following Modal */}
      <Modal
        visible={showFollowingModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowFollowingModal(false)}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Following</Text>
            <TouchableOpacity onPress={() => setShowFollowingModal(false)}>
              <X size={24} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, padding: 16 }}>
            {business?.id && (
              <FollowingFollowersList
                mode="following"
                userId={business.id}
                isDarkMode={isDarkMode}
                userCauses={profile?.causes || []}
              />
            )}
          </View>
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
  scrollView: {
    flex: 1,
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
  heroImageContainer: {
    width: '100%',
    height: 150,
    position: 'relative' as const,
  },
  heroImage: {
    width: '100%',
    height: 150,
  },
  visitButton: {
    position: 'absolute' as const,
    right: 16,
    bottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  visitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: Platform.OS === 'web' ? 8 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 12,
  },
  headerLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: '#FFFFFF',
  },
  titleContainer: {
    flex: 1,
    marginRight: 16,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700' as const,
    flex: 1,
  },
  scoreContainer: {
    alignItems: 'center',
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  category: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
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
    marginTop: 6,
  },
  locationText: {
    fontSize: 13,
  },
  socialLinksContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  brandDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  standDiscountSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  discountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  discountHeaderText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  discountCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  discountLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  discountValue: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  discountDivider: {
    height: 1,
    marginVertical: 12,
  },
  requirementsHeader: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  requirementText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  tierName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  tierDetails: {
    alignItems: 'flex-end',
  },
  tierPercent: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  tierMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  noDiscountText: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 8,
    lineHeight: 20,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  endorsementBadgeContainer: {
    alignItems: 'center',
  },
  endorsementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  endorsementBadgeText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  endorsementBadgeLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  actionMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuDropdown: {
    position: 'absolute',
    right: 0,
    top: 44,
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  actionMenuDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionMenuDropdownText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  endorsementActionDropdown: {
    position: 'absolute',
    right: 0,
    top: 44,
    minWidth: 140,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  alignmentCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  alignmentLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  alignmentLabel: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  alignmentDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 16,
  },
  moneyFlowCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
  },
  subsectionHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  shareholdersContainer: {},
  shareholderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sourcesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sourcesLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  sourcesText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  affiliateName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
    textAlign: 'center' as const,
  },
  affiliateRelationship: {
    fontSize: 13,
    flex: 1,
    textAlign: 'center' as const,
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 24,
  },
  valueTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  valueTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  valueTagText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  // Horizontal Gallery Styles
  galleryHorizontalScroll: {
    marginBottom: 16,
  },
  galleryHorizontalContent: {
    paddingHorizontal: 0,
    gap: 10,
  },
  galleryHorizontalCard: {
    width: 120,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
  },
  galleryHorizontalImage: {
    width: '100%',
    height: '100%',
  },
  // Action Buttons Row
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  // Legacy Gallery Styles (kept for modal)
  gallerySection: {
    marginTop: 16,
    marginBottom: 8,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  galleryCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryCardImage: {
    width: '100%',
    height: '100%',
  },
  galleryCaptionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  galleryCaptionText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: -50,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  modalCaptionContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalCaptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  quickAddModalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
    marginHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 50 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  listModalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quickAddItemName: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  emptyListText: {
    fontSize: 14,
    textAlign: 'center' as const,
    padding: 20,
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
  listIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    color: '#666',
  },
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionMenuContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionMenuItemText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  followCountsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  followCountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  followCountNumber: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  followCountLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  // Endorsements section styles
  endorsementsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  endorsementsLoading: {
    padding: 24,
  },
  // Empty endorsement explainer styles
  emptyEndorsementContainer: {
    padding: 32,
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
    fontSize: 18,
    fontWeight: '600' as const,
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
    fontSize: 14,
    fontWeight: '500' as const,
  },
  endorsementsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  endorsementsCount: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  endorsementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  endorsementItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  endorsementLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
  },
  endorsementLogoImage: {
    width: '100%',
    height: '100%',
  },
  endorsementInfo: {
    flex: 1,
    gap: 2,
  },
  endorsementName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  endorsementType: {
    fontSize: 12,
  },
  endorsementActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
