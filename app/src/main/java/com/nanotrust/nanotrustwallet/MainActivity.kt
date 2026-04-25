package com.nanotrust.nanotrustwallet

import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.security.KeyPair
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {

    private val keyPair: KeyPair by lazy { CryptoHelper.getOrCreateKeyPair(this) }
    private var onScanResult: ((receiverId: String) -> Unit)? = null
    private var resumeCounter = mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!UserPrefs.isLoggedIn(this)) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish(); return
        }
        renderContent()
    }

    override fun onResume() {
        super.onResume()
        resumeCounter.value++
    }

    private fun renderContent() {
        setContent {
            val resumeTick by resumeCounter
            WalletApp(
                resumeTick       = resumeTick,
                keyPair          = keyPair,
                onPayRequest     = {
                    startActivityForResult(Intent(this, ScanReceiverActivity::class.java), 101)
                },
                onReceiveRequest = { startActivity(Intent(this, ReceiveActivity::class.java)) },
                onShowProof      = { qrData ->
                    startActivity(Intent(this, ShowProofActivity::class.java).apply {
                        putExtra("qr_data", qrData)
                    })
                },
                onLinkBank  = { startActivity(Intent(this, LinkBankActivity::class.java)) },
                onTopUp     = { startActivity(Intent(this, TopUpActivity::class.java)) },
                onWithdraw  = { startActivity(Intent(this, WithdrawActivity::class.java)) },
                onLogout    = {
                    UserPrefs.logout(this)
                    startActivity(Intent(this, LoginActivity::class.java))
                    finish()
                },
                isOnline           = { isOnline() },
                setScanResultHandler = { handler -> onScanResult = handler }
            )
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 101 && resultCode == RESULT_OK) {
            val receiverId = data?.getStringExtra("receiver_id") ?: return
            onScanResult?.invoke(receiverId)
        }
    }

    private fun isOnline(): Boolean {
        return try {
            val cm      = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return false
            val caps    = cm.getNetworkCapabilities(network) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (e: Exception) {
            false
        }
    }
}

// ── Helper to get only REAL outgoing pending IOUs ─────────────────────────────
// Excludes: iou_rx_ (received), anything with key not starting with "iou_"
private fun getRealPending(context: android.content.Context): Map<String, String> {
    return UserPrefs.getAllPendingIous(context).filter { (key, _) ->
        key.startsWith("iou_") && !key.startsWith("iou_rx_")
    }
}

