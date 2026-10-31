package com.ante.app

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView

/** Ante's own screen: today's limits, the app picker and the tables. */
class MainActivity : Activity() {
    private var web: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Bank.init(this)
        web = WebHost.attach(this, mode = "main")
    }

    override fun onResume() {
        super.onResume()
        // Coming back from Settings or from a limited app: show fresh numbers and permission state.
        WebHost.refresh(web)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val w = web
        if (w == null) {
            @Suppress("DEPRECATION")
            super.onBackPressed()
            return
        }
        // Let the page close a sheet or leave a table first; finish only when it has nothing to close.
        w.evaluateJavascript("window.anteBack ? window.anteBack() : false") { handled ->
            if (handled != "true") finish()
        }
    }

    override fun onDestroy() {
        web?.let { (it.parent as? ViewGroup)?.removeView(it); it.destroy() }
        web = null
        super.onDestroy()
    }
}
