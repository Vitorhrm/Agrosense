import { useEffect, useId, useState, type FormEvent } from "react"
import { ChevronDown, RadioTower } from "lucide-react"
import { Button } from "../../../components/Button/Button"
import { buildSaveCommand, type DeviceForm, type DeviceInfo, type LoraNetwork, type WifiNetwork } from "../provisioning.ble"
import { activateStation, loadDeviceCloudContext, type DeviceCloudContext, type DeviceAssociation } from "../provisioning.cloud"
import { captureStationLocation } from "../stationLocation"

export function DeviceEditor({ info, userId, saving, scanningLora, loraNetworks, onScanLora, scanningWifi, wifiNetworks, onScanWifi, onSave, onBack }: {
  info: DeviceInfo
  userId: string
  saving: boolean
  scanningLora: boolean
  loraNetworks: LoraNetwork[] | null
  onScanLora: () => void
  scanningWifi: boolean
  wifiNetworks: WifiNetwork[] | null
  onScanWifi: () => void
  onSave: (json: string, association: DeviceAssociation) => void
  onBack: () => void
}) {
  const passwordHelpId = useId()
  const loraPasswordHelpId = useId()
  const loraGroupId = useId()
  const [form, setForm] = useState<DeviceForm>({
    name: info.name,
    wifiSsid: info.wifi_ssid ?? "",
    wifiPassword: "",
    openWifi: false,
    loraSsid: info.lora_ssid ?? "",
    loraReceiverId: info.lora_receiver_id ?? "",
    loraPassword: "",
  })
  const [cloud, setCloud] = useState<DeviceCloudContext | null>(null)
  const [cloudError, setCloudError] = useState(false)
  const [cloudRequest, setCloudRequest] = useState(0)
  const [areaOverride, setAreaOverride] = useState<string>()
  const [error, setError] = useState("")
  const [code, setCode] = useState("")
  const [activating, setActivating] = useState(false)
  const [locating, setLocating] = useState(false)
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

  async function activate() {
    if (!info.node || activating || saving || scanningLora || scanningWifi) return
    const normalized = code.trim().toLowerCase()
    setError("")
    if (!/^[a-f0-9]{32}$/.test(normalized)) {
      setError("Informe o código de ativação com 32 caracteres.")
      return
    }
    setActivating(true)
    try {
      if (!await activateStation(info.node, normalized)) {
        setError("Código inválido, expirado ou já utilizado nesta estação.")
        return
      }
      setCode("")
      setCloud(previous => previous ? { ...previous, stationGranted: true } : previous)
    } catch {
      setError("Não foi possível ativar a estação. Verifique a conexão e tente novamente.")
    } finally {
      setActivating(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || activating || scanningLora || locating) return
    setError("")
    try {
      const command = buildSaveCommand(form, info)
      const updateStationArea = Boolean(!receiver && cloud?.stationGranted && areaId !== cloud.areaId)
      let location
      if (!receiver && canAssignArea && areaId && (updateStationArea || !cloud.stationLocated)) {
        setLocating(true)
        location = await captureStationLocation()
      }
      onSave(JSON.stringify(command), {
        areaId: canAssignArea ? areaId || null : undefined,
        updateStationArea,
        location,
      })
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <form className="device-stage device-editor" onSubmit={submit}>
      <h3>Configuração do ESP32</h3>
      <p>Dispositivo {info.device_id}{info.node && ` · Estação ${info.node}`}</p>
      {error && <p className="inline-alert" role="alert">{error}</p>}
      {locating && <p role="status">Obtendo a localização do celular…</p>}
      {!receiver && <p>A primeira Station vinculada à área fornece a localização para a previsão. Cadastre-a no local da instalação.</p>}
      <fieldset disabled={saving || activating || scanningLora || locating}>
        <label className="field">
          <span>Nome do dispositivo</span>
          <div><input value={form.name} onChange={event => setField("name", event.target.value)} required maxLength={32} /></div>
        </label>
        {receiver && (
          <>
            <p className="device-wifi-status" role="status">
              {info.wifi_connected ? "Wi-Fi conectado." : info.wifi_saved ? "Rede Wi-Fi salva, sem conexão confirmada." : "Nenhuma rede Wi-Fi salva."}
            </p>
            <Button type="button" variant="secondary" onClick={onScanWifi} disabled={scanningWifi}>
              Buscar redes Wi-Fi
            </Button>
            {scanningWifi && <p role="status">Buscando redes próximas…</p>}
            {wifiNetworks?.length === 0 && <p>Nenhuma rede encontrada. Você pode digitar o SSID.</p>}
            {!!wifiNetworks?.length && <div className="device-results" aria-label="Redes Wi-Fi encontradas">
              {wifiNetworks.map(network => (
                <button type="button" key={network.ssid} onClick={() => setForm(previous => ({
                  ...previous, wifiSsid: network.ssid, wifiPassword: "", openWifi: network.open,
                }))}>
                  <span><strong>{network.ssid}</strong><small>{network.rssi} dBm · {network.open ? "Aberta" : "Protegida"}</small></span>
                </button>
              ))}
            </div>}
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
            <div className="device-lora-section">
              <h4>Rede LoRa</h4>
              {receiver ? (
                <label className="field">
                  <span>Nome da rede LoRa (SSID)</span>
                  <div><input value={form.loraSsid} maxLength={32} onChange={event => setField("loraSsid", event.target.value)} /></div>
                </label>
              ) : (
                <>
                  {form.loraSsid && form.loraReceiverId && (
                    <p className="device-lora-note">Rede selecionada: <strong>{form.loraSsid}</strong> · {form.loraReceiverId}</p>
                  )}
                  <Button variant="secondary" icon={RadioTower} full onClick={() => { setError(""); onScanLora() }}>
                    Buscar Access Points LoRa
                  </Button>
                  {scanningLora && <p className="device-progress" role="status">Buscando Access Points pelo rádio da Station…</p>}
                  {loraNetworks?.length === 0 && <p className="device-progress" role="status">Nenhum Access Point respondeu à busca.</p>}
                  {Boolean(loraNetworks?.length) && (
                    <fieldset className="device-lora-networks">
                      <legend>Access Points encontrados</legend>
                      {loraNetworks?.map(network => (
                        <label key={network.receiver_id + ":" + network.ssid}>
                          <input type="radio" name={loraGroupId}
                            checked={form.loraReceiverId === network.receiver_id && form.loraSsid === network.ssid}
                            onChange={() => setForm(previous => ({
                              ...previous, loraSsid: network.ssid, loraReceiverId: network.receiver_id, loraPassword: "",
                            }))}
                          />
                          <span><strong>{network.ssid}</strong><small>{network.receiver_id} · {network.rssi} dBm</small></span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </>
              )}
              <label className="field">
                <span>Senha LoRa</span>
                <div><input type="password" autoComplete="new-password" aria-describedby={loraPasswordHelpId} value={form.loraPassword} maxLength={64} onChange={event => setField("loraPassword", event.target.value)} /></div>
              </label>
              <p className="device-password-help" id={loraPasswordHelpId}>Para manter a rede e a senha atuais, deixe em branco. Ao mudar a rede, informe a senha.</p>
            </div>
          </>
        ) : <p className="device-lora-note">A busca e configuração LoRa estão indisponíveis neste dispositivo. Verifique o rádio e o firmware.</p>}
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
        {cloud && !receiver && !cloud.stationGranted && info.node && (
          <div className="device-cloud-retry">
            <label className="field">
              <span>Código de ativação da estação</span>
              <div><input type="password" autoComplete="off" maxLength={32} value={code} onChange={event => setCode(event.target.value)} /></div>
            </label>
            <button type="button" onClick={() => void activate()}>{activating ? "Ativando…" : "Ativar estação"}</button>
          </div>
        )}
        {!cloud && !cloudError && <p className="device-lora-note" role="status">Buscando áreas da conta…</p>}
        {cloudError && (
          <div className="device-cloud-retry">
            <p>Não foi possível buscar as áreas da conta.</p>
            <button type="button" onClick={() => { setCloudError(false); setCloudRequest(request => request + 1) }}>Tentar buscar áreas novamente</button>
          </div>
        )}
      </fieldset>
      <Button type="submit" full disabled={saving || activating || scanningLora}>{saving ? "Aguardando o ESP32…" : "Salvar no dispositivo"}</Button>
      {!saving && <button className="device-back" type="button" onClick={onBack}>Voltar à busca Bluetooth</button>}
    </form>
  )
}
