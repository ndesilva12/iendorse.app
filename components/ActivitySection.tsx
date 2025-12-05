import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

type TimeFrame = 'week' | 'month' | 'year';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  percentAligned: number;
  percentUnaligned: number;
}

interface ValueSpending {
  valueName: string;
  amount: number;
  percentage: number;
}

interface SpendingData {
  aligned: number;
  opposed: number;
  neutral: number;
  totalAmount: number;
  alignedAmount: number;
  opposedAmount: number;
  neutralAmount: number;
  transactions: Transaction[];
  valueSpending: ValueSpending[];
}

// Mock data generator based on timeframe
const generateMockData = (timeframe: TimeFrame, userValues: { name: string; type: string }[]): SpendingData => {
  const baseMultiplier = timeframe === 'week' ? 1 : timeframe === 'month' ? 4.3 : 52;

  // Generate realistic percentages
  const aligned = 45 + Math.random() * 15; // 45-60%
  const opposed = 15 + Math.random() * 10; // 15-25%
  const neutral = 100 - aligned - opposed;

  const totalAmount = (250 + Math.random() * 150) * baseMultiplier;
  const alignedAmount = (totalAmount * aligned) / 100;
  const opposedAmount = (totalAmount * opposed) / 100;
  const neutralAmount = (totalAmount * neutral) / 100;

  // Generate mock transactions
  const merchants = [
    'Whole Foods Market',
    'Patagonia',
    'Local Coffee Shop',
    'Amazon',
    'Target',
    'Trader Joe\'s',
    'Starbucks',
    'Nike',
    'Apple Store',
    'Farmers Market',
    'REI',
    'Fast Fashion Co',
    'Gas Station',
    'Restaurant',
    'Bookstore',
  ];

  const numTransactions = timeframe === 'week' ? 8 : timeframe === 'month' ? 25 : 150;
  const transactions: Transaction[] = [];

  const now = new Date();
  for (let i = 0; i < numTransactions; i++) {
    const daysAgo = timeframe === 'week' ? i : timeframe === 'month' ? i * 1.2 : i * 2.4;
    const transactionDate = new Date(now);
    transactionDate.setDate(transactionDate.getDate() - Math.floor(daysAgo));

    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const amount = 10 + Math.random() * 150;

    // Vary alignment based on merchant
    let percentAligned, percentUnaligned;
    if (merchant.includes('Whole Foods') || merchant.includes('Patagonia') || merchant.includes('Local') || merchant.includes('Farmers')) {
      percentAligned = 70 + Math.random() * 25;
      percentUnaligned = Math.random() * 10;
    } else if (merchant.includes('Fast Fashion') || merchant.includes('Gas')) {
      percentAligned = Math.random() * 15;
      percentUnaligned = 60 + Math.random() * 30;
    } else {
      percentAligned = 20 + Math.random() * 40;
      percentUnaligned = 10 + Math.random() * 30;
    }

    transactions.push({
      id: `txn-${i}`,
      date: transactionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      merchant,
      amount: Math.round(amount * 100) / 100,
      percentAligned: Math.round(percentAligned),
      percentUnaligned: Math.round(percentUnaligned),
    });
  }

  // Generate spending per value
  const supportValues = userValues.filter(v => v.type === 'support');
  const valueSpending: ValueSpending[] = supportValues.map((value) => {
    // Distribute aligned spending across values with some randomness
    const basePercentage = alignedAmount / supportValues.length;
    const variance = basePercentage * (0.3 + Math.random() * 0.4); // 30-70% variance
    const amount = basePercentage + (Math.random() > 0.5 ? variance : -variance);
    const percentage = (amount / totalAmount) * 100;

    return {
      valueName: value.name,
      amount: Math.max(0, Math.round(amount * 100) / 100),
      percentage: Math.max(0, Math.round(percentage * 10) / 10),
    };
  });

  return {
    aligned: Math.round(aligned * 10) / 10,
    opposed: Math.round(opposed * 10) / 10,
    neutral: Math.round(neutral * 10) / 10,
    totalAmount: Math.round(totalAmount * 100) / 100,
    alignedAmount: Math.round(alignedAmount * 100) / 100,
    opposedAmount: Math.round(opposedAmount * 100) / 100,
    neutralAmount: Math.round(neutralAmount * 100) / 100,
    transactions,
    valueSpending,
  };
};

interface ActivitySectionProps {
  timeframe?: TimeFrame;
  onTimeframeChange?: (timeframe: TimeFrame) => void;
}

