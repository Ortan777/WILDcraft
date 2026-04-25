package com.nanotrust.nanotrustwallet

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.google.zxing.BarcodeFormat
import com.journeyapps.barcodescanner.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class ScanProofActivity : AppCompatActivity() {

    private lateinit var barcodeView: DecoratedBarcodeView
    private lateinit var btnCancel: Button
    private val gson = Gson()
    private val client = OkHttpClient()
    private val CAMERA_PERMISSION_REQUEST = 100
    private var isDecoderBound = false
    private var hasScannedResult = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scan_merchant)

        barcodeView = findViewById(R.id.barcode_scanner)
        btnCancel = findViewById(R.id.btnCancelScan)

        barcodeView.barcodeView.decoderFactory = DefaultDecoderFactory(listOf(BarcodeFormat.QR_CODE))
        barcodeView.barcodeView.cameraSettings.isAutoFocusEnabled = true

        btnCancel.setOnClickListener { finish() }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                CAMERA_PERMISSION_REQUEST
            )
        }
    }

    override fun onResume() {
        super.onResume()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED) {
            barcodeView.resume()
            if (!isDecoderBound) bindDecoder()
        }
    }

    override fun onPause() {
        super.onPause()
        barcodeView.pause()
    }

    private fun bindDecoder() {
        isDecoderBound = true
        barcodeView.decodeContinuous(object : BarcodeCallback {
            override fun barcodeResult(result: BarcodeResult?) {
                if (hasScannedResult) return
                if (result == null || result.text.isNullOrEmpty()) return

                Log.d("NanoTrust", "Scanned proof QR: ${result.text}")

                try {
                    val raw = gson.fromJson(result.text, Map::class.java)
                    val type = raw["type"] as? String

                    if (type == "payment_proof") {
                        hasScannedResult = true
                        barcodeView.pause()

                        val payload = raw["payload"] as? Map<*, *>
                        val nonce = (payload?.get("nonce") as? String)
                            ?: System.currentTimeMillis().toString()
                        val amount = (payload?.get("amount") as? Double) ?: 0.0

                        // ✅ FIX 1: Check for duplicate QR (prevent scanning same QR twice)
                        if (UserPrefs.isNonceUsed(this@ScanProofActivity, nonce)) {
                            runOnUiThread {
                                Toast.makeText(
                                    this@ScanProofActivity,
                                    "❌ This payment QR has already been used!",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                            finish()
                            return
                        }

                        // ✅ FIX 2: Credit merchant's offline wallet immediately
                        UserPrefs.addOfflineBalance(this@ScanProofActivity, amount)

                        // ✅ FIX 3: Mark nonce as used so same QR can't be scanned again
                        UserPrefs.markNonceUsed(this@ScanProofActivity, nonce)

                        // ✅ FIX 4: Save incoming IOU for bank sync later
                        UserPrefs.savePendingIou(this@ScanProofActivity, nonce, result.text)

                        runOnUiThread {
                            Toast.makeText(
                                this@ScanProofActivity,
                                "✅ Received ₹$amount! Wallet updated.",
                                Toast.LENGTH_LONG
                            ).show()
                        }

                        // Try to sync immediately if online
                        syncToServer(result.text, nonce)
                        finish()
                    }
                } catch (e: JsonSyntaxException) {
                    Log.e("NanoTrust", "Not a valid proof QR")
                }
            }

            override fun possibleResultPoints(resultPoints: MutableList<com.google.zxing.ResultPoint>?) {}
        })
    }

    private fun syncToServer(iouJson: String, nonce: String) {
        val body = iouJson.toRequestBody("application/json".toMediaType())
        val bankUrl = UserPrefs.getBankUrl(this)
        if (bankUrl.isEmpty()) return

        val request = Request.Builder()
            .url("$bankUrl/bank/settle")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.d("NanoTrust", "Offline — IOU saved locally for later sync")
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    // Remove from pending after successful server sync
                    UserPrefs.removePendingIou(this@ScanProofActivity, nonce)
                    runOnUiThread {
                        Toast.makeText(
                            this@ScanProofActivity,
                            "✅ Synced with bank!",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
        })
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                barcodeView.resume()
                if (!isDecoderBound) bindDecoder()
            } else {
                Toast.makeText(this, "Camera permission required", Toast.LENGTH_LONG).show()
                finish()
            }
        }
    }
}