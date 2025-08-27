
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../../app/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface Event {
  type: string;
  props?: any;
  ts: string;
  uid: string;
  app_ver: string;
}

class AnalyticsService {
  private queue: Event[] = [];
  private uid: string = '';
  private appVer: string = '';
  private isInitialized: boolean = false;
  private flushInterval: NodeJS.Timeout | null = null;
  private isFlushingInProgress: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  private readonly STORAGE_KEYS = {
    QUEUE: 'analytics_queue',
    UID: 'analytics_uid',
  };

  async init(userUid?: string, version?: string): Promise<void> {
    try {
      console.log('AnalyticsService: Initializing...');
      
      // Set app version
      this.appVer = version || '1.0.0';
      
      // Get or generate user ID
      if (userUid) {
        this.uid = userUid;
        await AsyncStorage.setItem(this.STORAGE_KEYS.UID, userUid);
      } else {
        const storedUid = await AsyncStorage.getItem(this.STORAGE_KEYS.UID);
        if (storedUid) {
          this.uid = storedUid;
        } else {
          this.uid = uuidv4();
          await AsyncStorage.setItem(this.STORAGE_KEYS.UID, this.uid);
        }
      }

      // Load existing queue from storage
      await this.loadQueue();
      
      // Schedule periodic flushing
      this.scheduleFlush();
      
      this.isInitialized = true;
      console.log(`AnalyticsService: Initialized with UID: ${this.uid}, Version: ${this.appVer}, Queue size: ${this.queue.length}`);
    } catch (error) {
      console.error('AnalyticsService: Failed to initialize:', error);
    }
  }

  track(type: string, props?: any): void {
    if (!this.isInitialized) {
      console.warn('AnalyticsService: Not initialized, skipping track call');
      return;
    }

    try {
      const event: Event = {
        type,
        props: props || {},
        ts: new Date().toISOString(),
        uid: this.uid,
        app_ver: this.appVer,
      };

      this.queue.push(event);
      console.log(`AnalyticsService: Tracked event "${type}" with props:`, props);
      
      // Save queue to storage
      this.saveQueue();
      
      // If queue is getting large, flush immediately
      if (this.queue.length >= 20) {
        this.flush();
      }
    } catch (error) {
      console.error('AnalyticsService: Failed to track event:', error);
    }
  }

  async flush(): Promise<void> {
    if (this.isFlushingInProgress || this.queue.length === 0) {
      return;
    }

    this.isFlushingInProgress = true;
    
    try {
      console.log(`AnalyticsService: Flushing ${this.queue.length} events...`);
      
      // Take up to 50 events from the queue
      const batch = this.queue.slice(0, 50);
      
      if (batch.length === 0) {
        this.isFlushingInProgress = false;
        return;
      }

      // Send to Supabase
      const { error } = await supabase
        .from('events')
        .insert(batch);

      if (error) {
        console.error('AnalyticsService: Failed to send events to Supabase:', error);
        
        // Implement exponential backoff retry
        this.retryCount++;
        if (this.retryCount <= this.maxRetries) {
          const delay = Math.pow(2, this.retryCount) * 1000; // 2s, 4s, 8s
          console.log(`AnalyticsService: Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
          setTimeout(() => {
            this.isFlushingInProgress = false;
            this.flush();
          }, delay);
        } else {
          console.error('AnalyticsService: Max retries reached, keeping events in queue');
          this.retryCount = 0;
          this.isFlushingInProgress = false;
        }
        return;
      }

      // Success - remove sent events from queue
      this.queue = this.queue.slice(batch.length);
      this.retryCount = 0;
      
      console.log(`AnalyticsService: Successfully sent ${batch.length} events. ${this.queue.length} events remaining in queue.`);
      
      // Save updated queue
      await this.saveQueue();
      
    } catch (error) {
      console.error('AnalyticsService: Unexpected error during flush:', error);
    } finally {
      this.isFlushingInProgress = false;
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const storedQueue = await AsyncStorage.getItem(this.STORAGE_KEYS.QUEUE);
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
        console.log(`AnalyticsService: Loaded ${this.queue.length} events from storage`);
      }
    } catch (error) {
      console.error('AnalyticsService: Failed to load queue from storage:', error);
      this.queue = [];
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.QUEUE, JSON.stringify(this.queue));
    } catch (error) {
      console.error('AnalyticsService: Failed to save queue to storage:', error);
    }
  }

  private scheduleFlush(): void {
    // Flush on app foreground
    AppState.addEventListener('change', this.handleAppStateChange);
    
    // Flush every 60 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 60000);
    
    console.log('AnalyticsService: Scheduled auto-flush every 60s and on app foreground');
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active') {
      console.log('AnalyticsService: App became active, flushing events');
      this.flush();
    }
  };

  // Cleanup method
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    AppState.removeEventListener('change', this.handleAppStateChange);
    console.log('AnalyticsService: Destroyed');
  }

  // Get current queue size for debugging
  getQueueSize(): number {
    return this.queue.length;
  }

  // Get current UID for debugging
  getUID(): string {
    return this.uid;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// Export convenience functions
export const initAnalytics = (uid?: string, appVer?: string) => analyticsService.init(uid, appVer);
export const track = (type: string, props?: any) => analyticsService.track(type, props);
export const flushAnalytics = () => analyticsService.flush();
