import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth-context';

// Club preferences
export interface ClubPreferences {
  timezone: string;
  distanceUnit: 'km' | 'mi';
}

// Club member with role
export interface ClubMember {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: 'admin' | 'member';
  joinedAt: Date;
}

// Club type
export interface Club {
  id: string;
  name: string;
  description: string;
  image: string | null;
  preferences: ClubPreferences;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  memberCount: number;
}

// User's membership in a club
export interface ClubMembership {
  club: Club;
  role: 'admin' | 'member';
  joinedAt: Date;
}

// Club invite
export interface ClubInvite {
  id: string;
  clubId: string;
  clubName: string;
  clubImage: string | null;
  invitedByName: string;
  invitedByEmail: string;
  invitedAt: Date;
  status: 'pending' | 'accepted' | 'declined';
}

interface ClubsContextType {
  memberships: ClubMembership[];
  invites: ClubInvite[];
  isLoading: boolean;
  // Club actions
  createClub: (name: string, description: string) => Promise<Club>;
  getClubMembers: (clubId: string) => Promise<ClubMember[]>;
  updateClubPreferences: (clubId: string, preferences: Partial<ClubPreferences>) => Promise<void>;
  leaveClub: (clubId: string) => Promise<void>;
  // Admin actions
  inviteToClub: (clubId: string, email: string) => Promise<void>;
  kickMember: (clubId: string, memberId: string) => Promise<void>;
  promoteMember: (clubId: string, memberId: string) => Promise<void>;
  demoteMember: (clubId: string, memberId: string) => Promise<void>;
  // Invite actions
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  // Refresh data
  refreshClubs: () => Promise<void>;
  refreshInvites: () => Promise<void>;
}

const ClubsContext = createContext<ClubsContextType | undefined>(undefined);

const CLUBS_STORAGE_KEY = '@kuberun_clubs';
const INVITES_STORAGE_KEY = '@kuberun_invites';

// TODO: Replace with actual API base URL
const API_BASE_URL = 'http://localhost:3000/api';

