import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function OrderSuccessScreen({ route, navigation }) {
    // Get the order details passed from the CheckoutScreen
    const { order } = route.params;

    // Debug: Log the order object to see its structure
    useEffect(() => {
        console.log('Order object received in OrderSuccessScreen:', JSON.stringify(order, null, 2));
    }, [order]);

    // Safely parse the values - handle different possible structures
    const getOrderNumber = () => {
        // Try different possible locations for order number/ID
        return order?.order_number || 
               order?.id || 
               order?.data?.order_number || 
               order?.data?.id || 
               `ORD-${Date.now()}`;
    };

    const getTotalAmount = () => {
        // Try different possible locations for total amount
        const total = order?.total_amount || 
                     order?.total || 
                     order?.data?.total_amount || 
                     order?.data?.total || 0;
        
        const parsedTotal = parseFloat(total);
        return isNaN(parsedTotal) ? 0 : parsedTotal;
    };

    const getPointsEarned = () => {
        // Try different possible locations for points earned
        const points = order?.points_earned || 
                      order?.data?.points_earned || 0;
        
        const parsedPoints = parseInt(points);
        return isNaN(parsedPoints) ? 0 : parsedPoints;
    };

    const totalAmount = getTotalAmount();
    const pointsEarned = getPointsEarned();
    const orderNumber = getOrderNumber();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Icon name="check-circle" size={100} color="#4CAF50" />
                </View>

                <Text style={styles.title}>Order Placed Successfully!</Text>
                <Text style={styles.subtitle}>
                    Thank you for your purchase. Your order is being processed.
                </Text>

                <View style={styles.orderDetails}>
                    <Text style={styles.orderLabel}>Order Number:</Text>
                    <Text style={styles.orderValue}>#{orderNumber}</Text>
                    
                    <Text style={styles.orderLabel}>Total Amount:</Text>
                    <Text style={styles.orderTotal}>${totalAmount.toFixed(2)}</Text>

                    {/* Points Display Section */}
                    {pointsEarned > 0 && (
                        <>
                            <Text style={styles.pointsLabel}>Points Earned:</Text>
                            <View style={styles.pointsContainer}>
                                <Icon name="stars" size={24} color="#FFC107" />
                                <Text style={styles.pointsValue}>+{pointsEarned} Points!</Text>
                            </View>
                        </>
                    )}


                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('Marketplace')}
                >
                    <Text style={styles.buttonText}>Continue Shopping</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F9FF',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    iconContainer: {
        marginBottom: 30,
        backgroundColor: 'white',
        borderRadius: 75,
        padding: 20,
        elevation: 5,
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#257D8C',
        textAlign: 'center',
        marginBottom: 15,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
    },
    orderDetails: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 20,
        width: '100%',
        alignItems: 'center',
        marginBottom: 40,
        elevation: 3,
    },
    orderLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    orderValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    orderTotal: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#257D8C',
    },
    pointsLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 15,
    },
    pointsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    pointsValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFC107',
        marginLeft: 8,
    },

    button: {
        backgroundColor: '#257D8C',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 30,
        elevation: 3,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});