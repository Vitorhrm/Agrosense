import { useEffect, useState } from "react"
import { relativeSoilIndex } from "../../lib/soilIndex"
import { getSupabase } from "../../lib/supabase"

type Station = { node: string; dry_adc: number | null; wet_adc: number | null }
type Reading = Parameters<typeof relativeSoilIndex>[0] & { received_at: string }
const freshnessMs = 35 * 60 * 1000
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })

function StationSoil({ station, min, max }: { station: Station; min: number; max: number }) {
  const [result, setResult] = useState<{ reading: Reading | null; error: boolean }>()
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const { data, error } = await getSupabase().from("agro_readings")
          .select("received_at,soil_enabled,soil_index_pct,soil_raw").eq("node", station.node)
          .order("received_at", { ascending: false }).order("id", { ascending: false })
          .limit(1).abortSignal(controller.signal).maybeSingle()
        if (!controller.signal.aborted) setResult({ reading: data, error: Boolean(error) })
      } catch {
        if (!controller.signal.aborted) setResult({ reading: null, error: true })
      }
    }
    void load()
    return () => controller.abort()
  }, [station.node])

  if (!result) return <p role="status">Consultando a última leitura…</p>
  if (result.error) return <p role="alert">Não foi possível consultar a leitura.</p>
  const reading = result.reading
  if (!reading) return <p>A estação ainda não tem leituras.</p>
  const index = relativeSoilIndex(reading, station)
  if (!index) return <p>Última leitura sem índice de solo válido.</p>

  // Backlogged samples can arrive after collection. This check uses server reception time.
  const received = new Date(reading.received_at)
  const recent = Number.isFinite(received.getTime()) && Date.now() - received.getTime() <= freshnessMs
  const status = index.value < min ? "Abaixo da faixa" : index.value > max ? "Acima da faixa" : "Dentro da faixa"
  return <p role="status">
    {recent ? status : "Leitura antiga"} · {numberFormat.format(index.value)}% de índice relativo.
    {" "}Recebida em {received.toLocaleString("pt-BR")}.
  </p>
}

export function AreaSoil({ unit, min, max, stations }: {
  unit: string | null; min: number | null; max: number | null; stations: Station[]
}) {
  const [node, setNode] = useState("")
  const station = stations.find(item => item.node === node) ?? stations[0]
  return <section className="crop-config">
    <h2>Leitura do solo na área</h2>
    {unit === "vwc_pct" ? <p>A comparação requer uma leitura de teor volumétrico calibrado.</p>
      : unit !== "relative_index" || min === null || max === null || min >= max ? <p>Configure uma faixa de índice relativo na área.</p>
      : !station ? <p>Vincule uma estação à área para consultar o solo.</p>
      : <>
        <label>Estação
          <select value={station.node} onChange={event => setNode(event.target.value)}>
            {stations.map(item => <option key={item.node}>{item.node}</option>)}
          </select>
        </label>
        <StationSoil key={station.node} station={station} min={min} max={max} />
      </>}
  </section>
}
