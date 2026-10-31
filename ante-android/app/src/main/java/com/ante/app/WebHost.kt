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
        web.loadUrl(START_URL)
        return web
    }

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

    private fun isBundled(uri: Uri): Boolean {
        if (uri.scheme != "file" || !uri.host.isNullOrEmpty()) return false
        val segments = uri.pathSegments
        return segments.size >= 2 && segments[0] == "android_asset" && segments[1] == "web" && ".." !in segments
    }

    fun refresh(web: WebView?) {
        web?.evaluateJavascript("window.anteRefresh && window.anteRefresh()", null)
    }
}
