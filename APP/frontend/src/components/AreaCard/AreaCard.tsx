import { AlertCircle, ChevronRight, CloudRain, Leaf, WifiOff } from "lucide-react"
import { Badge } from "../../components/Badge/Badge"
import { areas } from "../../data/demo"
import "./AreaCard.css"

export function AreaCard({
  area,
  open,
}: {
  area: typeof areas[number]
  open: () => void
}) {
  return (
    <article className="area-card">
      <button type="button" className="area-card-open" aria-label={`Abrir ${area.name}`} onClick={open} />
      <div className="area-card-head">
        <div className="crop-icon">
          <Leaf size={22} />
        </div>
        <div className="area-title">
          <h3>{area.name}</h3>
          <p>
            {area.crop} · {area.stations} estações
          </p>
        </div>
        <ChevronRight size={20} className="muted" />
      </div>
      <div className="status-row">
        <Badge tone="success">{area.online} online</Badge>
        {area.offline > 0 && (
          <Badge tone="danger">
            <AlertCircle size={13} /> {area.offline} offline
          </Badge>
        )}
      </div>
      <div className="area-stats">
        <div>
          <span>Umidade média</span>
          <strong>{area.moisture}%</strong>
          <div className="progress">
            <i style={{ width: `${area.moisture}%` }} />
          </div>
        </div>
        <div>
          <span>Clima da área</span>
          <strong>
            {area.temperature}°{" "}
            <small>
              <CloudRain size={14} /> {area.rain}%
            </small>
          </strong>
          <p>Chuva: {area.nextRain}</p>
        </div>
      </div>
      <div className={`recommend-strip ${area.tone}`}>
        <div>
          <span>Recomendação</span>
          <strong>{area.recommendation}</strong>
        </div>
        <span className="round-arrow">
          <ChevronRight size={17} />
        </span>
      </div>
      {area.offline > 0 && (
        <div className="inline-alert">
          <WifiOff size={16} />
          <span>
            <strong>Estação Sul offline</strong> · há 2h 14min
          </span>
        </div>
      )}
    </article>
  )
}
