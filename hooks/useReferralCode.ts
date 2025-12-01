/**
 * useReferralCode Hook
 * Provides easy access to the current user's referral code for sharing purposes
 */

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { getUserReferralCode } from '@/services/firebase/referralService';

interface UseReferralCodeReturn {
  referralCode: string | null;
  isLoading: boolean;
}

export function useReferralCode(): UseReferralCodeReturn {
  const { user, isLoaded } = useUser();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReferralCode = async () => {
      if (!isLoaded) return;

      if (!user?.id) {
        setReferralCode(null);
        setIsLoading(false);
        return;
      }

      try {
        const code = await getUserReferralCode(user.id);
        setReferralCode(code);
      } catch (error) {
        console.error('[useReferralCode] Error loading referral code:', error);
        setReferralCode(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadReferralCode();
  }, [user?.id, isLoaded]);

  return { referralCode, isLoading };
}

export default useReferralCode;
