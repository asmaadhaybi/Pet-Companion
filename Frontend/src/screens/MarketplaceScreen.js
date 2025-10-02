import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TextInput,
    Image,
    RefreshControl,
    Alert,
    TouchableOpacity,
    ScrollView,
    Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function MarketplaceScreen({ navigation, route }) {
    const [userPoints, setUserPoints] = useState(0);
    const [userRole, setUserRole] = useState('user');
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [tiers] = useState(['All', 'Automated', 'Intelligent', 'Luxury']);
    const [selectedTier, setSelectedTier] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadMarketplaceData();
        });
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        if (route.params?.selectedTier) {
            // This fix takes only the first word (e.g., "Luxury")
            const tierKey = route.params.selectedTier.split(' ')[0];
            setSelectedTier(tierKey);
        }
    }, [route.params]);

    useEffect(() => {
        filterAndSortProducts();
    }, [products, selectedTier, searchQuery, sortBy, sortOrder]);

    const loadMarketplaceData = async () => {
        setLoading(true);
        await Promise.all([
            fetchUserData(),
            fetchProducts(),
            loadCart()
        ]);
        setLoading(false);
    };

    const fetchUserData = async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            const points = await AsyncStorage.getItem('userPoints');
            if (userData) {
                const user = JSON.parse(userData);
                setUserRole(user.role || 'user');
            }
            setUserPoints(points ? parseInt(points) : 150);
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    // Keep the API call for products but add local cart management
    const fetchProducts = async () => {
        try {
            const response = await ApiService.getAllProducts();
            console.log("--- RAW API RESPONSE ---", JSON.stringify(response, null, 2));

            if (response.success && response.data?.data) {
                setProducts(response.data.data); // Gets products from the paginated response
            } else {
                Alert.alert('Error', 'Could not load products from the store.');
                console.error("Failed to fetch products:", response);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            Alert.alert('Error', 'An unexpected error occurred while loading the store.');
        }
    };

    // Add local cart management functions from the shorter code
    const loadCart = async () => {
        try {
            const storedCart = await AsyncStorage.getItem('shoppingCart');
            if (storedCart) {
                setCart(JSON.parse(storedCart));
            }
        } catch (error) {
            console.error('Error loading cart:', error);
        }
    };

    const saveCart = async (newCart) => {
        try {
            await AsyncStorage.setItem('shoppingCart', JSON.stringify(newCart));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    };

    const filterAndSortProducts = () => {
        // Keep the same filtering logic but ensure array handling
        const productsArray = Array.isArray(products) ? products : products.data || [];
        let filtered = [...productsArray];

        console.log(`--- Filtering for tier: ${selectedTier} ---`);
        console.log("Products BEFORE filtering:", JSON.stringify(products, null, 2));

        // Filter by tier
        if (selectedTier !== 'All') {
            filtered = filtered.filter(p => 
                p.tier.toLowerCase() === selectedTier.toLowerCase()
            );
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query) ||
                (p.features && p.features.some(f => f.toLowerCase().includes(query)))
            );
        }
        
        // Sort logic
        filtered.sort((a, b) => a.name.localeCompare(b.name));

        console.log("Products AFTER filtering:", JSON.stringify(filtered, null, 2));
        setFilteredProducts(filtered);
    };

    // Replace the API addToCart with local cart management
    const addToCart = (product, quantity = 1) => {
        const existingItem = cart.find(item => item.id === product.id);
        let newCart;

        if (existingItem) {
            newCart = cart.map(item =>
                item.id === product.id
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            );
        } else {
            newCart = [...cart, { ...product, quantity }];
        }

        setCart(newCart);
        saveCart(newCart);
        
        Alert.alert(
            'Added to Cart! 🛒',
            `${product.name} has been added to your cart`,
            [{ text: 'OK' }]
        );
    };

    const removeFromCart = (productId) => {
        const newCart = cart.filter(item => item.id !== productId);
        setCart(newCart);
        saveCart(newCart);
    };

    const updateCartQuantity = (productId, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromCart(productId);
            return;
        }

        const newCart = cart.map(item =>
            item.id === productId
                ? { ...item, quantity: newQuantity }
                : item
        );
        setCart(newCart);
        saveCart(newCart);
    };

    const getDiscountedPrice = (product) => {
        const price = parseFloat(product.price) || 0;
        const discount = parseFloat(product.discount_percentage) || 0;
        if (product.points_required > 0 && userPoints >= product.points_required) {
            return price * (1 - discount / 100);
        }
        return price;
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

    const canUsePoints = (product) => {
        return userPoints >= product.points_required;
    };

    const canManageProducts = () => {
        return userRole === 'admin' || userRole === 'super_admin';
    };

    const getTotalCartValue = () => {
        return cart.reduce((total, item) => {
            return total + (getDiscountedPrice(item) * item.quantity);
        }, 0);
    };

    const getTotalCartItems = () => {
        return cart.reduce((total, item) => total + item.quantity, 0);
    };

    const proceedToCheckout = () => {
        if (cart.length === 0) {
            Alert.alert('Empty Cart', 'Please add items to cart before checkout');
            return;
        }
        
        setShowCart(false);
        navigation.navigate('Checkout', { 
            items: cart.map(item => ({
                product_id: item.id,
                product: item,
                quantity: item.quantity
            })),
            canUsePoints: cart.some(item => canUsePoints(item))
        });
    };

    const renderTierFilter = () => (
        <FlatList
            data={tiers}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[
                        styles.tierButton,
                        { borderColor: item !== 'All' ? getTierColor(item.toLowerCase()) : '#E5E7EB' },
                        selectedTier === item && { backgroundColor: item !== 'All' ? getTierColor(item.toLowerCase()) : '#257D8C' }
                    ]}
                    onPress={() => setSelectedTier(item)}
                >
                    {item !== 'All' && <Icon name={getTierIcon(item.toLowerCase())} size={16} color={selectedTier === item ? 'white' : getTierColor(item.toLowerCase())} style={{ marginRight: 6 }} />}
                    <Text style={{ color: selectedTier === item ? 'white' : '#333', fontWeight: '600' }}>{item}</Text>
                </TouchableOpacity>
            )}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tierContainer}
        />
    );

    const renderProductCard = ({ item }) => {
        const discountedPrice = getDiscountedPrice(item);
        const hasDiscount = canUsePoints(item);
        const price = parseFloat(item.price) || 0;
        const rating = parseFloat(item.rating) || 0;

        return (
            <TouchableOpacity style={styles.productCard} onPress={() => navigation.navigate('ProductDetails', { product: item })}>
                <View style={[styles.tierBadge, { backgroundColor: getTierColor(item.tier) }]}>
                    <Icon name={getTierIcon(item.tier)} size={12} color="white" />
                    <Text style={styles.tierBadgeText}>{item.tier.toUpperCase()}</Text>
                </View>

                {item.images && item.images.length > 0 ? (
                    <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                ) : (
                    <View style={[styles.productImage, styles.placeholderImage]}>
                        <Icon name="pets" size={40} color="#C4E6E8" />
                    </View>
                )}

                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.productDescription} numberOfLines={2}>{item.description}</Text>
                    <View style={styles.ratingContainer}>
                        <Icon name="star" size={14} color="#F7931E" />
                        <Text style={styles.ratingText}>{rating.toFixed(1)} ({item.reviews_count})</Text>
                    </View>

                    <View style={styles.priceRow}>
                        {hasDiscount && <Text style={styles.originalPrice}>${price.toFixed(2)}</Text>}
                        <Text style={styles.currentPrice}>${discountedPrice.toFixed(2)}</Text>
                    </View>

                    <Text style={[styles.stockText, { color: item.stock_quantity > 0 ? '#4CAF50' : '#F44336' }]}>
                        {item.stock_quantity > 0 ? `In Stock (${item.stock_quantity})` : 'Out of Stock'}
                    </Text>

                    <TouchableOpacity
                        style={[styles.addToCartButton, { backgroundColor: getTierColor(item.tier) }, item.stock_quantity === 0 && styles.addToCartButtonDisabled]}
                        onPress={() => addToCart(item)}
                        disabled={item.stock_quantity === 0}
                    >
                        <Icon name="add-shopping-cart" size={14} color="white" />
                        <Text style={styles.addToCartButtonText}>{item.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderCartModal = () => (
        <Modal
            visible={showCart}
            animationType="slide"
            onRequestClose={() => setShowCart(false)}
        >
            <SafeAreaView style={styles.cartModal}>
                <View style={styles.cartHeader}>
                    <Text style={styles.cartTitle}>Shopping Cart</Text>
                    <TouchableOpacity onPress={() => setShowCart(false)}>
                        <Icon name="close" size={24} color="#257D8C" />
                    </TouchableOpacity>
                </View>
                
                {cart.length > 0 ? (
                    <>
                        <FlatList
                            data={cart}
                            renderItem={({ item }) => (
                                <View style={styles.cartItem}>
                                    <View style={[styles.cartTierBadge, { backgroundColor: getTierColor(item.tier) }]}>
                                        <Icon name={getTierIcon(item.tier)} size={10} color="white" />
                                    </View>

                                    {item.images && item.images.length > 0 ? (
                                        <Image source={{ uri: item.images[0] }} style={styles.cartItemImage} />
                                    ) : (
                                        <View style={[styles.cartItemImage, styles.placeholderImage]}>
                                            <Icon name="pets" size={20} color="#C4E6E8" />
                                        </View>
                                    )}
                                    
                                    <View style={styles.cartItemInfo}>
                                        <Text style={styles.cartItemName}>{item.name}</Text>
                                        <Text style={styles.cartItemPrice}>
                                            ${getDiscountedPrice(item).toFixed(2)} each
                                        </Text>
                                        {canUsePoints(item) && (
                                            <Text style={styles.cartItemDiscount}>
                                                {item.discount_percentage}% points discount applied
                                            </Text>
                                        )}
                                    </View>
                                    
                                    <View style={styles.quantityControls}>
                                        <TouchableOpacity
                                            style={styles.quantityButton}
                                            onPress={() => updateCartQuantity(item.id, item.quantity - 1)}
                                        >
                                            <Icon name="remove" size={16} color="#257D8C" />
                                        </TouchableOpacity>
                                        <Text style={styles.quantityText}>{item.quantity}</Text>
                                        <TouchableOpacity
                                            style={styles.quantityButton}
                                            onPress={() => updateCartQuantity(item.id, item.quantity + 1)}
                                        >
                                            <Icon name="add" size={16} color="#257D8C" />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => removeFromCart(item.id)}
                                    >
                                        <Icon name="delete" size={16} color="#F44336" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            keyExtractor={(item) => item.id.toString()}
                        />
                        
                        <View style={styles.cartSummary}>
                            <View style={styles.cartTotal}>
                                <Text style={styles.cartTotalText}>
                                    Total: ${getTotalCartValue().toFixed(2)}
                                </Text>
                                <Text style={styles.cartItemsCount}>
                                    {getTotalCartItems()} items • Points savings applied
                                </Text>
                            </View>
                            
                            <TouchableOpacity
                                style={styles.checkoutButton}
                                onPress={proceedToCheckout}
                            >
                                <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyCart}>
                        <Icon name="shopping-cart" size={64} color="#C4E6E8" />
                        <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
                        <Text style={styles.emptyCartSubtitle}>Add some PawPal products to get started</Text>
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color="white" /></TouchableOpacity>
                <Text style={styles.headerTitle}>PawPal Store</Text>
                <View style={styles.headerRight}>
                    <View style={styles.pointsContainer}><Icon name="stars" size={16} color="#C066E3" /><Text style={styles.pointsText}>{userPoints}</Text></View>
                    <TouchableOpacity
                        style={styles.cartIcon}
                        onPress={() => setShowCart(true)}
                    >
                        <Icon name="shopping-cart" size={24} color="white" />
                        {cart.length > 0 && (
                            <View style={styles.cartBadge}>
                                <Text style={styles.cartBadgeText}>{getTotalCartItems()}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <Icon name="search" size={20} color="#666" />
                <TextInput style={styles.searchInput} placeholder="Search PawPal products..." value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Icon name="clear" size={20} color="#666" /></TouchableOpacity>}
            </View>

            <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMarketplaceData} />}>
                {renderTierFilter()}
                
                {canManageProducts() && (
                    <View style={styles.adminActions}>
                        <TouchableOpacity style={styles.adminButton} onPress={() => navigation.navigate('AddProduct')}>
                            <Icon name="add" size={16} color="white" />
                            <Text style={styles.adminButtonText}>Add Product</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.productsSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{selectedTier === 'All' ? 'All Products' : `${selectedTier} Tier`}</Text>
                        <Text style={styles.productsCount}>{filteredProducts.length} items</Text>
                    </View>
                    <FlatList
                        data={filteredProducts}
                        renderItem={renderProductCard}
                        keyExtractor={(item) => item.id.toString()}
                        numColumns={2}
                        columnWrapperStyle={styles.productRow}
                        scrollEnabled={false}
                    />
                </View>
            </ScrollView>

            {/* Floating Cart Button */}
            {cart.length > 0 && (
                <TouchableOpacity
                    style={styles.floatingCartButton}
                    onPress={() => setShowCart(true)}
                >
                    <Icon name="shopping-cart" size={20} color="white" />
                    <Text style={styles.floatingCartText}>
                        {getTotalCartItems()} • ${getTotalCartValue().toFixed(2)}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Cart Modal */}
            {renderCartModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F9FF' },
    header: { backgroundColor: '#257D8C', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', flex: 1, textAlign: 'center' },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    pointsContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginRight: 15 },
    pointsText: { marginLeft: 4, fontSize: 12, fontWeight: '600', color: 'white' },
    cartIcon: { position: 'relative' },
    cartBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FF6B6B', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
    cartBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    searchContainer: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginVertical: 10, paddingHorizontal: 15, borderRadius: 25, elevation: 2 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333', paddingVertical: 10 },
    tierContainer: { paddingHorizontal: 15, paddingVertical: 10 },
    tierButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, backgroundColor: 'white' },
    adminActions: { paddingHorizontal: 15, paddingVertical: 10 },
    adminButton: { backgroundColor: '#257D8C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 20, elevation: 2 },
    adminButtonText: { color: 'white', fontSize: 14, fontWeight: '600', marginLeft: 5 },
    productsSection: { paddingHorizontal: 15, paddingTop: 5 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#257D8C' },
    productsCount: { fontSize: 14, color: '#666' },
    productRow: { justifyContent: 'space-between' },
    productCard: { backgroundColor: 'white', borderRadius: 15, width: '48.5%', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, position: 'relative', marginBottom: 15 },
    tierBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, zIndex: 1 },
    tierBadgeText: { color: 'white', fontSize: 8, fontWeight: 'bold', marginLeft: 2 },
    productImage: { width: '100%', height: 120, borderTopLeftRadius: 15, borderTopRightRadius: 15 },
    placeholderImage: { backgroundColor: '#F0F9F9', justifyContent: 'center', alignItems: 'center' },
    productInfo: { padding: 12 },
    productName: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4, height: 34 },
    productDescription: { fontSize: 12, color: '#666', marginBottom: 6, height: 32 },
    ratingContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    ratingText: { fontSize: 11, color: '#666', marginLeft: 4 },
    priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    originalPrice: { fontSize: 12, color: '#999', textDecorationLine: 'line-through', marginRight: 6 },
    currentPrice: { fontSize: 16, fontWeight: 'bold', color: '#257D8C' },
    stockText: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
    addToCartButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, marginTop: 'auto' },
    addToCartButtonDisabled: { backgroundColor: '#CCC' },
    addToCartButtonText: { color: 'white', fontSize: 11, fontWeight: '600', marginLeft: 4 },
    floatingCartButton: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#257D8C', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    floatingCartText: { color: 'white', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
    // Cart Modal Styles
    cartModal: { flex: 1, backgroundColor: '#F0F9FF' },
    cartHeader: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    cartTitle: { fontSize: 18, fontWeight: 'bold', color: '#257D8C' },
    cartItem: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 15, marginVertical: 5, borderRadius: 12, elevation: 2, position: 'relative' },
    cartTierBadge: { position: 'absolute', top: 5, left: 5, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
    cartItemImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
    cartItemInfo: { flex: 1 },
    cartItemName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    cartItemPrice: { fontSize: 12, color: '#666', marginTop: 2 },
    cartItemDiscount: { fontSize: 11, color: '#4CAF50', fontWeight: '500', marginTop: 2 },
    quantityControls: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
    quantityButton: { backgroundColor: '#F8F9FF', borderWidth: 1, borderColor: '#C4E6E8', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
    quantityText: { fontSize: 14, fontWeight: 'bold', color: '#257D8C', marginHorizontal: 15, minWidth: 20, textAlign: 'center' },
    removeButton: { padding: 5 },
    cartSummary: { backgroundColor: 'white', padding: 20, marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    cartTotal: { marginBottom: 15 },
    cartTotalText: { fontSize: 20, fontWeight: 'bold', color: '#257D8C' },
    cartItemsCount: { fontSize: 14, color: '#666', marginTop: 2 },
    checkoutButton: { backgroundColor: '#257D8C', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    checkoutButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyCartTitle: { fontSize: 20, fontWeight: 'bold', color: '#257D8C', marginTop: 20 },
    emptyCartSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 10 },
});