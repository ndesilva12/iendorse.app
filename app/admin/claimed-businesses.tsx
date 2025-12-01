/**
 * Admin Panel - Claimed Businesses
 *
 * View all claimed businesses and allow detaching users from businesses
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Building2, UserX, Calendar, Mail, Phone, MapPin } from 'lucide-react-native';
import {
  getApprovedClaims,
  revokeClaim,
  revertToPersonalAccount,
  BusinessClaim,
} from '@/services/firebase/businessClaimService';

// Admin email whitelist
const ADMIN_EMAILS = [
  'normancdesilva@gmail.com',
];

export default function ClaimedBusinessesAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [claims, setClaims] = useState<BusinessClaim[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<BusinessClaim | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

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
      const approvedClaims = await getApprovedClaims();
      setClaims(approvedClaims);
    } catch (error) {
      console.error('Error loading claims:', error);
      Alert.alert('Error', 'Failed to load claimed businesses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = (claim: BusinessClaim) => {
    setSelectedClaim(claim);
    setRevokeReason('');
    setRevokeModalVisible(true);
  };

  const confirmRevoke = async (action: 'revoke' | 'delete' | 'revert') => {
    if (!selectedClaim || !user?.primaryEmailAddress?.emailAddress) return;

    if (!revokeReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for this action');
      return;
    }

    setIsRevoking(true);
    try {
      if (action === 'revert') {
        // Fully revert to personal account - removes all business info
        await revertToPersonalAccount(
          selectedClaim.userId,
          user.primaryEmailAddress.emailAddress,
          revokeReason.trim()
        );

        Alert.alert(
          'Success',
          'Business account has been fully reverted to a personal account. All business info has been removed.'
        );
      } else {
        // Just revoke or delete the claim
        await revokeClaim(
          selectedClaim.id,
          user.primaryEmailAddress.emailAddress,
          revokeReason.trim(),
          action === 'delete'
        );

        Alert.alert(
          'Success',
          action === 'delete'
            ? 'Claim has been deleted and the business is now available for others to claim.'
            : 'Claim has been revoked. The user will need to submit a new claim.'
        );
      }

      setRevokeModalVisible(false);
      setSelectedClaim(null);
      setRevokeReason('');
      loadClaims();
    } catch (error) {
      console.error('Error processing action:', error);
      Alert.alert('Error', 'Failed to process action');
    } finally {
      setIsRevoking(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter claims by search query
  const filteredClaims = claims.filter(claim => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      claim.placeName?.toLowerCase().includes(query) ||
      claim.placeAddress?.toLowerCase().includes(query) ||
      claim.userName?.toLowerCase().includes(query) ||
      claim.userEmail?.toLowerCase().includes(query)
    );
  });

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
        <View style={styles.headerContent}>
          <Text style={styles.title}>Claimed Businesses</Text>
          <Text style={styles.subtitle}>{claims.length} claimed businesses</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#888" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by business name, address, or user..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading claimed businesses...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {filteredClaims.length === 0 ? (
            <View style={styles.emptyState}>
              <Building2 size={48} color="#888" strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matches found' : 'No claimed businesses'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Try a different search term'
                  : 'No businesses have been claimed yet'}
              </Text>
            </View>
          ) : (
            filteredClaims.map((claim) => (
              <View key={claim.id} style={styles.claimCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.businessIcon}>
                    <Building2 size={24} color="#fff" strokeWidth={2} />
                  </View>
                  <View style={styles.businessInfo}>
                    <Text style={styles.businessName} numberOfLines={1}>
                      {claim.placeName}
                    </Text>
                    <View style={styles.addressRow}>
                      <MapPin size={14} color="#888" strokeWidth={2} />
                      <Text style={styles.businessAddress} numberOfLines={1}>
                        {claim.placeAddress}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.claimantSection}>
                  <Text style={styles.sectionLabel}>Claimed By</Text>
                  <Text style={styles.claimantName}>{claim.userName}</Text>
                  <View style={styles.detailRow}>
                    <Mail size={14} color="#888" strokeWidth={2} />
                    <Text style={styles.detailText}>{claim.userEmail}</Text>
                  </View>
                  {claim.businessPhone && (
                    <View style={styles.detailRow}>
                      <Phone size={14} color="#888" strokeWidth={2} />
                      <Text style={styles.detailText}>{claim.businessPhone}</Text>
                    </View>
                  )}
                  {claim.businessRole && (
                    <Text style={styles.roleText}>Role: {claim.businessRole}</Text>
                  )}
                </View>

                <View style={styles.dateSection}>
                  <View style={styles.detailRow}>
                    <Calendar size={14} color="#888" strokeWidth={2} />
                    <Text style={styles.detailText}>
                      Approved: {formatDate(claim.reviewedAt)}
                    </Text>
                  </View>
                  {claim.reviewedBy && (
                    <Text style={styles.reviewerText}>By: {claim.reviewedBy}</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.revokeButton}
                  onPress={() => handleRevoke(claim)}
                >
                  <UserX size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.revokeButtonText}>Detach User</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Revoke Modal */}
      <Modal
        visible={revokeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRevokeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Revoke Business Claim</Text>
            <Text style={styles.modalSubtitle}>
              This will detach {selectedClaim?.userName} from {selectedClaim?.placeName}
            </Text>

            <Text style={styles.inputLabel}>Reason for revoking *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason for revoking this claim..."
              placeholderTextColor="#888"
              value={revokeReason}
              onChangeText={setRevokeReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  setRevokeModalVisible(false);
                  setSelectedClaim(null);
                  setRevokeReason('');
                }}
                disabled={isRevoking}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButtonRevoke, !revokeReason.trim() && styles.buttonDisabled]}
                onPress={() => confirmRevoke('revoke')}
                disabled={isRevoking || !revokeReason.trim()}
              >
                {isRevoking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonRevokeText}>Revoke Claim</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.revertButton, !revokeReason.trim() && styles.buttonDisabled]}
              onPress={() => confirmRevoke('revert')}
              disabled={isRevoking || !revokeReason.trim()}
            >
              <Text style={styles.revertButtonText}>Revert to Personal Account</Text>
            </TouchableOpacity>
            <Text style={styles.revertHelpText}>
              This will remove all business info and convert the user back to a personal account
            </Text>

            <TouchableOpacity
              style={[styles.deleteButton, !revokeReason.trim() && styles.buttonDisabled]}
              onPress={() => confirmRevoke('delete')}
              disabled={isRevoking || !revokeReason.trim()}
            >
              <Text style={styles.deleteButtonText}>Delete Claim Permanently</Text>
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
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  claimCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  businessIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  businessAddress: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  claimantSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  claimantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  roleText: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  dateSection: {
    marginBottom: 16,
  },
  reviewerText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginLeft: 20,
  },
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
  },
  revokeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    minHeight: 80,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonRevoke: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
  },
  modalButtonRevokeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  revertButton: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    marginBottom: 4,
  },
  revertButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  revertHelpText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteButton: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
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
});
