import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Alert, Modal, TextInput, ActivityIndicator, Image, FlatList
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

// Helper function to format time (unchanged, it's correct)
const formatTimeAgo = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

    // Fallback for older dates: DD/MM/YYYY
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};


export default function HealthScreen({ navigation }) {
    const [activePet, setActivePet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [healthStats, setHealthStats] = useState(null);
    const [vitalSigns, setVitalSigns] = useState({ heart_rate: '--', oxygen_level: '--', blood_pressure: '--' });
    const [showMoodModal, setShowMoodModal] = useState(false);
    const [selectedMood, setSelectedMood] = useState(null);
    const [moodNotes, setMoodNotes] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    // ✨ NEW: State for the history modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [moodHistory, setMoodHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
      // ✨ NEW: State to hold the user's points
    const [userPoints, setUserPoints] = useState(0);

    const moodOptions = [
        { level: 1, emoji: '😢', label: 'Sad', color: '#FF6B6B' },
        { level: 2, emoji: '😐', label: 'Neutral', color: '#F39C12' },
        { level: 3, emoji: '😊', label: 'Happy', color: '#4ECDC4' },
        { level: 4, emoji: '😄', label: 'Playful', color: '#45B7D1' },
        { level: 5, emoji: '🤩', label: 'Excited', color: '#9B59B6' }
    ];

    useFocusEffect(
        React.useCallback(() => {
            loadInitialData();
        }, [])
    );
    // ✨ NEW: Add this useEffect block for automatic refreshing
    useEffect(() => {
        // Only start the timer if there is an active pet
        if (activePet) {
            // Set an interval to call loadVitalSigns every 30 seconds (30000 milliseconds)
            const intervalId = setInterval(() => {
                console.log("Refreshing vital signs...");
                loadVitalSigns(activePet.id);
            }, 30000);

            // This is a cleanup function that runs when the screen is closed.
            // It's very important to stop the timer to prevent memory leaks.
            return () => clearInterval(intervalId);
        }
    }, [activePet]); // This effect will re-run if the activePet changes


//automatically save the data to the database 
    //  useEffect(() => {
    //     if (activePet) {
    //         const simulateAndRefreshVitals = async () => {
    //             console.log("Simulating and recording new vital signs...");
                
    //             const simulatedData = {
    //                 heart_rate: Math.floor(Math.random() * (110 - 70 + 1)) + 70,
    //                 oxygen_level: Math.floor(Math.random() * (99 - 96 + 1)) + 96,
    //                 systolic_bp: Math.floor(Math.random() * (130 - 110 + 1)) + 110,
    //                 diastolic_bp: Math.floor(Math.random() * (85 - 70 + 1)) + 70,
    //             };

    //             try {
    //                 // 1. Save the new data to the database automatically
    //                 await ApiService.recordVitalSigns(activePet.id, simulatedData);

    //                 // 2. Fetch the latest data (which we just saved) to update the screen
    //                 await loadVitalSigns(activePet.id);
    //             } catch (error) {
    //                 console.error("Failed to automatically simulate and record vitals:", error);
    //             }
    //         };
            
    //         // Run it once immediately when the screen loads
    //         simulateAndRefreshVitals();

    //         // Set it to run again every 30 seconds
    //         const intervalId = setInterval(simulateAndRefreshVitals, 30000); 

    //         // Stop the timer when the screen is closed to prevent memory leaks
    //         return () => clearInterval(intervalId);
    //     }
    // }, [activePet]); // This effect will start when an active pet is loaded

 const loadInitialData = async () => {
        setLoading(true);
        try {
            const petData = await AsyncStorage.getItem('activePet');
            if (petData) {
                const pet = JSON.parse(petData);
                setActivePet(pet);
                await Promise.all([
                    loadHealthStats(pet.id),
                    loadVitalSigns(pet.id),
                    loadUserPoints()
                ]);
            } else {
                setActivePet(null);
                setHealthStats(null);
                setVitalSigns(null);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            setLoading(false);
        }
    };
    
 // ✨ FIXED: Load user points from API instead of AsyncStorage
    const loadUserPoints = async () => {
        try {
            const response = await ApiService.getUserPoints();
            if (response.success && response.data?.data) {
                setUserPoints(response.data.data.points || 0);
                // Also update AsyncStorage as backup
                await AsyncStorage.setItem('userPoints', (response.data.data.points || 0).toString());
            } else {
                // Fallback to AsyncStorage if API fails
                const points = await AsyncStorage.getItem('userPoints');
                setUserPoints(points ? parseInt(points, 10) : 0);
            }
        } catch (error) {
            console.error("Failed to load user points from API:", error);
            // Fallback to AsyncStorage if API fails
            try {
                const points = await AsyncStorage.getItem('userPoints');
                setUserPoints(points ? parseInt(points, 10) : 0);
            } catch (storageError) {
                console.error("Failed to load user points from storage:", storageError);
                setUserPoints(0);
            }
        }
    };


    const loadHealthStats = async (petId) => {
        try {
            const response = await ApiService.getHealthStats(petId);
            if (response.success) {
                setHealthStats(response.data.data);
            }
        } catch (error) {
            console.error('Failed to load health stats:', error);
        }
    };
    // ✨ NEW: Function to fetch and show the full history modal
const handleRecordMood = async () => {
    if (!selectedMood || !activePet) return;
    setIsRecording(true);
    try {
        const response = await ApiService.recordMood(activePet.id, selectedMood.level, moodNotes);
        
        if (response.success && response.data?.data) {
            Alert.alert("Success", "Mood recorded successfully!");

            const newTotalPoints = response.data.data.total_user_points;

            if (newTotalPoints !== undefined) {
                setUserPoints(newTotalPoints);
                await AsyncStorage.setItem('userPoints', newTotalPoints.toString());
            }

            // Close the modal and reset states
            setShowMoodModal(false);
            setSelectedMood(null);
            setMoodNotes('');
            
            // ✅ --- THIS IS THE NEW LINE ---
            // Navigate to Home and pass a 'refresh' parameter to trigger a data reload.
            navigation.navigate('Home', { refresh: true });

        } else {
            throw new Error(response.error || 'Failed to record mood');
        }
    } catch (error) {
        Alert.alert("Error", error.message);
    } finally {
        setIsRecording(false);
    }
};
 // ✨ THIS IS THE NEW FUNCTION TO FILL YOUR TABLE
    const handleSimulateVitals = async () => {
        if (!activePet) return Alert.alert("No Pet", "Please select an active pet first.");

        // Generate some random-but-realistic vital signs
        const simulatedData = {
            heart_rate: Math.floor(Math.random() * (110 - 70 + 1)) + 70, // Normal range
            oxygen_level: Math.floor(Math.random() * (99 - 96 + 1)) + 96,
            systolic_bp: Math.floor(Math.random() * (130 - 110 + 1)) + 110,
            diastolic_bp: Math.floor(Math.random() * (85 - 70 + 1)) + 70,
        };

        try {
            const response = await ApiService.recordVitalSigns(activePet.id, simulatedData);
            if (response.success) {
                Alert.alert("Success", "Simulated sensor reading has been saved!");
                // Refresh the vital signs on the screen to show the new data
                await loadVitalSigns(activePet.id);
            } else {
                throw new Error(response.error || 'Failed to save data.');
            }
        } catch (error) {
            console.error("Error simulating vitals:", error);
            Alert.alert("Error", error.message);
        }
    };
    
    const getMoodByLevel = (level) => moodOptions.find(m => m.level === Math.round(level)) || moodOptions[1];

  const loadHealthData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPetInfo(),
        loadHealthStats(),
        loadVitalSigns(),
      ]);
    } catch (error) {
      console.error('Error loading health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPetInfo = async () => {
    try {
      const petData = await AsyncStorage.getItem('activePet');
      if (petData) {
        setActivePet(JSON.parse(petData));
      }
    } catch (error) {
      console.error('Error loading pet info:', error);
    }
  };

//   const loadHealthStats = async () => {
//     try {
//       const response = await ApiService.getHealthData(activePet?.id);
//       if (response.success) {
//         setHealthData(response.data);
//       } else {
//         // Mock data for demonstration
//         setHealthData({
//           mood_average: 3.5,
//           mood_trend: 'improving',
//           recent_moods: [
//             { level: 4, recorded_at: '2025-09-15T10:00:00Z', notes: 'Played at park' },
//             { level: 3, recorded_at: '2025-09-14T15:30:00Z', notes: 'Had a nap' },
//             { level: 5, recorded_at: '2025-09-13T09:15:00Z', notes: 'Got treats' },
//           ],
//           health_alerts: [],
//           activity_level: 'Normal'
//         });
//       }
//     } catch (error) {
//       console.error('Error loading health stats:', error);
//       // Set mock data
//       setHealthData({
//         mood_average: 3.5,
//         mood_trend: 'stable',
//         recent_moods: [],
//         health_alerts: [],
//         activity_level: 'Normal'
//       });
//     }
//   };

 // ✨ FIX 2: Make the data loading function more robust
    const loadVitalSigns = async (petId) => {
        try {
            const response = await ApiService.getVitalSigns(petId);
            if (response.success && response.data?.data) {
                setVitalSigns(response.data.data);
            } else {
                // If API returns no data, set a default object
                setVitalSigns({ heart_rate: 'N/A', oxygen_level: 'N/A', blood_pressure: 'N/A' });
            }
        } catch (error) {
            console.error('Failed to load vital signs:', error);
            // If API call fails, set a default object
            setVitalSigns({ heart_rate: 'N/A', oxygen_level: 'N/A', blood_pressure: 'N/A' });
        }
    };
        // ✨ RESTORED: The missing function
    const handleShowHistory = async () => {
        if (!activePet) return;
        setLoadingHistory(true);
        setShowHistoryModal(true);
        try {
            const response = await ApiService.getMoodHistory(activePet.id);
            if (response.success && response.data?.data) {
                setMoodHistory(response.data.data.data);
            } else {
                setMoodHistory([]);
            }
        } catch (error) {
            Alert.alert("Error", "Could not load mood history.");
        } finally {
            setLoadingHistory(false);
        }
    };



  const handleMoodSelection = (mood) => {
    setSelectedMood(mood);
    setShowMoodModal(true);
  };

  const recordMood = async () => {
    if (!selectedMood) return;

    setisRecording(true);
    try {
      const response = await ApiService.recordMood(
        activePet?.id, 
        selectedMood.level, 
        moodNotes
      );

      if (response.success) {
        Alert.alert(
          'Mood Recorded!',
          `${activePet?.name || 'Your pet'}'s mood has been recorded as ${selectedMood.label}`,
          [{ text: 'OK' }]
        );
        
        // Refresh health data
        await loadHealthStats();
        
        // Close modal and reset
        setShowMoodModal(false);
        setMoodNotes('');
        setSelectedMood(null);
      } else {
        Alert.alert('Error', 'Failed to record mood. Please try again.');
      }
    } catch (error) {
      console.error('Error recording mood:', error);
      Alert.alert('Error', 'Failed to record mood. Please try again.');
    } finally {
      setisRecording(false);
    }
  };
  

  const getMoodEmoji = (level) => {
    const mood = moodOptions.find(m => m.level === Math.round(level));
    return mood ? mood.emoji : '😐';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257D8C" />
          <Text style={styles.loadingText}>Loading health data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
             {/* Header */}
            <View style={styles.header}>
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-back" size={24} color="#257D8C" />
                 </TouchableOpacity>
                 <Text style={styles.headerTitle}>Health Monitor</Text>
                         <View style={styles.headerRight}>
                 {/* <TouchableOpacity onPress={loadInitialData}>
                    <Icon name="refresh" size={24} color="#257D8C" />
                </TouchableOpacity> */}
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
                  {activePet.age} years old • {activePet.weight}kg
                </Text>
                <View style={styles.healthStatus}>
                  <View style={[styles.healthIndicator, { backgroundColor: '#4ECDC4' }]} />
                  <Text style={styles.healthStatusText}>Healthy</Text>
                </View>
              </View>
            </View>
            <View style={styles.pointsContainer}>
                          <Icon name="stars" size={16} color="#C066E3" />
                          <Text style={styles.pointsText}>{userPoints} pts</Text>
                        </View>
          </View>
        )}

   {/* Vital Signs */}
