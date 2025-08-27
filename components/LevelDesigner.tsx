
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { colors } from '../styles/commonStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  getCache, 
  saveTheme, 
  deleteTheme, 
  syncWordSets,
  initializeCache,
  getChallengesCache
} from '../src/levelsync/SyncService';

interface LevelDesignerProps {
  visible: boolean;
  onClose: () => void;
}

interface WordSetCache {
  themes: string[];
  bank: { [theme: string]: string[] };
  versions: { [theme: string]: number };
  challenges: Array<{
    name: string;
    words: string[];
    version: number;
    active_from?: string;
    active_to?: string;
  }>;
}

interface ChallengeCache {
  name: string;
  words: string[];
  version: number;
  active_from?: string;
  active_to?: string;
}

const LevelDesigner: React.FC<LevelDesignerProps> = ({ visible, onClose }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stages' | 'challenges'>('stages');
  const [cache, setCache] = useState<WordSetCache>({ themes: [], bank: {}, versions: {}, challenges: [] });
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [words, setWords] = useState<string[]>(Array(15).fill(''));
  const [errors, setErrors] = useState<string[]>(Array(15).fill(''));
  const [saving, setSaving] = useState(false);
  
  // Editor state
  const [currentKind, setCurrentKind] = useState<'Stage' | 'Challenge'>('Stage');
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo, setActiveTo] = useState('');
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  
  const { width } = useWindowDimensions();

  const isTablet = width > 768;

  useEffect(() => {
    console.log('LevelDesigner: visible changed to', visible);
    if (visible) {
      loadAdminStatus();
    }
  }, [visible]);

  useEffect(() => {
    console.log('LevelDesigner: isAdmin changed to', isAdmin, 'visible:', visible);
    if (isAdmin && visible) {
      loadCache();
    }
  }, [isAdmin, visible]);

  useEffect(() => {
    if (activeTab === 'stages' && selectedTheme && cache.bank[selectedTheme]) {
      const themeWords = cache.bank[selectedTheme];
      const paddedWords = [...themeWords];
      while (paddedWords.length < 15) {
        paddedWords.push('');
      }
      setWords(paddedWords.slice(0, 15));
      setErrors(Array(15).fill(''));
      setCurrentKind('Stage');
      setActiveFrom('');
      setActiveTo('');
    } else if (activeTab === 'challenges' && selectedChallenge) {
      const challenge = cache.challenges.find(c => c.name === selectedChallenge);
      if (challenge) {
        const paddedWords = [...challenge.words];
        while (paddedWords.length < 15) {
          paddedWords.push('');
        }
        setWords(paddedWords.slice(0, 15));
        setErrors(Array(15).fill(''));
        setCurrentKind('Challenge');
        setActiveFrom(challenge.active_from || '');
        setActiveTo(challenge.active_to || '');
      }
    } else if (selectedTheme === 'NEW_THEME' || selectedChallenge === 'NEW_CHALLENGE') {
      setWords(Array(15).fill(''));
      setErrors(Array(15).fill(''));
      if (selectedTheme === 'NEW_THEME') {
        setCurrentKind('Stage');
        setActiveFrom('');
        setActiveTo('');
      } else {
        setCurrentKind('Challenge');
        // Set default dates for new challenges
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        setActiveFrom(today.toISOString().split('T')[0]);
        setActiveTo(nextWeek.toISOString().split('T')[0]);
      }
    }
  }, [selectedTheme, selectedChallenge, cache, activeTab]);

  const loadAdminStatus = async () => {
    console.log('LevelDesigner: Loading admin status...');
    try {
      const adminPref = await AsyncStorage.getItem('pref_admin');
      const adminStatus = adminPref === 'true';
      console.log('LevelDesigner: Admin status loaded:', adminStatus);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('LevelDesigner: Failed to load admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const enableAdmin = async () => {
    console.log('LevelDesigner: Enabling admin mode...');
    try {
      await AsyncStorage.setItem('pref_admin', 'true');
      setIsAdmin(true);
      console.log('LevelDesigner: Admin mode enabled');
    } catch (error) {
      console.error('LevelDesigner: Failed to enable admin:', error);
      Alert.alert('Error', 'Failed to enable admin mode');
    }
  };

  const loadCache = async () => {
    console.log('LevelDesigner: Loading cache...');
    try {
      await initializeCache();
      await syncWordSets();
      const currentCache = await getCache();
      console.log('LevelDesigner: Cache loaded:', {
        themes: currentCache.themes.length,
        challenges: currentCache.challenges.length
      });
      setCache(currentCache);
      
      if (activeTab === 'stages' && currentCache.themes.length > 0 && !selectedTheme) {
        setSelectedTheme(currentCache.themes[0]);
      } else if (activeTab === 'challenges' && currentCache.challenges.length > 0 && !selectedChallenge) {
        setSelectedChallenge(currentCache.challenges[0].name);
      }
    } catch (error) {
      console.error('LevelDesigner: Failed to load cache:', error);
    }
  };

  const validateWords = (): boolean => {
    const newErrors = Array(15).fill('');
    let isValid = true;
    const nonEmptyWords = words.filter(word => word.trim() !== '');
    
    if (nonEmptyWords.length !== 15) {
      Alert.alert('Validation Error', 'Please provide exactly 15 words');
      return false;
    }

    const seenWords = new Set<string>();

    words.forEach((word, index) => {
      const trimmed = word.trim().toLowerCase();
      
      if (trimmed === '') {
        newErrors[index] = 'Required';
        isValid = false;
      } else if (trimmed.length < 3 || trimmed.length > 12) {
        newErrors[index] = '3-12 chars';
        isValid = false;
      } else if (!/^[a-z]+$/.test(trimmed)) {
        newErrors[index] = 'Lowercase letters only';
        isValid = false;
      } else if (seenWords.has(trimmed)) {
        newErrors[index] = 'Duplicate';
        isValid = false;
      } else {
        seenWords.add(trimmed);
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    const themeName = activeTab === 'stages' ? selectedTheme : selectedChallenge;
    
    console.log('LevelDesigner: Attempting to save:', {
      themeName,
      activeTab,
      currentKind,
      wordsCount: words.filter(w => w.trim()).length
    });
    
    if (!themeName || themeName === 'NEW_THEME' || themeName === 'NEW_CHALLENGE') {
      Alert.alert('Error', 'Please select or create a theme/challenge');
      return;
    }

    if (!validateWords()) {
      return;
    }

    // Validate challenge dates if needed
    if (currentKind === 'Challenge') {
      if (!activeFrom || !activeTo) {
        Alert.alert('Error', 'Please set active dates for the challenge');
        return;
      }
      
      if (new Date(activeFrom) >= new Date(activeTo)) {
        Alert.alert('Error', 'End date must be after start date');
        return;
      }
    }

    setSaving(true);
    try {
      const cleanWords = words.map(word => word.trim().toLowerCase());
      console.log('LevelDesigner: Saving with parameters:', {
        themeName,
        cleanWords: cleanWords.length,
        currentKind,
        activeFrom: currentKind === 'Challenge' ? activeFrom : undefined,
        activeTo: currentKind === 'Challenge' ? activeTo : undefined
      });
      
      await saveTheme(
        themeName, 
        cleanWords, 
        currentKind,
        currentKind === 'Challenge' ? activeFrom : undefined,
        currentKind === 'Challenge' ? activeTo : undefined
      );
      
      // Refresh cache
      await loadCache();
      
      console.log('LevelDesigner: Save completed successfully');
    } catch (error) {
      console.error('LevelDesigner: Save failed:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const themeName = activeTab === 'stages' ? selectedTheme : selectedChallenge;
    
    if (!themeName || themeName === 'NEW_THEME' || themeName === 'NEW_CHALLENGE') {
      Alert.alert('Error', `Please select a ${currentKind.toLowerCase()} to delete`);
      return;
    }

    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the ${currentKind.toLowerCase()} "${themeName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('LevelDesigner: Deleting:', themeName, currentKind);
              await deleteTheme(themeName, currentKind);
              if (activeTab === 'stages') {
                setSelectedTheme(null);
              } else {
                setSelectedChallenge(null);
              }
              await loadCache();
            } catch (error) {
              console.error('LevelDesigner: Delete failed:', error);
            }
          }
        }
      ]
    );
  };

  const handleRevert = () => {
    if (activeTab === 'stages' && selectedTheme && cache.bank[selectedTheme]) {
      const themeWords = cache.bank[selectedTheme];
      const paddedWords = [...themeWords];
      while (paddedWords.length < 15) {
        paddedWords.push('');
      }
      setWords(paddedWords.slice(0, 15));
      setErrors(Array(15).fill(''));
    } else if (activeTab === 'challenges' && selectedChallenge) {
      const challenge = cache.challenges.find(c => c.name === selectedChallenge);
      if (challenge) {
        const paddedWords = [...challenge.words];
        while (paddedWords.length < 15) {
          paddedWords.push('');
        }
        setWords(paddedWords.slice(0, 15));
        setErrors(Array(15).fill(''));
        setActiveFrom(challenge.active_from || '');
        setActiveTo(challenge.active_to || '');
      }
    }
  };

  const handleNewTheme = () => {
    Alert.prompt(
      'New Stage Theme',
      'Enter theme name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (themeName) => {
            if (themeName && themeName.trim()) {
              const cleanName = themeName.trim().toLowerCase();
              if (cache.themes.includes(cleanName)) {
                Alert.alert('Error', 'Stage theme already exists');
                return;
              }
              setSelectedTheme(cleanName);
              setCurrentKind('Stage');
              setWords(Array(15).fill(''));
              setErrors(Array(15).fill(''));
              setActiveFrom('');
              setActiveTo('');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const handleNewChallenge = () => {
    Alert.prompt(
      'New Challenge',
      'Enter challenge name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (challengeName) => {
            if (challengeName && challengeName.trim()) {
              const cleanName = challengeName.trim();
              if (cache.challenges.some(c => c.name === cleanName)) {
                Alert.alert('Error', 'Challenge already exists');
                return;
              }
              setSelectedChallenge(cleanName);
              setCurrentKind('Challenge');
              setWords(Array(15).fill(''));
              setErrors(Array(15).fill(''));
              
              // Set default dates
              const today = new Date();
              const nextWeek = new Date(today);
              nextWeek.setDate(today.getDate() + 7);
              setActiveFrom(today.toISOString().split('T')[0]);
              setActiveTo(nextWeek.toISOString().split('T')[0]);
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isDateActive = (activeFrom?: string, activeTo?: string): boolean => {
    if (!activeFrom || !activeTo) return true; // Always active if no dates
    const today = new Date().toISOString().split('T')[0];
    return today >= activeFrom && today <= activeTo;
  };

  console.log('LevelDesigner: Rendering with state:', {
    visible,
    loading,
    isAdmin,
    activeTab,
    selectedTheme,
    selectedChallenge,
    cacheThemes: cache.themes.length,
    cacheChallenges: cache.challenges.length
  });

  if (loading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Level Designer</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (!isAdmin) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Level Designer</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.restrictedContainer}>
            <Text style={styles.restrictedTitle}>Restricted</Text>
            <Text style={styles.restrictedText}>
              This feature is only available to administrators.
            </Text>
            <TouchableOpacity style={styles.enableAdminButton} onPress={enableAdmin}>
              <Text style={styles.enableAdminButtonText}>Enable Admin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Level Designer</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stages' && styles.activeTab]}
            onPress={() => {
              console.log('LevelDesigner: Switching to stages tab');
              setActiveTab('stages');
              setSelectedChallenge(null);
              if (cache.themes.length > 0) {
                setSelectedTheme(cache.themes[0]);
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'stages' && styles.activeTabText]}>
              Stages
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'challenges' && styles.activeTab]}
            onPress={() => {
              console.log('LevelDesigner: Switching to challenges tab');
              setActiveTab('challenges');
              setSelectedTheme(null);
              if (cache.challenges.length > 0) {
                setSelectedChallenge(cache.challenges[0].name);
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'challenges' && styles.activeTabText]}>
              Challenges
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.content, isTablet && styles.contentTablet]}>
          {/* Left Panel - Theme/Challenge List */}
          <View style={[styles.leftPanel, isTablet && styles.leftPanelTablet]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>
                {activeTab === 'stages' ? 'Stage Themes' : 'Challenges'}
              </Text>
              <TouchableOpacity 
                style={styles.newThemeButton} 
                onPress={activeTab === 'stages' ? handleNewTheme : handleNewChallenge}
              >
                <Text style={styles.newThemeButtonText}>+ New</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.themeList}>
              {activeTab === 'stages' ? (
                cache.themes.length > 0 ? (
                  cache.themes.map((theme) => (
                    <TouchableOpacity
                      key={theme}
                      style={[
                        styles.themeItem,
                        selectedTheme === theme && styles.themeItemSelected
                      ]}
                      onPress={() => {
                        console.log('LevelDesigner: Selected theme:', theme);
                        setSelectedTheme(theme);
                      }}
                    >
                      <Text style={[
                        styles.themeItemText,
                        selectedTheme === theme && styles.themeItemTextSelected
                      ]}>
                        {theme}
                      </Text>
                      <Text style={styles.themeVersion}>
                        v{cache.versions[theme] || 1}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>No stage themes found</Text>
                    <Text style={styles.emptyStateSubtext}>Create a new theme to get started</Text>
                  </View>
                )
              ) : (
                cache.challenges.length > 0 ? (
                  cache.challenges.map((challenge) => (
                    <TouchableOpacity
                      key={challenge.name}
                      style={[
                        styles.themeItem,
                        selectedChallenge === challenge.name && styles.themeItemSelected
                      ]}
                      onPress={() => {
                        console.log('LevelDesigner: Selected challenge:', challenge.name);
                        setSelectedChallenge(challenge.name);
                      }}
                    >
                      <View style={styles.challengeItemContent}>
                        <Text style={[
                          styles.themeItemText,
                          selectedChallenge === challenge.name && styles.themeItemTextSelected
                        ]}>
                          {challenge.name}
                        </Text>
                        <View style={styles.challengeItemMeta}>
                          <Text style={styles.themeVersion}>
                            v{challenge.version}
                          </Text>
                          {challenge.active_from && challenge.active_to && (
                            <View style={styles.challengeDateBadge}>
                              <Text style={styles.challengeDateText}>
                                {formatDate(challenge.active_from)} – {formatDate(challenge.active_to)}
                              </Text>
                              {!isDateActive(challenge.active_from, challenge.active_to) && (
                                <Text style={styles.inactiveTag}>Inactive</Text>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>No challenges found</Text>
                    <Text style={styles.emptyStateSubtext}>Create a new challenge to get started</Text>
                  </View>
                )
              )}
            </ScrollView>
          </View>

          {/* Right Panel - Editor */}
          <View style={[styles.rightPanel, isTablet && styles.rightPanelTablet]}>
            {(selectedTheme || selectedChallenge) ? (
              <>
                <View style={styles.editorHeader}>
                  <View style={styles.editorTitleContainer}>
                    <Text style={styles.editorTitle}>
                      {activeTab === 'stages' ? selectedTheme : selectedChallenge}
                    </Text>
                    <View style={styles.kindSelector}>
                      <Text style={styles.kindLabel}>Kind:</Text>
                      <View style={styles.kindBadge}>
                        <Text style={styles.kindBadgeText}>{currentKind}</Text>
                      </View>
                    </View>
                  </View>
                  
                  {currentKind === 'Challenge' && (
                    <View style={styles.dateInputsContainer}>
                      <View style={styles.dateInputGroup}>
                        <Text style={styles.dateLabel}>Active From:</Text>
                        <TextInput
                          style={styles.dateInput}
                          value={activeFrom}
                          onChangeText={setActiveFrom}
                          placeholder="YYYY-MM-DD"
                        />
                      </View>
                      <View style={styles.dateInputGroup}>
                        <Text style={styles.dateLabel}>Active To:</Text>
                        <TextInput
                          style={styles.dateInput}
                          value={activeTo}
                          onChangeText={setActiveTo}
                          placeholder="YYYY-MM-DD"
                        />
                      </View>
                    </View>
                  )}
                </View>

                <ScrollView style={styles.wordsContainer}>
                  {words.map((word, index) => (
                    <View key={index} style={styles.wordInputContainer}>
                      <Text style={styles.wordLabel}>{index + 1}.</Text>
                      <View style={styles.wordInputWrapper}>
                        <TextInput
                          style={[
                            styles.wordInput,
                            errors[index] && styles.wordInputError
                          ]}
                          value={word}
                          onChangeText={(text) => {
                            const newWords = [...words];
                            newWords[index] = text;
                            setWords(newWords);
                            
                            // Clear error when user starts typing
                            if (errors[index]) {
                              const newErrors = [...errors];
                              newErrors[index] = '';
                              setErrors(newErrors);
                            }
                          }}
                          placeholder="Enter word"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {errors[index] ? (
                          <Text style={styles.errorText}>{errors[index]}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.revertButton]}
                    onPress={handleRevert}
                  >
                    <Text style={styles.buttonText}>Revert</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={handleDelete}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.button, 
                      styles.saveButton,
                      saving && styles.buttonDisabled
                    ]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.buttonText}>
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.noSelectionContainer}>
                <Text style={styles.noSelectionText}>
                  Select a {activeTab === 'stages' ? 'stage theme' : 'challenge'} to edit or create a new one
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
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
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: colors.text,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  restrictedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  restrictedText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  enableAdminButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  enableAdminButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
  },
  contentTablet: {
    flexDirection: 'row',
  },
  leftPanel: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 300,
  },
  leftPanelTablet: {
    width: 300,
    maxHeight: 'none',
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  newThemeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  newThemeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  themeList: {
    flex: 1,
  },
  themeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  themeItemSelected: {
    backgroundColor: colors.primary + '20',
  },
  themeItemText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  themeItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  themeVersion: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: colors.background,
  },
  rightPanelTablet: {
    flex: 1,
  },
  editorHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  wordsContainer: {
    flex: 1,
    padding: 16,
  },
  wordInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  wordLabel: {
    fontSize: 16,
    color: colors.text,
    width: 30,
    marginTop: 12,
  },
  wordInputWrapper: {
    flex: 1,
  },
  wordInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  wordInputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  revertButton: {
    backgroundColor: colors.textSecondary,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noSelectionText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  // New styles for unified editor
  editorTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  kindSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kindLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  kindBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  kindBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  dateInputsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  challengeItemContent: {
    flex: 1,
  },
  challengeItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  challengeDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeDateText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  inactiveTag: {
    fontSize: 10,
    color: colors.error,
    backgroundColor: colors.error + '20',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default LevelDesigner;
