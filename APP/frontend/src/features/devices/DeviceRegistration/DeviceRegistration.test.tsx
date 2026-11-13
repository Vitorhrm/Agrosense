import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { buildSaveCommand, type DeviceForm, type DeviceInfo } from "../provisioning.ble"
import { DeviceRegistration } from "./DeviceRegistration"

const cloud = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), order: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn(), update: vi.fn(), rpc: vi.fn(),
}))
vi.mock("../../../lib/supabase", () => ({ getSupabase: () => ({ from: cloud.from, rpc: cloud.rpc }) }))

const bridge = { scan: vi.fn(), connect: vi.fn(), send: vi.fn(), disconnect: vi.fn() }
const userId = "test-user"
const area = { id: "area-1", name: "Área real" }
const info = {
  op: "info", ok: true, role: "receiver", name: "Estação antiga", device_id: "aabbccddeeff",
  node: "", wifi_ssid: "Wi-Fi existente", wifi_saved: true, wifi_connected: true,
  lora_supported: false,
}

function emit(detail: object) {
  act(() => window.dispatchEvent(new CustomEvent("agrosense-ble", { detail })))
}

function installBridge() {
  Object.defineProperty(window, "AgroSenseBle", { configurable: true, value: bridge })
}

beforeEach(() => {
  vi.resetAllMocks()
  cloud.from.mockReturnValue(cloud)
  cloud.select.mockReturnValue(cloud)
  cloud.update.mockReturnValue(cloud)
  cloud.eq.mockReturnValue(cloud)
  cloud.order.mockResolvedValue({ data: [area], error: null })
  cloud.maybeSingle.mockResolvedValue({ data: { area_id: area.id }, error: null })
  cloud.upsert.mockResolvedValue({ error: null })
})
afterEach(() => { Reflect.deleteProperty(window, "AgroSenseBle") })

it("informa que o BLE exige o aplicativo Android sem inventar resultados", () => {
  render(<DeviceRegistration userId={userId} />)
  expect(screen.getByText(/aplicativo Android/)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /buscar por Bluetooth/ })).not.toBeInTheDocument()
  expect(cloud.from).not.toHaveBeenCalled()
})

async function connectReceiver() {
  installBridge()
  const actions = userEvent.setup()
  render(<DeviceRegistration userId={userId} />)
  await actions.click(screen.getByRole("button", { name: "Access Point" }))
  await actions.click(screen.getByRole("button", { name: /buscar por Bluetooth/i }))
  expect(bridge.scan).toHaveBeenCalledWith("receiver")
  emit({ type: "device", id: "tx", name: "Station perto", role: "transmitter", rssi: -48 })
  emit({ type: "device", id: "ble-id", name: "AgroSense RX", role: "receiver", rssi: -62 })
  expect(screen.queryByText("Station perto")).not.toBeInTheDocument()
  await actions.click(screen.getByRole("button", { name: /AgroSense RX/ }))
  expect(bridge.connect).toHaveBeenCalledWith("ble-id")
  emit({ type: "connected" })
  expect(bridge.send).toHaveBeenCalledWith(JSON.stringify({ op: "info" }))
  emit({ type: "message", payload: info })
  await screen.findByRole("option", { name: area.name })
  expect(screen.getByLabelText("Nome do dispositivo")).toHaveValue(info.name)
  expect(screen.getByLabelText("Rede Wi-Fi (SSID)")).toHaveValue(info.wifi_ssid)
  expect(screen.getByRole("combobox", { name: "Área" })).toHaveValue(area.id)
  expect(screen.getByText(/busca e configuração LoRa/)).toBeInTheDocument()
  return actions
}

it("edita configuração existente e só salva metadados após confirmação do ESP32", async () => {
  const actions = await connectReceiver()
  await actions.clear(screen.getByLabelText("Nome do dispositivo"))
  await actions.type(screen.getByLabelText("Nome do dispositivo"), "Estação atualizada")
  await actions.click(screen.getByRole("button", { name: "Salvar no dispositivo" }))
  expect(bridge.send).toHaveBeenLastCalledWith(JSON.stringify({ op: "save", name: "Estação atualizada" }))
  expect(cloud.upsert).not.toHaveBeenCalled()
  emit({ type: "message", payload: { ...info, op: "save", name: "Estação atualizada" } })
  expect(await screen.findByText(/configuração e cadastro salvos/i)).toBeInTheDocument()
  expect(cloud.upsert).toHaveBeenCalledWith({
    user_id: userId, device_id: info.device_id, role: "receiver", name: "Estação atualizada",
    node: null, area_id: area.id, wifi_ssid: info.wifi_ssid, lora_ssid: null,
  }, { onConflict: "user_id,device_id" })
})

