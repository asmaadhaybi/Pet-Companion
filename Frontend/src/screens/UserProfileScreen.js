// Fixed UserProfile.js with proper image upload and synchronization
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  Image,
  Modal,
  Dimensions,
  ActionSheetIOS,
  Platform,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

export default function UserProfile({ navigation }) {
  // ✅ FIXED: Clean state management
  const [userProfile, setUserProfile] = useState({
    id: null,
    name: '',
    email: '',
    role: 'user',
    profile_picture: null,
    profile_picture_url: null,
    joinDate: null,
    pets: []
  });
  
  const [originalProfile, setOriginalProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [userStats, setUserStats] = useState({
    totalPoints: 0,
    pointsSpent: 0,
    ordersPlaced: 0,
    videosRecorded: 0,
    daysActive: 0,
  });

  // Load profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
    }, [])
  );

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Load user stats after profile is loaded
  useEffect(() => {
    if (userProfile.joinDate) {
      loadUserStats();
    }
  }, [userProfile.joinDate]);

  // Request camera permissions for Android
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs access to camera to take photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // ✅ FIXED: Enhanced profile loading with proper server sync
  const loadUserProfile = async () => {
    setLoading(true);
    try {
      console.log('Loading user profile...');
      
      // Try to load from server first if we have auth token
      const token = await AsyncStorage.getItem('authToken');
      
      if (token) {
        console.log('Auth token found, fetching from server...');
        try {
          const apiService = new ApiService();
          const result = await apiService.getProfile();
          
          if (result.success && result.user) {
            console.log('Profile loaded from server:', result.user);
            const serverProfile = result.user;
            
            const profileData = {
              id: serverProfile.id,
              name: serverProfile.name || '',
              email: serverProfile.email || '',
              role: serverProfile.role || 'user',
              profile_picture: serverProfile.profile_picture || null,
              profile_picture_url: serverProfile.profile_picture_url || 
                                 (serverProfile.profile_picture ? 
                                   `${ApiService.baseURL}/storage/${serverProfile.profile_picture}` : null),
              joinDate: serverProfile.created_at || new Date().toISOString(),
              pets: serverProfile.pets || [],
            };
            
            // Save to local storage for offline access
            await AsyncStorage.setItem('userData', JSON.stringify(profileData));
            setUserProfile(profileData);
            setOriginalProfile({ ...profileData });
            setLoading(false);
            return;
          }
        } catch (serverError) {
          console.warn('Server request failed, falling back to local storage:', serverError);
        }
      }
      
      // Fallback to local storage
      console.log('Loading from local storage...');
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedData = JSON.parse(userData);
        
        const profileData = {
          id: parsedData.id || null,
          name: parsedData.name || '',
          email: parsedData.email || '',
          role: parsedData.role || 'user',
          profile_picture: parsedData.profile_picture || null,
          profile_picture_url: parsedData.profile_picture_url || null,
          joinDate: parsedData.joinDate || parsedData.created_at || new Date().toISOString(),
          pets: parsedData.pets || [],
        };
        
        console.log('Profile loaded from local storage');
        setUserProfile(profileData);
        setOriginalProfile({ ...profileData });
      } else {
        // Create default profile if none exists
        const defaultProfile = {
          id: null,
          name: 'Pet Owner',
          email: 'user@example.com',
          role: 'user',
          profile_picture: null,
          profile_picture_url: null,
          joinDate: new Date().toISOString(),
          pets: [],
        };
        
        await AsyncStorage.setItem('userData', JSON.stringify(defaultProfile));
        setUserProfile(defaultProfile);
        setOriginalProfile({ ...defaultProfile });
        
        console.log('Created default profile');
      }
      
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load profile data.');
    }
    setLoading(false);
  };

  // Fixed days active calculation
  const calculateDaysActive = (joinDate) => {
    if (!joinDate) return 1;
    
    try {
      const joinDateObj = new Date(joinDate);
      const currentDate = new Date();
      
      // Reset time to avoid partial day issues
      joinDateObj.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      const timeDiff = currentDate.getTime() - joinDateObj.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      
      // Return at least 1 day if joined today
      return Math.max(daysDiff + 1, 1);
    } catch (error) {
      console.error('Error calculating days active:', error);
      return 1;
    }
  };

  const loadUserStats = async () => {
    try {
      // Load points
      const totalPoints = await AsyncStorage.getItem('userPoints');
      const pointsHistory = await AsyncStorage.getItem('pointsHistory');
      let pointsSpent = 0;
      
      if (pointsHistory) {
        try {
          const history = JSON.parse(pointsHistory);
          pointsSpent = history
            .filter(entry => entry && entry.type === 'spent')
            .reduce((sum, entry) => sum + (entry.amount || 0), 0);
        } catch (parseError) {
          console.warn('Error parsing points history:', parseError);
        }
      }

      // Load orders
      const orderHistory = await AsyncStorage.getItem('orderHistory');
      let ordersCount = 0;
      if (orderHistory) {
        try {
          const orders = JSON.parse(orderHistory);
          ordersCount = Array.isArray(orders) ? orders.length : 0;
        } catch (parseError) {
          console.warn('Error parsing order history:', parseError);
        }
      }

      // Load videos
      const petVideos = await AsyncStorage.getItem('petVideos');
      let videosCount = 0;
      if (petVideos) {
        try {
          const videos = JSON.parse(petVideos);
          videosCount = Array.isArray(videos) ? videos.length : 0;
        } catch (parseError) {
          console.warn('Error parsing pet videos:', parseError);
        }
      }

      // Calculate days active using the profile join date
      const daysActive = calculateDaysActive(userProfile.joinDate);

      setUserStats({
        totalPoints: parseInt(totalPoints) || 0,
        pointsSpent,
        ordersPlaced: ordersCount,
        videosRecorded: videosCount,
        daysActive,
      });

      console.log('User stats loaded:', {
        totalPoints: parseInt(totalPoints) || 0,
        pointsSpent,
        ordersPlaced: ordersCount,
        videosRecorded: videosCount,
        daysActive,
        joinDate: userProfile.joinDate
      });
      
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const validateProfile = () => {
    if (!userProfile.name || !userProfile.name.trim()) {
      Alert.alert('Validation Error', 'Name is required');
      return false;
    }

    if (!userProfile.email || !userProfile.email.trim()) {
      Alert.alert('Validation Error', 'Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userProfile.email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  // ✅ FIXED: Proper image upload with database synchronization
  const uploadProfileImage = async (imageUri) => {
    if (!imageUri) return null;

    setUploadingImage(true);
    try {
      console.log('Uploading profile image:', imageUri);
      
      // Check if we have authentication
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Authentication Required', 'Please login to upload profile image');
        return null;
      }

      const apiService = new ApiService();
      const result = await apiService.uploadProfileImage(imageUri);
      
      if (result.success && result.data) {
        console.log('Image uploaded successfully:', result.data);
        
        // Extract the proper image URL from server response
        const serverImageUrl = result.data.profile_picture_url || 
                              result.data.url || 
                              `${ApiService.baseURL}/storage/${result.data.profile_picture}`;
        
        console.log('Server image URL:', serverImageUrl);
        
        // Update local profile state immediately
        const updatedProfile = {
          ...userProfile,
          profile_picture: result.data.profile_picture,
          profile_picture_url: serverImageUrl
        };
        
        setUserProfile(updatedProfile);
        
        // Update local storage with server data
        await AsyncStorage.setItem('userData', JSON.stringify(updatedProfile));
        
        // Update original profile to reflect the change
        setOriginalProfile({ ...updatedProfile });
        
        console.log('Profile updated with new image:', updatedProfile);
        
        return serverImageUrl;
      } else {
        console.error('Image upload failed:', result.error);
        
        if (result.requiresLogin) {
          Alert.alert('Session Expired', 'Please login again to upload images', [
            { text: 'OK', onPress: () => navigation.navigate('Login') }
          ]);
        } else {
          Alert.alert('Upload Failed', result.error || 'Failed to upload image');
        }
        
        return null;
      }
      
    } catch (error) {
      console.error('Error uploading profile image:', error);
      Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // ✅ FIXED: Comprehensive save function with proper sync
  const saveUserProfile = async () => {
    if (!validateProfile()) {
      return;
    }

    // Check if there are any actual changes to save
    const hasNameOrEmailChange = userProfile.name !== originalProfile.name || 
                                userProfile.email !== originalProfile.email;
    const hasImageChange = userProfile.profile_picture_url !== originalProfile.profile_picture_url;
    
    if (!hasNameOrEmailChange && !hasImageChange) {
      setIsEditing(false); // Nothing changed, just exit editing mode
      return;
    }

    setSaving(true);
    try {
      console.log('Saving profile changes...');
      
      // Handle image upload if there's a new local image
      if (hasImageChange && userProfile.profile_picture_url && 
          userProfile.profile_picture_url.startsWith('file:')) {
        console.log('Uploading new image...');
        const uploadedImageUrl = await uploadProfileImage(userProfile.profile_picture_url);
        if (!uploadedImageUrl) {
          throw new Error('Failed to upload image');
        }
        // Image upload already updates the profile, so we continue
      }

      // Handle name/email updates
      if (hasNameOrEmailChange) {
        console.log('Updating name/email...');
        const apiService = new ApiService();
        const updateResult = await apiService.updateProfile({
          name: userProfile.name,
          email: userProfile.email,
        });
        
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Failed to update profile info');
        }
        
        console.log('Profile info updated successfully');
      }

      // Refresh profile from server to ensure sync
      await loadUserProfile();
      
      Alert.alert('Success!', 'Your profile has been updated.');
      setIsEditing(false);

    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Save Failed', error.message);
      // Revert to original profile on error
      setUserProfile({ ...originalProfile });
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    if (!originalProfile) {
      setIsEditing(false);
      return;
    }

    const hasChanges = JSON.stringify(userProfile) !== JSON.stringify(originalProfile);
    
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard your changes?',
      [
        { text: 'Continue Editing', style: 'cancel' },
        { 
          text: 'Discard', 
          style: 'destructive',
          onPress: () => {
            setUserProfile({ ...originalProfile });
            setIsEditing(false);
          }
        }
      ]
    );
  };

  const handleImagePicker = () => {
    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Take Photo', 'Choose from Library'];
      if (userProfile.profile_picture_url) {
        options.push('Remove Photo');
      }
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: options.length > 3 ? 3 : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openCamera();
          } else if (buttonIndex === 2) {
            openImageLibrary();
          } else if (buttonIndex === 3 && options.length > 3) {
            removeProfilePhoto();
          }
        }
      );
    } else {
      setShowImagePicker(true);
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1000,
      maxWidth: 1000,
      quality: 0.8,
    };

    launchCamera(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        if (response.errorMessage) {
          Alert.alert('Error', 'Failed to take photo: ' + response.errorMessage);
        }
        return;
      }

      if (response.assets && response.assets[0]) {
        const imageUri = response.assets[0].uri;
        console.log('Camera image selected:', imageUri);
        
        // Set the local image URI temporarily
        setUserProfile(prev => ({ 
          ...prev, 
          profile_picture_url: imageUri 
        }));
        setShowImagePicker(false);
      }
    });
  };

  const openImageLibrary = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1000,
      maxWidth: 1000,
      quality: 0.8,
      selectionLimit: 1,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        if (response.errorMessage) {
          Alert.alert('Error', 'Failed to select image: ' + response.errorMessage);
        }
        return;
      }

      if (response.assets && response.assets[0]) {
        const imageUri = response.assets[0].uri;
        console.log('Library image selected:', imageUri);
        
        // Set the local image URI temporarily
        setUserProfile(prev => ({ 
          ...prev, 
          profile_picture_url: imageUri 
        }));
        setShowImagePicker(false);
      }
    });
  };

  const removeProfilePhoto = async () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingImage(true);
              
              // Try to remove from server if authenticated
              const token = await AsyncStorage.getItem('authToken');
              
              if (token) {
                try {
                  const apiService = new ApiService();
                  const result = await apiService.removeProfileImage();
                  
                  if (result.success) {
                    console.log('Profile image removed from server');
                  }
                } catch (serverError) {
                  console.warn('Failed to remove image from server:', serverError);
                }
              }
              
              // Update local state
              const updatedProfile = {
                ...userProfile,
                profile_picture: null,
                profile_picture_url: null
              };
              
              setUserProfile(updatedProfile);
              setOriginalProfile({ ...updatedProfile });
              
              // Update local storage
              await AsyncStorage.setItem('userData', JSON.stringify(updatedProfile));
              setShowImagePicker(false);
              
              Alert.alert('Success', 'Profile photo removed successfully');
              
            } catch (error) {
              console.error('Error removing profile photo:', error);
              Alert.alert('Error', 'Failed to remove profile photo');
            } finally {
              setUploadingImage(false);
            }
          }
        }
      ]
    );
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Administrator';
      case 'admin':
        return 'Partner/Administrator';
      case 'user':
      default:
        return 'Pet Owner';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return '#E74C3C';
      case 'admin':
        return '#F39C12';
      case 'user':
      default:
        return '#257D8C';
    }
  };

  const hasChanges = () => {
    if (!originalProfile) return false;
    return JSON.stringify(userProfile) !== JSON.stringify(originalProfile);
  };

  // ✅ FIXED: Enhanced profile image source getter
  const getProfileImageSource = () => {
    const imageUrl = userProfile.profile_picture_url;
    
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
      // Check if it's a valid URL or local URI
      if (imageUrl.startsWith('http') || imageUrl.startsWith('file:') || imageUrl.startsWith('content:')) {
        return { uri: imageUrl };
      }
    }
    
    return null;
  };

  // Format join date for display
  const formatJoinDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting join date:', error);
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257D8C" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => {
            if (isEditing && hasChanges()) {
              cancelEditing();
            } else {
              navigation.goBack();
            }
          }}
        >
          <Icon name="arrow-back" size={24} color="#257D8C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerActions}>
          {isEditing && (
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={cancelEditing}
            >
              <Icon name="close" size={24} color="#FF4757" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.editBtn}
            onPress={() => {
              if (isEditing) {
                saveUserProfile();
              } else {
                setIsEditing(true);
              }
            }}
            disabled={saving || uploadingImage}
          >
            {(saving || uploadingImage) ? (
              <ActivityIndicator size="small" color="#257D8C" />
            ) : (
              <Icon name={isEditing ? "save" : "edit"} size={24} color="#257D8C" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity 
            style={styles.photoContainer}
            onPress={isEditing ? handleImagePicker : null}
            disabled={!isEditing || uploadingImage}
          >
            {getProfileImageSource() ? (
              <Image 
                source={getProfileImageSource()} 
                style={styles.profilePhoto}
                onError={(error) => {
                  console.warn('Image failed to load:', error);
                }}
              />
            ) : (
              <View style={styles.placeholderPhoto}>
                <Icon name="person" size={60} color="#C4E6E8" />
              </View>
            )}
            {isEditing && (
              <View style={styles.photoOverlay}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Icon name="camera-alt" size={24} color="white" />
                )}
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.roleContainer}>
            <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(userProfile.role) }]}>
              <Text style={styles.roleText}>{getRoleDisplayName(userProfile.role)}</Text>
            </View>
          </View>

          {uploadingImage && (
            <View style={styles.uploadStatus}>
              <ActivityIndicator size="small" color="#257D8C" />
              <Text style={styles.uploadStatusText}>Uploading image...</Text>
            </View>
          )}
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.disabledInput]}
              value={userProfile.name || ''}
              onChangeText={(text) => setUserProfile(prev => ({ ...prev, name: text }))}
              placeholder="Enter your full name"
              editable={isEditing && !saving}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.disabledInput]}
              value={userProfile.email || ''}
              onChangeText={(text) => setUserProfile(prev => ({ ...prev, email: text }))}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={isEditing && !saving}
            />
          </View>
        </View>

        {/* User Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="stars" size={28} color="#C066E3" />
              <Text style={styles.statNumber}>{userStats.totalPoints}</Text>
              <Text style={styles.statLabel}>Total Points</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="shopping-bag" size={28} color="#257D8C" />
              <Text style={styles.statNumber}>{userStats.ordersPlaced}</Text>
              <Text style={styles.statLabel}>Orders Placed</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="videocam" size={28} color="#FF6B6B" />
              <Text style={styles.statNumber}>{userStats.videosRecorded}</Text>
              <Text style={styles.statLabel}>Videos Recorded</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="calendar-today" size={28} color="#4ECDC4" />
              <Text style={styles.statNumber}>{userStats.daysActive}</Text>
              <Text style={styles.statLabel}>Days Active</Text>
            </View>
          </View>
        </View>

        {/* Points Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Points Summary</Text>
          <View style={styles.pointsSummaryCard}>
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Total Points Earned:</Text>
              <Text style={[styles.pointsValue, styles.earnedPoints]}>{userStats.totalPoints + userStats.pointsSpent}</Text>
            </View>
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Points Spent:</Text>
              <Text style={[styles.pointsValue, styles.spentPoints]}>{userStats.pointsSpent}</Text>
            </View>
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>Current Balance:</Text>
              <Text style={[styles.pointsValue, styles.currentPoints]}>{userStats.totalPoints}</Text>
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('OrderHistory')}
          >
            <Icon name="receipt-long" size={24} color="#257D8C" />
            <Text style={styles.actionButtonText}>Order History</Text>
            <Icon name="arrow-forward-ios" size={16} color="#C4E6E8" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('PetInfoScreen')}
          >
            <Icon name="pets" size={24} color="#257D8C" />
            <Text style={styles.actionButtonText}>Pet Profile</Text>
            <Icon name="arrow-forward-ios" size={16} color="#C4E6E8" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'This feature will be available in the next update!')}
          >
            <Icon name="help-outline" size={24} color="#257D8C" />
            <Text style={styles.actionButtonText}>Help & Support</Text>
            <Icon name="arrow-forward-ios" size={16} color="#C4E6E8" />
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since:</Text>
              <Text style={styles.infoValue}>
                {formatJoinDate(userProfile.joinDate)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Type:</Text>
              <Text style={styles.infoValue}>{getRoleDisplayName(userProfile.role)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Points Balance:</Text>
              <Text style={[styles.infoValue, styles.pointsValue]}>{userStats.totalPoints} pts</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Days Active:</Text>
              <Text style={[styles.infoValue, styles.daysActiveValue]}>{userStats.daysActive} days</Text>
            </View>
          </View>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => {
              Alert.alert(
                'Reset Profile Data',
                'This will clear all your pet data, videos, and purchase history. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset Data',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await AsyncStorage.multiRemove([
                          'petInfo',
                          'petVideos',
                          'dispenseLog',
                          'orderHistory',
                          'pointsHistory'
                        ]);
                        await AsyncStorage.setItem('userPoints', '0');
                        Alert.alert('Success', 'Profile data has been reset');
                        loadUserStats();
                      } catch (error) {
                        Alert.alert('Error', 'Failed to reset data');
                      }
                    }
                  }
                ]
              );
            }}
          >
            <Icon name="refresh" size={24} color="#FF4757" />
            <Text style={[styles.actionButtonText, styles.dangerText]}>Reset Profile Data</Text>
            <Icon name="arrow-forward-ios" size={16} color="#FF4757" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => {
              Alert.alert(
                'Clear All Data',
                'This will permanently delete all your local data. This action cannot be undone. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear All Data',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await AsyncStorage.clear();
                        Alert.alert('Success', 'All data cleared successfully');
                        // Reload with fresh data
                        loadUserProfile();
                        loadUserStats();
                      } catch (error) {
                        Alert.alert('Error', 'Failed to clear data');
                      }
                    }
                  }
                ]
              );
            }}
          >
            <Icon name="delete-forever" size={24} color="#FF4757" />
            <Text style={[styles.actionButtonText, styles.dangerText]}>Clear All Data</Text>
            <Icon name="arrow-forward-ios" size={16} color="#FF4757" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Image Picker Modal (Android) */}
      <Modal
        visible={showImagePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.imagePickerModal}>
            <Text style={styles.imagePickerTitle}>Update Profile Photo</Text>
            
            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => {
                setShowImagePicker(false);
                setTimeout(openCamera, 100);
              }}
            >
              <Icon name="camera-alt" size={24} color="#257D8C" />
              <Text style={styles.imagePickerText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => {
                setShowImagePicker(false);
                setTimeout(openImageLibrary, 100);
              }}
            >
              <Icon name="photo-library" size={24} color="#257D8C" />
              <Text style={styles.imagePickerText}>Choose from Library</Text>
            </TouchableOpacity>

            {userProfile.profile_picture_url && (
              <TouchableOpacity
                style={styles.imagePickerOption}
                onPress={removeProfilePhoto}
              >
                <Icon name="delete" size={24} color="#FF4757" />
                <Text style={[styles.imagePickerText, { color: '#FF4757' }]}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.imagePickerCancel}
              onPress={() => setShowImagePicker(false)}
            >
              <Text style={styles.imagePickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F6F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#257D8C',
    fontWeight: '500',
  },
  header: {
    backgroundColor: 'white',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 8,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F9F9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#257D8C',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#FFE6E6',
  },
  editBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F9F9',
  },
  scrollContainer: {
    paddingBottom: 30,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#C4E6E8',
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F9F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#C4E6E8',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#257D8C',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  roleContainer: {
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  roleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#F0F9F9',
    borderRadius: 15,
  },
  uploadStatusText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#257D8C',
    fontWeight: '500',
  },
  section: {
    margin: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#257D8C',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#C4E6E8',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  disabledInput: {
    backgroundColor: '#F8F9FF',
    color: '#666',
    borderColor: '#E0E6E8',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    width: '48%',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  // Points summary styles
  pointsSummaryCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 4,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  pointsLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  earnedPoints: {
    color: '#4ECDC4',
  },
  spentPoints: {
    color: '#FF6B6B',
  },
  currentPoints: {
    color: '#C066E3',
    fontSize: 18,
  },
  actionButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 15,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
    flex: 1,
    fontWeight: '500',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#FFE6E6',
    backgroundColor: '#FFFAFA',
  },
  dangerText: {
    color: '#FF4757',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 18,
    elevation: 4,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  daysActiveValue: {
    color: '#4ECDC4',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 25,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  imagePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
    textAlign: 'center',
    marginBottom: 25,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: '#F8F9FF',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  imagePickerText: {
    fontSize: 16,
    color: '#257D8C',
    marginLeft: 15,
    fontWeight: '500',
  },
  imagePickerCancel: {
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 15,
    borderRadius: 15,
    backgroundColor: '#F1F3F4',
  },
  imagePickerCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});