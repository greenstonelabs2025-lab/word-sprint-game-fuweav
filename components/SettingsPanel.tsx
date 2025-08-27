
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../styles/commonStyles';
import { Settings, loadSettings, saveSetting, resetProgress } from '../utils/settings';
import { track } from '../src/analytics/AnalyticsService';

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const { height } = useWindowDimensions();
  const [settings, setSettings] = useState<Settings>({
    vibrate: true,
    reduceMotion: false,
    highContrast: false,
    sound: false,
  });
  const [displayName, setDisplayName] = useState('Player');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(false);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    if (visible) {
      loadSettingsData();
    }
  }, [visible]);

  const loadSettingsData = async () => {
    try {
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);
      
      // Load display name
      const savedName = await AsyncStorage.getItem('pref_name');
      setDisplayName(savedName || 'Player');
    } catch (error) {
      console.error('Error loading settings in panel:', error);
    }
  };

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    try {
      await saveSetting(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
      
      // Track preference change
      track("pref_change", {
        key: key,
        value: value
      });
      
      console.log(`Setting ${key} updated to ${value}`);
    } catch (error) {
      console.error(`Error updating setting ${key}:`, error);
    }
  };

  const updateDisplayName = async (name: string) => {
    try {
      await AsyncStorage.setItem('pref_name', name);
      setDisplayName(name);
      
      // Track display name change (but don't include the actual name for privacy)
      track("pref_change", {
        key: "display_name",
        value: name.length > 0 ? "set" : "empty"
      });
      
      console.log('Display name updated to:', name);
    } catch (error) {
      console.error('Error updating display name:', error);
    }
  };

  const handleResetProgress = () => {
    setShowResetConfirm(true);
  };

  const confirmResetProgress = async () => {
    try {
      await resetProgress();
      setShowResetConfirm(false);
      setShowResetSuccess(true);
      
      // Track progress reset
      track("progress_reset", {
        source: "settings_panel"
      });
      
      // Auto-hide success message and close panel
      setTimeout(() => {
        setShowResetSuccess(false);
        onClose();
      }, 1500);
      
      console.log('Progress reset successfully');
    } catch (error) {
      console.error('Error resetting progress:', error);
      Alert.alert('Error', 'Failed to reset progress. Please try again.');
      setShowResetConfirm(false);
    }
  };

  const renderToggleRow = (
    title: string,
    description: string,
    value: boolean,
    onToggle: (value: boolean) => void
  ) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.grey + '40', true: colors.accent + '80' }}
        thumbColor={value ? colors.accent : colors.text}
        ios_backgroundColor={colors.grey + '40'}
      />
    </View>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={[styles.panel, { maxHeight: height * 0.6 }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Settings</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Display Name Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Display name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={displayName}
                  onChangeText={updateDisplayName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.grey}
                  maxLength={20}
                  autoCapitalize="words"
                />
                <Text style={styles.inputDescription}>
                  This name will appear on the leaderboard.
                </Text>
              </View>

              {renderToggleRow(
                'Vibrate on feedback',
                'Buzz on errors and taps.',
                settings.vibrate,
                (value) => updateSetting('vibrate', value)
              )}

              {renderToggleRow(
                'Reduce motion',
                'Minimise animations.',
                settings.reduceMotion,
                (value) => updateSetting('reduceMotion', value)
              )}

              {renderToggleRow(
                'Colour-blind high contrast',
                'Stronger colours for visibility.',
                settings.highContrast,
                (value) => updateSetting('highContrast', value)
              )}

              {renderToggleRow(
                'Sound effects',
                'Tap and success sounds.',
                settings.sound,
                (value) => updateSetting('sound', value)
              )}

              {/* Reset Progress Button */}
              <View style={styles.dangerSection}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleResetProgress}
                >
                  <Text style={styles.resetButtonText}>Reset Progress</Text>
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <Text style={styles.footer}>Settings save automatically.</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={showResetConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetConfirm(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Reset Progress</Text>
            <Text style={styles.confirmText}>
              This will reset stage, level and points. Are you sure?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowResetConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonDanger]}
                onPress={confirmResetProgress}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Success Modal */}
      <Modal
        visible={showResetSuccess}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.overlay}>
          <View style={styles.successModal}>
            <Text style={styles.successText}>Progress reset</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: colors.backgroundAlt,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    minHeight: '40%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey + '20',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
    color: colors.grey,
    lineHeight: 18,
  },
  dangerSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey + '20',
  },
  resetButton: {
    backgroundColor: colors.error,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  footer: {
    fontSize: 12,
    color: colors.grey,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  // Confirmation modal styles
  confirmModal: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  confirmText: {
    fontSize: 16,
    color: colors.grey,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.grey + '40',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmButtonDanger: {
    backgroundColor: colors.error,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  // Success modal styles
  successModal: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 20,
    margin: 20,
    alignItems: 'center',
    alignSelf: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  // Display name input styles
  inputSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey + '20',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: colors.grey + '10',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.grey + '30',
  },
  inputDescription: {
    fontSize: 12,
    color: colors.grey,
    marginTop: 4,
    lineHeight: 16,
  },
});
