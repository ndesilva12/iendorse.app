/**
 * Endorsement History Service
 *
 * Tracks cumulative endorsement days including:
 * - Total days endorsed (cumulative across all periods)
 * - Total days in top 5 positions
 * - Total days in top 10 positions
 *
 * Also supports backdating and admin edits
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';

const ENDORSEMENT_HISTORY_COLLECTION = 'endorsement_history';

// Types
export interface PositionChange {
  date: Date;
  position: number;
}

export interface EndorsementPeriod {
  id: string;
  startDate: Date;
  endDate: Date | null; // null if currently active
  startPosition: number;
  positionHistory: PositionChange[];
  daysInPeriod: number; // Calculated when period ends
  daysInTop5: number;
  daysInTop10: number;
}

export interface EndorsementHistory {
  id: string;

  // User and entity identification
  userId: string;
  entityType: 'brand' | 'business' | 'place' | 'value';
  entityId: string;
  entityName: string;

  // Cumulative totals (updated when periods end or daily)
  totalDaysEndorsed: number;
  totalDaysInTop5: number;
  totalDaysInTop10: number;

  // All endorsement periods
  periods: EndorsementPeriod[];

  // Current state
  isCurrentlyEndorsed: boolean;
  currentPosition: number | null;
  currentPeriodStartDate: Date | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Helper to convert Firestore timestamps
const convertTimestamp = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp.toDate) return timestamp.toDate();
  if (typeof timestamp === 'string') return new Date(timestamp);
  return new Date();
};

// Generate unique ID for history record
const generateHistoryId = (userId: string, entityType: string, entityId: string): string => {
  return `${userId}_${entityType}_${entityId}`;
};

// Generate unique ID for period
const generatePeriodId = (): string => {
  return `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get or create endorsement history for a user-entity combination
 */
