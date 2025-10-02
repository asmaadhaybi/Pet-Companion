// utils/ImageManager.js
// Utility class for managing profile images with persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class ImageManager {
  
  /**
   * Save profile image to local storage with user-specific key
   * @param {string} imageUri - The image URI to save
   * @param {string} userEmail - User email for unique storage key
   * @returns {Promise<boolean>} - Success status
   */
  static async saveProfileImage(imageUri, userEmail = 'user') {
    try {
      if (!imageUri || typeof imageUri !== 'string') {
        console.error('Invalid imageUri provided to saveProfileImage');
        return false;
      }

      const storageKey = `profile_image_${userEmail.replace(/[@.]/g, '_')}`;
      await AsyncStorage.setItem(storageKey, imageUri);
      
      console.log(`Profile image saved locally with key: ${storageKey}`);
      return true;
      
    } catch (error) {
      console.error('Error saving profile image:', error);
      return false;
    }
  }

  /**
   * Save server image URL to local storage
   * @param {string} serverUrl - The server URL to save
   * @param {string} userEmail - User email for unique storage key
   * @returns {Promise<boolean>} - Success status
   */
  static async saveServerImageUrl(serverUrl, userEmail = 'user') {
    try {
      if (!serverUrl || typeof serverUrl !== 'string') {
        console.error('Invalid serverUrl provided to saveServerImageUrl');
        return false;
      }

      const storageKey = `profile_image_${userEmail.replace(/[@.]/g, '_')}_server`;
      await AsyncStorage.setItem(storageKey, serverUrl);
      
      console.log(`Server image URL saved locally with key: ${storageKey}`);
      return true;
      
    } catch (error) {
      console.error('Error saving server image URL:', error);
      return false;
    }
  }

  /**
   * Load the best available profile image (server URL first, then local URI)
   * @param {string} userEmail - User email for unique storage key
   * @returns {Promise<string|null>} - The best available image URI/URL or null
   */
  static async loadBestProfileImage(userEmail = 'user') {
    try {
      const cleanEmail = userEmail.replace(/[@.]/g, '_');
      const localKey = `profile_image_${cleanEmail}`;
      const serverKey = `profile_image_${cleanEmail}_server`;
      
      console.log(`Loading best profile image for user: ${userEmail}`);
      
      // Priority 1: Server URL (most recent successful upload)
      const serverUrl = await AsyncStorage.getItem(serverKey);
      if (serverUrl && this.isValidUrl(serverUrl)) {
        console.log('Using server image URL');
        return serverUrl;
      }
      
      // Priority 2: Local image URI
      const localImage = await AsyncStorage.getItem(localKey);
      if (localImage && localImage.length > 0) {
        console.log('Using local image URI');
        return localImage;
      }
      
      console.log('No valid profile image found');
      return null;
      
    } catch (error) {
      console.error('Error loading profile image:', error);
      return null;
    }
  }

  /**
   * Update user data with profile image
   * @param {string} imageUrl - The image URL to update
   * @param {string} userEmail - User email
   * @returns {Promise<boolean>} - Success status
   */
  static async updateUserDataWithImage(imageUrl, userEmail) {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedData = JSON.parse(userData);
        parsedData.profile_picture = imageUrl;
        parsedData.photo = imageUrl;
        
        await AsyncStorage.setItem('userData', JSON.stringify(parsedData));
        console.log('User data updated with new profile image');
        return true;
      }
      return false;
      
    } catch (error) {
      console.error('Error updating user data with image:', error);
      return false;
    }
  }

  /**
   * Remove all stored profile images for a user
   * @param {string} userEmail - User email for unique storage key
   * @returns {Promise<boolean>} - Success status
   */
  static async removeAllProfileImages(userEmail = 'user') {
    try {
      const cleanEmail = userEmail.replace(/[@.]/g, '_');
      const localKey = `profile_image_${cleanEmail}`;
      const serverKey = `profile_image_${cleanEmail}_server`;
      
      await AsyncStorage.multiRemove([localKey, serverKey]);
      
      // Also update user data
      await this.updateUserDataWithImage(null, userEmail);
      
      console.log(`All profile images removed for user: ${userEmail}`);
      return true;
      
    } catch (error) {
      console.error('Error removing profile images:', error);
      return false;
    }
  }

  /**
   * Check if a string is a valid URL
   * @param {string} str - String to check
   * @returns {boolean} - Whether the string is a valid URL
   */
  static isValidUrl(str) {
    if (!str || typeof str !== 'string') return false;
    return str.startsWith('http://') || str.startsWith('https://');
  }

  /**
   * Check if a file URI exists and is accessible
   * @param {string} uri - File URI to check
   * @returns {Promise<boolean>} - Whether the file exists
   */
  static async checkFileExists(uri) {
    try {
      if (!uri || typeof uri !== 'string') return false;
      
      // For HTTP URLs, assume they exist (could be enhanced with a HEAD request)
      if (this.isValidUrl(uri)) {
        return true;
      }
      
      // For local files, you could use react-native-fs to check existence
      // For now, assume local URIs exist
      return true;
      
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Get image dimensions from URI (useful for validation)
   * @param {string} uri - Image URI
   * @returns {Promise<{width: number, height: number}|null>}
   */
  static async getImageDimensions(uri) {
    return new Promise((resolve) => {
      if (!uri || typeof uri !== 'string') {
        resolve(null);
        return;
      }

      const Image = require('react-native').Image;
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => {
          console.warn('Failed to get image dimensions:', error);
          resolve(null);
        }
      );
    });
  }

  /**
   * Create a storage key from user email
   * @param {string} userEmail - User email
   * @param {boolean} isServerKey - Whether this is for server URL storage
   * @returns {string} - The storage key
   */
  static createStorageKey(userEmail = 'user', isServerKey = false) {
    const cleanEmail = userEmail.replace(/[@.]/g, '_');
    const baseKey = `profile_image_${cleanEmail}`;
    return isServerKey ? `${baseKey}_server` : baseKey;
  }

  /**
   * Migrate old profile image keys to new format (for app updates)
   * @param {string} userEmail - User email
   * @returns {Promise<boolean>} - Success status
   */
  static async migrateOldImageKeys(userEmail) {
    try {
      // Check for old keys and migrate them
      const oldKeys = ['profileImage', 'profile_image', 'userProfileImage'];
      const newKey = this.createStorageKey(userEmail);
      const newServerKey = this.createStorageKey(userEmail, true);
      
      for (const oldKey of oldKeys) {
        const oldValue = await AsyncStorage.getItem(oldKey);
        if (oldValue) {
          console.log(`Migrating old key ${oldKey} to ${newKey}`);
          
          if (this.isValidUrl(oldValue)) {
            await AsyncStorage.setItem(newServerKey, oldValue);
          } else {
            await AsyncStorage.setItem(newKey, oldValue);
          }
          
          // Remove old key
          await AsyncStorage.removeItem(oldKey);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error migrating old image keys:', error);
      return false;
    }
  }

  /**
   * Get all stored profile images for debugging
   * @param {string} userEmail - User email
   * @returns {Promise<{local: string|null, server: string|null}>}
   */
  static async getAllStoredImages(userEmail = 'user') {
    try {
      const localKey = this.createStorageKey(userEmail);
      const serverKey = this.createStorageKey(userEmail, true);
      
      const local = await AsyncStorage.getItem(localKey);
      const server = await AsyncStorage.getItem(serverKey);
      
      return { local, server };
    } catch (error) {
      console.error('Error getting all stored images:', error);
      return { local: null, server: null };
    }
  }

  /**
   * Clean up orphaned profile images (images without corresponding users)
   * @returns {Promise<number>} - Number of cleaned up items
   */
  static async cleanupOrphanedImages() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const profileImageKeys = allKeys.filter(key => key.startsWith('profile_image_'));
      
      let cleanedCount = 0;
      
      // Get current user data to preserve active user's images
      const userData = await AsyncStorage.getItem('userData');
      let currentUserEmail = null;
      if (userData) {
        const parsedData = JSON.parse(userData);
        currentUserEmail = parsedData.email;
      }
      
      for (const key of profileImageKeys) {
        // Skip current user's images
        if (currentUserEmail && key.includes(currentUserEmail.replace(/[@.]/g, '_'))) {
          continue;
        }
        
        // Check if this key has a corresponding user
        const emailMatch = key.match(/profile_image_([^_]+(?:_[^_]+)*)/);
        if (emailMatch) {
          const extractedEmail = emailMatch[1].replace(/_/g, '.');
          
          // If this doesn't look like the current user's email, it might be orphaned
          // You could add more sophisticated logic here to check against a list of known users
          console.log(`Found potentially orphaned image key: ${key}`);
          // For safety, don't auto-delete - just log for now
          // await AsyncStorage.removeItem(key);
          // cleanedCount++;
        }
      }
      
      console.log(`Cleanup scan completed. Found ${profileImageKeys.length} profile image keys.`);
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up orphaned images:', error);
      return 0;
    }
  }

  /**
   * Compress image URI if needed (placeholder for future implementation)
   * @param {string} imageUri - Original image URI
   * @param {number} quality - Compression quality (0-1)
   * @returns {Promise<string>} - Compressed image URI
   */
  static async compressImage(imageUri, quality = 0.8) {
    try {
      // This is a placeholder - you could integrate with libraries like
      // react-native-image-resizer or react-native-image-crop-picker
      console.log('Image compression placeholder - returning original URI');
      return imageUri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return imageUri;
    }
  }

  /**
   * Validate image file size and dimensions
   * @param {string} imageUri - Image URI to validate
   * @param {Object} constraints - Validation constraints
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  static async validateImage(imageUri, constraints = {}) {
    const {
      maxWidth = 2000,
      maxHeight = 2000,
      minWidth = 100,
      minHeight = 100,
      maxSizeBytes = 5 * 1024 * 1024, // 5MB
    } = constraints;
    
    const errors = [];
    
    try {
      // Check dimensions
      const dimensions = await this.getImageDimensions(imageUri);
      if (dimensions) {
        if (dimensions.width > maxWidth) {
          errors.push(`Image width (${dimensions.width}px) exceeds maximum (${maxWidth}px)`);
        }
        if (dimensions.height > maxHeight) {
          errors.push(`Image height (${dimensions.height}px) exceeds maximum (${maxHeight}px)`);
        }
        if (dimensions.width < minWidth) {
          errors.push(`Image width (${dimensions.width}px) below minimum (${minWidth}px)`);
        }
        if (dimensions.height < minHeight) {
          errors.push(`Image height (${dimensions.height}px) below minimum (${minHeight}px)`);
        }
      }
      
      // File size validation would require additional libraries
      // This is a placeholder for future implementation
      
      return {
        valid: errors.length === 0,
        errors
      };
      
    } catch (error) {
      console.error('Error validating image:', error);
      return {
        valid: false,
        errors: ['Failed to validate image']
      };
    }
  }
}

export default ImageManager;