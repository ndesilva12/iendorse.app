import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink, X, List, MoreVertical, Heart, UserPlus, UserMinus, Share2 } from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  PanResponder,
  Platform,
  useWindowDimensions,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useData } from '@/contexts/DataContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { useRef, useState, useCallback, useEffect } from 'react';
import { getLogoUrl } from '@/lib/logo';
import { UserList, ListEntry, ValueListMode } from '@/types/library';
import { getUserLists, addEntryToList, createList, removeEntryFromList } from '@/services/firebase/listService';
import { followEntity, unfollowEntity, isFollowing as checkIsFollowing } from '@/services/firebase/followService';
import ItemOptionsModal from '@/components/ItemOptionsModal';

interface ValueDriver {
  id: string;
  name: string;
  type: 'brand' | 'product' | 'behavior';
  description: string;
  reason: string;
  imageUrl: string;
  websiteUrl?: string;
}




export default function ValueDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, isDarkMode, clerkUser } = useUser();
  const { brands, valuesMatrix, values: firebaseValues } = useData();
  const library = useLibrary();
  const colors = isDarkMode ? darkColors : lightColors;
  const scrollViewRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const isLargeScreen = Platform.OS === 'web' && width >= 768;

  // Item options modal state
  const [showItemOptionsModal, setShowItemOptionsModal] = useState(false);
  const [selectedDriverForOptions, setSelectedDriverForOptions] = useState<ValueDriver | null>(null);
  const [followedBrands, setFollowedBrands] = useState<Set<string>>(new Set());

  // Quick-add state (keeping for list selection modal)
  const [showListSelectionModal, setShowListSelectionModal] = useState(false);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [quickAddBrandId, setQuickAddBrandId] = useState<string | null>(null);
  const [quickAddBrandName, setQuickAddBrandName] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ValueListMode | null>(null);

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

  // Note: Values are no longer associated with user profiles
  // Look up value in Firebase values only
  let userCause: any = null;
  let isSelected = false;

  // If not found in user's causes, check Firebase values
  if (!userCause) {
    const firebaseValue = firebaseValues.find(v => v.id === id);
    if (firebaseValue) {
      // Convert to the format expected by the rest of the component
      userCause = {
        id: firebaseValue.id,
        name: firebaseValue.name,
        category: firebaseValue.category as any,
        description: undefined,
        type: undefined, // Not selected, so no type
      };
    }
  }

  // If still not found, show error
  if (!userCause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Value not found</Text>
      </View>
    );
  }

  const isSupporting = userCause.type === 'support';
  const isAvoiding = userCause.type === 'avoid';

  const getWebsiteUrl = (brandName: string): string => {
    const domain = brandName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .replace(/corporation|company|inc|group|brands?|industries|systems|technologies|platforms?$/gi, '');
    return `https://${domain}.com`;
  };

  const getDriversFromFirebase = () => {
    // Get value data from Firebase valuesMatrix
    const valueData = valuesMatrix[id];

    if (!valueData) {
      return { supports: [], opposes: [] };
    }

    const supports = (valueData.support || []).map((brandName, index) => {
      // Try to find the brand in the brands collection
      const brand = brands?.find(b => b.name === brandName);
      const brandId = brand?.id || brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const websiteUrl = brand?.website || getWebsiteUrl(brandName);
      const category = brand?.category || 'Brand';

      return {
        id: brandId,
        name: brandName,
        type: 'brand' as 'brand' | 'product' | 'behavior',
        description: category,
        reason: `Directly supports ${userCause.name}`,
        position: index + 1,
        imageUrl: getLogoUrl(websiteUrl),
        websiteUrl,
      };
    });

    const opposes = (valueData.oppose || []).map((brandName, index) => {
      // Try to find the brand in the brands collection
      const brand = brands?.find(b => b.name === brandName);
      const brandId = brand?.id || brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const websiteUrl = brand?.website || getWebsiteUrl(brandName);
      const category = brand?.category || 'Brand';

      return {
        id: brandId,
        name: brandName,
        type: 'brand' as 'brand' | 'product' | 'behavior',
        description: category,
        reason: `Opposes ${userCause.name}`,
        position: index + 1,
        imageUrl: getLogoUrl(websiteUrl),
        websiteUrl,
      };
    });

    return {
      supports,
      opposes,
    };
  };

  const drivers = getDriversFromFirebase();

  const handleShopPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  // Check if brand is endorsed
  const isBrandEndorsed = (brandId: string): boolean => {
    if (!library?.state?.userLists) return false;
    const endorsementList = library.state.userLists.find(list => list.isEndorsed);
    if (!endorsementList) return false;
    return endorsementList.entries?.some(
      (e: any) => e && e.type === 'brand' && e.brandId === brandId
    ) || false;
  };

  // Action menu handlers
  const handleEndorseBrand = async (brandId: string, brandName: string) => {
    if (!clerkUser?.id) return;

    try {
      if (!library?.state?.userLists) {
        Alert.alert('Error', 'Library not loaded yet. Please try again.');
        return;
      }
      const endorsementList = library.state.userLists.find(list => list.isEndorsed);
      if (!endorsementList) {
        Alert.alert('Error', 'Could not find endorsement list');
        return;
      }

      const existingEntry = endorsementList.entries.find(
        (e: any) => e.type === 'brand' && e.brandId === brandId
      );

      if (existingEntry) {
        Alert.alert('Already Endorsed', `${brandName} is already in your endorsements`);
        return;
      }

      const brand = brands?.find(b => b.id === brandId);

      await addEntryToList(endorsementList.id, {
        type: 'brand',
        brandId: brandId,
        brandName: brandName,
        name: brandName,
        website: brand?.website || '',
        logoUrl: brand?.exampleImageUrl || getLogoUrl(brand?.website || ''),
      });

      await library.loadUserLists(clerkUser.id, true);
      Alert.alert('Success', `${brandName} added to endorsements`);
    } catch (error) {
      console.error('Error endorsing brand:', error);
      Alert.alert('Error', 'Failed to endorse brand');
    }
  };

  const handleUnendorseBrand = async (brandId: string, brandName: string) => {
    if (!clerkUser?.id) return;

    try {
      if (!library?.state?.userLists) {
        Alert.alert('Error', 'Library not loaded yet. Please try again.');
        return;
      }
      const endorsementList = library.state.userLists.find(list => list.isEndorsed);
      if (!endorsementList) {
        Alert.alert('Error', 'Could not find endorsement list');
        return;
      }

      const entry = endorsementList.entries.find(
        (e: any) => e.type === 'brand' && e.brandId === brandId
      );

      if (!entry) {
        Alert.alert('Not Endorsed', `${brandName} is not in your endorsements`);
        return;
      }

      await removeEntryFromList(endorsementList.id, entry.id);
      await library.loadUserLists(clerkUser.id, true);
      Alert.alert('Success', `${brandName} removed from endorsements`);
    } catch (error) {
      console.error('Error removing brand from endorsements:', error);
      Alert.alert('Error', 'Failed to remove brand from endorsements');
    }
  };

  const handleFollowBrand = async (brandId: string, brandName: string) => {
    if (!clerkUser?.id) return;

    const isCurrentlyFollowing = followedBrands.has(brandId);

    try {
      if (isCurrentlyFollowing) {
        await unfollowEntity(clerkUser.id, brandId, 'brand');
        setFollowedBrands(prev => {
          const newSet = new Set(prev);
          newSet.delete(brandId);
          return newSet;
        });
        Alert.alert('Success', `Unfollowed ${brandName}`);
      } else {
        await followEntity(clerkUser.id, brandId, 'brand');
        setFollowedBrands(prev => new Set(prev).add(brandId));
        Alert.alert('Success', `Now following ${brandName}`);
      }
    } catch (error) {
      console.error('Error following/unfollowing brand:', error);
      Alert.alert('Error', `Failed to ${isCurrentlyFollowing ? 'unfollow' : 'follow'} brand`);
    }
  };

  // Check follow status when modal opens
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!selectedDriverForOptions || !clerkUser?.id) return;
      try {
        const isFollowing = await checkIsFollowing(clerkUser.id, selectedDriverForOptions.id, 'brand');
        if (isFollowing) {
          setFollowedBrands(prev => new Set(prev).add(selectedDriverForOptions.id));
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
    checkFollowStatus();
  }, [selectedDriverForOptions, clerkUser?.id]);

  const handleShareBrand = (brandId: string, brandName: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(`${window.location.origin}/brand/${brandId}`);
      Alert.alert('Success', 'Link copied to clipboard');
    } else {
      Alert.alert('Share', 'Share functionality coming soon');
    }
  };

  const handleAddToList = async (listId: string) => {
    // If adding a brand
    if (quickAddBrandId && quickAddBrandName) {
      try {
        const entry: Omit<ListEntry, 'id' | 'createdAt'> = {
          type: 'brand',
          brandId: quickAddBrandId,
          brandName: quickAddBrandName,
        };

        await addEntryToList(listId, entry);
        setShowListSelectionModal(false);
        setQuickAddBrandId(null);
        setQuickAddBrandName(null);
        Alert.alert('Success', `Added ${quickAddBrandName} to list!`);
      } catch (error) {
        console.error('[ValueDetail] Error adding brand to list:', error);
        Alert.alert('Error', 'Could not add to list. Please try again.');
      }
    }
    // If adding a value
    else if (selectedMode && userCause) {
      try {
        // Add the top brands for this value instead of the value card
        const causeData = valuesMatrix[userCause.id];
        if (!causeData) {
          Alert.alert('Error', 'Value data not found');
          return;
        }

        const brandList = selectedMode === 'maxBenefit' ? causeData.support : causeData.avoid;
        if (!brandList || brandList.length === 0) {
          Alert.alert('Error', 'No brands found for this value');
          return;
        }

        // Add top 10 brands (or all if less than 10)
        const brandsToAdd = brandList.slice(0, 10);
        let addedCount = 0;

        for (const brandName of brandsToAdd) {
          const brand = brands?.find(b => b.name === brandName);
          if (brand) {
            const brandEntry: Omit<ListEntry, 'id' | 'createdAt'> = {
              type: 'brand',
              brandId: brand.id,
              brandName: brand.name,
              website: brand.website,
            };
            await addEntryToList(listId, brandEntry);
            addedCount++;
          }
        }

        setShowListSelectionModal(false);
        setSelectedMode(null);
        Alert.alert('Success', `Added ${addedCount} brands from ${userCause.name} to list!`);
      } catch (error) {
        console.error('[ValueDetail] Error adding value to list:', error);
        Alert.alert('Error', 'Could not add to list. Please try again.');
      }
    }
  };

  const handleCreateAndAddToList = async () => {
    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    if (!profile.id) return;

    try {
      const listId = await createList(profile.id, newListName.trim(), newListDescription.trim());

      // If adding a brand
      if (quickAddBrandId && quickAddBrandName) {
        const entry: Omit<ListEntry, 'id' | 'createdAt'> = {
          type: 'brand',
          brandId: quickAddBrandId,
          brandName: quickAddBrandName,
        };

        await addEntryToList(listId, entry);

        setNewListName('');
        setNewListDescription('');
        setShowListSelectionModal(false);
        setQuickAddBrandId(null);
        setQuickAddBrandName(null);
        Alert.alert('Success', `Created list and added ${quickAddBrandName}!`);
      }
      // If adding a value
      else if (selectedMode && userCause) {
        // Add the top brands for this value instead of the value card
        const causeData = valuesMatrix[userCause.id];
        if (!causeData) {
          Alert.alert('Error', 'Value data not found');
          return;
        }

        const brandList = selectedMode === 'maxBenefit' ? causeData.support : causeData.avoid;
        if (!brandList || brandList.length === 0) {
          Alert.alert('Error', 'No brands found for this value');
          return;
        }

        // Add top 10 brands (or all if less than 10)
        const brandsToAdd = brandList.slice(0, 10);
        let addedCount = 0;

        for (const brandName of brandsToAdd) {
          const brand = brands?.find(b => b.name === brandName);
          if (brand) {
            const brandEntry: Omit<ListEntry, 'id' | 'createdAt'> = {
              type: 'brand',
              brandId: brand.id,
              brandName: brand.name,
              website: brand.website,
            };
            await addEntryToList(listId, brandEntry);
            addedCount++;
          }
        }

        setNewListName('');
        setNewListDescription('');
        setShowListSelectionModal(false);
        setSelectedMode(null);
        Alert.alert('Success', `Created list and added ${addedCount} brands from ${userCause.name}!`);
      }
    } catch (error) {
      console.error('[ValueDetail] Error creating list:', error);
      Alert.alert('Error', 'Could not create list. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: userCause.name,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.scrollContentCentered]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.contentWrapper, isLargeScreen && styles.contentWrapperConstrained]}>
        <View style={styles.header}>
          {isSelected && (
            <View style={[
              styles.badge,
              isSupporting ? styles.supportBadge : styles.avoidBadge
            ]}>
              <Text style={[
                styles.badgeText,
                isSupporting ? { color: colors.success } : { color: colors.danger }
              ]}>
                {isSupporting ? 'Supporting' : 'Opposing'}
              </Text>
            </View>
          )}
          <Text style={[styles.title, { color: colors.text }]}>{userCause.name}</Text>
          {userCause.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]}>{userCause.description}</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={24} color={colors.primaryLight} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Supports This Value</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Products, brands, and behaviors that align with {userCause.name.toLowerCase()}
          </Text>
          {drivers.supports.length > 0 ? (
            <View style={styles.driversContainer}>
              {drivers.supports.map((driver, index) => (
                <View key={`${id}-support-${driver.name}-${index}`} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[styles.driverCard, styles.supportingCard, { backgroundColor: colors.backgroundSecondary }]}
                    onPress={() => {
                      router.push(`/brand/${driver.id}?name=${encodeURIComponent(driver.name)}`);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.leftContent}>
                        {driver.imageUrl ? (
                          <Image source={{ uri: driver.imageUrl }} style={styles.brandLogo} />
                        ) : null}
                        <View style={styles.brandInfo}>
                          <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={1}>{driver.name}</Text>
                          <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>{driver.description}</Text>
                        </View>
                      </View>
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.actionMenuButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            console.log('[ValuePage] Opening options modal for supporting driver:', driver.name);
                            setSelectedDriverForOptions(driver);
                            setShowItemOptionsModal(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ transform: [{ rotate: '90deg' }] }}>
                            <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.shopButton, { backgroundColor: colors.primaryLight }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleShopPress(driver.websiteUrl || '');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.shopButtonText, { color: colors.white }]}>Shop</Text>
                          <ExternalLink size={14} color={colors.white} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No products found that support this value yet</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingDown size={24} color={colors.danger} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Opposes This Value</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Products, brands, and behaviors that work against {userCause.name.toLowerCase()}
          </Text>
          {drivers.opposes.length > 0 ? (
            <View style={styles.driversContainer}>
              {drivers.opposes.map((driver, index) => (
                <View key={`${id}-oppose-${driver.name}-${index}`} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[styles.driverCard, styles.opposingCard, { backgroundColor: colors.backgroundSecondary }]}
                    onPress={() => {
                      router.push(`/brand/${driver.id}?name=${encodeURIComponent(driver.name)}`);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.leftContent}>
                        {driver.imageUrl ? (
                          <Image source={{ uri: driver.imageUrl }} style={styles.brandLogo} />
                        ) : null}
                        <View style={styles.brandInfo}>
                          <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={1}>{driver.name}</Text>
                          <Text style={[styles.brandCategory, { color: colors.textSecondary }]} numberOfLines={1}>{driver.description}</Text>
                        </View>
                      </View>
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.actionMenuButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            console.log('[ValuePage] Opening options modal for opposing driver:', driver.name);
                            setSelectedDriverForOptions(driver);
                            setShowItemOptionsModal(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ transform: [{ rotate: '90deg' }] }}>
                            <MoreVertical size={18} color={colors.textSecondary} strokeWidth={2} />
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.shopButton, { backgroundColor: colors.danger }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleShopPress(driver.websiteUrl || '');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.shopButtonText, { color: colors.white }]}>Shop</Text>
                          <ExternalLink size={14} color={colors.white} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No products found that oppose this value yet</Text>
            </View>
          )}
        </View>
        </View>
      </ScrollView>

      {/* List Selection Modal (kept for potential future use) */}
      <Modal
        visible={showListSelectionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowListSelectionModal(false);
          setSelectedMode(null);
          setQuickAddBrandId(null);
          setQuickAddBrandName(null);
          setNewListName('');
          setNewListDescription('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              setShowListSelectionModal(false);
              setSelectedMode(null);
              setQuickAddBrandId(null);
              setQuickAddBrandName(null);
              setNewListName('');
              setNewListDescription('');
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Pressable
            style={[styles.listSelectionModalContainer, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add to List
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowListSelectionModal(false);
                  setSelectedMode(null);
                  setQuickAddBrandId(null);
                  setQuickAddBrandName(null);
                  setNewListName('');
                  setNewListDescription('');
                }}
              >
                <X size={24} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <Text style={[styles.quickAddItemName, { color: colors.primary }]}>
                {quickAddBrandName || userCause?.name}
              </Text>
              {selectedMode && (
                <Text style={[styles.modeIndicator, { color: selectedMode === 'maxBenefit' ? colors.success : colors.danger }]}>
                  {selectedMode === 'maxBenefit' ? 'Max Benefit Mode' : 'Max Pain Mode'}
                </Text>
              )}

              <Text style={[styles.modalLabel, { color: colors.text, marginTop: 16 }]}>
                Select a list:
              </Text>

              {userLists.length === 0 ? (
                <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                  You don't have any lists yet. Create one below!
                </Text>
              ) : (
                <View style={styles.quickAddListsContainer}>
                  {userLists.map((list) => (
                    <TouchableOpacity
                      key={list.id}
                      style={[styles.quickAddListItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                      onPress={() => handleAddToList(list.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.listIconContainer, { backgroundColor: colors.primaryLight + '20' }]}>
                        <List size={18} color={colors.primary} strokeWidth={2} />
                      </View>
                      <View style={styles.quickAddListInfo}>
                        <Text style={[styles.quickAddListName, { color: colors.text }]} numberOfLines={1}>
                          {list.name}
                        </Text>
                        <Text style={[styles.quickAddListCount, { color: colors.textSecondary }]}>
                          {list.entries.length} {list.entries.length === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.dividerContainer}>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              </View>

              <Text style={[styles.modalLabel, { color: colors.text }]}>Create new list:</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="List name"
                placeholderTextColor={colors.textSecondary}
                value={newListName}
                onChangeText={setNewListName}
              />

              <TextInput
                style={[styles.modalTextArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textSecondary}
                value={newListDescription}
                onChangeText={setNewListDescription}
                multiline
                numberOfLines={2}
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateAndAddToList}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>
                  Create List & Add Item
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </View>
      </Modal>

      {/* Item Options Modal */}
      {selectedDriverForOptions && (
        <ItemOptionsModal
          visible={showItemOptionsModal}
          onClose={() => {
            setShowItemOptionsModal(false);
            setSelectedDriverForOptions(null);
          }}
          itemName={selectedDriverForOptions.name}
          isDarkMode={isDarkMode}
          options={[
            {
              icon: Heart,
              label: isBrandEndorsed(selectedDriverForOptions.id) ? 'Unendorse' : 'Endorse',
              onPress: () => {
                console.log('[ValuePage] Endorse option pressed');
                const driver = selectedDriverForOptions;
                if (isBrandEndorsed(driver.id)) {
                  handleUnendorseBrand(driver.id, driver.name);
                } else {
                  handleEndorseBrand(driver.id, driver.name);
                }
              },
            },
            {
              icon: followedBrands.has(selectedDriverForOptions.id) ? UserMinus : UserPlus,
              label: followedBrands.has(selectedDriverForOptions.id) ? 'Unfollow' : 'Follow',
              onPress: () => {
                console.log('[ValuePage] Follow option pressed');
                handleFollowBrand(selectedDriverForOptions.id, selectedDriverForOptions.name);
              },
            },
            {
              icon: Share2,
              label: 'Share',
              onPress: () => {
                console.log('[ValuePage] Share option pressed');
                handleShareBrand(selectedDriverForOptions.id, selectedDriverForOptions.name);
              },
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentCentered: {
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    padding: 20,
  },
  contentWrapperConstrained: {
    maxWidth: '50%',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    marginBottom: 32,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  supportBadge: {
    backgroundColor: '#EFF6FF',
  },
  avoidBadge: {
    backgroundColor: '#FFD6E8',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  supportBadgeText: {},
  avoidBadgeText: {},
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  driversContainer: {
    gap: 12,
  },
  driverCard: {
    borderRadius: 12,
    padding: 14,
  },
  supportingCard: {},
  opposingCard: {},
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  brandLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  brandInfo: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 3,
  },
  brandCategory: {
    fontSize: 13,
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  shopButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Quick-add styles
  headerAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: 60,
  },
  modeSelectionModalContainer: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  listSelectionModalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  modalContent: {
    padding: 20,
  },
  modalScrollContent: {
    padding: 20,
  },
  quickAddItemName: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  modeSelectionDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  modeButtonsContainer: {
    gap: 12,
  },
  modeButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeButtonTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  modeButtonDescription: {
    fontSize: 14,
    textAlign: 'center' as const,
  },
  modeIndicator: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  emptyListText: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 20,
  },
  quickAddListsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  quickAddListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  listIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddListInfo: {
    flex: 1,
  },
  quickAddListName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  quickAddListCount: {
    fontSize: 13,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  modalInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  modalTextArea: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  modalButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
