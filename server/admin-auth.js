const SESSION_SECONDS = 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 8;
const encoder = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const hex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

async function keyedHash(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function login(request, env, json) {
  const clock = now();
  // Cloudflare sets this header at the edge. Hash the address before storing it.
  const client = await keyedHash('client:' + (request.headers.get('CF-Connecting-IP') || 'local'), env.ADMIN_PASSWORD);
  const [, attempt] = await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE expires_at <= ?').bind(clock),
    env.DB.prepare(`INSERT INTO login_attempts (client_key, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(client_key) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ?`)
      .bind(client, clock + LOGIN_WINDOW_SECONDS, MAX_ATTEMPTS)
  ]);
  if (!attempt.meta.changes) return json({ error:'Слишком много попыток входа. Повторите через 15 минут.' }, 429);

  let password;
  try { password = (await request.json())?.password; } catch { /* Invalid credentials. */ }
  const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value));
  const [expected, supplied] = await Promise.all([digest(env.ADMIN_PASSWORD), digest(typeof password === 'string' ? password : '')]);
  if (!crypto.subtle.timingSafeEqual(expected, supplied)) return json({ error:'Неверный пароль администратора.' }, 401);

  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const sessionKey = await keyedHash('session:' + token, env.ADMIN_PASSWORD);
  const expiresAt = clock + SESSION_SECONDS;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE client_key = ?').bind(client),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(clock),
    env.DB.prepare('INSERT INTO admin_sessions (session_key, expires_at) VALUES (?, ?)').bind(sessionKey, expiresAt)
  ]);
  return json({ authenticated:true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) });
}

export function sessionCookie(token, seconds) {
  return `__Host-isrp_session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
}

export async function activeSession(request, env) {
  const match = /(?:^|;\s*)__Host-isrp_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') || '');
  if (!match) return null;
  const key = await keyedHash('session:' + match[1], env.ADMIN_PASSWORD);
  return env.DB.prepare('SELECT session_key FROM admin_sessions WHERE session_key = ? AND expires_at > ?')
    .bind(key, now()).first('session_key');
}
