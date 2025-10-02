// screens/CheckoutScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function CheckoutScreen({ route, navigation }) {
  const { items, canUsePoints = false } = route.params;
  const [userPoints, setUserPoints] = useState(150);
  const [usePoints, setUsePoints] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    country: '',
    postal_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState(items.map(item => ({ ...item, usePoints: false })));

  useEffect(() => {
    fetchUserPoints();
  }, []);

  const fetchUserPoints = async () => {
    try {
      const points = await AsyncStorage.getItem('userPoints');
      setUserPoints(points ? parseInt(points) : 150);
    } catch (error) {
      console.error('Error fetching points:', error);
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'automated':
        return '#4ECDC4';
      case 'intelligent':
        return '#45B7D1';
      case 'luxury':
        return '#C066E3';
      default:
        return '#257D8C';
    }
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'automated':
        return 'schedule';
      case 'intelligent':
        return 'psychology';
      case 'luxury':
        return 'diamond';
      default:
        return 'pets';
    }
  };

  const toggleItemPoints = (itemIndex) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[itemIndex];
    
    if (!item.usePoints && userPoints < item.product.points_required) {
      Alert.alert(
        'Insufficient Points',
        `You need ${item.product.points_required} points to apply discount to ${item.product.name}`
      );
      return;
    }

    updatedItems[itemIndex] = {
      ...item,
      usePoints: !item.usePoints
    };
    setSelectedItems(updatedItems);
  };

  const calculateItemTotal = (item) => {
    // ✅ Safely parse all values to numbers
    const price = parseFloat(item.product.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    const discountPercentage = parseFloat(item.product.discount_percentage) || 0;

    const basePrice = price * quantity;
    if (item.usePoints && userPoints >= item.product.points_required) {
      const discount = basePrice * (discountPercentage / 100);
      return basePrice - discount;
    }
    return basePrice;
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalPointsUsed = 0;
    let pointsRequired = 0;

    selectedItems.forEach((item) => {
      const itemSubtotal = item.product.price * item.quantity;
      subtotal += itemSubtotal;

      if (item.usePoints && userPoints >= item.product.points_required) {
        const itemDiscount = itemSubtotal * (item.product.discount_percentage / 100);
        totalDiscount += itemDiscount;
        pointsRequired = Math.max(pointsRequired, item.product.points_required);
      }
    });

    const shipping = subtotal >= 100 ? 0 : 9.99; // Free shipping over $100
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + shipping + tax - totalDiscount;
    totalPointsUsed = pointsRequired;

    return {
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      pointsUsed: totalPointsUsed,
      freeShipping: subtotal >= 100
    };
  };

const getPointsEarned = () => {
  const totals = calculateTotals();
  const totalAmount = parseFloat(totals.total);
  
  // Match Laravel logic: Only award points if order >= $100
  if (totalAmount >= 100) {
    // Award 25% of total amount as points, rounded down
    return Math.floor(totalAmount * 0.25);
  }
  
  // No points earned if order is less than $100
  return 0;
};

// Replace your handlePlaceOrder function in CheckoutScreen.js with this:

const handlePlaceOrder = async () => {
  setLoading(true);

  try {
    const orderItems = selectedItems.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      use_points: item.usePoints || false,
    }));

    const orderData = {
      items: orderItems,
      shipping_address: shippingAddress,
    };

    console.log('Sending order data:', JSON.stringify(orderData, null, 2));

    const response = await ApiService.createOrder(orderData);
    
    console.log('Full API response:', JSON.stringify(response, null, 2));

    if (response.success) {
      Alert.alert('Success!', 'Your order has been placed.');

      // Extract the actual order data - handle different possible structures
      let orderToPass;
      
      if (response.data) {
        orderToPass = response.data;
      } else if (response.order) {
        orderToPass = response.order;
      } else {
        // If no nested data, use the response itself
        orderToPass = response;
      }

      console.log("Order data being passed to success screen:", JSON.stringify(orderToPass, null, 2));

      // Make sure we have at least basic order info
if (!orderToPass.total_amount && !orderToPass.total) {
  // Calculate total from our local calculations as fallback
  const totals = calculateTotals();
  const totalAmount = parseFloat(totals.total);
  
  orderToPass.total_amount = totalAmount;
  
  // Match Laravel logic for points: only award if >= $100, then 25% rounded down
  if (totalAmount >= 100) {
    orderToPass.points_earned = Math.floor(totalAmount * 0.25);
  } else {
    orderToPass.points_earned = 0;
  }
}

      navigation.navigate('OrderSuccess', { order: orderToPass });
      
    } else {
      // Error handling (keep your existing error handling code)
      if (response.errors) {
        const itemError = Object.values(response.errors).find(msg =>
          msg[0].includes('product_id is invalid')
        );

        if (itemError) {
          Alert.alert(
            'Item Unavailable',
            'One or more items in your order are no longer available. Please return to your cart to update it.'
          );
        } else {
          const firstError = Object.values(response.errors)[0][0];
          Alert.alert('Order Failed', firstError);
        }
      } else {
        const message = response.error || 'Failed to place order.';
        Alert.alert('Order Failed', message);
      }
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    Alert.alert('Error', 'An unexpected error occurred. Please try again.');
  } finally {
    setLoading(false);
  }
};
  // screens/CheckoutScreen.js

  const renderOrderItem = ({ item, index }) => {
    // ✅ --- START: FIX ---
    // Convert all string values to numbers first
    const price = parseFloat(item.product.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    const discountPercentage = parseFloat(item.product.discount_percentage) || 0;
    
    // Safely calculate totals
    const subtotal = price * quantity;
    const discountAmount = subtotal * (discountPercentage / 100);
    const itemTotal = calculateItemTotal(item); // This function also needs a fix, see below
    // ✅ --- END: FIX ---

    return (
      <View style={styles.orderItem}>
        <View style={[styles.tierBadge, { backgroundColor: getTierColor(item.product.tier) }]}>
          <Icon name={getTierIcon(item.product.tier)} size={12} color="white" />
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.product.name}</Text>
          <Text style={styles.itemTier}>{item.product.tier.charAt(0).toUpperCase() + item.product.tier.slice(1)} Tier</Text>
          <Text style={styles.itemDetails}>
            {/* ✅ Use the safe variables */}
            Qty: {quantity} × ${price.toFixed(2)}
          </Text>
        </View>

        <View style={styles.itemPricing}>
          <View style={styles.priceRow}>
            <Text style={styles.itemSubtotal}>
              {/* ✅ Use the safe variables */}
              ${subtotal.toFixed(2)}
            </Text>
            {item.usePoints && (
              <Text style={styles.itemDiscount}>
                {/* ✅ Use the safe variables */}
                -${discountAmount.toFixed(2)}
              </Text>
            )}
          </View>
          <Text style={[styles.itemTotal, { color: getTierColor(item.product.tier) }]}>
            {/* ✅ Use the safe variables */}
            ${itemTotal.toFixed(2)}
          </Text>
        </View>

        {item.product.points_required > 0 && (
          <TouchableOpacity
            style={styles.pointsToggle}
            onPress={() => toggleItemPoints(index)}
          >
            <View style={[
              styles.pointsToggleButton,
              { backgroundColor: item.usePoints ? getTierColor(item.product.tier) : 'white' }
            ]}>
              <Icon 
                name="stars" 
                size={16} 
                color={item.usePoints ? 'white' : getTierColor(item.product.tier)} 
              />
              <Text style={[
                styles.pointsToggleText,
                { color: item.usePoints ? 'white' : getTierColor(item.product.tier) }
              ]}>
                {item.product.points_required} pts
              </Text>
            </View>
            <Text style={styles.pointsToggleLabel}>
              {item.usePoints ? 'Using points' : 'Use points'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };


  const totals = calculateTotals();


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>PawPal Checkout</Text>
        <View style={styles.pointsContainer}>
          <Icon name="stars" size={16} color="#C066E3" />
          <Text style={styles.pointsText}>{userPoints}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <FlatList
            data={selectedItems}
            renderItem={renderOrderItem}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* Points Usage Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rewards Summary</Text>
          <View style={styles.rewardsCard}>
            <View style={styles.rewardsRow}>
              <Icon name="stars" size={20} color="#C066E3" />
              <Text style={styles.rewardsLabel}>Available Points:</Text>
              <Text style={styles.rewardsValue}>{userPoints}</Text>
            </View>
            
            {totals.pointsUsed > 0 && (
              <View style={styles.rewardsRow}>
                <Icon name="remove_circle" size={20} color="#FF6B6B" />
                <Text style={styles.rewardsLabel}>Points to Use:</Text>
                <Text style={styles.rewardsValue}>-{totals.pointsUsed}</Text>
              </View>
            )}
            
            <View style={styles.rewardsRow}>
              <Icon name="add_circle" size={20} color="#4CAF50" />
              <Text style={styles.rewardsLabel}>Points to Earn:</Text>
              <Text style={styles.rewardsValue}>+{getPointsEarned()}</Text>
            </View>
            
            <View style={[styles.rewardsRow, styles.rewardsTotalRow]}>
              <Icon name="account_balance_wallet" size={20} color="#257D8C" />
              <Text style={styles.rewardsTotalLabel}>New Balance:</Text>
              <Text style={styles.rewardsTotalValue}>
                {userPoints - totals.pointsUsed + getPointsEarned()} pts
              </Text>
            </View>
          </View>
        </View>

        {/* Shipping Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Street Address"
            value={shippingAddress.street}
            onChangeText={(text) =>
              setShippingAddress((prev) => ({ ...prev, street: text }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="City"
            value={shippingAddress.city}
            onChangeText={(text) =>
              setShippingAddress((prev) => ({ ...prev, city: text }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Country"
            value={shippingAddress.country}
            onChangeText={(text) =>
              setShippingAddress((prev) => ({ ...prev, country: text }))
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Postal Code"
            value={shippingAddress.postal_code}
            onChangeText={(text) =>
              setShippingAddress((prev) => ({ ...prev, postal_code: text }))
            }
          />
        </View>

        {/* Order Total */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>${totals.subtotal}</Text>
            </View>
            
            {parseFloat(totals.discount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.discountText]}>
                  Points Discount:
                </Text>
                <Text style={[styles.summaryValue, styles.discountText]}>
                  -${totals.discount}
                </Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Shipping:
                {totals.freeShipping && <Text style={styles.freeTag}> (FREE)</Text>}
              </Text>
              <Text style={[
                styles.summaryValue,
                totals.freeShipping && styles.freeShippingText
              ]}>
                {totals.freeShipping ? 'FREE' : `${totals.shipping}`}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax (8%):</Text>
              <Text style={styles.summaryValue}>${totals.tax}</Text>
            </View>
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>${totals.total}</Text>
            </View>
          </View>
        </View>

        {/* Place Order Button */}
        <TouchableOpacity
              style={[styles.placeOrderButton, loading && styles.disabledButton]}
              onPress={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Icon name="shopping_cart_checkout" size={20} color="white" />
                  <Text style={styles.placeOrderText}>
                    Place Order - ${totals.total}
                  </Text>
                </>
              )}
            </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  header: {
    backgroundColor: '#257D8C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  pointsText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  scrollContainer: {
    paddingBottom: 30,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 15,
  },
  orderItem: {
    position: 'relative',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 10,
  },
  tierBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1,
  },
  itemInfo: {
    flex: 1,
    marginBottom: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemTier: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  itemPricing: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSubtotal: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  itemDiscount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  pointsToggle: {
    alignItems: 'center',
  },
  pointsToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#257D8C',
  },
  pointsToggleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  pointsToggleLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  rewardsCard: {
    backgroundColor: '#F8F9FF',
    padding: 15,
    borderRadius: 12,
  },
  rewardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rewardsLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  rewardsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  rewardsTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    marginTop: 5,
  },
  rewardsTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginLeft: 10,
    flex: 1,
  },
  rewardsTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  input: {
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#C4E6E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  summaryCard: {
    backgroundColor: '#F8F9FF',
    padding: 15,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  discountText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  freeTag: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  freeShippingText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 10,
    paddingTop: 15,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  placeOrderButton: {
    backgroundColor: '#257D8C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 15,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  placeOrderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});