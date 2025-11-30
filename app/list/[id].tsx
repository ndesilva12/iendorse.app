import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { ArrowLeft, Share2, ExternalLink, Home, LogIn } from 'lucide-react-native';
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
} from 'react-native';
import { Image } from 'expo-image';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { useState, useEffect, useRef } from 'react';
import { getLogoUrl } from '@/lib/logo';
import { getList } from '@/services/firebase/listService';
import { UserList, ListEntry } from '@/types/library';
import * as Clipboard from 'expo-clipboard';
import EndorsedBadge from '@/components/EndorsedBadge';
import MenuButton from '@/components/MenuButton';

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

        <View style={styles.statsContainer}>
          <Text style={[styles.statsText, { color: colors.textSecondary }]}>
            {list.entries.length} {list.entries.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {list.entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              This list is empty
            </Text>
          </View>
        ) : (
          <View style={styles.entriesContainer}>
            {list.entries.map(entry => renderListEntry(entry))}
          </View>
        )}

        {/* Sign up banner at bottom for non-authenticated users */}
        {renderSignUpBanner()}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
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
});
