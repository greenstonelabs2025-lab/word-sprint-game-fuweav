
// Mock billing service for Google Play purchases
// When USE_REAL_BILLING is true, replace internals with react-native-iap

export const USE_REAL_BILLING = false;

// Product IDs - use exactly these in Google Play Console
export const PRODUCT_IDS = {
  POINTS_250: 'points_250',
  POINTS_600: 'points_600', 
  POINTS_1500: 'points_1500',
  ADFREE_UNLOCK: 'adfree_unlock',
  PREMIUM_MONTHLY: 'premium_monthly',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

export interface PurchaseResult {
  success: boolean;
  receipt?: any;
  error?: string;
}

// Mock active purchases for testing
let mockActivePurchases: string[] = [];

/**
 * Initialize billing connection
 * Mock: Returns immediately
 * Real: Will call RNIap.initConnection()
 */
export const initBilling = async (): Promise<void> => {
  if (USE_REAL_BILLING) {
    // TODO: Replace with RNIap.initConnection()
    throw new Error('Real billing not implemented yet');
  }
  
  // Mock implementation - simulate initialization delay
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('Billing initialized (mock)');
};

/**
 * Purchase a product
 * Mock: Returns success immediately with mock receipt
 * Real: Will call RNIap.requestPurchase() or requestSubscription()
 */
export const purchase = async (productId: string): Promise<PurchaseResult> => {
  if (USE_REAL_BILLING) {
    // TODO: Replace with real implementation
    // if (productId === PRODUCT_IDS.PREMIUM_MONTHLY) {
    //   return await RNIap.requestSubscription(productId);
    // } else {
    //   return await RNIap.requestPurchase(productId);
    // }
    throw new Error('Real billing not implemented yet');
  }
  
  // Mock implementation
  console.log(`Mock purchase initiated for: ${productId}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simulate different outcomes for testing
  const random = Math.random();
  
  if (random < 0.05) {
    // 5% chance of user cancellation
    return {
      success: false,
      error: 'USER_CANCELLED'
    };
  } else if (random < 0.1) {
    // 5% chance of network error
    return {
      success: false,
      error: 'NETWORK_ERROR'
    };
  } else if (random < 0.15 && (productId === PRODUCT_IDS.ADFREE_UNLOCK || productId === PRODUCT_IDS.PREMIUM_MONTHLY)) {
    // 5% chance of already owned for non-consumables
    return {
      success: false,
      error: 'ITEM_ALREADY_OWNED'
    };
  }
  
  // Success case
  const mockReceipt = {
    transactionId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    productId,
    purchaseTime: Date.now(),
    purchaseState: 1, // Purchased
  };
  
  console.log(`Mock purchase successful for: ${productId}`, mockReceipt);
  
  return {
    success: true,
    receipt: mockReceipt
  };
};

/**
 * Acknowledge or consume a purchase
 * Mock: Adds to mock active purchases if non-consumable
 * Real: Will call RNIap.finishTransaction() and consumePurchaseAndroid() for consumables
 */
export const acknowledgeOrConsume = async (productId: string, receipt: any): Promise<void> => {
  if (USE_REAL_BILLING) {
    // TODO: Replace with real implementation
    // const isConsumable = productId.startsWith('points_');
    // await RNIap.finishTransaction(receipt);
    // if (isConsumable) {
    //   await RNIap.consumePurchaseAndroid(receipt.purchaseToken);
    // }
    throw new Error('Real billing not implemented yet');
  }
  
  // Mock implementation
  console.log(`Mock acknowledge/consume for: ${productId}`);
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // For non-consumables, add to active purchases
  const isConsumable = productId.startsWith('points_');
  if (!isConsumable && !mockActivePurchases.includes(productId)) {
    mockActivePurchases.push(productId);
    console.log(`Added ${productId} to active purchases`);
  }
  
  console.log(`Mock acknowledge/consume completed for: ${productId}`);
};

/**
 * Get active purchases (non-consumables and active subscriptions)
 * Mock: Returns mock active purchases
 * Real: Will call RNIap.getAvailablePurchases() and map to productIds
 */
export const getActivePurchases = async (): Promise<string[]> => {
  if (USE_REAL_BILLING) {
    // TODO: Replace with real implementation
    // const purchases = await RNIap.getAvailablePurchases();
    // return purchases.map(p => p.productId);
    throw new Error('Real billing not implemented yet');
  }
  
  // Mock implementation
  console.log('Getting active purchases (mock)');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log('Mock active purchases:', mockActivePurchases);
  return [...mockActivePurchases];
};

/**
 * Verify receipt with server (stub for now)
 * Later: Implement Supabase Edge Function calling Google Play Developer API
 */
export const verifyReceiptWithServer = async (receipt: any): Promise<boolean> => {
  console.log('Mock receipt verification (always returns true)');
  
  // Simulate server call delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Always return true for now
  return true;
};

/**
 * Map billing errors to user-friendly messages
 */
export const mapBillingError = (error: string): string => {
  switch (error) {
    case 'USER_CANCELLED':
      return 'Purchase cancelled';
    case 'ITEM_ALREADY_OWNED':
      return 'Item already owned';
    case 'NETWORK_ERROR':
      return 'Check connection and try again';
    default:
      return 'Purchase failed. Please try again.';
  }
};

/**
 * Reset mock data (for testing only)
 */
export const resetMockData = (): void => {
  if (!USE_REAL_BILLING) {
    mockActivePurchases = [];
    console.log('Mock billing data reset');
  }
};
