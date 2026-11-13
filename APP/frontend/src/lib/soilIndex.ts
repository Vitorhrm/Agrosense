type SoilReading = {
  soil_enabled: boolean | null
  soil_index_pct: number | null
  soil_raw: number | null
}

export type SoilCalibration = { dry_adc: number | null; wet_adc: number | null }
export const SOIL_ADC_MAX = 4095

function validAdc(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= SOIL_ADC_MAX
}

// Ambos os sentidos do ADC são válidos, desde que as referências sejam distintas.
export function hasSoilCalibration(calibration: SoilCalibration): calibration is { dry_adc: number; wet_adc: number } {
  const { dry_adc, wet_adc } = calibration
  return validAdc(dry_adc) && validAdc(wet_adc) && dry_adc !== wet_adc
}

// Preserva o índice registrado na coleta. A calibração atual serve de referência para leituras antigas.
export function relativeSoilIndex(reading: SoilReading, calibration?: SoilCalibration) {
  if (reading.soil_enabled === false) return null
  const recorded = reading.soil_index_pct
  if (typeof recorded === "number" && recorded >= 0 && recorded <= 100) {
    return { value: recorded, recorded: true }
  }
  if (!calibration || !hasSoilCalibration(calibration) || !validAdc(reading.soil_raw)) return null
  const { dry_adc, wet_adc } = calibration
  const relative = ((reading.soil_raw - dry_adc) / (wet_adc - dry_adc)) * 100
  return { value: Math.max(0, Math.min(100, relative)), recorded: false }
}
