import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  ScrollView, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BANKS = [
  { name: 'Bank A', url: 'http://10.10.10.100:4000', ifscPrefix: 'OFPAY0001', color: '#1a73e8', bg: '#e8f0fe' },
  { name: 'Bank B', url: 'http://10.10.10.100:5000', ifscPrefix: 'BNKB0001', color: '#0f9d58', bg: '#e6f4ea' },
];

const PageHeader = ({ title, subtitle, onBack }) => (
  <View style={styles.pageHeader}>
    {onBack && (
      <TouchableOpacity style={styles.backIconBtn} onPress={onBack}>
        <Text style={styles.backIconText}>←</Text>
      </TouchableOpacity>
    )}
    <View style={{ flex: 1 }}>
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  </View>
);

export default function LinkBankScreen({ navigation, user }) {
  const [step, setStep] = useState('selectBank');
  const [selectedBank, setSelectedBank] = useState(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedAccount, setVerifiedAccount] = useState(null);
  const [linkedAccount, setLinkedAccount] = useState(null);

  useEffect(() => { checkExistingLink(); }, []);

  const checkExistingLink = async () => {
    const saved = await AsyncStorage.getItem('linked_bank');
    if (saved) { setLinkedAccount(JSON.parse(saved)); setStep('linked'); }
  };

  const verifyAccount = async () => {
    if (accountNumber.length < 9) { Alert.alert('Error', 'Enter a valid account number'); return; }
    if (!ifscCode.trim()) { Alert.alert('Error', 'Enter IFSC code'); return; }
    setLoading(true);
    try {
      const response = await fetch(`${selectedBank.url}/bank/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, ifscCode: ifscCode.toUpperCase() }),
      });
      const data = await response.json();
      if (data.success) { setVerifiedAccount(data.account); setStep('confirm'); }
      else Alert.alert('Verification Failed', data.message);
    } catch (e) { Alert.alert('Error', `Cannot connect to ${selectedBank.name}`); }
    setLoading(false);
  };

  const linkAccount = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${selectedBank.url}/bank/link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, ifscCode: ifscCode.toUpperCase(), userId: user.id }),
      });
      const data = await response.json();
      if (data.success) {
        const accountData = { ...data.account, bankName: selectedBank.name, bankUrl: selectedBank.url };
        await AsyncStorage.setItem('linked_bank', JSON.stringify(accountData));
        setLinkedAccount(accountData);
        setStep('linked');
        Alert.alert('✅ Success', `${selectedBank.name} linked successfully!`);
      } else Alert.alert('Error', data.message);
    } catch (e) { Alert.alert('Error', `Cannot connect to ${selectedBank.name}`); }
    setLoading(false);
  };

  const unlinkAccount = async () => {
    Alert.alert('Unlink Account', 'Are you sure you want to unlink this bank?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('linked_bank');
          setLinkedAccount(null); setStep('selectBank');
        }
      }
    ]);
  };

  // ── SELECT BANK ──────────────────────────────
  if (step === 'selectBank') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Link Bank Account</Text>
          <Text style={styles.headerSubtitle}>Select your bank to get started</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>Available Banks</Text>
          {BANKS.map(bank => (
            <TouchableOpacity
              key={bank.name}
              style={styles.bankCard}
              onPress={() => { setSelectedBank(bank); setIfscCode(bank.ifscPrefix); setStep('form'); }}
            >
              <View style={[styles.bankIconCircle, { backgroundColor: bank.bg }]}>
                <Text style={{ fontSize: 22 }}>🏦</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bankCardName}>{bank.name}</Text>
                <Text style={styles.bankCardIfsc}>IFSC: {bank.ifscPrefix}</Text>
              </View>
              <Text style={[styles.bankCardArrow, { color: bank.color }]}>›</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>📋 Test Accounts</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoBank}>Bank A (OFPAY0001)</Text>
              <Text style={styles.infoItem}>1234567890 — Jeevi</Text>
              <Text style={styles.infoItem}>0987654321 — Merchant One</Text>
            </View>
            <View style={[styles.infoRow, { marginBottom: 0 }]}>
              <Text style={styles.infoBank}>Bank B (BNKB0001)</Text>
              <Text style={styles.infoItem}>2222333344 — Merchant One</Text>
              <Text style={styles.infoItem}>5555666677 — Demo User</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── FORM SCREEN ──────────────────────────────
  if (step === 'form') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => setStep('selectBank')}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedBank.name}</Text>
          <Text style={styles.headerSubtitle}>Enter your account details</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Account Number</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔢</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter account number"
                placeholderTextColor="#9ca3af"
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.fieldLabel}>IFSC Code</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🏷️</Text>
              <TextInput
                style={styles.input}
                placeholder={selectedBank.ifscPrefix}
                placeholderTextColor="#9ca3af"
                value={ifscCode}
                onChangeText={setIfscCode}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: selectedBank.color }]}
              onPress={verifyAccount}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Verify Account →</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── CONFIRM SCREEN ───────────────────────────
  if (step === 'confirm') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => setStep('form')}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Account</Text>
          <Text style={styles.headerSubtitle}>Review your account details</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.successBanner]}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successText}>Account Found!</Text>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank</Text>
              <Text style={styles.detailValue}>{selectedBank.name}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Holder</Text>
              <Text style={styles.detailValue}>{verifiedAccount?.holderName}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Number</Text>
              <Text style={styles.detailValue}>XXXX{accountNumber.slice(-4)}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>IFSC Code</Text>
              <Text style={styles.detailValue}>{ifscCode.toUpperCase()}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank Balance</Text>
              <Text style={[styles.detailValue, { color: '#0f9d58', fontSize: 18, fontWeight: 'bold' }]}>
                ₹{verifiedAccount?.balance}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: selectedBank.color }]}
            onPress={linkAccount}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Link This Account ✅</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── LINKED SCREEN ────────────────────────────
  if (step === 'linked') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
        <View style={styles.headerBlock}>
          <TouchableOpacity style={styles.backIconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Linked Bank</Text>
          <Text style={styles.headerSubtitle}>Your connected bank account</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.linkedHeroCard}>
            <View style={styles.linkedIconCircle}>
              <Text style={{ fontSize: 32 }}>🏦</Text>
            </View>
            <Text style={styles.linkedBankName}>{linkedAccount?.bankName}</Text>
            <Text style={styles.linkedHolder}>{linkedAccount?.holderName}</Text>
            <Text style={styles.linkedAccNo}>XXXX{linkedAccount?.accountNumber?.slice(-4)}</Text>
            <Text style={styles.linkedBalance}>₹{linkedAccount?.balance}</Text>
            <Text style={styles.linkedBalanceLabel}>Bank Balance</Text>
            <View style={styles.linkedStatusBadge}>
              <Text style={styles.linkedStatusText}>✅ Linked & Active</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#1a73e8' }]}
            onPress={() => navigation.navigate('TopUp')}
          >
            <Text style={styles.primaryBtnText}>💰 Top Up Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={unlinkAccount}>
            <Text style={styles.outlineBtnText}>🔗 Unlink Account</Text>
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
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  bankCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  bankIconCircle: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  bankCardName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  bankCardIfsc: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  bankCardArrow: { fontSize: 26, fontWeight: '300' },

  infoCard: {
    backgroundColor: '#f0fdf4', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#bbf7d0', marginTop: 8,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#166534', marginBottom: 12 },
  infoRow: { marginBottom: 10 },
  infoBank: { fontSize: 12, fontWeight: '700', color: '#166534', marginBottom: 4 },
  infoItem: { fontSize: 12, color: '#374151', marginBottom: 2 },

  formCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 4,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9fafb', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    paddingHorizontal: 14, marginBottom: 18,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#111827' },

  primaryBtn: {
    borderRadius: 14, padding: 16, alignItems: 'center',
    marginTop: 8, marginBottom: 12,
    shadowColor: '#1a73e8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  outlineBtn: {
    borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fff2f2',
  },
  outlineBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },

  successBanner: {
    backgroundColor: '#f0fdf4', borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  successIcon: { fontSize: 36, marginBottom: 8 },
  successText: { fontSize: 18, fontWeight: 'bold', color: '#166534' },

  detailCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 8,
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  detailLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  detailDivider: { height: 1, backgroundColor: '#f3f4f6' },

  linkedHeroCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 30,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#1a73e8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  linkedIconCircle: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#e8f0fe', alignItems: 'center',
    justifyContent: 'center', marginBottom: 16,
  },
  linkedBankName: { fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 8 },
  linkedHolder: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  linkedAccNo: { fontSize: 14, color: '#9ca3af', marginBottom: 16 },
  linkedBalance: { fontSize: 36, fontWeight: 'bold', color: '#1a73e8', marginBottom: 4 },
  linkedBalanceLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  linkedStatusBadge: {
    backgroundColor: '#e6f4ea', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20,
  },
  linkedStatusText: { color: '#0f9d58', fontSize: 13, fontWeight: '700' },

  // legacy kept for PageHeader (unused but harmless)
  pageHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  pageSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
});