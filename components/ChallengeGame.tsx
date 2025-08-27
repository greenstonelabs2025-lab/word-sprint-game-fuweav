
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
  ScrollView,
} from 'react-native';
import { colors } from '../styles/commonStyles';
import { updatePoints } from '../utils/pointsManager';
import { track } from '../src/analytics/AnalyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChallengeGameProps {
  visible: boolean;
  challengeName: string;
  words: string[];
  onExit: () => void;
}

interface Settings {
  vibrate: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  sound: boolean;
}

interface CompletionModalProps {
  visible: boolean;
  challengeName: string;
  totalPoints: number;
  onClose: () => void;
}

const COMPLETED_CHALLENGES_KEY = 'completed_challenges';
const POINTS_PER_WORD = 20;

// Scramble function
const scramble = (word: string): string => {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join('');
};

const CompletionModal = ({ visible, challengeName, totalPoints, onClose }: CompletionModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.completionModal}>
        <Text style={styles.completionTitle}>🎉 Challenge Complete! 🎉</Text>
        <Text style={styles.completionChallenge}>"{challengeName}"</Text>
        <Text style={styles.completionPoints}>Total Points: {totalPoints}</Text>
        <TouchableOpacity
          style={styles.completionButton}
          onPress={onClose}
        >
          <Text style={styles.completionButtonText}>Awesome!</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

