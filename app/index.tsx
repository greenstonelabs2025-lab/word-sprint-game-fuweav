import { Text, View, Image, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import Button from '../components/Button';
import { commonStyles, buttonStyles } from '../styles/commonStyles';

// Declare the window properties we're using
declare global {
  interface Window {
    handleInstallClick: () => void;
    canInstall: boolean;
  }
}

export default function MainScreen() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Initial check
    setCanInstall(false);

    // Set up polling interval
    const intervalId = setInterval(() => {
      if(window.canInstall) {
        setCanInstall(true);
        clearInterval(intervalId);
      }
    }, 500);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.content}>
        <Image
          source={require('../assets/images/final_quest_240x240.png')}
          style={{ width: 180, height: 180 }}
          resizeMode="contain"
        />
        <Text style={commonStyles.title}>Word Sprint Game</Text>
        <Text style={commonStyles.text}>Test your vocabulary skills with this exciting word unscrambling game!</Text>
        <View style={commonStyles.buttonContainer}>
          <Button
            text="Play Word Sprint"
            onPress={() => router.push('/word-sprint-game')}
            style={buttonStyles.instructionsButton}
          />
          {canInstall && (
            <Button
              text="Install App"
              onPress={() => {
                if(window.handleInstallClick) {
                  window.handleInstallClick();
                  setCanInstall(false); // Update state after installation
                }
              }}
              style={buttonStyles.instructionsButton}
            />
          )}
        </View>
      </View>
    </View>
  );
}
