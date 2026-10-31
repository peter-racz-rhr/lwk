package com.ante.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.webkit.WebView

/**
 * Covers a limited app. Runs in its own task so Back can never land in the blocked app.
 */
class BlockActivity : Activity() {
    private var web: WebView? = null
    private var pkg: String? = null
    private var note: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Bank.init(this)
        readIntent(intent)
        web = WebHost.attach(this, mode = "block", blockedPkg = { pkg }, blockNote = { note })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readIntent(intent)
        web?.loadUrl(WebHost.START_URL)
    }

    override fun onResume() {
        super.onResume()
        visiblePkg = pkg
        WebHost.refresh(web)
    }

    override fun onPause() {
        visiblePkg = null
        super.onPause()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val w = web
        if (w == null) {
            goHome()
            return
        }
        // Back leaves a table first; from the block screen itself it goes home, never into the app.
        w.evaluateJavascript("window.anteBack ? window.anteBack() : false") { handled ->
            if (handled != "true") goHome()
        }
    }

    override fun onDestroy() {
        web?.destroy()
        web = null
        super.onDestroy()
    }

    private fun goHome() {
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    private fun readIntent(i: Intent?) {
        pkg = i?.getStringExtra(EXTRA_PKG)
        note = i?.getStringExtra(EXTRA_NOTE)
    }

    companion object {
        const val EXTRA_PKG = "pkg"
        const val EXTRA_NOTE = "note"

        /** Package currently covered by a visible block screen, used to avoid stacking duplicates. */
        @Volatile
        var visiblePkg: String? = null
            private set

        fun show(context: Context, pkg: String, note: String?) {
            if (visiblePkg == pkg && note == null) return
            val i = Intent(context, BlockActivity::class.java)
                .putExtra(EXTRA_PKG, pkg)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            if (note != null) i.putExtra(EXTRA_NOTE, note)
            context.startActivity(i)
        }
    }
}
