/**
 * Admin Panel - Main Dashboard
 *
 * Provides access to manage:
 * - Values (causes)
 * - Brands
 * - Businesses
 * - Users
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiUsageStats } from '@/services/firebase/placesService';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebase';

// Admin email whitelist
const ADMIN_EMAILS = [
  'normancdesilva@gmail.com',
  // Add more admin emails here
];

interface CollectionStats {
  users: number;
  brands: number;
  values: number;
  businesses: number;
  transactions: number;
  businessClaims: number;
}

export default function AdminDashboard() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiUsageStats, setApiUsageStats] = useState<any>(null);
  const [collectionStats, setCollectionStats] = useState<CollectionStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    // Check if user is admin
    if (user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      setIsAdmin(ADMIN_EMAILS.includes(email));
    }
    setIsLoading(false);

    // Load API usage stats
    loadApiStats();
    // Load collection stats
    loadCollectionStats();
  }, [user]);

  const loadApiStats = async () => {
    const stats = await getApiUsageStats();
    setApiUsageStats(stats);
  };

  const loadCollectionStats = async () => {
    setLoadingStats(true);
    try {
      const [usersSnap, brandsSnap, valuesSnap, businessesSnap, transactionsSnap, claimsSnap] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'brands')),
        getCountFromServer(collection(db, 'values')),
        getCountFromServer(collection(db, 'businesses')),
        getCountFromServer(collection(db, 'transactions')),
        getCountFromServer(collection(db, 'businessClaims')),
      ]);
      setCollectionStats({
        users: usersSnap.data().count,
        brands: brandsSnap.data().count,
        values: valuesSnap.data().count,
        businesses: businessesSnap.data().count,
        transactions: transactionsSnap.data().count,
        businessClaims: claimsSnap.data().count,
      });
    } catch (error) {
      console.error('[AdminDashboard] Error loading collection stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>
            You don't have permission to access the admin panel.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>
            Manage values, brands, businesses, and users
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Values Management */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/values')}
          >
            <Text style={styles.cardIcon}>📊</Text>
            <Text style={styles.cardTitle}>Values Management</Text>
            <Text style={styles.cardDescription}>
              Add, edit, or delete values and their brand associations
            </Text>
          </TouchableOpacity>

          {/* Brands Management */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/brands')}
          >
            <Text style={styles.cardIcon}>🏢</Text>
            <Text style={styles.cardTitle}>Brands Management</Text>
            <Text style={styles.cardDescription}>
              Manage brands, money flow sections, and all brand data
            </Text>
          </TouchableOpacity>

          {/* Brand Categories */}
          <TouchableOpacity
            style={[styles.card, styles.highlightCard]}
            onPress={() => router.push('/admin/brand-categories')}
          >
            <Text style={styles.cardIcon}>🏷️</Text>
            <Text style={styles.cardTitle}>Brand Categories</Text>
            <Text style={styles.cardDescription}>
              Quickly categorize brands for filtering. Assign categories with one tap.
            </Text>
          </TouchableOpacity>

          {/* Incomplete Brands */}
          <TouchableOpacity
            style={[styles.card, styles.highlightCard]}
            onPress={() => router.push('/admin/incomplete-brands')}
          >
            <Text style={styles.cardIcon}>⚠️</Text>
            <Text style={styles.cardTitle}>Incomplete Brands</Text>
            <Text style={styles.cardDescription}>
              Manage auto-created brands that need completion. Fill in details and mark as verified.
            </Text>
          </TouchableOpacity>

          {/* Cleanup Duplicates */}
          <TouchableOpacity
            style={[styles.card, styles.warningCard]}
            onPress={() => router.push('/admin/cleanup-duplicates')}
          >
            <Text style={styles.cardIcon}>🧹</Text>
            <Text style={styles.cardTitle}>Cleanup Duplicate Brands</Text>
            <Text style={styles.cardDescription}>
              Find and remove duplicate auto-created brands
            </Text>
          </TouchableOpacity>

          {/* Business Management */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/businesses')}
          >
            <Text style={styles.cardIcon}>👥</Text>
            <Text style={styles.cardTitle}>Businesses</Text>
            <Text style={styles.cardDescription}>
              Edit business profiles and all business data
            </Text>
          </TouchableOpacity>

          {/* Users Management */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/users')}
          >
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={styles.cardTitle}>Users</Text>
            <Text style={styles.cardDescription}>
              Edit user profiles, causes, and personal data
            </Text>
          </TouchableOpacity>

          {/* Prominent Users Management */}
          <TouchableOpacity
            style={[styles.card, styles.highlightCard]}
            onPress={() => router.push('/admin/prominent-users')}
          >
            <Text style={styles.cardIcon}>⭐</Text>
            <Text style={styles.cardTitle}>Prominent Users</Text>
            <Text style={styles.cardDescription}>
              Manage celebrity and notable user accounts. Create profiles, generate claim links, and normalize accounts.
            </Text>
          </TouchableOpacity>

          {/* Brand Requests */}
          <TouchableOpacity
            style={[styles.card, styles.highlightCard]}
            onPress={() => router.push('/admin/brand-requests')}
          >
            <Text style={styles.cardIcon}>📝</Text>
            <Text style={styles.cardTitle}>Brand Requests</Text>
            <Text style={styles.cardDescription}>
              View and manage user-submitted brand/business suggestions
            </Text>
          </TouchableOpacity>

          {/* Business Claims */}
          <TouchableOpacity
            style={[styles.card, styles.highlightCard]}
            onPress={() => router.push('/admin/business-claims')}
          >
            <Text style={styles.cardIcon}>🏪</Text>
            <Text style={styles.cardTitle}>Business Claims</Text>
            <Text style={styles.cardDescription}>
              Review and approve business ownership claims. Contact claimants via email/phone.
            </Text>
          </TouchableOpacity>

          {/* Claimed Businesses */}
          <TouchableOpacity
            style={[styles.card, styles.highlightCard]}
            onPress={() => router.push('/admin/claimed-businesses')}
          >
            <Text style={styles.cardIcon}>✅</Text>
            <Text style={styles.cardTitle}>Claimed Businesses</Text>
            <Text style={styles.cardDescription}>
              View all claimed businesses and detach users to release businesses for new claims.
            </Text>
          </TouchableOpacity>

          {/* Transactions */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/transactions')}
          >
            <Text style={styles.cardIcon}>💳</Text>
            <Text style={styles.cardTitle}>All Transactions</Text>
            <Text style={styles.cardDescription}>
              View all transactions across all businesses
            </Text>
          </TouchableOpacity>

          {/* Business Financials */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/financials')}
          >
            <Text style={styles.cardIcon}>💰</Text>
            <Text style={styles.cardTitle}>Business Financials</Text>
            <Text style={styles.cardDescription}>
              Manage business accounts, amounts owed, and record payments
            </Text>
          </TouchableOpacity>

          {/* Custom Fields */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/custom-fields')}
          >
            <Text style={styles.cardIcon}>🔧</Text>
            <Text style={styles.cardTitle}>Custom Fields</Text>
            <Text style={styles.cardDescription}>
              Create and manage custom fields for users, businesses, brands, and transactions
            </Text>
          </TouchableOpacity>

          {/* Reorder Endorsements */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/admin/reorder-endorsements')}
          >
            <Text style={styles.cardIcon}>📋</Text>
            <Text style={styles.cardTitle}>Reorder Endorsements</Text>
            <Text style={styles.cardDescription}>
              Reorder any user's endorsement list via drag-and-drop
            </Text>
          </TouchableOpacity>

          {/* Google Places API Usage */}
          <TouchableOpacity
            style={[styles.card, styles.apiCard]}
            onPress={() => router.push('/admin/api-usage')}
            activeOpacity={0.7}
          >
            <Text style={styles.cardIcon}>🗺️</Text>
            <Text style={styles.cardTitle}>Google Places API Usage</Text>
            <Text style={styles.cardDescription}>
              Track API calls to monitor usage against free tier limits. Tap for details.
            </Text>
            {apiUsageStats ? (
              <View style={styles.apiStatsContainer}>
                <View style={styles.apiStatRow}>
                  <Text style={styles.apiStatLabel}>Total Calls:</Text>
                  <Text style={styles.apiStatValue}>{apiUsageStats.totalCalls?.toLocaleString() || 0}</Text>
                </View>
                <View style={styles.apiStatRow}>
                  <Text style={styles.apiStatLabel}>Search Calls:</Text>
                  <Text style={styles.apiStatValue}>{apiUsageStats.searchCalls?.toLocaleString() || 0}</Text>
                </View>
                <View style={styles.apiStatRow}>
                  <Text style={styles.apiStatLabel}>Details Calls:</Text>
                  <Text style={styles.apiStatValue}>{apiUsageStats.detailsCalls?.toLocaleString() || 0}</Text>
                </View>
                <Text style={styles.tapForMoreText}>Tap for detailed stats →</Text>
              </View>
            ) : (
              <Text style={styles.noStatsText}>Tap to view API usage statistics</Text>
            )}
          </TouchableOpacity>

          {/* Database Stats */}
          <TouchableOpacity
            style={[styles.card, styles.statsCard]}
            onPress={loadCollectionStats}
            activeOpacity={0.7}
          >
            <Text style={styles.cardIcon}>📈</Text>
            <Text style={styles.cardTitle}>Quick Stats</Text>
            {loadingStats ? (
              <View style={styles.statsLoadingContainer}>
                <ActivityIndicator size="small" color="#4285f4" />
                <Text style={styles.statsLoadingText}>Loading stats...</Text>
              </View>
            ) : collectionStats ? (
              <View style={styles.statsContainer}>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{collectionStats.users.toLocaleString()}</Text>
                    <Text style={styles.statBoxLabel}>Users</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{collectionStats.brands.toLocaleString()}</Text>
                    <Text style={styles.statBoxLabel}>Brands</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{collectionStats.values.toLocaleString()}</Text>
                    <Text style={styles.statBoxLabel}>Values</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{collectionStats.businesses.toLocaleString()}</Text>
                    <Text style={styles.statBoxLabel}>Businesses</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{collectionStats.transactions.toLocaleString()}</Text>
                    <Text style={styles.statBoxLabel}>Transactions</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{collectionStats.businessClaims.toLocaleString()}</Text>
                    <Text style={styles.statBoxLabel}>Claims</Text>
                  </View>
                </View>
                <Text style={styles.tapForMoreText}>Tap to refresh</Text>
              </View>
            ) : (
              <View style={styles.statsContainer}>
                <Text style={styles.noStatsText}>Tap to load database statistics</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
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
  cardsContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 280,
    maxWidth: 400,
    flex: 1,
    flexBasis: Platform.OS === 'web' ? '30%' : '100%',
  },
  statsCard: {
    backgroundColor: '#f0f4f8',
  },
  highlightCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    backgroundColor: '#e3f2fd',
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    backgroundColor: '#fff8e1',
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
  statsContainer: {
    marginTop: 12,
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  statValue: {
    fontSize: 14,
    color: '#777',
    flex: 1,
  },
  // API Usage Styles
  apiCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4285f4',
    backgroundColor: '#e8f0fe',
  },
  apiStatsContainer: {
    marginTop: 12,
    gap: 8,
  },
  apiStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  apiStatLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  apiStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  monthlySection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    gap: 4,
  },
  monthlyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  refreshButton: {
    marginTop: 12,
    backgroundColor: '#4285f4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  noStatsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  tapForMoreText: {
    marginTop: 12,
    fontSize: 13,
    color: '#4285f4',
    fontWeight: '500',
    textAlign: 'right',
  },
  statsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 20,
  },
  statsLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  statBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
});
