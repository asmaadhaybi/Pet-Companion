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
} from 'react-native';
import ApiService from '../services/api';

export default function ForgotPasswordScreen({ navigation, route }) {
  const [email, setEmail] = useState(route?.params?.email || '');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [secure, setSecure] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const result = await ApiService.forgotPassword(email.trim().toLowerCase());
      
      console.log('Forgot password result:', result);

      if (result.success) {
        Alert.alert(
          'Reset Link Sent', 
          'Check your email for the reset token, or use the token shown below for testing.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (result.reset_token) {
                  setResetToken(result.reset_token);
                  Alert.alert(
                    'Testing Token',
                    `Your reset token is: ${result.reset_token}\n\nIn production, this would be sent to your email.`,
                    [{ text: 'OK', onPress: () => setStep(2) }]
                  );
                } else {
                  setStep(2);
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to send reset link');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newErrors = {};

    if (!resetToken.trim()) {
      newErrors.resetToken = 'Reset token is required';
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const resetData = {
        email: email.trim().toLowerCase(),
        token: resetToken.trim(),
        password: newPassword,
        password_confirmation: confirmPassword,
      };

      const result = await ApiService.resetPassword(resetData);

      if (result.success) {
        Alert.alert('Success', 'Password reset successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <View style={styles.header}>
        <Image source={require('../assets/logo_pet_companion.jpeg')} style={styles.logo} />
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>Enter your email address and we'll send you a reset link</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#a0a0a0"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendResetLink}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.header}>
        <Image source={require('../assets/logo_pet_companion.jpeg')} style={styles.logo} />
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your reset token and new password</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Reset Token</Text>
          <TextInput
            style={[styles.input, errors.resetToken ? styles.inputError : null]}
            placeholder="Enter reset token from email"
            placeholderTextColor="#a0a0a0"
            value={resetToken}
            onChangeText={(text) => {
              setResetToken(text);
              if (errors.resetToken) setErrors(prev => ({ ...prev, resetToken: '' }));
            }}
          />
          {errors.resetToken && <Text style={styles.errorText}>{errors.resetToken}</Text>}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, errors.newPassword ? styles.inputError : null]}
              placeholder="Enter new password"
              placeholderTextColor="#a0a0a0"
              secureTextEntry={secure}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (errors.newPassword) setErrors(prev => ({ ...prev, newPassword: '' }));
              }}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setSecure(!secure)}>
              <Text style={styles.eyeIcon}>{secure ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>
          {errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Confirm new password"
              placeholderTextColor="#a0a0a0"
              secureTextEntry={secureConfirm}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
              }}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setSecureConfirm(!secureConfirm)}>
              <Text style={styles.eyeIcon}>{secureConfirm ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(1)}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {step === 1 ? renderStep1() : renderStep2()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#CCFMEC' // Light background from palette
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
    borderColor: '#257D8C' // Primary color border
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#257D8C', // Primary color
    marginBottom: 8 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center', 
    lineHeight: 24 
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
    color: '#257D8C', // Primary color
    marginBottom: 8 
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#C4E6E8', // Light teal border
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  inputError: { 
    borderColor: '#C066E3' // Purple accent for errors
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#C4E6E8', // Light teal border
    borderRadius: 12,
  },
  passwordInput: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    color: '#333' 
  },
  eyeButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 14 
  },
  eyeIcon: { 
    fontSize: 18 
  },
  errorText: { 
    color: '#C066E3', // Purple accent for error text
    fontSize: 12, 
    marginTop: 4, 
    marginLeft: 4 
  },
  button: {
    backgroundColor: '#257D8C', // Primary color
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: { 
    backgroundColor: '#a8a8a8' 
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  backButton: { 
    alignSelf: 'center' 
  },
  backButtonText: { 
    color: '#257D8C', // Primary color
    fontSize: 14, 
    fontWeight: '600' 
  },
});