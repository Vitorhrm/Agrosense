import { Sprout } from "lucide-react"
import "./Logo.css"

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo${compact ? " logo-compact" : ""}`}>
      <div className="logo-mark">
        <Sprout size={compact ? 20 : 28} strokeWidth={2.4} />
        <span className="signal signal-a" />
        <span className="signal signal-b" />
      </div>
      {!compact && (
        <div>
          <strong>AgroSense</strong>
          <span>decisões que cultivam</span>
        </div>
      )}
    </div>
  )
}
