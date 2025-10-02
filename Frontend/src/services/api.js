// services/ApiService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL configuration - Update this to match your server
const API_BASE_URL = 'http://192.168.2.224:8000/api';
//const API_BASE_URL = 'http://10.0.2.2:8000/api'
class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
  }
  // ---------------------
  // TOKEN MANAGEMENT
  // ---------------------
  async getToken() {
    if (!this.token) {
      try {
        this.token = await AsyncStorage.getItem('token');
      } catch (error) {
        console.error('Error getting token:', error);
        return null;
      }
    }
    return this.token;
  }

  async setToken(token) {
    this.token = token;
    try {
      await AsyncStorage.setItem('token', token);
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  async clearToken() {
    this.token = null;
    try {
      await AsyncStorage.removeItem('token');
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  // Legacy method for compatibility
  static async getAuthToken() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        return user.token;
      }
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // ---------------------
  // CORE REQUEST METHOD
  // ---------------------

  async makeRequest(endpoint, options = {}) {
    const token = await this.getToken();

    const defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config = {
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      ...options,
    };

    try {
      console.log(`Making ${config.method || 'GET'} request to: ${this.baseURL}${endpoint}`);
      console.log('Request headers:', config.headers);
      if (config.body) {
        console.log('Request body:', config.body);
      }
      
      const response = await fetch(`${this.baseURL}${endpoint}`, config);

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Get response text first
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      let data = null;
      
      // Try to parse JSON only if we have content
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
          console.log('Parsed response data:', data);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.error('Response text was:', responseText);
          
          return {
            success: false,
            error: `Server returned invalid JSON response. Status: ${response.status}`,
            rawResponse: responseText,
            status: response.status
          };
        }
      } else {
        console.log('Empty response body');
        data = {};
      }

      // Handle token expiry
      if (response.status === 401) {
        await this.clearToken();
        await this.clearAuthData();
      }
      

      // Handle error status codes
      if (!response.ok) {
        const errorMessage = data?.message || 
                             data?.error || 
                             data?.errors || 
                             `HTTP ${response.status}: ${response.statusText}`;
        
        console.error('HTTP error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          errorMessage: errorMessage
        });

        return {
          success: false,
          error: errorMessage,
          status: response.status,
          data: data
        };
      }

      // Success case
      console.log('Request successful, returning data:', data);
      return { success: true, data, status: response.status };
      
    } catch (error) {
      console.error('Network/Request error:', {
        message: error.message,
        name: error.name,
        endpoint,
        method: config.method || 'GET'
      });
      
      // Handle different types of network errors
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        return { 
          success: false, 
          error: 'Cannot connect to server. Please check your network connection and ensure the server is running.',
          networkError: true
        };
      }
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout. Please try again.',
          timeoutError: true
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'An unexpected error occurred',
        originalError: error
      };
    }
  }

  // Form request method for handling FormData (file uploads)
  async makeFormRequest(endpoint, options = {}, isFormData = false) {
    const token = await this.getToken();

    const defaultHeaders = {
      Accept: 'application/json',
    };

    // Only set Content-Type for non-FormData requests
    if (!isFormData) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config = {
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      ...options,
    };

    try {
      console.log(`Making ${config.method || 'GET'} form request to: ${this.baseURL}${endpoint}`);
      console.log('Request headers:', config.headers);
      if (config.body && !isFormData) {
        console.log('Request body:', config.body);
      } else if (isFormData) {
        console.log('Request body: FormData (file upload)');
      }
      
      const response = await fetch(`${this.baseURL}${endpoint}`, config);

      console.log('Response status:', response.status);

      // Get response text first
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      let data = null;
      
      // Try to parse JSON only if we have content
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
          console.log('Parsed response data:', data);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.error('Response text was:', responseText);
          
          return {
            success: false,
            error: `Server returned invalid JSON response. Status: ${response.status}`,
            rawResponse: responseText,
            status: response.status
          };
        }
      } else {
        console.log('Empty response body');
        data = {};
      }

      // Handle token expiry
      if (response.status === 401) {
        await this.clearToken();
        await this.clearAuthData();
      }

      // Handle error status codes
      if (!response.ok) {
        const errorMessage = data?.message || 
                             data?.error || 
                             data?.errors || 
                             `HTTP ${response.status}: ${response.statusText}`;
        
        console.error('HTTP error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          errorMessage: errorMessage
        });

        return {
          success: false,
          error: errorMessage,
          status: response.status,
          data: data,
          errors: data?.errors // Include validation errors
        };
      }

      // Success case
      console.log('Form request successful, returning data:', data);
      return { success: true, data, status: response.status };
      
    } catch (error) {
      console.error('Network/Request error:', {
        message: error.message,
        name: error.name,
        endpoint,
        method: config.method || 'GET'
      });
      
      // Handle different types of network errors
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        return { 
          success: false, 
          error: 'Cannot connect to server. Please check your network connection and ensure the server is running.',
          networkError: true
        };
      }
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout. Please try again.',
          timeoutError: true
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'An unexpected error occurred',
        originalError: error
      };
    }
  }

  // Static method for legacy compatibility
  static async makeRequest(endpoint, options = {}) {
    const instance = new ApiService();
    return instance.makeRequest(endpoint, options);
  }

  // ---------------------
  // AUTHENTICATION METHODS
  // ---------------------

  async register(userData) {
    // Validate input data
    if (!userData.name || !userData.email || !userData.password) {
      return {
        success: false,
        error: 'Name, email, and password are required'
      };
    }

    // Prepare data to match Laravel backend expectations
    const requestData = {
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
      password_confirmation: userData.password_confirmation || userData.password,
      role: userData.role || 'user'
    };

    console.log('Register request data:', { ...requestData, password: '[HIDDEN]', password_confirmation: '[HIDDEN]' });

    const result = await this.makeRequest('/register', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    if (!result.success) {
      // Handle specific HTTP status codes
      if (result.status === 422) {
        const validationErrors = result.data?.errors || {};
        const firstError = Object.values(validationErrors)[0];
        return {
          success: false,
          error: Array.isArray(firstError) ? firstError[0] : (firstError || 'Validation failed'),
          validationErrors: validationErrors
        };
      }
      
      return result;
    }

    // Handle successful response
    const responseData = result.data;

    // Store auth data if successful
    if (responseData.authorisation?.token || responseData.token) {
      const token = responseData.authorisation?.token || responseData.token;
      await this.setToken(token);
      
      if (responseData.user) {
        await this.storeUserData(responseData.user);
      }

      return {
        success: true,
        data: {
          token: token,
          user: responseData.user,
          message: responseData.message || 'Registration successful'
        }
      };
    }

    return {
      success: false,
      error: 'Invalid response format from server'
    };
  }

  async login(credentials) {
    // Validate input
    if (!credentials.email || !credentials.password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }

    const requestData = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password
    };

    console.log('Login request data:', { ...requestData, password: '[HIDDEN]' });

    const result = await this.makeRequest('/login', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    if (!result.success) {
      // Handle specific HTTP status codes
      if (result.status === 401) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }
      
      if (result.status === 422) {
        const validationErrors = result.data?.errors || {};
        const firstError = Object.values(validationErrors)[0];
        return {
          success: false,
          error: Array.isArray(firstError) ? firstError[0] : (firstError || 'Validation failed')
        };
      }

      return result;
    }

    // Handle successful response
    const responseData = result.data;

    // Store auth data if successful
    if (responseData.authorisation?.token || responseData.token) {
      const token = responseData.authorisation?.token || responseData.token;
      await this.setToken(token);
      
      if (responseData.user) {
        await this.storeUserData(responseData.user);
      }

      return {
        success: true,
        data: {
          token: token,
          user: responseData.user,
          message: responseData.message || 'Login successful'
        }
      };
    }

    return {
      success: false,
      error: 'Invalid response format from server'
    };
  }

  async logout() {
    const result = await this.makeRequest('/logout', { method: 'POST' });

    // Clear local storage regardless of server response
    await this.clearAuthData();

    return { success: true, message: 'Logged out successfully' };
  }

  async getMe() {
    const result = await this.makeRequest('/me');
    
    if (result.success && result.data?.user) {
      await this.storeUserData(result.data.user);
    }
    
    return result;
  }

  async getProfile() {
    const result = await this.makeRequest('/profile');
    
    if (result.success && result.data?.user) {
      await this.storeUserData(result.data.user);
    }
    
    return result;
  }

  async getUserProfile() {
    return this.getProfile();
  }

  async updateUserProfile(profileData) {
    const result = await this.makeRequest('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    
    if (result.success && result.data?.user) {
      await this.storeUserData(result.data.user);
    }
    
    return result;
  }

  async refreshToken() {
    const result = await this.makeRequest('/refresh', { method: 'POST' });
    
    if (result.success && (result.data?.authorisation?.token || result.data?.token)) {
      const token = result.data.authorisation?.token || result.data.token;
      await this.setToken(token);
      
      if (result.data?.user) {
        await this.storeUserData(result.data.user);
      }
    }
    
    return result;
  }

  async refreshSession() {
    return this.refreshToken();
  }

  async forgotPassword(email) {
    if (!email) {
      return {
        success: false,
        error: 'Email is required'
      };
    }

    console.log('Forgot password request for email:', email);
    
    const result = await this.makeRequest('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (!result.success) {
      return result;
    }

    const responseData = result.data;
    
    return {
      success: true,
      message: responseData.message || 'Password reset email sent',
      // For testing - remove these in production
      ...(responseData.reset_token && { reset_token: responseData.reset_token }),
      ...(responseData.email && { email: responseData.email })
    };
  }

  async resetPassword(resetData) {
    if (!resetData.token || !resetData.email || !resetData.password) {
      return {
        success: false,
        error: 'Token, email, and new password are required'
      };
    }

    const requestData = {
      token: resetData.token,
      email: resetData.email.trim().toLowerCase(),
      password: resetData.password,
      password_confirmation: resetData.password_confirmation || resetData.password
    };

    console.log('Reset password request data:', { ...requestData, password: '[HIDDEN]', password_confirmation: '[HIDDEN]' });
    
    const result = await this.makeRequest('/reset-password', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    if (!result.success) {
      return result;
    }

    const responseData = result.data;
    
    return {
      success: true,
      message: responseData.message || 'Password reset successful'
    };
  }

  // Static methods for legacy compatibility
  static async login(email, password) {
    const instance = new ApiService();
    return instance.login({ email, password });
  }

  static async register(userData) {
    const instance = new ApiService();
    return instance.register(userData);
  }

  static async logout() {
    const instance = new ApiService();
    return instance.logout();
  }

  static async forgotPassword(email) {
    const instance = new ApiService();
    return instance.forgotPassword(email);
  }

  static async resetPassword(email, token, password, password_confirmation) {
    const instance = new ApiService();
    return instance.resetPassword({ email, token, password, password_confirmation });
  }

  static async getUserProfile() {
    const instance = new ApiService();
    return instance.getUserProfile();
  }

  static async updateUserProfile(profileData) {
    const instance = new ApiService();
    return instance.updateUserProfile(profileData);
  }

  static async refreshSession() {
    const instance = new ApiService();
    return instance.refreshSession();
  }

  // ---------------------
  // PET MANAGEMENT METHODS
  // ---------------------

  async savePetInfo(petInfo) {
    // Handle both FormData and regular object
    const isFormData = petInfo instanceof FormData;
    
    if (!isFormData) {
      // Validation for regular objects
      if (!petInfo.name || !petInfo.type || !petInfo.breed) {
        return {
          success: false,
          error: 'Pet name, type, and breed are required'
        };
      }

      // Validate numeric fields
      if (petInfo.age && (isNaN(petInfo.age) || petInfo.age <= 0)) {
        return {
          success: false,
          error: 'Please enter a valid age'
        };
      }

      if (petInfo.weight && (isNaN(petInfo.weight) || petInfo.weight <= 0)) {
        return {
          success: false,
          error: 'Please enter a valid weight'
        };
      }

      if (petInfo.daily_food_amount && (isNaN(petInfo.daily_food_amount) || petInfo.daily_food_amount <= 0)) {
        return {
          success: false,
          error: 'Please enter a valid daily food amount'
        };
      }

      // Clean and validate the data for regular objects
      const cleanedPetInfo = {
        name: petInfo.name.trim(),
        type: petInfo.type,
        breed: petInfo.breed.trim(),
        age: parseInt(petInfo.age) || 1,
        weight: parseFloat(petInfo.weight) || 1.0,
        size: petInfo.size || 'medium',
        activity_level: petInfo.activity_level || 'moderate',
        daily_food_amount: parseFloat(petInfo.daily_food_amount) || 100,
        feeding_frequency: parseInt(petInfo.feeding_frequency) || 2,
        allergies: petInfo.allergies ? petInfo.allergies.trim() : null,
        health_conditions: petInfo.health_conditions ? petInfo.health_conditions.trim() : null,
        special_diet: petInfo.special_diet || 'none',
      };

      console.log('Saving cleaned pet info:', cleanedPetInfo);
    } else {
      console.log('Saving pet info with FormData (includes file upload)');
    }

    // Prepare request options
    const requestOptions = {
      method: 'POST',
    };

    if (isFormData) {
      // For FormData, don't set Content-Type header (let browser set it with boundary)
      requestOptions.body = petInfo;
    } else {
      requestOptions.body = JSON.stringify(cleanedPetInfo);
    }

    const result = await this.makeFormRequest('/pets', requestOptions, isFormData);

    if (!result.success) {
      // Handle specific error cases
      if (result.status === 422) {
        const validationErrors = result.data?.errors || {};
        const firstError = Object.values(validationErrors)[0];
        return {
          success: false,
          error: Array.isArray(firstError) ? firstError[0] : (firstError || 'Validation failed'),
          validationErrors: validationErrors
        };
      }
      
      if (result.status === 401) {
        return {
          success: false,
          error: 'Authentication required. Please log in again.',
          authError: true
        };
      }

      return result;
    }

    // Handle successful response and store pet data locally
    const responseData = result.data;
    const petData = responseData.pet || responseData.data || responseData;
    
    if (petData) {
      await this.storePetData(petData);
      
      // Update local pets list
      try {
        const petsResponse = await this.getAllPets();
        if (petsResponse.success) {
          await AsyncStorage.setItem('userPets', JSON.stringify(petsResponse.data));
        }
      } catch (error) {
        console.error('Error updating local pet storage:', error);
      }
    }

    return {
      success: true,
      data: petData,
      message: responseData.message || 'Pet information saved successfully'
    };
  }

// ✅ FIXED: The one reliable update function for both forms and JSON
  async updatePetInfo(petId, petData) {
    const isFormData = petData instanceof FormData;
    // Use POST for FormData to avoid issues with PUT/PATCH in PHP
    const method = isFormData ? 'POST' : 'PUT';
    
    // If using POST, add the _method field for Laravel to treat it as a PUT
    if (isFormData) {
        petData.append('_method', 'PUT');
    }

    return this.request(`pets/${petId}`, {
      method: method,
      body: isFormData ? petData : JSON.stringify(petData),
    });
  }

  async getPetInfo(petId = null) {
    const endpoint = petId ? `/pets/${petId}` : '/pets';
    const result = await this.makeRequest(endpoint);
    
    if (!result.success) {
      return result;
    }

    const responseData = result.data;
    const petData = responseData.pets || responseData.pet || responseData.data || responseData;
    
    return {
      success: true,
      data: petData,
      message: responseData.message || 'Pet information retrieved successfully'
    };
  }

  async getAllPets() {
    return this.getPetInfo();
  }

  async getPet(petId) {
    return this.getPetInfo(petId);
  }

  async getUserPets(userId = null) {
    return this.getAllPets();
  }
  async setActivePet(petId) {
    if (!petId) {
      return { success: false, error: 'Pet ID is required' };
    }
    // This calls the new route you created: POST /api/pets/{petId}/set-active
    return this.makeRequest(`/pets/${petId}/set-active`, {
      method: 'POST',
    });
  }

  async deletePet(petId) {
    if (!petId) {
      return {
        success: false,
        error: 'Pet ID is required'
      };
    }

    const result = await this.makeRequest(`/pets/${petId}`, {
      method: 'DELETE',
    });

    if (result.success) {
      // Remove from local storage
      try {
        const storedPets = await AsyncStorage.getItem('userPets');
        if (storedPets) {
          let pets = JSON.parse(storedPets);
          pets = pets.filter(p => p.id !== petId);
          await AsyncStorage.setItem('userPets', JSON.stringify(pets));
          
          // Remove from active pet if it was the deleted one
          const activePet = await AsyncStorage.getItem('activePet');
          if (activePet) {
            const active = JSON.parse(activePet);
            if (active.id === petId) {
              if (pets.length > 0) {
                await AsyncStorage.setItem('activePet', JSON.stringify(pets[0]));
              } else {
                await AsyncStorage.removeItem('activePet');
              }
            }
          }
        }

        // Clear local pet data if this was the stored pet
        const storedPet = await this.getStoredPetInfo();
        if (storedPet && storedPet.id === petId) {
          await AsyncStorage.removeItem('petInfo');
        }
      } catch (error) {
        console.error('Error updating local pet storage after delete:', error);
      }
    }

    return result;
  }
// Pet Management Methods
  async updatePetInfo(petData) {
    return await this.makeRequest('/pets', {
      method: 'POST',
      body: JSON.stringify(petData),
    });
  }

   // --- CORE REQUEST METHOD (Simplified and More Robust) ---
async request(endpoint, options = {}) {
    const token = await this.getToken();
    const url = `${this.baseURL}${endpoint}`;

    const headers = {
      'Accept': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = { ...options, headers };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 204) {
        return { success: true, data: null, status: 204 };
      }
      
      const responseText = await response.text();
      let data = {};
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error("Failed to parse JSON:", responseText);
        return { success: false, error: 'Invalid JSON response from server.' };
      }

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || `HTTP Error: ${response.status}`;
        return { success: false, error: errorMessage, status: response.status, errors: data?.errors };
      }
      
      // Return the entire successful response body, which might contain 'data', 'message', etc.
      return { success: true, ...data };

    } catch (error) {
      console.error(`Network error for ${url}:`, error);
      return { success: false, error: 'Network request failed. Check your connection.' };
    }
  }
  // 🔹 PET MANAGEMENT METHODS (Use this cleaned-up section)

  
  // This method creates a new pet
  async savePetInfo(petData) {
    const isFormData = petData instanceof FormData;
    return this.request('pets', {
      method: 'POST',
      body: isFormData ? petData : JSON.stringify(petData),
    });
  }

