import { StyleSheet, ScrollView, View, Dimensions, FlatList, Image } from 'react-native';
import { useState, useRef } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LeaderboardEntry {
  position: number;
  name: string;
  profilePicture: string;
  value: number;
  unit: string;
  isCurrentUser?: boolean;
}

interface LeaderboardData {
  title: string;
  entries: LeaderboardEntry[];
}

const MOCK_LEADERBOARDS: LeaderboardData[] = [
  {
    title: 'Distance',
    entries: [
      { position: 1, name: 'Sarah Runner', profilePicture: 'https://i.pravatar.cc/150?img=1', value: 245.8, unit: 'km' },
      { position: 2, name: 'Mike Sprint', profilePicture: 'https://i.pravatar.cc/150?img=12', value: 198.2, unit: 'km' },
      { position: 3, name: 'Emma Fast', profilePicture: 'https://i.pravatar.cc/150?img=5', value: 187.5, unit: 'km' },
      { position: 4, name: 'John Walker', profilePicture: 'https://i.pravatar.cc/150?img=13', value: 156.3, unit: 'km' },
      { position: 5, name: 'Lisa Active', profilePicture: 'https://i.pravatar.cc/150?img=9', value: 142.9, unit: 'km' },
      { position: 6, name: 'Tom Jogger', profilePicture: 'https://i.pravatar.cc/150?img=15', value: 128.4, unit: 'km' },
      { position: 7, name: 'Amy Hiker', profilePicture: 'https://i.pravatar.cc/150?img=10', value: 115.7, unit: 'km' },
      { position: 8, name: 'Chris Move', profilePicture: 'https://i.pravatar.cc/150?img=14', value: 98.6, unit: 'km' },
      { position: 9, name: 'You', profilePicture: 'https://i.pravatar.cc/150?img=33', value: 89.3, unit: 'km', isCurrentUser: true },
      { position: 10, name: 'Dave Runner', profilePicture: 'https://i.pravatar.cc/150?img=16', value: 85.2, unit: 'km' },
    ],
  },
  {
    title: 'Active Time',
    entries: [
      { position: 1, name: 'Emma Fast', profilePicture: 'https://i.pravatar.cc/150?img=5', value: 86.5, unit: 'hrs' },
      { position: 2, name: 'Mike Sprint', profilePicture: 'https://i.pravatar.cc/150?img=12', value: 72.3, unit: 'hrs' },
      { position: 3, name: 'Sarah Runner', profilePicture: 'https://i.pravatar.cc/150?img=1', value: 68.9, unit: 'hrs' },
      { position: 4, name: 'Lisa Active', profilePicture: 'https://i.pravatar.cc/150?img=9', value: 61.2, unit: 'hrs' },
      { position: 5, name: 'Tom Jogger', profilePicture: 'https://i.pravatar.cc/150?img=15', value: 55.8, unit: 'hrs' },
      { position: 6, name: 'John Walker', profilePicture: 'https://i.pravatar.cc/150?img=13', value: 48.4, unit: 'hrs' },
      { position: 7, name: 'Amy Hiker', profilePicture: 'https://i.pravatar.cc/150?img=10', value: 42.7, unit: 'hrs' },
      { position: 8, name: 'Chris Move', profilePicture: 'https://i.pravatar.cc/150?img=14', value: 38.1, unit: 'hrs' },
      { position: 9, name: 'Dave Runner', profilePicture: 'https://i.pravatar.cc/150?img=16', value: 34.5, unit: 'hrs' },
      { position: 10, name: 'Nina Speed', profilePicture: 'https://i.pravatar.cc/150?img=20', value: 31.2, unit: 'hrs' },
      { position: 11, name: 'Oscar Fast', profilePicture: 'https://i.pravatar.cc/150?img=17', value: 28.9, unit: 'hrs' },
      { position: 12, name: 'You', profilePicture: 'https://i.pravatar.cc/150?img=33', value: 26.4, unit: 'hrs', isCurrentUser: true },
      { position: 13, name: 'Paula Dash', profilePicture: 'https://i.pravatar.cc/150?img=22', value: 23.8, unit: 'hrs' },
      { position: 14, name: 'Quinn Move', profilePicture: 'https://i.pravatar.cc/150?img=18', value: 21.5, unit: 'hrs' },
      { position: 15, name: 'Rachel Go', profilePicture: 'https://i.pravatar.cc/150?img=24', value: 19.3, unit: 'hrs' },
      { position: 16, name: 'Steve Walk', profilePicture: 'https://i.pravatar.cc/150?img=19', value: 17.2, unit: 'hrs' },
      { position: 17, name: 'Tina Pace', profilePicture: 'https://i.pravatar.cc/150?img=25', value: 15.8, unit: 'hrs' },
      { position: 18, name: 'Uma Active', profilePicture: 'https://i.pravatar.cc/150?img=26', value: 14.1, unit: 'hrs' },
      { position: 19, name: 'Victor Run', profilePicture: 'https://i.pravatar.cc/150?img=21', value: 12.6, unit: 'hrs' },
      { position: 20, name: 'Wendy Jog', profilePicture: 'https://i.pravatar.cc/150?img=28', value: 10.9, unit: 'hrs' },
      { position: 21, name: 'Xavier Swift', profilePicture: 'https://i.pravatar.cc/150?img=29', value: 9.8, unit: 'hrs' },
      { position: 22, name: 'Yara Motion', profilePicture: 'https://i.pravatar.cc/150?img=30', value: 8.7, unit: 'hrs' },
      { position: 23, name: 'Zack Rush', profilePicture: 'https://i.pravatar.cc/150?img=31', value: 7.9, unit: 'hrs' },
      { position: 24, name: 'Alice Stride', profilePicture: 'https://i.pravatar.cc/150?img=32', value: 7.2, unit: 'hrs' },
      { position: 25, name: 'Ben Quick', profilePicture: 'https://i.pravatar.cc/150?img=34', value: 6.8, unit: 'hrs' },
      { position: 26, name: 'Chloe Fit', profilePicture: 'https://i.pravatar.cc/150?img=35', value: 6.3, unit: 'hrs' },
      { position: 27, name: 'Dylan Go', profilePicture: 'https://i.pravatar.cc/150?img=36', value: 5.9, unit: 'hrs' },
      { position: 28, name: 'Eva Zoom', profilePicture: 'https://i.pravatar.cc/150?img=37', value: 5.5, unit: 'hrs' },
      { position: 29, name: 'Felix Pace', profilePicture: 'https://i.pravatar.cc/150?img=38', value: 5.1, unit: 'hrs' },
      { position: 30, name: 'Grace Move', profilePicture: 'https://i.pravatar.cc/150?img=39', value: 4.8, unit: 'hrs' },
      { position: 31, name: 'Henry Fast', profilePicture: 'https://i.pravatar.cc/150?img=40', value: 4.5, unit: 'hrs' },
      { position: 32, name: 'Iris Run', profilePicture: 'https://i.pravatar.cc/150?img=41', value: 4.2, unit: 'hrs' },
      { position: 33, name: 'Jake Dash', profilePicture: 'https://i.pravatar.cc/150?img=42', value: 3.9, unit: 'hrs' },
      { position: 34, name: 'Kara Speed', profilePicture: 'https://i.pravatar.cc/150?img=43', value: 3.7, unit: 'hrs' },
      { position: 35, name: 'Leo Sprint', profilePicture: 'https://i.pravatar.cc/150?img=44', value: 3.4, unit: 'hrs' },
      { position: 36, name: 'Mia Active', profilePicture: 'https://i.pravatar.cc/150?img=45', value: 3.2, unit: 'hrs' },
      { position: 37, name: 'Noah Walk', profilePicture: 'https://i.pravatar.cc/150?img=46', value: 2.9, unit: 'hrs' },
      { position: 38, name: 'Olivia Jog', profilePicture: 'https://i.pravatar.cc/150?img=47', value: 2.7, unit: 'hrs' },
      { position: 39, name: 'Peter Stride', profilePicture: 'https://i.pravatar.cc/150?img=48', value: 2.5, unit: 'hrs' },
      { position: 40, name: 'Quinn Rush', profilePicture: 'https://i.pravatar.cc/150?img=49', value: 2.3, unit: 'hrs' },
      { position: 41, name: 'Ruby Motion', profilePicture: 'https://i.pravatar.cc/150?img=50', value: 2.1, unit: 'hrs' },
      { position: 42, name: 'Sam Pace', profilePicture: 'https://i.pravatar.cc/150?img=51', value: 1.9, unit: 'hrs' },
      { position: 43, name: 'Tara Zoom', profilePicture: 'https://i.pravatar.cc/150?img=52', value: 1.7, unit: 'hrs' },
      { position: 44, name: 'Umar Swift', profilePicture: 'https://i.pravatar.cc/150?img=53', value: 1.5, unit: 'hrs' },
      { position: 45, name: 'Vera Fit', profilePicture: 'https://i.pravatar.cc/150?img=54', value: 1.4, unit: 'hrs' },
      { position: 46, name: 'Will Run', profilePicture: 'https://i.pravatar.cc/150?img=55', value: 1.2, unit: 'hrs' },
      { position: 47, name: 'Xena Go', profilePicture: 'https://i.pravatar.cc/150?img=56', value: 1.0, unit: 'hrs' },
      { position: 48, name: 'Yuri Active', profilePicture: 'https://i.pravatar.cc/150?img=57', value: 0.9, unit: 'hrs' },
      { position: 49, name: 'Zara Move', profilePicture: 'https://i.pravatar.cc/150?img=58', value: 0.7, unit: 'hrs' },
      { position: 50, name: 'Alex Speed', profilePicture: 'https://i.pravatar.cc/150?img=59', value: 0.5, unit: 'hrs' },
    ],
  }
];

export default function LeaderboardScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedItems, setDisplayedItems] = useState<{[key: number]: number}>({
    0: 10,
    1: 10,
  });
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const accent = colorScheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const cardBackground = isDark ? '#1c1f22' : '#ffffff';
  const rowHighlight = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.12)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

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
    if (isLoading) return;
    
    const currentCount = displayedItems[leaderboardIndex] || 10;
    const totalItems = MOCK_LEADERBOARDS[leaderboardIndex].entries.length;
    
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
            <Image source={{ uri: item.profilePicture }} style={styles.profilePicture} />
            <ThemedText style={[styles.name, { color: colors.text }]}>
              {item.name}
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
          Compare this week's effort with friends
        </ThemedText>
      </View>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {MOCK_LEADERBOARDS.map((data, index) => renderLeaderboard(data, index))}
      </ScrollView>

      <View style={styles.pagination}>
        {MOCK_LEADERBOARDS.map((_, index) => (
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
});
