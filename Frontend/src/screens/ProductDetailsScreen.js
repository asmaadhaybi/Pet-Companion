// screens/ProductDetailsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

export default function ProductDetailsScreen({ route, navigation }) {
  const { product: initialProduct } = route.params;
  const [product, setProduct] = useState(initialProduct);
  const [userPoints, setUserPoints] = useState(150);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('description');

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

// ✅ --- START: CORRECTED PRICE LOGIC --- ✅

  const canUseDiscount = () => {
    return product.points_required > 0 && userPoints >= product.points_required;
  };

  const getDiscountedPrice = () => {
    // 1. Convert all values to numbers first for safe calculations
    const price = parseFloat(product.price) || 0;
    const discount = parseFloat(product.discount_percentage) || 0;

    if (canUseDiscount()) {
      return price * (1 - discount / 100);
    }
    // 2. Always return a number
    return price;
  };

  // Calculate all numeric values ONCE before rendering
  const finalPrice = getDiscountedPrice();
  const originalPrice = parseFloat(product.original_price) || 0;
  const rating = parseFloat(product.rating) || 0;
  const hasDiscount = canUseDiscount();

  // ✅ --- END: CORRECTED PRICE LOGIC --- ✅
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

  const handleAddToCart = () => {
    if (product.stock_quantity < quantity) {
      Alert.alert('Error', 'Not enough stock available');
      return;
    }

    navigation.navigate('Checkout', {
      items: [{
        product_id: product.id,
        product: product,
        quantity: quantity
      }],
      canUsePoints: canUseDiscount()
    });
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= product.stock_quantity) {
      setQuantity(newQuantity);
    }
  };

  const renderImageCarousel = () => {
    if (!product.images || product.images.length === 0) {
      return (
        <View style={[styles.imagePlaceholder, { width: width, height: 300 }]}>
          <Icon name="pets" size={80} color="#C4E6E8" />
        </View>
      );
    }

    return (
      <View style={styles.imageSection}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.imageCarousel}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setSelectedImageIndex(index);
          }}
        >
          {product.images.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              style={{ width: width, height: 300 }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
        
        {/* Image indicators */}
        <View style={styles.imageIndicators}>
          {product.images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                { backgroundColor: selectedImageIndex === index ? getTierColor(product.tier) : '#E5E7EB' }
              ]}
            />
          ))}
        </View>

        {/* Floating tier badge */}
        <View style={[styles.floatingTierBadge, { backgroundColor: getTierColor(product.tier) }]}>
          <Icon name={getTierIcon(product.tier)} size={16} color="white" />
          <Text style={styles.floatingTierText}>{product.tier.toUpperCase()}</Text>
        </View>
      </View>
    );
  };

  const renderPriceSection = () => (
    <View style={styles.priceSection}>
      <View style={styles.priceRow}>
        {canUseDiscount() && product.originalPrice && (
          <Text style={styles.originalPrice}>${product.originalPrice.toFixed(2)}</Text>
        )}
        <Text style={[styles.currentPrice, { color: getTierColor(product.tier) }]}>
          ${getDiscountedPrice().toFixed(2)}
        </Text>
        {product.tier === 'luxury' && (
          <Text style={styles.freeShipping}>+ Free Shipping</Text>
        )}
      </View>

      {product.points_required > 0 && (
        <View style={styles.pointsInfo}>
          <Icon name="stars" size={16} color="#C066E3" />
          <Text style={[
            styles.pointsInfoText,
            { color: canUseDiscount() ? '#4CAF50' : '#C066E3' }
          ]}>
            {canUseDiscount() ? 
              `Save ${product.discount_percentage}% with your points!` : 
              `Need ${product.points_required} points for discount`}
          </Text>
        </View>
      )}
    </View>
  );

  const renderQuantitySelector = () => (
    <View style={styles.quantitySection}>
      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={[styles.quantityButton, { borderColor: getTierColor(product.tier) }]}
          onPress={() => handleQuantityChange(-1)}
          disabled={quantity <= 1}
        >
          <Icon name="remove" size={20} color={quantity <= 1 ? '#ccc' : getTierColor(product.tier)} />
        </TouchableOpacity>
        <Text style={[styles.quantityText, { color: getTierColor(product.tier) }]}>{quantity}</Text>
        <TouchableOpacity
          style={[styles.quantityButton, { borderColor: getTierColor(product.tier) }]}
          onPress={() => handleQuantityChange(1)}
          disabled={quantity >= product.stock_quantity}
        >
          <Icon name="add" size={20} color={quantity >= product.stock_quantity ? '#ccc' : getTierColor(product.tier)} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.addToCartButton, { backgroundColor: getTierColor(product.tier) }]}
        onPress={handleAddToCart}
        disabled={product.stock_quantity === 0 || loading}
      >
        <Text style={styles.addToCartText}>
          {product.stock_quantity === 0 ? 'OUT OF STOCK' : 'ADD TO CART'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => {
    const tabs = [
      { key: 'description', label: 'Description', icon: 'description' },
      { key: 'features', label: 'Features', icon: 'star' },
      { key: 'reviews', label: `Reviews (${product.reviews_count})`, icon: 'rate_review' }
    ];

    return (
      <View style={styles.tabsContainer}>
        <View style={styles.tabsHeader}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && [styles.activeTab, { borderBottomColor: getTierColor(product.tier) }]
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon 
                name={tab.icon} 
                size={16} 
                color={activeTab === tab.key ? getTierColor(product.tier) : '#666'} 
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.key && [styles.activeTabText, { color: getTierColor(product.tier) }]
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'description' && (
            <View style={styles.descriptionContent}>
              <Text style={styles.description}>{product.description}</Text>
              
              <View style={styles.productSpecs}>
                <Text style={styles.specsTitle}>Product Specifications</Text>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>SKU:</Text>
                  <Text style={styles.specValue}>Paw-{product.id.toString().padStart(5, '0')}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Category:</Text>
                  <Text style={styles.specValue}>{product.tier.charAt(0).toUpperCase() + product.tier.slice(1)}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Tags:</Text>
                  <Text style={styles.specValue}>automated, camera, feeder, hydrating, hydrator, microphone, mobile app, models, pets</Text>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'features' && (
            <View style={styles.featuresContent}>
              {product.features && product.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Icon name="check-circle" size={20} color={getTierColor(product.tier)} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              
              {product.tier === 'luxury' && (
                <View style={styles.luxuryNote}>
                  <Icon name="diamond" size={20} color="#C066E3" />
                  <Text style={styles.luxuryNoteText}>
                    Features & sounds, PawPal intelligent version without the one:
                    Customizable for a new level
                  </Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'reviews' && (
            <View style={styles.reviewsContent}>
              <View style={styles.ratingOverview}>
                <Text style={styles.ratingNumber}>{product.rating?.toFixed(1) || 'N/A'}</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                      key={star}
                      name="star"
                      size={16}
                      color={star <= Math.floor(product.rating || 0) ? '#F7931E' : '#E5E7EB'}
                    />
                  ))}
                </View>
                <Text style={styles.reviewsText}>Based on {product.reviews_count} customer reviews</Text>
              </View>

              <Text style={styles.noReviewsText}>
                Customer reviews will be displayed here once available.
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{product.tier.charAt(0).toUpperCase() + product.tier.slice(1)}</Text>
        <View style={styles.pointsContainer}>
          <Icon name="stars" size={16} color="#C066E3" />
          <Text style={styles.pointsText}>{userPoints} pts</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} bounces={false}>
        {/* Image Carousel */}
        {renderImageCarousel()}

        <View style={styles.contentContainer}>
           {/* Product Header */}
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color="#F7931E" />
              <Text style={styles.ratingText}>
                {/* ✅ FIX: Use the safe `rating` variable */}
                {rating.toFixed(1)} ({product.reviews_count} customer reviews)
              </Text>
            </View>
          </View>

          {/* Price Section */}
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              {/* ✅ FIX: Use the safe `originalPrice` variable */}
              {hasDiscount && originalPrice > 0 && (
                <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>
              )}
              {/* ✅ FIX: Use the safe `finalPrice` variable */}
              <Text style={[styles.currentPrice, { color: getTierColor(product.tier) }]}>
                ${finalPrice.toFixed(2)}
              </Text>
              {product.tier === 'luxury' && (
                <Text style={styles.freeShipping}>+ Free Shipping</Text>
              )}
            </View>
            </View>

          {/* Stock Status */}
          <View style={styles.stockContainer}>
            <Icon 
              name={product.stock_quantity > 0 ? 'check-circle' : 'cancel'} 
              size={16} 
              color={product.stock_quantity > 0 ? '#4CAF50' : '#F44336'} 
            />
            <Text style={[
              styles.stockText,
              { color: product.stock_quantity > 0 ? '#4CAF50' : '#F44336' }
            ]}>
              {product.stock_quantity > 5 ? 'In Stock' : 
               product.stock_quantity > 0 ? `Only ${product.stock_quantity} left in stock` : 'Out of Stock'}
            </Text>
          </View>

          {/* Quantity Selector */}
          {renderQuantitySelector()}

          {/* Tabs Section */}
          {renderTabs()}
        </View>
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
  headerTitle: {
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
    marginLeft: 5,
    fontWeight: '600',
    color: 'white',
    fontSize: 12,
  },
  scrollContainer: {
    flex: 1,
  },
  imageSection: {
    position: 'relative',
  },
  imageCarousel: {
    height: 300,
  },
  imagePlaceholder: {
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  floatingTierBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  floatingTierText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  contentContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  productHeader: {
    marginBottom: 15,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  priceSection: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 10,
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  freeShipping: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 10,
  },
  detailsContainer: {
    padding: 20,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  productDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  priceSection: {
    padding: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  pointsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  pointsInfoText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  quantitySection: {
    marginBottom: 30,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  quantityText: {
    marginHorizontal: 20,
    fontSize: 18,
    fontWeight: '600',
  },
  addToCartButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  addToCartText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabsContainer: {
    marginBottom: 30,
  },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  tabContent: {
    paddingTop: 20,
  },
  descriptionContent: {
    paddingBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  productSpecs: {
    backgroundColor: '#F8F9FF',
    padding: 15,
    borderRadius: 12,
  },
  specsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  specLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  specValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  featuresContent: {
    paddingBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  luxuryNote: {
    flexDirection: 'row',
    backgroundColor: '#F8F0FF',
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
  },
  luxuryNoteText: {
    fontSize: 14,
    color: '#C066E3',
    marginLeft: 10,
    flex: 1,
    fontStyle: 'italic',
  },
  reviewsContent: {
    paddingBottom: 20,
  },
  ratingOverview: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    marginBottom: 20,
  },
  ratingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewsText: {
    fontSize: 14,
    color: '#666',
  },
  noReviewsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});