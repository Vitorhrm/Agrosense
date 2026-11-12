export type DeviceRole = "transmitter" | "receiver"

export type BleDevice = {
  id: string
  name: string
  role: DeviceRole
  rssi: number
}

export type DeviceInfo = {
  device_id: string
  role: DeviceRole
  name: string
  node?: string
  wifi_ssid?: string
  wifi_saved?: boolean
  wifi_connected?: boolean
  lora_ssid?: string
  lora_supported?: boolean
}

type BleMessage = Partial<DeviceInfo> & {
  ok: boolean
  op?: "info" | "save"
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
    lora_supported: payload.lora_supported,
  }
}

export type DeviceForm = {
  name: string
  wifiSsid: string
  wifiPassword: string
  openWifi: boolean
  loraSsid: string
  loraPassword: string
}

type SaveCommand = {
  op: "save"
  name: string
  wifi_ssid?: string
  wifi_password?: string
  lora_ssid?: string
  lora_password?: string
}

const encoder = new TextEncoder()
const byteLength = (value: string) => encoder.encode(value).length

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

  if (current.lora_supported && (form.loraSsid !== (current.lora_ssid ?? "") || form.loraPassword)) {
    command.lora_ssid = form.loraSsid
    if (form.loraPassword) command.lora_password = form.loraPassword
  }
  return command
}
