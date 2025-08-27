
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, commonStyles } from '../styles/commonStyles';
import wordsData from '../data/words.json';

interface Level {
  word: string;
  scramble: string;
}

interface Stage {
  stage: number;
  theme: string;
  levels: Level[];
}

interface GameState {
  currentStage: number;
  currentLevel: number;
  points: number;
  streak: number;
  completedLevels: Set<string>;
}

interface ConfirmationPopupProps {
  visible: boolean;
  title: string;
  cost: number;
  currentPoints: number;
  onConfirm: () => void;
  onCancel: () => void;
}

interface WordSprintGameProps {
  onExit?: () => void;
}

const STORAGE_KEYS = {
  GAME_STATE: 'word_sprint_game_state',
  POINTS: 'word_sprint_points',
  PROGRESS: 'progress', // For compatibility with MainMenu
};

// Theme background colors mapping
const themeColors: { [key: string]: string } = {
  Animals: '#1b5e20',
  Food: '#6d4c41',
  Space: '#0d47a1',
  Sports: '#004d40',
  Mythology: '#4a148c',
  Countries: '#263238',
  Jobs: '#37474f',
  Clothing: '#3e2723',
  Music: '#1a237e',
  Technology: '#1b1b1b',
  Body: '#827717',
  Weather: '#01579b',
  Transport: '#263238',
  History: '#4e342e',
  Plants: '#2e7d32',
  Colours: '#212121',
  Oceans: '#003c8f',
  Fantasy: '#311b92',
  Insects: '#33691e',
  Mixed: '#424242',
};

// Enhanced scramble function that ensures the result is always different from the original
function scramble(word: string): string {
  if (word.length <= 1) return word;
  
  let scrambledWord = word;
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loops
  
  do {
    scrambledWord = word
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    attempts++;
  } while (scrambledWord === word && attempts < maxAttempts);
  
  // If we still have the original word after max attempts, manually scramble
  if (scrambledWord === word) {
    const letters = word.split("");
    // Swap first two characters if possible
    if (letters.length >= 2) {
      [letters[0], letters[1]] = [letters[1], letters[0]];
      scrambledWord = letters.join("");
    }
  }
  
  console.log(`Scrambled "${word}" to "${scrambledWord}"`);
  return scrambledWord;
}

