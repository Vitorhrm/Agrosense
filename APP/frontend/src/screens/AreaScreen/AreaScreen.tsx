import { ChevronRight, CloudRain, Droplets, Gauge, Leaf, MapPin, MoreHorizontal, Thermometer, Wind, Wifi, WifiOff } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { Badge } from "../../components/Badge/Badge"
import { Metric } from "../../components/Metric/Metric"
import { RecommendationCard } from "../../components/RecommendationCard/RecommendationCard"
import { HourlyForecast } from "../../components/HourlyForecast/HourlyForecast"
import type { Screen } from "../../types/navigation"
import { DeviceRegistration } from "../../features/devices/DeviceRegistration/DeviceRegistration"
import { areas, stations } from "../../data/demo"
import "./AreaScreen.css"

export function AreaScreen({ go, area }: { area: typeof areas[number], go: (screen: Screen) => void }) {
  const hasDetails = area.name === "Talhão Norte"
  const needsAttention = area.offline > 0 || area.tone === "danger"

  return (
    <AppShell screen="area" go={go}>
      <TopBar
        title={area.name}
        subtitle={`${area.crop} · ${area.stations} estações`}
        back
        onBack={() => go("areas")}
        action={
          <button className="icon-button">
            <MoreHorizontal size={21} />
          </button>
        }
      />
      <section className="page">
        <DeviceRegistration areaName={area.name} />
        <div className="area-overview">
          <div>
            <span className="area-symbol">
              <Leaf size={25} />
            </span>
            <div>
              <span>STATUS DA ÁREA</span>
              <strong>{needsAttention ? "Atenção necessária" : "Sem alertas"}</strong>
            </div>
          </div>
          <Badge tone={area.offline > 0 ? "danger" : "success"}>{area.offline > 0 ? `${area.offline} offline` : `${area.online} online`}</Badge>
        </div>
        <div className="section-title">
          <div>
            <span>CONDIÇÃO DA ÁREA</span>
            <p>Atualizado há 4 min</p>
          </div>
        </div>
        <div className="metrics-grid">
          <Metric icon={Droplets} label="Umidade do solo" value={`${area.moisture}%`} />
          <Metric
            icon={Thermometer}
            label="Temperatura"
            value={`${area.temperature} °C`}
            tone="orange"
          />
          {hasDetails && (
            <>
              <Metric icon={Wind} label="Umidade do ar" value="66%" tone="blue" />
              <Metric icon={Gauge} label="Pressão" value="1012 hPa" tone="purple" />
            </>
          )}
        </div>
        <RecommendationCard area={area} />
        <article className="weather-card">
          <button type="button" className="weather-card-open" aria-label={`Abrir previsão de ${area.name}`} onClick={() => go("weather-detail")} />
          <div className="weather-card-head">
            <div>
              <span>CLIMA DESTA ÁREA</span>
              <h3>Clima de {area.name}</h3>
            </div>
            <CloudRain size={31} />
          </div>
          <div className="weather-main">
            <strong>{area.temperature}°</strong>
            <div>
              <b>Próxima chuva · {area.nextRain}</b>
              <span>{area.rain}% de chance · {area.precipitation}</span>
            </div>
          </div>
          <div className="location-note">
            <MapPin size={14} /> Previsão baseada na localização das estações
          </div>
          {hasDetails && <HourlyForecast />}
        </article>
        <div className="section-title">
          <div>
            <span>ESTAÇÕES</span>
            <p>{area.online} online · {area.offline} offline</p>
          </div>
          <button onClick={() => go("new-station")}>Adicionar</button>
        </div>
        <div className="station-list">
          {hasDetails && stations.map((station) => (
            <button
              className={`station-card ${station.status.toLowerCase()}`}
              key={station.name}
              disabled={station.status !== "OFFLINE"}
              onClick={() => go("station")}
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
          <span>Áreas e culturas</span>
          <ChevronRight size={18} />
        </button>
      </section>
    </AppShell>
  )
}
