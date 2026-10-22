import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn() }))
vi.mock("../../lib/supabase", () => ({ getSupabase: () => ({ auth: mocks }) }))
import { authService } from "./auth.service"
const user = { id: "test-id", email: "test@example.com", user_metadata: { first_name: "Ana", last_name: "Silva" } }
beforeEach(() => vi.resetAllMocks())
describe("contrato com o Supabase", () => {
  it("envia as credenciais e converte o perfil", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user }, error: null })
    expect(await authService.login(" test@example.com ", "senha-segura")).toEqual({ id: "test-id", email: "test@example.com", firstName: "Ana", lastName: "Silva" })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "test@example.com", password: "senha-segura" })
  })
  it("propaga rejeição de credenciais", async () => {
    const error = new Error("invalid_credentials")
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error })
    await expect(authService.login("test@example.com", "errada")).rejects.toBe(error)
  })
  it("não autentica cadastro que exige confirmação de email", async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: null }, error: null })
    expect(await authService.signup("test@example.com", "senha-segura", "Ana", "Silva")).toEqual({ user: null, requiresEmailConfirmation: true })
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "test@example.com", password: "senha-segura", options: { data: { first_name: "Ana", last_name: "Silva" } } })
  })
  it("aceita cadastro com sessão quando o provedor a retorna", async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: { user } }, error: null })
    expect((await authService.signup("test@example.com", "senha-segura", "Ana", "Silva")).user?.id).toBe("test-id")
  })
  it("rejeita senha curta antes de chamar a rede", async () => {
    await expect(authService.signup("test@example.com", "123", "Ana", "Silva")).rejects.toThrow("8 caracteres")
    expect(mocks.signUp).not.toHaveBeenCalled()
  })
  it("restaura sessão e responde à ausência de sessão", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: { user } }, error: null }).mockResolvedValueOnce({ data: { session: null }, error: null })
    expect((await authService.getSession())?.id).toBe("test-id")
    expect(await authService.getSession()).toBeNull()
  })
  it("encerra somente a sessão deste dispositivo", async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    await authService.logout()
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" })
  })
  it("não ignora falha no logout", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("offline") })
    await expect(authService.logout()).rejects.toThrow("offline")
  })
  it("observa expiração e libera a assinatura ao desmontar", () => {
    const unsubscribe = vi.fn()
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
    const listener = vi.fn()
    const stop = authService.subscribe(listener)
    const callback = mocks.onAuthStateChange.mock.calls[0][0]
    callback("SIGNED_IN", { user }); callback("SIGNED_OUT", null)
    expect(listener).toHaveBeenLastCalledWith(null)
    stop(); expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
