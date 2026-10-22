import type { IconType } from "../../types/navigation"
import "./Metric.css"

export function Metric({
  icon: Icon,
  label,
  value,
  tone = "green",
}: {
  icon: IconType
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${tone}`}>
        <Icon size={19} />
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
