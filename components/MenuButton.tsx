import { useRouter, useSegments } from 'expo-router';
import { Menu, LogOut, User, Heart, Gift } from 'lucide-react-native';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useClerk } from '@clerk/clerk-expo';
import { useReferralCode } from '@/hooks/useReferralCode';
import { getReferralLink } from '@/services/firebase/referralService';
import * as Clipboard from 'expo-clipboard';

export default function MenuButton() {
  const router = useRouter();
  const segments = useSegments();
  const { isDarkMode, clerkUser, profile } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;
  const { signOut } = useClerk();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { referralCode } = useReferralCode();
  const isBusiness = profile.accountType === 'business';

  const handleSignOut = async () => {
    try {
      console.log('[MenuButton] Starting sign out process...');
      console.log('[MenuButton] Menu visible: false');
      setIsMenuVisible(false);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[MenuButton] Calling Clerk signOut...');
      await signOut();
      console.log('[MenuButton] Clerk signOut complete');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[MenuButton] Navigating to sign-in...');
      router.replace('/(auth)/sign-in');
      console.log('[MenuButton] Navigation complete');
    } catch (error) {
      console.error('[MenuButton] Sign out error:', error);
      await new Promise(resolve => setTimeout(resolve, 100));
      router.replace('/(auth)/sign-in');
    }
  };

  const handleNavigateToSearch = () => {
    setIsMenuVisible(false);
    router.push('/search');
  };

  const handleNavigateToSettings = () => {
    setIsMenuVisible(false);
    router.push('/settings');
  };

  const handleUpdateValues = () => {
    setIsMenuVisible(false);
    router.push('/onboarding');
  };

  const handleInvite = () => {
    setIsMenuVisible(false);
    setShowInviteModal(true);
  };

  const handleCopyInviteLink = async () => {
    if (!referralCode) return;
    const link = getReferralLink(referralCode);
    await Clipboard.setStringAsync(link);
    Alert.alert('Copied!', 'Your invite link has been copied to clipboard.');
  };

  const handleShareInvite = async () => {
    if (!referralCode) return;
    const link = getReferralLink(referralCode);
    const message = `Join me on iEndorse! Use my invite link to sign up: ${link}`;

    try {
      await Share.share({
        message,
        url: link,
        title: 'Join iEndorse',
      });
    } catch (error) {
      console.error('[MenuButton] Error sharing:', error);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setIsMenuVisible(true)}
        activeOpacity={0.7}
      >
        <Menu size={28} color={colors.text} strokeWidth={2} />
      </TouchableOpacity>

      <Modal
        visible={isMenuVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsMenuVisible(false)}
        >
          <TouchableOpacity
            style={[
              styles.menuContainer,
              {
                backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB',
                borderWidth: 1,
                borderColor: '#FFFFFF',
              }
            ]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/endorsing.png')}
                style={styles.menuLogo}
                resizeMode="contain"
              />
            </View>

            <ScrollView style={styles.menuContent}>
              {clerkUser && (
                <View style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                  <View style={styles.menuItemLeft}>
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.avatarText, { color: colors.white }]}>
                        {clerkUser.firstName?.charAt(0) || clerkUser.emailAddresses[0].emailAddress.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.menuItemTitle, { color: colors.text }]}>
                        {clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : clerkUser.emailAddresses[0].emailAddress}
                      </Text>
                      {clerkUser.firstName && (
                        <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                          {clerkUser.emailAddresses[0].emailAddress}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
                onPress={handleNavigateToSettings}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <User size={26} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.menuItemTitle, { color: colors.text }]}>Settings</Text>
                </View>
              </TouchableOpacity>

              {/* Update My Values menu item */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
                onPress={handleUpdateValues}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <Heart size={26} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.menuItemTitle, { color: colors.text }]}>Update My Values</Text>
                </View>
              </TouchableOpacity>

              {/* Invite Friends menu item */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
                onPress={handleInvite}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <Gift size={26} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.menuItemTitle, { color: colors.text }]}>Invite Friends</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <LogOut size={26} color={colors.danger} strokeWidth={2} />
                  <Text style={[styles.menuItemTitle, { color: colors.danger }]}>Logout</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInviteModal(false)}
        >
          <TouchableOpacity
            style={[styles.inviteModalContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.inviteModalHeader}>
              <Text style={[styles.inviteModalTitle, { color: colors.text }]}>Invite Friends</Text>
            </View>

            <View style={styles.inviteContent}>
              {/* Referral Code Display */}
              <View style={[styles.referralCodeBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.referralCodeLabel, { color: colors.textSecondary }]}>Your Invite Code</Text>
                <Text style={[styles.referralCode, { color: colors.primary }]}>{referralCode || '...'}</Text>
              </View>

              {/* Invite Link */}
              <View style={[styles.referralLinkBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.referralLinkLabel, { color: colors.textSecondary }]}>Your Invite Link</Text>
                <Text style={[styles.referralLink, { color: colors.text }]} numberOfLines={1}>
                  {referralCode ? getReferralLink(referralCode) : '...'}
                </Text>
              </View>

              {/* Bonus Info */}
              <View style={[styles.bonusInfoBox, { backgroundColor: 'transparent', borderColor: colors.primary }]}>
                <Text style={[styles.bonusInfoText, { color: colors.text }]}>
                  Get all of your endorsements backdated by <Text style={{ fontWeight: '700', color: colors.primary }}>7 DAYS</Text> for each successful referral!
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={[styles.inviteActionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={handleCopyInviteLink}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.inviteActionText, { color: colors.text }]}>Copy Link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleShareInvite}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.inviteActionText, { color: colors.white }]}>Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.closeInviteButton, { borderColor: colors.border }]}
                onPress={() => setShowInviteModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.closeInviteText, { color: colors.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isMobile = screenWidth < 768;

const styles = StyleSheet.create({
  menuButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isMobile && { marginLeft: 'auto' }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' && isMobile ? '15%' : '5%',
  },
  menuContainer: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  logoContainer: {
    padding: Platform.OS === 'web' && isMobile ? 20 : 28,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  menuLogo: {
    width: 240,
    height: 70,
  },
  menuContent: {
    maxHeight: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'web' && isMobile ? 18 : 24,
    paddingHorizontal: 28,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 20,
    fontWeight: '500' as const,
  },
  menuItemSubtitle: {
    fontSize: 16,
    fontWeight: '400' as const,
    marginTop: 4,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  // Invite modal styles
  inviteModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
  },
  inviteModalHeader: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
  },
  inviteModalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  inviteContent: {
    padding: 24,
    gap: 16,
  },
  referralCodeBox: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  referralCodeLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginBottom: 6,
  },
  referralCode: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: 3,
  },
  referralLinkBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  referralLinkLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginBottom: 6,
  },
  referralLink: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  inviteActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  inviteActionText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  closeInviteButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  closeInviteText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  bonusInfoBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  bonusInfoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
});