//  This method updates an existing pet
  async updatePetInfo(petId, petData) {
    const isFormData = petData instanceof FormData;
    // We use POST and add a "_method" field for Laravel to handle the file upload correctly.
    const method = isFormData ? 'POST' : 'PUT';
    
    if (isFormData) {
      petData.append('_method', 'PUT');
    }

    return this.request(`pets/${petId}`, {
      method: method,
      body: isFormData ? petData : JSON.stringify(petData),
    });
  }

    async request(endpoint, options = {}) {
    const token = await this.getToken();
    const url = `${this.baseURL}/${endpoint}`;

    const headers = {
      Accept: 'application/json',
      ...options.headers,
    };

if (token) {
  headers.Authorization = `Bearer ${token}`;
}


    // ✅ FIXED: Intelligently set Content-Type. Don't set it for FormData.
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = { ...options, headers };

    try {
      const response = await fetch(url, config);

      // ✅ FIXED: Gracefully handle successful empty responses (prevents JSON Parse Error)
      if (response.status === 204) {
        return { success: true, data: null, status: 204 };
      }
      
      const responseText = await response.text();
      let data = {};
      
      try {
        // Only parse if there's actual text content
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        return { success: false, error: 'Invalid JSON response from server.' };
      }

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || `HTTP Error: ${response.status}`;
        return { success: false, error: errorMessage, status: response.status };
      }

      // The API response is already well-structured, so we can return it directly.
      return data;

    } catch (error) {
      console.error(`Network error for ${url}:`, error);
      return { success: false, error: 'Network request failed. Check your connection.' };
    }
  }
  
  // ... other pet methods like getPet, deletePet, etc.

  // STATIC METHODS FOR COMPATIBILITY
  // ---------------------
  static async updatePetInfo(petId, petData) {
    const instance = new ApiService();
    return instance.updatePetInfo(petId, petData);
  }
 async updatePet(petId, petData) {
    const isFormData = petData instanceof FormData;
    // Note: Use POST for FormData updates to avoid issues with PUT/PATCH
    const method = isFormData ? 'POST' : 'PUT';
    
    // If using POST, add the _method field for Laravel to treat it as a PUT
    if (isFormData) {
        petData.append('_method', 'PUT');
    }

    return this.request(`/pets/${petId}`, {
      method: method,
      body: isFormData ? petData : JSON.stringify(petData),
    });
  }
