package com.nanotrust.nanotrustwallet

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson

object UserPrefs {
    private const val PREF_NAME = "nanotrust_user"
    private val gson = Gson()

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    // ── Auth ──────────────────────────────────────────────────────────────────
    fun isLoggedIn(context: Context) = prefs(context).getBoolean("logged_in", false)
    fun getUsername(context: Context) = prefs(context).getString("username", "") ?: ""
    fun getPassword(context: Context) = prefs(context).getString("password", "") ?: ""
    fun getUserId(context: Context) = prefs(context).getString("user_id", "") ?: ""

    fun saveUser(context: Context, username: String, password: String, userId: String) {
        prefs(context).edit()
            .putBoolean("logged_in", true)
            .putString("username", username)
            .putString("password", password)
            .putString("user_id", userId)
            .apply()
    }

    // Only clears login — keeps offline balance + bank link + pending IOUs
    fun logout(context: Context) {
        prefs(context).edit()
            .remove("logged_in")
            .remove("username")
            .remove("password")
            .remove("user_id")
            .apply()
    }

    // ── Offline Wallet ────────────────────────────────────────────────────────
    fun getOfflineBalance(context: Context) =
        prefs(context).getFloat("offline_balance", 0f).toDouble()

    fun setOfflineBalance(context: Context, amount: Double) =
        prefs(context).edit().putFloat("offline_balance", amount.toFloat()).apply()

    fun deductOfflineBalance(context: Context, amount: Double) =
        setOfflineBalance(context, getOfflineBalance(context) - amount)

    // ✅ Credit wallet (used when merchant scans payment QR)
    fun addOfflineBalance(context: Context, amount: Double) =
        setOfflineBalance(context, getOfflineBalance(context) + amount)

    // ── Bank Linkage ──────────────────────────────────────────────────────────
    fun getBankName(context: Context) = prefs(context).getString("bank_name", "") ?: ""
    fun getBankCode(context: Context) = prefs(context).getString("bank_code", "") ?: ""
    fun getBankIp(context: Context) = prefs(context).getString("bank_ip", "") ?: ""

    fun linkBank(context: Context, bankName: String, bankCode: String, bankIp: String) {
        prefs(context).edit()
            .putString("bank_name", bankName)
            .putString("bank_code", bankCode)
            .putString("bank_ip", bankIp)
            .apply()
    }

    fun getBankUrl(context: Context): String {
        val ip = getBankIp(context)
        return if (ip.isEmpty()) "" else "http://$ip:8000"
    }

    // ── Pending IOUs ──────────────────────────────────────────────────────────
    fun savePendingIou(context: Context, nonce: String, iouJson: String) =
        prefs(context).edit().putString("iou_$nonce", iouJson).apply()

    fun removePendingIou(context: Context, nonce: String) =
        prefs(context).edit().remove("iou_$nonce").apply()

    fun getAllPendingIous(context: Context): Map<String, String> =
        prefs(context).all
            .filter { it.key.startsWith("iou_") }
            .mapValues { it.value.toString() }

    fun hasPendingIous(context: Context) = getAllPendingIous(context).isNotEmpty()

    // ✅ Nonce tracking — prevents same QR being scanned/used twice
    fun isNonceUsed(context: Context, nonce: String): Boolean =
        prefs(context).getBoolean("used_nonce_$nonce", false)

    fun markNonceUsed(context: Context, nonce: String) =
        prefs(context).edit().putBoolean("used_nonce_$nonce", true).apply()

    // ── Transaction History (local log) ──────────────────────────────────────
    data class TxRecord(
        val type: String,      // "sent", "received", "topup", "withdraw"
        val amount: Double,
        val party: String,     // receiver/sender ID or "Bank"
        val timestamp: Long = System.currentTimeMillis()
    )

    fun saveTransaction(context: Context, type: String, amount: Double, party: String) {
        val key = "tx_${System.currentTimeMillis()}_${(Math.random() * 1000).toInt()}"
        val record = TxRecord(type, amount, party)
        prefs(context).edit().putString(key, gson.toJson(record)).apply()
    }

    fun getTransactions(context: Context): List<TxRecord> {
        return prefs(context).all
            .filter { it.key.startsWith("tx_") }
            .mapNotNull {
                runCatching { gson.fromJson(it.value.toString(), TxRecord::class.java) }.getOrNull()
            }
            .sortedByDescending { it.timestamp }
            .take(20) // keep last 20
    }
}