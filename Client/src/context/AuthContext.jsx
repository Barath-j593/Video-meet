import { createContext, useContext, useState, useEffect } from 'react';
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  getCurrentUser,
  isAuthenticated as checkAuth,
  verifyToken,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check auth status on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (checkAuth()) {
          const isValid = await verifyToken();
          if (isValid) {
            setUser(getCurrentUser());
          } else {
            logoutApi();
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        logoutApi();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const result = await loginApi({ email, password });
      if (result.success) {
        setUser(result.data.user);
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const result = await registerApi(userData);
      if (result.success) {
        setUser(result.data.user);
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      return { success: false, message };
    }
  };

  const logout = () => {
    logoutApi();
    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
