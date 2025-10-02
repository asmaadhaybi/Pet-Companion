// hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthService from '../api/authService';

// Create Auth Context
const AuthContext = createContext({});

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const token = await AuthService.getToken();
      const userData = await AuthService.getUserData();

      if (token && userData) {
        // Verify token is still valid
        const isValid = await AuthService.isAuthenticated();
        if (isValid) {
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // Token expired, clear storage
          await AuthService.logout();
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth state check error:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await AuthService.login(credentials);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await AuthService.register(userData);
      // Don't auto-login after registration, let user verify email first
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Force local logout even if server logout fails
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    AuthService.setUserData(userData);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
    checkAuthState,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook for login functionality
export const useLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuth();

  const handleLogin = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      const response = await login(credentials);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    login: handleLogin,
    loading,
    error,
    setError,
  };
};

// Hook for registration functionality
export const useRegister = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { register } = useAuth();

  const handleRegister = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await register(userData);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    register: handleRegister,
    loading,
    error,
    setError,
  };
};

// Hook for profile management
export const useProfile = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { updateUser } = useAuth();

  const updateProfile = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await AuthService.updateProfile(userData);
      updateUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      setError(null);
      const response = await AuthService.changePassword(currentPassword, newPassword);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    updateProfile,
    changePassword,
    loading,
    error,
    setError,
  };
};