package com.ante.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.WindowInsets
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import com.ante.app.core.OtaCore
import java.io.File

/** Builds the WebView that hosts the bundled UI from `assets/web/`. */
object WebHost {
    /** The page lives on a private https origin that never reaches the network: every request is answered below. */
    private const val HOST = "appassets.androidplatform.net"
    const val START_URL = "https://$HOST/web/index.html"
    private const val BG = "#0E1A18"

    @SuppressLint("SetJavaScriptEnabled")
    fun attach(
        activity: Activity,
        mode: String,
        blockedPkg: () -> String? = { null },
        blockNote: () -> String? = { null },
    ): WebView {
        val debuggable = (activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)

        val root = FrameLayout(activity).apply { setBackgroundColor(Color.parseColor(BG)) }
        val web = WebView(activity).apply {
            setBackgroundColor(Color.parseColor(BG))
            overScrollMode = WebView.OVER_SCROLL_NEVER
            // No browser-style scroll thumb: the page scrolls, but it should feel like an app.
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowContentAccess = false
            settings.allowFileAccess = false
            settings.mediaPlaybackRequiresUserGesture = true
            settings.textZoom = 100
            webViewClient = object : WebViewClient() {
                // The UI is local only. Refuse every navigation and every request outside the bundle.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    !(request.url.scheme == "https" && request.url.host == HOST)

                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    if (request.url.scheme == "data") return null
                    return serve(activity, request.url, (view.tag as? Source)?.root)
                }
            }
        }
        web.addJavascriptInterface(AnteBridge(activity, web, mode, blockedPkg, blockNote), "AnteNative")
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // Full screen: the bars are hidden (immersive), so only the camera cutout and the keyboard
        // need room. A swipe from the edge shows the bars over the page for a moment.
        root.setOnApplyWindowInsetsListener { v, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val cut = insets.getInsets(WindowInsets.Type.displayCutout())
                val ime = insets.getInsets(WindowInsets.Type.ime())
                v.setPadding(cut.left, cut.top, cut.right, maxOf(cut.bottom, ime.bottom))
            } else {
                // Below API 30 the keyboard only shows up as a system window inset taller than the
                // stable one (the hidden navigation bar). getDisplayCutout() exists from API 28.
                @Suppress("DEPRECATION")
                val ime = if (insets.systemWindowInsetBottom > insets.stableInsetBottom) insets.systemWindowInsetBottom else 0
                val cut = if (Build.VERSION.SDK_INT >= 28) insets.displayCutout else null
                v.setPadding(cut?.safeInsetLeft ?: 0, cut?.safeInsetTop ?: 0, cut?.safeInsetRight ?: 0, maxOf(cut?.safeInsetBottom ?: 0, ime))
            }
            insets
        }
        activity.setContentView(root)
        immersive(activity)
        load(activity, web)
        return web
    }

    /** Which files a page load uses: a downloaded update, or null for the ones in the APK. */
    private class Source(val root: File?)

    /** (Re)loads the page from the newest installed UI. */
    fun load(activity: Activity, web: WebView) {
        web.tag = Source(Ota.rootForLoad(activity))
        web.loadUrl(START_URL)
    }

    private fun serve(activity: Activity, uri: Uri, root: File?): WebResourceResponse {
        if (uri.scheme != "https" || uri.host != HOST) return blocked()
        val rel = OtaCore.safeRelPath(uri.path ?: "") ?: return blocked()
        return try {
            val stream = if (root != null) {
                val f = File(root, rel)
                if (!f.isFile) return blocked(404)
                f.inputStream()
            } else {
                activity.assets.open("web/$rel")
            }
            val mime = MIME[rel.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
            WebResourceResponse(mime, if (mime.startsWith("text/") || mime.endsWith("javascript")) "utf-8" else null, stream).apply {
                responseHeaders = mapOf("Cache-Control" to "no-store")
            }
        } catch (e: Exception) {
            blocked(404)
        }
    }

    private fun blocked(code: Int = 403) =
        WebResourceResponse("text/plain", "utf-8", code, if (code == 404) "Not found" else "Blocked", emptyMap(), null)

    private val MIME = mapOf(
        "html" to "text/html", "css" to "text/css", "js" to "text/javascript", "json" to "application/json",
        "svg" to "image/svg+xml", "png" to "image/png", "webp" to "image/webp", "jpg" to "image/jpeg",
        "woff2" to "font/woff2", "txt" to "text/plain",
    )

    /** Hides the status and navigation bars. Call again when the window regains focus. */
    fun immersive(activity: Activity) {
        val window = activity.window
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= 30) {
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                } else {
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                it.hide(WindowInsets.Type.systemBars())
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)
        }
    }

    fun refresh(web: WebView?) {
        web?.evaluateJavascript("window.anteRefresh && window.anteRefresh()", null)
    }
}
