import AsyncStorage from '@react-native-async-storage/async-storage';

const WALLET_KEY = 'wallet_balance';
const TRANSACTIONS_KEY = 'transactions';
const USER_ID_KEY = 'user_id';
const TOKENS_KEY = 'payment_tokens';

// ─── BALANCE ───────────────────────────────────

export const getBalance = async () => {
  const balance = await AsyncStorage.getItem(WALLET_KEY);
  return balance !== null ? parseFloat(balance) : 1000.00;
};

export const saveBalance = async (amount) => {
  await AsyncStorage.setItem(WALLET_KEY, amount.toString());
};

export const deductBalance = async (amount) => {
  const current = await getBalance();
  if (current < amount) return { success: false, message: 'Insufficient balance' };
  const newBalance = current - amount;
  await saveBalance(newBalance);
  return { success: true, newBalance };
};

export const creditBalance = async (amount) => {
  const current = await getBalance();
  const newBalance = current + amount;
  await saveBalance(newBalance);
  return { success: true, newBalance };
};

// ─── TRANSACTIONS ──────────────────────────────

export const saveTransaction = async (transaction) => {
  const existing = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  const transactions = existing ? JSON.parse(existing) : [];
  transactions.push({ ...transaction, timestamp: new Date().toISOString() });
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
};

export const getTransactions = async () => {
  const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const markTransactionSynced = async (token) => {
  const existing = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  const transactions = existing ? JSON.parse(existing) : [];
  const updated = transactions.map(t =>
    t.token === token ? { ...t, status: 'synced' } : t
  );
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
};

// ─── USER ──────────────────────────────────────

export const saveUserId = async (userId) => {
  await AsyncStorage.setItem(USER_ID_KEY, userId);
};

export const getUserId = async () => {
  return await AsyncStorage.getItem(USER_ID_KEY);
};

// ─── TOKENS ────────────────────────────────────

// Generate a unique payment token
export const generateToken = () => {
  return 'TKN_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9).toUpperCase();
};

// Save a payment token locally
export const saveToken = async (tokenData) => {
  const existing = await AsyncStorage.getItem(TOKENS_KEY);
  const tokens = existing ? JSON.parse(existing) : [];
  tokens.push({ ...tokenData, savedAt: new Date().toISOString() });
  await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
};

// Get all unsettled tokens
export const getUnsettledTokens = async () => {
  const data = await AsyncStorage.getItem(TOKENS_KEY);
  const tokens = data ? JSON.parse(data) : [];
  return tokens.filter(t => t.status === 'pending');
};

// Mark token as settled
export const markTokenSettled = async (token) => {
  const data = await AsyncStorage.getItem(TOKENS_KEY);
  const tokens = data ? JSON.parse(data) : [];
  const updated = tokens.map(t =>
    t.token === token ? { ...t, status: 'settled' } : t
  );
  await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(updated));
};

// Get all tokens
export const getAllTokens = async () => {
  const data = await AsyncStorage.getItem(TOKENS_KEY);
  return data ? JSON.parse(data) : [];
};