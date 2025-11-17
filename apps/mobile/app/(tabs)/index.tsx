import { StyleSheet, View, ScrollView, Dimensions } from 'react-native';
import { useMemo } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { TrendingUp, Activity, Timer, Award, Zap, Target } from 'lucide-react-native';

interface RunData {
  id: string;
  date: Date;
  duration: number; // in seconds
  distance: number; // in meters
  averageSpeed: number; // in m/s
}

// Generate mock data for the current week
const generateWeeklyRuns = (): RunData[] => {
  const runs: RunData[] = [];
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday of current week
  const monday = new Date(now);
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // If Sunday, go back 6 days
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  
  // Generate 1-2 runs per day for the week so far
  const daysToGenerate = currentDay === 0 ? 7 : currentDay; // If Sunday, show full week
  
  for (let day = 0; day < daysToGenerate; day++) {
    const runsThisDay = Math.random() > 0.3 ? Math.floor(Math.random() * 2) + 1 : 0;
    
    for (let run = 0; run < runsThisDay; run++) {
      const runDate = new Date(monday);
      runDate.setDate(monday.getDate() + day);
      runDate.setHours(Math.floor(Math.random() * 12) + 6);
      runDate.setMinutes(Math.floor(Math.random() * 60));
      
      const duration = Math.floor(Math.random() * 2400) + 1200; // 20-60 minutes
      const distance = Math.floor(Math.random() * 8000) + 2000; // 2-10 km
      const averageSpeed = distance / duration;
      
      runs.push({
        id: `run-${day}-${run}`,
        date: runDate,
        duration,
        distance,
        averageSpeed,
      });
    }
  }
  
  return runs.sort((a, b) => a.date.getTime() - b.date.getTime());
};

