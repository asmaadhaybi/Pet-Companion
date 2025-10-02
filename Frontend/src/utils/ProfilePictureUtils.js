// utils/ProfilePictureUtils.js
import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper functions to manage profile picture across the app

// Get user profile picture
export const getUserProfilePicture = async () => {
  try {
    const profilePicture = await AsyncStorage.getItem('userProfilePicture');
    return profilePicture;
  } catch (error) {
    console.error('Error getting profile picture:', error);
    return null;
  }
};

// Get user data with profile picture
export const getUserData = async () => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    const profilePicture = await AsyncStorage.getItem('userProfilePicture');
    
    if (userData) {
      const parsedData = JSON.parse(userData);
      return {
        ...parsedData,
        photo: profilePicture || parsedData.photo,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Save profile picture separately
export const saveUserProfilePicture = async (imageUri) => {
  try {
    if (imageUri) {
      await AsyncStorage.setItem('userProfilePicture', imageUri);
    } else {
      await AsyncStorage.removeItem('userProfilePicture');
    }
    return true;
  } catch (error) {
    console.error('Error saving profile picture:', error);
    return false;
  }
};

// ProfileAvatar Component - Use this in HomeScreen and other screens
export const ProfileAvatar = ({ 
  photo, 
  size = 40, 
  borderColor = '#C4E6E8', 
  borderWidth = 2,
  style = {},
  onPress = null 
}) => {
  const avatarSize = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const AvatarContent = () => (
    <View style={[avatarSize, { borderWidth, borderColor }, style]}>
      {photo ? (
        <Image 
          source={{ uri: photo }} 
          style={[avatarSize, styles.avatar]} 
          resizeMode="cover"
        />
      ) : (
        <View style={[avatarSize, styles.placeholderAvatar]}>
          <Icon 
            name="person" 
            size={size * 0.6} 
            color={borderColor} 
          />
        </View>
      )}
    </View>
  );

  return <AvatarContent />;
};

// Hook to use profile picture in any component
export const useUserProfilePicture = () => {
  const [profilePicture, setProfilePicture] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const data = await getUserData();
      setUserData(data);
      setProfilePicture(data?.photo);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  return {
    profilePicture,
    userData,
    loading,
    refreshProfileData: loadProfileData,
  };
};

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 50,
  },
  placeholderAvatar: {
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
});