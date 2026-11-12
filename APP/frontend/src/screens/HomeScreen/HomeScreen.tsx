import { AlertCircle, Check, ChevronRight, Droplets, Leaf, Plus, RadioTower } from "lucide-react"
import { Button } from "../../components/Button/Button"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { AreaCard } from "../../components/AreaCard/AreaCard"
import type { Screen } from "../../types/navigation"
import type { AuthUser } from "../../features/auth/auth.types"
import { areas } from "../../data/demo"
import "./HomeScreen.css"

export function HomeScreen({ go, user, onOpenArea }: { onOpenArea: (name: string) => void, go: (screen: Screen) => void, user: AuthUser | null }) {
  return (
    <AppShell screen="home" go={go}>
      <TopBar title={`Olá, ${user?.firstName || 'Produtor'}`} subtitle="Hoje" />
      <section className="page">
        <Button icon={RadioTower} full onClick={() => go("telemetry")}>
          Telemetria das estações
        </Button>
        <Button variant="secondary" icon={Leaf} full onClick={() => go("crop")}>
          Áreas e culturas
        </Button>
        <button className="attention-banner" onClick={() => go("alerts")}>
          <span>
            <AlertCircle size={21} />
          </span>
          <div>
            <strong>2 alertas precisam da sua atenção</strong>
            <p>1 estação offline e 1 umidade crítica</p>
          </div>
          <ChevronRight size={20} />
        </button>
        <div className="summary-weather">
          <div>
            <span>VISÃO GERAL</span>
            <strong>Como estão suas áreas hoje</strong>
          </div>
          <div className="mini-summary">
            <span>
              <Check size={15} /> 1 estável
            </span>
            <span>
              <Droplets size={15} /> 1 irrigar
            </span>
          </div>
        </div>
        <div className="section-title">
          <div>
            <span>MINHAS ÁREAS</span>
            <p>3 áreas cadastradas</p>
          </div>
          <button onClick={() => go("areas")}>Ver todas</button>
        </div>
        <div className="cards-stack">
          {areas.slice(0, 2).map((area) => (
            <AreaCard key={area.name} area={area} open={() => onOpenArea(area.name)} />
          ))}
        </div>
        <Button
          variant="secondary"
          icon={Plus}
          full
          onClick={() => go("new-area")}
        >
          Nova área
        </Button>
      </section>
    </AppShell>
  )
}