export const getOrCreateEndorsementHistory = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string,
  entityName: string
): Promise<EndorsementHistory> => {
  const historyId = generateHistoryId(userId, entityType, entityId);
  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: historyId,
      userId: data.userId,
      entityType: data.entityType,
      entityId: data.entityId,
      entityName: data.entityName || entityName,
      totalDaysEndorsed: data.totalDaysEndorsed || 0,
      totalDaysInTop5: data.totalDaysInTop5 || 0,
      totalDaysInTop10: data.totalDaysInTop10 || 0,
      periods: (data.periods || []).map((p: any) => ({
        id: p.id,
        startDate: convertTimestamp(p.startDate),
        endDate: p.endDate ? convertTimestamp(p.endDate) : null,
        startPosition: p.startPosition || 1,
        positionHistory: (p.positionHistory || []).map((ph: any) => ({
          date: convertTimestamp(ph.date),
          position: ph.position,
        })),
        daysInPeriod: p.daysInPeriod || 0,
        daysInTop5: p.daysInTop5 || 0,
        daysInTop10: p.daysInTop10 || 0,
      })),
      isCurrentlyEndorsed: data.isCurrentlyEndorsed || false,
      currentPosition: data.currentPosition || null,
      currentPeriodStartDate: data.currentPeriodStartDate ? convertTimestamp(data.currentPeriodStartDate) : null,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  }

  // Create new history record
  const newHistory: EndorsementHistory = {
    id: historyId,
    userId,
    entityType,
    entityId,
    entityName,
    totalDaysEndorsed: 0,
    totalDaysInTop5: 0,
    totalDaysInTop10: 0,
    periods: [],
    isCurrentlyEndorsed: false,
    currentPosition: null,
    currentPeriodStartDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await setDoc(docRef, {
    ...newHistory,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newHistory;
};

/**
 * Calculate days between two dates
 */
const calculateDays = (startDate: Date, endDate: Date): number => {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculate position-based days for a period
 */
const calculatePositionDays = (
  startDate: Date,
  endDate: Date,
  startPosition: number,
  positionHistory: PositionChange[]
): { daysInTop5: number; daysInTop10: number } => {
  let daysInTop5 = 0;
  let daysInTop10 = 0;

  // Sort position history by date
  const sortedHistory = [...positionHistory].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Start with the initial position
  let currentPosition = startPosition;
  let currentDate = startDate;

  for (const change of sortedHistory) {
    // Calculate days in current position before this change
    const daysAtPosition = calculateDays(currentDate, change.date);

    if (currentPosition <= 5) daysInTop5 += daysAtPosition;
    if (currentPosition <= 10) daysInTop10 += daysAtPosition;

    currentPosition = change.position;
    currentDate = change.date;
  }

  // Add days from last position change to end date
  const remainingDays = calculateDays(currentDate, endDate);
  if (currentPosition <= 5) daysInTop5 += remainingDays;
  if (currentPosition <= 10) daysInTop10 += remainingDays;

  return { daysInTop5, daysInTop10 };
};

/**
 * Start a new endorsement period (called when item is added to endorsement list)
 */
export const startEndorsementPeriod = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string,
  entityName: string,
  position: number = 1,
  startDate?: Date // Optional for backdating
): Promise<EndorsementHistory> => {
  const history = await getOrCreateEndorsementHistory(userId, entityType, entityId, entityName);

  // If already endorsed, don't start a new period
  if (history.isCurrentlyEndorsed) {
    console.log('[EndorsementHistory] Already endorsed, updating position only');
    return updateCurrentPosition(userId, entityType, entityId, position);
  }

  const effectiveStartDate = startDate || new Date();

  const newPeriod: EndorsementPeriod = {
    id: generatePeriodId(),
    startDate: effectiveStartDate,
    endDate: null,
    startPosition: position,
    positionHistory: [],
    daysInPeriod: 0,
    daysInTop5: 0,
    daysInTop10: 0,
  };

  const updatedHistory: EndorsementHistory = {
    ...history,
    entityName, // Update name in case it changed
    periods: [...history.periods, newPeriod],
    isCurrentlyEndorsed: true,
    currentPosition: position,
    currentPeriodStartDate: effectiveStartDate,
    updatedAt: new Date(),
  };

  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, history.id);
  await updateDoc(docRef, {
    entityName,
    periods: updatedHistory.periods.map(p => ({
      ...p,
      startDate: p.startDate,
      endDate: p.endDate,
      positionHistory: p.positionHistory,
    })),
    isCurrentlyEndorsed: true,
    currentPosition: position,
    currentPeriodStartDate: effectiveStartDate,
    updatedAt: serverTimestamp(),
  });

  return updatedHistory;
};

/**
 * End the current endorsement period (called when item is removed from endorsement list)
 */
export const endEndorsementPeriod = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string,
  endDate?: Date // Optional for backdating
): Promise<EndorsementHistory | null> => {
  const historyId = generateHistoryId(userId, entityType, entityId);
  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    console.log('[EndorsementHistory] No history found to end');
    return null;
  }

  const history = await getOrCreateEndorsementHistory(userId, entityType, entityId, '');

  if (!history.isCurrentlyEndorsed) {
    console.log('[EndorsementHistory] Not currently endorsed');
    return history;
  }

  const effectiveEndDate = endDate || new Date();

  // Find and close the current period (the one with null endDate)
  const updatedPeriods = history.periods.map(period => {
    if (period.endDate === null) {
      const daysInPeriod = calculateDays(period.startDate, effectiveEndDate);
      const { daysInTop5, daysInTop10 } = calculatePositionDays(
        period.startDate,
        effectiveEndDate,
        period.startPosition,
        period.positionHistory
      );

      return {
        ...period,
        endDate: effectiveEndDate,
        daysInPeriod,
        daysInTop5,
        daysInTop10,
      };
    }
    return period;
  });

  // Recalculate totals from all periods
  const totals = updatedPeriods.reduce(
    (acc, period) => ({
      totalDaysEndorsed: acc.totalDaysEndorsed + period.daysInPeriod,
      totalDaysInTop5: acc.totalDaysInTop5 + period.daysInTop5,
      totalDaysInTop10: acc.totalDaysInTop10 + period.daysInTop10,
    }),
    { totalDaysEndorsed: 0, totalDaysInTop5: 0, totalDaysInTop10: 0 }
  );

  const updatedHistory: EndorsementHistory = {
    ...history,
    periods: updatedPeriods,
    totalDaysEndorsed: totals.totalDaysEndorsed,
    totalDaysInTop5: totals.totalDaysInTop5,
    totalDaysInTop10: totals.totalDaysInTop10,
    isCurrentlyEndorsed: false,
    currentPosition: null,
    currentPeriodStartDate: null,
    updatedAt: new Date(),
  };

  await updateDoc(docRef, {
    periods: updatedPeriods.map(p => ({
      ...p,
      startDate: p.startDate,
      endDate: p.endDate,
      positionHistory: p.positionHistory,
    })),
    totalDaysEndorsed: totals.totalDaysEndorsed,
    totalDaysInTop5: totals.totalDaysInTop5,
    totalDaysInTop10: totals.totalDaysInTop10,
    isCurrentlyEndorsed: false,
    currentPosition: null,
    currentPeriodStartDate: null,
    updatedAt: serverTimestamp(),
  });

  return updatedHistory;
};

