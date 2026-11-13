package com.example.agrosense

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/** Casca Android mínima: exibe o React local. Autenticação e regras ficam no TypeScript. */
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var provisioning: DeviceProvisioning
    private var locationPrompt: GeolocationPermissions.Callback? = null
    private val localOrigin = "https://appassets.androidplatform.net"
    private val locationPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        locationPrompt?.invoke(localOrigin, hasLocationPermission(), false)
        locationPrompt = null
    }

    private fun hasLocationPermission() =
        checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
        webView = findViewById(R.id.appWebView)
        val container = findViewById<android.view.View>(R.id.appContainer)
        ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(container)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setGeolocationEnabled(true)
        }
        // Somente o React empacotado pode solicitar localização. A WebView não memoriza a autorização.
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                when {
                    origin != localOrigin || locationPrompt != null -> callback.invoke(origin, false, false)
                    hasLocationPermission() -> callback.invoke(origin, true, false)
                    else -> {
                        locationPrompt = callback
                        locationPermissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    }
                }
            }
        }
        
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.scheme != "https" || request.url.host != "appassets.androidplatform.net"
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
        provisioning = DeviceProvisioning(this) { message ->
            if (!isDestroyed) webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('agrosense-ble',{detail:$message}))", null,
            )
        }
        val allowedOrigins = setOf(localOrigin)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addWebMessageListener(webView, "AgroSenseNativeBle", allowedOrigins) { _, message, _, isMainFrame, _ ->
                if (isMainFrame) message.data?.let { provisioning.dispatch(it) }
            }
            WebViewCompat.addDocumentStartJavaScript(webView, """
                if (window === window.top && window.AgroSenseNativeBle) {
                  const post = (message) => window.AgroSenseNativeBle.postMessage(JSON.stringify(message));
                  window.AgroSenseBle = Object.freeze({
                    scan: (role) => post({action:'scan', role}),
                    connect: (id) => post({action:'connect', id}),
                    send: (json) => post({action:'send', json}),
                    disconnect: () => post({action:'disconnect'})
                  });
                }
            """.trimIndent(), allowedOrigins)
        }
        webView.loadUrl("https://appassets.androidplatform.net/assets/agrosense/index.html")
    }

    override fun onDestroy() {
        if (::provisioning.isInitialized) provisioning.close()
        webView.destroy()
        super.onDestroy()
    }
}
