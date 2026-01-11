import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  FlatList,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Users,
  Settings,
  UserPlus,
  X,
  Crown,
  Shield,
  ShieldOff,
  User,
  Trash2,
  ChevronDown,
  Check,
  LogOut,
} from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useClubs, ClubMember, ClubMembership, ClubPreferences } from '@/contexts/clubs-context';
import { useAuth } from '@/contexts/auth-context';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (+0)' },
  { value: 'Etc/GMT+12', label: 'UTC-12' },
  { value: 'Etc/GMT+11', label: 'UTC-11' },
  { value: 'Etc/GMT+10', label: 'UTC-10' },
  { value: 'Etc/GMT+9', label: 'UTC-9' },
  { value: 'Etc/GMT+8', label: 'UTC-8' },
  { value: 'Etc/GMT+7', label: 'UTC-7' },
  { value: 'Etc/GMT+6', label: 'UTC-6' },
  { value: 'Etc/GMT+5', label: 'UTC-5' },
  { value: 'Etc/GMT+4', label: 'UTC-4' },
  { value: 'Etc/GMT+3', label: 'UTC-3' },
  { value: 'Etc/GMT+2', label: 'UTC-2' },
  { value: 'Etc/GMT+1', label: 'UTC-1' },
  { value: 'Etc/GMT-1', label: 'UTC+1' },
  { value: 'Etc/GMT-2', label: 'UTC+2' },
  { value: 'Etc/GMT-3', label: 'UTC+3' },
  { value: 'Etc/GMT-4', label: 'UTC+4' },
  { value: 'Etc/GMT-5', label: 'UTC+5' },
  { value: 'Etc/GMT-6', label: 'UTC+6' },
  { value: 'Etc/GMT-7', label: 'UTC+7' },
  { value: 'Etc/GMT-8', label: 'UTC+8' },
  { value: 'Etc/GMT-9', label: 'UTC+9' },
  { value: 'Etc/GMT-10', label: 'UTC+10' },
  { value: 'Etc/GMT-11', label: 'UTC+11' },
  { value: 'Etc/GMT-12', label: 'UTC+12' },
  { value: 'Etc/GMT-13', label: 'UTC+13' },
  { value: 'Etc/GMT-14', label: 'UTC+14' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
];

