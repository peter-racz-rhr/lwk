package com.ante.app

import android.app.Activity
import android.content.Context
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.Executor

/**
 * "Sign in with Google" through Android's Credential Manager. Shows Google's own account sheet,
 * so Ante never sees a password. Needs the Web client ID from Google Cloud in
 * res/values/google.xml (see README, "Google sign-in").
 */
object GoogleAuth {
    private val main = Executor { Handler(Looper.getMainLooper()).post(it) }

    /** The configured Web client ID, or null while the placeholder is still in place. */
    fun webClientId(c: Context): String? {
        val res = c.resources.getIdentifier("google_web_client_id", "string", c.packageName)
        if (res == 0) return null
        val id = c.getString(res).trim()
        return id.takeIf { it.endsWith(".apps.googleusercontent.com") && !it.startsWith("REPLACE") }
    }

    /** Runs the sign-in sheet; [done] gets {ok, name, email} or {ok:false, error, message}. Main thread. */
    fun signIn(activity: Activity, done: (JSONObject) -> Unit) {
        val clientId = webClientId(activity)
            ?: return done(fail("not_configured", "Google sign-in isn't set up in this build yet."))
        val option = GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce()).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val callback = object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
            override fun onResult(result: GetCredentialResponse) {
                val credential = result.credential
                if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    done(fail("unexpected", "Google returned an unexpected credential."))
                    return
                }
                try {
                    val google = GoogleIdTokenCredential.createFrom(credential.data)
                    val name = google.displayName ?: google.givenName ?: ""
                    // A future server must verify google.idToken before trusting this account.
                    Account.save(activity, google.id, name, google.id)
                    done(JSONObject().put("ok", true).put("name", name).put("email", google.id))
                } catch (e: Exception) {
                    done(fail("parse", "Couldn't read the Google account. Try again."))
                }
            }

            override fun onError(e: GetCredentialException) {
                done(
                    when (e) {
                        is GetCredentialCancellationException -> fail("cancelled", "Sign-in was cancelled.")
                        is NoCredentialException -> fail("no_account", "No Google account on this phone. Add one in Settings, then try again.")
                        else -> fail("failed", "Google sign-in failed. Check your connection and try again.")
                    }
                )
            }
        }
        try {
            CredentialManager.create(activity).getCredentialAsync(activity, request, CancellationSignal(), main, callback)
        } catch (e: Exception) {
            done(fail("failed", "Google sign-in isn't available on this phone."))
        }
    }

    /** Clears Google's remembered account choice, so the next sign-in shows the account picker. */
    fun forgetGoogleChoice(activity: Activity) {
        try {
            CredentialManager.create(activity).clearCredentialStateAsync(
                ClearCredentialStateRequest(), CancellationSignal(), main,
                object : CredentialManagerCallback<Void?, ClearCredentialException> {
                    override fun onResult(result: Void?) = Unit
                    override fun onError(e: ClearCredentialException) = Unit
                },
            )
        } catch (e: Exception) {
            // Local sign-out already happened; clearing Google's saved choice is best effort.
        }
    }

    private fun fail(code: String, message: String) = JSONObject().put("ok", false).put("error", code).put("message", message)

    private fun nonce(): String {
        val bytes = ByteArray(24).also { SecureRandom().nextBytes(it) }
        return Base64.encodeToString(bytes, Base64.NO_WRAP or Base64.URL_SAFE)
    }
}
