import { useEffect, useState } from "react"
import { ChevronDown, RefreshCw } from "lucide-react"
import { AppShell } from "../../components/AppShell/AppShell"
import { Button } from "../../components/Button/Button"
import { TopBar } from "../../components/TopBar/TopBar"
import { getSupabase } from "../../lib/supabase"
import { relativeSoilIndex } from "../../lib/soilIndex"
import type { Screen } from "../../types/navigation"
import "./TelemetryScreen.css"

const readingLimit = 30
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })

interface Reading {
  id: number | string
  node: string
  received_at: string
  temp_c: number | null
  air_rh_pct: number | null
  pressure_hpa: number | null
  soil_raw: number | null
  soil_index_pct: number | null
  soil_enabled: boolean | null
  signal: string
}

interface StationAccess {
  node: string
  dry_adc: number | null
  wet_adc: number | null
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; readings: Reading[]; calibrationUnavailable: boolean }

function formatMeasurement(value: number | null, unit = "") {
  return value === null ? "—" : numberFormat.format(value) + unit
}

function soilIndex(reading: Reading, calibration: StationAccess | undefined) {
  if (reading.soil_enabled === false) return "Desativado"
  const index = relativeSoilIndex(reading, calibration)
  return index ? formatMeasurement(index.value, "%") + (index.recorded ? " · na coleta" : "") : "Sem calibração"
}

export function TelemetryScreen({ go, userId }: { go: (screen: Screen) => void; userId: string }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" })
  const [request, setRequest] = useState(0)
  const [selectedStation, setSelectedStation] = useState("")
  const [stationAccess, setStationAccess] = useState<StationAccess[]>([])

  useEffect(() => {
    const controller = new AbortController()

    async function loadReadings() {
      try {
        const client = getSupabase()
        let readingsQuery = client
          .from("agro_readings")
          .select("id,node,received_at,temp_c,air_rh_pct,pressure_hpa,soil_raw,soil_index_pct,soil_enabled,signal")
        if (selectedStation) readingsQuery = readingsQuery.eq("node", selectedStation)

        const [readings, access] = await Promise.all([
          readingsQuery
            .order("received_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(readingLimit)
            .abortSignal(controller.signal)
            .overrideTypes<Reading[], { merge: false }>(),
          client.from("agro_station_access")
            .select("node,dry_adc,wet_adc")
            .eq("user_id", userId)
            .abortSignal(controller.signal)
            .overrideTypes<StationAccess[], { merge: false }>(),
        ])

        if (controller.signal.aborted) return
        if (!access.error) {
          setStationAccess(access.data.sort((first, second) => first.node.localeCompare(second.node)))
        }
        if (readings.error) throw readings.error
        setLoad({ status: "ready", readings: readings.data, calibrationUnavailable: Boolean(access.error) })
      } catch {
        if (!controller.signal.aborted) setLoad({ status: "error" })
      }
    }

    void loadReadings()
    return () => controller.abort()
  }, [request, selectedStation, userId])

  const refresh = () => {
    setLoad({ status: "loading" })
    setRequest(current => current + 1)
  }

  const calibrationByNode = new Map(stationAccess.map(station => [station.node, station]))

  return (
    <AppShell screen="telemetry" go={go}>
      <TopBar title="Telemetria" subtitle="Até 30 leituras recentes" back onBack={() => go("home")} />
      <section className="page telemetry-page">
        {(stationAccess.length > 0 || selectedStation) && (
          <label className="field">
            <span>Estação</span>
            <div>
              <select
                value={selectedStation}
                onChange={event => {
                  setLoad({ status: "loading" })
                  setSelectedStation(event.target.value)
                }}
              >
                <option value="">Todas as estações</option>
                {selectedStation && !calibrationByNode.has(selectedStation) && <option value={selectedStation}>{selectedStation}</option>}
                {stationAccess.map(station => <option key={station.node} value={station.node}>{station.node}</option>)}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>
        )}
        <Button variant="secondary" icon={RefreshCw} onClick={refresh} disabled={load.status === "loading"}>
          Atualizar leituras
        </Button>
        {load.status === "loading" && <p className="telemetry-status" role="status">Carregando leituras…</p>}
        {load.status === "error" && (
          <p className="telemetry-status inline-alert" role="alert">
            Não foi possível carregar as leituras. Tente atualizar.
          </p>
        )}
        {load.status === "ready" && load.calibrationUnavailable && (
          <p className="telemetry-status" role="status">Não foi possível consultar a calibração das estações.</p>
        )}
        {load.status === "ready" && (
          load.readings.length === 0
            ? <p className="telemetry-status" role="status">Nenhuma leitura disponível para sua conta.</p>
            : <ul className="telemetry-readings" aria-label="Leituras recentes">
              {load.readings.map(reading => (
                <li className="telemetry-reading" key={reading.id}>
                  <header>
                    <h2>{reading.node}</h2>
                    <time dateTime={reading.received_at}>{dateFormat.format(new Date(reading.received_at))}</time>
                  </header>
                  <dl>
                    <div><dt>Temperatura</dt><dd>{formatMeasurement(reading.temp_c, " °C")}</dd></div>
                    <div><dt>Umidade do ar</dt><dd>{formatMeasurement(reading.air_rh_pct, "%")}</dd></div>
                    <div><dt>Pressão</dt><dd>{formatMeasurement(reading.pressure_hpa, " hPa")}</dd></div>
                    <div>
                      <dt>Solo (leitura bruta)</dt>
                      <dd>{reading.soil_enabled === false ? "Desativado" : formatMeasurement(reading.soil_raw)}</dd>
                    </div>
                    <div>
                      <dt>Índice relativo de umidade do solo</dt>
                      <dd>{soilIndex(reading, load.calibrationUnavailable ? undefined : calibrationByNode.get(reading.node))}</dd>
                    </div>
                    <div><dt>Sinal</dt><dd>{reading.signal ?? "—"}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
        )}
      </section>
    </AppShell>
  )
}
