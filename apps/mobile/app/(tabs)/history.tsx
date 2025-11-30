import { StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useState, useCallback } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { Calendar, Clock, MapPin, TrendingUp, X, Filter } from 'lucide-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

type TimeframeFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

interface RunHistory {
  id: string;
  date: Date;
  duration: number; // in seconds
  distance: number; // in meters
  averageSpeed: number; // in m/s
  calories: number;
  route: string;
}

// Generate dummy data (in production, fetch from API/storage)
const generateDummyRuns = (count: number, startDate: Date = new Date()): RunHistory[] => {
  const runs: RunHistory[] = [];
  const routes = ['City Park Loop', 'River Trail', 'Mountain Path', 'Beach Run', 'Downtown Circuit', 'Forest Trail', 'Lake Perimeter', 'Hill Climb Route'];
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(i / 2); // 2 runs per day on average
    const date = new Date(startDate);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 12) + 6); // 6 AM - 6 PM
    date.setMinutes(Math.floor(Math.random() * 60));
    
    const duration = Math.floor(Math.random() * 3600) + 900; // 15-75 minutes
    const distance = Math.floor(Math.random() * 15000) + 2000; // 2-17 km
    const averageSpeed = distance / duration;
    
    runs.push({
      id: `run-${i}`,
      date,
      duration,
      distance,
      averageSpeed,
      calories: Math.floor((duration / 60) * 10 + Math.random() * 100),
      route: routes[Math.floor(Math.random() * routes.length)],
    });
  }
  
  // Sort by date, newest first
  return runs.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const ALL_RUNS = generateDummyRuns(100); // Generate 100 dummy runs

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const accent = colorScheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const chipBackground = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 126, 164, 0.12)';
  const cardBackground = isDark ? '#1c1f22' : '#ffffff';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const inputBackground = isDark ? '#1f2428' : '#f5f7f9';
  
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all');
  const [displayedRuns, setDisplayedRuns] = useState<RunHistory[]>(ALL_RUNS.slice(0, 20));
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');

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
  const formatDistance = (meters: number): string => {
    return (meters / 1000).toFixed(2);
  };

  // Format speed
  const formatSpeed = (metersPerSecond: number): string => {
    return ((metersPerSecond * 3600) / 1000).toFixed(1);
  };

  // Format date
  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Filter runs based on timeframe
  const getFilteredRuns = useCallback((filter: TimeframeFilter, fromDate?: Date | null, toDate?: Date | null): RunHistory[] => {
    const now = new Date();
    
    switch (filter) {
      case 'today':
        return ALL_RUNS.filter(run => {
          const runDate = new Date(run.date);
          return runDate.toDateString() === now.toDateString();
        });
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return ALL_RUNS.filter(run => run.date >= weekAgo);
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return ALL_RUNS.filter(run => run.date >= monthAgo);
      case 'year':
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return ALL_RUNS.filter(run => run.date >= yearAgo);
      case 'custom':
        return ALL_RUNS.filter(run => {
          const runDate = new Date(run.date);
          const from = fromDate ? new Date(fromDate) : null;
          const to = toDate ? new Date(toDate) : null;
          
          // Set time to start of day for 'from' and end of day for 'to'
          if (from) {
            from.setHours(0, 0, 0, 0);
          }
          if (to) {
            to.setHours(23, 59, 59, 999);
          }
          
          // Check if run is within the date range
          if (from && to) {
            return runDate >= from && runDate <= to;
          } else if (from) {
            return runDate >= from;
          } else if (to) {
            return runDate <= to;
          }
          
          return true; // Both empty means show all
        });
      default:
        return ALL_RUNS;
    }
  }, []);

  // Handle filter change
  const handleFilterChange = (filter: TimeframeFilter) => {
    if (filter === 'custom') {
      setShowCustomModal(true);
      return;
    }
    
    setTimeframeFilter(filter);
    const filtered = getFilteredRuns(filter);
    setDisplayedRuns(filtered.slice(0, 20));
    setHasMore(filtered.length > 20);
  };

  // Parse date from string input (supports multiple formats)
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr.trim()) return null;
    
    // Try parsing YYYY-MM-DD format
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Try parsing MM/DD/YYYY format
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Try parsing DD.MM.YYYY format
    const euMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Fallback to Date constructor
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Apply custom date filter
  const applyCustomFilter = () => {
    const fromDate = parseDate(fromDateInput);
    const toDate = parseDate(toDateInput);
    
    // If both fields are empty, switch to "All time"
    if (!fromDate && !toDate) {
      setTimeframeFilter('all');
      const filtered = getFilteredRuns('all');
      setDisplayedRuns(filtered.slice(0, 20));
      setHasMore(filtered.length > 20);
      setShowCustomModal(false);
      return;
    }
    
    setCustomFromDate(fromDate);
    setCustomToDate(toDate);
    setTimeframeFilter('custom');
    const filtered = getFilteredRuns('custom', fromDate, toDate);
    setDisplayedRuns(filtered.slice(0, 20));
    setHasMore(filtered.length > 20);
    setShowCustomModal(false);
  };

  // Clear custom filter
  const clearCustomFilter = () => {
    setCustomFromDate(null);
    setCustomToDate(null);
    setFromDateInput('');
    setToDateInput('');
  };

  // Set quick date (today or a relative date)
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
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      const filtered = getFilteredRuns(
        timeframeFilter, 
        timeframeFilter === 'custom' ? customFromDate : undefined,
        timeframeFilter === 'custom' ? customToDate : undefined
      );
      const currentLength = displayedRuns.length;
      const nextBatch = filtered.slice(currentLength, currentLength + 20);
      
      if (nextBatch.length === 0) {
        setHasMore(false);
      } else {
        setDisplayedRuns([...displayedRuns, ...nextBatch]);
      }
      
      setIsLoading(false);
    }, 500);
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
            {formatDate(item.date)}
          </ThemedText>
          <ThemedText style={[styles.timeText, { color: colors.icon }]}>
            {formatTime(item.date)}
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
              {formatDuration(item.duration)}
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
              {formatSpeed(item.averageSpeed)} km/h
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.icon }]}>
              Avg Speed
            </ThemedText>
          </View>
        </View>
      </View>
      
      <View style={[styles.runFooter, { borderTopColor: borderColor }]}>
        <ThemedText style={[styles.routeName, { color: colors.text }]}>
          {item.route}
        </ThemedText>
        <ThemedText style={[styles.calories, { color: accent }]}>
          {item.calories} cal
        </ThemedText>
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

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
        No runs found for this timeframe
      </ThemedText>
    </View>
  );

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
          {displayedRuns.length} {displayedRuns.length === 1 ? 'run logged' : 'runs logged'}
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

      {/* Run List */}
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
    opacity: 0.6,
  },
  footer: {
    paddingVertical: 20,
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
