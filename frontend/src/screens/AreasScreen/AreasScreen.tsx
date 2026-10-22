import { Plus } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { AreaCard } from "../../components/AreaCard/AreaCard"
import type { Screen } from "../../types/navigation"
import { areas } from "../../data/demo"
import "./AreasScreen.css"

export function AreasScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="areas" go={go}>
      <TopBar
        title="Áreas"
        subtitle="3 áreas · 9 estações"
        action={
          <button className="icon-button" onClick={() => go("new-area")}>
            <Plus size={21} />
          </button>
        }
      />
      <section className="page">
        <div className="filter-row">
          <button className="chip active">Todas</button>
          <button className="chip">Precisam de ação</button>
          <button className="chip">Normais</button>
        </div>
        <div className="cards-stack">
          {areas.map((area) => (
            <AreaCard key={area.name} area={area} open={() => go("area")} />
          ))}
        </div>
      </section>
    </AppShell>
  )
}
