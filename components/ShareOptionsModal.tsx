/**
 * ShareOptionsModal Component
 * Simple modal with Share or Copy Link options
 * Supports referral tracking by appending user's referral code to shared URLs
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Alert,
} from 'react-native';
import { Share2, Link as LinkIcon } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import * as Clipboard from 'expo-clipboard';
import { appendReferralTracking } from '@/services/firebase/referralService';

interface ShareOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => Promise<void>;
  shareUrl?: string;
  isDarkMode?: boolean;
  referralCode?: string | null; // Optional referral code for tracking
}

export default function ShareOptionsModal({
  visible,
  onClose,
  onShare,
  shareUrl,
  isDarkMode = false,
  referralCode,
}: ShareOptionsModalProps) {
  const colors = isDarkMode ? darkColors : lightColors;
  const [copied, setCopied] = useState(false);

  // URL with referral tracking appended
  const trackedUrl = useMemo(() => {
    if (!shareUrl) return '';
    return appendReferralTracking(shareUrl, referralCode);
  }, [shareUrl, referralCode]);

  const handleCopyLink = async () => {
    if (!trackedUrl) {
      Alert.alert('Error', 'No link available to copy');
      return;
    }

    try {
      await Clipboard.setStringAsync(trackedUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);

      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Could not copy link');
    }
  };

  const handleShare = async () => {
    try {
      await onShare();
      onClose();
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
              <Text style={[styles.title, { color: colors.text }]}>Share</Text>

              {/* Share Button */}
              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                  <Share2 size={20} color={colors.white} strokeWidth={2} />
                </View>
                <Text style={[styles.optionText, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>

              {/* Copy Link Button */}
              {shareUrl && (
                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={handleCopyLink}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                    <LinkIcon size={20} color={colors.white} strokeWidth={2} />
                  </View>
                  <Text style={[styles.optionText, { color: colors.text }]}>
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Cancel Button */}
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
