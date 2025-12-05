/**
 * ContactModal Component
 * Contact form modal for user message submissions
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { X, Send, Mail } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { submitContactMessage } from '@/services/firebase/contactService';

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  // For authenticated users
  userId?: string;
  userName?: string;
  userEmail?: string;
  // If true, shows name/email fields (for unauthenticated users)
  requireContactInfo?: boolean;
}

const CONTACT_EMAIL = 'ndesilva1@alum.babson.edu';

export default function ContactModal({
  visible,
  onClose,
  isDarkMode = false,
  userId,
  userName,
  userEmail,
  requireContactInfo = false,
}: ContactModalProps) {
  const colors = isDarkMode ? darkColors : lightColors;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    // Validate required fields
    if (requireContactInfo) {
      if (!name.trim()) {
        if (Platform.OS === 'web') {
          window.alert('Please enter your name');
        } else {
          Alert.alert('Required', 'Please enter your name');
        }
        return;
      }
      if (!email.trim()) {
        if (Platform.OS === 'web') {
          window.alert('Please enter your email');
        } else {
          Alert.alert('Required', 'Please enter your email');
        }
        return;
      }
    }

    if (!message.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a message');
      } else {
        Alert.alert('Required', 'Please enter a message');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await submitContactMessage(message, {
        userId: userId,
        name: requireContactInfo ? name.trim() : userName,
        email: requireContactInfo ? email.trim() : userEmail,
      });

      setSubmitted(true);
      // Reset form
      setName('');
      setEmail('');
      setMessage('');

      // Auto close after 2 seconds
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('[ContactModal] Error submitting:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to send message. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`);
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setMessage('');
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={[styles.title, { color: colors.text }]}>Contact Us</Text>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {submitted ? (
                  <View style={styles.successContainer}>
                    <View style={[styles.successIcon, { backgroundColor: colors.primary + '20' }]}>
                      <Send size={32} color={colors.primary} strokeWidth={2} />
                    </View>
                    <Text style={[styles.successTitle, { color: colors.text }]}>
                      Message Sent!
                    </Text>
                    <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
                      Thank you for reaching out. We'll get back to you soon.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                      Send us a message and we'll get back to you as soon as possible.
                    </Text>

                    {/* Name field (for unauthenticated users) */}
                    {requireContactInfo && (
                      <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Name</Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              backgroundColor: colors.backgroundSecondary,
                              color: colors.text,
                              borderColor: colors.border,
                            },
                          ]}
                          placeholder="Your name"
                          placeholderTextColor={colors.textSecondary}
                          value={name}
                          onChangeText={setName}
                          autoCapitalize="words"
                        />
                      </View>
                    )}

                    {/* Email field (for unauthenticated users) */}
                    {requireContactInfo && (
                      <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              backgroundColor: colors.backgroundSecondary,
                              color: colors.text,
                              borderColor: colors.border,
                            },
                          ]}
                          placeholder="your@email.com"
                          placeholderTextColor={colors.textSecondary}
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    )}

                    {/* Message field */}
                    <View style={styles.inputContainer}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>Message</Text>
                      <TextInput
                        style={[
                          styles.textArea,
                          {
                            backgroundColor: colors.backgroundSecondary,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        placeholder="How can we help you?"
                        placeholderTextColor={colors.textSecondary}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                      />
                    </View>

                    {/* Submit button */}
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        { backgroundColor: colors.primary },
                        isSubmitting && styles.disabledButton,
                      ]}
                      onPress={handleSubmit}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Send size={18} color="#FFFFFF" strokeWidth={2} />
                          <Text style={styles.submitButtonText}>Send Message</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Alternative email contact */}
                    <View style={styles.alternativeContainer}>
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      <Text style={[styles.alternativeText, { color: colors.textSecondary }]}>
                        or email us directly
                      </Text>
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    </View>

                    <TouchableOpacity
                      style={[styles.emailButton, { borderColor: colors.border }]}
                      onPress={handleEmailPress}
                      activeOpacity={0.7}
                    >
                      <Mail size={18} color={colors.primary} strokeWidth={2} />
                      <Text style={[styles.emailText, { color: colors.primary }]}>
                        {CONTACT_EMAIL}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
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
  keyboardView: {
    width: '100%',
    maxWidth: 450,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 0,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  alternativeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  alternativeText: {
    fontSize: 13,
    marginHorizontal: 12,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  emailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
