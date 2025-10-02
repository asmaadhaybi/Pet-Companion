import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import ApiService from '../services/api'; // Make sure this path is correct

export default function OrderDetailsScreen({ route }) {
  // Get the orderId that was passed from the OrdersManagementScreen
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

 useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      try {
        setLoading(true);
        // ✅ CHANGE THIS LINE to use the new admin function
        const response = await ApiService.adminGetOrder(orderId);

        // ✅ This now correctly reads the data from your makeAdminRequest
        if (response.success && response.data) {
          setOrder(response.data.data); // The actual order is nested one level deeper
        } else {
          throw new Error(response.error || 'Failed to fetch order details.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrderDetails();
  }, [orderId]);

  if (loading) {
    return <ActivityIndicator style={styles.centered} size="large" color="#257D8C" />;
  }

  if (error) {
    return <Text style={styles.errorText}>Error: {error}</Text>;
  }

  if (!order) {
    return <Text style={styles.centered}>Order not found.</Text>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Order #{order.order_number}</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer Details</Text>
        <Text style={styles.text}>Name: {order.user?.name}</Text>
        <Text style={styles.text}>Email: {order.user?.email}</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Summary</Text>
        {order.order_items?.map(item => (
          <View key={item.id} style={styles.item}>
            <Text style={styles.itemName}>{item.product?.name} (x{item.quantity})</Text>
            <Text style={styles.itemPrice}>${parseFloat(item.total_price).toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>${parseFloat(order.total_amount).toFixed(2)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F9FF' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: 'red', textAlign: 'center', marginTop: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', marginVertical: 20 },
    card: { backgroundColor: 'white', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12, elevation: 3 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#257D8C', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
    text: { fontSize: 16, color: '#666', marginBottom: 5 },
    item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    itemName: { fontSize: 16, color: '#333' },
    itemPrice: { fontSize: 16, fontWeight: '500' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalValue: { fontSize: 18, fontWeight: 'bold', color: '#257D8C' }
});