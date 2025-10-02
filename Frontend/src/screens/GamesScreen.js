// screens/GamesScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const { width, height } = Dimensions.get('window');

export default function GamesScreen({ navigation }) {
  const [activePet, setActivePet] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  // Game session management
  const [currentGameSession, setCurrentGameSession] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [sessionPointsEarned, setSessionPointsEarned] = useState(0); // Tracks points for the current game
  const [isGameEnding, setIsGameEnding] = useState(false); // Prevents duplicate end-game alerts
  const [gameStats, setGameStats] = useState({
    basketball: { bestScore: 0, totalGames: 0 },
    cat_wand: { bestScore: 0, totalGames: 0 },
    robot_control: { totalCommands: 0 },
    voice_command: { totalCommands: 0 }
  });

  // Game states
  const [showBasketballGame, setShowBasketballGame] = useState(false);
  const [showCatWandGame, setShowCatWandGame] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
   // ✅ NEW: States for Robot & Voice Control Modal
  const [showVoiceCommandModal, setShowVoiceCommandModal] = useState(false);

  // Basketball game state
  const [ballPosition, setBallPosition] = useState({ x: width / 2 - 25, y: height * 0.7 });
  const [isBasketballPlaying, setIsBasketballPlaying] = useState(false);
  const [basketballScore, setBasketballScore] = useState(0);
  const [basketballLevel, setBasketballLevel] = useState(1);
  const [basketballTimeLeft, setBasketballTimeLeft] = useState(60);
  const [basketballGameDuration, setBasketballGameDuration] = useState(0);
  const ballAnimation = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const basketballTimer = useRef(null);

  // Cat wand game state
  const [wandPosition, setWandPosition] = useState({ x: width / 2 - 15, y: height * 0.6 });
  const [isCatWandPlaying, setIsCatWandPlaying] = useState(false);
  const [catWandScore, setCatWandScore] = useState(0);
  const [catWandCombo, setCatWandCombo] = useState(0);
  const [catWandTimeLeft, setCatWandTimeLeft] = useState(45);
  const [catWandGameDuration, setCatWandGameDuration] = useState(0);
  const wandAnimation = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const catWandTimer = useRef(null);

   // ✅ NEW: Robot control & Voice Command state
  const [robotConnected, setRobotConnected] = useState(false);
  const [isControlling, setIsControlling] = useState(false);
  const [robotBattery, setRobotBattery] = useState(85);
  const [lastCommand, setLastCommand] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isDetectingMovement, setIsDetectingMovement] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

 useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isListening]);
  // ✅ UPDATED: useFocusEffect ensures data reloads when you navigate back to the screen
  useFocusEffect(
    React.useCallback(() => {
      loadInitialData();
      return () => { // Cleanup function when leaving the screen
        if (basketballTimer.current) clearInterval(basketballTimer.current);
        if (catWandTimer.current) clearInterval(catWandTimer.current);
      };
    }, [])
  );

  // ✅ NEW: useEffects to automatically end the game when the timer runs out
  useEffect(() => {
    if (showBasketballGame && basketballTimeLeft === 0) {
      endBasketballGame();
    }
  }, [basketballTimeLeft, showBasketballGame]);
  
  useEffect(() => {
    if (showCatWandGame && catWandTimeLeft === 0) {
      endCatWandGame();
    }
  }, [catWandTimeLeft, showCatWandGame]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const petData = await AsyncStorage.getItem('activePet');
      await loadUserPoints();
      if (petData) {
        const pet = JSON.parse(petData);
        setActivePet(pet);
        await loadGameStats(pet.id);
      } else {
        setActivePet(null);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPoints = async () => {
    try {
      const response = await ApiService.getUserPoints();
      if (response.success) {
        setUserPoints(response.data?.data?.points || 0);
      }
    } catch (e) {
      console.error("Failed to load user points", e);
    }
  };

  const loadGameStats = async (petId) => {
    try {
      const response = await ApiService.getGameStats(petId);
      if (response.success) {
        setGameStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading game stats:', error);
    }
  };

  const startGameSession = async (gameType) => {
    if (!activePet) {
      Alert.alert('Pet Required', 'Please set up an active pet to play games.');
      return null;
    }
    try {
      const response = await ApiService.startGameSession({ pet_id: activePet.id, game_type: gameType });
      if (response.success && response.data?.data?.session_id) {
        const sessionData = response.data.data;
        setCurrentGameSession({ id: sessionData.session_id, game_type: sessionData.game_type });
        setGameStartTime(new Date());
        return sessionData.session_id;
      } else {
        throw new Error(response.error || 'Session ID not found');
      }
    } catch (error) {
      console.error('Error starting game session:', error.message);
      Alert.alert('Error', `Could not start game session: ${error.message}`);
      return null;
    }
  };

const updateGameProgress = async (score, gameData = {}) => {
        if (!currentGameSession) return 0;
        const sessionId = currentGameSession.id;
        try {
            const response = await ApiService.updateGameProgress(sessionId, {
                current_score: score,
                game_data: gameData,
                duration: Math.floor((new Date() - gameStartTime) / 1000),
            });

            if (response.success && response.data?.data) {
                const earnedForAction = response.data.data.points_earned || 0;
                
                // Set the total user points
                if (response.data.data.total_user_points !== undefined) {
                    setUserPoints(response.data.data.total_user_points);
                }

                // Set the total points for THIS SESSION from the backend's source of truth
                if (response.data.data.total_session_points !== undefined) {
                    setSessionPointsEarned(response.data.data.total_session_points);
                }
                
                return earnedForAction;
            }
        } catch (error) {
            console.error('Error updating game progress:', error);
        }
        return 0;
    };
  
 // screens/GamesScreen.js

    // ... (other functions in your component)

    // ✅ REVISED: This function now only ends the game and returns the results.
    const endGameSession = async (finalScore, gameDuration) => {
        if (!currentGameSession) return null;
        const sessionId = currentGameSession.id;

        try {
            const response = await ApiService.completeGameSession(sessionId, {
                final_score: finalScore,
                duration: gameDuration,
            });

            if (response.success) {
                if (response.data?.data?.total_user_points !== undefined) {
                    setUserPoints(response.data.data.total_user_points);
                }
                await loadGameStats(activePet.id);
                return response.data.data; // Return the final game results
            } else {
                throw new Error(response.error || 'Failed to end game session.');
            }
        } catch (error) {
            console.error('Error ending game session:', error);
            await loadGameStats(activePet.id);
            return null; // Return null on failure
        } finally {
            setCurrentGameSession(null);
            setGameStartTime(null);
        }
    };

    // ✅ REVISED: This function now correctly handles the logic flow.
    const endBasketballGame = async () => {
        if (isGameEnding) return;
        setIsGameEnding(true);

        if (basketballTimer.current) clearInterval(basketballTimer.current);
        setShowBasketballGame(false);

        // 1. End the game session first to get final results
        const gameResults = await endGameSession(basketballScore, basketballGameDuration);
        
        // 2. Use the results to build the message
        const finalPoints = gameResults?.session?.points_earned ?? sessionPointsEarned;
        const alertTitle = basketballScore > 0 ? '🏀 Game End!' : '🏀 Game Over!';
        
        let message = `Final Score: ${basketballScore}\n` +
                      `Level Reached: ${basketballLevel}\n` +
                      `Points Earned: ${finalPoints}`;

        if (basketballScore > 0) {
            message += `\n\nGreat job playing with ${activePet?.name}!`;
        } else {
            message += `\n\nNo points this time. Better luck next time!`;
        }

        // 3. Show the final score alert
        Alert.alert(alertTitle, message, [
            {
                text: 'OK',
                onPress: () => {
                    // 4. After showing the score, ask to reward the pet
                    Alert.alert(
                        'Reward Your Pet?',
                        `Give ${activePet?.name} a treat for playing?`,
                        [
                            { text: 'No, thanks', style: 'cancel' },
                            {
                                text: 'Give Treat!',
                                onPress: async () => {
                                    // 5. Call the separate dispense treat API
                                    await ApiService.dispenseTreats({ pet_id: activePet.id, amount: 1 });
                                    Alert.alert('Success!', `A treat was dispensed for ${activePet.name}.`);
                                }
                            },
                        ]
                    );
                }
            }
        ]);
        setIsGameEnding(false);
    };

    // ✅ REVISED: This function also follows the correct logic flow.
    const endCatWandGame = async () => {
        if (isGameEnding) return;
        setIsGameEnding(true);

        if (catWandTimer.current) clearInterval(catWandTimer.current);
        setShowCatWandGame(false);
        
        // 1. End the game session first
        const gameResults = await endGameSession(catWandScore, catWandGameDuration);
        
        // 2. Use the results for the message
        const finalPoints = gameResults?.session?.points_earned ?? sessionPointsEarned;
        const alertTitle = catWandScore > 0 ? '🪄 Game End!' : '🪄 Game Over!';
        
        let message = `Final Score: ${catWandScore}\n` +
                      `Best Combo: ${catWandCombo}\n` +
                      `Points Earned: ${finalPoints}`;

        if (catWandScore > 0) {
            message += `\n\n${activePet?.name} had a great workout!`;
        } else {
            message += `\n\nNo points this time. Try again!`;
        }
        
        // 3. Show the final score alert
        Alert.alert(alertTitle, message, [
            {
                text: 'OK',
                onPress: () => {
                    // 4. Ask to reward the pet
                    Alert.alert(
                        'Reward Your Pet?',
                        `Give ${activePet?.name} a treat for playing?`,
                        [
                            { text: 'No, thanks', style: 'cancel' },
                            {
                                text: 'Give Treat!',
                                onPress: async () => {
                                     // 5. Call the separate dispense treat API
                                    await ApiService.dispenseTreats({ pet_id: activePet.id, amount: 1 });
                                    Alert.alert('Success!', `A treat was dispensed for ${activePet.name}.`);
                                }
                            },
                        ]
                    );
                }
            }
        ]);
        setIsGameEnding(false);
    };
const launchBasketball = async () => {
    if (isBasketballPlaying || basketballTimeLeft <= 0) return;

    setIsBasketballPlaying(true);
    
    // Calculate difficulty based on level
    const difficulty = Math.min(basketballLevel * 0.1, 0.5);
    const successRate = Math.max(0.4, 0.8 - difficulty);
    
    // Animate ball to basket
    const basketX = width * 0.7;
    const basketY = height * 0.2;
    
    Animated.sequence([
      Animated.timing(ballAnimation, {
        toValue: { x: basketX - ballPosition.x, y: basketY - ballPosition.y },
        duration: 1200 - (basketballLevel * 100),
        useNativeDriver: false,
      }),
      Animated.timing(ballAnimation, {
        toValue: { x: 0, y: 0 },
        duration: 100,
        useNativeDriver: false,
      }),
    ]).start(async () => {
      const success = Math.random() < successRate;
      
      if (success) {
        const newScore = basketballScore + 1;
        setBasketballScore(newScore);
        
        // ✅ CHANGED: Create a variable to check for level-up condition
        const justLeveledUp = newScore > 0 && newScore % 5 === 0;

        if (justLeveledUp) {
          // Update the level state
          setBasketballLevel(prev => prev + 1);

          // ✅ CHANGED: The alert is now inside this block and has a new message.
          // Note: We use `basketballLevel + 1` because the state updates after the render.
          Alert.alert(
            '🎉 Level Up!', 
            `Awesome! You've reached level ${basketballLevel + 1}!\nThe game is getting faster.`
          );
        }
        
        // This still runs on every successful shot to award points silently
        await updateGameProgress(newScore, {
          level: basketballLevel,
          timeLeft: basketballTimeLeft,
          did_level_up: justLeveledUp // You can send this to the backend if needed
        });
        
      } else {
        Alert.alert('🐕 Almost!', `${activePet.name} missed the basket but had fun trying!`);
      }
      
      setIsBasketballPlaying(false);
      setBallPosition({ x: width / 2 - 25, y: height * 0.7 });
    });
  };
  // Enhanced Cat Wand Game Logic
const startBasketballGame = async () => {
        const sessionId = await startGameSession('basketball');
        if (!sessionId) return;
        
        setBasketballScore(0);
        setBasketballLevel(1);
        setBasketballTimeLeft(60);
        setBasketballGameDuration(0);
        setSessionPointsEarned(0); // Reset session points to 0
        setIsGameEnding(false);
        setShowBasketballGame(true);

        basketballTimer.current = setInterval(() => {
            setBasketballTimeLeft(prev => Math.max(0, prev - 1));
            setBasketballGameDuration(prev => prev + 1);
        }, 1000);
    };


const startCatWandGame = async () => {
        const sessionId = await startGameSession('cat_wand');
        if (!sessionId) return;
        
        setCatWandScore(0);
        setCatWandCombo(0);
        setCatWandTimeLeft(45);
        setCatWandGameDuration(0);
        setSessionPointsEarned(0); // Reset session points to 0
        setIsGameEnding(false);
        setShowCatWandGame(true);

        catWandTimer.current = setInterval(() => {
            setCatWandTimeLeft(prev => Math.max(0, prev - 1));
            setCatWandGameDuration(prev => prev + 1);
        }, 1000);
    };
  const moveCatWand = async () => {
    if (isCatWandPlaying || catWandTimeLeft <= 0) return;

    setIsCatWandPlaying(true);
    
    // Random wand movement with increased speed based on combo
    const speed = Math.max(300, 800 - (catWandCombo * 50));
    const newX = Math.random() * (width - 60);
    const newY = Math.random() * (height * 0.4) + height * 0.3;
    
    Animated.timing(wandAnimation, {
      toValue: { x: newX - wandPosition.x, y: newY - wandPosition.y },
      duration: speed,
      useNativeDriver: false,
    }).start(async () => {
      const newScore = catWandScore + 1;
      const newCombo = catWandCombo + 1;
      
      setCatWandScore(newScore);
      setCatWandCombo(newCombo);
      
      // Bonus points for combos
      const basePoints = 3;
      const comboBonus = Math.floor(newCombo / 7) * 2;
      const totalPoints = basePoints + comboBonus;
      
      const pointsEarned = await updateGameProgress(newScore, {
        combo: newCombo,
        timeLeft: catWandTimeLeft
      });
      
      setWandPosition({ x: newX, y: newY });
      setIsCatWandPlaying(false);

      if (comboBonus > 0) {
        Alert.alert('🎉 Combo!', `${activePet?.name} is on fire! +${pointsEarned || totalPoints} points!`);
      }
    });
  };

  // Enhanced Robot Control Functions
  const connectToRobot = async () => {
    if (!activePet) {
      Alert.alert('Pet Required', 'Please set up your pet profile first to control the robot');
      return;
    }

    try {
      setLoading(true);
      const response = await ApiService.makeRequest('/robot/connect', {
        method: 'POST',
        body: JSON.stringify({ pet_id: activePet.id })
      });

      if (response.success) {
        setRobotConnected(true);
        setRobotBattery(response.data.battery_level || 85);
        Alert.alert('Connected!', 'Robot is now connected and ready to interact with your pet.');
      } else {
        throw new Error(response.error || 'Failed to connect');
      }
    } catch (error) {
      console.error('Robot connection error:', error);
      // Simulate connection for demo
      setTimeout(() => {
        setRobotConnected(true);
        Alert.alert('Connected!', 'Robot is now connected and ready to interact with your pet.');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const sendRobotCommand = async (command) => {
    if (!robotConnected) {
      Alert.alert('Robot Not Connected', 'Please connect to the robot first');
      return;
    }

    setIsControlling(true);
    setLastCommand(command);
    
    try {
      const response = await ApiService.makeRequest('/robot/command', {
        method: 'POST',
        body: JSON.stringify({
          pet_id: activePet.id,
          command_type: command,
          command_data: new Date().toISOString()
        })
      });

      if (response.success) {
        const pointsEarned = response.data.points_earned || 3;
        setUserPoints(response.data.total_user_points);
        
        const commandMessages = {
          move_forward: `Robot moved forward to play with ${activePet?.name}! +${pointsEarned} points`,
          move_backward: `Robot moved backward, giving ${activePet?.name} space to play! +${pointsEarned} points`,
          turn_left: `Robot turned left to follow ${activePet?.name}! +${pointsEarned} points`,
          turn_right: `Robot turned right to engage with ${activePet?.name}! +${pointsEarned} points`,
          dispense_treat: `Robot dispensed a treat for ${activePet?.name}! +${pointsEarned} points`,
          play_sound: `Robot played a sound to get ${activePet?.name}'s attention! +${pointsEarned} points`,
        };
        
        Alert.alert('Command Executed', commandMessages[command] || 'Robot command executed successfully!');
        
        // Simulate battery drain
        setRobotBattery(prev => Math.max(10, prev - 1));
        
        // Refresh stats
        await loadGameStats(activePet.id);
      }
    } catch (error) {
      console.error('Robot command error:', error);
      // Fallback to offline simulation
      setTimeout(() => {
        const pointsEarned = 3;
        setUserPoints(prev => prev + pointsEarned);
        Alert.alert('Command Executed', 'Robot command executed successfully!');
        setRobotBattery(prev => Math.max(10, prev - 1));
      }, 1000);
    } finally {
      setTimeout(() => {
        setIsControlling(false);
        setLastCommand(null);
      }, 1500);
    }
  };

  const playVoiceCommand = async () => {
    if (!robotConnected) {
      Alert.alert('Robot Not Connected', 'Please connect to the robot first');
      return;
    }

    Alert.prompt(
      'Voice Command',
      'Enter a voice command for your pet:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Command',
          onPress: async (command) => {
            if (command && command.trim()) {
              setIsControlling(true);
              
              try {
                const response = await ApiService.makeRequest('/robot/command', {
                  method: 'POST',
                  body: JSON.stringify({
                    pet_id: activePet.id,
                    command_type: 'voice_command',
                    command_data: command.trim()
                  })
                });

                if (response.success) {
                  const pointsEarned = response.data.points_earned || 5;
                  setUserPoints(response.data.total_user_points);
                  Alert.alert(
                    'Voice Command Sent',
                    `Robot said: "${command}" to ${activePet?.name}!\n+${pointsEarned} points earned!`
                  );
                  
                  // Refresh stats
                  await loadGameStats(activePet.id);
                }
              } catch (error) {
                console.error('Voice command error:', error);
                // Fallback
                setUserPoints(prev => prev + 5);
                Alert.alert(
                  'Voice Command Sent',
                  `Robot said: "${command}" to ${activePet?.name}!\n+5 points earned!`
                );
              } finally {
                setIsControlling(false);
              }
            }
          },
        },
      ],
      'plain-text',
      ''
    );
  };

    const handleVoiceCommand = () => {
    if (!robotConnected) {
      Alert.alert('Robot Not Connected', 'Please connect to the robot first to issue voice commands.');
      return;
    }
    setShowVoiceCommandModal(true);
  };

  const startVoiceRecording = () => {
    setIsListening(true);
    // Simulate listening for 3 seconds
    setTimeout(() => {
      setIsListening(false);
      const sampleCommands = ['Sit', 'Give treat', 'Come here'];
      const capturedCommand = sampleCommands[Math.floor(Math.random() * sampleCommands.length)];
      processVoiceCommand(capturedCommand);
    }, 3000);
  };

const processVoiceCommand = async (command) => {
  if (!activePet) return;
  setIsProcessingVoice(true);
  try {
    const response = await ApiService.makeRequest('/robot/voice-command', {
      method: 'POST',
      body: JSON.stringify({
        pet_id: activePet.id,
        command: command // ✅ FIX: Change 'voice_command' back to 'command'
      })
    });

    if (response.success) {
      const action = response.data.data.analysis.action;
      Alert.alert(
        'Command Understood!',
        `Command "${command}" was interpreted as "${action.replace('_', ' ')}".\n\nNow, let's see if ${activePet.name} obeys!`,
        [{ text: 'Check Movement', onPress: () => detectPetMovement(action) }]
      );
    } else {
      // This will now properly show the validation error
      const errorMsg = response.validationErrors?.command?.[0] || response.error;
      throw new Error(errorMsg);
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setIsProcessingVoice(false);
  }
};

  const detectPetMovement = async (commandAction) => {
    setIsDetectingMovement(true);
    // Here you would typically activate a camera view.
    // For this simulation, we'll just show an indicator.
    try {
      const response = await ApiService.makeRequest('/robot/detect-movement', {
        method: 'POST',
        body: JSON.stringify({ pet_id: activePet.id, command_action: commandAction })
      });

      if (response.success) {
        const { movement_detected, treat_dispensed, points_earned } = response.data.data;
        if (movement_detected) {
          Alert.alert(
            'Success!',
            `${activePet.name} obeyed the command! A treat has been dispensed.\n\nYou earned +${points_earned} points!`,
            [{ text: 'Awesome!', onPress: () => setShowVoiceCommandModal(false) }]
          );
          setUserPoints(response.data.data.total_user_points);
        } else {
          Alert.alert(
            'Almost!',
            `${activePet.name} didn't respond to the command this time. No points earned.`,
            [{ text: 'OK', onPress: () => setShowVoiceCommandModal(false) }]
          );
        }
      } else {
        throw new Error(response.error || 'Failed to detect movement');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsDetectingMovement(false);
    }
  };

  const awardPoints = async (points) => {
    const newPoints = userPoints + points;
    setUserPoints(newPoints);
    await AsyncStorage.setItem('userPoints', newPoints.toString());
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257D8C" />
          <Text style={styles.loadingText}>Loading games...</Text>
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
        <Text style={styles.headerTitle}>Pet Games</Text>
        <View style={styles.headerRight}>
          <View style={styles.pointsContainer}>
            <Icon name="stars" size={16} color="#C066E3" />
            <Text style={styles.pointsText}>{userPoints} pts</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Active Pet Info */}
        {activePet && (
          <View style={styles.petInfoCard}>
            <View style={styles.petInfoLeft}>
              {activePet.photo ? (
                <Image source={{ uri: activePet.photo }} style={styles.petAvatar} />
              ) : (
                <View style={styles.petIconContainer}>
                  <Text style={styles.petIcon}>
                    {activePet.type === 'dog' ? '🐕' : 
                      activePet.type === 'cat' ? '🐱' : 
                      activePet.type === 'bird' ? '🐦' : '🐾'}
                  </Text>
                </View>
              )}
              <View style={styles.petDetails}>
                <Text style={styles.petName}>{activePet.name}</Text>
                <Text style={styles.petSubinfo}>Ready to play!</Text>
              </View>
            </View>
            {/* <TouchableOpacity 
              style={styles.switchPetBtn}
              onPress={() => navigation.navigate('PetsManagement')}
            >
              <Icon name="swap-horiz" size={16} color="#257D8C" />
              <Text style={styles.switchPetText}>Switch Pet</Text>
            </TouchableOpacity> */}
          </View>
        )}

        {/* Games Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Interactive Games</Text>
          
          <View style={styles.gamesGrid}>
            {/* Basketball Game */}
            <TouchableOpacity
              style={[styles.gameCard, { backgroundColor: '#FF6B6B' }]}
              onPress={startBasketballGame}
            >
              <Icon name="sports-basketball" size={40} color="white" />
              <Text style={styles.gameTitle}>Basketball</Text>
              <Text style={styles.gameDescription}>Launch ball for your dog</Text>
              <View style={styles.gameStats}>
                <Text style={styles.gameStatsText}>Best: {gameStats.basketball?.bestScore || 0}</Text>
                <Text style={styles.gameStatsText}>Games: {gameStats.basketball?.totalGames || 0}</Text>
              </View>
            </TouchableOpacity>

            {/* Cat Wand Game */}
            <TouchableOpacity
              style={[styles.gameCard, { backgroundColor: '#9B59B6' }]}
              onPress={startCatWandGame}
            >
              <Text style={styles.gameEmoji}>🪄</Text>
              <Text style={styles.gameTitle}>Cat Wand</Text>
              <Text style={styles.gameDescription}>Interactive feather wand</Text>
              <View style={styles.gameStats}>
                <Text style={styles.gameStatsText}>Best: {gameStats.cat_wand?.bestScore || 0}</Text>
                <Text style={styles.gameStatsText}>Games: {gameStats.cat_wand?.totalGames || 0}</Text>
              </View>
            </TouchableOpacity>

            {/* Control Panel */}
            <TouchableOpacity
              style={[styles.gameCard, { backgroundColor: '#45B7D1' }]}
              onPress={() => setShowControlPanel(true)}
            >
              <Icon name="settings-remote" size={40} color="white" />
              <Text style={styles.gameTitle}>Robot Control</Text>
              <Text style={styles.gameDescription}>Remote pet interaction</Text>
              <View style={styles.gameStats}>
                <Text style={styles.gameStatsText}>
                  {robotConnected ? 'Connected' : 'Disconnected'}
                </Text>
                <Text style={styles.gameStatsText}>Commands: {gameStats.robot_control?.totalCommands || 0}</Text>
              </View>
            </TouchableOpacity>

            {/* Voice Commands */}
            <TouchableOpacity
              style={[styles.gameCard, { backgroundColor: '#4ECDC4' }]}
              onPress={handleVoiceCommand} // ✅ UPDATED
              disabled={!robotConnected}
            >
              <Icon name="record-voice-over" size={40} color="white" />
              <Text style={styles.gameTitle}>Voice Commands</Text>
              <Text style={styles.gameDescription}>Speak to your pet</Text>
              <View style={styles.gameStats}>
                <Text style={styles.gameStatsText}>
                  {robotConnected ? 'Ready' : 'Need Robot'}
                </Text>
                <Text style={styles.gameStatsText}>Used: {gameStats.voice_command?.totalCommands || 0}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Game Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 How to Play</Text>
          
          <View style={styles.instructionsCard}>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionIcon}>🏀</Text>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>Basketball</Text>
                <Text style={styles.instructionDescription}>
                  Timed challenge! Launch balls and get your dog to return them to the basket. 
                  Level up every 5 successful shots for bonus points!
                </Text>
              </View>
            </View>

            <View style={styles.instructionItem}>
              <Text style={styles.instructionIcon}>🪄</Text>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>Cat Wand</Text>
                <Text style={styles.instructionDescription}>
                  Quick-tap challenge! Move the wand rapidly to build combos. 
                  Higher combos earn bonus points and speed up gameplay!
                </Text>
              </View>
            </View>

            <View style={styles.instructionItem}>
              <Text style={styles.instructionIcon}>🎮</Text>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>Robot Control</Text>
                <Text style={styles.instructionDescription}>
                  Direct robot control to interact with your pet. Monitor battery levels 
                  and use voice commands for maximum engagement points!
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📡 Robot Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusIndicator}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: robotConnected ? '#4ECDC4' : '#FF6B6B' }
                ]} />
                <Text style={styles.statusText}>
                  Robot {robotConnected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
              
              {robotConnected && (
                <View style={styles.batteryIndicator}>
                  <Icon name="battery-full" size={16} color="#4ECDC4" />
                  <Text style={styles.batteryText}>{robotBattery}%</Text>
                </View>
              )}
            </View>
            
            {lastCommand && (
              <View style={styles.lastCommandIndicator}>
                <Text style={styles.lastCommandText}>Last: {lastCommand.replace('_', ' ')}</Text>
              </View>
            )}
            
            {!robotConnected && (
              <TouchableOpacity 
                style={styles.connectButton}
                onPress={connectToRobot}
              >
                <Icon name="wifi" size={16} color="white" />
                <Text style={styles.connectButtonText}>Connect Robot</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

       {/* Enhanced Basketball Game Modal */}
       <Modal
        visible={showBasketballGame}
        animationType="slide"
        transparent={false}
        onRequestClose={endBasketballGame}
      >
        <SafeAreaView style={styles.gameModal}>
          <View style={styles.gameHeader}>
            <TouchableOpacity onPress={endBasketballGame}>
              <Icon name="close" size={24} color="#257D8C" />
            </TouchableOpacity>
            <Text style={styles.gameHeaderTitle}>Basketball Game</Text>
            <View style={styles.gameHeaderStats}>
              <Text style={styles.gameScore}>Score: {basketballScore}</Text>
              <Text style={styles.gameLevel}>Level: {basketballLevel}</Text>
              <Text style={styles.gamePoints}>Points: {sessionPointsEarned}</Text>
              <Text style={styles.gameTimer}>Time: {basketballTimeLeft}s</Text>
            </View>
          </View>

          <View style={styles.basketballGameArea}>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[ styles.progressFill, { width: `${(basketballTimeLeft / 60) * 100}%` }]} 
                />
              </View>
            </View>
            <View style={styles.basket}>
              <Text style={styles.basketEmoji}>🏀</Text>
              <Text style={styles.basketLabel}>Basket</Text>
            </View>
            <Animated.View
              style={[
                styles.ball,
                {
                  transform: [
                    { translateX: ballAnimation.x },
                    { translateY: ballAnimation.y },
                  ],
                },
                { left: ballPosition.x, top: ballPosition.y }
              ]}
            >
              <Text style={styles.ballEmoji}>⚽</Text>
            </Animated.View>

            {activePet && (
              <View style={styles.gamePet}>
                <Text style={styles.gamePetEmoji}>
                  {activePet.type === 'dog' ? '🐕' : '🐾'}
                </Text>
                <Text style={styles.gamePetName}>{activePet.name}</Text>
              </View>
            )}
            
            <View style={styles.gameControls}>
              <TouchableOpacity
                style={[ styles.gameControlBtn, (isBasketballPlaying || basketballTimeLeft <= 0) && styles.gameControlBtnDisabled ]}
                onPress={launchBasketball}
                disabled={isBasketballPlaying || basketballTimeLeft <= 0}
              >
                {isBasketballPlaying ? <ActivityIndicator color="white" size="small" /> : <Icon name="sports-basketball" size={20} color="white" />}
                <Text style={styles.gameControlText}>
                  {basketballTimeLeft <= 0 ? 'Game End' : isBasketballPlaying ? 'Playing...' : 'Launch Ball'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Enhanced Cat Wand Game Modal */}
      <Modal
        visible={showCatWandGame}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCatWandGame(false)}
      >
        <SafeAreaView style={styles.gameModal}>
          <View style={styles.gameHeader}>
            <TouchableOpacity onPress={endCatWandGame}>
              <Icon name="close" size={24} color="#257D8C" />
            </TouchableOpacity>
            <Text style={styles.gameHeaderTitle}>Cat Wand Game</Text>
            <View style={styles.gameHeaderStats}>
              <Text style={styles.gameScore}>Score: {catWandScore}</Text>
              <Text style={styles.gameCombo}>Combo: {catWandCombo}</Text>
              <Text style={styles.gamePoints}>Points: {sessionPointsEarned}</Text>
              <Text style={styles.gameTimer}>Time: {catWandTimeLeft}s</Text>
            </View>
          </View>

          <View style={styles.catWandGameArea}>
            {/* Game Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(catWandTimeLeft / 45) * 100}%` }
                  ]} 
                />
              </View>
            </View>

            {/* Combo Indicator */}
            {catWandCombo > 2 && (
              <View style={styles.comboIndicator}>
                <Text style={styles.comboText}>COMBO x{catWandCombo}!</Text>
              </View>
            )}

            {/* Wand */}
            <Animated.View
              style={[
                styles.wand,
                {
                  transform: [
                    { translateX: wandAnimation.x },
                    { translateY: wandAnimation.y },
                  ],
                },
                { left: wandPosition.x, top: wandPosition.y }
              ]}
            >
              <Text style={styles.wandEmoji}>🪶</Text>
            </Animated.View>

            {/* Pet */}
            <View style={styles.gamePet}>
              <Text style={styles.gamePetEmoji}>
                {activePet?.type === 'cat' ? '🐱' : 
                  activePet?.type === 'dog' ? '🐕' : '🐾'}
              </Text>
              <Text style={styles.gamePetName}>{activePet?.name}</Text>
            </View>

            {/* Game Controls */}
            <View style={styles.gameControls}>
              <TouchableOpacity
                style={[
                  styles.gameControlBtn, 
                  (isCatWandPlaying || catWandTimeLeft <= 0) && styles.gameControlBtnDisabled
                ]}
                onPress={moveCatWand}
                disabled={isCatWandPlaying || catWandTimeLeft <= 0}
              >
                {isCatWandPlaying ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.wandEmoji}>🪄</Text>
                )}
                <Text style={styles.gameControlText}>
                  {catWandTimeLeft <= 0 ? 'Game Over' :
                    isCatWandPlaying ? 'Moving...' : 'Move Wand'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ✅ UPDATED Robot Control Panel Modal */}
      <Modal visible={showControlPanel} /* ... same props ... */ >
        <View style={styles.modalOverlay}>
          <View style={styles.controlPanelModal}>
            <View style={styles.controlHeader}>
              <Text style={styles.controlTitle}>Robot Control Panel</Text>
              <TouchableOpacity onPress={() => setShowControlPanel(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {robotConnected ? (
              <>
                {/* Robot Status */}
                <View style={styles.robotStatusSection}>
                  <View style={styles.robotStatusRow}>
                    <View style={styles.statusIndicator}>
                      <View style={[styles.statusDot, { backgroundColor: '#4ECDC4' }]} />
                      <Text style={styles.statusText}>Connected</Text>
                    </View>
                    <View style={styles.batteryIndicator}>
                      <Icon 
                        name={robotBattery > 50 ? "battery-full" : robotBattery > 20 ? "battery-alert" : "battery-20"} 
                        size={16} 
                        color={robotBattery > 50 ? "#4ECDC4" : robotBattery > 20 ? "#F39C12" : "#FF6B6B"} 
                      />
                      <Text style={styles.batteryText}>{robotBattery}%</Text>
                    </View>
                  </View>
                  
                  {lastCommand && (
                    <View style={styles.lastCommandIndicator}>
                      <Text style={styles.lastCommandLabel}>Last Command:</Text>
                      <Text style={styles.lastCommandText}>{lastCommand.replace('_', ' ')}</Text>
                    </View>
                  )}
                </View>

                {/* Movement Controls */}
                <View style={styles.controlSection}>
                  <Text style={styles.controlSectionTitle}>Movement Controls</Text>
                  <View style={styles.movementGrid}>
                    <View style={styles.movementRow}>
                      <TouchableOpacity
                        style={[styles.movementBtn, { backgroundColor: '#45B7D1' }]}
                        onPress={() => sendRobotCommand('move_forward')}
                        disabled={isControlling}
                      >
                        <Icon name="keyboard-arrow-up" size={24} color="white" />
                        <Text style={styles.movementBtnText}>Forward</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.movementRow}>
                      <TouchableOpacity
                        style={[styles.movementBtn, { backgroundColor: '#45B7D1' }]}
                        onPress={() => sendRobotCommand('turn_left')}
                        disabled={isControlling}
                      >
                        <Icon name="keyboard-arrow-left" size={24} color="white" />
                        <Text style={styles.movementBtnText}>Left</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.movementBtn, { backgroundColor: '#45B7D1' }]}
                        onPress={() => sendRobotCommand('turn_right')}
                        disabled={isControlling}
                      >
                        <Icon name="keyboard-arrow-right" size={24} color="white" />
                        <Text style={styles.movementBtnText}>Right</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.movementRow}>
                      <TouchableOpacity
                        style={[styles.movementBtn, { backgroundColor: '#45B7D1' }]}
                        onPress={() => sendRobotCommand('move_backward')}
                        disabled={isControlling}
                      >
                        <Icon name="keyboard-arrow-down" size={24} color="white" />
                        <Text style={styles.movementBtnText}>Back</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Action Controls */}
                <View style={styles.controlSection}>
                  <Text style={styles.controlSectionTitle}>Action Controls</Text>
                  <View style={styles.actionsGrid}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#F39C12' }]}
                      onPress={() => sendRobotCommand('dispense_treat')}
                      disabled={isControlling}
                    >
                      <Icon name="cake" size={20} color="white" />
                      <Text style={styles.actionBtnText}>Dispense{'\n'}Treat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#9B59B6' }]}
                      onPress={() => sendRobotCommand('play_sound')}
                      disabled={isControlling}
                    >
                      <Icon name="volume-up" size={20} color="white" />
                      <Text style={styles.actionBtnText}>Play{'\n'}Sound</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#4ECDC4' }]}
                      onPress={playVoiceCommand}
                      disabled={isControlling}
                    >
                      <Icon name="mic" size={20} color="white" />
                      <Text style={styles.actionBtnText}>Voice{'\n'}Command</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isControlling && (
                  <View style={styles.controllingIndicator}>
                    <ActivityIndicator size="small" color="#257D8C" />
                    <Text style={styles.controllingText}>Sending command to robot...</Text>
                  </View>
                )}

                {/* Quick Actions */}
                <View style={styles.quickActionsSection}>
                  <Text style={styles.controlSectionTitle}>Quick Actions</Text>
                  <View style={styles.quickActionsRow}>
                    <TouchableOpacity
                      style={styles.quickActionBtn}
                      onPress={() => {
                        sendRobotCommand('play_sound');
                        setTimeout(() => sendRobotCommand('dispense_treat'), 2000);
                      }}
                      disabled={isControlling}
                    >
                      <Text style={styles.quickActionText}>Call & Treat</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.quickActionBtn}
                      onPress={() => {
                        const commands = ['turn_left', 'move_forward', 'turn_right', 'move_forward'];
                        commands.forEach((cmd, index) => {
                          setTimeout(() => sendRobotCommand(cmd), index * 1500);
                        });
                      }}
                      disabled={isControlling}
                    >
                      <Text style={styles.quickActionText}>Play Sequence</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.disconnectedState}>
                <Icon name="wifi-off" size={60} color="#ccc" />
                <Text style={styles.disconnectedTitle}>Robot Not Connected</Text>
                <Text style={styles.disconnectedDescription}>
                  Connect to your pet companion robot to use remote controls
                </Text>
                <TouchableOpacity 
                  style={styles.connectRobotBtn}
                  onPress={connectToRobot}
                >
                  <Icon name="wifi" size={16} color="white" />
                  <Text style={styles.connectRobotText}>Connect Robot</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
        {/* ✅ NEW Voice Command Modal */}
      <Modal
        visible={showVoiceCommandModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowVoiceCommandModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.voiceCommandModal}>
            <TouchableOpacity style={styles.closeVoiceModal} onPress={() => setShowVoiceCommandModal(false)}>
                <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>

            <Text style={styles.voiceModalTitle}>Give a Command</Text>
            
            {(isProcessingVoice || isDetectingMovement) ? (
              <View style={styles.processingIndicator}>
                <ActivityIndicator size="large" color="#257D8C" />
                <Text style={styles.processingText}>
                  {isProcessingVoice ? 'Analyzing command...' : 'Checking pet movement...'}
                </Text>
              </View>
            ) : (
              <Animated.View style={[styles.microphoneButton, { transform: [{ scale: pulseAnim }] }]}>
                <TouchableOpacity onPress={startVoiceRecording} disabled={isListening}>
                  <Text style={styles.micIcon}>{isListening ? '... ' : '🎙️'}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
            <Text style={styles.voiceModalSubtitle}>
              {isListening ? 'Listening...' : 'Tap the mic to start'}
            </Text>
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
    shadowRadius: 8,
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
    width: 80,
    alignItems: 'flex-end',
  },
  gamePoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27ae60', // A green color for points
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C4E6E8',
  },
  pointsText: {
    marginLeft: 4,
    fontWeight: '600',
    color: '#257D8C',
    fontSize: 12,
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  petInfoCard: {
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
  petInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  petAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#C4E6E8',
    marginRight: 12,
  },
  petIconContainer: {
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
  petIcon: {
    fontSize: 24,
  },
  petDetails: {
    flex: 1,
  },
  petName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  petSubinfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  switchPetBtn: {
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#C4E6E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchPetText: {
    color: '#257D8C',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
  // ✅ ADD these new styles for the Voice Command Modal
  voiceCommandModal: {
    width: width * 0.8,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeVoiceModal: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  voiceModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 20,
  },
  voiceModalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
  },
  microphoneButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 40,
  },
  processingIndicator: {
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gameCard: {
    width: '48%',
    backgroundColor: '#257D8C',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 4,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  gameEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  gameTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  gameDescription: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 8,
  },
  gameStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  gameStatsText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  instructionIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 4,
  },
  instructionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  batteryText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  lastCommandIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  lastCommandLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  lastCommandText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#257D8C',
    textTransform: 'capitalize',
  },
  connectButton: {
    backgroundColor: '#257D8C',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    marginTop: 10,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  gameModal: {
    flex: 1,
    backgroundColor: '#E8F6F5',
  },
  gameHeader: {
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
  gameHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  gameHeaderStats: {
    alignItems: 'flex-end',
  },
  gameScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C066E3',
  },
  gameLevel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#45B7D1',
  },
  gameCombo: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F39C12',
  },
  gameTimer: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  progressBarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 3,
  },
  comboIndicator: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  comboText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F39C12',
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#F39C12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  basketballGameArea: {
    flex: 1,
    padding: 20,
    position: 'relative',
  },
  catWandGameArea: {
    flex: 1,
    padding: 20,
    position: 'relative',
    backgroundColor: '#f0f9f9',
  },
  basket: {
    position: 'absolute',
    top: 80,
    right: 30,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  basketEmoji: {
    fontSize: 40,
  },
  basketLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#257D8C',
    marginTop: 5,
  },
  ball: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  ballEmoji: {
    fontSize: 30,
  },
  wand: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  wandEmoji: {
    fontSize: 20,
  },
  gamePet: {
    position: 'absolute',
    bottom: 120,
    left: 30,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  gamePetEmoji: {
    fontSize: 40,
  },
  gamePetName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#257D8C',
    marginTop: 5,
  },
  gameControls: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  gameControlBtn: {
    backgroundColor: '#257D8C',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  gameControlBtnDisabled: {
    backgroundColor: '#8DA3A6',
  },
  gameControlText: {
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
  controlPanelModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    elevation: 10,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  controlTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  robotStatusSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  robotStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  controlSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  movementGrid: {
    alignItems: 'center',
  },
  movementRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  movementBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#45B7D1',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 3,
    shadowColor: '#45B7D1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  movementBtnText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: {
    backgroundColor: '#257D8C',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: 80,
  },
  actionBtnText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  quickActionsSection: {
    padding: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickActionBtn: {
    backgroundColor: '#C066E3',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#C066E3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  controllingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#f8f9ff',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 10,
  },
  controllingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  disconnectedState: {
    padding: 40,
    alignItems: 'center',
  },
  disconnectedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    marginBottom: 8,
  },
  disconnectedDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  connectRobotBtn: {
    backgroundColor: '#257D8C',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectRobotText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});