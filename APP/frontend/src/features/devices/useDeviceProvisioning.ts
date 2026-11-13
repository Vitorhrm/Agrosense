import { useEffect, useRef, useState } from "react"
import { readDeviceInfo, readLoraNetworks, type LoraNetwork, type BleBridge, type BleDevice, type BleEvent, type DeviceInfo, type DeviceRole } from "./provisioning.ble"
import { saveDeviceMetadata, type SavedDevice } from "./provisioning.cloud"

type Step = "choose" | "scan" | "scanning" | "connect" | "read" | "edit" | "lora-scan" | "save" | "cloud" | "partial" | "done"

type ProvisioningState = {
  step: Step
  role?: DeviceRole
  devices: BleDevice[]
  searched: boolean
  loraNetworks: LoraNetwork[] | null
  info?: DeviceInfo
  saved?: SavedDevice
  error?: string
}

const initialState: ProvisioningState = { step: "choose", devices: [], searched: false, loraNetworks: null }
const waitMs: Partial<Record<Step, number>> = { scanning: 15000, connect: 25000, read: 12000, "lora-scan": 12000, save: 35000 }

const loraErrors = new Map([
  ["lora_unavailable", "Rádio LoRa indisponível. Confira a conexão do módulo e tente novamente."],
  ["lora_busy", "O rádio LoRa está ocupado. Aguarde e tente novamente."],
  ["lora_pair_timeout", "O Access Point não confirmou o pareamento. Confira se está ligado, se a rede selecionada é a correta e se a senha corresponde à do Access Point."],
  ["lora_send_failed", "O rádio não conseguiu enviar a solicitação LoRa. Tente novamente."],
  ["invalid_lora_password", "O dispositivo recusou a senha LoRa. Use de 16 a 64 bytes, sem caracteres de controle."],
  ["lora_password_required", "Informe a senha LoRa para trocar de rede ou Access Point."],
  ["invalid_lora_ssid", "O dispositivo recusou o SSID LoRa. Use de 1 a 32 bytes, sem caracteres de controle."],
  ["lora_ssid_required", "Informe o nome da rede LoRa."],
  ["invalid_lora_receiver_id", "O identificador do Access Point é inválido. Busque e selecione o Access Point novamente."],
])

