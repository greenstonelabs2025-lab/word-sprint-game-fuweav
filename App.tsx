
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  console.log('Word Sprint - Build 0.1 splash screen loaded');
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Word Sprint - Build 0.1</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
});
