/**
 * Admin Business Claims Management
 *
 * Review, approve, or reject business ownership claims
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, X, Mail, Phone, Clock, Building2, User, MapPin, ExternalLink, RefreshCw } from 'lucide-react-native';
import {
  getAllClaims,
  getPendingClaims,
  approveClaim,
  rejectClaim,
  convertClaimToBusinessAccount,
  BusinessClaim,
} from '@/services/firebase/businessClaimService';
import { getPlaceDetails } from '@/services/firebase/placesService';

// Admin email whitelist
const ADMIN_EMAILS = [
  'normancdesilva@gmail.com',
];

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

export default function BusinessClaimsAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [claims, setClaims] = useState<BusinessClaim[]>([]);
  const [filter, setFilter] = useState<FilterType>('pending');

  // Review modal state
  const [selectedClaim, setSelectedClaim] = useState<BusinessClaim | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      setIsAdmin(ADMIN_EMAILS.includes(email));
    }
    loadClaims();
  }, [user]);

  const loadClaims = async () => {
    setIsLoading(true);
    try {
      const allClaims = await getAllClaims();
      setClaims(allClaims);
    } catch (error) {
      console.error('[BusinessClaimsAdmin] Error loading claims:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to load claims');
      } else {
        Alert.alert('Error', 'Failed to load claims');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClaims = claims.filter(claim => {
    if (filter === 'all') return true;
    return claim.status === filter;
  });

  const handleApprove = async () => {
    if (!selectedClaim || !user?.primaryEmailAddress?.emailAddress) return;

    setIsProcessing(true);
    try {
      // First approve the claim
      await approveClaim(
        selectedClaim.id,
        user.primaryEmailAddress.emailAddress,
        reviewNotes
      );

      // Automatically convert the account to business
      let conversionSuccess = false;
      let conversionError: any = null;
      try {
        console.log('[BusinessClaimsAdmin] Getting place details for:', selectedClaim.placeId);
        const placeDetails = await getPlaceDetails(selectedClaim.placeId);
        console.log('[BusinessClaimsAdmin] Place details:', JSON.stringify(placeDetails, null, 2));

        console.log('[BusinessClaimsAdmin] Converting claim to business account...');
        await convertClaimToBusinessAccount(selectedClaim.id, {
          name: selectedClaim.placeName,
          address: selectedClaim.placeAddress,
          category: selectedClaim.placeCategory,
          phone: placeDetails?.phone || selectedClaim.businessPhone,
          website: placeDetails?.website || '',
          location: placeDetails?.location,
          photoUrl: placeDetails?.photoReferences?.[0] || '',
        });
        conversionSuccess = true;
        console.log('[BusinessClaimsAdmin] Account automatically converted to business');
      } catch (err) {
        conversionError = err;
        console.error('[BusinessClaimsAdmin] Error auto-converting account:', err);
      }

      // Show result message
      const successMessage = conversionSuccess
        ? 'Claim approved and account converted to business successfully!'
        : `Claim approved but account conversion failed: ${conversionError?.message || 'Unknown error'}. You can try manual conversion.`;

      if (Platform.OS === 'web') {
        window.alert(successMessage);
      } else {
        Alert.alert(conversionSuccess ? 'Success' : 'Partial Success', successMessage);
      }

      // Ask if user wants to send email (don't auto-open)
      if (selectedClaim.userEmail && Platform.OS === 'web') {
        const sendEmail = window.confirm('Would you like to send an approval notification email?');
        if (sendEmail) {
          const subject = encodeURIComponent('Your iEndorse Business Account is Ready!');
          const body = encodeURIComponent(
            `Hi ${selectedClaim.userName},\n\n` +
            `Great news! Your claim for "${selectedClaim.placeName}" has been approved and your business account is now active!\n\n` +
            `You can now:\n` +
            `- Manage your business profile\n` +
            `- Set up customer discounts in the Money tab\n` +
            `- Endorse other businesses in the List tab\n` +
            `- Track endorsements and engagement\n\n` +
            (reviewNotes ? `Notes from our team:\n${reviewNotes}\n\n` : '') +
            `Log in to iEndorse to get started.\n\n` +
            `Best regards,\nThe iEndorse Team`
          );
          window.open(`mailto:${selectedClaim.userEmail}?subject=${subject}&body=${body}`, '_blank');
        }
      } else if (selectedClaim.userEmail) {
        // Native - use Alert
        Alert.alert(
          'Send Email?',
          'Would you like to send an approval notification email?',
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes',
              onPress: () => {
                const subject = encodeURIComponent('Your iEndorse Business Account is Ready!');
                const body = encodeURIComponent(
                  `Hi ${selectedClaim.userName},\n\n` +
                  `Great news! Your claim for "${selectedClaim.placeName}" has been approved!`
                );
                Linking.openURL(`mailto:${selectedClaim.userEmail}?subject=${subject}&body=${body}`);
              }
            }
          ]
        );
      }

      setSelectedClaim(null);
      setReviewNotes('');
      loadClaims();
    } catch (error) {
      console.error('[BusinessClaimsAdmin] Error approving claim:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to approve claim');
      } else {
        Alert.alert('Error', 'Failed to approve claim');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedClaim || !user?.primaryEmailAddress?.emailAddress) return;

    if (!reviewNotes.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please provide a reason for rejection');
      } else {
        Alert.alert('Required', 'Please provide a reason for rejection');
      }
      return;
    }

    setIsProcessing(true);
    try {
      await rejectClaim(
        selectedClaim.id,
        user.primaryEmailAddress.emailAddress,
        reviewNotes
      );

      if (Platform.OS === 'web') {
        window.alert('Claim rejected');
        // Ask if user wants to send email
        if (selectedClaim.userEmail) {
          const sendEmail = window.confirm('Would you like to send a rejection notification email?');
          if (sendEmail) {
            const subject = encodeURIComponent('Update on Your iEndorse Business Claim');
            const body = encodeURIComponent(
              `Hi ${selectedClaim.userName},\n\n` +
              `We've reviewed your claim for "${selectedClaim.placeName}" and unfortunately we were unable to verify your ownership at this time.\n\n` +
              `Reason:\n${reviewNotes}\n\n` +
              `If you believe this is an error, please reply to this email with additional verification information.\n\n` +
              `Best regards,\nThe iEndorse Team`
            );
            window.open(`mailto:${selectedClaim.userEmail}?subject=${subject}&body=${body}`, '_blank');
          }
        }
      } else {
        Alert.alert('Success', 'Claim rejected');
        // Native - use Alert for email
        if (selectedClaim.userEmail) {
          Alert.alert(
            'Send Email?',
            'Would you like to send a rejection notification email?',
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Yes',
                onPress: () => {
                  const subject = encodeURIComponent('Update on Your iEndorse Business Claim');
                  const body = encodeURIComponent(
                    `Hi ${selectedClaim.userName},\n\n` +
                    `We've reviewed your claim for "${selectedClaim.placeName}" and unfortunately we were unable to verify your ownership at this time.`
                  );
                  Linking.openURL(`mailto:${selectedClaim.userEmail}?subject=${subject}&body=${body}`);
                }
              }
            ]
          );
        }
      }
      setSelectedClaim(null);
      setReviewNotes('');
      loadClaims();
    } catch (error) {
      console.error('[BusinessClaimsAdmin] Error rejecting claim:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to reject claim');
      } else {
        Alert.alert('Error', 'Failed to reject claim');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertToBusinessAccount = async () => {
    if (!selectedClaim) return;

    if (selectedClaim.status !== 'approved') {
      Alert.alert('Error', 'Only approved claims can be converted to business accounts');
      return;
    }

    setIsProcessing(true);
    try {
      // Get place details to populate the business account
      const placeDetails = await getPlaceDetails(selectedClaim.placeId);

      console.log('[BusinessClaimsAdmin] Manual conversion - getting place details...');
      await convertClaimToBusinessAccount(selectedClaim.id, {
        name: selectedClaim.placeName,
        address: selectedClaim.placeAddress,
        category: selectedClaim.placeCategory,
        phone: placeDetails?.phone || selectedClaim.businessPhone,
        website: placeDetails?.website || '',
        location: placeDetails?.location,
        photoUrl: placeDetails?.photoReferences?.[0] || '',
      });
      console.log('[BusinessClaimsAdmin] Manual conversion successful');

      if (Platform.OS === 'web') {
        window.alert('Claim converted to business account. User can now manage their business on iEndorse.');
        // Ask if user wants to send email
        if (selectedClaim.userEmail) {
          const sendEmail = window.confirm('Would you like to send a notification email?');
          if (sendEmail) {
            const subject = encodeURIComponent('Your iEndorse Business Account is Ready!');
            const body = encodeURIComponent(
              `Hi ${selectedClaim.userName},\n\n` +
              `Great news! Your business account for "${selectedClaim.placeName}" has been set up.\n\n` +
              `You can now:\n` +
              `- Manage your business profile\n` +
              `- Set up customer discounts\n` +
              `- Track endorsements\n` +
              `- And more!\n\n` +
              `Log in to iEndorse to get started.\n\n` +
              `Best regards,\nThe iEndorse Team`
            );
            window.open(`mailto:${selectedClaim.userEmail}?subject=${subject}&body=${body}`, '_blank');
          }
        }
      } else {
        Alert.alert('Success', 'Claim converted to business account. User can now manage their business on iEndorse.');
      }
      setSelectedClaim(null);
      loadClaims();
    } catch (error: any) {
      console.error('[BusinessClaimsAdmin] Error converting claim:', error);
      Alert.alert('Error', error?.message || 'Failed to convert claim to business account');
    } finally {
      setIsProcessing(false);
    }
  };

  const sendEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>
            You don't have permission to access this page.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Claims</Text>
        <TouchableOpacity onPress={loadClaims} style={styles.refreshButton}>
          <RefreshCw size={20} color="#333" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['pending', 'approved', 'rejected', 'all'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
            {f !== 'all' && (
              <View style={[styles.filterBadge, { backgroundColor: getStatusColor(f) }]}>
                <Text style={styles.filterBadgeText}>
                  {claims.filter(c => c.status === f).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Claims List */}
      <ScrollView style={styles.content}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#007bff" />
          </View>
        ) : filteredClaims.length === 0 ? (
          <View style={styles.emptyState}>
            <Building2 size={48} color="#ccc" strokeWidth={1.5} />
            <Text style={styles.emptyStateText}>No {filter === 'all' ? '' : filter} claims</Text>
          </View>
        ) : (
          filteredClaims.map((claim) => (
            <TouchableOpacity
              key={claim.id}
              style={styles.claimCard}
              onPress={() => setSelectedClaim(claim)}
              activeOpacity={0.7}
            >
              <View style={styles.claimHeader}>
                <View style={styles.claimTitleRow}>
                  <Text style={styles.claimBusinessName} numberOfLines={1}>
                    {claim.placeName}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(claim.status) + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(claim.status) }]}>
                      {claim.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.claimAddress} numberOfLines={1}>
                  {claim.placeAddress}
                </Text>
              </View>

              <View style={styles.claimInfo}>
                <View style={styles.claimInfoRow}>
                  <User size={14} color="#666" strokeWidth={2} />
                  <Text style={styles.claimInfoText}>{claim.userName}</Text>
                </View>
                <View style={styles.claimInfoRow}>
                  <Mail size={14} color="#666" strokeWidth={2} />
                  <Text style={styles.claimInfoText}>{claim.userEmail}</Text>
                </View>
                <View style={styles.claimInfoRow}>
                  <Clock size={14} color="#666" strokeWidth={2} />
                  <Text style={styles.claimInfoText}>{formatDate(claim.submittedAt)}</Text>
                </View>
              </View>

              {claim.status === 'pending' && (
                <View style={styles.claimActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedClaim(claim);
                    }}
                  >
                    <Text style={styles.approveButtonText}>Review</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={!!selectedClaim}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedClaim(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedClaim(null)} style={styles.modalClose}>
              <X size={24} color="#333" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Review Claim</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedClaim && (
              <>
                {/* Business Info */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Business</Text>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoCardTitle}>{selectedClaim.placeName}</Text>
                    <View style={styles.infoRow}>
                      <MapPin size={16} color="#666" strokeWidth={2} />
                      <Text style={styles.infoRowText}>{selectedClaim.placeAddress}</Text>
                    </View>
                    <Text style={styles.infoRowCategory}>{selectedClaim.placeCategory}</Text>
                  </View>
                </View>

                {/* Claimant Info */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Claimant</Text>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <User size={16} color="#666" strokeWidth={2} />
                      <Text style={styles.infoRowText}>{selectedClaim.userName}</Text>
                    </View>
                    <Text style={styles.infoRowLabel}>Role: {selectedClaim.businessRole || 'Not specified'}</Text>

                    <TouchableOpacity
                      style={styles.contactRow}
                      onPress={() => sendEmail(selectedClaim.userEmail)}
                    >
                      <Mail size={16} color="#007bff" strokeWidth={2} />
                      <Text style={styles.contactRowText}>{selectedClaim.userEmail}</Text>
                      <ExternalLink size={14} color="#007bff" strokeWidth={2} />
                    </TouchableOpacity>

                    {selectedClaim.businessEmail && (
                      <TouchableOpacity
                        style={styles.contactRow}
                        onPress={() => sendEmail(selectedClaim.businessEmail!)}
                      >
                        <Mail size={16} color="#007bff" strokeWidth={2} />
                        <Text style={styles.contactRowText}>Business: {selectedClaim.businessEmail}</Text>
                        <ExternalLink size={14} color="#007bff" strokeWidth={2} />
                      </TouchableOpacity>
                    )}

                    {selectedClaim.businessPhone && (
                      <TouchableOpacity
                        style={styles.contactRow}
                        onPress={() => callPhone(selectedClaim.businessPhone!)}
                      >
                        <Phone size={16} color="#007bff" strokeWidth={2} />
                        <Text style={styles.contactRowText}>{selectedClaim.businessPhone}</Text>
                        <ExternalLink size={14} color="#007bff" strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Verification Details */}
                {selectedClaim.verificationDetails && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Additional Verification</Text>
                    <View style={styles.infoCard}>
                      <Text style={styles.verificationText}>{selectedClaim.verificationDetails}</Text>
                    </View>
                  </View>
                )}

                {/* Review Notes */}
                {selectedClaim.status === 'pending' && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Review Notes</Text>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Add notes (required for rejection)..."
                      placeholderTextColor="#999"
                      value={reviewNotes}
                      onChangeText={setReviewNotes}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                )}

                {/* Previous Review */}
                {selectedClaim.status !== 'pending' && selectedClaim.reviewNotes && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Review Notes</Text>
                    <View style={styles.infoCard}>
                      <Text style={styles.verificationText}>{selectedClaim.reviewNotes}</Text>
                      <Text style={styles.reviewedBy}>
                        Reviewed by {selectedClaim.reviewedBy} on {formatDate(selectedClaim.reviewedAt)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                {selectedClaim.status === 'pending' && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.rejectButton]}
                      onPress={handleReject}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <X size={18} color="#fff" strokeWidth={2} />
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalButton, styles.approveModalButton]}
                      onPress={handleApprove}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Check size={18} color="#fff" strokeWidth={2} />
                          <Text style={styles.approveModalButtonText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Convert to Business Button (for approved claims) */}
                {selectedClaim.status === 'approved' && !(selectedClaim as any).convertedToBusinessAt && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.convertButton]}
                      onPress={handleConvertToBusinessAccount}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Building2 size={18} color="#fff" strokeWidth={2} />
                          <Text style={styles.convertButtonText}>Convert to Business Account</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Already converted notice */}
                {selectedClaim.status === 'approved' && (selectedClaim as any).convertedToBusinessAt && (
                  <View style={[styles.infoCard, { marginTop: 20, backgroundColor: '#E8F5E9' }]}>
                    <View style={styles.infoRow}>
                      <Check size={18} color="#10B981" strokeWidth={2} />
                      <Text style={[styles.infoRowText, { color: '#10B981', fontWeight: '600' }]}>
                        Converted to business account
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  refreshButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#007bff',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  claimCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  claimHeader: {
    marginBottom: 12,
  },
  claimTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  claimBusinessName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  claimAddress: {
    fontSize: 14,
    color: '#666',
  },
  claimInfo: {
    gap: 6,
  },
  claimInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claimInfoText: {
    fontSize: 14,
    color: '#666',
  },
  claimActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#007bff',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalClose: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoRowText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  infoRowLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  infoRowCategory: {
    fontSize: 13,
    color: '#007bff',
    marginTop: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  contactRowText: {
    fontSize: 14,
    color: '#007bff',
    flex: 1,
  },
  verificationText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  reviewedBy: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
  },
  reviewInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  approveModalButton: {
    backgroundColor: '#10B981',
  },
  approveModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  convertButton: {
    backgroundColor: '#007bff',
    flex: 1,
  },
  convertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
