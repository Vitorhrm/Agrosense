import { type ReactNode } from "react"
import { BottomNav } from "../../components/BottomNav/BottomNav"
import type { Screen } from "../../types/navigation"
import "./AppShell.css"

export function AppShell({
  children,
  screen,
  go,
  noNav = false,
}: {
  children: ReactNode
  screen: Screen
  go: (screen: Screen) => void
  noNav?: boolean
}) {
  return (
    <div className="app-shell">
      {["home", "areas", "area", "station", "weather", "weather-detail", "alerts", "history"].includes(screen) &&
        <aside className="demo-notice">Dados agrícolas de demonstração</aside>}
      <main className={noNav ? "app-content no-nav" : "app-content"}>
        {children}
      </main>
      {!noNav && <BottomNav screen={screen} go={go} />}
    </div>
  )
}
