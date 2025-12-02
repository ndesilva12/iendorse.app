/**
 * Admin Panel - Incomplete Brands Management
 *
 * Tool for managing auto-created brands that need completion
 * Shows brands created from value alignments that lack full details
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { X, CheckCircle, Edit2, Trash2, AlertCircle, ExternalLink, Upload, Link, Image as ImageIcon } from 'lucide-react-native';
import { pickAndUploadImage } from '@/lib/imageUpload';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Affiliate {
  name: string;
  relationship: string;
}

interface Partnership {
  name: string;
  relationship: string;
}

interface Ownership {
  name: string;
  relationship: string;
}

interface BrandData {
  id: string;
  name: string;
  category: string;
  description?: string;
  website?: string;
  location?: string;
  exampleImageUrl?: string; // Logo/profile image
  coverImageUrl?: string; // Cover/banner image
  // Social media links
  twitterUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  status?: 'auto-created' | 'in-progress' | 'verified';
  createdFrom?: string[]; // Which values reference this brand
  createdBy?: string; // Source of creation (e.g., 'celebrity-import', 'admin-edit')
  affiliates?: Affiliate[];
  partnerships?: Partnership[];
  ownership?: Ownership[];
  ownershipSources?: string;
}

interface ValueReference {
  valueId: string;
  valueName: string;
  type: 'aligned' | 'unaligned';
}

export default function IncompleteBrandsManagement() {
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [allValues, setAllValues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'auto-created' | 'in-progress' | 'verified'>('auto-created');
  const [filterSource, setFilterSource] = useState<'all' | 'prominent-import'>('all');
  const [valueReferences, setValueReferences] = useState<Record<string, ValueReference[]>>({});

  // Replace brand state
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replacingBrand, setReplacingBrand] = useState<BrandData | null>(null);
  const [replaceSearchQuery, setReplaceSearchQuery] = useState('');
  const [replaceSearchResults, setReplaceSearchResults] = useState<BrandData[]>([]);
  const [selectedReplacementBrand, setSelectedReplacementBrand] = useState<BrandData | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Form state - Basic info
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState<'auto-created' | 'in-progress' | 'verified'>('in-progress');

  // Form state - Images
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Form state - Social media links
  const [formTwitter, setFormTwitter] = useState('');
  const [formFacebook, setFormFacebook] = useState('');
  const [formInstagram, setFormInstagram] = useState('');
  const [formLinkedin, setFormLinkedin] = useState('');
  const [formTiktok, setFormTiktok] = useState('');
  const [formYoutube, setFormYoutube] = useState('');

  // Form state - Money flow
  const [formAffiliates, setFormAffiliates] = useState('');
  const [formPartnerships, setFormPartnerships] = useState('');
  const [formOwnership, setFormOwnership] = useState('');
  const [formOwnershipSources, setFormOwnershipSources] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load all brands
      const brandsRef = collection(db, 'brands');
      const brandsSnapshot = await getDocs(brandsRef);

      // Load all values to find references
      const valuesRef = collection(db, 'values');
      const valuesSnapshot = await getDocs(valuesRef);

      const loadedValues = valuesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.id,
        aligned: doc.data().aligned || [],
        unaligned: doc.data().unaligned || [],
      }));
      setAllValues(loadedValues);

      // Build brand references map (which values reference each brand)
      const references: Record<string, ValueReference[]> = {};

      loadedValues.forEach(value => {
        // Check aligned brands
        (value.aligned || []).forEach((brandName: string) => {
          const normalizedName = brandName.toLowerCase();
          if (!references[normalizedName]) {
            references[normalizedName] = [];
          }
          references[normalizedName].push({
            valueId: value.id,
            valueName: value.name,
            type: 'aligned',
          });
        });

        // Check unaligned brands
        (value.unaligned || []).forEach((brandName: string) => {
          const normalizedName = brandName.toLowerCase();
          if (!references[normalizedName]) {
            references[normalizedName] = [];
          }
          references[normalizedName].push({
            valueId: value.id,
            valueName: value.name,
            type: 'unaligned',
          });
        });
      });
      setValueReferences(references);

      // Load brands and mark incomplete ones
      const loadedBrands: BrandData[] = brandsSnapshot.docs.map((doc) => {
        const data = doc.data();

        // Check if brand is incomplete
        const hasNoMoneyFlow =
          (!data.affiliates || data.affiliates.length === 0) &&
          (!data.partnerships || data.partnerships.length === 0) &&
          (!data.ownership || data.ownership.length === 0);

        const hasMinimalData =
          (!data.website || data.website.trim() === '') &&
          (!data.location || data.location.trim() === '') &&
          (data.description === 'Auto-created from value alignment. Please update with full details.' ||
           !data.description || data.description.trim() === '');

        const isIncomplete = hasNoMoneyFlow && hasMinimalData;

        // Determine status
        let status = data.status || 'verified';
        if (isIncomplete && !data.status) {
          status = 'auto-created';
        }

        return {
          id: doc.id,
          name: data.name || doc.id,
          category: data.category || 'Uncategorized',
          description: data.description || '',
          website: data.website || '',
          location: data.location || '',
          exampleImageUrl: data.exampleImageUrl || '',
          coverImageUrl: data.coverImageUrl || '',
          twitterUrl: data.twitterUrl || '',
          facebookUrl: data.facebookUrl || '',
          instagramUrl: data.instagramUrl || '',
          linkedinUrl: data.linkedinUrl || '',
          tiktokUrl: data.tiktokUrl || '',
          youtubeUrl: data.youtubeUrl || '',
          status: status as any,
          createdBy: data.createdBy || '',
          affiliates: data.affiliates || [],
          partnerships: data.partnerships || [],
          ownership: data.ownership || [],
          ownershipSources: data.ownershipSources || '',
        };
      });

      setBrands(loadedBrands);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load brands from Firebase');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (brand: BrandData) => {
    setEditingBrand(brand);
    // Basic info
    setFormName(brand.name);
    setFormCategory(brand.category || '');
    setFormDescription(brand.description || '');
    setFormWebsite(brand.website || '');
    setFormLocation(brand.location || '');
    setFormStatus(brand.status || 'in-progress');

    // Images
    setFormLogoUrl(brand.exampleImageUrl || '');
    setFormCoverUrl(brand.coverImageUrl || '');

    // Social media links
    setFormTwitter(brand.twitterUrl || '');
    setFormFacebook(brand.facebookUrl || '');
    setFormInstagram(brand.instagramUrl || '');
    setFormLinkedin(brand.linkedinUrl || '');
    setFormTiktok(brand.tiktokUrl || '');
    setFormYoutube(brand.youtubeUrl || '');

    // Money flow - format as text
    setFormAffiliates(
      brand.affiliates?.map((a) => `${a.name}|${a.relationship}`).join('\n') || ''
    );
    setFormPartnerships(
      brand.partnerships?.map((p) => `${p.name}|${p.relationship}`).join('\n') || ''
    );
    setFormOwnership(
      brand.ownership?.map((o) => `${o.name}|${o.relationship}`).join('\n') || ''
    );
    setFormOwnershipSources(brand.ownershipSources || '');

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBrand(null);
  };

  // Helper to parse money flow text into structured data
  const parseMoneyFlowSection = (text: string): { name: string; relationship: string }[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => {
        const [name, relationship] = line.split('|').map((s) => s.trim());
        return { name: name || '', relationship: relationship || '' };
      })
      .filter((item) => item.name);
  };

  const handleSave = async () => {
    if (!editingBrand || !formName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      const brandRef = doc(db, 'brands', editingBrand.id);

      await updateDoc(brandRef, {
        // Basic info
        name: formName.trim(),
        category: formCategory.trim() || 'Uncategorized',
        description: formDescription.trim(),
        website: formWebsite.trim(),
        location: formLocation.trim(),
        status: formStatus,
        // Images
        exampleImageUrl: formLogoUrl.trim(),
        coverImageUrl: formCoverUrl.trim(),
        // Social media links
        twitterUrl: formTwitter.trim(),
        facebookUrl: formFacebook.trim(),
        instagramUrl: formInstagram.trim(),
        linkedinUrl: formLinkedin.trim(),
        tiktokUrl: formTiktok.trim(),
        youtubeUrl: formYoutube.trim(),
        // Money flow
        affiliates: parseMoneyFlowSection(formAffiliates),
        partnerships: parseMoneyFlowSection(formPartnerships),
        ownership: parseMoneyFlowSection(formOwnership),
        ownershipSources: formOwnershipSources.trim(),
      });

      // Clear the DataContext cache so changes are visible immediately
      await AsyncStorage.removeItem('@brands_cache');
      await AsyncStorage.removeItem('@data_cache_timestamp');
      console.log('[IncompleteBrandsAdmin] Cleared brands cache after save');

      Alert.alert('Success', `Brand "${formName}" updated successfully!`);
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving brand:', error);
      Alert.alert('Error', 'Failed to save brand');
    }
  };

  const handleMarkAsVerified = async (brand: BrandData) => {
    try {
      const brandRef = doc(db, 'brands', brand.id);
      await updateDoc(brandRef, { status: 'verified' });
      Alert.alert('Success', `${brand.name} marked as verified!`);
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleDelete = async (brand: BrandData) => {
    const refs = valueReferences[brand.name.toLowerCase()] || [];

    if (refs.length > 0) {
      Alert.alert(
        'Cannot Delete',
        `This brand is referenced by ${refs.length} value(s):\n\n${refs.map(r => `• ${r.valueName} (${r.type})`).join('\n')}\n\nPlease remove it from those values first.`
      );
      return;
    }

    Alert.alert(
      'Delete Brand',
      `Are you sure you want to delete "${brand.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const brandRef = doc(db, 'brands', brand.id);
              await deleteDoc(brandRef);
              Alert.alert('Success', 'Brand deleted');
              loadData();
            } catch (error) {
              console.error('Error deleting brand:', error);
              Alert.alert('Error', 'Failed to delete brand');
            }
          },
        },
      ]
    );
  };

  // Open replace modal
  const openReplaceModal = (brand: BrandData) => {
    setReplacingBrand(brand);
    setReplaceSearchQuery('');
    setReplaceSearchResults([]);
    setSelectedReplacementBrand(null);
    setShowReplaceModal(true);
  };

  // Search for replacement brands
  const searchForReplacement = (query: string) => {
    setReplaceSearchQuery(query);
    if (!query.trim()) {
      setReplaceSearchResults([]);
      return;
    }

    // Filter brands that could be replacements (excluding the brand being replaced)
    const results = brands.filter(b =>
      b.id !== replacingBrand?.id &&
      (b.name.toLowerCase().includes(query.toLowerCase()) ||
       b.id.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 10); // Limit to 10 results

    setReplaceSearchResults(results);
  };

  // Handle replacing brand in all endorsement lists
  const handleReplaceBrand = async () => {
    if (!replacingBrand || !selectedReplacementBrand) return;

    setIsReplacing(true);
    try {
      // Find all userLists that contain the stub brand
      const listsRef = collection(db, 'userLists');
      const listsSnapshot = await getDocs(listsRef);

      let updatedCount = 0;

      for (const listDoc of listsSnapshot.docs) {
        const listData = listDoc.data();
        const entries = listData.entries || [];

        // Check if any entry references the stub brand
        const hasStubBrand = entries.some((entry: any) =>
          entry.brandId === replacingBrand.id
        );

        if (hasStubBrand) {
          // Update entries to use the replacement brand
          const updatedEntries = entries.map((entry: any) => {
            if (entry.brandId === replacingBrand.id) {
              return {
                ...entry,
                brandId: selectedReplacementBrand.id,
                brandName: selectedReplacementBrand.name,
                brandCategory: selectedReplacementBrand.category,
              };
            }
            return entry;
          });

          // Update the list document
          await updateDoc(doc(db, 'userLists', listDoc.id), {
            entries: updatedEntries,
          });
          updatedCount++;
        }
      }

      // Delete the stub brand
      await deleteDoc(doc(db, 'brands', replacingBrand.id));

      // Clear cache
      await AsyncStorage.removeItem('@brands_cache');
      await AsyncStorage.removeItem('@data_cache_timestamp');

      Alert.alert(
        'Success',
        `Replaced "${replacingBrand.name}" with "${selectedReplacementBrand.name}" in ${updatedCount} list(s) and deleted the stub brand.`
      );

      setShowReplaceModal(false);
      setReplacingBrand(null);
      setSelectedReplacementBrand(null);
      loadData();
    } catch (error) {
      console.error('Error replacing brand:', error);
      Alert.alert('Error', 'Failed to replace brand');
    } finally {
      setIsReplacing(false);
    }
  };

  // Count brands from prominent user import
  const prominentImportCount = brands.filter(b =>
    b.createdBy === 'celebrity-import' || b.createdBy === 'admin-edit'
  ).length;

  const filteredBrands = brands.filter(brand => {
    // Status filter
    if (filterStatus !== 'all' && brand.status !== filterStatus) {
      return false;
    }

    // Source filter (prominent user import)
    if (filterSource === 'prominent-import') {
      if (brand.createdBy !== 'celebrity-import' && brand.createdBy !== 'admin-edit') {
        return false;
      }
    }

    // Search filter
    const matchesSearch =
      brand.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'auto-created': return '#dc3545';
      case 'in-progress': return '#ffc107';
      case 'verified': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'auto-created': return AlertCircle;
      case 'in-progress': return Edit2;
      case 'verified': return CheckCircle;
      default: return AlertCircle;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading incomplete brands...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Incomplete Brands</Text>
          <Text style={styles.subtitle}>
            Manage auto-created brands that need completion
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {brands.filter(b => b.status === 'auto-created').length}
            </Text>
            <Text style={styles.statLabel}>Auto-Created</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {brands.filter(b => b.status === 'in-progress').length}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {brands.filter(b => b.status === 'verified').length}
            </Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search brands..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Source Filter */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Source:</Text>
          <TouchableOpacity
            style={[styles.filterButton, filterSource === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterSource('all')}
          >
            <Text style={[styles.filterButtonText, filterSource === 'all' && styles.filterButtonTextActive]}>
              All Sources
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterSource === 'prominent-import' && styles.filterButtonActive, filterSource === 'prominent-import' && { backgroundColor: '#9333ea', borderColor: '#9333ea' }]}
            onPress={() => setFilterSource('prominent-import')}
          >
            <Text style={[styles.filterButtonText, filterSource === 'prominent-import' && styles.filterButtonTextActive]}>
              ⭐ Prominent User Import ({prominentImportCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Status:</Text>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'all' && styles.filterButtonTextActive]}>
              All ({brands.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'auto-created' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('auto-created')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'auto-created' && styles.filterButtonTextActive]}>
              Auto-Created ({brands.filter(b => b.status === 'auto-created').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'in-progress' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('in-progress')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'in-progress' && styles.filterButtonTextActive]}>
              In Progress ({brands.filter(b => b.status === 'in-progress').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'verified' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('verified')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'verified' && styles.filterButtonTextActive]}>
              Verified ({brands.filter(b => b.status === 'verified').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results Count */}
        <Text style={styles.resultsText}>
          Showing {filteredBrands.length} brands
        </Text>

        {/* Brands List */}
        {filteredBrands.map((brand) => {
          const StatusIcon = getStatusIcon(brand.status);
          const refs = valueReferences[brand.name.toLowerCase()] || [];

          return (
            <View key={brand.id} style={styles.brandCard}>
              <View style={styles.brandHeader}>
                <View style={styles.brandInfo}>
                  <Text style={styles.brandName}>{brand.name}</Text>
                  <Text style={styles.brandCategory}>{brand.category}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(brand.status) }]}>
                    <StatusIcon size={12} color="#fff" strokeWidth={2} />
                    <Text style={styles.statusText}>{brand.status || 'unknown'}</Text>
                  </View>
                </View>
              </View>

              {/* Brand Details */}
              <View style={styles.brandDetails}>
                {brand.createdBy && (
                  <>
                    <Text style={styles.detailLabel}>Source:</Text>
                    <Text style={[styles.detailValue, { color: '#9333ea', fontWeight: '600' }]}>
                      {brand.createdBy === 'celebrity-import' ? '⭐ Prominent User Import' :
                       brand.createdBy === 'admin-edit' ? '⭐ Admin Edit' : brand.createdBy}
                    </Text>
                  </>
                )}

                <Text style={styles.detailLabel}>Description:</Text>
                <Text style={styles.detailValue}>
                  {brand.description || <Text style={styles.emptyValue}>Not set</Text>}
                </Text>

                <Text style={styles.detailLabel}>Website:</Text>
                <Text style={styles.detailValue}>
                  {brand.website || <Text style={styles.emptyValue}>Not set</Text>}
                </Text>

                <Text style={styles.detailLabel}>Location:</Text>
                <Text style={styles.detailValue}>
                  {brand.location || <Text style={styles.emptyValue}>Not set</Text>}
                </Text>

                {refs.length > 0 && (
                  <>
                    <Text style={styles.detailLabel}>Referenced by {refs.length} value(s):</Text>
                    {refs.map((ref, idx) => (
                      <Text key={idx} style={styles.referenceText}>
                        • {ref.valueName} ({ref.type})
                      </Text>
                    ))}
                  </>
                )}
              </View>

              {/* Actions */}
              <View style={styles.brandActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openEditModal(brand)}
                >
                  <Edit2 size={16} color="#007bff" strokeWidth={2} />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.replaceButton]}
                  onPress={() => openReplaceModal(brand)}
                >
                  <ExternalLink size={16} color="#9333ea" strokeWidth={2} />
                  <Text style={[styles.actionButtonText, { color: '#9333ea' }]}>Replace</Text>
                </TouchableOpacity>

                {brand.status !== 'verified' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.verifyButton]}
                    onPress={() => handleMarkAsVerified(brand)}
                  >
                    <CheckCircle size={16} color="#28a745" strokeWidth={2} />
                    <Text style={[styles.actionButtonText, { color: '#28a745' }]}>Mark Verified</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(brand)}
                >
                  <Trash2 size={16} color="#dc3545" strokeWidth={2} />
                  <Text style={[styles.actionButtonText, { color: '#dc3545' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {filteredBrands.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No brands found matching your filters
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Brand</Text>
                  <TouchableOpacity onPress={closeModal}>
                    <X size={24} color="#333" strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  {/* ===== BASIC INFO SECTION ===== */}
                  <Text style={styles.sectionTitle}>📋 Basic Information</Text>

                  <Text style={styles.label}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="Brand name"
                  />

                  <Text style={styles.label}>Category</Text>
                  <TextInput
                    style={styles.input}
                    value={formCategory}
                    onChangeText={setFormCategory}
                    placeholder="e.g., Food & Beverage, Technology"
                  />

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formDescription}
                    onChangeText={setFormDescription}
                    placeholder="Brief description"
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.label}>Website</Text>
                  <TextInput
                    style={styles.input}
                    value={formWebsite}
                    onChangeText={setFormWebsite}
                    placeholder="https://example.com"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={formLocation}
                    onChangeText={setFormLocation}
                    placeholder="City, State, Country"
                  />

                  <Text style={styles.label}>Status</Text>
                  <View style={styles.statusButtons}>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        formStatus === 'auto-created' && styles.statusButtonActive
                      ]}
                      onPress={() => setFormStatus('auto-created')}
                    >
                      <Text style={[styles.statusButtonText, formStatus === 'auto-created' && styles.statusButtonTextActive]}>Auto-Created</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        formStatus === 'in-progress' && styles.statusButtonActive
                      ]}
                      onPress={() => setFormStatus('in-progress')}
                    >
                      <Text style={[styles.statusButtonText, formStatus === 'in-progress' && styles.statusButtonTextActive]}>In Progress</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        formStatus === 'verified' && styles.statusButtonActive
                      ]}
                      onPress={() => setFormStatus('verified')}
                    >
                      <Text style={[styles.statusButtonText, formStatus === 'verified' && styles.statusButtonTextActive]}>Verified</Text>
                    </TouchableOpacity>
                  </View>

                  {/* ===== IMAGES SECTION ===== */}
                  <Text style={styles.sectionTitle}>🖼️ Images</Text>

                  <Text style={styles.label}>Logo / Profile Image</Text>
                  <View style={styles.imageInputRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={formLogoUrl}
                      onChangeText={setFormLogoUrl}
                      placeholder="https://example.com/logo.png"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.uploadButton, logoUploading && styles.uploadButtonDisabled]}
                      onPress={async () => {
                        if (!editingBrand) return;
                        setLogoUploading(true);
                        try {
                          const url = await pickAndUploadImage(editingBrand.id, 'business', [1, 1]);
                          if (url) setFormLogoUrl(url);
                        } catch (error) {
                          Alert.alert('Error', 'Failed to upload image');
                        }
                        setLogoUploading(false);
                      }}
                      disabled={logoUploading}
                    >
                      {logoUploading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Upload size={16} color="#fff" strokeWidth={2} />
                          <Text style={styles.uploadButtonText}>Upload</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  {formLogoUrl ? (
                    <View style={styles.imagePreview}>
                      <Image source={{ uri: formLogoUrl }} style={styles.previewImageSmall} />
                    </View>
                  ) : null}

                  <Text style={styles.label}>Cover / Banner Image</Text>
                  <View style={styles.imageInputRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={formCoverUrl}
                      onChangeText={setFormCoverUrl}
                      placeholder="https://example.com/cover.png"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.uploadButton, coverUploading && styles.uploadButtonDisabled]}
                      onPress={async () => {
                        if (!editingBrand) return;
                        setCoverUploading(true);
                        try {
                          const url = await pickAndUploadImage(editingBrand.id, 'cover', [16, 9]);
                          if (url) setFormCoverUrl(url);
                        } catch (error) {
                          Alert.alert('Error', 'Failed to upload image');
                        }
                        setCoverUploading(false);
                      }}
                      disabled={coverUploading}
                    >
                      {coverUploading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Upload size={16} color="#fff" strokeWidth={2} />
                          <Text style={styles.uploadButtonText}>Upload</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  {formCoverUrl ? (
                    <View style={styles.imagePreview}>
                      <Image source={{ uri: formCoverUrl }} style={styles.previewImageWide} />
                    </View>
                  ) : null}

                  {/* ===== SOCIAL MEDIA LINKS SECTION ===== */}
                  <Text style={styles.sectionTitle}>🔗 Social Media Links</Text>

                  <Text style={styles.label}>Twitter / X</Text>
                  <TextInput
                    style={styles.input}
                    value={formTwitter}
                    onChangeText={setFormTwitter}
                    placeholder="https://twitter.com/brandname"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>Facebook</Text>
                  <TextInput
                    style={styles.input}
                    value={formFacebook}
                    onChangeText={setFormFacebook}
                    placeholder="https://facebook.com/brandname"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>Instagram</Text>
                  <TextInput
                    style={styles.input}
                    value={formInstagram}
                    onChangeText={setFormInstagram}
                    placeholder="https://instagram.com/brandname"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>LinkedIn</Text>
                  <TextInput
                    style={styles.input}
                    value={formLinkedin}
                    onChangeText={setFormLinkedin}
                    placeholder="https://linkedin.com/company/brandname"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>TikTok</Text>
                  <TextInput
                    style={styles.input}
                    value={formTiktok}
                    onChangeText={setFormTiktok}
                    placeholder="https://tiktok.com/@brandname"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>YouTube</Text>
                  <TextInput
                    style={styles.input}
                    value={formYoutube}
                    onChangeText={setFormYoutube}
                    placeholder="https://youtube.com/@brandname"
                    autoCapitalize="none"
                  />

                  {/* ===== MONEY FLOW SECTION ===== */}
                  <Text style={styles.sectionTitle}>💰 Money Flow</Text>
                  <Text style={styles.helpText}>
                    Enter one item per line in format: Name|Relationship
                  </Text>

                  <Text style={styles.label}>Affiliates</Text>
                  <TextInput
                    style={[styles.input, styles.textAreaLarge]}
                    value={formAffiliates}
                    onChangeText={setFormAffiliates}
                    placeholder="Taylor Swift|Multi-million endorsement&#10;LeBron James|$5M endorsement"
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={styles.label}>Partnerships</Text>
                  <TextInput
                    style={[styles.input, styles.textAreaLarge]}
                    value={formPartnerships}
                    onChangeText={setFormPartnerships}
                    placeholder="TSMC|Silicon Supply Chain/2010&#10;Foxconn|Manufacturing/2005"
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={styles.label}>Ownership</Text>
                  <TextInput
                    style={[styles.input, styles.textAreaLarge]}
                    value={formOwnership}
                    onChangeText={setFormOwnership}
                    placeholder="Vanguard Group|~9.5%&#10;BlackRock|~7.2%"
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={styles.label}>Ownership Sources (citations)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formOwnershipSources}
                    onChangeText={setFormOwnershipSources}
                    placeholder="HQ: Official site; Stakes: Q3 2025 13F filings via SEC/Yahoo Finance"
                    multiline
                    numberOfLines={3}
                  />

                  {/* Add some bottom padding */}
                  <View style={{ height: 24 }} />
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Replace Brand Modal */}
      <Modal
        visible={showReplaceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReplaceModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowReplaceModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Replace Brand</Text>
                  <TouchableOpacity onPress={() => setShowReplaceModal(false)}>
                    <X size={24} color="#333" strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  {/* Current brand info */}
                  <View style={styles.replaceSection}>
                    <Text style={styles.replaceSectionTitle}>Replacing:</Text>
                    <View style={styles.replaceBrandCard}>
                      <Text style={styles.replaceBrandName}>{replacingBrand?.name}</Text>
                      <Text style={styles.replaceBrandId}>ID: {replacingBrand?.id}</Text>
                      {replacingBrand?.createdBy && (
                        <Text style={styles.replaceBrandSource}>
                          Source: {replacingBrand.createdBy === 'celebrity-import' ? '⭐ Prominent User Import' : replacingBrand.createdBy}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Search for replacement */}
                  <View style={styles.replaceSection}>
                    <Text style={styles.replaceSectionTitle}>Search for replacement brand:</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Type brand name to search..."
                      value={replaceSearchQuery}
                      onChangeText={searchForReplacement}
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Search results */}
                  {replaceSearchResults.length > 0 && (
                    <View style={styles.replaceSection}>
                      <Text style={styles.replaceSectionTitle}>Select replacement:</Text>
                      <ScrollView style={{ maxHeight: 200 }}>
                        {replaceSearchResults.map((brand) => (
                          <TouchableOpacity
                            key={brand.id}
                            style={[
                              styles.replaceResultItem,
                              selectedReplacementBrand?.id === brand.id && styles.replaceResultItemSelected
                            ]}
                            onPress={() => setSelectedReplacementBrand(brand)}
                          >
                            <View>
                              <Text style={styles.replaceResultName}>{brand.name}</Text>
                              <Text style={styles.replaceResultId}>ID: {brand.id}</Text>
                              {brand.website && (
                                <Text style={styles.replaceResultDetail}>{brand.website}</Text>
                              )}
                            </View>
                            {selectedReplacementBrand?.id === brand.id && (
                              <CheckCircle size={20} color="#28a745" strokeWidth={2} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Selected replacement confirmation */}
                  {selectedReplacementBrand && (
                    <View style={[styles.replaceSection, styles.replaceConfirmation]}>
                      <Text style={styles.replaceSectionTitle}>✓ Will replace with:</Text>
                      <View style={[styles.replaceBrandCard, { borderColor: '#28a745' }]}>
                        <Text style={[styles.replaceBrandName, { color: '#28a745' }]}>
                          {selectedReplacementBrand.name}
                        </Text>
                        <Text style={styles.replaceBrandId}>ID: {selectedReplacementBrand.id}</Text>
                      </View>
                      <Text style={styles.replaceWarning}>
                        This will update all endorsement lists using "{replacingBrand?.name}" to use "{selectedReplacementBrand.name}" instead, then delete the stub brand.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowReplaceModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      { backgroundColor: '#9333ea' },
                      (!selectedReplacementBrand || isReplacing) && { opacity: 0.5 }
                    ]}
                    onPress={handleReplaceBrand}
                    disabled={!selectedReplacementBrand || isReplacing}
                  >
                    {isReplacing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Replace & Delete Stub</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  searchInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  brandCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  brandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  brandCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  brandDetails: {
    marginBottom: 12,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  emptyValue: {
    fontStyle: 'italic',
    color: '#999',
  },
  referenceText: {
    fontSize: 12,
    color: '#007bff',
  },
  brandActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  verifyButton: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  deleteButton: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  actionButtonText: {
    fontSize: 13,
    color: '#007bff',
    fontWeight: '500',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 12,
    color: '#333',
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  statusButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#333',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  imageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#28a745',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreview: {
    marginTop: 8,
    alignItems: 'center',
  },
  previewImageSmall: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  previewImageWide: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    resizeMode: 'cover',
  },
  textAreaLarge: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007bff',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Replace button styles
  replaceButton: {
    backgroundColor: '#f3e8ff',
    borderColor: '#d8b4fe',
  },
  // Replace modal styles
  replaceSection: {
    marginBottom: 16,
  },
  replaceSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  replaceBrandCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  replaceBrandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  replaceBrandId: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  replaceBrandSource: {
    fontSize: 12,
    color: '#9333ea',
    marginTop: 4,
  },
  replaceResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 8,
  },
  replaceResultItemSelected: {
    borderColor: '#28a745',
    backgroundColor: '#d4edda',
  },
  replaceResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  replaceResultId: {
    fontSize: 11,
    color: '#666',
  },
  replaceResultDetail: {
    fontSize: 11,
    color: '#007bff',
    marginTop: 2,
  },
  replaceConfirmation: {
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  replaceWarning: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
