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

class LinkBankActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private val gson = Gson()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_link_bank)

        val etIp = findViewById<EditText>(R.id.etBankIp)
        val btnConnect = findViewById<Button>(R.id.btnConnectBank)
        val tvBankInfo = findViewById<TextView>(R.id.tvBankInfo)
        val tvStatus = findViewById<TextView>(R.id.tvLinkStatus)
        val btnBack = findViewById<Button>(R.id.btnBackFromBank)
        val progressBar = findViewById<ProgressBar>(R.id.progressLink)

        // Show current linked bank
        val currentBank = UserPrefs.getBankName(this)
        if (currentBank.isNotEmpty()) {
            tvBankInfo.text = "Currently linked: $currentBank\nIP: ${UserPrefs.getBankIp(this)}"
            etIp.setText(UserPrefs.getBankIp(this))
            tvBankInfo.visibility = View.VISIBLE
        }

        btnConnect.setOnClickListener {
            val ip = etIp.text.toString().trim()
            if (ip.isEmpty()) {
                tvStatus.text = "Please enter the bank server IP"
                return@setOnClickListener
            }

            progressBar.visibility = View.VISIBLE
            tvStatus.text = "Connecting to bank..."
            btnConnect.isEnabled = false

            // Step 1: fetch bank info
            val infoRequest = Request.Builder()
                .url("http://$ip:8000/bank/info")
                .build()

            client.newCall(infoRequest).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        progressBar.visibility = View.GONE
                        btnConnect.isEnabled = true
                        tvStatus.text = "❌ Could not reach bank at $ip\nMake sure server is running"
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    val body = response.body?.string() ?: return
                    val info = gson.fromJson(body, Map::class.java)
                    val bankName = info["bank_name"] as? String ?: "Unknown Bank"
                    val bankCode = info["bank_code"] as? String ?: "BANK"

                    // Step 2: register user at this bank
                    val userId = UserPrefs.getUserId(this@LinkBankActivity)
                    val username = UserPrefs.getUsername(this@LinkBankActivity)

                    val regBody = gson.toJson(mapOf(
                        "user_id" to userId,
                        "name" to username
                    )).toRequestBody("application/json".toMediaType())

                    val regRequest = Request.Builder()
                        .url("http://$ip:8000/bank/register")
                        .post(regBody)
                        .build()

                    client.newCall(regRequest).enqueue(object : Callback {
                        override fun onFailure(call: Call, e: IOException) {
                            runOnUiThread {
                                progressBar.visibility = View.GONE
                                btnConnect.isEnabled = true
                                tvStatus.text = "❌ Registration failed"
                            }
                        }

                        override fun onResponse(call: Call, response: Response) {
                            val regBodyStr = response.body?.string() ?: return
                            val regData = gson.fromJson(regBodyStr, Map::class.java)
                            val account = regData["account"] as? Map<*, *>
                            val mainBal = account?.get("main_balance") as? Double ?: 0.0
                            val offlineBal = account?.get("offline_balance") as? Double ?: 0.0

                            // Save bank linkage and sync offline balance from server
                            UserPrefs.linkBank(this@LinkBankActivity, bankName, bankCode, ip)
                            UserPrefs.setOfflineBalance(this@LinkBankActivity, offlineBal)

                            runOnUiThread {
                                progressBar.visibility = View.GONE
                                btnConnect.isEnabled = true
                                tvBankInfo.text = "✅ Linked: $bankName\nIP: $ip\nMain: ₹$mainBal | Offline: ₹$offlineBal"
                                tvStatus.text = "Successfully linked!"
                            }
                        }
                    })
                }
            })
        }

        btnBack.setOnClickListener { finish() }
    }
}