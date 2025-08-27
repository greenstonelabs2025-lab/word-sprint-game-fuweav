
import AsyncStorage from '@react-native-async-storage/async-storage';

// Shared points update helper
export const updatePoints = async (delta: number): Promise<number> => {
  try {
    const progressData = await AsyncStorage.getItem('progress');
    let currentProgress = { stage: 0, level: 0, points: 0 };
    
    if (progressData) {
      currentProgress = JSON.parse(progressData);
    }
    
    // Clamp points between 0 and 999999
    const newPoints = Math.max(0, Math.min(999999, (currentProgress.points || 0) + delta));
    
    const updatedProgress = {
      ...currentProgress,
      points: newPoints,
    };
    
    await AsyncStorage.setItem('progress', JSON.stringify(updatedProgress));
    console.log(`Points updated: ${currentProgress.points || 0} + ${delta} = ${newPoints}`);
    
    return newPoints;
  } catch (error) {
    console.error('Error updating points:', error);
    throw error;
  }
};
