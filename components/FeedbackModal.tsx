
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../app/integrations/supabase/client';
import { colors } from '../styles/commonStyles';
import { track } from '../src/analytics/AnalyticsService';
import { loadSettings } from '../utils/settings';
import GradientButton from '../src/ui/GradientButton';
import { triggerHaptic } from '../src/services/HapticsService';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  prefillCategory?: 'Bug' | 'Idea' | 'Other';
  prefillMessage?: string;
  currentStage?: number;
  currentLevel?: number;
  currentPoints?: number;
  currentTheme?: string;
}

interface GameProgress {
  stage: number;
  level: number;
  points: number;
}

interface PendingFeedback {
  name: string;
  category: string;
  message: string;
  stage: number;
  level: number;
  points: number;
  device: string;
  app_ver: string;
  timestamp: string;
}

const CATEGORIES = ['Bug', 'Idea', 'Other'];
const MIN_MESSAGE_LENGTH = 10;
const APP_VERSION = '1.0.0';

export default function FeedbackModal({
  visible,
  onClose,
  prefillCategory,
  prefillMessage,
  currentStage,
  currentLevel,
  currentPoints,
  currentTheme,
}: FeedbackModalProps) {
  const { height } = useWindowDimensions();
  const [category, setCategory] = useState<string>(prefillCategory || 'Bug');
  const [message, setMessage] = useState<string>(prefillMessage || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameData, setGameData] = useState<GameProgress>({ stage: 0, level: 0, points: 0 });
  const [displayName, setDisplayName] = useState('Player');
  const [settings, setSettings] = useState({ reduceMotion: false, highContrast: false });

  useEffect(() => {
    if (visible) {
      loadGameData();
      loadUserData();
      loadUserSettings();
      
      // Track feedback modal open
      track('feedback_open', { screen: 'game' });
    }
  }, [visible]);

  useEffect(() => {
    if (prefillCategory) {
      setCategory(prefillCategory);
    }
    if (prefillMessage) {
      setMessage(prefillMessage);
    }
  }, [prefillCategory, prefillMessage]);

  const loadGameData = async () => {
    try {
      // Use provided current data if available, otherwise load from storage
      if (currentStage !== undefined && currentLevel !== undefined && currentPoints !== undefined) {
        setGameData({
          stage: currentStage,
          level: currentLevel,
          points: currentPoints,
        });
      } else {
        const progressData = await AsyncStorage.getItem('progress');
        if (progressData) {
          const progress = JSON.parse(progressData);
          setGameData({
            stage: progress.stage || 0,
            level: progress.level || 0,
            points: progress.points || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem('pref_name');
      setDisplayName(name || 'Player');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadUserSettings = async () => {
    try {
      const userSettings = await loadSettings();
      setSettings({
        reduceMotion: userSettings.reduceMotion,
        highContrast: userSettings.highContrast,
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const getDeviceInfo = (): string => {
    return `${Platform.OS} ${Platform.Version}`;
  };

  const generateShortId = (): string => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const savePendingFeedback = async (feedbackData: PendingFeedback) => {
    try {
      const existingPending = await AsyncStorage.getItem('pending_feedback');
      const pendingList: PendingFeedback[] = existingPending ? JSON.parse(existingPending) : [];
      
      pendingList.push(feedbackData);
      await AsyncStorage.setItem('pending_feedback', JSON.stringify(pendingList));
      
      console.log('Feedback saved offline:', feedbackData);
      
      // Track offline queue
      track('feedback_offline_queue', { count: pendingList.length });
    } catch (error) {
      console.error('Error saving pending feedback:', error);
    }
  };

  const submitFeedback = async () => {
    if (message.length < MIN_MESSAGE_LENGTH) {
      Alert.alert('Message Too Short', `Please enter at least ${MIN_MESSAGE_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        name: displayName,
        category,
        message,
        stage: gameData.stage + 1, // Display as 1-indexed
        level: gameData.level + 1, // Display as 1-indexed
        points: gameData.points,
        device: getDeviceInfo(),
        app_ver: APP_VERSION,
      };

      // Try to submit to Supabase
      const { data, error } = await supabase
        .from('feedback')
        .insert([feedbackData])
        .select('id')
        .single();

      if (error) {
        console.error('Supabase error:', error);
        
        // Save offline for later submission
        const pendingData: PendingFeedback = {
          ...feedbackData,
          timestamp: new Date().toISOString(),
        };
        
        await savePendingFeedback(pendingData);
        
        Alert.alert(
          'Saved Offline',
          'Your feedback has been saved and will be sent when you\'re back online.',
          [{ text: 'OK', onPress: handleClose }]
        );
      } else {
        // Success
        const shortId = generateShortId();
        
        // Track successful submission
        track('feedback_submit', { category });
        
        Alert.alert(
          'Thank You!',
          `Your feedback has been logged as #${shortId}. We appreciate your input!`,
          [{ text: 'OK', onPress: handleClose }]
        );
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      
      // Save offline as fallback
      const pendingData: PendingFeedback = {
        name: displayName,
        category,
        message,
        stage: gameData.stage + 1,
        level: gameData.level + 1,
        points: gameData.points,
        device: getDeviceInfo(),
        app_ver: APP_VERSION,
        timestamp: new Date().toISOString(),
      };
      
      await savePendingFeedback(pendingData);
      
      Alert.alert(
        'Saved Offline',
        'Your feedback has been saved and will be sent when you\'re back online.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCategory(prefillCategory || 'Bug');
    setMessage(prefillMessage || '');
    setIsSubmitting(false);
    onClose();
  };

  const isSubmitDisabled = message.length < MIN_MESSAGE_LENGTH || isSubmitting;
  const characterCount = message.length;
  const characterCountColor = characterCount < MIN_MESSAGE_LENGTH ? colors.error : colors.text;

  return (
    <Modal
      visible={visible}
      animationType={settings.reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, settings.highContrast && styles.highContrastText]}>
              Send Feedback
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, settings.highContrast && styles.highContrastBorder]}
              onPress={() => {
                triggerHaptic("light");
                handleClose();
              }}
              disabled={isSubmitting}
            >
              <Text style={[styles.closeButtonText, settings.highContrast && styles.highContrastText]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category Picker */}
          <View style={styles.section}>
            <Text style={[styles.label, settings.highContrast && styles.highContrastText]}>
              Category
            </Text>
            <View style={styles.categoryContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonSelected,
                    settings.highContrast && styles.highContrastBorder,
                    settings.highContrast && category === cat && styles.highContrastSelected,
                  ]}
                  onPress={() => {
                    triggerHaptic("light");
                    setCategory(cat);
                  }}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextSelected,
                      settings.highContrast && styles.highContrastText,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Message Input */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, settings.highContrast && styles.highContrastText]}>
                Message
              </Text>
              <Text style={[styles.characterCount, { color: characterCountColor }]}>
                {characterCount}/{MIN_MESSAGE_LENGTH} min
              </Text>
            </View>
            <TextInput
              style={[
                styles.messageInput,
                settings.highContrast && styles.highContrastInput,
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your bug report or idea..."
              placeholderTextColor={settings.highContrast ? '#888' : colors.grey}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>

          {/* Game Info Chips */}
          <View style={styles.section}>
            <Text style={[styles.label, settings.highContrast && styles.highContrastText]}>
              Game Context (Auto-filled)
            </Text>
            <View style={styles.chipsContainer}>
              <View style={[styles.chip, settings.highContrast && styles.highContrastChip]}>
                <Text style={[styles.chipText, settings.highContrast && styles.highContrastText]}>
                  Stage {gameData.stage + 1}
                </Text>
              </View>
              <View style={[styles.chip, settings.highContrast && styles.highContrastChip]}>
                <Text style={[styles.chipText, settings.highContrast && styles.highContrastText]}>
                  Level {gameData.level + 1}
                </Text>
              </View>
              <View style={[styles.chip, settings.highContrast && styles.highContrastChip]}>
                <Text style={[styles.chipText, settings.highContrast && styles.highContrastText]}>
                  {gameData.points} pts
                </Text>
              </View>
              {currentTheme && (
                <View style={[styles.chip, settings.highContrast && styles.highContrastChip]}>
                  <Text style={[styles.chipText, settings.highContrast && styles.highContrastText]}>
                    {currentTheme}
                  </Text>
                </View>
              )}
              <View style={[styles.chip, settings.highContrast && styles.highContrastChip]}>
                <Text style={[styles.chipText, settings.highContrast && styles.highContrastText]}>
                  v{APP_VERSION}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <GradientButton
              title="Cancel"
              icon="✖️"
              onPress={handleClose}
              colors={[colors.grey + '60', colors.grey + '40']}
              disabled={isSubmitting}
              style={styles.button}
            />

            <GradientButton
              title={isSubmitting ? 'Sending...' : 'Send'}
              icon={isSubmitting ? undefined : '📤'}
              onPress={submitFeedback}
              colors={isSubmitDisabled ? [colors.grey + '40', colors.grey + '20'] : ['#60A5FA', '#2563EB']}
              disabled={isSubmitDisabled}
              style={styles.button}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60, // Account for status bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
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
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  categoryButtonTextSelected: {
    color: '#ffffff',
  },
  messageInput: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grey + '40',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.grey,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
  },
  // High contrast styles
  highContrastText: {
    color: '#ffffff',
  },
  highContrastBorder: {
    borderColor: '#ffffff',
    borderWidth: 2,
  },
  highContrastInput: {
    borderColor: '#ffffff',
    borderWidth: 2,
    backgroundColor: '#000000',
    color: '#ffffff',
  },
  highContrastSelected: {
    backgroundColor: '#ffffff',
  },
  highContrastChip: {
    borderColor: '#ffffff',
    backgroundColor: '#333333',
  },
});
