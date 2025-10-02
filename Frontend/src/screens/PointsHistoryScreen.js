// screens/PointsHistoryScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api';

export default function PointsHistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPointsHistory(),
      fetchUserPoints()
    ]);
    setLoading(false);
  };

  const fetchPointsHistory = async () => {
    try {
      const result = await ApiService.getPointsHistory();
      if (result.success) {
        setHistory(result.history.data || []);
      }
    } catch (error) {
      console.error('Error fetching points history:', error);
    }
  };

  const fetchUserPoints = async () => {
    try {
      const result = await ApiService.getUserPoints();
      if (result.success) {
        setUserPoints(result.points);
      }
    } catch (error) {
      console.error('Error fetching points:', error);
    }
  };

  const getReasonIcon = (reason) => {
    switch (reason) {
      case 'purchase_reward': return 'shopping-cart';
      case 'purchase_discount': return 'discount';
      case 'admin_bonus': return 'card-giftcard';
      case 'referral_bonus': return 'group-add';
      default: return 'stars';
    }
  };

  const getReasonColor = (reason) => {
    switch (reason) {
      case 'purchase_reward': return '#3A50';
      case 'purchase_discount': return '#C066E3';
      case 'admin_bonus': return '#257D8C';
      case 'referral_bonus': return '#ff6b6b';
      default: return '#666';
    }
  };

  const formatReason = (reason) => {
    switch (reason) {
      case 'purchase_reward': return 'Purchase Reward';
      case 'purchase_discount': return 'Used for Discount';
      case 'admin_bonus': return 'Admin Bonus';
      case 'referral_bonus': return 'Referral Bonus';
      default: return reason.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <View style={styles.reasonContainer}>
          <View style={[styles.iconContainer, { backgroundColor: getReasonColor(item.reason) + '20' }]}>
            <Icon name={getReasonIcon(item.reason)} size={20} color={getReasonColor(item.reason)} />
          </View>
          <View style={styles.reasonInfo}>
            <Text style={styles.reasonTitle}>{formatReason(item.reason)}</Text>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          </View>
        </View>
        
        <View style={styles.pointsContainer}>
          <Text style={[
            styles.pointsChange,
            { color: item.points_change > 0 ? '#3A50' : '#C066E3' }
          ]}>
            {item.points_change > 0 ? '+' : ''}{item.points_change}
          </Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
      
      <Text style={styles.timestamp}>
        {new Date(item.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#257D8C" />
        </TouchableOpacity>
        <Text style={styles.title}>Points History</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Current Points */}
      <View style={styles.currentPointsCard}>
        <View style={styles.currentPointsContent}>
          <Icon name="stars" size={32} color="#C066E3" />
          <View style={styles.currentPointsText}>
            <Text style={styles.currentPointsTitle}>Current Balance</Text>
            <Text style={styles.currentPointsValue}>{userPoints} points</Text>
          </View>
        </View>
        
        <Text style={styles.currentPointsSubtitle}>
          Earn 1 point for every $1 spent • Use points for discounts
        </Text>
      </View>

      {/* History List */}
      {history.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Icon name="history" size={64} color="#C4E6E8" />
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start shopping to earn points and see your history here
          </Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => navigation.navigate('Marketplace')}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.historyList}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadData} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#CCFBEC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  currentPointsCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  currentPointsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  currentPointsText: {
    marginLeft: 15,
  },
  currentPointsTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  currentPointsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  currentPointsSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  historyList: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reasonContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reasonInfo: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsChange: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#999',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
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
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: '#257D8C',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});