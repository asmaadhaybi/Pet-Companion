import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user', // default role
  });

  const [secure, setSecure] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!['user', 'admin', 'super_admin'].includes(formData.role)) {
      newErrors.role = 'Invalid role selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      };

      console.log('Attempting to register with data:', { ...userData, password: '[HIDDEN]' });

      const result = await ApiService.register(userData);

      console.log('Registration result:', result);

      if (result.success) {
        // Check if we have the required data for authentication
        if (result.data.token && result.data.user) {
          try {
            // Store authentication data
            await AsyncStorage.setItem('token', result.data.token);
            await AsyncStorage.setItem('user_id', JSON.stringify(result.data.user.id));
            await AsyncStorage.setItem('userData', JSON.stringify(result.data.user));

            console.log('User data stored:', result.data.user);

            // Clear form data
            setFormData({
              name: '',
              email: '',
              password: '',
              confirmPassword: '',
              role: 'user',
            });

            Alert.alert('Success', result.data.message || 'Account created successfully!', [
              {
                text: 'OK',
                onPress: () => {
                  // Simple navigation back to Login screen
                  // The user can log in with their new credentials
                  try {
                    navigation.navigate('Login');
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                    // If Login navigation fails, just go back
                    navigation.goBack();
                  }
                },
              },
            ]);
          } catch (storageError) {
            console.error('Error storing user data:', storageError);
            Alert.alert(
              'Registration Successful', 
              'Your account has been created but there was an issue storing your data. Please log in with your credentials.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('Login')
                }
              ]
            );
          }
        } else {
          // Registration was successful but we don't have auth data
          console.warn('Registration successful but missing auth data:', result);
          Alert.alert(
            'Registration Successful', 
            'Your account has been created. Please log in with your credentials.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Login')
              }
            ]
          );
        }
      } else {
        // Handle specific error types
        let errorMessage = result.error || 'Something went wrong';
        
        // Check for validation errors
        if (result.validationErrors) {
          // Display server validation errors in form fields
          const serverErrors = {};
          Object.keys(result.validationErrors).forEach(field => {
            const errorArray = result.validationErrors[field];
            if (Array.isArray(errorArray) && errorArray.length > 0) {
              serverErrors[field] = errorArray[0];
            }
          });
          setErrors(prev => ({ ...prev, ...serverErrors }));
          
          // Show first validation error in alert
          const firstValidationError = Object.values(result.validationErrors)[0];
          errorMessage = Array.isArray(firstValidationError) ? firstValidationError[0] : firstValidationError;
        }

        // Handle network errors
        if (result.networkError) {
          errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
        }

        Alert.alert('Registration Failed', errorMessage);
      }
    } catch (error) {
      console.error('Unexpected registration error:', error);
      Alert.alert('Registration Failed', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={require('../assets/logo_pet_companion.jpeg')} style={styles.logo} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join our pet companion community</Text>
        </View>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="Enter your full name"
              placeholderTextColor="#8DA3A6"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              editable={!loading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="Enter your email"
              placeholderTextColor="#8DA3A6"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              editable={!loading}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.password ? styles.inputError : null]}
                placeholder="Create a password (min 6 characters)"
                placeholderTextColor="#8DA3A6"
                secureTextEntry={secure}
                value={formData.password}
                onChangeText={(text) => handleInputChange('password', text)}
                editable={!loading}
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setSecure(!secure)}
                disabled={loading}
              >
                <Text style={styles.eyeIcon}>{secure ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.confirmPassword ? styles.inputError : null]}
                placeholder="Confirm your password"
                placeholderTextColor="#8DA3A6"
                secureTextEntry={secureConfirm}
                value={formData.confirmPassword}
                onChangeText={(text) => handleInputChange('confirmPassword', text)}
                editable={!loading}
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setSecureConfirm(!secureConfirm)}
                disabled={loading}
              >
                <Text style={styles.eyeIcon}>{secureConfirm ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

          {/* Role Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Account Type</Text>
            <View style={[styles.pickerContainer, errors.role ? styles.inputError : null]}>
              <Picker
                selectedValue={formData.role}
                style={styles.picker}
                onValueChange={(value) => handleInputChange('role', value)}
                enabled={!loading}
              >
                <Picker.Item label="User" value="user" />
                <Picker.Item label="Admin" value="admin" />
                <Picker.Item label="Super Admin" value="super_admin" />
              </Picker>
            </View>
            {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.registerButtonText, { marginLeft: 8 }]}>Creating Account...</Text>
              </View>
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={[styles.signInText, loading && { opacity: 0.6 }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#E8F6F5' // Very light teal background
  },
  scrollContainer: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 40 
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 32 
  },
  logo: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#257D8C' // Dark teal border
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#257D8C', // Dark teal title
    marginBottom: 8 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#5A7B7D', // Medium teal for subtitle
    textAlign: 'center' 
  },
  form: { 
    width: '100%' 
  },
  inputContainer: { 
    marginBottom: 16 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#257D8C', // Dark teal labels
    marginBottom: 8 
  },
  input: { 
    backgroundColor: '#fff', 
    borderWidth: 2, 
    borderColor: '#C8E6E3', // Light teal border
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    color: '#257D8C' // Dark teal text
  },
  inputError: { 
    borderColor: '#E74C3C' // Red for errors
  },
  passwordContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderWidth: 2, 
    borderColor: '#C8E6E3', // Light teal border
    borderRadius: 12 
  },
  passwordInput: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    color: '#257D8C' // Dark teal text
  },
  eyeButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 14 
  },
  eyeIcon: { 
    fontSize: 18 
  },
  pickerContainer: { 
    backgroundColor: '#fff', 
    borderWidth: 2, 
    borderColor: '#C8E6E3', // Light teal border
    borderRadius: 12, 
    overflow: 'hidden' 
  },
  picker: { 
    height: 50, 
    width: '100%',
    color: '#257D8C' // Dark teal text
  },
  errorText: { 
    color: '#E74C3C', // Red for errors
    fontSize: 12, 
    marginTop: 4, 
    marginLeft: 4 
  },
  registerButton: { 
    backgroundColor: '#257D8C', // Dark teal primary button
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 24,
    marginTop: 8,
    shadowColor: '#257D8C',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  registerButtonDisabled: { 
    backgroundColor: '#8DA3A6' // Muted teal when disabled
  },
  registerButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  loadingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  footerText: { 
    color: '#5A7B7D', // Medium teal
    fontSize: 14 
  },
  signInText: { 
    color: '#257D8C', // Dark teal for better readability
    fontSize: 14, 
    fontWeight: '600' 
  },
});