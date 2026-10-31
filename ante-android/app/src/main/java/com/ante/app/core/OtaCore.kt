package com.ante.app.core

import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import java.util.zip.ZipInputStream

/** A published UI bundle: what to download, its checksum, and the signature over all of it. */
data class OtaManifest(
    val version: Long,
    /** Lowest [com.ante.app.Ota.NATIVE_API] this bundle works with. */
    val minNative: Int,
    val url: String,
    val sha256: String,
    val size: Long,
    val sig: String,
)

/**
 * Pure rules for over-the-air UI updates, kept free of Android so they are unit tested.
 * Nothing is trusted until [verify] passes with the public key built into the app.
 */
object OtaCore {
    const val MAX_ZIP = 8L * 1024 * 1024
    const val MAX_UNPACKED = 24L * 1024 * 1024
    const val MAX_FILES = 400
    private val HEX64 = Regex("^[0-9a-f]{64}$")
    private val ZIP_NAME = Regex("^[A-Za-z0-9._-]+\\.zip$")
    private val SAFE_SEGMENT = Regex("^[A-Za-z0-9._-]+$")

    /** The exact text that is signed. Every field is in it, so none can be swapped. */
    fun payload(m: OtaManifest) = "ante-web|${m.version}|${m.minNative}|${m.sha256}|${m.size}|${m.url}"

    fun parse(json: String, urlPrefix: String): OtaManifest? = try {
        val o = JSONObject(json)
        val m = OtaManifest(
            version = o.getLong("version"),
            minNative = o.getInt("minNative"),
            url = o.getString("url"),
            sha256 = o.getString("sha256"),
            size = o.getLong("size"),
            sig = o.getString("sig"),
        )
        val name = m.url.removePrefix(urlPrefix)
        val ok = m.version > 0 && m.minNative >= 0 && HEX64.matches(m.sha256) && m.size in 1..MAX_ZIP &&
            urlPrefix.startsWith("https://") && m.url.startsWith(urlPrefix) && ZIP_NAME.matches(name) && m.sig.isNotBlank()
        if (ok) m else null
    } catch (e: Exception) {
        null
    }

    /** ECDSA P-256 / SHA-256 over [payload], with the app's public key (X.509, base64). */
    fun verify(m: OtaManifest, publicKeyB64: String): Boolean = try {
        val key = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(publicKeyB64)))
        Signature.getInstance("SHA256withECDSA").run {
            initVerify(key)
            update(payload(m).toByteArray(Charsets.UTF_8))
            verify(Base64.getDecoder().decode(m.sig))
        }
    } catch (e: Exception) {
        false
    }

    /** Newer than what runs now, made for this app's native side, and not one that failed before. */
    fun shouldInstall(m: OtaManifest, current: Long, nativeApi: Int, bad: Long): Boolean =
        m.version > current && m.minNative <= nativeApi && m.version != bad

    fun sha256Hex(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    /** Unpacks into [dir] (which should be empty). Refuses escaping paths, oversized bundles, and bundles without index.html. */
    fun unzip(zip: ByteArray, dir: File): Boolean {
        val root = dir.canonicalFile
        var total = 0L
        var count = 0
        try {
            ZipInputStream(ByteArrayInputStream(zip)).use { z ->
                while (true) {
                    val e = z.nextEntry ?: break
                    if (++count > MAX_FILES) return false
                    val rel = e.name.replace('\\', '/')
                    if (rel.startsWith("/") || rel.split('/').any { it == ".." }) return false
                    val out = File(root, rel).canonicalFile
                    if (!out.path.startsWith(root.path + File.separator)) return false
                    if (e.isDirectory) { out.mkdirs(); continue }
                    out.parentFile?.mkdirs()
                    out.outputStream().use { o ->
                        val buf = ByteArray(16 * 1024)
                        while (true) {
                            val n = z.read(buf)
                            if (n < 0) break
                            total += n
                            if (total > MAX_UNPACKED) return false
                            o.write(buf, 0, n)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            return false
        }
        return File(root, "index.html").isFile
    }

    /** Maps a request path like /web/js/app.js to a bundle-relative path, or null if it is not a plain path inside /web/. */
    fun safeRelPath(path: String): String? {
        if (!path.startsWith("/web/")) return null
        val rel = path.removePrefix("/web/")
        if (rel.isEmpty()) return null
        val parts = rel.split('/')
        return if (parts.all { it.isNotEmpty() && it != "." && it != ".." && SAFE_SEGMENT.matches(it) }) rel else null
    }
}
