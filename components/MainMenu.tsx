
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from './Button';
import SettingsPanel from './SettingsPanel';
import FeedbackModal from './FeedbackModal';
import LevelDesigner from './LevelDesigner';
import { colors, commonStyles } from '../styles/commonStyles';
import { isDailyChallengeCompleted } from '../utils/dailyChallenge';

interface MainMenuProps {
  onStart: () => void;
  onDailyChallenge: () => void;
  onStore: () => void;
}

export default function MainMenu({ onStart, onDailyChallenge, onStore }: MainMenuProps) {
  const [rulesVisible, setRulesVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLevelDesigner, setShowLevelDesigner] = useState(false);
  const [isDailyChallengeCompletedToday, setIsDailyChallengeCompletedToday] = useState(false);

  useEffect(() => {
    checkDailyChallengeStatus();
  }, []);

  const checkDailyChallengeStatus = async () => {
    try {
      const completed = await isDailyChallengeCompleted();
      setIsDailyChallengeCompletedToday(completed);
      console.log('Daily challenge completion status:', completed);
    } catch (error) {
      console.error('Error checking daily challenge status:', error);
      setIsDailyChallengeCompletedToday(false);
    }
  };

  const newGame = async () => {
    Alert.alert(
      "New Game",
      "Are you sure you want to start a new game? This will overwrite your current progress.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: async () => {
            try {
              await AsyncStorage.setItem("progress", JSON.stringify({ stage: 0, level: 0, points: 0 }));
              console.log('New game started - progress reset to zeros');
              onStart();
            } catch (e) {
              console.error("Error saving new game:", e);
            }
          },
        },
      ]
    );
  };

  const continueGame = async () => {
    try {
      const progress = await AsyncStorage.getItem("progress");
      if (!progress) {
        // No existing progress, start new game
        await AsyncStorage.setItem("progress", JSON.stringify({ stage: 0, level: 0, points: 0 }));
        console.log('No existing progress found - starting new game');
      } else {
        console.log('Continuing existing game:', progress);
      }
      onStart();
    } catch (e) {
      console.error("Error loading game:", e);
      // Fallback to new game
      await AsyncStorage.setItem("progress", JSON.stringify({ stage: 0, level: 0, points: 0 }));
      onStart();
    }
  };

  const handleDailyChallenge = () => {
    console.log('Daily Challenge button pressed');
    onDailyChallenge();
  };

  const handleStore = () => {
    console.log('Store button pressed');
    onStore();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Word Sprint</Text>
        <Text style={styles.subtitle}>Unscramble. Score. Advance.</Text>
        
        <View style={styles.buttonContainer}>
          <Button
            text="New Game"
            onPress={newGame}
            style={styles.primaryButton}
          />
          
          <Button
            text="Continue"
            onPress={continueGame}
            style={styles.secondaryButton}
          />
          
          <Button
            text={isDailyChallengeCompletedToday ? "Daily Complete ✓" : "Daily Challenge"}
            onPress={handleDailyChallenge}
            style={[
              styles.dailyButton,
              isDailyChallengeCompletedToday && styles.completedDailyButton
            ]}
            textStyle={isDailyChallengeCompletedToday ? styles.completedDailyButtonText : undefined}
          />

          <Button
            text="Store"
            onPress={handleStore}
            style={styles.storeButton}
          />
          
          <TouchableOpacity 
            style={styles.rulesButton}
            onPress={() => setRulesVisible(true)}
          >
            <Text style={styles.rulesButtonText}>Rules</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.feedbackButton}
            onPress={() => setShowFeedback(true)}
          >
            <Text style={styles.feedbackButtonText}>Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.levelDesignerButton}
            onPress={() => setShowLevelDesigner(true)}
          >
            <Text style={styles.levelDesignerButtonText}>Level Designer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rules Modal */}
      <Modal 
        visible={rulesVisible} 
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRulesVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Game Rules</Text>
            
            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Goal:</Text>
              <Text style={styles.ruleText}>• Unscramble 15 levels per stage</Text>
              <Text style={styles.ruleText}>• Complete all 20 stages</Text>
            </View>

            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Points:</Text>
              <Text style={styles.ruleText}>• 10 × stage number per correct answer</Text>
              <Text style={styles.ruleText}>• +5 bonus points every 3-streak</Text>
            </View>

            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Help Options:</Text>
              <Text style={styles.ruleText}>• Hint = 50 pts (reveals first letter)</Text>
              <Text style={styles.ruleText}>• Answer = 200 pts (reveals full word)</Text>
            </View>

            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Daily Challenge:</Text>
              <Text style={styles.ruleText}>• One special word per day</Text>
              <Text style={styles.ruleText}>• 100 bonus points for completion</Text>
              <Text style={styles.ruleText}>• No hints available (Premium feature)</Text>
              <Text style={styles.ruleText}>• Leaderboard coming with Premium</Text>
            </View>

            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Progress:</Text>
              <Text style={styles.ruleText}>• Your progress auto-saves</Text>
              <Text style={styles.ruleText}>• Continue anytime from where you left off</Text>
            </View>

            <Button
              text="Close"
              onPress={() => setRulesVisible(false)}
              style={styles.closeButton}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Settings Panel */}
      <SettingsPanel 
        visible={showSettings} 
        onClose={() => setShowSettings(false)} 
      />

      {/* Feedback Modal */}
      <FeedbackModal 
        visible={showFeedback} 
        onClose={() => setShowFeedback(false)} 
      />

      {/* Level Designer */}
      <LevelDesigner 
        visible={showLevelDesigner} 
        onClose={() => setShowLevelDesigner(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.grey,
    marginBottom: 40,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    width: '100%',
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
    width: '100%',
  },
  dailyButton: {
    backgroundColor: '#4a148c',
    width: '100%',
  },
  completedDailyButton: {
    backgroundColor: '#00e676',
    opacity: 0.8,
  },
  completedDailyButtonText: {
    color: '#ffffff',
  },
  storeButton: {
    backgroundColor: '#FF6F00',
    width: '100%',
  },
  rulesButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  rulesButtonText: {
    fontSize: 16,
    color: colors.accent,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  settingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  settingsButtonText: {
    fontSize: 14,
    color: colors.grey,
    textAlign: 'center',
  },
  feedbackButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  feedbackButtonText: {
    fontSize: 14,
    color: colors.accent,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  levelDesignerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  levelDesignerButtonText: {
    fontSize: 14,
    color: colors.grey,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    padding: 24,
    paddingTop: 60, // Account for status bar
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 30,
    textAlign: 'center',
  },
  ruleSection: {
    marginBottom: 24,
  },
  ruleHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 4,
  },
  closeButton: {
    backgroundColor: colors.primary,
    marginTop: 20,
    alignSelf: 'center',
    width: '60%',
  },
});
