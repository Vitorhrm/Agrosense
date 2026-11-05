import { useState } from "react"
import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail, RadioTower } from "lucide-react"
import { Button } from "../../components/Button/Button"
import { Logo } from "../../components/Logo/Logo"
import { AppShell } from "../../components/AppShell/AppShell"
import type { Screen } from "../../types/navigation"
import type { AuthUser } from "../../features/auth/auth.types"
import { authService } from "../../features/auth/auth.service"
import { errorMessage } from "../../features/auth/auth.errors"
import "./Login.css"

export function Login({ go, onLogin }: { go: (screen: Screen) => void, onLogin: (u: AuthUser) => void }) {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError("")
    setLoading(true)
    try {
      const user = await authService.login(email, password)
      onLogin(user)
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell screen="login" go={go} noNav>
      <section className="auth-hero">
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
        <Logo />
        <div className="hero-visual">
          <div className="sun-dot" />
          <div className="field-line field-a" />
          <div className="field-line field-b" />
          <div className="field-line field-c" />
          <RadioTower size={42} />
          <span className="radio-wave wave-a" />
          <span className="radio-wave wave-b" />
        </div>
      </section>
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="auth-copy">
          <span className="eyebrow">MONITORAMENTO INTELIGENTE</span>
          <h1>Bem-vindo de volta</h1>
          <p>Acompanhe sua lavoura e irrigue com mais confiança.</p>
        </div>
        {error && (
          <div className="inline-alert auth-message" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        <label className="field">
          <span>E-mail</span>
          <div>
            <Mail size={18} />
            <input
              placeholder="seu@email.com"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>Senha</span>
          <div>
            <LockKeyhole size={18} />
            <input
              autoComplete="current-password"
              placeholder="Sua senha"
              type={visible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="field-action"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <Button full type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <p className="auth-switch">
          Ainda não tem conta?{" "}
          <button type="button" onClick={() => go("register")}>Criar conta</button>
        </p>
      </form>
    </AppShell>
  )
}
