import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Product, UserProfile } from '@/types';
import { searchPlaces, PlaceSearchResult } from '@/services/firebase/placesService';
import { getAllUsers } from '@/services/firebase/userService';
import { getAllUserBusinesses, BusinessUser } from '@/services/firebase/businessService';
import { searchProducts } from '@/mocks/products';
import { useData } from '@/contexts/DataContext';

interface SearchResult extends Product {
  resultType?: 'user' | 'business' | 'brand';
  profileImage?: string;
  location?: string;
  bio?: string;
}

interface GlobalSearchContextType {
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  placesResults: PlaceSearchResult[];
  loadingSearch: boolean;
  loadingPlaces: boolean;
  handleSearch: (query: string) => void;
  clearSearch: () => void;
  toggleSearch: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextType | undefined>(undefined);

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const { brands } = useData();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [placesResults, setPlacesResults] = useState<PlaceSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; profile: UserProfile }[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<BusinessUser[]>([]);

  const searchDebounce = useRef<NodeJS.Timeout | null>(null);
  const placesSearchDebounce = useRef<NodeJS.Timeout | null>(null);
  const dataLoaded = useRef(false);

  // Load users and businesses data for search
  const loadSearchData = useCallback(async () => {
    if (dataLoaded.current) return;

    try {
      const [users, businesses] = await Promise.all([
        getAllUsers(),
        getAllUserBusinesses()
      ]);
      setAllUsers(users);
      setAllBusinesses(businesses);
      dataLoaded.current = true;
    } catch (error) {
      console.error('[GlobalSearch] Error loading search data:', error);
    }
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    // Load search data if not loaded
    if (!dataLoaded.current) {
      loadSearchData();
    }

    // Clear debounce timers
    if (searchDebounce.current) {
      clearTimeout(searchDebounce.current);
    }
    if (placesSearchDebounce.current) {
      clearTimeout(placesSearchDebounce.current);
    }

    if (query.trim().length === 0) {
      setSearchResults([]);
      setPlacesResults([]);
      return;
    }

    setLoadingSearch(true);

    // Immediate search for local data
    searchDebounce.current = setTimeout(() => {
      const lowerQuery = query.toLowerCase().trim();

      // Search users (prioritized)
      const userResults: SearchResult[] = allUsers
        .filter(({ profile }) => {
          const name = profile?.userDetails?.name?.toLowerCase() || '';
          const location = profile?.userDetails?.location?.toLowerCase() || '';
          const bio = profile?.userDetails?.description?.toLowerCase() || '';
          return name.includes(lowerQuery) ||
                 location.includes(lowerQuery) ||
                 bio.includes(lowerQuery);
        })
        .map(({ id, profile }) => ({
          id,
          name: profile?.userDetails?.name || 'Unknown User',
          resultType: 'user' as const,
          profileImage: profile?.userDetails?.profileImage,
          location: profile?.userDetails?.location,
          bio: profile?.userDetails?.description,
          exampleImageUrl: profile?.userDetails?.profileImage,
          category: profile?.userDetails?.location || 'User',
        }));

      // Search businesses
      const businessResults: SearchResult[] = allBusinesses
        .filter(business => {
          const name = business.businessInfo?.name?.toLowerCase() || '';
          const category = business.businessInfo?.category?.toLowerCase() || '';
          return name.includes(lowerQuery) || category.includes(lowerQuery);
        })
        .map(business => ({
          id: business.id,
          name: business.businessInfo?.name || 'Unknown Business',
          resultType: 'business' as const,
          exampleImageUrl: business.businessInfo?.logoUrl,
          category: business.businessInfo?.category || 'Business',
          website: business.businessInfo?.website,
        }));

      // Search brands
      const brandResults: SearchResult[] = (brands || [])
        .filter(brand => {
          const name = brand.name?.toLowerCase() || '';
          const category = brand.category?.toLowerCase() || '';
          return name.includes(lowerQuery) || category.includes(lowerQuery);
        })
        .slice(0, 20)
        .map(brand => ({
          ...brand,
          resultType: 'brand' as const,
        }));

      // Product search (from mock data)
      const productResults = searchProducts(query);

      // Combine results: Users first, then businesses, then brands/products
      const combinedResults = [
        ...userResults,
        ...businessResults,
        ...brandResults,
        ...productResults.filter(p => !brandResults.find(b => b.id === p.id)),
      ];

      setSearchResults(combinedResults);
      setLoadingSearch(false);
    }, 200);

    // Debounced Google Places search (500ms)
    setLoadingPlaces(true);
    placesSearchDebounce.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(query);
        setPlacesResults(places);
      } catch (error) {
        console.error('[GlobalSearch] Error searching places:', error);
        setPlacesResults([]);
      } finally {
        setLoadingPlaces(false);
      }
    }, 500);
  }, [allUsers, allBusinesses, brands, loadSearchData]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setPlacesResults([]);
    setIsSearchActive(false);
  }, []);

  const toggleSearch = useCallback(() => {
    if (isSearchActive) {
      clearSearch();
    } else {
      setIsSearchActive(true);
      // Preload search data when opening search
      if (!dataLoaded.current) {
        loadSearchData();
      }
    }
  }, [isSearchActive, clearSearch, loadSearchData]);

  const value = {
    isSearchActive,
    setIsSearchActive,
    searchQuery,
    setSearchQuery,
    searchResults,
    placesResults,
    loadingSearch,
    loadingPlaces,
    handleSearch,
    clearSearch,
    toggleSearch,
  };

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext);
  if (context === undefined) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider');
  }
  return context;
}