export function ClubsProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<ClubMembership[]>([]);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  // Load data on mount and when auth changes
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setMemberships([]);
      setInvites([]);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadStoredClubs(), loadStoredInvites()]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStoredClubs = async () => {
    try {
      const stored = await AsyncStorage.getItem(CLUBS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setMemberships(data.map((m: any) => ({
          ...m,
          joinedAt: new Date(m.joinedAt),
          club: {
            ...m.club,
            createdAt: new Date(m.club.createdAt),
            updatedAt: new Date(m.club.updatedAt),
          }
        })));
      }
    } catch (error) {
      console.error('Failed to load stored clubs:', error);
    }
  };

  const loadStoredInvites = async () => {
    try {
      const stored = await AsyncStorage.getItem(INVITES_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setInvites(data.map((i: any) => ({
          ...i,
          invitedAt: new Date(i.invitedAt),
        })));
      }
    } catch (error) {
      console.error('Failed to load stored invites:', error);
    }
  };

  const saveMemberships = async (data: ClubMembership[]) => {
    await AsyncStorage.setItem(CLUBS_STORAGE_KEY, JSON.stringify(data));
    setMemberships(data);
  };

  const saveInvites = async (data: ClubInvite[]) => {
    await AsyncStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(data));
    setInvites(data);
  };

  const createClub = async (name: string, description: string): Promise<Club> => {
    // TODO: Replace with actual API call
    // const response = await fetch(`${API_BASE_URL}/clubs`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ name, description }),
    // });

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!name.trim()) {
      throw new Error('Club name is required');
    }

    const now = new Date();
    const newClub: Club = {
      id: 'club_' + Math.random().toString(36).substring(2, 15),
      name: name.trim(),
      description: description.trim(),
      image: null,
      preferences: {
        timezone: 'UTC',
        distanceUnit: 'km',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: user?.id ?? '',
      memberCount: 1,
    };

    const newMembership: ClubMembership = {
      club: newClub,
      role: 'admin',
      joinedAt: now,
    };

    await saveMemberships([...memberships, newMembership]);
    return newClub;
  };

  const getClubMembers = async (clubId: string): Promise<ClubMember[]> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock members for now - current user is always included
    const mockMembers: ClubMember[] = [
      {
        id: user?.id ?? 'mock-user',
        email: user?.email ?? 'you@example.com',
        name: user?.name ?? 'You',
        image: user?.image ?? null,
        role: 'admin',
        joinedAt: new Date(),
      },
      {
        id: 'admin_1',
        email: 'sarah@example.com',
        name: 'Sarah Admin',
        image: 'https://i.pravatar.cc/150?img=5',
        role: 'admin',
        joinedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'member_1',
        email: 'john@example.com',
        name: 'John Doe',
        image: 'https://i.pravatar.cc/150?img=2',
        role: 'member',
        joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'member_2',
        email: 'jane@example.com',
        name: 'Jane Smith',
        image: 'https://i.pravatar.cc/150?img=3',
        role: 'member',
        joinedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ];

    return mockMembers;
  };

  const updateClubPreferences = async (clubId: string, preferences: Partial<ClubPreferences>): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedMemberships = memberships.map((m) => {
      if (m.club.id === clubId) {
        return {
          ...m,
          club: {
            ...m.club,
            preferences: { ...m.club.preferences, ...preferences },
            updatedAt: new Date(),
          },
        };
      }
      return m;
    });

    await saveMemberships(updatedMemberships);
  };

  const leaveClub = async (clubId: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedMemberships = memberships.filter((m) => m.club.id !== clubId);
    await saveMemberships(updatedMemberships);
  };

  const inviteToClub = async (clubId: string, email: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!email.trim() || !email.includes('@')) {
      throw new Error('Valid email is required');
    }

    // In a real app, this would send an invite to the user's account
    console.log(`Invite sent to ${email} for club ${clubId}`);
  };

  const kickMember = async (clubId: string, memberId: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Update member count in local state
    const updatedMemberships = memberships.map((m) => {
      if (m.club.id === clubId) {
        return {
          ...m,
          club: {
            ...m.club,
            memberCount: Math.max(1, m.club.memberCount - 1),
          },
        };
      }
      return m;
    });

    await saveMemberships(updatedMemberships);
  };

  const promoteMember = async (clubId: string, memberId: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log(`Promoted member ${memberId} to admin in club ${clubId}`);
  };

  const demoteMember = async (clubId: string, memberId: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log(`Demoted member ${memberId} to member in club ${clubId}`);
  };

  const acceptInvite = async (inviteId: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    const invite = invites.find((i) => i.id === inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    // Create new membership
    const now = new Date();
    const newMembership: ClubMembership = {
      club: {
        id: invite.clubId,
        name: invite.clubName,
        description: '',
        image: invite.clubImage,
        preferences: {
          timezone: 'UTC',
          distanceUnit: 'km',
        },
        createdAt: now,
        updatedAt: now,
        createdBy: '',
        memberCount: 1,
      },
      role: 'member',
      joinedAt: now,
    };

    // Remove invite and add membership
    const updatedInvites = invites.filter((i) => i.id !== inviteId);
    await saveInvites(updatedInvites);
    await saveMemberships([...memberships, newMembership]);
  };

  const declineInvite = async (inviteId: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedInvites = invites.filter((i) => i.id !== inviteId);
    await saveInvites(updatedInvites);
  };

  const refreshClubs = async (): Promise<void> => {
    // TODO: Replace with actual API call to fetch clubs
    await loadStoredClubs();
  };

  const refreshInvites = async (): Promise<void> => {
    // TODO: Replace with actual API call to fetch invites
    // For demo, add a mock invite if none exist
    if (invites.length === 0) {
      const mockInvite: ClubInvite = {
        id: 'inv_' + Math.random().toString(36).substring(2, 15),
        clubId: 'club_demo',
        clubName: 'Running Enthusiasts',
        clubImage: null,
        invitedByName: 'Demo User',
        invitedByEmail: 'demo@example.com',
        invitedAt: new Date(),
        status: 'pending',
      };
      await saveInvites([mockInvite]);
    } else {
      await loadStoredInvites();
    }
  };

  return (
    <ClubsContext.Provider
      value={{
        memberships,
        invites,
        isLoading,
        createClub,
        getClubMembers,
        updateClubPreferences,
        leaveClub,
        inviteToClub,
        kickMember,
        promoteMember,
        demoteMember,
        acceptInvite,
        declineInvite,
        refreshClubs,
        refreshInvites,
      }}
    >
      {children}
    </ClubsContext.Provider>
  );
}

export function useClubs() {
  const context = useContext(ClubsContext);
  if (context === undefined) {
    throw new Error('useClubs must be used within a ClubsProvider');
  }
  return context;
}
