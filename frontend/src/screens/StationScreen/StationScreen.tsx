import { useState } from "react"
import { AlertCircle, Droplets, Gauge, LocateFixed, MapPin, RadioTower, Settings, Thermometer, Wind, Wifi, WifiOff } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { Badge } from "../../components/Badge/Badge"
import { Metric } from "../../components/Metric/Metric"
import { MiniChart } from "../../components/MiniChart/MiniChart"
import type { Screen } from "../../types/navigation"
import "./StationScreen.css"

export function StationScreen({ go }: { go: (screen: Screen) => void }) {
  const [period, setPeriod] = useState("24 horas")
  return (
    <AppShell screen="station" go={go}>
      <TopBar
        title="Estação Sul"
        subtitle="Talhão Norte"
        back
        onBack={() => go("area")}
        action={
          <button className="icon-button">
            <Settings size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="offline-hero">
          <span>
            <WifiOff size={27} />
          </span>
          <div>
            <Badge tone="danger">OFFLINE</Badge>
            <h2>Sem comunicação há 2h 14min</h2>
            <p>Última leitura recebida hoje às 14:20</p>
          </div>
        </div>
        <div className="station-location">
          <MapPin size={18} />
          <div>
            <span>Localização da estação</span>
            <strong>-22.9068, -47.0626</strong>
          </div>
          <button>
            <LocateFixed size={18} />
          </button>
        </div>
        <div className="data-warning">
          <AlertCircle size={17} />
          <span>Os valores abaixo correspondem à última leitura recebida.</span>
        </div>
        <div className="metrics-grid">
          <Metric icon={Droplets} label="Umidade do solo" value="27%" />
          <Metric
            icon={Thermometer}
            label="Temperatura"
            value="29,2°C"
            tone="orange"
          />
          <Metric icon={Wind} label="Umidade do ar" value="61%" tone="blue" />
          <Metric icon={Gauge} label="Pressão" value="1010 hPa" tone="purple" />
          <Metric
            icon={RadioTower}
            label="RSSI"
            value="-112 dBm"
            tone="orange"
          />
          <Metric icon={Wifi} label="SNR" value="7,4 dB" tone="blue" />
        </div>
        <div className="section-title">
          <div>
            <span>HISTÓRICO DE LEITURAS</span>
            <p>Últimos dados recebidos</p>
          </div>
        </div>
        <div className="filter-row compact">
          {["24 horas", "7 dias", "30 dias"].map((item) => (
            <button
              key={item}
              className={`chip ${period === item ? "active" : ""}`}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <article className="chart-card">
          <div>
            <span>UMIDADE DO SOLO</span>
            <strong>27%</strong>
            <small>-8% no período</small>
          </div>
          <MiniChart />
        </article>
        <article className="chart-card">
          <div>
            <span>TEMPERATURA</span>
            <strong>29,2°C</strong>
            <small>Máx. 31,8°C</small>
          </div>
          <MiniChart color="orange" />
        </article>
      </section>
    </AppShell>
  )
}