it("mantém a gravação no ESP32 quando o cadastro falha e tenta só a nuvem novamente", async () => {
  cloud.upsert.mockResolvedValueOnce({ error: { code: "offline" } })
  const actions = await connectReceiver()
  await actions.clear(screen.getByLabelText("Rede Wi-Fi (SSID)"))
  await actions.type(screen.getByLabelText("Rede Wi-Fi (SSID)"), "Rede nova")
  await actions.type(screen.getByLabelText("Senha da rede Wi-Fi"), "segredo123")
  await actions.click(screen.getByRole("button", { name: "Salvar no dispositivo" }))
  expect(JSON.parse(bridge.send.mock.lastCall![0])).toEqual({
    op: "save", name: info.name, wifi_ssid: "Rede nova", wifi_password: "segredo123",
  })
  emit({ type: "message", payload: { ...info, op: "save", wifi_ssid: "Rede nova" } })
  expect(await screen.findByRole("alert")).toHaveTextContent(/salva no dispositivo/i)
  await actions.click(screen.getByRole("button", { name: /tentar cadastro novamente/i }))
  await waitFor(() => expect(cloud.upsert).toHaveBeenCalledTimes(2))
  expect(bridge.send).toHaveBeenCalledTimes(2)
  expect(JSON.stringify(cloud.upsert.mock.calls)).not.toContain("segredo123")
})

it("vincula à área apenas a estação transmissora já liberada para a conta", async () => {
  installBridge()
  cloud.maybeSingle.mockResolvedValueOnce({ data: { area_id: null }, error: null })
    .mockResolvedValueOnce({ data: { node: "esp32-01" }, error: null })
  const transmitter = { ...info, role: "transmitter", node: "esp32-01", wifi_saved: false, wifi_ssid: "" }
  const actions = userEvent.setup()
  render(<DeviceRegistration userId={userId} />)
  await actions.click(screen.getByRole("button", { name: "Station" }))
  await actions.click(screen.getByRole("button", { name: /buscar por Bluetooth/i }))
  emit({ type: "device", id: "tx", name: "AgroSense TX", role: "transmitter", rssi: -48 })
  await actions.click(screen.getByRole("button", { name: /AgroSense TX/ }))
  emit({ type: "connected" })
  emit({ type: "message", payload: transmitter })
  await screen.findByRole("option", { name: area.name })
  expect(screen.queryByLabelText("Rede Wi-Fi (SSID)")).not.toBeInTheDocument()
  await actions.selectOptions(screen.getByRole("combobox", { name: "Área" }), area.id)
  await actions.click(screen.getByRole("button", { name: "Salvar no dispositivo" }))
  expect(cloud.update).not.toHaveBeenCalled()
  emit({ type: "message", payload: { ...transmitter, op: "save" } })
  expect(await screen.findByText(/configuração e cadastro salvos/i)).toBeInTheDocument()
  expect(cloud.from).toHaveBeenCalledWith("agro_station_access")
  expect(cloud.update).toHaveBeenCalledWith({ area_id: area.id })
  expect(cloud.eq).toHaveBeenCalledWith("user_id", userId)
  expect(cloud.eq).toHaveBeenCalledWith("node", transmitter.node)
})

