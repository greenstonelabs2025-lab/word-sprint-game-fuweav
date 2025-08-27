
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
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

const STORAGE_KEYS = {
  GAME_STATE: 'word_sprint_game_state',
  POINTS: 'word_sprint_points',
};

// Scramble function as requested
function scramble(word: string): string {
  return word.split("").sort(() => Math.random() - 0.5).join("");
}

export default function WordSprintGame() {
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

  const stages: Stage[] = wordsData as Stage[];
  const currentStageData = stages[gameState.currentStage];
  const currentLevelData = currentStageData?.levels[gameState.currentLevel];

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
      const savedState = await AsyncStorage.getItem(STORAGE_KEYS.GAME_STATE);
      if (savedState) {
        const parsed = JSON.parse(savedState);
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
      const stateToSave = {
        ...gameState,
        completedLevels: Array.from(gameState.completedLevels),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(stateToSave));
    } catch (error) {
      console.log('Error saving game state:', error);
    }
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

  const useHint = () => {
    if (gameState.points < 50) {
      Alert.alert('Not enough points!', 'You need at least 50 points to use a hint.');
      return;
    }

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
  };

  const revealAnswer = () => {
    if (gameState.points < 200) {
      Alert.alert('Not enough points!', 'You need at least 200 points to reveal the answer.');
      return;
    }

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

    setTimeout(() => {
      moveToNextLevel();
    }, 2000);
  };

  const purchaseHints = () => {
    // Placeholder for future monetization
    Alert.alert('Coming Soon', 'Hint purchasing will be available in a future update!');
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

  const getStreakBonus = () => {
    return Math.floor(gameState.streak / 3) * 5;
  };

  if (!currentStageData || !currentLevelData) {
    return (
      <View style={commonStyles.container}>
        <Text style={commonStyles.title}>Game Complete!</Text>
        <Text style={styles.completionText}>
          Congratulations! You've completed all {stages.length} stages!
        </Text>
        <Text style={styles.finalScore}>
          Final Score: {gameState.points} points
        </Text>
        <Button text="Back to Home" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.wrapper} contentContainerStyle={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.stageText}>
            Stage {gameState.currentStage + 1} - {currentStageData.theme}
          </Text>
          <Text style={styles.pointsText}>
            {gameState.points} pts
          </Text>
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.levelText}>
            Level {gameState.currentLevel + 1}/15
          </Text>
          <Text style={styles.streakText}>
            Streak: {gameState.streak} {getStreakBonus() > 0 && `(+${getStreakBonus()} bonus)`}
          </Text>
        </View>
      </View>

      {/* Scrambled Word Display */}
      <View style={styles.gameArea}>
        <Text style={styles.instructionText}>Unscramble this word:</Text>
        {renderScrambledWord()}
        
        {/* User Input */}
        <TextInput
          style={styles.input}
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type your answer here..."
          placeholderTextColor={colors.grey}
          autoCapitalize="none"
          autoCorrect={false}
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
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          text="Submit Answer"
          onPress={checkAnswer}
          style={[styles.submitButton, isAnswerRevealed && styles.disabledButton]}
        />
        
        <View style={styles.hintButtonRow}>
          <Button
            text={`Hint (50 pts)`}
            onPress={useHint}
            style={[
              styles.hintButton, 
              (gameState.points < 50 || isAnswerRevealed) && styles.disabledButton
            ]}
          />
          <Button
            text={`Answer (200 pts)`}
            onPress={revealAnswer}
            style={[
              styles.answerButton, 
              (gameState.points < 200 || isAnswerRevealed) && styles.disabledButton
            ]}
          />
        </View>

        <Button
          text="Purchase More Hints"
          onPress={purchaseHints}
          style={styles.purchaseButton}
        />

        <Button
          text="Back to Home"
          onPress={() => router.back()}
          style={styles.backButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
  },
  levelText: {
    fontSize: 16,
    color: colors.text,
  },
  streakText: {
    fontSize: 14,
    color: colors.grey,
  },
  gameArea: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  scrambledContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
  },
  letterBox: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 2,
    borderColor: colors.grey,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  revealedLetterBox: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  letterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  revealedLetterText: {
    color: colors.white,
  },
  input: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 2,
    borderColor: colors.grey,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    width: '100%',
    textAlign: 'center',
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  successMessage: {
    color: colors.accent,
    fontWeight: 'bold',
  },
  errorMessage: {
    color: colors.error || '#ff4444',
    fontWeight: 'bold',
  },
  buttonContainer: {
    width: '100%',
  },
  submitButton: {
    backgroundColor: colors.primary,
    marginBottom: 10,
  },
  hintButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  hintButton: {
    backgroundColor: colors.secondary,
    flex: 0.48,
  },
  answerButton: {
    backgroundColor: colors.accent,
    flex: 0.48,
  },
  disabledButton: {
    backgroundColor: colors.grey,
    opacity: 0.5,
  },
  purchaseButton: {
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  backButton: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.grey,
  },
  completionText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  finalScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 30,
  },
});
