import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, StatusBar, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUnsettledTokens, markTokenSettled, markTransactionSynced, saveBalance } from '../storage/wallet';

const SERVER_URL = 'http://10.10.10.100:3000';

export default function HomeScreen({ navigation, user, onLogout }) {
  const [balance, setBalance] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    const unsettled = await getUnsettledTokens();
    setPendingCount(unsettled.length);
    try {
      const response = await fetch(`${SERVER_URL}/wallet/${user.id}`);
      const data = await response.json();
      if (data.success) {
        setBalance(data.user.balance);
        await saveBalance(data.user.balance);
        if (unsettled.length > 0) settleTokens(unsettled);
      }
    } catch (e) {
      const local = await AsyncStorage.getItem('wallet_balance');
      setBalance(local ? parseFloat(local) : 0);
    }
  };

  const settleTokens = async (tokens) => {
    setSyncing(true);
    let settledCount = 0;
    for (const tokenData of tokens) {
      try {
        const response = await fetch(`${SERVER_URL}/payment/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: tokenData.token, senderId: tokenData.senderId,
            senderName: tokenData.senderName, receiverId: tokenData.receiverId,
            receiverName: tokenData.receiverName, amount: tokenData.amount,
            createdAt: tokenData.createdAt,
          }),
        });
        const result = await response.json();
        if (result.success) {
          await markTokenSettled(tokenData.token);
          await markTransactionSynced(tokenData.token);
          settledCount++;
        }
      } catch (e) {}
    }
    try {
      const response = await fetch(`${SERVER_URL}/wallet/${user.id}`);
      const data = await response.json();
      if (data.success) { setBalance(data.user.balance); await saveBalance(data.user.balance); }
    } catch (e) {}
    setSyncing(false);
    setPendingCount(0);
    if (settledCount > 0) Alert.alert('Synced', `${settledCount} payment(s) settled!`);
  };

  // ── Logout: does NOT clear AsyncStorage — parent (_layout.tsx) handles it ──
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => onLogout(),   // _layout.tsx preserves wallet/bank/txn data
        },
      ]
    );
  };

  const actions = [
    { label: 'Scan & Pay', bg: '#e8f0fe', screen: 'ScanQR',        icon: <ScanIcon /> },
    { label: 'Receive',    bg: '#e6f4ea', screen: 'ReceivePayment', icon: <ReceiveIcon /> },
    { label: 'Top Up',     bg: '#fef3e2', screen: 'TopUp',          icon: <TopUpIcon /> },
    { label: 'Bank',       bg: '#f3e8ff', screen: 'LinkBank',       icon: <BankIcon /> },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header + Balance */}
        <View style={styles.headerBlock}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Good day, {user.name.split(' ')[0]}!</Text>
              <Text style={styles.phone}>+91 {user.phone}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Wallet Balance</Text>
            <Text style={styles.balanceAmount}>
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
            <View style={styles.balanceFooter}>
              {syncing ? (
                <View style={styles.syncBadge}>
                  <View style={[styles.badgeDot, { backgroundColor: '#93c5fd' }]} />
                  <Text style={styles.syncBadgeText}>Syncing...</Text>
                </View>
              ) : pendingCount > 0 ? (
                <View style={[styles.syncBadge, { backgroundColor: 'rgba(251,191,36,0.25)' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: '#fbbf24' }]} />
                  <Text style={styles.syncBadgeText}>{pendingCount} pending</Text>
                </View>
              ) : (
                <View style={[styles.syncBadge, { backgroundColor: 'rgba(52,211,153,0.25)' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: '#34d399' }]} />
                  <Text style={styles.syncBadgeText}>All synced</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.screen}
                style={styles.actionButton}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: action.bg }]}>
                  {action.icon}
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* More Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Options</Text>
          <View style={styles.menuCard}>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Transactions')} activeOpacity={0.7}>
              <View style={[styles.menuIconBox, { backgroundColor: '#e8f0fe' }]}>
                <HistoryIcon />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>Transaction History</Text>
                <Text style={styles.menuSubtitle}>View all your payments</Text>
              </View>
              <ChevronIcon />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('LinkBank')} activeOpacity={0.7}>
              <View style={[styles.menuIconBox, { backgroundColor: '#f3e8ff' }]}>
                <BankMenuIcon />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>Linked Bank Account</Text>
                <Text style={styles.menuSubtitle}>Manage your bank</Text>
              </View>
              <ChevronIcon />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}>
                <LogoutIcon />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: '#dc2626' }]}>Logout</Text>
                <Text style={styles.menuSubtitle}>Sign out of your account</Text>
              </View>
              <ChevronIcon />
            </TouchableOpacity>

          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Professional Icon Components ────────────────────────────────────────────

function ScanIcon() {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 24, height: 24, position: 'relative' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, width: 8, height: 8, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderColor: '#1a73e8', borderRadius: 1 }} />
        <View style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderTopWidth: 2.5, borderRightWidth: 2.5, borderColor: '#1a73e8', borderRadius: 1 }} />
        <View style={{ position: 'absolute', bottom: 0, left: 0, width: 8, height: 8, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderColor: '#1a73e8', borderRadius: 1 }} />
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderColor: '#1a73e8', borderRadius: 1 }} />
        <View style={{ position: 'absolute', top: 10, left: 4,  width: 4, height: 4, backgroundColor: '#1a73e8', borderRadius: 1 }} />
        <View style={{ position: 'absolute', top: 10, left: 10, width: 4, height: 4, backgroundColor: '#1a73e8', borderRadius: 1 }} />
        <View style={{ position: 'absolute', top: 10, left: 16, width: 4, height: 4, backgroundColor: '#1a73e8', borderRadius: 1 }} />
      </View>
    </View>
  );
}

function ReceiveIcon() {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 2.5, height: 14, backgroundColor: '#0f9d58', borderRadius: 2, marginBottom: 1 }} />
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#0f9d58' }} />
      <View style={{ width: 18, height: 2.5, backgroundColor: '#0f9d58', borderRadius: 2, marginTop: 2 }} />
    </View>
  );
}

function TopUpIcon() {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 22, height: 14, backgroundColor: '#f29900', borderRadius: 4, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 3 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff', opacity: 0.9 }} />
      </View>
      <View style={{ position: 'absolute', top: 0, right: 3, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#fff' }} />
    </View>
  );
}

function BankIcon() {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#7c3aed' }} />
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 1 }}>
        {[0,1,2].map(i => <View key={i} style={{ width: 4, height: 9, backgroundColor: '#7c3aed', borderRadius: 1 }} />)}
      </View>
      <View style={{ width: 22, height: 2.5, backgroundColor: '#7c3aed', borderRadius: 1, marginTop: 1 }} />
    </View>
  );
}

function HistoryIcon() {
  return (
    <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: '#1a73e8', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 2, height: 6, backgroundColor: '#1a73e8', borderRadius: 1, bottom: '50%', left: '50%', marginLeft: -1 }} />
        <View style={{ position: 'absolute', width: 2, height: 5, backgroundColor: '#1a73e8', borderRadius: 1, top: '50%', left: '50%', marginTop: -1, transform: [{ rotate: '60deg' }] }} />
      </View>
    </View>
  );
}

function BankMenuIcon() {
  return (
    <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#7c3aed' }} />
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 1 }}>
        {[0,1,2].map(i => <View key={i} style={{ width: 4, height: 8, backgroundColor: '#7c3aed', borderRadius: 1 }} />)}
      </View>
      <View style={{ width: 20, height: 2.5, backgroundColor: '#7c3aed', borderRadius: 1, marginTop: 1 }} />
    </View>
  );
}

function LogoutIcon() {
  return (
    <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 14, height: 18, borderWidth: 2.5, borderColor: '#dc2626', borderRadius: 2, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 2 }}>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#dc2626' }} />
      </View>
      <View style={{ position: 'absolute', right: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 7, height: 2, backgroundColor: '#dc2626', borderRadius: 1 }} />
        <View style={{ width: 0, height: 0, borderTopWidth: 3.5, borderBottomWidth: 3.5, borderLeftWidth: 4, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#dc2626' }} />
      </View>
    </View>
  );
}

function ChevronIcon() {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 7, height: 7, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#d1d5db', transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a73e8',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
  },
  headerBlock: {
    backgroundColor: '#1a73e8',
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  phone: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, marginLeft: 12,
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, padding: 22,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 6 },
  balanceAmount: { color: '#fff', fontSize: 38, fontWeight: 'bold', marginBottom: 14 },
  balanceFooter: { flexDirection: 'row' },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  syncBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  section: { paddingHorizontal: 20, marginTop: 24, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  actionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { alignItems: 'center', width: '22%' },
  actionIconBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 4,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuIconBox: {
    width: 46, height: 46, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  menuSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 76 },
});