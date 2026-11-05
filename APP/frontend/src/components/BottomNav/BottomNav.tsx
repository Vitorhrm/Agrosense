import { Bell, CloudRain, Home, Map, User } from "lucide-react"
import type { Screen, IconType } from "../../types/navigation"
import "./BottomNav.css"

export function BottomNav({
  screen,
  go,
}: {
  screen: Screen
  go: (screen: Screen) => void
}) {
  const items: {
    label: string
    icon: IconType
    screen: Screen
    badge?: string
  }[] = [
    { label: "Início", icon: Home, screen: "home" },
    { label: "Áreas", icon: Map, screen: "areas" },
    { label: "Clima", icon: CloudRain, screen: "weather" },
    { label: "Alertas", icon: Bell, screen: "alerts", badge: "2" },
    { label: "Perfil", icon: User, screen: "profile" },
  ]
  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const active =
          screen === item.screen ||
          (item.screen === "areas" &&
            ["area", "station", "new-area", "new-station", "crop"].includes(
              screen,
            )) ||
          (item.screen === "weather" && screen === "weather-detail")
        const Icon = item.icon
        return (
          <button
            key={item.label}
            className={active ? "active" : ""}
            onClick={() => go(item.screen)}
          >
            <span className="nav-icon">
              <Icon size={21} strokeWidth={active ? 2.5 : 2} />
              {item.badge && <i>{item.badge}</i>}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
