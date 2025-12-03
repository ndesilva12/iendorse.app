/**
 * Merchant Verification Page
 *
 * This page is opened when a merchant scans a customer's QR code
 * Handles transaction confirmation and recording
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/contexts/UserContext';
import { useUser as useClerkUser } from '@clerk/clerk-expo';
import { lightColors, darkColors } from '@/constants/colors';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { isFollowing } from '@/services/firebase/followService';
import { getUserLists } from '@/services/firebase/listService';

export default function MerchantVerify() {
  const { profile, isDarkMode, getBusinessId, isTeamMember } = useUser();
  const { user: clerkUser } = useClerkUser();
  const colors = isDarkMode ? darkColors : lightColors;

  // Get URL parameters from QR code scan
  const params = useLocalSearchParams();
  const {
    userId: customerUserId,
    code: transactionCode,
    exp: expiryTime,
    name: customerName,
    email: customerEmail,
  } = params;

  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [requirementError, setRequirementError] = useState<string | null>(null);
  const [customDiscount, setCustomDiscount] = useState<string | null>(null);
  const [loadingBusinessInfo, setLoadingBusinessInfo] = useState(true);

  // Check if merchant is logged in as business account
  const isBusiness = profile.accountType === 'business';

  // Fetch business info to check for custom discount
  useEffect(() => {
    const fetchBusinessInfo = async () => {
      if (!clerkUser) return;

      try {
        const businessId = getBusinessId() || clerkUser.id;
        const businessDocRef = doc(db, 'users', businessId);
        const businessDoc = await getDoc(businessDocRef);
        const businessData = businessDoc.data();

        if (businessData?.businessInfo?.customDiscount) {
          setCustomDiscount(businessData.businessInfo.customDiscount);
        }
      } catch (error) {
        console.error('[MerchantVerify] Error fetching business info:', error);
      } finally {
        setLoadingBusinessInfo(false);
      }
    };

    fetchBusinessInfo();
  }, [clerkUser, getBusinessId]);

  // Verify QR code hasn't expired
  useEffect(() => {
    if (expiryTime) {
      const expiry = parseInt(expiryTime as string, 10);
      const now = Date.now();
      if (now > expiry) {
        setIsExpired(true);
      }
    }
  }, [expiryTime]);

  // Check if user is signed in and is a business (or team member - Phase 0)
  if (!clerkUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: colors.text }]}>Sign In Required</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Please sign in to your merchant account to verify this discount.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/sign-in')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Allow both business owners and team members (Phase 0)
  const canVerifyTransactions = isBusiness || isTeamMember();

  if (!canVerifyTransactions) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: colors.text }]}>Merchant Account Required</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            This page is only accessible to business accounts and team members.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isExpired) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: colors.text }]}>QR Code Expired</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            This QR code has expired. Please ask the customer to generate a new one.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isVerified) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.successTitle, { color: '#28a745' }]}>✓ Transaction Recorded</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {customDiscount ? 'Custom discount applied' : 'Discount applied'} successfully for {customerName}
          </Text>
          {customDiscount ? (
            <View style={[styles.customDiscountBox, { backgroundColor: colors.card }]}>
              <Text style={[styles.customDiscountText, { color: colors.text }]}>
                {customDiscount}
              </Text>
            </View>
          ) : (
            <Text style={[styles.amountText, { color: colors.text }]}>
              Purchase Amount: ${purchaseAmount}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleConfirmTransaction = async () => {
    // For custom discounts, no purchase amount is required
    if (!customDiscount && (!purchaseAmount || parseFloat(purchaseAmount) <= 0)) {
      Alert.alert('Error', 'Please enter a valid purchase amount');
      return;
    }

    setIsProcessing(true);
    setRequirementError(null);

    try {
      // Get business ID (works for both owners and team members - Phase 0)
      const businessId = getBusinessId() || clerkUser.id;

      // Check discount requirements before proceeding
      // Get business profile to check requirements
      const businessDocRef = doc(db, 'users', businessId);
      const businessDoc = await getDoc(businessDocRef);
      const businessData = businessDoc.data();
      const businessInfo = businessData?.businessInfo;

      // Check if customer is following the business (if required)
      if (businessInfo?.requireFollow) {
        const customerIsFollowing = await isFollowing(customerUserId as string, businessId, 'business');
        if (!customerIsFollowing) {
          setRequirementError('User must follow this business to receive the discount');
          Alert.alert('Requirement Not Met', 'User must follow this business to receive the discount');
          setIsProcessing(false);
          return;
        }
      }

      // ALWAYS check if customer has endorsed the business
      // This is a core requirement for discounts - users must endorse businesses to get their discounts
      const customerLists = await getUserLists(customerUserId as string);
      const endorsementList = customerLists.find(list => list.isEndorsed === true);

      console.log('[MerchantVerify] Checking endorsement for business:', businessId);
      console.log('[MerchantVerify] Customer lists found:', customerLists.length);
      console.log('[MerchantVerify] Endorsement list found:', !!endorsementList);

      if (!endorsementList) {
        setRequirementError('User must endorse this business to receive the discount');
        Alert.alert('Requirement Not Met', 'User must endorse this business to receive the discount. Please ask the customer to add your business to their endorsement list.');
        setIsProcessing(false);
        return;
      }

      console.log('[MerchantVerify] Endorsement list entries:', endorsementList.entries.length);
      console.log('[MerchantVerify] Endorsement list entries:', JSON.stringify(endorsementList.entries, null, 2));

      // Check if user has endorsed this specific business
      // Support multiple entry formats for robustness (filter out null/undefined entries)
      const hasEndorsed = endorsementList.entries.filter(e => e).some(entry => {
        if (entry.type === 'business') {
          // Check by businessId (primary method)
          if ('businessId' in entry && entry.businessId === businessId) {
            console.log('[MerchantVerify] ✓ Found business by ID match');
            return true;
          }
          // Check by business name as fallback
          if ('businessName' in entry && entry.businessName === businessInfo?.name) {
            console.log('[MerchantVerify] ✓ Found business by name match');
            return true;
          }
        }
        // Also check if user endorsed the business's brand (some users might endorse the brand)
        if (entry.type === 'brand' && 'brandName' in entry && entry.brandName === businessInfo?.name) {
          console.log('[MerchantVerify] ✓ Found business via brand name match');
          return true;
        }
        // Check for place entries that match this business
        if (entry.type === 'place' && 'placeId' in entry) {
          // Check if this place maps to the business
          if ('businessId' in entry && entry.businessId === businessId) {
            console.log('[MerchantVerify] ✓ Found business via place businessId match');
            return true;
          }
          if ('placeName' in entry && entry.placeName === businessInfo?.name) {
            console.log('[MerchantVerify] ✓ Found business via place name match');
            return true;
          }
        }
        return false;
      });

      console.log('[MerchantVerify] Has endorsed:', hasEndorsed);

      if (!hasEndorsed) {
        setRequirementError('User must endorse this business to receive the discount');
        Alert.alert('Requirement Not Met', 'User must endorse this business to receive the discount. Please ask the customer to add your business to their endorsement list.');
        setIsProcessing(false);
        return;
      }

      // Record transaction in Firebase
      const transactionRef = doc(db, 'transactions', transactionCode as string);

      // Get merchant business info (for team members, need to fetch from business owner)
      let merchantName = profile.businessInfo?.name || '';
      let merchantDiscount = profile.businessInfo?.customerDiscountPercent || 0;

      // If user is a team member, they might not have businessInfo directly
      if (isTeamMember() && profile.businessMembership) {
        merchantName = profile.businessMembership.businessName;
        // Note: team members can confirm transactions, discount comes from business settings
      }

      const endorseFeePercent = 2.5;

      // Get team member name for verification tracking
      const verifiedByName = clerkUser.fullName || clerkUser.firstName || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Unknown';

      console.log('[MerchantVerify] Recording transaction with:', {
        merchantDiscount,
        endorseFeePercent,
        purchaseAmount: parseFloat(purchaseAmount),
        businessId,
        verifiedBy: clerkUser.id,
        verifiedByName,
        isTeamMember: isTeamMember()
      });

      // Handle custom discount vs percentage discount
      const transactionData: any = {
        transactionId: transactionCode,
        customerId: customerUserId,
        customerName: customerName,
        customerEmail: customerEmail,
        merchantId: businessId, // Use business ID (works for both owner and team)
        merchantName: merchantName,
        status: 'completed',
        createdAt: serverTimestamp(),
        verifiedAt: serverTimestamp(),
        verifiedBy: clerkUser.id, // Track who confirmed the transaction (Phase 0)
        verifiedByName: verifiedByName, // Name of person who confirmed
      };

      if (customDiscount) {
        // Custom discount - no amount tracking
        transactionData.isCustomDiscount = true;
        transactionData.customDiscountDescription = customDiscount;
        transactionData.purchaseAmount = 0;
        transactionData.discountPercent = 0;
        transactionData.endorseFeePercent = 0;
        transactionData.discountAmount = 0;
        transactionData.endorseFeeAmount = 0;
      } else {
        // Percentage discount - track amounts
        transactionData.isCustomDiscount = false;
        transactionData.purchaseAmount = parseFloat(purchaseAmount);
        transactionData.discountPercent = merchantDiscount;
        transactionData.endorseFeePercent = endorseFeePercent;
        transactionData.discountAmount = (parseFloat(purchaseAmount) * merchantDiscount) / 100;
        transactionData.endorseFeeAmount = (parseFloat(purchaseAmount) * endorseFeePercent) / 100;
      }

      await setDoc(transactionRef, transactionData);

      console.log('[MerchantVerify] ✅ Transaction recorded successfully:', transactionCode);
      setIsVerified(true);

      // TODO: Send push notification to customer

    } catch (error) {
      console.error('[MerchantVerify] ❌ Error recording transaction:', error);
      Alert.alert(
        'Error',
        `Failed to record transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Verify Discount</Text>
      </View>

      <View style={styles.content}>
        {/* Customer Info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.customerName, { color: colors.text }]}>
            {customerName || customerEmail || 'Unknown'}
          </Text>
          <Text style={[styles.customerDetail, { color: colors.textSecondary }]}>
            {customerEmail || customerUserId}
          </Text>
        </View>

        {/* Custom Discount View OR Percentage Discount View */}
        {loadingBusinessInfo ? (
          <View style={[styles.card, { backgroundColor: colors.card, alignItems: 'center' }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.customerDetail, { color: colors.textSecondary, marginTop: 8 }]}>
              Loading discount info...
            </Text>
          </View>
        ) : customDiscount ? (
          /* Custom Discount View */
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Your Custom Discount</Text>
            <View style={[styles.customDiscountBox, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.customDiscountText, { color: colors.text }]}>
                {customDiscount}
              </Text>
            </View>
            <Text style={[styles.customerDetail, { color: colors.textSecondary, marginTop: 12, textAlign: 'center' }]}>
              Confirm to apply this custom discount for the customer.
            </Text>
          </View>
        ) : (
          /* Percentage Discount View */
          <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Your Offer</Text>
              <Text style={[styles.discountText, { color: colors.text }]}>
                {profile.businessInfo?.customerDiscountPercent || 10}% Discount
              </Text>
            </View>

            {/* Purchase Amount Input */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Purchase Amount (Original)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  value={purchaseAmount}
                  onChangeText={setPurchaseAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              {purchaseAmount && parseFloat(purchaseAmount) > 0 && (
                <>
                  {/* Divider */}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  {/* Final Amount - Prominent Display */}
                  <View style={[styles.finalAmountContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.finalAmountLabel, { color: colors.text }]}>
                      Final Purchase Amount:
                    </Text>
                    <Text style={[styles.finalAmountValue, { color: colors.primary }]}>
                      ${(parseFloat(purchaseAmount) - (parseFloat(purchaseAmount) * (profile.businessInfo?.customerDiscountPercent || 0)) / 100).toFixed(2)}
                    </Text>
                  </View>

                  {/* Divider */}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  {/* Breakdown */}
                  <View style={styles.calculationBox}>
                    <Text style={[styles.calculationText, { color: colors.textSecondary }]}>
                      Discount Amount: ${((parseFloat(purchaseAmount) * (profile.businessInfo?.customerDiscountPercent || 0)) / 100).toFixed(2)}
                    </Text>

                    <Text style={[styles.feeLabel, { color: colors.text }]}>
                      iEndorse Fee: 2.5%
                    </Text>
                    <Text style={[styles.feeValue, { color: colors.primary }]}>
                      ${((parseFloat(purchaseAmount) * 2.5) / 100).toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* Requirement Error Message */}
        {requirementError && (
          <View style={[styles.errorCard, { backgroundColor: '#FEE2E2', borderColor: '#DC2626' }]}>
            <Text style={[styles.errorText, { color: '#991B1B' }]}>
              ⚠️ {requirementError}
            </Text>
          </View>
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            {
              backgroundColor: (customDiscount || purchaseAmount) && !isProcessing && !loadingBusinessInfo
                ? colors.primary
                : '#ccc',
            },
          ]}
          onPress={handleConfirmTransaction}
          disabled={(!customDiscount && !purchaseAmount) || isProcessing || loadingBusinessInfo}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {customDiscount ? 'Confirm Custom Discount' : 'Confirm Transaction'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
          disabled={isProcessing}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  customerDetail: {
    fontSize: 12,
  },
  discountText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dollarSign: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: 'bold',
    padding: 12,
    borderWidth: 2,
    borderRadius: 8,
    maxWidth: '100%',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  finalAmountContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  finalAmountLabel: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  finalAmountValue: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  calculationBox: {
    gap: 8,
  },
  calculationText: {
    fontSize: 14,
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  feeValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  confirmButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  amountText: {
    fontSize: 20,
    fontWeight: '600',
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  customDiscountBox: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  customDiscountText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
  },
});
