package com.nanotrust.nanotrustwallet

import android.content.Context
import android.util.Base64
import java.security.*
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec

object CryptoHelper {
    private const val PREFS_NAME = "nano_trust_prefs"
    private const val PRIVATE_KEY = "private_key"
    private const val PUBLIC_KEY = "public_key"

    fun getOrCreateKeyPair(context: Context): KeyPair {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val privStr = prefs.getString(PRIVATE_KEY, null)
        if (privStr != null) {
            val privBytes = Base64.decode(privStr, Base64.DEFAULT)
            val pubStr = prefs.getString(PUBLIC_KEY, "")!!
            val pubBytes = Base64.decode(pubStr, Base64.DEFAULT)
            val kf = KeyFactory.getInstance("RSA")
            val privateKey = kf.generatePrivate(PKCS8EncodedKeySpec(privBytes))
            val publicKey = kf.generatePublic(X509EncodedKeySpec(pubBytes))
            return KeyPair(publicKey, privateKey)
        } else {
            val generator = KeyPairGenerator.getInstance("RSA")
            generator.initialize(2048)
            val pair = generator.generateKeyPair()
            val editor = prefs.edit()
            editor.putString(PRIVATE_KEY, Base64.encodeToString(pair.private.encoded, Base64.DEFAULT))
            editor.putString(PUBLIC_KEY, Base64.encodeToString(pair.public.encoded, Base64.DEFAULT))
            editor.apply()
            return pair
        }
    }

    fun signData(plainText: String, privateKey: PrivateKey): String {
        val signature = Signature.getInstance("SHA256withRSA")
        signature.initSign(privateKey)
        signature.update(plainText.toByteArray())
        return Base64.encodeToString(signature.sign(), Base64.DEFAULT)
    }
}