async deletePetPhoto(petId) {
  return this.request(`pets/${petId}/delete-photo`, {
    method: 'DELETE',
  });
}

  // Photo
// ApiService.js
// --- PET PHOTO METHODS (FROM YOUR CODE) ---
  // async uploadPetPhoto(petId, imageAsset) {
  //   if (!petId || !imageAsset) {
  //     return { success: false, error: 'Pet ID and Image are required' };
  //   }
  //   const formData = new FormData();
  //   formData.append('photo', {
  //     uri: imageAsset.uri,
  //     type: imageAsset.type || 'image/jpeg',
  //     name: imageAsset.fileName || `pet_photo_${Date.now()}.jpg`,
  //   });
  //   // This calls your dedicated photo upload endpoint
  //   return this.makeRequest(`/pets/${petId}/upload-photo`, {
  //     method: 'POST',
  //     body: formData,
  //   });
  // }


  // services/ApiService.js

// ... inside your ApiService class

async uploadPetPhoto(petId, imageAsset) {
  if (!petId || !imageAsset) {
    return { success: false, error: 'Pet ID and Image are required' };
  }
  
  const formData = new FormData();
  formData.append('photo', {
    uri: imageAsset.uri,
    type: imageAsset.type || 'image/jpeg',
    name: imageAsset.fileName || `pet_photo_${Date.now()}.jpg`,
  });

  // ✅ This calls your dedicated photo upload endpoint
  // We use `makeFormRequest` because it handles FormData correctly
  return this.makeFormRequest(`/pets/${petId}/upload-photo`, {
    method: 'POST',
    body: formData,
  }, true); // The 'true' flag tells the helper it's FormData
}
// Helper method for MIME types (add this to your ApiService class)
getMimeType(fileExtension) {
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg', 
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml'
  };
  return mimeTypes[fileExtension.toLowerCase()] || 'image/jpeg';
}


