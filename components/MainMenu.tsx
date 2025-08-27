
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
  AccessibilityInfo,
  ImageBackground,
  Image,
  Platform,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import SettingsPanel from './SettingsPanel';
import FeedbackModal from './FeedbackModal';
import LevelDesigner from './LevelDesigner';
import ChallengeList from './ChallengeList';
import GradientButton from '../src/ui/GradientButton';
import { colors, commonStyles } from '../styles/commonStyles';
import { isDailyChallengeCompleted } from '../utils/dailyChallenge';
import { getCache } from '../src/levelsync/SyncService';
import { loadSettings, Settings } from '../utils/settings';
import * as Config from '../src/config/ConfigService';

interface MainMenuProps {
  onStart: () => void;
  onDailyChallenge: () => void;
  onStore: () => void;
  onChallengeGame?: (challengeName: string, words: string[]) => void;
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
  const [bgUrl, setBgUrl] = useState<string>("");
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
    loadBackgroundImage();
  }, []);

  const loadBackgroundImage = async () => {
    try {
      console.log('MainMenu: Loading background image...');
      
      // First load cached image
      const cached = await Config.getCachedMenuBg();
      if (cached) {
        setBgUrl(cached);
        console.log('MainMenu: Set cached background URL:', cached);
      }
      
      // Then try to refresh with latest
      const fresh = await Config.refreshMenuBg();
      if (fresh && fresh !== cached) {
        setBgUrl(fresh);
        console.log('MainMenu: Updated to fresh background URL:', fresh);
        
        // Optionally prefetch for smoother display
        if (fresh) {
          Image.prefetch(fresh).catch(error => {
            console.warn('MainMenu: Failed to prefetch background image:', error);
          });
        }
      }
    } catch (error) {
      console.error('MainMenu: Error loading background image:', error);
    }
  };

  const refreshBackground = async () => {
    try {
      console.log('MainMenu: Manual background refresh requested...');
      const fresh = await Config.refreshMenuBg();
      if (fresh) {
        setBgUrl(fresh);
        console.log('MainMenu: Background refreshed successfully:', fresh);
      }
    } catch (error) {
      console.error('MainMenu: Error refreshing background:', error);
    }
  };

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
    <View style={{ flex: 1 }}>
      {/* Background Image or High Contrast Background */}
      {settings.highContrast ? (
        <View style={[styles.bg, { backgroundColor: '#101826' }]} />
      ) : (
        <ImageBackground
          source={bgUrl ? { uri: bgUrl } : { uri: "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=1200&fit=crop&crop=center&auto=format&q=80" }}
          style={styles.bg}
          resizeMode="cover"
          onError={() => {
            console.warn('MainMenu: Background image failed to load, clearing URL');
            setBgUrl("");
          }}
        />
      )}
      
      {/* Overlay - only show if not high contrast */}
      {!settings.highContrast && <View style={styles.overlay} />}
      
      {/* Content with SafeAreaView */}
      <SafeAreaView style={styles.content} edges={["top", "bottom"]}>
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
          
          {/* Secondary buttons with icons */}
          <View style={styles.secondaryButtonsContainer}>
            <GradientButton
              title="📘 Rules"
              onPress={() => setRulesVisible(true)}
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              size="sm"
              style={styles.secondaryButtonPill}
            />

            <GradientButton
              title="⚙️ Settings"
              onPress={() => setShowSettings(true)}
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              size="sm"
              style={styles.secondaryButtonPill}
            />

            <GradientButton
              title="✉️ Feedback"
              onPress={() => setShowFeedback(true)}
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              size="sm"
              style={styles.secondaryButtonPill}
            />

            <GradientButton
              title="✏️ Level Designer"
              onPress={() => setShowLevelDesigner(true)}
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              size="sm"
              style={styles.secondaryButtonPill}
            />
          </View>
          
          {/* Refresh background link */}
          <TouchableOpacity onPress={refreshBackground} style={styles.refreshLink}>
            <Text style={styles.refreshLinkText}>Refresh background</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
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
    maxWidth: 400,
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
  secondaryButtonPill: {
    minWidth: 120,
    maxWidth: 160,
  },
  refreshLink: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  refreshLinkText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'underline',
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