/**
 * Update the current position (called when list is reordered)
 */
export const updateCurrentPosition = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string,
  newPosition: number
): Promise<EndorsementHistory> => {
  const history = await getOrCreateEndorsementHistory(userId, entityType, entityId, '');

  if (!history.isCurrentlyEndorsed) {
    console.log('[EndorsementHistory] Not currently endorsed, cannot update position');
    return history;
  }

  // Add position change to current period
  const updatedPeriods = history.periods.map(period => {
    if (period.endDate === null) {
      return {
        ...period,
        positionHistory: [
          ...period.positionHistory,
          { date: new Date(), position: newPosition },
        ],
      };
    }
    return period;
  });

  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, history.id);
  await updateDoc(docRef, {
    periods: updatedPeriods.map(p => ({
      ...p,
      startDate: p.startDate,
      endDate: p.endDate,
      positionHistory: p.positionHistory,
    })),
    currentPosition: newPosition,
    updatedAt: serverTimestamp(),
  });

  return {
    ...history,
    periods: updatedPeriods,
    currentPosition: newPosition,
    updatedAt: new Date(),
  };
};

/**
 * Get cumulative days for a user-entity combination (includes current active period)
 */
export const getCumulativeDays = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string
): Promise<{
  totalDaysEndorsed: number;
  totalDaysInTop5: number;
  totalDaysInTop10: number;
  isCurrentlyEndorsed: boolean;
  currentPosition: number | null;
}> => {
  const historyId = generateHistoryId(userId, entityType, entityId);
  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return {
      totalDaysEndorsed: 0,
      totalDaysInTop5: 0,
      totalDaysInTop10: 0,
      isCurrentlyEndorsed: false,
      currentPosition: null,
    };
  }

  const history = await getOrCreateEndorsementHistory(userId, entityType, entityId, '');

  // Calculate current active period days if endorsed
  let activePeriodDays = { daysInPeriod: 0, daysInTop5: 0, daysInTop10: 0 };

  if (history.isCurrentlyEndorsed) {
    const activePeriod = history.periods.find(p => p.endDate === null);
    if (activePeriod) {
      const now = new Date();
      activePeriodDays.daysInPeriod = calculateDays(activePeriod.startDate, now);
      const positionDays = calculatePositionDays(
        activePeriod.startDate,
        now,
        activePeriod.startPosition,
        activePeriod.positionHistory
      );
      activePeriodDays.daysInTop5 = positionDays.daysInTop5;
      activePeriodDays.daysInTop10 = positionDays.daysInTop10;
    }
  }

  return {
    totalDaysEndorsed: history.totalDaysEndorsed + activePeriodDays.daysInPeriod,
    totalDaysInTop5: history.totalDaysInTop5 + activePeriodDays.daysInTop5,
    totalDaysInTop10: history.totalDaysInTop10 + activePeriodDays.daysInTop10,
    isCurrentlyEndorsed: history.isCurrentlyEndorsed,
    currentPosition: history.currentPosition,
  };
};

