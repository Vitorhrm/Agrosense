import type { User } from "@supabase/supabase-js"
import { getSupabase } from "../../lib/supabase"
import type { AuthUser, SignupResult } from "./auth.types"

function toAuthUser(user: User): AuthUser {
  const metadata = user.user_metadata
  return {
    id: user.id,
    email: user.email ?? "",
    firstName: String(metadata.first_name ?? metadata.name ?? ""),
    lastName: String(metadata.last_name ?? metadata.lastName ?? ""),
  }
}

/** A UI só recebe o perfil. O SDK cuida de tokens, renovação e persistência. */
export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
    return toAuthUser(data.user)
  },
  async signup(email: string, password: string, firstName: string, lastName: string): Promise<SignupResult> {
    if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.")
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(), password,
      options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
    })
    if (error) throw error
    // Um usuário criado sem sessão ainda precisa confirmar o e-mail.
    return { user: data.session && data.user ? toAuthUser(data.user) : null, requiresEmailConfirmation: !data.session }
  },
  async logout(): Promise<void> {
    const { error } = await getSupabase().auth.signOut({ scope: "local" })
    if (error) throw error
  },
  async getSession(): Promise<AuthUser | null> {
    const { data, error } = await getSupabase().auth.getSession()
    if (error) throw error
    return data.session ? toAuthUser(data.session.user) : null
  },
  subscribe(listener: (user: AuthUser | null) => void): () => void {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      listener(session ? toAuthUser(session.user) : null)
    })
    return () => data.subscription.unsubscribe()
  },
}
