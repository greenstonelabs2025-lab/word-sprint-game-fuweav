
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearStaleCache, resetGameProgress, clearWordSetsCache } from '../utils/cacheManager';
import GradientButton from '../src/ui/GradientButton';
import { colors } from '../styles/commonStyles';

interface DebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function DebugPanel({ visible, onClose }: DebugPanelProps) {
  const { width } = useWindowDimensions();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearStaleCache = async () => {
    try {
      setIsClearing(true);
      await clearStaleCache();
      Alert.alert(
        'Cache Cleared',
        'Stale cache has been cleared. Please restart the app to see the new Shapes theme.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to clear cache. Please try again.');
      console.error('Cache clear error:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleResetProgress = async () => {
    Alert.alert(
      'Reset Progress',
      'This will reset your game progress to Stage 1, Level 1. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              await resetGameProgress();
              Alert.alert(
                'Progress Reset',
                'Game progress has been reset. Please restart the app.',
                [{ text: 'OK', onPress: onClose }]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to reset progress. Please try again.');
              console.error('Progress reset error:', error);
            } finally {
              setIsClearing(false);
            }
          }
        }
      ]
    );
  };

  const handleClearWordSetsCache = async () => {
    try {
      setIsClearing(true);
      await clearWordSetsCache();
      Alert.alert(
        'Word Sets Cache Cleared',
        'Word sets cache has been cleared. The app will reload themes from the local wordBank.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to clear word sets cache. Please try again.');
      console.error('Word sets cache clear error:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will clear ALL app data including progress, settings, and cache. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              await AsyncStorage.clear();
              Alert.alert(
                'All Data Cleared',
                'All app data has been cleared. Please restart the app.',
                [{ text: 'OK', onPress: onClose }]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to clear all data. Please try again.');
              console.error('Clear all data error:', error);
            } finally {
              setIsClearing(false);
            }
          }
        }
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
        <View style={[styles.modalContent, { maxWidth: width - 40 }]}>
          <Text style={styles.modalTitle}>Debug Panel</Text>
          <Text style={styles.modalSubtitle}>
            Use these tools to clear cache and reset data
          </Text>

          <View style={styles.buttonContainer}>
            <GradientButton
              title="Clear Stale Cache"
              onPress={handleClearStaleCache}
              colors={[colors.accent, colors.primary]}
              disabled={isClearing}
              style={styles.debugButton}
            />

            <GradientButton
              title="Reset Game Progress"
              onPress={handleResetProgress}
              colors={['#FF8A80', '#E53935']}
              disabled={isClearing}
              style={styles.debugButton}
            />

            <GradientButton
              title="Clear Word Sets Cache"
              onPress={handleClearWordSetsCache}
              colors={['#FFD54F', '#FFA000']}
              disabled={isClearing}
              style={styles.debugButton}
            />

            <GradientButton
              title="Clear All Data"
              onPress={handleClearAllData}
              colors={['#F44336', '#D32F2F']}
              disabled={isClearing}
              style={styles.debugButton}
            />

            <GradientButton
              title="Close"
              onPress={onClose}
              colors={[colors.grey + '60', colors.grey + '40']}
              style={[styles.debugButton, styles.closeButton]}
            />
          </View>

          {isClearing && (
            <Text style={styles.loadingText}>Processing...</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.grey,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  debugButton: {
    width: '100%',
  },
  closeButton: {
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 16,
    textAlign: 'center',
  },
});
