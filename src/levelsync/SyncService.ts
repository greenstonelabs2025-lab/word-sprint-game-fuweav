
import { supabase } from '../../app/integrations/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// AsyncStorage keys
const WS_CACHE_KEY = 'ws_cache';
const WS_LAST_SYNC_KEY = 'ws_last_sync';
const WS_PENDING_KEY = 'ws_pending';
const WS_CHALLENGES_KEY = 'ws_challenges';
const WS_CHALLENGES_SYNC_KEY = 'ws_challenges_last_sync';

interface WordSetCache {
  themes: string[];
  bank: { [theme: string]: string[] };
  versions: { [theme: string]: number };
}

interface PendingAction {
  intent: 'save' | 'delete';
  theme: string;
  words?: string[];
  timestamp: string;
}

interface WordSet {
  id: string;
  theme: string;
  words: string[];
  version: number;
  updated_at: string;
}

interface Challenge {
  id: string;
  name: string;
  words: string[];
  active_from: string;
  active_to: string;
  version: number;
  updated_at: string;
}

interface ChallengeCache {
  name: string;
  words: string[];
  version: number;
}

// Initialize empty cache if none exists
export async function initializeCache(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(WS_CACHE_KEY);
    if (!existing) {
      const emptyCache: WordSetCache = {
        themes: [],
        bank: {},
        versions: {}
      };
      await AsyncStorage.setItem(WS_CACHE_KEY, JSON.stringify(emptyCache));
      console.log('Initialized empty word sets cache');
    }
    
    // Initialize challenges cache if it doesn't exist
    const challengesExisting = await AsyncStorage.getItem(WS_CHALLENGES_KEY);
    if (!challengesExisting) {
      await AsyncStorage.setItem(WS_CHALLENGES_KEY, JSON.stringify([]));
      console.log('Initialized empty challenges cache');
    }
  } catch (error) {
    console.error('Failed to initialize cache:', error);
  }
}

