import { CalendarDays, ChevronDown, History, Map } from "lucide-react"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { Badge } from "../../components/Badge/Badge"
import type { Screen } from "../../types/navigation"
import "./HistoryScreen.css"

export function HistoryScreen({ go }: { go: (screen: Screen) => void }) {
  const records = [
    [
      "Hoje · 18:30",
      "Talhão Norte",
      "Milho",
      "AGUARDAR CHUVA",
      "wait",
      "31%",
      "11,4 mm",
      "Há previsão de chuva suficiente nas próximas horas.",
    ],
    [
      "Hoje · 08:10",
      "Fazenda Sul",
      "Café",
      "IRRIGAR",
      "danger",
      "23%",
      "0 mm",
      "Umidade baixa e nenhuma chuva significativa prevista.",
    ],
    [
      "Ontem · 17:45",
      "Horta Leste",
      "Alface",
      "NÃO IRRIGAR",
      "good",
      "58%",
      "4,2 mm",
      "Umidade atual dentro da faixa adequada para o cultivo.",
    ],
  ]
  return (
    <AppShell screen="history" go={go}>
      <TopBar
        title="Histórico"
        subtitle="Recomendações de irrigação"
        back
        onBack={() => go("profile")}
      />
      <section className="page">
        <div className="history-filters">
          <button>
            <Map size={16} /> Todas as áreas <ChevronDown size={15} />
          </button>
          <button>
            <CalendarDays size={16} /> 30 dias <ChevronDown size={15} />
          </button>
        </div>
        <div className="filter-row">
          <button className="chip active">Todas</button>
          <button className="chip">Irrigar</button>
          <button className="chip">Aguardar</button>
        </div>
        <div className="history-list">
          {records.map((item) => (
            <article
              key={item[0] + item[1]}
              className={`history-card ${item[4]}`}
            >
              <div className="history-date">
                <History size={15} /> {item[0]}
              </div>
              <div className="history-head">
                <div>
                  <h3>{item[1]}</h3>
                  <span>{item[2]}</span>
                </div>
                <Badge
                  tone={
                    item[4] === "danger"
                      ? "danger"
                      : item[4] === "good"
                        ? "success"
                        : "warning"
                  }
                >
                  {item[3]}
                </Badge>
              </div>
              <div className="history-metrics">
                <span>
                  Umidade média <strong>{item[5]}</strong>
                </span>
                <span>
                  Precipitação <strong>{item[6]}</strong>
                </span>
              </div>
              <div className="history-reason">
                <strong>Motivo</strong>
                <p>{item[7]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  )
}
