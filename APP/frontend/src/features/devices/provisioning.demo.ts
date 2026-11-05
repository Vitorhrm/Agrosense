/** Apenas exemplos visuais. Não representam uma busca Bluetooth/LoRa real. */
export type DeviceKind = "transmitter" | "station"
export const bluetoothDevices = {
  transmitter: [{ id: "demo-tx-01", name: "ESP32-Transmissor-01" }],
  station: [{ id: "demo-st-01", name: "ESP32-Estacao-01" }],
} satisfies Record<DeviceKind, { id: string; name: string }[]>

// Na integração futura, estes resultados virão do scan LoRa realizado pelo ESP32,
// não pelo rádio Bluetooth do celular. RSSI mede intensidade; não é identificador.
export const loraTransmitters = [
  { id: "AGRO-TX-01", rssi: -62 },
  { id: "AGRO-TX-02", rssi: -79 },
]

