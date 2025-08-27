
import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  Alert, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Pressable,
  Animated,
  Vibration,
  LayoutAnimation,
  ScrollView,
  useWindowDimensions
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { themes, wordBank } from "./wordBank";
import SettingsPanel from "./components/SettingsPanel";
import FeedbackModal from "./components/FeedbackModal";
import { updatePoints } from "./components/StoreScreen";
import { colors } from "./styles/commonStyles";
import { track } from "./src/analytics/AnalyticsService";

interface ConfirmationPopupProps {
  visible: boolean;
  title: string;
  cost: number;
  currentPoints: number;
  onConfirm: () => void;
  onCancel: () => void;
}

interface Settings {
  vibrate: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  sound: boolean;
}

interface GameProgress {
  stage: number;
  level: number;
  points: number;
}

// Enhanced scramble function that ensures the result is always different from the original
const scramble = (word: string): string => {
  if (word.length <= 1) return word;
  
  let scrambledWord = word;
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loops
  
  do {
    scrambledWord = word
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    attempts++;
  } while (scrambledWord === word && attempts < maxAttempts);
  
  // If we still have the original word after max attempts, manually scramble
  if (scrambledWord === word) {
    const letters = word.split("");
    // Swap first two characters if possible
    if (letters.length >= 2) {
      [letters[0], letters[1]] = [letters[1], letters[0]];
      scrambledWord = letters.join("");
    }
  }
  
  console.log(`Scrambled "${word}" to "${scrambledWord}"`);
  return scrambledWord;
};

// Sound effect placeholders
const playClick = () => {
  console.log('Click sound would play here');
};

const playSuccess = () => {
  console.log('Success sound would play here');
};