// Get current cache
export async function getCache(): Promise<WordSetCache> {
  try {
    const cached = await AsyncStorage.getItem(WS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Failed to load cache:', error);
  }
  
  // Return empty cache if loading fails
  return {
    themes: [],
    bank: {},
    versions: {}
  };
}

// Save cache
async function saveCache(cache: WordSetCache): Promise<void> {
  try {
    await AsyncStorage.setItem(WS_CACHE_KEY, JSON.stringify(cache));
    console.log('Cache saved successfully');
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
}

// Main sync function
export async function syncWordSets(): Promise<void> {
  console.log('Starting word sets sync...');
  
  try {
    // First, flush any pending actions
    await flushPendingActions();
    
    // Fetch all word sets from Supabase
    const { data: wordSets, error } = await supabase
      .from('word_sets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch word sets:', error);
      return; // Keep cache unchanged on error
    }

    if (!wordSets) {
      console.log('No word sets found in database');
      return;
    }

    // Get current cache
    const cache = await getCache();
    let hasUpdates = false;

    // Process each word set
    for (const wordSet of wordSets) {
      const currentVersion = cache.versions[wordSet.theme] || 0;
      
      if (wordSet.version > currentVersion) {
        // Update cache with newer version
        cache.bank[wordSet.theme] = wordSet.words;
        cache.versions[wordSet.theme] = wordSet.version;
        
        // Add to themes list if not present
        if (!cache.themes.includes(wordSet.theme)) {
          cache.themes.push(wordSet.theme);
        }
        
        hasUpdates = true;
        console.log(`Updated ${wordSet.theme} to version ${wordSet.version}`);
      }
    }

    // Remove themes that no longer exist in database
    const dbThemes = wordSets.map(ws => ws.theme);
    cache.themes = cache.themes.filter(theme => {
      if (dbThemes.includes(theme)) {
        return true;
      } else {
        // Remove from bank and versions too
        delete cache.bank[theme];
        delete cache.versions[theme];
        hasUpdates = true;
        console.log(`Removed deleted theme: ${theme}`);
        return false;
      }
    });

    if (hasUpdates) {
      await saveCache(cache);
      console.log('Cache updated with new word sets');
    }

    // Update last sync timestamp
    await AsyncStorage.setItem(WS_LAST_SYNC_KEY, new Date().toISOString());
    console.log('Sync completed successfully');

  } catch (error) {
    console.error('Sync failed - keeping cache unchanged:', error);
  }
}

// Save theme (upsert)
export async function saveTheme(theme: string, words: string[]): Promise<void> {
  console.log(`Saving theme: ${theme}`);
  
  try {
    // Get current version for this theme
    const cache = await getCache();
    const currentVersion = cache.versions[theme] || 0;
    const newVersion = currentVersion + 1;

    // Try to upsert to Supabase
    const { error } = await supabase
      .from('word_sets')
      .upsert({
        theme,
        words,
        version: newVersion,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to save to Supabase:', error);
      
      // Queue for later if offline
      await queuePendingAction({
        intent: 'save',
        theme,
        words,
        timestamp: new Date().toISOString()
      });
      
      Alert.alert('Offline', 'Changes saved locally and will sync when online.');
      return;
    }

    // Update cache immediately on success
    cache.bank[theme] = words;
    cache.versions[theme] = newVersion;
    
    if (!cache.themes.includes(theme)) {
      cache.themes.push(theme);
    }
    
    await saveCache(cache);
    
    Alert.alert('Success', `Saved ${theme} v${newVersion}`);
    console.log(`Successfully saved ${theme} v${newVersion}`);

  } catch (error) {
    console.error('Save failed:', error);
    Alert.alert('Error', 'Failed to save theme');
  }
}

// Delete theme
export async function deleteTheme(theme: string): Promise<void> {
  console.log(`Deleting theme: ${theme}`);
  
  try {
    // Try to delete from Supabase
    const { error } = await supabase
      .from('word_sets')
      .delete()
      .eq('theme', theme);

    if (error) {
      console.error('Failed to delete from Supabase:', error);
      
      // Queue for later if offline
      await queuePendingAction({
        intent: 'delete',
        theme,
        timestamp: new Date().toISOString()
      });
      
      Alert.alert('Offline', 'Deletion queued and will sync when online.');
      return;
    }

    // Update cache immediately on success
    const cache = await getCache();
    cache.themes = cache.themes.filter(t => t !== theme);
    delete cache.bank[theme];
    delete cache.versions[theme];
    
    await saveCache(cache);
    
    Alert.alert('Success', `Deleted ${theme}`);
    console.log(`Successfully deleted ${theme}`);

  } catch (error) {
    console.error('Delete failed:', error);
    Alert.alert('Error', 'Failed to delete theme');
  }
}

// Queue pending action for offline handling
async function queuePendingAction(action: PendingAction): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(WS_PENDING_KEY);
    const pending: PendingAction[] = existing ? JSON.parse(existing) : [];
    
    pending.push(action);
    
    await AsyncStorage.setItem(WS_PENDING_KEY, JSON.stringify(pending));
    console.log('Queued pending action:', action.intent, action.theme);
  } catch (error) {
    console.error('Failed to queue pending action:', error);
  }
}

