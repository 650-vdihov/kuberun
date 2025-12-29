import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { apiClient, AuthError } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';

/**
 * Hook that wraps apiClient.fetch with automatic auth error handling
 * Redirects to login on session expiration
 */
export function useApiClient() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleAuthError = useCallback(async (error: AuthError) => {
    if (
      error.code === 'SESSION_EXPIRED' ||
      error.code === 'SESSION_INVALID' ||
      error.code === 'NO_SESSION'
    ) {
      // Clear auth state and redirect to login
      await signOut();
      router.replace('/(auth)/login');
    }
  }, [signOut, router]);

  const fetch = useCallback(async (url: string, options?: RequestInit) => {
    try {
      return await apiClient.fetch(url, options);
    } catch (error) {
      if (error instanceof AuthError) {
        await handleAuthError(error);
      }
      throw error;
    }
  }, [handleAuthError]);

  const get = useCallback(async <T>(url: string): Promise<T> => {
    try {
      return await apiClient.get<T>(url);
    } catch (error) {
      if (error instanceof AuthError) {
        await handleAuthError(error);
      }
      throw error;
    }
  }, [handleAuthError]);

  const post = useCallback(async <T>(url: string, body: unknown): Promise<T> => {
    try {
      return await apiClient.post<T>(url, body);
    } catch (error) {
      if (error instanceof AuthError) {
        await handleAuthError(error);
      }
      throw error;
    }
  }, [handleAuthError]);

  return { fetch, get, post };
}
