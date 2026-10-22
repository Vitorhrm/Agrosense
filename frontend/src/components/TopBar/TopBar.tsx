import { type ReactNode } from "react"
import { ArrowLeft, Bell } from "lucide-react"
import { Logo } from "../../components/Logo/Logo"
import "./TopBar.css"

export function TopBar({
  title,
  subtitle,
  back,
  onBack,
  action,
}: {
  title: string
  subtitle?: string
  back?: boolean
  onBack?: () => void
  action?: ReactNode
}) {
  return (
    <header className="top-bar">
      <div className="top-leading">
        {back ? (
          <button className="icon-button" onClick={onBack} aria-label="Voltar">
            <ArrowLeft size={21} />
          </button>
        ) : (
          <Logo compact />
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action || (
        <button
          className="icon-button notification-button"
          aria-label="Notificações"
        >
          <Bell size={20} />
          <span />
        </button>
      )}
    </header>
  )
}
