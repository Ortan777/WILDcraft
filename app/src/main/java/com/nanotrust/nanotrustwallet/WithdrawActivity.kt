package com.nanotrust.nanotrustwallet

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class WithdrawActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private val gson = Gson()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_withdraw)

        val etAmount = findViewById<EditText>(R.id.etWithdrawAmount)
        val etUpiPin = findViewById<EditText>(R.id.etWithdrawUpiPin)
        val btnWithdraw = findViewById<Button>(R.id.btnConfirmWithdraw)
        val tvStatus = findViewById<TextView>(R.id.tvWithdrawStatus)
        val tvOfflineBal = findViewById<TextView>(R.id.tvWithdrawOfflineBal)
        val tvBank = findViewById<TextView>(R.id.tvWithdrawBankName)
        val progressBar = findViewById<ProgressBar>(R.id.progressWithdraw)
        val btnBack = findViewById<Button>(R.id.btnBackFromWithdraw)

        val bankName = UserPrefs.getBankName(this)
        val bankUrl = UserPrefs.getBankUrl(this)
        val userId = UserPrefs.getUserId(this)
        var offlineBalance = UserPrefs.getOfflineBalance(this)

        tvBank.text = "Bank: $bankName"
        tvOfflineBal.text = "Offline wallet: ₹$offlineBalance"

        if (bankName.isEmpty()) {
            tvStatus.text = "No bank linked. Please link a bank first."
            btnWithdraw.isEnabled = false
        }

        btnWithdraw.setOnClickListener {
            val amountStr = etAmount.text.toString().trim()
            val upiPin = etUpiPin.text.toString().trim()
            val amount = amountStr.toDoubleOrNull()

            when {
                amount == null || amount <= 0 -> {
                    tvStatus.text = "Enter a valid amount"
                    return@setOnClickListener
                }
                amount > offlineBalance -> {
                    tvStatus.text = "❌ Insufficient offline balance (₹$offlineBalance)"
                    return@setOnClickListener
                }
                upiPin.isEmpty() -> {
                    tvStatus.text = "Enter your UPI PIN"
                    return@setOnClickListener
                }
            }

            progressBar.visibility = View.VISIBLE
            btnWithdraw.isEnabled = false
            tvStatus.text = "Processing..."

            val requestBody = gson.toJson(mapOf(
                "user_id" to userId,
                "amount" to amount,
                "upi_pin" to upiPin
            )).toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$bankUrl/bank/withdraw")
                .post(requestBody)
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        progressBar.visibility = View.GONE
                        btnWithdraw.isEnabled = true
                        tvStatus.text = "❌ Could not reach bank — must be online"
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    runOnUiThread {
                        progressBar.visibility = View.GONE
                        btnWithdraw.isEnabled = true
                    }
                    when (response.code) {
                        401 -> runOnUiThread { tvStatus.text = "❌ Wrong UPI PIN" }
                        400 -> runOnUiThread { tvStatus.text = "❌ Insufficient balance on server" }
                        200 -> {
                            // Deduct from local offline wallet
                            UserPrefs.deductOfflineBalance(this@WithdrawActivity, amount!!)
                            offlineBalance = UserPrefs.getOfflineBalance(this@WithdrawActivity)

                            val body = response.body?.string()
                            val data = gson.fromJson(body, Map::class.java)
                            val newMain = data["main_balance"] as? Double ?: 0.0
                            val newOffline = data["offline_balance"] as? Double ?: offlineBalance

                            // Sync local with server
                            UserPrefs.setOfflineBalance(this@WithdrawActivity, newOffline)

                            runOnUiThread {
                                tvOfflineBal.text = "Offline wallet: ₹$newOffline"
                                tvStatus.text = "✅ Withdrawn ₹$amount!\nMain account: ₹$newMain\nOffline wallet: ₹$newOffline"
                                etAmount.text.clear()
                                etUpiPin.text.clear()
                            }
                        }
                        else -> runOnUiThread { tvStatus.text = "❌ Server error ${response.code}" }
                    }
                }
            })
        }

        btnBack.setOnClickListener { finish() }
    }
}