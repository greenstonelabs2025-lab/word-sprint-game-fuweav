
import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
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
import DebugPanel from "./components/DebugPanel";
import GradientButton from "./src/ui/GradientButton";
import { updatePoints } from "./components/StoreScreen";
import { colors } from "./styles/commonStyles";
import { track } from "./src/analytics/AnalyticsService";
import { getCache, isCacheEmpty, syncWordSets } from "./src/levelsync/SyncService";

// THEME0_CHECK: Verify themes are loaded correctly from wordBank
console.log("THEME0_CHECK:", themes[0]);

// Debug log to verify themes are loaded correctly from wordBank
console.log("=== THEME DEBUG INFO ===");
console.log("THEMES_0=", themes[0]);
console.log("WordBank themes count:", themes.length);
console.log("First theme words:", wordBank[themes[0]]?.slice(0, 3));
console.log("All themes:", themes);
console.log("Shapes words available:", wordBank["Shapes"]?.length || 0);
console.log("========================");

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

interface LetterTile {
  letter: string;
  index: number;
  disabled: boolean;
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

// Generate letter pool for tap-letter system
const generateLetterPool = (word: string): LetterTile[] => {
  const wordLetters = word.toLowerCase().split('');
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const pool: string[] = [...wordLetters];
  
  // Count existing letters to avoid too many duplicates
  const letterCounts: { [key: string]: number } = {};
  wordLetters.forEach(letter => {
    letterCounts[letter] = (letterCounts[letter] || 0) + 1;
  });
  
  // Add random letters until we have at least 10 (or more if word is longer)
  const targetSize = Math.max(10, word.length + 3);
  while (pool.length < targetSize) {
    const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
    const currentCount = letterCounts[randomLetter] || 0;
    
    // Limit each letter to max 2 total occurrences unless it's in the word more than that
    const maxAllowed = Math.max(2, wordLetters.filter(l => l === randomLetter).length);
    if (currentCount < maxAllowed) {
      pool.push(randomLetter);
      letterCounts[randomLetter] = currentCount + 1;
    }
  }
  
  // Shuffle the pool and create tiles with indices
  const shuffledPool = pool.sort(() => Math.random() - 0.5);
  return shuffledPool.map((letter, index) => ({
    letter: letter.toUpperCase(),
    index,
    disabled: false
  }));
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
            <GradientButton
              title="Cancel"
              onPress={onCancel}
              colors={[colors.grey + '60', colors.grey + '40']}
              style={styles.modalButton}
            />
            
            <GradientButton
              title="Confirm"
              onPress={hasEnoughPoints ? onConfirm : onCancel}
              colors={hasEnoughPoints ? [colors.accent, colors.primary] : [colors.grey + '40', colors.grey + '20']}
              disabled={!hasEnoughPoints}
              style={styles.modalButton}
            />
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
  const [word, setWord] = useState('loading');
  const [scrambled, setScrambled] = useState('loading');
  
  // Tap-letter system state
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [letterTiles, setLetterTiles] = useState<LetterTile[]>([]);
  const [guessHistory, setGuessHistory] = useState<number[]>([]); // Track tile indices used
  
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
  
  // Word sets cache state
  const [wordSetsCache, setWordSetsCache] = useState<{
    themes: string[];
    bank: { [theme: string]: string[] };
    versions: { [theme: string]: number };
  }>({ themes: [], bank: {}, versions: {} });
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [showSyncRequired, setShowSyncRequired] = useState(false);
  
  // Popup states
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [showAnswerPopup, setShowAnswerPopup] = useState(false);
  const [showGearMenu, setShowGearMenu] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [titleTapCount, setTitleTapCount] = useState(0);

  // Animation values
  const scaleWord = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pressScaleBackspace = useRef(new Animated.Value(1)).current;
  const pressScaleClear = useRef(new Animated.Value(1)).current;
  const pressScaleShuffle = useRef(new Animated.Value(1)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;

  // Load settings, word sets cache, and game progress
  useEffect(() => {
    loadSettings();
    loadWordSetsCache();
  }, []);

  // Load progress after cache is loaded
  useEffect(() => {
    if (cacheLoaded) {
      loadProgress();
    }
  }, [cacheLoaded]);

  // Initialize letter pool when word changes
  useEffect(() => {
    if (word && word !== 'loading') {
      const tiles = generateLetterPool(word);
      setLetterTiles(tiles);
      setCurrentGuess([]);
      setGuessHistory([]);
      console.log('Generated letter pool for word:', word, tiles.map(t => t.letter).join(''));
    }
  }, [word]);

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

  const loadWordSetsCache = async () => {
    try {
      console.log('Loading word sets cache...');
      
      // Check if cache is empty
      const isEmpty = await isCacheEmpty();
      if (isEmpty) {
        console.log('Cache is empty, attempting sync...');
        await syncWordSets();
      }
      
      // Load cache
      const cache = await getCache();
      setWordSetsCache(cache);
      
      // Check if we have any themes
      if (cache.themes.length === 0) {
        console.log('No word sets available - showing sync required message');
        setShowSyncRequired(true);
        // Fallback to hardcoded themes for now
        setWordSetsCache({
          themes: themes,
          bank: wordBank,
          versions: themes.reduce((acc, theme) => ({ ...acc, [theme]: 1 }), {})
        });
      }
      
      setCacheLoaded(true);
      console.log('Word sets cache loaded:', cache.themes.length, 'themes');
    } catch (error) {
      console.error('Error loading word sets cache:', error);
      // Fallback to hardcoded data
      setWordSetsCache({
        themes: themes,
        bank: wordBank,
        versions: themes.reduce((acc, theme) => ({ ...acc, [theme]: 1 }), {})
      });
      setCacheLoaded(true);
    }
  };

  const loadProgress = async () => {
    try {
      // One-time cache clear to ensure Shapes theme is used
      const cacheCleared = await AsyncStorage.getItem('shapes_cache_cleared');
      if (!cacheCleared) {
        console.log('One-time cache clear: removing progress to ensure Shapes theme');
        await AsyncStorage.removeItem('progress');
        await AsyncStorage.setItem('shapes_cache_cleared', 'true');
      }
      
      const d = await AsyncStorage.getItem("progress");
      let stored = { stage: 0, level: 0, points: 100 };
      
      if (d) {
        stored = JSON.parse(d);
        console.log('Loaded stored progress:', stored);
      }
      
      let s = stored.stage;
      let l = stored.level;
      let p = stored.points;
      
      // Guard old saves - prevent crashes if stage index is out of bounds
      if (s >= themes.length) {
        console.log('Stage index out of bounds, resetting to 0');
        s = 0;
        l = 0;
        p = 100;
      }
      
      // If saved theme name was "Test" or "Test Animals", hard reset
      if (themes[0] !== "Shapes") {
        console.log('First theme is not Shapes, hard reset');
        s = 0;
        l = 0;
        p = 100;
      }
      
      setStage(s);
      setLevel(l);
      setPoints(p);
      
      // Set word from themes after setting stage/level
      const w = getWordForLevel(s, l);
      setWord(w);
      setScrambled(scramble(w));
      
      console.log(`Progress loaded: Stage ${s + 1}, Level ${l + 1}, Points ${p}, Word: ${w}, Theme: ${themes[s]}`);
    } catch (e) {
      console.log('Error loading progress:', e);
      // Set defaults - always start with Shapes (stage 0)
      setStage(0);
      setLevel(0);
      setPoints(100);
      const w = getWordForLevel(0, 0);
      setWord(w);
      setScrambled(scramble(w));
      console.log(`Default progress set: Stage 1, Level 1, Theme: ${themes[0]}, Word: ${w}`);
    }
  };

  const getWordForLevel = (stageIndex: number, levelIndex: number): string => {
    const theme = themes[stageIndex];
    const word = wordBank[theme][levelIndex];
    
    if (!word) {
      console.warn(`No word found for theme ${theme} at level ${levelIndex}, using fallback`);
      return "demo"; // Fallback word
    }
    
    return word;
  };

  const save = async (s: number, l: number, p: number) => {
    try {
      await AsyncStorage.setItem("progress", JSON.stringify({ stage: s, level: l, points: p }));
    } catch (e) {
      console.log('Error saving progress:', e);
    }
  };

  // Tap-letter system functions
  const handleLetterTap = (tileIndex: number) => {
    const tile = letterTiles[tileIndex];
    if (tile.disabled || currentGuess.length >= word.length) return;
    
    if (settings.sound) {
      playClick();
    }
    
    // Add letter to guess
    setCurrentGuess(prev => [...prev, tile.letter]);
    setGuessHistory(prev => [...prev, tileIndex]);
    
    // Disable the tile
    setLetterTiles(prev => prev.map((t, i) => 
      i === tileIndex ? { ...t, disabled: true } : t
    ));
    
    console.log('Letter tapped:', tile.letter, 'Current guess:', [...currentGuess, tile.letter].join(''));
  };

  const handleBackspace = () => {
    if (currentGuess.length === 0) return;
    
    if (settings.sound) {
      playClick();
    }
    
    // Remove last letter and re-enable its tile
    const lastTileIndex = guessHistory[guessHistory.length - 1];
    setCurrentGuess(prev => prev.slice(0, -1));
    setGuessHistory(prev => prev.slice(0, -1));
    
    setLetterTiles(prev => prev.map((t, i) => 
      i === lastTileIndex ? { ...t, disabled: false } : t
    ));
    
    console.log('Backspace - removed letter, current guess:', currentGuess.slice(0, -1).join(''));
  };

  const handleClear = () => {
    if (currentGuess.length === 0) return;
    
    if (settings.sound) {
      playClick();
    }
    
    // Clear all and re-enable all tiles
    setCurrentGuess([]);
    setGuessHistory([]);
    setLetterTiles(prev => prev.map(t => ({ ...t, disabled: false })));
    
    console.log('Cleared guess');
  };

  const handleShuffle = () => {
    if (settings.sound) {
      playClick();
    }
    
    // Shuffle only the unused tiles
    setLetterTiles(prev => {
      const enabledTiles = prev.filter(t => !t.disabled);
      const disabledTiles = prev.filter(t => t.disabled);
      
      // Shuffle enabled tiles
      const shuffledEnabled = enabledTiles.sort(() => Math.random() - 0.5);
      
      // Reconstruct the array maintaining disabled positions
      const result = [...prev];
      let enabledIndex = 0;
      
      for (let i = 0; i < result.length; i++) {
        if (!result[i].disabled) {
          result[i] = { ...shuffledEnabled[enabledIndex], index: i };
          enabledIndex++;
        }
      }
      
      return result;
    });
    
    console.log('Shuffled unused tiles');
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
    setShowStageComplete(false);
    save(s, l, points);
    animateStageTransition();
    console.log(`Advanced to stage ${s + 1}, level ${l + 1}: ${w}`);
  };

  const check = () => {
    if (settings.sound) {
      playClick();
    }

    const guess = currentGuess.join('').toLowerCase();
    const targetWord = word.toLowerCase();

    if (guess === targetWord) {
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
        word: targetWord
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
        word: targetWord,
        guess: guess
      });
      
      animateWrong();
      
      // Re-scramble tiles on wrong answer
      if (!settings.reduceMotion) {
        handleShuffle();
        // Auto-clear guess if reduce motion is off
        setTimeout(() => {
          handleClear();
        }, 300);
      }
      
      console.log('Wrong answer - re-scrambling tiles');
      
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
                message: `Context: Wrong answer on "${word}" (Stage ${stage + 1}, Level ${level + 1}, Theme: ${themes[stage]}). My guess was "${guess}". `
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
      
      // Auto-place the next correct letter
      const targetWord = word.toLowerCase();
      const nextPosition = currentGuess.length;
      
      if (nextPosition < targetWord.length) {
        const nextLetter = targetWord[nextPosition].toUpperCase();
        
        // Find the first available tile with this letter
        const availableTileIndex = letterTiles.findIndex(tile => 
          tile.letter === nextLetter && !tile.disabled
        );
        
        if (availableTileIndex !== -1) {
          // Auto-tap this tile
          handleLetterTap(availableTileIndex);
          console.log('Hint used - auto-placed letter:', nextLetter);
        } else {
          Alert.alert("Hint", `Next letter: ${nextLetter}`);
        }
      }
      
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
      
      // Fill all remaining letters instantly
      const targetWord = word.toLowerCase();
      const remainingLetters = targetWord.slice(currentGuess.length);
      
      for (const letter of remainingLetters) {
        const availableTileIndex = letterTiles.findIndex(tile => 
          tile.letter === letter.toUpperCase() && !tile.disabled
        );
        
        if (availableTileIndex !== -1) {
          // Add to guess without animation
          setCurrentGuess(prev => [...prev, letter.toUpperCase()]);
          setGuessHistory(prev => [...prev, availableTileIndex]);
          setLetterTiles(prev => prev.map((t, i) => 
            i === availableTileIndex ? { ...t, disabled: true } : t
          ));
        }
      }
      
      console.log('Answer revealed - auto-filled word');
      
      // Show success and move to next
      setTimeout(() => {
        showSuccessBanner("Answer revealed!");
        setTimeout(() => {
          next();
        }, 800);
      }, 500);
      
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

  const handleTitleTap = () => {
    const newCount = titleTapCount + 1;
    setTitleTapCount(newCount);
    
    // Reset count after 2 seconds
    setTimeout(() => {
      setTitleTapCount(0);
    }, 2000);
    
    // Show debug panel after 5 taps
    if (newCount >= 5) {
      setShowDebugPanel(true);
      setTitleTapCount(0);
    }
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
      return '#000000';
    }
    
    const themeColors: { [key: string]: string } = {
      Shapes: '#2E3A59',
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
        letterTile: '#00FF00',
        letterTileDisabled: '#333333',
      };
    }
    return {
      submit: '#00e676',
      hint: '#ffd54f',
      answer: '#ff8a80',
      letterTile: '#2E3A59',
      letterTileDisabled: '#1F2943',
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

  // Render current guess boxes
  const renderGuessBoxes = () => {
    const boxes = Array.from({ length: word.length }, (_, i) => {
      const hasLetter = i < currentGuess.length;
      const letter = hasLetter ? currentGuess[i] : '';
      
      return (
        <View
          key={i}
          style={[
            styles.guessBox,
            hasLetter && styles.guessBoxFilled,
            settings.highContrast && styles.guessBoxHighContrast,
            settings.highContrast && hasLetter && styles.guessBoxFilledHighContrast
          ]}
        >
          <Text style={[
            styles.guessBoxText,
            settings.highContrast && styles.guessBoxTextHighContrast
          ]}>
            {letter || '_'}
          </Text>
        </View>
      );
    });
    
    return (
      <View style={styles.guessContainer}>
        {boxes}
      </View>
    );
  };

  // Render letter tiles grid
  const renderLetterTiles = () => {
    const tilesPerRow = 5;
    const rows = [];
    
    for (let i = 0; i < letterTiles.length; i += tilesPerRow) {
      const rowTiles = letterTiles.slice(i, i + tilesPerRow);
      rows.push(
        <View key={i} style={styles.letterRow}>
          {rowTiles.map((tile, index) => (
            <Pressable
              key={tile.index}
              style={[
                styles.letterTile,
                tile.disabled && styles.letterTileDisabled,
                settings.highContrast && !tile.disabled && styles.letterTileHighContrast,
                settings.highContrast && tile.disabled && styles.letterTileDisabledHighContrast
              ]}
              onPress={() => handleLetterTap(tile.index)}
              disabled={tile.disabled}
              {...createPressHandlers(new Animated.Value(1))}
            >
              <Text style={[
                styles.letterTileText,
                tile.disabled && styles.letterTileTextDisabled,
                settings.highContrast && styles.letterTileTextHighContrast
              ]}>
                {tile.letter}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    }
    
    return (
      <View style={styles.letterGrid}>
        {rows}
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

  // Show sync required message if no word sets available
  if (showSyncRequired) {
    return (
      <View style={[styles.container, { backgroundColor: '#424242' }]}>
        <View style={styles.syncRequiredContainer}>
          <Text style={styles.syncRequiredTitle}>No Word Sets</Text>
          <Text style={styles.syncRequiredText}>
            Sync required to load word sets. Please check your connection and try again.
          </Text>
          <GradientButton
            title="Retry Sync"
            onPress={async () => {
              setShowSyncRequired(false);
              await loadWordSetsCache();
            }}
            colors={[colors.primary, colors.accent]}
          />
          {onExit && (
            <GradientButton
              title="Back to Menu"
              onPress={onExit}
              colors={[colors.grey + '60', colors.grey + '40']}
              style={{ marginTop: 16 }}
            />
          )}
        </View>
      </View>
    );
  }

  // Show loading state
  if (!cacheLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: '#424242' }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading word sets...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {/* Fixed HUD Bar */}
      <View style={[
        styles.hud,
        settings.highContrast && { backgroundColor: "#000" }
      ]}>
        <View style={styles.hudLeft}>
          {onExit && (
            <GradientButton
              title="🏠"
              onPress={handleMenuPress}
              colors={['#3A4A6A', '#23314A']}
              size="sm"
            />
          )}
        </View>
        <View style={styles.hudCenter}>
          <Text 
            style={[
              styles.hudTitle,
              settings.highContrast && { color: "#fff" }
            ]}
            onPress={handleTitleTap}
          >
            WORD SPRINT
          </Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={[
            styles.hudMeta,
            settings.highContrast && { color: "#fff" }
          ]} numberOfLines={1} adjustsFontSizeToFit>
            Pts: {points}
          </Text>
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
      <ScrollView style={styles.gameContent} contentContainerStyle={styles.gameContentContainer}>
        <Text style={styles.themeText}>Theme: {themes[stage]}</Text>
        
        <Animated.View style={[styles.wordCard, { opacity: fadeOpacity }]}>
          <Animated.Text style={[styles.scrambledWord, { transform: wordTransform }]}>
            {scrambled}
          </Animated.Text>
        </Animated.View>
        
        {/* Current Guess Display */}
        {renderGuessBoxes()}
        
        {/* Letter Tiles Grid */}
        {renderLetterTiles()}
        
        {/* Control Buttons */}
        <View style={styles.controlButtonsContainer}>
          <View style={styles.controlButtonsRow}>
            <GradientButton
              title="⌫"
              onPress={handleBackspace}
              colors={['#FFD54F', '#FFA000']}
              size="sm"
              style={styles.controlButtonPill}
            />
            
            <GradientButton
              title="🧹 Clear"
              onPress={handleClear}
              colors={['#FF8A80', '#E53935']}
              size="sm"
              style={styles.controlButtonPill}
            />
            
            <GradientButton
              title="🔀"
              onPress={handleShuffle}
              colors={['#9C27B0', '#7B1FA2']}
              size="sm"
              style={styles.controlButtonPill}
            />
          </View>
        </View>
        
        {/* Game Action Buttons */}
        <View style={styles.buttonContainer}>
          <GradientButton
            title="Submit"
            icon="✅"
            onPress={check}
            colors={["#00E676", "#00B248"]}
          />
          
          <GradientButton
            title={points >= 50 ? 'Hint (50)' : 'Need 50 pts'}
            icon="💡"
            onPress={hint}
            colors={["#FFD54F", "#FFA000"]}
            disabled={points < 50}
          />
          
          <GradientButton
            title={points >= 200 ? 'Answer (200)' : 'Need 200 pts'}
            icon="🔑"
            onPress={answer}
            colors={["#FF8A80", "#E53935"]}
            disabled={points < 200}
          />
        </View>
      </ScrollView>

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
              <GradientButton
                title="Next Stage"
                onPress={nextStage}
                colors={[colors.accent, colors.primary]}
                style={styles.stageCompleteButton}
              />
              {onExit && (
                <GradientButton
                  title="Menu"
                  onPress={() => {
                    setShowStageComplete(false);
                    handleMenuPress();
                  }}
                  colors={[colors.grey + '60', colors.grey + '40']}
                  style={styles.stageCompleteButton}
                />
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
            
            <GradientButton
              title="Settings"
              icon="⚙️"
              onPress={() => {
                setShowGearMenu(false);
                setShowSettings(true);
              }}
              colors={[colors.backgroundAlt, colors.grey + '60']}
              style={styles.gearMenuItem}
            />
            
            <GradientButton
              title="Feedback"
              icon="✉️"
              onPress={handleFeedbackPress}
              colors={[colors.backgroundAlt, colors.grey + '60']}
              style={styles.gearMenuItem}
            />
            
            <GradientButton
              title="Cancel"
              icon="✖️"
              onPress={() => setShowGearMenu(false)}
              colors={[colors.grey + '40', colors.grey + '20']}
              style={[styles.gearMenuItem, styles.gearMenuCancel]}
            />
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

      {/* Debug Panel */}
      <DebugPanel 
        visible={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  // HUD 3-column layout
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: "100%",
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingTop: 10,
    zIndex: 1000,
  },
  hudLeft: { flex: 1, alignItems: "flex-start" },
  hudCenter: { flex: 2, alignItems: "center", justifyContent: "center" },
  hudRight: { flex: 1, alignItems: "flex-end" },
  hudTitle: {
    fontSize: 20, 
    fontWeight: "700", 
    letterSpacing: 1, 
    textAlign: "center",
    color: "#fff"
  },
  hudMeta: { 
    fontSize: 16, 
    fontWeight: "600", 
    textAlign: "right",
    color: "#fff"
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
    marginTop: 50, // Account for fixed HUD
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
  },
  gameContentContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    marginBottom: 20,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrambledWord: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  // Guess boxes styles
  guessContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  guessBox: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  guessBoxFilled: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.6)',
    boxShadow: '0 0 8px rgba(255,255,255,0.3)',
  },
  guessBoxHighContrast: {
    backgroundColor: '#000000',
    borderColor: '#ffffff',
    borderWidth: 2,
  },
  guessBoxFilledHighContrast: {
    backgroundColor: '#000000',
    borderColor: '#ffffff',
  },
  guessBoxText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  guessBoxTextHighContrast: {
    color: '#ffffff',
  },
  // Letter tiles styles
  letterGrid: {
    marginBottom: 20,
    gap: 8,
  },
  letterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  letterTile: {
    width: 44,
    height: 44,
    backgroundColor: '#2E3A59',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  letterTileDisabled: {
    backgroundColor: '#1F2943',
    opacity: 0.4,
  },
  letterTileHighContrast: {
    backgroundColor: '#00FF00',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  letterTileDisabledHighContrast: {
    backgroundColor: '#333333',
    borderWidth: 2,
    borderColor: '#ffffff',
    opacity: 1,
  },
  letterTileText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  letterTileTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
  letterTileTextHighContrast: {
    color: '#000000',
  },
  // Control buttons styles
  controlButtonsContainer: {
    marginBottom: 20,
  },
  controlButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  controlButtonPill: {
    minWidth: 60,
    maxWidth: 100,
  },
  // Game action buttons
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
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
    marginBottom: 8,
  },
  gearMenuCancel: {
    marginTop: 8,
  },
  // Sync required styles
  syncRequiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  syncRequiredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  syncRequiredText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
  },
});
