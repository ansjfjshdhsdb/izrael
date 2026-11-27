import registry from '../data/licenses.json';
import { activeSession, login, sessionCookie } from './admin-auth.js';

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers } });
}
const fail = (error, status) => json({ error }, status);
const key = value => value.trim().normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е');

// Use the existing Cloudflare registry tables. A new binding starts empty.
let schemaReady;
function ensureSchema(db) {
  schemaReady ??= db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS licenses (id_key TEXT PRIMARY KEY, license_key TEXT NOT NULL UNIQUE, record TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)'),
    db.prepare('CREATE TABLE IF NOT EXISTS admin_sessions (session_key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS login_attempts (client_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)')
  ]).catch(error => { schemaReady = undefined; throw error; });
  return schemaReady;
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date + 'T');
}

async function saveRecord(request, db, id) {
  let input;
  try { input = await request.json(); } catch { return fail('Неверный формат запроса.', 400); }
  const record = {};
  for (const field of ['nickname','license','role','faction','status','issuedAt','expiresAt']) {
    if (typeof input?.[field] !== 'string' || !input[field].trim() || input[field].length > 100) {
      return fail('Проверьте поля лицензии.', 400);
    }
    record[field] = input[field].trim();
  }
  if (!registry.factions.find(f => f.id === record.faction)?.roles.includes(record.role) ||
      !['active','expired','revoked'].includes(record.status) || !validDate(record.issuedAt) ||
      !validDate(record.expiresAt) || record.expiresAt < record.issuedAt) return fail('Проверьте роль, статус и даты лицензии.', 400);

  record.id = id ?? 'ISRP-' + crypto.randomUUID().toUpperCase();
  try {
    if (id === null) {
      await db.prepare('INSERT INTO licenses (id_key,license_key,record) VALUES (?,?,?)')
        .bind(key(record.id), key(record.license), JSON.stringify(record)).run();
    } else {
      if (!Number.isSafeInteger(input.revision) || input.revision < 1) return fail('Обновите запись перед сохранением.', 409);
      const updated = await db.prepare(`UPDATE licenses SET license_key=?, record=json_patch(record,?), version=version+1
        WHERE id_key=? AND version=? RETURNING record, version`)
        .bind(key(record.license), JSON.stringify(record), key(id), input.revision).first();
      if (!updated) return fail('Запись уже изменилась. Откройте её заново.', 409);
      return json({ ...JSON.parse(updated.record), revision:updated.version });
    }
  } catch (error) {
    if (String(error).includes('UNIQUE constraint')) return fail('Такой номер лицензии уже используется.', 409);
    throw error;
  }
  return json({ ...record, revision:1 }, 201);
}

async function api(request, env, url) {
  const path = url.pathname;
  const method = request.method;
  if (method !== 'GET' && (request.headers.get('X-ISRP-Request') !== '1' ||
      request.headers.get('Content-Type')?.split(';')[0] !== 'application/json' ||
      (request.headers.has('Origin') && request.headers.get('Origin') !== url.origin))) {
    return fail('Неверный формат запроса.', 403);
  }
  const configured = Boolean(env.DB && env.ADMIN_PASSWORD);
  if (path === '/api/session' && method === 'GET') {
    if (configured) await ensureSchema(env.DB);
    return json({ configured, authenticated:configured && Boolean(await activeSession(request, env)), canSetup:false,
      setupMessage:!env.DB ? 'Владельцу: подключите базу D1 к Worker izrael под именем DB.' :
        !env.ADMIN_PASSWORD ? 'Владельцу: в настройках Worker izrael добавьте секрет ADMIN_PASSWORD и опубликуйте изменение.' : undefined });
  }
  if (!env.DB) return fail('База реестра не подключена.', 503);
  await ensureSchema(env.DB);
  if (path === '/api/registry' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT record, version FROM licenses ORDER BY rowid DESC').all();
    return json({ ...registry, records:results.map(row => ({ ...JSON.parse(row.record), revision:row.version })) });
  }
  if (!configured) return fail('Владелец ещё не настроил вход.', 503);
  if (path === '/api/login' && method === 'POST') return login(request, env, json);
  const session = await activeSession(request, env);
  if (!session) return fail('Войдите в панель управления.', 401);
  if (path === '/api/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE session_key=?').bind(session).run();
    return json({ authenticated:false }, 200, { 'Set-Cookie':sessionCookie('', 0) });
  }
  if (path === '/api/records' && method === 'POST') return saveRecord(request, env.DB, null);
  const match = /^\/api\/records\/([^/]+)$/.exec(path);
  if (match && method === 'PUT') return saveRecord(request, env.DB, decodeURIComponent(match[1]));
  return fail('Страница не найдена.', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try { return await api(request, env, url); }
    catch { return fail('Реестр временно недоступен. Попробуйте ещё раз.', 503); }
  }
};
