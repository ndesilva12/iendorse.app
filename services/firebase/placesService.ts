/**
 * Google Places Service
 *
 * Provides access to Google Places API for searching
 * and getting details of external businesses
 *
 * Uses Google Maps JavaScript API for web (CORS-safe)
 * Uses REST API for native platforms
 */

import { Platform } from 'react-native';
import { db } from '@/firebase';
import { doc, setDoc, increment, getDoc, Timestamp } from 'firebase/firestore';

// Get API key from environment
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

// API Usage Tracking
interface ApiUsageStats {
  totalCalls: number;
  searchCalls: number;
  detailsCalls: number;
  photoCalls: number;
  lastUpdated: Timestamp;
  dailyCalls: { [date: string]: number };
  monthlyCalls: { [month: string]: number };
}

/**
 * Track a Google Places API call
 */
const trackApiCall = async (callType: 'search' | 'details' | 'photo') => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const month = today.substring(0, 7); // YYYY-MM

    const statsRef = doc(db, 'system', 'placesApiUsage');

    await setDoc(statsRef, {
      totalCalls: increment(1),
      [`${callType}Calls`]: increment(1),
      lastUpdated: Timestamp.now(),
      [`dailyCalls.${today}`]: increment(1),
      [`monthlyCalls.${month}`]: increment(1),
    }, { merge: true });
  } catch (error) {
    // Don't let tracking errors break the main functionality
    console.error('[PlacesService] Error tracking API call:', error);
  }
};

/**
 * Get API usage statistics
 */
export const getApiUsageStats = async (): Promise<ApiUsageStats | null> => {
  try {
    const statsRef = doc(db, 'system', 'placesApiUsage');
    const statsDoc = await getDoc(statsRef);

    if (!statsDoc.exists()) {
      return null;
    }

    return statsDoc.data() as ApiUsageStats;
  } catch (error) {
    console.error('[PlacesService] Error getting API usage stats:', error);
    return null;
  }
};

/**
 * Initialize API usage document (call from admin to create if doesn't exist)
 */
export const initializeApiUsageStats = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const statsRef = doc(db, 'system', 'placesApiUsage');
    const statsDoc = await getDoc(statsRef);

    if (statsDoc.exists()) {
      return { success: true, message: 'API usage document already exists' };
    }

    // Create initial document
    await setDoc(statsRef, {
      totalCalls: 0,
      searchCalls: 0,
      detailsCalls: 0,
      photoCalls: 0,
      lastUpdated: Timestamp.now(),
      dailyCalls: { [today]: 0 },
      monthlyCalls: { [month]: 0 },
    });

    return { success: true, message: 'API usage document created successfully' };
  } catch (error: any) {
    console.error('[PlacesService] Error initializing API usage stats:', error);
    return { success: false, message: error.message || 'Failed to initialize API usage stats' };
  }
};

// Types for Places API responses
export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  category: string;
  rating?: number;
  userRatingsTotal?: number;
  photoReference?: string;
  location?: {
    lat: number;
    lng: number;
  };
  openNow?: boolean;
  priceLevel?: number;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  googleMapsUrl: string;
  rating?: number;
  userRatingsTotal?: number;
  category: string;
  categories: string[];
  location?: {
    lat: number;
    lng: number;
  };
  priceLevel?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  photoReferences: string[];
  reviews: {
    author: string;
    rating: number;
    text: string;
    time: string;
  }[];
}

// Google Maps script loading for web
let googleMapsLoaded = false;
let googleMapsLoadPromise: Promise<void> | null = null;

const loadGoogleMapsScript = (): Promise<void> => {
  if (Platform.OS !== 'web') {
    return Promise.resolve();
  }

  if (googleMapsLoaded && (window as any).google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).google?.maps?.places) {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
};

/**
 * Search for places using Google Places API
 * Uses JavaScript API on web, REST API on native
 */
export const searchPlaces = async (
  query: string,
  location?: { lat: number; lng: number },
  radius: number = 50000
): Promise<PlaceSearchResult[]> => {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[PlacesService] Google Places API key not configured');
    return [];
  }

  if (!query || query.trim().length < 2) {
    return [];
  }

  // Track API usage
  trackApiCall('search');

  // Use JavaScript API on web (handles CORS)
  if (Platform.OS === 'web') {
    return searchPlacesWeb(query, location, radius);
  }

  // Use REST API on native (no CORS issues)
  return searchPlacesNative(query, location, radius);
};

