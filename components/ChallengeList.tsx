
import React, { useState, useEffect } from 'react';
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
import { getChallengesCache, syncChallenges } from '../src/levelsync/SyncService';
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

  useEffect(() => {
    if (visible) {
      loadChallenges();
      loadCompletedChallenges();
    }
  }, [visible]);

  const loadChallenges = async () => {
    setLoading(true);
    try {
      // Sync challenges from server first
      await syncChallenges();
      
      // Load from cache
      const cachedChallenges = await getChallengesCache();
      setChallenges(cachedChallenges);
      console.log(`Loaded ${cachedChallenges.length} active challenges`);
    } catch (error) {
      console.error('Failed to load challenges:', error);
      Alert.alert('Error', 'Failed to load challenges. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedChallenges = async () => {
    try {
      const completed = await AsyncStorage.getItem(COMPLETED_CHALLENGES_KEY);
      if (completed) {
        setCompletedChallenges(JSON.parse(completed));
      }
    } catch (error) {
      console.error('Failed to load completed challenges:', error);
    }
  };

  const isChallengeCompleted = (challengeName: string): boolean => {
    return completedChallenges.some(c => c.name === challengeName);
  };

  const handleChallengePress = (challenge: ChallengeCache) => {
    if (isChallengeCompleted(challenge.name)) {
      Alert.alert(
        'Challenge Completed',
        `You have already completed "${challenge.name}". Would you like to play it again?`,
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

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.challengeCard,
          isCompleted && styles.completedChallengeCard
        ]}
        onPress={() => handleChallengePress(challenge)}
      >
        <View style={styles.challengeHeader}>
          <Text style={[
            styles.challengeName,
            isCompleted && styles.completedChallengeName
          ]}>
            {challenge.name}
          </Text>
          {isCompleted && (
            <Text style={styles.completedIcon}>✓</Text>
          )}
        </View>
        
        <Text style={styles.challengeInfo}>
          {challenge.words.length} words
        </Text>
        
        {isCompleted && completedData && (
          <Text style={styles.completedInfo}>
            Completed • {completedData.points} points
          </Text>
        )}
        
        <Text style={styles.challengeReward}>
          Reward: +20 points per word
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
});
