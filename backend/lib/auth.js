import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {AppError} from './domain.js';

const MIN_SECRET_LENGTH = 16;
const MIN_SESSION_SECRET_LENGTH = 32;

export function equalSecret(a, b) {
  return typeof a === 'string' && typeof b === 'string' && b.length >= MIN_SECRET_LENGTH && timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function dashboardConfigured(env) {
  return env.DASHBOARD_PASSWORD?.length >= MIN_SECRET_LENGTH && env.SESSION_SECRET?.length >= MIN_SESSION_SECRET_LENGTH;
}
export function sessionToken(secret, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + 86400);
  return expires + '.' + createHmac('sha256', secret).update(expires).digest('hex');
}
export function validSession(token, secret, now = Date.now()) {
  if (!token || !secret || secret.length < MIN_SESSION_SECRET_LENGTH) return false;
  const [expires, signature] = token.split('.');
  if (!/^\d+$/.test(expires || '') || Number(expires) <= now / 1000) return false;
  return equalSecret(signature, createHmac('sha256', secret).update(expires).digest('hex'));
}
export function requireDashboard(request, env) {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('agrosense_session='))?.slice(18);
  if (!validSession(token, env.SESSION_SECRET)) throw new AppError(401, 'Entre no painel para continuar.');
}
export function requireIngest(request, env) {
  if (!env.INGEST_TOKEN || env.INGEST_TOKEN.length < 32) throw new AppError(503, 'Token do receptor ainda não configurado.');
  if (!equalSecret(request.headers.get('authorization')?.replace(/^Bearer /, ''), env.INGEST_TOKEN)) throw new AppError(401, 'Receptor não autorizado.');
}
export function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new AppError(403, 'Origem não autorizada.');
}
