import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL = 'http://10.10.10.100:3000';

export default function LoginScreen({ onLoginSuccess }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const sendOTP = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10 digit phone number');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your full name');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (data.success) {
        setStep('otp');
        Alert.alert('OTP Sent! 📱', `Your OTP is: ${data.otp}\n(This would come via SMS in production)`);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (e) {
      Alert.alert('Connection Error', 'Cannot connect to server. Make sure server is running!');
    }
    setLoading(false);
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6 digit OTP');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, name }),
      });
      const data = await response.json();
      if (data.success) {
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await AsyncStorage.setItem('user_id', data.user.id);
        await AsyncStorage.setItem('wallet_balance', data.user.balance.toString());
        onLoginSuccess(data.user);
      } else {
        Alert.alert('Invalid OTP', data.message);
      }
    } catch (e) {
      Alert.alert('Connection Error', 'Cannot connect to server!');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>OP</Text>
          </View>
          <Text style={styles.appName}>OfflinePay</Text>
          <Text style={styles.tagline}>Fast • Secure • Offline</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {step === 'phone' ? (
            <>
              <Text style={styles.cardTitle}>Welcome! 👋</Text>
              <Text style={styles.cardSubtitle}>Enter your details to get started</Text>

              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9ca3af"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.countryCode}>🇮🇳 +91</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10 digit mobile number"
                  placeholderTextColor="#9ca3af"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={sendOTP}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Send OTP →</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Verify OTP 🔐</Text>
              <Text style={styles.cardSubtitle}>Enter the 6-digit code sent to{'\n'}+91 {phone}</Text>

              <TextInput
                style={styles.otpInput}
                placeholder="● ● ● ● ● ●"
                placeholderTextColor="#9ca3af"
                value={otp}
                onChangeText={setOtp}
                keyboardType="numeric"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={verifyOTP}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Verify & Continue →</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => { setStep('phone'); setOtp(''); }}
              >
                <Text style={styles.backLinkText}>← Change mobile number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footer}>By continuing, you agree to our Terms & Privacy Policy</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a73e8' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff', alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  logoText: { fontSize: 28, fontWeight: 'bold', color: '#1a73e8' },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9fafb', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    paddingHorizontal: 14, marginBottom: 18,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  countryCode: { fontSize: 14, color: '#374151', marginRight: 10, fontWeight: '600' },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#111827' },
  otpInput: {
    backgroundColor: '#f9fafb', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#1a73e8',
    padding: 18, fontSize: 28, color: '#111827',
    textAlign: 'center', letterSpacing: 12,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 14,
    padding: 16, alignItems: 'center',
    shadowColor: '#1a73e8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { color: '#1a73e8', fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 },
}); 