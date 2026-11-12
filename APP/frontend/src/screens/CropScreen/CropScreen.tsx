import { useEffect, useState, type FormEvent } from "react"
import { AppShell } from "../../components/AppShell/AppShell"
import { TopBar } from "../../components/TopBar/TopBar"
import { getSupabase } from "../../lib/supabase"
import type { Screen } from "../../types/navigation"
import "./CropScreen.css"

const textFields = [
  ["name", "Nome da área", 80],
  ["crop", "Cultura", 80],
  ["stage", "Estágio da cultura", 80],
  ["source", "Fonte técnica dos parâmetros", 300],
  ["conditions", "Condições de aplicação (solo, sensor, manejo)", 600],
] as const

const numberFields = [
  ["latitude", "Latitude (graus)", -90, 90],
  ["longitude", "Longitude (graus)", -180, 180],
  ["soil_min", "Limite inferior do solo", 0, 100],
  ["soil_max", "Limite superior do solo", 0, 100],
  ["rain_min_mm", "Volume mínimo de chuva (mm)", 0, 1000],
  ["rain_window_hours", "Janela de chuva (horas)", 1, 168],
  ["kc", "Coeficiente da cultura (Kc)", 0.01, 3],
] as const

type Area = { id: string; soil_unit: "relative_index" | "vwc_pct" | null }
  & Record<typeof textFields[number][0], string | null>
  & Record<typeof numberFields[number][0], number | null>
type Station = { node: string; area_id: string | null; dry_adc: number | null; wet_adc: number | null }
type Forecast = {
  fetched_at: string
  daily: { date: string; temp_min_c: number; temp_max_c: number; precipitation_probability_pct: number | null; precipitation_mm: number | null }[]
}

function AreaForecast({ latitude, longitude }: { latitude: number; longitude: number }) {
  const [result, setResult] = useState<{ forecast: Forecast } | { error: string }>()
  useEffect(() => {
    const controller = new AbortController()
    const base = import.meta.env.VITE_AGROSENSE_API_URL || window.location.origin
    // A previsão não precisa da precisão completa da coordenada cadastrada.
    const query = new URLSearchParams({ lat: latitude.toFixed(3), lon: longitude.toFixed(3) })
    fetch(new URL("/api/forecast?" + query, base), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error()
        const forecast: Forecast = await response.json()
        if (!Array.isArray(forecast.daily) || !forecast.fetched_at) throw new Error()
        setResult({ forecast })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ error: "A previsão está indisponível. Tente novamente mais tarde." })
      })
    return () => controller.abort()
  }, [latitude, longitude])

  return <section className="crop-config">
    <h2>Previsão por área</h2>
    {!result && <p role="status">Consultando previsão…</p>}
    {result && "error" in result && <p role="alert">{result.error}</p>}
    {result && "forecast" in result && <>
      <p>Consulta em {new Date(result.forecast.fetched_at).toLocaleString("pt-BR")} · Fonte: <a href="https://open-meteo.com/">Open-Meteo</a></p>
      <ul className="crop-forecast">
        {result.forecast.daily.map(day => <li key={day.date}>
          <strong>{day.date.split("-").reverse().join("/")}</strong>
          <span>{day.temp_min_c} a {day.temp_max_c} °C</span>
          <span>Chuva: {day.precipitation_probability_pct === null ? "sem probabilidade" : day.precipitation_probability_pct + "%"} · {day.precipitation_mm === null ? "sem volume" : day.precipitation_mm + " mm"}</span>
        </li>)}
      </ul>
    </>}
  </section>
}

