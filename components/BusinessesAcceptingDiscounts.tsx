import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Search, MapPin, AlertCircle, ChevronDown, Map as MapIcon, X, Percent } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { getBusinessesAcceptingDiscounts, calculateDistance, calculateAlignmentScore, normalizeScores, BusinessUser } from '@/services/firebase/businessService';
import { getLogoUrl, getBusinessLogoUrl } from '@/lib/logo';
import BusinessMapView from './BusinessMapView';

type LocalDistanceOption = 1 | 5 | 10 | 25 | 50 | 100;

export default function BusinessesAcceptingDiscounts() {
  const router = useRouter();
  const { isDarkMode, profile } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  const [businesses, setBusinesses] = useState<BusinessUser[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<BusinessUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<LocalDistanceOption>(100);
  const [showDistanceMenu, setShowDistanceMenu] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAllBusinesses, setShowAllBusinesses] = useState(false);
  const INITIAL_DISPLAY_COUNT = 10;

  // Request GPS location permission and get current location
  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    try {
      console.log('[BusinessesAcceptingDiscounts] Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[BusinessesAcceptingDiscounts] ❌ Location permission denied');
        Alert.alert(
          'Location Required',
          'Location access is needed to show nearby businesses.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('[BusinessesAcceptingDiscounts] ✅ Permission granted, getting location...');
      const location = await Location.getCurrentPositionAsync({});
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(newLocation);
      console.log('[BusinessesAcceptingDiscounts] ✅ Got GPS location:', newLocation);
    } catch (error) {
      console.error('[BusinessesAcceptingDiscounts] ❌ Error getting location:', error);
      Alert.alert(
        'Location Error',
        'Failed to get your location. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Fetch businesses from Firebase (once on mount)
  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      setIsLoading(true);
      const fetchedBusinesses = await getBusinessesAcceptingDiscounts();
      setBusinesses(fetchedBusinesses);
    } catch (error) {
      console.error('[BusinessesAcceptingDiscounts] Error loading businesses:', error);
      Alert.alert('Error', 'Failed to load businesses. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply distance calculation, alignment scoring, filtering, and sorting
  useEffect(() => {
    console.log('[BusinessesAcceptingDiscounts] Processing businesses:', {
      totalBusinesses: businesses.length,
      hasLocation: !!userLocation,
      userLocation,
      userCausesCount: profile.causes?.length || 0,
      distanceFilter,
    });

    if (businesses.length === 0) {
      setFilteredBusinesses([]);
      return;
    }

    // Create new array to avoid mutating original
    let processed = businesses.map((business) => {
      const newBusiness = { ...business };

      // Calculate distance if location available
      if (userLocation && business.businessInfo.latitude && business.businessInfo.longitude) {
        newBusiness.distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          business.businessInfo.latitude,
          business.businessInfo.longitude
        );
      }

      // Calculate alignment score if user has causes
      if (profile.causes && profile.causes.length > 0) {
        const rawScore = calculateAlignmentScore(profile.causes, business.causes || []);
        newBusiness.alignmentScore = rawScore;
      }

      return newBusiness;
    });

    console.log('[BusinessesAcceptingDiscounts] Sample processed business:', {
      name: processed[0]?.businessInfo.name,
      distance: processed[0]?.distance,
      alignmentScore: processed[0]?.alignmentScore,
    });

    // Normalize alignment scores if we have them
    if (processed.some(b => b.alignmentScore !== undefined)) {
      const rawScores = processed.map(b => b.alignmentScore || 50);
      const normalizedScores = normalizeScores(rawScores);
      processed = processed.map((business, index) => ({
        ...business,
        alignmentScore: normalizedScores[index],
      }));
      console.log('[BusinessesAcceptingDiscounts] Normalized sample score:', processed[0]?.alignmentScore);
    }

    // Filter by distance if location is available
    if (userLocation) {
      const beforeFilter = processed.length;
      processed = processed.filter((business) => {
        // Check for undefined/null, not falsy (since 0 is a valid distance)
        if (business.distance === undefined || business.distance === null) return false;
        return business.distance <= distanceFilter;
      });
      console.log('[BusinessesAcceptingDiscounts] Distance filtering:', {
        beforeFilter,
        afterFilter: processed.length,
        distanceFilter,
        sampleDistance: processed[0]?.distance,
      });

      // Sort by distance (businesses with location first)
      processed.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        if (a.distance !== undefined) return -1;
        if (b.distance !== undefined) return 1;
        return 0;
      });
    } else {
      console.log('[BusinessesAcceptingDiscounts] No location, showing all businesses');
      // Random sort if no location
      processed.sort(() => Math.random() - 0.5);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      processed = processed.filter((business) => {
        const name = business.businessInfo.name.toLowerCase();
        const category = business.businessInfo.category?.toLowerCase() || '';
        const location = business.businessInfo.location?.toLowerCase() || '';

        return name.includes(query) || category.includes(query) || location.includes(query);
      });
    }

    console.log('[BusinessesAcceptingDiscounts] ✅ Final filtered businesses:', processed.length);
    setFilteredBusinesses(processed);
  }, [userLocation, businesses, distanceFilter, searchQuery, profile.causes]);

  const handleEnableLocation = () => {
    Alert.alert(
      'Enable Location',
      'To see businesses sorted by distance, please enable location permissions.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', onPress: requestLocation }
      ]
    );
  };

  // Helper to get discount requirements summary
  const getRequirementsSummary = (info: any): string[] => {
    const requirements: string[] = [];

    if (info.endorsementEnabled) {
      let req = '';
      if (info.endorsementType === 'any') req = 'Endorse any value';
      else if (info.endorsementType === 'shared') req = 'Shared value';
      else if (info.endorsementType === 'endorsed') req = 'Endorse business';
      if (info.endorsementMinDays > 0) req += ` ${info.endorsementMinDays}+ days`;
      requirements.push(req);
    }

    if (info.followsEnabled) {
      let req = 'Follow';
      if (info.followsMinDays > 0) req += ` ${info.followsMinDays}+ days`;
      requirements.push(req);
    }

    return requirements;
  };

  // Helper to format discount tiers for display
  const formatDiscountTiers = (businessInfo: any): { percent: number; label: string }[] => {
    const tiers: { percent: number; label: string }[] = [];

    // Base endorsement discount (tier 1)
    const baseDiscount = businessInfo.customerDiscountPercent || businessInfo.valueCodeDiscount || 0;
    if (baseDiscount > 0) {
      const minDays = businessInfo.endorsementMinDays || 0;
      const rankType = businessInfo.endorsementType || 'endorsed';
      let label = 'Endorsement';
      if (rankType === 'top5') label = 'Top 5';
      else if (rankType === 'top10') label = 'Top 10';
      if (minDays > 0) label += ` ${minDays}d+`;
      tiers.push({ percent: baseDiscount, label });
    }

    // Tier 2 if exists
    if (businessInfo.tier2Discount && businessInfo.tier2Discount > 0) {
      const minDays = businessInfo.tier2MinDays || 0;
      const rankType = businessInfo.tier2Type || 'endorsed';
      let label = 'Tier 2';
      if (rankType === 'top5') label = 'Top 5';
      else if (rankType === 'top10') label = 'Top 10';
      if (minDays > 0) label += ` ${minDays}d+`;
      tiers.push({ percent: businessInfo.tier2Discount, label });
    }

    // Tier 3 if exists
    if (businessInfo.tier3Discount && businessInfo.tier3Discount > 0) {
      const minDays = businessInfo.tier3MinDays || 0;
      const rankType = businessInfo.tier3Type || 'endorsed';
      let label = 'Tier 3';
      if (rankType === 'top5') label = 'Top 5';
      else if (rankType === 'top10') label = 'Top 10';
      if (minDays > 0) label += ` ${minDays}d+`;
      tiers.push({ percent: businessInfo.tier3Discount, label });
    }

    // Custom discount
    if (businessInfo.customDiscount && businessInfo.customDiscount.trim()) {
      let label = businessInfo.customDiscount;
      if (businessInfo.customDiscountType) {
        if (businessInfo.customDiscountType === 'top5') label += ' (Top 5)';
        else if (businessInfo.customDiscountType === 'top10') label += ' (Top 10)';
      }
      if (businessInfo.customDiscountMinDays && businessInfo.customDiscountMinDays > 0) {
        label += ` ${businessInfo.customDiscountMinDays}d+`;
      }
      tiers.push({ percent: 0, label }); // 0 indicates custom (not percentage)
    }

    return tiers;
  };

  const renderBusinessCard = ({ item }: { item: BusinessUser }) => {
    const { businessInfo, distance } = item;

    // Get logo URL (avoids unreliable Google Places photos)
    const logoUrl = getBusinessLogoUrl(businessInfo.logoUrl, businessInfo.website);

    // Get discount tiers
    const discountTiers = formatDiscountTiers(businessInfo);
    const mainDiscount = discountTiers.length > 0 ? discountTiers[0].percent : 0;

    return (
      <TouchableOpacity
        style={[styles.businessCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => router.push(`/business/${item.id}`)}
      >
        <View style={styles.businessCardRow}>
          {/* Logo on left */}
          <View style={[styles.businessLogo, { backgroundColor: '#FFFFFF' }]}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.businessLogoImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.businessLogoPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.businessLogoPlaceholderText}>
                  {businessInfo.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Info in middle */}
          <View style={styles.businessInfo}>
            <Text style={[styles.businessName, { color: colors.text }]} numberOfLines={1}>
              {businessInfo.name}
            </Text>
            <Text style={[styles.businessMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {businessInfo.location || businessInfo.category}
              {distance !== undefined && ` • ${distance.toFixed(1)} mi`}
            </Text>
          </View>

          {/* Discount badge on right */}
          <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.discountBadgeText}>
              {mainDiscount > 0 ? `${mainDiscount}%` : 'Deal'}
            </Text>
          </View>
        </View>

        {/* Discount tiers row - compact display */}
        {discountTiers.length > 1 && (
          <View style={[styles.tiersRow, { borderTopColor: colors.border }]}>
            {discountTiers.map((tier, index) => (
              <View key={index} style={styles.tierItem}>
                <Text style={[styles.tierPercent, { color: tier.percent > 0 ? colors.primary : colors.text }]}>
                  {tier.percent > 0 ? `${tier.percent}%` : ''}
                </Text>
                <Text style={[styles.tierLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {tier.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Businesses Accepting Endorse</Text>
        <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading businesses...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Businesses Accepting Endorse Discounts</Text>

      {/* Search Bar with Location Icon */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <Search size={20} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search businesses..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {!userLocation && (
          <TouchableOpacity onPress={handleEnableLocation} activeOpacity={0.7} style={styles.locationIconButton}>
            <MapPin size={20} color={colors.primary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Distance Filter and Map Button */}
      {userLocation && (
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.distanceButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => setShowDistanceMenu(true)}
            activeOpacity={0.7}
          >
            <MapPin size={16} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.distanceButtonText, { color: colors.text }]}>
              {distanceFilter} mile{distanceFilter !== 1 ? 's' : ''}
            </Text>
            <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mapButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowMapModal(true)}
            activeOpacity={0.7}
          >
            <MapIcon size={16} color={colors.white} strokeWidth={2} />
            <Text style={[styles.mapButtonText, { color: colors.white }]}>Map</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Business List */}
      {filteredBusinesses.length > 0 ? (
        <>
          <View style={styles.listContainer}>
            {(showAllBusinesses ? filteredBusinesses : filteredBusinesses.slice(0, INITIAL_DISPLAY_COUNT)).map((item) => (
              <View key={item.id}>
                {renderBusinessCard({ item })}
              </View>
            ))}
          </View>
          {!showAllBusinesses && filteredBusinesses.length > INITIAL_DISPLAY_COUNT && (
            <TouchableOpacity
              style={[styles.seeMoreButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={() => setShowAllBusinesses(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.seeMoreText, { color: colors.primary }]}>
                See More ({filteredBusinesses.length - INITIAL_DISPLAY_COUNT} more)
              </Text>
              <ChevronDown size={20} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={[styles.emptyContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <AlertCircle size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {searchQuery ? 'No businesses found matching your search' : 'No businesses accepting Endorse discounts yet'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            {searchQuery ? 'Try a different search term' : 'Check back soon as more businesses join!'}
          </Text>
        </View>
      )}

      {/* Distance Filter Menu Modal */}
      <Modal
        visible={showDistanceMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDistanceMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowDistanceMenu(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Distance Filter</Text>
            {([1, 5, 10, 25, 50, 100] as LocalDistanceOption[]).map((distance) => (
              <TouchableOpacity
                key={distance}
                style={[
                  styles.menuItem,
                  { borderBottomColor: colors.border },
                  distanceFilter === distance && { backgroundColor: colors.backgroundSecondary }
                ]}
                onPress={() => {
                  setDistanceFilter(distance);
                  setShowDistanceMenu(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.menuItemText,
                  { color: distanceFilter === distance ? colors.primary : colors.text }
                ]}>
                  {distance} mile{distance !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.mapModalContainer, { backgroundColor: colors.background }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.mapModalHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <Text style={[styles.mapModalTitle, { color: colors.text }]}>
                Businesses ({distanceFilter} mile{distanceFilter !== 1 ? 's' : ''})
              </Text>
              <TouchableOpacity
                style={[styles.mapModalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowMapModal(false)}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.mapModalContent}>
              {userLocation && filteredBusinesses.length > 0 ? (
                <BusinessMapView
                  businesses={filteredBusinesses.map(business => ({
                    business,
                    alignmentScore: business.alignmentScore || 50, // Use calculated score or default
                    distance: business.distance,
                  }))}
                  userLocation={userLocation}
                  distanceRadius={distanceFilter}
                  onBusinessPress={(businessId) => {
                    setShowMapModal(false);
                    router.push(`/business/${businessId}`);
                  }}
                  isBusinessAccount={profile?.accountType === 'business'}
                />
              ) : (
                <View style={styles.mapModalEmpty}>
                  <MapPin size={48} color={colors.textSecondary} strokeWidth={1.5} />
                  <Text style={[styles.mapModalEmptyText, { color: colors.text }]}>
                    No businesses found in this area
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
  },
  locationIconButton: {
    padding: 4,
    marginLeft: 8,
  },
  listContainer: {
    gap: 8,
  },
  businessCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  businessCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  businessLogoImage: {
    width: '100%',
    height: '100%',
  },
  businessLogoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessLogoPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  businessInfo: {
    flex: 1,
    marginRight: 12,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  businessMeta: {
    fontSize: 13,
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  tiersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  tierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tierPercent: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  tierLabel: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  distanceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  distanceButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuContainer: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mapModalContainer: {
    width: '95%',
    height: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 100,
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
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  seeMoreText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