/**
 * Get all endorsement history for a user
 */
export const getUserEndorsementHistory = async (
  userId: string
): Promise<EndorsementHistory[]> => {
  const q = query(
    collection(db, ENDORSEMENT_HISTORY_COLLECTION),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      entityType: data.entityType,
      entityId: data.entityId,
      entityName: data.entityName || 'Unknown',
      totalDaysEndorsed: data.totalDaysEndorsed || 0,
      totalDaysInTop5: data.totalDaysInTop5 || 0,
      totalDaysInTop10: data.totalDaysInTop10 || 0,
      periods: (data.periods || []).map((p: any) => ({
        id: p.id,
        startDate: convertTimestamp(p.startDate),
        endDate: p.endDate ? convertTimestamp(p.endDate) : null,
        startPosition: p.startPosition || 1,
        positionHistory: (p.positionHistory || []).map((ph: any) => ({
          date: convertTimestamp(ph.date),
          position: ph.position,
        })),
        daysInPeriod: p.daysInPeriod || 0,
        daysInTop5: p.daysInTop5 || 0,
        daysInTop10: p.daysInTop10 || 0,
      })),
      isCurrentlyEndorsed: data.isCurrentlyEndorsed || false,
      currentPosition: data.currentPosition || null,
      currentPeriodStartDate: data.currentPeriodStartDate ? convertTimestamp(data.currentPeriodStartDate) : null,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  });
};

/**
 * Get all endorsement history (for admin)
 */
export const getAllEndorsementHistory = async (): Promise<EndorsementHistory[]> => {
  const q = query(
    collection(db, ENDORSEMENT_HISTORY_COLLECTION),
    orderBy('updatedAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      entityType: data.entityType,
      entityId: data.entityId,
      entityName: data.entityName || 'Unknown',
      totalDaysEndorsed: data.totalDaysEndorsed || 0,
      totalDaysInTop5: data.totalDaysInTop5 || 0,
      totalDaysInTop10: data.totalDaysInTop10 || 0,
      periods: (data.periods || []).map((p: any) => ({
        id: p.id,
        startDate: convertTimestamp(p.startDate),
        endDate: p.endDate ? convertTimestamp(p.endDate) : null,
        startPosition: p.startPosition || 1,
        positionHistory: (p.positionHistory || []).map((ph: any) => ({
          date: convertTimestamp(ph.date),
          position: ph.position,
        })),
        daysInPeriod: p.daysInPeriod || 0,
        daysInTop5: p.daysInTop5 || 0,
        daysInTop10: p.daysInTop10 || 0,
      })),
      isCurrentlyEndorsed: data.isCurrentlyEndorsed || false,
      currentPosition: data.currentPosition || null,
      currentPeriodStartDate: data.currentPeriodStartDate ? convertTimestamp(data.currentPeriodStartDate) : null,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  });
};

// ==================== ADMIN FUNCTIONS ====================

/**
 * Admin: Update endorsement history (backdate, modify totals, etc.)
 */
export const adminUpdateEndorsementHistory = async (
  historyId: string,
  updates: Partial<{
    totalDaysEndorsed: number;
    totalDaysInTop5: number;
    totalDaysInTop10: number;
    periods: EndorsementPeriod[];
    entityName: string;
  }>
): Promise<void> => {
  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);

  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  if (updates.totalDaysEndorsed !== undefined) {
    updateData.totalDaysEndorsed = updates.totalDaysEndorsed;
  }
  if (updates.totalDaysInTop5 !== undefined) {
    updateData.totalDaysInTop5 = updates.totalDaysInTop5;
  }
  if (updates.totalDaysInTop10 !== undefined) {
    updateData.totalDaysInTop10 = updates.totalDaysInTop10;
  }
  if (updates.entityName !== undefined) {
    updateData.entityName = updates.entityName;
  }
  if (updates.periods !== undefined) {
    updateData.periods = updates.periods.map(p => ({
      ...p,
      startDate: p.startDate,
      endDate: p.endDate,
      positionHistory: p.positionHistory,
    }));
  }

  await updateDoc(docRef, updateData);
};

