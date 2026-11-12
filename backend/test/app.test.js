import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../lib/app.js';
import {sessionToken, validSession} from '../lib/auth.js';
import {validateReading, summarizeReadings} from '../lib/domain.js';

const env = {INGEST_TOKEN: 'i'.repeat(64), SESSION_SECRET: 's'.repeat(64), DASHBOARD_PASSWORD: 'p'.repeat(24), NVIDIA_MODEL: 'test-model', NVIDIA_API_KEY: 'test-key'};
const sample = {v: 1, node: 'station1', seq: 2, uptime_ms: 27932, temp_c: 23.62, air_rh_pct: 66.38, pressure_hpa: 900.78, soil_raw: 3282, soil_enabled: true, signal: 'Muito próximo'};
const request = (path, body, headers = {}) => new Request('https://agro.test' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', ...headers}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
const cookie = () => ({Cookie: 'agrosense_session=' + sessionToken(env.SESSION_SECRET)});

test('aceita falhas ambientais como null e rejeita tipos e leituras impossiveis', () => {
  assert.equal(validateReading({...sample, temp_c: null}).temp_c, null);
  for (const invalid of [{soil_raw: 4096}, {temp_c: '23'}, {node: '../x'}, {soil_enabled: false}, {event_id: 'bad'}]) {
    assert.throws(() => validateReading({...sample, ...invalid}));
  }
  assert.equal(summarizeReadings([{...sample, soil_enabled: false}]).statistics.soil_raw, null);
});
test('sessoes expiram e nao aceitam assinatura alterada', () => {
  const token = sessionToken(env.SESSION_SECRET, 1000);
  assert.equal(validSession(token, env.SESSION_SECRET, 2000), true);
  assert.equal(validSession(token, env.SESSION_SECRET, 86401001), false);
  assert.equal(validSession(token + 'x', env.SESSION_SECRET, 2000), false);
});
test('API protege ingestao, valida JSON e deduplica sem chamar a IA', async () => {
  const inserted = new Set(); let calls = 0;
  const app = createApp({env, storeFactory: () => ({insert: async row => {if (inserted.has(row.event_id)) return false; inserted.add(row.event_id); return true;}}), ai: () => {calls++;}});
  assert.equal((await app(request('/api/readings', sample))).status, 401);
  const headers = {Authorization: 'Bearer ' + env.INGEST_TOKEN};
  assert.equal((await app(request('/api/readings', null, headers))).status, 400);
  const row = {...sample, event_id: '12345678-1234-4123-8123-123456789abc'};
  assert.equal((await app(request('/api/readings', row, headers))).status, 201);
  assert.equal((await app(request('/api/readings', row, headers))).status, 200);
  assert.equal(calls, 0);
});
test('login cria cookie seguro e bloqueia POST de outro site', async () => {
  const app = createApp({env});
  assert.equal((await app(request('/api/login', {password: 'wrong'}))).status, 401);
  const response = await app(request('/api/login', {password: env.DASHBOARD_PASSWORD}));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.equal((await app(request('/api/summary', {node: 'station1'}, {...cookie(), Origin: 'https://evil.test'}))).status, 403);
});
test('resumo separa stations, reutiliza cache e respeita cooldown', async () => {
  let saved = null, calls = 0, allowed = true;
  const rows = [{...sample, received_at: '2026-11-05T20:00:00Z'}];
  const app = createApp({env, storeFactory: () => ({recent: async node => {assert.equal(node, 'station1'); return rows;}, summary: async () => saved, claim: async () => allowed, saveSummary: async row => {saved = row;}}), ai: async context => {calls++; assert.equal(context.node, 'station1'); return 'Resumo de teste.';}});
  assert.equal((await app(request('/api/summary', {node: 'station1'}, cookie()))).status, 200);
  assert.equal(saved.sample_count, 1);
  assert.equal((await app(request('/api/summary', {node: 'station1'}, cookie()))).status, 200);
  assert.equal(calls, 1);
  saved = null; allowed = false;
  assert.equal((await app(request('/api/summary', {node: 'station1'}, cookie()))).status, 429);
  assert.equal(calls, 1);
});

test('ingestao rejeita event_id que nao seja string sem consultar o banco', async () => {
  const app = createApp({env, storeFactory: () => {
    assert.fail('A entrada inválida não deve consultar o banco.');
  }});
  const headers = {Authorization: 'Bearer ' + env.INGEST_TOKEN};
  const response = await app(request('/api/readings', {
    ...sample, event_id: ['12345678-1234-4123-8123-123456789abc'],
  }, headers));
  assert.equal(response.status, 400);
});

test('login rejeita configuracao curta sem emitir cookie', async () => {
  for (const invalid of [{SESSION_SECRET: 'curto'}, {DASHBOARD_PASSWORD: 'curta'}]) {
    const config = {...env, ...invalid};
    const app = createApp({env: config});
    const response = await app(request('/api/login', {password: config.DASHBOARD_PASSWORD}));
    assert.equal(response.status, 503);
    assert.equal(response.headers.has('set-cookie'), false);
  }
});

test('preserva índice relativo medido e rejeita índice fora da escala ou com solo desativado', () => {
  assert.equal(validateReading({...sample, soil_index_pct: 57.2}).soil_index_pct, 57.2);
  assert.equal(validateReading(sample).soil_index_pct, undefined);
  for (const invalid of [{soil_index_pct: -1}, {soil_index_pct: 101}, {soil_index_pct: '25'}, {soil_index_pct: 25, soil_enabled: false, soil_raw: 0}]) {
    assert.throws(() => validateReading({...sample, ...invalid}));
  }
});
