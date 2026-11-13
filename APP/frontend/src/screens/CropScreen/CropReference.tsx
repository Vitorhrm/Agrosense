import { useEffect, useState, type MouseEvent } from "react"
import { getSupabase } from "../../lib/supabase"

const stages = [
  ["kc_initial", "Inicial"],
  ["kc_development", "Desenvolvimento"],
  ["kc_mid", "Meio do ciclo"],
  ["kc_late", "Final do ciclo"],
] as const

type Stage = typeof stages[number][0]
type Crop = { id: string; name: string; source_url: string } & Record<Stage, number>
const conditions = "Kc indicativo da FAO para umidade do ar e vento moderados. Ajuste ao clima e ao manejo local."

export function CropReference() {
  const [crops, setCrops] = useState<Crop[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [cropId, setCropId] = useState("")
  const [stage, setStage] = useState<Stage>("kc_initial")
  const [applied, setApplied] = useState(false)
  const crop = crops?.find(item => item.id === cropId)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const { data, error } = await getSupabase().from("agro_crop_catalog")
          .select("id,name,kc_initial,kc_development,kc_mid,kc_late,source_url")
          .order("name").abortSignal(controller.signal)
        if (error) throw error
        if (!controller.signal.aborted) setCrops(data)
      } catch {
        if (!controller.signal.aborted) setUnavailable(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  function apply(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form
    if (!form || !crop) return
    const values = {
      crop: crop.name,
      stage: stages.find(([key]) => key === stage)?.[1] ?? "",
      kc: String(crop[stage]),
      source: "FAO, Irrigation Water Needs, tabela 8 · " + crop.source_url,
      conditions,
    }
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name)
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value
    }
    setApplied(true)
  }

  return <fieldset>
    <legend>Referência de cultura</legend>
    {unavailable ? <p role="status">Catálogo indisponível. Você pode preencher os dados da cultura manualmente.</p>
      : !crops ? <p role="status">Carregando catálogo…</p>
      : <>
        <label>Cultura no catálogo
          <select value={cropId} onChange={event => { setCropId(event.target.value); setApplied(false) }}>
            <option value="">Escolha uma cultura</option>
            {crops.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {crop && <>
          <label>Fase de referência
            <select value={stage} onChange={event => { setStage(event.target.value as Stage); setApplied(false) }}>
              {stages.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <p>Kc de referência: {crop[stage].toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. <a href={crop.source_url}>Fonte: FAO, tabela 8</a>.</p>
          <button type="button" onClick={apply}>Usar referência nesta área</button>
          {applied && <p role="status">Cultura e Kc preenchidos. Revise e salve a área.</p>}
        </>}
      </>}
  </fieldset>
}