/**
 * Admin: Add a backdated endorsement period
 */
export const adminAddBackdatedPeriod = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string,
  entityName: string,
  startDate: Date,
  endDate: Date | null,
  startPosition: number = 1
): Promise<EndorsementHistory> => {
  const history = await getOrCreateEndorsementHistory(userId, entityType, entityId, entityName);

  const daysInPeriod = endDate ? calculateDays(startDate, endDate) : 0;
  const positionDays = endDate
    ? calculatePositionDays(startDate, endDate, startPosition, [])
    : { daysInTop5: 0, daysInTop10: 0 };

  const newPeriod: EndorsementPeriod = {
    id: generatePeriodId(),
    startDate,
    endDate,
    startPosition,
    positionHistory: [],
    daysInPeriod,
    daysInTop5: positionDays.daysInTop5,
    daysInTop10: positionDays.daysInTop10,
  };

  const updatedPeriods = [...history.periods, newPeriod].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  // Recalculate totals from closed periods only
  const closedPeriods = updatedPeriods.filter(p => p.endDate !== null);
  const totals = closedPeriods.reduce(
    (acc, period) => ({
      totalDaysEndorsed: acc.totalDaysEndorsed + period.daysInPeriod,
      totalDaysInTop5: acc.totalDaysInTop5 + period.daysInTop5,
      totalDaysInTop10: acc.totalDaysInTop10 + period.daysInTop10,
    }),
    { totalDaysEndorsed: 0, totalDaysInTop5: 0, totalDaysInTop10: 0 }
  );

  const hasActivePeriod = updatedPeriods.some(p => p.endDate === null);
  const activePeriod = updatedPeriods.find(p => p.endDate === null);

  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, history.id);
  await updateDoc(docRef, {
    entityName,
    periods: updatedPeriods.map(p => ({
      ...p,
      startDate: p.startDate,
      endDate: p.endDate,
      positionHistory: p.positionHistory,
    })),
    totalDaysEndorsed: totals.totalDaysEndorsed,
    totalDaysInTop5: totals.totalDaysInTop5,
    totalDaysInTop10: totals.totalDaysInTop10,
    isCurrentlyEndorsed: hasActivePeriod,
    currentPosition: activePeriod?.startPosition || null,
    currentPeriodStartDate: activePeriod?.startDate || null,
    updatedAt: serverTimestamp(),
  });

  return {
    ...history,
    entityName,
    periods: updatedPeriods,
    totalDaysEndorsed: totals.totalDaysEndorsed,
    totalDaysInTop5: totals.totalDaysInTop5,
    totalDaysInTop10: totals.totalDaysInTop10,
    isCurrentlyEndorsed: hasActivePeriod,
    currentPosition: activePeriod?.startPosition || null,
    currentPeriodStartDate: activePeriod?.startDate || null,
    updatedAt: new Date(),
  };
};

/**
 * Admin: Delete an endorsement period
 */
