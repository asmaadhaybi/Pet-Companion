// screens/AnalyticsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen({ navigation }) {
  const [activePet, setActivePet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [healthMetrics, setHealthMetrics] = useState([]);
  const [insights, setInsights] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      loadAnalyticsData();
    }, [selectedPeriod])
  );

  const loadAnalyticsData = async () => {
    setLoading(true);
    setAnalyticsData(null);
    
    try {
      // First get the active pet
      await fetchActivePet();
      
      const response = await ApiService.getPetAnalytics(null, selectedPeriod);

      if (response.success && response.data?.data) {
        const data = response.data.data;
        
        // Transform the backend data to match frontend expectations
        const transformedData = {
          nutrition: {
            waterIntake: data.nutrition?.water_intake || 0,
            foodIntake: data.nutrition?.food_intake || 0,
            treatsGiven: data.nutrition?.treats_given || 0,
            medicationGiven: data.nutrition?.medication_taken || 0,
            dailyAverage: {
              water: data.nutrition?.daily_average?.water || 0,
              food: data.nutrition?.daily_average?.food || 0,
              treats: data.nutrition?.daily_average?.treats || 0,
              medication: data.nutrition?.daily_average?.meds || 0
            }
          },
          activity: {
            gamesPlayed: parseInt(data.activity?.games_played) || 0,
            totalPlayTime: parseFloat(data.activity?.total_play_time) || 0,
            pointsEarned: parseInt(data.activity?.points_earned) || 0,
            favoriteGame: data.activity?.favorite_game || 'None',
            averageScore: parseFloat(data.activity?.average_score) || 0,
            totalSessions: parseInt(data.activity?.total_sessions) || parseInt(data.activity?.games_played) || 0,
            avgSessionDuration: parseFloat(data.activity?.avg_session_duration) || 0
          },
          health: {
            moodScore: data.health?.mood_score || 85,
            activityLevel: data.health?.activity_level || 'Medium',
            lastMoodRecord: data.health?.last_vet_visit || null,
            averageMood: data.health?.mood_score || 85
          }
        };

        setAnalyticsData(transformedData);
        
        // Set weekly data if available
        if (data.weekly_trend && Array.isArray(data.weekly_trend)) {
          setWeeklyData(data.weekly_trend);
        }
        
        // Set insights if available
        if (data.insights && Array.isArray(data.insights)) {
          setInsights(data.insights);
        }
        
        // Generate health metrics
        if (data.pet) {
          generateHealthMetrics(transformedData, data.pet);
        }
        
      } else {
        console.error("API Error:", response.error || "Could not load analytics data.");
        // Set default data structure to prevent crashes
        setAnalyticsData(getDefaultAnalyticsData());
      }
    } catch (error) {
      console.error('Error in loadAnalyticsData:', error);
      // Set default data structure to prevent crashes
      setAnalyticsData(getDefaultAnalyticsData());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultAnalyticsData = () => ({
    nutrition: {
      waterIntake: 0,
      foodIntake: 0,
      treatsGiven: 0,
      medicationGiven: 0,
      dailyAverage: {
        water: 0,
        food: 0,
        treats: 0,
        medication: 0
      }
    },
    activity: {
      gamesPlayed: 0,
      totalPlayTime: 0,
      pointsEarned: 0,
      favoriteGame: 'None'
    },
    health: {
      moodScore: 85,
      activityLevel: 'Medium',
      lastMoodRecord: null,
      averageMood: 85
    }
  });

  const fetchActivePet = async () => {
    try {
      const storedActivePet = await AsyncStorage.getItem('activePet');
      if (storedActivePet) {
        const pet = JSON.parse(storedActivePet);
        setActivePet(pet);
        return pet;
      }
      return null;
    } catch (error) {
      console.error('Error fetching pet data:', error);
      return null;
    }
  };

  const generateHealthMetrics = (analyticsData, pet) => {
    const metrics = [
      {
        name: 'Weight',
        value: pet?.weight || 0,
        unit: 'kg',
        trend: 'stable',
        icon: 'monitor-weight',
        color: '#4ECDC4'
      },
      {
        name: 'Activity Level',
        value: getActivityLevelPercentage(analyticsData.activity?.gamesPlayed || 0),
        unit: '%',
        trend: analyticsData.activity?.gamesPlayed > 5 ? 'up' : 'stable',
        icon: 'directions-run',
        color: '#FF6B6B'
      },
      {
        name: 'Mood Score',
        value: analyticsData.health?.moodScore || 85,
        unit: '/100',
        trend: 'stable',
        icon: 'mood',
        color: '#45B7D1'
      },
      {
        name: 'Daily Water',
        value: analyticsData.nutrition?.dailyAverage?.water || 0,
        unit: 'ml',
        trend: 'stable',
        icon: 'water-drop',
        color: '#9B59B6'
      }
    ];
    
    setHealthMetrics(metrics);
  };

  const getActivityLevelPercentage = (gamesPlayed) => {
    return Math.min(Math.round((gamesPlayed / 10) * 100), 100);
  };

  // ✅ CORRECTED: This function now navigates correctly
  const generateReport = () => {
    if (!analyticsData || !activePet) {
      Alert.alert("No Data", "Analytics data is not available to generate a report.");
      return;
    }

    Alert.alert(
      'Generate Report',
      'Choose a report type:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Weekly Report', 
          onPress: () => navigation.navigate('ReportViewer', { 
            type: 'weekly', 
            data: analyticsData, 
            pet: activePet 
          })
        },
        { 
          text: 'Monthly Report', 
          onPress: () => navigation.navigate('ReportViewer', { 
            type: 'monthly', 
            data: analyticsData, 
            pet: activePet 
          })
        }
      ]
    );


    // This navigation call will now work correctly
    navigation.navigate('ReportViewer', { 
      type: selectedPeriod, // 'week', 'month', etc.
      data: analyticsData,
      pet: activePet 
    });
  };

  const exportData = async () => {
    try {
      Alert.alert(
        'Export Data',
        'Your pet\'s data export is being prepared.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {['week', 'month', 'year'].map(period => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && styles.periodButtonActive
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text style={[
            styles.periodButtonText,
            selectedPeriod === period && styles.periodButtonTextActive
          ]}>
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSummaryCards = () => {
    if (!analyticsData?.nutrition?.dailyAverage) {
      return (
        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <Icon name="local-drink" size={30} color="#45B7D1" />
            <Text style={styles.summaryNumber}>0ml</Text>
            <Text style={styles.summaryLabel}>Daily Water</Text>
          </View>
          <View style={styles.summaryCard}>
            <Icon name="restaurant" size={30} color="#FF6B6B" />
            <Text style={styles.summaryNumber}>0g</Text>
            <Text style={styles.summaryLabel}>Daily Food</Text>
          </View>
          <View style={styles.summaryCard}>
            <Icon name="sports-esports" size={30} color="#4ECDC4" />
            <Text style={styles.summaryNumber}>0</Text>
            <Text style={styles.summaryLabel}>Games Played</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <Icon name="local-drink" size={30} color="#45B7D1" />
          <Text style={styles.summaryNumber}>
            {Math.round(analyticsData.nutrition.dailyAverage.water || 0)}ml
          </Text>
          <Text style={styles.summaryLabel}>Daily Water</Text>
        </View>
        <View style={styles.summaryCard}>
          <Icon name="restaurant" size={30} color="#FF6B6B" />
          <Text style={styles.summaryNumber}>
            {Math.round(analyticsData.nutrition.dailyAverage.food || 0)}g
          </Text>
          <Text style={styles.summaryLabel}>Daily Food</Text>
        </View>
        <View style={styles.summaryCard}>
          <Icon name="sports-esports" size={30} color="#4ECDC4" />
          <Text style={styles.summaryNumber}>
            {analyticsData.activity?.gamesPlayed || 0}
          </Text>
          <Text style={styles.summaryLabel}>Games Played</Text>
        </View>
      </View>
    );
  };

  const renderNutritionChart = () => {
    if (!analyticsData?.nutrition?.dailyAverage) {
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Nutrition Overview</Text>
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No nutrition data available yet</Text>
          </View>
        </View>
      );
    }

    const { nutrition } = analyticsData;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Nutrition Overview</Text>
        <View style={styles.nutritionStats}>
          <View style={styles.nutritionItem}>
            <Icon name="water-drop" size={24} color="#45B7D1" />
            <Text style={styles.nutritionLabel}>Water</Text>
            <Text style={styles.nutritionValue}>
              {Math.round(nutrition.waterIntake || 0)}ml
            </Text>
            <Text style={styles.nutritionAverage}>
              Avg: {Math.round(nutrition.dailyAverage.water || 0)}ml/day
            </Text>
          </View>
          <View style={styles.nutritionItem}>
            <Icon name="restaurant" size={24} color="#FF6B6B" />
            <Text style={styles.nutritionLabel}>Food</Text>
            <Text style={styles.nutritionValue}>
              {Math.round(nutrition.foodIntake || 0)}g
            </Text>
            <Text style={styles.nutritionAverage}>
              Avg: {Math.round(nutrition.dailyAverage.food || 0)}g/day
            </Text>
          </View>
          <View style={styles.nutritionItem}>
            <Icon name="cake" size={24} color="#F7931E" />
            <Text style={styles.nutritionLabel}>Treats</Text>
            <Text style={styles.nutritionValue}>
              {Math.round(nutrition.treatsGiven || 0)}g
            </Text>
            <Text style={styles.nutritionAverage}>
              Avg: {Math.round(nutrition.dailyAverage.treats || 0)}g/day
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderActivityChart = () => {
    if (!analyticsData?.activity) {
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Activity & Engagement</Text>
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No activity data available yet</Text>
          </View>
        </View>
      );
    }

    const { activity } = analyticsData;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Activity & Engagement</Text>
        <View style={styles.activityStats}>
          <View style={styles.activityRow}>
            <View style={styles.activityItem}>
              <Icon name="sports-esports" size={20} color="#4ECDC4" />
              <Text style={styles.activityNumber}>
                {activity.gamesPlayed || 0}
              </Text>
              <Text style={styles.activityLabel}>Games Played</Text>
            </View>
            <View style={styles.activityItem}>
              <Icon name="schedule" size={20} color="#FF6B6B" />
              <Text style={styles.activityNumber}>
                {Math.round(activity.totalPlayTime || 0)}min
              </Text>
              <Text style={styles.activityLabel}>Total Play Time</Text>
            </View>
          </View>
          <View style={styles.activityRow}>
            <View style={styles.activityItem}>
              <Icon name="stars" size={20} color="#F7931E" />
              <Text style={styles.activityNumber}>
                {activity.pointsEarned || 0}
              </Text>
              <Text style={styles.activityLabel}>Points Earned</Text>
            </View>
            <View style={styles.activityItem}>
              <Icon name="favorite" size={20} color="#9B59B6" />
              <Text style={styles.activityNumber}>
                {activity.averageScore ? Math.round(activity.averageScore) : 'N/A'}
              </Text>
              <Text style={styles.activityLabel}>Average Score</Text>
            </View>
          </View>
          {activity.favoriteGame && activity.favoriteGame !== 'None' && (
            <View style={styles.favoriteGameContainer}>
              <Icon name="gamepad" size={16} color="#257D8C" />
              <Text style={styles.favoriteGameText}>
                Favorite: {activity.favoriteGame}
              </Text>
            </View>
          )}
          {activity.avgSessionDuration > 0 && (
            <View style={styles.sessionInfoContainer}>
              <Text style={styles.sessionInfoText}>
                Average session: {Math.round(activity.avgSessionDuration)}min • 
                Total sessions: {activity.totalSessions || activity.gamesPlayed || 0}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderWeeklyTrend = () => (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Weekly Trends</Text>
      {weeklyData.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.weeklyChart}>
              {weeklyData.map((day, index) => (
                <View key={index} style={styles.dayColumn}>
                  <Text style={styles.dayLabel}>{day.day}</Text>
                  <View style={styles.barContainer}>
                    <View style={[
                      styles.bar, 
                      styles.waterBar, 
                      { height: Math.max((day.water / 10), 5) }
                    ]} />
                    <View style={[
                      styles.bar, 
                      styles.foodBar, 
                      { height: Math.max((day.food / 5), 5) }
                    ]} />
                    <View style={[
                      styles.bar, 
                      styles.activityBar, 
                      { height: Math.max(day.activity_minutes || 20, 5) }
                    ]} />
                  </View>
                  <Text style={styles.dayDate}>
                    {day.date ? day.date.split('-')[2] : ''}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#45B7D1' }]} />
              <Text style={styles.legendText}>Water</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#FF6B6B' }]} />
              <Text style={styles.legendText}>Food</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#4ECDC4' }]} />
              <Text style={styles.legendText}>Activity</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No weekly data available yet</Text>
        </View>
      )}
    </View>
  );

  const renderHealthMetrics = () => (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Health Metrics</Text>
      <View style={styles.metricsGrid}>
        {healthMetrics.map((metric, index) => (
          <View key={index} style={styles.metricCard}>
            <Icon name={metric.icon} size={24} color={metric.color} />
            <Text style={styles.metricName}>{metric.name}</Text>
            <Text style={[styles.metricValue, { color: metric.color }]}>
              {metric.value}{metric.unit}
            </Text>
            <View style={styles.trendIndicator}>
              <Icon 
                name={
                  metric.trend === 'up' ? 'trending-up' : 
                  metric.trend === 'down' ? 'trending-down' : 
                  'trending-flat'
                } 
                size={16} 
                color={
                  metric.trend === 'up' ? '#4CAF50' : 
                  metric.trend === 'down' ? '#F44336' : 
                  '#FFC107'
                } 
              />
              <Text style={styles.trendText}>{metric.trend}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderInsights = () => (
    <View style={styles.insightsCard}>
      <Text style={styles.insightsTitle}>AI Insights</Text>
      <View style={styles.insightsList}>
        {insights.length > 0 ? (
          insights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <Icon name={insight.icon || "lightbulb"} size={20} color="#F7931E" />
              <Text style={styles.insightText}>{insight.message}</Text>
            </View>
          ))
        ) : (
          <>
            <View style={styles.insightItem}>
              <Icon name="lightbulb" size={20} color="#F7931E" />
              <Text style={styles.insightText}>
                {activePet?.name || 'Your pet'} needs more data to generate insights. Keep using the app!
              </Text>
            </View>
            <View style={styles.insightItem}>
              <Icon name="favorite" size={20} color="#E74C3C" />
              <Text style={styles.insightText}>
                Try playing more games to increase activity tracking data.
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257D8C" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#257D8C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pet Analytics</Text>
        <TouchableOpacity onPress={generateReport}>
          <Icon name="assessment" size={24} color="#257D8C" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadAnalyticsData} />
        }
      >
        {/* Pet Info */}
        {activePet && (
          <View style={styles.petCard}>
            <Text style={styles.petCardTitle}>Analytics for {activePet.name}</Text>
            <Text style={styles.petCardSubtitle}>
              {activePet.breed} • {activePet.age} years • {activePet.weight}kg
            </Text>
          </View>
        )}

        {/* Period Selector */}
        {renderPeriodSelector()}

        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Charts */}
        {renderNutritionChart()}
        {renderActivityChart()}
        {renderWeeklyTrend()}
        {renderHealthMetrics()}
        {renderInsights()}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={generateReport}>
            <Icon name="picture-as-pdf" size={20} color="white" />
            <Text style={styles.actionButtonText}>Generate Report</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]} 
            onPress={exportData}
          >
            <Icon name="file-download" size={20} color="#257D8C" />
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              Export Data
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#257D8C',
  },
  header: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  petCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  petCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  petCardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 4,
    marginBottom: 20,
    elevation: 2,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#257D8C',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 20,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noDataText: {
    color: '#666',
    fontSize: 14,
  },
  nutritionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  nutritionAverage: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  activityStats: {
    gap: 15,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityItem: {
    alignItems: 'center',
    flex: 1,
  },
  activityNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  activityLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  weeklyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    height: 120,
  },
  dayColumn: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 40,
  },
  dayLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    width: 30,
  },
  bar: {
    width: 8,
    borderRadius: 4,
    marginHorizontal: 1,
  },
  waterBar: {
    backgroundColor: '#45B7D1',
  },
  foodBar: {
    backgroundColor: '#FF6B6B',
  },
  activityBar: {
    backgroundColor: '#4ECDC4',
  },
  dayDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 5,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  metricName: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  insightsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 15,
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FF',
    padding: 12,
    borderRadius: 10,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#257D8C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    flex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#257D8C',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#257D8C',
  },
  favoriteGameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  favoriteGameText: {
    fontSize: 14,
    color: '#257D8C',
    marginLeft: 8,
    fontWeight: '500',
  },
  sessionInfoContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  sessionInfoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});