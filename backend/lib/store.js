import {createClient} from '@supabase/supabase-js';
import {AppError} from './domain.js';

export function createStore(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new AppError(503, 'Configure a conexão com o Supabase na Vercel.');
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {auth: {persistSession: false, autoRefreshToken: false}, global: {fetch: (url, options) => fetch(url, {...options, signal: AbortSignal.timeout(10000)})}});
  function checked(result) {
    if (result.error) { console.error('supabase_operation_failed', {code: result.error.code}); throw new AppError(502, 'Não foi possível acessar o histórico.'); }
    return result.data;
  }
  return {
    async insert(reading) {
      const result = await client.from('agro_readings').insert(reading);
      if (result.error?.code === '23505') return false;
      checked(result); return true;
    },
    async stations() { return checked(await client.from('agro_stations').select('*').order('node')); },
    async series(node, hours) { return checked(await client.rpc('agro_series', {p_node: node, p_hours: hours})); },
    async recent(node) { return checked(await client.from('agro_readings').select('received_at,temp_c,air_rh_pct,pressure_hpa,soil_raw,soil_enabled,signal').eq('node', node).order('received_at', {ascending: false}).limit(120)).reverse(); },
    async summary(node) { return checked(await client.from('agro_summaries').select('*').eq('node', node).maybeSingle()); },
    async claim(node) { return checked(await client.rpc('agro_claim_summary', {p_node: node})); },
    async saveSummary(summary) { checked(await client.from('agro_summaries').upsert(summary, {onConflict: 'node'})); },
  };
}
