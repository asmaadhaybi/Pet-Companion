// api/authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your actual backend URL
const BASE_URL = 'https://your-backend-url.com/api';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'userToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  DEVICE_ID: 'deviceId',
  LAST_LOGIN: 'lastLogin',
};

class AuthService {
  constructor() {
    this.baseURL = BASE_URL;
    this.tokenRefreshPromise = null;
  }

  // ==================== STORAGE METHODS ====================

  // Get stored token
  static async getToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // Store token
  static async setToken(token) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  // Remove token
  static async removeToken() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  // Get refresh token
  static async getRefreshToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  // Store refresh token
  static async setRefreshToken(refreshToken) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  // Remove refresh token
  static async removeRefreshToken() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error removing refresh token:', error);
    }
  }

  // Get user data
  static async getUserData() {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  // Store user data
  static async setUserData(userData) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  }

  // Remove user data
  static async removeUserData() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.error('Error removing user data:', error);
    }
  }

  // Clear all auth data
  static async clearAuthData() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.LAST_LOGIN,
      ]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  // ==================== HTTP REQUEST HELPER ====================

  // Make authenticated request
  static async makeAuthenticatedRequest(endpoint, options = {}) {
    const token = await this.getToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const requestOptions = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, requestOptions);
      
      // Handle token expiration
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry request with new token
          const newToken = await this.getToken();
          requestOptions.headers['Authorization'] = `Bearer ${newToken}`;
          return await fetch(`${BASE_URL}${endpoint}`, requestOptions);
        } else {
          // Refresh failed, user needs to login again
          await this.clearAuthData();
          throw new Error('Session expired. Please log in again.');
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP Error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // ==================== AUTHENTICATION METHODS ====================

  // Login function
  static async login(credentials) {
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentials,
          deviceId: await this.getDeviceId(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store tokens and user data
      if (data.token || data.accessToken) {
        await this.setToken(data.token || data.accessToken);
      }
      
      if (data.refreshToken) {
        await this.setRefreshToken(data.refreshToken);
      }
      
      if (data.user) {
        await this.setUserData(data.user);
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register function
  static async register(userData) {
    try {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...userData,
          deviceId: await this.getDeviceId(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Optionally auto-login after registration
      if (data.autoLogin && data.token) {
        await this.setToken(data.token);
        if (data.refreshToken) {
          await this.setRefreshToken(data.refreshToken);
        }
        if (data.user) {
          await this.setUserData(data.user);
        }
      }

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Logout function
  static async logout() {
    try {
      const token = await this.getToken();
      
      if (token) {
        // Call logout endpoint to invalidate token on server
        try {
          await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              deviceId: await this.getDeviceId(),
            }),
          });
        } catch (error) {
          console.warn('Server logout failed:', error);
          // Continue with local logout even if server logout fails
        }
      }

      // Clear all stored auth data
      await this.clearAuthData();
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Force local logout even on error
      await this.clearAuthData();
      throw error;
    }
  }

  // Refresh token
  static async refreshToken() {
    try {
      // Prevent multiple simultaneous refresh attempts
      if (this.tokenRefreshPromise) {
        return await this.tokenRefreshPromise;
      }

      this.tokenRefreshPromise = this._performTokenRefresh();
      const result = await this.tokenRefreshPromise;
      this.tokenRefreshPromise = null;
      
      return result;
    } catch (error) {
      this.tokenRefreshPromise = null;
      throw error;
    }
  }

  // Internal token refresh method
  static async _performTokenRefresh() {
    try {
      const refreshToken = await this.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token found');
      }

      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
          deviceId: await this.getDeviceId(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Token refresh failed');
      }

      // Store new tokens
      if (data.token || data.accessToken) {
        await this.setToken(data.token || data.accessToken);
      }
      
      if (data.refreshToken) {
        await this.setRefreshToken(data.refreshToken);
      }

      if (data.user) {
        await this.setUserData(data.user);
      }

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      // Clear invalid tokens
      await this.clearAuthData();
      return false;
    }
  }

  // ==================== PASSWORD MANAGEMENT ====================

  // Forgot password
  static async forgotPassword(email) {
    try {
      const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      return data;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  // Reset password
  static async resetPassword(token, newPassword) {
    try {
      const response = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token, 
          password: newPassword,
          deviceId: await this.getDeviceId(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset failed');
      }

      return data;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  // Change password (authenticated user)
  static async changePassword(currentPassword, newPassword) {
    try {
      return await this.makeAuthenticatedRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ 
          currentPassword, 
          newPassword 
        }),
      });
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  // ==================== EMAIL VERIFICATION ====================

  // Verify email
  static async verifyEmail(token) {
    try {
      const response = await fetch(`${BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Email verification failed');
      }

      // Update user data if email verification was successful
      if (data.user) {
        await this.setUserData(data.user);
      }

      return data;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  // Resend verification email
  static async resendVerificationEmail() {
    try {
      return await this.makeAuthenticatedRequest('/auth/resend-verification', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      throw error;
    }
  }

  // ==================== USER PROFILE MANAGEMENT ====================

  // Check if user is authenticated
  static async isAuthenticated() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        return false;
      }

      // Verify token with server
      try {
        await this.makeAuthenticatedRequest('/auth/verify-token', {
          method: 'GET',
        });
        return true;
      } catch (error) {
        // If verification fails, try to refresh token
        return await this.refreshToken();
      }
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }

  // Get current user profile
  static async getCurrentUser() {
    try {
      const data = await this.makeAuthenticatedRequest('/auth/me', {
        method: 'GET',
      });

      // Update stored user data
      if (data.user) {
        await this.setUserData(data.user);
      }

      return data;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  // Update user profile
  static async updateProfile(userData) {
    try {
      const data = await this.makeAuthenticatedRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(userData),
      });

      // Update stored user data
      if (data.user) {
        await this.setUserData(data.user);
      }

      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  // Upload profile picture
  static async uploadProfilePicture(imageUri) {
    try {
      const token = await this.getToken();
      
      if (!token) {
        throw new Error('No token found');
      }

      const formData = new FormData();
      formData.append('profilePicture', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      const response = await fetch(`${BASE_URL}/auth/upload-profile-picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile picture upload failed');
      }

      // Update stored user data
      if (data.user) {
        await this.setUserData(data.user);
      }

      return data;
    } catch (error) {
      console.error('Upload profile picture error:', error);
      throw error;
    }
  }

  // ==================== DEVICE & SESSION MANAGEMENT ====================

  // Get or generate device ID
  static async getDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      
      if (!deviceId) {
        // Generate a simple device ID (you might want to use a more robust solution)
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return null;
    }
  }

  // Get active sessions
  static async getActiveSessions() {
    try {
      return await this.makeAuthenticatedRequest('/auth/sessions', {
        method: 'GET',
      });
    } catch (error) {
      console.error('Get active sessions error:', error);
      throw error;
    }
  }

  // Terminate session
  static async terminateSession(sessionId) {
    try {
      return await this.makeAuthenticatedRequest(`/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Terminate session error:', error);
      throw error;
    }
  }

  // Terminate all other sessions
  static async terminateAllOtherSessions() {
    try {
      return await this.makeAuthenticatedRequest('/auth/sessions/terminate-others', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Terminate all sessions error:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  // Check if token is expired (client-side check)
  static async isTokenExpired() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        return true;
      }

      // Decode JWT token (basic check - you might want to use a JWT library)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true;
      }

      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Token expiration check error:', error);
      return true;
    }
  }

  // Get last login time
  static async getLastLoginTime() {
    try {
      const lastLogin = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOGIN);
      return lastLogin ? new Date(lastLogin) : null;
    } catch (error) {
      console.error('Error getting last login time:', error);
      return null;
    }
  }

  // Check if user has been authenticated before
  static async hasUserLoggedInBefore() {
    try {
      const lastLogin = await this.getLastLoginTime();
      return lastLogin !== null;
    } catch (error) {
      console.error('Error checking previous login:', error);
      return false;
    }
  }

  // ==================== TWO-FACTOR AUTHENTICATION ====================

  // Enable 2FA
  static async enableTwoFactorAuth() {
    try {
      return await this.makeAuthenticatedRequest('/auth/2fa/enable', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Enable 2FA error:', error);
      throw error;
    }
  }

  // Verify 2FA setup
  static async verifyTwoFactorSetup(code) {
    try {
      return await this.makeAuthenticatedRequest('/auth/2fa/verify-setup', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    } catch (error) {
      console.error('Verify 2FA setup error:', error);
      throw error;
    }
  }

  // Disable 2FA
  static async disableTwoFactorAuth(code) {
    try {
      return await this.makeAuthenticatedRequest('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    } catch (error) {
      console.error('Disable 2FA error:', error);
      throw error;
    }
  }

  // Verify 2FA code during login
  static async verifyTwoFactorCode(tempToken, code) {
    try {
      const response = await fetch(`${BASE_URL}/auth/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tempToken, 
          code,
          deviceId: await this.getDeviceId(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '2FA verification failed');
      }

      // Store tokens after successful 2FA
      if (data.token) {
        await this.setToken(data.token);
      }
      
      if (data.refreshToken) {
        await this.setRefreshToken(data.refreshToken);
      }
      
      if (data.user) {
        await this.setUserData(data.user);
      }

      return data;
    } catch (error) {
      console.error('2FA verification error:', error);
      throw error;
    }
  }
}

export default AuthService;