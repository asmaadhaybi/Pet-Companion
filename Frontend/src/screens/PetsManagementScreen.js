import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

export default function PetsManagementScreen({ navigation }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePet, setActivePet] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [petToDelete, setPetToDelete] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPetForPhoto, setSelectedPetForPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [deletingPet, setDeletingPet] = useState(false);
  const [isSettingActive, setIsSettingActive] = useState(false); // ✅ ADD THIS LINE


  // useEffect(() => {
  //   loadPets();
  //   loadActivePet();
  // }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadPetData();
    });
    return unsubscribe;
  }, [navigation]);

const loadPetData = async () => {
    setLoading(true);
    try {
      const result = await ApiService.getAllPets();

      if (result.success && Array.isArray(result.data)) {
        const petsFromServer = result.data;
        setPets(petsFromServer);

        // Find the active pet from the server data
        const activePetFromServer = petsFromServer.find(pet => pet.is_active) || petsFromServer[0];
        setActivePet(activePetFromServer);
        
        // Update storage to keep everything in sync
        await AsyncStorage.setItem('userPets', JSON.stringify(petsFromServer));
        if (activePetFromServer) {
          await AsyncStorage.setItem('activePet', JSON.stringify(activePetFromServer));
        }

      } else {
        // Fallback to local storage if API fails
        const storedPets = await AsyncStorage.getItem('userPets');
        if (storedPets) {
          setPets(JSON.parse(storedPets));
        }
      }
    } catch (error) {
      console.error('Error loading pet data:', error);
      Alert.alert('Error', 'Could not load pet data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };
  
  // ❌ REMOVE the old loadPets() function.
  // ❌ REMOVE the old loadActivePet() function.

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPetData(); // Make sure refresh also calls the new function
    setRefreshing(false);
  };


  const loadActivePet = async () => {
    try {
      const storedActivePet = await AsyncStorage.getItem('activePet');
      if (storedActivePet) {
        setActivePet(JSON.parse(storedActivePet));
      }
    } catch (error) {
      console.error('Error loading active pet:', error);
    }
  };

  // const onRefresh = async () => {
  //   setRefreshing(true);
  //   await loadPets();
  //   setRefreshing(false);
  // };

// screens/PetsManagementScreen.js

const handleSetActivePet = async (petToActivate) => {
  setIsSettingActive(true);

  try {
    const result = await ApiService.setActivePet(petToActivate.id);

    if (result.success && result.data?.success) {
      const updatedActivePet = result.data.data;
      const successMessage = result.data.message;

      setActivePet(updatedActivePet);
      await AsyncStorage.setItem('activePet', JSON.stringify(updatedActivePet));

      const updatedPetsList = pets.map(p => ({
        ...p,
        is_active: p.id === updatedActivePet.id,
      }));
      setPets(updatedPetsList);
      await AsyncStorage.setItem('userPets', JSON.stringify(updatedPetsList));

      Alert.alert('Success', successMessage || `${updatedActivePet.name} is now your active pet!`);
      
      // ✅ --- KEY FIX ---
      // Navigate back to the HomeScreen and pass the new active pet as a parameter.
      // This tells the HomeScreen to update its state immediately.
      navigation.navigate('Home', { newActivePet: updatedActivePet });
      
    } else {
      Alert.alert('Error', result.error || 'Failed to set active pet.');
    }
  } catch (error) {
    console.error('Error setting active pet:', error);
    Alert.alert('Error', 'An unexpected error occurred.');
  } finally {
    setIsSettingActive(false);
    setShowActionModal(false);
  }
};



// screens/PetsManagementScreen.js

// In screens/PetsManagementScreen.js

const handleEditPet = (pet) => {
  setShowActionModal(false);
  // ✅ This is the fix.
  // We navigate to 'PetInfo' and pass the pet's ID as a parameter.
  navigation.navigate('PetInfo', { petId: pet.id });
};

  const handleDeletePet = (pet) => {
    setShowActionModal(false);
    setPetToDelete(pet);
    setShowDeleteModal(true);
  };

  const confirmDeletePet = async () => {
    if (!petToDelete) return;

    try {
      setDeletingPet(true);

      console.log('[UI] Deleting pet id:', petToDelete.id);
      
      // Make the API call using DELETE /api/pets/{id}
      const result = await ApiService.deletePet(petToDelete.id);

      console.log('[UI] delete result:', result);

      // Check for success response
      if (result && (result.success === true || result.message === 'Pet deleted successfully' || result.status === 'success')) {
        // Success — update UI state & AsyncStorage
        const updatedPets = pets.filter(p => p.id !== petToDelete.id);
        setPets(updatedPets);
        await AsyncStorage.setItem('userPets', JSON.stringify(updatedPets));

        // Update active pet if the deleted pet was active
        if (activePet?.id === petToDelete.id) {
          const newActivePet = updatedPets.length > 0 ? updatedPets[0] : null;
          setActivePet(newActivePet);
          if (newActivePet) {
            await AsyncStorage.setItem('activePet', JSON.stringify(newActivePet));
          } else {
            await AsyncStorage.removeItem('activePet');
          }
        }

        Alert.alert('Success', `${petToDelete.name} has been removed from your pets.`);
      } else {
        // Handle different failure shapes
        const msg = result?.message || result?.error || 'Failed to delete pet';
        console.warn('[UI] Delete failed:', msg, result);
        Alert.alert('Error', msg);
      }
    } catch (error) {
      console.error('Error deleting pet:', error);
      Alert.alert('Error', 'Failed to delete pet. Please try again.');
    } finally {
      setDeletingPet(false);
      setShowDeleteModal(false);
      setPetToDelete(null);
    }
  };

  const handleAddPhoto = (pet) => {
    setShowActionModal(false);
    setSelectedPetForPhoto(pet);
    setShowPhotoModal(true);
  };

  const handlePetCardPress = (pet) => {
    setSelectedPet(pet);
    setShowActionModal(true);
  };

// screens/PetsManagementScreen.js
// Replace these methods in your PetsManagementScreen.js

// screens/PetsManagementScreen.js

// ... (inside your PetsManagementScreen component)

  const pickImage = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 600,
    };
    // This uses the correct callback structure
    launchImageLibrary(options, async (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      if (response.assets && response.assets[0] && selectedPetForPhoto) {
        await uploadPhoto(response.assets[0]);
      }
    });
  };

  const takePhoto = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 600,
      saveToPhotos: true,
    };
    // This uses the correct callback structure
    launchCamera(options, async (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      if (response.assets && response.assets[0] && selectedPetForPhoto) {
        await uploadPhoto(response.assets[0]);
      }
    });
  };
