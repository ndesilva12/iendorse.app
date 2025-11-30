import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { ArrowLeft, Share2, ExternalLink, Home, LogIn, MapPin, X } from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Share,
  Alert,
  Linking,
  Dimensions,
  PanResponder,
  Modal,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { getLogoUrl } from '@/lib/logo';
import { getList } from '@/services/firebase/listService';
import { getPlacePhotoUrl } from '@/services/firebase/placesService';
import { UserList, ListEntry } from '@/types/library';
import * as Clipboard from 'expo-clipboard';
import EndorsedBadge from '@/components/EndorsedBadge';
import MenuButton from '@/components/MenuButton';
import EndorsementMapView, { MapEntry } from '@/components/EndorsementMapView';

// Category definitions for filtering
const CUSTOM_CATEGORIES = [
  { id: 'technology', label: 'Technology', color: '#3B82F6' },
  { id: 'retail', label: 'Retail', color: '#10B981' },
  { id: 'food_beverage', label: 'Food & Beverage', color: '#F59E0B' },
  { id: 'finance', label: 'Finance', color: '#6366F1' },
  { id: 'automotive', label: 'Automotive', color: '#EF4444' },
  { id: 'entertainment', label: 'Entertainment', color: '#EC4899' },
  { id: 'health_wellness', label: 'Health & Wellness', color: '#14B8A6' },
  { id: 'fashion', label: 'Fashion', color: '#8B5CF6' },
  { id: 'travel', label: 'Travel', color: '#06B6D4' },
  { id: 'other', label: 'Other', color: '#6B7280' },
];

// Map any category string to one of our custom categories
const mapToCustomCategory = (category: string | undefined): string => {
  if (!category) return 'other';
  const lower = category.toLowerCase().replace(/[_\s&]+/g, ' ').trim();

  if (lower.includes('tech') || lower.includes('software') || lower.includes('computer') ||
      lower.includes('electron') || lower.includes('internet') || lower.includes('digital')) {
    return 'technology';
  }
  if (lower.includes('retail') || lower.includes('store') || lower.includes('shop') ||
      lower.includes('supermarket') || lower.includes('grocery')) {
    return 'retail';
  }
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe') ||
      lower.includes('coffee') || lower.includes('bakery') || lower.includes('bar') ||
      lower.includes('beverage') || lower.includes('pizza') || lower.includes('dining')) {
    return 'food_beverage';
  }
  if (lower.includes('bank') || lower.includes('financ') || lower.includes('insurance') ||
      lower.includes('invest') || lower.includes('credit')) {
    return 'finance';
  }
  if (lower.includes('auto') || lower.includes('car') || lower.includes('vehicle') ||
      lower.includes('motor') || lower.includes('dealer')) {
    return 'automotive';
  }
  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('theater') ||
      lower.includes('music') || lower.includes('game') || lower.includes('gaming')) {
    return 'entertainment';
  }
  if (lower.includes('health') || lower.includes('medical') || lower.includes('hospital') ||
      lower.includes('clinic') || lower.includes('pharmacy') || lower.includes('fitness') ||
      lower.includes('gym') || lower.includes('spa') || lower.includes('wellness')) {
    return 'health_wellness';
  }
  if (lower.includes('fashion') || lower.includes('clothing') || lower.includes('apparel') ||
      lower.includes('shoe') || lower.includes('jewelry') || lower.includes('beauty') ||
      lower.includes('salon') || lower.includes('boutique')) {
    return 'fashion';
  }
  if (lower.includes('travel') || lower.includes('hotel') || lower.includes('resort') ||
      lower.includes('airline') || lower.includes('flight') || lower.includes('tour')) {
    return 'travel';
  }
  return 'other';
};

