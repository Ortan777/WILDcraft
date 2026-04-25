import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  ScrollView, StatusBar, Modal, Dimensions, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PAY_SERVER = 'http://10.10.10.100:3000';
const { width } = Dimensions.get('window');

// ─── Success / Failure Modal ──────────────────────────────────────────────────

function ResultModal({ visible, type, title, amount, subtitle, onDone }) {
  const isSuccess = type === 'success';
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={modal.overlay}>
        <View style={modal.sheet}>

          {/* Animated circle icon */}
          <View style={[modal.iconRing, { borderColor: isSuccess ? '#0f9d58' : '#dc2626' }]}>
            <View style={[modal.iconInner, { backgroundColor: isSuccess ? '#e6f4ea' : '#fee2e2' }]}>
              {isSuccess ? (
                // Checkmark drawn with Views
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', bottom: 10, left: 4, width: 13, height: 3, backgroundColor: '#0f9d58', borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
                  <View style={{ position: 'absolute', bottom: 8, right: 2, width: 22, height: 3, backgroundColor: '#0f9d58', borderRadius: 2, transform: [{ rotate: '-55deg' }] }} />
                </View>
              ) : (
                // X mark
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', width: 26, height: 3, backgroundColor: '#dc2626', borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
                  <View style={{ position: 'absolute', width: 26, height: 3, backgroundColor: '#dc2626', borderRadius: 2, transform: [{ rotate: '-45deg' }] }} />
                </View>
              )}
            </View>
          </View>

          {/* Text */}
          <Text style={[modal.title, { color: isSuccess ? '#0f9d58' : '#dc2626' }]}>{title}</Text>

          {amount ? (
            <Text style={modal.amount}>₹{amount}</Text>
          ) : null}

          <Text style={modal.subtitle}>{subtitle}</Text>

          {/* Divider */}
          <View style={modal.divider} />

          {/* Done button */}
          <TouchableOpacity
            style={[modal.doneBtn, { backgroundColor: isSuccess ? '#0f9d58' : '#dc2626' }]}
            onPress={onDone}
            activeOpacity={0.85}
          >
            <Text style={modal.doneBtnText}>Done</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ─── Professional Icons ───────────────────────────────────────────────────────

function WalletIcon({ color = '#1a73e8' }) {
  return (
    <View style={{ width: 22, height: 18, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 22, height: 14, backgroundColor: color, borderRadius: 4 }}>
        <View style={{ position: 'absolute', right: 4, top: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' }} />
        <View style={{ position: 'absolute', top: -4, left: 3, width: 8, height: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderWidth: 2, borderColor: color, backgroundColor: 'transparent' }} />
      </View>
    </View>
  );
}

function BankBuildingIcon({ color = '#0f9d58' }) {
  return (
    <View style={{ width: 22, height: 20, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[0,1,2].map(i => <View key={i} style={{ width: 4, height: 8, backgroundColor: color, borderRadius: 1 }} />)}
      </View>
      <View style={{ width: 20, height: 2.5, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

function ArrowIcon({ color = '#6b7280' }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', right: 2, width: 0, height: 0, borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 6, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color }} />
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TopUpScreen({ navigation, user }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [bankAccount, setBankAccount] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [mode, setMode] = useState('topup');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('success');   // 'success' | 'error'
  const [modalTitle, setModalTitle] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalSubtitle, setModalSubtitle] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('linked_bank');
      if (saved) {
        const bankData = JSON.parse(saved);
        const response = await fetch(`${bankData.bankUrl}/bank/account/${user.id}`);
        const data = await response.json();
        if (data.success) setBankAccount({ ...data.account, bankUrl: bankData.bankUrl });
      }
    } catch (e) {}
    try {
      const response = await fetch(`${PAY_SERVER}/wallet/${user.id}`);
      const data = await response.json();
      if (data.success) setWalletBalance(data.user.balance);
    } catch (e) {
      const local = await AsyncStorage.getItem('wallet_balance');
      setWalletBalance(local ? parseFloat(local) : 0);
    }
  };

  const showResult = (type, title, amt, subtitle) => {
    setModalType(type);
    setModalTitle(title);
    setModalAmount(amt);
    setModalSubtitle(subtitle);
    setModalVisible(true);
  };

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];
  const isTopup = mode === 'topup';

  const topUp = async () => {
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (!bankAccount) { Alert.alert('Error', 'No bank account linked!'); return; }
    setLoading(true);
    try {
      const bankRes = await fetch(`${bankAccount.bankUrl}/bank/topup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, accountNumber: bankAccount.accountNumber, ifscCode: bankAccount.ifscCode, amount: parseFloat(amount) }),
      });
      const bankData = await bankRes.json();
      if (!bankData.success) {
        showResult('error', 'Transfer Failed', '', bankData.message);
        setLoading(false); return;
      }
      const payRes = await fetch(`${PAY_SERVER}/wallet/topup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: parseFloat(amount) }),
      });
      const payData = await payRes.json();
      if (payData.success) {
        await AsyncStorage.setItem('wallet_balance', payData.newBalance.toString());
        setWalletBalance(payData.newBalance);
        showResult('success', 'Money Added!', amount, `Wallet balance: ₹${payData.newBalance}`);
        setAmount('');
      }
    } catch (e) {
      showResult('error', 'Connection Error', '', 'Cannot connect to server. Please try again.');
    }
    setLoading(false);
  };

  const withdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (!bankAccount) { Alert.alert('Error', 'No bank account linked!'); return; }
    if (parseFloat(amount) > walletBalance) {
      showResult('error', 'Insufficient Balance', '', `Available wallet balance: ₹${walletBalance}`);
      return;
    }
    setLoading(true);
    try {
      const payRes = await fetch(`${PAY_SERVER}/wallet/withdraw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: parseFloat(amount) }),
      });
      const payData = await payRes.json();
      if (!payData.success) {
        showResult('error', 'Transfer Failed', '', payData.message);
        setLoading(false); return;
      }
      const bankRes = await fetch(`${bankAccount.bankUrl}/bank/withdraw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, accountNumber: bankAccount.accountNumber, ifscCode: bankAccount.ifscCode, amount: parseFloat(amount) }),
      });
      const bankData = await bankRes.json();
      if (bankData.success) {
        await AsyncStorage.setItem('wallet_balance', payData.newBalance.toString());
        setWalletBalance(payData.newBalance);
        showResult('success', 'Sent to Bank!', amount, `Wallet balance: ₹${payData.newBalance}`);
        setAmount('');
      }
    } catch (e) {
      showResult('error', 'Connection Error', '', 'Cannot connect to server. Please try again.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />

      {/* Result Modal */}
      <ResultModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        amount={modalAmount}
        subtitle={modalSubtitle}
        onDone={() => { setModalVisible(false); loadData(); }}
      />

      {/* Header */}
      <View style={styles.headerBlock}>
        <TouchableOpacity style={styles.backIconBtn} onPress={() => navigation.goBack()}>
          <View style={{ width: 8, height: 8, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: '#fff', transform: [{ rotate: '45deg' }], marginLeft: 4 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet & Bank</Text>
        <Text style={styles.headerSubtitle}>Transfer money between wallet and bank</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Balance Row */}
        <View style={styles.balanceRow}>
          <View style={[styles.balanceBox, { borderColor: '#bfdbfe' }]}>
            <Text style={styles.balanceBoxLabel}>Wallet</Text>
            <Text style={[styles.balanceBoxAmount, { color: '#1a73e8' }]}>₹{walletBalance.toFixed(2)}</Text>
          </View>
          <View style={styles.arrowCircle}>
            <View style={{ width: 12, height: 2, backgroundColor: '#1a73e8', borderRadius: 1, marginBottom: 4 }} />
            <View style={{ width: 12, height: 2, backgroundColor: '#1a73e8', borderRadius: 1 }} />
          </View>
          <View style={[styles.balanceBox, { borderColor: '#bbf7d0' }]}>
            <Text style={styles.balanceBoxLabel}>Bank</Text>
            <Text style={[styles.balanceBoxAmount, { color: '#0f9d58' }]}>₹{bankAccount?.balance ?? 0}</Text>
          </View>
        </View>

        {!bankAccount ? (
          <View style={styles.noBankCard}>
            <View style={{ marginBottom: 16 }}><BankBuildingIcon color="#9ca3af" /></View>
            <Text style={styles.noBankTitle}>No Bank Account Linked</Text>
            <Text style={styles.noBankSub}>Link your bank to top up or withdraw</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('LinkBank')}>
              <Text style={styles.primaryBtnText}>Link Bank Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Bank info chip */}
            <View style={styles.bankChip}>
              <View style={{ marginRight: 10 }}><BankBuildingIcon color="#1a73e8" /></View>
              <Text style={styles.bankChipText}>
                {bankAccount.holderName} • XXXX{bankAccount.accountNumber?.slice(-4)}
              </Text>
            </View>

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, isTopup && styles.modeBtnActiveBlue]}
                onPress={() => setMode('topup')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BankBuildingIcon color={isTopup ? '#fff' : '#9ca3af'} />
                  <ArrowIcon color={isTopup ? '#fff' : '#9ca3af'} />
                  <WalletIcon color={isTopup ? '#fff' : '#9ca3af'} />
                </View>
                <Text style={[styles.modeBtnText, isTopup && styles.modeBtnTextActive]}>Bank → Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, !isTopup && styles.modeBtnActiveRed]}
                onPress={() => setMode('withdraw')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <WalletIcon color={!isTopup ? '#fff' : '#9ca3af'} />
                  <ArrowIcon color={!isTopup ? '#fff' : '#9ca3af'} />
                  <BankBuildingIcon color={!isTopup ? '#fff' : '#9ca3af'} />
                </View>
                <Text style={[styles.modeBtnText, !isTopup && styles.modeBtnTextActive]}>Wallet → Bank</Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.amountCard}>
              <Text style={styles.fieldLabel}>Enter Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.rupeeSign}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="#d1d5db"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.amountUnderline} />

              <Text style={styles.quickLabel}>Quick Select</Text>
              <View style={styles.quickGrid}>
                {quickAmounts.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.quickChip, amount === a.toString() && (isTopup ? styles.quickChipBlue : styles.quickChipRed)]}
                    onPress={() => setAmount(a.toString())}
                  >
                    <Text style={[styles.quickChipText, amount === a.toString() && styles.quickChipTextActive]}>
                      ₹{a}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: isTopup ? '#1a73e8' : '#dc2626' }]}
              onPress={isTopup ? topUp : withdraw}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {isTopup ? <WalletIcon color="#fff" /> : <BankBuildingIcon color="#fff" />}
                  <Text style={styles.primaryBtnText}>
                    {isTopup ? 'Add to Wallet' : 'Send to Bank'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  headerBlock: {
    backgroundColor: '#1a73e8',
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingHorizontal: 20, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  backIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  scrollContent: { padding: 20 },

  balanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  balanceBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  balanceBoxLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600', marginBottom: 4 },
  balanceBoxAmount: { fontSize: 20, fontWeight: 'bold' },
  arrowCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#e8f0fe', alignItems: 'center',
    justifyContent: 'center', marginHorizontal: 10,
  },

  bankChip: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb',
  },
  bankChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },

  modeToggle: {
    flexDirection: 'row', backgroundColor: '#f3f4f6',
    borderRadius: 16, padding: 4, marginBottom: 16,
  },
  modeBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 13, alignItems: 'center', gap: 4,
  },
  modeBtnActiveBlue: { backgroundColor: '#1a73e8' },
  modeBtnActiveRed: { backgroundColor: '#dc2626' },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  modeBtnTextActive: { color: '#fff' },

  amountCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af', marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupeeSign: { fontSize: 32, fontWeight: 'bold', color: '#111827', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 42, fontWeight: 'bold', color: '#111827', paddingVertical: 8 },
  amountUnderline: { height: 2, backgroundColor: '#e5e7eb', borderRadius: 1, marginBottom: 20 },

  quickLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#f9fafb',
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  quickChipBlue: { backgroundColor: '#e8f0fe', borderColor: '#1a73e8' },
  quickChipRed: { backgroundColor: '#fee2e2', borderColor: '#dc2626' },
  quickChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  quickChipTextActive: { color: '#1a73e8' },

  primaryBtn: {
    backgroundColor: '#1a73e8', borderRadius: 16,
    padding: 17, alignItems: 'center', marginBottom: 12,
    shadowColor: '#1a73e8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  noBankCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 32,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 4,
  },
  noBankTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  noBankSub: { fontSize: 13, color: '#9ca3af', marginBottom: 20, textAlign: 'center' },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  iconRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  iconInner: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 22, fontWeight: 'bold',
    marginBottom: 10, textAlign: 'center',
  },
  amount: {
    fontSize: 44, fontWeight: 'bold',
    color: '#111827', marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: '#6b7280',
    textAlign: 'center', lineHeight: 22,
    marginBottom: 24,
  },
  divider: {
    width: '100%', height: 1,
    backgroundColor: '#f3f4f6', marginBottom: 24,
  },
  doneBtn: {
    width: '100%', borderRadius: 16,
    padding: 17, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});