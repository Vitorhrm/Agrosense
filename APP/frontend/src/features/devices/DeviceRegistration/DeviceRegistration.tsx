import { Bluetooth, Check, ChevronRight, RadioTower } from "lucide-react"
import { Button } from "../../../components/Button/Button"
import { getBleBridge, type DeviceRole } from "../provisioning.ble"
import { useDeviceProvisioning } from "../useDeviceProvisioning"
import { DeviceEditor } from "./DeviceEditor"
import "./DeviceRegistration.css"

const roleNames: Record<DeviceRole, string> = {
  transmitter: "Transmissor",
  receiver: "Estação (receptor)",
}

export function DeviceRegistration({ userId }: { userId: string }) {
  const bridge = getBleBridge()
  const { state, choose, connect, reset, retryCloud, save, scan } = useDeviceProvisioning(bridge, userId)
  const { step, role, info, devices, searched, error, saved } = state

  return (
    <section className="device-panel" aria-label="Configuração de dispositivos">
      <header className="device-panel-heading">
        <div>
          <h2>{role ? roleNames[role] : "Dispositivos AgroSense"}</h2>
          <p>{role ? "Configure ou edite o ESP32 por Bluetooth." : "Escolha o tipo do dispositivo para começar."}</p>
        </div>
      </header>

      {!bridge ? (
        <div className="device-notice">
          <Bluetooth size={18} />
          <p>A configuração por Bluetooth exige o aplicativo Android. No navegador, você pode continuar usando a telemetria e as demais telas.</p>
        </div>
      ) : (
        <>
          {error && <p className="inline-alert device-error" role="alert">{error}</p>}
          {step === "choose" && (
            <div className="device-options">
              {(["transmitter", "receiver"] as const).map(deviceRole => (
                <button key={deviceRole} type="button" onClick={() => choose(deviceRole)}>
                  <RadioTower size={20} />
                  <span><strong>{roleNames[deviceRole]}</strong></span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}

          {(step === "scan" || step === "scanning") && (
            <div className="device-stage">
              <h3>Busca Bluetooth</h3>
              <p>Ligue o ESP32 e aproxime o celular. Selecione o dispositivo para consultar a configuração atual.</p>
              <Button icon={Bluetooth} full disabled={step === "scanning"} onClick={scan}>Buscar por Bluetooth</Button>
              {step === "scanning" && <p className="device-progress" role="status">Buscando dispositivos…</p>}
              {searched && devices.length === 0 && <p className="device-progress" role="status">Nenhum dispositivo desse tipo foi encontrado.</p>}
              {devices.length > 0 && (
                <div className="device-results" aria-label="Dispositivos encontrados">
                  {devices.map(device => (
                    <button key={device.id} type="button" onClick={() => connect(device)}>
                      <Bluetooth size={20} />
                      <span>
                        <strong>{device.name || roleNames[device.role]}</strong>
                        <small>{device.id}{Number.isFinite(device.rssi) && ` · ${device.rssi} dBm`}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              )}
              <button className="device-back" type="button" onClick={() => reset()}>Escolher outro tipo</button>
            </div>
          )}

          {(step === "connect" || step === "read") && (
            <div className="device-stage">
              <p role="status">{step === "connect" ? "Conectando ao ESP32…" : "Lendo a configuração do ESP32…"}</p>
              <button className="device-back" type="button" onClick={() => reset(role)}>Cancelar conexão</button>
            </div>
          )}

          {info && (step === "edit" || step === "save") && (
            <DeviceEditor info={info} userId={userId} saving={step === "save"} onSave={save} onBack={() => reset(role)} />
          )}

          {step === "cloud" && <p className="device-progress" role="status">Configuração confirmada pelo ESP32. Salvando o cadastro na sua conta…</p>}
          {step === "partial" && <Button full onClick={retryCloud}>Tentar cadastro novamente</Button>}

          {step === "done" && saved && (
            <div className="device-stage device-complete">
              <div role="status">
                <span className="device-check"><Check size={27} /></span>
                <h3>Configuração e cadastro salvos</h3>
                <p>{saved.info.name}</p>
                {saved.info.wifi_saved && !saved.info.wifi_connected && (
                  <p>Rede Wi-Fi gravada. Reconecte por Bluetooth para verificar a conexão.</p>
                )}
              </div>
              <Button full onClick={() => reset(role)}>Configurar ou editar outro dispositivo</Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
