
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from './components/Button';
import { colors, commonStyles } from './styles/commonStyles';

// Word bank with all themes
const wordBank = {
  Animals: ["cat", "dog", "lion", "wolf", "bear", "tiger", "shark", "snake", "zebra", "mouse", "whale", "camel", "panda", "rhino", "eagle"],
  Food: ["meat", "milk", "egg", "rice", "fish", "bread", "apple", "cheese", "butter", "onion", "pizza", "sugar", "spice", "grape", "lemon"],
  Space: ["star", "moon", "mars", "venus", "earth", "orbit", "nova", "comet", "galaxy", "neptune", "uranus", "rocket", "planet", "cosmos", "asteroid"],
  Sports: ["golf", "tennis", "rugby", "cricket", "boxing", "hockey", "soccer", "cycling", "skiing", "rowing", "wrestle", "karate", "judo", "surfing", "archery"],
  Mythology: ["zeus", "hera", "odin", "thor", "loki", "apollo", "ares", "poseidon", "hades", "freya", "atlas", "hermes", "nike", "gaia", "eros"],
  Countries: ["wales", "spain", "china", "france", "brazil", "italy", "egypt", "japan", "greece", "india", "chile", "cuba", "turkey", "kenya", "norway"],
  Jobs: ["nurse", "pilot", "chef", "farmer", "doctor", "actor", "judge", "miner", "teacher", "driver", "baker", "police", "singer", "artist", "clerk"],
  Clothing: ["shirt", "jeans", "hat", "gloves", "shoes", "socks", "scarf", "skirt", "dress", "jacket", "shorts", "boots", "tie", "belt", "coat"],
  Music: ["song", "band", "drum", "guitar", "piano", "violin", "singer", "lyric", "opera", "metal", "jazz", "blues", "choir", "dance", "pop"],
  Technology: ["phone", "app", "code", "mouse", "email", "wifi", "cloud", "robot", "server", "bytes", "pixel", "data", "drive", "ai", "web"],
  Body: ["head", "arm", "leg", "hand", "eye", "ear", "nose", "tooth", "heart", "lungs", "skin", "bone", "blood", "brain", "foot"],
  Weather: ["rain", "snow", "wind", "storm", "sunny", "cloud", "fog", "hail", "heat", "frost", "ice", "cold", "warm", "temp", "humid"],
  Transport: ["car", "bus", "bike", "train", "plane", "ship", "truck", "taxi", "boat", "metro", "tram", "van", "ferry", "jeep", "canoe"],
  History: ["war", "king", "queen", "rome", "egypt", "slave", "crown", "empire", "sword", "knight", "castle", "troop", "tank", "gun", "fort"],
  Plants: ["tree", "rose", "oak", "seed", "leaf", "root", "stem", "corn", "wheat", "grass", "fern", "ivy", "moss", "vine", "bush"],
  Colours: ["red", "blue", "green", "black", "white", "yellow", "brown", "pink", "grey", "gold", "silver", "purple", "navy", "lime", "aqua"],
  Oceans: ["wave", "reef", "fish", "shark", "whale", "seal", "kelp", "crab", "ship", "port", "sail", "dock", "bay", "tide", "coral"],
  Fantasy: ["elf", "orc", "troll", "fairy", "giant", "witch", "dwarf", "dragon", "magic", "spell", "sword", "quest", "beast", "ghost", "curse"],
  Insects: ["ant", "bee", "fly", "wasp", "moth", "worm", "bug", "gnat", "termite", "roach", "flea", "tick", "grub", "beetle", "spider"],
  Mixed: ["quiz", "idea", "note", "word", "play", "test", "goal", "luck", "mind", "game", "spin", "fast", "hard", "time", "life"]
};

// Theme array for cycling through stages
const themes = ["Animals", "Food", "Space", "Sports", "Mythology", "Countries", "Jobs", "Clothing", "Music", "Technology", "Body", "Weather", "Transport", "History", "Plants", "Colours", "Oceans", "Fantasy", "Insects", "Mixed"];

