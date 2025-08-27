
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Clear stale cache data to ensure the app uses the new themes/wordBank
 * This should be called once after updating the wordBank.ts file
 */
export const clearStaleCache = async (): Promise<void> => {
  try {
    console.log('Clearing stale cache...');
    
    // List of cache keys to clear
    const keysToRemove = [
      'progress',      // Game progress (stage/level/points)
      'ws_cache',      // Word sets cache
      'ws_last_sync',  // Last sync timestamp
    ];
    
    // Remove all specified keys
    await AsyncStorage.multiRemove(keysToRemove);
    
    console.log('Stale cache cleared successfully');
    console.log('Removed keys:', keysToRemove);
    
    // Optionally, you can also clear all AsyncStorage data with:
    // await AsyncStorage.clear();
    
  } catch (error) {
    console.error('Error clearing stale cache:', error);
    throw error;
  }
};

/**
 * Reset game progress to start fresh with new themes
 */
export const resetGameProgress = async (): Promise<void> => {
  try {
    console.log('Resetting game progress...');
    
    await AsyncStorage.removeItem('progress');
    
    console.log('Game progress reset successfully');
  } catch (error) {
    console.error('Error resetting game progress:', error);
    throw error;
  }
};

/**
 * Clear all word sets cache data
 */
export const clearWordSetsCache = async (): Promise<void> => {
  try {
    console.log('Clearing word sets cache...');
    
    const cacheKeys = [
      'ws_cache',
      'ws_last_sync',
      'ws_pending',
      'ws_challenges',
      'ws_challenges_sync',
    ];
    
    await AsyncStorage.multiRemove(cacheKeys);
    
    console.log('Word sets cache cleared successfully');
  } catch (error) {
    console.error('Error clearing word sets cache:', error);
    throw error;
  }
};
