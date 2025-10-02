// api/apiClient.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://your-backend-url.com/api';

class ApiClient {
  constructor() {
    this.baseURL = BASE_URL;
  }

  // Get token from storage
  async getToken() {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // Create headers with authentication
  async createHeaders(customHeaders = {}) {
    const token = await this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Handle response
  async handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 401) {
        // Unauthorized - clear stored data and redirect to login
        await AsyncStorage.multiRemove(['userToken', 'userData']);
        throw new Error('Session expired. Please log in again.');
      }
      
      if (response.status === 403) {
        throw new Error('Access denied. You do not have permission to perform this action.');
      }

      if (response.status === 404) {
        throw new Error('Resource not found.');
      }

      if (response.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }

      throw new Error(data.message || 'An error occurred');
    }

    return data;
  }

  // GET request
  async get(endpoint, customHeaders = {}) {
    try {
      const headers = await this.createHeaders(customHeaders);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('GET request error:', error);
      throw error;
    }
  }

  // POST request
  async post(endpoint, data = {}, customHeaders = {}) {
    try {
      const headers = await this.createHeaders(customHeaders);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('POST request error:', error);
      throw error;
    }
  }

  // PUT request
  async put(endpoint, data = {}, customHeaders = {}) {
    try {
      const headers = await this.createHeaders(customHeaders);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('PUT request error:', error);
      throw error;
    }
  }

  // PATCH request
  async patch(endpoint, data = {}, customHeaders = {}) {
    try {
      const headers = await this.createHeaders(customHeaders);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('PATCH request error:', error);
      throw error;
    }
  }

  // DELETE request
  async delete(endpoint, customHeaders = {}) {
    try {
      const headers = await this.createHeaders(customHeaders);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('DELETE request error:', error);
      throw error;
    }
  }

  // Upload file (multipart/form-data)
  async uploadFile(endpoint, file, additionalData = {}) {
    try {
      const token = await this.getToken();
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Add additional form data
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Don't set Content-Type for FormData, let the browser set it

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  // Download file
  async downloadFile(endpoint) {
    try {
      const headers = await this.createHeaders();
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      return response.blob();
    } catch (error) {
      console.error('File download error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const apiClient = new ApiClient();
export default apiClient;