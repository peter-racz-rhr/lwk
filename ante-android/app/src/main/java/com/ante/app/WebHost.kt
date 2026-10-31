package com.ante.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Build
import android.view.ViewGroup
import android.view.WindowInsets
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

/** Builds the WebView that hosts the bundled UI from `assets/web/`. */
object WebHost {
    const val START_URL = "file:///android_asset/web/index.html"
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
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowContentAccess = false
            settings.allowFileAccess = false
            settings.mediaPlaybackRequiresUserGesture = true
            settings.textZoom = 100
            webViewClient = object : WebViewClient() {
                // The UI is local only. Refuse every navigation and every request outside the bundled files.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    !isBundled(request.url)

                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    if (isBundled(request.url) || request.url.scheme == "data") null
                    else WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), null)
            }
        }
        web.addJavascriptInterface(AnteBridge(activity, web, mode, blockedPkg, blockNote), "AnteNative")
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // targetSdk 35 draws edge to edge, so keep the page clear of the status and navigation bars.
        root.setOnApplyWindowInsetsListener { v, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                val ime = insets.getInsets(WindowInsets.Type.ime())
                v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            } else {
                @Suppress("DEPRECATION")
                v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        activity.setContentView(root)
        web.loadUrl(START_URL)
        return web
    }

    private fun isBundled(uri: Uri): Boolean {
        if (uri.scheme != "file" || !uri.host.isNullOrEmpty()) return false
        val segments = uri.pathSegments
        return segments.size >= 2 && segments[0] == "android_asset" && segments[1] == "web" && ".." !in segments
    }

    fun refresh(web: WebView?) {
        web?.evaluateJavascript("window.anteRefresh && window.anteRefresh()", null)
    }
}
