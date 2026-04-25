import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ScrollView,
  StatusBar, Dimensions
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, Camera } from 'expo-camera';
import { saveToken, markTokenSettled, saveTransaction, markTransactionSynced } from '../storage/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL = 'http://10.10.10.100:3000';
const { height } = Dimensions.get('window');

// ─── Professional Icons ───────────────────────────────────────────────────────

function QRGenerateIcon({ size = 48, color = '#0f9d58' }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer frame corners */}
      <View style={{ width: s * 0.85, height: s * 0.85, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        {/* Top-left corner */}
        <View style={{ position: 'absolute', top: 0, left: 0, width: s * 0.3, height: s * 0.3, borderTopWidth: 3, borderLeftWidth: 3, borderColor: color, borderRadius: 2 }} />
        {/* Top-right corner */}
        <View style={{ position: 'absolute', top: 0, right: 0, width: s * 0.3, height: s * 0.3, borderTopWidth: 3, borderRightWidth: 3, borderColor: color, borderRadius: 2 }} />
        {/* Bottom-left corner */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, width: s * 0.3, height: s * 0.3, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: color, borderRadius: 2 }} />
        {/* Bottom-right corner */}
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: s * 0.3, height: s * 0.3, borderBottomWidth: 3, borderRightWidth: 3, borderColor: color, borderRadius: 2 }} />
        {/* Inner QR dots */}
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {[0,1,2].map(i => (
            <View key={i} style={{ flexDirection: 'column', gap: 3 }}>
              {[0,1,2].map(j => (
                <View key={j} style={{ width: s * 0.1, height: s * 0.1, backgroundColor: color, borderRadius: 1, opacity: (i === 1 && j === 1) ? 0.3 : 1 }} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ScanReceiptIcon({ size = 48, color = '#f29900' }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Phone outline */}
      <View style={{
        width: s * 0.5, height: s * 0.75,
        borderWidth: 2.5, borderColor: color,
        borderRadius: s * 0.08,
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Screen lines */}
        <View style={{ width: s * 0.28, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 4, opacity: 0.5 }} />
        <View style={{ width: s * 0.28, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 4, opacity: 0.5 }} />
        <View style={{ width: s * 0.2, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.5 }} />
        {/* Home button dot */}
        <View style={{ position: 'absolute', bottom: s * 0.04, width: s * 0.1, height: s * 0.1, borderRadius: s * 0.05, borderWidth: 1.5, borderColor: color }} />
      </View>
      {/* Scan beam */}
      <View style={{
        position: 'absolute',
        width: s * 0.6,
        height: 2.5,
        backgroundColor: color,
        borderRadius: 2,
        opacity: 0.8,
      }} />
      {/* Side arrows */}
      <View style={{ position: 'absolute', left: 0, top: '38%', width: 0, height: 0, borderTopWidth: 4, borderBottomWidth: 4, borderRightWidth: 6, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color }} />
      <View style={{ position: 'absolute', right: 0, top: '38%', width: 0, height: 0, borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 6, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color }} />
    </View>
  );
}

function ChevronIcon() {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#d1d5db', transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReceivePaymentScreen({ navigation, user }) {
  const [screen, setScreen] = useState('options');
  const [amount, setAmount] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState('');
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (screen === 'scanReceipt') askCameraPermission();
  }, [screen]);

  const askCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const generateQR = () => {
    if (!amount) { Alert.alert('Error', 'Please enter amount'); return; }
    setQrData(JSON.stringify({ merchantName: user.name, amount: parseFloat(amount), merchantId: user.id }));
    setShowQR(true);
  };

  const handleReceiptScanned = async ({ data }) => {
    if (scanned) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type !== 'payment_receipt') { Alert.alert('Invalid QR', 'Not a payment receipt QR'); return; }
      if (parsed.receiverId !== user.id) { Alert.alert('Wrong Payment', 'This payment is not for you!'); return; }
      setScanned(true);
      await saveToken({ token: parsed.token, type: 'received', senderId: parsed.senderId, senderName: parsed.senderName, receiverId: parsed.receiverId, receiverName: parsed.receiverName, amount: parsed.amount, createdAt: parsed.createdAt, status: 'pending' });
      await saveTransaction({ type: 'received', amount: parsed.amount, from: parsed.senderName, senderId: parsed.senderId, token: parsed.token, status: 'pending_sync' });
      try {
        const response = await fetch(`${SERVER_URL}/payment/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
        const result = await response.json();
        if (result.success) {
          await markTokenSettled(parsed.token);
          await markTransactionSynced(parsed.token);
          const walletRes = await fetch(`${SERVER_URL}/wallet/${user.id}`);
          const walletData = await walletRes.json();
          if (walletData.success) await AsyncStorage.setItem('wallet_balance', walletData.user.balance.toString());
          Alert.alert('Payment Received!', `₹${parsed.amount} from ${parsed.senderName}`, [{ text: 'OK', onPress: () => navigation.navigate('Home') }]);
          return;
        }
      } catch (e) {}
      Alert.alert('Token Saved!', `₹${parsed.amount} from ${parsed.senderName}\nWill settle when online.`, [{ text: 'OK', onPress: () => navigation.navigate('Home') }]);
    } catch { Alert.alert('Invalid QR', 'Could not read this QR code.'); }
  };

  // ── OPTIONS ──────────────────────────────────
  if (screen === 'options') {
    // Available body height after header (~220px header)
    const cardHeight = (height - 260) / 2 - 12;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f9d58" />

        {/* Green Header */}
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => navigation.goBack()}>
            <View style={styles.backArrow}>
              <View style={{ width: 8, height: 8, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: '#fff', transform: [{ rotate: '45deg' }] }} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receive Payment</Text>
          <Text style={styles.headerSubtitle}>Choose how to receive money</Text>
        </View>

        {/* Two Full Cards */}
        <View style={styles.cardsContainer}>

          {/* Card 1 — Generate QR */}
          <TouchableOpacity
            style={[styles.halfCard, { height: cardHeight }]}
            onPress={() => setScreen('generate')}
            activeOpacity={0.85}
          >
            <View style={[styles.cardIconCircle, { backgroundColor: '#e6f4ea' }]}>
              <QRGenerateIcon size={52} color="#0f9d58" />
            </View>
            <Text style={styles.cardTitle}>Generate QR Code</Text>
            <Text style={styles.cardSub}>Set an amount and show QR{'\n'}for customer to scan and pay</Text>
            <View style={[styles.cardChip, { backgroundColor: '#e6f4ea' }]}>
              <Text style={[styles.cardChipText, { color: '#0f9d58' }]}>Merchant Mode</Text>
            </View>
            <View style={styles.cardArrowCircle}>
              <View style={{ width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#0f9d58', transform: [{ rotate: '45deg' }] }} />
            </View>
          </TouchableOpacity>

          {/* Card 2 — Scan Receipt */}
          <TouchableOpacity
            style={[styles.halfCard, { height: cardHeight }]}
            onPress={() => setScreen('scanReceipt')}
            activeOpacity={0.85}
          >
            <View style={[styles.cardIconCircle, { backgroundColor: '#fef3e2' }]}>
              <ScanReceiptIcon size={52} color="#f29900" />
            </View>
            <Text style={styles.cardTitle}>Scan Payment QR</Text>
            <Text style={styles.cardSub}>Scan the QR shown on{'\n'}customer's phone to confirm</Text>
            <View style={[styles.cardChip, { backgroundColor: '#fef3e2' }]}>
              <Text style={[styles.cardChipText, { color: '#f29900' }]}>Scan & Confirm</Text>
            </View>
            <View style={styles.cardArrowCircle}>
              <View style={{ width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#f29900', transform: [{ rotate: '45deg' }] }} />
            </View>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    );
  }

  // ── GENERATE QR ──────────────────────────────
  if (screen === 'generate') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f9d58" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => { setScreen('options'); setShowQR(false); setAmount(''); }}>
            <View style={styles.backArrow}>
              <View style={{ width: 8, height: 8, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: '#fff', transform: [{ rotate: '45deg' }] }} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Generate QR Code</Text>
          <Text style={styles.headerSubtitle}>Enter amount and share QR with customer</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!showQR ? (
            <View style={styles.formCard}>
              <View style={[styles.cardIconCircle, { backgroundColor: '#e6f4ea', alignSelf: 'center', marginBottom: 20 }]}>
                <QRGenerateIcon size={52} color="#0f9d58" />
              </View>
              <Text style={styles.fieldLabel}>Amount to Receive (₹)</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#d1d5db"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#0f9d58' }]} onPress={generateQR}>
                <Text style={styles.primaryBtnText}>Generate QR Code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.qrCard}>
              <Text style={styles.qrMerchant}>{user.name}</Text>
              <Text style={styles.qrAmount}>₹{amount}</Text>
              <View style={styles.qrBox}>
                <QRCode value={qrData} size={220} />
              </View>
              <Text style={styles.qrHint}>Ask customer to scan this QR code</Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#0f9d58' }]} onPress={() => { setShowQR(false); setAmount(''); }}>
                <Text style={styles.primaryBtnText}>Generate New QR</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── SCAN RECEIPT ─────────────────────────────
  if (screen === 'scanReceipt') {
    if (hasPermission === null || hasPermission === false) {
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#f29900" />
          <View style={[styles.headerBlock, { backgroundColor: '#f29900' }]}>
            <TouchableOpacity style={styles.backIconBtn} onPress={() => setScreen('options')}>
              <View style={styles.backArrow}>
                <View style={{ width: 8, height: 8, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: '#fff', transform: [{ rotate: '45deg' }] }} />
              </View>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Payment QR</Text>
          </View>
          <View style={styles.centeredContent}>
            <Text style={styles.permText}>
              {hasPermission === null ? 'Requesting camera permission...' : '❌ Camera permission denied.'}
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#f29900" />
        <View style={[styles.headerBlock, { backgroundColor: '#f29900' }]}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => setScreen('options')}>
            <View style={styles.backArrow}>
              <View style={{ width: 8, height: 8, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: '#fff', transform: [{ rotate: '45deg' }] }} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Payment QR</Text>
          <Text style={styles.headerSubtitle}>Scan the QR shown on customer's phone</Text>
        </View>
        <View style={styles.cameraSection}>
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleReceiptScanned}
            />
            {/* Corner overlays */}
            <View style={styles.scanOverlay}>
              <View style={{ width: 220, height: 220, position: 'relative' }}>
                <View style={{ position: 'absolute', top: 0, left: 0, width: 32, height: 32, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#f29900', borderRadius: 3 }} />
                <View style={{ position: 'absolute', top: 0, right: 0, width: 32, height: 32, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#f29900', borderRadius: 3 }} />
                <View style={{ position: 'absolute', bottom: 0, left: 0, width: 32, height: 32, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#f29900', borderRadius: 3 }} />
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#f29900', borderRadius: 3 }} />
              </View>
            </View>
          </View>
          <Text style={styles.scanHint}>Align the QR code within the frame</Text>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  headerBlock: {
    backgroundColor: '#0f9d58',
    paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  backIconBtn: { marginBottom: 14 },
  backArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  // ── Two half-page cards ──
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 14,
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
  },
  cardIconCircle: {
    width: 90, height: 90, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  cardSub: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  cardChip: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, marginBottom: 8,
  },
  cardChipText: { fontSize: 12, fontWeight: '700' },
  cardArrowCircle: {
    position: 'absolute', bottom: 20, right: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f9fafb',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb',
  },

  // ── Form & QR ──
  scrollContent: { padding: 20 },
  formCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 4,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 10 },
  amountInput: {
    fontSize: 42, fontWeight: 'bold', color: '#111827',
    textAlign: 'center', paddingVertical: 12, marginBottom: 24,
    borderBottomWidth: 2, borderBottomColor: '#e5e7eb',
  },
  primaryBtn: {
    borderRadius: 14, padding: 17, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  qrCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  qrMerchant: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  qrAmount: { fontSize: 40, fontWeight: 'bold', color: '#0f9d58', marginBottom: 24 },
  qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  qrHint: { fontSize: 13, color: '#9ca3af', marginBottom: 24, textAlign: 'center' },

  // ── Camera ──
  cameraSection: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  cameraWrapper: { width: 300, height: 300, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  scanHint: { marginTop: 24, fontSize: 14, color: '#6b7280', fontWeight: '500' },

  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  permText: { fontSize: 16, color: '#374151', textAlign: 'center' },
});