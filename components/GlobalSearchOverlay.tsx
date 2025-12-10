import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Search, X, ChevronRight, MapPin } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { formatCategory } from '@/services/firebase/placesService';

// This component renders the search input and results as content (not an overlay)
// It's meant to be rendered inside a tab's content area, replacing normal content when search is active
export default function GlobalSearchOverlay() {
  const router = useRouter();
  const { isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const inputRef = useRef<TextInput>(null);
  const {
    isSearchActive,
    searchQuery,
    searchResults,
    placesResults,
    loadingSearch,
    loadingPlaces,
    handleSearch,
    clearSearch,
  } = useGlobalSearch();

  // Auto-focus the input when search becomes active
  useEffect(() => {
    if (isSearchActive && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isSearchActive]);

  if (!isSearchActive) {
    return null;
  }

  const handleItemPress = (item: any) => {
    clearSearch(); // Close search when navigating
    if (item.resultType === 'user') {
      router.push(`/user/${item.id}`);
    } else if (item.resultType === 'business') {
      router.push(`/business/${item.id}`);
    } else {
      router.push(`/brand/${item.id}`);
    }
  };

  const handlePlacePress = (placeId: string) => {
    clearSearch(); // Close search when navigating
    router.push(`/place/${placeId}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Input Bar */}
      <View style={[styles.searchBarContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Search size={20} color={colors.primary} strokeWidth={2} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search users, brands, places..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch('')}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={clearSearch}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Search Results Content */}
      <View style={styles.resultsContainer}>
        {searchQuery.trim().length === 0 ? (
          <View style={styles.emptySection}>
            <Search size={48} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={[styles.emptySectionTitle, { color: colors.text }]}>Search</Text>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              Search for users, businesses, and brands
            </Text>
          </View>
        ) : searchResults.length === 0 && placesResults.length === 0 && !loadingSearch && !loadingPlaces ? (
          <View style={styles.emptySection}>
            <Text style={[styles.emptySectionTitle, { color: colors.text }]}>No results found</Text>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              Try searching for a different product or brand
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.searchResultsScroll} showsVerticalScrollIndicator={false}>
            {/* Loading indicator */}
            {loadingSearch && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Searching...</Text>
              </View>
            )}

            {/* Database Results */}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsSection}>
                <Text style={[styles.searchResultsSectionTitle, { color: colors.textSecondary }]}>
                  Results ({searchResults.length})
                </Text>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={`${item.resultType}-${item.id}`}
                    style={styles.searchResultItem}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultInner}>
                      <View style={[styles.searchResultLogo, { backgroundColor: '#FFFFFF' }]}>
                        {item.exampleImageUrl || item.profileImage ? (
                          <Image
                            source={{ uri: item.exampleImageUrl || item.profileImage }}
                            style={styles.searchResultLogoImage}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View style={[styles.searchResultLogoPlaceholder, { backgroundColor: colors.primary }]}>
                            <Text style={styles.searchResultLogoText}>
                              {item.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.searchResultText}>
                        <Text style={[styles.searchResultName, { color: colors.text }]} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={[styles.searchResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.resultType === 'user' ? (item.location || 'User') :
                           item.resultType === 'business' ? (item.category || 'Business') :
                           (item.brand || item.category || 'Brand')}
                        </Text>
                        {item.bio && (
                          <Text style={[styles.searchResultBio, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.bio}
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Google Places Results */}
            {loadingPlaces && (
              <View style={styles.searchResultsSection}>
                <Text style={[styles.searchResultsSectionTitle, { color: colors.textSecondary }]}>
                  Searching all businesses...
                </Text>
              </View>
            )}

            {!loadingPlaces && placesResults.length > 0 && (
              <View style={styles.searchResultsSection}>
                <Text style={[styles.searchResultsSectionTitle, { color: colors.textSecondary }]}>
                  All Businesses ({placesResults.length})
                </Text>
                {placesResults.map((place) => (
                  <TouchableOpacity
                    key={place.placeId}
                    style={styles.searchResultItem}
                    onPress={() => handlePlacePress(place.placeId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultInner}>
                      <View style={[styles.searchResultLogo, { backgroundColor: colors.backgroundSecondary }]}>
                        <Image
                          source={require('@/assets/images/yendorseicon.png')}
                          style={styles.searchResultLogoImage}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
                      </View>
                      <View style={styles.searchResultText}>
                        <Text style={[styles.searchResultName, { color: colors.text }]} numberOfLines={2}>
                          {place.name}
                        </Text>
                        <Text style={[styles.searchResultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                          {formatCategory(place.category)}{place.rating ? ` · ${place.rating}★` : ''}
                        </Text>
                        {place.address && (
                          <View style={styles.addressRow}>
                            <MapPin size={12} color={colors.textSecondary} strokeWidth={2} />
                            <Text style={[styles.searchResultAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                              {place.address}
                            </Text>
                          </View>
                        )}
                      </View>
                      <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Bottom padding */}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  clearButton: {
    padding: 4,
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  emptySection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptySectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySectionText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  searchResultsScroll: {
    flex: 1,
  },
  searchResultsSection: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  searchResultsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchResultItem: {
    marginBottom: 8,
  },
  searchResultInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  searchResultLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultLogoImage: {
    width: '100%',
    height: '100%',
  },
  searchResultLogoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultLogoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchResultText: {
    flex: 1,
    gap: 2,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchResultCategory: {
    fontSize: 13,
  },
  searchResultBio: {
    fontSize: 12,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  searchResultAddress: {
    fontSize: 12,
    flex: 1,
  },
});