it("descobre Access Points reais via LoRa e envia o pareamento da Station apenas pelo BLE", async () => {
  installBridge()
  const transmitter = { ...info, role: "transmitter", node: "esp32-01", wifi_saved: false, wifi_ssid: "", lora_supported: true }
  const actions = userEvent.setup()
  render(<DeviceRegistration userId={userId} />)
  await actions.click(screen.getByRole("button", { name: "Station" }))
  await actions.click(screen.getByRole("button", { name: /buscar por Bluetooth/i }))
  emit({ type: "device", id: "tx", name: "AgroSense TX", role: "transmitter", rssi: -48 })
  await actions.click(screen.getByRole("button", { name: /AgroSense TX/ }))
  emit({ type: "connected" })
  emit({ type: "message", payload: transmitter })
  await actions.click(screen.getByRole("button", { name: "Buscar Access Points LoRa" }))
  emit({ type: "message", payload: { ok: false, error: "lora_busy" } })
  expect(screen.getByRole("alert")).toHaveTextContent(/rádio LoRa está ocupado/i)
  await actions.click(screen.getByRole("button", { name: "Buscar Access Points LoRa" }))
  expect(bridge.send).toHaveBeenLastCalledWith(JSON.stringify({ op: "scan_lora" }))
  expect(screen.getByRole("button", { name: "Salvar no dispositivo" })).toBeDisabled()
  emit({ type: "message", payload: { ok: true, op: "scan_lora", networks: [
    { ssid: "Fazenda Norte", receiver_id: "001122334455", rssi: -78 },
  ] } })
  await actions.click(screen.getByRole("radio", { name: /Fazenda Norte/ }))
  await actions.click(screen.getByRole("button", { name: "Salvar no dispositivo" }))
  expect(screen.getByRole("alert")).toHaveTextContent(/senha LoRa/)
  await actions.type(screen.getByLabelText("Senha LoRa"), "senha-segura-1234")
  await actions.click(screen.getByRole("button", { name: "Salvar no dispositivo" }))
  expect(JSON.parse(bridge.send.mock.lastCall![0])).toEqual({
    op: "save", name: transmitter.name, lora_ssid: "Fazenda Norte",
    lora_receiver_id: "001122334455", lora_password: "senha-segura-1234",
  })
  emit({ type: "message", payload: {
    ...transmitter, op: "save", lora_ssid: "Fazenda Norte", lora_receiver_id: "001122334455",
  } })
  expect(await screen.findByText(/configuração e cadastro salvos/i)).toBeInTheDocument()
  expect(JSON.stringify(cloud.upsert.mock.calls)).not.toContain("senha-segura-1234")
})

it("ativa uma estação pelo código da conta sem enviar o código ao rádio", async () => {
  installBridge()
  cloud.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  cloud.rpc.mockResolvedValue({ data: true, error: null })
  const station = { ...info, role: "transmitter", node: "esp32-01" }
  const code = "aabbccddeeff00112233445566778899"
  const actions = userEvent.setup()
  render(<DeviceRegistration userId={userId} />)
  await actions.click(screen.getByRole("button", { name: "Station" }))
  await actions.click(screen.getByRole("button", { name: /buscar por Bluetooth/i }))
  emit({ type: "device", id: "tx", name: "AgroSense TX", role: "transmitter", rssi: -48 })
  await actions.click(screen.getByRole("button", { name: /AgroSense TX/ }))
  emit({ type: "connected" })
  emit({ type: "message", payload: station })
  await actions.type(await screen.findByLabelText("Código de ativação da estação"), code)
  await actions.click(screen.getByRole("button", { name: "Ativar estação" }))
  expect(await screen.findByRole("combobox", { name: "Área" })).toBeInTheDocument()
  expect(cloud.rpc).toHaveBeenCalledWith("agro_activate_station", { p_node: station.node, p_code: code })
  expect(bridge.send).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ op: "info" }))
})

it("permite mudar a senha LoRa do Access Point e omite campos de configuração inalterados", () => {
  const current: DeviceInfo = {
    ...info, role: "receiver", lora_supported: true, lora_ssid: "Rede da área", lora_receiver_id: info.device_id,
  }
  const form: DeviceForm = {
    name: current.name, wifiSsid: current.wifi_ssid!, wifiPassword: "", openWifi: false,
    loraSsid: current.lora_ssid!, loraReceiverId: current.device_id, loraPassword: "",
  }
  expect(buildSaveCommand(form, current)).toEqual({ op: "save", name: current.name })
  expect(() => buildSaveCommand({ ...form, loraSsid: "Outra área" }, current)).toThrow(/senha LoRa/)
  expect(buildSaveCommand({ ...form, loraPassword: "senha-segura-1234" }, current)).toEqual({
    op: "save", name: current.name, lora_ssid: "Rede da área", lora_password: "senha-segura-1234",
  })
})
