import { StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { Calendar, Clock, MapPin, TrendingUp, X, Filter } from 'lucide-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useApiClient } from '@/hooks/use-api-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

type TimeframeFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

interface RunHistory {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number; // in seconds
  distance: string; // in meters (stored as string in DB)
  pace: string | null;
  avgSpeed: string | null; // km/h
  calories: number | null;
  status: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const accent = colorScheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const chipBackground = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 126, 164, 0.12)';
  const cardBackground = isDark ? '#1c1f22' : '#ffffff';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const inputBackground = isDark ? '#1f2428' : '#f5f7f9';

  const apiClient = useApiClient();
  
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all');
  const [displayedRuns, setDisplayedRuns] = useState<RunHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');

  // Fetch runs from API
  const fetchRuns = useCallback(async (page: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoading(true);
    } else {
      setIsInitialLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');

      if (timeframeFilter !== 'all' && timeframeFilter !== 'custom') {
        params.append('timeframe', timeframeFilter);
      } else if (timeframeFilter === 'custom') {
        if (customFromDate) params.append('from', customFromDate);
        if (customToDate) params.append('to', customToDate);
      }

      const response = await apiClient.get<{
        runs: RunHistory[];
        pagination: PaginationInfo;
      }>(`${API_BASE_URL}/activity/runs?${params.toString()}`);

      if (response) {
        if (append) {
          setDisplayedRuns(prev => [...prev, ...response.runs]);
        } else {
          setDisplayedRuns(response.runs);
        }
        setPagination(response.pagination);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Failed to fetch runs:', error);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [apiClient, timeframeFilter, customFromDate, customToDate]);

  // Initial fetch and refetch when filter changes
  useEffect(() => {
    fetchRuns(1, false);
  }, [timeframeFilter, customFromDate, customToDate]);

  // Format time as HH:MM:SS or MM:SS
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  // Format distance
  const formatDistance = (meters: string | number): string => {
    const m = typeof meters === 'string' ? parseFloat(meters) : meters;
    return (m / 1000).toFixed(2);
  };

  // Format pace (min/km)
  const formatPace = (pace: string | null): string => {
    if (!pace) return '--';
    const paceNum = parseFloat(pace);
    if (paceNum === 0 || !isFinite(paceNum)) return '--';
    const mins = Math.floor(paceNum);
    const secs = Math.round((paceNum - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Generate run title based on time of day and average speed
  const getRunTitle = (startTime: string, avgSpeed: string | null): string => {
    const date = new Date(startTime);
    const hour = date.getHours();
    
    // Determine time of day
    let timeOfDay: string;
    if (hour >= 5 && hour < 12) {
      timeOfDay = 'Morning';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'Afternoon';
    } else if (hour >= 17 && hour < 21) {
      timeOfDay = 'Evening';
    } else {
      timeOfDay = 'Night';
    }
    
    // Determine activity type based on avg speed (km/h)
    const speed = avgSpeed ? parseFloat(avgSpeed) : 0;
    let activityType: string;
    if (speed >= 12) {
      activityType = 'Run';
    } else if (speed >= 9) {
      activityType = 'Jog';
    } else if (speed >= 6) {
      activityType = 'Brisk Walk';
    } else if (speed >= 3) {
      activityType = 'Walk';
    } else {
      activityType = 'Stroll';
    }
    
    return `${timeOfDay} ${activityType}`;
  };

  // Handle filter change
  const handleFilterChange = (filter: TimeframeFilter) => {
    if (filter === 'custom') {
      setShowCustomModal(true);
      return;
    }
    
    setTimeframeFilter(filter);
    setCustomFromDate('');
    setCustomToDate('');
  };

  // Parse date from string input
  const parseDate = (dateStr: string): string | null => {
    if (!dateStr.trim()) return null;
    
    // Try parsing YYYY-MM-DD format
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return dateStr;
    }
    
    // Try parsing MM/DD/YYYY format
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try parsing DD.MM.YYYY format
    const euMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return null;
  };

  // Apply custom date filter
  const applyCustomFilter = () => {
    const fromDate = parseDate(fromDateInput);
    const toDate = parseDate(toDateInput);
    
    if (!fromDate && !toDate) {
      setTimeframeFilter('all');
      setCustomFromDate('');
      setCustomToDate('');
    } else {
      setTimeframeFilter('custom');
      setCustomFromDate(fromDate || '');
      setCustomToDate(toDate || '');
    }
    
    setShowCustomModal(false);
  };

  // Clear custom filter
  const clearCustomFilter = () => {
    setFromDateInput('');
    setToDateInput('');
  };

  // Set quick date
  const setQuickDate = (field: 'from' | 'to', daysAgo: number = 0) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const formatted = date.toISOString().split('T')[0];
    if (field === 'from') {
      setFromDateInput(formatted);
    } else {
      setToDateInput(formatted);
    }
  };

  // Load more runs (infinite scroll)
  const loadMoreRuns = () => {
    if (isLoading || !pagination?.hasMore) return;
    fetchRuns(currentPage + 1, true);
  };

  const renderRunItem = ({ item }: { item: RunHistory }) => (
    <TouchableOpacity 
      style={[
        styles.runCard,
        { 
          backgroundColor: cardBackground,
          borderColor,
          shadowColor: isDark ? '#000' : accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.08,
          shadowRadius: 12,
          elevation: 3,
        }
      ]}
    >
      <View style={styles.runHeader}>
        <View style={styles.dateContainer}>
          <Calendar size={16} color={colors.icon} />
          <ThemedText style={[styles.dateText, { color: colors.text }]}>
            {formatDate(item.startTime)}
          </ThemedText>
          <ThemedText style={[styles.timeText, { color: colors.icon }]}>
            {formatTime(item.startTime)}
          </ThemedText>
        </View>
      </View>
      
      <View style={styles.runStats}>
        <View style={styles.statItem}>
          <MapPin size={18} color={accent} />
          <View style={styles.statContent}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {formatDistance(item.distance)} km
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.icon }]}>
              Distance
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.statItem}>
          <Clock size={18} color={accent} />
          <View style={styles.statContent}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {formatDuration(item.duration || 0)}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.icon }]}>
              Duration
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.statItem}>
          <TrendingUp size={18} color={accent} />
          <View style={styles.statContent}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {formatPace(item.pace)} /km
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.icon }]}>
              Pace
            </ThemedText>
          </View>
        </View>
      </View>
      
      <View style={[styles.runFooter, { borderTopColor: borderColor }]}>
        <ThemedText style={[styles.routeName, { color: colors.text }]}>
          {getRunTitle(item.startTime, item.avgSpeed)}
        </ThemedText>
        {item.calories != null && (
          <ThemedText style={[styles.calories, { color: accent }]}>
            {item.calories} cal
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isLoading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={accent} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isInitialLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
          No runs found for this timeframe
        </ThemedText>
        <ThemedText style={[styles.emptySubtext, { color: colors.icon }]}>
          Start a run in the Activity tab!
        </ThemedText>
      </View>
    );
  };

  const getFilterButtonStyle = (filter: TimeframeFilter) => ([
    styles.filterButton,
    {
      backgroundColor: timeframeFilter === filter ? accent : chipBackground,
      borderColor: timeframeFilter === filter ? accent : 'transparent',
    },
  ]);

  const getFilterTextStyle = (filter: TimeframeFilter) => ([
    styles.filterText,
    {
      color: timeframeFilter === filter ? colors.background : colors.text,
    },
  ]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.screenHeader}>
        <ThemedText type="title" style={styles.screenTitle}>History</ThemedText>
        <ThemedText style={[styles.headerSubtitle, { color: colors.icon }]}>
          {pagination ? `${pagination.total} ${pagination.total === 1 ? 'run' : 'runs'} logged` : 'Loading...'}
        </ThemedText>
      </View>

      {/* Timeframe Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={getFilterButtonStyle('all')}
          onPress={() => handleFilterChange('all')}
        >
          <ThemedText style={getFilterTextStyle('all')}>
            All Time
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={getFilterButtonStyle('today')}
          onPress={() => handleFilterChange('today')}
        >
          <ThemedText style={getFilterTextStyle('today')}>
            Today
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={getFilterButtonStyle('week')}
          onPress={() => handleFilterChange('week')}
        >
          <ThemedText style={getFilterTextStyle('week')}>
            Week
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={getFilterButtonStyle('month')}
          onPress={() => handleFilterChange('month')}
        >
          <ThemedText style={getFilterTextStyle('month')}>
            Month
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={getFilterButtonStyle('year')}
          onPress={() => handleFilterChange('year')}
        >
          <ThemedText style={getFilterTextStyle('year')}>
            Year
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={getFilterButtonStyle('custom')}
          onPress={() => handleFilterChange('custom')}
        >
          <View style={styles.customFilterContent}>
            <Filter 
              size={14} 
              color={timeframeFilter === 'custom' ? colors.background : colors.icon} 
            />
            <ThemedText style={getFilterTextStyle('custom')}>
              Custom
            </ThemedText>
          </View>
        </TouchableOpacity>
      </View>

      {/* Custom Date Filter Modal */}
      <Modal
        visible={showCustomModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                Custom Date Range
              </ThemedText>
              <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                <X size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateInputContainer}>
              <View style={styles.inputLabelRow}>
                <ThemedText style={[styles.inputLabel, { color: colors.text }]}>
                  From Date (optional)
                </ThemedText>
                <View style={styles.quickDateButtons}>
                  <TouchableOpacity 
                    style={[styles.quickDateButton, { backgroundColor: chipBackground }]}
                    onPress={() => setQuickDate('from', 7)}
                  >
                    <ThemedText style={[styles.quickDateText, { color: accent }]}>
                      7d ago
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.quickDateButton, { backgroundColor: chipBackground }]}
                    onPress={() => setQuickDate('from', 30)}
                  >
                    <ThemedText style={[styles.quickDateText, { color: accent }]}>
                      30d ago
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.dateInputWrapper, { backgroundColor: inputBackground }]}>
                <TextInput
                  style={[styles.dateInput, { color: colors.text }]}
                  placeholder="YYYY-MM-DD, MM/DD/YYYY, or DD.MM.YYYY"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  value={fromDateInput}
                  onChangeText={setFromDateInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Calendar size={20} color={colors.icon} />
              </View>
              <ThemedText style={[styles.helperText, { color: colors.icon }]}>
                Leave empty for no start date limit
              </ThemedText>
            </View>

            <View style={styles.dateInputContainer}>
              <View style={styles.inputLabelRow}>
                <ThemedText style={[styles.inputLabel, { color: colors.text }]}>
                  To Date (optional)
                </ThemedText>
                <View style={styles.quickDateButtons}>
                  <TouchableOpacity 
                    style={[styles.quickDateButton, { backgroundColor: chipBackground }]}
                    onPress={() => setQuickDate('to', 0)}
                  >
                    <ThemedText style={[styles.quickDateText, { color: accent }]}>
                      Today
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.dateInputWrapper, { backgroundColor: inputBackground }]}>
                <TextInput
                  style={[styles.dateInput, { color: colors.text }]}
                  placeholder="YYYY-MM-DD, MM/DD/YYYY, or DD.MM.YYYY"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  value={toDateInput}
                  onChangeText={setToDateInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Calendar size={20} color={colors.icon} />
              </View>
              <ThemedText style={[styles.helperText, { color: colors.icon }]}>
                Leave empty for no end date limit
              </ThemedText>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.clearButton, { borderColor: accent }]}
                onPress={clearCustomFilter}
              >
                <ThemedText style={[styles.clearButtonText, { color: accent }]}>
                  Clear
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton, { backgroundColor: accent }]}
                onPress={applyCustomFilter}
              >
                <ThemedText style={[styles.applyButtonText, { color: colors.background }]}>
                  Apply
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading State */}
      {isInitialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        /* Run List */
        <FlatList
          data={displayedRuns}
          renderItem={renderRunItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMoreRuns}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerSubtitle: {
    fontSize: 15,
    marginTop: 6,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  runCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  runHeader: {
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
  },
  runStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 18,
  },
  runFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  routeName: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
  },
  calories: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.5,
    marginTop: 8,
  },
  customFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dateInputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickDateButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  quickDateButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickDateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
