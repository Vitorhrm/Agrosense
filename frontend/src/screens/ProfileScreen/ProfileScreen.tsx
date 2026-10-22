import { useState } from "react"
import { ChevronRight, History, Leaf, LogOut, Menu, Settings } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { Badge } from "../../components/Badge/Badge"
import type { Screen } from "../../types/navigation"
import type { AuthUser } from "../../features/auth/auth.types"
import { authService } from "../../features/auth/auth.service"
import { errorMessage } from "../../features/auth/auth.errors"
import "./ProfileScreen.css"

export function ProfileScreen({ go, user, onLogout }: { go: (screen: Screen) => void, user: AuthUser | null, onLogout: () => void }) {
  const menu = [
    [History, "Histórico de recomendações", "history"],
    [Leaf, "Parâmetros das culturas", "crop"],
  ] as const

  const [logoutError, setLogoutError] = useState("")
  const [loggingOut, setLoggingOut] = useState(false)
  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError("")
    try {
      await authService.logout()
      onLogout()
    } catch (e: unknown) {
      setLogoutError(errorMessage(e))
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <AppShell screen="profile" go={go}>
      <TopBar
        title="Perfil"
        subtitle="Sua conta e configurações"
        action={
          <button className="icon-button">
            <Menu size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="profile-card">
          <div className="avatar">{user?.firstName?.[0] || "U"}{user?.lastName?.[0] || ""}</div>
          <div>
            <h2>{user?.firstName} {user?.lastName}</h2>
            <p>{user?.email}</p>
            <Badge tone="success">Produtor conectado</Badge>
          </div>
          <button>
            <Settings size={18} />
          </button>
        </div>
        <div className="profile-stats">
          <div>
            <strong>3</strong>
            <span>Áreas</span>
          </div>
          <div>
            <strong>9</strong>
            <span>Estações</span>
          </div>
          <div>
            <strong className="green-text">8</strong>
            <span>Online</span>
          </div>
          <div>
            <strong className="red-text">1</strong>
            <span>Offline</span>
          </div>
        </div>
        <div className="section-title">
          <div>
            <span>CONTA E DADOS</span>
          </div>
        </div>
        <div className="menu-list">
          {menu.map(([Icon, label, target]) => (
            <button key={label} onClick={() => go(target)}>
              <span>
                <Icon size={19} />
              </span>
              <strong>{label}</strong>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        {logoutError && <div className="inline-alert" role="alert">{logoutError}</div>}
        <button className="logout-button" onClick={handleLogout} disabled={loggingOut}>
          <LogOut size={19} /> {loggingOut ? "Saindo..." : "Sair da conta"}
        </button>
        <p className="app-version">
          AgroSense · Versão 1.0.0
          <br />
          Projeto acadêmico de monitoramento agrícola
        </p>
      </section>
    </AppShell>
  )
}
