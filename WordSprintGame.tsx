
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, wordBank } from "./wordBank";

const STORAGE_KEYS = {
  GAME_STATE: 'word_sprint_game_state',
  POINTS: 'word_sprint_points',
  STAGE: 'word_sprint_stage',
  LEVEL: 'word_sprint_level',
  STREAK: 'word_sprint_streak'
};

function scramble(word: string) {
  return word.split("").sort(() => Math.random() - 0.5).join("");
}

export default function WordSprintGame() {
  const [stage, setStage] = useState(0);
  const [level, setLevel] = useState(0);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [word, setWord] = useState(wordBank[themes[0]][0]);
  const [scrambled, setScrambled] = useState(scramble(word));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load game state from AsyncStorage on component mount
  useEffect(() => {
    loadGameState();
  }, []);

  // Save game state whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveGameState();
    }
  }, [stage, level, points, streak, isLoading]);

  // Update word when stage or level changes
  useEffect(() => {
    if (stage < themes.length && level < wordBank[themes[stage]].length) {
      const newWord = wordBank[themes[stage]][level];
      setWord(newWord);
      setScrambled(scramble(newWord));
      setInput("");
    }
  }, [stage, level]);

  const loadGameState = async () => {
    try {
      console.log('Loading game state from AsyncStorage...');
      
      const savedStage = await AsyncStorage.getItem(STORAGE_KEYS.STAGE);
      const savedLevel = await AsyncStorage.getItem(STORAGE_KEYS.LEVEL);
      const savedPoints = await AsyncStorage.getItem(STORAGE_KEYS.POINTS);
      const savedStreak = await AsyncStorage.getItem(STORAGE_KEYS.STREAK);

      if (savedStage !== null) {
        setStage(parseInt(savedStage, 10));
      }
      if (savedLevel !== null) {
        setLevel(parseInt(savedLevel, 10));
      }
      if (savedPoints !== null) {
        setPoints(parseInt(savedPoints, 10));
      }
      if (savedStreak !== null) {
        setStreak(parseInt(savedStreak, 10));
      }

      console.log('Game state loaded successfully');
    } catch (error) {
      console.log('Error loading game state:', error);
      Alert.alert('Error', 'Failed to load saved game data');
    } finally {
      setIsLoading(false);
    }
  };

  const saveGameState = async () => {
    try {
      console.log('Saving game state to AsyncStorage...');
      
      await AsyncStorage.setItem(STORAGE_KEYS.STAGE, stage.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.LEVEL, level.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.POINTS, points.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.STREAK, streak.toString());

      console.log('Game state saved successfully');
    } catch (error) {
      console.log('Error saving game state:', error);
    }
  };

  const nextWord = () => {
    let newLevel = level + 1, newStage = stage;
    if (newLevel >= 15) { 
      newStage++; 
      newLevel = 0; 
    }
    if (newStage >= themes.length) { 
      Alert.alert("Game Over", "All stages done!"); 
      return; 
    }
    
    setStage(newStage);
    setLevel(newLevel);
  };

  const checkAnswer = () => {
    if (input.toLowerCase() === word.toLowerCase()) {
      let gain = 10 * (stage + 1);
      const newStreak = streak + 1;
      if (newStreak % 3 === 0) gain += 5;
      
      setPoints(points + gain);
      setStreak(newStreak);
      
      Alert.alert("Correct", `+${gain} pts`);
      nextWord();
    } else { 
      Alert.alert("Wrong", "Try again"); 
      setStreak(0); 
    }
  };

  const buyHint = () => {
    if (points < 50) { 
      Alert.alert("Not enough points!", "Need 50 pts"); 
      return; 
    }
    setPoints(points - 50);
    Alert.alert("Hint", `First letter: ${word[0]}`);
  };

  const buyAnswer = () => {
    if (points < 200) { 
      Alert.alert("Not enough points!", "Need 200 pts"); 
      return; 
    }
    setPoints(points - 200);
    Alert.alert("Answer", `The word is ${word}`);
    nextWord();
  };

  const resetGame = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.STAGE,
        STORAGE_KEYS.LEVEL,
        STORAGE_KEYS.POINTS,
        STORAGE_KEYS.STREAK
      ]);
      
      setStage(0);
      setLevel(0);
      setPoints(0);
      setStreak(0);
      
      Alert.alert("Game Reset", "Your progress has been reset!");
    } catch (error) {
      console.log('Error resetting game:', error);
      Alert.alert('Error', 'Failed to reset game data');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Stage {stage + 1}/20 | Level {level + 1}/15</Text>
      <Text>Theme: {themes[stage]}</Text>
      <Text>Points: {points} | Streak: {streak}</Text>
      <Text style={styles.word}>{scrambled}</Text>
      <TextInput 
        style={styles.input} 
        value={input} 
        onChangeText={setInput} 
        placeholder="Unscramble..."
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button title="Submit" onPress={checkAnswer} />
      <Button title="Hint (50 pts)" onPress={buyHint} />
      <Button title="Answer (200 pts)" onPress={buyAnswer} />
      <Button title="Reset Game" onPress={resetGame} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 20 
  },
  header: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 10 
  },
  word: { 
    fontSize: 32, 
    margin: 20 
  },
  input: { 
    borderWidth: 1, 
    padding: 10, 
    width: "80%", 
    marginBottom: 10 
  }
});
