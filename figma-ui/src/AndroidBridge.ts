export interface AuthUser { id: string; email: string; firstName: string; lastName: string }
export interface SignupResult { user: AuthUser | null; requiresEmailConfirmation: boolean }
declare global { interface Window { AndroidBridge?: { postMessage(message: string): void; onmessage: ((event: { data: string }) => void) | null } } }
type Pending = { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Não foi possível concluir a operação." }
function isUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false
  const user = value as Record<string, unknown>
  return ["id", "email", "firstName", "lastName"].every(key => typeof user[key] === "string") && !!user.id
}
/** Tokens permanecem no cliente Kotlin; a ponte devolve somente dados de perfil. */
class AndroidBridgeService {
  private pending = new Map<string, Pending>()
  constructor() {
    if (window.AndroidBridge) window.AndroidBridge.onmessage = event => {
      let value: unknown
      try { value = JSON.parse(event.data) } catch { return }
      if (!value || typeof value !== "object") return
      const response = value as Record<string, unknown>
      if (typeof response.callbackId !== "string") return
      const request = this.pending.get(response.callbackId)
      if (!request) return
      clearTimeout(request.timer)
      this.pending.delete(response.callbackId)
      if (response.success === true) request.resolve(response.data)
      else request.reject(new Error(typeof response.error === "string" ? response.error : "Não foi possível concluir a operação."))
    }
    window.addEventListener("pagehide", () => {
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error("A página foi encerrada.")) }
      this.pending.clear()
    })
  }
  private request(type: string, payload: Record<string, string> = {}): Promise<unknown> {
    const bridge = window.AndroidBridge
    if (!bridge) return Promise.reject(new Error("Autenticação disponível no aplicativo Android. Atualize o Android System WebView se necessário."))
    return new Promise((resolve, reject) => {
      const callbackId = crypto.randomUUID()
      // Evita callbacks presos quando a Activity ou a conexão são encerradas.
      const timer = setTimeout(() => { this.pending.delete(callbackId); reject(new Error("O serviço demorou para responder. Tente novamente.")) }, 35000)
      this.pending.set(callbackId, { resolve, reject, timer })
      try { bridge.postMessage(JSON.stringify({ callbackId, type, payload })) }
      catch { clearTimeout(timer); this.pending.delete(callbackId); reject(new Error("Falha na comunicação com o aplicativo.")) }
    })
  }
  async login(email: string, pass: string): Promise<AuthUser> {
    const result = await this.request("login", { email, pass })
    if (!isUser(result)) throw new Error("Resposta de autenticação inválida.")
    return result
  }
  async signup(email: string, pass: string, name: string, lastName: string): Promise<SignupResult> {
    const value = await this.request("signup", { email, pass, name, lastName })
    if (!value || typeof value !== "object") throw new Error("Resposta de cadastro inválida.")
    const result = value as Record<string, unknown>
    if (result.requiresEmailConfirmation === true) return { user: null, requiresEmailConfirmation: true }
    if (!isUser(result.user)) throw new Error("Sessão de cadastro inválida.")
    return { user: result.user, requiresEmailConfirmation: false }
  }
  async logout(): Promise<void> { await this.request("logout") }
  async getSession(): Promise<AuthUser | null> {
    const result = await this.request("getSession")
    if (result === null) return null
    if (!isUser(result)) throw new Error("Resposta de sessão inválida.")
    return result
  }
}
export const bridgeService = new AndroidBridgeService()
