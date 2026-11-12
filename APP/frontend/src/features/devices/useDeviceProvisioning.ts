import { useEffect, useRef, useState } from "react"
import { readDeviceInfo, type BleBridge, type BleDevice, type BleEvent, type DeviceInfo, type DeviceRole } from "./provisioning.ble"
import { saveDeviceMetadata, type SavedDevice } from "./provisioning.cloud"

type Step = "choose" | "scan" | "scanning" | "connect" | "read" | "edit" | "save" | "cloud" | "partial" | "done"

type ProvisioningState = {
  step: Step
  role?: DeviceRole
  devices: BleDevice[]
  searched: boolean
  info?: DeviceInfo
  saved?: SavedDevice
  error?: string
}

const initialState: ProvisioningState = { step: "choose", devices: [], searched: false }
const waitMs: Partial<Record<Step, number>> = { scanning: 15000, connect: 25000, read: 12000, save: 35000 }

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
    update({ step: "scan", info: undefined, error: message })
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
      } else if (detail.type === "message" && role && (step === "read" || step === "save")) {
        const response = detail.payload
        if (!response || (response.op && response.op !== (step === "read" ? "info" : "save"))) return
        if (!response.ok) {
          if (step === "read") recover("O dispositivo não respondeu com uma configuração válida.")
          else {
            pendingArea.current = null
            update({ step: "edit", error: "O dispositivo recusou a configuração. Confira os dados e tente novamente." })
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
      } else if (detail.type === "error" && ["scanning", "connect", "read", "edit", "save"].includes(step)) {
        recover(detail.message)
      } else if (detail.type === "disconnected" && ["connect", "read", "edit", "save"].includes(step)) {
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
      recover(state.step === "save"
        ? "O ESP32 não confirmou a gravação a tempo. Reconecte para conferir a configuração."
        : "O Bluetooth não respondeu a tempo. Tente buscar e conectar novamente.")
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [state.step, bridge])

  return {
    state, scan, connect, save,
    choose: (role: DeviceRole) => reset(role),
    reset,
    retryCloud: () => {
      if (current.current.step === "partial" && current.current.saved) void saveCloud(current.current.saved)
    },
  }
}
