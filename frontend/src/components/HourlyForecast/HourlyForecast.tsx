import { CloudRain, Sun } from "lucide-react"
import { hourly } from "../../data/demo"
import "./HourlyForecast.css"

export function HourlyForecast() {
  return (
    <div className="hourly">
      {hourly.map(([time, rain, mm], index) => (
        <div key={time} className={index === 3 ? "peak" : ""}>
          <strong>{time}</strong>
          {index < 2 ? <Sun size={20} /> : <CloudRain size={20} />}
          <span>{rain}</span>
          <small>{mm}</small>
        </div>
      ))}
    </div>
  )
}
