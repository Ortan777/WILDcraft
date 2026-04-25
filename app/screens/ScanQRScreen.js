import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, StatusBar
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTransaction, markTransactionSynced, generateToken, saveToken, markTokenSettled, getBalance, saveBalance } from '../storage/wallet';
import QRCode from 'react-native-qrcode-svg';

const SERVER_URL = 'http://10.10.10.100:3000';

export default function ScanQRScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('scan');
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => { setup(); }, []);

  const setup = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    try {
      const parsed = JSON.parse(data);
      if (!parsed.amount || !parsed.merchantId) { Alert.alert('Invalid QR', 'Not an OfflinePay QR.'); return; }
      if (parsed.merchantId === user?.id) { Alert.alert('Error', 'You cannot pay yourself!'); return; }
      setScanned(true); setPaymentData(parsed); setScreen('confirm');
    } catch { Alert.alert('Invalid QR', 'Not an OfflinePay QR.'); }
  };

  const confirmPayment = async () => {
    if (!paymentData || !user) return;
    setProcessing(true);
    const localBalance = await getBalance();
    if (localBalance < paymentData.amount) {
      Alert.alert('❌ Insufficient Balance', `Your balance ₹${localBalance} is less than ₹${paymentData.amount}`);
      setProcessing(false); return;
    }
    const token = generateToken();
    const createdAt = new Date().toISOString();
    const newBalance = localBalance - paymentData.amount;
    await saveBalance(newBalance);
    await saveToken({ token, type: 'sent', senderId: user.id, senderName: user.name, receiverId: paymentData.merchantId, receiverName: paymentData.merchantName, amount: paymentData.amount, createdAt, status: 'pending' });
    await saveTransaction({ type: 'sent', amount: paymentData.amount, merchant: paymentData.merchantName, merchantId: paymentData.merchantId, token, status: 'pending_sync' });
    const receipt = { token, senderId: user.id, senderName: user.name, receiverId: paymentData.merchantId, receiverName: paymentData.merchantName, amount: paymentData.amount, createdAt, type: 'payment_receipt' };
    const settled = await trySettle(receipt);
    if (settled) { await markTokenSettled(token); await markTransactionSynced(token); receipt.status = 'settled'; }
    else receipt.status = 'pending';
    setReceiptData(receipt); setScreen('receipt'); setProcessing(false);
  };

  const trySettle = async (receipt) => {
    try {
      const response = await fetch(`${SERVER_URL}/payment/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(receipt) });
      const data = await response.json();
      return data.success;
    } catch (e) { return false; }
  };

  if (hasPermission === null || hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan & Pay</Text>
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.permText}>
            {hasPermission === null ? 'Requesting camera permission...' : '❌ Camera permission denied.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── SCAN ─────────────────────────────────────
  if (screen === 'scan') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan & Pay</Text>
          <Text style={styles.headerSubtitle}>Point camera at merchant's QR code</Text>
        </View>
        <View style={styles.cameraSection}>
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarCodeScanned}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame} />
            </View>
          </View>
          <Text style={styles.scanHint}>Align QR code within the frame</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── CONFIRM ───────────────────────────────────
  if (screen === 'confirm') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => { setScanned(false); setPaymentData(null); setScreen('scan'); }}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Payment</Text>
          <Text style={styles.headerSubtitle}>Review before paying</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.confirmCard}>
            <View style={styles.merchantCircle}>
              <Text style={{ fontSize: 30 }}>🏪</Text>
            </View>
            <Text style={styles.merchantName}>{paymentData?.merchantName}</Text>
            <Text style={styles.confirmAmount}>₹{paymentData?.amount}</Text>
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>⚡ Offline Token Payment</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paying to</Text>
              <Text style={styles.summaryValue}>{paymentData?.merchantName}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={[styles.summaryValue, { color: '#dc2626' }]}>₹{paymentData?.amount}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Method</Text>
              <Text style={styles.summaryValue}>Offline Token</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.payBtn} onPress={confirmPayment} disabled={processing}>
            <Text style={styles.payBtnText}>{processing ? 'Processing...' : '✅ Pay Now'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setScanned(false); setPaymentData(null); setScreen('scan'); }}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── RECEIPT ───────────────────────────────────
  if (screen === 'receipt' && receiptData) {
    const settled = receiptData.status === 'settled';
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={settled ? '#0f9d58' : '#1a73e8'} />
        <View style={[styles.headerBlock, { backgroundColor: settled ? '#0f9d58' : '#1a73e8' }]}>
          <Text style={styles.headerTitle}>{settled ? '✅ Payment Complete!' : '⚡ Payment Token'}</Text>
          <Text style={styles.headerSubtitle}>{settled ? 'Your payment has been settled' : 'Payment saved — will sync when online'}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {settled ? (
            <View style={styles.settledCard}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>✅</Text>
              <Text style={styles.settledTitle}>Payment Settled!</Text>
              <Text style={styles.settledAmount}>₹{receiptData.amount}</Text>
              <Text style={styles.settledSub}>Sent to {receiptData.receiverName}</Text>
            </View>
          ) : (
            <View style={styles.receiptCard}>
              <Text style={styles.receiptTitle}>Ask merchant to scan this QR</Text>
              <Text style={styles.receiptSub}>This stores the payment token on merchant's phone</Text>
              <View style={styles.qrBox}>
                <QRCode value={JSON.stringify(receiptData)} size={220} />
              </View>
              <Text style={styles.tokenText}>Token: {receiptData.token?.slice(0, 20)}...</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>⏳ Pending Settlement</Text>
              </View>
              <Text style={styles.receiptInfo}>When either device goes online, payment auto-settles ✅</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.payBtn, { backgroundColor: settled ? '#0f9d58' : '#1a73e8' }]} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.payBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerBlock: {
    backgroundColor: '#1a73e8',
    paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  backIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  backIconText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  scrollContent: { padding: 20 },
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  permText: { fontSize: 16, color: '#374151', textAlign: 'center' },

  cameraSection: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  cameraWrapper: { width: 280, height: 280, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 200, height: 200, borderWidth: 2.5, borderColor: '#1a73e8', borderRadius: 14 },
  scanHint: { marginTop: 20, fontSize: 14, color: '#6b7280', fontWeight: '500' },

  confirmCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 30, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  merchantCircle: { width: 70, height: 70, borderRadius: 20, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  merchantName: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  confirmAmount: { fontSize: 46, fontWeight: 'bold', color: '#111827', marginBottom: 14 },
  offlineBadge: { backgroundColor: '#fef3e2', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  offlineBadgeText: { color: '#f29900', fontSize: 13, fontWeight: '700' },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 8, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  summaryLabel: { fontSize: 13, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  summaryDivider: { height: 1, backgroundColor: '#f3f4f6' },

  payBtn: {
    backgroundColor: '#1a73e8', borderRadius: 14, padding: 17, alignItems: 'center', marginBottom: 12,
    shadowColor: '#1a73e8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },

  settledCard: {
    backgroundColor: '#f0fdf4', borderRadius: 24, padding: 36, alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  settledTitle: { fontSize: 20, fontWeight: 'bold', color: '#166534', marginBottom: 8 },
  settledAmount: { fontSize: 48, fontWeight: 'bold', color: '#0f9d58', marginBottom: 8 },
  settledSub: { fontSize: 14, color: '#6b7280' },

  receiptCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  receiptTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  receiptSub: { fontSize: 12, color: '#9ca3af', marginBottom: 20, textAlign: 'center' },
  qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  tokenText: { fontSize: 11, color: '#9ca3af', marginBottom: 12 },
  pendingBadge: { backgroundColor: '#fef3e2', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  pendingBadgeText: { color: '#f29900', fontSize: 13, fontWeight: '700' },
  receiptInfo: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
});