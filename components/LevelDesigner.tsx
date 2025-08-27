
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
} from 'react-native';
import { colors } from '../styles/commonStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getCache, 
  saveTheme, 
  deleteTheme, 
  syncWordSets,
  initializeCache 
} from '../src/levelsync/SyncService';

interface LevelDesignerProps {
  visible: boolean;
  onClose: () => void;
}

interface WordSetCache {
  themes: string[];
  bank: { [theme: string]: string[] };
  versions: { [theme: string]: number };
}

const LevelDesigner: React.FC<LevelDesignerProps> = ({ visible, onClose }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cache, setCache] = useState<WordSetCache>({ themes: [], bank: {}, versions: {} });
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [words, setWords] = useState<string[]>(Array(15).fill(''));
  const [errors, setErrors] = useState<string[]>(Array(15).fill(''));
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();

  const isTablet = width > 768;

  useEffect(() => {
    if (visible) {
      loadAdminStatus();
    }
  }, [visible]);

  useEffect(() => {
    if (isAdmin && visible) {
      loadCache();
    }
  }, [isAdmin, visible]);

  useEffect(() => {
    if (selectedTheme && cache.bank[selectedTheme]) {
      const themeWords = cache.bank[selectedTheme];
      const paddedWords = [...themeWords];
      while (paddedWords.length < 15) {
        paddedWords.push('');
      }
      setWords(paddedWords.slice(0, 15));
      setErrors(Array(15).fill(''));
    } else if (selectedTheme === 'NEW_THEME') {
      setWords(Array(15).fill(''));
      setErrors(Array(15).fill(''));
    }
  }, [selectedTheme, cache]);

  const loadAdminStatus = async () => {
    try {
      const adminPref = await AsyncStorage.getItem('pref_admin');
      setIsAdmin(adminPref === 'true');
    } catch (error) {
      console.error('Failed to load admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const enableAdmin = async () => {
    try {
      await AsyncStorage.setItem('pref_admin', 'true');
      setIsAdmin(true);
    } catch (error) {
      console.error('Failed to enable admin:', error);
      Alert.alert('Error', 'Failed to enable admin mode');
    }
  };

  const loadCache = async () => {
    try {
      await initializeCache();
      await syncWordSets();
      const currentCache = await getCache();
      setCache(currentCache);
      
      if (currentCache.themes.length > 0 && !selectedTheme) {
        setSelectedTheme(currentCache.themes[0]);
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
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
    if (!selectedTheme || selectedTheme === 'NEW_THEME') {
      Alert.alert('Error', 'Please select or create a theme');
      return;
    }

    if (!validateWords()) {
      return;
    }

    setSaving(true);
    try {
      const cleanWords = words.map(word => word.trim().toLowerCase());
      await saveTheme(selectedTheme, cleanWords);
      
      // Refresh cache
      await loadCache();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedTheme || selectedTheme === 'NEW_THEME') {
      Alert.alert('Error', 'Please select a theme to delete');
      return;
    }

    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the theme "${selectedTheme}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTheme(selectedTheme);
              setSelectedTheme(null);
              await loadCache();
            } catch (error) {
              console.error('Delete failed:', error);
            }
          }
        }
      ]
    );
  };

  const handleRevert = () => {
    if (selectedTheme && cache.bank[selectedTheme]) {
      const themeWords = cache.bank[selectedTheme];
      const paddedWords = [...themeWords];
      while (paddedWords.length < 15) {
        paddedWords.push('');
      }
      setWords(paddedWords.slice(0, 15));
      setErrors(Array(15).fill(''));
    }
  };

  const handleNewTheme = () => {
    Alert.prompt(
      'New Theme',
      'Enter theme name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (themeName) => {
            if (themeName && themeName.trim()) {
              const cleanName = themeName.trim().toLowerCase();
              if (cache.themes.includes(cleanName)) {
                Alert.alert('Error', 'Theme already exists');
                return;
              }
              setSelectedTheme(cleanName);
              setWords(Array(15).fill(''));
              setErrors(Array(15).fill(''));
            }
          }
        }
      ],
      'plain-text'
    );
  };

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

        <View style={[styles.content, isTablet && styles.contentTablet]}>
          {/* Left Panel - Theme List */}
          <View style={[styles.leftPanel, isTablet && styles.leftPanelTablet]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Themes</Text>
              <TouchableOpacity style={styles.newThemeButton} onPress={handleNewTheme}>
                <Text style={styles.newThemeButtonText}>+ New</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.themeList}>
              {cache.themes.map((theme) => (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeItem,
                    selectedTheme === theme && styles.themeItemSelected
                  ]}
                  onPress={() => setSelectedTheme(theme)}
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
              ))}
            </ScrollView>
          </View>

          {/* Right Panel - Editor */}
          <View style={[styles.rightPanel, isTablet && styles.rightPanelTablet]}>
            {selectedTheme ? (
              <>
                <View style={styles.editorHeader}>
                  <Text style={styles.editorTitle}>
                    {selectedTheme} v{cache.versions[selectedTheme] || 1}
                  </Text>
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
                  Select a theme to edit or create a new one
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
});

export default LevelDesigner;
