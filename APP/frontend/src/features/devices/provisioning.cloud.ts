import { getSupabase } from "../../lib/supabase"
import type { DeviceInfo } from "./provisioning.ble"
import type { StationLocation } from "./stationLocation"

export type CloudArea = { id: string; name: string }

export type DeviceCloudContext = {
  areas: CloudArea[]
  areaId: string
  stationGranted: boolean
  stationLocated: boolean
}

export async function loadDeviceCloudContext(userId: string, info: DeviceInfo): Promise<DeviceCloudContext> {
  const client = getSupabase()
  const station = info.role === "transmitter"
  const [areas, association] = await Promise.all([
    client.from("agro_areas").select("id,name").order("name"),
    station
      ? info.node
        ? client.from("agro_station_access").select("area_id,latitude").eq("user_id", userId).eq("node", info.node).maybeSingle()
        : null
      : client.from("agro_devices").select("area_id").eq("user_id", userId).eq("device_id", info.device_id).maybeSingle(),
  ])
  if (areas.error || association?.error) throw new Error("Não foi possível carregar as áreas.")

  return {
    areas: areas.data,
    areaId: association?.data?.area_id ?? "",
    stationGranted: station && Boolean(association?.data),
    stationLocated: station && !!association?.data && "latitude" in association.data &&
      typeof association.data.latitude === "number",
  }
}

export type DeviceAssociation = { areaId?: string | null; updateStationArea: boolean; location?: StationLocation }
export type SavedDevice = DeviceAssociation & { info: DeviceInfo }

export async function saveDeviceMetadata(userId: string, saved: SavedDevice) {
  const { info, areaId, updateStationArea, location } = saved
  const client = getSupabase()

  if (updateStationArea || location) {
    const { data, error } = await client.from("agro_station_access")
      .update({ ...(updateStationArea && { area_id: areaId }), ...location })
      .eq("user_id", userId)
      .eq("node", info.node)
      .select("node")
      .maybeSingle()
    if (error || !data) throw new Error("Não foi possível associar a estação à área.")
  }

  const { error } = await client.from("agro_devices").upsert({
    user_id: userId,
    device_id: info.device_id,
    role: info.role,
    name: info.name,
    node: info.node || null,
    wifi_ssid: info.wifi_saved ? info.wifi_ssid || null : null,
    lora_ssid: info.lora_ssid || null,
    ...(areaId !== undefined && { area_id: areaId }),
  }, { onConflict: "user_id,device_id" })
  if (error) throw new Error("Não foi possível salvar o cadastro.")
}

export async function activateStation(node: string, code: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("agro_activate_station", {
    p_node: node,
    p_code: code,
  })
  if (error) throw error
  return data === true
}
