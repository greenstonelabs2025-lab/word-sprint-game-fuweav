
import React, { useState } from 'react';
import { View } from 'react-native';
import MainMenu from '../components/MainMenu';
import WordSprintGame from '../WordSprintGame';
import DailyChallenge from '../components/DailyChallenge';
import StoreScreen from '../components/StoreScreen';
import { commonStyles } from '../styles/commonStyles';

export default function MainScreen() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'daily' | 'store'>('menu');

  console.log('Current screen:', screen);

  if (screen === 'menu') {
    return (
      <View style={commonStyles.wrapper}>
        <MainMenu 
          onStart={() => setScreen('game')}
          onDailyChallenge={() => setScreen('daily')}
          onStore={() => setScreen('store')}
        />
      </View>
    );
  }

  if (screen === 'daily') {
    return (
      <View style={commonStyles.wrapper}>
        <DailyChallenge onExit={() => setScreen('menu')} />
      </View>
    );
  }

  if (screen === 'store') {
    return (
      <View style={commonStyles.wrapper}>
        <StoreScreen onExit={() => setScreen('menu')} />
      </View>
    );
  }

  return (
    <View style={commonStyles.wrapper}>
      <WordSprintGame 
        onExit={() => setScreen('menu')}
        onStore={() => setScreen('store')}
      />
    </View>
  );
}
