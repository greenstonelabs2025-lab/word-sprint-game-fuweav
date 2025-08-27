
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  Animated,
  AccessibilityInfo
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Button from './Button';
import SettingsPanel from './SettingsPanel';
import FeedbackModal from './FeedbackModal';
import LevelDesigner from './LevelDesigner';
import ChallengeList from './ChallengeList';
import GradientButton from '../src/ui/GradientButton';
import { colors, commonStyles } from '../styles/commonStyles';
import { isDailyChallengeCompleted } from '../utils/dailyChallenge';
import { getCache } from '../src/levelsync/SyncService';
import { loadSettings, Settings } from '../utils/settings';

interface MainMenuProps {
  onStart: () => void;
  onDailyChallenge: () => void;
  onStore: () => void;
  onChallengeGame?: (challengeName: string, words: string[]) => void;
}

interface SecondaryButtonProps {
  text: string;
  onPress: () => void;
  settings: Settings;
}

function SecondaryButton({ text, onPress, settings }: SecondaryButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    if (!settings.reduceMotion) {
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
    
    if (settings.vibrate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    setIsPressed(false);
    if (!settings.reduceMotion) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
        style={[
          styles.secondaryButton,
          settings.highContrast && styles.highContrastSecondaryButton
        ]}
      >
        {isPressed && !settings.highContrast && (
          <LinearGradient
            colors={['#1F2A44', '#151C2B']}
            style={styles.secondaryButtonGradient}
          />
        )}
        <Text style={[
          styles.secondaryButtonText,
          settings.highContrast && styles.highContrastSecondaryButtonText
        ]}>
          {text}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MainMenu({ onStart, onDailyChallenge, onStore, onChallengeGame }: MainMenuProps) {
  const [rulesVisible, setRulesVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLevelDesigner, setShowLevelDesigner] = useState(false);
  const [showChallengeList, setShowChallengeList] = useState(false);
  const [isDailyChallengeCompletedToday, setIsDailyChallengeCompletedToday] = useState(false);
  const [hasChallenges, setHasChallenges] = useState(false);
  const [hasActiveDaily, setHasActiveDaily] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    vibrate: true,
    reduceMotion: false,
    highContrast: false,
    sound: false,
  });

  useEffect(() => {
    loadUserSettings();
    checkDailyChallengeStatus();
    checkChallengesAvailable();
  }, []);

  const loadUserSettings = async () => {
    try {
      const userSettings = await loadSettings();
      setSettings(userSettings);
      console.log('User settings loaded:', userSettings);
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const checkDailyChallengeStatus = async () => {
    try {
      const completed = await isDailyChallengeCompleted();
      setIsDailyChallengeCompletedToday(completed);
      
      // Check if there's an active daily challenge available
      // For now, we'll assume there's always an active daily unless completed
      setHasActiveDaily(!completed);
      
      console.log('Daily challenge completion status:', completed);
    } catch (error) {
      console.error('Error checking daily challenge status:', error);
      setIsDailyChallengeCompletedToday(false);
      setHasActiveDaily(false);
    }
  };

  const checkChallengesAvailable = async () => {
    try {
      const cache = await getCache();
      setHasChallenges(cache.challenges && cache.challenges.length > 0);
      console.log('Challenges available:', cache.challenges?.length || 0);
    } catch (error) {
      console.error('Error checking challenges:', error);
      setHasChallenges(false);
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
        {/* Header with emblem */}
        <View style={styles.header}>
          <View style={styles.emblem}>
            <Text style={styles.emblemEmoji} role="img" accessibilityLabel="Lightning bolt">
              ⚡️
            </Text>
          </View>
          <Text style={[styles.title, settings.highContrast && styles.highContrastTitle]}>
            Word Sprint
          </Text>
          <Text style={[styles.subtitle, settings.highContrast && styles.highContrastSubtitle]}>
            Unscramble. Score. Advance.
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <GradientButton
            title="New Game"
            icon="🆕"
            onPress={newGame}
            colors={['#5EE7DF', '#0083B0']}
          />
          
          <GradientButton
            title="Continue"
            icon="🔁"
            onPress={continueGame}
            colors={['#6A85B6', '#BAC8E0']}
          />
          
          <GradientButton
            title={isDailyChallengeCompletedToday ? "Daily Complete ✓" : "Daily Challenge"}
            icon="🏆"
            onPress={handleDailyChallenge}
            colors={['#9D50BB', '#6E48AA']}
          />

          <GradientButton
            title="Store"
            icon="🛒"
            onPress={handleStore}
            colors={['#FF8C00', '#FF512F']}
          />
          
          {/* Secondary buttons */}
          <View style={styles.secondaryButtonsContainer}>
            <SecondaryButton
              text="Rules"
              onPress={() => setRulesVisible(true)}
              settings={settings}
            />

            <SecondaryButton
              text="Settings"
              onPress={() => setShowSettings(true)}
              settings={settings}
            />

            <SecondaryButton
              text="Feedback"
              onPress={() => setShowFeedback(true)}
              settings={settings}
            />

            <SecondaryButton
              text="Level Designer"
              onPress={() => setShowLevelDesigner(true)}
              settings={settings}
            />
          </View>
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

            <GradientButton
              title="Close"
              onPress={() => setRulesVisible(false)}
              colors={[colors.primary, colors.accent]}
              style={styles.closeButton}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Settings Panel */}
      <SettingsPanel 
        visible={showSettings} 
        onClose={() => {
          setShowSettings(false);
          // Reload settings when panel closes
          loadUserSettings();
        }} 
      />

      {/* Feedback Modal */}
      <FeedbackModal 
        visible={showFeedback} 
        onClose={() => setShowFeedback(false)} 
      />

      {/* Level Designer */}
      <LevelDesigner 
        visible={showLevelDesigner} 
        onClose={() => {
          setShowLevelDesigner(false);
          // Refresh challenges after designer closes
          checkChallengesAvailable();
        }} 
      />

      {/* Challenge List */}
      <ChallengeList 
        visible={showChallengeList} 
        onClose={() => setShowChallengeList(false)}
        onChallengeSelect={(challengeName, words) => {
          setShowChallengeList(false);
          onChallengeGame?.(challengeName, words);
        }}
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emblem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emblemEmoji: {
    fontSize: 18,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  secondaryButtonsContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  secondaryButton: {
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  secondaryButtonGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    zIndex: 1,
  },
  // High contrast styles
  highContrastSecondaryButton: {
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#000000',
  },
  highContrastSecondaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  highContrastTitle: {
    color: '#ffffff',
  },
  highContrastSubtitle: {
    color: '#ffffff',
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
    marginTop: 20,
    alignSelf: 'center',
    width: '60%',
  },
});
