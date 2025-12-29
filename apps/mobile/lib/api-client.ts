import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const AUTH_STORAGE_KEY = '@kuberun_auth_session';
const JWT_STORAGE_KEY = '@kuberun_jwt_token';

interface StoredSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  session: {
    token: string;  // Session token (long-lived)
    expiresAt: string;
  };
}

interface JwtToken {
  token: string;
  expiresAt: number;  // Unix timestamp
}

/**
 * API Client with automatic JWT management
 * 
 * Flow:
 * 1. User authenticates → gets session token (stored, 7 days)
 * 2. When calling microservices, we get a JWT from /api/auth/token
 * 3. JWT is short-lived (15 min), cached locally
 * 4. When JWT expires, automatically refresh from auth service
 * 5. If session expires, redirect to login
 */
class ApiClient {
  private jwtToken: JwtToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  /**
   * Get a valid JWT token for microservice calls
   * Automatically refreshes if expired
   */
  async getJwtToken(): Promise<string> {
    // Check if we have a valid cached JWT
    if (this.jwtToken && this.jwtToken.expiresAt > Date.now() / 1000 + 60) {
      return this.jwtToken.token;
    }

    // If already refreshing, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Refresh the JWT
    this.refreshPromise = this.refreshJwtToken();
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh JWT token using session token
   */
  private async refreshJwtToken(): Promise<string> {
    const storedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedSession) {
      throw new AuthError('No session found', 'NO_SESSION');
    }

    const session: StoredSession = JSON.parse(storedSession);
    
    // Check if session is expired
    if (new Date(session.session.expiresAt) <= new Date()) {
      await this.clearTokens();
      throw new AuthError('Session expired', 'SESSION_EXPIRED');
    }

    // Get JWT from auth service
    const response = await fetch(`${API_BASE_URL}/auth/api/auth/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.session.token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.clearTokens();
        throw new AuthError('Session invalid', 'SESSION_INVALID');
      }
      throw new Error(`Failed to get JWT: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse JWT to get expiration (JWT format: header.payload.signature)
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    
    this.jwtToken = {
      token: data.token,
      expiresAt: payload.exp,
    };

    // Cache JWT in storage for app restarts
    await AsyncStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(this.jwtToken));

    return data.token;
  }

  /**
   * Make an authenticated request to a microservice
   * Automatically handles JWT refresh and retry on 401
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const jwt = await this.getJwtToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${jwt}`,
      },
    });

    // If token expired, refresh and retry once
    if (response.status === 401) {
      const errorText = await response.text();
      
      // Check if it's a token expiration (not invalid credentials)
      if (errorText.includes('expired') || errorText.includes('Token expired')) {
        // Clear cached JWT and retry
        this.jwtToken = null;
        await AsyncStorage.removeItem(JWT_STORAGE_KEY);
        
        const newJwt = await this.getJwtToken();
        
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newJwt}`,
          },
        });
      }
      
      // Session is invalid, clear everything
      await this.clearTokens();
      throw new AuthError('Authentication failed', 'AUTH_FAILED');
    }

    return response;
  }

  /**
   * Make a GET request
   */
  async get<T>(url: string): Promise<T> {
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Make a POST request
   */
  async post<T>(url: string, body: unknown): Promise<T> {
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Load cached JWT on app start
   */
  async loadCachedJwt(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(JWT_STORAGE_KEY);
      if (cached) {
        const jwt: JwtToken = JSON.parse(cached);
        // Only use if not expired
        if (jwt.expiresAt > Date.now() / 1000 + 60) {
          this.jwtToken = jwt;
        }
      }
    } catch (error) {
      console.error('Failed to load cached JWT:', error);
    }
  }

  /**
   * Clear all tokens (on logout)
   */
  async clearTokens(): Promise<void> {
    this.jwtToken = null;
    await AsyncStorage.removeItem(JWT_STORAGE_KEY);
  }
}

/**
 * Custom error for auth-related issues
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'NO_SESSION' | 'SESSION_EXPIRED' | 'SESSION_INVALID' | 'AUTH_FAILED'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Singleton instance
export const apiClient = new ApiClient();
