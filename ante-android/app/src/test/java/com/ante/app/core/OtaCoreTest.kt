package com.ante.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class OtaCoreTest {
    private val prefix = "https://github.com/o/r/releases/download/web-latest/"
    private val keys = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private val pub = Base64.getEncoder().encodeToString(keys.public.encoded)

    private fun zipOf(vararg files: Pair<String, String>): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { z -> files.forEach { (n, c) -> z.putNextEntry(ZipEntry(n)); z.write(c.toByteArray()); z.closeEntry() } }
        return out.toByteArray()
    }

    private fun signed(version: Long = 100, minNative: Int = 1, zip: ByteArray = zipOf("index.html" to "<p>"), url: String = prefix + "web-$version.zip"): String {
        val sha = OtaCore.sha256Hex(zip)
        val m = OtaManifest(version, minNative, url, sha, zip.size.toLong(), "")
        val sig = Signature.getInstance("SHA256withECDSA").apply { initSign(keys.private); update(OtaCore.payload(m).toByteArray()) }.sign()
        return """{"version":$version,"minNative":$minNative,"url":"$url","sha256":"$sha","size":${zip.size},"sig":"${Base64.getEncoder().encodeToString(sig)}"}"""
    }

    @Test fun `a correctly signed manifest parses and verifies`() {
        val m = OtaCore.parse(signed(), prefix)
        assertNotNull(m)
        assertTrue(OtaCore.verify(m!!, pub))
    }

    @Test fun `changing any signed field breaks the signature`() {
        val good = OtaCore.parse(signed(), prefix)!!
        assertFalse(OtaCore.verify(good.copy(version = 101), pub))
        assertFalse(OtaCore.verify(good.copy(minNative = 0), pub))
        assertFalse(OtaCore.verify(good.copy(sha256 = "0".repeat(64)), pub))
        assertFalse(OtaCore.verify(good.copy(size = good.size + 1), pub))
        assertFalse(OtaCore.verify(good.copy(url = prefix + "other.zip"), pub))
    }

    @Test fun `a manifest signed by another key is rejected`() {
        val other = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
        val m = OtaCore.parse(signed(), prefix)!!
        assertFalse(OtaCore.verify(m, Base64.getEncoder().encodeToString(other.public.encoded)))
        assertFalse(OtaCore.verify(m, "not a key"))
        assertFalse(OtaCore.verify(m.copy(sig = "AAAA"), pub))
    }

    @Test fun `manifests with bad fields or foreign urls are refused`() {
        assertNull(OtaCore.parse("not json", prefix))
        assertNull(OtaCore.parse(signed(url = "https://evil.example/web.zip"), prefix))
        assertNull(OtaCore.parse(signed(url = "http://github.com/o/r/releases/download/web-latest/x.zip"), prefix))
        assertNull(OtaCore.parse(signed(url = prefix + "../x.zip"), prefix))
        assertNull(OtaCore.parse(signed(version = 0), prefix))
        assertNull(OtaCore.parse(signed().replace("\"sha256\":\"", "\"sha256\":\"zz"), prefix))
    }

    @Test fun `only newer bundles that fit this app are installed`() {
        val m = OtaCore.parse(signed(version = 200, minNative = 2), prefix)!!
        assertTrue(OtaCore.shouldInstall(m, current = 100, nativeApi = 2, bad = 0))
        assertFalse(OtaCore.shouldInstall(m, current = 200, nativeApi = 2, bad = 0))
        assertFalse(OtaCore.shouldInstall(m, current = 100, nativeApi = 1, bad = 0))
        assertFalse(OtaCore.shouldInstall(m, current = 100, nativeApi = 2, bad = 200))
    }

    @Test fun `unzip writes the bundle`() {
        val dir = Files.createTempDirectory("ota").toFile()
        assertTrue(OtaCore.unzip(zipOf("index.html" to "<p>hi", "js/app.js" to "x"), dir))
        assertEquals("<p>hi", File(dir, "index.html").readText())
        assertEquals("x", File(dir, "js/app.js").readText())
    }

    @Test fun `unzip refuses paths that escape the folder`() {
        val dir = Files.createTempDirectory("ota").toFile()
        assertFalse(OtaCore.unzip(zipOf("index.html" to "a", "../evil.txt" to "x"), dir))
        assertFalse(File(dir.parentFile, "evil.txt").exists())
        assertFalse(OtaCore.unzip(zipOf("index.html" to "a", "/abs.txt" to "x"), Files.createTempDirectory("ota").toFile()))
    }

    @Test fun `unzip needs an index page and stays under the size limit`() {
        assertFalse(OtaCore.unzip(zipOf("js/app.js" to "x"), Files.createTempDirectory("ota").toFile()))
        val big = "x".repeat((OtaCore.MAX_UNPACKED + 1).toInt())
        assertFalse(OtaCore.unzip(zipOf("index.html" to "a", "big.bin" to big), Files.createTempDirectory("ota").toFile()))
    }

    @Test fun `served paths cannot leave the bundle`() {
        assertEquals("index.html", OtaCore.safeRelPath("/web/index.html"))
        assertEquals("js/app.js", OtaCore.safeRelPath("/web/js/app.js"))
        assertNull(OtaCore.safeRelPath("/web/../secret"))
        assertNull(OtaCore.safeRelPath("/other/index.html"))
        assertNull(OtaCore.safeRelPath("/web/"))
        assertNull(OtaCore.safeRelPath("/web/a\\b"))
    }
}