export const adminDeletePeriod = async (
  historyId: string,
  periodId: string
): Promise<void> => {
  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('History not found');
  }

  const data = docSnap.data();
  const updatedPeriods = (data.periods || []).filter((p: any) => p.id !== periodId);

  // Recalculate totals
  const closedPeriods = updatedPeriods.filter((p: any) => p.endDate !== null);
  const totals = closedPeriods.reduce(
    (acc: any, period: any) => ({
      totalDaysEndorsed: acc.totalDaysEndorsed + (period.daysInPeriod || 0),
      totalDaysInTop5: acc.totalDaysInTop5 + (period.daysInTop5 || 0),
      totalDaysInTop10: acc.totalDaysInTop10 + (period.daysInTop10 || 0),
    }),
    { totalDaysEndorsed: 0, totalDaysInTop5: 0, totalDaysInTop10: 0 }
  );

  const hasActivePeriod = updatedPeriods.some((p: any) => p.endDate === null);
  const activePeriod = updatedPeriods.find((p: any) => p.endDate === null);

  await updateDoc(docRef, {
    periods: updatedPeriods,
    totalDaysEndorsed: totals.totalDaysEndorsed,
    totalDaysInTop5: totals.totalDaysInTop5,
    totalDaysInTop10: totals.totalDaysInTop10,
    isCurrentlyEndorsed: hasActivePeriod,
    currentPosition: activePeriod?.startPosition || null,
    currentPeriodStartDate: activePeriod?.startDate ? convertTimestamp(activePeriod.startDate) : null,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Admin: Handle backdating an endorsement entry
 * When an entry date is backdated, the backdated days should NOT count as top 5/10.
 * This updates the endorsement history to use position 100 for all backdated days.
 */
export const handleBackdateEntry = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string,
  entityName: string,
  newStartDate: Date
): Promise<void> => {
  const historyId = generateHistoryId(userId, entityType, entityId);
  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);
  const docSnap = await getDoc(docRef);

  // Position 100 means it won't count as top 5 or top 10
  const BACKDATE_POSITION = 100;

  if (!docSnap.exists()) {
    // No history exists, create one with the backdated start date at position 100
    // The position 100 ensures backdated days don't count as top 5/10
    const newPeriod: EndorsementPeriod = {
      id: generatePeriodId(),
      startDate: newStartDate,
      endDate: null,
      startPosition: BACKDATE_POSITION,
      positionHistory: [
        // Add position change to current position (1) from today
        { date: new Date(), position: 1 },
      ],
      daysInPeriod: 0,
      daysInTop5: 0,
      daysInTop10: 0,
    };

    await setDoc(docRef, {
      id: historyId,
      userId,
      entityType,
      entityId,
      entityName,
      totalDaysEndorsed: 0,
      totalDaysInTop5: 0,
      totalDaysInTop10: 0,
      periods: [newPeriod],
      isCurrentlyEndorsed: true,
      currentPosition: 1,
      currentPeriodStartDate: newStartDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const data = docSnap.data();
  const periods = (data.periods || []).map((p: any) => ({
    id: p.id,
    startDate: convertTimestamp(p.startDate),
    endDate: p.endDate ? convertTimestamp(p.endDate) : null,
    startPosition: p.startPosition || 1,
    positionHistory: (p.positionHistory || []).map((ph: any) => ({
      date: convertTimestamp(ph.date),
      position: ph.position,
    })),
    daysInPeriod: p.daysInPeriod || 0,
    daysInTop5: p.daysInTop5 || 0,
    daysInTop10: p.daysInTop10 || 0,
  }));

  // Find the current active period (endDate === null)
  const activePeriodIndex = periods.findIndex((p: EndorsementPeriod) => p.endDate === null);

  if (activePeriodIndex !== -1) {
    const activePeriod = periods[activePeriodIndex];
    const currentPosition = data.currentPosition || 1;

    // Update the active period:
    // 1. Set startDate to the backdated date
    // 2. Set startPosition to 100 (so backdated days don't count as top 5/10)
    // 3. Add a position change from today at the current position
    activePeriod.startDate = newStartDate;
    activePeriod.startPosition = BACKDATE_POSITION;

    // Clear existing position history and add a single change for today
    // This marks the transition from "backdated" (pos 100) to actual position
    activePeriod.positionHistory = [
      { date: new Date(), position: currentPosition },
    ];

    periods[activePeriodIndex] = activePeriod;
  } else {
    // No active period, create one with backdating
    const newPeriod: EndorsementPeriod = {
      id: generatePeriodId(),
      startDate: newStartDate,
      endDate: null,
      startPosition: BACKDATE_POSITION,
      positionHistory: [
        { date: new Date(), position: 1 },
      ],
      daysInPeriod: 0,
      daysInTop5: 0,
      daysInTop10: 0,
    };
    periods.push(newPeriod);
  }

  await updateDoc(docRef, {
    entityName,
    periods: periods.map((p: EndorsementPeriod) => ({
      ...p,
      startDate: p.startDate,
      endDate: p.endDate,
      positionHistory: p.positionHistory,
    })),
    currentPeriodStartDate: newStartDate,
    isCurrentlyEndorsed: true,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Add bonus days to ALL endorsement items for a user
 * Used for referral rewards - adds days to totalDaysEndorsed
 * Does NOT add to top 5/10 days (bonus days are not position-based)
 */
export const addBonusDaysToAllEndorsements = async (
  userId: string,
  bonusDays: number
): Promise<number> => {
  try {
    const q = query(
      collection(db, ENDORSEMENT_HISTORY_COLLECTION),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('[EndorsementHistory] No endorsement history found for user:', userId);
      return 0;
    }

    let updatedCount = 0;

    // Update each endorsement history record
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const currentTotalDays = data.totalDaysEndorsed || 0;

      await updateDoc(docSnapshot.ref, {
        totalDaysEndorsed: currentTotalDays + bonusDays,
        updatedAt: serverTimestamp(),
      });

      updatedCount++;
    }

    console.log(`[EndorsementHistory] Added ${bonusDays} bonus days to ${updatedCount} endorsement items for user:`, userId);
    return updatedCount;
  } catch (error) {
    console.error('[EndorsementHistory] Error adding bonus days:', error);
    throw error;
  }
};

/**
 * Admin function to directly update endorsement metrics
 * Used for manual adjustments in the admin panel
 */
export const updateEndorsementMetrics = async (
  userId: string,
  entityType: 'brand' | 'business' | 'place' | 'value',
  entityId: string,
  updates: {
    totalDaysEndorsed?: number;
    totalDaysInTop5?: number;
    totalDaysInTop10?: number;
  }
): Promise<void> => {
  const historyId = generateHistoryId(userId, entityType, entityId);
  const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Endorsement history not found for this entity');
  }

  const updateData: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.totalDaysEndorsed !== undefined) {
    updateData.totalDaysEndorsed = updates.totalDaysEndorsed;
  }
  if (updates.totalDaysInTop5 !== undefined) {
    updateData.totalDaysInTop5 = updates.totalDaysInTop5;
  }
  if (updates.totalDaysInTop10 !== undefined) {
    updateData.totalDaysInTop10 = updates.totalDaysInTop10;
  }

  await updateDoc(docRef, updateData);
};

/**
 * Migrate existing endorsement list entries to create endorsement history records
 * This is needed for entries that were added before the tracking system was implemented
 */
export const migrateEndorsementHistory = async (
  userId: string,
  entries: Array<{
    type: 'brand' | 'business' | 'place' | 'value';
    entityId: string;
    entityName: string;
    createdAt: Date;
    position: number;
  }>
): Promise<{ created: number; existing: number }> => {
  let created = 0;
  let existing = 0;

  for (const entry of entries) {
    const historyId = generateHistoryId(userId, entry.type, entry.entityId);
    const docRef = doc(db, ENDORSEMENT_HISTORY_COLLECTION, historyId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      existing++;
      continue;
    }

    // Create new history record with the entry's creation date
    const newPeriod: EndorsementPeriod = {
      id: generatePeriodId(),
      startDate: entry.createdAt,
      endDate: null, // Currently active
      startPosition: entry.position,
      positionHistory: [],
      daysInPeriod: 0,
      daysInTop5: 0,
      daysInTop10: 0,
    };

    const newHistory: Omit<EndorsementHistory, 'createdAt' | 'updatedAt'> = {
      id: historyId,
      userId,
      entityType: entry.type,
      entityId: entry.entityId,
      entityName: entry.entityName,
      totalDaysEndorsed: 0,
      totalDaysInTop5: 0,
      totalDaysInTop10: 0,
      periods: [newPeriod],
      isCurrentlyEndorsed: true,
      currentPosition: entry.position,
      currentPeriodStartDate: entry.createdAt,
    };

    await setDoc(docRef, {
      ...newHistory,
      periods: [{
        ...newPeriod,
        startDate: entry.createdAt,
        endDate: null,
        positionHistory: [],
      }],
      currentPeriodStartDate: entry.createdAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    created++;
    console.log(`[EndorsementHistory] Created migration history for ${entry.entityName}`);
  }

  console.log(`[EndorsementHistory] Migration complete: ${created} created, ${existing} already existed`);
  return { created, existing };
};
