
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  vibrate: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  sound: boolean;
}

export const defaultSettings: Settings = {
  vibrate: true,
  reduceMotion: false,
  highContrast: false,
  sound: false,
};

export const SETTINGS_KEYS = {
  VIBRATE: 'pref_vibrate',
  REDUCE_MOTION: 'pref_reduce_motion',
  HIGH_CONTRAST: 'pref_high_contrast',
  SOUND: 'pref_sound',
} as const;

export const loadSettings = async (): Promise<Settings> => {
  try {
    const keys = Object.values(SETTINGS_KEYS);
    const values = await AsyncStorage.multiGet(keys);
    
    const settings: Settings = {
      vibrate: values[0][1] === 'true' || values[0][1] === null, // default true
      reduceMotion: values[1][1] === 'true', // default false
      highContrast: values[2][1] === 'true', // default false
      sound: values[3][1] === 'true', // default false
    };
    
    console.log('Settings loaded:', settings);
    return settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultSettings;
  }
};

export const saveSetting = async (key: keyof Settings, value: boolean): Promise<void> => {
  try {
    const storageKey = SETTINGS_KEYS[key.toUpperCase() as keyof typeof SETTINGS_KEYS] || 
                      `pref_${key === 'reduceMotion' ? 'reduce_motion' : key === 'highContrast' ? 'high_contrast' : key}`;
    await AsyncStorage.setItem(storageKey, value.toString());
    console.log(`Setting ${key} saved as ${value}`);
  } catch (error) {
    console.error(`Error saving setting ${key}:`, error);
  }
};

export const resetProgress = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('progress');
    console.log('Progress reset successfully');
  } catch (error) {
    console.error('Error resetting progress:', error);
    throw error;
  }
};
