// screens/CartScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api';

export default function CartScreen({ navigation }) {
  const [cartData, setCartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItems, setUpdatingItems] = useState(new Set());

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCart();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCart = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getCart();
      if (response.success) {
        setCartData(response.data);
      } else {
        console.error('Failed to load cart:', response.error);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      Alert.alert('Error', 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCart();
    setRefreshing(false);
  };

  const updateCartItemQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) {
      handleRemoveItem(itemId);
      return;
    }

    try {
      setUpdatingItems(prev => new Set([...prev, itemId]));
      
      const response = await ApiService.updateCartItem(itemId, { quantity: newQuantity });
      
      if (response.success) {
        // Update local state immediately for better UX
        setCartData(prev => ({
          ...prev,
          items: prev.items.map(item =>
            item.id === itemId
              ? { ...item, quantity: newQuantity, total: item.price * newQuantity }
              : item
          )
        }));
        
        // Recalculate totals
        setTimeout(() => loadCart(), 500); // Reload to get accurate totals
      } else {
        Alert.alert('Error', response.error || 'Failed to update item');
      }
    } catch (error) {
      console.error('Error updating cart item:', error);
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleRemoveItem = (itemId) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeCartItem(itemId),
        },
      ]
    );
  };

  const removeCartItem = async (itemId) => {
    try {
      setUpdatingItems(prev => new Set([...prev, itemId]));
      
      const response = await ApiService.removeFromCart(itemId);
      
      if (response.success) {
        // Remove item from local state immediately
        setCartData(prev => ({
          ...prev,
          items: prev.items.filter(item => item.id !== itemId)
        }));
        
        // Reload to get accurate totals
        setTimeout(() => loadCart(), 500);
      } else {
        Alert.alert('Error', response.error || 'Failed to remove item');
      }
    } catch (error) {
      console.error('Error removing cart item:', error);
      Alert.alert('Error', 'Failed to remove item');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearCart,
        },
      ]
    );
  };

  const clearCart = async () => {
    try {
      setLoading(true);
      const response = await ApiService.clearCart();
      
      if (response.success) {
        setCartData({ items: [], subtotal: 0, total_items: 0, total_amount: 0 });
      } else {
        Alert.alert('Error', response.error || 'Failed to clear cart');
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      Alert.alert('Error', 'Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    if (!cartData || cartData.items.length === 0) {
      Alert.alert('Empty Cart', 'Please add some items to your cart before checkout');
      return;
    }
    
    navigation.navigate('Checkout', { items: cartData.items });
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

  const renderCartItem = ({ item }) => {
    const isUpdating = updatingItems.has(item.id);
        const itemTotal = parseFloat(item.total) || 0;

    return (
      <View style={styles.cartItem}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ProductDetails', { product: item.product })}
          style={styles.productImageContainer}
        >
          {item.product.images && item.product.images.length > 0 ? (
            <Image
              source={{ uri: item.product.images[0] }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.productImage, styles.placeholderImage]}>
              <Icon name="pets" size={30} color="#C4E6E8" />
            </View>
          )}
          
          {/* Tier Badge */}
          <View style={[styles.tierBadge, { backgroundColor: getTierColor(item.product.tier) }]}>
            <Text style={styles.tierBadgeText}>{item.product.tier.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.itemDetails}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProductDetails', { product: item.product })}
          >
            <Text style={styles.itemName} numberOfLines={2}>
              {item.product.name}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.itemCategory}>{item.product.category?.name}</Text>
          
          <View style={styles.priceContainer}>
            <Text style={styles.itemPrice}>${item.price}</Text>
            {item.use_points && (
              <View style={styles.pointsUsedContainer}>
                <Icon name="stars" size={12} color="#C066E3" />
                <Text style={styles.pointsUsedText}>{item.points_used} pts used</Text>
              </View>
            )}
          </View>

          <View style={styles.quantityAndTotal}>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={[styles.quantityButton, isUpdating && styles.disabledButton]}
                onPress={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                disabled={isUpdating || item.quantity <= 1}
              >
                <Icon 
                  name="remove" 
                  size={18} 
                  color={isUpdating || item.quantity <= 1 ? '#ccc' : '#257D8C'} 
                />
              </TouchableOpacity>
              
              <Text style={styles.quantityText}>
                {isUpdating ? '...' : item.quantity}
              </Text>
              
              <TouchableOpacity
                style={[styles.quantityButton, isUpdating && styles.disabledButton]}
                onPress={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                disabled={isUpdating || item.quantity >= item.product.stock_quantity}
              >
                <Icon 
                  name="add" 
                  size={18} 
                  color={isUpdating || item.quantity >= item.product.stock_quantity ? '#ccc' : '#257D8C'} 
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.itemTotal}>${item.total.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#FF6B6B" />
          ) : (
            <Icon name="delete" size={20} color="#FF6B6B" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyCart}>
      <Icon name="shopping-cart" size={80} color="#C4E6E8" />
      <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
      <Text style={styles.emptyCartSubtitle}>
        Add some amazing pet products to get started!
      </Text>
      <TouchableOpacity
        style={styles.shopNowButton}
        onPress={() => navigation.navigate('Marketplace')}
      >
        <Icon name="shopping-bag" size={20} color="white" />
        <Text style={styles.shopNowText}>Shop Now</Text>
      </TouchableOpacity>
    </View>
  );

 // screens/CartScreen.js

  const renderSummary = () => {
    if (!cartData || cartData.items.length === 0) return null;

    // ✅ Safely convert all summary values to numbers
    const subtotal = parseFloat(cartData.subtotal) || 0;
    const taxAmount = parseFloat(cartData.tax_amount) || 0;
    const shippingAmount = parseFloat(cartData.shipping_amount) || 0;
    const totalAmount = parseFloat(cartData.total_amount) || 0;

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal ({cartData.total_items} items)</Text>
          {/* ✅ Use the safe variables */}
          <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          {/* ✅ Use the safe variables */}
          <Text style={styles.summaryValue}>${taxAmount.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping</Text>
          <Text style={[
            styles.summaryValue,
            shippingAmount === 0 && styles.freeShipping
          ]}>
            {/* ✅ Use the safe variables */}
            {shippingAmount === 0 ? 'FREE' : `$${shippingAmount.toFixed(2)}`}
          </Text>
        </View>
        
        {shippingAmount === 0 && subtotal < 50 && (
          <Text style={styles.freeShippingNote}>
            Free shipping on orders over $50!
          </Text>
        )}
        
        {cartData.total_points_used > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Points Used</Text>
            <Text style={styles.pointsUsedValue}>{cartData.total_points_used} pts</Text>
          </View>
        )}
        
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          {/* ✅ Use the safe variables */}
          <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  if (loading && !cartData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257D8C" />
          <Text style={styles.loadingText}>Loading cart...</Text>
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
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        {cartData && cartData.items.length > 0 && (
          <TouchableOpacity
            onPress={handleClearCart}
            style={styles.clearButton}
          >
            <Icon name="delete-sweep" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {cartData && cartData.items.length > 0 ? (
        <View style={styles.content}>
          {/* Cart Items */}
          <FlatList
            data={cartData.items}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.cartList}
          />

          {/* Order Summary */}
          {renderSummary()}

          {/* Checkout Button */}
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={handleCheckout}
          >
            <Icon name="payment" size={20} color="white" />
            <Text style={styles.checkoutText}>
              Proceed to Checkout (${cartData.total_amount.toFixed(2)})
            </Text>
          </TouchableOpacity>

          {/* Continue Shopping */}
          <TouchableOpacity
            style={styles.continueShoppingButton}
            onPress={() => navigation.navigate('Marketplace')}
          >
            <Text style={styles.continueShoppingText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        renderEmptyCart()
      )}
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
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  header: {
    backgroundColor: '#257D8C',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  cartList: {
    paddingVertical: 10,
  },
  cartItem: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierBadgeText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  itemCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#257D8C',
    marginRight: 10,
  },
  pointsUsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pointsUsedText: {
    fontSize: 10,
    color: '#C066E3',
    marginLeft: 2,
  },
  quantityAndTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    borderRadius: 8,
    padding: 2,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 12,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  removeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  summaryContainer: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  freeShipping: {
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
  freeShippingNote: {
    fontSize: 12,
    color: '#4ECDC4',
    textAlign: 'center',
    marginVertical: 5,
  },
  pointsUsedValue: {
    fontSize: 14,
    color: '#C066E3',
    fontWeight: 'bold',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
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
  checkoutButton: {
    backgroundColor: '#257D8C',
    marginHorizontal: 15,
    marginBottom: 10,
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  checkoutText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  continueShoppingButton: {
    marginHorizontal: 15,
    marginBottom: 15,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueShoppingText: {
    color: '#257D8C',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyCartTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyCartSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  shopNowButton: {
    backgroundColor: '#257D8C',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  shopNowText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});