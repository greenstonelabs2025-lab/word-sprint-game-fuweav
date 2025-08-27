
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Switch,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../styles/commonStyles';
import * as BillingService from '../billing/BillingService';
import { updatePoints } from '../utils/pointsManager';
import { track } from '../src/analytics/AnalyticsService';

interface StoreScreenProps {
  onExit: () => void;
}

interface PurchaseItem {
  id: string;
  name: string;
  points: number;
  price: string;
  color: string;
  isBest?: boolean;
}

interface ConfirmPurchaseModalProps {
  visible: boolean;
  item: PurchaseItem | null;
  currentPoints: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const purchaseItems: PurchaseItem[] = [
  {
    id: 'points_250',
    name: 'Small Pack',
    points: 250,
    price: '$0.99',
    color: '#9E9E9E',
  },
  {
    id: 'points_600',
    name: 'Best Value',
    points: 600,
    price: '$1.99',
    color: '#4CAF50',
    isBest: true,
  },
  {
    id: 'points_1500',
    name: 'Mega Pack',
    points: 1500,
    price: '$4.99',
    color: '#9C27B0',
  },
];

// Confirmation Modal Component
function ConfirmPurchaseModal({ visible, item, currentPoints, onConfirm, onCancel }: ConfirmPurchaseModalProps) {
  if (!item) return null;
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Confirm Purchase</Text>
          <Text style={styles.modalSubtitle}>{item.name}</Text>
          <Text style={styles.modalPoints}>+{item.points} points</Text>
          <Text style={styles.modalPrice}>{item.price}</Text>
          <Text style={styles.modalCurrentPoints}>Current points: {currentPoints}</Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.modalButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function StoreScreen({ onExit }: StoreScreenProps) {
  const { height } = useWindowDimensions();
  const [points, setPoints] = useState(0);
  const [adFreeMode, setAdFreeMode] = useState(false);
  const [premiumMode, setPremiumMode] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PurchaseItem | null>(null);
  const [inFlight, setInFlight] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load current points
      const progressData = await AsyncStorage.getItem('progress');
      if (progressData) {
        const progress = JSON.parse(progressData);
        setPoints(progress.points || 0);
      }
      
      // Load preferences
      const adFreeValue = await AsyncStorage.getItem('pref_ad_free');
      setAdFreeMode(adFreeValue === 'true');
      
      const premiumValue = await AsyncStorage.getItem('pref_premium');
      setPremiumMode(premiumValue === 'true');
      
      console.log('Store data loaded - Points:', points, 'Ad-free:', adFreeMode, 'Premium:', premiumMode);
    } catch (error) {
      console.error('Error loading store data:', error);
    }
  };

  const mapBillingError = (error: string): string => {
    switch (error) {
      case 'USER_CANCELLED':
        return 'Purchase cancelled';
      case 'NETWORK_ERROR':
      case 'SERVICE_UNAVAILABLE':
        return 'Network error';
      case 'ITEM_ALREADY_OWNED':
        return 'Already owned';
      default:
        return 'Purchase failed';
    }
  };

  const handlePurchase = async (item: PurchaseItem) => {
    if (inFlight) return;
    
    setInFlight(true);
    
    try {
      await BillingService.initBilling();
      
      const res = await BillingService.purchase(item.id);
      
      if (!res.success) {
        const errorMessage = mapBillingError(res.error || 'UNKNOWN_ERROR');
        
        // Track failed purchase
        track("iap_failed", {
          productId: item.id,
          error: res.error || 'UNKNOWN_ERROR',
          price: item.price,
          points: item.points
        });
        
        // Handle special case for already owned items
        if (res.error === 'ITEM_ALREADY_OWNED') {
          if (item.id === 'adfree_unlock') {
            await AsyncStorage.setItem('pref_ad_free', 'true');
            setAdFreeMode(true);
          } else if (item.id === 'premium_monthly') {
            await AsyncStorage.setItem('pref_premium', 'true');
            setPremiumMode(true);
          }
          Alert.alert('Already Owned', 'This item is already owned and has been restored.');
        } else {
          Alert.alert('Purchase Failed', errorMessage);
        }
        
        setInFlight(false);
        return;
      }
      
      await BillingService.acknowledgeOrConsume(item.id, res.receipt);
      
      // Award points or set preferences
      if (item.id.startsWith('points_')) {
        const newPoints = await updatePoints(item.points);
        setPoints(newPoints);
      } else if (item.id === 'adfree_unlock') {
        await AsyncStorage.setItem('pref_ad_free', 'true');
        setAdFreeMode(true);
      } else if (item.id === 'premium_monthly') {
        await AsyncStorage.setItem('pref_premium', 'true');
        setPremiumMode(true);
      }
      
      // Track successful purchase
      track("iap_buy", {
        productId: item.id,
        price: item.price,
        points: item.points || 0,
        newTotalPoints: item.id.startsWith('points_') ? points + item.points : points
      });
      
      Alert.alert('Purchase Successful', 'Purchased');
      console.log(`Purchase completed: ${item.id}`);
      
    } catch (error) {
      console.error('Purchase error:', error);
      
      // Track purchase error
      track("iap_error", {
        productId: item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        price: item.price
      });
      
      Alert.alert('Purchase Failed', 'An error occurred. Please try again.');
    } finally {
      setInFlight(false);
    }
  };

