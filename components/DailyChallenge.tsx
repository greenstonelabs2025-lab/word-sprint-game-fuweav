
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  Vibration,
  Alert,
  useWindowDimensions,
  ScrollView,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../app/integrations/supabase/client';
import { track } from '../src/analytics/AnalyticsService';
import GradientButton from '../src/ui/GradientButton';
import { triggerHaptic } from '../src/services/HapticsService';
import {
  generateDailyWord,
  getTodayKey,
  isDailyChallengeCompleted,
  markDailyChallengeCompleted,
  awardDailyChallengePoints,
  scrambleDailyWord,
  cleanupOldDailyChallengeData,
} from '../utils/dailyChallenge';

interface DailyChallengeProps {
  onExit: () => void;
}

interface Settings {
  vibrate: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  sound: boolean;
}

interface PremiumModalProps {
  visible: boolean;
  onClose: () => void;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  created_at: string;
}

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
}

// Premium Modal Component
function PremiumModal({ visible, onClose }: PremiumModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.premiumModalContent}>
          <Text style={styles.premiumModalTitle}>Premium Coming Soon</Text>
          <Text style={styles.premiumModalText}>
            Get unlimited hints, answers and Daily Challenge boosts.
          </Text>
          <View style={styles.premiumModalButtons}>
            <TouchableOpacity
              style={[styles.premiumModalButton, styles.closeButton]}
              onPress={() => {
                triggerHaptic("light");
                onClose();
              }}
            >
              <Text style={styles.premiumModalButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.premiumModalButton, styles.notifyButton]}
              onPress={() => {
                triggerHaptic("light");
                console.log('User wants to be notified about Premium');
                Alert.alert('Thanks!', 'We\'ll notify you when Premium is available.');
                onClose();
              }}
            >
              <Text style={styles.premiumModalButtonText}>Notify Me</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Leaderboard Modal Component
