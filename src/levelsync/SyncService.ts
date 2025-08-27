
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
  challenges: Array<{
    name: string;
    words: string[];
    version: number;
    active_from?: string;
    active_to?: string;
  }>;
}

interface PendingAction {
  intent: 'save' | 'delete';
  theme: string;
  words?: string[];
  kind?: 'Stage' | 'Challenge';
  active_from?: string;
  active_to?: string;
  timestamp: string;
}

interface WordSet {
  id: string;
  theme: string;
  words: string[];
  version: number;
  updated_at: string;
  kind: 'Stage' | 'Challenge';
  active_from?: string;
  active_to?: string;
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
  active_from?: string;
  active_to?: string;
}

// Initialize empty cache if none exists
export async function initializeCache(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(WS_CACHE_KEY);
    if (!existing) {
      const emptyCache: WordSetCache = {
        themes: [],
        bank: {},
        versions: {},
        challenges: []
      };
      await AsyncStorage.setItem(WS_CACHE_KEY, JSON.stringify(emptyCache));
      console.log('Initialized empty word sets cache');
    } else {
      // Migrate existing cache to include challenges array if missing
      const cache = JSON.parse(existing);
      if (!cache.challenges) {
        cache.challenges = [];
        await AsyncStorage.setItem(WS_CACHE_KEY, JSON.stringify(cache));
        console.log('Migrated cache to include challenges array');
      }
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
      const cache = JSON.parse(cached);
      // Ensure challenges array exists for backward compatibility
      if (!cache.challenges) {
        cache.challenges = [];
      }
      return cache;
    }
  } catch (error) {
    console.error('Failed to load cache:', error);
  }
  
  // Return empty cache if loading fails
  return {
    themes: [],
    bank: {},
    versions: {},
    challenges: []
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

    // Reset challenges array
    cache.challenges = [];

    // Process each word set
    for (const wordSet of wordSets) {
      if (wordSet.kind === 'Stage') {
        // Handle Stage word sets (existing logic)
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
          console.log(`Updated stage ${wordSet.theme} to version ${wordSet.version}`);
        }
      } else if (wordSet.kind === 'Challenge') {
        // Handle Challenge word sets
        cache.challenges.push({
          name: wordSet.theme,
          words: wordSet.words,
          version: wordSet.version,
          active_from: wordSet.active_from,
          active_to: wordSet.active_to
        });
        hasUpdates = true;
        console.log(`Added challenge ${wordSet.theme} to cache`);
      }
    }

    // Remove stage themes that no longer exist in database
    const dbStageThemes = wordSets.filter(ws => ws.kind === 'Stage').map(ws => ws.theme);
    cache.themes = cache.themes.filter(theme => {
      if (dbStageThemes.includes(theme)) {
        return true;
      } else {
        // Remove from bank and versions too
        delete cache.bank[theme];
        delete cache.versions[theme];
        hasUpdates = true;
        console.log(`Removed deleted stage theme: ${theme}`);
        return false;
      }
    });

    if (hasUpdates) {
      await saveCache(cache);
      console.log('Cache updated with new word sets and challenges');
    }

    // Update last sync timestamp
    await AsyncStorage.setItem(WS_LAST_SYNC_KEY, new Date().toISOString());
    console.log('Sync completed successfully');

  } catch (error) {
    console.error('Sync failed - keeping cache unchanged:', error);
  }
}