  const restorePurchases = async () => {
    try {
      const ids = await BillingService.getActivePurchases();
      
      if (ids.includes('adfree_unlock')) {
        await AsyncStorage.setItem('pref_ad_free', 'true');
        setAdFreeMode(true);
      }
      
      if (ids.includes('premium_monthly')) {
        await AsyncStorage.setItem('pref_premium', 'true');
        setPremiumMode(true);
      }
      
      // Track restore action
      track("iap_restore", {
        restoredItems: ids,
        count: ids.length
      });
      
      Alert.alert('Restore Complete', 'Restored');
      console.log('Purchases restored:', ids);
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert('Error', 'Failed to restore purchases.');
    }
  };

  const toggleAdFree = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('pref_ad_free', value.toString());
      setAdFreeMode(value);
      
      // Track preference change
      track("pref_change", {
        key: "ad_free",
        value: value
      });
      
      console.log('Ad-free mode toggled:', value);
    } catch (error) {
      console.error('Error toggling ad-free mode:', error);
    }
  };

  const renderPurchaseRow = (item: PurchaseItem) => (
    <Pressable
      key={item.id}
      style={[
        styles.purchaseRow, 
        { borderLeftColor: item.color },
        inFlight && styles.disabledRow
      ]}
      onPress={() => handlePurchase(item)}
      disabled={inFlight}
    >
      <View style={styles.purchaseLeft}>
        <View style={styles.purchaseHeader}>
          <Text style={styles.purchaseName}>{item.name}</Text>
          {item.isBest && (
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>Best</Text>
            </View>
          )}
        </View>
        <Text style={styles.purchasePrice}>{item.price}</Text>
      </View>
      
      <View style={[styles.pointsPill, { backgroundColor: item.color }]}>
        <Text style={styles.pointsPillText}>
          {inFlight ? 'Processing...' : `+${item.points}`}
        </Text>
      </View>
    </Pressable>
  );

  const renderToggleRow = (title: string, description: string, value: boolean, onToggle: (value: boolean) => void, disabled = false) => (
    <View style={[styles.toggleRow, disabled && styles.disabledToggleRow]}>
      <View style={styles.toggleLeft}>
        <Text style={[styles.toggleTitle, disabled && styles.disabledText]}>{title}</Text>
        <Text style={[styles.toggleDescription, disabled && styles.disabledText]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#767577', true: colors.accent }}
        thumbColor={value ? colors.primary : '#f4f3f4'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onExit}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Store</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Wallet Card */}
        <View style={styles.walletCard}>
          <Text style={styles.walletTitle}>Your Wallet</Text>
          <Text style={styles.walletPoints}>Points: {points.toLocaleString()}</Text>
        </View>

        {/* Purchase Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Point Packs</Text>
          {purchaseItems.map(renderPurchaseRow)}
        </View>

        {/* Ad-Free Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {renderToggleRow(
            'Ad-Free Mode',
            'Removes banner and upsell hints. Gameplay unchanged.',
            adFreeMode,
            toggleAdFree
          )}
        </View>

        {/* Premium Perks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Perks</Text>
          {renderToggleRow(
            'Premium Monthly',
            'Premium features and benefits.',
            premiumMode,
            () => {},
            true
          )}
          {renderToggleRow(
            'Unlimited Hints',
            'Use hints without spending points.',
            false,
            () => {},
            true
          )}
          {renderToggleRow(
            'Daily Boosts',
            'Extra rewards in Daily Challenge.',
            false,
            () => {},
            true
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
            <Text style={styles.restoreButtonText}>Restore purchases</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey + '20',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  walletCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletTitle: {
    fontSize: 16,
    color: colors.grey,
    marginBottom: 8,
  },
  walletPoints: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  purchaseRow: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledRow: {
    opacity: 0.6,
  },
  purchaseLeft: {
    flex: 1,
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  purchaseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  bestBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  bestBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  purchasePrice: {
    fontSize: 14,
    color: colors.grey,
  },
  pointsPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsPillText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  toggleRow: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disabledToggleRow: {
    opacity: 0.5,
  },
  toggleLeft: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
    color: colors.grey,
    lineHeight: 18,
  },
  disabledText: {
    color: colors.grey + '80',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  restoreButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  restoreButtonText: {
    fontSize: 14,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.grey,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalPoints: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalPrice: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  modalCurrentPoints: {
    fontSize: 14,
    color: colors.grey,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.grey + '40',
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});

// Export the updatePoints function for backward compatibility
export { updatePoints } from '../utils/pointsManager';
