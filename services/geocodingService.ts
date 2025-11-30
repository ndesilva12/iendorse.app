// Geocoding service for converting location strings to coordinates
// Uses Google Geocoding API with in-memory caching

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// In-memory cache for geocoded locations
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

// Pending geocode requests to avoid duplicate calls
const pendingRequests = new Map<string, Promise<{ lat: number; lng: number } | null>>();

/**
 * Geocode a location string (e.g., "New York, NY") to coordinates
 * Results are cached in memory to avoid repeated API calls
 */
export async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  // Normalize the location string for caching
  const normalizedLocation = location.trim().toLowerCase();

  // Check cache first
  if (geocodeCache.has(normalizedLocation)) {
    return geocodeCache.get(normalizedLocation) || null;
  }

  // Check if there's already a pending request for this location
  if (pendingRequests.has(normalizedLocation)) {
    return pendingRequests.get(normalizedLocation)!;
  }

  // Create the geocode promise
  const geocodePromise = (async () => {
    if (!GOOGLE_API_KEY) {
      console.warn('[Geocoding] No API key available');
      geocodeCache.set(normalizedLocation, null);
      return null;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        const result = { lat, lng };
        geocodeCache.set(normalizedLocation, result);
        return result;
      }

      // Cache null result for failed lookups
      geocodeCache.set(normalizedLocation, null);
      return null;
    } catch (error) {
      console.warn('[Geocoding] Error geocoding location:', location, error);
      geocodeCache.set(normalizedLocation, null);
      return null;
    } finally {
      // Clean up pending request
      pendingRequests.delete(normalizedLocation);
    }
  })();

  pendingRequests.set(normalizedLocation, geocodePromise);
  return geocodePromise;
}

/**
 * Batch geocode multiple locations
 * Returns a map of location string to coordinates
 */
export async function batchGeocodeLocations(
  locations: string[]
): Promise<Map<string, { lat: number; lng: number } | null>> {
  const results = new Map<string, { lat: number; lng: number } | null>();

  // Geocode all locations in parallel (with some throttling to avoid rate limits)
  const batchSize = 5;
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (location) => {
        const coords = await geocodeLocation(location);
        return { location, coords };
      })
    );

    for (const { location, coords } of batchResults) {
      results.set(location, coords);
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Clear the geocode cache
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}
