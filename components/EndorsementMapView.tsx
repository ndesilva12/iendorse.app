import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ListEntry } from '@/types/library';
import { MapPin, ExternalLink } from 'lucide-react-native';

export interface MapEntry {
  id: string;
  name: string;
  category?: string;
  address?: string;
  logoUrl?: string;
  location: {
    lat: number;
    lng: number;
  };
  type: 'place' | 'business' | 'brand';
  originalEntry: ListEntry;
}

type Props = {
  entries: MapEntry[];
  userLocation?: { latitude: number; longitude: number } | null;
  onEntryPress?: (entry: MapEntry) => void;
  mapId?: string;
};

// Native fallback - shows a list view since react-native-maps may not be available
// For full map support, react-native-maps would need to be configured
export default function EndorsementMapView({ entries, userLocation, onEntryPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MapPin size={24} color="#00aaff" strokeWidth={2} />
        <Text style={styles.headerText}>
          {entries.length} {entries.length === 1 ? 'Location' : 'Locations'}
        </Text>
      </View>
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {entries.map((entry, index) => {
          const rank = index + 1;
          const isRanked = rank <= 50;
          return (
          <TouchableOpacity
            key={`${entry.type}-${entry.id}`}
            style={styles.entryCard}
            onPress={() => onEntryPress?.(entry)}
            activeOpacity={0.7}
          >
            <View style={[styles.entryNumber, isRanked && styles.entryNumberRanked]}>
              <Text style={styles.entryNumberText}>{rank}</Text>
            </View>
            <View style={styles.entryInfo}>
              <Text style={styles.entryName} numberOfLines={1}>{entry.name}</Text>
              {entry.category && (
                <Text style={styles.entryCategory} numberOfLines={1}>
                  {entry.category.replace(/_/g, ' ')}
                </Text>
              )}
              {entry.address && (
                <View style={styles.addressRow}>
                  <MapPin size={12} color="#6b7280" strokeWidth={2} />
                  <Text style={styles.entryAddress} numberOfLines={2}>{entry.address}</Text>
                </View>
              )}
            </View>
            <ExternalLink size={16} color="#00aaff" strokeWidth={2} />
          </TouchableOpacity>
        );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  listContainer: {
    flex: 1,
    padding: 12,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00aaff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryNumberRanked: {
    backgroundColor: '#1e3a5f',
  },
  entryNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  entryCategory: {
    fontSize: 12,
    color: '#00aaff',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  entryAddress: {
    fontSize: 11,
    color: '#6b7280',
    flex: 1,
    lineHeight: 14,
  },
});
