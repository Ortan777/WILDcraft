package com.nanotrust.nanotrustwallet

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.google.gson.Gson

class ReceiveActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val userId = UserPrefs.getUserId(this)
        val gson = Gson()
        val qrContent = gson.toJson(
            mapOf(
                "type" to "receive_request",
                "receiver_id" to userId
            )
        )

        val intent = Intent(this, ShowProofActivity::class.java)
        intent.putExtra("qr_data", qrContent)
        intent.putExtra("user_id", userId)
        startActivity(intent)
        finish()
    }
}