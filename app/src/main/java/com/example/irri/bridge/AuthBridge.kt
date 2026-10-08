package com.example.irri.bridge

import android.net.Uri
import android.webkit.WebView
import androidx.lifecycle.LifecycleCoroutineScope
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebViewCompat
import com.example.irri.controller.AuthRepository
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Decodifica mensagens da origem local; autenticação e validação ficam no repository. */
class AuthBridge(private val scope: LifecycleCoroutineScope) : WebViewCompat.WebMessageListener {
    private val repository = AuthRepository()
    override fun onPostMessage(view: WebView, message: WebMessageCompat, sourceOrigin: Uri, isMainFrame: Boolean, replyProxy: JavaScriptReplyProxy) {
        if (!isMainFrame || sourceOrigin.toString() != ORIGIN) return
        val data = message.data ?: return
        if (data.length > 8192) return
        // Mensagens malformadas são ignoradas sem registrar possíveis credenciais.
        val json = runCatching { JSONObject(data) }.getOrNull() ?: return
        val callbackId = json.optString("callbackId")
        if (!callbackId.matches(Regex("[a-zA-Z0-9-]{1,80}"))) return
        val payload = json.optJSONObject("payload")
        fun field(name: String) = payload?.optString(name) ?: ""
        scope.launch {
            try {
                val result: Result<*> = when (json.optString("type")) {
                    "login" -> repository.login(field("email"), field("pass"))
                    "signup" -> repository.signup(field("email"), field("pass"), field("name"), field("lastName"))
                    "logout" -> repository.logout()
                    "getSession" -> repository.getSession()
                    else -> Result.failure<Any>(Exception("Operação não reconhecida."))
                }
                send(callbackId, result, replyProxy)
            } catch (_: TimeoutCancellationException) {
                send(callbackId, Result.failure<Any>(Exception("O serviço demorou para responder. Tente novamente.")), replyProxy)
            }
        }
    }
    private fun send(callbackId: String, result: Result<*>, reply: JavaScriptReplyProxy) {
        val response = JSONObject().apply {
            put("callbackId", callbackId)
            put("success", result.isSuccess)
            if (result.isSuccess) {
                val data = result.getOrNull()
                put("data", if (data == null || data == Unit) JSONObject.NULL else JSONObject.wrap(data))
            } else put("error", result.exceptionOrNull()?.message ?: "Não foi possível concluir a operação.")
        }
        // O documento pode ter sido destruído enquanto a requisição estava em andamento.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            runCatching { reply.postMessage(response.toString()) }
        }
    }
    companion object { const val ORIGIN = "https://appassets.androidplatform.net" }
}