// Confirmation Popup Component
function ConfirmationPopup({ visible, title, cost, currentPoints, onConfirm, onCancel }: ConfirmationPopupProps) {
  const hasEnoughPoints = currentPoints >= cost;
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalCost}>Cost: {cost} points</Text>
          <Text style={styles.modalPoints}>Your points: {currentPoints}</Text>
          
          {!hasEnoughPoints && (
            <Text style={styles.modalWarning}>Not enough points!</Text>
          )}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalButton, 
                styles.confirmButton,
                !hasEnoughPoints && styles.disabledModalButton
              ]}
              onPress={hasEnoughPoints ? onConfirm : () => {
                Alert.alert("Not enough points", "You need more points to use this feature.");
                onCancel();
              }}
            >
              <Text style={[
                styles.modalButtonText,
                !hasEnoughPoints && styles.disabledModalButtonText
              ]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function WordSprintGame({ onExit }: WordSprintGameProps) {
  const [gameState, setGameState] = useState<GameState>({
    currentStage: 0,
    currentLevel: 0,
    points: 100, // Start with some points
    streak: 0,
    completedLevels: new Set(),
  });

  const [userInput, setUserInput] = useState('');
  const [message, setMessage] = useState('');
  const [revealedLetters, setRevealedLetters] = useState<number[]>([]);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [currentScrambledWord, setCurrentScrambledWord] = useState('');
  
  // Popup states
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [showAnswerPopup, setShowAnswerPopup] = useState(false);

  const stages: Stage[] = wordsData as Stage[];
  const currentStageData = stages[gameState.currentStage];
  const currentLevelData = currentStageData?.levels[gameState.currentLevel];
  const currentThemeColor = currentStageData ? themeColors[currentStageData.theme] || '#424242' : '#424242';

  useEffect(() => {
    loadGameState();
  }, []);

  useEffect(() => {
    saveGameState();
  }, [gameState]);

  // Generate new scrambled word when level changes
  useEffect(() => {
    if (currentLevelData) {
      setCurrentScrambledWord(scramble(currentLevelData.word));
      setRevealedLetters([]);
      setIsAnswerRevealed(false);
      setMessage('');
      setUserInput('');
    }
  }, [gameState.currentStage, gameState.currentLevel]);

  const loadGameState = async () => {
    try {
      // First try to load from the new progress format (MainMenu compatibility)
      const progressData = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (progressData) {
        const { stage, level, points } = JSON.parse(progressData);
        console.log('Loaded progress from MainMenu format:', { stage, level, points });
        setGameState(prev => ({
          ...prev,
          currentStage: stage,
          currentLevel: level,
          points: points,
        }));
        return;
      }

      // Fallback to old game state format
      const savedState = await AsyncStorage.getItem(STORAGE_KEYS.GAME_STATE);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        console.log('Loaded game state from old format:', parsed);
        setGameState({
          ...parsed,
          completedLevels: new Set(parsed.completedLevels || []),
        });
      }
    } catch (error) {
      console.log('Error loading game state:', error);
    }
  };

  const saveGameState = async () => {
    try {
      // Save in both formats for compatibility
      const stateToSave = {
        ...gameState,
        completedLevels: Array.from(gameState.completedLevels),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(stateToSave));
      
      // Also save in MainMenu compatible format
      const progressData = {
        stage: gameState.currentStage,
        level: gameState.currentLevel,
        points: gameState.points,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progressData));
      
      console.log('Game state saved:', progressData);
    } catch (error) {
      console.log('Error saving game state:', error);
    }
  };

  const handleMenuPress = async () => {
    // Save progress before exiting
    await saveGameState();
    console.log('Progress saved, returning to menu');
    onExit?.();
  };

  const checkAnswer = () => {
    if (!currentLevelData) return;

    const userAnswer = userInput.toLowerCase().trim();
    const correctAnswer = currentLevelData.word.toLowerCase();

    if (userAnswer === correctAnswer) {
      const basePoints = 10;
      const stageMultiplier = gameState.currentStage + 1;
      let streakBonus = 0;
      
      // Streak bonus: +5 every 3 correct
      const newStreak = gameState.streak + 1;
      if (newStreak % 3 === 0) {
        streakBonus = 5;
      }
      
      const totalPoints = basePoints * stageMultiplier + streakBonus;

      setMessage(`Correct! +${totalPoints} points${streakBonus > 0 ? ` (${streakBonus} streak bonus!)` : ''}`);
      
      const levelKey = `${gameState.currentStage}-${gameState.currentLevel}`;
      
      setGameState(prev => ({
        ...prev,
        points: prev.points + totalPoints,
        streak: newStreak,
        completedLevels: new Set([...prev.completedLevels, levelKey]),
      }));

      // Move to next level after a delay
      setTimeout(() => {
        moveToNextLevel();
      }, 1500);
    } else {
      setMessage('Try again!');
      setGameState(prev => ({ ...prev, streak: 0 }));
      
      // Re-scramble the word on wrong answer
      if (currentLevelData) {
        setCurrentScrambledWord(scramble(currentLevelData.word));
        console.log('Wrong answer - re-scrambling word');
      }
    }
  };

  const moveToNextLevel = () => {
    setUserInput('');
    setMessage('');
    setRevealedLetters([]);
    setIsAnswerRevealed(false);

    setGameState(prev => {
      if (prev.currentLevel < 14) {
        // Move to next level in current stage
        return { ...prev, currentLevel: prev.currentLevel + 1 };
      } else if (prev.currentStage < stages.length - 1) {
        // Move to next stage
        return { 
          ...prev, 
          currentStage: prev.currentStage + 1, 
          currentLevel: 0 
        };
      } else {
        // Game completed
        Alert.alert('Congratulations!', 'You have completed all stages!');
        return prev;
      }
    });
  };

  const handleHintConfirm = () => {
    setShowHintPopup(false);
    
    if (!currentLevelData) return;

    const word = currentLevelData.word;
    const availablePositions = [];
    
    for (let i = 0; i < word.length; i++) {
      if (!revealedLetters.includes(i)) {
        availablePositions.push(i);
      }
    }

    if (availablePositions.length === 0) {
      setMessage('All letters already revealed!');
      return;
    }

    const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
    
    setRevealedLetters(prev => [...prev, randomPosition]);
    setGameState(prev => ({ ...prev, points: prev.points - 50 }));
    setMessage('Hint used! One letter revealed.');
    
    console.log('Hint used - 50 points deducted');
  };

  const handleAnswerConfirm = () => {
    setShowAnswerPopup(false);
    
    if (!currentLevelData) return;

    setIsAnswerRevealed(true);
    setUserInput(currentLevelData.word);
    setGameState(prev => ({ ...prev, points: prev.points - 200 }));
    setMessage('Answer revealed! Moving to next level...');

    const levelKey = `${gameState.currentStage}-${gameState.currentLevel}`;
    setGameState(prev => ({
      ...prev,
      completedLevels: new Set([...prev.completedLevels, levelKey]),
    }));

    console.log('Answer revealed - 200 points deducted');

    setTimeout(() => {
      moveToNextLevel();
    }, 2000);
  };

  const useHint = () => {
    setShowHintPopup(true);
  };

  const revealAnswer = () => {
    setShowAnswerPopup(true);
  };

  const renderScrambledWord = () => {
    if (!currentLevelData || !currentScrambledWord) return null;

    const scrambledLetters = currentScrambledWord.split('');
    const word = currentLevelData.word;

    return (
      <View style={styles.scrambledContainer}>
        {scrambledLetters.map((letter, index) => {
          // Find if this letter position should be revealed
          const wordIndex = word.toLowerCase().indexOf(letter.toLowerCase());
          const isRevealed = revealedLetters.includes(wordIndex) || isAnswerRevealed;
          
          return (
            <View key={index} style={[styles.letterBox, isRevealed && styles.revealedLetterBox]}>
              <Text style={[styles.letterText, isRevealed && styles.revealedLetterText]}>
                {isRevealed ? word[wordIndex]?.toUpperCase() || letter.toUpperCase() : letter.toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (!currentStageData || !currentLevelData) {
    return (
      <View style={[styles.container, { backgroundColor: currentThemeColor }]}>
        <View style={styles.gameCard}>
          <Text style={styles.gameTitle}>Game Complete!</Text>
          <Text style={styles.completionText}>
            Congratulations! You&apos;ve completed all {stages.length} stages!
          </Text>
          <Text style={styles.finalScore}>
            Final Score: {gameState.points} points
          </Text>
          {onExit && (
            <Pressable style={[styles.actionButton, styles.submitButton]} onPress={onExit}>
              <Text style={styles.actionButtonText}>Back to Menu</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentThemeColor }]}>
      {/* Top HUD Bar */}
      <View style={styles.hudBar}>
        {/* Left: Menu Button */}
        <View style={styles.hudLeft}>
          {onExit && (
            <Pressable style={styles.menuButton} onPress={handleMenuPress}>
              <Text style={styles.menuButtonText}>Menu</Text>
            </Pressable>
          )}
        </View>

        {/* Center: Title */}
        <View style={styles.hudCenter}>
          <Text style={styles.hudTitle}>WORD SPRINT</Text>
        </View>

        {/* Right: Points and Streak Pill */}
        <View style={styles.hudRight}>
          <View style={styles.pointsPill}>
            <Text style={styles.pointsText}>{gameState.points}</Text>
            <Text style={styles.streakText}>Streak: {gameState.streak}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Game Card with Overlay */}
        <View style={styles.gameCard}>
          {/* Stage and Level Info */}
          <Text style={styles.stageLabel}>Stage {gameState.currentStage + 1} • {currentStageData.theme}</Text>
          <Text style={styles.levelLabel}>Level {gameState.currentLevel + 1} of 15</Text>

          {/* Scrambled Word Display */}
          <Text style={styles.scrambledWordTitle}>
            {currentScrambledWord.toUpperCase()}
          </Text>

          {/* User Input */}
          <TextInput
            style={styles.input}
            value={userInput}
            onChangeText={setUserInput}
            placeholder="Unscramble…"
            placeholderTextColor="rgba(0,0,0,0.5)"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={true}
            returnKeyType="done"
            onSubmitEditing={checkAnswer}
            editable={!isAnswerRevealed}
          />

          {/* Message Display */}
          {message ? (
            <Text style={[
              styles.message, 
              message.includes('Correct') && styles.successMessage,
              message.includes('Try again') && styles.errorMessage
            ]}>
              {message}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable 
              style={[styles.actionButton, styles.submitButton, isAnswerRevealed && styles.disabledButton]} 
              onPress={checkAnswer}
              disabled={isAnswerRevealed}
            >
              <Text style={styles.actionButtonText}>Submit</Text>
            </Pressable>

            <Pressable 
              style={[styles.actionButton, styles.hintButton, isAnswerRevealed && styles.disabledButton]} 
              onPress={useHint}
              disabled={isAnswerRevealed}
            >
              <Text style={styles.actionButtonText}>Hint</Text>
            </Pressable>

            <Pressable 
              style={[styles.actionButton, styles.answerButton, isAnswerRevealed && styles.disabledButton]} 
              onPress={revealAnswer}
              disabled={isAnswerRevealed}
            >
              <Text style={styles.actionButtonText}>Answer</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Popups */}
      <ConfirmationPopup
        visible={showHintPopup}
        title="Use Hint"
        cost={50}
        currentPoints={gameState.points}
        onConfirm={handleHintConfirm}
        onCancel={() => setShowHintPopup(false)}
      />

      <ConfirmationPopup
        visible={showAnswerPopup}
        title="Reveal Answer"
        cost={200}
        currentPoints={gameState.points}
        onConfirm={handleAnswerConfirm}
        onCancel={() => setShowAnswerPopup(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 8,
  },
  
  // HUD Bar Styles
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  hudLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  hudCenter: {
    flex: 2,
    alignItems: 'center',
  },
  hudRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  hudTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: 'white',
    textAlign: 'center',
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  menuButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pointsPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  pointsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  streakText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },

  // Game Card Styles
  gameCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    boxShadow: '0px 4px 8px rgba(0,0,0,0.1)',
    elevation: 3,
  },
  stageLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 4,
  },
  levelLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  scrambledWordTitle: {
    fontSize: 44,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 4,
  },

  // Input Styles
  input: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Message Styles
  message: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  successMessage: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  errorMessage: {
    color: '#FF5722',
    fontWeight: 'bold',
  },

  // Button Styles
  buttonContainer: {
    gap: 8,
  },
  actionButton: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  submitButton: {
    backgroundColor: '#00e676',
  },
  hintButton: {
    backgroundColor: '#ffd54f',
  },
  answerButton: {
    backgroundColor: '#ff8a80',
  },
  disabledButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    opacity: 0.5,
  },

  // Completion Styles
  gameTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 16,
  },
  completionText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
  },
  finalScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 30,
  },

  // Legacy styles for scrambled word display (keeping for compatibility)
  scrambledContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
  },
  letterBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  revealedLetterBox: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  letterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  revealedLetterText: {
    color: 'white',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
    maxWidth: 320,
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCost: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: '600',
    marginBottom: 8,
  },
  modalPoints: {
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  modalWarning: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  disabledModalButton: {
    backgroundColor: '#9E9E9E',
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disabledModalButtonText: {
    color: '#666',
  },
});