// screens/PetsManagementScreen.js

const uploadPhoto = async (imageAsset) => {
  if (!selectedPetForPhoto) {
    Alert.alert('Error', 'No pet was selected.');
    return;
  }

  setUploadingPhoto(true);

  try {
    // ✅ FIXED: We will call the dedicated upload function from your ApiService
    // This is much cleaner than a raw fetch call here.
    const result = await ApiService.uploadPetPhoto(selectedPetForPhoto.id, imageAsset);

    console.log('--- SERVER RESPONSE ---', result);

    if (result.success) {
      // The backend should return the full updated pet object.
      // Let's assume it's in result.data.pet or result.data
      const updatedPetFromServer = result.data?.pet || result.data;

      const updatedPets = pets.map(pet => {
        if (pet.id === selectedPetForPhoto.id) {
          // ✅ CORE FIX: MERGE the existing pet data with the new data from the server
          return { ...pet, ...updatedPetFromServer };
        }
        return pet;
      });

      setPets(updatedPets);
      await AsyncStorage.setItem('userPets', JSON.stringify(updatedPets));

      // Also update the active pet if it's the one being changed
      if (activePet?.id === selectedPetForPhoto.id) {
        const newActivePet = updatedPets.find(p => p.id === selectedPetForPhoto.id);
        setActivePet(newActivePet);
        await AsyncStorage.setItem('activePet', JSON.stringify(newActivePet));
      }

      Alert.alert('Success', 'Photo updated successfully!');
    } else {
      throw new Error(result.error || 'Failed to upload photo');
    }

  } catch (error) {
    console.error('--- UPLOAD FAILED ---', error);
    Alert.alert('Upload Failed', error.message);
  } finally {
    setUploadingPhoto(false);
    setShowPhotoModal(false);
    setSelectedPetForPhoto(null);
  }
};
  
//   // // This is the debugging version with the corrected function call
//   const uploadPhoto = async (imageAsset) => {
//     if (!selectedPetForPhoto) {
//       Alert.alert('Error', 'No pet was selected.');
//       return;
//     }

//     try {
//       setUploadingPhoto(true);

