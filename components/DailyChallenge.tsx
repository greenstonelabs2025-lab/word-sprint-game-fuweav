
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  Vibration,
  Alert,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import {
  generateDailyWord,
  getTodayKey,
  isDailyChallengeCompleted,
  markDailyChallengeCompleted,
  awardDailyChallengePoints,
  scrambleDailyWord,
  cleanupOldDailyChallengeData,
} from '../utils/dailyChallenge';

interface DailyChallengeProps {
  onExit: () => void;
}

interface Settings {
  vibrate: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  sound: boolean;
}

interface PremiumModalProps {
  visible: boolean;
  onClose: () => void;
}

// Premium Modal Component
function PremiumModal({ visible, onClose }: PremiumModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.premiumModalContent}>
          <Text style={styles.premiumModalTitle}>Premium Coming Soon</Text>
          <Text style={styles.premiumModalText}>
            Get unlimited hints, answers and Daily Challenge boosts.
          </Text>
          <View style={styles.premiumModalButtons}>
            <TouchableOpacity
              style={[styles.premiumModalButton, styles.closeButton]}
              onPress={onClose}
            >
              <Text style={styles.premiumModalButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.premiumModalButton, styles.notifyButton]}
              onPress={() => {
                console.log('User wants to be notified about Premium');
                Alert.alert('Thanks!', 'We\'ll notify you when Premium is available.');
                onClose();
              }}
            >
              <Text style={styles.premiumModalButtonText}>Notify Me</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function DailyChallenge({ onExit }: DailyChallengeProps) {
  const { height } = useWindowDimensions();
  const [dailyWord, setDailyWord] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');
  const [input, setInput] = useState('');
  const [points, setPoints] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isAdFree, setIsAdFree] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    vibrate: true,
    reduceMotion: false,
    highContrast: false,
    sound: false,
  });

  // Animation values
  const scaleWord = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeDaily();
    loadSettings();
    loadAdFreeStatus();
    // Clean up old data on app start (optional)
    cleanupOldDailyChallengeData();
  }, []);

  const loadSettings = async () => {
    try {
      const keys = ['pref_vibrate', 'pref_reduce_motion', 'pref_high_contrast', 'pref_sound'];
      const values = await AsyncStorage.multiGet(keys);
      
      const loadedSettings: Settings = {
        vibrate: values[0][1] === 'true' || values[0][1] === null,
        reduceMotion: values[1][1] === 'true',
        highContrast: values[2][1] === 'true',
        sound: values[3][1] === 'true',
      };
      
      setSettings(loadedSettings);
      console.log('Settings loaded in daily challenge:', loadedSettings);
    } catch (error) {
      console.error('Error loading settings in daily challenge:', error);
    }
  };

  const loadAdFreeStatus = async () => {
    try {
      const adFreeValue = await AsyncStorage.getItem('pref_ad_free');
      setIsAdFree(adFreeValue === 'true');
      console.log('Ad-free status loaded:', adFreeValue === 'true');
    } catch (error) {
      console.error('Error loading ad-free status:', error);
    }
  };

  const initializeDaily = async () => {
    try {
      // Check if already completed today
      const completed = await isDailyChallengeCompleted();
      if (completed) {
        setIsCompleted(true);
        console.log('Daily challenge already completed for today');
        
        // Load current points for display
        const progressData = await AsyncStorage.getItem('progress');
        if (progressData) {
          const progress = JSON.parse(progressData);
          setPoints(progress.points || 0);
        }
        return;
      }

      // Generate today's word
      const word = generateDailyWord();
      const scrambled = scrambleDailyWord(word);
      
      setDailyWord(word);
      setScrambledWord(scrambled);
      
      // Load current points
      const progressData = await AsyncStorage.getItem('progress');
      if (progressData) {
        const progress = JSON.parse(progressData);
        setPoints(progress.points || 0);
      }
      
      console.log('Daily challenge initialized:', { word, scrambled });
    } catch (error) {
      console.error('Error initializing daily challenge:', error);
      // Fallback
      const word = 'challenge';
      setDailyWord(word);
      setScrambledWord(scrambleDailyWord(word));
    }
  };

  const animateCorrect = () => {
    if (settings.reduceMotion) return;
    
    Animated.sequence([
      Animated.timing(scaleWord, {
        toValue: 1.15,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(scaleWord, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      })
    ]).start();
  };

  const animateWrong = () => {
    if (settings.vibrate) {
      Vibration.vibrate(30);
    }

    if (!settings.reduceMotion) {
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        })
      ]).start();
    }

    // Re-scramble on wrong answer
    setScrambledWord(scrambleDailyWord(dailyWord));
  };

  const handleSubmit = async () => {
    if (isCompleted) return;

    if (input.toLowerCase().trim() === dailyWord.toLowerCase()) {
      // Correct answer!
      animateCorrect();
      
      try {
        // Mark as completed and award points
        await markDailyChallengeCompleted();
        const newPoints = await awardDailyChallengePoints(100);
        
        setPoints(newPoints);
        setIsCompleted(true);
        setShowSuccessModal(true);
        
        console.log('Daily challenge completed! 100 points awarded');
      } catch (error) {
        console.error('Error completing daily challenge:', error);
        // Still show success even if save fails (fallback)
        setIsCompleted(true);
        setShowSuccessModal(true);
        Alert.alert('Success!', 'Challenge completed! (Note: Progress may not have saved)');
      }
    } else {
      // Wrong answer
      animateWrong();
      console.log('Wrong answer in daily challenge');
    }
  };

  const createPressHandlers = () => ({
    onPressIn: () => {
      if (!settings.reduceMotion) {
        Animated.spring(pressScale, {
          toValue: 0.96,
          speed: 20,
          useNativeDriver: true,
        }).start();
      }
    },
    onPressOut: () => {
      if (!settings.reduceMotion) {
        Animated.spring(pressScale, {
          toValue: 1,
          speed: 20,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  // Get theme background color (use a default theme color for daily)
  const getThemeBackground = () => {
    if (settings.highContrast) {
      return '#1a1a1a';
    }
    return '#4a148c'; // Purple theme for daily challenge
  };

  const wordTransform = [
    { scale: scaleWord },
    { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }
  ];

  if (isCompleted && !showSuccessModal) {
    return (
      <View style={[styles.container, { backgroundColor: getThemeBackground() }]}>
        {/* HUD Bar */}
        <View style={styles.hudBar}>
          <TouchableOpacity style={styles.menuButton} onPress={onExit}>
            <Text style={styles.menuButtonText}>Menu</Text>
          </TouchableOpacity>
          
          <Text style={styles.gameTitle}>DAILY CHALLENGE</Text>
          
          <View style={styles.hudRight}>
            <View style={styles.pointsPill}>
              <Text style={styles.pointsText}>{points}</Text>
            </View>
          </View>
        </View>

        <View style={styles.completedContainer}>
          <Text style={styles.completedTitle}>Challenge Complete! ✓</Text>
          <Text style={styles.completedText}>You earned 100 bonus points today.</Text>
          <Text style={styles.completedText}>Come back tomorrow for a new challenge!</Text>
          
          <View style={styles.leaderboardContainer}>
            <Text style={styles.leaderboardText}>
              Your score will appear on tomorrow's leaderboard.
            </Text>
            {!isAdFree && (
              <Text style={[styles.leaderboardNote, { color: 'rgba(255,255,255,0.6)' }]}>
                Leaderboard requires Premium.
              </Text>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={onExit}
          >
            <Text style={styles.backButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[getThemeBackground(), '#000000']}
      style={styles.container}
    >
      {/* HUD Bar */}
      <View style={styles.hudBar}>
        <TouchableOpacity style={styles.menuButton} onPress={onExit}>
          <Text style={styles.menuButtonText}>Menu</Text>
        </TouchableOpacity>
        
        <Text style={styles.gameTitle}>DAILY CHALLENGE</Text>
        
        <View style={styles.hudRight}>
          <View style={styles.pointsPill}>
            <Text style={styles.pointsText}>{points}</Text>
          </View>
        </View>
      </View>

      {/* Game Content */}
      <View style={styles.gameContent}>
        <Text style={styles.dailyTitle}>Today's Challenge</Text>
        
        <View style={styles.wordCard}>
          <Animated.Text style={[styles.scrambledWord, { transform: wordTransform }]}>
            {scrambledWord}
          </Animated.Text>
        </View>
        
        <TextInput
          style={[
            styles.input,
            settings.highContrast && { borderColor: '#ffffff', borderWidth: 2 }
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Unscramble…"
          placeholderTextColor="rgba(255,255,255,0.6)"
          autoFocus={true}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!isCompleted}
        />
        
        <Pressable
          style={[
            styles.submitButton,
            isCompleted && styles.disabledButton
          ]}
          onPress={handleSubmit}
          disabled={isCompleted}
          {...createPressHandlers()}
        >
          <Animated.View style={{ transform: [{ scale: pressScale }] }}>
            <Text style={[
              styles.submitButtonText,
              settings.highContrast && { color: '#ffffff' }
            ]}>
              Submit
            </Text>
          </Animated.View>
        </Pressable>

        {/* Premium Upsell - Only show if not ad-free */}
        {!isAdFree && (
          <View style={styles.upsellContainer}>
            <Text style={[
              styles.upsellText,
              { fontStyle: 'italic', color: settings.highContrast ? '#cccccc' : 'rgba(255,255,255,0.7)' }
            ]}>
              Want Hints in Daily? Unlock Premium.
            </Text>
            
            <TouchableOpacity
              style={styles.premiumButton}
              onPress={() => setShowPremiumModal(true)}
            >
              <Text style={styles.premiumButtonText}>Go Premium</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Leaderboard Placeholder */}
        <View style={styles.leaderboardContainer}>
          <Text style={styles.leaderboardText}>
            Your score will appear on tomorrow's leaderboard.
          </Text>
          {!isAdFree && (
            <Text style={[styles.leaderboardNote, { color: 'rgba(255,255,255,0.6)' }]}>
              Leaderboard requires Premium.
            </Text>
          )}
        </View>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <Text style={styles.successModalTitle}>Congrats!</Text>
            <Text style={styles.successModalText}>You earned 100 bonus points.</Text>
            <Text style={styles.leaderboardText}>
              Your score will appear on tomorrow's leaderboard.
            </Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                setShowSuccessModal(false);
                // Stay on the completed screen
              }}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Premium Modal - Only show if not ad-free */}
      {!isAdFree && (
        <PremiumModal
          visible={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  hudBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  menuButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dailyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 30,
    textAlign: 'center',
  },
  wordCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrambledWord: {
    fontSize: 42,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#00e676',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#666666',
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  upsellContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  upsellText: {
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  premiumButton: {
    backgroundColor: '#ffd54f',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  premiumButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  leaderboardContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  leaderboardText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 4,
  },
  leaderboardNote: {
    fontSize: 12,
    textAlign: 'center',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  completedTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00e676',
    marginBottom: 20,
    textAlign: 'center',
  },
  completedText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  backButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
    alignItems: 'center',
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00e676',
    marginBottom: 16,
    textAlign: 'center',
  },
  successModalText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#00e676',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  premiumModalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
    alignItems: 'center',
  },
  premiumModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  premiumModalText: {
    fontSize: 16,
    color: colors.grey,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  premiumModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  premiumModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: colors.grey + '40',
  },
  notifyButton: {
    backgroundColor: colors.accent,
  },
  premiumModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
