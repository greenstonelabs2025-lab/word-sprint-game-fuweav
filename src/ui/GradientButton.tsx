
import React, { useRef } from 'react';
import { 
  Pressable, 
  Text, 
  View, 
  StyleSheet, 
  useWindowDimensions, 
  Platform,
  AccessibilityInfo 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  withTiming, 
  useAnimatedStyle,
  interpolate 
} from 'react-native-reanimated';
import { loadSettings } from '../../utils/settings';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  colors?: [string, string];
  icon?: string;
  disabled?: boolean;
  style?: any;
}

const GradientButton: React.FC<GradientButtonProps> = ({ 
  title, 
  onPress, 
  colors = ["#4A90E2", "#357ABD"], 
  icon, 
  disabled = false,
  style 
}) => {
  const { width } = useWindowDimensions();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  // Load settings for user preferences
  const [settings, setSettings] = React.useState({
    vibrate: true,
    reduceMotion: false,
    highContrast: false,
    sound: false,
  });

  React.useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const userSettings = await loadSettings();
        setSettings(userSettings);
      } catch (error) {
        console.error('Error loading settings in GradientButton:', error);
      }
    };
    loadUserSettings();
  }, []);

  const handlePressIn = () => {
    if (disabled) return;
    
    if (!settings.reduceMotion) {
      scale.value = withTiming(0.97, { duration: 100 });
    } else {
      opacity.value = withTiming(0.8, { duration: 100 });
    }
    
    if (settings.vibrate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    if (disabled) return;
    
    if (!settings.reduceMotion) {
      scale.value = withTiming(1, { duration: 100 });
    } else {
      opacity.value = withTiming(1, { duration: 100 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    if (settings.reduceMotion) {
      return {
        opacity: opacity.value,
      };
    }
    
    return {
      transform: [{ scale: scale.value }],
      opacity: disabled ? 0.5 : 1,
    };
  });

  // Calculate responsive width
  const buttonWidth = Math.min(width * 0.83, 400);
  const isTablet = width > 768;
  const maxWidth = isTablet ? 400 : width - 24;

  // Get contrast color for high contrast mode
  const getContrastColor = (hexColor: string): string => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // High contrast mode colors
  const finalColors = settings.highContrast 
    ? [colors[0], colors[0]] // Solid color for high contrast
    : disabled 
    ? ["#444", "#222"] 
    : colors;

  const textColor = settings.highContrast 
    ? getContrastColor(colors[0])
    : disabled 
    ? 'rgba(255,255,255,0.5)' 
    : '#ffffff';

  // Auto-shrink font size for long titles
  const getFontSize = () => {
    const baseSize = 18;
    if (title.length > 20) return 16;
    if (title.length > 15) return 17;
    return baseSize;
  };

  return (
    <Animated.View style={[animatedStyle, { width: '100%', alignItems: 'center' }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[{ width: Math.min(buttonWidth, maxWidth) }, style]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${icon ? icon + ' ' : ''}${title}`}
        accessibilityHint={disabled ? 'Button is disabled' : 'Double tap to activate'}
      >
        <LinearGradient
          colors={finalColors}
          style={[
            styles.gradient,
            settings.highContrast && styles.highContrastGradient,
            disabled && styles.disabledGradient
          ]}
          start={[0, 0]}
          end={[1, 1]}
        >
          <View style={styles.content}>
            {icon && (
              <Text 
                style={[styles.icon, { color: textColor }]} 
                role="img"
                accessibilityLabel={`${title} icon`}
              >
                {icon}
              </Text>
            )}
            <Text 
              style={[
                styles.title, 
                { 
                  color: textColor,
                  fontSize: getFontSize()
                }
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              {title}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  gradient: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44, // Accessibility minimum
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  highContrastGradient: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  disabledGradient: {
    shadowOpacity: 0,
    elevation: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    width: '100%',
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
});

export default GradientButton;