export function CropScreen({ go }: { go: (screen: Screen) => void }) {
  const [areas, setAreas] = useState<Area[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [selected, setSelected] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const area = areas.find(item => item.id === selected)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const client = getSupabase()
        const [areaRows, stationRows] = await Promise.all([
          client.from("agro_areas").select("*").order("name").abortSignal(controller.signal),
          client.from("agro_station_access").select("node,area_id,dry_adc,wet_adc").order("node").abortSignal(controller.signal),
        ])
        if (controller.signal.aborted) return
        if (areaRows.error || stationRows.error) throw new Error()
        setAreas(areaRows.data)
        setStations(stationRows.data)
        setSelected(areaRows.data[0]?.id ?? "")
      } catch {
        if (!controller.signal.aborted) setError("Não foi possível carregar as áreas. Confira a conexão e reabra a tela.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (field: string) => String(data.get(field) ?? "").trim() || null
    const numbers = Object.fromEntries(numberFields.map(([field]) => [field, text(field) === null ? null : Number(text(field))]))
    const record = { ...Object.fromEntries(textFields.map(([field]) => [field, text(field)])), ...numbers, soil_unit: text("soil_unit") }
    setError("")
    setStatus("")
    if (!text("name") || !text("crop")) {
      setError("Informe o nome da área e a cultura.")
      return
    }
    if ((numbers.latitude === null) !== (numbers.longitude === null)) {
      setError("Preencha latitude e longitude juntas.")
      return
    }
    if ([numbers.soil_min, numbers.soil_max, record.soil_unit].some(value => value !== null) &&
      (numbers.soil_min === null || numbers.soil_max === null || !record.soil_unit || numbers.soil_min >= numbers.soil_max)) {
      setError("Informe a unidade e os dois limites do solo. O inferior deve ser menor que o superior.")
      return
    }
    if ((numbers.rain_min_mm === null) !== (numbers.rain_window_hours === null)) {
      setError("Informe o volume mínimo de chuva e a janela em horas juntos.")
      return
    }
    if ([numbers.soil_min, numbers.rain_min_mm, numbers.kc].some(value => value !== null) && (!text("source") || !text("conditions"))) {
      setError("Registre a fonte técnica e as condições de aplicação dos parâmetros.")
      return
    }
    setBusy(true)
    try {
      const table = getSupabase().from("agro_areas")
      const query = area ? table.update(record).eq("id", area.id) : table.insert(record)
      const { data: saved, error: failure } = await query.select().single()
      if (failure) throw failure
      setAreas(items => [...items.filter(item => item.id !== saved.id), saved].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")))
      setSelected(saved.id)
      setStatus("Área salva.")
    } catch {
      setError("Não foi possível salvar a área. Verifique os dados e tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  async function assign(node: string, areaId: string) {
    setBusy(true)
    setError("")
    setStatus("")
    try {
      const { data, error: failure } = await getSupabase().from("agro_station_access")
        .update({ area_id: areaId || null }).eq("node", node).select("node,area_id,dry_adc,wet_adc").single()
      if (failure) throw failure
      setStations(items => items.map(item => item.node === node ? data : item))
      setStatus("Vínculo da estação atualizado.")
    } catch {
      setError("Não foi possível vincular a estação.")
    } finally {
      setBusy(false)
    }
  }

  async function calibrate(event: FormEvent<HTMLFormElement>, node: string) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const dry = values.get("dry_adc") === "" ? null : Number(values.get("dry_adc"))
    const wet = values.get("wet_adc") === "" ? null : Number(values.get("wet_adc"))
    setError("")
    setStatus("")
    if ((dry === null) !== (wet === null) || (dry !== null && dry === wet)) {
      setError("Informe dois valores ADC diferentes ou deixe ambos em branco.")
      return
    }
    setBusy(true)
    try {
      const { data, error: failure } = await getSupabase().from("agro_station_access")
        .update({ dry_adc: dry, wet_adc: wet }).eq("node", node).select("node,area_id,dry_adc,wet_adc").single()
      if (failure) throw failure
      setStations(items => items.map(item => item.node === node ? data : item))
      setStatus("Calibração salva.")
    } catch {
      setError("Não foi possível salvar a calibração.")
    } finally {
      setBusy(false)
    }
  }

  return <AppShell screen="crop" go={go}>
    <TopBar title="Áreas e culturas" back onBack={() => go("home")} />
    <section className="page crop-management">
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {loading ? <p role="status">Carregando áreas…</p> : <>
        <label>Área
          <select value={selected} disabled={busy} onChange={event => {
            setSelected(event.target.value)
            setStatus("")
            setError("")
          }}>
            <option value="">Nova área</option>
            {areas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <form key={selected} className="crop-config" onSubmit={save}>
          <h2>{area ? "Configurar área" : "Cadastrar área"}</h2>
          <fieldset disabled={busy}>
            {textFields.slice(0, 3).map(([name, label, maxLength]) =>
              <label key={name}>{label}<input name={name} defaultValue={area?.[name] ?? ""} maxLength={maxLength} required={name === "name" || name === "crop"} /></label>)}
            {numberFields.slice(0, 2).map(([name, label, min, max]) =>
              <label key={name}>{label}<input name={name} type="number" step="any" min={min} max={max} defaultValue={area?.[name] ?? ""} /></label>)}
          </fieldset>
          <h2>Parâmetros da cultura</h2>
          <p>Os limites dependem do solo, da cultura e da instalação. As leituras brutas em ADC não são comparadas com estes limites.</p>
          <fieldset disabled={busy}>
            <label>Escala do solo
              <select name="soil_unit" defaultValue={area?.soil_unit ?? ""}>
                <option value="">Sem escala configurada</option>
                <option value="relative_index">Índice relativo (0–100)</option>
                <option value="vwc_pct">Teor volumétrico calibrado (%)</option>
              </select>
            </label>
            {numberFields.slice(2).map(([name, label, min, max]) =>
              <label key={name}>{label}<input name={name} type="number" step="any" min={min} max={max} defaultValue={area?.[name] ?? ""} /></label>)}
            {textFields.slice(3).map(([name, label, maxLength]) =>
              <label key={name}>{label}<textarea name={name} maxLength={maxLength} defaultValue={area?.[name] ?? ""} /></label>)}
          </fieldset>
          <button type="submit" disabled={busy}>Salvar área</button>
        </form>
        {area && <section className="crop-config">
          <h2>Estações</h2>
          {stations.length === 0 && <p>Nenhuma estação autorizada para esta conta.</p>}
          {stations.map(station => <div className="crop-config" key={station.node}><label>{station.node}
            <select value={station.area_id ?? ""} disabled={busy} onChange={event => void assign(station.node, event.target.value)}>
              <option value="">Sem área</option>
              {areas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
            <form className="crop-config" onSubmit={event => void calibrate(event, station.node)}>
              <h3>Calibração do solo</h3>
              <p>Use médias medidas com esta sonda e este solo. O resultado é um índice relativo.</p>
              <label>Referência seca (ADC)<input name="dry_adc" type="number" step="1" min="0" max="4095" defaultValue={station.dry_adc ?? ""} disabled={busy} /></label>
              <label>Referência saturada (ADC)<input name="wet_adc" type="number" step="1" min="0" max="4095" defaultValue={station.wet_adc ?? ""} disabled={busy} /></label>
              <button type="submit" disabled={busy}>Salvar calibração</button>
            </form>
          </div>)}
          <button type="button" onClick={() => go("telemetry")}>Ver leituras</button>
        </section>}
        {area && area.latitude !== null && area.longitude !== null &&
          <AreaForecast key={area.id + ":" + area.latitude + ":" + area.longitude} latitude={area.latitude} longitude={area.longitude} />}
      </>}
    </section>
  </AppShell>
}
