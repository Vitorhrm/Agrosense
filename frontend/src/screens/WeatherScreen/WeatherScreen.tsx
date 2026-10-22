import { ChevronRight, CloudRain, MapPin, Sun } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import type { Screen } from "../../types/navigation"
import { areas } from "../../data/demo"
import "./WeatherScreen.css"

export function WeatherScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="weather" go={go}>
      <TopBar title="Clima" subtitle="Previsão individual por área" />
      <section className="page">
        <div className="info-banner">
          <MapPin size={18} />
          <p>
            Cada previsão usa a localização das estações vinculadas àquela área.
          </p>
        </div>
        <div className="section-title">
          <div>
            <span>CLIMA POR ÁREA</span>
            <p>Atualizado agora</p>
          </div>
        </div>
        <div className="climate-list">
          {areas.map((area, index) => (
            <button
              className={`climate-card climate-${index}`}
              key={area.name}
              onClick={() => go("weather-detail")}
            >
              <div className="climate-head">
                <div>
                  <span>{area.crop}</span>
                  <h3>{area.name}</h3>
                </div>
                {index === 1 ? <Sun size={32} /> : <CloudRain size={32} />}
              </div>
              <div className="climate-temp">
                <strong>{area.temperature}°</strong>
                <div>
                  <b>{area.rain}% de chuva</b>
                  <span>Umidade do ar: {index === 1 ? 48 : 66}%</span>
                </div>
              </div>
              <div className="climate-rain">
                <CloudRain size={17} />
                <div>
                  <span>Próxima chuva</span>
                  <strong>{area.nextRain}</strong>
                </div>
                <b>{area.precipitation}</b>
              </div>
              <div className="climate-footer">
                <MapPin size={13} /> Localização própria da área{" "}
                <ChevronRight size={17} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </AppShell>
  )
}
