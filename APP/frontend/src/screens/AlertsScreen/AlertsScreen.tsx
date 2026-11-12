import { Check, ChevronRight, CloudRain, Droplets, MapPin, WifiOff } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { Badge } from "../../components/Badge/Badge"
import type { Screen } from "../../types/navigation"
import "./AlertsScreen.css"

export function AlertsScreen({ go, onOpenArea, onOpenForecast, onOpenStation }: {
  go: (screen: Screen) => void
  onOpenArea: (name: string) => void
  onOpenForecast: (name: string) => void
  onOpenStation: (name: string) => void
}) {
  return (
    <AppShell screen="alerts" go={go}>
      <TopBar
        title="Alertas"
        subtitle="2 ativos precisam de atenção"
        action={
          <button className="icon-button">
            <Check size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="filter-row">
          <button className="chip active">
            Ativos <i>2</i>
          </button>
          <button className="chip">Resolvidos</button>
          <button className="chip">Todos</button>
        </div>
        <div className="alert-group-title">
          <span>CRÍTICOS</span>
          <Badge tone="danger">2 alertas</Badge>
        </div>
        <button className="alert-card critical" onClick={() => onOpenStation("Talhão Norte")}>
          <span className="alert-icon">
            <WifiOff size={21} />
          </span>
          <div>
            <div>
              <Badge tone="danger">ESTAÇÃO OFFLINE</Badge>
              <small>há 14 min</small>
            </div>
            <h3>Estação Sul offline</h3>
            <p>Sem comunicação há 2h 14min.</p>
            <strong>
              <MapPin size={14} /> Talhão Norte
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <button className="alert-card critical">
          <span className="alert-icon">
            <Droplets size={21} />
          </span>
          <div>
            <div>
              <Badge tone="danger">UMIDADE CRÍTICA</Badge>
              <small>há 36 min</small>
            </div>
            <h3>Umidade do solo em 19%</h3>
            <p>A Estação Centro registrou umidade abaixo do limite.</p>
            <strong>
              <MapPin size={14} /> Fazenda Sul
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <div className="alert-group-title">
          <span>IRRIGAÇÃO</span>
        </div>
        <button className="alert-card irrigation" onClick={() => onOpenArea("Fazenda Sul")}>
          <span className="alert-icon">
            <Droplets size={21} />
          </span>
          <div>
            <div>
              <Badge tone="warning">IRRIGAR</Badge>
              <small>hoje, 08:10</small>
            </div>
            <h3>Irrigação recomendada</h3>
            <p>Não há chuva significativa nas próximas 24 horas.</p>
            <strong>
              <MapPin size={14} /> Fazenda Sul
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <div className="alert-group-title">
          <span>CLIMA</span>
        </div>
        <button
          className="alert-card climate"
          onClick={() => onOpenForecast("Talhão Norte")}
        >
          <span className="alert-icon">
            <CloudRain size={21} />
          </span>
          <div>
            <div>
              <Badge tone="info">CHUVA PREVISTA</Badge>
              <small>hoje, 07:45</small>
            </div>
            <h3>Chuva nas próximas horas</h3>
            <p>11,4 mm previstos a partir das 21:00.</p>
            <strong>
              <MapPin size={14} /> Talhão Norte
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <div className="resolved-alert">
          <Check size={17} />
          <div>
            <strong>Estação Norte voltou a ficar online</strong>
            <span>Resolvido hoje às 06:32</span>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
