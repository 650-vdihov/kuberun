import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// better-auth User type (matches Drizzle schema)
interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// better-auth Session type (matches Drizzle schema)
interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Combined auth state from better-auth
interface AuthSession {
  user: User;
  session: Session;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '@kuberun_auth_session';

// API Gateway base URL from environment variable
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from storage on app start
  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const storedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (storedSession) {
        const authSession: AuthSession = JSON.parse(storedSession);
        // Check if session is expired
        if (new Date(authSession.session.expiresAt) > new Date()) {
          setUser(authSession.user);
          setSession(authSession.session);
        } else {
          // Session expired, clear storage
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load stored session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Sign in failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // better-auth returns { token, user }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        emailVerified: data.user.emailVerified,
        image: data.user.image,
        createdAt: new Date(data.user.createdAt),
        updatedAt: new Date(data.user.updatedAt),
      };

      const session: Session = {
        id: data.token,
        userId: user.id,
        token: data.token,
        expiresAt: expiresAt,
        ipAddress: null,
        userAgent: null,
        createdAt: now,
        updatedAt: now,
      };

      const authSession: AuthSession = { user, session };
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
      setUser(user);
      setSession(session);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Sign up failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // better-auth returns { token, user }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        emailVerified: data.user.emailVerified,
        image: data.user.image,
        createdAt: new Date(data.user.createdAt),
        updatedAt: new Date(data.user.updatedAt),
      };

      const session: Session = {
        id: data.token, // Use token as session id
        userId: user.id,
        token: data.token,
        expiresAt: expiresAt,
        ipAddress: null,
        userAgent: null,
        createdAt: now,
        updatedAt: now,
      };

      const authSession: AuthSession = { user, session };
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
      setUser(user);
      setSession(session);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      if (session?.token) {
        await fetch(`${API_BASE_URL}/auth/api/auth/sign-out`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user && !!session,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
