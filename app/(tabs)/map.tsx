import { useRouter } from 'expo-router';
import { MapPin, Filter, X, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const [mapReady, setMapReady] = useState(false);

  // Refs for map state management
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const mapInitializedRef = useRef(false);
  const hasUserChangedFilterRef = useRef(false);
  const previousFilterRef = useRef<'endorsements' | 'local'>('endorsements');

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

  // Get endorsement list from library context (same as home tab)
  useEffect(() => {
    const loadData = async () => {
      if (!clerkUser?.id) return;

      setLoading(true);
      try {
        // Get endorsement list from library context
        const endorsementListData = library.state.userLists?.find(list => list.isEndorsed);
        if (endorsementListData?.entries) {
          console.log('[Map] Found endorsement list with', endorsementListData.entries.length, 'entries');
          setEndorsementList(endorsementListData.entries);
        } else {
          console.log('[Map] No endorsement list found, trying direct fetch');
          // Fallback to direct fetch
          const list = await getEndorsementList(clerkUser.id);
          if (list) {
            console.log('[Map] Direct fetch found', list.entries?.length || 0, 'entries');
            setEndorsementList(list.entries || []);
          }
        }

        // Fetch all businesses for location data
        const businesses = await getAllUserBusinesses();
        console.log('[Map] Found', businesses.length, 'businesses');
        setAllBusinesses(businesses);
      } catch (error) {
        console.error('[Map] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clerkUser?.id, library.state.userLists]);

  // Convert endorsement list entries to map markers (without category filter)
  const allMarkers = useMemo(() => {
    const markers: MapMarker[] = [];
    let placeCount = 0;
    let businessCount = 0;
    let brandCount = 0;
    let noLocationCount = 0;

    console.log('[Map] Processing', endorsementList.length, 'endorsement entries');

    // Process all endorsement list entries
    endorsementList.forEach((entry) => {
      let marker: MapMarker | null = null;

      if (entry.type === 'business') {
        businessCount++;
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
            isLocal: distance ? distance <= 25 : false,
          };
        }
      } else if (entry.type === 'brand') {
        brandCount++;
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
            isLocal: distance ? distance <= 25 : false,
          };
        }
      } else if (entry.type === 'place') {
        placeCount++;
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
            isLocal: distance ? distance <= 25 : false,
          };
        }
      }

      if (marker) {
        markers.push(marker);
      } else {
        noLocationCount++;
      }
    });

    console.log('[Map] Entry breakdown: places:', placeCount, 'businesses:', businessCount, 'brands:', brandCount);
    console.log('[Map] Markers created:', markers.length, 'No location:', noLocationCount);

    return markers;
  }, [endorsementList, allBusinesses, brands, userLocation]);

  // Get unique categories from ALL markers (before filtering)
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allMarkers.forEach(m => {
      if (m.category) {
        cats.add(m.category.toLowerCase());
      }
    });
    return ['all', ...Array.from(cats)];
  }, [allMarkers]);

  // Apply filters to get displayed markers
  const mapMarkers = useMemo(() => {
    let filteredMarkers = allMarkers;

    // Local filter: only show markers within 25 miles
    if (activeFilter === 'local') {
      filteredMarkers = filteredMarkers.filter(m => m.isLocal === true);
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filteredMarkers = filteredMarkers.filter(m =>
        m.category.toLowerCase() === selectedCategory.toLowerCase() ||
        m.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        selectedCategory.toLowerCase().includes(m.category.toLowerCase())
      );
    }

    return filteredMarkers;
  }, [allMarkers, activeFilter, selectedCategory]);

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
            Local (25mi)
          </Text>
          {activeFilter === 'local' && (
            <View style={[styles.filterCount, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterCountText}>{mapMarkers.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Separator */}
        <View style={[styles.filterSeparator, { backgroundColor: colors.border }]} />

        {/* Category filter chips in same row - always show all categories */}
        {CATEGORIES.map((cat) => (
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

  // Initialize Leaflet map for web (only once)
  useEffect(() => {
    if (Platform.OS !== 'web' || loading || loadingLocation || mapInitializedRef.current) return;

    // Load Leaflet CSS
    if (!document.querySelector('link[data-leaflet-map-css]')) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      link.setAttribute('data-leaflet-map-css', 'true');
      document.head.appendChild(link);
    }

    // Load Leaflet library
    const initLeaflet = () => {
      if (!(window as any).L) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => initializeMap();
        document.body.appendChild(script);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      const L = (window as any).L;
      if (!L) return;

      const mapElement = document.getElementById('endorsement-map');
      if (!mapElement) return;

      // Skip if already initialized
      if (mapInstanceRef.current) return;

      console.log('[Map] Initializing Leaflet map');
      mapInitializedRef.current = true;

      // Default center (user location or San Francisco)
      const centerLat = userLocation?.latitude || 37.7749;
      const centerLng = userLocation?.longitude || -122.4194;

      // Initialize map - zoom level 9 covers about half of Massachusetts (~50 miles)
      const map = L.map('endorsement-map', {
        center: [centerLat, centerLng],
        zoom: 9,
      });
      mapInstanceRef.current = map;

      // Add tile layer (CartoDB Voyager for better labels)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Create a layer group for markers
      markersLayerRef.current = L.layerGroup().addTo(map);

      // Add user location marker (blue)
      if (userLocation) {
        L.marker([userLocation.latitude, userLocation.longitude], {
          icon: L.divIcon({
            className: 'user-location-marker',
            html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#3B82F6"/>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" stroke="white" stroke-width="2"/>
              <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>`,
            iconSize: [24, 32],
            iconAnchor: [12, 32],
          }),
        }).addTo(map).bindPopup('You are here');
      }

      // Signal that map is ready for markers
      console.log('[Map] Map initialized, ready for markers');
      setMapReady(true);
    };

    // Initialize after a short delay to ensure DOM is ready
    const timer = setTimeout(initLeaflet, 100);

    // Listen for navigation events
    const handleNavigate = (event: any) => {
      const { id, type } = event.detail;
      if (type === 'business') {
        router.push(`/business/${id}`);
      } else if (type === 'brand') {
        router.push(`/brand/${id}`);
      } else if (type === 'place') {
        router.push(`/place/${id}`);
      }
    };

    window.addEventListener('navigate-to-endorsement', handleNavigate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('navigate-to-endorsement', handleNavigate);
    };
  }, [loading, loadingLocation, userLocation, router]);

  // Update markers when data changes (separate from map initialization)
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapReady || !mapInstanceRef.current || !markersLayerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    console.log('[Map] Updating markers:', mapMarkers.length, 'mapReady:', mapReady);

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    // Add local radius circle if local filter is active
    if (activeFilter === 'local' && userLocation) {
      L.circle([userLocation.latitude, userLocation.longitude], {
        radius: 25 * 1609.34, // 25 miles in meters
        color: 'rgba(59, 130, 246, 0.5)',
        fillColor: 'rgba(59, 130, 246, 0.1)',
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(markersLayerRef.current);
    }

    // Add endorsement markers (green)
    mapMarkers.forEach((marker) => {
      const markerColor = '#22C55E';
      const distanceText = marker.distance !== undefined
        ? marker.distance < 1
          ? `${(marker.distance * 5280).toFixed(0)} ft away`
          : `${marker.distance.toFixed(1)} mi away`
        : '';

      L.marker([marker.latitude, marker.longitude], {
        icon: L.divIcon({
          className: 'endorsement-marker',
          html: `<svg width="20" height="28" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z" fill="${markerColor}"/>
            <path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z" stroke="white" stroke-width="1.5"/>
          </svg>`,
          iconSize: [20, 28],
          iconAnchor: [10, 28],
        }),
      })
        .addTo(markersLayerRef.current)
        .bindPopup(`
          <div style="min-width: 200px; padding: 12px;">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px; color: #1f2937;">
              ${marker.name}
            </div>
            <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px; text-transform: capitalize;">
              ${marker.category}
            </div>
            ${marker.address ? `
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; line-height: 1.4;">
                📍 ${marker.address}
              </div>
            ` : ''}
            ${distanceText ? `
              <div style="font-size: 12px; color: #9ca3af; margin-bottom: 10px;">
                ${distanceText}
              </div>
            ` : ''}
            <button
              onclick="window.dispatchEvent(new CustomEvent('navigate-to-endorsement', { detail: { id: '${marker.id}', type: '${marker.type}' } }))"
              style="
                width: 100%;
                background-color: #00aaff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
              "
              onmouseover="this.style.backgroundColor='#0099ee'"
              onmouseout="this.style.backgroundColor='#00aaff'"
            >
              View Details
            </button>
          </div>
        `, {
          maxWidth: 280,
          className: 'endorsement-popup'
        });
    });

    // Only fit bounds when user switches to local filter (to show local area)
    // Don't fit bounds on initial load to avoid zooming out to show worldwide markers
    const filterChanged = previousFilterRef.current !== activeFilter;
    if (filterChanged) {
      hasUserChangedFilterRef.current = true;
      previousFilterRef.current = activeFilter;
    }

    // Fit map bounds only for local filter OR when user explicitly changed filter
    if (mapMarkers.length > 0 && activeFilter === 'local' && userLocation) {
      // For local filter, fit to show the local radius area
      const bounds = L.latLngBounds(mapMarkers.map(m => [m.latitude, m.longitude]));
      bounds.extend([userLocation.latitude, userLocation.longitude]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else if (hasUserChangedFilterRef.current && activeFilter === 'endorsements' && mapMarkers.length > 0) {
      // When switching back to endorsements, reset to initial zoom centered on user
      if (userLocation) {
        mapInstanceRef.current.setView([userLocation.latitude, userLocation.longitude], 9);
      }
    }
    // On initial load with endorsements filter, keep the initial zoom (level 9) and don't fit all worldwide markers
  }, [mapMarkers, activeFilter, userLocation, mapReady]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        mapInitializedRef.current = false;
        setMapReady(false);
      }
    };
  }, []);

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
      // For web, use Leaflet map (initialized in useEffect)
      return (
        <View style={styles.mapContainer}>
          <div id="endorsement-map" style={{ width: '100%', height: '100%' }} />
          {/* Show loading overlay while map initializes */}
          {!mapReady && (
            <View style={[styles.mapLoadingOverlay, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
                Loading {mapMarkers.length} location{mapMarkers.length !== 1 ? 's' : ''}...
              </Text>
            </View>
          )}
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
              radius={25 * 1609.34} // 25 miles in meters
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
              : 'No businesses found within 25 miles of your location.'}
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 4,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
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
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
