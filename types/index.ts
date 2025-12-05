export type CauseCategory = string; // Dynamic - comes from Firebase

export type AlignmentType = 'support' | 'avoid';

export interface Cause {
  id: string;
  name: string;
  category: string; // Changed to string to support any category from Firebase
  type: AlignmentType;
  description?: string;
  weight?: number; // Weight for alignment scoring (default: 1.0)
}

export interface Shareholder {
  name: string;
  percentage: number;
  alignment: 'aligned' | 'opposed' | 'neutral';
  causes: string[];
}

export interface MoneyFlow {
  company: string;
  shareholders: Shareholder[];
  overallAlignment: number;
}

export interface Affiliate {
  name: string;
  relationship: string;
}

export interface Partnership {
  name: string;
  relationship: string;
}

export interface Ownership {
  name: string;
  relationship: string;
}

export interface ValueAlignment {
  valueId: string;
  position: number;
  isSupport: boolean;
}

export interface Brand {
  id: string;
  name: string; // Brand name (e.g., "Apple", "Nike")
  category: string;
  exampleImageUrl?: string; // Optional image of example product
  description?: string; // Brand description
  alignmentScore?: number; // DEPRECATED: No longer used, all brands default to 50
  moneyFlow: MoneyFlow;
  keyReasons: string[];
  relatedValues: string[];
  valueAlignments: ValueAlignment[];
  alternatives?: Brand[];
  website?: string; // Used to generate logo URL via logo.dev
  affiliates?: Affiliate[]; // Celebrity/influencer affiliates and their relationships
  partnerships?: Partnership[]; // Business partnerships and collaborations
  ownership?: Ownership[]; // Parent companies, investors, and ownership structure
  ownershipSources?: string; // Citations/sources for ownership data
  location?: string; // Location name (e.g., "New York, NY" / Headquarters Location)
  latitude?: number; // Latitude coordinate for distance calculations
  longitude?: number; // Longitude coordinate for distance calculations
}

// For backwards compatibility during transition
// TODO: Remove this once all code is migrated
export type Product = Brand;

export type AccountType = 'individual' | 'business';

// Team Member Types (Phase 0)
export type TeamRole = 'owner' | 'team';
export type TeamMemberStatus = 'pending' | 'active' | 'suspended';

export interface BusinessTeamMember {
  id: string; // Clerk user ID
  businessId: string; // Business they belong to
  email: string;
  name: string;
  role: TeamRole; // 'owner' or 'team' in Phase 0
  inviteCode: string; // Unique code for join link
  status: TeamMemberStatus;
  invitedBy: string; // User ID who created the invite
  joinedAt?: string; // ISO timestamp
  createdAt: string; // When invite was created
}

export interface BusinessMembership {
  businessId: string;
  role: TeamRole;
  businessName: string;
}

export interface SocialMedia {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  yelp?: string;
  youtube?: string;
}

export interface BusinessLocation {
  address: string; // Full address (e.g., "123 Main St, New York, NY 10001")
  latitude: number; // Latitude coordinate
  longitude: number; // Longitude coordinate
  isPrimary?: boolean; // Mark primary/headquarters location
}

export interface GalleryImage {
  imageUrl: string;
  caption: string;
}

export interface BusinessInfo {
  name: string;
  category: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string; // Cover/background image (defaults to logoUrl if not set)
  galleryImages?: GalleryImage[]; // Up to 3 additional images with captions

  // Multiple locations support (NEW - preferred)
  locations?: BusinessLocation[]; // Array of business locations

  // Single location fields (DEPRECATED - kept for backwards compatibility)
  location?: string; // Location name (e.g., "New York, NY")
  latitude?: number; // Latitude coordinate for distance calculations
  longitude?: number; // Longitude coordinate for distance calculations

  acceptsStandDiscounts: boolean; // Renamed from acceptsValueCodes
  acceptsQRCode?: boolean; // Whether business accepts QR code scans
  acceptsValueCode?: boolean; // Whether business accepts manual value code entry
  valueCodeDiscount?: number; // Percentage discount (e.g., 10 for 10%)
  customerDiscountPercent?: number; // Customer discount portion
  donationPercent?: number; // Donation portion
  totalDonated?: number; // Track total donations facilitated
  customDiscount?: string; // Custom discount text (requires admin approval)
  requireFollow?: boolean; // Require customer to follow business to receive discount
  requireEndorse?: boolean; // Require customer to endorse business to receive discount
  socialMedia?: SocialMedia;
  affiliates?: Affiliate[]; // Celebrity/influencer affiliates and their relationships
  partnerships?: Partnership[]; // Business partnerships and collaborations
  ownership?: Ownership[]; // Parent companies, investors, and ownership structure
  ownershipSources?: string; // Citations/sources for ownership data
}

export interface UserDetails {
  name?: string;
  description?: string;
  website?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  socialMedia?: SocialMedia;
  profileImage?: string; // Profile photo URL
  coverImage?: string; // Cover/banner image URL
}

export interface ValueCodeCustomer {
  id: string;
  name: string;
  totalSpent: number;
  totalDiscounted: number;
  values: string[]; // Value IDs
  lastPurchaseDate: string;
}

export interface UserProfile {
  id?: string; // User ID from Clerk
  accountType?: AccountType; // Default: 'individual'
  causes?: Cause[]; // DEPRECATED - no longer used, kept for backwards compatibility
  searchHistory: string[];
  promoCode?: string;
  totalSavings?: number; // Total discount amount saved through transactions
  businessInfo?: BusinessInfo; // Only for business accounts (owner)
  valueCodeCustomers?: ValueCodeCustomer[]; // Only for business accounts
  userDetails?: UserDetails; // Only for individual accounts
  consentGivenAt?: string; // ISO timestamp when user gave consent
  consentVersion?: string; // Version of consent agreement accepted
  codeSharing?: boolean; // Whether user allows code sharing with merchants (default: true if consented)
  businessMembership?: BusinessMembership; // For team members linked to a business
  isPublicProfile?: boolean; // Whether user's profile and library are publicly viewable (default: true)
  alignedListPublic?: boolean; // Whether the Aligned system list is publicly viewable (default: true)
  unalignedListPublic?: boolean; // Whether the Unaligned system list is publicly viewable (default: true)
  hasSeenIntro?: boolean; // Whether user has seen the welcome carousel (default: false)
  // Verification badges
  isVerified?: boolean; // True for organic/existing verified accounts (shows blue filled badge)
  isCelebrityAccount?: boolean; // True for celebrity accounts created via batch import (shows grey outlined badge)
}