//       console.log(
//         '--- STEP 1: DATA FROM selectedPetForPhoto ---',
//         JSON.stringify(selectedPetForPhoto, null, 2)
//       );

//       const formData = new FormData();
      
//       Object.keys(selectedPetForPhoto).forEach(key => {
//         if (key !== 'photo' && key !== 'photo_url' && selectedPetForPhoto[key] != null) {
//           formData.append(key, String(selectedPetForPhoto[key]));
//         }
//       });

//       formData.append('photo', {
//         uri: imageAsset.uri,
//         type: imageAsset.type || 'image/jpeg',
//         name: imageAsset.fileName || 'pet_photo.jpg',
//       });
      
//       formData.append('_method', 'PUT');

//       console.log('--- STEP 2: FORMDATA TO BE SENT ---', formData._parts);

//       // --- FIXED: Changed getAuthToken to getToken ---
//       const token = await ApiService.getToken(); 
//       const petId = selectedPetForPhoto.id;
//       const url = `http://192.168.2.224:8000/api/pets/${petId}`;

//       console.log(`--- STEP 3: SENDING REQUEST TO: ${url} ---`);
      
//       const response = await fetch(url, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Accept': 'application/json',
//         },
//         body: formData,
//       });

//       const responseText = await response.text();
//       const resultData = JSON.parse(responseText);

//       console.log('--- STEP 4: SERVER RESPONSE ---', {
//         status: response.status,
//         body: resultData,
//       });

//       if (!response.ok) {
//         throw new Error(resultData.message || 'Validation Failed');
//       }

//       const updatedPetFromServer = resultData.data?.pet || resultData.data;

//       const updatedPets = pets.map(pet =>
//         pet.id === petId ? updatedPetFromServer : pet
//       );
//       setPets(updatedPets);
//       await AsyncStorage.setItem('userPets', JSON.stringify(updatedPets));
//       if (activePet?.id === petId) {
//           setActivePet(updatedPetFromServer);
//           await AsyncStorage.setItem('activePet', JSON.stringify(updatedPetFromServer));
//       }
//       Alert.alert('Success', 'Photo updated successfully!');

//     } catch (error) {
//       console.error('--- UPLOAD FAILED ---', error);
//       Alert.alert('Upload Failed', error.message);
//     } finally {
//       setUploadingPhoto(false);
//       setShowPhotoModal(false);
//       setSelectedPetForPhoto(null);
//     }
//   };

//   // screens/PetsManagementScreen.js

// // const uploadPhoto = async (imageAsset) => {
// //   if (!selectedPetForPhoto) {
// //     Alert.alert('Error', 'No pet was selected.');
// //     return;
// //   }

// //   setUploadingPhoto(true);

// //   try {
// //     // ✅ FIXED: We will call the dedicated upload function from your ApiService
// //     // This is much cleaner than a raw fetch call here.
// //     const result = await ApiService.uploadPetPhoto(selectedPetForPhoto.id, imageAsset);

// //     console.log('--- SERVER RESPONSE ---', result);

// //     if (result.success) {
// //       // The backend should return the full updated pet object.
// //       // Let's assume it's in result.data.pet or result.data
// //       const updatedPetFromServer = result.data?.pet || result.data;

// //       const updatedPets = pets.map(pet => {
// //         if (pet.id === selectedPetForPhoto.id) {
// //           // ✅ CORE FIX: MERGE the existing pet data with the new data from the server
// //           return { ...pet, ...updatedPetFromServer };
// //         }
// //         return pet;
// //       });

// //       setPets(updatedPets);
// //       await AsyncStorage.setItem('userPets', JSON.stringify(updatedPets));

// //       // Also update the active pet if it's the one being changed
// //       if (activePet?.id === selectedPetForPhoto.id) {
// //         const newActivePet = updatedPets.find(p => p.id === selectedPetForPhoto.id);
// //         setActivePet(newActivePet);
// //         await AsyncStorage.setItem('activePet', JSON.stringify(newActivePet));
// //       }

// //       Alert.alert('Success', 'Photo updated successfully!');
// //     } else {
// //       throw new Error(result.error || 'Failed to upload photo');
// //     }