/**
 * Web implementation using Google Maps JavaScript API
 */
const searchPlacesWeb = async (
  query: string,
  location?: { lat: number; lng: number },
  radius: number = 50000
): Promise<PlaceSearchResult[]> => {
  try {
    await loadGoogleMapsScript();

    const google = (window as any).google;
    if (!google?.maps?.places) {
      console.error('[PlacesService] Google Maps Places library not loaded');
      return [];
    }

    return new Promise((resolve) => {
      // Create a dummy map element (required by PlacesService)
      let mapDiv = document.getElementById('places-service-map');
      if (!mapDiv) {
        mapDiv = document.createElement('div');
        mapDiv.id = 'places-service-map';
        mapDiv.style.display = 'none';
        document.body.appendChild(mapDiv);
      }

      const map = new google.maps.Map(mapDiv, {
        center: location || { lat: 37.7749, lng: -122.4194 },
        zoom: 15,
      });

      const service = new google.maps.places.PlacesService(map);

      const request: any = {
        query: query,
        type: 'establishment',
      };

      if (location) {
        request.location = new google.maps.LatLng(location.lat, location.lng);
        request.radius = radius;
      }

      service.textSearch(request, (results: any[], status: string) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          console.log('[PlacesService] No results or error:', status);
          resolve([]);
          return;
        }

        const places: PlaceSearchResult[] = results.slice(0, 20).map((place: any) => ({
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address || place.vicinity || '',
          category: place.types?.[0]?.replace(/_/g, ' ') || 'Business',
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          photoReference: place.photos?.[0]?.getUrl ? 'has_photo' : undefined,
          // Store the photo getter for later use
          _photoGetter: place.photos?.[0]?.getUrl,
          location: place.geometry?.location ? {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          } : undefined,
          openNow: place.opening_hours?.isOpen?.(),
          priceLevel: place.price_level,
        }));

        // Get photo URLs for places that have photos
        places.forEach((p: any) => {
          if (p._photoGetter) {
            p.photoReference = p._photoGetter({ maxWidth: 400 });
            delete p._photoGetter;
          }
        });

        console.log('[PlacesService] Web search completed:', places.length, 'results');
        resolve(places);
      });
    });
  } catch (error) {
    console.error('[PlacesService] Web search error:', error);
    return [];
  }
};

/**
 * Native implementation using REST API (no CORS restrictions)
 */
const searchPlacesNative = async (
  query: string,
  location?: { lat: number; lng: number },
  radius: number = 50000
): Promise<PlaceSearchResult[]> => {
  try {
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const params = new URLSearchParams({
      query: query,
      key: GOOGLE_PLACES_API_KEY,
      type: 'establishment',
    });

    if (location?.lat && location?.lng) {
      params.append('location', `${location.lat},${location.lng}`);
      params.append('radius', radius.toString());
    }

    const response = await fetch(`${baseUrl}?${params.toString()}`);
    const result = await response.json();

    if (result.status !== 'OK' && result.status !== 'ZERO_RESULTS') {
      console.error('[PlacesService] API error:', result.status, result.error_message);
      return [];
    }

    const places: PlaceSearchResult[] = (result.results || []).slice(0, 20).map((place: any) => ({
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      category: place.types?.[0]?.replace(/_/g, ' ') || 'Business',
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      photoReference: place.photos?.[0]?.photo_reference,
      location: place.geometry?.location,
      openNow: place.opening_hours?.open_now,
      priceLevel: place.price_level,
    }));

    console.log('[PlacesService] Native search completed:', places.length, 'results');
    return places;
  } catch (error: any) {
    console.error('[PlacesService] Native search error:', error);
    return [];
  }
};

/**
 * Get detailed information about a specific place
 */
export const getPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[PlacesService] Google Places API key not configured');
    return null;
  }

  // Track API usage
  trackApiCall('details');

  // Use JavaScript API on web
  if (Platform.OS === 'web') {
    return getPlaceDetailsWeb(placeId);
  }

  // Use REST API on native
  return getPlaceDetailsNative(placeId);
};

/**
 * Web implementation for place details
 */