interface GameState {
  currentStage: number;
  currentLevel: number;
  points: number;
  streak: number;
  completedLevels: Set<string>;
}

const STORAGE_KEYS = {
  GAME_STATE: 'word_sprint_game_state_v2',
};

const STAGES_COUNT = 20;
const LEVELS_PER_STAGE = 15;

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
  const [currentWord, setCurrentWord] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');

  useEffect(() => {
    loadGameState();
  }, []);

  useEffect(() => {
    saveGameState();
  }, [gameState]);

  useEffect(() => {
    generateCurrentWord();
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
        console.log('Game state loaded:', parsed);
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
      console.log('Game state saved:', stateToSave);
    } catch (error) {
      console.log('Error saving game state:', error);
    }
  };

  const getWordForLevel = (stageIndex: number, levelIndex: number): string => {
    const theme = themes[stageIndex % themes.length];
    const wordsForTheme = wordBank[theme as keyof typeof wordBank];
    
    // Select word based on level, cycling through available words
    // For higher levels, prefer longer words
    const sortedWords = [...wordsForTheme].sort((a, b) => a.length - b.length);
    const wordIndex = Math.min(levelIndex, sortedWords.length - 1);
    
    return sortedWords[wordIndex];
  };

  const scrambleWord = (word: string): string => {
    const letters = word.split('');
    // Fisher-Yates shuffle
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.join('');
  };

  const generateCurrentWord = () => {
    const word = getWordForLevel(gameState.currentStage, gameState.currentLevel);
    const scrambled = scrambleWord(word);
    setCurrentWord(word);
    setScrambledWord(scrambled);
    setRevealedLetters([]);
    setIsAnswerRevealed(false);
    setUserInput('');
    setMessage('');
    console.log(`Generated word: ${word}, scrambled: ${scrambled}`);
  };

  const getCurrentTheme = (): string => {
    return themes[gameState.currentStage % themes.length];
  };

  const checkAnswer = () => {
    const userAnswer = userInput.toLowerCase().trim();
    const correctAnswer = currentWord.toLowerCase();

    console.log(`Checking answer: ${userAnswer} vs ${correctAnswer}`);

    if (userAnswer === correctAnswer) {
      const basePoints = 10;
      const stageMultiplier = gameState.currentStage + 1;
      const streakBonus = getStreakBonus();
      const totalPoints = basePoints * stageMultiplier + streakBonus;

      setMessage(`Correct! +${totalPoints} points`);
      
      const newStreak = gameState.streak + 1;
      const levelKey = `${gameState.currentStage}-${gameState.currentLevel}`;
      
      setGameState(prev => ({
        ...prev,
        points: prev.points + totalPoints,
        streak: newStreak,
        completedLevels: new Set([...prev.completedLevels, levelKey]),
      }));

      console.log(`Correct answer! Points awarded: ${totalPoints}, new streak: ${newStreak}`);

      // Move to next level after a delay
      setTimeout(() => {
        moveToNextLevel();
      }, 1500);
    } else {
      setMessage('Try again!');
      setGameState(prev => ({ ...prev, streak: 0 }));
      console.log('Wrong answer, streak reset');
    }
  };

  const moveToNextLevel = () => {
    console.log(`Moving to next level from ${gameState.currentStage}-${gameState.currentLevel}`);
    
    setGameState(prev => {
      if (prev.currentLevel < LEVELS_PER_STAGE - 1) {
        // Move to next level in current stage
        console.log(`Moving to level ${prev.currentLevel + 1} in stage ${prev.currentStage + 1}`);
        return { ...prev, currentLevel: prev.currentLevel + 1 };
      } else if (prev.currentStage < STAGES_COUNT - 1) {
        // Move to next stage
        console.log(`Moving to stage ${prev.currentStage + 2}, level 1`);
        return { 
          ...prev, 
          currentStage: prev.currentStage + 1, 
          currentLevel: 0 
        };
      } else {
        // Game completed
        Alert.alert('Congratulations!', 'You have completed all 20 stages!');
        console.log('Game completed!');
        return prev;
      }
    });
  };

  const useHint = () => {
    if (gameState.points < 50) {
      setMessage('Not enough points for hint!');
      return;
    }

    const word = currentWord;
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
    
    console.log(`Hint used, revealed position ${randomPosition}, letter: ${word[randomPosition]}`);
  };

  const revealAnswer = () => {
    if (gameState.points < 200) {
      setMessage('Not enough points for answer!');
      return;
    }

    setIsAnswerRevealed(true);
    setUserInput(currentWord);
    setGameState(prev => ({ ...prev, points: prev.points - 200 }));
    setMessage('Answer revealed! Moving to next level...');

    const levelKey = `${gameState.currentStage}-${gameState.currentLevel}`;
    setGameState(prev => ({
      ...prev,
      completedLevels: new Set([...prev.completedLevels, levelKey]),
    }));

    console.log(`Answer revealed: ${currentWord}`);

    setTimeout(() => {
      moveToNextLevel();
    }, 2000);
  };

  const purchaseHints = () => {
    // Placeholder for future monetization
    Alert.alert('Coming Soon', 'Hint purchasing will be available in a future update!');
  };

  const renderScrambledWord = () => {
    const scrambledLetters = scrambledWord.split('');
    const word = currentWord;

    return (
      <View style={styles.scrambledContainer}>
        {scrambledLetters.map((letter, index) => {
          // Find which position this letter corresponds to in the original word
          let originalIndex = -1;
          const usedIndices: number[] = [];
          
          for (let i = 0; i < index; i++) {
            const prevLetter = scrambledLetters[i];
            const foundIndex = word.indexOf(prevLetter, usedIndices.length > 0 ? Math.max(...usedIndices) + 1 : 0);
            if (foundIndex !== -1) {
              usedIndices.push(foundIndex);
            }
          }
          
          originalIndex = word.indexOf(letter, usedIndices.length > 0 ? Math.max(...usedIndices) + 1 : 0);
          if (originalIndex === -1) {
            originalIndex = word.indexOf(letter);
          }
          
          const isRevealed = revealedLetters.includes(originalIndex) || isAnswerRevealed;
          
          return (
            <View key={index} style={styles.letterBox}>
              <Text style={[styles.letterText, isRevealed && styles.revealedLetter]}>
                {isRevealed && originalIndex !== -1 ? word[originalIndex].toUpperCase() : letter.toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const getStreakBonus = () => {
    return gameState.streak >= 3 ? Math.floor(gameState.streak / 3) * 5 : 0;
  };

  // Check if game is completed
  if (gameState.currentStage >= STAGES_COUNT) {
    return (
      <View style={commonStyles.container}>
        <Text style={commonStyles.title}>🎉 Game Complete! 🎉</Text>
        <Text style={styles.completionText}>
          You've mastered all {STAGES_COUNT} stages!
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
            Stage {gameState.currentStage + 1}/20 - {getCurrentTheme()}
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
          onSubmitEditing={checkAnswer}
        />

        {/* Message Display */}
        {message ? (
          <Text style={[styles.message, message.includes('Correct') && styles.successMessage]}>
            {message}
          </Text>
        ) : null}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          text="Submit Answer"
          onPress={checkAnswer}
          style={styles.submitButton}
        />
        
        <View style={styles.hintButtonRow}>
          <Button
            text={`Hint (50 pts)`}
            onPress={useHint}
            style={[styles.hintButton, gameState.points < 50 && styles.disabledButton]}
          />
          <Button
            text={`Answer (200 pts)`}
            onPress={revealAnswer}
            style={[styles.answerButton, gameState.points < 200 && styles.disabledButton]}
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
  letterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  revealedLetter: {
    color: colors.accent,
    backgroundColor: colors.primary,
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
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  finalScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 30,
  },
});
