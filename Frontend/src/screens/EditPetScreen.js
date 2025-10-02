import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

// ✅ CHANGED: Renamed the component to EditPetScreen for clarity
export default function EditPetScreen({ navigation, route }) {
  // ✅ CHANGED: We get the entire 'pet' object that was passed during navigation
  const { pet } = route.params || {};
  const isEditing = !!pet; // This will always be true on this screen

  const [loading, setLoading] = useState(true); // Start loading to populate the form
  const [saving, setSaving] = useState(false);
  
  const [petInfo, setPetInfo] = useState({
    name: '',
    type: 'dog',
    breed: '',
    age: '',
    weight: '',
    size: 'medium',
    activity_level: 'moderate',
    daily_food_amount: '',
    feeding_frequency: '2',
    allergies: '',
    health_conditions: '',
    special_diet: 'none',
    photo: null,
  });

  // UI State (no changes here)
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);

  // Options (no changes here)
  const petTypes = [ { value: 'dog', label: 'Dog', icon: '🐕' }, { value: 'cat', label: 'Cat', icon: '🐱' }, { value: 'bird', label: 'Bird', icon: '🐦' }, { value: 'fish', label: 'Fish', icon: '🐠' }, { value: 'rabbit', label: 'Rabbit', icon: '🐰' }, { value: 'hamster', label: 'Hamster', icon: '🐹' }, { value: 'other', label: 'Other', icon: '🐾' }];
  const petSizes = [ { value: 'small', label: 'Small (< 10kg)', description: 'Chihuahua, Cat, etc.' }, { value: 'medium', label: 'Medium (10-25kg)', description: 'Beagle, Border Collie, etc.' }, { value: 'large', label: 'Large (25-40kg)', description: 'Labrador, Golden Retriever, etc.' }, { value: 'extra_large', label: 'Extra Large (> 40kg)', description: 'Great Dane, Mastiff, etc.' }];
  const activityLevels = [ { value: 'low', label: 'Low Activity', description: 'Mostly indoor, minimal exercise' }, { value: 'moderate', label: 'Moderate Activity', description: 'Daily walks, some playtime' }, { value: 'high', label: 'High Activity', description: 'Very active, lots of exercise' }];
  const specialDiets = [ { value: 'none', label: 'No Special Diet' }, { value: 'grain-free', label: 'Grain-Free' }, { value: 'raw', label: 'Raw Diet' }, { value: 'prescription', label: 'Prescription Diet' }, { value: 'senior', label: 'Senior Formula' }, { value: 'weight-management', label: 'Weight Management' }, { value: 'puppy-kitten', label: 'Puppy/Kitten Formula' }];

  // ✅ CHANGED: This effect now populates the form with the pet's existing data.
  // We don't need to fetch from the API again because the data was already passed to us.
  useEffect(() => {
    if (pet) {
      setPetInfo({
        name: pet.name || '',
        type: pet.type || 'dog',
        breed: pet.breed || '',
        age: pet.age?.toString() || '',
        weight: pet.weight?.toString() || '',
        size: pet.size || 'medium',
        activity_level: pet.activity_level || 'moderate',
        daily_food_amount: pet.daily_food_amount?.toString() || '',
        feeding_frequency: pet.feeding_frequency?.toString() || '2',
        allergies: pet.allergies || '',
        health_conditions: pet.health_conditions || '',
        special_diet: pet.special_diet || 'none',
        photo: pet.photo_url || pet.photo || null,
      });
      setLoading(false); // Done loading
    } else {
      // If for some reason no pet data was passed, show an error and go back.
      Alert.alert('Error', 'Could not load pet data.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [pet]);

  // This effect for recalculating food amount requires no changes.
  useEffect(() => {
    if (petInfo.weight && petInfo.activity_level) {
      calculateRecommendedFoodAmount();
    }
  }, [petInfo.weight, petInfo.activity_level, petInfo.type]);
  
  // No changes needed for this function
  const calculateRecommendedFoodAmount = () => {
    const weight = parseFloat(petInfo.weight);
    if (!weight || weight <= 0) return;
    let baseAmount = 0;
    switch (petInfo.type) {
      case 'dog': baseAmount = weight * 20; break;
      case 'cat': baseAmount = weight * 15; break;
      default: baseAmount = weight * 18;
    }
    switch (petInfo.activity_level) {
      case 'low': baseAmount *= 0.8; break;
      case 'high': baseAmount *= 1.3; break;
      default: baseAmount *= 1.0;
    }
    const recommendedAmount = Math.round(baseAmount / 5) * 5;
    setPetInfo(prev => ({ ...prev, daily_food_amount: recommendedAmount.toString() }));
  };

  // ✅ CHANGED: The logic here is now simplified to only handle updating.
  const handleSave = async () => {

    // ✅ ADD THIS DEBUGGING BLOCK before setSaving(true)
  console.log("--- 📦 Preparing to Update Pet ---");
  console.log("Pet ID:", pet.id);
  const formData = new FormData();
  Object.keys(petInfo).forEach(key => {
    if (key !== 'photo' && petInfo[key] !== null) {
      formData.append(key, String(petInfo[key]));
    }
  });

  if (petInfo.photo && petInfo.photo.startsWith('file://')) {
    const photoAsset = { uri: petInfo.photo, type: 'image/jpeg', name: `pet_photo_${Date.now()}.jpg` };
    formData.append('photo', photoAsset);
  }
    // --- Validation Checks (no changes needed) ---
    if (!petInfo.name.trim()) { Alert.alert('Validation Error', "Please enter your pet's name"); return; }
    if (!petInfo.breed.trim()) { Alert.alert('Validation Error', "Please enter your pet's breed"); return; }
    const age = parseInt(petInfo.age);
    if (isNaN(age) || age <= 0 || age > 50) { Alert.alert('Validation Error', 'Please enter a valid age (1-50 years)'); return; }
    const weight = parseFloat(petInfo.weight);
    if (isNaN(weight) || weight <= 0 || weight > 200) { Alert.alert('Validation Error', 'Please enter a valid weight (0.1-200 kg)'); return; }
    
    setSaving(true);
    try {
      const formData = new FormData();
      Object.keys(petInfo).forEach(key => {
        if (key !== 'photo' && petInfo[key] !== null) {
          formData.append(key, String(petInfo[key]));
        }
      });
      if (petInfo.photo && petInfo.photo.startsWith('file://')) {
        const photoAsset = { uri: petInfo.photo, type: 'image/jpeg', name: 'pet_photo.jpg' };
        formData.append('photo', photoAsset);
      }
      
      // ✅ We now only call the updatePetInfo method, using the pet's ID
      const result = await ApiService.updatePetInfo(pet.id, formData);

      if (result.success) {
        Alert.alert('Success', 'Pet updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        let errorMessage = result.error || 'Failed to update pet information.';
        if (result.errors) {
          errorMessage = Object.values(result.errors)[0][0];
        }
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Pet Info submission error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // No changes needed for photo handling
  const handlePhotoUpload = () => {
    const options = { mediaType: 'photo', quality: 0.7, maxWidth: 500, maxHeight: 500 };
    Alert.alert('Select Photo', 'Choose how you want to select a photo', [
      { text: 'Camera', onPress: () => launchCamera(options, handleImageResponse) },
      { text: 'Photo Library', onPress: () => launchImageLibrary(options, handleImageResponse) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const handleImageResponse = (response) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Error', 'Failed to select image');
    } else if (response.assets && response.assets.length > 0) {
      setPetInfo(prev => ({ ...prev, photo: response.assets[0].uri }));
    }
  };

  // No changes needed for the rest of the file (modals, JSX, styles)
  const renderOptionModal = (visible, onClose, options, currentValue, onSelect, title) => ( <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}> <View style={styles.modalOverlay}> <View style={styles.modalContent}> <View style={styles.modalHeader}> <Text style={styles.modalTitle}>{title}</Text> <TouchableOpacity onPress={onClose} style={styles.closeButton}> <Icon name="close" size={24} color="#666" /> </TouchableOpacity> </View> <FlatList data={options} keyExtractor={(item) => item.value} renderItem={({ item }) => ( <TouchableOpacity style={[ styles.optionItem, currentValue === item.value && styles.selectedOption ]} onPress={() => { onSelect(item.value); onClose(); }} > {item.icon && <Text style={styles.optionIcon}>{item.icon}</Text>} <View style={styles.optionText}> <Text style={[ styles.optionLabel, currentValue === item.value && styles.selectedOptionText ]}> {item.label} </Text> {item.description && ( <Text style={styles.optionDescription}>{item.description}</Text> )} </View> {currentValue === item.value && ( <Icon name="check" size={20} color="#257D8C" /> )} </TouchableOpacity> )} /> </View> </View> </Modal> );
  if (loading) { return ( <SafeAreaView style={styles.container}> <View style={styles.loadingContainer}> <ActivityIndicator size="large" color="#257D8C" /> <Text style={styles.loadingText}>Loading pet information...</Text> </View> </SafeAreaView> ); }
  return ( <SafeAreaView style={styles.container}> <View style={styles.header}> <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} > <Icon name="arrow-back" size={24} color="#257D8C" /> </TouchableOpacity> <Text style={styles.headerTitle}> {isEditing ? 'Edit Pet' : 'Add Pet'} </Text> <View style={styles.headerRight} /> </View> <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}> <View style={styles.section}> <Text style={styles.sectionTitle}>Pet Photo</Text> <TouchableOpacity style={styles.photoContainer} onPress={handlePhotoUpload} > {petInfo.photo ? ( <Image source={{ uri: petInfo.photo }} style={styles.petPhoto} /> ) : ( <View style={styles.photoPlaceholder}> <Icon name="add-a-photo" size={40} color="#C4E6E8" /> <Text style={styles.photoPlaceholderText}>Add Photo</Text> </View> )} </TouchableOpacity> </View> <View style={styles.section}> <Text style={styles.sectionTitle}>Basic Information</Text> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Pet Name *</Text> <TextInput style={styles.textInput} value={petInfo.name} onChangeText={(text) => setPetInfo(prev => ({ ...prev, name: text }))} placeholder="Enter your pet's name" placeholderTextColor="#999" /> </View> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Pet Type *</Text> <TouchableOpacity style={styles.selectInput} onPress={() => setShowTypeModal(true)} > <View style={styles.selectContent}> <Text style={styles.selectIcon}> {petTypes.find(t => t.value === petInfo.type)?.icon} </Text> <Text style={styles.selectText}> {petTypes.find(t => t.value === petInfo.type)?.label} </Text> </View> <Icon name="keyboard-arrow-down" size={24} color="#666" /> </TouchableOpacity> </View> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Breed *</Text> <TextInput style={styles.textInput} value={petInfo.breed} onChangeText={(text) => setPetInfo(prev => ({ ...prev, breed: text }))} placeholder="Enter breed (e.g., Golden Retriever, Persian)" placeholderTextColor="#999" /> </View> <View style={styles.row}> <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}> <Text style={styles.inputLabel}>Age (years) *</Text> <TextInput style={styles.textInput} value={petInfo.age} onChangeText={(text) => setPetInfo(prev => ({ ...prev, age: text }))} placeholder="Age" keyboardType="numeric" placeholderTextColor="#999" /> </View> <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}> <Text style={styles.inputLabel}>Weight (kg) *</Text> <TextInput style={styles.textInput} value={petInfo.weight} onChangeText={(text) => setPetInfo(prev => ({ ...prev, weight: text }))} placeholder="Weight" keyboardType="decimal-pad" placeholderTextColor="#999" /> </View> </View> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Size Category *</Text> <TouchableOpacity style={styles.selectInput} onPress={() => setShowSizeModal(true)} > <Text style={styles.selectText}> {petSizes.find(s => s.value === petInfo.size)?.label} </Text> <Icon name="keyboard-arrow-down" size={24} color="#666" /> </TouchableOpacity> </View> </View> <View style={styles.section}> <Text style={styles.sectionTitle}>Activity & Diet</Text> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Activity Level *</Text> <TouchableOpacity style={styles.selectInput} onPress={() => setShowActivityModal(true)} > <Text style={styles.selectText}> {activityLevels.find(a => a.value === petInfo.activity_level)?.label} </Text> <Icon name="keyboard-arrow-down" size={24} color="#666" /> </TouchableOpacity> </View> <View style={styles.row}> <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}> <Text style={styles.inputLabel}>Daily Food Amount (g) *</Text> <TextInput style={styles.textInput} value={petInfo.daily_food_amount} onChangeText={(text) => setPetInfo(prev => ({ ...prev, daily_food_amount: text }))} placeholder="Amount" keyboardType="numeric" placeholderTextColor="#999" /> <TouchableOpacity style={styles.calculateButton} onPress={calculateRecommendedFoodAmount} > <Icon name="calculate" size={16} color="#257D8C" /> <Text style={styles.calculateButtonText}>Calculate</Text> </TouchableOpacity> </View> <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}> <Text style={styles.inputLabel}>Meals/Day *</Text> <TextInput style={styles.textInput} value={petInfo.feeding_frequency} onChangeText={(text) => setPetInfo(prev => ({ ...prev, feeding_frequency: text }))} placeholder="2" keyboardType="numeric" placeholderTextColor="#999" /> </View> </View> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Special Diet</Text> <TouchableOpacity style={styles.selectInput} onPress={() => setShowDietModal(true)} > <Text style={styles.selectText}> {specialDiets.find(d => d.value === petInfo.special_diet)?.label} </Text> <Icon name="keyboard-arrow-down" size={24} color="#666" /> </TouchableOpacity> </View> </View> <View style={styles.section}> <Text style={styles.sectionTitle}>Health Information</Text> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Allergies</Text> <TextInput style={[styles.textInput, styles.multilineInput]} value={petInfo.allergies} onChangeText={(text) => setPetInfo(prev => ({ ...prev, allergies: text }))} placeholder="List any known allergies..." multiline numberOfLines={3} placeholderTextColor="#999" /> </View> <View style={styles.inputGroup}> <Text style={styles.inputLabel}>Health Conditions</Text> <TextInput style={[styles.textInput, styles.multilineInput]} value={petInfo.health_conditions} onChangeText={(text) => setPetInfo(prev => ({ ...prev, health_conditions: text }))} placeholder="List any health conditions or medical history..." multiline numberOfLines={3} placeholderTextColor="#999" /> </View> </View> <View style={styles.saveSection}> <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving} > {saving ? ( <ActivityIndicator size="small" color="white" /> ) : ( <Icon name="save" size={20} color="white" /> )} <Text style={styles.saveButtonText}> {saving ? 'Saving...' : 'Update Pet'} </Text> </TouchableOpacity> </View> </ScrollView> {renderOptionModal( showTypeModal, () => setShowTypeModal(false), petTypes, petInfo.type, (value) => setPetInfo(prev => ({ ...prev, type: value })), 'Select Pet Type' )} {renderOptionModal( showSizeModal, () => setShowSizeModal(false), petSizes, petInfo.size, (value) => setPetInfo(prev => ({ ...prev, size: value })), 'Select Size Category' )} {renderOptionModal( showActivityModal, () => setShowActivityModal(false), activityLevels, petInfo.activity_level, (value) => setPetInfo(prev => ({ ...prev, activity_level: value })), 'Select Activity Level' )} {renderOptionModal( showDietModal, () => setShowDietModal(false), specialDiets, petInfo.special_diet, (value) => setPetInfo(prev => ({ ...prev, special_diet: value })), 'Select Special Diet' )} </SafeAreaView> );
}

// ✅ Your existing styles work perfectly, no changes needed here.
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#CCFBEC' }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }, loadingText: { marginTop: 10, fontSize: 16, color: '#666' }, header: { backgroundColor: 'white', paddingTop: 15, paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowColor: '#257D8C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, backButton: { padding: 5 }, headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#257D8C' }, headerRight: { width: 34 }, scrollContainer: { flex: 1, paddingBottom: 20 }, section: { backgroundColor: 'white', margin: 15, borderRadius: 15, padding: 20, elevation: 3, shadowColor: '#257D8C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#257D8C', marginBottom: 15 }, photoContainer: { alignItems: 'center', marginBottom: 10 }, petPhoto: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#C4E6E8' }, photoPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f0f9f9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#C4E6E8', borderStyle: 'dashed' }, photoPlaceholderText: { marginTop: 5, fontSize: 12, color: '#666' }, inputGroup: { marginBottom: 15 }, inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }, textInput: { borderWidth: 2, borderColor: '#C4E6E8', borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: '#f8f9ff', color: '#333' }, multilineInput: { height: 80, textAlignVertical: 'top' }, selectInput: { borderWidth: 2, borderColor: '#C4E6E8', borderRadius: 12, padding: 12, backgroundColor: '#f8f9ff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, selectContent: { flexDirection: 'row', alignItems: 'center' }, selectIcon: { fontSize: 20, marginRight: 8 }, selectText: { fontSize: 16, color: '#333' }, row: { flexDirection: 'row', alignItems: 'flex-end' }, calculateButton: { position: 'absolute', right: 8, top: 32, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, calculateButtonText: { fontSize: 12, color: '#257D8C', fontWeight: '600', marginLeft: 4 }, saveSection: { margin: 15 }, saveButton: { backgroundColor: '#257D8C', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#257D8C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }, saveButtonDisabled: { backgroundColor: '#999' }, saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 8 }, modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }, modalContent: { backgroundColor: 'white', borderRadius: 16, width: '90%', maxHeight: '80%', elevation: 10 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' }, modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#257D8C' }, closeButton: { padding: 5 }, optionItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }, selectedOption: { backgroundColor: '#f0f9f9' }, optionIcon: { fontSize: 20, marginRight: 10, width: 30 }, optionText: { flex: 1 }, optionLabel: { fontSize: 16, color: '#333', fontWeight: '500' }, selectedOptionText: { color: '#257D8C', fontWeight: '600' }, optionDescription: { fontSize: 12, color: '#666', marginTop: 2 } });