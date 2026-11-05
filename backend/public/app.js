const $ = id => document.getElementById(id);
const state = {stations: [], readings: [], metric: 'soil_raw', loading: false, generating: false};
const metrics = {soil_raw: ['Leitura do solo', 'ADC'], temp_c: ['Temperatura', '°C'], air_rh_pct: ['Umidade do ar', '%'], pressure_hpa: ['Pressão local', 'hPa']};
const format = (value, suffix, digits = 1) => value === null || value === undefined ? '—' : `${Number(value).toLocaleString('pt-BR', {maximumFractionDigits: digits})} ${suffix}`;
const date = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
function showLogin() { $('login').hidden = false; $('dashboard').hidden = true; $('logout').hidden = true; }
function showDashboard() { $('login').hidden = true; $('dashboard').hidden = false; $('logout').hidden = false; }
async function api(path, options = {}) {
  const response = await fetch(path, {credentials: 'same-origin', ...options});
  const value = await response.json();
  if (response.status === 401) showLogin();
  if (!response.ok) throw new Error(value.error || 'Falha na comunicação com o servidor.');
  return value;
}
const post = (path, value) => api(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)});
function renderSummary(summary) {
  $('summary').textContent = summary?.text || 'Receba as primeiras medições e clique no botão para gerar uma interpretação.';
  $('summary-meta').textContent = summary ? `${summary.sample_count} coletas · ${date(summary.generated_at)} · ${summary.model}` : '';
}
async function refresh() {
  if (state.loading) return;
  state.loading = true; $('refresh').disabled = true;
  try {
    const data = await api('/api/stations');
    showDashboard(); state.stations = data.stations;
    const previous = $('station').value;
    $('station').replaceChildren();
    for (const item of data.stations) {
      const option = document.createElement('option'); option.value = item.node; option.textContent = item.node; $('station').append(option);
    }
    if (data.stations.some(item => item.node === previous)) $('station').value = previous;
    if (!data.stations.length) {
      const option = document.createElement('option'); option.textContent = 'Aguardando estações'; option.value = ''; $('station').append(option);
      state.readings = []; $('generate').disabled = true; $('connection').textContent = 'Aguardando leituras'; drawChart(); return;
    }
    const station = data.stations.find(item => item.node === $('station').value);
    $('temp').textContent = format(station.temp_c, '°C');
    $('humidity').textContent = format(station.air_rh_pct, '%');
    $('pressure').textContent = format(station.pressure_hpa, 'hPa');
    $('soil').textContent = station.soil_enabled ? format(station.soil_raw, 'ADC', 0) : 'Desativado';
    $('signal').textContent = station.signal; $('last-update').textContent = date(station.received_at);
    const ageSeconds = Math.max(0, (Date.now() - Date.parse(station.received_at)) / 1000);
    $('connection').textContent = ageSeconds < 60 ? '● Recebendo coletas' : '◷ Sem coleta recente';
    const history = await api(`/api/readings?node=${encodeURIComponent(station.node)}&hours=${$('period').value}`);
    state.readings = history.readings; renderSummary(history.summary);
    $('generate').disabled = !data.ai_configured || state.generating;
    $('generate').title = data.ai_configured ? '' : 'Configure a chave e o modelo NVIDIA na Vercel.';
    $('error').textContent = ''; drawChart();
  } catch (error) { $('error').textContent = error.message; }
  finally { state.loading = false; $('refresh').disabled = false; }
}

// Gráfico local, sem CDN, sem chaves e sem converter a leitura do solo em percentual.
function drawChart() {
  const canvas = $('chart'), rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const width = rect.width, height = rect.height, pad = {left: 50, right: 15, top: 20, bottom: 32};
  const points = state.readings.map(item => ({time: Date.parse(item.received_at), value: item[state.metric]}));
  const valid = points.filter(item => item.value !== null && Number.isFinite(Number(item.value)));
  const [label, unit] = metrics[state.metric]; $('chart-label').textContent = `${label} · ${unit}`;
  $('point-count').textContent = `${points.length} pontos`;
  $('chart-empty').hidden = Boolean(valid.length);
  canvas.setAttribute('aria-label', `${label}, ${unit}, ${valid.length} pontos válidos no período selecionado`);
  if (!valid.length) return;
  let min = Math.min(...valid.map(p => Number(p.value))), max = Math.max(...valid.map(p => Number(p.value)));
  const delta = Math.max((max - min) * .15, state.metric === 'soil_raw' ? 10 : .5); min -= delta; max += delta;
  const start = points[0].time, end = Math.max(points.at(-1).time, start + 1000);
  const x = time => pad.left + (time - start) / (end - start) * (width - pad.left - pad.right);
  const y = value => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
  ctx.font = '10px system-ui'; ctx.fillStyle = '#91a087'; ctx.strokeStyle = '#edf0e9'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const value = min + (max - min) * i / 4, position = y(value);
    ctx.beginPath(); ctx.moveTo(pad.left, position); ctx.lineTo(width - pad.right, position); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(value.toLocaleString('pt-BR', {maximumFractionDigits: state.metric === 'soil_raw' ? 0 : 1}), pad.left - 10, position + 3);
  }
  ctx.strokeStyle = '#719b52'; ctx.lineWidth = 2; ctx.beginPath(); let connected = false, previous = null;
  for (const point of points) {
    if (point.value === null) { connected = false; continue; }
    if (previous && point.time - previous.time > Number($('period').value) * 10 * 1000 * 5) connected = false;
    if (connected) ctx.lineTo(x(point.time), y(point.value)); else ctx.moveTo(x(point.time), y(point.value));
    connected = true; previous = point;
  }
  ctx.stroke(); ctx.fillStyle = '#719b52';
  if (valid.length === 1) { ctx.beginPath(); ctx.arc(x(valid[0].time), y(valid[0].value), 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#91a087';
  for (let i = 0; i < 4; i++) {
    const time = start + (end - start) * i / 3;
    ctx.textAlign = i === 0 ? 'left' : i === 3 ? 'right' : 'center';
    ctx.fillText(new Date(time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), x(time), height - 8);
  }
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try { await post('/api/login', {password: $('password').value}); $('password').value = ''; $('login-error').textContent = ''; await refresh(); }
  catch (error) { $('login-error').textContent = error.message; } finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => { await post('/api/logout', {}); showLogin(); });
$('refresh').addEventListener('click', refresh); $('station').addEventListener('change', refresh); $('period').addEventListener('change', refresh);
for (const button of document.querySelectorAll('[data-metric]')) button.addEventListener('click', () => {
  state.metric = button.dataset.metric;
  for (const item of document.querySelectorAll('[data-metric]')) { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); }
  drawChart();
});
$('generate').addEventListener('click', async () => {
  if (!$('station').value || state.generating) return;
  state.generating = true; $('generate').disabled = true; $('generate').textContent = 'Analisando as coletas…';
  const node = $('station').value;
  try { const data = await post('/api/summary', {node}); if ($('station').value === node) renderSummary(data.summary); $('error').textContent = ''; }
  catch (error) { $('error').textContent = error.message; }
  finally { state.generating = false; $('generate').disabled = false; $('generate').textContent = '✦ Gerar resumo'; }
});
new ResizeObserver(drawChart).observe($('chart'));
setInterval(() => { if (!document.hidden && !$('dashboard').hidden && !state.generating) refresh(); }, 10000);
refresh();
