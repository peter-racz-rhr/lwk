package com.ante.app

import android.content.Context
import org.json.JSONObject

/**
 * The signed-in Google account (name and email only) and whether onboarding is done.
 * Stored on the device. Ante has no server: the account is used to greet the user and is the
 * hook for a future backup/sync service.
 */
object Account {
    private const val PREFS = "ante-account"

    private fun prefs(c: Context) = c.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun toJson(c: Context): JSONObject {
        val p = prefs(c)
        val email = p.getString("email", null)
        return JSONObject()
            .put("signedIn", email != null)
            .put("name", p.getString("name", "") ?: "")
            .put("email", email ?: "")
            .put("onboarded", p.getBoolean("onboarded", false))
            .put("googleConfigured", GoogleAuth.webClientId(c) != null)
    }

    fun save(c: Context, id: String, name: String, email: String) {
        prefs(c).edit()
            .putString("id", id.take(255))
            .putString("name", name.take(80))
            .putString("email", email.take(254))
            .putLong("signedInAt", System.currentTimeMillis())
            .apply()
    }

    fun clear(c: Context) {
        prefs(c).edit().remove("id").remove("name").remove("email").remove("signedInAt").apply()
    }

    fun setOnboarded(c: Context) {
        prefs(c).edit().putBoolean("onboarded", true).apply()
    }
}