export default function ActivitySection({ timeframe: externalTimeframe, onTimeframeChange }: ActivitySectionProps = {}) {
  const [internalTimeframe, setInternalTimeframe] = useState<TimeFrame>('month');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const { isDarkMode, profile } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  // Use external timeframe if provided, otherwise use internal state
  const timeframe = externalTimeframe || internalTimeframe;
  const setTimeframe = (tf: TimeFrame) => {
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    } else {
      setInternalTimeframe(tf);
    }
  };

  // Note: Values are no longer associated with user profiles
  // Using empty array for mock data generation
  const userValues: { name: string; type: string }[] = [];

  // Generate data based on timeframe
  const data = generateMockData(timeframe, userValues);

  const timeframes: { value: TimeFrame; label: string }[] = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
  ];

  return (
    <View style={styles.statsSection}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity</Text>
      <View style={[styles.statsCard, { backgroundColor: 'transparent', borderColor: colors.primaryLight }]}>

        {/* Header: Title + Time Selector */}
        <View style={styles.header}>
          <Text style={[styles.spendingTitle, { color: colors.text }]}>Your Spending</Text>
          <View style={styles.timelineCompact}>
            {timeframes.map((tf) => (
              <TouchableOpacity
                key={tf.value}
                style={[
                  styles.timelineButtonCompact,
                  timeframe === tf.value && { backgroundColor: colors.primary },
                ]}
                onPress={() => setTimeframe(tf.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.timelineButtonTextCompact,
                    { color: colors.textSecondary },
                    timeframe === tf.value && { color: colors.white, fontWeight: '600' },
                  ]}
                >
                  {tf.label.replace('This ', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Total Amount - Hero Element */}
        <View style={styles.totalContainer}>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            ${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            total spent
          </Text>
        </View>

        {/* Horizontal Bar - Thicker and more prominent */}
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barSegment,
              styles.barAligned,
              { flex: data.aligned, backgroundColor: colors.primary },
            ]}
          />
          <View
            style={[
              styles.barSegment,
              styles.barNeutral,
              { flex: data.neutral, backgroundColor: isDarkMode ? '#1A2332' : '#F5F6F7' },
            ]}
          />
          <View
            style={[
              styles.barSegment,
              styles.barOpposed,
              { flex: data.opposed, backgroundColor: '#6B7280' },
            ]}
          />
        </View>

        {/* Breakdown: Percentages, Labels, and Amounts Combined */}
        <View style={styles.breakdownRow}>
          {/* Aligned */}
          <View style={[styles.breakdownItem, { flex: data.aligned }]}>
            <Text style={[styles.breakdownPercent, { color: colors.primary }]}>
              {data.aligned.toFixed(0)}%
            </Text>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
              Aligned
            </Text>
            <Text style={[styles.breakdownAmount, { color: colors.text }]}>
              ${data.alignedAmount.toFixed(0)}
            </Text>
          </View>

          {/* Neutral */}
          <View style={[styles.breakdownItem, { flex: data.neutral }]}>
            <Text style={[styles.breakdownPercent, { color: colors.textSecondary }]}>
              {data.neutral.toFixed(0)}%
            </Text>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
              Neutral
            </Text>
            <Text style={[styles.breakdownAmount, { color: colors.text }]}>
              ${data.neutralAmount.toFixed(0)}
            </Text>
          </View>

          {/* Unaligned */}
          <View style={[styles.breakdownItem, { flex: data.opposed }]}>
            <Text style={[styles.breakdownPercent, { color: '#6B7280' }]}>
              {data.opposed.toFixed(0)}%
            </Text>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
              Unaligned
            </Text>
            <Text style={[styles.breakdownAmount, { color: colors.text }]}>
              ${data.opposedAmount.toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Actions Row: Bank Management + View Details */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
              Manage Banks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary, { borderColor: colors.primary }]}
            onPress={() => setDetailsExpanded(!detailsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
              {detailsExpanded ? 'Hide Details' : 'View Details'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expandable Details */}
        {detailsExpanded && (
          <View style={[styles.detailsContainer, { borderTopColor: colors.border }]}>
            <Text style={[styles.detailsTitle, { color: colors.text }]}>
              Recent Transactions
            </Text>
            {data.transactions.slice(0, 15).map((transaction) => (
              <View key={transaction.id} style={[styles.transactionItem, { borderBottomColor: colors.border }]}>
                <View style={styles.transactionHeader}>
                  <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={1}>
                    {transaction.merchant}
                  </Text>
                  <Text style={[styles.transactionAmount, { color: colors.text }]}>
                    ${transaction.amount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.transactionMeta}>
                  <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>
                    {transaction.date}
                  </Text>
                  <View style={styles.alignmentBadges}>
                    {transaction.percentAligned > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.badgeText, { color: colors.primary }]}>
                          {transaction.percentAligned}% aligned
                        </Text>
                      </View>
                    )}
                    {transaction.percentUnaligned > 0 && (
                      <View style={[styles.badge, { backgroundColor: '#9CA3AF' + '20' }]}>
                        <Text style={[styles.badgeText, { color: '#9CA3AF' }]}>
                          {transaction.percentUnaligned}% unaligned
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 16,
  },
  statsCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
  },
  // Header with title and compact time selector
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  spendingTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  timelineCompact: {
    flexDirection: 'row',
    gap: 4,
  },
  timelineButtonCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  timelineButtonTextCompact: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  // Total amount - hero element
  totalContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: '700' as const,
    letterSpacing: -1,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  // Bar - thicker and more prominent
  barContainer: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 16,
  },
  barSegment: {
    // flex set dynamically
  },
  barAligned: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  barNeutral: {
    // middle segment
  },
  barOpposed: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  // Breakdown - combined percentages, labels, and amounts
  breakdownRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 24,
  },
  breakdownItem: {
    alignItems: 'center',
    gap: 4,
  },
  breakdownPercent: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  // Actions row
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    // Border color set dynamically
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  // Details section
  detailsContainer: {
    borderTopWidth: 1,
    paddingTop: 20,
    marginTop: 20,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  transactionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  merchantName: {
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
    marginRight: 12,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  transactionDate: {
    fontSize: 12,
  },
  alignmentBadges: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
});
