
import React, { useState } from 'react';
import { View } from 'react-native';
import MainMenu from '../components/MainMenu';
import WordSprintGame from '../WordSprintGame';
import { commonStyles } from '../styles/commonStyles';

export default function MainScreen() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');

  console.log('Current screen:', screen);

  if (screen === 'menu') {
    return (
      <View style={commonStyles.wrapper}>
        <MainMenu onStart={() => setScreen('game')} />
      </View>
    );
  }

  return (
    <View style={commonStyles.wrapper}>
      <WordSprintGame onExit={() => setScreen('menu')} />
    </View>
  );
}
