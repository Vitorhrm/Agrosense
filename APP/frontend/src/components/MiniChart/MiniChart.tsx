import "./MiniChart.css"

export function MiniChart({
  color = "green",
}: {
  color?: "green" | "orange" | "blue" | "purple"
}) {
  return (
    <div className={`chart ${color}`}>
      <span className="grid-line one" />
      <span className="grid-line two" />
      <svg viewBox="0 0 320 100" preserveAspectRatio="none">
        <path
          className="chart-fill"
          d="M0 72 C30 65,42 40,72 50 S112 83,145 57 S195 20,225 42 S270 74,320 28 L320 100 L0 100 Z"
        />
        <path
          className="chart-line"
          d="M0 72 C30 65,42 40,72 50 S112 83,145 57 S195 20,225 42 S270 74,320 28"
        />
      </svg>
      <div className="chart-labels">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>Agora</span>
      </div>
    </div>
  )
}
