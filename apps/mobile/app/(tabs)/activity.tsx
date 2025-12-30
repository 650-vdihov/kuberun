import { StyleSheet, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Play, Pause, Square, Trash2 } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useApiClient } from '@/hooks/use-api-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Note: server uses 'active', UI uses 'running' - we map between them
type ActivityState = 'idle' | 'active' | 'paused';

interface ActivityStats {
  elapsedTime: number;
  distance: number;
  currentSpeed: number;
  averageSpeed: number;
}

export default function ActivityScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const accent = colorScheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const surface = isDark ? '#1c1f22' : '#ffffff';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const apiClient = useApiClient();

  const [activityState, setActivityState] = useState<ActivityState>('idle');
  const [stats, setStats] = useState<ActivityStats>({
    elapsedTime: 0,
    distance: 0,
    currentSpeed: 0,
    averageSpeed: 0,
  });
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0); // Store elapsed time when paused
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const trackingInterval = useRef<any>(null);

  // Request location permissions
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to track your runs.',
          [{ text: 'OK' }]
        );
      }
    })();
  }, []);

  // Check for active run on mount
  useEffect(() => {
    checkForActiveRun();
  }, []);

  // Check if there's an active or paused run
  const checkForActiveRun = async () => {
    try {
      const response = await apiClient.get<any>(`${API_BASE_URL}/activity/runs/active/current`);
      
      if (response) {
        setCurrentRunId(response.id);
        setActivityState(response.status as ActivityState);
        
        // Calculate elapsed time from start time
        const startTime = new Date(response.startTime).getTime();
        startTimeRef.current = startTime;
        
        if (response.status === 'active') {
          // Resume timer and tracking
          startTimer();
          startLocationTracking();
        }
      }
    } catch (error: any) {
      // 404 is expected if no active run
      if (!error.message?.includes('404')) {
        console.error('Failed to check for active run:', error);
      }
    }
  };

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

  // Start timer
  const startTimer = () => {
    if (timerRef.current) return;
    
    // Set start time accounting for any previously elapsed time
    startTimeRef.current = Date.now() - (pausedElapsedRef.current * 1000);
    
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setStats(prev => ({ ...prev, elapsedTime: elapsed }));
    }, 1000);
  };

  // Stop timer (and save elapsed time)
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      // Save current elapsed time for resume
      pausedElapsedRef.current = stats.elapsedTime;
    }
  };

  // Send tracking point to server
  const sendTrackingPoint = async (location: Location.LocationObject) => {
    if (!currentRunId) return;

    try {
      const trackingData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude || 0,
        speed: location.coords.speed || 0,
        accuracy: location.coords.accuracy || 0,
        timestamp: new Date(location.timestamp).toISOString(),
      };

      await apiClient.post(`${API_BASE_URL}/activity/runs/${currentRunId}/track`, trackingData);

      // Update current speed in UI
      setStats(prev => ({
        ...prev,
        currentSpeed: location.coords.speed || 0,
      }));
    } catch (error) {
      console.error('Failed to send tracking point:', error);
    }
  };

  // Start location tracking
  const startLocationTracking = async () => {
    if (!hasLocationPermission || locationSubscription.current) return;

    try {
      // Watch location with high accuracy
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (location: Location.LocationObject) => {
          sendTrackingPoint(location);
        }
      );
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      Alert.alert('Error', 'Failed to start GPS tracking');
    }
  };

  // Stop location tracking
  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      try {
        locationSubscription.current.remove();
      } catch (error) {
        console.warn('Error removing location subscription:', error);
      }
      locationSubscription.current = null;
    }
  };

  // Start activity
  const handleStart = async () => {
    if (!hasLocationPermission) {
      Alert.alert('Permission Required', 'Location permission is needed to track your runs.');
      return;
    }

    try {
      // Start run on server
      const response = await apiClient.post<any>(`${API_BASE_URL}/activity/runs/start`, {});
      
      setCurrentRunId(response.id);
      setActivityState('active');
      startTimeRef.current = Date.now();
      pausedElapsedRef.current = 0; // Reset paused elapsed time
      
      // Start timer
      startTimer();
      
      // Start location tracking
      await startLocationTracking();
    } catch (error) {
      console.error('Failed to start run:', error);
      Alert.alert('Error', 'Failed to start run. Please try again.');
    }
  };

  // Pause activity
  const handlePause = async () => {
    if (!currentRunId) return;

    try {
      await apiClient.post(`${API_BASE_URL}/activity/runs/${currentRunId}/pause`, {});
      
      setActivityState('paused');
      stopTimer();
      stopLocationTracking();
    } catch (error) {
      console.error('Failed to pause run:', error);
      Alert.alert('Error', 'Failed to pause run. Please try again.');
    }
  };

  // Resume activity
  const handleResume = async () => {
    if (!currentRunId) return;

    try {
      await apiClient.post(`${API_BASE_URL}/activity/runs/${currentRunId}/resume`, {});
      
      setActivityState('active');
      startTimer();
      await startLocationTracking();
    } catch (error) {
      console.error('Failed to resume run:', error);
      Alert.alert('Error', 'Failed to resume run. Please try again.');
    }
  };

  // Discard run (cancel without saving)
  const handleDiscard = () => {
    console.log('handleDiscard called');
    discardRun();
  };

  // Actually perform the discard
  const discardRun = async () => {
    try {
      stopTimer();
      stopLocationTracking();

      if (currentRunId) {
        // Delete the run from server
        const response = await apiClient.fetch(`${API_BASE_URL}/activity/runs/${currentRunId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          console.error('Failed to delete run on server');
        }
      }
    } catch (error) {
      console.error('Failed to discard run:', error);
    } finally {
      // Always reset local state
      setActivityState('idle');
      setCurrentRunId(null);
      setStats({
        elapsedTime: 0,
        distance: 0,
        currentSpeed: 0,
        averageSpeed: 0,
      });
      startTimeRef.current = 0;
      pausedElapsedRef.current = 0;
    }
  };

  // End activity
  const handleEnd = async () => {
    if (!currentRunId) return;

    try {
      // Stop timer and tracking
      stopTimer();
      stopLocationTracking();

      // Complete run on server
      const response = await apiClient.post<any>(`${API_BASE_URL}/activity/runs/${currentRunId}/complete`, {});

      // Show success message with stats
      const distance = parseFloat(response.distance) / 1000;
      const duration = response.duration;
      const mins = Math.floor(duration / 60);
      
      Alert.alert(
        'Run Completed!',
        `Distance: ${distance.toFixed(2)} km\nTime: ${mins} minutes`,
        [{ text: 'OK' }]
      );

      // Reset state
      setActivityState('idle');
      setCurrentRunId(null);
      setStats({
        elapsedTime: 0,
        distance: 0,
        currentSpeed: 0,
        averageSpeed: 0,
      });
      startTimeRef.current = 0;
      pausedElapsedRef.current = 0;
    } catch (error: any) {
      console.error('Failed to complete run:', error);
      Alert.alert('Error', error.message || 'Failed to complete run. Please try again.');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopLocationTracking();
    };
  }, []);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.screenHeader}>
        <ThemedText type="title" style={styles.screenTitle}>
          Activity
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
          Track your running activity
        </ThemedText>
      </View>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        {/* GPS Status */}
        {activityState !== 'idle' && !hasLocationPermission && (
          <View style={[styles.infoBox, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
            <ThemedText style={[styles.infoText, { color: colors.text }]}>
              ⚠️ GPS tracking disabled - enable location permissions
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
            <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>
        )}

        {activityState === 'active' && (
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
            <TouchableOpacity 
              style={[styles.actionButton, styles.discardButton]} 
              onPress={() => {
                handleDiscard();
              }}
              activeOpacity={0.7}
            >
              <Trash2 size={28} color="#FFFFFF" />
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
  discardButton: {
    backgroundColor: '#6b7280',
    flex: 0.5,
  },
});
