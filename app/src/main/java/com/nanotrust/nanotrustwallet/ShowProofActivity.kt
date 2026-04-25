package com.nanotrust.nanotrustwallet

import android.os.Bundle
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.gson.Gson
import com.google.zxing.BarcodeFormat
import com.google.zxing.WriterException
import com.journeyapps.barcodescanner.BarcodeEncoder

class ShowProofActivity : AppCompatActivity() {

    private val gson = Gson()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_show_proof)

        val qrData = intent.getStringExtra("qr_data") ?: ""
        val userId = intent.getStringExtra("user_id") ?: UserPrefs.getUserId(this)

        val ivQr        = findViewById<ImageView>(R.id.ivProofQr)
        val tvLabel     = findViewById<TextView>(R.id.tvProofLabel)
        val tvSubLabel  = findViewById<TextView>(R.id.tvProofSubLabel)
        val tvUserId    = findViewById<TextView>(R.id.tvProofUserId)
        val btnAction   = findViewById<Button>(R.id.btnScanPayerProof)   // repurposed
        val btnClose    = findViewById<Button>(R.id.btnCloseProof)

        tvUserId.text = "Your ID: $userId"

        // Parse QR type to determine which screen this is
        var isPaymentProof = false
        var nonce = ""
        var amount = 0.0
        var receiverId = ""

        try {
            val parsed = gson.fromJson(qrData, Map::class.java)
            val type = parsed["type"] as? String

            when (type) {
                "payment_proof" -> {
                    isPaymentProof = true
                    val payload = parsed["payload"] as? Map<*, *>
                    nonce      = payload?.get("nonce") as? String ?: ""
                    amount     = (payload?.get("amount") as? Double) ?: 0.0
                    receiverId = payload?.get("receiver") as? String ?: ""

                    tvLabel.text    = "✅ Payment Sent"
                    tvSubLabel.text = "Show this QR to receiver to confirm payment of ₹$amount"
                }
                "receive_request" -> {
                    tvLabel.text    = "Scan & Pay"
                    tvSubLabel.text = "Ask payer to scan this QR to pay you"
                }
                else -> {
                    tvLabel.text    = "Show this QR"
                    tvSubLabel.text = ""
                }
            }
        } catch (e: Exception) {
            tvLabel.text    = "Show this QR"
            tvSubLabel.text = ""
        }

        // Generate QR bitmap
        try {
            val encoder = BarcodeEncoder()
            val bitmap  = encoder.encodeBitmap(qrData, BarcodeFormat.QR_CODE, 700, 700)
            ivQr.setImageBitmap(bitmap)
        } catch (e: WriterException) {
            Toast.makeText(this, "Error generating QR", Toast.LENGTH_SHORT).show()
        }

        if (isPaymentProof) {
            // ✅ After payment: show Cancel Payment button (not scan)
            btnAction.text            = "Cancel Payment"
            btnAction.setBackgroundColor(android.graphics.Color.parseColor("#DC2626"))
            btnAction.setOnClickListener {
                // Remove the IOU from pending
                if (nonce.isNotEmpty()) {
                    UserPrefs.removePendingIou(this, nonce)
                    // Refund offline balance
                    UserPrefs.addOfflineBalance(this, amount)
                }
                Toast.makeText(this, "Payment cancelled. ₹$amount refunded.", Toast.LENGTH_LONG).show()
                finish()
            }

            btnClose.text = "Done"
            btnClose.setOnClickListener { finish() }

        } else {
            // Receive screen: show "Scan Payer's Proof QR" button
            btnAction.text = "Scan Payer's Proof QR"
            btnAction.setBackgroundColor(android.graphics.Color.parseColor("#2563EB"))
            btnAction.setOnClickListener {
                startActivity(android.content.Intent(this, ScanProofActivity::class.java))
            }

            btnClose.text = "Close"
            btnClose.setOnClickListener { finish() }
        }
    }
}