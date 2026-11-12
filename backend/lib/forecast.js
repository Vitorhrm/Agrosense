import {AppError} from './domain.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 7;
const DAY_SECONDS = 86400;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_CAPACITY = 128;
const MAX_CONCURRENT_REQUESTS = 12;
const COORDINATE_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DAILY_FIELDS = [
  'temperature_2m_min', 'temperature_2m_max', 'precipitation_probability_max',
  'precipitation_sum', 'weather_code',
];

function coordinate(params, name, limit) {
  const values = params.getAll(name);
  const input = values[0] ?? '';
  const value = Number(input);
  if (values.length !== 1 || input.length > 32 || !COORDINATE_PATTERN.test(input) ||
      !Number.isFinite(value) || Math.abs(value) > limit) {
    throw new AppError(400, 'Informe latitude entre -90 e 90 e longitude entre -180 e 180.');
  }
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

const invalidForecast = () => new AppError(502, 'O provedor retornou uma previsão incompleta ou inválida.');
const unavailableForecast = () => new AppError(503, 'A previsão está temporariamente indisponível. Tente novamente mais tarde.');
const validWeatherCode = code => Number.isInteger(code) && code >= 0 && code <= 99;
const validPrecipitation = (value, max) => value === null || (Number.isFinite(value) && value >= 0 && value <= max);

function parseForecast(data, now) {
  const {current, daily, timezone, utc_offset_seconds: offset} = data ?? {};
  if (typeof timezone !== 'string' || timezone.length > 64 ||
      !Number.isInteger(offset) || Math.abs(offset) > 14 * 3600 ||
      !Number.isInteger(current?.time) || Math.abs(current.time * 1000 - now) > 2 * 3600 * 1000 ||
      !Number.isFinite(current.temperature_2m) || !validWeatherCode(current.weather_code) ||
      !['time', ...DAILY_FIELDS].every(field => Array.isArray(daily?.[field]) && daily[field].length === FORECAST_DAYS)) {
    throw invalidForecast();
  }
  try {
    new Intl.DateTimeFormat('en', {timeZone: timezone});
  } catch {
    throw invalidForecast();
  }

  // A série diária usa o deslocamento fixo informado pelo Open-Meteo.
  const firstDay = Math.floor((current.time + offset) / DAY_SECONDS) * DAY_SECONDS - offset;
  const days = daily.time.map((time, index) => {
    const min = daily.temperature_2m_min[index];
    const max = daily.temperature_2m_max[index];
    const probability = daily.precipitation_probability_max[index];
    const precipitation = daily.precipitation_sum[index];
    const weather = daily.weather_code[index];
    if (time !== firstDay + index * DAY_SECONDS || !Number.isFinite(min) || !Number.isFinite(max) || min > max ||
        !validPrecipitation(probability, 100) || !validPrecipitation(precipitation, Infinity) || !validWeatherCode(weather)) {
      throw invalidForecast();
    }
    return {
      date: new Date((time + offset) * 1000).toISOString().slice(0, 10),
      temp_min_c: min, temp_max_c: max, precipitation_probability_pct: probability,
      precipitation_mm: precipitation, weather_code: weather,
    };
  });
  return {
    expiresAt: Math.min(now + CACHE_TTL_MS, (firstDay + DAY_SECONDS) * 1000),
    payload: {
      provider: 'Open-Meteo', timezone, fetched_at: new Date(now).toISOString(),
      current: {
        time: new Date(current.time * 1000).toISOString(),
        temp_c: current.temperature_2m, weather_code: current.weather_code,
      },
      daily: days,
    },
  };
}

export function createForecast(fetchForecast = fetch) {
  const cache = new Map();
  const pending = new Map();

  async function load(latitude, longitude) {
    const url = new URL(FORECAST_URL);
    url.search = new URLSearchParams({
      latitude, longitude, timezone: 'auto', timeformat: 'unixtime',
      temperature_unit: 'celsius', precipitation_unit: 'mm', forecast_days: String(FORECAST_DAYS),
      current: 'temperature_2m,weather_code', daily: DAILY_FIELDS.join(','),
    });
    let response;
    try {
      response = await fetchForecast(url, {signal: AbortSignal.timeout(6000), redirect: 'error'});
    } catch {
      throw unavailableForecast();
    }
    if (response.status === 429 || response.status >= 500) throw unavailableForecast();
    if (!response.ok) throw invalidForecast();
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw unavailableForecast();
      throw invalidForecast();
    }
    return parseForecast(data, Date.now());
  }

  return async function forecast(params) {
    const latitude = coordinate(params, 'lat', 90);
    const longitude = coordinate(params, 'lon', 180);
    const key = latitude + ',' + longitude;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached;
    cache.delete(key);
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= MAX_CONCURRENT_REQUESTS) throw unavailableForecast();
    const request = load(latitude, longitude).then(result => {
      if (cache.size >= CACHE_CAPACITY) cache.delete(cache.keys().next().value);
      cache.set(key, result);
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