export default function ChallengeGame({ visible, challengeName, words, onExit }: ChallengeGameProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');
  const [totalPoints, setTotalPoints] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [settings, setSettings] = useState<Settings>({
    vibrate: true,
    reduceMotion: false,
    highContrast: false,
    sound: true,
  });
  const [showCompletion, setShowCompletion] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  const correctAnimation = useRef(new Animated.Value(0)).current;
  const wrongAnimation = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (visible && words.length > 0) {
      initializeGame();
      loadSettings();
      loadPremiumStatus();
    }
  }, [visible, words]);

  useEffect(() => {
    if (words.length > 0 && currentWordIndex < words.length) {
      const word = words[currentWordIndex];
      setScrambledWord(scramble(word));
    }
  }, [currentWordIndex, words]);

  const initializeGame = () => {
    setCurrentWordIndex(0);
    setGuess('');
    setTotalPoints(0);
    setCorrectAnswers(0);
    setShowCompletion(false);
    console.log(`Starting challenge: ${challengeName} with ${words.length} words`);
  };

  const loadSettings = async () => {
    try {
      const settingsData = await AsyncStorage.getItem('settings');
      if (settingsData) {
        setSettings(JSON.parse(settingsData));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadPremiumStatus = async () => {
    try {
      const premium = await AsyncStorage.getItem('pref_premium');
      setIsPremium(premium === 'true');
    } catch (error) {
      console.error('Failed to load premium status:', error);
    }
  };

  const animateCorrect = () => {
    if (settings.reduceMotion) return;
    
    Animated.sequence([
      Animated.timing(correctAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(correctAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateWrong = () => {
    if (settings.reduceMotion) return;
    
    Animated.sequence([
      Animated.timing(wrongAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(wrongAnimation, {
        toValue: -1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(wrongAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(wrongAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const checkAnswer = () => {
    const currentWord = words[currentWordIndex];
    const isCorrect = guess.toLowerCase().trim() === currentWord.toLowerCase();

    if (isCorrect) {
      // Correct answer
      animateCorrect();
      if (settings.vibrate) {
        Vibration.vibrate(100);
      }

      const pointsEarned = POINTS_PER_WORD;
      setTotalPoints(prev => prev + pointsEarned);
      setCorrectAnswers(prev => prev + 1);

      // Track analytics
      track('challenge_correct', {
        challenge: challengeName,
        word: currentWord,
        wordIndex: currentWordIndex,
        points: pointsEarned
      });

      // Move to next word or complete challenge
      if (currentWordIndex + 1 >= words.length) {
        // Challenge completed!
        completeChallenge();
      } else {
        setTimeout(() => {
          setCurrentWordIndex(prev => prev + 1);
          setGuess('');
        }, 1000);
      }
    } else {
      // Wrong answer
      animateWrong();
      if (settings.vibrate) {
        Vibration.vibrate([100, 50, 100]);
      }

      // Track analytics
      track('challenge_wrong', {
        challenge: challengeName,
        word: currentWord,
        guess: guess,
        wordIndex: currentWordIndex
      });

      Alert.alert('Try Again', 'That\'s not quite right. Keep trying!');
    }
  };

  const completeChallenge = async () => {
    const finalPoints = totalPoints + POINTS_PER_WORD; // Add points for the last word
    
    try {
      // Award points to user
      await updatePoints(finalPoints);

      // Save completion record
      const completedChallenge = {
        name: challengeName,
        completedAt: new Date().toISOString(),
        points: finalPoints
      };

      const existing = await AsyncStorage.getItem(COMPLETED_CHALLENGES_KEY);
      const completed = existing ? JSON.parse(existing) : [];
      
      // Remove any existing completion for this challenge
      const filtered = completed.filter((c: any) => c.name !== challengeName);
      filtered.push(completedChallenge);
      
      await AsyncStorage.setItem(COMPLETED_CHALLENGES_KEY, JSON.stringify(filtered));

      // Track analytics
      track('challenge_complete', {
        challenge: challengeName,
        totalWords: words.length,
        totalPoints: finalPoints
      });

      console.log(`Challenge "${challengeName}" completed with ${finalPoints} points`);
      
      // Show completion modal
      setTotalPoints(finalPoints);
      setShowCompletion(true);

    } catch (error) {
      console.error('Failed to save challenge completion:', error);
      Alert.alert('Error', 'Failed to save progress. Please try again.');
    }
  };

  const useHint = () => {
    if (!isPremium) {
      Alert.alert(
        'Premium Feature',
        'Hints are available for Premium users only. Upgrade to unlock hints and other exclusive features!',
        [{ text: 'OK' }]
      );
      return;
    }

    // Premium users get hints (implementation would go here)
    Alert.alert('Hint', 'Premium hint feature coming soon!');
  };

  const handleExit = () => {
    Alert.alert(
      'Exit Challenge',
      'Are you sure you want to exit? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: onExit }
      ]
    );
  };

  const handleCompletionClose = () => {
    setShowCompletion(false);
    onExit();
  };

  if (!visible || words.length === 0) {
    return null;
  }

  const currentWord = words[currentWordIndex];
  const progress = ((currentWordIndex + 1) / words.length) * 100;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleExit}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExit}
          >
            <Text style={styles.exitButtonText}>✕</Text>
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.challengeTitle}>{challengeName}</Text>
            <Text style={styles.progressText}>
              {currentWordIndex + 1} of {words.length}
            </Text>
          </View>
          
          <View style={styles.pointsContainer}>
            <Text style={styles.pointsText}>{totalPoints} pts</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        {/* Game Content */}
        <ScrollView contentContainerStyle={styles.gameContent}>
          <Animated.View
            style={[
              styles.wordContainer,
              {
                backgroundColor: correctAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.surface, colors.success + '20'],
                }),
                transform: [
                  {
                    translateX: wrongAnimation.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-10, 0, 10],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.scrambledText}>{scrambledWord}</Text>
          </Animated.View>

          <TextInput
            style={styles.input}
            value={guess}
            onChangeText={setGuess}
            placeholder="Enter your guess..."
            placeholderTextColor={colors.grey}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={checkAnswer}
            returnKeyType="done"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={checkAnswer}
              disabled={!guess.trim()}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hintButton, !isPremium && styles.disabledButton]}
              onPress={useHint}
            >
              <Text style={[styles.hintButtonText, !isPremium && styles.disabledButtonText]}>
                {isPremium ? 'Hint' : 'Hint (Premium)'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              +{POINTS_PER_WORD} points per correct word
            </Text>
            <Text style={styles.infoText}>
              {correctAnswers} correct • {words.length - correctAnswers} remaining
            </Text>
          </View>
        </ScrollView>

        {/* Completion Modal */}
        <CompletionModal
          visible={showCompletion}
          challengeName={challengeName}
          totalPoints={totalPoints}
          onClose={handleCompletionClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exitButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitButtonText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  progressText: {
    fontSize: 14,
    color: colors.grey,
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  gameContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  wordContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    marginBottom: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  scrambledText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  hintButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  hintButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabledButton: {
    backgroundColor: colors.grey + '30',
  },
  disabledButtonText: {
    color: colors.grey,
  },
  infoContainer: {
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.grey,
    textAlign: 'center',
  },
  // Completion Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completionModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  completionChallenge: {
    fontSize: 18,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  completionPoints: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.success,
    textAlign: 'center',
    marginBottom: 24,
  },
  completionButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 120,
  },
  completionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
});