@Composable
fun WalletApp(
    resumeTick: Int,
    keyPair: KeyPair,
    onPayRequest: () -> Unit,
    onReceiveRequest: () -> Unit,
    onShowProof: (String) -> Unit,
    onLinkBank: () -> Unit,
    onTopUp: () -> Unit,
    onWithdraw: () -> Unit,
    onLogout: () -> Unit,
    isOnline: () -> Boolean,
    setScanResultHandler: ((String) -> Unit) -> Unit
) {
    val gson    = remember { Gson() }
    val client  = remember { OkHttpClient() }
    val context = LocalContext.current

    val username = remember(resumeTick) { UserPrefs.getUsername(context) }
    val userId   = remember(resumeTick) { UserPrefs.getUserId(context) }
    val bankName = remember(resumeTick) { UserPrefs.getBankName(context) }

    var offlineBalance by remember { mutableDoubleStateOf(0.0) }
    var statusText     by remember { mutableStateOf("") }
    var hasPending     by remember { mutableStateOf(false) }
    var isSyncing      by remember { mutableStateOf(false) }
    var online         by remember { mutableStateOf(false) }
    var selectedTab    by remember { mutableStateOf(0) }

    var pendingReceiverId  by remember { mutableStateOf<String?>(null) }
    var showAmountDialog   by remember { mutableStateOf(false) }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var pendingAmount      by remember { mutableDoubleStateOf(0.0) }
    var amountInput        by remember { mutableStateOf("") }
    var passwordInput      by remember { mutableStateOf("") }
    var passwordError      by remember { mutableStateOf("") }
    var amountError        by remember { mutableStateOf("") }

    LaunchedEffect(resumeTick) {
        offlineBalance = UserPrefs.getOfflineBalance(context)
        // ✅ FIX: only count real outgoing IOUs
        hasPending = getRealPending(context).isNotEmpty()
        online     = isOnline()
    }

    LaunchedEffect(resumeTick) {
        while (true) {
            online = isOnline()
            kotlinx.coroutines.delay(5000)
        }
    }

    fun refreshState() {
        offlineBalance = UserPrefs.getOfflineBalance(context)
        hasPending     = getRealPending(context).isNotEmpty()
    }

    fun syncPendingIous() {
        val pending = getRealPending(context)
        if (pending.isEmpty()) { statusText = "Nothing to sync"; return }

        val bankUrl = UserPrefs.getBankUrl(context)
        if (bankUrl.isEmpty()) { statusText = "No bank linked"; return }

        isSyncing  = true
        statusText = "Syncing ${pending.size} transaction(s)..."
        var doneCount = 0

        pending.forEach { (key, iouJson) ->
            val nonce = key.removePrefix("iou_")
            try {
                val raw     = gson.fromJson(iouJson, Map::class.java)
                val payload = raw["payload"] as? Map<*, *> ?: run { doneCount++; return@forEach }
                val amount     = (payload["amount"] as? Double) ?: 0.0
                val receiverId = (payload["receiver"] as? String) ?: ""
                val sig        = (raw["signature"] as? String) ?: ""

                val body = gson.toJson(mapOf(
                    "user_id"     to userId,
                    "receiver_id" to receiverId,
                    "amount"      to amount,
                    "nonce"       to nonce,
                    "signature"   to sig
                )).toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url("$bankUrl/bank/settle")
                    .post(body)
                    .build()

                client.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        isSyncing  = false
                        statusText = "Sync failed — check connection"
                    }
                    override fun onResponse(call: Call, response: Response) {
                        doneCount++
                        if (response.isSuccessful) {
                            UserPrefs.removePendingIou(context, nonce)
                            val respBody = response.body?.string()
                            if (respBody != null) {
                                try {
                                    val data = gson.fromJson(respBody, Map::class.java)
                                    val serverBal = data["offline_balance"] as? Double
                                    if (serverBal != null) {
                                        UserPrefs.setOfflineBalance(context, serverBal)
                                        offlineBalance = serverBal
                                    }
                                } catch (e: Exception) { /* ignore */ }
                            }
                        } else {
                            statusText = "Sync error: ${response.body?.string()}"
                        }
                        if (doneCount == pending.size) {
                            isSyncing  = false
                            hasPending = getRealPending(context).isNotEmpty()
                            statusText = if (!hasPending) "✅ All synced!" else "⚠️ Some failed"
                        }
                    }
                })
            } catch (e: Exception) { doneCount++ }
        }
    }

    fun doPayment(receiverId: String, amount: Double) {
        UserPrefs.deductOfflineBalance(context, amount)
        offlineBalance = UserPrefs.getOfflineBalance(context)

        val nonce   = UUID.randomUUID().toString()
        val payload = mapOf(
            "sender"   to userId,
            "receiver" to receiverId,
            "amount"   to amount,
            "nonce"    to nonce
        )
        val payloadJson = gson.toJson(payload)
        val signature   = CryptoHelper.signData(payloadJson, keyPair.private)
        val qrData      = gson.toJson(mapOf(
            "type"      to "payment_proof",
            "payload"   to payload,
            "signature" to signature
        ))

        // Save as pending IOU with key "iou_<nonce>"
        UserPrefs.savePendingIou(context, nonce, qrData)
        UserPrefs.saveTransaction(context, "sent", amount, receiverId)
        hasPending = true

        onShowProof(qrData)
    }

    DisposableEffect(Unit) {
        setScanResultHandler { receiverId ->
            pendingReceiverId = receiverId
            showAmountDialog  = true
        }
        onDispose {}
    }

    // ── Amount Dialog ─────────────────────────────────────────────────────────
    if (showAmountDialog && pendingReceiverId != null) {
        AlertDialog(
            onDismissRequest = {
                showAmountDialog  = false
                amountInput       = ""
                pendingReceiverId = null
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(20.dp),
            title = {
                Text("Enter Amount", fontWeight = FontWeight.Bold, color = Color(0xFF111827))
            },
            text = {
                Column {
                    Text("To: $pendingReceiverId", color = Color(0xFF6B7280), fontSize = 13.sp)
                    Text("Balance: ₹$offlineBalance", color = Color(0xFF6B7280), fontSize = 13.sp)
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = amountInput,
                        onValueChange = { amountInput = it; amountError = "" },
                        label = { Text("Amount (₹)") },
                        singleLine = true,
                        isError = amountError.isNotEmpty(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    if (amountError.isNotEmpty()) {
                        Text(amountError, color = Color(0xFFDC2626), fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amt = amountInput.toDoubleOrNull()
                        when {
                            amt == null || amt <= 0 -> amountError = "Enter a valid amount"
                            amt > offlineBalance    -> amountError = "Insufficient! You have ₹$offlineBalance"
                            else -> {
                                pendingAmount     = amt
                                showAmountDialog  = false
                                showPasswordDialog = true
                                amountInput       = ""
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                    shape  = RoundedCornerShape(10.dp)
                ) { Text("Next") }
            },
            dismissButton = {
                TextButton(onClick = {
                    showAmountDialog  = false
                    amountInput       = ""
                    pendingReceiverId = null
                }) { Text("Cancel", color = Color(0xFF6B7280)) }
            }
        )
    }

    // ── Password Dialog ───────────────────────────────────────────────────────
    if (showPasswordDialog && pendingReceiverId != null) {
        AlertDialog(
            onDismissRequest = {
                showPasswordDialog = false
                passwordInput     = ""
                pendingReceiverId = null
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(20.dp),
            title = {
                Text("Confirm Payment", fontWeight = FontWeight.Bold, color = Color(0xFF111827))
            },
            text = {
                Column {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFEFF6FF))
                            .padding(12.dp)
                    ) {
                        Column {
                            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                                Text("Amount", color = Color(0xFF6B7280), fontSize = 13.sp)
                                Text("₹$pendingAmount", fontWeight = FontWeight.Bold,
                                    color = Color(0xFF111827), fontSize = 16.sp)
                            }
                            Spacer(Modifier.height(4.dp))
                            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                                Text("To", color = Color(0xFF6B7280), fontSize = 13.sp)
                                Text(pendingReceiverId ?: "", color = Color(0xFF111827), fontSize = 13.sp)
                            }
                            Spacer(Modifier.height(4.dp))
                            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                                Text("After payment", color = Color(0xFF6B7280), fontSize = 13.sp)
                                Text("₹${offlineBalance - pendingAmount}",
                                    color = Color(0xFF16A34A), fontSize = 13.sp)
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = passwordInput,
                        onValueChange = { passwordInput = it; passwordError = "" },
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        isError = passwordError.isNotEmpty(),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (passwordError.isNotEmpty()) {
                        Text(passwordError, color = Color(0xFFDC2626), fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (passwordInput == UserPrefs.getPassword(context)) {
                            val rid = pendingReceiverId!!
                            showPasswordDialog = false
                            passwordInput     = ""
                            passwordError     = ""
                            pendingReceiverId = null
                            doPayment(rid, pendingAmount)
                        } else {
                            passwordError = "Wrong password"
                            passwordInput = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                    shape  = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Pay ₹$pendingAmount", fontWeight = FontWeight.Bold) }
            },
            dismissButton = null
        )
    }

    Scaffold(
        containerColor = Color(0xFF2563EB),
        bottomBar = {
            NavigationBar(
                containerColor = Color.White,
                tonalElevation = 8.dp
            ) {
                listOf(
                    Triple("Home",    Icons.Filled.Home,                 0),
                    Triple("Balance", Icons.Filled.AccountBalanceWallet, 1),
                    Triple("History", Icons.Filled.History,              2),
                    Triple("About",   Icons.Filled.Info,                 3)
                ).forEach { (label, icon, index) ->
                    NavigationBarItem(
                        selected = selectedTab == index,
                        onClick  = { selectedTab = index },
                        icon     = { Icon(icon, label, modifier = Modifier.size(24.dp)) },
                        label    = { Text(label, fontSize = 11.sp) },
                        colors   = NavigationBarItemDefaults.colors(
                            selectedIconColor   = Color(0xFF2563EB),
                            selectedTextColor   = Color(0xFF2563EB),
                            unselectedIconColor = Color(0xFF9CA3AF),
                            unselectedTextColor = Color(0xFF9CA3AF),
                            indicatorColor      = Color(0xFFEFF6FF)
                        )
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            when (selectedTab) {
                0 -> HomeTab(
                    username         = username,
                    bankName         = bankName,
                    offlineBalance   = offlineBalance,
                    online           = online,
                    hasPending       = hasPending,
                    isSyncing        = isSyncing,
                    statusText       = statusText,
                    context          = context,
                    onPayRequest     = onPayRequest,
                    onReceiveRequest = onReceiveRequest,
                    onTopUp          = onTopUp,
                    onLinkBank       = onLinkBank,
                    onLogout         = onLogout,
                    onSync           = { syncPendingIous() },
                    onCancelPayment  = { nonce, amount ->
                        UserPrefs.removePendingIou(context, nonce)
                        UserPrefs.addOfflineBalance(context, amount)
                        offlineBalance = UserPrefs.getOfflineBalance(context)
                        hasPending     = getRealPending(context).isNotEmpty()
                    }
                )
                1 -> BalanceTab(
                    userId  = userId,
                    bankUrl = UserPrefs.getBankUrl(context),
                    client  = client,
                    gson    = gson
                )
                2 -> HistoryTab(context = context)
                3 -> AboutTab()
            }
        }
    }
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
@Composable
fun HomeTab(
    username: String,
    bankName: String,
    offlineBalance: Double,
    online: Boolean,
    hasPending: Boolean,
    isSyncing: Boolean,
    statusText: String,
    context: android.content.Context,
    onPayRequest: () -> Unit,
    onReceiveRequest: () -> Unit,
    onTopUp: () -> Unit,
    onLinkBank: () -> Unit,
    onLogout: () -> Unit,
    onSync: () -> Unit,
    onCancelPayment: (nonce: String, amount: Double) -> Unit
) {
    // ✅ FIX: Only show real outgoing IOUs — never rx_ or merchant stubs
    val pendingIous = getRealPending(context)

    Column(modifier = Modifier.fillMaxSize()) {

        // Blue Header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF2563EB))
                .padding(start = 20.dp, end = 20.dp, top = 24.dp, bottom = 28.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "Good day, $username!",
                            color = Color.White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            if (bankName.isEmpty()) "No bank linked" else bankName,
                            color = Color(0xFFBFDBFE),
                            fontSize = 13.sp
                        )
                    }
                    TextButton(
                        onClick = onLogout,
                        colors  = ButtonDefaults.textButtonColors(contentColor = Color.White),
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color(0x33FFFFFF))
                    ) { Text("Logout", fontSize = 12.sp) }
                }

                Spacer(Modifier.height(20.dp))

                // Balance card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0x33FFFFFF))
                        .padding(20.dp)
                ) {
                    Column {
                        Text("Offline Wallet Balance", color = Color(0xFFBFDBFE), fontSize = 13.sp)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "₹${String.format("%,.2f", offlineBalance)}",
                            color = Color.White,
                            fontSize = 34.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(
                                        if (pendingIous.isEmpty()) Color(0xFF16A34A)
                                        else Color(0xFFF59E0B)
                                    )
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(Color.White)
                                    )
                                    Spacer(Modifier.width(5.dp))
                                    Text(
                                        if (pendingIous.isEmpty()) "All synced"
                                        else "${pendingIous.size} pending",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                            if (online && pendingIous.isNotEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(20.dp))
                                        .background(Color(0x33FFFFFF))
                                        .clickable { onSync() }
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        if (isSyncing) "Syncing..." else "Tap to sync",
                                        color = Color.White,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))

                Text("Quick Actions", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(Modifier.height(14.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    QuickActionButton("Scan & Pay", Icons.Filled.QrCodeScanner,
                        Color(0x33FFFFFF), Color.White, Color(0xFFBFDBFE)) { onPayRequest() }
                    QuickActionButton("Receive", Icons.Filled.QrCode,
                        Color(0x33FFFFFF), Color.White, Color(0xFFBFDBFE)) { onReceiveRequest() }
                    QuickActionButton("Top Up", Icons.Filled.AccountBalanceWallet,
                        Color(0x33FFFFFF), Color.White, Color(0xFFBFDBFE)) { onTopUp() }
                    QuickActionButton("Bank", Icons.Filled.AccountBalance,
                        Color(0x33FFFFFF), Color.White, Color(0xFFBFDBFE)) { onLinkBank() }
                }
            }
        }

        // White content
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF5F7FA)),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (statusText.isNotEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFEFF6FF))
                            .padding(12.dp)
                    ) { Text(statusText, color = Color(0xFF2563EB), fontSize = 13.sp) }
                }
            }

            item {
                Text("More Options", fontWeight = FontWeight.Bold, fontSize = 16.sp,
                    color = Color(0xFF111827))
                Spacer(Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(16.dp))
                ) {
                    Column {
                        MoreOptionRow(
                            title     = "Linked Bank Account",
                            subtitle  = "Manage your bank",
                            icon      = Icons.Filled.AccountBalance,
                            iconBg    = Color(0xFFF5F3FF),
                            iconColor = Color(0xFF7C3AED)
                        ) { onLinkBank() }
                        HorizontalDivider(color = Color(0xFFF3F4F6), thickness = 1.dp)
                        MoreOptionRow(
                            title     = "Logout",
                            subtitle  = "Sign out of your account",
                            icon      = Icons.Filled.Logout,
                            iconBg    = Color(0xFFFEF2F2),
                            iconColor = Color(0xFFDC2626),
                            isRed     = true
                        ) { onLogout() }
                    }
                }
            }

            // ✅ Pending transactions with Cancel button per row
            if (pendingIous.isNotEmpty()) {
                item {
                    Text("Pending Transactions", fontWeight = FontWeight.Bold,
                        fontSize = 16.sp, color = Color(0xFF111827))
                }
                items(pendingIous.entries.toList()) { (key, iouJson) ->
                    val raw      = runCatching { Gson().fromJson(iouJson, Map::class.java) }.getOrNull()
                    val payload  = raw?.get("payload") as? Map<*, *>
                    val receiver = payload?.get("receiver") as? String ?: "Unknown"
                    val amount   = (payload?.get("amount") as? Double) ?: 0.0
                    val nonce    = key.removePrefix("iou_")

                    if (raw != null) {
                        TransactionRow(
                            receiver        = receiver,
                            amount          = amount,
                            onCancel        = { onCancelPayment(nonce, amount) }
                        )
                    }
                }
            } else {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(16.dp))
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.CheckCircle, null,
                                tint = Color(0xFF16A34A), modifier = Modifier.size(36.dp))
                            Spacer(Modifier.height(8.dp))
                            Text("All transactions synced", color = Color(0xFF6B7280), fontSize = 14.sp)
                        }
                    }
                }
            }
        }
    }
}

