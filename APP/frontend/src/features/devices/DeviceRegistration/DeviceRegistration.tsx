import { useId, useState, type FormEvent } from "react"
import {
  Bluetooth,
  Check,
  ChevronRight,
  LockKeyhole,
  Plus,
  RadioTower,
  Wifi,
  X,
} from "lucide-react"
import { Button } from "../../../components/Button/Button"
import {
  bluetoothDevices,
  loraTransmitters,
  type DeviceKind,
} from "../provisioning.demo"
import "./DeviceRegistration.css"

type Step = "choose" | "bluetooth" | "configure" | "done"

export function DeviceRegistration({
  areaName,
  initialKind,
  onClose,
}: {
  areaName: string
  initialKind?: DeviceKind
  onClose?: () => void
}) {
  const id = useId()
  const [expanded, setExpanded] = useState(Boolean(initialKind))
  const [kind, setKind] = useState<DeviceKind>(initialKind ?? "transmitter")
  const [step, setStep] = useState<Step>(initialKind ? "bluetooth" : "choose")
  const [devicesVisible, setDevicesVisible] = useState(false)
  const [deviceName, setDeviceName] = useState("")
  const [wifi, setWifi] = useState("")
  const [password, setPassword] = useState("")
  const [loraId, setLoraId] = useState("")
  const [stationName, setStationName] = useState("")
  const [networksVisible, setNetworksVisible] = useState(false)
  const transmitter = kind === "transmitter"
  const label = transmitter ? "transmissor" : "estação"

  const clearConfiguration = () => {
    setDevicesVisible(false)
    setDeviceName("")
    setWifi("")
    setPassword("")
    setLoraId("")
    setStationName("")
    setNetworksVisible(false)
  }
  const choose = (next: DeviceKind) => {
    clearConfiguration()
    setKind(next)
    setStep("bluetooth")
  }
  const close = () => {
    clearConfiguration()
    setStep("choose")
    setExpanded(false)
    onClose?.()
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !(transmitter
        ? wifi.trim() && loraId.trim()
        : stationName.trim() && networksVisible && loraId)
    )
      return
    // Protótipo: não persiste a senha, não chama BLE e não grava no Supabase.
    setPassword("")
    setStep("done")
  }

  return (
    <div className="device-registration">
      {!expanded ? (
        <Button icon={Plus} full onClick={() => setExpanded(true)}>
          Cadastrar dispositivo
        </Button>
      ) : (
        <section
          className="device-panel"
          aria-label={`Cadastro de dispositivo em ${areaName}`}
        >
          <header className="device-panel-heading">
            <div>
              <span>DISPOSITIVOS DA ÁREA</span>
              <h2>
                {step === "choose"
                  ? "O que deseja cadastrar?"
                  : `Cadastrar ${label}`}
              </h2>
              <p>{areaName}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar cadastro"
              onClick={close}
            >
              <X size={18} />
            </button>
          </header>
          <div className="device-demo-note">
            <Bluetooth size={18} />
            <p>
              <strong>Prévia de configuração</strong>Bluetooth e LoRa simulados.
              Nenhum dispositivo será conectado ou configurado. Use dados
              fictícios.
            </p>
          </div>
          {step !== "choose" && step !== "done" && (
            <ol className="device-steps" aria-label="Etapas do cadastro">
              <li className={step === "bluetooth" ? "current" : "complete"}>
                1. Bluetooth
              </li>
              <li className={step === "configure" ? "current" : ""}>
                2. Configuração
              </li>
            </ol>
          )}
          {step === "choose" && (
            <div className="device-options">
              <button type="button" onClick={() => choose("transmitter")}>
                <Wifi size={23} />
                <span>
                  <strong>Cadastrar transmissor</strong>
                  <small>Conectar ao Wi-Fi e definir a rede LoRa</small>
                </span>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => choose("station")}>
                <RadioTower size={23} />
                <span>
                  <strong>Cadastrar estação</strong>
                  <small>Nomear a estação e escolher o transmissor</small>
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          {step === "bluetooth" && (
            <div className="device-stage">
              <h3>Encontre o ESP32</h3>
              <p>
                Aproxime o celular do dispositivo. Na versão completa, ele será
                encontrado e conectado por Bluetooth.
              </p>
              <Button
                variant="secondary"
                icon={Bluetooth}
                full
                onClick={() => setDevicesVisible(true)}
              >
                {devicesVisible
                  ? "Buscar novamente (simulação)"
                  : "Buscar via Bluetooth (simulação)"}
              </Button>
              {devicesVisible && (
                <div className="device-results" aria-live="polite">
                  <p>Dispositivos de exemplo</p>
                  {bluetoothDevices[kind].map((device) => (
                    <button
                      type="button"
                      key={device.id}
                      onClick={() => {
                        setDeviceName(device.name)
                        setStep("configure")
                      }}
                    >
                      <Bluetooth size={20} />
                      <span>
                        <strong>{device.name}</strong>
                        <small>Selecionar dispositivo de exemplo</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              )}
              {!initialKind && (
                <button
                  type="button"
                  className="device-back"
                  onClick={() => {
                    clearConfiguration()
                    setStep("choose")
                  }}
                >
                  Voltar às opções
                </button>
              )}
            </div>
          )}
          {step === "configure" && (
            <form className="device-stage" onSubmit={submit}>
              <div className="device-selected">
                <Bluetooth size={16} />
                <span>{deviceName} · simulação</span>
              </div>
              {transmitter ? (
                <>
                  <h3>Configure o transmissor</h3>
                  <p>
                    Informe a rede Wi-Fi que o transmissor usará para acessar a
                    internet e o identificador da sua rede LoRa.
                  </p>
                  <label className="field">
                    <span>Nome da rede Wi-Fi (SSID)</span>
                    <div>
                      <Wifi size={18} />
                      <input
                        value={wifi}
                        onChange={(e) => setWifi(e.target.value)}
                        placeholder="Ex.: Wi-Fi da fazenda"
                        maxLength={32}
                        required
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span id={`${id}-password-label`}>Senha do Wi-Fi</span>
                    <div>
                      <LockKeyhole size={18} />
                      <input
                        aria-labelledby={`${id}-password-label`}
                        type="password"
                        autoComplete="off"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha da rede de exemplo"
                        maxLength={64}
                      />
                    </div>
                    <small>
                      Deixe em branco para uma rede aberta. Use somente dados
                      fictícios nesta prévia.
                    </small>
                  </label>
                  <label className="field">
                    <span id={`${id}-lora-label`}>
                      Identificador da rede LoRa
                    </span>
                    <div>
                      <RadioTower size={18} />
                      <input
                        aria-labelledby={`${id}-lora-label`}
                        value={loraId}
                        onChange={(e) => setLoraId(e.target.value)}
                        placeholder="Ex.: AGRO-TX-01"
                        maxLength={32}
                        required
                      />
                    </div>
                    <small>
                      Identifica o transmissor para as estações. RSSI é a
                      intensidade do sinal.
                    </small>
                  </label>
                </>
              ) : (
                <>
                  <h3>Configure a estação</h3>
                  <p>
                    Na versão completa, o ESP32 buscará os transmissores LoRa
                    próximos e enviará a lista ao celular por Bluetooth.
                  </p>
                  <label className="field">
                    <span>Nome da estação</span>
                    <div>
                      <RadioTower size={18} />
                      <input
                        value={stationName}
                        onChange={(e) => setStationName(e.target.value)}
                        placeholder="Ex.: Estação Sul"
                        maxLength={60}
                        required
                      />
                    </div>
                  </label>
                  <Button
                    variant="secondary"
                    icon={RadioTower}
                    full
                    onClick={() => {
                      setNetworksVisible(true)
                      setLoraId("")
                    }}
                  >
                    {networksVisible
                      ? "Repetir busca LoRa (simulação)"
                      : "Buscar transmissores LoRa (simulação)"}
                  </Button>
                  {networksVisible && (
                    <fieldset className="device-networks">
                      <legend>Transmissores de exemplo</legend>
                      {loraTransmitters.map((network) => (
                        <label key={network.id} htmlFor={`${id}-${network.id}`}>
                          <input
                            id={`${id}-${network.id}`}
                            type="radio"
                            name={`${id}-lora`}
                            value={network.id}
                            checked={loraId === network.id}
                            onChange={() => setLoraId(network.id)}
                            required
                          />
                          <span>
                            <strong>{network.id}</strong>
                            <small>RSSI: {network.rssi} dBm · exemplo</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </>
              )}
              <Button
                type="submit"
                full
                disabled={
                  transmitter
                    ? !wifi.trim() || !loraId.trim()
                    : !stationName.trim() || !loraId
                }
              >
                Concluir simulação
              </Button>
              <button
                type="button"
                className="device-back"
                onClick={() => {
                  clearConfiguration()
                  setStep("bluetooth")
                }}
              >
                Voltar à busca Bluetooth
              </button>
            </form>
          )}
          {step === "done" && (
            <div className="device-stage device-complete" role="status">
              <span className="device-check">
                <Check size={27} />
              </span>
              <h3>Simulação concluída</h3>
              <p>
                Prévia da configuração de {label} para {areaName}. Nenhum
                cadastro foi salvo ou enviado ao ESP32.
              </p>
              <dl>
                <div>
                  <dt>Dispositivo</dt>
                  <dd>{deviceName}</dd>
                </div>
                {!transmitter && (
                  <div>
                    <dt>Nome da estação</dt>
                    <dd>{stationName.trim()}</dd>
                  </div>
                )}
                {transmitter && (
                  <div>
                    <dt>Wi-Fi (SSID)</dt>
                    <dd>{wifi.trim()}</dd>
                  </div>
                )}
                <div>
                  <dt>Transmissor / rede LoRa</dt>
                  <dd>{loraId.trim()}</dd>
                </div>
              </dl>
              <Button full onClick={close}>
                Voltar para a área
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
