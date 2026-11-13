export type DeviceRole = "transmitter" | "receiver"

export type BleDevice = {
  id: string
  name: string
  role: DeviceRole
  rssi: number
}

export type LoraNetwork = { ssid: string; receiver_id: string; rssi: number }

export type DeviceInfo = {
  device_id: string
  role: DeviceRole
  name: string
  node?: string
  wifi_ssid?: string
  wifi_saved?: boolean
  wifi_connected?: boolean
  lora_ssid?: string
  lora_receiver_id?: string
  lora_supported?: boolean
}

type BleMessage = Partial<DeviceInfo> & {
  ok: boolean
  op?: "info" | "save" | "scan_lora"
  networks?: unknown
  error?: string
}

export type BleEvent =
  | ({ type: "device" } & BleDevice)
  | { type: "connected" }
  | { type: "scan-complete" }
  | { type: "disconnected" }
  | { type: "error"; message: string }
  | { type: "message"; payload: BleMessage }

export type BleBridge = {
  scan(role: DeviceRole): void
  connect(deviceId: string): void
  send(json: string): void
  disconnect(): void
}

export function getBleBridge(): BleBridge | undefined {
  return (window as Window & { AgroSenseBle?: BleBridge }).AgroSenseBle
}

export function readDeviceInfo(payload: BleMessage, role: DeviceRole): DeviceInfo | null {
  if (
    payload.role !== role ||
    typeof payload.device_id !== "string" ||
    !/^[0-9a-f]{12}$/.test(payload.device_id) ||
    typeof payload.name !== "string" ||
    !payload.name.trim()
  ) return null
  return {
    device_id: payload.device_id,
    role,
    name: payload.name,
    node: payload.node,
    wifi_ssid: payload.wifi_ssid,
    wifi_saved: payload.wifi_saved,
    wifi_connected: payload.wifi_connected,
    lora_ssid: payload.lora_ssid,
    lora_receiver_id: payload.lora_receiver_id,
    lora_supported: payload.lora_supported,
  }
}

export type DeviceForm = {
  name: string
  wifiSsid: string
  wifiPassword: string
  openWifi: boolean
  loraSsid: string
  loraReceiverId: string
  loraPassword: string
}

type SaveCommand = {
  op: "save"
  name: string
  wifi_ssid?: string
  wifi_password?: string
  lora_ssid?: string
  lora_password?: string
  lora_receiver_id?: string
}

const encoder = new TextEncoder()
const byteLength = (value: string) => encoder.encode(value).length
const validReceiverId = /^[0-9a-f]{12}$/

function validLoraText(value: string, minimum: number, maximum: number) {
  const bytes = byteLength(value)
  const hasControl = Array.from(value).some(character => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
  return !hasControl && bytes >= minimum && bytes <= maximum
}

export function readLoraNetworks(payload: unknown): LoraNetwork[] | null {
  if (!Array.isArray(payload)) return null
  const networks = new Map<string, LoraNetwork>()
  for (const network of payload) {
    if (
      !network || typeof network !== "object" ||
      typeof network.ssid !== "string" || !validLoraText(network.ssid, 1, 32) ||
      typeof network.receiver_id !== "string" || !validReceiverId.test(network.receiver_id) ||
      !Number.isFinite(network.rssi)
    ) continue
    const key = network.receiver_id + ":" + network.ssid
    const previous = networks.get(key)
    if (!previous || network.rssi > previous.rssi) {
      networks.set(key, { ssid: network.ssid, receiver_id: network.receiver_id, rssi: network.rssi })
    }
  }
  return [...networks.values()].sort((first, second) => second.rssi - first.rssi)
}

export function buildSaveCommand(form: DeviceForm, current: DeviceInfo): SaveCommand {
  const name = form.name.trim()
  if (!name || byteLength(name) > 32) throw new Error("Informe um nome de 1 a 32 bytes.")
  const command: SaveCommand = { op: "save", name }

  if (current.role === "receiver") {
    const ssidChanged = form.wifiSsid !== (current.wifi_ssid ?? "")
    const changeWifi = ssidChanged || form.openWifi || Boolean(form.wifiPassword)
    if (changeWifi) {
      if (!form.wifiSsid || byteLength(form.wifiSsid) > 32) {
        throw new Error("Informe um nome de rede Wi-Fi de 1 a 32 bytes.")
      }
      const password = form.openWifi ? "" : form.wifiPassword
      const passwordBytes = byteLength(password)
      const isPsk = /^[0-9a-f]{64}$/i.test(password)
      if (!form.openWifi && ((ssidChanged && !password) || (password && !isPsk && (passwordBytes < 8 || passwordBytes > 63)))) {
        throw new Error("Informe uma senha Wi-Fi de 8 a 63 bytes ou indique que a rede é aberta.")
      }
      command.wifi_ssid = form.wifiSsid
      if (form.openWifi || password) command.wifi_password = password
    }
  }

  const transmitter = current.role === "transmitter"
  const loraChanged = form.loraSsid !== (current.lora_ssid ?? "") ||
    (transmitter && form.loraReceiverId !== (current.lora_receiver_id ?? ""))
  if (current.lora_supported && (loraChanged || form.loraPassword)) {
    if (!validLoraText(form.loraSsid, 1, 32)) throw new Error("Informe um SSID LoRa de 1 a 32 bytes, sem caracteres de controle.")
    if (transmitter && !validReceiverId.test(form.loraReceiverId)) throw new Error("Selecione um Access Point na busca LoRa.")
    if (!validLoraText(form.loraPassword, 16, 64)) {
      throw new Error("Informe uma senha LoRa de 16 a 64 bytes, sem caracteres de controle.")
    }
    command.lora_ssid = form.loraSsid
    if (transmitter) command.lora_receiver_id = form.loraReceiverId
    command.lora_password = form.loraPassword
  }
  return command
}
