import { StyleSheet, ScrollView, View, Dimensions, FlatList, Image, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useState, useRef, useMemo, useEffect } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useClubs } from '@/contexts/clubs-context';
import { useApiClient } from '@/hooks/use-api-client';
import { ChevronDown, Users, Check } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LeaderboardEntry {
  position: number;
  userId: string;
  userName?: string;
  userImage?: string | null;
  value: number;
  unit: string;
  isCurrentUser?: boolean;
}

interface LeaderboardResponse {
  distance: LeaderboardEntry[];
  activeTime: LeaderboardEntry[];
}

interface LeaderboardData {
  title: string;
  entries: LeaderboardEntry[];
}

type WeekType = 'this' | 'last';

// Generate mock leaderboard data for a club
const generateClubLeaderboard = (clubId: string, clubName: string, week: WeekType): LeaderboardData[] => {
  // Use clubId to seed different data for each club
  const seed = clubId.charCodeAt(0) || 1;
  // Different multiplier for last week to simulate different results
  const weekMultiplier = week === 'last' ? 0.85 : 1;
  
  // Shuffle positions slightly for last week
  const distanceNames = week === 'last' 
    ? ['Mike Sprint', 'Sarah Runner', 'John Walker', 'Emma Fast', 'Tom Jogger', 'Lisa Active', 'You', 'Amy Hiker', 'Chris Move', 'Dave Runner']
    : ['Sarah Runner', 'Mike Sprint', 'Emma Fast', 'John Walker', 'Lisa Active', 'Tom Jogger', 'Amy Hiker', 'Chris Move', 'You', 'Dave Runner'];
  
  const distanceImages = week === 'last'
    ? [12, 1, 13, 5, 15, 9, 33, 10, 14, 16]
    : [1, 12, 5, 13, 9, 15, 10, 14, 33, 16];
  
  const distanceValues = [245.8, 198.2, 187.5, 156.3, 142.9, 128.4, 115.7, 98.6, 89.3, 85.2];
  
  const distanceEntries: LeaderboardEntry[] = distanceNames.map((name, i) => ({
    position: i + 1,
    name,
    profilePicture: `https://i.pravatar.cc/150?img=${distanceImages[i]}`,
    value: Math.round(distanceValues[i] * (seed % 3 + 0.5) * weekMultiplier * 10) / 10,
    unit: 'km',
    isCurrentUser: name === 'You',
  }));

  const timeNames = week === 'last'
    ? ['Mike Sprint', 'Emma Fast', 'Lisa Active', 'Sarah Runner', 'You', 'Tom Jogger', 'John Walker', 'Amy Hiker', 'Chris Move', 'Dave Runner']
    : ['Emma Fast', 'Mike Sprint', 'Sarah Runner', 'Lisa Active', 'Tom Jogger', 'John Walker', 'You', 'Amy Hiker', 'Chris Move', 'Dave Runner'];
  
  const timeImages = week === 'last'
    ? [12, 5, 9, 1, 33, 15, 13, 10, 14, 16]
    : [5, 12, 1, 9, 15, 13, 33, 10, 14, 16];
  
  const timeValues = [86.5, 72.3, 68.9, 61.2, 55.8, 48.4, 42.7, 38.1, 34.5, 31.2];
  
  const timeEntries: LeaderboardEntry[] = timeNames.map((name, i) => ({
    position: i + 1,
    name,
    profilePicture: `https://i.pravatar.cc/150?img=${timeImages[i]}`,
    value: Math.round(timeValues[i] * (seed % 2 + 0.7) * weekMultiplier * 10) / 10,
    unit: 'hrs',
    isCurrentUser: name === 'You',
  }));

  return [
    { title: 'Distance', entries: distanceEntries },
    { title: 'Active Time', entries: timeEntries },
  ];
};