const MOCK_RUNS = generateWeeklyRuns();

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const accent = colorScheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const cardBackground = isDark ? '#1c1f22' : '#ffffff';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const raisedCardStyle = {
    backgroundColor: cardBackground,
    borderColor,
    borderWidth: 1,
    shadowColor: isDark ? '#000' : accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.25 : 0.08,
    shadowRadius: 12,
    elevation: 4,
  };
  
  // Calculate weekly statistics
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const monday = new Date(now);
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    monday.setDate(now.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Get this week's runs
    const thisWeekRuns = MOCK_RUNS.filter(run => run.date >= monday);
    
    // Calculate daily distances for chart (Monday to Sunday)
    const dailyDistances = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
    thisWeekRuns.forEach(run => {
      const dayOfWeek = run.date.getDay();
      const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0, Sun=6
      dailyDistances[index] += run.distance;
    });
    
    // Calculate total stats
    const totalDistance = thisWeekRuns.reduce((sum, run) => sum + run.distance, 0);
    const totalTime = thisWeekRuns.reduce((sum, run) => sum + run.duration, 0);
    const avgPace = totalDistance > 0 ? totalTime / (totalDistance / 1000) : 0; // seconds per km
    
    return {
      dailyDistances,
      totalDistance,
      totalTime,
      avgPace,
    };
  }, []);
  
  // Calculate featured activities (personal bests)
  const featuredActivities = useMemo(() => {
    if (MOCK_RUNS.length === 0) return null;
    
    // Best pace (fastest run)
    const bestPaceRun = MOCK_RUNS.reduce((best, run) => 
      run.averageSpeed > best.averageSpeed ? run : best
    );
    const bestPaceSecondsPerKm = 1000 / bestPaceRun.averageSpeed;
    
    // Longest distance
    const longestDistanceRun = MOCK_RUNS.reduce((longest, run) => 
      run.distance > longest.distance ? run : longest
    );
    
    // Longest duration
    const longestDurationRun = MOCK_RUNS.reduce((longest, run) => 
      run.duration > longest.duration ? run : longest
    );
    
    return {
      bestPace: { value: bestPaceSecondsPerKm, date: bestPaceRun.date },
      longestDistance: { value: longestDistanceRun.distance, date: longestDistanceRun.date },
      longestDuration: { value: longestDurationRun.duration, date: longestDurationRun.date },
    };
  }, []);
  
  const formatDistance = (meters: number): string => {
    return (meters / 1000).toFixed(2);
  };
  
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTimeMinutes = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}`;
  }
  
  const formatPace = (secondsPerKm: number): string => {
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const dailyDistancesKm = weeklyStats.dailyDistances.map(d => d / 1000);
  const maxDistance = Math.max(...dailyDistancesKm, 1);
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <ThemedText type="title" style={styles.screenTitle}>Dashboard</ThemedText>
      </View>
      
      {/* Weekly Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.subtitleContainer}>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>Weekly Stats</ThemedText>
        </View>
        
        {/* Stats Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, raisedCardStyle]}>
            <View style={[styles.iconContainer, { backgroundColor: accent }]}>
              <TrendingUp size={20} color="#fff" />
            </View>
            <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
              {formatDistance(weeklyStats.totalDistance)}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.icon }]}>km</ThemedText>
          </View>
          
          <View style={[styles.summaryCard, raisedCardStyle]}>
            <View style={[styles.iconContainer, { backgroundColor: accent }]}>
              <Timer size={20} color="#fff" />
            </View>
            <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
              {formatTime(weeklyStats.totalTime)}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.icon }]}>time</ThemedText>
          </View>
          
          <View style={[styles.summaryCard, raisedCardStyle]}>
            <View style={[styles.iconContainer, { backgroundColor: accent }]}>
              <Activity size={20} color="#fff" />
            </View>
            <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
              {weeklyStats.avgPace > 0 ? formatPace(weeklyStats.avgPace) : '--'}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.icon }]}>pace</ThemedText>
          </View>
        </View>
      </View>
      
      {/* Chart Section */}
      <View style={styles.chartSection}>
        <View style={styles.subtitleContainer}>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            Distances by Day
          </ThemedText>
        </View>
        <View style={[styles.chartCard, raisedCardStyle]}>
          <View style={styles.barChartContent}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
              const distance = dailyDistancesKm[index];
              const heightPercentage = maxDistance > 0 ? (distance / maxDistance) * 100 : 0;
              
              return (
                <View key={day} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    {distance > 0 && (
                      <ThemedText style={[styles.barValue, { color: colors.text }]}>
                        {distance.toFixed(1)}
                      </ThemedText>
                    )}
                    <View 
                      style={[
                        styles.bar, 
                        { 
                          height: `${Math.max(heightPercentage, 2)}%`,
                          backgroundColor: accent,
                        }
                      ]} 
                    />
                  </View>
                  <ThemedText style={[styles.barLabel, { color: colors.icon }]}>{day}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </View>
      
      {/* Featured Activities */}
      {featuredActivities && (
        <View style={styles.featuredSection}>
          <View style={styles.subtitleContainer}>
            <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
              Featured Activities
            </ThemedText>
          </View>
          
          <View style={styles.featuredGrid}>
            {/* Best Pace */}
            <View style={[styles.featuredCard, raisedCardStyle]}>
              <View style={[styles.featuredIconContainer, { backgroundColor: '#10b981' }]}>
                <Zap size={24} color="#fff" />
              </View>
              <ThemedText style={[styles.featuredLabel, { color: colors.icon }]}>Best Pace</ThemedText>
              <ThemedText style={[styles.featuredValue, { color: colors.text }]}>
                {formatPace(featuredActivities.bestPace.value)}
              </ThemedText>
              <ThemedText style={[styles.featuredUnit, { color: colors.icon }]}>/km</ThemedText>
              <ThemedText style={[styles.featuredDate, { color: colors.icon }]}>
                {featuredActivities.bestPace.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </ThemedText>
            </View>
            
            {/* Longest Distance */}
            <View style={[styles.featuredCard, raisedCardStyle]}>
              <View style={[styles.featuredIconContainer, { backgroundColor: '#f59e0b' }]}>
                <Target size={24} color="#fff" />
              </View>
              <ThemedText style={[styles.featuredLabel, { color: colors.icon }]}>Furthest Run</ThemedText>
              <ThemedText style={[styles.featuredValue, { color: colors.text }]}>
                {formatDistance(featuredActivities.longestDistance.value)}
              </ThemedText>
              <ThemedText style={[styles.featuredUnit, { color: colors.icon }]}>km</ThemedText>
              <ThemedText style={[styles.featuredDate, { color: colors.icon }]}>
                {featuredActivities.longestDistance.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </ThemedText>
            </View>
            
            {/* Longest Duration */}
            <View style={[styles.featuredCard, raisedCardStyle]}>
              <View style={[styles.featuredIconContainer, { backgroundColor: '#8b5cf6' }]}>
                <Award size={24} color="#fff" />
              </View>
              <ThemedText style={[styles.featuredLabel, { color: colors.icon }]}>Longest Run</ThemedText>
              <ThemedText style={[styles.featuredValue, { color: colors.text }]}>
                {formatTimeMinutes(featuredActivities.longestDuration.value)}
              </ThemedText>
              <ThemedText style={[styles.featuredUnit, { color: colors.icon }]}>min</ThemedText>
              <ThemedText style={[styles.featuredDate, { color: colors.icon }]}>
                {featuredActivities.longestDuration.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </ThemedText>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitleContainer: {
    marginBottom: 12,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    flexBasis: 0,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  chartCard: {
    borderRadius: 16,
    padding: 20,
  },
  barChartContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    paddingBottom: 0,
    paddingTop: 40,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bar: {
    width: '100%',
    minHeight: 4,
    borderRadius: 4,
    maxWidth: 32,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  detailsSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  detailCard: {
    borderRadius: 16,
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  featuredSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  featuredGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  featuredCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  featuredIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featuredLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  featuredValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  featuredUnit: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  featuredDate: {
    fontSize: 11,
    fontWeight: '500',
  },
});