// Photo upload methods
  async savePetWithPhoto(formData) {
    console.log('Saving pet with photo using FormData');
    
    const token = await this.getToken();

    const config = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        // Don't set Content-Type for FormData - let the browser set it with boundary
      },
      body: formData,
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      console.log(`Making POST request to: ${this.baseURL}/pets (with FormData)`);
      console.log('Request headers:', config.headers);
      
      const response = await fetch(`${this.baseURL}/pets`, config);

      console.log('Response status:', response.status);

      // Get response text first
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      let data = null;
      
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
          console.log('Parsed response data:', data);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          return {
            success: false,
            error: `Server returned invalid JSON response. Status: ${response.status}`,
            rawResponse: responseText,
            status: response.status
          };
        }
      } else {
        console.log('Empty response body');
        data = {};
      }

      // Handle token expiry
      if (response.status === 401) {
        await this.clearToken();
        await this.clearAuthData();
      }

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || data?.errors || `HTTP ${response.status}: ${response.statusText}`;
        
        return {
          success: false,
          error: errorMessage,
          status: response.status,
          data: data,
          validationErrors: data?.errors
        };
      }

      // Handle successful response and store pet data locally
      const responseData = data;
      const petData = responseData.pet || responseData.data || responseData;
      
      if (petData) {
        await this.storePetData(petData);
        
        // Update local pets list
        try {
          const petsResponse = await this.getAllPets();
          if (petsResponse.success) {
            await AsyncStorage.setItem('userPets', JSON.stringify(petsResponse.data));
          }
        } catch (error) {
          console.error('Error updating local pet storage:', error);
        }
      }

      return {
        success: true,
        data: petData,
        message: responseData.message || 'Pet saved successfully with photo'
      };
      
    } catch (error) {
      console.error('Network/Request error:', error);
      
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        return { 
          success: false, 
          error: 'Cannot connect to server. Please check your network connection.',
          networkError: true
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'An unexpected error occurred',
        originalError: error
      };
    }
  }

    // ---------------------
  // PET RECOMMENDATIONS
  // ---------------------

  async getPetRecommendations(petId) {
    if (!petId) {
      return {
        success: false,
        error: 'Pet ID is required'
      };
    }

    console.log('Getting recommendations for pet ID:', petId);

    const result = await this.makeRequest(`/pets/${petId}/recommendations`);
    
    if (!result.success) {
      return result;
    }

    const responseData = result.data;
    
    return {
      success: true,
      data: responseData.recommendations || responseData.data || responseData,
      message: responseData.message || 'Recommendations retrieved successfully'
    };
  }

  async getFoodRecommendations(petId) {
    if (!petId) {
      return {
        success: false,
        error: 'Pet ID is required'
      };
    }

    return this.makeRequest(`/pets/${petId}/food-recommendations`);
  }

  async getFeedingSchedule(petId) {
    if (!petId) {
      return {
        success: false,
        error: 'Pet ID is required'
      };
    }

    return this.makeRequest(`/pets/${petId}/feeding-schedule`);
  }

  async getExerciseRecommendations(petId) {
    if (!petId) {
      return {
        success: false,
        error: 'Pet ID is required'
      };
    }

    return this.makeRequest(`/pets/${petId}/exercise-recommendations`);
  }

  async getHealthTips(petId) {
    if (!petId) {
      return {
        success: false,
        error: 'Pet ID is required'
      };
    }

    return this.makeRequest(`/pets/${petId}/health-tips`);
  }

  // Static methods for legacy compatibility
  static async getPetRecommendations(petId) {
    const instance = new ApiService();
    return instance.getPetRecommendations(petId);
  }

