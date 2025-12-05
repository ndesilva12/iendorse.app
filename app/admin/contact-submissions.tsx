/**
 * Admin Panel - Contact Submissions Management
 * View and manage user contact form messages
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAllContactSubmissions,
  markSubmissionRead,
  markSubmissionReplied,
  deleteContactSubmission,
  ContactSubmission,
} from '@/services/firebase/contactService';

export default function ContactSubmissionsManagement() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'replied'>('all');

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setIsLoading(true);
      const data = await getAllContactSubmissions();
      setSubmissions(data);
    } catch (error) {
      console.error('Error loading contact submissions:', error);
      Alert.alert('Error', 'Failed to load contact submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkRead = async (submissionId: string) => {
    try {
      await markSubmissionRead(submissionId);
      loadSubmissions();
    } catch (error) {
      console.error('Error marking submission as read:', error);
      Alert.alert('Error', 'Failed to update submission');
    }
  };

  const handleMarkReplied = async (submissionId: string) => {
    try {
      await markSubmissionReplied(submissionId);
      Alert.alert('Success', 'Marked as replied');
      loadSubmissions();
    } catch (error) {
      console.error('Error marking submission as replied:', error);
      Alert.alert('Error', 'Failed to update submission');
    }
  };

  const handleEmailReply = (submission: ContactSubmission) => {
    const email = submission.email;
    if (!email) {
      Alert.alert('No Email', 'This submission does not have an email address');
      return;
    }

    const subject = encodeURIComponent('Re: Your iEndorse Contact Submission');
    const body = encodeURIComponent(`Hi ${submission.name || 'there'},\n\nThank you for contacting us.\n\n---\nOriginal message:\n${submission.message}\n---\n\n`);

    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  const handleDelete = (submission: ContactSubmission) => {
    const confirmDelete = async () => {
      try {
        await deleteContactSubmission(submission.id!);
        Alert.alert('Success', 'Submission deleted');
        loadSubmissions();
      } catch (error) {
        console.error('Error deleting submission:', error);
        Alert.alert('Error', 'Failed to delete submission');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this submission?')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Submission',
        'Are you sure you want to delete this submission?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const filteredSubmissions = filter === 'all'
    ? submissions
    : submissions.filter(s => s.status === filter);

  const getStatusColor = (status: ContactSubmission['status']) => {
    switch (status) {
      case 'unread': return '#dc3545';
      case 'read': return '#ffc107';
      case 'replied': return '#28a745';
      default: return '#6c757d';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading submissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const unreadCount = submissions.filter(s => s.status === 'unread').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contact Submissions</Text>
        <Text style={styles.subtitle}>
          {submissions.length} total ({unreadCount} unread)
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'unread', 'read', 'replied'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Submissions List */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.listContainer}>
          {filteredSubmissions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No {filter === 'all' ? '' : filter} submissions</Text>
            </View>
          ) : (
            filteredSubmissions.map((submission) => (
              <View key={submission.id} style={styles.card}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.senderInfo}>
                    {submission.name && (
                      <Text style={styles.senderName}>{submission.name}</Text>
                    )}
                    {submission.email && (
                      <Text style={styles.senderEmail}>{submission.email}</Text>
                    )}
                    {submission.userId && !submission.name && (
                      <Text style={styles.senderUserId}>User: {submission.userId.substring(0, 12)}...</Text>
                    )}
                    {!submission.name && !submission.email && !submission.userId && (
                      <Text style={styles.senderAnonymous}>Anonymous</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(submission.status) }]}>
                    <Text style={styles.statusText}>{submission.status}</Text>
                  </View>
                </View>

                {/* Date */}
                <Text style={styles.date}>{formatDate(submission.createdAt)}</Text>

                {/* Message */}
                <View style={styles.messageContainer}>
                  <Text style={styles.messageText}>{submission.message}</Text>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  {submission.status === 'unread' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionRead]}
                      onPress={() => handleMarkRead(submission.id!)}
                    >
                      <Text style={styles.actionButtonText}>Mark Read</Text>
                    </TouchableOpacity>
                  )}

                  {submission.email && submission.status !== 'replied' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionReply]}
                      onPress={() => handleEmailReply(submission)}
                    >
                      <Text style={styles.actionButtonText}>Reply via Email</Text>
                    </TouchableOpacity>
                  )}

                  {submission.status !== 'replied' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionMarkReplied]}
                      onPress={() => handleMarkReplied(submission.id!)}
                    >
                      <Text style={styles.actionButtonText}>Mark Replied</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionDelete]}
                    onPress={() => handleDelete(submission)}
                  >
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
  },
  filterTabActive: {
    backgroundColor: '#007bff',
  },
  filterTabText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  senderEmail: {
    fontSize: 14,
    color: '#007bff',
    marginTop: 2,
  },
  senderUserId: {
    fontSize: 14,
    color: '#6c757d',
  },
  senderAnonymous: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  date: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 12,
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 15,
    color: '#212529',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionRead: {
    borderColor: '#ffc107',
    backgroundColor: '#fff3cd',
  },
  actionReply: {
    borderColor: '#007bff',
    backgroundColor: '#cce5ff',
  },
  actionMarkReplied: {
    borderColor: '#28a745',
    backgroundColor: '#d4edda',
  },
  actionDelete: {
    borderColor: '#dc3545',
    backgroundColor: '#dc3545',
  },
});
