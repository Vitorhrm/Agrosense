export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const SIGNALS = ['Muito próximo', 'Bom', 'Regular', 'Zona de limite', 'Crítico'];
export function validateNode(node) {
  if (typeof node !== 'string' || !/^[a-zA-Z0-9_-]{1,24}$/.test(node)) throw new AppError(400, 'Estação inválida.');
  return node;
}

// Mantém null como ausência de leitura e nunca converte strings em números.
export function validateReading(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Envie um objeto JSON.');
  validateNode(value.node);
  if (value.v !== 1 || !SIGNALS.includes(value.signal) || typeof value.soil_enabled !== 'boolean') throw new AppError(400, 'Formato de coleta inválido.');
  for (const field of ['seq', 'uptime_ms']) {
    if (!Number.isInteger(value[field]) || value[field] < 0 || value[field] > 4294967295) throw new AppError(400, `Campo ${field} inválido.`);
  }
  for (const [field, min, max] of [['temp_c', -40, 85], ['air_rh_pct', 0, 100], ['pressure_hpa', 300, 1100]]) {
    if (value[field] !== null && (typeof value[field] !== 'number' || !Number.isFinite(value[field]) || value[field] < min || value[field] > max)) throw new AppError(400, `Campo ${field} inválido.`);
  }
  if (!Number.isInteger(value.soil_raw) || value.soil_raw < 0 || value.soil_raw > 4095 || (!value.soil_enabled && value.soil_raw !== 0)) throw new AppError(400, 'Leitura de solo inválida.');
  if (value.event_id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.event_id)) throw new AppError(400, 'event_id inválido.');
  return Object.fromEntries(['v', 'node', 'seq', 'uptime_ms', 'temp_c', 'air_rh_pct', 'pressure_hpa', 'soil_raw', 'soil_enabled', 'signal'].map(key => [key, value[key]]));
}

// A IA recebe estatísticas verificáveis; solo permanece ADC, sem percentual inventado.
export function summarizeReadings(readings) {
  const statistics = {};
  for (const field of ['temp_c', 'air_rh_pct', 'pressure_hpa', 'soil_raw']) {
    const values = readings.filter(row => field !== 'soil_raw' || row.soil_enabled).map(row => row[field]).filter(value => value !== null);
    statistics[field] = values.length ? {
      min: Math.min(...values), max: Math.max(...values),
      mean: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100,
      first: values[0], last: values.at(-1), samples: values.length,
    } : null;
  }
  return {samples: readings.length, start: readings[0]?.received_at, end: readings.at(-1)?.received_at,
    latest_signal: readings.at(-1)?.signal, statistics};
}
