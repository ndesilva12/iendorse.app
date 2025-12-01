/**
 * ShareModal Component
 * Modal for sharing brands, businesses, or lists with platform options
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
  Linking,
  Alert,
} from 'react-native';
import { X, Mail, Facebook, Twitter, Linkedin, Link as LinkIcon, MessageCircle, Share2 } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import * as Clipboard from 'expo-clipboard';
import { appendReferralTracking } from '@/services/firebase/referralService';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  shareUrl: string;
  title: string;
  description?: string;
  isDarkMode?: boolean;
  referralCode?: string | null; // Optional referral code for tracking
}

export default function ShareModal({
  visible,
  onClose,
  shareUrl,
  title,
  description,
  isDarkMode = false,
  referralCode,
}: ShareModalProps) {
  const colors = isDarkMode ? darkColors : lightColors;
  const [copied, setCopied] = useState(false);

  // URL with referral tracking appended
  const trackedUrl = useMemo(() => {
    return appendReferralTracking(shareUrl, referralCode);
  }, [shareUrl, referralCode]);

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(trackedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      if (Platform.OS === 'web') {
        // Show subtle confirmation on web
      } else {
        Alert.alert('Success', 'Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Could not copy link');
    }
  };

  const handleShare = async (platform: string) => {
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(trackedUrl);
    const encodedDescription = description ? encodeURIComponent(description) : '';

    let url = '';

    switch (platform) {
      case 'email':
        url = `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
        break;
      case 'sms':
        url = Platform.OS === 'ios'
          ? `sms:&body=${encodedTitle}%20${encodedUrl}`
          : `sms:?body=${encodedTitle}%20${encodedUrl}`;
        break;
      default:
        return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        onClose();
      } else {
        Alert.alert('Error', `Cannot open ${platform}`);
      }
    } catch (error) {
      console.error(`Error opening ${platform}:`, error);
      Alert.alert('Error', `Could not open ${platform}`);
    }
  };

  const shareOptions = [
    { id: 'email', label: 'Email', icon: Mail, color: '#EA4335' },
    { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
    { id: 'twitter', label: 'X', icon: Twitter, color: '#000000' },
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
    { id: 'sms', label: 'Message', icon: MessageCircle, color: '#34C759' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.text }]}>Share</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Share Title */}
              <View style={styles.shareInfo}>
                <Text style={[styles.shareTitle, { color: colors.text }]} numberOfLines={2}>
                  {title}
                </Text>
                {description && (
                  <Text style={[styles.shareDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                    {description}
                  </Text>
                )}
              </View>

              {/* Copy Link Button - Prominent */}
              <TouchableOpacity
                style={[styles.copyLinkButton, { backgroundColor: colors.primary }]}
                onPress={handleCopyLink}
                activeOpacity={0.7}
              >
                <LinkIcon size={20} color={colors.white} strokeWidth={2} />
                <Text style={[styles.copyLinkText, { color: colors.white }]}>
                  {copied ? 'Link Copied!' : 'Copy Link'}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: colors.border }]}>
                <Text style={[styles.dividerText, { color: colors.textSecondary, backgroundColor: colors.background }]}>
                  or share via
                </Text>
              </View>

              {/* Share Options Grid */}
              <View style={styles.optionsGrid}>
                {shareOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.optionButton, { backgroundColor: colors.backgroundSecondary }]}
                      onPress={() => handleShare(option.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
                        <Icon size={20} color="#FFFFFF" strokeWidth={2} />
                      </View>
                      <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={1}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* URL Display */}
              <View style={[styles.urlContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.urlText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {trackedUrl}
                </Text>
              </View>
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
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  closeButton: {
    padding: 4,
  },
  shareInfo: {
    marginBottom: 20,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  shareDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  copyLinkText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    marginBottom: 20,
    position: 'relative' as const,
    alignItems: 'center',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500' as const,
    paddingHorizontal: 12,
    position: 'absolute' as const,
    top: -8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  urlContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  urlText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
});
