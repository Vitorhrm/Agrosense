package com.example.irri.controller

import android.util.Base64
import com.example.irri.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.postgrest.Postgrest
import org.json.JSONObject

/** Cliente compartilhado. Configure somente a chave pública publishable/anon em local.properties. */
object SupabaseController {
    private fun isPublicKey(key: String): Boolean {
        if (key.startsWith("sb_publishable_")) return true
        // Chaves JWT antigas só são aceitas quando a função declarada é anon.
        return runCatching {
            val payload = key.split('.')[1]
            JSONObject(String(Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP))).optString("role") == "anon"
        }.getOrDefault(false)
    }
    val client: SupabaseClient? by lazy {
        val url = BuildConfig.SUPABASE_URL
        val key = BuildConfig.SUPABASE_ANON_KEY
        if (!url.startsWith("https://") || !isPublicKey(key)) null
        else createSupabaseClient(supabaseUrl = url, supabaseKey = key) { install(Auth); install(Postgrest) }
    }
}
