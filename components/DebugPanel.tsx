
import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { clearStaleCache, resetGameProgress, clearWordSetsCache } from '../utils/cacheManager';
import GradientButton from '../src/ui/GradientButton';
import { colors } from '../styles/commonStyles';

interface DebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

const styles = StyleSheet.create({
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
    minWidth: 300,
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.grey,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
  },
  closeButton: {
    marginTop: 8,
  },
});

export default function DebugPanel({ visible, onClose }: DebugPanelProps) {
  const { width } = useWindowDimensions();
  const [isLoading, setIsLoading] = useState(false);

  const handleClearStaleCache = async () => {
    try {
      setIsLoading(true);
      await clearStaleCache();
      Alert.alert('Success', 'Stale cache cleared successfully. Restart the app to see changes.');
    } catch (error) {
      console.error('Error clearing stale cache:', error);
      Alert.alert('Error', 'Failed to clear stale cache. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetProgress = async () => {
    Alert.alert(
      'Reset Progress',
      'This will reset your game progress to the beginning. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await resetGameProgress();
              Alert.alert('Success', 'Game progress reset successfully. Restart the app to see changes.');
            } catch (error) {
              console.error('Error resetting progress:', error);
              Alert.alert('Error', 'Failed to reset progress. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClearWordSetsCache = async () => {
    Alert.alert(
      'Clear Word Sets Cache',
      'This will clear all cached word sets and force a re-sync. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await clearWordSetsCache();
              Alert.alert('Success', 'Word sets cache cleared successfully. Restart the app to see changes.');
            } catch (error) {
              console.error('Error clearing word sets cache:', error);
              Alert.alert('Error', 'Failed to clear word sets cache. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will clear ALL app data including progress, settings, and cache. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await AsyncStorage.clear();
              Alert.alert('Success', 'All app data cleared successfully. Restart the app to see changes.');
            } catch (error) {
              console.error('Error clearing all data:', error);
              Alert.alert('Error', 'Failed to clear all data. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClearProgressOnly = async () => {
    Alert.alert(
      'Clear Progress Cache',
      'This will clear the progress cache to force the app to pick up new themes. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await AsyncStorage.removeItem("progress");
              console.log('Progress cache cleared for theme update');
              Alert.alert('Success', 'Progress cache cleared successfully. Restart the app to see changes.');
            } catch (error) {
              console.error('Error clearing progress cache:', error);
              Alert.alert('Error', 'Failed to clear progress cache. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleForceShapesTheme = async () => {
    Alert.alert(
      'Force Shapes Theme',
      'This will clear all cache and force the app to use "Shapes" as the first theme. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Force Shapes',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Clear all theme-related cache
              await AsyncStorage.multiRemove([
                'progress',
                'progress_cleared_for_wordbank',
                'shapes_theme_forced',
                'wordsets_cache',
                'wordsets_last_sync',
                'wordsets_pending_actions'
              ]);
              
              // Set flag to force shapes theme
              await AsyncStorage.setItem('force_shapes_theme', 'true');
              
              console.log('All cache cleared and Shapes theme forced');
              Alert.alert(
                'Success', 
                'All cache cleared and Shapes theme forced. The app will now use "Shapes" as the first theme. Please restart the app.',
                [{ text: 'OK', onPress: () => onClose() }]
              );
            } catch (error) {
              console.error('Error forcing shapes theme:', error);
              Alert.alert('Error', 'Failed to force shapes theme');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: Math.min(400, width - 40) }]}>
          <Text style={styles.title}>Debug Panel</Text>
          <Text style={styles.description}>
            Use these tools to clear cache and reset data for debugging purposes.
          </Text>

          <View style={styles.buttonContainer}>
            <GradientButton
              title="🔺 Force Shapes Theme"
              onPress={handleForceShapesTheme}
              colors={['#4CAF50', '#388E3C']}
              disabled={isLoading}
              style={styles.button}
            />

            <GradientButton
              title="Clear Progress Cache"
              onPress={handleClearProgressOnly}
              colors={['#FF9800', '#F57C00']}
              disabled={isLoading}
              style={styles.button}
            />

            <GradientButton
              title="Clear Stale Cache"
              onPress={handleClearStaleCache}
              colors={['#2196F3', '#1976D2']}
              disabled={isLoading}
              style={styles.button}
            />

            <GradientButton
              title="Reset Game Progress"
              onPress={handleResetProgress}
              colors={['#FF5722', '#D84315']}
              disabled={isLoading}
              style={styles.button}
            />

            <GradientButton
              title="Clear Word Sets Cache"
              onPress={handleClearWordSetsCache}
              colors={['#9C27B0', '#7B1FA2']}
              disabled={isLoading}
              style={styles.button}
            />

            <GradientButton
              title="Clear All Data"
              onPress={handleClearAllData}
              colors={['#F44336', '#C62828']}
              disabled={isLoading}
              style={styles.button}
            />

            <GradientButton
              title="Close"
              onPress={onClose}
              colors={[colors.grey + '60', colors.grey + '40']}
              disabled={isLoading}
              style={[styles.button, styles.closeButton]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
