package com.example.irri.controller

import android.util.Patterns
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

/** Regras de autenticação independentes da Activity e da interface React. */
class AuthRepository {
    private class InvalidInput(message: String) : Exception(message)
    private fun validateInput(valid: Boolean, message: () -> String) { if (!valid) throw InvalidInput(message()) }
    private val mutex = Mutex()
    private fun configuredClient() = SupabaseController.client
        ?: throw IllegalStateException("Configure a chave pública do Supabase em local.properties.")

    private suspend fun session(): Map<String, String>? {
        val auth = configuredClient().auth
        // Espera a restauração da sessão persistida antes de decidir qual tela abrir.
        auth.sessionStatus.first { it !is SessionStatus.Initializing }
        val user = auth.currentUserOrNull() ?: return null
        return mapOf(
            "id" to user.id,
            "email" to (user.email ?: ""),
            "firstName" to (user.userMetadata?.get("first_name")?.jsonPrimitive?.contentOrNull ?: ""),
            "lastName" to (user.userMetadata?.get("last_name")?.jsonPrimitive?.contentOrNull ?: "")
        )
    }
    private fun validate(email: String, password: String, signup: Boolean = false) {
        validateInput(email.length <= 254 && Patterns.EMAIL_ADDRESS.matcher(email).matches()) { "Informe um e-mail válido." }
        validateInput(password.isNotBlank() && password.length <= 256) { "Informe uma senha válida." }
        if (signup) validateInput(password.length >= 8) { "A senha deve ter pelo menos 8 caracteres." }
    }
    private suspend fun <T> operation(message: String, block: suspend () -> T): Result<T> = mutex.withLock {
        try { Result.success(withTimeout(30000) { block() }) }
        catch (cancelled: CancellationException) { throw cancelled } // Preserva o cancelamento da Activity.
        catch (invalid: InvalidInput) { Result.failure(IllegalArgumentException(invalid.message ?: "Dados inválidos.")) }
        catch (missing: IllegalStateException) { Result.failure(IllegalStateException("Configure a chave pública do Supabase em local.properties.")) }
        catch (_: Exception) { Result.failure(Exception(message)) } // Não expõe respostas sensíveis do servidor.
    }
    suspend fun getSession(): Result<Map<String, String>?> = operation("Não foi possível recuperar a sessão.") { session() }
    suspend fun login(email: String, pass: String): Result<Map<String, String>> = operation("E-mail ou senha incorretos, ou serviço indisponível.") {
        val normalizedEmail = email.trim()
        validate(normalizedEmail, pass)
        val client = configuredClient()
        session()
        client.auth.signInWith(Email) { this.email = normalizedEmail; password = pass }
        session() ?: throw Exception("Sessão não estabelecida.")
    }
    suspend fun signup(email: String, pass: String, name: String, lastName: String): Result<Map<String, Any?>> = operation("Não foi possível cadastrar. Verifique os dados e tente novamente.") {
        val normalizedEmail = email.trim()
        validate(normalizedEmail, pass, signup = true)
        validateInput(name.trim().length in 1..80 && lastName.trim().length in 1..80) { "Informe nome e sobrenome válidos." }
        val client = configuredClient()
        session()
        client.auth.signUpWith(Email) {
            this.email = normalizedEmail
            password = pass
            data = buildJsonObject { put("first_name", name.trim()); put("last_name", lastName.trim()) }
        }
        val user = session()
        // Confirmação de e-mail é um resultado normal, diferente de falha de cadastro.
        mapOf("user" to user, "requiresEmailConfirmation" to (user == null))
    }
    suspend fun logout(): Result<Unit> = operation("Não foi possível sair da conta. Tente novamente.") { configuredClient().auth.signOut() }
}
