import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={28} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Image
          source={require('@/assets/images/endorsing.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webContent]}
      >
        <Text style={[styles.mainTitle, { color: colors.text }]}>
          Stand Privacy Policy & Terms of Service
        </Text>

        <Text style={[styles.date, { color: colors.textSecondary }]}>
          Effective Date: November 7, 2025{'\n'}
          Last Updated: November 7, 2025
        </Text>

        {/* Privacy Policy */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy Policy</Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          iEndorse Corp ("we," "us," or "iEndorse") operates the iEndorse App (the "App"), a values-based shopping and discovery platform available at iendorse.app and via mobile applications.
        </Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          This Privacy Policy explains how we collect, use, disclose, and protect your information when you use the App, create an account, generate a personalized code, or interact with merchants and local businesses through our service.
        </Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          By using the App, you agree to this Privacy Policy. If you do not agree, do not use the App.
        </Text>

        {/* Section 1 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Information We Collect</Text>

        <Text style={[styles.subHeading, { color: colors.text }]}>A. Information You Provide Directly</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          <Text style={styles.bold}>Account Information:</Text> Name, email address, password (hashed), and profile photo (optional).{'\n\n'}
          <Text style={styles.bold}>Values & Preferences:</Text> The values you select as Aligned, Opposed, or Neutral during onboarding and profile updates.{'\n\n'}
          <Text style={styles.bold}>Voluntary Profile Data:</Text> Any additional information you choose to add (e.g., city, favorite causes, bio).{'\n\n'}
          <Text style={styles.bold}>Consent to Code Generation:</Text> When you opt in to generate a Personalized Code, you authorize sharing of your name, email, and selected values with participating merchants.
        </Text>

        <Text style={[styles.subHeading, { color: colors.text }]}>B. Information Collected Automatically</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          <Text style={styles.bold}>Usage Data:</Text> Pages viewed, buttons clicked, time spent, search queries.{'\n\n'}
          <Text style={styles.bold}>Device & Technical Data:</Text> IP address, device type, browser, operating system, App version.{'\n\n'}
          <Text style={styles.bold}>Cookies & Tracking:</Text> We use essential cookies for login and functionality. Analytics cookies (optional) help improve the App.
        </Text>

        <Text style={[styles.subHeading, { color: colors.text }]}>C. Information from Third Parties</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          <Text style={styles.bold}>Bank Data (Optional):</Text> If you connect a bank via Plaid (or similar), we receive transaction data (merchant names, amounts, dates) to track spending and calculate impact. We do not store full card numbers or bank logins.{'\n\n'}
          <Text style={styles.bold}>Merchant Feedback:</Text> Merchants may report when your code is used (e.g., purchase confirmed).
        </Text>

        {/* Section 2 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>2. How We Use Your Information</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          • Create and manage your account{'\n'}
          • Generate and validate your Personalized Code{'\n'}
          • Match you with aligned merchants and local businesses{'\n'}
          • Share your name, email, and selected values with merchants to unlock discounts, donations, and tailored offers{'\n'}
          • Send transactional emails (e.g., code ready, discount applied){'\n'}
          • Improve the App (analytics, bug fixes){'\n'}
          • Prevent fraud and enforce terms
        </Text>

        {/* Section 3 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Data Sharing with Merchants</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          This is the core value exchange of Stand:{'\n\n'}
          <Text style={styles.bold}>You get:</Text> Discounts, charity donations, and recommendations{'\n'}
          <Text style={styles.bold}>Merchants get:</Text> Your name, email, and values profile (aligned/opposed/neutral)
        </Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          <Text style={styles.bold}>What is Shared:</Text>{'\n'}
          • Name: Yes{'\n'}
          • Email: Yes{'\n'}
          • Selected Values: Yes{'\n'}
          • Phone Number: No{'\n'}
          • Address: No{'\n'}
          • Bank/Credit Card Details: No{'\n'}
          • Full Transaction History: No (only confirmation of use)
        </Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          Merchants may use this data to:{'\n'}
          • Apply your discount{'\n'}
          • Donate to a cause you support{'\n'}
          • Send you personalized offers (via email or in-store){'\n'}
          • Improve their alignment with customer values
        </Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          <Text style={styles.bold}>You control this sharing:</Text>{'\n'}
          • You must opt in during signup{'\n'}
          • You can revoke consent at any time in Settings > Privacy > Stop Code Sharing
        </Text>

        {/* Section 5 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>5. Your Privacy Rights</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          • Access your data: Settings > Profile > Download Data{'\n'}
          • Correct inaccurate data: Edit in Profile{'\n'}
          • Delete your account: Settings > Delete Account{'\n'}
          • Revoke Code Sharing: Settings > Privacy > Stop Sharing{'\n'}
          • CCPA Request: Email privacy@stand.app
        </Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          We respond within 30 days (CCPA) or 1 month (GDPR).
        </Text>

        {/* Section 6 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>6. Data Security</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          • Passwords are hashed with bcrypt{'\n'}
          • Data in transit uses TLS 1.3{'\n'}
          • Access is role-based and logged{'\n'}
          • Regular security audits via Vercel and Firebase
        </Text>

        <Text style={[styles.bodyText, { color: colors.text }]}>
          However, no system is 100% secure. You are responsible for keeping your password safe.
        </Text>

        {/* Section 7 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>7. Children</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          The App is not for users under 16. We do not knowingly collect data from children.
        </Text>

        {/* Section 10 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>10. Contact Us</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          iEndorse Corp{'\n'}
          Email: privacy@stand.app{'\n'}
          Address: Remote – USA
        </Text>

        {/* Terms of Service */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Terms of Service</Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Acceptance</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          By using Stand, you agree to these Terms and our Privacy Policy.
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>2. User Conduct</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          You may not:{'\n'}
          • Use bots or scrape data{'\n'}
          • Reverse-engineer the App{'\n'}
          • Share your code with others{'\n'}
          • Use the App for illegal purposes
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Personalized Code</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          • The code is personal and non-transferable{'\n'}
          • Discounts and donations are at merchant discretion{'\n'}
          • We are not liable for merchant failure to honor offers
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>4. Intellectual Property</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          All content, logos, and code are owned by iEndorse Corp.
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>5. Disclaimer of Warranties</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          The App is provided "as is". We do not guarantee 100% uptime or accuracy of matches.
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>6. Limitation of Liability</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          To the fullest extent allowed by law, iEndorse Corp is not liable for indirect damages or losses from merchant actions.
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>7. Termination</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          We may suspend or delete your account for violations.
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.text }]}>8. Governing Law</Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          Delaware, USA (without regard to conflict of laws).
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  webContent: {
    maxWidth: 768,
    alignSelf: 'center' as const,
    width: '100%',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  date: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: 32,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 24,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  bold: {
    fontWeight: '700' as const,
  },
});
