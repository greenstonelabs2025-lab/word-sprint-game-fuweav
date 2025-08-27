
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Alert, StyleSheet, Modal, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { themes, wordBank } from "./wordBank";

interface ConfirmationPopupProps {
  visible: boolean;
  title: string;
  cost: number;
  currentPoints: number;
  onConfirm: () => void;
  onCancel: () => void;
}

// Enhanced scramble function that ensures the result is always different from the original
const scramble = (word: string): string => {
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
};

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

export default function WordSprintGame() {
  const [stage, setStage] = useState(0);
  const [level, setLevel] = useState(0);
  const [points, setPoints] = useState(100); // Start with some points
  const [streak, setStreak] = useState(0);
  const [word, setWord] = useState(wordBank[themes[0]][0]);
  const [scrambled, setScrambled] = useState(scramble(word));
  const [input, setInput] = useState("");
  
  // Popup states
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [showAnswerPopup, setShowAnswerPopup] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await AsyncStorage.getItem("progress");
        if (d) {
          const { s, l, p } = JSON.parse(d);
          setStage(s);
          setLevel(l);
          setPoints(p);
          const w = wordBank[themes[s]][l];
          setWord(w);
          setScrambled(scramble(w));
        }
      } catch (e) {
        console.log('Error loading progress:', e);
      }
    })();
  }, []);

  const save = async (s: number, l: number, p: number) => {
    try {
      await AsyncStorage.setItem("progress", JSON.stringify({ stage: s, level: l, points: p }));
    } catch (e) {
      console.log('Error saving progress:', e);
    }
  };

  const next = () => {
    let l = level + 1, s = stage;
    if (l >= 15) { s++; l = 0; }
    if (s >= themes.length) { Alert.alert("Game Over", "All stages done!"); return; }
    const w = wordBank[themes[s]][l];
    setStage(s);
    setLevel(l);
    setWord(w);
    setScrambled(scramble(w)); // Re-scramble the new word
    setInput("");
    save(s, l, points);
    console.log(`Moved to stage ${s + 1}, level ${l + 1}: ${w}`);
  };

  const check = () => {
    if (input.toLowerCase() === word.toLowerCase()) {
      let gain = 10 * (stage + 1);
      const ns = streak + 1;
      if (ns % 3 === 0) gain += 5;
      const np = points + gain;
      setPoints(np);
      setStreak(ns);
      Alert.alert("Correct", `+${gain} pts`);
      save(stage, level, np);
      next();
    } else {
      Alert.alert("Wrong", "Try again");
      setStreak(0);
      // Re-scramble on wrong answer
      setScrambled(scramble(word));
      console.log('Wrong answer - re-scrambling word');
    }
  };

  const handleHintConfirm = () => {
    setShowHintPopup(false);
    const np = points - 50;
    setPoints(np);
    save(stage, level, np);
    Alert.alert("Hint", `First letter: ${word[0]}`);
    console.log('Hint used - 50 points deducted');
  };

  const handleAnswerConfirm = () => {
    setShowAnswerPopup(false);
    const np = points - 200;
    setPoints(np);
    save(stage, level, np);
    Alert.alert("Answer", word);
    console.log('Answer revealed - 200 points deducted');
    next();
  };

  const hint = () => {
    setShowHintPopup(true);
  };

  const answer = () => {
    setShowAnswerPopup(true);
  };

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
      />
      <TouchableOpacity style={styles.button} onPress={check}>
        <Text style={styles.buttonText}>Submit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={hint}>
        <Text style={styles.buttonText}>Hint (50 pts)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={answer}>
        <Text style={styles.buttonText}>Answer (200 pts)</Text>
      </TouchableOpacity>

      {/* Confirmation Popups */}
      <ConfirmationPopup
        visible={showHintPopup}
        title="Use Hint"
        cost={50}
        currentPoints={points}
        onConfirm={handleHintConfirm}
        onCancel={() => setShowHintPopup(false)}
      />

      <ConfirmationPopup
        visible={showAnswerPopup}
        title="Reveal Answer"
        cost={200}
        currentPoints={points}
        onConfirm={handleAnswerConfirm}
        onCancel={() => setShowAnswerPopup(false)}
      />
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
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 5,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCost: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  modalPoints: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  modalWarning: {
    fontSize: 14,
    color: '#ff4444',
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
    backgroundColor: '#666',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  disabledModalButton: {
    backgroundColor: '#ccc',
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
