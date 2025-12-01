/**
 * Verification Badge Component
 * Shows a verification badge similar to X.com/Twitter
 * - Blue filled badge with checkmark for verified (organic) accounts
 * - Grey outlined badge with checkmark for celebrity accounts
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';

type VerificationType = 'verified' | 'celebrity';

interface VerificationBadgeProps {
  type: VerificationType;
  isDarkMode?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function VerificationBadge({
  type,
  isDarkMode = false,
  size = 'medium'
}: VerificationBadgeProps) {
  const colors = isDarkMode ? darkColors : lightColors;

  const sizeStyles = {
    small: {
      badge: { width: 14, height: 14 },
      icon: 9,
      borderWidth: 1.5,
    },
    medium: {
      badge: { width: 18, height: 18 },
      icon: 11,
      borderWidth: 2,
    },
    large: {
      badge: { width: 22, height: 22 },
      icon: 14,
      borderWidth: 2,
    },
  };

  const currentSize = sizeStyles[size];

  // Verified = blue filled, Celebrity = grey outlined
  const isVerified = type === 'verified';
  const badgeColor = isVerified ? colors.primary : '#9CA3AF'; // Grey for celebrity
  const backgroundColor = isVerified ? badgeColor : 'transparent';
  const checkColor = isVerified ? '#FFFFFF' : badgeColor;

  return (
    <View
      style={[
        styles.badge,
        currentSize.badge,
        {
          backgroundColor,
          borderColor: badgeColor,
          borderWidth: isVerified ? 0 : currentSize.borderWidth,
        }
      ]}
    >
      <Check
        size={currentSize.icon}
        color={checkColor}
        strokeWidth={isVerified ? 3 : 2.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
