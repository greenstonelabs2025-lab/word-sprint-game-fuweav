
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import MainMenu from '../components/MainMenu';
import WordSprintGame from '../WordSprintGame';
import DailyChallenge from '../components/DailyChallenge';
import StoreScreen from '../components/StoreScreen';
import ChallengeGame from '../components/ChallengeGame';
import { commonStyles } from '../styles/commonStyles';
import * as BillingService from '../billing/BillingService';
import { initAnalytics } from '../src/analytics/AnalyticsService';
import { submitPendingFeedback } from '../src/feedback/FeedbackService';
import { initializeCache, syncWordSets } from '../src/levelsync/SyncService';

export default function MainScreen() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'daily' | 'store' | 'challenges' | 'challengeGame'>('menu');
  const [challengeData, setChallengeData] = useState<{ name: string; words: string[] } | null>(null);

  useEffect(() => {
    // Initialize services on app start
    const initializeServices = async () => {
      try {
        // Initialize billing
        await BillingService.initBilling();
        console.log('Billing initialized on app start');
        
        // Initialize analytics with app version
        await initAnalytics(undefined, '1.0.0');
        console.log('Analytics initialized on app start');
        
        // Submit any pending feedback
        await submitPendingFeedback();
        console.log('Pending feedback submitted on app start');
        
        // Initialize word sets cache
        await initializeCache();
        console.log('Word sets cache initialized on app start');
        
        // Sync word sets and challenges
        await syncWordSets();
        console.log('Word sets and challenges synced on app start');
      } catch (error) {
        console.error('Failed to initialize services on app start:', error);
      }
    };

    initializeServices();
  }, []);

  console.log('Current screen:', screen);

  if (screen === 'menu') {
    return (
      <View style={commonStyles.wrapper}>
        <MainMenu 
          onStart={() => setScreen('game')}
          onDailyChallenge={() => setScreen('daily')}
          onStore={() => setScreen('store')}
          onChallengeGame={(challengeName, words) => {
            setChallengeData({ name: challengeName, words });
            setScreen('challengeGame');
          }}
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

  if (screen === 'challengeGame' && challengeData) {
    return (
      <View style={commonStyles.wrapper}>
        <ChallengeGame 
          visible={true}
          challengeName={challengeData.name}
          words={challengeData.words}
          onExit={() => {
            setChallengeData(null);
            setScreen('menu');
          }}
        />
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
