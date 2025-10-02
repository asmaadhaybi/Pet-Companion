// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Image,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation, route }) {
  const [userRole, setUserRole] = useState('user');
  const [userName, setUserName] = useState('');
  const [userPhoto, setUserPhoto] = useState(null);
  const [userPets, setUserPets] = useState([]);
  const [activePet, setActivePet] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [recentVideos, setRecentVideos] = useState([]);
  
  // Health-related state
  const [healthStats, setHealthStats] = useState(null);
  const [vitalSigns, setVitalSigns] = useState(null);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [moodNotes, setMoodNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const moodOptions = [
    { level: 1, emoji: '😢', label: 'Sad', color: '#FF6B6B' },
    { level: 2, emoji: '😐', label: 'Neutral', color: '#F39C12' },
    { level: 3, emoji: '😊', label: 'Happy', color: '#4ECDC4' },
    { level: 4, emoji: '😄', label: 'Playful', color: '#45B7D1' },
    { level: 5, emoji: '🤩', label: 'Excited', color: '#9B59B6' }
  ];

  // PawPal tier definitions
  const tierInfo = {
    automated: {
      color: '#4ECDC4',
      icon: 'schedule',
      name: 'Automated PawPal',
      description: 'Basic feeding & hydration'
    },
    intelligent: {
      color: '#45B7D1',
      icon: 'psychology',
      name: 'Intelligent PawPal',
      description: 'AI-powered with games'
    },
    luxury: {
      color: '#C066E3',
      icon: 'diamond',
      name: 'Luxury PawPal',
      description: 'Premium customizable'
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // This useEffect will run whenever the screen receives new parameters.
  useEffect(() => {
    // Check if the 'newActivePet' parameter exists from the route
    if (route.params?.newActivePet) {
      console.log("New active pet received from PetsManagementScreen:", route.params.newActivePet.name);
      
      // Update the activePet state with the new data
      const newPet = route.params.newActivePet;
      setActivePet(newPet);
      
      // Also, refresh the health data for this new pet
      loadHealthData(newPet.id);

      // Optional: Refresh the full list of pets in case other details changed
      fetchUserPets();
    }
  }, [route.params?.newActivePet]); // The effect depends on this specific parameter

 useEffect(() => {
    if (route.params?.refresh) {
      console.log("Refresh signal received, reloading all data...");
      loadInitialData();
      // Optional: Clear the parameter so it doesn't trigger again on focus without a new event
      navigation.setParams({ refresh: false });
    }
  }, [route.params?.refresh]);

  // This useEffect reloads data when the screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
        // We still want to refresh on focus to catch other changes (e.g., profile updates)
        console.log("HomeScreen focused, reloading data...");
        loadInitialData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUserProfile(),
      fetchUserPets(),
      fetchUserPoints(),
      fetchPawPalProducts(),
      fetchCategories(),
      fetchRecentVideos(),
    ]);
    setLoading(false);
  };

  const fetchUserProfile = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role || 'user');
        setUserName(user.name || 'Pet Owner');
        setUserPhoto(user.photo || null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setUserRole('user');
      setUserName('Pet Owner');
      setUserPhoto(null);
    }
  };

const fetchUserPets = async () => {
    try {
      const response = await ApiService.getAllPets();
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        const pets = response.data;
        setUserPets(pets);
        const active = pets.find(p => p.is_active) || pets[0];
        setActivePet(active);
        
        // ✅ CRITICAL: Once we have the active pet, load its health data
        if (active) {
            await loadHealthData(active.id);
        } else {
            // No active pet, clear health data
            setHealthStats(null);
            setVitalSigns(null);
        }

      } else {
        // No pets found, clear all pet-related state
        setUserPets([]);
        setActivePet(null);
        setHealthStats(null);
        setVitalSigns(null);
      }
    } catch (error) {
      console.error('Error fetching pets:', error);
    }
  };

