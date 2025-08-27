
import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";

const themes = ["Animals","Food","Space","Sports","Mythology"];
const wordBank: { [key: string]: string[] } = {
  Animals:["cat","dog","lion","bear","wolf","tiger","zebra","shark","snake","whale","camel","mouse","panda","rhino","eagle"],
  Food:["meat","milk","egg","rice","fish","bread","apple","cheese","butter","onion","pizza","sugar","grape","lemon","spice"],
  Space:["star","moon","mars","venus","earth","orbit","nova","comet","galaxy","rocket","planet","cosmos","asteroid","neptune","uranus"],
  Sports:["golf","tennis","rugby","cricket","boxing","hockey","soccer","cycling","skiing","rowing","wrestle","karate","judo","surfing","archery"],
  Mythology:["zeus","hera","odin","thor","loki","apollo","ares","poseidon","hades","freya","atlas","hermes","nike","gaia","eros"]
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

  const nextWord = () => {
    let newLevel = level + 1, newStage = stage;
    if (newLevel >= 15) { newStage++; newLevel = 0; }
    if (newStage >= themes.length) { Alert.alert("Game Over","All stages done!"); return; }
    const newWord = wordBank[themes[newStage]][newLevel];
    setStage(newStage); setLevel(newLevel);
    setWord(newWord); setScrambled(scramble(newWord)); setInput("");
  };

  const checkAnswer = () => {
    if (input.toLowerCase() === word) {
      let gain = 10 * (stage + 1);
      const newStreak = streak + 1;
      if (newStreak % 3 === 0) gain += 5;
      setPoints(points + gain); setStreak(newStreak);
      Alert.alert("Correct", `+${gain} pts`); nextWord();
    } else { Alert.alert("Wrong","Try again"); setStreak(0); }
  };

  const buyHint = () => {
    if (points < 50) { Alert.alert("Not enough points! Need 50."); return; }
    setPoints(points - 50);
    Alert.alert("Hint", `First letter: ${word[0]}`);
  };

  const buyAnswer = () => {
    if (points < 200) { Alert.alert("Not enough points! Need 200."); return; }
    setPoints(points - 200);
    Alert.alert("Answer", `The word is ${word}`);
    nextWord();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Stage {stage+1}/20 | Level {level+1}/15</Text>
      <Text>Theme: {themes[stage]}</Text>
      <Text>Points: {points} | Streak: {streak}</Text>
      <Text style={styles.word}>{scrambled}</Text>
      <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Unscramble..."/>
      <Button title="Submit" onPress={checkAnswer}/>
      <Button title="Hint (50 pts)" onPress={buyHint}/>
      <Button title="Answer (200 pts)" onPress={buyAnswer}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,alignItems:"center",justifyContent:"center",padding:20},
  header:{fontSize:20,fontWeight:"bold",marginBottom:10},
  word:{fontSize:32,margin:20},
  input:{borderWidth:1,padding:10,width:"80%",marginBottom:10}
});
