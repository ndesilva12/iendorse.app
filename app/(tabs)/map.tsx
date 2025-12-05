import { useRouter } from 'expo-router';
import { MapPin, Filter, X, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
// Only import react-native-maps on native platforms
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}
import * as Location from 'expo-location';
import MenuButton from '@/components/MenuButton';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { getAllUserBusinesses, BusinessUser } from '@/services/firebase/businessService';
import { getEndorsementList } from '@/services/firebase/listService';
import { getLogoUrl } from '@/lib/logo';
import { ListEntry, BrandListEntry, BusinessListEntry, PlaceListEntry } from '@/types/library';

// Categories for filtering
const CATEGORIES = [
  { id: 'all', label: 'All', color: '#3B82F6' },
  { id: 'technology', label: 'Technology', color: '#3B82F6' },
  { id: 'retail', label: 'Retail', color: '#10B981' },
  { id: 'food_beverage', label: 'Food & Beverage', color: '#F59E0B' },
  { id: 'food', label: 'Food', color: '#F59E0B' },
  { id: 'restaurant', label: 'Restaurant', color: '#F59E0B' },
  { id: 'finance', label: 'Finance', color: '#6366F1' },
  { id: 'automotive', label: 'Automotive', color: '#EF4444' },
  { id: 'entertainment', label: 'Entertainment', color: '#EC4899' },
  { id: 'health_wellness', label: 'Health & Wellness', color: '#14B8A6' },
  { id: 'health', label: 'Health', color: '#14B8A6' },
  { id: 'fashion', label: 'Fashion', color: '#8B5CF6' },
  { id: 'travel', label: 'Travel', color: '#06B6D4' },
  { id: 'services', label: 'Services', color: '#6B7280' },
  { id: 'other', label: 'Other', color: '#6B7280' },
];

// Map marker data interface
interface MapMarker {
  id: string;
  type: 'business' | 'brand' | 'place';
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  logoUrl?: string;
  address?: string;
  distance?: number;
  isLocal?: boolean;
}

// Muted map style
const mutedMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#424242" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#ffffff" }, { "weight": 2 }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#d0d0d0" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#f5e6d3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
];