// Confirmation Popup Component
function ConfirmationPopup({ visible, title, cost, currentPoints, onConfirm, onCancel }: ConfirmationPopupProps) {
  const hasEnoughPoints = currentPoints >= cost;
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Spend Points?</Text>
          <Text style={styles.modalSubtitle}>{title}</Text>
          <Text style={styles.modalCost}>{cost} points</Text>
          <Text style={styles.modalPoints}>You have {currentPoints} points</Text>
          
          {!hasEnoughPoints && (
            <Text style={styles.modalWarning}>Not enough points</Text>
          )}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalButton, 
                styles.confirmButton,
                !hasEnoughPoints && styles.disabledModalButton
              ]}
              onPress={hasEnoughPoints ? onConfirm : onCancel}
            >
              <Text style={[
                styles.modalButtonText,
                !hasEnoughPoints && styles.disabledModalButtonText
              ]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface WordSprintGameProps {
  onExit?: () => void;
  onStore?: () => void;
}

export default function WordSprintGame({ onExit, onStore }: WordSprintGameProps) {
  const { height } = useWindowDimensions();
  const [stage, setStage] = useState(0);
  const [level, setLevel] = useState(0);
  const [points, setPoints] = useState(100);
  const [streak, setStreak] = useState(0);
  const [word, setWord] = useState(wordBank[themes[0]][0]);
  const [scrambled, setScrambled] = useState(scramble(word));
  const [input, setInput] = useState("");
  const [showBanner, setShowBanner] = useState(false);
  const [bannerText, setBannerText] = useState("");
  const [showStageComplete, setShowStageComplete] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackContext, setFeedbackContext] = useState<{
    category?: 'Bug' | 'Idea' | 'Other';
    message?: string;
  }>({});
  const [settings, setSettings] = useState<Settings>({
    vibrate: true,
    reduceMotion: false,
    highContrast: false,
    sound: false,
  });
  
  // Popup states
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [showAnswerPopup, setShowAnswerPopup] = useState(false);
  const [showGearMenu, setShowGearMenu] = useState(false);

  // Animation values
  const scaleWord = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pressScaleSubmit = useRef(new Animated.Value(1)).current;
  const pressScaleHint = useRef(new Animated.Value(1)).current;
  const pressScaleAnswer = useRef(new Animated.Value(1)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;

  // Load settings and game progress
  useEffect(() => {
    loadSettings();
    loadProgress();
  }, []);

  const loadSettings = async () => {
    try {
      const keys = ['pref_vibrate', 'pref_reduce_motion', 'pref_high_contrast', 'pref_sound'];
      const values = await AsyncStorage.multiGet(keys);
      
      const loadedSettings: Settings = {
        vibrate: values[0][1] === 'true' || values[0][1] === null,
        reduceMotion: values[1][1] === 'true',
        highContrast: values[2][1] === 'true',
        sound: values[3][1] === 'true',
      };
      
      setSettings(loadedSettings);
      console.log('Settings loaded in game:', loadedSettings);
    } catch (error) {
      console.error('Error loading settings in game:', error);
    }
  };

  const loadProgress = async () => {
    try {
      const d = await AsyncStorage.getItem("progress");
      if (d) {
        const { stage: s, level: l, points: p } = JSON.parse(d);
        setStage(s);
        setLevel(l);
        setPoints(p);
        const w = getWordForLevel(s, l);
        setWord(w);
        setScrambled(scramble(w));
        console.log(`Loaded progress: Stage ${s + 1}, Level ${l + 1}, Points ${p}`);
      }
    } catch (e) {
      console.log('Error loading progress:', e);
    }
  };

  const getWordForLevel = (stageIndex: number, levelIndex: number): string => {
    const themeWords = wordBank[themes[stageIndex]];
    if (!themeWords || themeWords.length === 0) {
      return "demo"; // Fallback word
    }
    return themeWords[levelIndex % themeWords.length];
  };

  const save = async (s: number, l: number, p: number) => {
    try {
      await AsyncStorage.setItem("progress", JSON.stringify({ stage: s, level: l, points: p }));
    } catch (e) {
      console.log('Error saving progress:', e);
    }
  };

  const animateCorrect = () => {
    if (settings.reduceMotion) return;
    
    Animated.sequence([
      Animated.timing(scaleWord, {
        toValue: 1.15,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(scaleWord, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      })
    ]).start();

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const animateWrong = () => {
    if (settings.vibrate) {
      Vibration.vibrate(30);
    }

    if (!settings.reduceMotion) {
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        })
      ]).start();
    }
  };

  const animateStageTransition = () => {
    if (settings.reduceMotion) return;
    
    Animated.sequence([
      Animated.timing(fadeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  };

  const showSuccessBanner = (text: string) => {
    setBannerText(text);
    setShowBanner(true);
    setTimeout(() => {
      setShowBanner(false);
    }, 800);
  };

  const next = () => {
    let l = level + 1, s = stage;
    
    if (l >= 15) {
      // Stage complete
      setShowStageComplete(true);
      return;
    }
    
    const w = getWordForLevel(s, l);
    setStage(s);
    setLevel(l);
    setWord(w);
    setScrambled(scramble(w));
    setInput("");
    save(s, l, points);
    animateStageTransition();
    console.log(`Moved to stage ${s + 1}, level ${l + 1}: ${w}`);
  };

  const nextStage = () => {
    let s = stage + 1;
    let l = 0;
    
    if (s >= themes.length) {
      Alert.alert("Game Complete!", "Congratulations! You've completed all stages!");
      return;
    }
    
    const w = getWordForLevel(s, l);
    setStage(s);
    setLevel(l);
    setWord(w);
    setScrambled(scramble(w));
    setInput("");
    setShowStageComplete(false);
    save(s, l, points);
    animateStageTransition();
    console.log(`Advanced to stage ${s + 1}, level ${l + 1}: ${w}`);
  };

  const check = () => {
    if (settings.sound) {
      playClick();
    }

    if (input.toLowerCase() === word.toLowerCase()) {
      let gain = 10 * (stage + 1);
      const ns = streak + 1;
      if (ns % 3 === 0) gain += 5;
      const np = points + gain;
      setPoints(np);
      setStreak(ns);
      
      // Track correct answer
      track("correct", {
        stage: stage + 1,
        level: level + 1,
        gain,
        streak: ns,
        theme: themes[stage],
        word: word.toLowerCase()
      });
      
      if (settings.sound) {
        playSuccess();
      }
      
      animateCorrect();
      showSuccessBanner(`Correct! +${gain} pts`);
      save(stage, level, np);
      
      setTimeout(() => {
        next();
      }, 800);
    } else {
      setStreak(0);
      
      // Track wrong answer
      track("wrong", {
        stage: stage + 1,
        level: level + 1,
        theme: themes[stage],
        word: word.toLowerCase(),
        guess: input.toLowerCase()
      });
      
      animateWrong();
      setScrambled(scramble(word)); // Re-scramble on wrong answer
      console.log('Wrong answer - re-scrambling word');
      
      // Show alert with feedback option for wrong answers
      Alert.alert(
        "Try Again",
        "That's not quite right. Keep trying!",
        [
          { text: "OK", style: "default" },
          { 
            text: "Report Bug", 
            style: "default",
            onPress: () => {
              setFeedbackContext({
                category: 'Bug',
                message: `Context: Wrong answer on "${word}" (Stage ${stage + 1}, Level ${level + 1}, Theme: ${themes[stage]}). My guess was "${input}". `
              });
              setShowFeedback(true);
            }
          }
        ]
      );
    }
  };

  const handleHintConfirm = async () => {
    setShowHintPopup(false);
    try {
      const newPoints = await updatePoints(-50);
      setPoints(newPoints);
      
      // Track hint purchase
      track("hint_buy", {
        cost: 50,
        points: newPoints,
        stage: stage + 1,
        level: level + 1,
        theme: themes[stage],
        word: word.toLowerCase()
      });
      
      Alert.alert("Hint", `First letter: ${word[0]}`);
      console.log('Hint used - 50 points deducted');
    } catch (error) {
      console.error('Error deducting points for hint:', error);
      Alert.alert('Error', 'Failed to use hint. Please try again.');
    }
  };

  const handleAnswerConfirm = async () => {
    setShowAnswerPopup(false);
    try {
      const newPoints = await updatePoints(-200);
      setPoints(newPoints);
      
      // Track answer purchase
      track("answer_buy", {
        cost: 200,
        points: newPoints,
        stage: stage + 1,
        level: level + 1,
        theme: themes[stage],
        word: word.toLowerCase()
      });
      
      Alert.alert("Answer", word);
      console.log('Answer revealed - 200 points deducted');
      setTimeout(() => {
        next();
      }, 1000);
    } catch (error) {
      console.error('Error deducting points for answer:', error);
      Alert.alert('Error', 'Failed to reveal answer. Please try again.');
    }
  };

  const hint = () => {
    if (settings.sound) {
      playClick();
    }
    setShowHintPopup(true);
  };

  const answer = () => {
    if (settings.sound) {
      playClick();
    }
    setShowAnswerPopup(true);
  };

  const handleMenuPress = () => {
    if (settings.sound) {
      playClick();
    }
    save(stage, level, points);
    onExit?.();
  };

  const handleStorePress = () => {
    if (settings.sound) {
      playClick();
    }
    save(stage, level, points);
    onStore?.();
  };

  const handleSettingsPress = () => {
    if (settings.sound) {
      playClick();
    }
    setShowGearMenu(true);
  };

  const handleFeedbackPress = () => {
    if (settings.sound) {
      playClick();
    }
    setFeedbackContext({});
    setShowFeedback(true);
    setShowGearMenu(false);
  };

  const createPressHandlers = (pressScale: Animated.Value) => ({
    onPressIn: () => {
      if (!settings.reduceMotion) {
        Animated.spring(pressScale, {
          toValue: 0.96,
          speed: 20,
          useNativeDriver: true,
        }).start();
      }
    },
    onPressOut: () => {
      if (!settings.reduceMotion) {
        Animated.spring(pressScale, {
          toValue: 1,
          speed: 20,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  // Get theme background color
  const getThemeBackground = () => {
    if (settings.highContrast) {
      return '#1a1a1a';
    }
    
    const themeColors: { [key: string]: string } = {
      Animals: '#1b5e20',
      Food: '#6d4c41',
      Space: '#0d47a1',
      Sports: '#004d40',
      Mythology: '#4a148c',
      Countries: '#263238',
      Jobs: '#37474f',
      Clothing: '#3e2723',
      Music: '#1a237e',
      Technology: '#1b1b1b',
      Body: '#827717',
      Weather: '#01579b',
      Transport: '#263238',
      History: '#4e342e',
      Plants: '#2e7d32',
      Colours: '#212121',
      Oceans: '#003c8f',
      Fantasy: '#311b92',
      Insects: '#33691e',
      Mixed: '#424242',
    };
    
    return themeColors[themes[stage]] || '#424242';
  };

  // Get button colors based on high contrast setting
  const getButtonColors = () => {
    if (settings.highContrast) {
      return {
        submit: '#00FF00',
        hint: '#FFD700',
        answer: '#FF5555',
      };
    }
    return {
      submit: '#00e676',
      hint: '#ffd54f',
      answer: '#ff8a80',
    };
  };

  const buttonColors = getButtonColors();

  // Progress bar segments
  const renderProgressBar = () => {
    const segments = Array.from({ length: 15 }, (_, i) => (
      <View
        key={i}
        style={[
          styles.progressSegment,
          { opacity: i <= level ? 1 : 0.3 }
        ]}
      />
    ));
    
    return (
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>
          Stage {stage + 1} • Level {level + 1}/15
        </Text>
        <View style={styles.progressBar}>
          {segments}
        </View>
      </View>
    );
  };

  const containerStyle = [
    styles.container,
    { backgroundColor: getThemeBackground() }
  ];

  const wordTransform = [
    { scale: scaleWord },
    { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }
  ];

  return (
    <View style={containerStyle}>
      {/* HUD Bar */}
      <View style={styles.hudBar}>
        {onExit && (
          <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
            <Text style={styles.menuButtonText}>Menu</Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.gameTitle}>WORD SPRINT</Text>
        
        <View style={styles.hudRight}>
          {onStore && (
            <TouchableOpacity style={styles.storeButton} onPress={handleStorePress}>
              <Text style={styles.storeButtonText}>Store</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
          <View style={styles.pointsPill}>
            <Text style={styles.pointsText}>{points}</Text>
            <Text style={styles.streakText}>🔥{streak}</Text>
          </View>
        </View>
      </View>

      {/* Success Banner */}
      {showBanner && (
        <View style={[styles.banner, { backgroundColor: getThemeBackground() }]}>
          <Text style={styles.bannerText}>{bannerText}</Text>
        </View>
      )}

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Game Content */}
      <View style={styles.gameContent}>
        <Text style={styles.themeText}>Theme: {themes[stage]}</Text>
        
        <Animated.View style={[styles.wordCard, { opacity: fadeOpacity }]}>
          <Animated.Text style={[styles.scrambledWord, { transform: wordTransform }]}>
            {scrambled}
          </Animated.Text>
        </Animated.View>
        
        <TextInput
          style={[
            styles.input,
            settings.highContrast && { borderColor: '#ffffff', borderWidth: 2 }
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Unscramble…"
          placeholderTextColor="rgba(255,255,255,0.6)"
          autoFocus={true}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={check}
        />
        
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.gameButton, { backgroundColor: buttonColors.submit }]}
            onPress={check}
            {...createPressHandlers(pressScaleSubmit)}
          >
            <Animated.View style={{ transform: [{ scale: pressScaleSubmit }] }}>
              <Text style={[styles.gameButtonText, settings.highContrast && { color: '#ffffff' }]}>
                Submit
              </Text>
            </Animated.View>
          </Pressable>
          
          <Pressable
            style={[styles.gameButton, { backgroundColor: buttonColors.hint }]}
            onPress={hint}
            {...createPressHandlers(pressScaleHint)}
          >
            <Animated.View style={{ transform: [{ scale: pressScaleHint }] }}>
              <Text style={[styles.gameButtonText, settings.highContrast && { color: '#ffffff' }]}>
                Hint (50 pts)
              </Text>
            </Animated.View>
          </Pressable>
          
          <Pressable
            style={[styles.gameButton, { backgroundColor: buttonColors.answer }]}
            onPress={answer}
            {...createPressHandlers(pressScaleAnswer)}
          >
            <Animated.View style={{ transform: [{ scale: pressScaleAnswer }] }}>
              <Text style={[styles.gameButtonText, settings.highContrast && { color: '#ffffff' }]}>
                Answer (200 pts)
              </Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {/* Stage Complete Modal */}
      <Modal
        visible={showStageComplete}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stageCompleteModal}>
            <Text style={styles.stageCompleteTitle}>Stage {stage + 1} Clear!</Text>
            <Text style={styles.stageCompleteText}>Total Points: {points}</Text>
            <Text style={styles.stageCompleteText}>Streak: {streak}</Text>
            <View style={styles.stageCompleteButtons}>
              <TouchableOpacity
                style={[styles.stageCompleteButton, styles.nextStageButton]}
                onPress={nextStage}
              >
                <Text style={styles.stageCompleteButtonText}>Next Stage</Text>
              </TouchableOpacity>
              {onExit && (
                <TouchableOpacity
                  style={[styles.stageCompleteButton, styles.menuStageButton]}
                  onPress={() => {
                    setShowStageComplete(false);
                    handleMenuPress();
                  }}
                >
                  <Text style={styles.stageCompleteButtonText}>Menu</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Popups */}
      <ConfirmationPopup
        visible={showHintPopup}
        title="Hint"
        cost={50}
        currentPoints={points}
        onConfirm={handleHintConfirm}
        onCancel={() => setShowHintPopup(false)}
      />

      <ConfirmationPopup
        visible={showAnswerPopup}
        title="Answer"
        cost={200}
        currentPoints={points}
        onConfirm={handleAnswerConfirm}
        onCancel={() => setShowAnswerPopup(false)}
      />

      {/* Gear Menu Modal */}
      <Modal
        visible={showGearMenu}
        transparent={true}
        animationType={settings.reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowGearMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.gearMenuContent}>
            <Text style={styles.gearMenuTitle}>Game Menu</Text>
            
            <TouchableOpacity
              style={styles.gearMenuItem}
              onPress={() => {
                setShowGearMenu(false);
                setShowSettings(true);
              }}
            >
              <Text style={styles.gearMenuItemText}>⚙️ Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.gearMenuItem}
              onPress={handleFeedbackPress}
            >
              <Text style={styles.gearMenuItemText}>💬 Feedback</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.gearMenuItem, styles.gearMenuCancel]}
              onPress={() => setShowGearMenu(false)}
            >
              <Text style={[styles.gearMenuItemText, styles.gearMenuCancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Panel */}
      <SettingsPanel 
        visible={showSettings} 
        onClose={() => {
          setShowSettings(false);
          loadSettings(); // Reload settings when panel closes
        }} 
      />

      {/* Feedback Modal */}
      <FeedbackModal 
        visible={showFeedback} 
        onClose={() => {
          setShowFeedback(false);
          setFeedbackContext({});
        }}
        prefillCategory={feedbackContext.category}
        prefillMessage={feedbackContext.message}
        currentStage={stage}
        currentLevel={level}
        currentPoints={points}
        currentTheme={themes[stage]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  hudBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  menuButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,111,0,0.8)',
    borderRadius: 4,
  },
  storeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 6,
  },
  settingsButtonText: {
    fontSize: 18,
    color: '#ffffff',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  pointsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  streakText: {
    color: '#ffffff',
    fontSize: 14,
  },
  banner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  progressSegment: {
    width: 16,
    height: 4,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  gameContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  themeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginBottom: 20,
  },
  wordCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrambledWord: {
    fontSize: 42,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    width: '100%',
    maxWidth: 300,
    marginBottom: 30,
    color: '#333',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  gameButton: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gameButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.grey,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCost: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalPoints: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  modalWarning: {
    fontSize: 14,
    color: colors.error,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.grey + '40',
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  disabledModalButton: {
    backgroundColor: colors.grey + '20',
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  disabledModalButtonText: {
    color: colors.grey,
  },
  // Stage complete modal
  stageCompleteModal: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    minWidth: 280,
  },
  stageCompleteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  stageCompleteText: {
    fontSize: 16,
    color: colors.grey,
    marginBottom: 8,
    textAlign: 'center',
  },
  stageCompleteButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  stageCompleteButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextStageButton: {
    backgroundColor: colors.accent,
  },
  menuStageButton: {
    backgroundColor: colors.grey + '40',
  },
  stageCompleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  // Gear menu styles
  gearMenuContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  gearMenuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  gearMenuItem: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  gearMenuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  gearMenuCancel: {
    backgroundColor: colors.grey + '40',
    marginTop: 8,
  },
  gearMenuCancelText: {
    color: colors.grey,
  },
});