// Flush pending actions
async function flushPendingActions(): Promise<void> {
  try {
    const pending = await AsyncStorage.getItem(WS_PENDING_KEY);
    if (!pending) return;

    const actions: PendingAction[] = JSON.parse(pending);
    if (actions.length === 0) return;

    console.log(`Flushing ${actions.length} pending actions...`);

    const successfulActions: number[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      try {
        if (action.intent === 'save' && action.words) {
          const cache = await getCache();
          const currentVersion = cache.versions[action.theme] || 0;
          const newVersion = currentVersion + 1;

          const { error } = await supabase
            .from('word_sets')
            .upsert({
              theme: action.theme,
              words: action.words,
              version: newVersion,
              updated_at: new Date().toISOString()
            });

          if (!error) {
            successfulActions.push(i);
            console.log(`Flushed save for ${action.theme}`);
          }
        } else if (action.intent === 'delete') {
          const { error } = await supabase
            .from('word_sets')
            .delete()
            .eq('theme', action.theme);

          if (!error) {
            successfulActions.push(i);
            console.log(`Flushed delete for ${action.theme}`);
          }
        }
      } catch (error) {
        console.error(`Failed to flush action for ${action.theme}:`, error);
      }
    }

    // Remove successful actions from queue
    if (successfulActions.length > 0) {
      const remainingActions = actions.filter((_, index) => !successfulActions.includes(index));
      await AsyncStorage.setItem(WS_PENDING_KEY, JSON.stringify(remainingActions));
      console.log(`Flushed ${successfulActions.length} actions, ${remainingActions.length} remaining`);
    }

  } catch (error) {
    console.error('Failed to flush pending actions:', error);
  }
}

// Get last sync time
export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(WS_LAST_SYNC_KEY);
  } catch (error) {
    console.error('Failed to get last sync time:', error);
    return null;
  }
}

// Check if cache is empty
export async function isCacheEmpty(): Promise<boolean> {
  const cache = await getCache();
  return cache.themes.length === 0;
}

// Get challenges cache
export async function getChallengesCache(): Promise<ChallengeCache[]> {
  try {
    const cached = await AsyncStorage.getItem(WS_CHALLENGES_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Failed to load challenges cache:', error);
  }
  
  return [];
}

// Save challenges cache
async function saveChallengesCache(challenges: ChallengeCache[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WS_CHALLENGES_KEY, JSON.stringify(challenges));
    console.log('Challenges cache saved successfully');
  } catch (error) {
    console.error('Failed to save challenges cache:', error);
  }
}

// Sync challenges from Supabase
export async function syncChallenges(): Promise<void> {
  console.log('Starting challenges sync...');
  
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    console.log('Fetching challenges active on:', today);
    
    // Fetch active challenges from Supabase
    // Get challenges where today is between active_from and active_to
    const { data: challenges, error } = await supabase
      .from('seasonal_challenges')
      .select('*')
      .filter('active_from', 'lte', today)
      .filter('active_to', 'gte', today)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch challenges:', error);
      return; // Keep cache unchanged on error
    }

    if (!challenges) {
      console.log('No active challenges found');
      await saveChallengesCache([]);
      return;
    }

    // Convert to cache format
    const challengeCache: ChallengeCache[] = challenges.map(challenge => ({
      name: challenge.name,
      words: challenge.words,
      version: challenge.version
    }));

    await saveChallengesCache(challengeCache);
    
    // Update last sync timestamp
    await AsyncStorage.setItem(WS_CHALLENGES_SYNC_KEY, new Date().toISOString());
    console.log(`Synced ${challengeCache.length} active challenges`);

  } catch (error) {
    console.error('Challenges sync failed - keeping cache unchanged:', error);
  }
}

// Save challenge (admin function)
export async function saveChallenge(name: string, words: string[], activeFrom: string, activeTo: string): Promise<void> {
  console.log(`Saving challenge: ${name}`);
  
  try {
    // Insert new challenge to Supabase
    const { error } = await supabase
      .from('seasonal_challenges')
      .insert({
        name,
        words,
        active_from: activeFrom,
        active_to: activeTo,
        version: 1,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to save challenge to Supabase:', error);
      Alert.alert('Error', 'Failed to save challenge');
      return;
    }

    // Sync challenges immediately to update cache
    await syncChallenges();
    
    Alert.alert('Success', `Challenge "${name}" saved successfully`);
    console.log(`Successfully saved challenge: ${name}`);

  } catch (error) {
    console.error('Save challenge failed:', error);
    Alert.alert('Error', 'Failed to save challenge');
  }
}