<View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Vital Signs</Text>

    {/* ✨ THIS IS THE NEW BUTTON ✨ */}
    <TouchableOpacity onPress={handleSimulateVitals} style={styles.simulateButton}>
      <Icon name="sensors" size={14} color="white" />
      <Text style={styles.simulateButtonText}>Simulate</Text>
    </TouchableOpacity>
  </View>

  <View style={styles.vitalsCard}>
    <View style={styles.vitalsGrid}>
      {/* Heart Rate Item */}
      <View style={styles.vitalItem}>
        <Icon name="favorite" size={24} color="#FF6B6B" />
        <Text style={styles.vitalValue}>{vitalSigns?.heart_rate || '--'}</Text>
        <Text style={styles.vitalLabel}>Heart Rate</Text>
        <Text style={styles.vitalUnit}>bpm</Text>
      </View>

      {/* Oxygen Item */}
      <View style={styles.vitalItem}>
        <Icon name="air" size={24} color="#45B7D1" />
        <Text style={styles.vitalValue}>{vitalSigns?.oxygen_level || '--'}%</Text>
        <Text style={styles.vitalLabel}>Oxygen</Text>
        <Text style={styles.vitalUnit}>SpO2</Text>
      </View>

      {/* Blood Pressure Item */}
      <View style={styles.vitalItem}>
        <Icon name="show-chart" size={24} color="#9B59B6" />
        <Text style={styles.vitalValue}>{vitalSigns?.blood_pressure || '--'}</Text>
        <Text style={styles.vitalLabel}>Blood Pressure</Text>
        <Text style={styles.vitalUnit}>mmHg</Text>
      </View>
    </View>
  </View>
