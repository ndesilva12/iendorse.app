import { useRouter } from 'expo-router';
import { Search as SearchIcon, TrendingUp, TrendingDown, Minus, ScanBarcode, X } from 'lucide-react-native';
import { useState } from 'react';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import MenuButton from '@/components/MenuButton';
import Colors, { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { searchProducts } from '@/mocks/products';
import { Product } from '@/types';
import { lookupBarcode, findBrandInDatabase, getBrandProduct } from '@/mocks/barcode-products';
import { getLogoUrl } from '@/lib/logo';

export default function SearchScreen() {
  const router = useRouter();
  const { profile, addToSearchHistory, isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scannedInfo, setScannedInfo] = useState<{productName: string; brandName: string; imageUrl?: string; notInDatabase: boolean} | null>(null);
  const [scanning, setScanning] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.trim().length > 0) {
      // Note: User causes removed - search with empty array for neutral results
      const searchResults = searchProducts(text, []);
      setResults(searchResults);
    } else {
      setResults([]);
    }
  };

  const handleProductPress = (product: Product) => {
    addToSearchHistory(query);
    router.push({
      pathname: '/brand/[id]',
      params: { id: product.id },
    });
  };

  const handleOpenScanner = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Scanner Not Available',
        'The barcode scanner is not available on web. Please use the mobile app to scan products.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to scan barcodes',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    setScannerVisible(true);
  };

  const handleCloseScanner = () => {
    setScannerVisible(false);
    setScannedProduct(null);
    setScannedInfo(null);
    setScanning(true);
    setLookingUp(false);
  };

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (!scanning || lookingUp) return;
    
    console.log('Barcode scanned:', data);
    setScanning(false);
    setLookingUp(true);
    
    try {
      const productInfo = await lookupBarcode(data);
      
      if (!productInfo) {
        Alert.alert(
          'Product Not Found',
          'This barcode was not found in our database. Try searching manually.',
          [
            { text: 'OK', onPress: () => handleCloseScanner() },
            { text: 'Scan Again', onPress: () => { setScanning(true); setLookingUp(false); } }
          ]
        );
        return;
      }
      
      const matchedBrand = findBrandInDatabase(productInfo.brandName);
      
      if (!matchedBrand) {
        setScannedInfo({
          productName: productInfo.productName,
          brandName: productInfo.brandName,
          imageUrl: productInfo.imageUrl,
          notInDatabase: true
        });
        return;
      }
      
      const product = getBrandProduct(matchedBrand);
      
      if (product) {
        setScannedProduct(product);
      } else {
        setScannedInfo({
          productName: productInfo.productName,
          brandName: matchedBrand,
          imageUrl: productInfo.imageUrl,
          notInDatabase: true
        });
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert(
        'Error',
        'Failed to process barcode. Please try again.',
        [
          { text: 'OK', onPress: () => handleCloseScanner() },
          { text: 'Retry', onPress: () => { setScanning(true); setLookingUp(false); } }
        ]
      );
    } finally {
      setLookingUp(false);
    }
  };

  const handleViewScannedProduct = () => {
    if (scannedProduct) {
      handleCloseScanner();
      router.push({
        pathname: '/brand/[id]',
        params: { id: scannedProduct.id },
      });
    }
  };

  const getAlignmentColor = (score: number | undefined) => {
    const normalizedScore = score ?? 50;
    if (normalizedScore >= 70) return Colors.success;
    if (normalizedScore >= 40) return Colors.neutral;
    return Colors.danger;
  };

  const getAlignmentIcon = (score: number | undefined) => {
    const normalizedScore = score ?? 50;
    if (normalizedScore >= 70) return TrendingUp;
    if (normalizedScore >= 40) return Minus;
    return TrendingDown;
  };

  const getAlignmentLabel = (score: number | undefined) => {
    const normalizedScore = score ?? 50;
    if (normalizedScore >= 70) return 'Strongly Aligned';
    if (normalizedScore >= 40) return 'Neutral';
    return 'Not Aligned';
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const alignmentColor = getAlignmentColor(item.alignmentScore);
    const AlignmentIcon = getAlignmentIcon(item.alignmentScore);
    const alignmentLabel = getAlignmentLabel(item.alignmentScore);

    return (
      <TouchableOpacity
        style={[styles.productCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: getLogoUrl(item.website || '') }}
          style={styles.productImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <View style={styles.productTitleContainer}>
              <Text style={[styles.productBrand, { color: colors.primary }]}>{item.brand}</Text>
              <Text style={[styles.productName, { color: colors.text }]}>{item.name}</Text>
            </View>
            <View style={[styles.scoreContainer, { backgroundColor: alignmentColor + '15' }]}>
              <AlignmentIcon size={16} color={alignmentColor} strokeWidth={2.5} />
              <Text style={[styles.scoreText, { color: alignmentColor }]}>
                {Math.abs(item.alignmentScore ?? 50)}
              </Text>
            </View>
          </View>
          <View style={[styles.alignmentBadge, { backgroundColor: alignmentColor + '15' }]}>
            <Text style={[styles.alignmentText, { color: alignmentColor }]}>
              {alignmentLabel}
            </Text>
          </View>
          <Text style={[styles.keyReason, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.keyReasons[0]}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={[styles.stickyHeader, { backgroundColor: colors.background, borderBottomColor: 'rgba(0, 0, 0, 0.05)' }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>Search</Text>
          <MenuButton />
        </View>
        
        <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.primaryLight }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: isDarkMode ? colors.backgroundSecondary : colors.white, borderColor: colors.primaryLight }]}>
          <SearchIcon size={20} color={colors.primaryLight} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search products, brands..."
            placeholderTextColor={colors.textLight}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={handleOpenScanner}
            style={[styles.scanButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            <ScanBarcode size={20} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        </View>
      </View>

      {query.trim().length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.primaryLight + '10' }]}>
            <SearchIcon size={48} color={colors.primaryLight} strokeWidth={1.5} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Search for products</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Find out how your purchases align with your values
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No results found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Try searching for a different product or brand</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderProduct}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={handleCloseScanner}
      >
        <View style={styles.scannerContainer}>
          {!scannedProduct && !scannedInfo ? (
            <>
              <CameraView
                style={styles.camera}
                facing={'back' as CameraType}
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'qr',
                    'ean13',
                    'ean8',
                    'code128',
                    'code39',
                    'upc_a',
                    'upc_e',
                  ],
                }}
              >
                <View style={styles.scannerOverlay}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleCloseScanner}
                    activeOpacity={0.7}
                  >
                    <X size={24} color={colors.white} strokeWidth={2.5} />
                  </TouchableOpacity>

                  <View style={styles.scannerFrame}>
                    <View style={styles.scannerFrameCorner} />
                  </View>

                  <View style={styles.scannerTextContainer}>
                    <Text style={styles.scannerTitle}>
                      {lookingUp ? 'Looking Up Product...' : 'Scan Barcode'}
                    </Text>
                    <Text style={styles.scannerSubtitle}>
                      {lookingUp
                        ? 'Checking our database for brand information'
                        : 'Position the barcode within the frame'}
                    </Text>
                  </View>
                </View>
              </CameraView>
            </>
          ) : scannedProduct ? (
            <View style={[styles.resultContainer, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[styles.closeButton, styles.closeButtonResult]}
                onPress={handleCloseScanner}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.resultContent}>
                <View style={[styles.successBadge, { backgroundColor: Colors.success + '15' }]}>
                  <ScanBarcode size={32} color={Colors.success} strokeWidth={2} />
                </View>

                <Text style={[styles.resultTitle, { color: colors.text }]}>Product Found!</Text>

                <Image
                  source={{ uri: getLogoUrl(scannedProduct.website || '') }}
                  style={styles.resultImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />

                <Text style={[styles.resultBrand, { color: colors.primary }]}>
                  {scannedProduct.brand}
                </Text>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {scannedProduct.name}
                </Text>

                <View style={styles.alignmentContainer}>
                  {(() => {
                    const alignmentColor = getAlignmentColor(scannedProduct.alignmentScore);
                    const AlignmentIcon = getAlignmentIcon(scannedProduct.alignmentScore);
                    const alignmentLabel = getAlignmentLabel(scannedProduct.alignmentScore);

                    return (
                      <>
                        <View style={[styles.alignmentScore, { backgroundColor: alignmentColor + '15' }]}>
                          <AlignmentIcon size={24} color={alignmentColor} strokeWidth={2.5} />
                          <Text style={[styles.alignmentScoreText, { color: alignmentColor }]}>
                            {Math.abs(scannedProduct.alignmentScore ?? 50)}
                          </Text>
                        </View>
                        <Text style={[styles.alignmentLabel, { color: alignmentColor }]}>
                          {alignmentLabel}
                        </Text>
                      </>
                    );
                  })()}
                </View>

                <TouchableOpacity
                  style={[styles.viewDetailsButton, { backgroundColor: colors.primary }]}
                  onPress={handleViewScannedProduct}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.viewDetailsButtonText, { color: colors.white }]}>
                    View Details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scanAgainButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setScannedProduct(null);
                    setScanning(true);
                    setLookingUp(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scanAgainButtonText, { color: colors.text }]}>
                    Scan Another
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : scannedInfo ? (
            <View style={[styles.resultContainer, { backgroundColor: colors.background }]}>              
              <TouchableOpacity
                style={[styles.closeButton, styles.closeButtonResult]}
                onPress={handleCloseScanner}
                activeOpacity={0.7}
              >
                <X size={24} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.resultContent}>
                <View style={[styles.successBadge, { backgroundColor: Colors.success + '15' }]}>                  
                  <ScanBarcode size={32} color={Colors.success} strokeWidth={2} />
                </View>

                <Text style={[styles.resultTitle, { color: colors.text }]}>Product Scanned!</Text>

                {scannedInfo.imageUrl && (
                  <Image
                    source={{ uri: scannedInfo.imageUrl }}
                    style={styles.resultImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                )}

                <Text style={[styles.resultBrand, { color: colors.primary }]}>
                  {scannedInfo.brandName}
                </Text>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {scannedInfo.productName}
                </Text>

                <View style={[styles.notInDbBadge, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>                  
                  <Text style={[styles.notInDbText, { color: colors.warning }]}>
                    This brand is not in our values database yet
                  </Text>
                </View>
                
                <Text style={[styles.notInDbDescription, { color: colors.textSecondary }]}>
                  The barcode scanner is working correctly, but we don&apos;t have alignment information for this brand.
                </Text>

                <TouchableOpacity
                  style={[styles.scanAgainButton, { borderColor: colors.border, marginTop: 24 }]}                  
                  onPress={() => {
                    setScannedInfo(null);
                    setScanning(true);
                    setLookingUp(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scanAgainButtonText, { color: colors.text }]}>
                    Scan Another Product
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stickyHeader: {
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    flex: 1,
  },

  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  productCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  productImage: {
    width: '100%',
    height: 200,
  },
  productInfo: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  productBrand: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  alignmentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  alignmentText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  keyReason: {
    fontSize: 14,
    lineHeight: 20,
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    position: 'absolute' as const,
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonResult: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  scannerFrame: {
    position: 'absolute' as const,
    top: '30%',
    left: '10%',
    right: '10%',
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
  scannerFrameCorner: {
    position: 'absolute' as const,
    top: -2,
    left: -2,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#00ff88',
    borderTopLeftRadius: 12,
  },
  scannerTextContainer: {
    position: 'absolute' as const,
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  scannerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
  },
  resultContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 24,
  },
  resultImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginBottom: 24,
  },
  resultBrand: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  resultName: {
    fontSize: 22,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginBottom: 24,
  },
  alignmentContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  alignmentScore: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  alignmentScoreText: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  alignmentLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  viewDetailsButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewDetailsButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  scanAgainButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  scanAgainButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  notInDbBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 24,
    marginBottom: 12,
  },
  notInDbText: {
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  notInDbDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});