export default function LeaderboardScreen() {
  const { memberships } = useClubs();
  const apiClient = useApiClient();
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeekType>('this');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedItems, setDisplayedItems] = useState<{[key: number]: number}>({
    0: 10,
    1: 10,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const accent = colorScheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const cardBackground = isDark ? '#1c1f22' : '#ffffff';
  const rowHighlight = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.12)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

  // Get selected club or default to first club
  const selectedClub = useMemo(() => {
    if (selectedClubId) {
      return memberships.find(m => m.club.id === selectedClubId)?.club;
    }
    return memberships[0]?.club;
  }, [selectedClubId, memberships]);

  // Fetch leaderboard data when club or week changes
  useEffect(() => {
    if (!selectedClub?.id) {
      setLeaderboardData([]);
      setIsLoading(false);
      return;
    }

    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const endpoint = selectedWeek === 'this' 
          ? `/leaderboards/club/${selectedClub.id}/weekly`
          : `/leaderboards/club/${selectedClub.id}/last-week`;
        
        const data = await apiClient.get<LeaderboardResponse>(endpoint);
        
        setLeaderboardData([
          { title: 'Distance', entries: data.distance },
          { title: 'Active Time', entries: data.activeTime },
        ]);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        setLeaderboardData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedClub?.id, selectedWeek]);

  const handleClubSelect = (clubId: string) => {
    setSelectedClubId(clubId);
    setShowClubPicker(false);
    // Reset displayed items when switching clubs
    setDisplayedItems({ 0: 10, 1: 10 });
    setCurrentIndex(0);
    scrollViewRef.current?.scrollTo({ x: 0, animated: false });
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return position.toString();
    }
  };

  const loadMore = (leaderboardIndex: number) => {
    if (isLoading || !leaderboardData[leaderboardIndex]) return;
    
    const currentCount = displayedItems[leaderboardIndex] || 10;
    const totalItems = leaderboardData[leaderboardIndex].entries.length;
    
    if (currentCount >= totalItems) return;
    
    setIsLoading(true);
    // Simulate network delay
    setTimeout(() => {
      setDisplayedItems(prev => ({
        ...prev,
        [leaderboardIndex]: Math.min(currentCount + 10, totalItems)
      }));
      setIsLoading(false);
    }, 1000);
  };

  const renderLeaderboardEntry = ({ item }: { item: LeaderboardEntry }) => {
    const isTopThree = item.position <= 3;
    
    return (
      <View
        style={[
          styles.entryRow,
          {
            backgroundColor: cardBackground,
            borderColor,
            shadowColor: isDark ? '#000' : accent,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 10,
            elevation: 3,
          },
          item.isCurrentUser && {
            borderColor: accent,
            backgroundColor: rowHighlight,
          },
        ]}
      >
        <View style={styles.positionColumn}>
          <ThemedText style={[styles.position, { color: colors.text }, isTopThree && styles.medalText]}>
            {getMedalIcon(item.position)}
          </ThemedText>
        </View>
        
        <View style={styles.nameColumn}>
          <View style={styles.nameContainer}>
            <Image 
              source={{ uri: item.userImage || `https://i.pravatar.cc/150?u=${item.userId}` }} 
              style={styles.profilePicture} 
            />
            <ThemedText style={[styles.name, { color: colors.text }]}>
              {item.isCurrentUser ? 'You' : (item.userName || `User ${item.position}`)}
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.valueColumn}>
          <ThemedText style={[styles.value, { color: colors.text }]}>
            {item.value.toLocaleString()} {item.unit}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderLeaderboard = (data: LeaderboardData, index: number) => {
    const itemCount = displayedItems[index] || 10;
    const displayData = data.entries.slice(0, itemCount);
    const hasMore = itemCount < data.entries.length;

    return (
      <View key={index} style={styles.leaderboardContainer}>
        <ThemedText type="title" style={[styles.leaderboardTitle, { color: colors.text }]}>
          {data.title}
        </ThemedText>
        
        <FlatList
          data={displayData}
          renderItem={renderLeaderboardEntry}
          keyExtractor={(item) => `${index}-${item.position}`}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => loadMore(index)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.loadingFooter}>
                <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
                  {isLoading ? 'Loading...' : 'Scroll for more'}
                </ThemedText>
              </View>
            ) : null
          }
        />
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.screenHeader}>
        <ThemedText type="title" style={styles.screenTitle}>
          Leaderboard
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
          {selectedWeek === 'this' ? "Compare this week's effort with club members" : "Last week's final standings"}
        </ThemedText>
      </View>

      {/* Week Switcher */}
      <View style={styles.weekSwitcher}>
        <TouchableOpacity
          style={[
            styles.weekTab,
            { borderColor },
            selectedWeek === 'this' && { backgroundColor: accent, borderColor: accent },
          ]}
          onPress={() => setSelectedWeek('this')}
        >
          <ThemedText style={[
            styles.weekTabText,
            { color: selectedWeek === 'this' ? '#fff' : colors.text },
          ]}>
            This Week
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.weekTab,
            { borderColor },
            selectedWeek === 'last' && { backgroundColor: accent, borderColor: accent },
          ]}
          onPress={() => setSelectedWeek('last')}
        >
          <ThemedText style={[
            styles.weekTabText,
            { color: selectedWeek === 'last' ? '#fff' : colors.text },
          ]}>
            Last Week
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Club Switcher */}
      {memberships.length > 0 ? (
        <TouchableOpacity
          style={[styles.clubSwitcher, { backgroundColor: cardBackground, borderColor }]}
          onPress={() => setShowClubPicker(true)}
        >
          <View style={styles.clubSwitcherContent}>
            <View style={[styles.clubIcon, { backgroundColor: accent + '20' }]}>
              <Users size={18} color={accent} />
            </View>
            <ThemedText style={[styles.clubName, { color: colors.text }]}>
              {selectedClub?.name || 'Select a club'}
            </ThemedText>
          </View>
          <ChevronDown size={20} color={colors.icon} />
        </TouchableOpacity>
      ) : (
        <View style={[styles.noClubsBanner, { backgroundColor: cardBackground, borderColor }]}>
          <Users size={24} color={colors.icon} />
          <ThemedText style={[styles.noClubsText, { color: colors.icon }]}>
            Join a club to see leaderboards
          </ThemedText>
        </View>
      )}

      {leaderboardData.length > 0 ? (
        <>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.scrollView}
          >
            {leaderboardData.map((data, index) => renderLeaderboard(data, index))}
          </ScrollView>

          <View style={styles.pagination}>
            {leaderboardData.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: colors.icon },
                  currentIndex === index && [styles.activeDot, { backgroundColor: accent }],
                ]}
              />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
            No leaderboard data available
          </ThemedText>
        </View>
      )}

      {/* Club Picker Dropdown */}
      <Modal
        visible={showClubPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClubPicker(false)}
      >
        <Pressable 
          style={styles.dropdownOverlay} 
          onPress={() => setShowClubPicker(false)}
        >
          <Pressable 
            style={[
              styles.dropdownContainer, 
              { 
                backgroundColor: cardBackground, 
                borderColor,
                shadowColor: isDark ? '#000' : '#64748b',
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {memberships.map((membership, index) => (
              <TouchableOpacity
                key={membership.club.id}
                style={[
                  styles.dropdownOption,
                  index < memberships.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
                  (selectedClub?.id === membership.club.id) && { backgroundColor: accent + '10' },
                ]}
                onPress={() => handleClubSelect(membership.club.id)}
              >
                <ThemedText style={[styles.dropdownOptionText, { color: colors.text }]}>
                  {membership.club.name}
                </ThemedText>
                {(selectedClub?.id === membership.club.id) && (
                  <Check size={18} color={accent} />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
  weekSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 10,
  },
  weekTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  weekTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clubSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  clubSwitcherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clubIcon: {
    marginRight: 10,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  noClubsBanner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noClubsText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  leaderboardContainer: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  leaderboardTitle: {
    marginBottom: 16,
    fontSize: 24,
  },
  headerText: {
    fontWeight: '600',
    fontSize: 14,
    opacity: 0.7,
  },
  list: {
    flex: 1,
  },
  entryRow: {
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  currentUserRow: {
    borderWidth: 2,
  },
  positionColumn: {
    width: 40,
    justifyContent: 'center',
  },
  nameColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  valueColumn: {
    width: 100,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  position: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
  },
  medalText: {
    fontSize: 24,
    lineHeight: 32,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  name: {
    fontSize: 15,
    flex: 1,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingTop: 0,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    borderRadius: 4,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingTop: 180,
    paddingHorizontal: 20,
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
