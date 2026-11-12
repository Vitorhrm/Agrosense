import {randomUUID} from 'node:crypto';
import {AppError, validateNode, validateReading, summarizeReadings} from './domain.js';
import {dashboardConfigured, equalSecret, sessionToken, requireDashboard, requireIngest, requireSameOrigin} from './auth.js';
import {createStore} from './store.js';
import {generateSummary} from './ai.js';
import {createForecast} from './forecast.js';

const json = (body, status = 200, headers = {}) => Response.json(body, {status, headers: {'Cache-Control': 'no-store', ...headers}});
async function body(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AppError(415, 'Use application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Corpo vazio.');
  let size = 0; const chunks = [];
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    size += value.length; if (size > 4096) { await reader.cancel(); throw new AppError(413, 'Mensagem muito grande.'); }
    chunks.push(value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object_required');
    return parsed;
  }
  catch { throw new AppError(400, 'JSON inválido.'); }
}

export function createApp({env = process.env, storeFactory = createStore, ai = generateSummary, forecastFetch} = {}) {
  const forecast = createForecast(forecastFetch);
  return async function handle(request) {
    const url = new URL(request.url), route = url.pathname;
    const isForecast = route === '/api/forecast' && request.method === 'GET';
    const cors = isForecast ? {'Access-Control-Allow-Origin': '*'} : {};
    try {
      if (route === '/api/health' && request.method === 'GET') return json({ok: true});
      if (isForecast) {
        const {payload, expiresAt} = await forecast(url.searchParams);
        const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        return json(payload, 200, {...cors, 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`});
      }
      if (route === '/api/login' && request.method === 'POST') {
        requireSameOrigin(request);
        if (!dashboardConfigured(env)) throw new AppError(503, 'Acesso ao painel ainda não configurado.');
        const input = await body(request);
        if (!equalSecret(input.password, env.DASHBOARD_PASSWORD)) throw new AppError(401, 'Senha incorreta.');
        const secure = url.protocol === 'https:' ? '; Secure' : '';
        return json({ok: true}, 200, {'Set-Cookie': `agrosense_session=${sessionToken(env.SESSION_SECRET)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secure}`});
      }
      if (route === '/api/logout' && request.method === 'POST') {
        requireSameOrigin(request);
        return json({ok: true}, 200, {'Set-Cookie': 'agrosense_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
      }
      if (route === '/api/readings' && request.method === 'POST') {
        requireIngest(request, env);
        const input = await body(request), reading = validateReading(input);
        const inserted = await storeFactory(env).insert({...reading, event_id: input.event_id || randomUUID()});
        return json({ok: true, duplicate: !inserted}, inserted ? 201 : 200);
      }
      requireDashboard(request, env);
      if (request.method === 'POST') requireSameOrigin(request);
      const store = storeFactory(env);
      if (route === '/api/stations' && request.method === 'GET') return json({stations: await store.stations(), ai_configured: Boolean(env.NVIDIA_API_KEY && env.NVIDIA_MODEL)});
      if (route === '/api/readings' && request.method === 'GET') {
        const node = validateNode(url.searchParams.get('node'));
        const hours = Number(url.searchParams.get('hours') || 1);
        if (![1, 6, 24].includes(hours)) throw new AppError(400, 'Período inválido.');
        return json({node, hours, readings: await store.series(node, hours), summary: await store.summary(node)});
      }
      if (route === '/api/summary' && request.method === 'POST') {
        requireSameOrigin(request);
        const node = validateNode((await body(request)).node);
        const readings = await store.recent(node);
        if (!readings.length) throw new AppError(409, 'A estação ainda não possui leituras.');
        const previous = await store.summary(node), latest = readings.at(-1).received_at;
        if (previous && Date.parse(previous.window_end) >= Date.parse(latest)) return json({summary: previous, cached: true});
        if (!await store.claim(node)) throw new AppError(429, 'Aguarde 1 minuto entre os resumos desta estação.');
        const context = {node, ...summarizeReadings(readings)};
        const summary = {node, text: await ai(context, env), model: env.NVIDIA_MODEL,
          window_start: context.start, window_end: context.end, sample_count: context.samples, generated_at: new Date().toISOString()};
        await store.saveSummary(summary);
        return json({summary, cached: false});
      }
      return json({error: 'Rota não encontrada.'}, 404);
    } catch (error) {
      if (!(error instanceof AppError)) console.error('api_request_failed', {name: error.name});
      return json({error: error instanceof AppError ? error.message : 'Não foi possível concluir a operação.'}, error.status || 500, cors);
    }
  };
}
