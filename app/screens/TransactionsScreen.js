import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  SafeAreaView, TouchableOpacity, StatusBar
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllTokens } from '../storage/wallet';

const SERVER_URL = 'http://10.10.10.100:3000';

export default function TransactionsScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { loadTransactions(); }, []));

  const loadTransactions = async () => {
    setLoading(true);
    const userData = await AsyncStorage.getItem('user');
    if (!userData) return;
    const u = JSON.parse(userData);
    setUser(u);
    try {
      const response = await fetch(`${SERVER_URL}/ledger/${u.id}`);
      const data = await response.json();
      if (data.success && data.transactions.length > 0) {
        setTransactions(data.transactions); setLoading(false); return;
      }
    } catch (e) {}
    const tokens = await getAllTokens();
    setTransactions(tokens.map(t => ({
      id: t.token, sender_id: t.senderId, receiver_id: t.receiverId,
      sender_name: t.senderName, receiver_name: t.receiverName,
      amount: t.amount, status: t.status === 'settled' ? 'synced' : 'pending',
      created_at: t.createdAt, type: t.type,
    })).reverse());
    setLoading(false);
  };

  const renderItem = ({ item }) => {
    const isSender = item.sender_id === user?.id;
    const settled = item.status === 'synced';
    return (
      <View style={styles.txCard}>
        <View style={[styles.txIcon, { backgroundColor: isSender ? '#fee2e2' : '#e6f4ea' }]}>
          <Text style={{ fontSize: 20 }}>{isSender ? '📤' : '📥'}</Text>
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txType}>{isSender ? 'Sent' : 'Received'}</Text>
          <Text style={styles.txParty}>
            {isSender
              ? `To: ${item.receiver_name || item.receiver_id}`
              : `From: ${item.sender_name || item.sender_id}`}
          </Text>
          <Text style={styles.txDate}>{new Date(item.created_at).toLocaleString()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: settled ? '#e6f4ea' : '#fef3e2' }]}>
            <Text style={[styles.statusBadgeText, { color: settled ? '#0f9d58' : '#f29900' }]}>
              {settled ? '✅ Settled' : '⏳ Pending'}
            </Text>
          </View>
        </View>
        <Text style={[styles.txAmount, { color: isSender ? '#dc2626' : '#0f9d58' }]}>
          {isSender ? '-' : '+'}₹{item.amount}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
      <View style={styles.headerBlock}>
        <TouchableOpacity style={styles.backIconBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Text style={styles.headerSubtitle}>Your payment history</Text>
      </View>

      {loading ? (
        <View style={styles.centeredContent}>
          <Text style={styles.statusText}>Loading transactions...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centeredContent}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📭</Text>
          <Text style={styles.emptyTitle}>No Transactions Yet</Text>
          <Text style={styles.emptySubtitle}>Your payment history will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
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

  listContent: { padding: 20 },
  txCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  txIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  txInfo: { flex: 1 },
  txType: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  txParty: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  txDate: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  txAmount: { fontSize: 17, fontWeight: 'bold' },

  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  statusText: { fontSize: 15, color: '#9ca3af' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});