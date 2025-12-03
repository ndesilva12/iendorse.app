/**
 * Logo URL utility for generating brand logos using logo.dev API
 * Falls back to Stand app logo if logo.dev fails
 */

// Stand app logo fallback
const STAND_LOGO_FALLBACK = 'https://upright.money/icon-512.png';

// Logo.dev API key (use publishable key for client-side requests)
const LOGO_DEV_API_KEY = process.env.EXPO_PUBLIC_LOGO_DEV_API_KEY || 'pk_NmXtbgd3TRWfEXgPZ_qtzw';

/**
 * Extract domain from a full URL
 * @param url - Full URL (e.g., "https://www.apple.com/store")
 * @returns Domain (e.g., "apple.com")
 */
function extractDomain(url: string): string {
  try {
    // Handle URLs without protocol
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(urlWithProtocol);
    // Remove www. prefix if present
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.warn('[Logo] Failed to extract domain from URL:', url, error);
    // Return the URL as-is if parsing fails, logo.dev might still handle it
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

/**
 * Generate logo URL using logo.dev API
 * @param websiteUrl - Company website URL or domain
 * @param options - Optional parameters for logo customization
 * @returns Logo URL
 */
export function getLogoUrl(
  websiteUrl: string,
  options: {
    size?: number;
    format?: 'png' | 'jpg' | 'svg';
    fallback?: string;
  } = {}
): string {
  const { size = 128, format = 'png', fallback = STAND_LOGO_FALLBACK } = options;

  // If no website URL provided, return fallback
  if (!websiteUrl || websiteUrl.trim() === '') {
    return fallback;
  }

  const domain = extractDomain(websiteUrl);

  // Generate logo.dev URL with API key
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_API_KEY}&size=${size}&format=${format}`;
}

/**
 * Get fallback logo URL (Stand app logo)
 * @returns Stand logo URL
 */
export function getFallbackLogoUrl(): string {
  return STAND_LOGO_FALLBACK;
}

/**
 * Check if a URL is a logo.dev URL
 * @param url - URL to check
 * @returns true if URL is from logo.dev
 */
export function isLogoDevUrl(url: string): boolean {
  return url.includes('logo.dev');
}

/**
 * Check if a URL is a Google Places photo URL
 * These URLs can be unreliable/expire and may show error images
 * @param url - URL to check
 * @returns true if URL is from Google Places API
 */
export function isGooglePlacesPhotoUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('maps.googleapis.com/maps/api/place/photo') ||
         url.includes('lh3.googleusercontent.com') ||
         url.includes('googleusercontent.com/places');
}

/**
 * Get a reliable business logo URL
 * Prefers user-uploaded logos, falls back to logo.dev for website-based logos
 * Avoids using Google Places photos directly as they can expire
 * @param logoUrl - User-uploaded logo URL (may be Google Places photo)
 * @param websiteUrl - Business website URL
 * @returns A reliable logo URL
 */
export function getBusinessLogoUrl(
  logoUrl: string | undefined,
  websiteUrl: string | undefined
): string {
  // If there's an uploaded logo that's NOT a Google Places photo, use it
  if (logoUrl && !isGooglePlacesPhotoUrl(logoUrl)) {
    return logoUrl;
  }

  // Otherwise, generate from website using logo.dev
  if (websiteUrl && websiteUrl.trim()) {
    return getLogoUrl(websiteUrl);
  }

  // Final fallback
  return STAND_LOGO_FALLBACK;
}
