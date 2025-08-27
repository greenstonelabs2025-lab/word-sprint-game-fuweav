
import React from 'react';
import { View } from 'react-native';
import MainScreen from './app/index';

export default function App() {
  console.log('Word Sprint app starting directly in main menu');
  
  return (
    <View style={{ flex: 1 }}>
      <MainScreen />
    </View>
  );
}
