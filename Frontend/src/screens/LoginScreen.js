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
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors = {};
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const checkExistingPetInfo = async () => {
    try {
      const petInfo = await AsyncStorage.getItem('petInfo');
      return petInfo !== null;
    } catch (error) {
      console.error('Error checking pet info:', error);
      return false;
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const credentials = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      };

      console.log('Attempting to login with email:', credentials.email);

      const result = await ApiService.login(credentials);

      console.log('Login result:', result);

      if (result.success) {
        try {
          // Store authentication data
          await AsyncStorage.setItem('token', result.data.token);
          await AsyncStorage.setItem('user_id', JSON.stringify(result.data.user.id));
          await AsyncStorage.setItem('userData', JSON.stringify(result.data.user));

          console.log('User data stored:', result.data.user);

          // Clear form
          setFormData({ email: '', password: '' });

          // Navigate based on user role
          const userRole = result.data.user.role;
          const userName = result.data.user.name || 'User';
          
          if (userRole === 'user') {
            // Check if user already has pet information
            const hasPetInfo = await checkExistingPetInfo();
            
            if (hasPetInfo) {
              // User already has pet info, go directly to Home
              Alert.alert(
                'Welcome Back!', 
                `Hello ${userName}! Welcome back to Pet Companion.`,
                [
                  {
                    text: 'Continue',
                    onPress: () => {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                      });
                    },
                  },
                ]
              );
            } else {
              // New user needs to set up pet information
              Alert.alert(
                'Welcome to Pet Companion!', 
                `Hi ${userName}! To get personalized recommendations for your pet, please set up your pet's profile.`,
                [
                  {
                    text: 'Set Up Pet Profile',
                    onPress: () => {
                      try {
                        navigation.navigate('PetInfo');
                      } catch (navError) {
                        console.error('Navigation to PetInfo failed:', navError);
                        navigation.navigate('Home');
                      }
                    },
                  },
                  {
                    text: 'Skip for Now',
                    style: 'cancel',
                    onPress: () => {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                      });
                    },
                  },
                ]
              );
            }
          } else if (userRole === 'super_admin') {
            // Super Admin goes directly to dashboard
            Alert.alert(
              'Super Admin Access', 
              `Welcome back, ${userName}! You have super admin privileges.`,
              [
                {
                  text: 'Access Dashboard',
                  onPress: () => {
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Home' }],
                    });
                  },
                },
              ]
            );
          } else if (userRole === 'admin') {
            // Admin/Partner goes directly to dashboard
            Alert.alert(
              'Partner Dashboard', 
              `Welcome ${userName}! Access your partner dashboard to manage products and sales.`,
              [
                {
                  text: 'Access Dashboard',
                  onPress: () => {
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Home' }],
                    });
                  },
                },
              ]
            );
          } else {
            // Default case - unknown role
            console.warn('Unknown user role:', userRole);
            Alert.alert('Login Successful!', `Welcome back, ${userName}!`, [
              {
                text: 'Continue',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                },
              },
            ]);
          }

        } catch (storageError) {
          console.error('Error storing user data:', storageError);
          Alert.alert(
            'Login Successful', 
            'Welcome! There was an issue storing your data, but you are logged in.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                },
              },
            ]
          );
        }
      } else {
        // Handle specific error types
        let errorMessage = result.error || 'Invalid credentials';
        
        // Check for validation errors
        if (result.validationErrors) {
          const serverErrors = {};
          Object.keys(result.validationErrors).forEach(field => {
            const errorArray = result.validationErrors[field];
            if (Array.isArray(errorArray) && errorArray.length > 0) {
              serverErrors[field] = errorArray[0];
            }
          });
          setErrors(prev => ({ ...prev, ...serverErrors }));
          
          const firstValidationError = Object.values(result.validationErrors)[0];
          errorMessage = Array.isArray(firstValidationError) ? firstValidationError[0] : firstValidationError;
        }

        // Handle network errors
        if (result.networkError) {
          errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
        }

        Alert.alert('Login Failed', errorMessage);
      }
    } catch (error) {
      console.error('Unexpected login error:', error);
      Alert.alert('Login Failed', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!formData.email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address first');
      return;
    }

    if (!validateEmail(formData.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Fixed navigation - pass email as a parameter object
    try {
      navigation.navigate('ForgotPassword', { 
        email: formData.email.trim().toLowerCase() 
      });
    } catch (navError) {
      console.error('Navigation error:', navError);
      // Alternative: show a simple input dialog instead of navigation
      Alert.prompt(
        'Forgot Password',
        'Enter your email address to reset password:',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Send Reset Email',
            onPress: async (email) => {
              if (email && validateEmail(email)) {
                setLoading(true);
                try {
                  const result = await ApiService.forgotPassword(email);
                  if (result.success) {
                    Alert.alert('Success', 'Password reset email sent!');
                  } else {
                    Alert.alert('Error', result.error || 'Failed to send reset email');
                  }
                } catch (error) {
                  Alert.alert('Error', 'Network error. Please try again.');
                } finally {
                  setLoading(false);
                }
              } else {
                Alert.alert('Error', 'Please enter a valid email address');
              }
            }
          }
        ],
        'plain-text',
        formData.email
      );
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
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

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.password ? styles.inputError : null]}
                placeholder="Enter your password"
                placeholderTextColor="#8DA3A6"
                secureTextEntry={secure}
                value={formData.password}
                onChangeText={(text) => handleInputChange('password', text)}
                onSubmitEditing={handleLogin}
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

          <TouchableOpacity 
            style={styles.forgotPassword} 
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={[styles.forgotPasswordText, loading && { opacity: 0.6 }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.loginButtonText, { marginLeft: 8 }]}>Signing In...</Text>
              </View>
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
            >
              <Text style={[styles.signUpText, loading && { opacity: 0.6 }]}>Sign Up</Text>
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
    marginBottom: 40 
  },
  logo: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#257D8C' // Dark teal border
  },
  title: { 
    fontSize: 32, 
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
    marginBottom: 20 
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
  errorText: { 
    color: '#E74C3C', // Red for errors
    fontSize: 12, 
    marginTop: 4, 
    marginLeft: 4 
  },
  forgotPassword: { 
    alignSelf: 'flex-end', 
    marginBottom: 24 
  },
  forgotPasswordText: { 
    color: '#257D8C', // Darker teal for better readability
    fontSize: 14, 
    fontWeight: '600' 
  },
  loginButton: { 
    backgroundColor: '#257D8C', // Dark teal primary button
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 24,
    shadowColor: '#257D8C',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonDisabled: { 
    backgroundColor: '#8DA3A6' // Muted teal when disabled
  },
  loginButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  loadingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  divider: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  dividerLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: '#C8E6E3' // Light teal divider
  },
  dividerText: { 
    marginHorizontal: 16, 
    color: '#5A7B7D', // Medium teal
    fontSize: 14 
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
  signUpText: { 
    color: '#257D8C', // Darker teal for better readability
    fontSize: 14, 
    fontWeight: '600' 
  },
});