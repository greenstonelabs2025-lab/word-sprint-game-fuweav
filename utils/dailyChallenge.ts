
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wordBank, themes } from '../wordBank';

// Generate daily word based on date
export const generateDailyWord = (): string => {
  const dateString = new Date().toDateString();
  console.log('Generating daily word for date:', dateString);
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    const char = dateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Get all words from all themes
  const allWords: string[] = [];
  themes.forEach(theme => {
    allWords.push(...wordBank[theme]);
  });
  
  // Use hash to pick a word
  const wordIndex = Math.abs(hash) % allWords.length;
  const selectedWord = allWords[wordIndex];
  
  console.log('Daily word selected:', selectedWord, 'from index:', wordIndex);
  return selectedWord;
};

// Get today's date key in YYYYMMDD format
export const getTodayKey = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

// Check if daily challenge is completed for today
export const isDailyChallengeCompleted = async (): Promise<boolean> => {
  try {
    const todayKey = getTodayKey();
    const completionKey = `daily_done_${todayKey}`;
    const completed = await AsyncStorage.getItem(completionKey);
    return completed === 'true';
  } catch (error) {
    console.error('Error checking daily challenge completion:', error);
    return false;
  }
};

// Mark daily challenge as completed
export const markDailyChallengeCompleted = async (): Promise<void> => {
  try {
    const todayKey = getTodayKey();
    const completionKey = `daily_done_${todayKey}`;
    const scoreKey = `daily_score_${todayKey}`;
    
    await AsyncStorage.setItem(completionKey, 'true');
    await AsyncStorage.setItem(scoreKey, '100'); // Store dummy score for leaderboard
    
    console.log('Daily challenge marked as completed for:', todayKey);
  } catch (error) {
    console.error('Error marking daily challenge as completed:', error);
    throw error;
  }
};

// Award daily challenge points to global score
export const awardDailyChallengePoints = async (bonusPoints: number = 100): Promise<number> => {
  try {
    const progressData = await AsyncStorage.getItem('progress');
    let newPoints = bonusPoints;
    
    if (progressData) {
      const progress = JSON.parse(progressData);
      newPoints = (progress.points || 0) + bonusPoints;
      progress.points = newPoints;
      await AsyncStorage.setItem('progress', JSON.stringify(progress));
    } else {
      // Create new progress if none exists
      const newProgress = { stage: 0, level: 0, points: newPoints };
      await AsyncStorage.setItem('progress', JSON.stringify(newProgress));
    }
    
    console.log('Daily challenge points awarded:', bonusPoints, 'New total:', newPoints);
    return newPoints;
  } catch (error) {
    console.error('Error awarding daily challenge points:', error);
    throw error;
  }
};

// Clean up old daily challenge data (optional - keeps storage clean)
export const cleanupOldDailyChallengeData = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const dailyKeys = keys.filter(key => 
      key.startsWith('daily_done_') || key.startsWith('daily_score_')
    );
    
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const keysToDelete: string[] = [];
    
    dailyKeys.forEach(key => {
      const dateMatch = key.match(/(\d{8})$/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateStr.substring(6, 8));
        const keyDate = new Date(year, month, day);
        
        if (keyDate < sevenDaysAgo) {
          keysToDelete.push(key);
        }
      }
    });
    
    if (keysToDelete.length > 0) {
      await AsyncStorage.multiRemove(keysToDelete);
      console.log('Cleaned up old daily challenge data:', keysToDelete.length, 'keys removed');
    }
  } catch (error) {
    console.error('Error cleaning up old daily challenge data:', error);
    // Don't throw - this is optional cleanup
  }
};

// Enhanced scramble function that ensures the result is different from original
export const scrambleDailyWord = (word: string): string => {
  if (word.length <= 1) return word;
  
  let scrambledWord = word;
  let attempts = 0;
  const maxAttempts = 50;
  
  do {
    scrambledWord = word
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    attempts++;
  } while (scrambledWord === word && attempts < maxAttempts);
  
  // If we still have the original word after max attempts, manually scramble
  if (scrambledWord === word) {
    const letters = word.split("");
    if (letters.length >= 2) {
      [letters[0], letters[1]] = [letters[1], letters[0]];
      scrambledWord = letters.join("");
    }
  }
  
  console.log(`Scrambled daily word "${word}" to "${scrambledWord}"`);
  return scrambledWord;
};
