import { AlertCircle, CloudRain, Droplets, Gauge, History, Leaf, Settings } from "lucide-react"
import { Button } from "../../components/Button/Button"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import type { Screen } from "../../types/navigation"
import "./CropScreen.css"

export function CropScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="crop" go={go}>
      <TopBar
        title="Cultura"
        subtitle="Parâmetros agronômicos"
        back
        onBack={() => go("area")}
        action={
          <button className="icon-button">
            <Settings size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="crop-hero">
          <span>
            <Leaf size={29} />
          </span>
          <div>
            <small>CULTURA ATIVA</small>
            <h2>Milho</h2>
            <p>Zea mays · Talhão Norte</p>
          </div>
        </div>
        <div className="info-banner">
          <AlertCircle size={18} />
          <p>
            Estes parâmetros orientam as recomendações automáticas de irrigação.
          </p>
        </div>
        <div className="parameter-list">
          <div>
            <span>
              <Droplets size={18} /> Umidade mínima
            </span>
            <strong>35%</strong>
          </div>
          <div>
            <span>
              <Droplets size={18} /> Umidade máxima
            </span>
            <strong>65%</strong>
          </div>
          <div>
            <span>
              <CloudRain size={18} /> Precipitação mínima
            </span>
            <strong>5 mm</strong>
          </div>
          <div>
            <span>
              <History size={18} /> Tempo máximo para chuva
            </span>
            <strong>6 horas</strong>
          </div>
          <div>
            <span>
              <Gauge size={18} /> Coeficiente da cultura (Kc)
            </span>
            <strong>1,20</strong>
          </div>
        </div>
        <Button variant="secondary" full>
          Editar parâmetros
        </Button>
      </section>
    </AppShell>
  )
}
