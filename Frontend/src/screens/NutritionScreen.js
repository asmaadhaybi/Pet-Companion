import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Alert, Modal, TextInput, ActivityIndicator, Dimensions, Image, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

// Put this ABOVE your component, after imports
function formatDispenseTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffHours < 1) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

const { width } = Dimensions.get('window');

// Progress Bar Component for Sensor Levels
const LevelProgressBar = ({ label, level, icon, color }) => (
    <View style={styles.progressBarContainer}>
        <View style={styles.progressBarHeader}>
            <Icon name={icon} size={16} color={color} />
            <Text style={styles.progressBarLabel}>{label}</Text>
        </View>
        <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${level}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.progressBarPercentage}>{level}% Full</Text>
    </View>
);

export default function NutritionScreen({ navigation }) {
  const [activePet, setActivePet] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(false);
  const [containerLevels, setContainerLevels] = useState(null);
  
  // Dispense modal state
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [dispenseType, setDispenseType] = useState('');
  const [dispenseAmount, setDispenseAmount] = useState('');
  const [isSavingGoals, setIsSavingGoals] = useState(false);

  // History and stats
  const [dispenseHistory, setDispenseHistory] = useState([]);
  const [nutritionStats, setNutritionStats] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [nutritionGoals, setNutritionGoals] = useState(null);
  const [formGoals, setFormGoals] = useState({
        daily_calorie_goal: '0',
        daily_water_goal: '0',
        daily_treats_goal: '0',
        daily_medication_goal: '0',
    });
    // ✅ REVISED: State for schedules fetched from the server
    const [schedules, setSchedules] = useState([]);
    // ✅ NEW: State for the schedule management modal
    const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
    const [currentSchedule, setCurrentSchedule] = useState(null); // For editing
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
 // ✅ NEW: States to manage the auto-dispense UI
    const [autoDispenseEnabled, setAutoDispenseEnabled] = useState(false);
    const [autoDispenseThreshold, setAutoDispenseThreshold] = useState(20);
  // Enhanced feeding schedule state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [feedingSchedule, setFeedingSchedule] = useState([]);
  const [customSchedule, setCustomSchedule] = useState({
    meal_times: ['08:00', '18:00'],
    portions: []
  });

  useFocusEffect(
    React.useCallback(() => {
        loadInitialData();
    }, [])
  );

  // useEffect for automatic refreshing of sensor levels
  useEffect(() => {
    if (activePet) {
      const intervalId = setInterval(() => {
        console.log("Refreshing container levels...");
        loadContainerLevels(activePet.id);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(intervalId); // Cleanup on screen exit
    }
  }, [activePet]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
        const petData = await AsyncStorage.getItem('activePet');
        const pet = petData ? JSON.parse(petData) : null;
        setActivePet(pet);
        if (pet) {
            setAutoDispenseEnabled(pet.auto_dispense_enabled || false);
            setAutoDispenseThreshold(pet.auto_dispense_threshold || 20);
        }
        await loadUserPoints();

        if (pet) {
            await Promise.all([
                loadDispenseHistory(pet.id),
                loadNutritionStats(pet.id),
                loadContainerLevels(pet.id),
                loadNutritionGoals(pet.id),
                //generateFeedingSchedule(pet),
                loadSchedules(pet.id) // ✅ NEW: Fetch schedules

            ]);
        }
    } catch (error) {
        console.error('Error loading initial data:', error);
    } finally {
        setLoading(false);
    }
  };
 // --- DATA LOADING FUNCTIONS ---
    const loadSchedules = async (petId) => {
        const response = await ApiService.getDispenseSchedules(petId);
        if (response.success && response.data?.data?.schedules) {
            setSchedules(response.data.data.schedules);
        } else {
            setSchedules([]);
            console.error("Failed to fetch schedules:", response.error);
        }
    };

     // --- SCHEDULE MANAGEMENT ---
    const handleAddNewSchedule = () => {
        setCurrentSchedule({ type: 'food', amount: '', schedule_time: '08:00', is_active: true });
        setIsScheduleModalVisible(true);
    };

    const handleEditSchedule = (schedule) => {
        setCurrentSchedule(schedule);
        setIsScheduleModalVisible(true);
    };

    const handleSaveSchedule = async () => {
        if (!currentSchedule || !currentSchedule.amount || !currentSchedule.schedule_time) {
            Alert.alert("Invalid Input", "Please fill in all schedule details.");
            return;
        }

        setIsSavingSchedule(true);
        const scheduleData = { ...currentSchedule, pet_id: activePet.id };

        const response = scheduleData.id
            ? await ApiService.updateDispenseSchedule(scheduleData.id, scheduleData)
            : await ApiService.saveDispenseSchedule(scheduleData);

        if (response.success) {
            Alert.alert("Success", `Schedule ${scheduleData.id ? 'updated' : 'saved'}!`);
            await loadSchedules(activePet.id); // Refresh the list
            setIsScheduleModalVisible(false);
            setCurrentSchedule(null);
        } else {
            Alert.alert("Error", "Could not save schedule. " + (response.error || ''));
        }
        setIsSavingSchedule(false);
    };

    const handleDeleteSchedule = (scheduleId) => {
        Alert.alert(
            "Delete Schedule",
            "Are you sure you want to delete this schedule?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const response = await ApiService.deleteDispenseSchedule(scheduleId);
                        if (response.success) {
                            Alert.alert("Deleted", "Schedule has been removed.");
                            await loadSchedules(activePet.id);
                        } else {
                            Alert.alert("Error", "Could not delete schedule.");
                        }
                    },
                },
            ]
        );
    };
  // Generate feeding schedule based on pet data
  const generateFeedingSchedule = async (pet) => {
    if (!pet) return;
    
    const frequency = parseInt(pet.feeding_frequency, 10) || 2;
    const dailyAmount = parseFloat(pet.daily_food_amount) || 100;
    const portionSize = Math.round(dailyAmount / frequency);
    
    // Generate default meal times based on frequency
    let mealTimes = [];
    if (frequency === 1) {
      mealTimes = ['08:00'];
    } else if (frequency === 2) {
      mealTimes = ['08:00', '18:00'];
    } else if (frequency === 3) {
      mealTimes = ['08:00', '13:00', '18:00'];
    } else {
      // For 4+ meals, spread throughout the day
      const intervalHours = Math.floor(12 / (frequency - 1));
      mealTimes = Array.from({ length: frequency }, (_, index) => {
        const hour = 8 + (index * intervalHours);
        return `${hour.toString().padStart(2, '0')}:00`;
      });
    }

    const schedule = mealTimes.map((time, index) => ({
      id: index + 1,
      time: time,
      portion: portionSize,
      completed: false,
      last_fed: null
    }));

    setFeedingSchedule(schedule);
  };

  // Function to load sensor data from the API
  const loadContainerLevels = async (petId) => {
    if (!petId) return;
    try {
        const response = await ApiService.getContainerLevels(petId);
        if (response.success) {
            setContainerLevels(response.data.data);
        } else {
            console.error("Failed to fetch container levels:", response.error);
            setContainerLevels(null);
        }
    } catch (error) {
        console.error('Error loading container levels:', error);
        setContainerLevels(null);
    }
  };

  const loadUserPoints = async () => {
    try {
      const response = await ApiService.getUserPoints();
      if (response.success && response.data?.data) {
        setUserPoints(response.data.data.points || 0);
      }
    } catch (error) {
      console.error('Error loading user points:', error);
    }
  };

  const loadDispenseHistory = async (petId) => {
    if (!petId) return;
    try {
      const response = await ApiService.getDispenseHistory(petId);
      if (response.success && response.data?.data?.data) {
        setDispenseHistory(response.data.data.data);
      } else {
        setDispenseHistory([]);
      }
    } catch (error) {
      console.error('Error loading dispense history:', error);
      setDispenseHistory([]);
    }
  };

  const loadNutritionStats = async (petId) => {
    if (!petId) return;
    try {
      const response = await ApiService.getNutritionStats(petId);
      if (response.success) {
        setNutritionStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading nutrition stats:', error);
    }
  };

  const getRecommendedAmount = (type) => {
    if (!activePet) return '...';
    
    const weight = parseFloat(activePet.weight) || 1;
    
    switch (type) {
      case 'water':
        return Math.round(weight * 30).toString();
      case 'food':
        return Math.round(weight * 20).toString();
      case 'treats':
        return Math.round(weight * 2).toString();
      case 'medication':
        return '1'; // Default to 1 pill/unit
      default:
        return '';
    }
  };

  const loadNutritionGoals = async (petId) => {
        if (!petId) return;
        try {
            const response = await ApiService.getNutritionGoals(petId);
            if (response.success && response.data?.data) {
                const goals = response.data.data;
                setNutritionGoals(goals);
                setFormGoals({
                    daily_calorie_goal: (goals.daily_calorie_goal || '0').toString(),
                    daily_water_goal: (goals.daily_water_goal || '0').toString(),
                    daily_treats_goal: (goals.daily_treats_goal || '0').toString(),
                    daily_medication_goal: (goals.daily_medication_goal || '0').toString(),
                });
            }
        } catch (error) {
            console.error('Error loading nutrition goals:', error);
        }
    };
    
    const handleEditGoals = () => {
        if (nutritionGoals) {
            setFormGoals({
                daily_calorie_goal: (nutritionGoals.daily_calorie_goal || '0').toString(),
                daily_water_goal: (nutritionGoals.daily_water_goal || '0').toString(),
                daily_treats_goal: (nutritionGoals.daily_treats_goal || '0').toString(),
                daily_medication_goal: (nutritionGoals.daily_medication_goal || '0').toString(),
            });
        }
        setShowGoalsModal(true);
    };

    const handleSaveGoals = async () => {
        if (!activePet) return;
        setIsSavingGoals(true);
        try {
            const goalsToSave = {
                daily_calorie_goal: parseInt(formGoals.daily_calorie_goal, 10) || 0,
                daily_water_goal: parseInt(formGoals.daily_water_goal, 10) || 0,
                daily_treats_goal: parseInt(formGoals.daily_treats_goal, 10) || 0,
                daily_medication_goal: parseInt(formGoals.daily_medication_goal, 10) || 0,
            };
            const response = await ApiService.updateNutritionGoals(activePet.id, goalsToSave);
            if (response.success) {
                Alert.alert('Success', 'Nutrition goals have been updated!');
                await loadNutritionGoals(activePet.id);
                setShowGoalsModal(false);
            } else {
                Alert.alert('Error', 'Could not save goals. Please try again.');
            }
        } catch (error) {
            console.error('Error saving goals:', error);
            Alert.alert('Error', 'An unexpected error occurred.');
        } finally {
            setIsSavingGoals(false);
        }
    };
 // ✅ NEW: Handler function to save settings to the backend
    const handleAutoDispenseSettingsChange = async (settings) => {
        if (!activePet) return;

        // Optimistically update UI
        if (settings.auto_dispense_enabled !== undefined) {
            setAutoDispenseEnabled(settings.auto_dispense_enabled);
        }
        if (settings.auto_dispense_threshold !== undefined) {
            setAutoDispenseThreshold(settings.auto_dispense_threshold);
        }

        // Send update to server
        const response = await ApiService.updateAutoDispenseSettings(activePet.id, {
             auto_dispense_enabled: settings.auto_dispense_enabled ?? autoDispenseEnabled,
        water_auto_threshold: settings.water_auto_threshold ?? autoDispenseThreshold,
        });

        if (!response.success) {
            Alert.alert("Error", "Could not save settings. Please try again.");
            // Revert UI on failure
            setAutoDispenseEnabled(activePet.auto_dispense_enabled || false);
            setAutoDispenseThreshold(activePet.auto_dispense_threshold || 20);
        } else {
            // Optionally, update the activePet object in AsyncStorage
            const updatedPet = response.data.data;
            await AsyncStorage.setItem('activePet', JSON.stringify(updatedPet));
            setActivePet(updatedPet);
        }
    };
  const handleDispense = (type) => {
    if (!activePet) {
      Alert.alert(
        'Pet Setup Required',
        'Please set up your pet profile first to use nutrition features.',
        [{ text: 'OK' }]
      );
      return;
    }
    setDispenseType(type);
    setDispenseAmount(getRecommendedAmount(type));
    setShowDispenseModal(true);
  };

const confirmDispense = async () => {
    if (!dispenseAmount || isNaN(dispenseAmount) || parseFloat(dispenseAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setDispensing(true);
    try {
      const dispenseData = { pet_id: activePet.id, amount: parseFloat(dispenseAmount) };
      let response;

      switch (dispenseType) {
        case 'food': response = await ApiService.dispenseFood(dispenseData); break;
        case 'water': response = await ApiService.dispenseWater(dispenseData); break;
        case 'treats': response = await ApiService.dispenseTreats(dispenseData); break;
        // ✅ FIXED: Changed 'meds' to 'medication' to match the button press
        case 'medication': response = await ApiService.dispenseMedication(dispenseData); break; 
        default: throw new Error('Invalid dispense type');
      }

      if (response.success) {
        const responseData = response.data.data; 

        setUserPoints(responseData.total_user_points);
        await AsyncStorage.setItem('userPoints', responseData.total_user_points.toString());

        await loadDispenseHistory(activePet.id);
        await loadNutritionStats(activePet.id);

        const unit = dispenseType === 'water' ? 'ml' : 
                     dispenseType === 'medication' ? ' unit(s)' : 'g';
        
        Alert.alert(
          'Dispense Successful!',
          `Dispensed ${dispenseAmount}${unit} of ${dispenseType} for ${activePet.name}\n\n+${responseData.points_earned} points earned!`,
          [{ text: 'OK' }]
        );
        
        setShowDispenseModal(false);
        setDispenseAmount('');
      } else {
        Alert.alert('Error', response.error || 'Failed to dispense');
      }
    } catch (error) {
      console.error('Dispense error:', error);
      Alert.alert('Error', 'Failed to dispense. Please try again.');
    } finally {
      setDispensing(false);
    }
  };

  // Enhanced feeding schedule functions
  const handleScheduledFeed = (scheduleItem) => {
    setDispenseType('food');
    setDispenseAmount(scheduleItem.portion.toString());
    setShowDispenseModal(true);
  };

  const markMealComplete = (mealId) => {
    setFeedingSchedule(prev => 
      prev.map(meal => 
        meal.id === mealId 
          ? { ...meal, completed: true, last_fed: new Date().toISOString() }
          : meal
      )
    );
  };

  const resetDailySchedule = () => {
    setFeedingSchedule(prev =>
      prev.map(meal => ({ ...meal, completed: false, last_fed: null }))
    );
  };

  const getDispenseIcon = (type) => {
    switch (type) {
      case 'water': return 'water-drop';
      case 'food': return 'restaurant';
      case 'treats': return 'cake';
      case 'medication': 
      case 'meds': return 'medication';
      default: return 'circle';
    }
  };

  const getDispenseColor = (type) => {
    switch (type) {
      case 'water': return '#45B7D1';
      case 'food': return '#FF6B6B';
      case 'treats': return '#F39C12';
      case 'medication':
      case 'meds': return '#9B59B6';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257D8C" />
          <Text style={styles.loadingText}>Loading nutrition data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#257D8C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Nutrition</Text>
        <View style={styles.headerRight}>
        </View>
      </View>
 {/* ✅ REVISED: Automated Mode Toggle Section */}
                <View style={styles.section}>
                    <View style={styles.automatedModeSection}>
                        <View style={styles.toggleHeader}>
                            <Text style={styles.toggleTitle}>Automated Dispensing</Text>
                            <Switch
                                value={autoDispenseEnabled}
                                onValueChange={(newValue) => handleAutoDispenseSettingsChange({ auto_dispense_enabled: newValue })}
                                trackColor={{ false: '#ccc', true: '#4ECDC4' }}
                                thumbColor={autoDispenseEnabled ? '#257D8C' : '#f4f3f4'}
                            />
                        </View>
                        
                        {autoDispenseEnabled && (
                            <View style={styles.thresholdSetting}>
                                <Text style={styles.thresholdLabel}>
                                    Dispense when levels are below: {autoDispenseThreshold}%
                                </Text>
                                <View style={styles.thresholdButtons}>
                                    {[10, 15, 20, 25].map(threshold => (
                                        <TouchableOpacity
                                            key={threshold}
                                            style={[
                                                styles.thresholdButton,
                                                autoDispenseThreshold === threshold && styles.thresholdButtonActive
                                            ]}
                                            onPress={() => handleAutoDispenseSettingsChange({ auto_dispense_threshold: threshold })}
                                        >
                                            <Text style={[
                                                styles.thresholdButtonText,
                                                autoDispenseThreshold === threshold && styles.thresholdButtonTextActive
                                            ]}>
                                                {threshold}%
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                </View>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Active Pet Card */}
        {activePet && (
          <View style={styles.petCard}>
            <View style={styles.petCardLeft}>
              {activePet.photo ? (
                <Image source={{ uri: activePet.photo }} style={styles.petAvatar} />
              ) : (
                <View style={styles.petIconContainer}>
                  <Text style={styles.petIcon}>
                    {activePet.type === 'dog' ? '🐕' : 
                     activePet.type === 'cat' ? '🐱' : '🐾'}
                  </Text>
                </View>
              )}
              <View style={styles.petDetails}>
                <Text style={styles.petName}>{activePet.name}</Text>
                <Text style={styles.petInfo}>
                  {activePet.weight}kg • {activePet.activity_level} activity
                </Text>
                <Text style={styles.petSubInfo}>
                  Daily food: {activePet.daily_food_amount}g • {activePet.feeding_frequency} meals
                </Text>
              </View>
            </View>
            <View style={styles.pointsContainer}>
              <Icon name="stars" size={16} color="#C066E3" />
              <Text style={styles.pointsText}>{userPoints} pts</Text>
            </View>
          </View>
        )}
        {/* Container Levels Section */}
        {containerLevels && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Container Levels</Text>
                <View style={styles.levelsCard}>
                    <LevelProgressBar label="Water" icon="water-drop" level={containerLevels.water_level} color="#45B7D1" />
                    <LevelProgressBar label="Food" icon="restaurant" level={containerLevels.food_level} color="#FF6B6B" />
                    <LevelProgressBar label="Treats" icon="cake" level={containerLevels.treats_level} color="#F39C12" />
                    <LevelProgressBar label="Medication" icon="medication" level={containerLevels.medication_level} color="#9B59B6" />
                </View>
            </View>
        )}

        {/* Quick Dispense Actions - Now includes Medication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Dispense</Text>
          
          <View style={styles.dispenseGrid}>
            <TouchableOpacity
              style={[styles.dispenseBtn, { backgroundColor: '#45B7D1' }]}
              onPress={() => handleDispense('water')}
            >
              <Icon name="water-drop" size={24} color="white" />
              <Text style={styles.dispenseBtnTitle}>Water</Text>
              <Text style={styles.dispenseBtnSubtitle}>
                Rec: {getRecommendedAmount('water')}ml
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dispenseBtn, { backgroundColor: '#FF6B6B' }]}
              onPress={() => handleDispense('food')}
            >
              <Icon name="restaurant" size={24} color="white" />
              <Text style={styles.dispenseBtnTitle}>Food</Text>
              <Text style={styles.dispenseBtnSubtitle}>
                Rec: {getRecommendedAmount('food')}g
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.dispenseGrid, { marginTop: 10 }]}>
            <TouchableOpacity
              style={[styles.dispenseBtn, { backgroundColor: '#F39C12' }]}
              onPress={() => handleDispense('treats')}
            >
              <Icon name="cake" size={24} color="white" />
              <Text style={styles.dispenseBtnTitle}>Treats</Text>
              <Text style={styles.dispenseBtnSubtitle}>
                Rec: {getRecommendedAmount('treats')}g
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dispenseBtn, { backgroundColor: '#9B59B6' }]}
              onPress={() => handleDispense('medication')}
            >
              <Icon name="medication" size={24} color="white" />
              <Text style={styles.dispenseBtnTitle}>Meds</Text>
              <Text style={styles.dispenseBtnSubtitle}>
                Rec: {getRecommendedAmount('medication')} unit
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Nutrition Stats - Now includes Medication */}
        {nutritionStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly Statistics</Text>
            
            <View style={styles.statsCard}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Icon name="water-drop" size={24} color="#45B7D1" />
                  <Text style={styles.statValue}>{nutritionStats.total_water}ml</Text>
                  <Text style={styles.statLabel}>Water</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Icon name="restaurant" size={24} color="#FF6B6B" />
                  <Text style={styles.statValue}>{nutritionStats.total_food}g</Text>
                  <Text style={styles.statLabel}>Food</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Icon name="cake" size={24} color="#F39C12" />
                  <Text style={styles.statValue}>{nutritionStats.total_treats}g</Text>
                  <Text style={styles.statLabel}>Treats</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Icon name="medication" size={24} color="#9B59B6" />
                  <Text style={styles.statValue}>{nutritionStats.total_medication || 0}</Text>
                  <Text style={styles.statLabel}>Meds</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Enhanced Feeding Schedule */}
        {/* ✅ REVISED: Today's Feeding Schedule Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Feeding Schedules</Text>
                        <TouchableOpacity onPress={handleAddNewSchedule} style={styles.addScheduleBtn}>
                            <Icon name="add" size={16} color="white" />
                            <Text style={styles.addScheduleText}>Add New</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.scheduleCard}>
                        {schedules.length > 0 ? schedules.map(schedule => (
                            <View key={schedule.id} style={styles.scheduleItem}>
                                <Icon name={getDispenseIcon(schedule.type)} size={24} color={getDispenseColor(schedule.type)} />
                                <View style={styles.scheduleDetails}>
                                    <Text style={styles.scheduleTime}>{schedule.schedule_time}</Text>
                                    <Text style={styles.scheduleAmount}>{schedule.amount}g {schedule.type}</Text>
                                </View>
                                <Switch value={schedule.is_active} onValueChange={async (value) => {
                                    await ApiService.updateDispenseSchedule(schedule.id, { ...schedule, is_active: value });
                                    await loadSchedules(activePet.id);
                                }} />
                                <TouchableOpacity onPress={() => handleEditSchedule(schedule)} style={{ marginLeft: 10 }}>
                                    <Icon name="edit" size={20} color="#666" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteSchedule(schedule.id)} style={{ marginLeft: 10 }}>
                                    <Icon name="delete" size={20} color="#FF6B6B" />
                                </TouchableOpacity>
                            </View>
                        )) : (
                            <Text style={styles.emptyHistoryText}>No schedules set up yet.</Text>
                        )}
                    </View>
                </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => setShowHistory(true)}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.historyCard}>
            {dispenseHistory.slice(0, 3).map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Icon 
                    name={getDispenseIcon(item.type)} 
                    size={20} 
                    color={getDispenseColor(item.type)} 
                  />
                </View>
                <View style={styles.historyDetails}>
                  <Text style={styles.historyTitle}>
                    {item.amount}{item.type === 'water' ? 'ml' : 
                                   item.type === 'medication' || item.type === 'meds' ? ' units' : 'g'} {item.type}
                  </Text>
                  <Text style={styles.historyTime}>
                    {formatDispenseTime(item.dispensed_at || item.timestamp)}
                  </Text>
                </View>
                <Text style={styles.historyPoints}>+1 pts</Text>
              </View>
            ))}
            
            {dispenseHistory.length === 0 && (
              <View style={styles.emptyHistory}>
                <Icon name="info" size={24} color="#999" />
                <Text style={styles.emptyHistoryText}>No nutrition activity yet</Text>
                <Text style={styles.emptyHistorySubtext}>Start dispensing to track nutrition</Text>
              </View>
            )}
          </View>
        </View>

        {/* Nutrition Goals Section */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Nutrition Goals</Text>
                <TouchableOpacity onPress={handleEditGoals}>
                    <Icon name="edit" size={20} color="#C066E3" />
                </TouchableOpacity>
            </View>
            <View style={styles.guidelinesCard}>
                {/* Water Goal */}
                <View style={styles.guidelineItem}>
                    <Text style={styles.guidelineIcon}>💧</Text>
                    <View style={styles.guidelineText}>
                        <Text style={styles.guidelineTitle}>Daily Water Goal</Text>
                        <Text style={styles.guidelineDescription}>
                            {nutritionGoals?.daily_water_goal ?? '...'}ml per day
                        </Text>
                    </View>
                </View>
                {/* Calorie Goal */}
                <View style={styles.guidelineItem}>
                    <Text style={styles.guidelineIcon}>🔥</Text>
                    <View style={styles.guidelineText}>
                        <Text style={styles.guidelineTitle}>Daily Calorie Goal</Text>
                        <Text style={styles.guidelineDescription}>
                            {nutritionGoals?.daily_calorie_goal ?? '...'} kcal per day
                        </Text>
                    </View>
                </View>
                {/* Treats Goal */}
                <View style={styles.guidelineItem}>
                    <Text style={styles.guidelineIcon}>🦴</Text>
                    <View style={styles.guidelineText}>
                        <Text style={styles.guidelineTitle}>Max Daily Treats</Text>
                        <Text style={styles.guidelineDescription}>
                            {nutritionGoals?.daily_treats_goal ?? '...'}g per day
                        </Text>
                    </View>
                </View>
                {/* Medication Goal */}
                <View style={styles.guidelineItem}>
                    <Text style={styles.guidelineIcon}>💊</Text>
                    <View style={styles.guidelineText}>
                        <Text style={styles.guidelineTitle}>Daily Medication</Text>
                        <Text style={styles.guidelineDescription}>
                            {nutritionGoals?.daily_medication_goal ?? '...'} units per day
                        </Text>
                    </View>
                </View>
            </View>
        </View>
      </ScrollView>

      {/* Enhanced Dispense Modal */}
      <Modal
        visible={showDispenseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDispenseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dispense {dispenseType}</Text>
            <Text style={styles.modalSubtitle}>
              For {activePet?.name || 'your pet'} ({activePet?.weight || 5}kg)
            </Text>
            <Text style={styles.recommendedText}>
              Recommended: {getRecommendedAmount(dispenseType)}
              {dispenseType === 'water' ? 'ml' : 
               dispenseType === 'medication' ? ' unit(s)' : 'g'}
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder={`Enter amount (${dispenseType === 'water' ? 'ml' : 
                                             dispenseType === 'medication' ? 'units' : 'g'})`}
              value={dispenseAmount}
              onChangeText={setDispenseAmount}
              keyboardType="numeric"
              editable={!dispensing}
            />
            
            <View style={styles.quickAmountButtons}>
              <TouchableOpacity
                style={styles.quickAmountBtn}
                onPress={() => setDispenseAmount(getRecommendedAmount(dispenseType))}
                disabled={dispensing}
              >
                <Text style={styles.quickAmountText}>Recommended</Text>
              </TouchableOpacity>
              {dispenseType !== 'medication' && (
                <>
                  <TouchableOpacity
                    style={styles.quickAmountBtn}
                    onPress={() => setDispenseAmount((parseFloat(getRecommendedAmount(dispenseType)) * 0.5).toString())}
                    disabled={dispensing}
                  >
                    <Text style={styles.quickAmountText}>Half</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickAmountBtn}
                    onPress={() => setDispenseAmount((parseFloat(getRecommendedAmount(dispenseType)) * 1.5).toString())}
                    disabled={dispensing}
                  >
                    <Text style={styles.quickAmountText}>Extra</Text>
                  </TouchableOpacity>
                </>
              )}
              {dispenseType === 'medication' && (
                <>
                  <TouchableOpacity
                    style={styles.quickAmountBtn}
                    onPress={() => setDispenseAmount('2')}
                    disabled={dispensing}
                  >
                    <Text style={styles.quickAmountText}>2 units</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickAmountBtn}
                    onPress={() => setDispenseAmount('3')}
                    disabled={dispensing}
                  >
                    <Text style={styles.quickAmountText}>3 units</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowDispenseModal(false)}
                disabled={dispensing}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn, dispensing && styles.confirmBtnDisabled]}
                onPress={confirmDispense}
                disabled={dispensing}
              >
                {dispensing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmBtnText}>Dispense</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Goals Modal */}
      <Modal
          visible={showGoalsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowGoalsModal(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Set Nutrition Goals</Text>
                  <Text style={styles.modalSubtitle}>For {activePet?.name}</Text>
                  
                  {/* Calorie Goal Input */}
                  <Text style={styles.notesLabel}>Daily Calorie Goal (kcal)</Text>
                  <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., 250"
                      value={formGoals.daily_calorie_goal}
                      onChangeText={(text) => setFormGoals({...formGoals, daily_calorie_goal: text})}
                      keyboardType="numeric"
                  />
                  
                  {/* Water Goal Input */}
                  <Text style={styles.notesLabel}>Daily Water Goal (ml)</Text>
                  <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., 300"
                      value={formGoals.daily_water_goal}
                      onChangeText={(text) => setFormGoals({...formGoals, daily_water_goal: text})}
                      keyboardType="numeric"
                  />
                  
                  {/* Treats Goal Input */}
                  <Text style={styles.notesLabel}>Max Daily Treats (g)</Text>
                  <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., 10"
                      value={formGoals.daily_treats_goal}
                      onChangeText={(text) => setFormGoals({...formGoals, daily_treats_goal: text})}
                      keyboardType="numeric"
                  />

                  {/* Medication Goal Input */}
                  <Text style={styles.notesLabel}>Daily Medication Goal (units)</Text>
                  <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., 1"
                      value={formGoals.daily_medication_goal}
                      onChangeText={(text) => setFormGoals({...formGoals, daily_medication_goal: text})}
                      keyboardType="numeric"
                  />

                  {/* Modal Buttons */}
                  <View style={styles.modalButtons}>
                      <TouchableOpacity
                          style={[styles.modalBtn, styles.cancelBtn]}
                          onPress={() => setShowGoalsModal(false)}
                          disabled={isSavingGoals}
                      >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                          style={[styles.modalBtn, styles.confirmBtn, isSavingGoals && styles.confirmBtnDisabled]}
                          onPress={handleSaveGoals}
                          disabled={isSavingGoals}
                      >
                          {isSavingGoals ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.confirmBtnText}>Save Goals</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      {/* Schedule Settings Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Feeding Schedule Settings</Text>
            <Text style={styles.modalSubtitle}>Customize your pet's feeding times</Text>
            
            <ScrollView style={styles.scheduleModalContent}>
              <Text style={styles.notesLabel}>Current Schedule</Text>
              {feedingSchedule.map((meal, index) => (
                <View key={meal.id} style={styles.scheduleModalItem}>
                  <Text style={styles.scheduleModalMeal}>Meal {index + 1}</Text>
                  <Text style={styles.scheduleModalTime}>{meal.time}</Text>
                  <Text style={styles.scheduleModalPortion}>{meal.portion}g</Text>
                </View>
              ))}
              
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleInfoTitle}>Schedule Information</Text>
                <Text style={styles.scheduleInfoText}>
                  • Based on {activePet?.feeding_frequency || 2} meals per day
                </Text>
                <Text style={styles.scheduleInfoText}>
                  • Total daily food: {activePet?.daily_food_amount || 100}g
                </Text>
                <Text style={styles.scheduleInfoText}>
                  • Portion per meal: {Math.round((parseFloat(activePet?.daily_food_amount) || 100) / (parseInt(activePet?.feeding_frequency) || 2))}g
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowScheduleModal(false)}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={() => {
                  generateFeedingSchedule(activePet);
                  setShowScheduleModal(false);
                }}
              >
                <Text style={styles.confirmBtnText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowHistory(false)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.historyHeader}>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Icon name="close" size={24} color="#257D8C" />
            </TouchableOpacity>
            <Text style={styles.historyHeaderTitle}>Nutrition History</Text>
            <View style={{width: 24}} />
          </View>

          <ScrollView style={styles.historyContainer}>
            {dispenseHistory.map((item, index) => (
              <View key={index} style={styles.historyItemFull}>
                <View style={styles.historyIconLarge}>
                  <Icon 
                    name={getDispenseIcon(item.type)} 
                    size={24} 
                    color={getDispenseColor(item.type)} 
                  />
                </View>
                <View style={styles.historyDetailsFull}>
                  <Text style={styles.historyTitleFull}>
                    {item.amount}{item.type === 'water' ? 'ml' : 
                                   item.type === 'medication' || item.type === 'meds' ? ' units' : 'g'} {item.type}
                  </Text>
                  <Text style={styles.historyPetName}>
                    For {item.pet_name || activePet?.name || 'Pet'}
                  </Text>
                  <Text style={styles.historyTimeFull}>
                    {new Date(item.dispensed_at || item.timestamp).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.historyPointsFull}>
                  <Text style={styles.historyPointsText}>+1 pts</Text>
                </View>
              </View>
            ))}
            
            {dispenseHistory.length === 0 && (
              <View style={styles.emptyHistoryFull}>
                <Icon name="timeline" size={60} color="#ccc" />
                <Text style={styles.emptyHistoryTitle}>No History Yet</Text>
                <Text style={styles.emptyHistoryDescription}>
                  Start using the nutrition system to track your pet's feeding
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
       {/* ✅ NEW/REVISED: Schedule Management Modal */}
            <Modal visible={isScheduleModalVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{currentSchedule?.id ? 'Edit' : 'Add'} Schedule</Text>
                        {/* Add inputs for time, amount, type, etc. here */}
                        <Text style={styles.notesLabel}>Time (HH:MM)</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={currentSchedule?.schedule_time}
                            onChangeText={text => setCurrentSchedule(s => ({...s, schedule_time: text}))}
                            placeholder="e.g., 18:30"
                        />
                        <Text style={styles.notesLabel}>Amount (g)</Text>
                         <TextInput
                            style={styles.modalInput}
                            value={String(currentSchedule?.amount || '')}
                            onChangeText={text => setCurrentSchedule(s => ({...s, amount: text}))}
                            keyboardType="numeric"
                            placeholder="e.g., 50"
                        />
                         <View style={styles.modalButtons}>
                             <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsScheduleModalVisible(false)}>
                                 <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                             <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleSaveSchedule} disabled={isSavingSchedule}>
                                {isSavingSchedule ? <ActivityIndicator color="white"/> : <Text style={styles.confirmBtnText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#CCFBEC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: 'white',
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  headerRight: {
    width: 34,
    alignItems: 'flex-end',
  },
  resetButton: {
    padding: 5,
  },
  // Container Levels Styles
  levelsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
  },
  progressBarContainer: {
    marginBottom: 15,
  },
  progressBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressBarPercentage: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  petCard: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 15,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  petCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  petAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#C4E6E8',
    marginRight: 12,
  },
  petIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C4E6E8',
    marginRight: 12,
  },
  petIcon: {
    fontSize: 30,
  },
  petDetails: {
    flex: 1,
  },
  petName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  petInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  petSubInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
   addScheduleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4ECDC4',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    addScheduleText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
        marginLeft: 4,
    },
    scheduleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    scheduleDetails: {
        flex: 1,
        marginLeft: 15,
    },
    scheduleTime: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    scheduleAmount: {
        fontSize: 14,
        color: '#666',
        textTransform: 'capitalize',
    },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#C4E6E8',
  },
  pointsText: {
    marginLeft: 5,
    fontWeight: '600',
    color: '#257D8C',
    fontSize: 14,
  },
  section: {
    margin: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  seeAllText: {
    fontSize: 14,
    color: '#C066E3',
    fontWeight: '600',
  },
  dispenseGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dispenseBtn: {
    flex: 1,
    backgroundColor: '#257D8C',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 4,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  dispenseBtnTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  dispenseBtnSubtitle: {
    color: 'white',
    fontSize: 10,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    width: '22%',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 16,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyDetails: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyPoints: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C066E3',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 10,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 5,
  },
  guidelinesCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  guidelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  guidelineIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  guidelineText: {
    flex: 1,
  },
  guidelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 4,
  },
  guidelineDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  scheduleCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 16,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F6F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scheduleDetails: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scheduleAmount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  lastFedText: {
    fontSize: 10,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 2,
  },
  scheduleDispenseBtn: {
    backgroundColor: '#E8F6F5',
    padding: 8,
    borderRadius: 8,
  },
  scheduleBtnCompleted: {
    backgroundColor: '#E8F5E8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 350,
    maxHeight: '80%',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  recommendedText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#C4E6E8',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: '#f8f9ff',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#257D8C',
    marginBottom: 8,
    marginTop: 10,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickAmountBtn: {
    flex: 1,
    backgroundColor: '#f0f9f9',
    borderRadius: 8,
    paddingVertical: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 12,
    color: '#257D8C',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelBtn: {
    backgroundColor: '#f1f3f4',
  },
  confirmBtn: {
    backgroundColor: '#257D8C',
  },
  confirmBtnDisabled: {
    backgroundColor: '#8DA3A6',
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Schedule Modal Styles
  scheduleModalContent: {
    maxHeight: 300,
  },
  scheduleModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9ff',
    borderRadius: 8,
    marginBottom: 8,
  },
  scheduleModalMeal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#257D8C',
    flex: 1,
  },
  scheduleModalTime: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  scheduleModalPortion: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'right',
  },
  scheduleInfo: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f9f9',
    borderRadius: 12,
  },
  scheduleInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 8,
  },
  scheduleInfoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  historyHeader: {
    backgroundColor: 'white',
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#CCFBEC',
  },
  historyItemFull: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyIconLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  historyDetailsFull: {
    flex: 1,
  },
  historyTitleFull: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  historyPetName: {
    fontSize: 12,
    color: '#257D8C',
    marginTop: 2,
  },
  historyTimeFull: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  historyPointsFull: {
    backgroundColor: '#E8F6F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyPointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C066E3',
  },
  emptyHistoryFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyHistoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 15,
  },
  emptyHistoryDescription: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});