// ✅ THIS IS THE CORRECTED UPLOAD FUNCTION
  async uploadProfileImage(imageUri) {
    try {
      if (!imageUri) throw new Error('No image URI provided');

      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Authentication required', requiresLogin: true };

      const formData = new FormData();
      const uriParts = imageUri.split('.');
      const fileExtension = uriParts.pop() || 'jpg';
      
      formData.append('profile_image', {
        uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
        type: `image/${fileExtension}`,
        name: `profile.${fileExtension}`,
      });

      const response = await fetch(`${this.baseURL}/profile/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Do NOT set 'Content-Type'. fetch does this for you with FormData.
        },
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.errors?.profile_image?.[0] || responseData.message || 'Upload failed';
        throw new Error(errorMessage);
      }
      
      return { success: true, data: responseData.data };

    } catch (error) {
      console.error('ApiService uploadProfileImage error:', error);
      return { success: false, error: error.message };
    }
  }

  async getProfile() {
    return this.makeRequest('/profile');
  }

  async updateProfile(profileData) {
    return this.makeRequest('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async removeProfileImage() {
    return this.makeRequest('/profile/image', {
      method: 'DELETE',
    });
  }
  // Helper method to get MIME type
  getMimeType(fileExtension) {
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    return mimeTypes[fileExtension.toLowerCase()] || 'image/jpeg';
  }

  // User Stats Method
  async getUserStats() {
    return await this.makeRequest('/user/stats');
  }

  // Delete Account Method
  async deleteAccount() {
    const response = await this.makeRequest('/auth/account', {
      method: 'DELETE',
    });

    if (response.success) {
      // Clear local data
      this.token = null;
      await AsyncStorage.clear();
    }

    return response;
  }

  // -------------------------------
  // 🔹 USER POINTS ROUTES
  // -------------------------------
  async getUserPoints() {
    return this.makeRequest('/user/points', { method: 'GET' });
  }

  async updateUserPoints(data) {
    return this.makeRequest('/user/points', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async awardPoints(data) {
    return this.makeRequest('/user/points/award', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async spendPoints(data) {
    return this.makeRequest('/user/points/spend', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPointsHistory(limit = 50) {
    return this.makeRequest(`/user/points/history?limit=${limit}`, {
      method: 'GET',
    });
  }

  async getPointsSummary() {
    return this.makeRequest('/user/points/summary', { method: 'GET' });
  }

  // -------------------------------
  // 🔹 GAME ROUTES
  // -------------------------------
  async startGameSession(gameData) {
    return this.makeRequest('/games/start', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  async updateGameProgress(sessionId, progressData) {
    return this.makeRequest(`/games/session/${sessionId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(progressData),
    });
  }

  async completeGameSession(sessionId, completionData) {
    return this.makeRequest(`/games/session/${sessionId}/end`, {
      method: 'PUT',
      body: JSON.stringify(completionData),
    });
  }

  async createGameSession(gameData) {
    return this.makeRequest('/games/sessions', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  async getGameHistory() {
    return this.makeRequest('/games/history', { method: 'GET' });
  }

  async getGameStats() {
    return this.makeRequest('/games/stats', { method: 'GET' });
  }

  async getLeaderboard() {
    return this.makeRequest('/games/leaderboard', { method: 'GET' });
  }

  async getAvailableGames() {
    return this.makeRequest('/games/available', { method: 'GET' });
  }

  async getActiveGame() {
    return this.makeRequest('/games/active', { method: 'GET' });
  }

  // -------------------------------
  // 🔹 ROBOT ROUTES
  // -------------------------------
  async connectRobot(data) {
    return this.makeRequest('/robot/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendRobotCommand(commandData) {
    return this.makeRequest('/robot/command', {
      method: 'POST',
      body: JSON.stringify(commandData),
    });
  }

  async getRobotCommandHistory() {
    return this.makeRequest('/robot/commands/history', { method: 'GET' });
  }

  // -------------------------------
  // 🔹 PET-SPECIFIC GAME ROUTES
  // -------------------------------
  async getPetGameHistory(petId) {
    return this.makeRequest(`/pets/${petId}/games`, { method: 'GET' });
  }

  async getPetGameStats(petId) {
    return this.makeRequest(`/pets/${petId}/game-stats`, { method: 'GET' });
  }

  async getPetAvailableGames(petId) {
    return this.makeRequest(`/pets/${petId}/available-games`, { method: 'GET' });
  }

  async getPetActiveGame(petId) {
    return this.makeRequest(`/pets/${petId}/active-game`, { method: 'GET' });
  }
 // ✅ NEW OR UPDATED: This function allows sending the treat request
    async completeGameSession(sessionId, gameData) {
        return this.makeRequest(`/games/session/${sessionId}/end`, {
            method: 'PUT',
            body: JSON.stringify(gameData),
        });
    }

    // ✅ NEW: Function to update the auto-dispense settings
    async updateAutoDispenseSettings(petId, settings) {
        return this.makeRequest(`/pets/${petId}/auto-dispense-settings`, {
            method: 'POST',
            body: JSON.stringify(settings),
        });
    }
    
  // -------------------------------
  // 🔹 PUBLIC ROUTES
  // -------------------------------
  async getPublicLeaderboard() {
    return this.makeRequest('/public/games/leaderboard', { method: 'GET' });}
    // -------------------------------
// 🔹 NUTRITION ROUTES
// -------------------------------
async dispenseFood(data) {
  return this.makeRequest('/nutrition/dispense/food', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async dispenseWater(data) {
  return this.makeRequest('/nutrition/dispense/water', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async dispenseTreats(data) {
  return this.makeRequest('/nutrition/dispense/treats', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
async dispenseMedication(data) {
    return this.makeRequest('/nutrition/dispense/medication', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

async getDispenseHistory(petId = null) {
  const url = petId ? `/nutrition/history?pet_id=${petId}` : '/nutrition/history';
  return this.makeRequest(url, { method: 'GET' });
}

async getNutritionStats(petId = null) {
  const url = petId ? `/nutrition/stats?pet_id=${petId}` : '/nutrition/stats';
  return this.makeRequest(url, { method: 'GET' });
}
async getNutritionGoals(petId) {
    if (!petId) return { success: false, error: 'Pet ID required' };
    return this.makeRequest(`/nutrition/goals/${petId}`, { method: 'GET' });
}

async updateNutritionGoals(petId, goals) {
    if (!petId) return { success: false, error: 'Pet ID required' };
    return this.makeRequest(`/nutrition/goals/${petId}`, {
        method: 'POST',
        body: JSON.stringify(goals),
    });
}

// ✨ NEW: Add this function to get the latest container levels
async getNutritionLevels(petId) {
    if (!petId) return { success: false, data: null };
    return this.makeRequest(`/nutrition/levels/${petId}`, { method: 'GET' });
}
/**
     * ✨ ADD THIS NEW FUNCTION ✨
     * This function fetches the latest sensor readings for container levels.
     */
    async getContainerLevels(petId) {
        if (!petId) return { success: false, data: null };
        return this.makeRequest(`/nutrition/levels/${petId}`, { method: 'GET' });
    }

        // --- ✅ NEW: Schedule Management Methods ---
    async saveDispenseSchedule(scheduleData) {
        return this.makeRequest('/nutrition/schedule', {
            method: 'POST',
            body: JSON.stringify(scheduleData),
        });
    }

    async getDispenseSchedules(petId) {
        return this.makeRequest(`/nutrition/schedule/${petId}`);
    }

    async updateDispenseSchedule(scheduleId, updateData) {
        return this.makeRequest(`/nutrition/schedule/${scheduleId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
        });
    }

    async deleteDispenseSchedule(scheduleId) {
        return this.makeRequest(`/nutrition/schedule/${scheduleId}`, {
            method: 'DELETE',
        });
    }
// -------------------------------
// ✨ NEW: HEALTH & MOOD ROUTES
// -------------------------------
async getHealthStats(petId) {
    if (!petId) return { success: false, data: null };
    return this.makeRequest(`/health/stats?pet_id=${petId}`, { method: 'GET' });
}

async getVitalSigns(petId) {
    if (!petId) return { success: false, data: null };
    return this.makeRequest(`/health/vitals/${petId}`, { method: 'GET' });
}

async recordMood(petId, mood_level, notes) {
    if (!petId) return { success: false, error: 'Pet ID required' };
    const data = { pet_id: petId, mood_level, notes };
    return this.makeRequest('/health/mood/record', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
 async getMoodHistory(petId) {
        if (!petId) return { success: false, error: 'Pet ID is required' };
        return this.makeRequest(`/health/mood/history/${petId}`, { method: 'GET' });
    }
    // ✨ ADD THIS NEW FUNCTION
async recordVitalSigns(petId, vitalsData) {
    if (!petId) return { success: false, error: 'Pet ID required' };
    const data = { pet_id: petId, ...vitalsData };
    return this.makeRequest('/health/vitals/record', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
// ANALYTICS ROUTES
  // -------------------------------
  async getPetAnalytics(petId, period = 'week') {
    let url = `/analytics?period=${period}`;
    if (petId) {
      url += `&pet_id=${petId}`;
    }
    return this.makeRequest(url, { method: 'GET' });
  }

async generateReport(petId, type, format) {
    try {
        console.log('=== API SERVICE GENERATE REPORT ===');
        
        if (!petId) {
            return { success: false, error: 'Pet ID is required' };
        }

        const reportParams = {
            pet_id: petId,
            type: type,
            format: format || 'pdf',
        };

        console.log('Request parameters:', reportParams);
        console.log('Making request to: /analytics/generate-report');

        // Use the improved request method
        const response = await this.request('analytics/generate-report', {
            method: 'POST',
            body: JSON.stringify(reportParams),
        });

        console.log('=== RAW API RESPONSE ===');
        console.log('Response type:', typeof response);
        console.log('Response keys:', Object.keys(response || {}));
        console.log('Full response:', JSON.stringify(response, null, 2));

        // CHECK DIFFERENT RESPONSE FORMATS
        
        // Format 1: Standard success response with nested data
        if (response.success === true && response.data) {
            console.log('✅ Format 1: Standard success response with nested data');
            return {
                success: true,
                data: response.data,
                message: response.message || 'Report generated successfully'
            };
        }
        
        // Format 2: Direct success response (success + direct properties)
        if (response.success === true && response.download_url) {
            console.log('✅ Format 2: Direct success response');
            return {
                success: true,
                data: {
                    download_url: response.download_url,
                    file_name: response.file_name,
                    file_size: response.file_size,
                    generated_at: response.generated_at,
                    expires_at: response.expires_at,
                    format: response.format,
                    type: response.type
                },
                message: response.message || 'Report generated successfully'
            };
        }
        
        // Format 3: No explicit success field but has download_url
        if (response.download_url && response.file_name) {
            console.log('✅ Format 3: Implicit success (has download_url)');
            return {
                success: true,
                data: response,
                message: 'Report generated successfully'
            };
        }
        
        // Format 4: Error response
        if (response.success === false || response.error) {
            console.log('❌ Format 4: Error response');
            return {
                success: false,
                error: response.error || response.message || 'Unknown error from server',
                details: response
            };
        }
        
        // Format 5: Unexpected response format
        console.log('⚠️ Format 5: Unexpected response format');
        console.log('Response does not match any expected format');
        
        return {
            success: false,
            error: 'Unexpected response format from server',
            details: response,
            debug_info: {
                has_success_field: 'success' in (response || {}),
                success_value: response?.success,
                has_data_field: 'data' in (response || {}),
                has_download_url: 'download_url' in (response || {}),
                has_file_name: 'file_name' in (response || {}),
                available_keys: Object.keys(response || {})
            }
        };

    } catch (error) {
        console.error('❌ ERROR IN GENERATE REPORT API CALL:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        
        return {
            success: false,
            error: error.message || 'Network error while generating report',
            networkError: true,
            originalError: error
        };
    }
}
  async exportAnalyticsData(exportParams) {
    return this.makeRequest('/analytics/export-data', {
      method: 'POST',
      body: JSON.stringify(exportParams),
    });
  }

  async checkConnection() {
    try {
      const response = await this.makeRequest('/health-check', { method: 'GET' });
      return response.success === true;
    } catch (error) {
      return false;
    }
  }


    async getPointsBalance() {
    // ✅ FIX IS HERE: Change the URL to match your api.php file
    return this.makeRequest('/points/balance');
  }
// --- Product Routes ---
    
    async getAllProducts() {
        return this.makeRequest('/products');
    }

    async getProduct(id) {
        return this.makeRequest(`/products/${id}`);
    }
    
    async getProductTiers() {
        return this.makeRequest('/products/tiers/all');
    }

    // Admin
 // Your createProduct method, now corrected to use `this.getToken()`
async createProduct(productFormData) {
    try {
      const token = await this.getToken();
      if (!token) {
        return { success: false, message: 'Authentication token not found.' };
      }
      
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: productFormData,
      });

      // ✅ CHANGE IS HERE: If the response is not OK, read it as text
      if (!response.ok) {
        // This will grab the HTML error page as text
        const errorText = await response.text(); 
        // Log it to your console to see the real Laravel error
        console.error("Full server response:", errorText); 
        // Throw an error to go to the catch block
        throw new Error("Server responded with an error page.");
      }

      return await response.json();

    } catch (error) {
      console.error('API createProduct error:', error);
      throw error;
    }
  }

  // Add other API methods here, also using `this.getToken()`
  // Example:
  async getProducts() {
    try {
        const token = await this.getToken(); // <-- Use `this.` here too
        if (!token) return { success: false, message: 'Authentication token not found.' };

        const response = await fetch(`${API_BASE_URL}/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });
        return await response.json();
    } catch (error) {
        console.error('API getProducts error:', error);
        throw error;
    }
  } 
    // Admin
    async updateProduct(id, productData) {
        // Note: productData should be FormData if it includes an image
        // We need to append _method: 'PUT' for Laravel to handle it
        productData.append('_method', 'PUT');
        const token = await this.getToken();
        const response = await fetch(`${this.baseURL}/products/${id}`, {
            method: 'POST', // Use POST to send FormData
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: productData,
        });
        return response.json();
    }
    
    // Admin
    async deleteProduct(id) {
        return this.makeRequest(`/products/${id}`, {
            method: 'DELETE',
        });
    }

    // --- Cart Routes ---

    async getCart() {
        return this.makeRequest('/cart');
    }

    async addToCart(itemData) { // e.g., { product_id: 1, quantity: 2 }
        return this.makeRequest('/cart', {
            method: 'POST',
            body: JSON.stringify(itemData),
        });
    }

    async updateCartItem(cartItemId, updateData) { // e.g., { quantity: 3 }
        return this.makeRequest(`/cart/${cartItemId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
        });
    }

    async removeCartItem(cartItemId) {
        return this.makeRequest(`/cart/${cartItemId}`, {
            method: 'DELETE',
        });
    }
    
    async clearCart() {
        return this.makeRequest('/cart', {
            method: 'DELETE',
        });
    }

    // --- Order Routes ---

    async getOrderHistory() {
        return this.makeRequest('/orders');
    }

    async createOrder(orderData) { // e.g., { address: '...', payment_method: '...' }
        return this.makeRequest('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData),
        });
    }
    
    async getOrder(id) {
        return this.makeRequest(`/orders/${id}`);
    }

    // --- Points Routes ---

    async getPointsHistory() {
        return this.makeRequest('/points');
    }

    async getPointsBalance() {
        return this.makeRequest('/points/balance');
    }

    // --- Super Admin Routes ---
// In ApiService.js

  // ... your original makeRequest and makeFormRequest functions are here. Do not change them.

  // ✅ ADD THIS NEW FUNCTION
  // This is a special, safe function just for the admin panel
  async makeAdminRequest(endpoint, options = {}) {
    const token = await this.getToken();
    const url = `${this.baseURL}${endpoint}`;

 const headers = {
      'Accept': 'application/json',
      // ✅ THIS LINE WAS MISSING. It's required for sending JSON data.
      'Content-Type': 'application/json', 
      ...options.headers
    };
        if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const config = { ...options, headers };

    try {
      const response = await fetch(url, config);
      const data = await response.json(); // Reliably parse the data

      if (!response.ok) {
        throw new Error(data.message || `HTTP Error: ${response.status}`);
      }

      // This wraps the clean data in the format your app expects
      return { success: true, data: data, status: response.status };

    } catch (error) {
      console.error(`Admin request to ${endpoint} failed:`, error);
      if (error instanceof SyntaxError) {
        return { success: false, error: 'Server returned an invalid response.' };
      }
      return { success: false, error: error.message };
    }
  }
    // Super Admin
 async adminGetAllOrders() {
    // ✅ Change this line to use the new function
    return this.makeAdminRequest('/admin/orders');
  }

// In ApiService.js

  async adminUpdateOrderStatus(orderId, statusData) { // e.g., { status: 'shipped' }
    return this.makeAdminRequest(`/admin/orders/${orderId}/status`, {
      // ✅ CHANGE THIS LINE from 'PUT' to 'POST'
      method: 'POST',
      body: JSON.stringify(statusData),
    });
  }
// ✅ ADD THIS NEW FUNCTION
  async adminGetOrder(orderId) {
    // This calls our new route: GET /api/admin/orders/{id}
    return this.makeAdminRequest(`/admin/orders/${orderId}`);
  }



 // --- Video Endpoints ---

  /**
   * Corresponds to: GET /videos
   * Fetches a paginated and filtered list of videos.
   * @param {URLSearchParams} params - Optional query parameters.
   */
  async getPetVideos(params) {
    const queryString = params ? `?${params.toString()}` : '';
    return this.makeRequest(`/videos${queryString}`);
  }

  /**
   * Corresponds to: POST /videos
   * Uploads a new video file and its data.
   * @param {FormData} formData - The video file and associated data.
   */
  async uploadVideo(formData) {
    return this.makeRequest('/videos', {
      method: 'POST',
      body: formData,
      // The 'Content-Type' header is intentionally omitted for FormData
      // as the browser/fetch client will set it correctly with the boundary.
    });
  }
  
  /**
   * Corresponds to: GET /videos/recent
   * Fetches the most recent videos.
   * @param {number} limit - The number of recent videos to fetch.
   */
  async getRecentVideos(limit = 5) {
      return this.makeRequest(`/videos/recent?limit=${limit}`);
  }

  /**
   * Corresponds to: GET /videos/stats
   * Fetches statistics about the user's videos.
   */
  async getVideoStats() {
    return this.makeRequest('/videos/stats');
  }

  /**
   * Corresponds to: GET /videos/{id}
   * Fetches a single video by its ID.
   * @param {string|number} videoId - The ID of the video.
   */
  async getPetVideo(videoId) {
    return this.makeRequest(`/videos/${videoId}`);
  }

  /**
   * Corresponds to: PUT /videos/{id}
   * Updates a video's details.
   * @param {string|number} videoId - The ID of the video to update.
   * @param {object} videoData - The new data for the video.
   */
  async updatePetVideo(videoId, videoData) {
    return this.makeRequest(`/videos/${videoId}`, {
      method: 'PUT',
      body: JSON.stringify(videoData),
    });
  }

  /**
   * Corresponds to: DELETE /videos/{id}
   * Deletes a video.
   * @param {string|number} videoId - The ID of the video to delete.
   */
  async deletePetVideo(videoId) {
    return this.makeRequest(`/videos/${videoId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Corresponds to: POST /videos/{id}/toggle-favorite
   * Toggles the favorite status of a video.
   * @param {string|number} videoId - The ID of the video.
   */
  async toggleVideoFavorite(videoId) {
    return this.makeRequest(`/videos/${videoId}/toggle-favorite`, {
      method: 'POST',
    });
  }








  // ---------------------
  // STORAGE HELPERS
  // ---------------------

  async storeUserData(userData) {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await AsyncStorage.setItem('user_id', userData.id?.toString() || '');
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  }

  async getUserData() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async storePetData(petData) {
    try {
      await AsyncStorage.setItem('petInfo', JSON.stringify(petData));
    } catch (error) {
      console.error('Error storing pet data:', error);
    }
  }

  async getStoredPetInfo() {
    try {
      const petData = await AsyncStorage.getItem('petInfo');
      return petData ? JSON.parse(petData) : null;
    } catch (error) {
      console.error('Error getting stored pet info:', error);
      return null;
    }
  }

  async clearAuthData() {
    try {
      await AsyncStorage.multiRemove(['token', 'user_id', 'userData', 'petInfo']);
      this.token = null;
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  // ---------------------
  // AUTHENTICATION HELPERS
  // ---------------------

  async isAuthenticated() {
    const token = await this.getToken();
    if (!token) return false;

    // Verify token with backend
    try {
      const result = await this.getMe();
      return result.success;
    } catch (error) {
      console.error('Error verifying authentication:', error);
      return false;
    }
  }

  async getStoredUser() {
    return this.getUserData();
  }

  // Static method for legacy compatibility
  static async isAuthenticated() {
    const instance = new ApiService();
    return instance.isAuthenticated();
  }

  // ---------------------
  // UTILITY METHODS FOR OFFLINE SUPPORT
  // ---------------------

  async syncPendingData() {
    try {
      const pendingData = await AsyncStorage.getItem('pendingSync');
      if (pendingData) {
        const pending = JSON.parse(pendingData);
        
        for (const item of pending) {
          try {
            await this.makeRequest(item.endpoint, item.options);
          } catch (error) {
            console.error('Error syncing pending data:', error);
          }
        }
        
        // Clear pending data after sync
        await AsyncStorage.removeItem('pendingSync');
      }
    } catch (error) {
      console.error('Error during data sync:', error);
    }
  }

  async addToPendingSync(endpoint, options) {
    try {
      const pendingData = await AsyncStorage.getItem('pendingSync');
      const pending = pendingData ? JSON.parse(pendingData) : [];
      
      pending.push({
        endpoint,
        options,
        timestamp: Date.now()
      });
      
      await AsyncStorage.setItem('pendingSync', JSON.stringify(pending));
    } catch (error) {
      console.error('Error adding to pending sync:', error);
    }
  }

  // Static methods for legacy compatibility
  static async syncPendingData() {
    const instance = new ApiService();
    return instance.syncPendingData();
  }

  static async addToPendingSync(endpoint, options) {
    const instance = new ApiService();
    return instance.addToPendingSync(endpoint, options);
  }


  // // ---------------------
  // // HEALTH CHECK & TESTING
  // // ---------------------

  // async healthCheck() {
  //   return this.makeRequest('/health');
  // }

  async testConnection() {
    try {
      console.log('Testing connection to:', `${this.baseURL}/test`);
      
      const response = await fetch(`${this.baseURL}/test`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      console.log('Test connection response status:', response.status);

      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Connection successful' : 'Connection failed'
      };
    } catch (error) {
      console.error('Test connection error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Network connection failed'
      };
    }
  }

    // ---------------------
  // CONFIGURATION METHODS
  // ---------------------

  getBaseURL() {
    return this.baseURL;
  }

  updateBaseURL(newURL) {
    this.baseURL = newURL;
    console.log('Base URL updated to:', this.baseURL);
  }

  async checkRoutes() {
    console.log('Checking available routes...');
    
    const routes = [
      '/test',
      '/login',
      '/register',
      '/me',
      '/pets',
      '/products',
      '/categories',
      '/orders',
      '/points',
      '/games'
    ];

    const results = {};

    for (const route of routes) {
      try {
        const response = await fetch(`${this.baseURL}${route}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        results[route] = {
          status: response.status,
          statusText: response.statusText,
          available: response.status !== 404
        };
      } catch (error) {
        results[route] = {
          status: 'error',
          error: error.message,
          available: false
        };
      }
    }

    console.log('Route check results:', results);
    return results;
  }

  // Static methods for legacy compatibility
  static async healthCheck() {
    const instance = new ApiService();
    return instance.healthCheck();
  }

  // ---------------------
  // UTILITY METHODS
  // ---------------------

  async clearAllData() {
    try {
      await AsyncStorage.clear();
      this.token = null;
      return { success: true, message: 'All data cleared successfully' };
    } catch (error) {
      console.error('Error clearing all data:', error);
      return { success: false, error: 'Failed to clear all data' };
    }
  }
}

export default new ApiService();