import { StyleSheet, View, ScrollView, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import {
  TrendingUp,
  Activity,
  Timer,
  Award,
  Zap,
  Target,
} from "lucide-react-native";
import { useApiClient } from "@/hooks/use-api-client";
import { useFocusEffect } from "expo-router";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface WeeklyStats {
  totalDistance: number;
  totalTime: number;
  avgPace: number;
}

interface DailyDistances {
  days: string[];
  distances: number[];
}

interface FeaturedActivity {
  value: number;
  date: string;
}

interface FeaturedActivities {
  bestPace: FeaturedActivity | null;
  longestDistance: FeaturedActivity | null;
  longestDuration: FeaturedActivity | null;
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[colorScheme ?? "light"];
  const accent = colorScheme === "dark" ? "#38bdf8" : "#0ea5e9";
  const cardBackground = isDark ? "#1c1f22" : "#ffffff";
  const borderColor = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(15, 23, 42, 0.08)";
  const raisedCardStyle = {
    backgroundColor: cardBackground,
    borderColor,
    borderWidth: 1,
    shadowColor: isDark ? "#000" : accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.25 : 0.08,
    shadowRadius: 12,
    elevation: 4,
  };

  const apiClient = useApiClient();

  // State for API data
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalDistance: 0,
    totalTime: 0,
    avgPace: 0,
  });
  const [dailyDistances, setDailyDistances] = useState<DailyDistances>({
    days: [],
    distances: [],
  });
  const [featuredActivities, setFeaturedActivities] =
    useState<FeaturedActivities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [statsRes, distancesRes, featuredRes] = await Promise.all([
        apiClient.get<WeeklyStats>(
          `${API_BASE_URL}/activity/dashboard/weekly-stats`
        ),
        apiClient.get<DailyDistances>(
          `${API_BASE_URL}/activity/dashboard/daily-distances`
        ),
        apiClient.get<FeaturedActivities>(
          `${API_BASE_URL}/activity/dashboard/featured`
        ),
      ]);

      setWeeklyStats(statsRes);
      setDailyDistances(distancesRes);
      setFeaturedActivities(featuredRes);
    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  // Fetch data on mount and when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

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
  };

  const formatPace = (secondsPerKm: number): string => {
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const dailyDistancesKm = dailyDistances.distances.map((d) => d / 1000);
  const maxDistance = Math.max(...dailyDistancesKm, 1);

  // Loading state
  if (isLoading) {
    return (
      <ThemedView
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={accent} />
        <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
          Loading dashboard...
        </ThemedText>
      </ThemedView>
    );
  }

  // Error state
  if (error) {
    return (
      <ThemedView
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ThemedText style={[styles.errorText, { color: "#ef4444" }]}>
          {error}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.screenHeader}>
        <ThemedText type="title" style={styles.screenTitle}>
          Dashboard
        </ThemedText>
      </View>

      {/* Weekly Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.subtitleContainer}>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            Weekly Stats
          </ThemedText>
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
            <ThemedText style={[styles.summaryLabel, { color: colors.icon }]}>
              km
            </ThemedText>
          </View>

          <View style={[styles.summaryCard, raisedCardStyle]}>
            <View style={[styles.iconContainer, { backgroundColor: accent }]}>
              <Timer size={20} color="#fff" />
            </View>
            <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
              {formatTime(weeklyStats.totalTime)}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.icon }]}>
              time
            </ThemedText>
          </View>

          <View style={[styles.summaryCard, raisedCardStyle]}>
            <View style={[styles.iconContainer, { backgroundColor: accent }]}>
              <Activity size={20} color="#fff" />
            </View>
            <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
              {weeklyStats.avgPace > 0 ? formatPace(weeklyStats.avgPace) : "--"}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.icon }]}>
              pace
            </ThemedText>
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
            {dailyDistances.days.map((day, index) => {
              const distance = dailyDistancesKm[index] || 0;
              const heightPercentage =
                maxDistance > 0 ? (distance / maxDistance) * 100 : 0;

              return (
                <View key={`${day}-${index}`} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    {distance > 0 && (
                      <ThemedText
                        style={[styles.barValue, { color: colors.text }]}
                      >
                        {distance.toFixed(1)}
                      </ThemedText>
                    )}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(heightPercentage, 2)}%`,
                          backgroundColor: accent,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.barLabel, { color: colors.icon }]}>
                    {day}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Featured Activities */}
      {featuredActivities &&
        (featuredActivities.bestPace ||
          featuredActivities.longestDistance ||
          featuredActivities.longestDuration) && (
          <View style={styles.featuredSection}>
            <View style={styles.subtitleContainer}>
              <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
                Featured Activities
              </ThemedText>
            </View>

            <View style={styles.featuredGrid}>
              {/* Best Pace */}
              {featuredActivities.bestPace && (
                <View style={[styles.featuredCard, raisedCardStyle]}>
                  <View
                    style={[
                      styles.featuredIconContainer,
                      { backgroundColor: "#10b981" },
                    ]}
                  >
                    <Zap size={24} color="#fff" />
                  </View>
                  <ThemedText
                    style={[styles.featuredLabel, { color: colors.icon }]}
                  >
                    Best Pace
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredValue, { color: colors.text }]}
                  >
                    {formatPace(featuredActivities.bestPace.value)}
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredUnit, { color: colors.icon }]}
                  >
                    /km
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredDate, { color: colors.icon }]}
                  >
                    {formatDate(featuredActivities.bestPace.date)}
                  </ThemedText>
                </View>
              )}

              {/* Longest Distance */}
              {featuredActivities.longestDistance && (
                <View style={[styles.featuredCard, raisedCardStyle]}>
                  <View
                    style={[
                      styles.featuredIconContainer,
                      { backgroundColor: "#f59e0b" },
                    ]}
                  >
                    <Target size={24} color="#fff" />
                  </View>
                  <ThemedText
                    style={[styles.featuredLabel, { color: colors.icon }]}
                  >
                    Furthest Run
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredValue, { color: colors.text }]}
                  >
                    {formatDistance(featuredActivities.longestDistance.value)}
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredUnit, { color: colors.icon }]}
                  >
                    km
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredDate, { color: colors.icon }]}
                  >
                    {formatDate(featuredActivities.longestDistance.date)}
                  </ThemedText>
                </View>
              )}

              {/* Longest Duration */}
              {featuredActivities.longestDuration && (
                <View style={[styles.featuredCard, raisedCardStyle]}>
                  <View
                    style={[
                      styles.featuredIconContainer,
                      { backgroundColor: "#8b5cf6" },
                    ]}
                  >
                    <Award size={24} color="#fff" />
                  </View>
                  <ThemedText
                    style={[styles.featuredLabel, { color: colors.icon }]}
                  >
                    Longest Run
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredValue, { color: colors.text }]}
                  >
                    {formatTimeMinutes(
                      featuredActivities.longestDuration.value
                    )}
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredUnit, { color: colors.icon }]}
                  >
                    min
                  </ThemedText>
                  <ThemedText
                    style={[styles.featuredDate, { color: colors.icon }]}
                  >
                    {formatDate(featuredActivities.longestDuration.date)}
                  </ThemedText>
                </View>
              )}
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  screenHeader: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
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
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    flexBasis: 0,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: "center",
    gap: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "600",
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
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 200,
    paddingBottom: 0,
    paddingTop: 40,
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  barWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  bar: {
    width: "100%",
    minHeight: 4,
    borderRadius: 4,
    maxWidth: 32,
  },
  barValue: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "500",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    height: 1,
  },
  featuredSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  featuredGrid: {
    flexDirection: "row",
    gap: 12,
  },
  featuredCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  featuredIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featuredLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  featuredValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 2,
  },
  featuredUnit: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
  },
  featuredDate: {
    fontSize: 11,
    fontWeight: "500",
  },
});
