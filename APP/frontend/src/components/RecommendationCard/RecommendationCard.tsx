import { Check, CloudRain } from "lucide-react"
import "./RecommendationCard.css"

export function RecommendationCard() {
  return (
    <article className="recommend-card">
      <div className="recommend-top">
        <span className="recommend-icon">
          <CloudRain size={25} />
        </span>
        <div>
          <span>RECOMENDAÇÃO DE IRRIGAÇÃO</span>
          <h3>AGUARDAR CHUVA</h3>
        </div>
      </div>
      <p>
        A umidade média do solo está abaixo do recomendado para o milho, porém
        há alta probabilidade de chuva significativa nas próximas horas.
      </p>
      <div className="recommend-grid">
        <div>
          <span>Umidade atual</span>
          <strong>31%</strong>
        </div>
        <div>
          <span>Limite recomendado</span>
          <strong>35%</strong>
        </div>
        <div>
          <span>Próxima chuva</span>
          <strong>3h 40min</strong>
        </div>
        <div>
          <span>Precipitação</span>
          <strong>11,4 mm</strong>
        </div>
      </div>
      <div className="reason">
        <Check size={16} />
        <span>É seguro aguardar a precipitação prevista antes de irrigar.</span>
      </div>
    </article>
  )
}