export default function SharedListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDarkMode, clerkUser } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const { brands, values } = useData();

  const isSignedIn = !!clerkUser;

  const [list, setList] = useState<UserList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [localFilter, setLocalFilter] = useState<'all' | 'local'>('all');

  // Map modal state
  const [showMapModal, setShowMapModal] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 100) {
          if (isSignedIn) {
            router.push('/(tabs)/home');
          }
        }
      },
    })
  ).current;

  useEffect(() => {
    loadList();
  }, [id]);

  const loadList = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedList = await getList(id);
      if (!fetchedList) {
        setError('List not found');
      } else {
        setList(fetchedList);
      }
    } catch (err) {
      console.error('Error loading list:', err);
      setError('Failed to load list');
    } finally {
      setIsLoading(false);
    }
  };

  // Get category for an entry
  const getEntryCategory = (entry: ListEntry): string | undefined => {
    if (entry.type === 'brand') {
      const brand = brands.find(b => b.id === entry.brandId);
      return brand?.category || (entry as any).brandCategory;
    }
    if (entry.type === 'business') {
      return (entry as any).businessCategory;
    }
    if (entry.type === 'place') {
      return (entry as any).placeCategory;
    }
    return undefined;
  };

  // Check if entry is local (place type)
  const isLocalEntry = (entry: ListEntry): boolean => {
    return entry.type === 'place';
  };

  // Filter entries based on current filters
  const filteredEntries = useMemo(() => {
    if (!list?.entries) return [];

    let entries = list.entries;

    // Apply local filter
    if (localFilter === 'local') {
      entries = entries.filter(isLocalEntry);
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      entries = entries.filter(entry => {
        const category = getEntryCategory(entry);
        const categoryId = mapToCustomCategory(category);
        return categoryId === categoryFilter;
      });
    }

    return entries;
  }, [list?.entries, localFilter, categoryFilter, brands]);

  // Get unique categories present in the list
  const uniqueCategories = useMemo(() => {
    if (!list?.entries) return [];

    const categorySet = new Set<string>();
    list.entries.forEach(entry => {
      const category = getEntryCategory(entry);
      const categoryId = mapToCustomCategory(category);
      if (categoryId !== 'other') {
        categorySet.add(categoryId);
      }
    });

    // Also add 'other' if there are items with no/unknown category
    const hasOther = list.entries.some(entry => {
      const category = getEntryCategory(entry);
      return mapToCustomCategory(category) === 'other';
    });
    if (hasOther) {
      categorySet.add('other');
    }

    return CUSTOM_CATEGORIES.filter(cat => categorySet.has(cat.id));
  }, [list?.entries, brands]);

  // Check if there are any local entries
  const hasLocalEntries = useMemo(() => {
    return list?.entries?.some(isLocalEntry) || false;
  }, [list?.entries]);

  // Generate map entries from filtered list
  const mapEntries = useMemo((): MapEntry[] => {
    if (!list?.entries) return [];

    const entries: MapEntry[] = [];

    // Apply same filters as the list view
    let entriesToMap = list.entries;
    if (localFilter === 'local') {
      entriesToMap = entriesToMap.filter(isLocalEntry);
    }
    if (categoryFilter !== 'all') {
      entriesToMap = entriesToMap.filter(entry => {
        const category = getEntryCategory(entry);
        const categoryId = mapToCustomCategory(category);
        return categoryId === categoryFilter;
      });
    }

    entriesToMap.forEach(entry => {
      if (entry.type === 'place') {
        const placeEntry = entry as any;
        if (placeEntry.location?.lat && placeEntry.location?.lng) {
          entries.push({
            id: placeEntry.placeId,
            name: placeEntry.placeName,
            category: placeEntry.placeCategory,
            address: placeEntry.placeAddress,
            logoUrl: placeEntry.logoUrl,
            location: {
              lat: placeEntry.location.lat,
              lng: placeEntry.location.lng,
            },
            type: 'place',
            originalEntry: entry,
          });
        }
      } else if (entry.type === 'brand') {
        const brandEntry = entry as any;
        const brand = brands.find(b => b.id === brandEntry.brandId);
        if (brand?.latitude && brand?.longitude) {
          entries.push({
            id: brandEntry.brandId,
            name: brandEntry.brandName || brand?.name,
            category: brandEntry.brandCategory || brand?.category,
            address: brand?.location,
            logoUrl: brandEntry.logoUrl,
            location: {
              lat: brand.latitude,
              lng: brand.longitude,
            },
            type: 'brand',
            originalEntry: entry,
          });
        }
      }
    });

    return entries;
  }, [list?.entries, brands, localFilter, categoryFilter]);

  const handleShare = async () => {
    if (!list) return;

    const shareMessage = `Check out "${list.name}" on iEndorse!\n\n` +
      (list.creatorName ? `Created by: ${list.creatorName}\n` : '') +
      (list.description ? `${list.description}\n\n` : '') +
      `${list.entries.length} ${list.entries.length === 1 ? 'item' : 'items'}`;
    const shareLink = `https://iendorse.app/list/${list.id}`;
    const shareMessageWithLink = `${shareMessage}\n\n${shareLink}`;

    try {
      await Share.share({
        message: shareMessageWithLink,
        title: list.name,
      });
    } catch (error) {
      console.error('Error sharing list:', error);
    }
  };

  const handleCopyLink = async () => {
    if (!list) return;

    const shareLink = `https://iendorse.app/list/${list.id}`;
    try {
      await Clipboard.setStringAsync(shareLink);
      Alert.alert('Success', 'Link copied to clipboard!');
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert('Error', 'Could not copy link');
    }
  };

  const handleGoHome = () => {
    router.push('/(tabs)/home');
  };

  const handleSignIn = () => {
    router.push('/(auth)/sign-in');
  };

  const handleSignUp = () => {
    router.push('/(auth)/sign-up');
  };

  const renderListEntry = (entry: ListEntry) => {
    if (entry.type === 'brand') {
      // Try to find brand by brandId first, then by name
      let brand = brands.find(b => b.id === entry.brandId);
      if (!brand && entry.brandName) {
        brand = brands.find(b => b.name.toLowerCase() === entry.brandName?.toLowerCase());
      }

      // Even if brand not found in database, we can still render with the entry data
      const brandName = brand?.name || entry.brandName || entry.name || 'Unknown Brand';
      const brandWebsite = brand?.website || entry.website || '';
      const logoUrl = entry.logoUrl || (brandWebsite ? getLogoUrl(brandWebsite, { size: 128 }) : '');

      return (
        <TouchableOpacity
          key={entry.id}
          style={[styles.entryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => {
            if (brand) {
              router.push(`/brand/${brand.id}`);
            } else if (entry.brandId) {
              router.push(`/brand/${entry.brandId}`);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.entryImageContainer}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.entryImage}
                contentFit="contain"
              />
            ) : (
              <View style={[styles.entryImagePlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.entryImagePlaceholderText}>{brandName.charAt(0)}</Text>
              </View>
            )}
          </View>
          <View style={styles.entryInfo}>
            <Text style={[styles.entryName, { color: colors.text }]}>{brandName}</Text>
            <Text style={[styles.entryType, { color: colors.textSecondary }]}>Brand</Text>
          </View>
          <ExternalLink size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      );
    }

    if (entry.type === 'business') {
      const businessName = entry.businessName || entry.name || 'Unknown Business';
      const logoUrl = entry.logoUrl || (entry.website ? getLogoUrl(entry.website, { size: 128 }) : '');

      return (
        <TouchableOpacity
          key={entry.id}
          style={[styles.entryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => {
            if (entry.businessId) {
              router.push(`/business/${entry.businessId}`);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.entryImageContainer}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.entryImage}
                contentFit="contain"
              />
            ) : (
              <View style={[styles.entryImagePlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.entryImagePlaceholderText}>{businessName.charAt(0)}</Text>
              </View>
            )}
          </View>
          <View style={styles.entryInfo}>
            <Text style={[styles.entryName, { color: colors.text }]}>{businessName}</Text>
            <Text style={[styles.entryType, { color: colors.textSecondary }]}>Business</Text>
          </View>
          <ExternalLink size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      );
    }

    if (entry.type === 'place') {
      const placeEntry = entry as any;
      const placeName = placeEntry.placeName || entry.name || 'Unknown Place';
      // Get logo URL from cached logoUrl, or generate from photoReference
      let logoUrl = placeEntry.logoUrl || '';
      if (!logoUrl && placeEntry.photoReference) {
        logoUrl = getPlacePhotoUrl(placeEntry.photoReference);
      }
      if (!logoUrl && placeEntry.website) {
        logoUrl = getLogoUrl(placeEntry.website, { size: 128 });
      }

      return (
        <TouchableOpacity
          key={entry.id}
          style={[styles.entryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => {
            if (placeEntry.placeId) {
              router.push(`/place/${placeEntry.placeId}`);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.entryImageContainer}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.entryImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.entryImagePlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.entryImagePlaceholderText}>{placeName.charAt(0)}</Text>
              </View>
            )}
          </View>
          <View style={styles.entryInfo}>
            <Text style={[styles.entryName, { color: colors.text }]}>{placeName}</Text>
            <Text style={[styles.entryType, { color: colors.textSecondary }]}>
              {placeEntry.placeCategory || 'Local Business'}
            </Text>
          </View>
          <ExternalLink size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      );
    }

    if (entry.type === 'value') {
      const value = values.find(v => v.id === entry.valueId);
      if (!value) return null;

      return (
        <View
          key={entry.id}
          style={[styles.entryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        >
          <View style={styles.entryInfo}>
            <Text style={[styles.entryName, { color: colors.text }]}>{value.name}</Text>
            <Text style={[styles.entryType, { color: colors.textSecondary }]}>
              Value • {entry.mode === 'support' ? 'Support' : 'Avoid'}
            </Text>
          </View>
        </View>
      );
    }

    if (entry.type === 'link') {
      return (
        <TouchableOpacity
          key={entry.id}
          style={[styles.entryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.open(entry.url, '_blank');
            } else {
              Linking.openURL(entry.url || '');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.entryInfo}>
            <Text style={[styles.entryName, { color: colors.text }]}>{entry.title}</Text>
            <Text style={[styles.entryType, { color: colors.textSecondary }]} numberOfLines={1}>
              {entry.url}
            </Text>
          </View>
          <ExternalLink size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      );
    }

    if (entry.type === 'text') {
      return (
        <View
          key={entry.id}
          style={[styles.entryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        >
          <View style={styles.entryInfo}>
            <Text style={[styles.entryText, { color: colors.text }]}>{entry.content}</Text>
          </View>
        </View>
      );
    }

    return null;
  };

  // App header component - same style as tab screens
  const renderAppHeader = () => (
    <View style={[styles.appHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.appHeaderContent}>
        <TouchableOpacity onPress={handleGoHome} activeOpacity={0.7}>
          <Image
            source={require('@/assets/images/endorsemulti1.png')}
            style={styles.headerLogo}
            contentFit="contain"
          />
        </TouchableOpacity>
        {isSignedIn ? (
          <MenuButton />
        ) : (
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={[styles.signInButton, { borderColor: colors.primary }]}
              onPress={handleSignIn}
              activeOpacity={0.7}
            >
              <Text style={[styles.signInButtonText, { color: colors.primary }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.signUpButton, { backgroundColor: colors.primary }]}
              onPress={handleSignUp}
              activeOpacity={0.7}
            >
              <Text style={[styles.signUpButtonText, { color: colors.white }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  // Sign up banner for non-authenticated users
  const renderSignUpBanner = () => {
    if (isSignedIn) return null;

    return (
      <View style={[styles.signUpBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
        <View style={styles.signUpBannerContent}>
          <Text style={[styles.signUpBannerTitle, { color: colors.text }]}>
            Create your own endorsement list
          </Text>
          <Text style={[styles.signUpBannerText, { color: colors.textSecondary }]}>
            Join iEndorse to build and share your personalized list of brands and businesses you support.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.signUpBannerButton, { backgroundColor: colors.primary }]}
          onPress={handleSignUp}
          activeOpacity={0.7}
        >
          <Text style={[styles.signUpBannerButtonText, { color: colors.white }]}>Get Started</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        {renderAppHeader()}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading list...</Text>
        </View>
      </View>
    );
  }

  if (error || !list) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        {renderAppHeader()}
        <View style={styles.centerContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>List Not Found</Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {error || 'This list doesn\'t exist or has been deleted.'}
          </Text>
          <TouchableOpacity
            style={[styles.homeButton, { backgroundColor: colors.primary }]}
            onPress={handleGoHome}
            activeOpacity={0.7}
          >
            <Home size={18} color={colors.white} strokeWidth={2} />
            <Text style={[styles.homeButtonText, { color: colors.white }]}>Go to Home</Text>
          </TouchableOpacity>
        </View>
        {renderSignUpBanner()}
      </View>
    );
  }

  // Generate OG meta tags for social sharing
  const ogTitle = `${list.name} - iEndorse`;
  const ogDescription = list.description ||
    (list.creatorName ? `Endorsement list by ${list.creatorName}` : 'Discover endorsed brands and businesses');
  const ogUrl = `https://iendorse.app/list/${id}`;
  const ogImage = 'https://iendorse.app/og-list.png';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {Platform.OS === 'web' && (
        <Head>
          <title>{ogTitle}</title>
          <meta name="description" content={ogDescription} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={ogUrl} />
          <meta property="og:title" content={ogTitle} />
          <meta property="og:description" content={ogDescription} />
          <meta property="og:image" content={ogImage} />
          <meta property="twitter:card" content="summary_large_image" />
          <meta property="twitter:url" content={ogUrl} />
          <meta property="twitter:title" content={ogTitle} />
          <meta property="twitter:description" content={ogDescription} />
          <meta property="twitter:image" content={ogImage} />
        </Head>
      )}
      <Stack.Screen options={{ headerShown: false }} />
      {renderAppHeader()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...panResponder.panHandlers}
      >
        {/* List Header */}
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: colors.text }]}>{list.name}</Text>
          <View style={styles.listActions}>
            <TouchableOpacity
              onPress={handleCopyLink}
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
              activeOpacity={0.7}
            >
              <ExternalLink size={18} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
              activeOpacity={0.7}
            >
              <Share2 size={18} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {list.creatorName && (
          <View style={[styles.creatorCard, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.creatorHeader}>
              <View>
                <Text style={[styles.creatorLabel, { color: colors.textSecondary }]}>
                  {list.isEndorsed ? 'Endorsed by' : list.originalCreatorName ? 'Originally created by' : 'Created by'}
                </Text>
                <Text style={[styles.creatorName, { color: colors.text }]}>{list.isEndorsed ? list.creatorName : (list.originalCreatorName || list.creatorName)}</Text>
              </View>
              {list.isEndorsed && (
                <EndorsedBadge isDarkMode={isDarkMode} size="medium" />
              )}
            </View>
          </View>
        )}

        {list.description && (
          <View style={[styles.descriptionCard, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.description, { color: colors.text }]}>{list.description}</Text>
          </View>
        )}

        {/* Filter bar and map button */}
        {list.entries.length > 0 && (
          <View style={styles.filterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterButtonsScroll}
              style={styles.filterScrollView}
            >
              {/* All filter */}
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  localFilter === 'all' && categoryFilter === 'all'
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }
                ]}
                onPress={() => {
                  setLocalFilter('all');
                  setCategoryFilter('all');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: localFilter === 'all' && categoryFilter === 'all' ? '#FFFFFF' : colors.text }
                ]}>
                  All
                </Text>
              </TouchableOpacity>

              {/* Local filter - only show if there are local entries */}
              {hasLocalEntries && (
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    localFilter === 'local' && categoryFilter === 'all'
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }
                  ]}
                  onPress={() => {
                    setLocalFilter('local');
                    setCategoryFilter('all');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterButtonText,
                    { color: localFilter === 'local' && categoryFilter === 'all' ? '#FFFFFF' : colors.text }
                  ]}>
                    Local
                  </Text>
                </TouchableOpacity>
              )}

              {/* Category filters */}
              {uniqueCategories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterButton,
                    categoryFilter === cat.id
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }
                  ]}
                  onPress={() => {
                    setLocalFilter('all');
                    setCategoryFilter(cat.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterButtonText,
                    { color: categoryFilter === cat.id ? '#FFFFFF' : colors.text }
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Map button */}
            {mapEntries.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowMapModal(true)}
                style={[styles.mapButton, { backgroundColor: colors.backgroundSecondary }]}
                activeOpacity={0.7}
              >
                <MapPin size={20} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.statsContainer}>
          <Text style={[styles.statsText, { color: colors.textSecondary }]}>
            {filteredEntries.length} {filteredEntries.length === 1 ? 'item' : 'items'}
            {(localFilter !== 'all' || categoryFilter !== 'all') && list.entries.length !== filteredEntries.length && (
              ` (filtered from ${list.entries.length})`
            )}
          </Text>
        </View>

        {filteredEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {list.entries.length === 0 ? 'This list is empty' : 'No items match the selected filter'}
            </Text>
          </View>
        ) : (
          <View style={styles.entriesContainer}>
            {filteredEntries.map(entry => renderListEntry(entry))}
          </View>
        )}

        {/* Sign up banner at bottom for non-authenticated users */}
        {renderSignUpBanner()}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowMapModal(false)}
      >
        <TouchableOpacity
          style={styles.mapModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMapModal(false)}
        >
          <Pressable
            style={[
              styles.mapModalContent,
              { backgroundColor: colors.background }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.mapModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.mapModalTitle, { color: colors.text }]}>
                Map View ({mapEntries.length} locations)
              </Text>
              <TouchableOpacity
                style={[styles.mapModalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowMapModal(false)}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.mapModalBody}>
              {mapEntries.length > 0 ? (
                <EndorsementMapView
                  entries={mapEntries}
                  mapId="shared-list-map"
                  onEntryPress={(entry) => {
                    setShowMapModal(false);
                    if (entry.type === 'place') {
                      router.push(`/place/${entry.id}`);
                    } else if (entry.type === 'brand') {
                      router.push(`/brand/${entry.id}`);
                    } else if (entry.type === 'business') {
                      router.push(`/business/${entry.id}`);
                    }
                  }}
                />
              ) : (
                <View style={styles.mapModalEmpty}>
                  <MapPin size={48} color={colors.textSecondary} strokeWidth={1.5} />
                  <Text style={[styles.mapModalEmptyText, { color: colors.text }]}>
                    No mappable locations in this list
                  </Text>
                  <Text style={[styles.mapModalEmptySubtext, { color: colors.textSecondary }]}>
                    Only places and brands with coordinates can be shown on the map
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
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
    padding: 16,
    paddingBottom: 32,
    ...Platform.select({
      web: {
        maxWidth: 768,
        width: '100%',
        alignSelf: 'center',
      },
    }),
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // App header styles
  appHeader: {
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
  },
  appHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Platform.select({
      web: {
        maxWidth: 768,
        width: '100%',
        alignSelf: 'center',
      },
    }),
  },
  headerLogo: {
    width: 140,
    height: 42,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  signInButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  signInButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signUpButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  signUpButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // List header
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  listTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  listActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 10,
    borderRadius: 10,
  },
  // Sign up banner
  signUpBanner: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
  },
  signUpBannerContent: {
    marginBottom: 16,
  },
  signUpBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  signUpBannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  signUpBannerButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  signUpBannerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  creatorCard: {
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  creatorLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    opacity: 0.7,
  },
  creatorName: {
    fontSize: 20,
    fontWeight: '700',
  },
  descriptionCard: {
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  statsContainer: {
    marginBottom: 20,
    marginTop: 4,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  entriesContainer: {
    gap: 12,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      },
    }),
  },
  entryImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  entryImage: {
    width: '100%',
    height: '100%',
  },
  entryImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryImagePlaceholderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 22,
  },
  entryType: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
  },
  entryText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  // Filter styles
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  filterScrollView: {
    flex: 1,
  },
  filterButtonsScroll: {
    gap: 8,
    paddingRight: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  mapButton: {
    padding: 10,
    borderRadius: 10,
  },
  // Map modal styles
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mapModalContent: {
    width: '100%',
    maxWidth: 800,
    height: '90%',
    maxHeight: 700,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  mapModalCloseButton: {
    padding: 8,
    borderRadius: 8,
  },
  mapModalBody: {
    flex: 1,
  },
  mapModalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  mapModalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  mapModalEmptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
