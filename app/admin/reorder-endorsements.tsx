/**
 * Admin Panel - Reorder User Endorsements
 *
 * Allows admins to:
 * - Search and select a user
 * - View their endorsement list
 * - Reorder endorsements via drag-and-drop (desktop) or up/down buttons (mobile)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, X, ChevronUp, ChevronDown, GripVertical, Save, Store, Award, ExternalLink, User } from 'lucide-react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { getEndorsementList, reorderListEntries } from '@/services/firebase/listService';
import { UserList, ListEntry } from '@/types/library';

// Admin email whitelist
const ADMIN_EMAILS = [
  'normancdesilva@gmail.com',
];

interface UserBasic {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
}

export default function ReorderEndorsementsAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserBasic[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserBasic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserBasic | null>(null);
  const [endorsementList, setEndorsementList] = useState<UserList | null>(null);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Editable rank state
  const [editingRankIndex, setEditingRankIndex] = useState<number | null>(null);
  const [editingRankValue, setEditingRankValue] = useState<string>('');

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      setIsAdmin(ADMIN_EMAILS.includes(email));
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    // Filter users based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers([]);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserBasic[] = [];
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          name: data.userDetails?.name || data.name || 'Unknown',
          email: data.email || '',
          profileImage: data.userDetails?.profileImage,
        });
      });
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEndorsementList = async (userId: string) => {
    setIsLoading(true);
    try {
      const list = await getEndorsementList(userId);
      if (list) {
        setEndorsementList(list);
        setEntries([...list.entries]);
        setHasChanges(false);
      } else {
        Alert.alert('No Endorsements', 'This user does not have an endorsement list');
        setEndorsementList(null);
        setEntries([]);
      }
    } catch (error) {
      console.error('Error loading endorsement list:', error);
      Alert.alert('Error', 'Failed to load endorsement list');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (selectedUser: UserBasic) => {
    setSelectedUser(selectedUser);
    setSearchQuery('');
    setFilteredUsers([]);
    loadEndorsementList(selectedUser.id);
  };

  const moveEntry = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= entries.length) return;

    const newEntries = [...entries];
    const [movedEntry] = newEntries.splice(fromIndex, 1);
    newEntries.splice(toIndex, 0, movedEntry);
    setEntries(newEntries);
    setHasChanges(true);
  };

  // Start editing a rank
  const startEditingRank = (index: number) => {
    setEditingRankIndex(index);
    setEditingRankValue(String(index + 1));
  };

  // Handle rank input change
  const handleRankChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setEditingRankValue(numericValue);
  };

  // Finish editing and move to new position
  const finishEditingRank = () => {
    if (editingRankIndex === null) return;

    const newRank = parseInt(editingRankValue, 10);

    // Validate the new rank
    if (!isNaN(newRank) && newRank >= 1 && newRank <= entries.length) {
      const newIndex = newRank - 1; // Convert to 0-based index
      if (newIndex !== editingRankIndex) {
        moveEntry(editingRankIndex, newIndex);
      }
    }

    setEditingRankIndex(null);
    setEditingRankValue('');
  };

  // Cancel editing
  const cancelEditingRank = () => {
    setEditingRankIndex(null);
    setEditingRankValue('');
  };

  const handleSave = async () => {
    if (!endorsementList) return;

    setIsSaving(true);
    try {
      await reorderListEntries(endorsementList.id, entries);
      setHasChanges(false);
      Alert.alert('Success', 'Endorsement order updated successfully');
    } catch (error) {
      console.error('Error saving order:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const getEntryName = (entry: ListEntry): string => {
    // Check specific type fields first
    if ('brandName' in entry && entry.brandName) return entry.brandName;
    if ('businessName' in entry && entry.businessName) return entry.businessName;
    if ('valueName' in entry && entry.valueName) return entry.valueName;
    if ('title' in entry) return entry.title;
    // Fallback to generic 'name' field (used in some entry creation flows)
    if ('name' in entry && (entry as any).name) return (entry as any).name;
    return 'Unknown';
  };

  const getEntryIcon = (entry: ListEntry) => {
    if (entry.type === 'brand') return <Store size={20} color="#007bff" />;
    if (entry.type === 'business') return <Store size={20} color="#28a745" />;
    if (entry.type === 'value') return <Award size={20} color="#6f42c1" />;
    if (entry.type === 'link') return <ExternalLink size={20} color="#17a2b8" />;
    return <Store size={20} color="#666" />;
  };

  const getEntryImage = (entry: ListEntry): string | undefined => {
    if ('logoUrl' in entry) return entry.logoUrl;
    if ('businessLogo' in entry) return entry.businessLogo;
    return undefined;
  };

  // Drag and drop handlers for web
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      moveEntry(sourceIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  if (isLoading && !selectedUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading users...</Text>
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
            You don't have permission to access this page.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Reorder Endorsements</Text>
        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Save size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* User Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search user by name or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Search Results Dropdown */}
        {filteredUsers.length > 0 && (
          <View style={styles.searchResults}>
            {filteredUsers.slice(0, 10).map(u => (
              <TouchableOpacity
                key={u.id}
                style={styles.searchResultItem}
                onPress={() => handleSelectUser(u)}
              >
                {u.profileImage ? (
                  <Image source={{ uri: u.profileImage }} style={styles.userAvatar} />
                ) : (
                  <View style={styles.userAvatarPlaceholder}>
                    <User size={16} color="#666" />
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Selected User Info */}
      {selectedUser && (
        <View style={styles.selectedUserCard}>
          {selectedUser.profileImage ? (
            <Image source={{ uri: selectedUser.profileImage }} style={styles.selectedUserAvatar} />
          ) : (
            <View style={styles.selectedUserAvatarPlaceholder}>
              <User size={24} color="#666" />
            </View>
          )}
          <View style={styles.selectedUserInfo}>
            <Text style={styles.selectedUserName}>{selectedUser.name}</Text>
            <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
          </View>
          <TouchableOpacity
            style={styles.clearUserButton}
            onPress={() => {
              setSelectedUser(null);
              setEndorsementList(null);
              setEntries([]);
              setHasChanges(false);
            }}
          >
            <X size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Loading indicator */}
      {isLoading && selectedUser && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      )}

      {/* Endorsement List */}
      {endorsementList && !isLoading && (
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {entries.length} Endorsement{entries.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.listHint}>
              {Platform.OS === 'web' ? 'Tap rank to edit, drag, or use arrows' : 'Tap rank to edit, or use arrows'}
            </Text>
          </View>

          <ScrollView style={styles.entriesList}>
            {entries.map((entry, index) => {
              const cardContent = (
                <>
                  {/* Drag Handle (Web only) */}
                  {Platform.OS === 'web' && (
                    <View style={styles.dragHandle}>
                      <GripVertical size={20} color="#999" />
                    </View>
                  )}

                  {/* Position Number - Editable */}
                  {editingRankIndex === index ? (
                    <TextInput
                      style={styles.positionInput}
                      value={editingRankValue}
                      onChangeText={handleRankChange}
                      onBlur={finishEditingRank}
                      onSubmitEditing={finishEditingRank}
                      keyboardType="number-pad"
                      autoFocus
                      selectTextOnFocus
                      maxLength={3}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.positionBadge}
                      onPress={() => startEditingRank(index)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.positionText}>{index + 1}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Entry Image */}
                  {getEntryImage(entry) ? (
                    <Image source={{ uri: getEntryImage(entry) }} style={styles.entryImage} />
                  ) : (
                    <View style={styles.entryImagePlaceholder}>
                      {getEntryIcon(entry)}
                    </View>
                  )}

                  {/* Entry Info */}
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryName}>{getEntryName(entry)}</Text>
                    <Text style={styles.entryType}>
                      {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                    </Text>
                  </View>

                  {/* Reorder Buttons - show on all platforms */}
                  <View style={styles.mobileControls}>
                    <TouchableOpacity
                      style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                      onPress={() => moveEntry(index, index - 1)}
                      disabled={index === 0}
                    >
                      <ChevronUp size={20} color={index === 0 ? '#ccc' : '#007bff'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moveButton, index === entries.length - 1 && styles.moveButtonDisabled]}
                      onPress={() => moveEntry(index, index + 1)}
                      disabled={index === entries.length - 1}
                    >
                      <ChevronDown size={20} color={index === entries.length - 1 ? '#ccc' : '#007bff'} />
                    </TouchableOpacity>
                  </View>
                </>
              );

              // On web, wrap with a div that has proper drag events
              if (Platform.OS === 'web') {
                return (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: draggedIndex === index ? '#f0f0f0' : '#fff',
                      opacity: draggedIndex === index ? 0.5 : 1,
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: dropTargetIndex === index && draggedIndex !== null ? '#007bff' : '#e0e0e0',
                      gap: 10,
                      cursor: 'grab',
                      userSelect: 'none',
                    }}
                  >
                    {cardContent}
                  </div>
                );
              }

              // On mobile, use View
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.entryCard,
                    draggedIndex === index && styles.entryCardDragging,
                    dropTargetIndex === index && draggedIndex !== null && styles.entryCardDropTarget,
                  ]}
                >
                  {cardContent}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Empty State */}
      {!selectedUser && !isLoading && (
        <View style={styles.emptyState}>
          <Search size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>Search for a user to reorder their endorsements</Text>
        </View>
      )}

      {selectedUser && !endorsementList && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>This user has no endorsement list</Text>
        </View>
      )}
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchSection: {
    position: 'relative',
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  searchResults: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  selectedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  selectedUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  selectedUserAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedUserInfo: {
    flex: 1,
  },
  selectedUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedUserEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  clearUserButton: {
    padding: 8,
  },
  loadingOverlay: {
    padding: 40,
    alignItems: 'center',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  listHint: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  entriesList: {
    flex: 1,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 10,
    ...(Platform.OS === 'web' && {
      cursor: 'grab',
      userSelect: 'none',
    }),
  },
  entryCardDragging: {
    opacity: 0.5,
    backgroundColor: '#f0f0f0',
  },
  entryCardDropTarget: {
    borderColor: '#007bff',
    borderWidth: 2,
    backgroundColor: '#e3f2fd',
  },
  dragHandle: {
    padding: 4,
    cursor: 'grab',
  },
  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  positionInput: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1976d2',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#1976d2',
    padding: 0,
  },
  entryImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  entryImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  entryType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  mobileControls: {
    flexDirection: 'column',
    gap: 4,
  },
  moveButton: {
    padding: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  moveButtonDisabled: {
    opacity: 0.4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
