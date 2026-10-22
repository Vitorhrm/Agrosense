import { ChevronRight, CloudRain, Droplets, Gauge, Leaf, MapPin, MoreHorizontal, Thermometer, Wind, Wifi, WifiOff } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { Badge } from "../../components/Badge/Badge"
import { Metric } from "../../components/Metric/Metric"
import { RecommendationCard } from "../../components/RecommendationCard/RecommendationCard"
import { HourlyForecast } from "../../components/HourlyForecast/HourlyForecast"
import type { Screen } from "../../types/navigation"
import { stations } from "../../data/demo"
import "./AreaScreen.css"

export function AreaScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="area" go={go}>
      <TopBar
        title="Talhão Norte"
        subtitle="Milho · 3 estações"
        back
        onBack={() => go("areas")}
        action={
          <button className="icon-button">
            <MoreHorizontal size={21} />
          </button>
        }
      />
      <section className="page">
        <div className="area-overview">
          <div>
            <span className="area-symbol">
              <Leaf size={25} />
            </span>
            <div>
              <span>STATUS DA ÁREA</span>
              <strong>Atenção necessária</strong>
            </div>
          </div>
          <Badge tone="danger">1 offline</Badge>
        </div>
        <div className="section-title">
          <div>
            <span>CONDIÇÃO DA ÁREA</span>
            <p>Atualizado há 4 min</p>
          </div>
        </div>
        <div className="metrics-grid">
          <Metric icon={Droplets} label="Umidade do solo" value="34%" />
          <Metric
            icon={Thermometer}
            label="Temperatura"
            value="27°C"
            tone="orange"
          />
          <Metric icon={Wind} label="Umidade do ar" value="66%" tone="blue" />
          <Metric icon={Gauge} label="Pressão" value="1012 hPa" tone="purple" />
        </div>
        <RecommendationCard />
        <article className="weather-card" onClick={() => go("weather-detail")}>
          <div className="weather-card-head">
            <div>
              <span>CLIMA DESTA ÁREA</span>
              <h3>Clima do Talhão Norte</h3>
            </div>
            <CloudRain size={31} />
          </div>
          <div className="weather-main">
            <strong>27°</strong>
            <div>
              <b>Chuva às 21:00</b>
              <span>82% de chance · 11,4 mm</span>
            </div>
          </div>
          <div className="location-note">
            <MapPin size={14} /> Previsão baseada na localização das estações
          </div>
          <HourlyForecast />
        </article>
        <div className="section-title">
          <div>
            <span>ESTAÇÕES</span>
            <p>2 online · 1 offline</p>
          </div>
          <button onClick={() => go("new-station")}>Adicionar</button>
        </div>
        <div className="station-list">
          {stations.map((station) => (
            <button
              className={`station-card ${station.status.toLowerCase()}`}
              key={station.name}
              onClick={() => station.status === "OFFLINE" && go("station")}
            >
              <span className="station-status-icon">
                {station.status === "ONLINE" ? (
                  <Wifi size={19} />
                ) : (
                  <WifiOff size={19} />
                )}
              </span>
              <div>
                <strong>{station.name}</strong>
                <span>Última leitura: {station.ago}</span>
                <small>
                  Umidade
                  {station.status === "OFFLINE" ? " da última leitura" : ""}:{" "}
                  {station.moisture}
                </small>
              </div>
              <div>
                <Badge
                  tone={station.status === "ONLINE" ? "success" : "danger"}
                >
                  {station.status}
                </Badge>
                <ChevronRight size={18} />
              </div>
            </button>
          ))}
        </div>
        <button className="text-action" onClick={() => go("crop")}>
          <Leaf size={18} />
          <span>Parâmetros da cultura: Milho</span>
          <ChevronRight size={18} />
        </button>
      </section>
    </AppShell>
  )
}
