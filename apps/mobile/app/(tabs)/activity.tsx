import { StyleSheet, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Play, Pause, Square } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

type ActivityState = 'idle' | 'running' | 'paused';

interface ActivityData {
  timestamp: number;
  latitude: number;
  longitude: number;
  speed: number;
  distance: number;
}

interface ActivityStats {
  elapsedTime: number;
  distance: number;
  currentSpeed: number;
  averageSpeed: number;
}

interface StoredActivity {
  id: string;
  startTime: number;
  endTime: number;
  stats: ActivityStats;
  dataPoints: ActivityData[];
  synced: boolean;
}

const STORAGE_KEY = 'stored_activities';
const SYNC_KEY = 'unsynced_activities';

export default function ActivityScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const accent = colorScheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const surface = isDark ? '#1c1f22' : '#ffffff';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const warningBackground = isDark ? 'rgba(255, 204, 112, 0.2)' : 'rgba(250, 204, 21, 0.15)';

  const [activityState, setActivityState] = useState<ActivityState>('idle');
  const [stats, setStats] = useState<ActivityStats>({
    elapsedTime: 0,
    distance: 0,
    currentSpeed: 0,
    averageSpeed: 0,
  });
  const [isOnline, setIsOnline] = useState(true);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const activityDataBuffer = useRef<ActivityData[]>([]);
  const currentActivityId = useRef<string>('');
  const locationUpdateInterval = useRef<any>(null);

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format distance (km with 2 decimals)
  const formatDistance = (meters: number): string => {
    return (meters / 1000).toFixed(2);
  };

  // Format speed (km/h with 1 decimal)
  const formatSpeed = (metersPerSecond: number): string => {
    return ((metersPerSecond * 3600) / 1000).toFixed(1);
  };

  // Simulate location updates (in production, use expo-location)
  const simulateLocationUpdate = () => {
    // Mock data - in production, get real GPS coordinates
    const mockData: ActivityData = {
      timestamp: Date.now(),
      latitude: 46.0569 + Math.random() * 0.001,
      longitude: 14.5058 + Math.random() * 0.001,
      speed: Math.random() * 5 + 2, // 2-7 m/s (7-25 km/h)
      distance: Math.random() * 10 + 5, // 5-15 meters per update
    };

    // Update current stats
    setStats(prev => {
      const newDistance = prev.distance + mockData.distance;
      const newAvgSpeed = stats.elapsedTime > 0 ? newDistance / stats.elapsedTime : 0;
      
      return {
        ...prev,
        distance: newDistance,
        currentSpeed: mockData.speed,
        averageSpeed: newAvgSpeed,
      };
    });

    // Add to buffer for batch sending
    activityDataBuffer.current.push(mockData);
  };

  // Load unsynced activities count
  const loadUnsyncedCount = async () => {
    try {
      const stored = await AsyncStorage.getItem(SYNC_KEY);
      if (stored) {
        const activities: StoredActivity[] = JSON.parse(stored);
        setUnsyncedCount(activities.length);
      }
    } catch (error) {
      console.error('Failed to load unsynced count:', error);
    }
  };

  // Save activity to local storage
  const saveActivityLocally = async (activity: StoredActivity) => {
    try {
      // Save to unsynced list
      const stored = await AsyncStorage.getItem(SYNC_KEY);
      const activities: StoredActivity[] = stored ? JSON.parse(stored) : [];
      activities.push(activity);
      await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(activities));
      
      // Also save to general storage for history
      const allActivities = await AsyncStorage.getItem(STORAGE_KEY);
      const all: StoredActivity[] = allActivities ? JSON.parse(allActivities) : [];
      all.push(activity);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      
      setUnsyncedCount(activities.length);
      console.log('Activity saved locally:', activity.id);
    } catch (error) {
      console.error('Failed to save activity locally:', error);
    }
  };

  // Sync single activity to backend
  const syncActivity = async (activity: StoredActivity): Promise<boolean> => {
    try {
      // TODO: Replace with actual API endpoint
      console.log('Syncing activity to backend:', activity.id);
      
      // Example API call:
      // const response = await fetch('https://your-api.com/activities', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(activity),
      // });
      // 
      // if (!response.ok) throw new Error('Sync failed');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('Failed to sync activity:', error);
      return false;
    }
  };

  // Sync all unsynced activities
  const syncUnsyncedActivities = async () => {
    try {
      const stored = await AsyncStorage.getItem(SYNC_KEY);
      if (!stored) return;

      const activities: StoredActivity[] = JSON.parse(stored);
      if (activities.length === 0) return;

      console.log(`Syncing ${activities.length} unsynced activities...`);
      
      const stillUnsynced: StoredActivity[] = [];
      
      for (const activity of activities) {
        const success = await syncActivity(activity);
        if (!success) {
          stillUnsynced.push(activity);
        }
      }

      // Update storage with remaining unsynced activities
      await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(stillUnsynced));
      setUnsyncedCount(stillUnsynced.length);

      if (stillUnsynced.length === 0) {
        console.log('All activities synced successfully!');
      } else {
        console.log(`${stillUnsynced.length} activities still pending sync`);
      }
    } catch (error) {
      console.error('Failed to sync activities:', error);
    }
  };

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      
      // When coming back online, try to sync
      if (online && unsyncedCount > 0) {
        console.log('Back online! Attempting to sync...');
        syncUnsyncedActivities();
      }
    });

    // Load initial unsynced count
    loadUnsyncedCount();

    return () => unsubscribe();
  }, [unsyncedCount]);

  // Start activity
  const handleStart = () => {
    setActivityState('running');
    const activityId = `activity_${Date.now()}`;
    currentActivityId.current = activityId;
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    activityDataBuffer.current = [];

    // Start timer
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
      setStats(prev => ({ ...prev, elapsedTime: elapsed }));
    }, 1000);

    // Start location updates every 5 seconds
    locationUpdateInterval.current = setInterval(() => {
      simulateLocationUpdate();
    }, 5000);

    // Initial location update
    simulateLocationUpdate();
  };

  // Pause activity
  const handlePause = () => {
    setActivityState('paused');

    if (timerRef.current) clearInterval(timerRef.current);
    if (locationUpdateInterval.current) clearInterval(locationUpdateInterval.current);

    // Calculate and store total paused time
    const currentElapsed = Date.now() - startTimeRef.current - pausedTimeRef.current;
    pausedTimeRef.current = Date.now() - startTimeRef.current - currentElapsed;
  };

  // Resume activity
  const handleResume = () => {
    setActivityState('running');
    
    // Update start time to account for pause duration
    const pauseDuration = Date.now() - (startTimeRef.current + pausedTimeRef.current + stats.elapsedTime * 1000);
    startTimeRef.current = Date.now() - stats.elapsedTime * 1000;
    pausedTimeRef.current = 0;

    // Restart timer
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setStats(prev => ({ ...prev, elapsedTime: elapsed }));
    }, 1000);

    // Restart location updates
    locationUpdateInterval.current = setInterval(() => {
      simulateLocationUpdate();
    }, 5000);
  };

  // End activity
  const handleEnd = async () => {
    // Clear all intervals
    if (timerRef.current) clearInterval(timerRef.current);
    if (locationUpdateInterval.current) clearInterval(locationUpdateInterval.current);

    // Create activity record
    const activity: StoredActivity = {
      id: currentActivityId.current,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      stats: { ...stats },
      dataPoints: [...activityDataBuffer.current],
      synced: false,
    };

    // Save locally first
    await saveActivityLocally(activity);

    // Try to sync if online
    if (isOnline) {
      const synced = await syncActivity(activity);
      if (synced) {
        // Remove from unsynced list
        const stored = await AsyncStorage.getItem(SYNC_KEY);
        if (stored) {
          let activities: StoredActivity[] = JSON.parse(stored);
          activities = activities.filter(a => a.id !== activity.id);
          await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(activities));
          setUnsyncedCount(activities.length);
        }
      }
    }

    // Show success message
    Alert.alert(
      'Activity Saved!',
      isOnline 
        ? 'Your activity has been saved and synced.' 
        : 'Your activity has been saved locally and will sync when you\'re back online.',
      [{ text: 'OK' }]
    );

    // Reset
    setActivityState('idle');
    setStats({
      elapsedTime: 0,
      distance: 0,
      currentSpeed: 0,
      averageSpeed: 0,
    });
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;
    activityDataBuffer.current = [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (locationUpdateInterval.current) clearInterval(locationUpdateInterval.current);
    };
  }, []);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.screenHeader}>
        <ThemedText type="title" style={styles.screenTitle}>
          Activity
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
          Track your next adventure
        </ThemedText>
      </View>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sync Button */}
        {activityState === 'idle' && unsyncedCount > 0 && (
          <TouchableOpacity 
            style={[
              styles.syncButton, 
              { backgroundColor: accent },
              !isOnline && styles.syncButtonDisabled
            ]}
            onPress={syncUnsyncedActivities}
            disabled={!isOnline}
          >
            <ThemedText style={[styles.syncButtonText, { color: colors.background }]}>
              Sync {unsyncedCount} unsynced {unsyncedCount === 1 ? 'activity' : 'activities'}
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Timer Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={[styles.label, { color: colors.icon }]}>Time</ThemedText>
          <ThemedText style={[styles.mainValue, { color: colors.text }]}>
            {formatTime(stats.elapsedTime)}
          </ThemedText>
        </View>

        {/* Distance Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={[styles.label, { color: colors.icon }]}>Distance</ThemedText>
          <View style={styles.valueRow}>
            <ThemedText style={[styles.mainValue, { color: colors.text }]}>
              {formatDistance(stats.distance)}
            </ThemedText>
            <ThemedText style={[styles.unit, { color: colors.icon }]}>km</ThemedText>
          </View>
        </View>

        {/* Speed Section - Split */}
        <View style={[styles.speedContainer, { backgroundColor: surface, borderColor }]}>
          <View style={styles.speedBox}>
            <ThemedText style={[styles.label, { color: colors.icon }]}>Current Speed</ThemedText>
            <View style={styles.valueRow}>
              <ThemedText style={[styles.speedValue, { color: colors.text }]}>
                {formatSpeed(stats.currentSpeed)}
              </ThemedText>
              <ThemedText style={[styles.speedUnit, { color: colors.icon }]}>km/h</ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <View style={styles.speedBox}>
            <ThemedText style={[styles.label, { color: colors.icon }]}>Avg. Speed</ThemedText>
            <View style={styles.valueRow}>
              <ThemedText style={[styles.speedValue, { color: colors.text }]}>
                {formatSpeed(stats.averageSpeed)}
              </ThemedText>
              <ThemedText style={[styles.speedUnit, { color: colors.icon }]}>km/h</ThemedText>
            </View>
          </View>
        </View>

        {/* Info Box */}
        {activityState !== 'idle' && !isOnline && (
          <View style={[styles.infoBox, { backgroundColor: warningBackground }]}>
            <ThemedText style={[styles.infoText, { color: colors.text }]}>
              ⚠️ Offline mode - Activity will sync when online
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.buttonContainer, { backgroundColor: colors.background, borderTopColor: borderColor }]}>
        {activityState === 'idle' && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: accent }]} 
            onPress={handleStart}
          >
            <Play size={32} color="#ffffffff" fill="#FFFFFF" />
          </TouchableOpacity>
        )}

        {activityState === 'running' && (
          <>
            <TouchableOpacity style={[styles.actionButton, styles.pauseButton]} onPress={handlePause}>
              <Pause size={32} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.endButton]} onPress={handleEnd}>
              <Square size={32} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}

        {activityState === 'paused' && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: accent }]} 
              onPress={handleResume}
            >
              <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.endButton]} onPress={handleEnd}>
              <Square size={32} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 16,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 6,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 160,
  },
  section: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 24,
    borderRadius: 24,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  mainValue: {
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 64,
  },
  unit: {
    fontSize: 28,
    marginLeft: 8,
    fontWeight: '600',
  },
  speedContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 24,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  speedBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    marginHorizontal: 20,
  },
  speedValue: {
    fontSize: 36,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  speedUnit: {
    fontSize: 18,
    marginLeft: 6,
  },
  infoBox: {
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  actionButton: {
    flex: 1,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
  },
  endButton: {
    backgroundColor: '#ef4444',
  },
  syncButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
