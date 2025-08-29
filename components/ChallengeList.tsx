
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { colors } from '../styles/commonStyles';
import { getCache, syncWordSets } from '../src/levelsync/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChallengeListProps {
  visible: boolean;
  onClose: () => void;
  onChallengeSelect: (challengeName: string, words: string[]) => void;
}

interface ChallengeCache {
  name: string;
  words: string[];
  version: number;
  active_from?: string;
  active_to?: string;
}

interface CompletedChallenge {
  name: string;
  completedAt: string;
  points: number;
}

const COMPLETED_CHALLENGES_KEY = 'completed_challenges';

export default function ChallengeList({ visible, onClose, onChallengeSelect }: ChallengeListProps) {
  const [challenges, setChallenges] = useState<ChallengeCache[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();

  // Memoize loadCompletedChallenges to prevent dependency warnings
  const loadCompletedChallenges = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const completedToday: string[] = [];
      
      // Check each challenge for today's completion
      for (const challenge of challenges) {
        const completionKey = `challenge_done_${challenge.name}_${today}`;
        const isCompleted = await AsyncStorage.getItem(completionKey);
        if (isCompleted) {
          completedToday.push(challenge.name);
        }
      }
      
      // Convert to the expected format for compatibility
      const completedData = completedToday.map(name => ({
        name,
        completedAt: new Date().toISOString(),
        points: 0 // We'll get this from the completion data if needed
      }));
      
      setCompletedChallenges(completedData);
    } catch (error) {
      console.error('Failed to load completed challenges:', error);
    }
  }, [challenges]);

  useEffect(() => {
    if (visible) {
      loadChallenges();
    }
  }, [visible]);

  useEffect(() => {
    if (challenges.length > 0) {
      loadCompletedChallenges();
    }
  }, [challenges, loadCompletedChallenges]);

  const loadChallenges = async () => {
    setLoading(true);
    try {
      // Sync word sets (including challenges) from server first
      await syncWordSets();
      
      // Load from unified cache
      const cache = await getCache();
      const activeChallenges = cache.challenges.filter(challenge => {
        // Filter challenges that are currently active
        if (!challenge.active_from || !challenge.active_to) {
          return true; // Always active if no dates
        }
        const today = new Date().toISOString().split('T')[0];
        return today >= challenge.active_from && today <= challenge.active_to;
      });
      
      setChallenges(activeChallenges);
      console.log(`Loaded ${activeChallenges.length} active challenges`);
    } catch (error) {
      console.error('Failed to load challenges:', error);
      Alert.alert('Error', 'Failed to load challenges. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isChallengeCompleted = (challengeName: string): boolean => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return completedChallenges.some(c => c.name === challengeName);
  };

  const handleChallengePress = (challenge: ChallengeCache) => {
    // Check if challenge is currently active
    if (challenge.active_from && challenge.active_to) {
      const today = new Date().toISOString().split('T')[0];
      if (today < challenge.active_from || today > challenge.active_to) {
        Alert.alert('Challenge Not Active', 'This challenge is not currently active.');
        return;
      }
    }
    
    if (isChallengeCompleted(challenge.name)) {
      Alert.alert(
        'Challenge Completed',
        `You have already completed "${challenge.name}" today. Would you like to play it again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Play Again', 
            onPress: () => onChallengeSelect(challenge.name, challenge.words)
          }
        ]
      );
    } else {
      onChallengeSelect(challenge.name, challenge.words);
    }
  };

  const renderChallenge = (challenge: ChallengeCache, index: number) => {
    const isCompleted = isChallengeCompleted(challenge.name);
    const completedData = completedChallenges.find(c => c.name === challenge.name);
    
    // Check if challenge is currently active
    const isActive = !challenge.active_from || !challenge.active_to || 
      (() => {
        const today = new Date().toISOString().split('T')[0];
        return today >= challenge.active_from && today <= challenge.active_to;
      })();

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.challengeCard,
          isCompleted && styles.completedChallengeCard,
          !isActive && styles.inactiveChallengeCard
        ]}
        onPress={() => handleChallengePress(challenge)}
        disabled={!isActive}
      >
        <View style={styles.challengeHeader}>
          <Text style={[
            styles.challengeName,
            isCompleted && styles.completedChallengeName,
            !isActive && styles.inactiveChallengeName
          ]}>
            {challenge.name}
          </Text>
          <View style={styles.challengeStatus}>
            {isCompleted && <Text style={styles.completedIcon}>✓ Complete</Text>}
            {!isActive && <Text style={styles.inactiveTag}>Not Active</Text>}
          </View>
        </View>
        
        <Text style={styles.challengeInfo}>
          {challenge.words.length} words
        </Text>
        
        {challenge.active_from && challenge.active_to && (
          <Text style={styles.challengeDates}>
            {formatDate(challenge.active_from)} – {formatDate(challenge.active_to)}
          </Text>
        )}
        
        {isCompleted && completedData && (
          <Text style={styles.completedInfo}>
            Completed today
          </Text>
        )}
        
        <Text style={[
          styles.challengeReward,
          !isActive && styles.inactiveText
        ]}>
          {isActive ? 'Reward: +20 points per word' : 'Challenge not available'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Seasonal Challenges</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading challenges...</Text>
            </View>
          ) : challenges.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Active Challenges</Text>
              <Text style={styles.emptyText}>
                Check back later for seasonal challenges like Halloween, Christmas, and more!
              </Text>
            </View>
          ) : (
            <View style={styles.challengesList}>
              <Text style={styles.subtitle}>
                Complete special word challenges for bonus points!
              </Text>
              {challenges.map((challenge, index) => renderChallenge(challenge, index))}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadChallenges}
          disabled={loading}
        >
          <Text style={styles.refreshButtonText}>
            {loading ? 'Refreshing...' : 'Refresh Challenges'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    color: colors.grey,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  challengesList: {
    gap: 16,
  },
  challengeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  completedChallengeCard: {
    backgroundColor: colors.success + '10',
    borderColor: colors.success + '30',
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  completedChallengeName: {
    color: colors.success,
  },
  completedIcon: {
    fontSize: 20,
    color: colors.success,
    fontWeight: 'bold',
  },
  challengeInfo: {
    fontSize: 14,
    color: colors.grey,
    marginBottom: 4,
  },
  completedInfo: {
    fontSize: 14,
    color: colors.success,
    marginBottom: 4,
    fontWeight: '500',
  },
  challengeReward: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: colors.grey,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.grey,
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshButton: {
    margin: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  challengeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeDates: {
    fontSize: 12,
    color: colors.grey,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  inactiveChallengeCard: {
    backgroundColor: colors.grey + '10',
    borderColor: colors.grey + '30',
    opacity: 0.6,
  },
  inactiveChallengeName: {
    color: colors.grey,
  },
  inactiveTag: {
    fontSize: 12,
    color: colors.error,
    backgroundColor: colors.error + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  inactiveText: {
    color: colors.grey,
  },
});
