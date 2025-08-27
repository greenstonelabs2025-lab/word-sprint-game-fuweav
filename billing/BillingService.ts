
import * as RNIap from 'react-native-iap';

const USE_REAL_BILLING = false;

const PRODUCTS = ["points_250", "points_600", "points_1500", "adfree_unlock"];
const SUBSCRIPTIONS = ["premium_monthly"];

export async function initBilling(): Promise<void> {
  if (USE_REAL_BILLING) {
    try {
      await RNIap.initConnection();
      await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
      console.log('Real billing initialized');
    } catch (error) {
      console.error('Failed to initialize billing:', error);
      throw error;
    }
  } else {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Mock billing initialized');
  }
}

export async function purchase(productId: string): Promise<{ success: boolean; receipt?: any; error?: string }> {
  if (USE_REAL_BILLING) {
    try {
      let result;
      if (SUBSCRIPTIONS.includes(productId)) {
        result = await RNIap.requestSubscription(productId);
      } else {
        result = await RNIap.requestPurchase(productId);
      }
      
      return {
        success: true,
        receipt: result
      };
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      let errorCode = 'UNKNOWN_ERROR';
      if (error.code) {
        errorCode = error.code;
      } else if (error.message) {
        if (error.message.includes('cancelled') || error.message.includes('canceled')) {
          errorCode = 'USER_CANCELLED';
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          errorCode = 'NETWORK_ERROR';
        } else if (error.message.includes('already owned') || error.message.includes('already purchased')) {
          errorCode = 'ITEM_ALREADY_OWNED';
        }
      }
      
      return {
        success: false,
        error: errorCode
      };
    }
  } else {
    // Mock implementation
    console.log(`Mock purchase initiated for: ${productId}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const random = Math.random();
    if (random < 0.05) {
      return { success: false, error: 'USER_CANCELLED' };
    } else if (random < 0.1) {
      return { success: false, error: 'NETWORK_ERROR' };
    } else if (random < 0.15 && (productId === 'adfree_unlock' || productId === 'premium_monthly')) {
      return { success: false, error: 'ITEM_ALREADY_OWNED' };
    }
    
    return {
      success: true,
      receipt: {
        transactionId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        purchaseTime: Date.now(),
        purchaseState: 1
      }
    };
  }
}

export async function acknowledgeOrConsume(productId: string, receipt: any): Promise<void> {
  if (USE_REAL_BILLING) {
    try {
      const isConsumable = productId.startsWith('points_');
      await RNIap.finishTransaction(receipt);
      
      if (isConsumable && receipt.purchaseToken) {
        await RNIap.consumePurchaseAndroid(receipt.purchaseToken);
      }
      
      console.log(`Real acknowledge/consume completed for: ${productId}`);
    } catch (error) {
      console.error('Failed to acknowledge/consume:', error);
      throw error;
    }
  } else {
    // Mock implementation
    console.log(`Mock acknowledge/consume for: ${productId}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

export async function getActivePurchases(): Promise<string[]> {
  if (USE_REAL_BILLING) {
    try {
      const purchases = await RNIap.getAvailablePurchases();
      return purchases.map(purchase => purchase.productId);
    } catch (error) {
      console.error('Failed to get active purchases:', error);
      return [];
    }
  } else {
    // Mock implementation
    console.log('Getting active purchases (mock)');
    await new Promise(resolve => setTimeout(resolve, 300));
    return [];
  }
}
