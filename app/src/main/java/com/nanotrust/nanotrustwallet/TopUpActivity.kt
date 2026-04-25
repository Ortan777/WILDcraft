package com.nanotrust.nanotrustwallet

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class TopUpActivity : AppCompatActivity() {

    private val gson = Gson()
    private val client = OkHttpClient()

    private lateinit var etAmount: EditText
    private lateinit var etUpiPin: EditText
    private lateinit var tvMainBalance: TextView
    private lateinit var tvAfterTopUp: TextView
    private lateinit var tvTopUpStatus: TextView
    private lateinit var tvTopUpBankName: TextView
    private lateinit var btnConfirmTopUp: Button
    private lateinit var btnBack: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_topup)

        etAmount = findViewById(R.id.etTopUpAmount)
        etUpiPin = findViewById(R.id.etUpiPin)
        tvMainBalance = findViewById(R.id.tvMainBalance)
        tvAfterTopUp = findViewById(R.id.tvAfterTopUp)
        tvTopUpStatus = findViewById(R.id.tvTopUpStatus)
        tvTopUpBankName = findViewById(R.id.tvTopUpBankName)
        btnConfirmTopUp = findViewById(R.id.btnConfirmTopUp)
        btnBack = findViewById(R.id.btnBackFromTopUp)

        // Show bank name and current balance
        val bankName = UserPrefs.getBankName(this)
        val currentOffline = UserPrefs.getOfflineBalance(this)
        tvTopUpBankName.text = if (bankName.isNotEmpty()) bankName else "No bank linked"
        tvMainBalance.text = "₹$currentOffline"
        tvAfterTopUp.text = "After top-up, offline wallet: ₹$currentOffline"

        // Live preview of resulting balance
        etAmount.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val amt = s.toString().toDoubleOrNull() ?: 0.0
                val current = UserPrefs.getOfflineBalance(this@TopUpActivity)
                tvAfterTopUp.text = "After top-up, offline wallet: ₹${current + amt}"
            }
        })

        btnConfirmTopUp.setOnClickListener {
            performTopUp()
        }

        btnBack.setOnClickListener {
            finish()
        }
    }

    private fun performTopUp() {
        val amountStr = etAmount.text.toString().trim()
        val upiPin = etUpiPin.text.toString().trim()

        // Basic validation
        if (amountStr.isEmpty()) {
            showStatus("Please enter an amount", isError = true)
            return
        }
        val amount = amountStr.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            showStatus("Enter a valid amount", isError = true)
            return
        }
        if (upiPin.isEmpty()) {
            showStatus("Please enter your UPI PIN", isError = true)
            return
        }

        val bankUrl = UserPrefs.getBankUrl(this)
        if (bankUrl.isEmpty()) {
            showStatus("No bank linked. Please link a bank first.", isError = true)
            return
        }

        val userId = UserPrefs.getUserId(this)

        // Disable button to prevent double-tap
        btnConfirmTopUp.isEnabled = false
        showStatus("Processing top-up...", isError = false)

        val body = gson.toJson(
            mapOf(
                "user_id" to userId,
                "amount" to amount,
                "upi_pin" to upiPin
            )
        ).toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$bankUrl/bank/topup")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    btnConfirmTopUp.isEnabled = true
                    showStatus("Top-up failed: ${e.message}", isError = true)
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val respBody = response.body?.string()
                runOnUiThread {
                    btnConfirmTopUp.isEnabled = true
                    if (response.isSuccessful && respBody != null) {
                        try {
                            val data = gson.fromJson(respBody, Map::class.java)
                            val newOffline = data["offline_balance"] as? Double
                            if (newOffline != null) {
                                UserPrefs.setOfflineBalance(this@TopUpActivity, newOffline)
                                tvMainBalance.text = "₹$newOffline"
                                tvAfterTopUp.text = "After top-up, offline wallet: ₹$newOffline"
                                etAmount.setText("")
                                etUpiPin.setText("")
                                showStatus("✅ Top-up successful! New balance: ₹$newOffline", isError = false)
                            } else {
                                showStatus("Top-up done but balance not returned", isError = false)
                            }
                        } catch (e: Exception) {
                            showStatus("Response error: ${e.message}", isError = true)
                        }
                    } else {
                        showStatus("Top-up failed: $respBody", isError = true)
                    }
                }
            }
        })
    }

    private fun showStatus(message: String, isError: Boolean) {
        tvTopUpStatus.text = message
        tvTopUpStatus.setTextColor(
            if (isError)
                getColor(android.R.color.holo_red_light)
            else
                getColor(android.R.color.holo_green_light)
        )
        tvTopUpStatus.visibility = View.VISIBLE
    }
}