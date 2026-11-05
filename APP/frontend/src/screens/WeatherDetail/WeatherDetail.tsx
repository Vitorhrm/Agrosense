import { Check, CloudRain, Droplets, Gauge, MapPin, Sun, Wind } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { HourlyForecast } from "../../components/HourlyForecast/HourlyForecast"
import type { Screen } from "../../types/navigation"
import "./WeatherDetail.css"

export function WeatherDetail({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="weather-detail" go={go}>
      <TopBar
        title="Clima do Talhão Norte"
        subtitle="Previsão específica da área"
        back
        onBack={() => go("weather")}
      />
      <section className="page">
        <article className="weather-hero">
          <div className="weather-hero-top">
            <span>AGORA · PARCIALMENTE NUBLADO</span>
            <CloudRain size={43} />
          </div>
          <div className="weather-hero-temp">
            <strong>27°</strong>
            <div>
              <span>Sensação de 28°</span>
              <b>Máx. 29° · Mín. 19°</b>
            </div>
          </div>
          <div className="weather-details">
            <span>
              <Wind size={16} /> Umidade <b>66%</b>
            </span>
            <span>
              <Gauge size={16} /> Pressão <b>1012 hPa</b>
            </span>
          </div>
        </article>
        <div className="location-confirm">
          <MapPin size={18} />
          <div>
            <strong>Previsão localizada</strong>
            <span>
              Corresponde à localização média das 3 estações desta área.
            </span>
          </div>
          <Check size={18} />
        </div>
        <article className="rain-focus">
          <div className="rain-focus-title">
            <span>
              <CloudRain size={22} />
            </span>
            <div>
              <small>PRÓXIMA CHUVA</small>
              <strong>Hoje às 21:00</strong>
            </div>
          </div>
          <div className="rain-countdown">
            <div>
              <strong>3h 40min</strong>
              <span>até a chuva</span>
            </div>
            <div>
              <strong>82%</strong>
              <span>probabilidade</span>
            </div>
            <div>
              <strong>11,4 mm</strong>
              <span>precipitação</span>
            </div>
          </div>
        </article>
        <div className="section-title">
          <div>
            <span>PREVISÃO HORÁRIA</span>
            <p>Próximas 5 horas</p>
          </div>
        </div>
        <article className="white-card">
          <HourlyForecast />
        </article>
        <div className="section-title">
          <div>
            <span>PRÓXIMOS DIAS</span>
            <p>Previsão para a área</p>
          </div>
        </div>
        <div className="daily-list">
          {[
            ["Hoje", "Chuva à noite", "19°", "29°", "82%"],
            ["Qua", "Chuva moderada", "18°", "25°", "74%"],
            ["Qui", "Parcialmente nublado", "17°", "27°", "22%"],
            ["Sex", "Ensolarado", "18°", "30°", "8%"],
          ].map((day, i) => (
            <div key={day[0]}>
              <strong>{day[0]}</strong>
              {i < 2 ? <CloudRain size={20} /> : <Sun size={20} />}
              <span>{day[1]}</span>
              <small>
                <Droplets size={13} /> {day[4]}
              </small>
              <b>
                {day[2]} / {day[3]}
              </b>
            </div>
          ))}
        </div>
        <div className="et-card">
          <div>
            <Wind size={20} />
            <span>Evapotranspiração ET0</span>
          </div>
          <strong>3,8 mm/dia</strong>
        </div>
      </section>
    </AppShell>
  )
}
