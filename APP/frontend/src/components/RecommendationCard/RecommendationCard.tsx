import { CloudRain } from "lucide-react"
import type { areas } from "../../data/demo"
import "./RecommendationCard.css"

export function RecommendationCard({ area }: { area: typeof areas[number] }) {
  return (
    <article className="recommend-card">
      <div className="recommend-top">
        <span className="recommend-icon">
          <CloudRain size={25} />
        </span>
        <div>
          <span>RECOMENDAÇÃO DE IRRIGAÇÃO</span>
          <h3>{area.recommendation}</h3>
        </div>
      </div>
      <div className="recommend-grid">
        <div>
          <span>Umidade atual</span>
          <strong>{area.moisture}%</strong>
        </div>
        <div>
          <span>Próxima chuva</span>
          <strong>{area.nextRain}</strong>
        </div>
        <div>
          <span>Precipitação</span>
          <strong>{area.precipitation}</strong>
        </div>
      </div>
    </article>
  )
}
