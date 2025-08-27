
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded Supabase Storage URL for menu background
const MENU_BG_URL = "https://jocffwplyqupgylasozz.supabase.co/storage/v1/object/public/Pictures/ChatGPT%20Image%20Aug%2027,%202025,%2008_11_26%20PM.png";
const MENU_BG_CACHE_KEY = "menu_bg_url";

/**
 * Get the cached menu background URL
 * @returns Promise<string> - Returns cached URL or empty string if not found
 */
export async function getCachedMenuBg(): Promise<string> {
  try {
    const cachedUrl = await AsyncStorage.getItem(MENU_BG_CACHE_KEY);
    console.log('ConfigService: Retrieved cached menu bg URL:', cachedUrl || 'none');
    return cachedUrl || "";
  } catch (error) {
    console.error('ConfigService: Error getting cached menu bg:', error);
    return "";
  }
}

/**
 * Refresh the menu background URL from Supabase and cache it
 * @returns Promise<string> - Returns the fresh URL or empty string if failed
 */
export async function refreshMenuBg(): Promise<string> {
  try {
    console.log('ConfigService: Refreshing menu bg URL from Supabase...');
    
    // For Option A, we just use the hardcoded URL and cache it
    // In the future, this could be enhanced to fetch from a config table
    const freshUrl = MENU_BG_URL;
    
    // Test if the URL is accessible by making a HEAD request
    try {
      const response = await fetch(freshUrl, { method: 'HEAD' });
      if (response.ok) {
        // URL is accessible, cache it
        await AsyncStorage.setItem(MENU_BG_CACHE_KEY, freshUrl);
        console.log('ConfigService: Successfully refreshed and cached menu bg URL:', freshUrl);
        return freshUrl;
      } else {
        console.warn('ConfigService: Menu bg URL not accessible, status:', response.status);
        // Keep old cache if fetch fails
        return await getCachedMenuBg();
      }
    } catch (fetchError) {
      console.warn('ConfigService: Network error fetching menu bg, keeping old cache:', fetchError);
      // Keep old cache if fetch fails
      return await getCachedMenuBg();
    }
  } catch (error) {
    console.error('ConfigService: Error refreshing menu bg:', error);
    // Keep old cache if refresh fails
    return await getCachedMenuBg();
  }
}
