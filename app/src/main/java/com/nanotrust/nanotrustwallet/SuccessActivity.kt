package com.nanotrust.nanotrustwallet

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.animation.AnimationUtils
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class SuccessActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_success)

        val title = intent.getStringExtra("title") ?: "Payment Successful"
        val subtitle = intent.getStringExtra("subtitle") ?: ""
        val amount = intent.getStringExtra("amount") ?: ""

        findViewById<TextView>(R.id.tvSuccessTitle).text = title
        findViewById<TextView>(R.id.tvSuccessSubtitle).text = subtitle
        findViewById<TextView>(R.id.tvSuccessAmount).text = amount

        // Animate the checkmark
        val checkView = findViewById<android.view.View>(R.id.ivSuccessCheck)
        val anim = AnimationUtils.loadAnimation(this, android.R.anim.fade_in)
        checkView.startAnimation(anim)

        // Vibrate
        vibrate()

        // Auto close after 2.5 seconds
        Handler(Looper.getMainLooper()).postDelayed({
            finish()
        }, 2500)
    }

    private fun vibrate() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val vm = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 80, 60, 120), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(VIBRATOR_SERVICE) as Vibrator
                @Suppress("DEPRECATION")
                v.vibrate(longArrayOf(0, 80, 60, 120), -1)
            }
        } catch (e: Exception) { }
    }
}