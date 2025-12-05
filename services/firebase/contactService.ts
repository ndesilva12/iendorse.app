/**
 * Contact Service
 * Handles user contact form submissions for admin review
 */

import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/firebase';

export interface ContactSubmission {
  id?: string;
  name?: string; // Optional - only required for unauthenticated users
  email?: string; // Optional - only required for unauthenticated users
  userId?: string; // Optional - only present for authenticated users
  message: string;
  status: 'unread' | 'read' | 'replied';
  createdAt: Date;
  readAt?: Date;
  repliedAt?: Date;
  adminNotes?: string;
}

const COLLECTION_NAME = 'contactSubmissions';

/**
 * Submit a contact form message
 */
export async function submitContactMessage(
  message: string,
  userData?: {
    userId?: string;
    name?: string;
    email?: string;
  }
): Promise<string> {
  try {
    const submissionData: Record<string, any> = {
      message: message.trim(),
      status: 'unread',
      createdAt: Timestamp.now(),
    };

    // Add user data if provided
    if (userData?.userId) submissionData.userId = userData.userId;
    if (userData?.name) submissionData.name = userData.name;
    if (userData?.email) submissionData.email = userData.email;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), submissionData);
    console.log('[ContactService] Submitted contact message:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[ContactService] Error submitting contact message:', error);
    throw error;
  }
}

/**
 * Get all contact submissions (for admin panel)
 */
export async function getAllContactSubmissions(): Promise<ContactSubmission[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    const submissions: ContactSubmission[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      submissions.push({
        id: docSnap.id,
        name: data.name,
        email: data.email,
        userId: data.userId,
        message: data.message,
        status: data.status || 'unread',
        createdAt: data.createdAt?.toDate() || new Date(),
        readAt: data.readAt?.toDate(),
        repliedAt: data.repliedAt?.toDate(),
        adminNotes: data.adminNotes,
      });
    });

    return submissions;
  } catch (error) {
    console.error('[ContactService] Error fetching submissions:', error);
    throw error;
  }
}

/**
 * Mark a submission as read
 */
export async function markSubmissionRead(submissionId: string): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, submissionId), {
      status: 'read',
      readAt: Timestamp.now(),
    });
    console.log('[ContactService] Marked submission as read:', submissionId);
  } catch (error) {
    console.error('[ContactService] Error marking submission as read:', error);
    throw error;
  }
}

/**
 * Mark a submission as replied
 */
export async function markSubmissionReplied(submissionId: string, notes?: string): Promise<void> {
  try {
    const updateData: Record<string, any> = {
      status: 'replied',
      repliedAt: Timestamp.now(),
    };
    if (notes) updateData.adminNotes = notes;

    await updateDoc(doc(db, COLLECTION_NAME, submissionId), updateData);
    console.log('[ContactService] Marked submission as replied:', submissionId);
  } catch (error) {
    console.error('[ContactService] Error marking submission as replied:', error);
    throw error;
  }
}

/**
 * Delete a contact submission
 */
export async function deleteContactSubmission(submissionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, submissionId));
    console.log('[ContactService] Deleted submission:', submissionId);
  } catch (error) {
    console.error('[ContactService] Error deleting submission:', error);
    throw error;
  }
}

/**
 * Get unread submission count (for admin notification)
 */
export async function getUnreadSubmissionCount(): Promise<number> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'unread')
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('[ContactService] Error getting unread count:', error);
    return 0;
  }
}
