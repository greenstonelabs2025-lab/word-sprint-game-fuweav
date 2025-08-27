
import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";

const words = ["cat", "dog", "lion", "bear", "wolf", "tiger", "zebra", "shark", "snake", "whale"];

function scramble(word: string) {
  return word.split("").sort(() => Math.random() - 0.5).join("");
}

export default function WordSprintGame() {
  const [index, setIndex] = useState(0);
  const [word, setWord] = useState(words[0]);
  const [scrambled, setScrambled] = useState(scramble(words[0]));
  const [input, setInput] = useState("");

  const checkAnswer = () => {
    if (input.toLowerCase() === word) {
      Alert.alert("Correct!", "You solved it.");
      nextWord();
    } else {
      Alert.alert("Wrong", "Try again.");
    }
  };

  const nextWord = () => {
    const newIndex = (index + 1) % words.length;
    setIndex(newIndex);
    setWord(words[newIndex]);
    setScrambled(scramble(words[newIndex]));
    setInput("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Word Sprint</Text>
      <Text style={styles.word}>{scrambled}</Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="Unscramble..."
      />
      <Button title="Submit" onPress={checkAnswer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  word: { fontSize: 32, marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, width: "80%", marginBottom: 10 }
});
