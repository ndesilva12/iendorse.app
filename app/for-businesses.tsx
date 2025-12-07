import { useRouter } from 'expo-router';
import { Building2, Users, TrendingUp, Heart, Star, ArrowRight, Check } from 'lucide-react-native';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';

export default function ForBusinessesScreen() {
  const router = useRouter();
  const { isDarkMode } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  const handleGetStarted = () => {
    router.push('/sign-up');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <Image
              source={require('@/assets/images/yendorseicon.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            {IS_WEB && (
              <View style={styles.headerNav}>
                <TouchableOpacity onPress={() => {}} style={styles.navItem}>
                  <Text style={[styles.navText, { color: colors.text }]}>Features</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {}} style={styles.navItem}>
                  <Text style={[styles.navText, { color: colors.text }]}>Pricing</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {}} style={styles.navItem}>
                  <Text style={[styles.navText, { color: colors.text }]}>About</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: colors.primary }]}
                  onPress={handleGetStarted}
                >
                  <Text style={[styles.headerButtonText, { color: colors.white }]}>Get Started</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Hero Section */}
        <View style={[styles.hero, { backgroundColor: colors.background }]}>
          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Connect with customers who share your values
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Join Endorse Money and attract value-aligned customers who want to support businesses like yours.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryButtonText, { color: colors.white }]}>
                Get Started Free
              </Text>
              <ArrowRight size={20} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Hero Image Placeholder */}
          <View style={[styles.heroImageContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Building2 size={120} color={colors.primary} opacity={0.3} />
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
              App Screenshot
            </Text>
          </View>
        </View>

        {/* Client Logos / Social Proof */}
        <View style={[styles.clientsSection, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          <Text style={[styles.clientsText, { color: colors.textSecondary }]}>
            Trusted by businesses across the country
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Everything you need to grow
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Powerful features to help you connect with value-aligned customers and grow your business
          </Text>

          <View style={styles.featuresGrid}>
            <FeatureCard
              icon={<Users size={32} color={colors.primary} />}
              title="Reach New Customers"
              description="Connect with customers actively seeking businesses that align with their values"
              colors={colors}
            />
            <FeatureCard
              icon={<TrendingUp size={32} color={colors.primary} />}
              title="Increase Visibility"
              description="Stand out in searches and get discovered by your ideal customer base"
              colors={colors}
            />
            <FeatureCard
              icon={<Heart size={32} color={colors.primary} />}
              title="Build Trust"
              description="Showcase your values and build authentic connections with your community"
              colors={colors}
            />
            <FeatureCard
              icon={<Star size={32} color={colors.primary} />}
              title="Customer Insights"
              description="Understand your customers better with detailed analytics and engagement metrics"
              colors={colors}
            />
          </View>
        </View>

        {/* Testimonials Section */}
        <View style={[styles.testimonialsSection, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Real Stories from Real Businesses
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            See how businesses are growing with Endorse Money
          </Text>

          <View style={styles.testimonialsGrid}>
            <TestimonialCard
              quote="Endorse Money helped us connect with customers who truly care about our mission. Our customer retention has never been better."
              author="Sarah Johnson"
              role="Owner, Green Earth Cafe"
              colors={colors}
            />
            <TestimonialCard
              quote="The platform made it easy to showcase our values and attract the right customers. It's been a game-changer for our business."
              author="Michael Chen"
              role="Founder, EcoTech Solutions"
              colors={colors}
            />
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Growing Together
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Join a thriving community of value-driven businesses
          </Text>

          <View style={styles.statsGrid}>
            <StatCard
              number="10,000+"
              label="Active Users"
              colors={colors}
            />
            <StatCard
              number="500+"
              label="Businesses"
              colors={colors}
            />
            <StatCard
              number="95%"
              label="Satisfaction Rate"
              colors={colors}
            />
            <StatCard
              number="50+"
              label="Cities"
              colors={colors}
            />
          </View>
        </View>

        {/* Feature Showcase 1 */}
        <View style={styles.featureShowcase}>
          <View style={styles.featureShowcaseContent}>
            <View style={[styles.featureImagePlaceholder, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Building2 size={80} color={colors.primary} opacity={0.3} />
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                Business Profile Screenshot
              </Text>
            </View>
            <View style={styles.featureShowcaseText}>
              <Text style={[styles.featureShowcaseTitle, { color: colors.text }]}>
                Create Your Brand Profile
              </Text>
              <Text style={[styles.featureShowcaseDescription, { color: colors.textSecondary }]}>
                Build a compelling profile that showcases your business values, mission, and what makes you unique. Let customers discover the real story behind your brand.
              </Text>
              <View style={styles.featurePoints}>
                <FeaturePoint text="Customizable brand profile" colors={colors} />
                <FeaturePoint text="Value alignment display" colors={colors} />
                <FeaturePoint text="Rich media support" colors={colors} />
              </View>
            </View>
          </View>
        </View>

        {/* Feature Showcase 2 */}
        <View style={[styles.featureShowcase, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.featureShowcaseContent}>
            <View style={styles.featureShowcaseText}>
              <Text style={[styles.featureShowcaseTitle, { color: colors.text }]}>
                Connect with Value-Aligned Customers
              </Text>
              <Text style={[styles.featureShowcaseDescription, { color: colors.textSecondary }]}>
                Reach customers who are actively looking for businesses that share their values. Build meaningful relationships that drive loyalty and growth.
              </Text>
              <View style={styles.featurePoints}>
                <FeaturePoint text="Targeted customer discovery" colors={colors} />
                <FeaturePoint text="Engagement analytics" colors={colors} />
                <FeaturePoint text="Community building tools" colors={colors} />
              </View>
            </View>
            <View style={[styles.featureImagePlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Users size={80} color={colors.primary} opacity={0.3} />
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                Customer Engagement Screenshot
              </Text>
            </View>
          </View>
        </View>

        {/* CTA Section */}
        <View style={[styles.ctaSection, { backgroundColor: colors.primary }]}>
          <Text style={[styles.ctaTitle, { color: colors.white }]}>
            Ready to grow your business?
          </Text>
          <Text style={[styles.ctaSubtitle, { color: colors.white }]}>
            Join Endorse Money today and start connecting with customers who share your values
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.white }]}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={[styles.ctaButtonText, { color: colors.primary }]}>
              Get Started Free
            </Text>
          </TouchableOpacity>
          <Text style={[styles.ctaNote, { color: colors.white }]}>
            No credit card required • Free forever
          </Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }]}>
          <Image
            source={require('@/assets/images/yendorseicon.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
              <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={[styles.footerDivider, { color: colors.textSecondary }]}>•</Text>
            <TouchableOpacity>
              <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={[styles.footerDivider, { color: colors.textSecondary }]}>•</Text>
            <TouchableOpacity>
              <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Contact</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.footerCopyright, { color: colors.textSecondary }]}>
            © 2024 Endorse Money. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description, colors }: any) {
  return (
    <View style={[styles.featureCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
        {icon}
      </View>
      <Text style={[styles.featureCardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.featureCardDescription, { color: colors.textSecondary }]}>{description}</Text>
    </View>
  );
}

// Testimonial Card Component
function TestimonialCard({ quote, author, role, colors }: any) {
  return (
    <View style={[styles.testimonialCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.testimonialQuote, { color: colors.text }]}>"{quote}"</Text>
      <View style={styles.testimonialAuthor}>
        <Text style={[styles.testimonialName, { color: colors.text }]}>{author}</Text>
        <Text style={[styles.testimonialRole, { color: colors.textSecondary }]}>{role}</Text>
      </View>
    </View>
  );
}

// Stat Card Component
function StatCard({ number, label, colors }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statNumber, { color: colors.primary }]}>{number}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// Feature Point Component
function FeaturePoint({ text, colors }: any) {
  return (
    <View style={styles.featurePointContainer}>
      <Check size={20} color={colors.primary} />
      <Text style={[styles.featurePointText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header
  header: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: IS_WEB ? 1200 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  headerLogo: {
    width: 50,
    height: 50,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  navItem: {
    paddingVertical: 8,
  },
  navText: {
    fontSize: 15,
    fontWeight: '500',
  },
  headerButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  headerButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    alignItems: 'center',
  },
  heroContent: {
    maxWidth: IS_WEB ? 800 : undefined,
    alignItems: 'center',
    marginBottom: 40,
  },
  heroTitle: {
    fontSize: IS_WEB ? 48 : 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: IS_WEB ? 56 : 40,
  },
  heroSubtitle: {
    fontSize: IS_WEB ? 20 : 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: IS_WEB ? 30 : 24,
    maxWidth: 600,
  },
  primaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  heroImageContainer: {
    width: IS_WEB ? 600 : SCREEN_WIDTH - 48,
    height: IS_WEB ? 400 : 300,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 14,
  },

  // Clients
  clientsSection: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  clientsText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Features Section
  featuresSection: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: IS_WEB ? 36 : 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: IS_WEB ? 18 : 16,
    textAlign: 'center',
    marginBottom: 48,
    maxWidth: 600,
    lineHeight: 24,
  },
  featuresGrid: {
    flexDirection: IS_WEB ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 24,
    maxWidth: 1200,
    justifyContent: 'center',
  },
  featureCard: {
    width: IS_WEB ? 260 : '100%',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  featureIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureCardDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Testimonials
  testimonialsSection: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  testimonialsGrid: {
    flexDirection: IS_WEB ? 'row' : 'column',
    gap: 24,
    maxWidth: 1000,
  },
  testimonialCard: {
    flex: 1,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  testimonialQuote: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  testimonialAuthor: {
    gap: 4,
  },
  testimonialName: {
    fontSize: 16,
    fontWeight: '600',
  },
  testimonialRole: {
    fontSize: 14,
  },

  // Stats
  statsSection: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: IS_WEB ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: IS_WEB ? 48 : 32,
    maxWidth: 1000,
    justifyContent: 'center',
  },
  statCard: {
    alignItems: 'center',
    minWidth: IS_WEB ? 200 : undefined,
  },
  statNumber: {
    fontSize: IS_WEB ? 48 : 36,
    fontWeight: '700',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 16,
  },

  // Feature Showcase
  featureShowcase: {
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  featureShowcaseContent: {
    flexDirection: IS_WEB ? 'row' : 'column',
    alignItems: 'center',
    gap: 48,
    maxWidth: 1200,
    alignSelf: 'center',
  },
  featureImagePlaceholder: {
    width: IS_WEB ? 500 : SCREEN_WIDTH - 48,
    height: IS_WEB ? 400 : 300,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureShowcaseText: {
    flex: 1,
    gap: 16,
  },
  featureShowcaseTitle: {
    fontSize: IS_WEB ? 32 : 24,
    fontWeight: '700',
    lineHeight: IS_WEB ? 40 : 32,
  },
  featureShowcaseDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  featurePoints: {
    gap: 12,
    marginTop: 8,
  },
  featurePointContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featurePointText: {
    fontSize: 15,
  },

  // CTA
  ctaSection: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: IS_WEB ? 36 : 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  ctaSubtitle: {
    fontSize: IS_WEB ? 18 : 16,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 600,
    lineHeight: 24,
    opacity: 0.9,
  },
  ctaButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ctaNote: {
    marginTop: 16,
    fontSize: 14,
    opacity: 0.8,
  },

  // Footer
  footer: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  footerLogo: {
    width: 60,
    height: 60,
    marginBottom: 24,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerLink: {
    fontSize: 14,
  },
  footerDivider: {
    fontSize: 14,
  },
  footerCopyright: {
    fontSize: 12,
  },
});