// Calculate distance between two coordinates in miles
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapScreen() {
  const router = useRouter();
  const { profile, isDarkMode, clerkUser } = useUser();
  const { brands } = useData();
  const library = useLibrary();
  const colors = isDarkMode ? darkColors : lightColors;
  const { width, height } = useWindowDimensions();

  const isTabletOrLarger = Platform.OS === 'web' && width >= 768;

  // State
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [endorsementList, setEndorsementList] = useState<ListEntry[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<BusinessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'endorsements' | 'local'>('endorsements');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showMarkersList, setShowMarkersList] = useState(false);

  // Fetch user location
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('[Map] Error getting location:', error);
      } finally {
        setLoadingLocation(false);
      }
    };
    getLocation();
  }, []);

  // Fetch endorsement list and businesses
  useEffect(() => {
    const fetchData = async () => {
      if (!clerkUser?.id) return;

      setLoading(true);
      try {
        // Fetch endorsement list
        const list = await getEndorsementList(clerkUser.id);
        if (list) {
          setEndorsementList(list.entries || []);
        }

        // Fetch all businesses
        const businesses = await getAllUserBusinesses();
        setAllBusinesses(businesses);
      } catch (error) {
        console.error('[Map] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clerkUser?.id]);

  // Convert endorsement list entries to map markers
  const mapMarkers = useMemo(() => {
    const markers: MapMarker[] = [];

    // Process all endorsement list entries
    endorsementList.forEach((entry) => {
      let marker: MapMarker | null = null;

      if (entry.type === 'business') {
        const businessEntry = entry as BusinessListEntry;
        const business = allBusinesses.find(b => b.id === businessEntry.businessId);

        if (business && business.businessInfo.latitude && business.businessInfo.longitude) {
          const distance = userLocation
            ? calculateDistance(userLocation.latitude, userLocation.longitude, business.businessInfo.latitude, business.businessInfo.longitude)
            : undefined;

          marker = {
            id: business.id,
            type: 'business',
            name: businessEntry.businessName || business.businessInfo.name,
            category: business.businessInfo.category || 'other',
            latitude: business.businessInfo.latitude,
            longitude: business.businessInfo.longitude,
            logoUrl: business.businessInfo.logoUrl || (business.businessInfo.website ? getLogoUrl(business.businessInfo.website) : undefined),
            address: business.businessInfo.location,
            distance,
            isLocal: distance ? distance <= 50 : false,
          };
        }
      } else if (entry.type === 'brand') {
        const brandEntry = entry as BrandListEntry;
        const brand = brands.find(b => b.id === brandEntry.brandId);

        if (brand && brand.latitude && brand.longitude) {
          const distance = userLocation
            ? calculateDistance(userLocation.latitude, userLocation.longitude, brand.latitude, brand.longitude)
            : undefined;

          marker = {
            id: brand.id,
            type: 'brand',
            name: brandEntry.brandName || brand.name,
            category: brand.category || 'other',
            latitude: brand.latitude,
            longitude: brand.longitude,
            logoUrl: brand.exampleImageUrl || (brand.website ? getLogoUrl(brand.website) : undefined),
            address: brand.location,
            distance,
            isLocal: distance ? distance <= 50 : false,
          };
        }
      } else if (entry.type === 'place') {
        const placeEntry = entry as PlaceListEntry;

        // Place entries have location directly in the entry
        if (placeEntry.location?.lat && placeEntry.location?.lng) {
          const distance = userLocation
            ? calculateDistance(userLocation.latitude, userLocation.longitude, placeEntry.location.lat, placeEntry.location.lng)
            : undefined;

          marker = {
            id: placeEntry.placeId,
            type: 'place',
            name: placeEntry.placeName,
            category: placeEntry.category || 'other',
            latitude: placeEntry.location.lat,
            longitude: placeEntry.location.lng,
            logoUrl: placeEntry.imageUrl,
            address: placeEntry.address,
            distance,
            isLocal: distance ? distance <= 50 : false,
          };
        }
      }

      if (marker) {
        markers.push(marker);
      }
    });

    // Apply filter
    let filteredMarkers = markers;

    // Local filter: only show markers within 50 miles
    if (activeFilter === 'local') {
      filteredMarkers = markers.filter(m => m.isLocal === true);
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filteredMarkers = filteredMarkers.filter(m =>
        m.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        selectedCategory.toLowerCase().includes(m.category.toLowerCase())
      );
    }

    return filteredMarkers;
  }, [endorsementList, allBusinesses, brands, activeFilter, selectedCategory, userLocation]);

  // Get unique categories from markers
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    mapMarkers.forEach(m => {
      if (m.category) {
        cats.add(m.category.toLowerCase());
      }
    });
    return ['all', ...Array.from(cats)];
  }, [mapMarkers]);

  // Calculate map region
  const mapRegion = useMemo(() => {
    if (mapMarkers.length > 0) {
      const lats = mapMarkers.map(m => m.latitude);
      const lngs = mapMarkers.map(m => m.longitude);

      if (userLocation) {
        lats.push(userLocation.latitude);
        lngs.push(userLocation.longitude);
      }

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const latDelta = Math.max((maxLat - minLat) * 1.5, 0.05);
      const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.05);

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      };
    }

    // Default to user location or SF
    return {
      latitude: userLocation?.latitude || 37.7749,
      longitude: userLocation?.longitude || -122.4194,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }, [mapMarkers, userLocation]);

  const handleMarkerPress = (marker: MapMarker) => {
    setSelectedMarker(marker);
  };

  const handleViewDetails = () => {
    if (!selectedMarker) return;

    if (selectedMarker.type === 'business') {
      router.push(`/business/${selectedMarker.id}`);
    } else if (selectedMarker.type === 'brand') {
      router.push(`/brand/${selectedMarker.id}`);
    } else if (selectedMarker.type === 'place') {
      router.push(`/place/${selectedMarker.id}`);
    }
    setSelectedMarker(null);
  };

  // Render header
  const renderHeader = () => (
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
  );

  // Render filters
  const renderFilters = () => (
    <View style={[styles.filtersContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollRow}
        contentContainerStyle={styles.filterScrollContent}
      >
        {/* Main filter buttons */}
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'endorsements' && styles.filterButtonActive,
            { borderColor: activeFilter === 'endorsements' ? colors.primary : colors.border }
          ]}
          onPress={() => setActiveFilter('endorsements')}
        >
          <Text style={[
            styles.filterButtonText,
            { color: activeFilter === 'endorsements' ? colors.primary : colors.text }
          ]}>
            Endorsements
          </Text>
          {activeFilter === 'endorsements' && (
            <View style={[styles.filterCount, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterCountText}>{mapMarkers.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'local' && styles.filterButtonActive,
            { borderColor: activeFilter === 'local' ? colors.primary : colors.border }
          ]}
          onPress={() => setActiveFilter('local')}
        >
          <Text style={[
            styles.filterButtonText,
            { color: activeFilter === 'local' ? colors.primary : colors.text }
          ]}>
            Local (50mi)
          </Text>
          {activeFilter === 'local' && (
            <View style={[styles.filterCount, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterCountText}>{mapMarkers.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Separator */}
        <View style={[styles.filterSeparator, { backgroundColor: colors.border }]} />

        {/* Category filter chips in same row */}
        {CATEGORIES.filter(cat => availableCategories.includes(cat.id) || cat.id === 'all').map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color },
              { borderColor: selectedCategory === cat.id ? cat.color : colors.border }
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            {selectedCategory === cat.id && (
              <Check size={14} color={cat.color} strokeWidth={2.5} />
            )}
            <Text style={[
              styles.categoryChipText,
              { color: selectedCategory === cat.id ? cat.color : colors.text }
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Collapsible markers list for web */}
      {Platform.OS === 'web' && mapMarkers.length > 0 && (
        <TouchableOpacity
          style={[styles.markersListToggle, { borderTopColor: colors.border }]}
          onPress={() => setShowMarkersList(!showMarkersList)}
        >
          <Text style={[styles.markersListToggleText, { color: colors.text }]}>
            {mapMarkers.length} Location{mapMarkers.length !== 1 ? 's' : ''}
          </Text>
          {showMarkersList ? (
            <ChevronUp size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      )}

      {/* Expanded markers list for web */}
      {Platform.OS === 'web' && showMarkersList && mapMarkers.length > 0 && (
        <ScrollView
          style={[styles.markersListExpanded, { borderTopColor: colors.border }]}
          showsVerticalScrollIndicator={true}
        >
          {mapMarkers.slice(0, 20).map((marker) => (
            <TouchableOpacity
              key={marker.id}
              style={[styles.markerListItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                if (marker.type === 'business') {
                  router.push(`/business/${marker.id}`);
                } else if (marker.type === 'brand') {
                  router.push(`/brand/${marker.id}`);
                } else if (marker.type === 'place') {
                  router.push(`/place/${marker.id}`);
                }
              }}
            >
              <View style={[styles.markerListLogo, { backgroundColor: '#FFFFFF' }]}>
                {marker.logoUrl ? (
                  <Image
                    source={{ uri: marker.logoUrl }}
                    style={styles.markerListLogoImage}
                    contentFit="cover"
                  />
                ) : (
                  <MapPin size={16} color={colors.primary} />
                )}
              </View>
              <View style={styles.markerListInfo}>
                <Text style={[styles.markerListName, { color: colors.text }]} numberOfLines={1}>
                  {marker.name}
                </Text>
                <Text style={[styles.markerListCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                  {marker.category}{marker.distance ? ` • ${marker.distance.toFixed(1)} mi` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {mapMarkers.length > 20 && (
            <Text style={[styles.markersListMore, { color: colors.textSecondary }]}>
              +{mapMarkers.length - 20} more locations
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );

  // Render map
  const renderMap = () => {
    if (loading || loadingLocation) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading map...
          </Text>
        </View>
      );
    }

    if (Platform.OS === 'web') {
      // For web, use an iframe with OpenStreetMap
      const centerLat = mapRegion.latitude;
      const centerLng = mapRegion.longitude;
      const zoom = 12;

      return (
        <View style={styles.mapContainer}>
          <iframe
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.1},${centerLat - 0.1},${centerLng + 0.1},${centerLat + 0.1}&layer=mapnik&marker=${centerLat},${centerLng}`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </View>
      );
    }

    // Native map using react-native-maps
    return (
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapRegion}
          provider={PROVIDER_GOOGLE}
          customMapStyle={mutedMapStyle}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {/* User location marker */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.userMarker}>
                <MapPin size={32} color="#3B82F6" fill="#3B82F6" strokeWidth={1.5} />
              </View>
            </Marker>
          )}

          {/* Local radius circle */}
          {activeFilter === 'local' && userLocation && (
            <Circle
              center={userLocation}
              radius={50 * 1609.34} // 50 miles in meters
              strokeColor="rgba(59, 130, 246, 0.5)"
              fillColor="rgba(59, 130, 246, 0.1)"
              strokeWidth={2}
            />
          )}

          {/* Business/Brand markers */}
          {mapMarkers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => handleMarkerPress(marker)}
            >
              <View style={styles.businessMarker}>
                <MapPin size={28} color="#22C55E" fill="#22C55E" strokeWidth={1.5} />
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Selected marker details */}
        {selectedMarker && (
          <View style={styles.selectionContainer}>
            <View style={styles.selectionCard}>
              <View style={styles.selectionHeader}>
                <View style={styles.selectionHeaderLeft}>
                  <Text style={styles.businessName}>{selectedMarker.name}</Text>
                  <Text style={styles.businessCategory}>{selectedMarker.category}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedMarker(null)}
                >
                  <X size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.selectionBody}>
                {selectedMarker.address && (
                  <View style={styles.addressContainer}>
                    <MapPin size={14} color="#6B7280" strokeWidth={2} />
                    <Text style={styles.addressText}>{selectedMarker.address}</Text>
                  </View>
                )}

                {selectedMarker.distance !== undefined && (
                  <Text style={styles.distanceText}>
                    {selectedMarker.distance < 1
                      ? `${(selectedMarker.distance * 5280).toFixed(0)} ft away`
                      : `${selectedMarker.distance.toFixed(1)} mi away`}
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={handleViewDetails}
                >
                  <Text style={styles.viewDetailsButtonText}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Empty state
  const renderEmptyState = () => {
    if (loading) return null;

    if (mapMarkers.length === 0) {
      return (
        <View style={[styles.emptyOverlay, { backgroundColor: colors.background + 'DD' }]}>
          <MapPin size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {activeFilter === 'endorsements' ? 'No Endorsed Locations' : 'No Local Businesses'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {activeFilter === 'endorsements'
              ? 'Add businesses with locations to your endorsement list to see them on the map.'
              : 'No businesses found within 50 miles of your location.'}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {renderHeader()}
      {renderFilters()}

      <View style={[
        styles.mapWrapper,
        isTabletOrLarger && styles.mapWrapperDesktop
      ]}>
        {renderMap()}
        {renderEmptyState()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  filtersContainer: {
    borderBottomWidth: 1,
  },
  filterScrollRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterScrollContent: {
    alignItems: 'center',
    gap: 8,
  },
  filterSeparator: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  markersListToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  markersListToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  markersListExpanded: {
    maxHeight: 250,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  markerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  markerListLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markerListLogoImage: {
    width: '100%',
    height: '100%',
  },
  markerListInfo: {
    flex: 1,
  },
  markerListName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  markerListCategory: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  markersListMore: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 4,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  mapWrapper: {
    flex: 1,
  },
  mapWrapperDesktop: {
    // On desktop, map already fills the 50% content area from _layout.tsx
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  userMarker: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
  },
  selectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectionHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBody: {
    padding: 16,
    gap: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  distanceText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  viewDetailsButton: {
    backgroundColor: '#00aaff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  viewDetailsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyOverlay: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