// Save theme (upsert) - updated to support both Stage and Challenge
export async function saveTheme(
  theme: string, 
  words: string[], 
  kind: 'Stage' | 'Challenge' = 'Stage',
  active_from?: string,
  active_to?: string
): Promise<void> {
  console.log(`Saving ${kind.toLowerCase()}: ${theme}`);
  
  try {
    // Get current version for this theme
    const cache = await getCache();
    let currentVersion = 0;
    
    if (kind === 'Stage') {
      currentVersion = cache.versions[theme] || 0;
    } else {
      // For challenges, find existing version
      const existingChallenge = cache.challenges.find(c => c.name === theme);
      currentVersion = existingChallenge?.version || 0;
    }
    
    const newVersion = currentVersion + 1;

    // Prepare the payload
    const payload: any = {
      theme,
      words,
      kind,
      version: newVersion,
      updated_at: new Date().toISOString()
    };

    // Add date fields for challenges
    if (kind === 'Challenge') {
      payload.active_from = active_from;
      payload.active_to = active_to;
    }

    // Try to upsert to Supabase
    const { error } = await supabase
      .from('word_sets')
      .upsert(payload);

    if (error) {
      console.error('Failed to save to Supabase:', error);
      
      // Queue for later if offline
      await queuePendingAction({
        intent: 'save',
        theme,
        words,
        kind,
        active_from,
        active_to,
        timestamp: new Date().toISOString()
      });
      
      Alert.alert('Offline', 'Changes saved locally and will sync when online.');
      return;
    }

    // Update cache immediately on success
    if (kind === 'Stage') {
      cache.bank[theme] = words;
      cache.versions[theme] = newVersion;
      
      if (!cache.themes.includes(theme)) {
        cache.themes.push(theme);
      }
    } else {
      // Update or add challenge in cache
      const existingIndex = cache.challenges.findIndex(c => c.name === theme);
      const challengeData = {
        name: theme,
        words,
        version: newVersion,
        active_from,
        active_to
      };
      
      if (existingIndex >= 0) {
        cache.challenges[existingIndex] = challengeData;
      } else {
        cache.challenges.push(challengeData);
      }
    }
    
    await saveCache(cache);
    
    Alert.alert('Success', `Saved ${theme} v${newVersion}`);
    console.log(`Successfully saved ${kind.toLowerCase()} ${theme} v${newVersion}`);

  } catch (error) {
    console.error('Save failed:', error);
    Alert.alert('Error', `Failed to save ${kind.toLowerCase()}`);
  }
}

// Delete theme - updated to support both Stage and Challenge
export async function deleteTheme(theme: string, kind: 'Stage' | 'Challenge'): Promise<void> {
  console.log(`Deleting ${kind.toLowerCase()}: ${theme}`);
  
  try {
    // Try to delete from Supabase
    const { error } = await supabase
      .from('word_sets')
      .delete()
      .eq('theme', theme)
      .eq('kind', kind);

    if (error) {
      console.error('Failed to delete from Supabase:', error);
      
      // Queue for later if offline
      await queuePendingAction({
        intent: 'delete',
        theme,
        kind,
        timestamp: new Date().toISOString()
      });
      
      Alert.alert('Offline', 'Deletion queued and will sync when online.');
      return;
    }

    // Update cache immediately on success
    const cache = await getCache();
    
    if (kind === 'Stage') {
      cache.themes = cache.themes.filter(t => t !== theme);
      delete cache.bank[theme];
      delete cache.versions[theme];
    } else {
      cache.challenges = cache.challenges.filter(c => c.name !== theme);
    }
    
    await saveCache(cache);
    
    Alert.alert('Success', `Deleted ${kind.toLowerCase()} ${theme}`);
    console.log(`Successfully deleted ${kind.toLowerCase()} ${theme}`);

  } catch (error) {
    console.error('Delete failed:', error);
    Alert.alert('Error', `Failed to delete ${kind.toLowerCase()}`);
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
          let currentVersion = 0;
          
          if (action.kind === 'Stage') {
            currentVersion = cache.versions[action.theme] || 0;
          } else {
            const existingChallenge = cache.challenges.find(c => c.name === action.theme);
            currentVersion = existingChallenge?.version || 0;
          }
          
          const newVersion = currentVersion + 1;

          const payload: any = {
            theme: action.theme,
            words: action.words,
            kind: action.kind || 'Stage',
            version: newVersion,
            updated_at: new Date().toISOString()
          };

          if (action.kind === 'Challenge') {
            payload.active_from = action.active_from;
            payload.active_to = action.active_to;
          }

          const { error } = await supabase
            .from('word_sets')
            .upsert(payload);

          if (!error) {
            successfulActions.push(i);
            console.log(`Flushed save for ${action.kind || 'Stage'} ${action.theme}`);
          }
        } else if (action.intent === 'delete') {
          const { error } = await supabase
            .from('word_sets')
            .delete()
            .eq('theme', action.theme)
            .eq('kind', action.kind || 'Stage');

          if (!error) {
            successfulActions.push(i);
            console.log(`Flushed delete for ${action.kind || 'Stage'} ${action.theme}`);
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

// Get challenges from unified cache
export async function getChallengesCache(): Promise<ChallengeCache[]> {
  const cache = await getCache();
  return cache.challenges || [];
}
