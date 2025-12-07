import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { ChevronLeft, Lock, Download, Shield, FileText, ExternalLink, Trash2, Building2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser as useUserContext } from '@/contexts/UserContext';
import { useUser, useAuth } from '@clerk/clerk-expo';

export default function SettingsScreen() {
  const router = useRouter();
  const { isDarkMode, profile, setBusinessInfo } = useUserContext();
  const colors = isDarkMode ? darkColors : lightColors;
  const { user } = useUser();
  const { signOut } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  // On larger screens (web), constrain content to 50% width in the center
  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;
  const contentMaxWidth = isLargeScreen ? windowWidth * 0.5 : undefined;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [codeSharing, setCodeSharing] = useState(profile.codeSharing ?? true);
  const [isPasswordSectionExpanded, setIsPasswordSectionExpanded] = useState(false);

  useEffect(() => {
    setCodeSharing(profile.codeSharing ?? true);
  }, [profile.codeSharing]);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    setError('');

    try {
      await user?.updatePassword({
        currentPassword,
        newPassword,
      });

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Success',
        'Your password has been changed successfully',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      console.error('[Settings] Password change error:', err);

      // Handle specific Clerk errors
      if (err?.errors?.[0]?.code === 'form_password_incorrect') {
        setError('Current password is incorrect');
      } else if (err?.errors?.[0]?.code === 'form_password_pwned') {
        setError('This password has been compromised. Please choose a different password');
      } else if (err?.errors?.[0]?.code === 'form_password_length_too_short') {
        setError('Password must be at least 8 characters long');
      } else {
        const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Failed to change password';
        setError(errorMessage);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggleCodeSharing = async (value: boolean) => {
    setCodeSharing(value);
    await setBusinessInfo({ codeSharing: value });

    if (!value) {
      Alert.alert(
        'Code Sharing Disabled',
        'Your personalized code will no longer be shared with merchants. This may affect your ability to receive discounts and donations.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleDownloadData = () => {
    Alert.alert(
      'Download Your Data',
      'We will prepare your data for download and send it to your email address within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Download',
          onPress: () => {
            Alert.alert('Request Submitted', 'Check your email for the download link.', [{ text: 'OK' }]);
          }
        }
      ]
    );
  };

  const handleOpenPrivacyPolicy = () => {
    router.push('/privacy-policy');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the user account
              await user?.delete();

              // Sign out
              await signOut();

              // Navigate to sign-in
              router.replace('/(auth)/sign-in');
            } catch (error) {
              console.error('[Settings] Delete account error:', error);
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again or contact support.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: 'rgba(0, 0, 0, 0.05)' }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={28} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Image
          source={require('@/assets/images/yendorse.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isLargeScreen && {
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          }
        ]}
      >
        <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>

        {/* Password Change Section - Collapsible */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.collapsibleHeader, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setIsPasswordSectionExpanded(!isPasswordSectionExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderNoMargin}>
              <Lock size={24} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Change Password
              </Text>
            </View>
            {isPasswordSectionExpanded ? (
              <ChevronUp size={24} color={colors.textSecondary} strokeWidth={2} />
            ) : (
              <ChevronDown size={24} color={colors.textSecondary} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {isPasswordSectionExpanded && (
            <View style={[styles.card, styles.collapsibleContent, { backgroundColor: colors.backgroundSecondary }]}>
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Current Password</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter your current password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }
                  ]}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>New Password</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter your new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }
                  ]}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Confirm New Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }
                  ]}
                  autoCapitalize="none"
                />
              </View>

              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                Password must be at least 8 characters long
              </Text>

              <TouchableOpacity
                style={[
                  styles.changePasswordButton,
                  { backgroundColor: colors.primary },
                  isChangingPassword && styles.disabledButton
                ]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
                activeOpacity={0.7}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={[styles.changePasswordButtonText, { color: colors.white }]}>
                    Change Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Claim Business Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building2 size={24} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Business
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Own a business? Claim it to manage your profile and offer discounts to customers who endorse you.
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/business-setup?from=settings')}
              activeOpacity={0.7}
            >
              <Building2 size={20} color={colors.white} strokeWidth={2} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                Claim Your Business
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={24} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Privacy & Data
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
            {/* Stop Code Sharing Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Enable Code Sharing</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Allow merchants to access your code for discounts and donations
                </Text>
              </View>
              <Switch
                value={codeSharing}
                onValueChange={handleToggleCodeSharing}
                trackColor={{ false: '#D1D5DB', true: '#000000' }}
                thumbColor='#FFFFFF'
                ios_backgroundColor='#E5E7EB'
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Download My Data Button */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleDownloadData}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <Download size={22} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.actionText, { color: colors.text }]}>Download My Data</Text>
              </View>
              <ExternalLink size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Delete Account Button */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <Trash2 size={22} color="#EF4444" strokeWidth={2} />
                <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete Account</Text>
              </View>
              <ExternalLink size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={24} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Legal
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
            {/* Privacy Policy */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleOpenPrivacyPolicy}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <Shield size={22} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.actionText, { color: colors.text }]}>Privacy Policy & Terms</Text>
              </View>
              <ExternalLink size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  headerLogo: {
    width: 140,
    height: 41,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionHeaderNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 0,
  },
  collapsibleContent: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
    marginBottom: 20,
    fontStyle: 'italic' as const,
  },
  changePasswordButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  disabledButton: {
    opacity: 0.6,
  },
  changePasswordButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  errorContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingLeft: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
