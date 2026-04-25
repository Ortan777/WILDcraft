package com.nanotrust.nanotrustwallet

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (UserPrefs.isLoggedIn(this)) {
            goToMain()
            return
        }

        setContentView(R.layout.activity_login)

        val etUsername = findViewById<EditText>(R.id.etUsername)
        val etPassword = findViewById<EditText>(R.id.etPassword)
        val btnLogin = findViewById<Button>(R.id.btnLogin)
        val btnRegister = findViewById<Button>(R.id.btnRegister)
        val tvError = findViewById<TextView>(R.id.tvLoginError)

        btnLogin.setOnClickListener {
            val username = etUsername.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (username.isEmpty() || password.isEmpty()) {
                tvError.text = "Please enter username and password"
                return@setOnClickListener
            }

            val savedPassword = getSharedPreferences("nanotrust_accounts", MODE_PRIVATE)
                .getString("pwd_$username", null)

            when {
                savedPassword == null -> tvError.text = "User not found. Please register."
                savedPassword != password -> tvError.text = "Incorrect password"
                else -> {
                    val userId = "user_$username"
                    UserPrefs.saveUser(this, username, password, userId)
                    goToMain()
                }
            }
        }

        btnRegister.setOnClickListener {
            val username = etUsername.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (username.isEmpty() || password.isEmpty()) {
                tvError.text = "Please enter username and password"
                return@setOnClickListener
            }

            val accounts = getSharedPreferences("nanotrust_accounts", MODE_PRIVATE)

            if (accounts.contains("pwd_$username")) {
                tvError.text = "Username already taken"
                return@setOnClickListener
            }

            accounts.edit().putString("pwd_$username", password).apply()

            val userId = "user_$username"
            UserPrefs.saveUser(this, username, password, userId)
            UserPrefs.setOfflineBalance(this, 0.0)

            Toast.makeText(this, "Account created! Welcome $username", Toast.LENGTH_SHORT).show()
            goToMain()
        }
    }

    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}