import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, Check, X, Mail } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useClubs, ClubInvite } from '@/contexts/clubs-context';

export default function InvitesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { invites, isLoading, acceptInvite, declineInvite, refreshInvites } = useClubs();

  const [refreshing, setRefreshing] = useState(false);
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Refresh invites on mount
    refreshInvites();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshInvites();
    setRefreshing(false);
  };

  const handleAccept = async (invite: ClubInvite) => {
    setProcessingInvites((prev) => new Set(prev).add(invite.id));
    try {
      await acceptInvite(invite.id);
      Alert.alert('Success', `You've joined ${invite.clubName}!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invite');
    } finally {
      setProcessingInvites((prev) => {
        const next = new Set(prev);
        next.delete(invite.id);
        return next;
      });
    }
  };

  const handleDecline = async (invite: ClubInvite) => {
    Alert.alert(
      'Decline Invite',
      `Are you sure you want to decline the invite to ${invite.clubName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingInvites((prev) => new Set(prev).add(invite.id));
            try {
              await declineInvite(invite.id);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to decline invite');
            } finally {
              setProcessingInvites((prev) => {
                const next = new Set(prev);
                next.delete(invite.id);
                return next;
              });
            }
          },
        },
      ]
    );
  };

  const pendingInvites = invites.filter((i) => i.status === 'pending');

  const renderInviteItem = ({ item }: { item: ClubInvite }) => {
    const isProcessing = processingInvites.has(item.id);

    return (
      <View style={[styles.inviteCard, { backgroundColor: colors.background, borderColor: colors.icon + '30' }]}>
        <View style={styles.inviteHeader}>
          <View style={[styles.clubIconContainer, { backgroundColor: colors.tint + '20' }]}>
            <Users size={24} color={colors.tint} />
          </View>
          <View style={styles.inviteInfo}>
            <Text style={[styles.clubName, { color: colors.text }]}>{item.clubName}</Text>
            <View style={styles.invitedByRow}>
              <Mail size={12} color={colors.icon} />
              <Text style={[styles.invitedBy, { color: colors.icon }]}>
                Invited by {item.invitedByName}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.inviteActions}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.tint} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.declineButton, { borderColor: colors.icon + '50' }]}
                onPress={() => handleDecline(item)}
              >
                <X size={18} color={colors.icon} />
                <Text style={[styles.declineButtonText, { color: colors.icon }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptButton, { backgroundColor: colors.tint }]}
                onPress={() => handleAccept(item)}
              >
                <Check size={18} color={colors.background} />
                <Text style={[styles.acceptButtonText, { color: colors.background }]}>Accept</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Mail size={64} color={colors.icon} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Invites</Text>
      <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
        When someone invites you to a club, it will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Club Invites</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Pending Count Badge */}
      {pendingInvites.length > 0 && (
        <View style={styles.countBadgeContainer}>
          <View style={[styles.countBadge, { backgroundColor: colors.tint + '20' }]}>
            <Text style={[styles.countBadgeText, { color: colors.tint }]}>
              {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={pendingInvites}
          keyExtractor={(item) => item.id}
          renderItem={renderInviteItem}
          contentContainerStyle={[
            styles.listContent,
            pendingInvites.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  countBadgeContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  countBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  inviteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  invitedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invitedBy: {
    fontSize: 13,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
