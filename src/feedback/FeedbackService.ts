
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../app/integrations/supabase/client';

interface PendingFeedback {
  name: string;
  category: string;
  message: string;
  stage: number;
  level: number;
  points: number;
  device: string;
  app_ver: string;
  timestamp: string;
}

class FeedbackService {
  private readonly STORAGE_KEY = 'pending_feedback';

  async submitPendingFeedback(): Promise<void> {
    try {
      const pendingData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!pendingData) {
        console.log('FeedbackService: No pending feedback to submit');
        return;
      }

      const pendingList: PendingFeedback[] = JSON.parse(pendingData);
      if (pendingList.length === 0) {
        console.log('FeedbackService: Pending feedback list is empty');
        return;
      }

      console.log(`FeedbackService: Attempting to submit ${pendingList.length} pending feedback items`);

      const successfulSubmissions: number[] = [];

      for (let i = 0; i < pendingList.length; i++) {
        const feedback = pendingList[i];
        
        try {
          // Remove timestamp field before submitting to Supabase
          const { timestamp, ...feedbackData } = feedback;
          
          const { error } = await supabase
            .from('feedback')
            .insert([feedbackData]);

          if (error) {
            console.error(`FeedbackService: Failed to submit feedback ${i}:`, error);
            // Continue with next item instead of breaking
          } else {
            console.log(`FeedbackService: Successfully submitted feedback ${i}`);
            successfulSubmissions.push(i);
          }
        } catch (error) {
          console.error(`FeedbackService: Error submitting feedback ${i}:`, error);
          // Continue with next item
        }
      }

      // Remove successfully submitted items from the pending list
      if (successfulSubmissions.length > 0) {
        const remainingFeedback = pendingList.filter((_, index) => !successfulSubmissions.includes(index));
        
        if (remainingFeedback.length === 0) {
          // All feedback submitted successfully
          await AsyncStorage.removeItem(this.STORAGE_KEY);
          console.log('FeedbackService: All pending feedback submitted successfully');
        } else {
          // Some feedback still pending
          await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(remainingFeedback));
          console.log(`FeedbackService: ${successfulSubmissions.length} feedback items submitted, ${remainingFeedback.length} still pending`);
        }
      } else {
        console.log('FeedbackService: No feedback items were successfully submitted');
      }
    } catch (error) {
      console.error('FeedbackService: Error processing pending feedback:', error);
    }
  }

  async getPendingFeedbackCount(): Promise<number> {
    try {
      const pendingData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!pendingData) return 0;
      
      const pendingList: PendingFeedback[] = JSON.parse(pendingData);
      return pendingList.length;
    } catch (error) {
      console.error('FeedbackService: Error getting pending feedback count:', error);
      return 0;
    }
  }

  async clearPendingFeedback(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('FeedbackService: Cleared all pending feedback');
    } catch (error) {
      console.error('FeedbackService: Error clearing pending feedback:', error);
    }
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();

// Export convenience functions
export const submitPendingFeedback = () => feedbackService.submitPendingFeedback();
export const getPendingFeedbackCount = () => feedbackService.getPendingFeedbackCount();
export const clearPendingFeedback = () => feedbackService.clearPendingFeedback();
