import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Plus, Minus, ChevronDown, X, Trash2 } from 'lucide-react-native';
import { lightColors, darkColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

type EndorsementType = 'any' | 'top10' | 'top5';

interface DiscountTier {
  discount: number;
  type: EndorsementType;
  minDays: number;
  minFollowers: number;
}

export default function ValueCodeSettings() {
  const { isDarkMode, profile, setBusinessInfo } = useUser();
  const colors = isDarkMode ? darkColors : lightColors;

  const businessInfo = profile.businessInfo || {
    name: '',
    category: '',
    acceptsStandDiscounts: false,
    customerDiscountPercent: 5,
    customDiscount: '',
  };

  const [acceptsDiscounts, setAcceptsDiscounts] = useState(
    businessInfo.acceptsStandDiscounts ?? false
  );

  // Tier 1 (Base endorsement tier - required)
  const [tier1, setTier1] = useState<DiscountTier>({
    discount: businessInfo.customerDiscountPercent || 5,
    type: businessInfo.endorsementType || 'any',
    minDays: businessInfo.endorsementMinDays || 0,
    minFollowers: businessInfo.endorsementMinFollowers || 0,
  });
  const [showTier1TypeDropdown, setShowTier1TypeDropdown] = useState(false);

  // Tier 2 (optional)
  const [tier2Enabled, setTier2Enabled] = useState(
    businessInfo.tier2Discount && businessInfo.tier2Discount > 0
  );
  const [tier2, setTier2] = useState<DiscountTier>({
    discount: businessInfo.tier2Discount || 10,
    type: businessInfo.tier2Type || 'top10',
    minDays: businessInfo.tier2MinDays || 0,
    minFollowers: businessInfo.tier2MinFollowers || 0,
  });
  const [showTier2TypeDropdown, setShowTier2TypeDropdown] = useState(false);

  // Tier 3 (optional)
  const [tier3Enabled, setTier3Enabled] = useState(
    businessInfo.tier3Discount && businessInfo.tier3Discount > 0
  );
  const [tier3, setTier3] = useState<DiscountTier>({
    discount: businessInfo.tier3Discount || 15,
    type: businessInfo.tier3Type || 'top5',
    minDays: businessInfo.tier3MinDays || 0,
    minFollowers: businessInfo.tier3MinFollowers || 0,
  });
  const [showTier3TypeDropdown, setShowTier3TypeDropdown] = useState(false);

  // Custom discount
  const [showCustomInput, setShowCustomInput] = useState(
    !!(businessInfo.customDiscount && businessInfo.customDiscount.trim())
  );
  const [customDiscountText, setCustomDiscountText] = useState(businessInfo.customDiscount || '');
  const [customDiscountType, setCustomDiscountType] = useState<EndorsementType>(
    businessInfo.customDiscountType || 'any'
  );
  const [customDiscountMinDays, setCustomDiscountMinDays] = useState(
    businessInfo.customDiscountMinDays || 0
  );
  const [showCustomTypeDropdown, setShowCustomTypeDropdown] = useState(false);

  const handleToggleDiscounts = async (value: boolean) => {
    setAcceptsDiscounts(value);
    await setBusinessInfo({
      acceptsStandDiscounts: value,
    });

    if (value) {
      Alert.alert(
        'Discounts Enabled',
        'Customers who endorse your business can now receive discounts!',
        [{ text: 'Great!' }]
      );
    }
  };

  // Tier 1 handlers
  const handleTier1DiscountChange = async (newValue: number) => {
    const clamped = Math.max(0, Math.min(50, newValue));
    setTier1({ ...tier1, discount: clamped });
    await setBusinessInfo({ customerDiscountPercent: clamped });
  };

  const handleTier1TypeChange = async (type: EndorsementType) => {
    setTier1({ ...tier1, type });
    setShowTier1TypeDropdown(false);
    await setBusinessInfo({ endorsementType: type });
  };

  const handleTier1MinDaysChange = async (newDays: number) => {
    const clamped = Math.max(0, Math.min(365, newDays));
    setTier1({ ...tier1, minDays: clamped });
    await setBusinessInfo({ endorsementMinDays: clamped });
  };

  const handleTier1MinFollowersChange = async (newFollowers: number) => {
    const clamped = Math.max(0, Math.min(100000, newFollowers));
    setTier1({ ...tier1, minFollowers: clamped });
    await setBusinessInfo({ endorsementMinFollowers: clamped });
  };

  // Tier 2 handlers
  const handleEnableTier2 = async () => {
    setTier2Enabled(true);
    await setBusinessInfo({
      tier2Discount: tier2.discount,
      tier2Type: tier2.type,
      tier2MinDays: tier2.minDays,
      tier2MinFollowers: tier2.minFollowers,
    });
  };

  const handleDisableTier2 = async () => {
    setTier2Enabled(false);
    await setBusinessInfo({
      tier2Discount: 0,
      tier2Type: null,
      tier2MinDays: 0,
      tier2MinFollowers: 0,
    });
  };

  const handleTier2DiscountChange = async (newValue: number) => {
    const clamped = Math.max(tier1.discount, Math.min(50, newValue));
    setTier2({ ...tier2, discount: clamped });
    await setBusinessInfo({ tier2Discount: clamped });
  };

  const handleTier2TypeChange = async (type: EndorsementType) => {
    setTier2({ ...tier2, type });
    setShowTier2TypeDropdown(false);
    await setBusinessInfo({ tier2Type: type });
  };

  const handleTier2MinDaysChange = async (newDays: number) => {
    const clamped = Math.max(0, Math.min(365, newDays));
    setTier2({ ...tier2, minDays: clamped });
    await setBusinessInfo({ tier2MinDays: clamped });
  };

  const handleTier2MinFollowersChange = async (newFollowers: number) => {
    const clamped = Math.max(0, Math.min(100000, newFollowers));
    setTier2({ ...tier2, minFollowers: clamped });
    await setBusinessInfo({ tier2MinFollowers: clamped });
  };

  // Tier 3 handlers
  const handleEnableTier3 = async () => {
    setTier3Enabled(true);
    await setBusinessInfo({
      tier3Discount: tier3.discount,
      tier3Type: tier3.type,
      tier3MinDays: tier3.minDays,
      tier3MinFollowers: tier3.minFollowers,
    });
  };

  const handleDisableTier3 = async () => {
    setTier3Enabled(false);
    await setBusinessInfo({
      tier3Discount: 0,
      tier3Type: null,
      tier3MinDays: 0,
      tier3MinFollowers: 0,
    });
  };

  const handleTier3DiscountChange = async (newValue: number) => {
    const minDiscount = tier2Enabled ? tier2.discount : tier1.discount;
    const clamped = Math.max(minDiscount, Math.min(50, newValue));
    setTier3({ ...tier3, discount: clamped });
    await setBusinessInfo({ tier3Discount: clamped });
  };

  const handleTier3TypeChange = async (type: EndorsementType) => {
    setTier3({ ...tier3, type });
    setShowTier3TypeDropdown(false);
    await setBusinessInfo({ tier3Type: type });
  };

  const handleTier3MinDaysChange = async (newDays: number) => {
    const clamped = Math.max(0, Math.min(365, newDays));
    setTier3({ ...tier3, minDays: clamped });
    await setBusinessInfo({ tier3MinDays: clamped });
  };

  const handleTier3MinFollowersChange = async (newFollowers: number) => {
    const clamped = Math.max(0, Math.min(100000, newFollowers));
    setTier3({ ...tier3, minFollowers: clamped });
    await setBusinessInfo({ tier3MinFollowers: clamped });
  };

  // Custom discount handlers
  const handleCustomDiscountTextChange = async (text: string) => {
    setCustomDiscountText(text);
    await setBusinessInfo({ customDiscount: text });
  };

  const handleCustomDiscountTypeChange = async (type: EndorsementType) => {
    setCustomDiscountType(type);
    setShowCustomTypeDropdown(false);
    await setBusinessInfo({ customDiscountType: type });
  };

  const handleCustomDiscountMinDaysChange = async (newDays: number) => {
    const clamped = Math.max(0, Math.min(365, newDays));
    setCustomDiscountMinDays(clamped);
    await setBusinessInfo({ customDiscountMinDays: clamped });
  };

  const handleClearCustomDiscount = async () => {
    setShowCustomInput(false);
    setCustomDiscountText('');
    setCustomDiscountType('any');
    setCustomDiscountMinDays(0);
    await setBusinessInfo({
      customDiscount: '',
      customDiscountType: null,
      customDiscountMinDays: 0,
    });
  };

  const getTypeLabel = (type: EndorsementType) => {
    switch (type) {
      case 'any': return 'Any Endorsement';
      case 'top10': return 'Top 10';
      case 'top5': return 'Top 5';
    }
  };

  const renderTierCard = (
    tierNum: number,
    tier: DiscountTier,
    showTypeDropdown: boolean,
    setShowTypeDropdown: (v: boolean) => void,
    onDiscountChange: (v: number) => void,
    onTypeChange: (t: EndorsementType) => void,
    onMinDaysChange: (d: number) => void,
    onMinFollowersChange: (f: number) => void,
    onRemove?: () => void,
    isBaseTier: boolean = false
  ) => (
    <View style={[
      styles.tierCard,
      {
        backgroundColor: colors.background,
        borderColor: colors.border,
        zIndex: showTypeDropdown ? 1000 - tierNum : 1,
        ...(Platform.OS === 'web' ? { overflow: 'visible' } : {}),
      }
    ]}>
      <View style={styles.tierHeader}>
        <Text style={[styles.tierTitle, { color: colors.text }]}>
          {isBaseTier ? 'Base Endorsement Discount' : `Tier ${tierNum}`}
        </Text>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} activeOpacity={0.7}>
            <Trash2 size={18} color={colors.danger || '#EF4444'} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Row 1: Discount Percentage */}
      <View style={styles.tierRowCentered}>
        <Text style={[styles.tierRowLabelCentered, { color: colors.textSecondary }]}>Discount</Text>
        <View style={styles.inlineCounter}>
          <TouchableOpacity
            style={[styles.smallButton, { borderColor: colors.border }]}
            onPress={() => onDiscountChange(tier.discount - 0.5)}
            activeOpacity={0.7}
          >
            <Minus size={16} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <TextInput
            style={[styles.editableCounterInput, { color: colors.primary, borderColor: colors.border }]}
            value={tier.discount.toFixed(1)}
            onChangeText={(text) => {
              const num = parseFloat(text.replace('%', ''));
              if (!isNaN(num)) onDiscountChange(num);
            }}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Text style={[styles.percentSign, { color: colors.primary }]}>%</Text>
          <TouchableOpacity
            style={[styles.smallButton, { borderColor: colors.border }]}
            onPress={() => onDiscountChange(tier.discount + 0.5)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: Type Dropdown */}
      <View style={[styles.tierRowCentered, Platform.OS === 'web' ? { overflow: 'visible', zIndex: showTypeDropdown ? 1000 : 1 } : {}]}>
        <Text style={[styles.tierRowLabelCentered, { color: colors.textSecondary }]}>Type</Text>
        <View style={[styles.dropdownOptionGroup, { zIndex: showTypeDropdown ? 1000 : 1 }]}>
          <TouchableOpacity
            style={[styles.dropdownCentered, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => setShowTypeDropdown(!showTypeDropdown)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, { color: colors.text }]}>
              {getTypeLabel(tier.type)}
            </Text>
            <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          {showTypeDropdown && (
            <View style={[styles.dropdownListCentered, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {(['any', 'top10', 'top5'] as EndorsementType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.border },
                    tier.type === type && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => onTypeChange(type)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    { color: tier.type === type ? '#FFFFFF' : colors.text }
                  ]}>
                    {getTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Row 3: Min Days */}
      <View style={styles.tierRowCentered}>
        <Text style={[styles.tierRowLabelCentered, { color: colors.textSecondary }]}>Min Days</Text>
        <View style={styles.inlineCounter}>
          <TouchableOpacity
            style={[styles.smallButton, { borderColor: colors.border }]}
            onPress={() => onMinDaysChange(tier.minDays - 1)}
            activeOpacity={0.7}
          >
            <Minus size={16} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <TextInput
            style={[styles.editableCounterInput, { color: colors.primary, borderColor: colors.border }]}
            value={String(tier.minDays)}
            onChangeText={(text) => {
              const num = parseInt(text, 10);
              if (!isNaN(num)) onMinDaysChange(num);
            }}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <TouchableOpacity
            style={[styles.smallButton, { borderColor: colors.border }]}
            onPress={() => onMinDaysChange(tier.minDays + 1)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 4: Min Followers */}
      <View style={styles.tierRowCentered}>
        <Text style={[styles.tierRowLabelCentered, { color: colors.textSecondary }]}>Min Followers</Text>
        <View style={styles.inlineCounter}>
          <TouchableOpacity
            style={[styles.smallButton, { borderColor: colors.border }]}
            onPress={() => onMinFollowersChange(tier.minFollowers - 1)}
            activeOpacity={0.7}
          >
            <Minus size={16} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <TextInput
            style={[styles.editableCounterInput, { color: colors.primary, borderColor: colors.border }]}
            value={String(tier.minFollowers)}
            onChangeText={(text) => {
              const num = parseInt(text, 10);
              if (!isNaN(num)) onMinFollowersChange(num);
            }}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <TouchableOpacity
            style={[styles.smallButton, { borderColor: colors.border }]}
            onPress={() => onMinFollowersChange(tier.minFollowers + 1)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <>
      {/* DISCOUNTS SECTION */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Discounts</Text>

        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          {/* Toggle */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Accept Discounts</Text>
            <Switch
              value={acceptsDiscounts}
              onValueChange={handleToggleDiscounts}
              trackColor={{ false: '#D1D5DB', true: '#000000' }}
              thumbColor='#FFFFFF'
              ios_backgroundColor='#E5E7EB'
            />
          </View>

          {/* What You Get box - Only visible when discounts are NOT accepted */}
          {!acceptsDiscounts && (
            <View style={[styles.infoBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                What You Get For Discounts
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                <Text style={styles.underlinedText}>When you accept discounts, you get invaluable insights about what your customers believe.</Text> Find out: ideologies, causes, social issues, interests, celebrity sentiments, religions, etc.
              </Text>
            </View>
          )}

          {acceptsDiscounts && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Info notice */}
              <View style={[styles.noticeBox, { backgroundColor: colors.primary + '10' }]}>
                <Text style={[styles.noticeText, { color: colors.text }]}>
                  All discounts require customers to endorse your business. Set different discount tiers for different endorsement levels.
                </Text>
              </View>

              {/* Tier 1 - Base Endorsement (Always shown) */}
              {renderTierCard(
                1,
                tier1,
                showTier1TypeDropdown,
                setShowTier1TypeDropdown,
                handleTier1DiscountChange,
                handleTier1TypeChange,
                handleTier1MinDaysChange,
                handleTier1MinFollowersChange,
                undefined,
                true
              )}

              {/* Tier 2 */}
              {tier2Enabled ? (
                renderTierCard(
                  2,
                  tier2,
                  showTier2TypeDropdown,
                  setShowTier2TypeDropdown,
                  handleTier2DiscountChange,
                  handleTier2TypeChange,
                  handleTier2MinDaysChange,
                  handleTier2MinFollowersChange,
                  handleDisableTier2
                )
              ) : (
                <TouchableOpacity
                  style={[styles.addTierButton, { borderColor: colors.border }]}
                  onPress={handleEnableTier2}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.addTierText, { color: colors.primary }]}>
                    Add Tier 2 Discount
                  </Text>
                </TouchableOpacity>
              )}

              {/* Tier 3 (only if Tier 2 is enabled) */}
              {tier2Enabled && (
                tier3Enabled ? (
                  renderTierCard(
                    3,
                    tier3,
                    showTier3TypeDropdown,
                    setShowTier3TypeDropdown,
                    handleTier3DiscountChange,
                    handleTier3TypeChange,
                    handleTier3MinDaysChange,
                    handleTier3MinFollowersChange,
                    handleDisableTier3
                  )
                ) : (
                  <TouchableOpacity
                    style={[styles.addTierButton, { borderColor: colors.border }]}
                    onPress={handleEnableTier3}
                    activeOpacity={0.7}
                  >
                    <Plus size={18} color={colors.primary} strokeWidth={2} />
                    <Text style={[styles.addTierText, { color: colors.primary }]}>
                      Add Tier 3 Discount
                    </Text>
                  </TouchableOpacity>
                )
              )}

              {/* iEndorse Fee */}
              <View style={styles.feeRow}>
                <Text style={[styles.feeText, { color: colors.textSecondary }]}>
                  iEndorse Fee: 2.5% Fixed
                </Text>
              </View>

              {/* Custom Discount Section */}
              {showCustomInput ? (
                <View style={[styles.customCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.tierHeader}>
                    <Text style={[styles.tierTitle, { color: colors.text }]}>Custom Discount</Text>
                    <TouchableOpacity onPress={handleClearCustomDiscount} activeOpacity={0.7}>
                      <Trash2 size={18} color={colors.danger || '#EF4444'} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.customLabel, { color: colors.textSecondary }]}>
                    Describe your custom discount (e.g., "Free appetizer", "Buy 1 Get 1")
                  </Text>
                  <TextInput
                    style={[
                      styles.customInput,
                      { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }
                    ]}
                    placeholder="Enter custom discount..."
                    placeholderTextColor={colors.textSecondary}
                    value={customDiscountText}
                    onChangeText={handleCustomDiscountTextChange}
                  />

                  {/* Custom discount type */}
                  <View style={[styles.tierRowCentered, { marginTop: 12 }, Platform.OS === 'web' ? { overflow: 'visible', zIndex: showCustomTypeDropdown ? 1000 : 1 } : {}]}>
                    <Text style={[styles.tierRowLabelCentered, { color: colors.textSecondary }]}>Type</Text>
                    <View style={[styles.dropdownOptionGroup, { zIndex: showCustomTypeDropdown ? 1000 : 1 }]}>
                      <TouchableOpacity
                        style={[styles.dropdownCentered, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        onPress={() => setShowCustomTypeDropdown(!showCustomTypeDropdown)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropdownText, { color: colors.text }]}>
                          {getTypeLabel(customDiscountType)}
                        </Text>
                        <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
                      </TouchableOpacity>
                      {showCustomTypeDropdown && (
                        <View style={[styles.dropdownListCentered, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                          {(['any', 'top10', 'top5'] as EndorsementType[]).map((type) => (
                            <TouchableOpacity
                              key={type}
                              style={[
                                styles.dropdownItem,
                                { borderBottomColor: colors.border },
                                customDiscountType === type && { backgroundColor: colors.primary }
                              ]}
                              onPress={() => handleCustomDiscountTypeChange(type)}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.dropdownItemText,
                                { color: customDiscountType === type ? '#FFFFFF' : colors.text }
                              ]}>
                                {getTypeLabel(type)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Custom discount min days */}
                  <View style={styles.tierRowCentered}>
                    <Text style={[styles.tierRowLabelCentered, { color: colors.textSecondary }]}>Min Days</Text>
                    <View style={styles.inlineCounter}>
                      <TouchableOpacity
                        style={[styles.smallButton, { borderColor: colors.border }]}
                        onPress={() => handleCustomDiscountMinDaysChange(customDiscountMinDays - 1)}
                        activeOpacity={0.7}
                      >
                        <Minus size={16} color={colors.text} strokeWidth={2} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.editableCounterInput, { color: colors.primary, borderColor: colors.border }]}
                        value={String(customDiscountMinDays)}
                        onChangeText={(text) => {
                          const num = parseInt(text, 10);
                          if (!isNaN(num)) handleCustomDiscountMinDaysChange(num);
                        }}
                        keyboardType="number-pad"
                        selectTextOnFocus
                      />
                      <TouchableOpacity
                        style={[styles.smallButton, { borderColor: colors.border }]}
                        onPress={() => handleCustomDiscountMinDaysChange(customDiscountMinDays + 1)}
                        activeOpacity={0.7}
                      >
                        <Plus size={16} color={colors.text} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addTierButton, { borderColor: colors.border }]}
                  onPress={() => setShowCustomInput(true)}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color={colors.primary} strokeWidth={2} />
                  <Text style={[styles.addTierText, { color: colors.primary }]}>
                    Add Custom Discount
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    ...(Platform.OS === 'web' ? { overflow: 'visible' } : {}),
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  underlinedText: {
    textDecorationLine: 'underline',
    fontWeight: '600' as const,
  },
  noticeBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Tier Cards
  tierCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  // Centered single-column layout for tier rows
  tierRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 0,
    flexWrap: 'nowrap',
  },
  tierRowLabelCentered: {
    fontSize: 13,
    fontWeight: '500' as const,
    minWidth: 70,
    flexShrink: 0,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tierRowLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
  },
  tierOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Option Groups
  optionGroup: {
    flex: 1,
  },
  optionGroupType: {
    flex: 0,
    minWidth: 100,
    maxWidth: 110,
  },
  optionGroupRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Counters
  inlineCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  inlineCounterSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smallButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    minWidth: 60,
    textAlign: 'center',
  },
  counterValueSmall: {
    fontSize: 15,
    fontWeight: '700' as const,
    minWidth: 36,
    textAlign: 'center',
  },
  // Editable counter inputs
  editableCounterInput: {
    fontSize: 14,
    fontWeight: '700' as const,
    minWidth: 40,
    maxWidth: 50,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  editableCounterInputSmall: {
    fontSize: 14,
    fontWeight: '700' as const,
    minWidth: 36,
    maxWidth: 44,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 4,
  },
  percentSign: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  // Dropdown
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
  },
  dropdownCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 32,
    minWidth: 100,
    maxWidth: 140,
    flexShrink: 1,
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  dropdownList: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownListCentered: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  // Add Tier Button
  addTierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  addTierText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  // Fee Row
  feeRow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  feeText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  // Custom Discount
  customCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  customLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  customInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  // Dropdown option group for z-index handling
  dropdownOptionGroup: {
    ...(Platform.OS === 'web' ? { overflow: 'visible' } : {}),
    position: 'relative',
  },
});