</View>

         {/* Mood Tracker */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Mood Tracker</Text>
                            <View style={styles.moodCard}>
                                <View style={styles.currentMoodSection}>
                                    <Text style={styles.currentMoodTitle}>Average Mood</Text>
                                    <View style={styles.currentMoodDisplay}>
                                        <Text style={styles.currentMoodEmoji}>
                                            {/* ✅ FIXED: Used healthStats instead of healthData */}
                                            {getMoodByLevel(healthStats?.mood_average).emoji}
                                        </Text>
                                        <View style={styles.currentMoodDetails}>
                                            <Text style={styles.currentMoodLevel}>
                                                {/* ✅ FIXED: Used healthStats instead of healthData */}
                                                {healthStats?.mood_average?.toFixed(1) || '...'} / 5.0
                                            </Text>
                                            <Text style={styles.currentMoodTrend}>
                                                {/* ✅ FIXED: Used healthStats instead of healthData */}
                                                Trending {healthStats?.mood_trend || '...'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

            {/* Mood Selection Bar */}
            <View style={styles.moodSelectionSection}>
              <Text style={styles.moodSelectionTitle}>How is {activePet?.name || 'your pet'} feeling?</Text>
              <View style={styles.moodOptions}>
                {moodOptions.map((mood) => (
                  <TouchableOpacity
                    key={mood.level}
                    style={[styles.moodOption, { borderColor: mood.color }]}
                    onPress={() => handleMoodSelection(mood)}
                  >
                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                    <Text style={styles.moodLabel}>{mood.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

{/* Recent Mood History */}
<View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Recent Moods</Text>
    <TouchableOpacity onPress={handleShowHistory}>
        <Text style={styles.seeAllText}>See All</Text>
    </TouchableOpacity>
  </View>
  
  <View style={styles.historyCard}>
    {healthStats?.recent_moods?.length > 0 ? (
      healthStats.recent_moods.map((mood, index) => (
        <View key={index} style={styles.moodHistoryItem}>
          <View style={styles.moodHistoryIcon}>
            <Text style={styles.moodHistoryEmoji}>
              {getMoodByLevel(mood.level).emoji}
            </Text>
          </View>
          <View style={styles.moodHistoryDetails}>
            <Text style={styles.moodHistoryLevel}>
              {moodOptions.find(m => m.level === mood.level)?.label || 'Unknown'}
            </Text>
            <Text style={styles.moodHistoryTime}>
              {formatTimeAgo(mood.recorded_at)}
            </Text>

            {/* This line conditionally displays the note if it exists */}
            {mood.notes && (
              <Text style={styles.moodHistoryNotes}>"{mood.notes}"</Text>
            )}
            
          </View>
        </View>
      ))
    ) : (
      <View style={styles.emptyHistory}>
        <Icon name="sentiment-satisfied" size={40} color="#ccc" />
        <Text style={styles.emptyHistoryText}>No mood data yet</Text>
        <Text style={styles.emptyHistorySubtext}>
          Start tracking {activePet?.name || 'your pet'}'s mood
        </Text>
      </View>
    )}
  </View>
</View>
        {/* Health Guidelines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Tips</Text>
          
          <View style={styles.guidelinesCard}>
            <View style={styles.guidelineItem}>
              <Text style={styles.guidelineIcon}>💓</Text>
              <View style={styles.guidelineText}>
                <Text style={styles.guidelineTitle}>Normal Heart Rate</Text>
                <Text style={styles.guidelineDescription}>
                  Dogs: 60-140 bpm (varies by size)
                  Cats: 120-140 bpm
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Text style={styles.guidelineIcon}>🌡️</Text>
              <View style={styles.guidelineText}>
                <Text style={styles.guidelineTitle}>Body Temperature</Text>
                <Text style={styles.guidelineDescription}>
                  Normal range: 101-102.5°F (38.3-39.2°C)
                  Monitor for fever or hypothermia
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Text style={styles.guidelineIcon}>😊</Text>
              <View style={styles.guidelineText}>
                <Text style={styles.guidelineTitle}>Mood Indicators</Text>
                <Text style={styles.guidelineDescription}>
                  Watch for changes in appetite, activity, and social behavior
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Mood Recording Modal */}
      <Modal
        visible={showMoodModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMoodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Mood</Text>
            <Text style={styles.modalSubtitle}>
              {selectedMood?.emoji} {selectedMood?.label}
            </Text>
            
            <Text style={styles.notesLabel}>Add a note (optional):</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="What made them feel this way?"
              value={moodNotes}
              onChangeText={setMoodNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowMoodModal(false)}
                disabled={isRecording}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn, isRecording && styles.confirmBtnDisabled]}
                onPress={handleRecordMood}
                disabled={isRecording}
              >
                {isRecording ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmBtnText}>Record</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
       <Modal
                visible={showHistoryModal}
                animationType="slide"
                onRequestClose={() => setShowHistoryModal(false)}
            >
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={styles.backButton}>
                           <Icon name="close" size={24} color="#257D8C" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Full Mood History</Text>
                        <View style={{width: 24}} />
                    </View>
                    {loadingHistory ? (
                        <View style={styles.loadingContainer}>
                           <ActivityIndicator size="large" color="#257D8C"/>
                        </View>
                    ) : (
                        <FlatList
                            data={moodHistory}
                            keyExtractor={(item) => item.id.toString()}
                            ListEmptyComponent={() => (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyStateText}>No mood history found.</Text>
                                </View>
                            )}
                             // ✅ REPLACE YOUR RENDERITEM WITH THIS ENTIRE BLOCK
    renderItem={({ item }) => (
        <View style={styles.fullHistoryItem}>
            <View style={styles.moodHistoryIcon}>
                <Text style={styles.moodHistoryEmoji}>{getMoodByLevel(item.mood_score).emoji}</Text>
            </View>
            <View style={styles.moodHistoryDetails}>
                <Text style={styles.moodHistoryLevel}>{getMoodByLevel(item.mood_score).label}</Text>
                <Text style={styles.moodHistoryTime}>{new Date(item.recorded_at).toLocaleString()}</Text>
                
                {/* FIXED: This is now the ONLY line that displays the note */}
                {item.notes && <Text style={styles.moodHistoryNotes}>"{item.notes}"</Text>}
            </View>
        </View>
                            )}
                        />
                    )}
                </SafeAreaView>
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
  sectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},

simulateButton: {
  flexDirection: 'row',
  alignItems: 'center',
    backgroundColor: '#4ECDC4',
  paddingVertical: 4,
  paddingHorizontal: 8,
  borderRadius: 12,
  elevation: 2,
},

simulateButtonText: {
  color: 'white',
  fontSize: 12,
  marginLeft: 4,
  fontWeight: '600',
},

  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  scrollContainer: {
    flex: 1,
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
  // ✨ FIXED: Updated points container to match Nutrition screen exactly
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ECDC4', // Same green background as Nutrition
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  // ✨ FIXED: Updated points text to match Nutrition screen exactly
  pointsText: {
    color: 'white', // White text like Nutrition screen
    fontWeight: 'bold',
    marginLeft: 5,
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  healthIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  healthStatusText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  section: {
    margin: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 15,
  },
  vitalsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vitalItem: {
    alignItems: 'center',
    flex: 1,
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 8,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  vitalUnit: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
   moodHistoryNotes: {
        fontSize: 12,
        color: '#666',      // Currently a soft gray color
        marginTop: 4,
        fontStyle: 'italic',
    },
  moodCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  currentMoodSection: {
    marginBottom: 20,
  },
  currentMoodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  currentMoodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentMoodEmoji: {
    fontSize: 40,
    marginRight: 15,
  },
  currentMoodDetails: {
    flex: 1,
  },
  sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4ECDC4',
    },
    fullHistoryItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        backgroundColor: 'white',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
    },
  currentMoodLevel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  currentMoodTrend: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  moodSelectionSection: {},
  moodSelectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  moodOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodOption: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#f8f9ff',
    flex: 1,
    marginHorizontal: 2,
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 10,
    color: '#666',
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
  moodHistoryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  moodHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moodHistoryEmoji: {
    fontSize: 20,
  },
  moodHistoryDetails: {
    flex: 1,
  },
  moodHistoryLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  moodHistoryTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  moodHistoryNotes: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
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
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 2,
    borderColor: '#C4E6E8',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 20,
    backgroundColor: '#f8f9ff',
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});