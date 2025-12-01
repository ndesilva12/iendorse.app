// Library types for list management

export type ListEntryType = 'brand' | 'business' | 'value' | 'link' | 'text' | 'place' | 'pending_business';

export type ValueListMode = 'maxPain' | 'maxBenefit';

export interface BaseListEntry {
  id: string;
  type: ListEntryType;
  createdAt: Date;
}

export interface BrandListEntry extends BaseListEntry {
  type: 'brand';
  brandId: string;
  brandName: string;
  brandCategory?: string;
  website?: string;
  logoUrl?: string;
}

export interface BusinessListEntry extends BaseListEntry {
  type: 'business';
  businessId: string;
  businessName: string;
  businessCategory?: string;
  website?: string;
  logoUrl?: string;
}

// External place from Google Places API
export interface PlaceListEntry extends BaseListEntry {
  type: 'place';
  placeId: string;           // Google Place ID
  placeName: string;
  placeCategory?: string;
  placeAddress?: string;
  website?: string;
  logoUrl?: string;          // Cached photo URL
  photoReference?: string;   // For fetching fresh photo
  rating?: number;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface ValueListEntry extends BaseListEntry {
  type: 'value';
  valueId: string;
  valueName: string;
  mode: ValueListMode; // 'maxPain' or 'maxBenefit'
}

export interface LinkListEntry extends BaseListEntry {
  type: 'link';
  url: string;
  title: string;
  description?: string;
}

export interface TextListEntry extends BaseListEntry {
  type: 'text';
  content: string;
}

// Pending business entry - created manually by user, awaiting admin approval
export interface PendingBusinessListEntry extends BaseListEntry {
  type: 'pending_business';
  pendingBusinessName: string;
  pendingBusinessCategory: string;
  description?: string;
  website?: string;
  location?: string;
  logoUrl?: string;
}

export type ListEntry = BrandListEntry | BusinessListEntry | PlaceListEntry | ValueListEntry | LinkListEntry | TextListEntry | PendingBusinessListEntry;

export interface UserList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  creatorName?: string;
  creatorImage?: string;
  entries: ListEntry[];
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  isEndorsed: boolean;
  order?: number; // For custom ordering of lists
  originalListId?: string; // For copied lists - tracks the original
  originalCreatorName?: string; // For attribution
  originalCreatorImage?: string; // For displaying original creator's image
}
