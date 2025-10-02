// screens/ProductsManagementScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api';

export default function ProductsManagementScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getAllProducts();
      if (response.success && response.data?.data) {
        setProducts(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const toggleProductStatus = async (productId, currentStatus) => {
    try {
      const response = await ApiService.updateProduct(productId, {
        is_active: !currentStatus
      });
      
      if (response.success) {
        Alert.alert('Success', 'Product status updated');
        fetchProducts();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update product status');
    }
  };

  const deleteProduct = async (productId) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.deleteProduct(productId);
              if (response.success) {
                Alert.alert('Success', 'Product deleted');
                fetchProducts();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'automated': return '#4ECDC4';
      case 'intelligent': return '#45B7D1';
      case 'luxury': return '#C066E3';
      default: return '#257D8C';
    }
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'automated': return 'schedule';
      case 'intelligent': return 'psychology';
      case 'luxury': return 'diamond';
      default: return 'pets';
    }
  };

  const renderProduct = ({ item }) => {
    const price = parseFloat(item.price) || 0;
    
    return (
      <View style={styles.productCard}>
        <View style={[styles.tierBadge, { backgroundColor: getTierColor(item.tier) }]}>
          <Icon name={getTierIcon(item.tier)} size={12} color="white" />
          <Text style={styles.tierText}>{item.tier.toUpperCase()}</Text>
        </View>

        <View style={styles.productHeader}>
          {item.images && item.images.length > 0 ? (
            <Image source={{ uri: item.images[0] }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.placeholderImage]}>
              <Icon name="pets" size={30} color="#C4E6E8" />
            </View>
          )}

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.productPrice}>${price.toFixed(2)}</Text>
            <Text style={styles.stockText}>
              Stock: {item.stock_quantity} units
            </Text>
          </View>
        </View>

        <View style={styles.productActions}>
          <View style={styles.statusToggle}>
            <Text style={styles.statusLabel}>Active:</Text>
            <Switch
              value={item.is_active}
              onValueChange={() => toggleProductStatus(item.id, item.is_active)}
              trackColor={{ false: '#C4E6E8', true: getTierColor(item.tier) }}
              thumbColor={item.is_active ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: getTierColor(item.tier) }]}
              onPress={() => navigation.navigate('EditProduct', { productId: item.id })}
            >
              <Icon name="edit" size={16} color="white" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => deleteProduct(item.id)}
            >
              <Icon name="delete" size={16} color="white" />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>My Products</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddProduct')}>
          <Icon name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {products.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Icon name="inventory" size={64} color="#C4E6E8" />
          <Text style={styles.emptyTitle}>No Products Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start by adding your first PawPal product
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddProduct')}
          >
            <Icon name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>Add Product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.productsList}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchProducts} />
          }
        />
      )}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  productsList: {
    padding: 15,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tierBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  tierText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  productHeader: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  placeholderImage: {
    backgroundColor: '#F0F9F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 4,
  },
  stockText: {
    fontSize: 12,
    color: '#666',
  },
  productActions: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 15,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: '#257D8C',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});