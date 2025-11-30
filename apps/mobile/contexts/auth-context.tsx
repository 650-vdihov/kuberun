import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// TODO: Replace with actual better-auth API base URL
const API_BASE_URL = 'http://localhost:3000/api/auth';

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
    // TODO: Replace with actual better-auth API call
    // const response = await fetch(`${API_BASE_URL}/sign-in/email`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, password }),
    // });
    // const data = await response.json();
    
    // Simulating API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Mock better-auth response - replace with actual API response
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const mockUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 15),
      email: email,
      name: email.split('@')[0],
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    };

    const mockSession: Session = {
      id: 'ses_' + Math.random().toString(36).substring(2, 15),
      userId: mockUser.id,
      token: 'tok_' + Math.random().toString(36).substring(2, 30),
      expiresAt: expiresAt,
      ipAddress: null,
      userAgent: null,
      createdAt: now,
      updatedAt: now,
    };

    const authSession: AuthSession = { user: mockUser, session: mockSession };
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
    setUser(mockUser);
    setSession(mockSession);
  };

  const signUp = async (email: string, password: string, name: string) => {
    // TODO: Replace with actual better-auth API call
    // const response = await fetch(`${API_BASE_URL}/sign-up/email`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, password, name }),
    // });
    // const data = await response.json();
    
    // Simulating API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock validation
    if (!email || !password || !name) {
      throw new Error('All fields are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Mock better-auth response - replace with actual API response
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const mockUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 15),
      email: email,
      name: name,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    };

    const mockSession: Session = {
      id: 'ses_' + Math.random().toString(36).substring(2, 15),
      userId: mockUser.id,
      token: 'tok_' + Math.random().toString(36).substring(2, 30),
      expiresAt: expiresAt,
      ipAddress: null,
      userAgent: null,
      createdAt: now,
      updatedAt: now,
    };

    const authSession: AuthSession = { user: mockUser, session: mockSession };
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
    setUser(mockUser);
    setSession(mockSession);
  };

  const signOut = async () => {
    // TODO: Replace with actual better-auth API call
    // await fetch(`${API_BASE_URL}/sign-out`, {
    //   method: 'POST',
    //   headers: { 
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${session?.token}`,
    //   },
    // });
    
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setSession(null);
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
