# Keep the JavaScript bridge methods if minification is ever turned on.
-keepclassmembers class com.ante.app.AnteBridge {
    @android.webkit.JavascriptInterface <methods>;
}
