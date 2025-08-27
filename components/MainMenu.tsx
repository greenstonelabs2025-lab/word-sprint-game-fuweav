
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

interface GradientButtonProps {
  text: string;
  emoji: string;
  onPress: () => void;
  gradientColors: string[];
  style?: any;
  hasActiveDaily?: boolean;
  settings: Settings;
}

interface SecondaryButtonProps {
  text: string;
  onPress: () => void;
  settings: Settings;
}

function GradientButton({ 
  text, 
  emoji, 
  onPress, 
  gradientColors, 
  style, 
  hasActiveDaily = false,
  settings 
}: GradientButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for daily challenge when active
  useEffect(() => {
    if (hasActiveDaily && !settings.reduceMotion) {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setTimeout(pulse, 1500);
        });
      };
      pulse();
    }
  }, [hasActiveDaily, settings.reduceMotion]);

  const handlePressIn = () => {
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
    if (!settings.reduceMotion) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePress = () => {
    onPress();
  };

  // High contrast mode colors
  const getHighContrastColors = () => {
    if (text.includes('New Game')) return ['#00FF00', '#00FF00'];
    if (text.includes('Continue')) return ['#4DA3FF', '#4DA3FF'];
    if (text.includes('Daily')) return ['#B466FF', '#B466FF'];
    if (text.includes('Store')) return ['#FFA040', '#FFA040'];
    return gradientColors;
  };

  const finalGradientColors = settings.highContrast ? getHighContrastColors() : gradientColors;

  return (
    <Animated.View 
      style={[
        { transform: [{ scale: scaleAnim }] },
        hasActiveDaily && { transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] }
      ]}
    >
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
        style={[styles.gradientButtonContainer, style]}
      >
        <LinearGradient
          colors={finalGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientButton,
            settings.highContrast && styles.highContrastButton,
            hasActiveDaily && styles.dailyActiveButton
          ]}
        >
          {/* Inner shadow overlays */}
          {!settings.highContrast && (
            <>
              <View style={styles.innerShadowLight} />
              <View style={styles.innerShadowDark} />
            </>
          )}
          
          <View style={styles.buttonContent}>
            <Text style={styles.buttonEmoji} role="img" accessibilityLabel={`${text} icon`}>
              {emoji}
            </Text>
            <Text style={[styles.buttonText, settings.highContrast && styles.highContrastButtonText]}>
              {text}
            </Text>
          </View>
        </LinearGradient>
        
        {/* Daily active border */}
        {hasActiveDaily && !settings.reduceMotion && (
          <View style={styles.dailyActiveBorder} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
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
            text="New Game"
            emoji="🆕"
            onPress={newGame}
            gradientColors={['#5EE7DF', '#0083B0']}
            settings={settings}
          />
          
          <GradientButton
            text="Continue"
            emoji="🔁"
            onPress={continueGame}
            gradientColors={['#6A85B6', '#BAC8E0']}
            settings={settings}
          />
          
          <GradientButton
            text={isDailyChallengeCompletedToday ? "Daily Complete ✓" : "Daily Challenge"}
            emoji="🏆"
            onPress={handleDailyChallenge}
            gradientColors={['#9D50BB', '#6E48AA']}
            hasActiveDaily={hasActiveDaily}
            settings={settings}
          />

          <GradientButton
            text="Store"
            emoji="🛒"
            onPress={handleStore}
            gradientColors={['#FF8C00', '#FF512F']}
            settings={settings}
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
  gradientButtonContainer: {
    width: '100%',
    position: 'relative',
  },
  gradientButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  innerShadowLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: '50%',
    bottom: '50%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 14,
  },
  innerShadowDark: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: '50%',
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderBottomRightRadius: 14,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 1,
  },
  buttonEmoji: {
    fontSize: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dailyActiveButton: {
    // Additional styling for active daily challenge
  },
  dailyActiveBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
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
  highContrastButton: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  highContrastButtonText: {
    color: '#000000',
    fontWeight: 'bold',
  },
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
    backgroundColor: colors.primary,
    marginTop: 20,
    alignSelf: 'center',
    width: '60%',
  },
});
