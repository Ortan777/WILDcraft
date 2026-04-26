# 💳 OfflinePay

> **A mobile payment application that works without internet — like digital cash.**

---

## 📖 What is OfflinePay?

OfflinePay is a **fintech prototype** that solves a real-world problem — making payments in areas with **no internet connectivity**. Inspired by the way UPI apps like GPay and PhonePe work, OfflinePay adds an offline-first layer where payments are stored locally as cryptographic tokens and synced to the server when internet becomes available.

Think of it as **digital cash** — the transaction happens immediately offline, and the actual money settles later when connectivity is restored.

---

## 🌟 Key Features

| Feature | Description |
|---|---|
| 📵 Offline Payments | Make and receive payments without internet |
| 📷 QR Code Payments | Scan merchant QR to pay instantly |
| 🔄 Two-Way QR Token | Sender shows receipt QR → merchant scans to store token |
| ⚡ Auto Sync | Tokens auto-settle when internet is available |
| 🏦 Bank Linking | Link bank account from Bank A or Bank B |
| 💰 Wallet Top Up | Transfer money from bank to wallet |
| 📤 Wallet Withdraw | Send money from wallet back to bank |
| 📋 Transaction History | View all payments with sync status |
| 🌐 Bank Dashboards | Admin web portals for each bank |

---

## 🏗️ Architecture

```
📱 OfflinePay App (React Native + Expo)
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
🖥️ OfflinePayServer                    🏦 Bank Servers
   Port 3000                           Bank A: Port 4000
   - User auth (OTP)                   Bank B: Port 5000
   - Payment tokens                    - Account verification
   - Token settlement                  - Bank linking
   - Ledger management                 - Top up / Withdraw
   - Wallet balances                   - Admin dashboards
```

---

## 💡 How Offline Payment Works

```
STEP 1 — OFFLINE PAYMENT:
┌─────────────────────────────────────────────────┐
│  Merchant opens app → Receive Payment           │
│  → Enters amount → QR code generated            │
│                                                 │
│  Customer scans merchant QR → Confirms payment  │
│  → Token generated (TKN_1234_ABCDEF)           │
│  → Balance deducted locally                     │
│  → Receipt QR appears on customer's phone       │
│                                                 │
│  Merchant scans customer's receipt QR           │
│  → Token stored on both phones locally          │
│  → Both show ⏳ Pending Settlement              │
└─────────────────────────────────────────────────┘

STEP 2 — WHEN INTERNET COMES BACK:
┌─────────────────────────────────────────────────┐
│  Either phone opens Home screen                 │
│  → App detects internet automatically           │
│  → Sends token to server                        │
│  → Server verifies (no duplicate tokens)        │
│  → Deducts from sender's DB balance             │
│  → Credits receiver's DB balance                │
│  → Ledger entry created                         │
│  → Both phones show ✅ Settled                  │
└─────────────────────────────────────────────────┘
```

---

# ⚡ NanoTrust
> **Your money, unplugged. The wallet that works where the internet doesn't.**

NanoTrust is an offline-first mobile payment solution built for innovation. It allows users to securely transact money peer-to-peer without needing an active internet or cellular connection, utilizing local cryptographic signing to guarantee security and prevent double-spending.

## 🛠️ Tech Stack

**Frontend (Android App)**
* **Language:** Kotlin
* **UI Framework:** Jetpack Compose
* **Networking:** Retrofit & OkHttp
* **Architecture:** Offline-first, local cryptographic signing

**Backend (Bank Server / Settlement Node)**
* **Language:** Python 3
* **Framework:** FastAPI
* **Server:** Uvicorn
* **Database:** Local JSON (Lightweight Hackathon DB)

---

## 📂 Folder Structure

```text
NanoTrust-Offline/
│
├── Android-App/                      # Frontend: NanoTrust Wallet
│   ├── app/src/main/java/.../
│   │   ├── MainActivity.kt           # Main Compose entry point
│   │   ├── ApiNetwork.kt             # Retrofit configuration 
│   │   ├── CryptoHelper.kt           # Cryptographic signing & nonces
│   │   └── screens/                  # Jetpack Compose UI screens
│   └── AndroidManifest.xml           # App config & network permissions
│
└── Backend-Server/                   # Backend: Mock Bank Integration
    ├── bank_server.py                # FastAPI server handling logic
    ├── bank_db.json                  # Auto-generated ledger 
    └── requirements.txt              # Python dependencies


```
## 🧪 Test Scenarios

### ✅ Test 1 — Online Payment
Both phones online + Server running
1. Phone 1 → Receive Payment → Enter ₹100 → Generate QR
2. Phone 2 → Scan & Pay → Scan QR → Pay Now
3. Expected: Instant settlement ✅


### 📵 Test 2 — Offline Payment (Server off)
Stop server → Phones still on WiFi
1. Make payment as above
2. Expected: "Payment Saved Offline!" ⏳
3. Restart server → Open app → Auto settles ✅

### 📵 Test 3 — No Internet on Phones
Server running + Turn off WiFi on both phones
1. Make payment
2. Expected: Token saved locally ⏳
3. Turn WiFi back on → Open app → Auto settles ✅




### 📵 Test 4 — Two-Way QR (Both offline)
Server off + Both phones WiFi off
1. Phone 1 → Receive Payment → Generate QR
2. Phone 2 → Scan QR → Pay → Receipt QR appears
3. Phone 1 → Receive Payment → Scan Customer QR
4. Token stored on both phones ⏳
5. Either phone goes online → Auto settles ✅


Token: TKN_1706123456789_AB3X7K2

Contains:
├── senderId      → Who paid
├── receiverId    → Who received
├── amount        → How much
├── createdAt     → When (timestamp)
└── status        → pending / settled


**Security features:**
- Each token is unique (timestamp + random string)
- Server rejects duplicate tokens (prevents double spending)
- Token stored on both sender and receiver phones
- Token marked as settled after server confirmation



## 🗺️ Roadmap

- [x] Offline QR payments
- [x] Two-way QR token exchange
- [x] Auto sync when online
- [x] Bank account linking (two banks)
- [x] Wallet top up and withdrawal
- [x] Bank admin dashboards
- [ ] UPI PIN for payments
- [ ] Push notifications
- [ ] Deploy servers to cloud
- [ ] Real SMS OTP integration
- [ ] PIN lock for app security
- [ ] Spending analytics dashboard


