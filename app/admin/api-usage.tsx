/**
 * Admin Panel - Google Places API Usage
 *
 * Track and monitor Google Places API usage
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw, TrendingUp, Search, MapPin, Image } from 'lucide-react-native';
import { getApiUsageStats, initializeApiUsageStats } from '@/services/firebase/placesService';

// Admin email whitelist
const ADMIN_EMAILS = ['normancdesilva@gmail.com'];

// Free tier limits (monthly)
const FREE_TIER_LIMITS = {
  textSearch: 100000, // $0.00 per call up to this
  placeDetails: 100000, // $0.00 per call up to this
  placePhoto: 100000, // $0.00 per call up to this
};

export default function ApiUsageAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setIsAdmin(ADMIN_EMAILS.includes(user.primaryEmailAddress.emailAddress));
    }
    loadStats();
  }, [user]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const apiStats = await getApiUsageStats();
      setStats(apiStats);
    } catch (error) {
      console.error('[ApiUsageAdmin] Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStats();
    setIsRefreshing(false);
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      const result = await initializeApiUsageStats();
      if (result.success) {
        await loadStats();
      }
      alert(result.message);
    } catch (error: any) {
      console.error('[ApiUsageAdmin] Error initializing stats:', error);
      alert(error.message || 'Failed to initialize stats');
    } finally {
      setIsInitializing(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number): number => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return '#EF4444'; // Red
    if (percentage >= 70) return '#F59E0B'; // Orange
    if (percentage >= 50) return '#FBBF24'; // Yellow
    return '#10B981'; // Green
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
  };

  const getCurrentMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

  const currentMonth = getCurrentMonth();
  const currentMonthCalls = stats?.monthlyCalls?.[currentMonth] || 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>API Usage</Text>
          <Text style={styles.subtitle}>Google Places API Statistics</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton} disabled={isRefreshing}>
          <RefreshCw size={20} color={isRefreshing ? '#ccc' : '#333'} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285f4" />
            <Text style={styles.loadingText}>Loading statistics...</Text>
          </View>
        ) : stats ? (
          <>
            {/* Overview Cards */}
            <View style={styles.overviewSection}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.overviewCards}>
                <View style={[styles.overviewCard, { backgroundColor: '#E8F0FE' }]}>
                  <TrendingUp size={24} color="#4285f4" strokeWidth={2} />
                  <Text style={styles.overviewValue}>{formatNumber(stats.totalCalls)}</Text>
                  <Text style={styles.overviewLabel}>Total API Calls</Text>
                </View>
                <View style={[styles.overviewCard, { backgroundColor: '#E6F4EA' }]}>
                  <Search size={24} color="#34A853" strokeWidth={2} />
                  <Text style={styles.overviewValue}>{formatNumber(stats.searchCalls)}</Text>
                  <Text style={styles.overviewLabel}>Search Calls</Text>
                </View>
                <View style={[styles.overviewCard, { backgroundColor: '#FEF7E0' }]}>
                  <MapPin size={24} color="#FBBC04" strokeWidth={2} />
                  <Text style={styles.overviewValue}>{formatNumber(stats.detailsCalls)}</Text>
                  <Text style={styles.overviewLabel}>Details Calls</Text>
                </View>
                <View style={[styles.overviewCard, { backgroundColor: '#FCE8E6' }]}>
                  <Image size={24} color="#EA4335" strokeWidth={2} />
                  <Text style={styles.overviewValue}>{formatNumber(stats.photoCalls)}</Text>
                  <Text style={styles.overviewLabel}>Photo Calls</Text>
                </View>
              </View>
            </View>

            {/* Current Month Usage */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Month ({currentMonth})</Text>
              <View style={styles.usageCard}>
                <View style={styles.usageHeader}>
                  <Text style={styles.usageTitle}>API Calls This Month</Text>
                  <Text style={styles.usageCount}>{formatNumber(currentMonthCalls)}</Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${getUsagePercentage(currentMonthCalls, FREE_TIER_LIMITS.textSearch)}%`,
                        backgroundColor: getUsageColor(getUsagePercentage(currentMonthCalls, FREE_TIER_LIMITS.textSearch)),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.usageSubtext}>
                  {getUsagePercentage(currentMonthCalls, FREE_TIER_LIMITS.textSearch).toFixed(1)}% of free tier ({formatNumber(FREE_TIER_LIMITS.textSearch)} calls)
                </Text>
              </View>
            </View>

            {/* Monthly Breakdown */}
            {stats.monthlyCalls && Object.keys(stats.monthlyCalls).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
                <View style={styles.monthlyList}>
                  {Object.entries(stats.monthlyCalls)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([month, count]: [string, any]) => (
                      <View key={month} style={styles.monthlyRow}>
                        <Text style={styles.monthlyMonth}>{month}</Text>
                        <View style={styles.monthlyBarContainer}>
                          <View
                            style={[
                              styles.monthlyBar,
                              {
                                width: `${Math.min((count / Math.max(...Object.values(stats.monthlyCalls) as number[])) * 100, 100)}%`,
                                backgroundColor: month === currentMonth ? '#4285f4' : '#CBD5E1',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.monthlyCount}>{formatNumber(count)}</Text>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* Free Tier Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Free Tier Limits</Text>
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  Google Places API offers a monthly $200 credit which covers:
                </Text>
                <View style={styles.infoList}>
                  <Text style={styles.infoItem}>• Text Search: ~{formatNumber(FREE_TIER_LIMITS.textSearch)} requests/month</Text>
                  <Text style={styles.infoItem}>• Place Details: ~{formatNumber(FREE_TIER_LIMITS.placeDetails)} requests/month</Text>
                  <Text style={styles.infoItem}>• Place Photos: ~{formatNumber(FREE_TIER_LIMITS.placePhoto)} requests/month</Text>
                </View>
                <Text style={styles.infoNote}>
                  Note: Actual limits depend on the specific API calls and their pricing tiers.
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <TrendingUp size={48} color="#ccc" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              API usage statistics will appear here once API calls are made. Click "Initialize Stats" to create the tracking document.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.refreshButtonLarge, { backgroundColor: '#10B981' }]}
                onPress={handleInitialize}
                disabled={isInitializing}
              >
                <Text style={styles.refreshButtonLargeText}>
                  {isInitializing ? 'Initializing...' : 'Initialize Stats'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.refreshButtonLarge} onPress={handleRefresh}>
                <RefreshCw size={18} color="#fff" strokeWidth={2} />
                <Text style={styles.refreshButtonLargeText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  overviewSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  overviewCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    minWidth: 150,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  usageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  usageCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4285f4',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  usageSubtext: {
    fontSize: 13,
    color: '#666',
  },
  monthlyList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  monthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthlyMonth: {
    width: 80,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  monthlyBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  monthlyBar: {
    height: '100%',
    borderRadius: 4,
  },
  monthlyCount: {
    width: 60,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4285f4',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoList: {
    gap: 6,
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 14,
    color: '#555',
  },
  infoNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
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
    textAlign: 'center',
    maxWidth: 280,
  },
  refreshButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4285f4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  refreshButtonLargeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
