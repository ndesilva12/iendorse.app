import { useRouter, useLocalSearchParams } from 'expo-router';
import { Building2, Search, MapPin, Check, AlertCircle, ChevronRight, Clock } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { searchPlaces, PlaceSearchResult, getPlacePhotoUrl } from '@/services/firebase/placesService';
import { submitBusinessClaim, getClaimsByUser, BusinessClaim } from '@/services/firebase/businessClaimService';
import { getLogoUrl } from '@/lib/logo';
import * as Location from 'expo-location';
import debounce from 'lodash/debounce';

export default function BusinessSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isFromSettings = params.from === 'settings';
  const { isDarkMode, clerkUser, isLoading: isProfileLoading, setAccountType, profile } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const [isInitializing, setIsInitializing] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Selected business state
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);

  // Claim form state
  const [businessRole, setBusinessRole] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [verificationDetails, setVerificationDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing claims
  const [existingClaims, setExistingClaims] = useState<BusinessClaim[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);

  // Check if user is ready - don't create user doc here, it will be created when onboarding completes
  useEffect(() => {
    if (!clerkUser?.id || isProfileLoading) {
      return;
    }
    console.log('[BusinessSetup] User ready:', clerkUser.id);
    console.log('[BusinessSetup] Current profile:', profile?.accountType);
    setIsInitializing(false);
  }, [clerkUser?.id, isProfileLoading]);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      } catch (error) {
        console.log('[BusinessSetup] Could not get location:', error);
      }
    })();
  }, []);

  // Load existing claims
  useEffect(() => {
    if (clerkUser?.id) {
      loadExistingClaims();
    }
  }, [clerkUser?.id]);

  const loadExistingClaims = async () => {
    if (!clerkUser?.id) return;
    setIsLoadingClaims(true);
    try {
      const claims = await getClaimsByUser(clerkUser.id);
      setExistingClaims(claims);
    } catch (error) {
      console.error('[BusinessSetup] Error loading claims:', error);
    } finally {
      setIsLoadingClaims(false);
    }
  };

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchPlaces(query, userLocation || undefined, 50000);
        setSearchResults(results);
      } catch (error) {
        console.error('[BusinessSetup] Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [userLocation]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  const handleSelectPlace = (place: PlaceSearchResult) => {
    setSelectedPlace(place);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmitClaim = async () => {
    if (!selectedPlace || !clerkUser) {
      Alert.alert('Error', 'Please select a business first');
      return;
    }

    if (!businessRole.trim()) {
      Alert.alert('Required', 'Please enter your role at the business');
      return;
    }

    if (!businessEmail.trim() && !businessPhone.trim()) {
      Alert.alert('Required', 'Please provide a business email or phone number for verification');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitBusinessClaim({
        userId: clerkUser.id,
        userEmail: clerkUser.primaryEmailAddress?.emailAddress || '',
        userName: clerkUser.fullName || clerkUser.firstName || '',
        placeId: selectedPlace.placeId,
        placeName: selectedPlace.name,
        placeAddress: selectedPlace.address,
        placeCategory: selectedPlace.category,
        businessRole: businessRole.trim(),
        businessPhone: businessPhone.trim(),
        businessEmail: businessEmail.trim(),
        verificationDetails: verificationDetails.trim(),
      });

      console.log('[BusinessSetup] Business claim submitted successfully');

      // Handle differently based on where user came from
      if (isFromSettings) {
        // User came from settings - navigate back to profile
        // Account will be converted when admin approves the claim
        router.replace('/(tabs)/profile');
      } else {
        // User came from onboarding flow - go back to onboarding to continue with values
        router.replace('/onboarding?accountType=business');
      }
    } catch (error: any) {
      console.error('[BusinessSetup] Error submitting claim:', error);
      Alert.alert('Error', error?.message || 'Failed to submit claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} color="#F59E0B" strokeWidth={2} />;
      case 'approved': return <Check size={16} color="#10B981" strokeWidth={2} />;
      case 'rejected': return <AlertCircle size={16} color="#EF4444" strokeWidth={2} />;
      default: return null;
    }
  };

  // Get photo URL for a place
  const getPlacePhoto = (place: PlaceSearchResult) => {
    if (place.photoReference) {
      return getPlacePhotoUrl(place.photoReference);
    }
    return null;
  };

  // Show loading state while profile is loading or initializing
  if (isProfileLoading || (isInitializing && clerkUser)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            {isInitializing ? 'Setting up your business account...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // If no user after loading, show a message and retry option
  if (!clerkUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={styles.loadingContainer}>
          <AlertCircle size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.loadingText, { color: colors.text, marginTop: 16 }]}>
            Please sign in to claim your business
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            <Text style={styles.retryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          Platform.OS === 'web' && styles.webContent
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/endorsing.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
            <Building2 size={32} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Claim Your Business
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Search for your business and claim ownership to manage your profile on iEndorse
          </Text>
        </View>

        {/* Existing Claims Section */}
        {existingClaims.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Claims
            </Text>
            {existingClaims.map((claim) => (
              <View
                key={claim.id}
                style={[styles.claimCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              >
                <View style={styles.claimHeader}>
                  <Text style={[styles.claimName, { color: colors.text }]} numberOfLines={1}>
                    {claim.placeName}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(claim.status) + '20' }]}>
                    {getStatusIcon(claim.status)}
                    <Text style={[styles.statusText, { color: getStatusColor(claim.status) }]}>
                      {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.claimAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {claim.placeAddress}
                </Text>
                {claim.status === 'rejected' && claim.reviewNotes && (
                  <Text style={[styles.claimNotes, { color: colors.danger }]}>
                    Reason: {claim.reviewNotes}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Search Section */}
        {!selectedPlace && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Find Your Business
            </Text>
            <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Search size={20} color={colors.textSecondary} strokeWidth={2} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search for your business name..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <View style={[styles.resultsContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                {searchResults.map((place) => (
                  <TouchableOpacity
                    key={place.placeId}
                    style={[styles.resultItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleSelectPlace(place)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.resultLogo, { backgroundColor: '#FFFFFF' }]}>
                      {getPlacePhoto(place) ? (
                        <ExpoImage
                          source={{ uri: getPlacePhoto(place)! }}
                          style={styles.resultLogoImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.resultLogoPlaceholder, { backgroundColor: colors.primary }]}>
                          <Text style={styles.resultLogoText}>{place.name.charAt(0)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text style={[styles.resultAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                        {place.address}
                      </Text>
                      <Text style={[styles.resultCategory, { color: colors.textSecondary }]}>
                        {place.category}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <View style={[styles.noResults, { backgroundColor: colors.backgroundSecondary }]}>
                <AlertCircle size={32} color={colors.textSecondary} strokeWidth={1.5} />
                <Text style={[styles.noResultsText, { color: colors.text }]}>
                  No businesses found
                </Text>
                <Text style={[styles.noResultsSubtext, { color: colors.textSecondary }]}>
                  Try a different search term or check the spelling
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Selected Business + Claim Form */}
        {selectedPlace && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Selected Business
              </Text>
              <View style={[styles.selectedCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary }]}>
                <View style={[styles.selectedLogo, { backgroundColor: '#FFFFFF' }]}>
                  {getPlacePhoto(selectedPlace) ? (
                    <ExpoImage
                      source={{ uri: getPlacePhoto(selectedPlace)! }}
                      style={styles.selectedLogoImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.selectedLogoPlaceholder, { backgroundColor: colors.primary }]}>
                      <Text style={styles.selectedLogoText}>{selectedPlace.name.charAt(0)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.selectedInfo}>
                  <Text style={[styles.selectedName, { color: colors.text }]}>
                    {selectedPlace.name}
                  </Text>
                  <Text style={[styles.selectedAddress, { color: colors.textSecondary }]}>
                    {selectedPlace.address}
                  </Text>
                  <Text style={[styles.selectedCategory, { color: colors.primary }]}>
                    {selectedPlace.category}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedPlace(null)}
                  style={styles.changeButton}
                >
                  <Text style={[styles.changeButtonText, { color: colors.primary }]}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Verification Form */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Verification Information
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                We'll use this information to verify your ownership
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Your Role *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g., Owner, Manager, Director"
                  placeholderTextColor={colors.textSecondary}
                  value={businessRole}
                  onChangeText={setBusinessRole}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Business Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="contact@yourbusiness.com"
                  placeholderTextColor={colors.textSecondary}
                  value={businessEmail}
                  onChangeText={setBusinessEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Business Phone</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.textSecondary}
                  value={businessPhone}
                  onChangeText={setBusinessPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Additional Verification (optional)</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Any additional information to help verify your ownership..."
                  placeholderTextColor={colors.textSecondary}
                  value={verificationDetails}
                  onChangeText={setVerificationDetails}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: businessRole.trim() && (businessEmail.trim() || businessPhone.trim()) ? colors.primary : colors.border }
              ]}
              onPress={handleSubmitClaim}
              disabled={isSubmitting || !businessRole.trim() || (!businessEmail.trim() && !businessPhone.trim())}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.submitButtonText, { color: businessRole.trim() && (businessEmail.trim() || businessPhone.trim()) ? '#FFFFFF' : colors.textSecondary }]}>
                  Submit Claim
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
              By submitting, you confirm that you have the authority to claim this business. We may contact you to verify ownership.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingBottom: 80,
  },
  webContent: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  logo: {
    width: 180,
    height: 52,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  resultsContainer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  resultLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  resultLogoImage: {
    width: '100%',
    height: '100%',
  },
  resultLogoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLogoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
    marginRight: 8,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  resultAddress: {
    fontSize: 13,
    marginBottom: 2,
  },
  resultCategory: {
    fontSize: 12,
  },
  noResults: {
    marginTop: 16,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  noResultsSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  selectedLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  selectedLogoImage: {
    width: '100%',
    height: '100%',
  },
  selectedLogoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedLogoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectedAddress: {
    fontSize: 13,
    marginBottom: 2,
  },
  selectedCategory: {
    fontSize: 12,
    fontWeight: '600',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 80,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Existing claims styles
  claimCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  claimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  claimName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  claimAddress: {
    fontSize: 13,
  },
  claimNotes: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
