import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Alert, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api'; // Ensure this path is correct

export default function OrdersManagementScreen({ navigation }) {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [loading, setLoading] = useState(true); // Start loading on initial mount
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ total: 0, pending: 0, totalValue: 0, delivered: 0 });

 // ✅ This function is now safer and handles responses from your makeRequest
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await ApiService.adminGetAllOrders();

            // Check if your makeRequest function reported success
            if (response.success) {
                // Safely check if the nested data structure exists
                const ordersArray = response.data?.orders?.data;

                // Check if we actually got an array of orders
                if (Array.isArray(ordersArray)) {
                    setOrders(ordersArray);
                    calculateStats(ordersArray);
                } else {
                    // This handles cases where the response is successful but empty
                    console.log('Request successful, but no orders were found.');
                    setOrders([]);
                    calculateStats([]);
                }
            } else {
                // This handles cases where makeRequest returned success: false
                throw new Error(response.error || 'An unknown API error occurred.');
            }
        } catch (error) {
            Alert.alert('Error', error.message);
            setOrders([]);
            calculateStats([]); // Also reset stats on error
        } finally {
            setLoading(false);
        }
    }, []);
    // Fetch orders when the screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', fetchOrders);
        return unsubscribe;
    }, [navigation, fetchOrders]);

    // Apply filters whenever the source data or search query changes
    useEffect(() => {
        let filtered = [...orders];

        if (filter !== 'all') {
            filtered = filtered.filter(order => order.status === filter);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(order =>
                order.order_number?.toLowerCase().includes(query) ||
                order.user?.name?.toLowerCase().includes(query) ||
                order.user?.email?.toLowerCase().includes(query)
            );
        }
        setFilteredOrders(filtered);
    }, [orders, filter, searchQuery]);


    const calculateStats = (ordersData) => {
        const newStats = {
            total: ordersData.length,
            pending: ordersData.filter(o => o.status === 'pending').length,
            confirmed: ordersData.filter(o => o.status === 'confirmed').length,
            shipped: ordersData.filter(o => o.status === 'shipped').length,
            delivered: ordersData.filter(o => o.status === 'delivered').length,
            cancelled: ordersData.filter(o => o.status === 'cancelled').length,
            totalValue: ordersData.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0)
        };
        setStats(newStats);
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            const response = await ApiService.adminUpdateOrderStatus(orderId, { status: newStatus });
            if (response.success) {
                Alert.alert('Success', `Order status updated to ${newStatus}`);
                fetchOrders(); // Refresh the list
            } else {
                throw new Error(response.message || 'An unknown error occurred');
            }
        } catch (error) {
            console.error('Update order status error:', error);
            Alert.alert('Error', `Failed to update order status: ${error.message}`);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: '#FFC107', confirmed: '#257D8C', shipped: '#45B7D1',
            delivered: '#4CAF50', cancelled: '#FF6B6B',
        };
        return colors[status] || '#666';
    };

    const getStatusIcon = (status) => {
        const icons = {
            pending: 'schedule', confirmed: 'check-circle', shipped: 'local-shipping',
            delivered: 'done-all', cancelled: 'cancel',
        };
        return icons[status] || 'info';
    };

    const getNextStatus = (currentStatus) => {
        const statusFlow = {
            pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered',
        };
        return statusFlow[currentStatus];
    };

    const renderOrderStatusActions = (order) => {
        const nextStatus = getNextStatus(order.status);
        if (order.status === 'delivered' || order.status === 'cancelled') return null;

        return (
            <View style={styles.statusActions}>
                {nextStatus && (
                    <TouchableOpacity
                        style={[styles.statusButton, { backgroundColor: getStatusColor(nextStatus) }]}
                        onPress={() => updateOrderStatus(order.id, nextStatus)}
                    >
                        <Icon name={getStatusIcon(nextStatus)} size={14} color="white" />
                        <Text style={styles.statusButtonText}>Mark as {nextStatus}</Text>
                    </TouchableOpacity>
                )}
                {order.status !== 'cancelled' && (
                    <TouchableOpacity
                        style={[styles.statusButton, styles.cancelButton]}
                        onPress={() => Alert.alert(
                            'Cancel Order',
                            'Are you sure you want to cancel this order?',
                            [
                                { text: 'No', style: 'cancel' },
                                { text: 'Yes', onPress: () => updateOrderStatus(order.id, 'cancelled') }
                            ]
                        )}
                    >
                        <Icon name="cancel" size={14} color="white" />
                        <Text style={styles.statusButtonText}>Cancel</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderOrder = ({ item }) => (
        <TouchableOpacity
            style={styles.orderCard}
            onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
        >
            <View style={styles.orderHeader}>
                <View>
                    <Text style={styles.orderNumber}>#{item.order_number}</Text>
                    <Text style={styles.orderDate}>
                        {new Date(item.created_at).toLocaleString()}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Icon name={getStatusIcon(item.status)} size={16} color={getStatusColor(item.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {(item.status || '').toUpperCase()}
                    </Text>
                </View>
            </View>
            <View style={styles.orderDetails}>
                <View style={styles.orderDetailRow}>
                    <Icon name="person" size={16} color="#666" />
                    <Text style={styles.orderDetailText}>{item.user?.name || 'Customer'}</Text>
                </View>
                <View style={styles.orderDetailRow}>
                    <Icon name="shopping-bag" size={16} color="#666" />
                    <Text style={styles.orderDetailText}>{item.order_items?.length || 0} item(s)</Text>
                </View>
            </View>
            <View style={styles.orderFooter}>
                <Text style={styles.totalAmount}>${parseFloat(item.total_amount || 0).toFixed(2)}</Text>
            </View>
            {renderOrderStatusActions(item)}
        </TouchableOpacity>
    );

    const renderFilterButton = (label, value) => (
        <TouchableOpacity
            style={[
                styles.filterButton,
                filter === value && { backgroundColor: getStatusColor(value) || '#257D8C' }
            ]}
            onPress={() => setFilter(value)}
        >
            <Text style={[styles.filterButtonText, filter === value && styles.filterButtonTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    if (loading && !orders.length) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#257D8C" />
                <Text style={styles.loadingText}>Fetching Orders...</Text>
            </View>
        );
    }
    
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color="white" /></TouchableOpacity>
                <Text style={styles.title}>Orders Management</Text>
                <TouchableOpacity onPress={fetchOrders}>
                    <Icon name="refresh" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Icon name="search" size={20} color="#999" style={{marginLeft: 5}}/>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Order # or Customer..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
                    {renderFilterButton('All', 'all')}
                    {renderFilterButton('Pending', 'pending')}
                    {renderFilterButton('Confirmed', 'confirmed')}
                    {renderFilterButton('Shipped', 'shipped')}
                    {renderFilterButton('Delivered', 'delivered')}
                    {renderFilterButton('Cancelled', 'cancelled')}
                </ScrollView>
            </View>

            {filteredOrders.length === 0 ? (
                <View style={styles.emptyState}>
                    <Icon name="receipt-long" size={64} color="#C4E6E8" />
                    <Text style={styles.emptyTitle}>No Orders Found</Text>
                    <Text style={styles.emptySubtitle}>Try adjusting your search or filter.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    renderItem={renderOrder}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.ordersList}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchOrders} colors={["#257D8C"]} />
                    }
                />
            )}
        </View>
    );
}

// Add these simplified styles to your file
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F9FF' },
    header: { backgroundColor: '#257D8C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15 },
    title: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    searchContainer: { margin: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 10, elevation: 2 },
    searchInput: { flex: 1, height: 50, paddingLeft: 10 },
    filtersContainer: { paddingHorizontal: 15, paddingVertical: 10 },
    filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'white', marginRight: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    filterButtonText: { fontSize: 13, fontWeight: '600', color: '#666' },
    filterButtonTextActive: { color: 'white' },
    ordersList: { paddingHorizontal: 15, paddingBottom: 30 },
    orderCard: { backgroundColor: 'white', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    orderNumber: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
    orderDate: { fontSize: 12, color: '#666' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15 },
    statusText: { marginLeft: 6, fontSize: 11, fontWeight: '700' },
    orderDetails: { marginBottom: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 },
    orderDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    orderDetailText: { fontSize: 13, color: '#666', marginLeft: 8 },
    orderFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#257D8C' },
    statusActions: { flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 },
    statusButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
    cancelButton: { backgroundColor: '#FF6B6B' },
    statusButtonText: { color: 'white', fontSize: 12, fontWeight: '600', marginLeft: 4 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#257D8C', marginTop: 20, marginBottom: 10 },
    emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
});