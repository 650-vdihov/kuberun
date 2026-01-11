import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { apiClient } from '../lib/api-client';

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
  deleteClub: (clubId: string) => Promise<void>;
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
      await Promise.all([refreshClubs(), refreshInvites()]);
    } catch (error) {
      console.error('Failed to load clubs data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createClub = async (name: string, description: string): Promise<Club> => {
    if (!name.trim()) {
      throw new Error('Club name is required');
    }

    const response = await apiClient.post<Club>('/clubs/clubs', { 
      name: name.trim(), 
      description: description.trim() 
    });

    // Refresh clubs to get updated list
    await refreshClubs();
    
    return response;
  };

  const getClubMembers = async (clubId: string): Promise<ClubMember[]> => {
    const members = await apiClient.get<ClubMember[]>(`/clubs/clubs/${clubId}/members`);
    return members.map(m => ({
      ...m,
      joinedAt: new Date(m.joinedAt),
    }));
  };

  const updateClubPreferences = async (clubId: string, preferences: Partial<ClubPreferences>): Promise<void> => {
    await apiClient.put(`/clubs/clubs/${clubId}/preferences`, { preferences });
    await refreshClubs();
  };

  const deleteClub = async (clubId: string): Promise<void> => {
    await apiClient.delete(`/clubs/clubs/${clubId}`);
    await refreshClubs();
  };

  const leaveClub = async (clubId: string): Promise<void> => {
    await apiClient.delete(`/clubs/clubs/${clubId}/leave`);
    await refreshClubs();
  };

  const inviteToClub = async (clubId: string, email: string): Promise<void> => {
    if (!email.trim() || !email.includes('@')) {
      throw new Error('Valid email is required');
    }
    
    await apiClient.post(`/clubs/clubs/${clubId}/invite`, { email });
  };

  const kickMember = async (clubId: string, memberId: string): Promise<void> => {
    console.log('kickMember called with:', { clubId, memberId });
    try {
      const response = await apiClient.delete(`/clubs/clubs/${clubId}/members/${memberId}`);
      console.log('kickMember response:', response);
      await refreshClubs();
      console.log('Clubs refreshed after kick');
    } catch (error) {
      console.error('Error in kickMember:', error);
      throw error;
    }
  };

  const promoteMember = async (clubId: string, memberId: string): Promise<void> => {
    await apiClient.post(`/clubs/clubs/${clubId}/members/${memberId}/promote`, {});
    await refreshClubs();
  };

  const demoteMember = async (clubId: string, memberId: string): Promise<void> => {
    await apiClient.post(`/clubs/clubs/${clubId}/members/${memberId}/demote`, {});
    await refreshClubs();
  };

  const acceptInvite = async (inviteId: string): Promise<void> => {
    await apiClient.post(`/clubs/invites/${inviteId}/accept`, {});
    await Promise.all([refreshClubs(), refreshInvites()]);
  };

  const declineInvite = async (inviteId: string): Promise<void> => {
    await apiClient.post(`/clubs/invites/${inviteId}/decline`, {});
    await refreshInvites();
  };

  const refreshClubs = async (): Promise<void> => {
    try {
      const memberships = await apiClient.get<ClubMembership[]>('/clubs/clubs');
      const formattedMemberships: ClubMembership[] = memberships.map(m => ({
        club: {
          ...m.club,
          createdAt: new Date(m.club.createdAt),
          updatedAt: new Date(m.club.updatedAt),
        },
        role: m.role,
        joinedAt: new Date(m.joinedAt),
      }));
      setMemberships(formattedMemberships);
    } catch (error) {
      console.error('Failed to refresh clubs:', error);
      throw error;
    }
  };

  const refreshInvites = async (): Promise<void> => {
    try {
      const fetchedInvites = await apiClient.get<any[]>('/clubs/invites');
      setInvites(fetchedInvites.map(item => ({
        id: item.invite.id,
        clubId: item.invite.clubId,
        clubName: item.club.name,
        clubImage: item.club.image,
        invitedByName: 'Admin', // Backend doesn't return this yet
        invitedByEmail: '', // Backend doesn't return this yet
        invitedAt: new Date(item.invite.createdAt),
        status: item.invite.status,
      })));
    } catch (error) {
      console.error('Failed to refresh invites:', error);
      throw error;
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
        deleteClub,
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
