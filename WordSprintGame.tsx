
import React,{useState,useEffect} from "react";
import {View,Text,TextInput,Button,Alert,StyleSheet} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {themes,wordBank} from "./wordBank";

const scramble=(w:string)=>w.split("").sort(()=>Math.random()-.5).join("");

export default function WordSprintGame(){
  const[stage,setStage]=useState(0),[level,setLevel]=useState(0);
  const[points,setPoints]=useState(0),[streak,setStreak]=useState(0);
  const[word,setWord]=useState(wordBank[themes[0]][0]);
  const[scrambled,setScrambled]=useState(scramble(word));
  const[input,setInput]=useState("");

  useEffect(()=>{(async()=>{try{
    const d=await AsyncStorage.getItem("progress");
    if(d){const{s,l,p}=JSON.parse(d);
      setStage(s);setLevel(l);setPoints(p);
      const w=wordBank[themes[s]][l];setWord(w);setScrambled(scramble(w));
    }}catch(e){console.log('Error loading progress:',e);}})()},[]);

  const save=async(s:number,l:number,p:number)=>{
    try{await AsyncStorage.setItem("progress",JSON.stringify({stage:s,level:l,points:p}));}catch(e){console.log('Error saving progress:',e);}
  };

  const next=()=>{
    let l=level+1,s=stage;
    if(l>=15){s++;l=0;}
    if(s>=themes.length){Alert.alert("Game Over","All stages done!");return;}
    const w=wordBank[themes[s]][l];
    setStage(s);setLevel(l);setWord(w);setScrambled(scramble(w));setInput("");
    save(s,l,points);
  };

  const check=()=>{
    if(input.toLowerCase()===word){
      let gain=10*(stage+1);const ns=streak+1;
      if(ns%3===0)gain+=5;
      const np=points+gain;
      setPoints(np);setStreak(ns);Alert.alert("Correct",`+${gain} pts`);
      save(stage,level,np);next();
    } else {Alert.alert("Wrong","Try again");setStreak(0);}
  };

  const hint=()=>{
    if(points<50){Alert.alert("Need 50 pts");return;}
    const np=points-50;setPoints(np);save(stage,level,np);
    Alert.alert("Hint",`First letter: ${word[0]}`);
  };

  const answer=()=>{
    if(points<200){Alert.alert("Need 200 pts");return;}
    const np=points-200;setPoints(np);save(stage,level,np);
    Alert.alert("Answer",word);next();
  };

  return(
    <View style={styles.container}>
      <Text style={styles.header}>Stage {stage+1}/20 | Level {level+1}/15</Text>
      <Text>Theme: {themes[stage]}</Text>
      <Text>Points: {points} | Streak: {streak}</Text>
      <Text style={styles.word}>{scrambled}</Text>
      <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Unscramble..."/>
      <Button title="Submit" onPress={check}/>
      <Button title="Hint (50 pts)" onPress={hint}/>
      <Button title="Answer (200 pts)" onPress={answer}/>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,alignItems:"center",justifyContent:"center",padding:20},
  header:{fontSize:20,fontWeight:"bold",marginBottom:10},
  word:{fontSize:32,margin:20},
  input:{borderWidth:1,padding:10,width:"80%",marginBottom:10}
});
