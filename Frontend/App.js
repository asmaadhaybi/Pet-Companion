import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import all your screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import PetInfoScreen from './src/screens/PetInfoScreen';
import HomeScreen from './src/screens/HomeScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreem'; // Corrected typo
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import AddProductScreen from './src/screens/AddProductScreen';
import ProductDetailsScreen from './src/screens/ProductDetailsScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';
import PointsHistoryScreen from './src/screens/PointsHistoryScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import EditPetScreen from './src/screens/EditPetScreen';
import PetsManagementScreen from './src/screens/PetsManagementScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import NutritionScreen from './src/screens/NutritionScreen';
import GamesScreen from './src/screens/GamesScreen';
import HealthScreen from './src/screens/HealthScreen';
import ReportViewerScreen from './src/screens/ReportViewerScreen';
import CartScreen from './src/screens/CartScreen';
import OrderSuccessScreen from './src/screens/OrderSuccessScreen';
// import VideoHistoryScreen from './src/screens/VideoHistoryScreen';
// import VideoPlayerScreen from './src/screens/VideoPlayerScreen';
import OrdersManagementScreen from './src/screens/OrdersManagementScreen';
import OrderDetailsScreen from './src/screens/OrderDetailsScreen';
// import CameraScreen from './src/screens/CameraScreen'; // ✅ 1. IMPORT THE CAMERA SCREEN

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Authentication */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

        {/* Core App */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        
        {/* Pet Management */}
        <Stack.Screen name="PetInfo" component={PetInfoScreen} />
        <Stack.Screen name="EditPet" component={EditPetScreen} />
        <Stack.Screen name="PetsManagement" component={PetsManagementScreen} />
        
        {/* Features */}
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
        <Stack.Screen name="Nutrition" component={NutritionScreen} />
        <Stack.Screen name="Games" component={GamesScreen} />
        <Stack.Screen name="Health" component={HealthScreen}/>
        <Stack.Screen name="ReportViewer" component={ReportViewerScreen} />
        
        {/* Marketplace */}
        <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
        <Stack.Screen name="AddProduct" component={AddProductScreen} />
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        <Stack.Screen name="PointsHistory" component={PointsHistoryScreen} />
        <Stack.Screen name="Cart" component={CartScreen}/>
        <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ headerShown: false }} // Hides the header for a cleaner look
        />

        {/* <Stack.Screen name="VideoHistory" component={VideoHistoryScreen}/>
        <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen}/>  */}
        {/* <Stack.Screen name="CameraScreen" component={CameraScreen} /> */}

<Stack.Screen 
  name="OrdersManagement" 
  component={OrdersManagementScreen}
  options={{ headerShown: false }}
/>
 {/* 2. ADD THIS LINE */}
      <Stack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen} 
      />
      </Stack.Navigator>
    </NavigationContainer>
  );
}