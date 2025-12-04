import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { BusinessUser } from '@/services/firebase/businessService';
import { TrendingUp, TrendingDown, MapPin as MapPinIcon } from 'lucide-react-native';

type Props = {
  businesses: Array<{
    business: BusinessUser;
    alignmentScore: number;
    distance?: number;
    closestLocation?: string;
  }>;
  userLocation: { latitude: number; longitude: number } | null;
  distanceRadius: number; // in miles
  onBusinessPress?: (businessId: string) => void;
  isBusinessAccount?: boolean; // Hide score badges for business accounts
};

type SelectedBusiness = {
  business: BusinessUser;
  alignmentScore: number;
  distance?: number;
  closestLocation?: string;
} | null;

// Muted map style with improved readability for navigation
const mutedMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#f5f5f5" }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#424242" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#ffffff" }, { "weight": 2 }]
  },
  // City and town names - darker and more prominent
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#2c2c2c" }]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#ffffff" }, { "weight": 3 }]
  },
  {
    "featureType": "administrative.neighborhood",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#4a4a4a" }]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#bdbdbd" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#eeeeee" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#e5e5e5" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }]
  },
  // Roads - better contrast
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#d0d0d0" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#fefefe" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#c5c5c5" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#4a4a4a" }]
  },
  // Highways - more distinct with light tan
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#f5e6d3" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#d4c5b0" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#3d3d3d" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#ffffff" }, { "weight": 3 }]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8a8a8a" }]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [{ "color": "#e5e5e5" }]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [{ "color": "#eeeeee" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#c9c9c9" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8a8a8a" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#ffffff" }, { "weight": 2 }]
  }
];

