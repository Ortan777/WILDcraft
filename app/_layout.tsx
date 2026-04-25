import { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ReceivePaymentScreen from './screens/ReceivePaymentScreen';
import ScanQRScreen from './screens/ScanQRScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import LinkBankScreen from './screens/LinkBankScreen';
import TopUpScreen from './screens/TopUpScreen';

const Stack = createNativeStackNavigator();

export default function RootLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) setUser(JSON.parse(userData));
    } catch (e) {
      console.log('Login check error:', e);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      // ── Keys from wallet.js ──────────────────────────────────
      const walletBalance  = await AsyncStorage.getItem('wallet_balance');  // WALLET_KEY
      const linkedBank     = await AsyncStorage.getItem('linked_bank');
      const tokens         = await AsyncStorage.getItem('payment_tokens');  // TOKENS_KEY
      const transactions   = await AsyncStorage.getItem('transactions');    // TRANSACTIONS_KEY

      // Wipe everything
      await AsyncStorage.clear();

      // Restore persistent data
      if (walletBalance)  await AsyncStorage.setItem('wallet_balance',  walletBalance);
      if (linkedBank)     await AsyncStorage.setItem('linked_bank',     linkedBank);
      if (tokens)         await AsyncStorage.setItem('payment_tokens',  tokens);
      if (transactions)   await AsyncStorage.setItem('transactions',    transactions);

    } catch (e) {
      console.log('Logout error:', e);
    }
    setUser(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoCircle}>
          <View style={styles.logoInner} />
        </View>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLoginSuccess={async (u) => {
          await AsyncStorage.setItem('user', JSON.stringify(u));
          await AsyncStorage.setItem('user_id', String(u.id));
          setUser(u);
        }}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home">
        {(props) => (
          <HomeScreen {...props} user={user} onLogout={handleLogout} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ScanQR" component={ScanQRScreen} />
      <Stack.Screen name="ReceivePayment">
        {(props) => <ReceivePaymentScreen {...props} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="LinkBank">
        {(props) => <LinkBankScreen {...props} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="TopUp">
        {(props) => <TopUpScreen {...props} user={user} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoInner: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#fff',
  },
});