// //   } catch (error) {
// //     console.error('--- UPLOAD FAILED ---', error);
// //     Alert.alert('Upload Failed', error.message);
// //   } finally {
// //     setUploadingPhoto(false);
// //     setShowPhotoModal(false);
// //     setSelectedPetForPhoto(null);
// //   }
// // };

  const handleDeletePhoto = async (pet) => {
    try {
      Alert.alert(
        'Delete Photo',
        `Are you sure you want to delete ${pet.name}'s photo?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Call the delete photo endpoint DELETE /api/pets/delete-photo
                const result = await ApiService.deletePetPhoto(pet.id);

                console.log('[UI] Photo delete result:', result);
                
                if (result && (result.success === true || result.message === 'Photo deleted successfully' || result.status === 'success')) {
                  // Update the pet in local state
                  const updatedPets = pets.map(p => {
                    if (p.id === pet.id) {
                      return { 
                        ...p, 
                        photo: null, 
                        photo_url: null
                      };
                    }
                    return p;
                  });
                  
                  setPets(updatedPets);
                  await AsyncStorage.setItem('userPets', JSON.stringify(updatedPets));
                  
                  // Update active pet if necessary
                  if (activePet?.id === pet.id) {
                    const updatedActivePet = updatedPets.find(p => p.id === pet.id);
                    setActivePet(updatedActivePet);
                    await AsyncStorage.setItem('activePet', JSON.stringify(updatedActivePet));
                  }
                  
                  Alert.alert('Success', 'Photo deleted successfully!');
                } else {
                  Alert.alert('Error', result?.message || result?.error || 'Failed to delete photo');
                }
              } catch (error) {
                console.error('Error deleting photo:', error);
                Alert.alert('Error', 'Failed to delete photo. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in handleDeletePhoto:', error);
    }
  };

  const getPetIcon = (type) => {
    const icons = {
      dog: '🐕',
      cat: '🐱',
      bird: '🐦',
      fish: '🐠',
      rabbit: '🐰',
      hamster: '🐹',
    };
    return icons[type] || '🐾';
  };

  const getSizeLabel = (size) => {
    const labels = {
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      extra_large: 'Extra Large',
    };
    return labels[size] || size;
  };

  const getActivityLabel = (level) => {
    const labels = {
      low: 'Low Activity',
      moderate: 'Moderate Activity',
      high: 'High Activity',
    };
    return labels[level] || level;
  };

  const renderPetCard = ({ item: pet }) => {
    const isActive = activePet?.id === pet.id;
    
    return (
      <TouchableOpacity 
        style={[styles.petCard, isActive && styles.activePetCard]}
        onPress={() => handlePetCardPress(pet)}
        activeOpacity={0.7}
      >
        <View style={styles.petCardHeader}>
          <View style={styles.petImageContainer}>
            {pet.photo_url || pet.photo ? (
              <Image 
                source={{ uri: pet.photo_url || pet.photo }} 
                style={styles.petImage}
                onError={() => console.log('Failed to load pet image')}
              />
            ) : (
              <View style={styles.petImagePlaceholder}>
                <Text style={styles.petImageIcon}>{getPetIcon(pet.type)}</Text>
              </View>
            )}
            {isActive && (
              <View style={styles.activeIndicator}>
                <Icon name="star" size={16} color="#FFD700" />
              </View>
            )}
          </View>
          
          <View style={styles.petInfo}>
            <View style={styles.petNameRow}>
              <Text style={styles.petName}>{pet.name}</Text>
              {isActive && <Text style={styles.activeLabel}>Active</Text>}
            </View>
            <Text style={styles.petBreed}>{pet.breed}</Text>
            <Text style={styles.petDetails}>
              {pet.age} {pet.age === 1 ? 'year' : 'years'} • {pet.weight}kg • {getSizeLabel(pet.size)}
            </Text>
            <Text style={styles.petActivity}>{getActivityLabel(pet.activity_level)}</Text>
          </View>

          <TouchableOpacity 
            style={styles.moreOptionsBtn}
            onPress={() => handlePetCardPress(pet)}
          >
            <Icon name="more-vert" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Pet Stats */}
        <View style={styles.petStats}>
          <View style={styles.statItem}>
            <Icon name="restaurant" size={16} color="#257D8C" />
            <Text style={styles.statText}>{pet.daily_food_amount}g/day</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="schedule" size={16} color="#257D8C" />
            <Text style={styles.statText}>{pet.feeding_frequency}x meals</Text>
          </View>
          {pet.special_diet && pet.special_diet !== 'none' && (
            <View style={styles.statItem}>
              <Icon name="local-dining" size={16} color="#E67E22" />
              <Text style={styles.statText}>{pet.special_diet}</Text>
            </View>
          )}
        </View>

        {/* Health Alerts */}
        {(pet.allergies || pet.health_conditions) && (
          <View style={styles.healthAlerts}>
            {pet.allergies && (
              <View style={styles.alertItem}>
                <Icon name="warning" size={14} color="#E74C3C" />
                <Text style={styles.alertText}>Allergies: {pet.allergies}</Text>
              </View>
            )}
            {pet.health_conditions && (
              <View style={styles.alertItem}>
                <Icon name="local-hospital" size={14} color="#9B59B6" />
                <Text style={styles.alertText}>Health: {pet.health_conditions}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="pets" size={80} color="#C4E6E8" />
      <Text style={styles.emptyTitle}>No Pets Yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first pet to get started with personalized care recommendations
      </Text>
      <TouchableOpacity
        style={styles.addFirstPetBtn}
        onPress={() => navigation.navigate('PetInfo')}
      >
        <Icon name="add" size={20} color="white" />
        <Text style={styles.addFirstPetText}>Add Your First Pet</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257D8C" />
          <Text style={styles.loadingText}>Loading your pets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#257D8C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Pets</Text>
        
        {/* <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('PetInfo')}
        >
          <Icon name="add" size={24} color="#257D8C" />
        </TouchableOpacity> */}
                <View style={styles.headerRight}>
        </View>
      </View>

      {pets.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryText}>
              {pets.length} {pets.length === 1 ? 'pet' : 'pets'} registered
            </Text>
            {activePet && (
              <Text style={styles.activePetText}>
                Active: {activePet.name}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.addNewPetBtn}
            onPress={() => navigation.navigate('PetInfo')}
          >
            <Icon name="add" size={16} color="#257D8C" />
            <Text style={styles.addNewPetText}>Add Pet</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={pets}
        renderItem={renderPetCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#257D8C']}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Pet Actions Modal */}
      <Modal
        visible={showActionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <View style={styles.actionModalHeader}>
              <View style={styles.petModalInfo}>
                {selectedPet?.photo_url || selectedPet?.photo ? (
                  <Image 
                    source={{ uri: selectedPet.photo_url || selectedPet.photo }} 
                    style={styles.petModalImage}
                  />
                ) : (
                  <View style={styles.petModalImagePlaceholder}>
                    <Text style={styles.petModalImageIcon}>
                      {getPetIcon(selectedPet?.type)}
                    </Text>
                  </View>
                )}
                <View style={styles.petModalDetails}>
                  <Text style={styles.petModalName}>{selectedPet?.name}</Text>
                  <Text style={styles.petModalBreed}>{selectedPet?.breed}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowActionModal(false)}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.actionsList}>
              {activePet?.id !== selectedPet?.id && (
                
                <TouchableOpacity
  style={styles.actionItem}
  disabled={isSettingActive} // This disables the button while loading
  onPress={() => handleSetActivePet(selectedPet)}
>
  <Icon name="star-border" size={24} color="#F39C12" />
  <Text style={styles.actionText}>Set as Active Pet</Text>
  
  {/* ✅ FIXED: This now correctly checks isSettingActive */}
  {isSettingActive ? (
    <ActivityIndicator color="#F39C12" />
  ) : (
    <Icon name="chevron-right" size={20} color="#ccc" />
  )}
</TouchableOpacity> 
              )}

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleEditPet(selectedPet)}
              >
                <Icon name="edit" size={24} color="#257D8C" />
                <Text style={styles.actionText}>Edit Information</Text>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleAddPhoto(selectedPet)}
              >
                <Icon name="camera-alt" size={24} color="#9B59B6" />
                <Text style={styles.actionText}>
                  {selectedPet?.photo_url || selectedPet?.photo ? 'Update Photo' : 'Add Photo'}
                </Text>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              {(selectedPet?.photo_url || selectedPet?.photo) && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleDeletePhoto(selectedPet)}
                >
                  <Icon name="delete-outline" size={24} color="#FF6B6B" />
                  <Text style={styles.actionText}>Remove Photo</Text>
                  <Icon name="chevron-right" size={20} color="#ccc" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionItem, styles.dangerAction]}
                onPress={() => handleDeletePet(selectedPet)}
              >
                <Icon name="delete" size={24} color="#E74C3C" />
                <Text style={[styles.actionText, styles.dangerText]}>Delete Pet</Text>
                <Icon name="chevron-right" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => !deletingPet && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <Icon name="warning" size={48} color="#E74C3C" />
            <Text style={styles.deleteTitle}>Delete Pet?</Text>
            <Text style={styles.deleteMessage}>
              Are you sure you want to remove {petToDelete?.name} from your pets?
              This action cannot be undone and will delete all associated data.
            </Text>
            
            {deletingPet ? (
              <View style={styles.deletingContainer}>
                <ActivityIndicator size="large" color="#E74C3C" />
                <Text style={styles.deletingText}>Deleting pet...</Text>
              </View>
            ) : (
              <View style={styles.deleteActions}>
                <TouchableOpacity
                  style={[styles.deleteActionBtn, styles.cancelBtn]}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteActionBtn, styles.confirmDeleteBtn]}
                  onPress={confirmDeletePet}
                >
                  <Text style={styles.confirmDeleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Photo Upload Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !uploadingPhoto && setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoModal}>
            <Text style={styles.photoModalTitle}>
              {selectedPetForPhoto?.photo_url || selectedPetForPhoto?.photo ? 'Update' : 'Add'} Photo for {selectedPetForPhoto?.name}
            </Text>
            
            {uploadingPhoto ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#257D8C" />
                <Text style={styles.uploadingText}>Uploading photo...</Text>
              </View>
            ) : (
              <View style={styles.photoOptions}>
                <TouchableOpacity
                  style={styles.photoOption}
                  onPress={takePhoto}
                >
                  <Icon name="camera-alt" size={32} color="#257D8C" />
                  <Text style={styles.photoOptionText}>Take New Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.photoOption}
                  onPress={pickImage}
                >
                  <Icon name="photo-library" size={32} color="#257D8C" />
                  <Text style={styles.photoOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {!uploadingPhoto && (
              <TouchableOpacity
                style={styles.photoModalClose}
                onPress={() => setShowPhotoModal(false)}
              >
                <Text style={styles.photoModalCloseText}>Cancel</Text>
              </TouchableOpacity>
            )}
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
    marginTop: 16,
    fontSize: 16,
    color: '#257D8C',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  addBtn: {
    padding: 4,
  },
  summary: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6E3',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryText: {
    fontSize: 14,
    color: '#257D8C',
    fontWeight: '600',
  },
  activePetText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addNewPetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#257D8C',
  },
  addNewPetText: {
    color: '#257D8C',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  petCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  activePetCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#FFFDF0',
  },
  petCardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  petImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  petImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#C4E6E8',
  },
  petImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C4E6E8',
  },
  petImageIcon: {
    fontSize: 32,
  },
  activeIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  petInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  petName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
    flex: 1,
  },
  activeLabel: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#B8860B',
  },
  petBreed: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  petActivity: {
    fontSize: 12,
    color: '#34A853',
    fontWeight: '600',
  },
  moreOptionsBtn: {
    padding: 4,
  },
  petStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  healthAlerts: {
    backgroundColor: '#FFF8F0',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 11,
    color: '#D35400',
    marginLeft: 6,
    flex: 1,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 20,
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  addFirstPetBtn: {
    backgroundColor: '#257D8C',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addFirstPetText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    elevation: 10,
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  petModalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  petModalImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#C4E6E8',
    marginRight: 12,
  },
  petModalImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C4E6E8',
    marginRight: 12,
  },
  petModalImageIcon: {
    fontSize: 20,
  },
  petModalDetails: {
    flex: 1,
  },
  petModalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  petModalBreed: {
    fontSize: 14,
    color: '#666',
  },
  closeModalBtn: {
    padding: 4,
  },
  actionsList: {
    maxHeight: 400,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 16,
    fontWeight: '500',
  },
  dangerAction: {
    backgroundColor: '#FFF5F5',
  },
  dangerText: {
    color: '#E74C3C',
  },
  deleteModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    elevation: 10,
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginTop: 16,
    marginBottom: 12,
  },
  deleteMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deletingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  deletingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#E74C3C',
  },
  deleteActions: {
    flexDirection: 'row',
    width: '100%',
  },
  deleteActionBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f3f4',
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    backgroundColor: '#E74C3C',
  },
  confirmDeleteBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  photoModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    elevation: 10,
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 24,
    textAlign: 'center',
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#257D8C',
  },
  photoOptions: {
    width: '100%',
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f8f9ff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C4E6E8',
  },
  photoOptionText: {
    fontSize: 16,
    color: '#257D8C',
    fontWeight: '600',
    marginLeft: 16,
  },
  photoModalClose: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  photoModalCloseText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});