// ── History Tab ───────────────────────────────────────────────────────────────
@Composable
fun HistoryTab(context: android.content.Context) {
    val transactions = remember { UserPrefs.getTransactions(context) }
    val fmt = remember { SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()) }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF5F7FA))) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF2563EB))
                .padding(horizontal = 20.dp, vertical = 24.dp)
        ) {
            Column {
                Text("Transaction History", color = Color.White, fontSize = 22.sp,
                    fontWeight = FontWeight.Bold)
                Text("Your last 20 transactions", color = Color(0xFFBFDBFE), fontSize = 13.sp)
            }
        }

        if (transactions.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Filled.History, null, tint = Color(0xFF9CA3AF),
                        modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("No transactions yet", color = Color(0xFF9CA3AF), fontSize = 15.sp)
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(transactions) { tx ->
                    val (icon, iconBg, iconColor, amountColor, prefix) = when (tx.type) {
                        "sent"     -> listOf(Icons.Filled.ArrowUpward,   Color(0xFFFEF2F2), Color(0xFFDC2626), Color(0xFFDC2626), "-")
                        "received" -> listOf(Icons.Filled.ArrowDownward, Color(0xFFECFDF5), Color(0xFF16A34A), Color(0xFF16A34A), "+")
                        "topup"    -> listOf(Icons.Filled.AddCircle,     Color(0xFFEFF6FF), Color(0xFF2563EB), Color(0xFF2563EB), "+")
                        else       -> listOf(Icons.Filled.AccountBalance, Color(0xFFF5F3FF), Color(0xFF7C3AED), Color(0xFF7C3AED), "-")
                    }
                    @Suppress("UNCHECKED_CAST")
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                            .padding(14.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(iconBg as Color),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(icon as ImageVector, null, tint = iconColor as Color,
                                    modifier = Modifier.size(20.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    when (tx.type) {
                                        "sent"     -> "Paid to ${tx.party}"
                                        "received" -> "Received from ${tx.party}"
                                        "topup"    -> "Top Up from Bank"
                                        else       -> "Withdrawn to Bank"
                                    },
                                    fontWeight = FontWeight.Medium,
                                    fontSize   = 14.sp,
                                    color      = Color(0xFF111827)
                                )
                                Text(
                                    fmt.format(Date(tx.timestamp)),
                                    fontSize = 12.sp,
                                    color    = Color(0xFF9CA3AF)
                                )
                            }
                            Text(
                                "${prefix as String}₹${tx.amount}",
                                color      = amountColor as Color,
                                fontWeight = FontWeight.Bold,
                                fontSize   = 15.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Balance Tab ───────────────────────────────────────────────────────────────
@Composable
fun BalanceTab(userId: String, bankUrl: String, client: OkHttpClient, gson: Gson) {
    var pinInput       by remember { mutableStateOf("") }
    var mainBalance    by remember { mutableStateOf<Double?>(null) }
    var offlineBalance by remember { mutableStateOf<Double?>(null) }
    var statusText     by remember { mutableStateOf("") }
    var isLoading      by remember { mutableStateOf(false) }
    var lastUpdated    by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF5F7FA))) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF2563EB))
                .padding(horizontal = 20.dp, vertical = 24.dp)
        ) {
            Column {
                Text("Check Balance", color = Color.White, fontSize = 22.sp,
                    fontWeight = FontWeight.Bold)
                Text("Enter UPI PIN to view bank balance", color = Color(0xFFBFDBFE), fontSize = 13.sp)
            }
        }

        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (mainBalance != null) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .border(2.dp, Color(0xFF2563EB), RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .padding(16.dp)
                    ) {
                        Column {
                            Text("Main Balance", color = Color(0xFF6B7280), fontSize = 12.sp)
                            Spacer(Modifier.height(4.dp))
                            Text("₹${String.format("%,.2f", mainBalance)}",
                                color = Color(0xFF2563EB), fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .border(2.dp, Color(0xFF16A34A), RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .padding(16.dp)
                    ) {
                        Column {
                            Text("Offline Wallet", color = Color(0xFF6B7280), fontSize = 12.sp)
                            Spacer(Modifier.height(4.dp))
                            Text("₹${String.format("%,.2f", offlineBalance)}",
                                color = Color(0xFF16A34A), fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                if (lastUpdated.isNotEmpty()) {
                    Text("Last updated: $lastUpdated", color = Color(0xFF9CA3AF), fontSize = 11.sp)
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(16.dp))
                    .padding(20.dp)
            ) {
                Column {
                    Text("UPI PIN", color = Color(0xFF6B7280), fontSize = 12.sp,
                        fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = pinInput,
                        onValueChange = { pinInput = it },
                        placeholder = { Text("Enter your UPI PIN") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = {
                            if (bankUrl.isEmpty()) { statusText = "No bank linked"; return@Button }
                            isLoading = true; statusText = ""
                            val request = Request.Builder()
                                .url("$bankUrl/bank/account/$userId")
                                .build()
                            client.newCall(request).enqueue(object : Callback {
                                override fun onFailure(call: Call, e: IOException) {
                                    isLoading  = false
                                    statusText = "Could not reach bank"
                                }
                                override fun onResponse(call: Call, response: Response) {
                                    isLoading = false
                                    val body = response.body?.string() ?: return
                                    try {
                                        val data = gson.fromJson(body, Map::class.java)
                                        mainBalance    = data["main_balance"] as? Double
                                        offlineBalance = data["offline_balance"] as? Double
                                        lastUpdated    = SimpleDateFormat("hh:mm a",
                                            Locale.getDefault()).format(Date())
                                    } catch (e: Exception) {
                                        statusText = "Error reading response"
                                    }
                                }
                            })
                        },
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        colors   = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                        shape    = RoundedCornerShape(12.dp),
                        enabled  = !isLoading
                    ) { Text(if (isLoading) "Loading..." else "Check Balance", fontWeight = FontWeight.Bold) }

                    if (statusText.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text(statusText, color = Color(0xFFDC2626), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

// ── About Tab ─────────────────────────────────────────────────────────────────
@Composable
fun AboutTab() {
    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF5F7FA))) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF2563EB))
                .padding(horizontal = 20.dp, vertical = 24.dp)
        ) {
            Column {
                Text("About NanoTrust", color = Color.White, fontSize = 22.sp,
                    fontWeight = FontWeight.Bold)
                Text("Offline payments, anywhere", color = Color(0xFFBFDBFE), fontSize = 13.sp)
            }
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { AboutCard(Icons.Filled.PhoneAndroid, "What is NanoTrust?",
                "NanoTrust is an offline-first P2P payment app. Pay and receive money using QR codes — even without internet.") }
            item { AboutCard(Icons.Filled.Lock, "How is it secure?",
                "Every payment is signed using RSA-2048 cryptography. Unique nonces prevent replay attacks. Your offline wallet is ring-fenced.") }
            item { AboutCard(Icons.Filled.Sync, "How does sync work?",
                "Payments are stored locally as signed IOUs. When online, tap Sync to settle all pending payments with your bank.") }
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF2563EB))
                        .padding(20.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.SupportAgent, null, tint = Color.White,
                                modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Helpline", color = Color.White, fontSize = 16.sp,
                                fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.height(6.dp))
                        Text("For support, contact your bank branch or raise a dispute through the app.",
                            color = Color(0xFFBFDBFE), fontSize = 13.sp)
                        Spacer(Modifier.height(12.dp))
                        Text("NanoTrust v1.0 — Built for rural financial inclusion",
                            color = Color(0xFF93C5FD), fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

// ── Reusable composables ──────────────────────────────────────────────────────
@Composable
fun QuickActionButton(
    label: String, icon: ImageVector,
    bgColor: Color, iconColor: Color,
    labelColor: Color = Color(0xFF374151),
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onClick() }.padding(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(58.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(bgColor),
            contentAlignment = Alignment.Center
        ) { Icon(icon, label, tint = iconColor, modifier = Modifier.size(26.dp)) }
        Spacer(Modifier.height(6.dp))
        Text(label, fontSize = 11.sp, color = labelColor,
            fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
    }
}

@Composable
fun MoreOptionRow(
    title: String, subtitle: String,
    icon: ImageVector, iconBg: Color, iconColor: Color,
    isRed: Boolean = false,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(iconBg),
            contentAlignment = Alignment.Center
        ) { Icon(icon, title, tint = iconColor, modifier = Modifier.size(22.dp)) }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                color = if (isRed) Color(0xFFDC2626) else Color(0xFF111827))
            Text(subtitle, fontSize = 12.sp, color = Color(0xFF9CA3AF))
        }
        Icon(Icons.Filled.ChevronRight, null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(20.dp))
    }
}

// ✅ TransactionRow now has a Cancel button
@Composable
fun TransactionRow(receiver: String, amount: Double, onCancel: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFFEF2F2)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.ArrowUpward, null, tint = Color(0xFFDC2626),
                        modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(receiver, fontWeight = FontWeight.Medium, fontSize = 14.sp,
                        color = Color(0xFF111827))
                    Text("Pending sync", fontSize = 12.sp, color = Color(0xFF9CA3AF))
                }
                Text("-₹$amount", color = Color(0xFFDC2626), fontWeight = FontWeight.Bold,
                    fontSize = 15.sp)
            }
            Spacer(Modifier.height(10.dp))
            // ✅ Cancel button per pending row
            Button(
                onClick = onCancel,
                colors  = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                shape   = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(36.dp)
            ) {
                Text("Cancel Payment", fontSize = 12.sp, color = Color.White,
                    fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun AboutCard(icon: ImageVector, title: String, body: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFEFF6FF)),
                    contentAlignment = Alignment.Center
                ) { Icon(icon, null, tint = Color(0xFF2563EB), modifier = Modifier.size(20.dp)) }
                Spacer(Modifier.width(10.dp))
                Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF111827))
            }
            Spacer(Modifier.height(8.dp))
            Text(body, fontSize = 13.sp, color = Color(0xFF6B7280), lineHeight = 20.sp)
        }
    }
}