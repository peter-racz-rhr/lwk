package com.ante.app

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/** Lists apps that have a launcher icon, with small PNG icons for the web UI. */
object AppCatalog {
    private const val ICON_PX = 96
    private val iconCache = HashMap<String, String>()

    fun launchableApps(context: Context): JSONArray {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        @Suppress("DEPRECATION")
        val activities = pm.queryIntentActivities(intent, 0)
        val seen = HashSet<String>()
        val rows = activities.mapNotNull { info ->
            val pkg = info.activityInfo?.packageName ?: return@mapNotNull null
            if (pkg == context.packageName || !seen.add(pkg)) return@mapNotNull null
            val label = info.loadLabel(pm)?.toString()?.take(60) ?: pkg
            Triple(pkg, label, info)
        }.sortedBy { it.second.lowercase() }

        val out = JSONArray()
        for ((pkg, label, _) in rows) {
            val cached = synchronized(iconCache) { iconCache[pkg] } ?: ""
            out.put(JSONObject().put("pkg", pkg).put("label", label).put("icon", cached))
        }
        return out
    }

    fun labelFor(context: Context, pkg: String): String = try {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString().take(60)
    } catch (e: Exception) {
        pkg
    }

    fun iconFor(context: Context, pkg: String): String {
        synchronized(iconCache) { iconCache[pkg] }?.let { return it }
        return try {
            encode(context.packageManager.getApplicationIcon(pkg)).also { synchronized(iconCache) { iconCache[pkg] = it } }
        } catch (e: Exception) {
            ""
        }
    }

    private fun encode(d: Drawable): String {
        val bmp = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        d.setBounds(0, 0, ICON_PX, ICON_PX)
        d.draw(c)
        val bytes = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, bytes)
        bmp.recycle()
        return "data:image/png;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
    }
}
