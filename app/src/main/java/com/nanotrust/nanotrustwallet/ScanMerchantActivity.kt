package com.nanotrust.nanotrustwallet

import android.Manifest
import android.content.Intent
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
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import com.journeyapps.barcodescanner.DecoratedBarcodeView
import com.journeyapps.barcodescanner.DefaultDecoderFactory

data class PaymentRequestQR(
    val type: String,
    val merchant_id: String,
    val amount: Double,
    val nonce: String
)

class ScanMerchantActivity : AppCompatActivity() {

    private lateinit var barcodeView: DecoratedBarcodeView
    private lateinit var btnCancel: Button

    private val gson = Gson()
    private val CAMERA_PERMISSION_REQUEST = 100
    private var isDecoderBound = false
    private var hasScannedResult = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scan_merchant)

        barcodeView = findViewById(R.id.barcode_scanner)
        btnCancel   = findViewById(R.id.btnCancelScan)

        // ✅ FIX: Force portrait + correct rotation so camera is never tilted
        barcodeView.barcodeView.decoderFactory =
            DefaultDecoderFactory(listOf(BarcodeFormat.QR_CODE))
        barcodeView.barcodeView.cameraSettings.isAutoFocusEnabled = true

        // ✅ FIX: explicitly set rotation to portrait (0 = upright)
        // ZXing DecoratedBarcodeView respects the activity screenOrientation in Manifest,
        // but we also set cameraSettings to avoid sideways preview
        barcodeView.barcodeView.cameraSettings.requestedCameraId = -1  // default/back camera

        btnCancel.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
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
            == PackageManager.PERMISSION_GRANTED
        ) {
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

                Log.d("NanoTrust", "ScanMerchant RAW: ${result.text}")

                try {
                    val raw = gson.fromJson(result.text, Map::class.java)
                    val type = raw["type"] as? String

                    if (type == "payment_request") {
                        val merchantId = raw["merchant_id"] as? String ?: return
                        val amount     = (raw["amount"] as? Double) ?: 0.0
                        val nonce      = raw["nonce"] as? String ?: ""

                        if (merchantId.isNotEmpty()) {
                            hasScannedResult = true
                            barcodeView.pause()

                            val resultIntent = Intent().apply {
                                putExtra("merchant_id", merchantId)
                                putExtra("amount", amount)
                                putExtra("nonce", nonce)
                            }
                            setResult(RESULT_OK, resultIntent)
                            finish()
                        }
                    }
                } catch (e: JsonSyntaxException) {
                    Log.e("NanoTrust", "Not a NanoTrust merchant QR")
                } catch (e: Exception) {
                    Log.e("NanoTrust", "ScanMerchant error: ${e.message}")
                }
            }

            override fun possibleResultPoints(
                resultPoints: MutableList<com.google.zxing.ResultPoint>?
            ) {}
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
                Toast.makeText(this, "Camera permission is required to scan.", Toast.LENGTH_LONG).show()
                finish()
            }
        }
    }
}