function LeaderboardModal({ visible, onClose }: LeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchLeaderboard();
    }
  }, [visible]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const todayKey = getTodayKey();
      console.log('Fetching leaderboard for day:', todayKey);
      
      const { data, error: supabaseError } = await supabase
        .from('daily_leaderboard')
        .select('id, name, score, created_at')
        .eq('day', todayKey)
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(50);

      if (supabaseError) {
        console.error('Supabase error fetching leaderboard:', supabaseError);
        setError('Failed to load leaderboard');
        return;
      }

      console.log('Leaderboard data fetched:', data);
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => (
    <View style={styles.leaderboardItem}>
      <View style={styles.rankContainer}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>
      <View style={styles.nameContainer}>
        <Text style={styles.nameText} numberOfLines={1}>
          {item.name.length > 16 ? item.name.substring(0, 16) + '...' : item.name}
        </Text>
      </View>
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>{item.score}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.leaderboardOverlay}>
        <View style={styles.leaderboardModal}>
          {/* Header */}
          <View style={styles.leaderboardHeader}>
            <Text style={styles.leaderboardTitle}>Today's Leaderboard</Text>
            <TouchableOpacity 
              style={styles.closeIconButton} 
              onPress={() => {
                triggerHaptic("light");
                onClose();
              }}
            >
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.leaderboardContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton} 
                  onPress={() => {
                    triggerHaptic("light");
                    fetchLeaderboard();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : leaderboard.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No scores yet. Be first!</Text>
              </View>
            ) : (
              <>
                {/* Header row */}
                <View style={styles.leaderboardHeaderRow}>
                  <Text style={styles.headerRankText}>Rank</Text>
                  <Text style={styles.headerNameText}>Name</Text>
                  <Text style={styles.headerScoreText}>Score</Text>
                </View>
                
                {/* Leaderboard list */}
                <FlatList
                  data={leaderboard}
                  renderItem={renderLeaderboardItem}
                  keyExtractor={(item) => item.id}
                  style={styles.leaderboardList}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function DailyChallenge({ onExit }: DailyChallengeProps) {
  const { height } = useWindowDimensions();
  const [dailyWord, setDailyWord] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');
  const [input, setInput] = useState('');
  const [points, setPoints] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [isAdFree, setIsAdFree] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    vibrate: true,
    reduceMotion: false,
    highContrast: false,
    sound: false,
  });

  // Animation values
  const scaleWord = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeDaily();
    loadSettings();
    loadAdFreeStatus();
    // Clean up old data on app start (optional)
    cleanupOldDailyChallengeData();
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
      console.log('Settings loaded in daily challenge:', loadedSettings);
    } catch (error) {
      console.error('Error loading settings in daily challenge:', error);
    }
  };

  const loadAdFreeStatus = async () => {
    try {
      const adFreeValue = await AsyncStorage.getItem('pref_ad_free');
      setIsAdFree(adFreeValue === 'true');
      console.log('Ad-free status loaded:', adFreeValue === 'true');
    } catch (error) {
      console.error('Error loading ad-free status:', error);
    }
  };

  const initializeDaily = async () => {
    try {
      // Check if already completed today
      const completed = await isDailyChallengeCompleted();
      if (completed) {
        setIsCompleted(true);
        console.log('Daily challenge already completed for today');
        
        // Load current points for display
        const progressData = await AsyncStorage.getItem('progress');
        if (progressData) {
          const progress = JSON.parse(progressData);
          setPoints(progress.points || 0);
        }
        return;
      }

      // Generate today's word
      const word = generateDailyWord();
      const scrambled = scrambleDailyWord(word);
      
      setDailyWord(word);
      setScrambledWord(scrambled);
      
      // Load current points
      const progressData = await AsyncStorage.getItem('progress');
      if (progressData) {
        const progress = JSON.parse(progressData);
        setPoints(progress.points || 0);
      }
      
      console.log('Daily challenge initialized:', { word, scrambled });
    } catch (error) {
      console.error('Error initializing daily challenge:', error);
      // Fallback
      const word = 'challenge';
      setDailyWord(word);
      setScrambledWord(scrambleDailyWord(word));
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

    // Re-scramble on wrong answer
    setScrambledWord(scrambleDailyWord(dailyWord));
  };

  const submitToLeaderboard = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const todayKey = getTodayKey();
      
      // Check if already submitted today
      const submittedKey = `daily_submitted_${todayKey}`;
      const alreadySubmitted = await AsyncStorage.getItem(submittedKey);
      
      if (alreadySubmitted === 'true') {
        console.log('Already submitted to leaderboard today');
        return;
      }
      
      // Get display name
      const displayName = await AsyncStorage.getItem('pref_name') || 'Player';
      
      console.log('Submitting to leaderboard:', { day: todayKey, name: displayName, score: 100 });
      
      // Submit to Supabase with upsert (insert or update if exists)
      const { error } = await supabase
        .from('daily_leaderboard')
        .upsert(
          { day: todayKey, name: displayName, score: 100 },
          { onConflict: 'day,name' }
        );

      if (error) {
        console.error('Supabase error submitting score:', error);
        // Don't block the user experience - show friendly message but continue
        Alert.alert(
          'Leaderboard Unavailable', 
          'Your score couldn\'t be submitted to the leaderboard, but your progress has been saved locally.'
        );
      } else {
        console.log('Score submitted to leaderboard successfully');
        // Mark as submitted to prevent double submissions
        await AsyncStorage.setItem(submittedKey, 'true');
      }
    } catch (error) {
      console.error('Error submitting to leaderboard:', error);
      // Don't block the user experience
      Alert.alert(
        'Leaderboard Unavailable', 
        'Your score couldn\'t be submitted to the leaderboard, but your progress has been saved locally.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (isCompleted) return;

    if (input.toLowerCase().trim() === dailyWord.toLowerCase()) {
      // Correct answer!
      if (settings.vibrate) {
        triggerHaptic("success");
      }
      
      animateCorrect();
      
      try {
        // Mark as completed and award points
        await markDailyChallengeCompleted();
        const newPoints = await awardDailyChallengePoints(100);
        
        setPoints(newPoints);
        setIsCompleted(true);
        setShowSuccessModal(true);
        
        // Track daily challenge success
        track("daily_win", {
          day: getTodayKey(),
          bonus: 100,
          word: dailyWord.toLowerCase(),
          points: newPoints
        });
        
        // Submit to leaderboard (non-blocking)
        submitToLeaderboard();
        
        console.log('Daily challenge completed! 100 points awarded');
      } catch (error) {
        console.error('Error completing daily challenge:', error);
        // Still show success even if save fails (fallback)
        setIsCompleted(true);
        setShowSuccessModal(true);
        Alert.alert('Success!', 'Challenge completed! (Note: Progress may not have saved)');
      }
    } else {
      // Wrong answer
      if (settings.vibrate) {
        triggerHaptic("error");
      }
      
      animateWrong();
      
      // Track wrong answer in daily challenge
      track("daily_wrong", {
        day: getTodayKey(),
        word: dailyWord.toLowerCase(),
        guess: input.toLowerCase().trim()
      });
      
      console.log('Wrong answer in daily challenge');
    }
  };

  const createPressHandlers = () => ({
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

  // Get theme background color (use a default theme color for daily)
  const getThemeBackground = () => {
    if (settings.highContrast) {
      return '#1a1a1a';
    }
    return '#4a148c'; // Purple theme for daily challenge
  };

  const wordTransform = [
    { scale: scaleWord },
    { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }
  ];

  if (isCompleted && !showSuccessModal) {
    return (
      <View style={[styles.container, { backgroundColor: getThemeBackground() }]}>
        {/* HUD Bar */}
        <View style={styles.hud}>
          <View style={styles.hudLeft}>
            <GradientButton
              title="🏠"
              onPress={onExit}
              colors={['#3A4A6A', '#23314A']}
              size="sm"
            />
          </View>
          <View style={styles.hudCenter}>
            <Text style={styles.hudTitle}>DAILY CHALLENGE</Text>
          </View>
          <View style={styles.hudRight}>
            <Text style={styles.hudMeta} numberOfLines={1} adjustsFontSizeToFit>
              Pts: {points}
            </Text>
          </View>
        </View>

        <View style={styles.completedContainer}>
          <Text style={styles.completedTitle}>Challenge Complete! ✓</Text>
          <Text style={styles.completedText}>You earned 100 bonus points today.</Text>
          <Text style={styles.completedText}>Come back tomorrow for a new challenge!</Text>
          
          <View style={styles.leaderboardContainer}>
            <TouchableOpacity
              style={styles.viewLeaderboardButton}
              onPress={() => {
                if (settings.vibrate) {
                  triggerHaptic("light");
                }
                setShowLeaderboardModal(true);
              }}
            >
              <Text style={styles.viewLeaderboardButtonText}>View Leaderboard</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (settings.vibrate) {
                triggerHaptic("light");
              }
              onExit();
            }}
          >
            <Text style={styles.backButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>

        {/* Leaderboard Modal */}
        <LeaderboardModal
          visible={showLeaderboardModal}
          onClose={() => setShowLeaderboardModal(false)}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[getThemeBackground(), '#000000']}
      style={styles.container}
    >
      {/* HUD Bar */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <GradientButton
            title="🏠"
            onPress={onExit}
            colors={['#3A4A6A', '#23314A']}
            size="sm"
          />
        </View>
        <View style={styles.hudCenter}>
          <Text style={styles.hudTitle}>DAILY CHALLENGE</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudMeta} numberOfLines={1} adjustsFontSizeToFit>
            Pts: {points}
          </Text>
        </View>
      </View>

      {/* Game Content */}
      <View style={styles.gameContent}>
        <Text style={styles.dailyTitle}>Today's Challenge</Text>
        
        <View style={styles.wordCard}>
          <Animated.Text style={[styles.scrambledWord, { transform: wordTransform }]}>
            {scrambledWord}
          </Animated.Text>
        </View>
        
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
          onSubmitEditing={handleSubmit}
          editable={!isCompleted}
        />
        
        <View style={styles.submitButtonContainer}>
          <GradientButton
            title="Submit"
            icon="✅"
            onPress={handleSubmit}
            colors={isCompleted ? ['#666666', '#444444'] : ['#00E676', '#00B248']}
            disabled={isCompleted}
            style={styles.submitButtonStyle}
          />
        </View>

        {/* Premium Upsell - Only show if not ad-free */}
        {!isAdFree && (
          <View style={styles.upsellContainer}>
            <Text style={[
              styles.upsellText,
              { fontStyle: 'italic', color: settings.highContrast ? '#cccccc' : 'rgba(255,255,255,0.7)' }
            ]}>
              Want Hints in Daily? Unlock Premium.
            </Text>
            
            <GradientButton
              title="Go Premium"
              icon="⭐"
              onPress={() => setShowPremiumModal(true)}
              colors={['#FFC107', '#FF9800']}
              size="sm"
              style={styles.premiumButtonStyle}
            />
          </View>
        )}

        {/* Leaderboard Button */}
        <View style={styles.leaderboardContainer}>
          <TouchableOpacity
            style={styles.viewLeaderboardButton}
            onPress={() => {
              if (settings.vibrate) {
                triggerHaptic("light");
              }
              setShowLeaderboardModal(true);
            }}
          >
            <Text style={styles.viewLeaderboardButtonText}>View Leaderboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <Text style={styles.successModalTitle}>Congrats!</Text>
            <Text style={styles.successModalText}>You earned 100 bonus points.</Text>
            <Text style={styles.leaderboardText}>
              Your score has been submitted to the leaderboard!
            </Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                if (settings.vibrate) {
                  triggerHaptic("light");
                }
                setShowSuccessModal(false);
                // Stay on the completed screen
              }}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Premium Modal - Only show if not ad-free */}
      {!isAdFree && (
        <PremiumModal
          visible={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
        />
      )}

      {/* Leaderboard Modal */}
      <LeaderboardModal
        visible={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
      />
    </LinearGradient>
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
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingTop: 10,
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
  gameContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dailyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 30,
    textAlign: 'center',
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
    marginBottom: 20,
    color: '#333',
  },
  submitButtonContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 30,
    alignItems: 'center',
  },
  submitButtonStyle: {
    width: '100%',
  },
  upsellContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  upsellText: {
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  premiumButtonStyle: {
    width: 200,
  },
  leaderboardContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  leaderboardText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 4,
  },
  leaderboardNote: {
    fontSize: 12,
    textAlign: 'center',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  completedTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00e676',
    marginBottom: 20,
    textAlign: 'center',
  },
  completedText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  backButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
    alignItems: 'center',
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00e676',
    marginBottom: 16,
    textAlign: 'center',
  },
  successModalText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#00e676',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  premiumModalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 280,
    alignItems: 'center',
  },
  premiumModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  premiumModalText: {
    fontSize: 16,
    color: colors.grey,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  premiumModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  premiumModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: colors.grey + '40',
  },
  notifyButton: {
    backgroundColor: colors.accent,
  },
  premiumModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  // Leaderboard button styles
  viewLeaderboardButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  viewLeaderboardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  // Leaderboard modal styles
  leaderboardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardModal: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    margin: 20,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey + '20',
  },
  leaderboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  leaderboardContent: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.grey,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: colors.grey,
    textAlign: 'center',
  },
  leaderboardHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    marginBottom: 8,
  },
  headerRankText: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  headerNameText: {
    flex: 3,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'left',
    paddingLeft: 8,
  },
  headerScoreText: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  leaderboardList: {
    flex: 1,
  },
  leaderboardItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey + '10',
    alignItems: 'center',
  },
  rankContainer: {
    flex: 1,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  nameContainer: {
    flex: 3,
    paddingLeft: 8,
  },
  nameText: {
    fontSize: 16,
    color: colors.text,
  },
  scoreContainer: {
    flex: 1,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
  },
});