// ✅ UPGRADED: This function now correctly loads health stats for a specific pet
  const loadHealthData = async (petId) => {
    if (!petId) return;
    try {
      const statsResponse = await ApiService.getHealthStats(petId);
      if (statsResponse.success) {
        setHealthStats(statsResponse.data.data);
      }
      const vitalsResponse = await ApiService.getVitalSigns(petId);
      if (vitalsResponse.success) {
        setVitalSigns(vitalsResponse.data.data);
      }
    } catch (error) {
      console.error(`Error loading health data for pet ${petId}:`, error);
    }
  };

  // ✅ UPGRADED: This function now fetches points from the API first
  const fetchUserPoints = async () => {
    try {
      // Try multiple API endpoints to get points
      let response = await ApiService.getUserPoints();
      
      // If getUserPoints doesn't work, try getPointsBalance
      if (!response.success || response.points === undefined) {
        response = await ApiService.getPointsBalance();
      }
      
      // Handle different response formats
      let points = 0;
      if (response.success) {
        if (response.points !== undefined) {
          points = response.points;
        } else if (response.data && response.data.points !== undefined) {
          points = response.data.points;
        } else if (response.data && response.data.data && response.data.data.points !== undefined) {
          points = response.data.data.points;
        } else if (response.balance !== undefined) {
          points = response.balance;
        }
      }
      
      setUserPoints(points);
      await AsyncStorage.setItem('userPoints', points.toString());
      
    } catch (error) {
      console.error("Failed to load user points from API:", error);
      // Try to get from AsyncStorage as fallback
      try {
        const storedPoints = await AsyncStorage.getItem('userPoints');
        setUserPoints(storedPoints ? parseInt(storedPoints, 10) : 150);
      } catch (storageError) {
        console.error("Failed to load points from storage:", storageError);
        setUserPoints(150); // Default fallback
      }
    }
  };

  const fetchPawPalProducts = async () => {
    try {
      // Try to fetch from API first
      const response = await ApiService.getProducts({ featured: true });
      if (response.success && response.data) {
        setFeaturedProducts(response.data.data || response.data);
        await AsyncStorage.setItem('featuredProducts', JSON.stringify(response.data.data || response.data));
        return;
      }
      
      // Fallback to stored products or mock data
      const storedProducts = await AsyncStorage.getItem('featuredProducts');
      if (storedProducts) {
        setFeaturedProducts(JSON.parse(storedProducts));
      } else {
        // Mock PawPal products matching the tier system
        const mockProducts = [
          {
            id: 1,
            name: 'Automated PawPal Base',
            description: 'Smart feeding and hydration with automated scheduling',
            price: 79.99,
            original_price: 99.99,
            points_required: 50,
            discount_percentage: 15,
            images: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400'],
            tier: 'automated',
            category: 'feeding',
            stock_quantity: 25,
            rating: 4.5,
            reviews_count: 142,
            features: ['Automated feeding', 'Portion control', 'Basic scheduling'],
            is_featured: true
          },
          {
            id: 2,
            name: 'Intelligent PawPal System',
            description: 'AI-powered pet care with interactive games and monitoring',
            price: 149.99,
            original_price: 179.99,
            points_required: 100,
            discount_percentage: 20,
            images: ['https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=400'],
            tier: 'intelligent',
            category: 'smart',
            stock_quantity: 15,
            rating: 4.7,
            reviews_count: 89,
            features: ['AI games', 'Health monitoring', 'Two-way communication'],
            is_featured: true
          },
          {
            id: 3,
            name: 'Luxury PawPal Complete',
            description: 'Premium customizable system with all luxury features',
            price: 299.99,
            original_price: 399.99,
            points_required: 200,
            discount_percentage: 25,
            images: ['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400'],
            tier: 'luxury',
            category: 'luxury',
            stock_quantity: 8,
            rating: 4.9,
            reviews_count: 67,
            features: ['Premium materials', 'Full customization', 'Professional monitoring'],
            is_featured: true
          },
          {
            id: 4,
            name: 'Luxury Camera Module',
            description: 'HD camera with night vision and motion detection',
            price: 49.99,
            original_price: 69.99,
            points_required: 40,
            discount_percentage: 12,
            images: ['https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=400'],
            tier: 'luxury',
            category: 'accessories',
            stock_quantity: 20,
            rating: 4.6,
            reviews_count: 34,
            features: ['4K HD', 'Night vision', 'Motion detection'],
            is_featured: false
          }
        ];
        setFeaturedProducts(mockProducts);
        await AsyncStorage.setItem('featuredProducts', JSON.stringify(mockProducts));
      }
    } catch (error) {
      console.error('Error fetching PawPal products:', error);
      setFeaturedProducts([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const mockCategories = ['Food', 'Toys', 'Accessories', 'Health', 'Treats', 'Care'];
      setCategories(mockCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

// Replace the existing fetchRecentVideos function with this:
const fetchRecentVideos = async () => {
  try {
    const response = await ApiService.getRecentVideos(3); // Get 3 recent videos
    if (response.success && Array.isArray(response.data)) {
      setRecentVideos(response.data);
    } else {
      // Fallback to AsyncStorage if API fails
      const storedVideos = await AsyncStorage.getItem('petVideos');
      if (storedVideos) {
        const videos = JSON.parse(storedVideos);
        setRecentVideos(videos.slice(0, 3)); // Show last 3 videos
      } else {
        setRecentVideos([]);
      }
    }
  } catch (error) {
    console.error('Error fetching recent videos:', error);
    // Try AsyncStorage as fallback
    try {
      const storedVideos = await AsyncStorage.getItem('petVideos');
      if (storedVideos) {
        const videos = JSON.parse(storedVideos);
        setRecentVideos(videos.slice(0, 3));
      } else {
        setRecentVideos([]);
      }
    } catch (storageError) {
      console.error('Error reading from storage:', storageError);
      setRecentVideos([]);
    }
  }
};


  const canManageProducts = () => {
    return userRole === 'admin' || userRole === 'super_admin';
  };

  const switchActivePet = async (pet) => {
    setActivePet(pet);
    await AsyncStorage.setItem('activePet', JSON.stringify(pet));
    await loadHealthData(pet.id);
  };

  const handleSelectMood = (mood) => {
    if (!activePet) {
      Alert.alert(
        'Pet Setup Required', 
        'Please set up your pet profile first to track mood',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Setup Pet', 
            onPress: () => navigation.navigate('PetInfo') 
          }
        ]
      );
      return;
    }
    setSelectedMood(mood);
    setShowMoodModal(true);
  };

  const handleRecordMood = async () => {
    if (!selectedMood || !activePet) return;
    setIsRecording(true);
    try {
      const response = await ApiService.recordMood(activePet.id, selectedMood.level, moodNotes);
      if (response.success) {
        Alert.alert("Success", "Mood recorded successfully!");
        setShowMoodModal(false);
        setSelectedMood(null);
        setMoodNotes('');
        await loadHealthData(activePet.id); // Refresh data
        
        // Award points for tracking mood
        const pointsEarned = 10;
        const newPoints = userPoints + pointsEarned;
        setUserPoints(newPoints);
        await AsyncStorage.setItem('userPoints', newPoints.toString());
      } else {
        throw new Error(response.error || 'Failed to record mood');
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setIsRecording(false);
    }
  };

  const getMoodByLevel = (level) => moodOptions.find(m => m.level === Math.round(level)) || moodOptions[1];

  const getTierInfo = (tier) => {
    return tierInfo[tier] || {
      color: '#257D8C',
      icon: 'pets',
      name: 'PawPal',
      description: 'Pet care system'
    };
  };

  const canUsePointsDiscount = (product) => {
    return product.points_required > 0 && userPoints >= product.points_required;
  };

  // ✅ The Corrected Function
  const getDiscountedPrice = (prod) => {
    // 1. Safely convert price to a number, defaulting to 0
    const price = parseFloat(prod?.price) || 0; 
    const discount = parseFloat(prod?.discount_percentage) || 0;

    if (canUsePointsDiscount(prod)) {
      return price * (1 - discount / 100);
    }
    
    // 2. IMPORTANT: Always return the base price if no discount applies
    return price; 
  };

  const renderFeaturedProduct = ({ item }) => {
    const tierData = getTierInfo(item.tier);
    const hasDiscount = canUsePointsDiscount(item);
    const finalPrice = getDiscountedPrice(item);
    // ✅ FIX: Convert all prices to numbers and provide default values
    const itemPrice = parseFloat(item.price) || 0;
    const itemOriginalPrice = parseFloat(item.original_price) || 0;
    // ✅ FIX: Convert original_price and rating to numbers to prevent crashes
    const originalPrice = parseFloat(item.original_price) || 0;
    const rating = parseFloat(item.rating) || 0;
    
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
      >
        {/* Tier Badge */}
        <View style={[styles.tierBadge, { backgroundColor: tierData.color }]}>
          <Icon name={tierData.icon} size={10} color="white" />
          <Text style={styles.tierBadgeText}>{item.tier.toUpperCase()}</Text>
        </View>

        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Icon name="pets" size={30} color="#C4E6E8" />
          </View>
        )}

        {/* Featured Badge */}
        {item.is_featured && (
          <View style={styles.featuredBadge}>
            <Icon name="star" size={10} color="white" />
            <Text style={styles.featuredText}>FEATURED</Text>
          </View>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount_percentage}% OFF</Text>
          </View>
        )}
        
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          
          <View style={styles.ratingContainer}>
            <Icon name="star" size={12} color="#F7931E" />
            <Text style={styles.ratingText}>
              {rating.toFixed(1)} ({item.reviews_count})
            </Text>
          </View>

          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              {/* ✅ FIX: Use the safe numeric variable for original price */}
              {hasDiscount && itemOriginalPrice > 0 && (
                <Text style={styles.originalPrice}>${itemOriginalPrice.toFixed(2)}</Text>
              )}
              {/* ✅ FIX: And for the final price */}
              <Text style={[styles.productPrice, { color: tierData.color }]}>
                ${finalPrice.toFixed(2)}
              </Text>
            </View>
            
            {item.points_required > 0 && (
              <View style={[
                styles.pointsBadge,
                { backgroundColor: canUsePointsDiscount(item) ? '#4CAF50' : '#FFC107' }
              ]}>
                <Icon name="stars" size={8} color="white" />
                <Text style={styles.pointsRequiredText}>{item.points_required} pts</Text>
              </View>
            )}
          </View>

          {/* Features Preview */}
          <View style={styles.featuresContainer}>
            {item.features && item.features.slice(0, 2).map((feature, index) => (
              <View key={index} style={styles.featureTag}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTierCategory = ({ item }) => {
    const tierData = getTierInfo(item);
    const tierProducts = featuredProducts.filter(p => p.tier === item);
    
    return (
      <TouchableOpacity
        style={[styles.tierCard, { borderColor: tierData.color }]}
        onPress={() => navigation.navigate('Marketplace', { selectedTier: tierData.name })}
      >
        <View style={[styles.tierIcon, { backgroundColor: tierData.color }]}>
          <Icon name={tierData.icon} size={24} color="white" />
        </View>
        <Text style={styles.tierName}>{tierData.name}</Text>
        <Text style={styles.tierDescription}>{tierData.description}</Text>
        <Text style={styles.tierProductCount}>
          {tierProducts.length} products
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => navigation.navigate('Marketplace', { selectedCategory: item })}
    >
      <Text style={styles.categoryIcon}>
        {item === 'Food' ? '🍖' : 
         item === 'Toys' ? '🎾' : 
         item === 'Accessories' ? '🎀' : 
         item === 'Health' ? '🏥' : 
         item === 'Treats' ? '🦴' : '🛒'}
      </Text>
      <Text style={styles.categoryName}>{item}</Text>
    </TouchableOpacity>
  );

const renderRecentVideo = ({ item }) => (
  <TouchableOpacity
    style={styles.videoCard}
    onPress={() => navigation.navigate('VideoPlayer', { video: item })}
  >
    <View style={styles.videoThumbnail}>
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.videoThumbnailImage} />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Icon name="play-circle-filled" size={40} color="#257D8C" />
        </View>
      )}
      {item.formatted_duration && (
        <View style={styles.videoDurationBadge}>
          <Text style={styles.videoDurationText}>{item.formatted_duration}</Text>
        </View>
      )}
      {item.is_favorite && (
        <View style={styles.favoriteIndicator}>
          <Icon name="favorite" size={16} color="#FF6B6B" />
        </View>
      )}
    </View>
    
    <View style={styles.videoCardContent}>
      <Text style={styles.videoTitle} numberOfLines={2}>
        {item.title || 'Untitled Video'}
      </Text>
      
      {item.pet && (
        <View style={styles.videoPetInfo}>
          <Text style={styles.videoPetIcon}>
            {item.pet.type === 'dog' ? '🐕' : 
             item.pet.type === 'cat' ? '🐱' : '🐾'}
          </Text>
          <Text style={styles.videoPetName}>{item.pet.name}</Text>
        </View>
      )}
      
      <Text style={styles.videoDate}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  </TouchableOpacity>
);


  const renderPetSelector = () => {
    if (userPets.length <= 1) return null;

    return (
      <View style={styles.petSelector}>
        <Text style={styles.petSelectorTitle}>Select Active Pet:</Text>
        <FlatList
          data={userPets}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.petSelectorItem,
                activePet?.id === item.id && styles.petSelectorItemActive
              ]}
              onPress={() => switchActivePet(item)}
            >
              <Text style={styles.petSelectorIcon}>
                {item.type === 'dog' ? '🐕' : item.type === 'cat' ? '🐱' : '🐾'}
              </Text>
              <Text style={[
                styles.petSelectorName,
                activePet?.id === item.id && styles.petSelectorNameActive
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.petSelectorList}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadInitialData} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hello, {userName}!</Text>
            <Text style={styles.subGreeting}>
              {userRole === 'super_admin' ? 'Super Admin Dashboard' :
               userRole === 'admin' ? 'PawPal Partner Dashboard' : 'Welcome to PawPal'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.pointsContainer}
              onPress={() => navigation.navigate('PointsHistory')}
            >
              <Icon name="stars" size={20} color="#C066E3" />
              <Text style={styles.pointsText}>{userPoints} pts</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileBtn}
              onPress={() => navigation.navigate('UserProfile')}
            >
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.profileImage} />
              ) : (
                <Icon name="person" size={24} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Pet Selector (if multiple pets) */}
        {userRole === 'user' && renderPetSelector()}

       {/* Pet Info Card (for users) */}
        {userRole === 'user' && (
          <View style={styles.petCard}>
            {activePet ? (
              <>
                <View style={styles.petCardHeader}>
                  <View style={styles.petCardLeft}>
                    <View style={styles.petAvatarContainer}>
                      {activePet.photo ? (
                        <Image source={{ uri: activePet.photo }} style={styles.petAvatar} />
                      ) : (
                        <View style={styles.petIconContainer}>
                          <Text style={styles.petIcon}>
                            {activePet.type === 'dog' ? '🐕' : 
                             activePet.type === 'cat' ? '🐱' : 
                             activePet.type === 'bird' ? '🐦' :
                             activePet.type === 'fish' ? '🐠' :
                             activePet.type === 'rabbit' ? '🐰' :
                             activePet.type === 'hamster' ? '🐹' : '🐾'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.petDetails}>
                      <Text style={styles.petName}>{activePet.name}</Text>
                      <Text style={styles.petInfo}>
                        {activePet.breed} • {activePet.age} years • {activePet.weight}kg
                      </Text>
                      <Text style={styles.petSubInfo}>
                        Size: {activePet.size} 
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.editPetBtn}
                    onPress={() => navigation.navigate('PetInfo', { petId: activePet.id })}
                  >
                    <Icon name="edit" size={16} color="white" />
                    <Text style={styles.editPetText}>Edit</Text>
                  </TouchableOpacity>
                </View>
                
                {userPets.length > 0 && (
                  <TouchableOpacity 
                    style={styles.managePetsBtn}
                    onPress={() => navigation.navigate('PetsManagement')}
                  >
                    <Icon name="pets" size={16} color="#257D8C" />
                    <Text style={styles.managePetsText}>Manage All Pets ({userPets.length})</Text>
                    <Icon name="arrow-forward" size={16} color="#257D8C" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity 
                style={styles.setupPetCard}
                onPress={() => navigation.navigate('PetInfo')}
              >
                <View style={styles.setupPetIconContainer}>
                  <Icon name="pets" size={40} color="#257D8C" />
                </View>
                <View style={styles.setupPetContent}>
                  <Text style={styles.setupPetTitle}>Set up your pet profile</Text>
                  <Text style={styles.setupPetSubtitle}>
                    Add your pet's info to get personalized PawPal recommendations
                  </Text>
                  <TouchableOpacity 
                    style={styles.setupPetButton}
                    onPress={() => navigation.navigate('PetInfo')}
                  >
                    <Icon name="add" size={20} color="white" />
                    <Text style={styles.setupPetButtonText}>Add Pet</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
        {/* Quick Actions */}
        {userRole === 'user' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: '#FF6B6B' }]}
              onPress={() => navigation.navigate('Nutrition')}
            >
              <Icon name="restaurant" size={24} color="white" />
              <Text style={styles.quickActionText}>Nutrition</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: '#4ECDC4' }]}
              onPress={() => navigation.navigate('Games')}
            >
              <Icon name="sports-esports" size={24} color="white" />
              <Text style={styles.quickActionText}>Games</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: '#45B7D1' }]}
              onPress={() => navigation.navigate('Analytics')}
            >
              <Icon name="analytics" size={24} color="white" />
              <Text style={styles.quickActionText}>Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: '#C066E3' }]}
              onPress={() => navigation.navigate('Marketplace')}
            >
              <Icon name="shopping-cart" size={24} color="white" />
              <Text style={styles.quickActionText}>PawPal Store</Text>
            </TouchableOpacity>
          </View>
        </View>
 )}
        {/* Health Monitor (for users) */}
        {userRole === 'user' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🏥 Health Monitor</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Health')}>
                <Text style={styles.seeAllText}>View Details</Text>
              </TouchableOpacity>
            </View>

            {activePet ? (
              <View style={styles.healthCard}>
                {/* Vital Signs */}
                <View style={styles.vitalsSection}>
                  <Text style={styles.vitalsTitle}>Vital Signs</Text>
                  <View style={styles.vitalsGrid}>
                    <View style={styles.vitalItem}>
                      <Icon name="favorite" size={20} color="#FF6B6B" />
                      <Text style={styles.vitalValue}>{vitalSigns?.heart_rate || '--'}</Text>
                      <Text style={styles.vitalLabel}>BPM</Text>
                    </View>
                    
                    <View style={styles.vitalItem}>
                      <Icon name="air" size={20} color="#45B7D1" />
                      <Text style={styles.vitalValue}>{vitalSigns?.oxygen_level || '--'}%</Text>
                      <Text style={styles.vitalLabel}>O2</Text>
                    </View>
                    
                    <View style={styles.vitalItem}>
                      <Icon name="device-thermostat" size={20} color="#F39C12" />
                      <Text style={styles.vitalValue}>{vitalSigns?.temperature || '--'}°</Text>
                      <Text style={styles.vitalLabel}>Temp</Text>
                    </View>
                  </View>
                </View>

                {/* Mood Tracking */}
                <View style={styles.moodSection}>
                  <View style={styles.moodHeader}>
                    <Text style={styles.moodTitle}>Current Mood</Text>
                    <View style={styles.currentMoodDisplay}>
                      <Text style={styles.currentMoodEmoji}>
                        {getMoodByLevel(healthStats?.mood_average || 3).emoji}
                      </Text>
                      <Text style={styles.currentMoodLevel}>
                        {(healthStats?.mood_average || 3).toFixed(1)}/5.0
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.moodSelectionTitle}>How is {activePet.name} feeling today?</Text>
                  <View style={styles.moodOptions}>
                    {moodOptions.map((mood) => (
                      <TouchableOpacity
                        key={mood.level}
                        style={[styles.moodOption, { borderColor: mood.color }]}
                        onPress={() => handleSelectMood(mood)}
                      >
                        <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.noHealthData}>
                <Icon name="health-and-safety" size={40} color="#C4E6E8" />
                <Text style={styles.noHealthDataTitle}>No Health Data</Text>
                <Text style={styles.noHealthDataSubtitle}>Set up your pet profile to start monitoring health</Text>
              </View>
            )}
          </View>
        )}

        {/* PawPal Store */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🛒 PawPal Store</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Marketplace')}>
              <Text style={styles.seeAllText}>Shop All</Text>
            </TouchableOpacity>
          </View>

          {/* PawPal Tiers */}
          <Text style={styles.subsectionTitle}>Choose Your PawPal Tier</Text>
          <FlatList
            data={['automated', 'intelligent', 'luxury']}
            renderItem={renderTierCategory}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tiersContainer}
          />

          {/* Featured Products */}
          <Text style={styles.subsectionTitle}>Featured Products</Text>
          <FlatList
            data={featuredProducts.filter(p => p.is_featured)}
            renderItem={renderFeaturedProduct}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsContainer}
          />
        </View>

        {/* Recent Pet Videos (for users) */}
        {/* {userRole === 'user' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📹 Recent Pet Videos</Text>
              <TouchableOpacity onPress={() => navigation.navigate('VideoHistory')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {recentVideos.length > 0 ? (
              <FlatList
                data={recentVideos}
                renderItem={renderRecentVideo}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.videosContainer}
              />
            ) : (
              <TouchableOpacity 
                style={styles.noVideosCard}
                onPress={() => navigation.navigate('Camera')}
              >
                <Icon name="videocam" size={40} color="#C4E6E8" />
                <Text style={styles.noVideosTitle}>No videos yet</Text>
                <Text style={styles.noVideosSubtitle}>Start recording your pet's moments</Text>
              </TouchableOpacity>
            )}
          </View>
        )} */}

        {/* Admin Management (for admins) */}
        {canManageProducts() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {userRole === 'super_admin' ? '⚡ Super Admin Panel' : '🏪 PawPal Partner Dashboard'}
            </Text>
            
            <View style={styles.adminActionsGrid}>
              <TouchableOpacity
                style={[styles.adminActionBtn, { backgroundColor: '#257D8C' }]}
                onPress={() => navigation.navigate('AddProduct')}
              >
                <Icon name="add-shopping-cart" size={24} color="white" />
                <Text style={styles.adminActionText}>Add PawPal Product</Text>
              </TouchableOpacity>
              
             <TouchableOpacity
  style={[styles.adminActionBtn, { backgroundColor: '#4ECDC4' }]}
  onPress={() => navigation.navigate('Marketplace')}
>
  <Icon name="inventory" size={24} color="white" />
  <Text style={styles.adminActionText}>My Products</Text>
</TouchableOpacity>

              <TouchableOpacity
                style={[styles.adminActionBtn, { backgroundColor: '#F7931E' }]}
                onPress={() => navigation.navigate('OrdersManagement')}
              >
                <Icon name="receipt-long" size={24} color="white" />
                <Text style={styles.adminActionText}>Orders</Text>
              </TouchableOpacity>

              {/* <TouchableOpacity
                style={[styles.adminActionBtn, { backgroundColor: '#9B59B6' }]}
                onPress={() => navigation.navigate('SalesDashboard')}
              >
                <Icon name="trending-up" size={24} color="white" />
                <Text style={styles.adminActionText}>Sales Analytics</Text>
              </TouchableOpacity> */}

              {userRole === 'super_admin' && (
                <>
                  <TouchableOpacity
                    style={[styles.adminActionBtn, { backgroundColor: '#C066E3' }]}
                    onPress={() => navigation.navigate('UserManagement')}
                  >
                    <Icon name="people" size={24} color="white" />
                    <Text style={styles.adminActionText}>User Management</Text>
                  </TouchableOpacity>
                  
                  {/* <TouchableOpacity
                    style={[styles.adminActionBtn, { backgroundColor: '#E74C3C' }]}
                    onPress={() => navigation.navigate('SystemAnalytics')}
                  >
                    <Icon name="dashboard" size={24} color="white" />
                    <Text style={styles.adminActionText}>System Analytics</Text>
                  </TouchableOpacity> */}
                </>
              )}
            </View>
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert(
              'Logout',
              'Are you sure you want to logout?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: async () => {
                    await AsyncStorage.clear();
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Login' }],
                    });
                  },
                },
              ]
            );
          }}
        >
          <Icon name="logout" size={20} color="white" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* FAB for Admin */}
      {canManageProducts() && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddProduct')}
        >
          <Icon name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  header: {
    backgroundColor: 'white',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  subGreeting: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C4E6E8',
    marginRight: 10,
  },
  pointsText: {
    marginLeft: 5,
    fontWeight: '600',
    color: '#257D8C',
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#257D8C',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  petSelector: {
    backgroundColor: 'white',
    margin: 15,
    marginBottom: 0,
    borderRadius: 15,
    padding: 16,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  petSelectorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#257D8C',
    marginBottom: 10,
  },
  petSelectorList: {
    paddingVertical: 5,
  },
  petSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  petSelectorItemActive: {
    backgroundColor: '#E8F6F5',
    borderColor: '#257D8C',
  },
  petSelectorIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  petSelectorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  petSelectorNameActive: {
    color: '#257D8C',
    fontWeight: '600',
  },
  petCard: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 15,
    padding: 16,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  petCardHeader: {
    marginBottom: 12,
  },
  petCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginBottom: 10,
  },
  petAvatarContainer: {
    marginRight: 12,
  },
  petAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#C4E6E8',
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
  editPetBtn: {
    backgroundColor: '#257D8C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  editPetText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  managePetsBtn: {
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#C4E6E8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managePetsText: {
    color: '#257D8C',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  setupPetCard: {
    padding: 20,
    alignItems: 'center',
  },
  setupPetIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#C4E6E8',
  },
  setupPetContent: {
    alignItems: 'center',
    width: '100%',
  },
  setupPetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    textAlign: 'center',
    marginBottom: 8,
  },
  setupPetSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  setupPetButton: {
    backgroundColor: '#257D8C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  setupPetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#257D8C',
    marginBottom: 10,
  },
  seeAllText: {
    fontSize: 14,
    color: '#C066E3',
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionBtn: {
    width: '48%',
    backgroundColor: '#257D8C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  quickActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  // Health Monitor Styles
  healthCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  vitalsSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vitalsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 12,
  },
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  vitalItem: {
    alignItems: 'center',
    flex: 1,
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 8,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  moodSection: {
    flex: 1,
  },
  moodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  moodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  currentMoodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentMoodEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  currentMoodLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
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
    fontSize: 20,
  },
  noHealthData: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  noHealthDataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 12,
  },
  noHealthDataSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  // PawPal Store Styles
  tiersContainer: {
    paddingBottom: 15,
  },
  tierCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 16,
    alignItems: 'center',
    marginRight: 15,
    width: 140,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
  },
  tierIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  tierName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 6,
  },
  tierProductCount: {
    fontSize: 10,
    color: '#257D8C',
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingBottom: 15,
  },
  categoryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginRight: 12,
    minWidth: 80,
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#257D8C',
    textAlign: 'center',
  },
  productsContainer: {
    paddingBottom: 10,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 12,
    marginRight: 15,
    width: 160,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  tierBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1,
  },
  tierBadgeText: {
    color: 'white',
    fontSize: 7,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  productImage: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    marginBottom: 8,
  },
  placeholderImage: {
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F7931E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1,
  },
  featuredText: {
    color: 'white',
    fontSize: 7,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  discountBadge: {
    position: 'absolute',
    top: 32,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1,
  },
  discountText: {
    color: 'white',
    fontSize: 7,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  priceContainer: {
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 10,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  pointsRequiredText: {
    fontSize: 8,
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  featureTag: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
    marginBottom: 2,
  },
  featureText: {
    fontSize: 8,
    color: '#257D8C',
    fontWeight: '500',
  },
  videosContainer: {
    paddingBottom: 10,
  },
  videoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginRight: 15,
    alignItems: 'center',
    width: 100,
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  videoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  videoDate: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  noVideosCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noVideosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 10,
  },
  noVideosSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  adminActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  adminActionBtn: {
    width: '48%',
    backgroundColor: '#257D8C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  adminActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    backgroundColor: 'white',
    width: '48%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#257D8C',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoutBtn: {
    backgroundColor: '#FF4757',
    margin: 15,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  logoutText: {
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
    textAlignVertical: 'top',
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
// Add these new styles to the existing StyleSheet:
const newVideoStyles = StyleSheet.create({
  videoThumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  videoDurationText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  favoriteIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  videoCardContent: {
    padding: 8,
  },
  videoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  videoPetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  videoPetIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  videoPetName: {
    fontSize: 10,
    fontWeight: '500',
    color: '#257D8C',
  },
  videoDate: {
    fontSize: 9,
    color: '#666',
  },
});

// Update the existing videoCard style:
const updatedVideoCardStyle = {
  backgroundColor: 'white',
  borderRadius: 12,
  marginRight: 15,
  width: 140,
  elevation: 2,
  shadowColor: '#257D8C',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  overflow: 'hidden',
};

// Update the existing videoThumbnail style:
const updatedVideoThumbnailStyle = {
  width: '100%',
  height: 80,
  position: 'relative',
};
// Navigation function to handle video player navigation
const navigateToVideoPlayer = (video) => {
  navigation.navigate('VideoPlayer', { video });
};

// Function to handle video upload success
const handleVideoUploadSuccess = async (newVideo) => {
  // Refresh the recent videos list
  await fetchRecentVideos();
  
  // Show success message
  Alert.alert('Success', 'Video uploaded successfully!');
  
  // Optionally navigate to the video player
  // navigateToVideoPlayer(newVideo);
};

// Updated Recent Pet Videos section JSX:
// const RecentVideosSection = () => (
//   <View style={styles.section}>
//     <View style={styles.sectionHeader}>
//       <Text style={styles.sectionTitle}>📹 Recent Pet Videos</Text>
//       <TouchableOpacity onPress={() => navigation.navigate('VideoHistory')}>
//         <Text style={styles.seeAllText}>View All</Text>
//       </TouchableOpacity>
//     </View>
    
//     {recentVideos.length > 0 ? (
//       <FlatList
//         data={recentVideos}
//         renderItem={renderRecentVideo}
//         keyExtractor={(item) => item.id.toString()}
//         horizontal
//         showsHorizontalScrollIndicator={false}
//         contentContainerStyle={styles.videosContainer}
//       />
//     ) : (
//       <TouchableOpacity 
//         style={styles.noVideosCard}
//         onPress={() => navigation.navigate('Camera')}
//       >
//         <Icon name="videocam" size={40} color="#C4E6E8" />
//         <Text style={styles.noVideosTitle}>No videos yet</Text>
//         <Text style={styles.noVideosSubtitle}>Start recording your pet's moments</Text>
//         <TouchableOpacity
//           style={styles.recordVideoBtn}
//           onPress={() => navigation.navigate('Camera')}
//         >
//           <Icon name="videocam" size={16} color="white" />
//           <Text style={styles.recordVideoBtnText}>Record Video</Text>
//         </TouchableOpacity>
//       </TouchableOpacity>
//     )}
//   </View>
// );
// Add these additional styles for the enhanced video section:
const additionalVideoStyles = {
  recordVideoBtn: {
    backgroundColor: '#257D8C',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  recordVideoBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
};