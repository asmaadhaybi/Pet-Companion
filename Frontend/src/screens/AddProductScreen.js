// screens/AddProductScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import ApiService from '../services/api';

export default function AddProductScreen({ navigation }) {
  const [product, setProduct] = useState({
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    stock_quantity: '',
    tier: 'automated', // automated, intelligent, luxury
    category: 'feeding',
    images: [],
    points_required: '',
    discount_percentage: '',
    features: [],
    is_active: true,
    is_featured: false,
  });
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [featureText, setFeatureText] = useState('');

  const tiers = [
    { key: 'automated', label: 'Automated PawPal', color: '#4ECDC4', icon: 'schedule' },
    { key: 'intelligent', label: 'Intelligent PawPal', color: '#45B7D1', icon: 'psychology' },
    { key: 'luxury', label: 'Luxury PawPal', color: '#C066E3', icon: 'diamond' }
  ];

  const categories = [
    { key: 'feeding', label: 'Feeding & Hydration' },
    { key: 'smart', label: 'Smart Features' },
    { key: 'luxury', label: 'Luxury Components' },
    { key: 'accessories', label: 'Accessories' },
    { key: 'health', label: 'Health Monitoring' }
  ];

   // ✅ FIX 1: MOVED THIS FUNCTION OUTSIDE of handleSubmit
  const handleSelectImages = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: 5,
        quality: 0.8,
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          console.log('ImagePicker Error: ', response.errorMessage);
          Alert.alert('Error', 'Could not select images.');
        } else {
          setProduct((prev) => ({
            ...prev,
            images: [...prev.images, ...response.assets],
          }));
        }
      },
    );
  };

  // ✅ FIX 2: MOVED THIS FUNCTION OUTSIDE of handleSubmit as well
  const handleRemoveImage = (index) => {
    setProduct((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };


  const handleAddFeature = () => {
    if (featureText.trim()) {
      setProduct((prev) => ({
        ...prev,
        features: [...prev.features, featureText.trim()],
      }));
      setFeatureText('');
    }
  };

  const handleRemoveFeature = (index) => {
    setProduct((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const getTierColor = (tier) => {
    const tierObj = tiers.find(t => t.key === tier);
    return tierObj ? tierObj.color : '#257D8C';
  };

// screens/AddProductScreen.js

const handleSubmit = async () => {
    // --- Validation Checks ---
    if (!product.name || !product.description || !product.price || !product.stock_quantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (product.images.length === 0) {
      Alert.alert('Error', 'Please add at least one product image');
      return;
    }
    if (product.features.length === 0) {
      Alert.alert('Error', 'Please add at least one product feature');
      return;
    }

    setLoading(true);

    const formData = new FormData();

    // Append all text/number fields
    formData.append('name', product.name);
    formData.append('description', product.description);
    formData.append('price', product.price);
    formData.append('stock_quantity', product.stock_quantity);
    formData.append('tier', product.tier);
    formData.append('category', product.category);
    
    // ✅ FIX 1: Convert booleans to 1 or 0
    formData.append('is_active', product.is_active ? '1' : '0');
    formData.append('is_featured', product.is_featured ? '1' : '0');

    if (product.originalPrice) formData.append('original_price', product.originalPrice);
    if (product.points_required) formData.append('points_required', product.points_required);
    if (product.discount_percentage) formData.append('discount_percentage', product.discount_percentage);

    // Append arrays
    product.features.forEach((feature) => {
        formData.append('features[]', feature); // This is correct
    });

    product.images.forEach((image, index) => {
      formData.append('images[]', {
        uri: image.uri,
        type: image.type,
        name: image.fileName || `product_image_${index}.jpg`,
      });
    });

    try {
      const result = await ApiService.createProduct(formData);

      if (result.success) {
        Alert.alert('Success', 'PawPal product created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        console.error("Backend Validation Error:", result.errors || result.message);
        Alert.alert('Error', result.message || 'Failed to create product');
      }
    } catch (error) {
      console.error("Network/Submit Error:", error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const renderTierSelector = () => (
    <View style={styles.tierSelector}>
      <Text style={styles.sectionTitle}>Product Tier *</Text>
      {tiers.map((tier) => (
        <TouchableOpacity
          key={tier.key}
          style={[
            styles.tierOption,
            { borderColor: tier.color },
            product.tier === tier.key && [styles.tierOptionSelected, { backgroundColor: tier.color + '20' }]
          ]}
          onPress={() => setProduct(prev => ({ ...prev, tier: tier.key }))}
        >
          <View style={styles.tierOptionContent}>
            <View style={[styles.tierIcon, { backgroundColor: tier.color }]}>
              <Icon name={tier.icon} size={20} color="white" />
            </View>
            <Text style={[
              styles.tierOptionText,
              product.tier === tier.key && { color: tier.color, fontWeight: 'bold' }
            ]}>
              {tier.label}
            </Text>
          </View>
          {product.tier === tier.key && (
            <Icon name="check-circle" size={24} color={tier.color} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCategorySelector = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryOption,
              product.category === category.key && [
                styles.categoryOptionSelected,
                { backgroundColor: getTierColor(product.tier), borderColor: getTierColor(product.tier) }
              ]
            ]}
            onPress={() => setProduct(prev => ({ ...prev, category: category.key }))}
          >
            <Text style={[
              styles.categoryOptionText,
              product.category === category.key && styles.categoryOptionTextSelected
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Add PawPal Product</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.formContainer}>
        <View style={styles.form}>
          {/* Tier Selection */}
          {renderTierSelector()}

          {/* Basic Info */}
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={[styles.input, { borderColor: getTierColor(product.tier) }]}
              value={product.name}
              onChangeText={(text) =>
                setProduct((prev) => ({ ...prev, name: text }))
              }
              placeholder="e.g., Automated PawPal Base Unit"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea, { borderColor: getTierColor(product.tier) }]}
              value={product.description}
              onChangeText={(text) =>
                setProduct((prev) => ({ ...prev, description: text }))
              }
              placeholder="Detailed product description highlighting key benefits..."
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Category Selection */}
          {renderCategorySelector()}

          {/* Pricing */}
          <Text style={styles.sectionTitle}>Pricing</Text>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Original Price</Text>
              <TextInput
                style={[styles.input, { borderColor: getTierColor(product.tier) }]}
                value={product.originalPrice}
                onChangeText={(text) =>
                  setProduct((prev) => ({ ...prev, originalPrice: text }))
                }
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>Sale Price *</Text>
              <TextInput
                style={[styles.input, { borderColor: getTierColor(product.tier) }]}
                value={product.price}
                onChangeText={(text) =>
                  setProduct((prev) => ({ ...prev, price: text }))
                }
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Stock Quantity *</Text>
            <TextInput
              style={[styles.input, { borderColor: getTierColor(product.tier) }]}
              value={product.stock_quantity}
              onChangeText={(text) =>
                setProduct((prev) => ({ ...prev, stock_quantity: text }))
              }
              placeholder="0"
              keyboardType="number-pad"
            />
          </View>

          {/* Points & Discount */}
          <Text style={styles.sectionTitle}>Rewards System</Text>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Points Required</Text>
              <TextInput
                style={[styles.input, { borderColor: getTierColor(product.tier) }]}
                value={product.points_required}
                onChangeText={(text) =>
                  setProduct((prev) => ({ ...prev, points_required: text }))
                }
                placeholder="0"
                keyboardType="number-pad"
              />
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>Discount %</Text>
              <TextInput
                style={[styles.input, { borderColor: getTierColor(product.tier) }]}
                value={product.discount_percentage}
                onChangeText={(text) =>
                  setProduct((prev) => ({ ...prev, discount_percentage: text }))
                }
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Features */}
          <Text style={styles.sectionTitle}>Product Features</Text>

          <View style={styles.featureInputContainer}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 10, borderColor: getTierColor(product.tier) }]}
              value={featureText}
              onChangeText={setFeatureText}
              placeholder="Enter a product feature"
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: getTierColor(product.tier) }]}
              onPress={handleAddFeature}
            >
              <Icon name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {product.features.length > 0 && (
            <View style={styles.featuresList}>
              {product.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Icon name="check-circle" size={16} color={getTierColor(product.tier)} />
                  <Text style={styles.featureText} numberOfLines={1}>
                    {feature}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveFeature(index)}>
                    <Icon name="close" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Images */}
         <Text style={styles.sectionTitle}>Product Images</Text>
      <TouchableOpacity
        style={[styles.imagePickerButton, { borderColor: getTierColor(product.tier) }]}
        onPress={handleSelectImages}
      >
        <Icon name="add-photo-alternate" size={24} color={getTierColor(product.tier)} />
        <Text style={[styles.imagePickerText, { color: getTierColor(product.tier) }]}>
            Select Images
        </Text>
      </TouchableOpacity>

      {/* Conditional rendering of image previews if images exist */}
      {product.images.length > 0 && (
        <View style={styles.imagesPreviewContainer}>
          {product.images.map((image, index) => (
            <View key={index} style={styles.imagePreviewWrapper}>
              {/* Display the image using its URI */}
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => handleRemoveImage(index)}
              >
                <Icon name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

          {/* Settings */}
          <Text style={styles.sectionTitle}>Product Settings</Text>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Featured Product</Text>
            <Switch
              value={product.is_featured}
              onValueChange={(value) =>
                setProduct((prev) => ({ ...prev, is_featured: value }))
              }
              trackColor={{ false: '#C4E6E8', true: getTierColor(product.tier) }}
              thumbColor={product.is_featured ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Active Product</Text>
            <Switch
              value={product.is_active}
              onValueChange={(value) =>
                setProduct((prev) => ({ ...prev, is_active: value }))
              }
              trackColor={{ false: '#C4E6E8', true: getTierColor(product.tier) }}
              thumbColor={product.is_active ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: getTierColor(product.tier) },
              loading && styles.disabledButton
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Icon name="add-shopping-cart" size={20} color="white" />
                <Text style={styles.submitButtonText}>Create PawPal Product</Text>
              </>
            )}
          </TouchableOpacity>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  formContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#257D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

   imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderWidth: 2,
    borderRadius: 12,
    borderStyle: 'dashed',
    marginBottom: 15,
  },
  imagePickerText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  imagesPreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  imagePreviewWrapper: {
    position: 'relative',
    margin: 5,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginTop: 20,
    marginBottom: 15,
  },
  tierSelector: {
    marginBottom: 10,
  },
  tierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  tierOptionSelected: {
    borderWidth: 2,
  },
  tierOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  tierOptionText: {
    fontSize: 16,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#257D8C',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9ff',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'white',
  },
  categoryOptionSelected: {
    borderWidth: 2,
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  categoryOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  featureInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  imageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FF',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureText: {
    flex: 1,
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
  },
  imagesList: {
    marginBottom: 20,
  },
  imageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C4E6E8',
  },
  imageUrl: {
    flex: 1,
    color: '#666',
    marginLeft: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#C4E6E8',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});