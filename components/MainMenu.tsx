
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from './Button';
import { colors, commonStyles } from '../styles/commonStyles';

interface MainMenuProps {
  onStart: () => void;
}

export default function MainMenu({ onStart }: MainMenuProps) {
  const [rulesVisible, setRulesVisible] = useState(false);

  const newGame = async () => {
    Alert.alert(
      "New Game",
      "Are you sure you want to start a new game? This will overwrite your current progress.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: async () => {
            try {
              await AsyncStorage.setItem("progress", JSON.stringify({ stage: 0, level: 0, points: 0 }));
              console.log('New game started - progress reset to zeros');
              onStart();
            } catch (e) {
              console.error("Error saving new game:", e);
            }
          },
        },
      ]
    );
  };

  const continueGame = async () => {
    try {
      const progress = await AsyncStorage.getItem("progress");
      if (!progress) {
        // No existing progress, start new game
        await AsyncStorage.setItem("progress", JSON.stringify({ stage: 0, level: 0, points: 0 }));
        console.log('No existing progress found - starting new game');
      } else {
        console.log('Continuing existing game:', progress);
      }
      onStart();
    } catch (e) {
      console.error("Error loading game:", e);
      // Fallback to new game
      await AsyncStorage.setItem("progress", JSON.stringify({ stage: 0, level: 0, points: 0 }));
      onStart();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Word Sprint</Text>
        <Text style={styles.subtitle}>Unscramble. Score. Advance.</Text>
        
        <View style={styles.buttonContainer}>
          <Button
            text="New Game"
            onPress={newGame}
            style={styles.primaryButton}
          />
          
          <Button
            text="Continue"
            onPress={continueGame}
            style={styles.secondaryButton}
          />
          
          <TouchableOpacity 
            style={styles.rulesButton}
            onPress={() => setRulesVisible(true)}
          >
            <Text style={styles.rulesButtonText}>Rules</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rules Modal */}
      <Modal 
        visible={rulesVisible} 
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRulesVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Game Rules</Text>
            
            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Goal:</Text>
              <Text style={styles.ruleText}>• Unscramble 15 levels per stage</Text>
              <Text style={styles.ruleText}>• Complete all 20 stages</Text>
            </View>

            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Points:</Text>
              <Text style={styles.ruleText}>• 10 × stage number per correct answer</Text>
              <Text style={styles.ruleText}>• +5 bonus points every 3-streak</Text>
            </View>

            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Help Options:</Text>
              <Text style={styles.ruleText}>• Hint = 50 pts (reveals first letter)</Text>
              <Text style={styles.ruleText}>• Answer = 200 pts (reveals full word)</Text>
            </View>

            <View style={styles.ruleSection}>
              <Text style={styles.ruleHeader}>Progress:</Text>
              <Text style={styles.ruleText}>• Your progress auto-saves</Text>
              <Text style={styles.ruleText}>• Continue anytime from where you left off</Text>
            </View>

            <Button
              text="Close"
              onPress={() => setRulesVisible(false)}
              style={styles.closeButton}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.grey,
    marginBottom: 40,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    width: '100%',
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
    width: '100%',
  },
  rulesButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  rulesButtonText: {
    fontSize: 16,
    color: colors.accent,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    padding: 24,
    paddingTop: 60, // Account for status bar
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 30,
    textAlign: 'center',
  },
  ruleSection: {
    marginBottom: 24,
  },
  ruleHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 4,
  },
  closeButton: {
    backgroundColor: colors.primary,
    marginTop: 20,
    alignSelf: 'center',
    width: '60%',
  },
});