const DISTANCE_UNITS = [
  { value: 'km', label: 'Kilometers (km)' },
  { value: 'mi', label: 'Miles (mi)' },
] as const;

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  const {
    memberships,
    getClubMembers,
    updateClubPreferences,
    inviteToClub,
    kickMember,
    promoteMember,
    demoteMember,
    leaveClub,
  } = useClubs();

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [showDistanceDropdown, setShowDistanceDropdown] = useState(false);

  // Find the membership for this club
  const membership = memberships.find((m) => m.club.id === id);
  const isAdmin = membership?.role === 'admin';
  const isOwner = membership?.club.createdBy === user?.id;

  useEffect(() => {
    loadMembers();
  }, [id]);

  const loadMembers = async () => {
    if (!id) return;
    setIsLoadingMembers(true);
    try {
      const data = await getClubMembers(id);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      await inviteToClub(id!, inviteEmail);
      Alert.alert('Success', `Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleKickMember = (member: ClubMember) => {
    console.log('handleKickMember called for:', member.name, member.id);
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from the club?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            console.log('Kicking member:', member.id, 'from club:', id);
            try {
              await kickMember(id!, member.id);
              await loadMembers();
              Alert.alert('Success', `${member.name} has been removed`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handlePromoteMember = (member: ClubMember) => {
    Alert.alert(
      'Promote to Admin',
      `Are you sure you want to promote ${member.name} to admin? They will be able to manage members, settings, and invite others.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await promoteMember(id!, member.id);
              await loadMembers();
              Alert.alert('Success', `${member.name} is now an admin`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to promote member');
            }
          },
        },
      ]
    );
  };

  const handleDemoteMember = (member: ClubMember) => {
    Alert.alert(
      'Demote Admin',
      `Are you sure you want to demote ${member.name} from admin? They will no longer be able to manage members, settings, or invite others.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          style: 'destructive',
          onPress: async () => {
            try {
              await demoteMember(id!, member.id);
              await loadMembers();
              Alert.alert('Success', `${member.name} is now a regular member`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to demote member');
            }
          },
        },
      ]
    );
  };

  const handleUpdateTimezone = async (timezone: string) => {
    try {
      await updateClubPreferences(id!, { timezone });
      setShowTimezoneDropdown(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update timezone');
    }
  };

  const handleUpdateDistanceUnit = async (unit: 'km' | 'mi') => {
    try {
      await updateClubPreferences(id!, { distanceUnit: unit });
      setShowDistanceDropdown(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update distance unit');
    }
  };

  const handleLeaveClub = () => {
    Alert.alert(
      'Leave Club',
      `Are you sure you want to leave ${membership?.club.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveClub(id!);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave club');
            }
          },
        },
      ]
    );
  };

  if (!membership) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Club not found</Text>
          <TouchableOpacity
            style={[styles.backButtonLarge, { backgroundColor: colors.tint }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: colors.background }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderMemberItem = ({ item }: { item: ClubMember }) => {
    const isCurrentUser = item.id === user?.id;
    const canManage = isAdmin && !isCurrentUser;
    
    console.log('Rendering member:', {
      memberName: item.name,
      memberId: item.id,
      currentUserId: user?.id,
      isCurrentUser,
      isAdmin,
      canManage,
      memberRole: item.role
    });

    return (
      <View style={[styles.memberCard, { borderColor: colors.icon + '30' }]}>
        <View style={styles.memberInfo}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.memberAvatar} />
          ) : (
            <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.tint + '20' }]}>
              <User size={20} color={colors.tint} />
            </View>
          )}
          <View style={styles.memberDetails}>
            <View style={styles.memberNameRow}>
              <Text style={[styles.memberName, { color: colors.text }]}>
                {item.name}
                {isCurrentUser && ' (You)'}
              </Text>
              {item.role === 'admin' && (
                <View style={[styles.roleBadge, { backgroundColor: colors.tint + '20' }]}>
                  <Shield size={12} color={colors.tint} />
                  <Text style={[styles.roleBadgeText, { color: colors.tint }]}>Admin</Text>
                </View>
              )}
            </View>
            <Text style={[styles.memberEmail, { color: colors.icon }]}>{item.email}</Text>
          </View>
        </View>

        {canManage && (
          <View style={styles.memberActions}>
            {item.role === 'member' ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.tint + '20' }]}
                onPress={() => handlePromoteMember(item)}
              >
                <Crown size={16} color={colors.tint} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#dc262620' }]}
                onPress={() => handleDemoteMember(item)}
              >
                <ShieldOff size={16} color="#dc2626" />
              </TouchableOpacity>
            )}
            {item.role === 'member' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#dc262620' }]}
                onPress={() => handleKickMember(item)}
              >
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {membership.club.name}
        </Text>
        <View style={styles.headerActions}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowSettingsModal(true)}
            >
              <Settings size={22} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Club Info */}
      <View style={styles.clubInfo}>
        {membership.club.image ? (
          <Image source={{ uri: membership.club.image }} style={styles.clubImage} />
        ) : (
          <View style={[styles.clubImagePlaceholder, { backgroundColor: colors.tint + '20' }]}>
            <Users size={40} color={colors.tint} />
          </View>
        )}
        <View style={styles.clubStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {membership.club.memberCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.icon }]}>Members</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {membership.club.preferences.distanceUnit.toUpperCase()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.icon }]}>Unit</Text>
          </View>
        </View>
      </View>

      {/* Admin Actions */}
      {isAdmin && (
        <View style={styles.adminActions}>
          <TouchableOpacity
            style={[styles.inviteButton, { backgroundColor: colors.tint }]}
            onPress={() => setShowInviteModal(true)}
          >
            <UserPlus size={20} color={colors.background} />
            <Text style={[styles.inviteButtonText, { color: colors.background }]}>
              Invite Member
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Members List */}
      <View style={styles.membersSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
        {isLoadingMembers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.membersList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Leave Club Button */}
      <View style={styles.leaveContainer}>
        <TouchableOpacity
          style={[styles.leaveButton, { borderColor: '#dc2626' }]}
          onPress={handleLeaveClub}
        >
          <LogOut size={20} color="#dc2626" />
          <Text style={styles.leaveButtonText}>Leave Club</Text>
        </TouchableOpacity>
      </View>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Invite Member</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Email Address</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.icon + '50', backgroundColor: colors.background },
                ]}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="Enter email address"
                placeholderTextColor={colors.icon}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>

            <Text style={[styles.helpText, { color: colors.icon }]}>
              An invitation will be sent to this email. The user will see it in their Invites section.
            </Text>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.tint },
                isInviting && styles.submitButtonDisabled,
              ]}
              onPress={handleInvite}
              disabled={isInviting}
            >
              {isInviting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.submitButtonText, { color: colors.background }]}>
                  Send Invite
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Club Settings</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Timezone Setting */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Timezone</Text>
              <TouchableOpacity
                style={[styles.dropdown, { borderColor: colors.icon + '50' }]}
                onPress={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {TIMEZONES.find((tz) => tz.value === membership.club.preferences.timezone)?.label || membership.club.preferences.timezone}
                </Text>
                <ChevronDown size={20} color={colors.icon} />
              </TouchableOpacity>
              {showTimezoneDropdown && (
                <ScrollView style={[styles.dropdownList, { backgroundColor: colors.background, borderColor: colors.icon + '30' }]}>
                  {TIMEZONES.map((tz) => (
                    <TouchableOpacity
                      key={tz.value}
                      style={[
                        styles.dropdownItem,
                        membership.club.preferences.timezone === tz.value && { backgroundColor: colors.tint + '20' },
                      ]}
                      onPress={() => handleUpdateTimezone(tz.value)}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{tz.label}</Text>
                      {membership.club.preferences.timezone === tz.value && (
                        <Check size={16} color={colors.tint} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Distance Unit Setting */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Distance Unit</Text>
              <TouchableOpacity
                style={[styles.dropdown, { borderColor: colors.icon + '50' }]}
                onPress={() => setShowDistanceDropdown(!showDistanceDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {DISTANCE_UNITS.find((u) => u.value === membership.club.preferences.distanceUnit)?.label}
                </Text>
                <ChevronDown size={20} color={colors.icon} />
              </TouchableOpacity>
              {showDistanceDropdown && (
                <View style={[styles.dropdownList, { backgroundColor: colors.background, borderColor: colors.icon + '30' }]}>
                  {DISTANCE_UNITS.map((unit) => (
                    <TouchableOpacity
                      key={unit.value}
                      style={[
                        styles.dropdownItem,
                        membership.club.preferences.distanceUnit === unit.value && { backgroundColor: colors.tint + '20' },
                      ]}
                      onPress={() => handleUpdateDistanceUnit(unit.value)}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{unit.label}</Text>
                      {membership.club.preferences.distanceUnit === unit.value && (
                        <Check size={16} color={colors.tint} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
  },
  backButtonLarge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  clubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  clubImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  clubImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubStats: {
    flex: 1,
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  adminActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  membersList: {
    gap: 8,
    paddingBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberDetails: {
    marginLeft: 12,
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
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
  },
  inputGroup: {
    gap: 8,
    marginBottom: 16,
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
  helpText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
  },
  dropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 15,
  },
});
