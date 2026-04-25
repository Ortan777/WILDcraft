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
import com.journeyapps.barcodescanner.*

data class ReceiveRequestQR(
    val type: String,
    val receiver_id: String
)

class ScanReceiverActivity : AppCompatActivity() {

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
        btnCancel = findViewById(R.id.btnCancelScan)

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
            // Set decoder BEFORE resume
            barcodeView.barcodeView.decoderFactory =
                DefaultDecoderFactory(listOf(BarcodeFormat.QR_CODE))
            barcodeView.barcodeView.cameraSettings.isAutoFocusEnabled = true

            barcodeView.resume()

            if (!isDecoderBound) {
                bindDecoder()
            }
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

                // Debug: show exactly what was scanned
                runOnUiThread {
                    Toast.makeText(
                        this@ScanReceiverActivity,
                        "Scanned: ${result.text}",
                        Toast.LENGTH_LONG
                    ).show()
                }

                Log.d("NanoTrust", "RAW: ${result.text}")

                try {
                    val qrData = gson.fromJson(result.text, ReceiveRequestQR::class.java)

                    if (qrData.type == "receive_request" && qrData.receiver_id.isNotEmpty()) {
                        hasScannedResult = true
                        barcodeView.pause()

                        val intent = Intent().apply {
                            putExtra("receiver_id", qrData.receiver_id)
                        }
                        setResult(RESULT_OK, intent)
                        finish()

                    } else {
                        runOnUiThread {
                            Toast.makeText(
                                this@ScanReceiverActivity,
                                "Wrong type: ${qrData.type}",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }

                } catch (e: JsonSyntaxException) {
                    runOnUiThread {
                        Toast.makeText(
                            this@ScanReceiverActivity,
                            "Not a NanoTrust QR",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    Log.e("NanoTrust", "Parse error: ${e.message}")
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
                barcodeView.barcodeView.decoderFactory =
                    DefaultDecoderFactory(listOf(BarcodeFormat.QR_CODE))
                barcodeView.barcodeView.cameraSettings.isAutoFocusEnabled = true
                barcodeView.resume()
                if (!isDecoderBound) bindDecoder()
            } else {
                Toast.makeText(this, "Camera permission required", Toast.LENGTH_LONG).show()
                finish()
            }
        }
    }
}