const getPlaceDetailsWeb = async (placeId: string): Promise<PlaceDetails | null> => {
  try {
    await loadGoogleMapsScript();

    const google = (window as any).google;
    if (!google?.maps?.places) {
      console.error('[PlacesService] Google Maps Places library not loaded');
      return null;
    }

    return new Promise((resolve) => {
      let mapDiv = document.getElementById('places-service-map');
      if (!mapDiv) {
        mapDiv = document.createElement('div');
        mapDiv.id = 'places-service-map';
        mapDiv.style.display = 'none';
        document.body.appendChild(mapDiv);
      }

      const map = new google.maps.Map(mapDiv, {
        center: { lat: 0, lng: 0 },
        zoom: 15,
      });

      const service = new google.maps.places.PlacesService(map);

      service.getDetails(
        {
          placeId: placeId,
          fields: [
            'place_id', 'name', 'formatted_address', 'formatted_phone_number',
            'website', 'url', 'rating', 'user_ratings_total', 'photos',
            'types', 'opening_hours', 'price_level', 'reviews', 'geometry'
          ],
        },
        (place: any, status: string) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
            console.error('[PlacesService] Details error:', status);
            resolve(null);
            return;
          }

          const photoUrls = place.photos?.slice(0, 1).map((photo: any) =>
            photo.getUrl({ maxWidth: 800 })
          ) || [];

          const details: PlaceDetails = {
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address || '',
            phone: place.formatted_phone_number,
            website: place.website,
            googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            category: place.types?.[0]?.replace(/_/g, ' ') || 'Business',
            categories: place.types?.map((t: string) => t.replace(/_/g, ' ')) || [],
            location: place.geometry?.location ? {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            } : undefined,
            priceLevel: place.price_level,
            openingHours: place.opening_hours?.weekday_text,
            isOpenNow: place.opening_hours?.isOpen?.(),
            photoReferences: photoUrls,
            reviews: place.reviews?.slice(0, 5).map((r: any) => ({
              author: r.author_name,
              rating: r.rating,
              text: r.text,
              time: r.relative_time_description,
            })) || [],
          };

          console.log('[PlacesService] Web details retrieved for:', details.name);
          resolve(details);
        }
      );
    });
  } catch (error) {
    console.error('[PlacesService] Web details error:', error);
    return null;
  }
};

/**
 * Native implementation for place details
 */
const getPlaceDetailsNative = async (placeId: string): Promise<PlaceDetails | null> => {
  try {
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_PLACES_API_KEY,
      fields: 'place_id,name,formatted_address,formatted_phone_number,website,url,rating,user_ratings_total,photos,types,opening_hours,price_level,reviews,geometry',
    });

    const response = await fetch(`${baseUrl}?${params.toString()}`);
    const result = await response.json();

    if (result.status !== 'OK') {
      console.error('[PlacesService] API error:', result.status, result.error_message);
      return null;
    }

    const place = result.result;

    const details: PlaceDetails = {
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      phone: place.formatted_phone_number,
      website: place.website,
      googleMapsUrl: place.url,
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      category: place.types?.[0]?.replace(/_/g, ' ') || 'Business',
      categories: place.types?.map((t: string) => t.replace(/_/g, ' ')) || [],
      location: place.geometry?.location,
      priceLevel: place.price_level,
      openingHours: place.opening_hours?.weekday_text,
      isOpenNow: place.opening_hours?.open_now,
      photoReferences: place.photos?.slice(0, 1).map((p: any) => p.photo_reference) || [],
      reviews: place.reviews?.slice(0, 5).map((r: any) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description,
      })) || [],
    };

    console.log('[PlacesService] Native details retrieved for:', details.name);
    return details;
  } catch (error: any) {
    console.error('[PlacesService] Native details error:', error);
    return null;
  }
};

/**
 * Get the URL for a place photo
 * On web with JS API, photoReference is already a URL
 * On native, construct the URL from photo_reference
 */
export const getPlacePhotoUrl = (photoReference: string, maxWidth: number = 400): string => {
  if (!photoReference) {
    return '';
  }

  // If it's already a URL (from web JS API), return as-is
  if (photoReference.startsWith('http')) {
    return photoReference;
  }

  // On native, construct the URL
  if (!GOOGLE_PLACES_API_KEY) {
    return '';
  }
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
};

/**
 * Format price level to dollar signs
 */
export const formatPriceLevel = (priceLevel?: number): string => {
  if (priceLevel === undefined || priceLevel === null) return '';
  return '$'.repeat(priceLevel);
};

/**
 * Format rating with stars
 */
export const formatRating = (rating?: number): string => {
  if (rating === undefined || rating === null) return 'No rating';
  return `${rating.toFixed(1)} ★`;
};

/**
 * Get a display-friendly category name
 */
export const formatCategory = (category: string): string => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