export function useDeviceProvisioning(bridge: BleBridge | undefined, userId: string) {
  const [state, setState] = useState(initialState)
  const current = useRef(state)
  const pendingArea = useRef<Pick<SavedDevice, "areaId" | "updateStationArea"> | null>(null)
  const active = useRef(false)

  function update(next: Partial<ProvisioningState>) {
    current.current = { ...current.current, ...next }
    setState(current.current)
  }

  function reset(role?: DeviceRole) {
    update({
      ...initialState,
      step: role ? "scan" : "choose",
      role,
      info: undefined,
      saved: undefined,
      error: undefined,
    })
    pendingArea.current = null
    bridge?.disconnect()
  }

  function recover(message: string) {
    update({ step: "scan", info: undefined, loraNetworks: null, error: message })
    pendingArea.current = null
    bridge?.disconnect()
  }

  function scan() {
    if (!bridge || !current.current.role || current.current.step !== "scan") return
    update({ step: "scanning", searched: false, devices: [], error: undefined })
    bridge.scan(current.current.role)
  }

  function connect(device: BleDevice) {
    if (!bridge || !["scan", "scanning"].includes(current.current.step)) return
    update({ step: "connect", error: undefined })
    bridge.connect(device.id)
  }

  function scanLora() {
    const { info, step } = current.current
    if (!bridge || step !== "edit" || info?.role !== "transmitter" || !info.lora_supported) return
    update({ step: "lora-scan", loraNetworks: null, error: undefined })
    bridge.send(JSON.stringify({ op: "scan_lora" }))
  }

  function save(json: string, association: Pick<SavedDevice, "areaId" | "updateStationArea">) {
    if (!bridge || current.current.step !== "edit") return
    pendingArea.current = association
    update({ step: "save", error: undefined })
    bridge.send(json)
  }

  async function saveCloud(saved: SavedDevice) {
    update({ step: "cloud", saved, error: undefined })
    try {
      await saveDeviceMetadata(userId, saved)
      if (active.current && current.current.saved === saved) update({ step: "done" })
    } catch {
      if (active.current && current.current.saved === saved) {
        update({ step: "partial", error: "Configuração salva no dispositivo. O cadastro na conta ainda está pendente." })
      }
    }
  }

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      pendingArea.current = null
      bridge?.disconnect()
    }
  }, [bridge])

  useEffect(() => {
    if (!bridge) return

    function receive(event: Event) {
      const detail = (event as CustomEvent<BleEvent>).detail
      if (!detail) return
      const { step, role, devices, info } = current.current

      if (detail.type === "device" && step === "scanning" && detail.role === role) {
        update({ devices: [...devices.filter(device => device.id !== detail.id), detail].sort((a, b) => b.rssi - a.rssi) })
      } else if (detail.type === "scan-complete" && step === "scanning") {
        update({ step: "scan", searched: true })
      } else if (detail.type === "connected" && step === "connect") {
        update({ step: "read" })
        bridge?.send(JSON.stringify({ op: "info" }))
      } else if (detail.type === "message" && step === "lora-scan" && detail.payload && (!detail.payload.op || detail.payload.op === "scan_lora")) {
        const networks = detail.payload.ok ? readLoraNetworks(detail.payload.networks) : null
        if (networks) update({ step: "edit", loraNetworks: networks })
        else update({ step: "edit", error: loraErrors.get(detail.payload.error ?? "") ?? "O Station não conseguiu concluir a busca LoRa. Tente novamente." })
      } else if (detail.type === "message" && role && (step === "read" || step === "save")) {
        const response = detail.payload
        if (!response || (response.op && response.op !== (step === "read" ? "info" : "save"))) return
        if (!response.ok) {
          if (step === "read") recover("O dispositivo não respondeu com uma configuração válida.")
          else {
            pendingArea.current = null
            update({ step: "edit", error: loraErrors.get(response.error ?? "") ?? "O dispositivo recusou a configuração. Confira os dados e tente novamente." })
          }
          return
        }

        const confirmed = readDeviceInfo(response, role)
        if (!confirmed || (step === "save" && (confirmed.device_id !== info?.device_id || confirmed.node !== info?.node))) {
          recover("A resposta recebida não corresponde ao dispositivo selecionado.")
        } else if (step === "read") {
          update({ step: "edit", info: confirmed, error: undefined })
        } else if (pendingArea.current) {
          const saved = { info: confirmed, ...pendingArea.current }
          pendingArea.current = null
          void saveCloud(saved)
          bridge?.disconnect()
        }
      } else if (detail.type === "error" && ["scanning", "connect", "read", "edit", "lora-scan", "save"].includes(step)) {
        recover(detail.message)
      } else if (detail.type === "disconnected" && ["connect", "read", "edit", "lora-scan", "save"].includes(step)) {
        recover(step === "save"
          ? "O Bluetooth caiu antes da confirmação. Reconecte para conferir a configuração gravada."
          : "O dispositivo desconectou. Faça a busca e conecte novamente.")
      }
    }

    window.addEventListener("agrosense-ble", receive)
    return () => window.removeEventListener("agrosense-ble", receive)
  })

  useEffect(() => {
    const delay = waitMs[state.step]
    if (!delay) return
    const timeout = window.setTimeout(() => {
      if (current.current.step !== state.step) return
      if (state.step === "lora-scan") {
        update({ step: "edit", error: "O Station não retornou a busca LoRa a tempo. Tente novamente." })
        return
      }
      recover(state.step === "save"
        ? "O ESP32 não confirmou a gravação a tempo. Reconecte para conferir a configuração."
        : "O Bluetooth não respondeu a tempo. Tente buscar e conectar novamente.")
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [state.step, bridge])

  return {
    state, scan, scanLora, connect, save,
    choose: (role: DeviceRole) => reset(role),
    reset,
    retryCloud: () => {
      if (current.current.step === "partial" && current.current.saved) void saveCloud(current.current.saved)
    },
  }
}
