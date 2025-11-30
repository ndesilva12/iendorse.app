import { useRouter, useLocalSearchParams } from 'expo-router';
import { Heart, Shield, Users, Building2, Globe, User, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Trophy, Search, MapPin, ChevronRight, AlertCircle, Check, LogOut, X, Sparkles } from 'lucide-react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { Cause, CauseCategory, AlignmentType } from '@/types';
import { searchPlaces, PlaceSearchResult, getPlacePhotoUrl } from '@/services/firebase/placesService';
import { submitBusinessClaim, getClaimsByUser, BusinessClaim } from '@/services/firebase/businessClaimService';
import * as Location from 'expo-location';
import debounce from 'lodash/debounce';

// Icon mappings for common categories (with fallbacks)
const CATEGORY_ICONS: Record<string, any> = {
  social_issue: Heart,
  religion: Building2,
  ideology: Users,
  corporation: Building2,
  nation: Globe,
  organization: Shield,
  person: User,
  sports: Trophy,
  lifestyle: Heart,
};

// Label mappings for common categories (with dynamic fallback)
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

const getCategoryIcon = (category: string) => {
  const normalized = normalizeCategory(category);
  return CATEGORY_ICONS[normalized] || Heart;
};

const getCategoryLabel = (category: string) => {
  const normalized = normalizeCategory(category);
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
  return category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

interface SelectedValue {
  id: string;
  name: string;
  category: CauseCategory;
  type: AlignmentType;
  description?: string;
}

type OnboardingStep = 'claim_business' | 'select_values';

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountType?: string }>();
  const { signOut } = useAuth();
  const { addCauses, profile, isDarkMode, clerkUser, isLoading, setAccountType, clearAllStoredData } = useUser();
  const { values: firebaseValues } = useData();
  const colors = isDarkMode ? darkColors : lightColors;
  const insets = useSafeAreaInsets();

  // Redirect users who have already completed onboarding
  // This handles the case where a user's claim was approved while they were offline
  // OR an existing business user who already has values selected
  useEffect(() => {
    if (!isLoading && profile?.causes?.length > 0) {
      // User has completed values selection - they should go to home
      // Business users don't NEED businessInfo to use the app
      console.log('[Onboarding] User already has causes, redirecting to home');
      router.replace('/(tabs)/home');
      return;
    }
  }, [isLoading, profile?.causes?.length]);

  // Handler to exit onboarding and sign out
  const handleExitOnboarding = async () => {
    const doExit = async () => {
      try {
        console.log('[Onboarding] Exiting onboarding...');
        // Clear any local data that was saved
        await clearAllStoredData();
        // Sign out of Clerk
        await signOut();
        // Navigate to sign-in
        router.replace('/(auth)/sign-in');
      } catch (error) {
        console.error('[Onboarding] Error signing out:', error);
        // Force navigation even on error
        router.replace('/(auth)/sign-in');
      }
    };

    if (Platform.OS === 'web') {
      // Use browser confirm dialog on web
      if (window.confirm('Are you sure you want to exit? Your progress will not be saved.')) {
        await doExit();
      }
    } else {
      // Use native Alert on mobile
      Alert.alert(
        'Exit Onboarding',
        'Are you sure you want to exit? Your progress will not be saved.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: doExit },
        ]
      );
    }
  };

  // Direct sign out without confirmation - emergency escape
  const handleForceSignOut = async () => {
    try {
      console.log('[Onboarding] Force sign out...');
      await clearAllStoredData();
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('[Onboarding] Force sign out error:', error);
      // Try to navigate anyway
      router.replace('/(auth)/sign-in');
    }
  };

  // Determine if this is a business user - check query param first, then profile
  // Query param is passed from sign-up to handle the race condition where profile isn't loaded yet
  const isBusinessUser = params.accountType === 'business' || profile?.accountType === 'business';

  console.log('[Onboarding] accountType from params:', params.accountType);
  console.log('[Onboarding] accountType from profile:', profile?.accountType);
  console.log('[Onboarding] isBusinessUser:', isBusinessUser);

  // Step management for business users
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(isBusinessUser ? 'claim_business' : 'select_values');
  const [hasSubmittedClaim, setHasSubmittedClaim] = useState(false);
  const [isCheckingClaims, setIsCheckingClaims] = useState(isBusinessUser);

  // Business claim state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [businessRole, setBusinessRole] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [verificationDetails, setVerificationDetails] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // Values selection state
  const [selectedValues, setSelectedValues] = useState<SelectedValue[]>(() => {
    return profile.causes.map(c => ({
      id: c.id,
      name: c.name,
      category: c.category,
      type: c.type,
      description: c.description,
    }));
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Welcome modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Update step when isBusinessUser is determined (handles late-loading params)
  useEffect(() => {
    if (isBusinessUser && currentStep === 'select_values' && !hasSubmittedClaim) {
      console.log('[Onboarding] Business user detected, switching to claim step');
      setCurrentStep('claim_business');
      setIsCheckingClaims(true);
    }
  }, [isBusinessUser]);

  // Check if business user already has claims
  useEffect(() => {
    const checkExistingClaims = async () => {
      if (!isBusinessUser || !clerkUser?.id) {
        setIsCheckingClaims(false);
        return;
      }

      try {
        const claims = await getClaimsByUser(clerkUser.id);
        if (claims.length > 0) {
          console.log('[Onboarding] Business user already has claims, skipping to values');
          setHasSubmittedClaim(true);
          setCurrentStep('select_values');
        }
      } catch (error) {
        console.error('[Onboarding] Error checking claims:', error);
      } finally {
        setIsCheckingClaims(false);
      }
    };

    checkExistingClaims();
  }, [isBusinessUser, clerkUser?.id]);

  // Get user location for business search
  useEffect(() => {
    if (isBusinessUser && currentStep === 'claim_business') {
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
          console.log('[Onboarding] Could not get location:', error);
        }
      })();
    }
  }, [isBusinessUser, currentStep]);

  // Debounced search for businesses
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
        console.error('[Onboarding] Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [userLocation]
  );

  useEffect(() => {
    if (currentStep === 'claim_business') {
      debouncedSearch(searchQuery);
      return () => debouncedSearch.cancel();
    }
  }, [searchQuery, debouncedSearch, currentStep]);

  // Group values by category
  const valuesByCategory = firebaseValues.reduce((acc, value) => {
    const normalizedCategory = normalizeCategory(value.category || 'other');
    if (!acc[normalizedCategory]) {
      acc[normalizedCategory] = [];
    }
    acc[normalizedCategory].push(value);
    return acc;
  }, {} as Record<string, typeof firebaseValues>);

  const knownCategories = CATEGORY_ORDER.filter(cat => valuesByCategory[cat]);
  const unknownCategories = Object.keys(valuesByCategory)
    .filter(cat => !CATEGORY_ORDER.includes(cat))
    .sort();
  const categories = [...knownCategories, ...unknownCategories];

  const minValues = 3;

  useEffect(() => {
    if (profile.causes.length > 0) {
      setSelectedValues(profile.causes.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        type: c.type,
        description: c.description,
      })));
    }
  }, [profile.causes]);

  const handleSelectPlace = (place: PlaceSearchResult) => {
    setSelectedPlace(place);
    setSearchQuery('');
    setSearchResults([]);
  };

  const getPlacePhoto = (place: PlaceSearchResult) => {
    if (place.photoReference) {
      return getPlacePhotoUrl(place.photoReference);
    }
    return null;
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

    setIsSubmittingClaim(true);
    try {
      // Submit the claim - user document will be created when onboarding completes
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

      console.log('[Onboarding] Business claim submitted successfully');
      setHasSubmittedClaim(true);

      // Navigate directly to values selection - no Alert needed for web compatibility
      setCurrentStep('select_values');
    } catch (error: any) {
      console.error('[Onboarding] Error submitting claim:', error);
      Alert.alert('Error', error?.message || 'Failed to submit claim. Please try again.');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const toggleValue = (valueId: string, name: string, category: string, description?: string) => {
    setSelectedValues(prev => {
      const existing = prev.find(v => v.id === valueId);

      if (!existing) {
        return [...prev, { id: valueId, name, category, type: 'support', description }];
      }

      if (existing.type === 'support') {
        return prev.map(v =>
          v.id === valueId ? { ...v, type: 'avoid' as AlignmentType } : v
        );
      }

      return prev.filter(v => v.id !== valueId);
    });
  };

  const getValueState = (valueId: string): 'unselected' | 'support' | 'avoid' => {
    const found = selectedValues.find(v => v.id === valueId);
    if (!found) return 'unselected';
    return found.type;
  };

  const handleContinue = async () => {
    console.log('[Onboarding] Continue pressed with', selectedValues.length, 'values');
    if (selectedValues.length >= minValues) {
      const causes: Cause[] = selectedValues.map(v => ({
        id: v.id,
        name: v.name,
        category: v.category,
        type: v.type,
        description: v.description,
      }));
      console.log('[Onboarding] Saving causes for user:', clerkUser?.id);
      await addCauses(causes);
      console.log('[Onboarding] addCauses completed');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Show custom welcome modal
      setShowWelcomeModal(true);
    }
  };

  const handleWelcomeComplete = () => {
    setShowWelcomeModal(false);
    console.log('[Onboarding] Redirecting to browse tab');
    router.replace('/(tabs)/values');
  };

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

  // Show loading while checking claims for business users
  if (isCheckingClaims) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // STEP 1: Business Claim (for business users only)
  if (isBusinessUser && currentStep === 'claim_business') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }, Platform.OS === 'web' && styles.webContent]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/endorsemobile.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.exitButtonsRow}>
                <TouchableOpacity
                  style={[styles.exitButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={handleExitOnboarding}
                  activeOpacity={0.7}
                >
                  <LogOut size={18} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.exitButtonText, { color: colors.textSecondary }]}>Sign Out</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exitIconButton, { backgroundColor: colors.danger + '20' }]}
                  onPress={handleForceSignOut}
                  activeOpacity={0.7}
                >
                  <X size={20} color={colors.danger} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.stepIndicator, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.stepText, { color: colors.primary }]}>Step 1 of 2</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Claim Your Business</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Search for your business and claim ownership to manage your profile on iEndorse
            </Text>
          </View>

          {/* Search Section */}
          {!selectedPlace && (
            <View style={styles.section}>
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
                    Try a different search term
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Selected Business + Form */}
          {selectedPlace && (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Business</Text>
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
                  </View>
                  <TouchableOpacity onPress={() => setSelectedPlace(null)} style={styles.changeButton}>
                    <Text style={[styles.changeButtonText, { color: colors.primary }]}>Change</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Verification Info</Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Your Role *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g., Owner, Manager"
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
                  <Text style={[styles.label, { color: colors.text }]}>Additional Info (optional)</Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="Any additional verification details..."
                    placeholderTextColor={colors.textSecondary}
                    value={verificationDetails}
                    onChangeText={setVerificationDetails}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer for Business Claim Step */}
        <View style={[styles.footer, { paddingBottom: 32 + insets.bottom, backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }, Platform.OS === 'web' && styles.footerWeb]}>
          <View style={[styles.footerContent, Platform.OS === 'web' && styles.footerContentWeb]}>
            <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
              {selectedPlace ? 'Ready to submit your claim' : 'Search and select your business above'}
            </Text>
            <TouchableOpacity
              style={[
                styles.continueButton,
                { backgroundColor: selectedPlace && businessRole.trim() && (businessEmail.trim() || businessPhone.trim()) ? colors.primary : colors.neutral },
                (!selectedPlace || !businessRole.trim() || (!businessEmail.trim() && !businessPhone.trim())) && { opacity: 0.5 }
              ]}
              onPress={handleSubmitClaim}
              disabled={isSubmittingClaim || !selectedPlace || !businessRole.trim() || (!businessEmail.trim() && !businessPhone.trim())}
              activeOpacity={0.8}
            >
              {isSubmittingClaim ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.continueButtonText, { color: colors.white }]}>Submit Claim & Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // STEP 2: Values Selection (for all users, or step 2 for business)
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }, Platform.OS === 'web' && styles.webContent]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/endorsemobile.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.exitButtonsRow}>
              <TouchableOpacity
                style={[styles.exitButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleExitOnboarding}
                activeOpacity={0.7}
              >
                <LogOut size={18} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.exitButtonText, { color: colors.textSecondary }]}>Sign Out</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exitIconButton, { backgroundColor: colors.danger + '20' }]}
                onPress={handleForceSignOut}
                activeOpacity={0.7}
              >
                <X size={20} color={colors.danger} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
          {isBusinessUser && (
            <View style={[styles.stepIndicator, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.stepComplete}>
                <Check size={14} color={colors.success} strokeWidth={3} />
              </View>
              <Text style={[styles.stepText, { color: colors.primary }]}>Step 2 of 2</Text>
            </View>
          )}
          <Text style={[styles.title, { color: colors.text }]}>Identify Your Values</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select a positive or negative view of at least {minValues} items you feel strongly about.
          </Text>
          <View style={[styles.instructionBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              <Text style={[styles.instructionBold, { color: colors.text }]}>Tap once</Text> to support a value
            </Text>
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              <Text style={[styles.instructionBold, { color: colors.text }]}>Tap twice</Text> to oppose a value
            </Text>
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              <Text style={[styles.instructionBold, { color: colors.text }]}>Tap three times</Text> to deselect
            </Text>
          </View>
        </View>

        <View style={styles.causesContainer}>
          {categories.map((category) => {
            const values = valuesByCategory[category];
            if (!values || values.length === 0) return null;
            const Icon = getCategoryIcon(category);
            const isExpanded = expandedCategories.has(category);
            const displayedValues = isExpanded ? values : values.slice(0, 10);
            const hasMore = values.length > 10;

            return (
              <View key={category} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Icon size={20} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>
                    {getCategoryLabel(category)}
                  </Text>
                </View>
                <View style={styles.valuesGrid}>
                  {displayedValues.map(value => {
                    const state = getValueState(value.id);
                    return (
                      <TouchableOpacity
                        key={value.id}
                        style={[
                          styles.valueChip,
                          { borderColor: colors.border },
                          state === 'support' && { backgroundColor: colors.success, borderColor: colors.success },
                          state === 'avoid' && { backgroundColor: colors.danger, borderColor: colors.danger },
                        ]}
                        onPress={() => toggleValue(value.id, value.name, normalizeCategory(value.category), value.description)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.valueChipText,
                            { color: colors.text },
                            (state === 'support' || state === 'avoid') && { color: colors.white },
                          ]}
                          numberOfLines={1}
                        >
                          {value.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {hasMore && (
                  <TouchableOpacity
                    style={[styles.showMoreButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => toggleCategoryExpanded(category)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.showMoreText, { color: colors.primary }]}>
                      {isExpanded ? 'Show Less' : `Show ${values.length - 10} More`}
                    </Text>
                    {isExpanded ? (
                      <ChevronUp size={16} color={colors.primary} strokeWidth={2} />
                    ) : (
                      <ChevronDown size={16} color={colors.primary} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 32 + insets.bottom, backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }, Platform.OS === 'web' && styles.footerWeb]}>
        <View style={[styles.footerContent, Platform.OS === 'web' && styles.footerContentWeb]}>
          <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
            {selectedValues.length} {selectedValues.length === 1 ? 'value' : 'values'} selected{selectedValues.length < minValues ? ` (minimum ${minValues} required)` : ''}
          </Text>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.primary }, selectedValues.length < minValues && { backgroundColor: colors.neutral, opacity: 0.5 }]}
            onPress={handleContinue}
            disabled={selectedValues.length < minValues}
            activeOpacity={0.8}
          >
            <Text style={[styles.continueButtonText, { color: colors.white }]}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Welcome Modal */}
      <Modal
        visible={showWelcomeModal}
        transparent
        animationType="fade"
        onRequestClose={handleWelcomeComplete}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.welcomeModal, { backgroundColor: colors.background }]}>
            {/* Close button */}
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={handleWelcomeComplete}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>

            {/* Icon */}
            <Sparkles size={48} color={colors.primary} strokeWidth={1.5} style={styles.welcomeIcon} />

            {/* Title */}
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Welcome to Endorse!
            </Text>

            {/* Message */}
            <Text style={[styles.welcomeMessage, { color: colors.textSecondary }]}>
              {isBusinessUser
                ? 'Set discounts in the Money tab and endorse other businesses in the List tab.'
                : 'Endorse businesses you support and look for discounts.'}
            </Text>

            {/* Button */}
            <TouchableOpacity
              style={[styles.welcomeButton, { backgroundColor: colors.primary }]}
              onPress={handleWelcomeComplete}
              activeOpacity={0.8}
            >
              <Text style={styles.welcomeButtonText}>Let's Go!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {},
  webContent: {
    maxWidth: 768,
    alignSelf: 'center' as const,
    width: '100%',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  exitButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  exitButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  exitIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flex: 1,
    maxWidth: 160,
    height: 60,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  stepComplete: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  instructionBox: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionBold: {
    fontWeight: '600' as const,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 12,
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
    fontWeight: '700' as const,
  },
  resultInfo: {
    flex: 1,
    marginRight: 8,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
    marginTop: 12,
  },
  noResultsSubtext: {
    fontSize: 14,
    marginTop: 4,
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
    fontWeight: '700' as const,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  selectedAddress: {
    fontSize: 13,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
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
  causesContainer: {
    paddingHorizontal: 24,
  },
  categorySection: {
    marginBottom: 32,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  valueChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  showMoreButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  footerWeb: {
    alignItems: 'center',
  },
  footerContent: {
    width: '100%',
  },
  footerContentWeb: {
    width: '50%',
    maxWidth: 400,
  },
  selectedCount: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  // Welcome Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  welcomeModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeIcon: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },
  welcomeButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  welcomeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600' as const,
  },
});
