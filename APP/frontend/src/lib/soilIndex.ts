type SoilReading = {
  soil_enabled: boolean | null
  soil_index_pct: number | null
  soil_raw: number | null
}

type Calibration = { dry_adc: number | null; wet_adc: number | null }

function validAdc(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= 4095
}

// Prefer the calibration recorded with the sample. Recalculate legacy readings from ADC.
export function relativeSoilIndex(reading: SoilReading, calibration?: Calibration) {
  if (reading.soil_enabled === false) return null
  const recorded = reading.soil_index_pct
  if (typeof recorded === "number" && recorded >= 0 && recorded <= 100) {
    return { value: recorded, recorded: true }
  }
  if (!calibration || !validAdc(reading.soil_raw)) return null
  const { dry_adc, wet_adc } = calibration
  if (!validAdc(dry_adc) || !validAdc(wet_adc) || dry_adc === wet_adc) return null
  const relative = ((reading.soil_raw - dry_adc) / (wet_adc - dry_adc)) * 100
  return { value: Math.max(0, Math.min(100, relative)), recorded: false }
}
