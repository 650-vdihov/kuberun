import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users, ChevronRight, X, ArrowLeft } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useClubs, ClubMembership } from '@/contexts/clubs-context';

export default function ClubsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { memberships, isLoading, createClub, refreshClubs } = useClubs();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubDescription, setNewClubDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCreateClub = async () => {
    if (!newClubName.trim()) {
      Alert.alert('Error', 'Club name is required');
      return;
    }

    setIsCreating(true);
    try {
      const club = await createClub(newClubName, newClubDescription);
      setShowCreateModal(false);
      setNewClubName('');
      setNewClubDescription('');
      // Navigate to the new club
      router.push({ pathname: '/club/[id]', params: { id: club.id } } as any);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create club');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshClubs();
    setRefreshing(false);
  };

  const handleClubPress = (membership: ClubMembership) => {
    router.push({ pathname: '/club/[id]', params: { id: membership.club.id } } as any);
  };

  const renderClubItem = ({ item }: { item: ClubMembership }) => (
    <TouchableOpacity
      style={[styles.clubCard, { backgroundColor: colors.background, borderColor: colors.icon + '30' }]}
      onPress={() => handleClubPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.clubCardContent}>
        {item.club.image ? (
          <Image source={{ uri: item.club.image }} style={styles.clubImage} />
        ) : (
          <View style={[styles.clubImagePlaceholder, { backgroundColor: colors.tint + '20' }]}>
            <Users size={24} color={colors.tint} />
          </View>
        )}
        <View style={styles.clubInfo}>
          <Text style={[styles.clubName, { color: colors.text }]}>{item.club.name}</Text>
          <View style={styles.clubMeta}>
            <Text style={[styles.clubRole, { color: colors.tint }]}>
              {item.role === 'admin' ? 'Admin' : 'Member'}
            </Text>
            <Text style={[styles.clubMembers, { color: colors.icon }]}>
              • {item.club.memberCount} member{item.club.memberCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={colors.icon} />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Users size={64} color={colors.icon} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Clubs Yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
        Create a club or accept an invite to get started
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Clubs</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.tint }]}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.7}
        >
          <Plus size={20} color={colors.background} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={memberships}
          keyExtractor={(item) => item.club.id}
          renderItem={renderClubItem}
          contentContainerStyle={[
            styles.listContent,
            memberships.length === 0 && styles.emptyListContent,
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

      {/* Create Club Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Club</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Club Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.icon + '50', backgroundColor: colors.background },
                ]}
                value={newClubName}
                onChangeText={setNewClubName}
                placeholder="Enter club name"
                placeholderTextColor={colors.icon}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { color: colors.text, borderColor: colors.icon + '50', backgroundColor: colors.background },
                ]}
                value={newClubDescription}
                onChangeText={setNewClubDescription}
                placeholder="What is this club about?"
                placeholderTextColor={colors.icon}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.tint },
                isCreating && styles.submitButtonDisabled,
              ]}
              onPress={handleCreateClub}
              disabled={isCreating}
              activeOpacity={0.7}
            >
              {isCreating ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.submitButtonText, { color: colors.background }]}>
                  Create Club
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
  clubCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  clubCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  clubImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubRole: {
    fontSize: 12,
    fontWeight: '500',
  },
  clubMembers: {
    fontSize: 12,
    marginLeft: 4,
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    padding: 24,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
