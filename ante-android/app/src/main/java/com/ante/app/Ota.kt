package com.ante.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.ante.app.core.OtaCore
import com.ante.app.core.OtaManifest
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Over-the-air updates for the web UI. Each push publishes a signed bundle to the repo's
 * `web-latest` release; the app downloads it in the background, checks the signature and the
 * checksum, and serves it on the next page load. Native code still needs a new APK.
 *
 * Safety: nothing unsigned is ever loaded; a bundle that fails to start twice is dropped and
 * marked bad; a newly installed APK wipes downloaded bundles (its own files are newer); and the
 * highest version ever installed is remembered, so an older signed bundle is never taken again.
 */
object Ota {
    /** Bump whenever the bridge (AnteBridge) changes in a way the page depends on. */
    const val NATIVE_API = 1

    private const val BASE = "https://github.com/peter-racz-rhr/lwk/releases/download/web-latest/"
    private const val MANIFEST_URL = BASE + "manifest.json"

    /** Public half of the signing key (X.509 SubjectPublicKeyInfo, base64). The private half is the ANTE_OTA_KEY secret. */
    private const val PUBLIC_KEY =
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbEPbTanLsFhwTPwntD438+sxfcEp/ZZcFJwVLdJNi/gXYNIrATFdKs5WecLX466xUp84KKidmdDGfFfDQR64ww=="

    private const val CHECK_EVERY_MS = 10 * 60_000L
    private const val MAX_UNCONFIRMED_LOADS = 3
    private const val TIMEOUT_MS = 15_000
    private const val MAX_MANIFEST = 16 * 1024

    private const val PREFS = "ota"
    /** Highest version ever installed. Kept apart so an APK update or a fallback never lowers it (no rollback to older signed bundles). */
    private const val HIGH_PREFS = "ota-high"
    private const val K_HIGH = "high"
    private const val K_VERSION = "version"
    private const val K_APK = "apkStamp"
    private const val K_UNCONFIRMED = "unconfirmed"
    private const val K_BAD = "bad"
    private const val K_LAST_CHECK = "lastCheck"

    private val checking = AtomicBoolean(false)
    private val main = Handler(Looper.getMainLooper())

    private fun prefs(c: Context) = c.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun high(c: Context) = c.applicationContext.getSharedPreferences(HIGH_PREFS, Context.MODE_PRIVATE)
    private fun otaDir(c: Context) = File(c.applicationContext.filesDir, "web-ota")
    private fun bundleDir(c: Context, version: Long) = File(otaDir(c), "v$version")

    private fun apkStamp(c: Context): Long = try {
        @Suppress("DEPRECATION")
        c.packageManager.getPackageInfo(c.packageName, 0).lastUpdateTime
    } catch (e: Exception) {
        0L
    }

    /** Version of the downloaded bundle in use, or 0 for the one inside the APK. */
    fun activeVersion(c: Context): Long = prefs(c).getLong(K_VERSION, 0)

    /**
     * Folder to serve the page from for one page load, or null for the bundled assets.
     * Counts the load; [confirm] (called by the page once it has drawn) clears the count.
     */
    @Synchronized
    fun rootForLoad(c: Context): File? {
        val p = prefs(c)
        val stamp = apkStamp(c)
        if (p.getLong(K_APK, -1) != stamp) {
            // A new APK ships newer files than any bundle downloaded for the old one.
            otaDir(c).deleteRecursively()
            p.edit().clear().putLong(K_APK, stamp).apply()
            return null
        }
        val v = p.getLong(K_VERSION, 0)
        if (v <= 0) return null
        val dir = bundleDir(c, v)
        val unconfirmed = p.getInt(K_UNCONFIRMED, 0)
        if (!File(dir, "index.html").isFile || unconfirmed >= MAX_UNCONFIRMED_LOADS) {
            // It never finished starting: fall back to the built-in UI and don't fetch it again.
            dir.deleteRecursively()
            p.edit().putLong(K_BAD, v).putLong(K_VERSION, 0).putInt(K_UNCONFIRMED, 0).apply()
            return null
        }
        p.edit().putInt(K_UNCONFIRMED, unconfirmed + 1).apply()
        return dir
    }

