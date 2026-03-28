import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_TOKEN_KEY = 'admin-auth-token';

interface AdminAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
  });

  // Check if token is valid
  const validateToken = useCallback(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      setState({ isAuthenticated: false, isLoading: false });
      return false;
    }

    try {
      const decoded = JSON.parse(atob(token));
      if (decoded.exp && decoded.exp > Date.now()) {
        setState({ isAuthenticated: true, isLoading: false });
        return true;
      }
    } catch {
      // Invalid token
    }

    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setState({ isAuthenticated: false, isLoading: false });
    return false;
  }, []);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { username, password },
      });

      if (error) {
        return { success: false, error: 'Connection error' };
      }

      if (data.error) {
        return { success: false, error: data.error };
      }

      if (data.success && data.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        setState({ isAuthenticated: true, isLoading: false });
        return { success: true };
      }

      return { success: false, error: 'Unknown error' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Connection failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setState({ isAuthenticated: false, isLoading: false });
  };

  return {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    logout,
  };
}