export default function BusinessMapView({ businesses, userLocation, distanceRadius, onBusinessPress, isBusinessAccount }: Props) {
  const [selectedBusiness, setSelectedBusiness] = useState<SelectedBusiness>(null);

  // Calculate the appropriate zoom/delta based on distance radius
  const getLatLongDelta = (radiusMiles: number) => {
    // Rough approximation: 1 degree latitude ≈ 69 miles
    // Smaller delta = more zoomed in
    const delta = (radiusMiles / 69) * 1.5;
    return { latitudeDelta: delta, longitudeDelta: delta };
  };

  const { latitudeDelta, longitudeDelta } = getLatLongDelta(distanceRadius);

  const centerLat = userLocation?.latitude || 37.7749;
  const centerLng = userLocation?.longitude || -122.4194;

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta,
          longitudeDelta,
        }}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mutedMapStyle}
      >
        {/* User location marker (location pin) */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MapPinIcon size={32} color="#3B82F6" fill="#3B82F6" strokeWidth={1.5} />
            </View>
          </Marker>
        )}

        {/* Distance radius circle */}
        {userLocation && (
          <Circle
            center={userLocation}
            radius={distanceRadius * 1609.34} // Convert miles to meters
            strokeColor="rgba(59, 130, 246, 0.5)"
            fillColor="rgba(59, 130, 246, 0.1)"
            strokeWidth={2}
          />
        )}

        {/* Business markers */}
        {businesses.map((businessData) => {
          const { business, alignmentScore, distance, closestLocation } = businessData;
          const location = business.businessInfo.locations?.[0] ||
                         (business.businessInfo.latitude && business.businessInfo.longitude
                           ? { latitude: business.businessInfo.latitude, longitude: business.businessInfo.longitude }
                           : null);

          if (!location || !location.latitude || !location.longitude) return null;

          const color = alignmentScore >= 50 ? '#22C55E' : '#EF4444';

          return (
            <Marker
              key={business.id}
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => setSelectedBusiness(businessData)}
            >
              <View style={{
                width: 28,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <MapPinIcon size={28} color={color} fill={color} strokeWidth={1.5} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Selection Container */}
      {selectedBusiness && (() => {
        const acceptsStand = selectedBusiness.business.businessInfo.acceptsStandDiscounts;
        const discountPercent = selectedBusiness.business.businessInfo.customerDiscountPercent || 0;
        const donationPercent = selectedBusiness.business.businessInfo.donationPercent || 0;
        const acceptanceMethod = 'QR Code';

        return (
          <View style={styles.selectionContainer}>
            <View style={styles.selectionCard}>
              <View style={styles.selectionHeader}>
                <View style={styles.selectionHeaderLeft}>
                  <Text style={styles.businessName}>{selectedBusiness.business.businessInfo.name}</Text>
                  <Text style={styles.businessCategory}>{selectedBusiness.business.businessInfo.category}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedBusiness(null)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.selectionBody}>
                {/* Alignment Score Badge - Hidden for business accounts */}
                {!isBusinessAccount && (
                <View style={[
                  styles.scoreBadge,
                  { backgroundColor: (selectedBusiness.alignmentScore ?? 50) >= 50 ? '#22C55E15' : '#EF444415' }
                ]}>
                  {(selectedBusiness.alignmentScore ?? 50) >= 50 ? (
                    <TrendingUp size={16} color="#22C55E" strokeWidth={2.5} />
                  ) : (
                    <TrendingDown size={16} color="#EF4444" strokeWidth={2.5} />
                  )}
                  <Text style={[
                    styles.scoreText,
                    { color: (selectedBusiness.alignmentScore ?? 50) >= 50 ? '#22C55E' : '#EF4444' }
                  ]}>
                    Score: {selectedBusiness.alignmentScore ?? 50}
                  </Text>
                </View>
                )}

                {/* Address */}
                <View style={styles.addressContainer}>
                  <MapPinIcon size={14} color="#6B7280" strokeWidth={2} />
                  <Text style={styles.addressText}>
                    {selectedBusiness.closestLocation ||
                     selectedBusiness.business.businessInfo.locations?.[0]?.address ||
                     selectedBusiness.business.businessInfo.location ||
                     'Address not available'}
                  </Text>
                </View>

                {/* Distance */}
                {selectedBusiness.distance !== undefined && (
                  <Text style={styles.distanceText}>
                    {selectedBusiness.distance < 1
                      ? `${(selectedBusiness.distance * 5280).toFixed(0)} ft away`
                      : `${selectedBusiness.distance.toFixed(1)} mi away`}
                  </Text>
                )}

                {/* iEndorse Contributions */}
                {acceptsStand && (
                  <View style={styles.standContributionsBox}>
                    <Text style={styles.standContributionsTitle}>iEndorse Contributions Accepted</Text>
                    <Text style={styles.standContributionsAccepts}>Accepts: {acceptanceMethod}</Text>
                    <View style={styles.standContributionsPercents}>
                      <Text style={styles.standContributionsPercentText}>
                        Discount: <Text style={styles.standContributionsPercentBold}>{discountPercent.toFixed(1)}%</Text>
                      </Text>
                      <Text style={styles.standContributionsPercentText}>
                        Donation: <Text style={styles.standContributionsPercentBold}>{donationPercent.toFixed(1)}%</Text>
                      </Text>
                    </View>
                  </View>
                )}

                {/* View Details Button */}
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => {
                    setSelectedBusiness(null);
                    if (onBusinessPress) {
                      onBusinessPress(selectedBusiness.business.id);
                    }
                  }}
                >
                  <Text style={styles.viewDetailsButtonText}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  selectionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
  },
  selectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectionHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#6B7280',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  selectionBody: {
    padding: 16,
    gap: 12,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  distanceText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  standContributionsBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 12,
  },
  standContributionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00aaff',
    marginBottom: 6,
  },
  standContributionsAccepts: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 4,
  },
  standContributionsPercents: {
    flexDirection: 'row',
    gap: 12,
  },
  standContributionsPercentText: {
    fontSize: 12,
    color: '#4B5563',
  },
  standContributionsPercentBold: {
    fontWeight: '700',
    fontSize: 16,
  },
  viewDetailsButton: {
    backgroundColor: '#00aaff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  viewDetailsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
