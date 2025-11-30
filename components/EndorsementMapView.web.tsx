import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { ListEntry } from '@/types/library';

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

// Create marker icon HTML
function createMarkerIconHtml(index: number): string {
  const color = '#00aaff';
  return `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="${color}"/>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" stroke="white" stroke-width="2"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
    <text x="12" y="15" text-anchor="middle" fill="${color}" font-size="8" font-weight="bold">${index + 1}</text>
  </svg>`;
}

// Create popup content HTML
function createPopupContentHtml(entry: MapEntry): string {
  const logoHtml = entry.logoUrl
    ? `<img src="${entry.logoUrl}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; margin-bottom: 8px;" onerror="this.style.display='none'" />`
    : '';

  return `
    <div style="min-width: 200px; padding: 12px;">
      ${logoHtml}
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px; color: #1f2937;">
        ${entry.name}
      </div>
      ${entry.category ? `
        <div style="font-size: 12px; color: #00aaff; margin-bottom: 8px; text-transform: capitalize;">
          ${entry.category.replace(/_/g, ' ')}
        </div>
      ` : ''}
      ${entry.address ? `
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px; line-height: 1.4;">
          📍 ${entry.address}
        </div>
      ` : ''}
      <button
        onclick="window.dispatchEvent(new CustomEvent('navigate-to-entry', { detail: '${entry.id}__${entry.type}' }))"
        style="
          width: 100%;
          background-color: #00aaff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        "
      >
        View Details
      </button>
    </div>
  `;
}

export default function EndorsementMapView({ entries, userLocation, onEntryPress, mapId = 'endorsement-map' }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const isInitializedRef = useRef(false);
  const fitBoundsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entriesRef = useRef(entries);
  const onEntryPressRef = useRef(onEntryPress);

  // Keep refs updated
  entriesRef.current = entries;
  onEntryPressRef.current = onEntryPress;

  // Load Leaflet CSS once
  useEffect(() => {
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      link.setAttribute('data-leaflet-css', 'true');
      document.head.appendChild(link);
    }
  }, []);

  // Initialize map once
  useEffect(() => {
    let mounted = true;

    const initializeMap = () => {
      const L = (window as any).L;
      if (!L || !mounted || isInitializedRef.current) return;

      const container = document.getElementById(mapId);
      if (!container) return;

      // Start with a US-wide view
      const defaultCenter: [number, number] = [39.8283, -98.5795];
      const defaultZoom = 4;

      try {
        const map = L.map(mapId, {
          zoomControl: true,
          attributionControl: true,
        }).setView(defaultCenter, defaultZoom);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map);

        mapRef.current = map;
        isInitializedRef.current = true;

        // Add user location marker if available
        if (userLocation) {
          L.marker([userLocation.latitude, userLocation.longitude], {
            icon: L.divIcon({
              className: 'user-marker',
              html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#3B82F6"/>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
              </svg>`,
              iconSize: [24, 32],
              iconAnchor: [12, 32],
            }),
          }).addTo(map).bindPopup('You are here');
        }

        // Add initial markers
        updateMarkers();
      } catch (error) {
        console.error('[Map] Initialization error:', error);
      }
    };

    const updateMarkers = () => {
      const L = (window as any).L;
      if (!L || !mapRef.current) return;

      const currentEntries = entriesRef.current;
      const currentEntryIds = new Set(currentEntries.map(e => `${e.id}__${e.type}`));

      // Remove old markers
      markersRef.current.forEach((marker, markerId) => {
        if (!currentEntryIds.has(markerId)) {
          try { marker.remove(); } catch (e) { /* ignore */ }
          markersRef.current.delete(markerId);
        }
      });

      // Add new markers
      currentEntries.forEach((entry, index) => {
        const markerId = `${entry.id}__${entry.type}`;

        if (!markersRef.current.has(markerId)) {
          try {
            const marker = L.marker([entry.location.lat, entry.location.lng], {
              icon: L.divIcon({
                className: 'endorsement-marker',
                html: createMarkerIconHtml(index),
                iconSize: [24, 32],
                iconAnchor: [12, 32],
              }),
            })
              .addTo(mapRef.current)
              .bindPopup(createPopupContentHtml(entry), {
                maxWidth: 280,
                className: 'endorsement-popup'
              });

            markersRef.current.set(markerId, marker);
          } catch (error) {
            console.warn('[Map] Error adding marker:', error);
          }
        }
      });

      // Debounced fit bounds
      if (fitBoundsTimeoutRef.current) {
        clearTimeout(fitBoundsTimeoutRef.current);
      }

      fitBoundsTimeoutRef.current = setTimeout(() => {
        if (!mapRef.current || currentEntries.length === 0) return;

        const allPoints: [number, number][] = currentEntries.map(e => [e.location.lat, e.location.lng]);
        if (userLocation) {
          allPoints.push([userLocation.latitude, userLocation.longitude]);
        }

        if (allPoints.length > 0) {
          try {
            if (allPoints.length === 1) {
              mapRef.current.setView(allPoints[0], 12, { animate: false });
            } else {
              mapRef.current.fitBounds(allPoints, { padding: [50, 50], animate: false });
            }
          } catch (error) {
            console.warn('[Map] fitBounds error:', error);
          }
        }
      }, 500);
    };

    // Store updateMarkers for use in entries effect
    (window as any)[`__updateMarkers_${mapId}`] = updateMarkers;

    // Load Leaflet if not available
    const L = (window as any).L;
    if (!L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = initializeMap;
      document.body.appendChild(script);
    } else {
      initializeMap();
    }

    // Cleanup
    return () => {
      mounted = false;
      if (fitBoundsTimeoutRef.current) {
        clearTimeout(fitBoundsTimeoutRef.current);
      }
      delete (window as any)[`__updateMarkers_${mapId}`];
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (error) { /* ignore */ }
        mapRef.current = null;
        isInitializedRef.current = false;
        markersRef.current.clear();
      }
    };
  }, [mapId, userLocation]);

  // Update markers when entries change
  useEffect(() => {
    const updateMarkers = (window as any)[`__updateMarkers_${mapId}`];
    if (updateMarkers && isInitializedRef.current) {
      updateMarkers();
    }
  }, [entries, mapId]);

  // Handle navigation events
  useEffect(() => {
    const handleNavigate = (event: any) => {
      const callback = onEntryPressRef.current;
      if (callback) {
        const [id, type] = event.detail.split('__');
        const entry = entriesRef.current.find(e => e.id === id && e.type === type);
        if (entry) {
          callback(entry);
        }
      }
    };

    window.addEventListener('navigate-to-entry', handleNavigate);
    return () => {
      window.removeEventListener('navigate-to-entry', handleNavigate);
    };
  }, []);

  return (
    <View style={styles.container}>
      <div id={mapId} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
