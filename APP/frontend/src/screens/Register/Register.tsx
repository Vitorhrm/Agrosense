import { useState } from "react"
import { AlertCircle, Check, LockKeyhole, Mail, Sprout, User } from "lucide-react"
import { Button } from "../../components/Button/Button"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import type { Screen } from "../../types/navigation"
import type { AuthUser } from "../../features/auth/auth.types"
import { authService } from "../../features/auth/auth.service"
import { errorMessage } from "../../features/auth/auth.errors"
import "./Register.css"

export function Register({ go, onLogin }: { go: (screen: Screen) => void, onLogin: (u: AuthUser) => void }) {
  const [name, setName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError("")
    setSuccessMsg("")
    if (password !== confirm) {
      setError("As senhas não coincidem.")
      return
    }
    setLoading(true)
    try {
      const result = await authService.signup(email, password, name, lastName)
      setPassword("")
      setConfirm("")
      if (result.user) onLogin(result.user)
      else setSuccessMsg("Cadastro recebido. Verifique seu e-mail para confirmar a conta e depois faça login.")
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell screen="register" go={go} noNav>
      <TopBar
        title="Criar conta"
        subtitle="Comece a monitorar sua produção"
        back
        onBack={() => go("login")}
        action={<span />}
      />
      <form className="form-page" onSubmit={handleSubmit}>
        <div className="form-intro">
          <div className="intro-icon">
            <Sprout size={26} />
          </div>
          <h2>Sua lavoura, mais conectada</h2>
          <p>Leva menos de um minuto para começar.</p>
        </div>
        {error && (
          <div className="inline-alert auth-message" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="resolved-alert auth-message" role="status">
            <Check size={16} />
            <strong>{successMsg}</strong>
          </div>
        )}
        <label className="field">
          <span>Nome</span>
          <div>
            <User size={18} />
            <input
              placeholder="Como podemos chamar você?"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>Sobrenome</span>
          <div>
            <User size={18} />
            <input
              placeholder="Seu sobrenome"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>E-mail</span>
          <div>
            <Mail size={18} />
            <input
              placeholder="seu@email.com"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>Senha</span>
          <div>
            <LockKeyhole size={18} />
            <input
              placeholder="Mínimo de 8 caracteres"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </label>
        <label className="field">
          <span>Confirmar senha</span>
          <div>
            <LockKeyhole size={18} />
            <input
              placeholder="Repita sua senha"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
        </label>
        <Button full type="submit" disabled={loading}>
          {loading ? "Cadastrando..." : "Criar conta"}
        </Button>
        <p className="terms">
          Ao continuar, você concorda com nossos Termos de Uso e Política de
          Privacidade.
        </p>
      </form>
    </AppShell>
  )
}
