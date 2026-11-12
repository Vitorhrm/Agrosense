import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../lib/app.js';

const forecastRequest = (query, method = 'GET') => new Request(
  'https://agro.test/api/forecast?' + query, {method, headers: {Origin: 'null'}},
);

function forecastData() {
  const offset = -10800;
  const currentTime = Math.floor(Date.now() / 1000);
  const dayStart = Math.floor((currentTime + offset) / 86400) * 86400 - offset;
  return {
    timezone: 'America/Sao_Paulo', utc_offset_seconds: offset,
    current: {time: currentTime, temperature_2m: 26, weather_code: 1},
    daily: {
      time: Array.from({length: 7}, (_, index) => dayStart + index * 86400),
      temperature_2m_min: Array(7).fill(19), temperature_2m_max: Array(7).fill(27),
      precipitation_probability_max: [null, 0, 30, 40, 50, 60, 70],
      precipitation_sum: [null, 0, 1, 2, 3, 4, 5], weather_code: Array(7).fill(3),
    },
  };
}

test('previsão pública usa somente as coordenadas arredondadas e reutiliza consultas simultâneas', async () => {
  const data = forecastData();
  const calls = [];
  const app = createApp({env: {}, forecastFetch: async (url, options) => {
    calls.push(url);
    assert.equal(options.headers, undefined);
    assert.ok(options.signal);
    return Response.json(data);
  }});
  const [first, second] = await Promise.all([
    app(forecastRequest('lat=-23.55041&lon=-46.63341')),
    app(forecastRequest('lat=-23.55042&lon=-46.63342')),
  ]);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('access-control-allow-origin'), '*');
  assert.match(first.headers.get('cache-control'), /^public, max-age=\d+, s-maxage=\d+$/);
  assert.equal(calls.length, 1);
  const url = new URL(calls[0]);
  assert.equal(url.origin, 'https://api.open-meteo.com');
  assert.equal(url.pathname, '/v1/forecast');
  assert.equal(url.searchParams.get('latitude'), '-23.550');
  assert.equal(url.searchParams.get('longitude'), '-46.633');
  assert.equal(url.searchParams.get('timezone'), 'auto');
  assert.equal(url.searchParams.get('timeformat'), 'unixtime');
  assert.equal(url.searchParams.get('forecast_days'), '7');
  const value = await first.json();
  assert.deepEqual(value, await second.json());
  assert.equal(value.provider, 'Open-Meteo');
  assert.equal(value.timezone, 'America/Sao_Paulo');
  assert.equal(value.current.time, new Date(data.current.time * 1000).toISOString());
  assert.equal(value.current.temp_c, 26);
  assert.equal(value.daily.length, 7);
  assert.equal(value.daily[0].date, new Date((data.daily.time[0] + data.utc_offset_seconds) * 1000).toISOString().slice(0, 10));
  assert.equal(value.daily[0].precipitation_probability_pct, null);
  assert.equal(value.daily[1].precipitation_probability_pct, 0);

  const third = await app(forecastRequest('lat=-23.5504&lon=-46.6334'));
  assert.deepEqual(await third.json(), value);
  assert.equal(calls.length, 1);
});

test('previsão rejeita coordenadas ausentes, duplicadas e inválidas sem chamar provedor', async () => {
  let calls = 0;
  const app = createApp({env: {}, forecastFetch: async () => { calls++; }});
  for (const query of ['lat=91&lon=0', 'lat=0&lon=-181', 'lat=&lon=1', 'lat=0', 'lat=1,2&lon=0',
    'lat=0x10&lon=0', 'lat=1&lat=2&lon=3', 'lat=Infinity&lon=0']) {
    const response = await app(forecastRequest(query));
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 0);
});

test('previsão retorna erro controlado para limite, horário inválido e payload incompleto', async () => {
  const data = forecastData();
  const responses = [
    new Response(null, {status: 429}),
    Response.json({...data, current: {...data.current, time: 0}}),
    Response.json({...data, daily: {...data.daily, time: []}}),
    Response.json(data),
  ];
  const app = createApp({env: {}, forecastFetch: async () => responses.shift()});
  for (const status of [503, 502, 502, 200]) {
    const response = await app(forecastRequest('lat=1e-7&lon=0'));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    if (status !== 200) {
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(typeof (await response.json()).error, 'string');
    }
  }
});