    /** The page started fine. */
    fun confirm(c: Context) { prefs(c).edit().putInt(K_UNCONFIRMED, 0).apply() }

    /**
     * Looks for a newer bundle in the background (at most every [CHECK_EVERY_MS]). When one has
     * been installed, [ready] runs on the main thread with its version.
     */
    fun checkAsync(c: Context, ready: (Long) -> Unit) {
        val ctx = c.applicationContext
        val p = prefs(ctx)
        val now = System.currentTimeMillis()
        if (now - p.getLong(K_LAST_CHECK, 0) in 0 until CHECK_EVERY_MS) return
        if (!checking.compareAndSet(false, true)) return
        p.edit().putLong(K_LAST_CHECK, now).apply()
        Thread({
            try {
                val v = fetchAndInstall(ctx)
                if (v > 0) main.post { ready(v) }
            } catch (e: Exception) {
                // Offline or a bad download: try again at the next check.
            } finally {
                checking.set(false)
            }
        }, "ante-ota").start()
    }

    private fun fetchAndInstall(c: Context): Long {
        // Make sure a fresh APK has wiped old bundles before comparing versions.
        if (prefs(c).getLong(K_APK, -1) != apkStamp(c)) rootForLoad(c)
        val text = String(get(MANIFEST_URL, MAX_MANIFEST.toLong()), Charsets.UTF_8)
        val m: OtaManifest = OtaCore.parse(text, BASE) ?: return 0
        if (!OtaCore.verify(m, PUBLIC_KEY)) return 0
        val p = prefs(c)
        // Compare with the highest version this phone ever installed, not just the current one,
        // so an old (validly signed) bundle can't be replayed after a fallback or a reinstall.
        val floor = maxOf(p.getLong(K_VERSION, 0), high(c).getLong(K_HIGH, 0))
        if (!OtaCore.shouldInstall(m, floor, NATIVE_API, p.getLong(K_BAD, 0))) return 0
        val zip = get(m.url, OtaCore.MAX_ZIP)
        if (zip.size.toLong() != m.size || OtaCore.sha256Hex(zip) != m.sha256) return 0
        val tmp = File(otaDir(c), "v${m.version}.tmp").apply { deleteRecursively(); mkdirs() }
        if (!OtaCore.unzip(zip, tmp)) { tmp.deleteRecursively(); return 0 }
        val dest = bundleDir(c, m.version)
        dest.deleteRecursively()
        if (!tmp.renameTo(dest)) { tmp.deleteRecursively(); return 0 }
        synchronized(this) {
            val old = p.getLong(K_VERSION, 0)
            p.edit().putLong(K_VERSION, m.version).putInt(K_UNCONFIRMED, 0).apply()
            high(c).edit().putLong(K_HIGH, maxOf(m.version, high(c).getLong(K_HIGH, 0))).commit()
            // Keep the previous bundle until the next install, in case a page still has it open.
            otaDir(c).listFiles()?.forEach { f -> if (f != dest && f.name != "v$old") f.deleteRecursively() }
        }
        return m.version
    }

    /** HTTPS GET with a size cap. Redirects (GitHub sends release files to its CDN) must stay on HTTPS. */
    private fun get(url: String, max: Long): ByteArray {
        var target = URL(url)
        repeat(5) {
            require(target.protocol == "https")
            val conn = target.openConnection() as HttpURLConnection
            conn.instanceFollowRedirects = false
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS
            conn.setRequestProperty("Accept", "application/octet-stream")
            try {
                val code = conn.responseCode
                if (code in 300..399) {
                    target = URL(target, conn.getHeaderField("Location") ?: error("redirect without location"))
                    return@repeat
                }
                if (code != 200) error("HTTP $code")
                val out = ByteArrayOutputStream()
                conn.inputStream.use { input ->
                    val buf = ByteArray(16 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        if (out.size() > max) error("too large")
                    }
                }
                return out.toByteArray()
            } finally {
                conn.disconnect()
            }
        }
        error("too many redirects")
    }
}
