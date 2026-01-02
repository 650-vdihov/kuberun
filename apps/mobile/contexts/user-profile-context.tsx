import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './auth-context';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export type Gender = 'male' | 'female';

export interface UserProfile {
  id: string;
  userId: string;
  name?: string;
  gender?: Gender;
  height?: string; // in cm
  weight?: string; // in kg
  image?: string; // base64 encoded image
  createdAt: string;
  updatedAt: string;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await apiClient.get<UserProfile>(`${API_BASE_URL}/activity/profile`);
      setProfile(data);
    } catch (err: any) {
      // 404 means profile doesn't exist yet, which is fine
      if (err.message?.includes('404')) {
        setProfile(null);
      } else {
        console.error('Failed to fetch profile:', err);
        setError('Failed to load profile');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Load profile on mount and when auth status changes
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  // Update profile data
  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    try {
      setError(null);
      const updated = await apiClient.post<UserProfile>(`${API_BASE_URL}/activity/profile`, data);
      setProfile(updated);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile');
      throw err;
    }
  }, []);

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        isLoading,
        error,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
