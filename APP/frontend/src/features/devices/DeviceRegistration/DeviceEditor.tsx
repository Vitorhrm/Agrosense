import { useEffect, useId, useState, type FormEvent } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "../../../components/Button/Button"
import { buildSaveCommand, type DeviceForm, type DeviceInfo } from "../provisioning.ble"
import { loadDeviceCloudContext, type DeviceCloudContext, type SavedDevice } from "../provisioning.cloud"

type Association = Pick<SavedDevice, "areaId" | "updateStationArea">

export function DeviceEditor({ info, userId, saving, onSave, onBack }: {
  info: DeviceInfo
  userId: string
  saving: boolean
  onSave: (json: string, association: Association) => void
  onBack: () => void
}) {
  const passwordHelpId = useId()
  const [form, setForm] = useState<DeviceForm>({
    name: info.name,
    wifiSsid: info.wifi_ssid ?? "",
    wifiPassword: "",
    openWifi: false,
    loraSsid: info.lora_ssid ?? "",
    loraPassword: "",
  })
  const [cloud, setCloud] = useState<DeviceCloudContext | null>(null)
  const [cloudError, setCloudError] = useState(false)
  const [cloudRequest, setCloudRequest] = useState(0)
  const [areaOverride, setAreaOverride] = useState<string>()
  const [error, setError] = useState("")
  const receiver = info.role === "receiver"
  const areaId = areaOverride ?? cloud?.areaId
  const canAssignArea = cloud && (receiver || cloud.stationGranted)

  useEffect(() => {
    let cancelled = false
    void loadDeviceCloudContext(userId, info).then(
      result => { if (!cancelled) setCloud(result) },
      () => { if (!cancelled) setCloudError(true) },
    )
    return () => { cancelled = true }
  }, [userId, info, cloudRequest])

  function setField<Field extends keyof DeviceForm>(field: Field, value: DeviceForm[Field]) {
    setForm(previous => ({ ...previous, [field]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setError("")
    try {
      const command = buildSaveCommand(form, info)
      onSave(JSON.stringify(command), {
        areaId: canAssignArea ? areaId || null : undefined,
        updateStationArea: Boolean(!receiver && cloud?.stationGranted && areaId !== cloud.areaId),
      })
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message)
    }
  }

  return (
    <form className="device-stage device-editor" onSubmit={submit}>
      <h3>Configuração do ESP32</h3>
      <p>Dispositivo {info.device_id}{info.node && ` · Estação ${info.node}`}</p>
      {error && <p className="inline-alert" role="alert">{error}</p>}
      <fieldset disabled={saving}>
        <label className="field">
          <span>Nome do dispositivo</span>
          <div><input value={form.name} onChange={event => setField("name", event.target.value)} required maxLength={32} /></div>
        </label>
        {receiver && (
          <>
            <p className="device-wifi-status" role="status">
              {info.wifi_connected ? "Wi-Fi conectado." : info.wifi_saved ? "Rede Wi-Fi salva, sem conexão confirmada." : "Nenhuma rede Wi-Fi salva."}
            </p>
            <label className="field">
              <span>Rede Wi-Fi (SSID)</span>
              <div><input value={form.wifiSsid} onChange={event => setField("wifiSsid", event.target.value)} maxLength={32} /></div>
            </label>
            <label className="field">
              <span>Senha da rede Wi-Fi</span>
              <div><input type="password" autoComplete="new-password" aria-describedby={passwordHelpId} value={form.wifiPassword} onChange={event => setField("wifiPassword", event.target.value)} disabled={form.openWifi} maxLength={64} /></div>
            </label>
            <p className="device-password-help" id={passwordHelpId}>Em branco mantém a senha da rede atual.</p>
            <label className="device-checkbox">
              <input type="checkbox" checked={form.openWifi} onChange={event => setField("openWifi", event.target.checked)} /> Rede Wi-Fi aberta, sem senha
            </label>
          </>
        )}
        {info.lora_supported ? (
          <>
            <label className="field">
              <span>Identificador LoRa</span>
              <div><input value={form.loraSsid} onChange={event => setField("loraSsid", event.target.value)} /></div>
            </label>
            <label className="field">
              <span>Senha LoRa</span>
              <div><input type="password" autoComplete="new-password" value={form.loraPassword} onChange={event => setField("loraPassword", event.target.value)} /></div>
            </label>
          </>
        ) : <p className="device-lora-note">A busca e configuração LoRa pelo aplicativo ainda dependem do suporte do rádio DX-LR32.</p>}
        {canAssignArea && (
          <label className="field">
            <span>Área</span>
            <div>
              <select value={areaId ?? ""} onChange={event => setAreaOverride(event.target.value)}>
                <option value="">Sem área vinculada</option>
                {cloud.areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>
        )}
        {cloud && !receiver && !cloud.stationGranted && <p className="device-lora-note">O vínculo com uma área fica disponível quando esta estação for liberada para sua conta.</p>}
        {!cloud && !cloudError && <p className="device-lora-note" role="status">Buscando áreas da conta…</p>}
        {cloudError && (
          <div className="device-cloud-retry">
            <p>Não foi possível buscar as áreas da conta.</p>
            <button type="button" onClick={() => { setCloudError(false); setCloudRequest(request => request + 1) }}>Tentar buscar áreas novamente</button>
          </div>
        )}
      </fieldset>
      <Button type="submit" full disabled={saving}>{saving ? "Aguardando o ESP32…" : "Salvar no dispositivo"}</Button>
      {!saving && <button className="device-back" type="button" onClick={onBack}>Voltar à busca Bluetooth</button>}
    </form>
  )
}
