
import { Platform, Vibration } from "react-native";
import * as expoHaptics from "expo-haptics";

export type Haptic = "none" | "light" | "medium" | "heavy" | "success" | "warning" | "error";

export function triggerHaptic(type: Haptic = "light") {
  if (type === "none") return;
  
  if (expoHaptics) {
    const H = expoHaptics;
    switch (type) {
      case "light": 
        return H.impactAsync(H.ImpactFeedbackStyle.Light);
      case "medium": 
        return H.impactAsync(H.ImpactFeedbackStyle.Medium);
      case "heavy": 
        return H.impactAsync(H.ImpactFeedbackStyle.Heavy);
      case "success": 
        return H.notificationAsync(H.NotificationFeedbackType.Success);
      case "warning": 
        return H.notificationAsync(H.NotificationFeedbackType.Warning);
      case "error": 
        return H.notificationAsync(H.NotificationFeedbackType.Error);
      default:
        return H.impactAsync(H.ImpactFeedbackStyle.Light);
    }
  }
  
  // Fallback to vibration on Android
  if (Platform.OS === "android") {
    Vibration.vibrate(12);
  }
}
