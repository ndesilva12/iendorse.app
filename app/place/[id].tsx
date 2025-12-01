/**
 * Place Detail Screen
 *
 * Displays details for an external place from Google Places API
 * Shows name, address, rating, photos, hours, and reviews
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Clock,
  Star,
  ExternalLink,
  Navigation,
  Share2,
} from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { getPlaceDetails, PlaceDetails, getPlacePhotoUrl, formatCategory, formatPriceLevel } from '@/services/firebase/placesService';
import { getLogoUrl } from '@/lib/logo';
import { Percent, Tag } from 'lucide-react-native';

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [logoError, setLogoError] = useState(false);

  // Get brand logo URL from website if available
  const brandLogoUrl = place?.website ? getLogoUrl(place.website, { size: 200 }) : null;

  // Swipe to go back
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

  useEffect(() => {
    const loadPlaceDetails = async () => {
      if (!id) {
        setError('No place ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const details = await getPlaceDetails(id);
        if (details) {
          setPlace(details);
        } else {
          setError('Place not found');
        }
      } catch (err) {
        console.error('[PlaceDetail] Error loading place:', err);
        setError('Failed to load place details');
      } finally {
        setLoading(false);
      }
    };

    loadPlaceDetails();
  }, [id]);

  const handleOpenMaps = useCallback(() => {
    if (place?.googleMapsUrl) {
      Linking.openURL(place.googleMapsUrl);
    } else if (place?.location) {
      const url = Platform.select({
        ios: `maps://maps.apple.com/?q=${place.name}&ll=${place.location.lat},${place.location.lng}`,
        android: `geo:${place.location.lat},${place.location.lng}?q=${place.name}`,
        default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`,
      });
      Linking.openURL(url);
    }
  }, [place]);

  const handleCall = useCallback(() => {
    if (place?.phone) {
      Linking.openURL(`tel:${place.phone}`);
    }
  }, [place]);

  const handleOpenWebsite = useCallback(() => {
    if (place?.website) {
      Linking.openURL(place.website);
    }
  }, [place]);

  const handleShare = useCallback(async () => {
    if (place?.googleMapsUrl) {
      try {
        if (Platform.OS === 'web') {
          navigator.clipboard.writeText(place.googleMapsUrl);
          alert('Link copied to clipboard');
        } else {
          const { Share } = await import('react-native');
          await Share.share({
            title: place.name,
            message: `Check out ${place.name}: ${place.googleMapsUrl}`,
            url: place.googleMapsUrl,
          });
        }
      } catch (err) {
        console.error('[PlaceDetail] Error sharing:', err);
      }
    }
  }, [place]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading place details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !place) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>
            {error || 'Place not found'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={Platform.OS === 'web' && isLargeScreen ? styles.webWrapper : styles.fullWidth}
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {place.name}
          </Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Share2 size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Cover Photo */}
          {place.photoReferences.length > 0 && (
            <View style={styles.photosContainer}>
              <Image
                source={{ uri: getPlacePhotoUrl(place.photoReferences[currentPhotoIndex], 800) }}
                style={styles.mainPhoto}
                contentFit="cover"
                transition={200}
              />
            </View>
          )}

          {/* Place Info with Logo on left, info on right */}
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              {/* Logo on left */}
              {brandLogoUrl && !logoError ? (
                <View style={styles.logoContainer}>
                  <Image
                    source={{ uri: brandLogoUrl }}
                    style={styles.brandLogo}
                    contentFit="contain"
                    transition={200}
                    onError={() => setLogoError(true)}
                  />
                </View>
              ) : place.photoReferences.length > 0 ? (
                <View style={styles.logoContainer}>
                  <Image
                    source={{ uri: getPlacePhotoUrl(place.photoReferences[0], 200) }}
                    style={styles.brandLogo}
                    contentFit="cover"
                    transition={200}
                  />
                </View>
              ) : (
                <View style={[styles.logoContainer, styles.logoPlaceholder, { backgroundColor: colors.border }]}>
                  <Globe size={32} color={colors.textSecondary} />
                </View>
              )}

              {/* Name and category on right */}
              <View style={styles.infoHeaderText}>
                <Text style={[styles.placeName, { color: colors.text }]}>{place.name}</Text>
                <View style={styles.categoryRow}>
                  <Text style={[styles.category, { color: colors.textSecondary }]}>
                    {place.categories.slice(0, 3).map(formatCategory).join(' · ')}
                  </Text>
                  {place.priceLevel !== undefined && (
                    <Text style={[styles.priceLevel, { color: colors.textSecondary }]}>
                      {' · '}{formatPriceLevel(place.priceLevel)}
                    </Text>
                  )}
                </View>

                {/* Rating */}
                {place.rating && (
                  <View style={styles.ratingContainer}>
                    <Star size={18} color="#FFB800" fill="#FFB800" />
                    <Text style={[styles.ratingText, { color: colors.text }]}>
                      {place.rating.toFixed(1)}
                    </Text>
                    {place.userRatingsTotal && (
                      <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>
                        ({place.userRatingsTotal.toLocaleString()} reviews)
                      </Text>
                    )}
                    {place.isOpenNow !== undefined && (
                      <View style={[
                        styles.openBadge,
                        { backgroundColor: place.isOpenNow ? '#22C55E20' : '#EF444420' }
                      ]}>
                        <Text style={[
                          styles.openBadgeText,
                          { color: place.isOpenNow ? '#22C55E' : '#EF4444' }
                        ]}>
                          {place.isOpenNow ? 'Open' : 'Closed'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Photo thumbnails removed to reduce Google Places Photos API costs */}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleOpenMaps}
            >
              <Navigation size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Directions</Text>
            </TouchableOpacity>

            {place.phone && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                onPress={handleCall}
              >
                <Phone size={20} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>Call</Text>
              </TouchableOpacity>
            )}

            {place.website && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                onPress={handleOpenWebsite}
              >
                <Globe size={20} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>Website</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Endorsement Discounts Section */}
          <View style={[styles.discountSection, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: colors.border }]}>
            <View style={styles.discountHeader}>
              <View style={[styles.discountIconContainer, { backgroundColor: colors.primary }]}>
                <Percent size={20} color="#FFFFFF" />
              </View>
              <View style={styles.discountTitleContainer}>
                <Text style={[styles.discountTitle, { color: colors.text }]}>Endorsement Discounts</Text>
                <Text style={[styles.discountSubtitle, { color: colors.textSecondary }]}>
                  Earn discounts when you endorse this business
                </Text>
              </View>
            </View>

            <View style={[styles.discountNotice, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: colors.border }]}>
              <Tag size={16} color={colors.textSecondary} />
              <Text style={[styles.discountNoticeText, { color: colors.textSecondary }]}>
                This business is not on Endorse yet. Discounts will be available once they join our platform.
              </Text>
            </View>

            <Text style={[styles.discountCta, { color: colors.primary }]}>
              Know the owner? Invite them to Endorse!
            </Text>
          </View>

          {/* Address */}
          {place.address && (
            <TouchableOpacity
              style={[styles.infoRow, { borderBottomColor: colors.border }]}
              onPress={handleOpenMaps}
            >
              <MapPin size={20} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.text }]}>{place.address}</Text>
              <ExternalLink size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Phone */}
          {place.phone && (
            <TouchableOpacity
              style={[styles.infoRow, { borderBottomColor: colors.border }]}
              onPress={handleCall}
            >
              <Phone size={20} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.text }]}>{place.phone}</Text>
            </TouchableOpacity>
          )}

          {/* Website */}
          {place.website && (
            <TouchableOpacity
              style={[styles.infoRow, { borderBottomColor: colors.border }]}
              onPress={handleOpenWebsite}
            >
              <Globe size={20} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.primary }]} numberOfLines={1}>
                {place.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </Text>
              <ExternalLink size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Opening Hours */}
          {place.openingHours && place.openingHours.length > 0 && (
            <View style={[styles.hoursSection, { borderBottomColor: colors.border }]}>
              <View style={styles.hoursTitleRow}>
                <Clock size={20} color={colors.textSecondary} />
                <Text style={[styles.hoursTitle, { color: colors.text }]}>Opening Hours</Text>
              </View>
              {place.openingHours.map((hours, index) => (
                <Text key={index} style={[styles.hoursText, { color: colors.textSecondary }]}>
                  {hours}
                </Text>
              ))}
            </View>
          )}

          {/* Reviews */}
          {place.reviews && place.reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews</Text>
              {place.reviews.map((review, index) => (
                <View
                  key={index}
                  style={[styles.reviewCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewAuthor, { color: colors.text }]}>{review.author}</Text>
                    <View style={styles.reviewRating}>
                      <Star size={14} color="#FFB800" fill="#FFB800" />
                      <Text style={[styles.reviewRatingText, { color: colors.text }]}>{review.rating}</Text>
                    </View>
                  </View>
                  <Text style={[styles.reviewTime, { color: colors.textSecondary }]}>{review.time}</Text>
                  <Text style={[styles.reviewText, { color: colors.text }]}>{review.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Google Maps Attribution */}
          <View style={styles.attribution}>
            <Text style={[styles.attributionText, { color: colors.textSecondary }]}>
              Data provided by Google Places
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
  },
  fullWidth: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  photosContainer: {
    marginBottom: 0,
  },
  mainPhoto: {
    width: '100%',
    height: 220,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginRight: 16,
    marginTop: -40,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoHeaderText: {
    flex: 1,
    paddingTop: 4,
  },
  photoThumbnails: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  thumbnail: {
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    opacity: 0.6,
  },
  thumbnailActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#007bff',
  },
  thumbnailImage: {
    width: 60,
    height: 60,
  },
  photoThumbnailsRight: {
    flexDirection: 'column',
    gap: 4,
    marginLeft: 12,
  },
  thumbnailSmall: {
    borderRadius: 6,
    overflow: 'hidden',
    opacity: 0.7,
  },
  thumbnailImageSmall: {
    width: 40,
    height: 40,
  },
  morePhotos: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  morePhotosText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  photoThumbnailsHorizontal: {
    marginBottom: 12,
    paddingLeft: 16,
  },
  photoThumbnailsContent: {
    paddingRight: 16,
    gap: 8,
  },
  thumbnailHorizontal: {
    width: 100,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    opacity: 0.8,
  },
  thumbnailImageHorizontal: {
    width: '100%',
    height: '100%',
  },
  placeName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  category: {
    fontSize: 14,
  },
  priceLevel: {
    fontSize: 14,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
  },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  openBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
  },
  hoursSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  hoursTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  hoursTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  hoursText: {
    fontSize: 14,
    marginLeft: 32,
    lineHeight: 22,
  },
  reviewsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  reviewCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewRatingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewTime: {
    fontSize: 12,
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  attribution: {
    padding: 16,
    alignItems: 'center',
  },
  attributionText: {
    fontSize: 12,
  },
  discountSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  discountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  discountIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTitleContainer: {
    flex: 1,
  },
  discountTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  discountSubtitle: {
    fontSize: 13,
  },
  discountNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  discountNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  discountCta: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
