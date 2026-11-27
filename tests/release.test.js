import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Miniflare } from 'miniflare';

test('release registry and administrative access', async t => {
  const out = await mkdtemp(join(tmpdir(), 'isrp-release-'));
  t.after(() => rm(out, { recursive:true, force:true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'functions', 'build', '--outdir', out]);
  const password = randomUUID();
  const runtime = new Miniflare({
    modules:true, script:await readFile(join(out, 'index.js'), 'utf8'), compatibilityDate:'2026-03-01',
    d1Databases:['DB'], bindings:{ ADMIN_PASSWORD:password }
  });
  t.after(() => runtime.dispose());
  const db = await runtime.getD1Database('DB');
  async function migrate(name) {
    const sql = await readFile('migrations/' + name, 'utf8');
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
    await db.batch(statements.map(s => db.prepare(s)));
  }
  function request(action, method = 'GET', body, token) {
    const headers = { 'Content-Type':'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return runtime.dispatchFetch('https://portal.example/api/' + action, {
      method, headers, body:body === undefined ? undefined : JSON.stringify(body)
    });
  }
  async function signIn() {
    const response = await request('login', 'POST', { password });
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.ok(session.token);
    return session.token;
  }

  await t.test('fresh and upgraded registries contain only issued licenses', async () => {
    await migrate('001_registry.sql');
    assert.equal((await (await request('portal')).json()).registry.records.length, 0);
    const seed = db.prepare('INSERT INTO licenses (id_key, license_key, record) VALUES (?, ?, ?)');
    await db.batch([
      seed.bind('sample', 'sample-license', JSON.stringify({ id:'sample', demo:true })),
      seed.bind('existing', 'existing-license', JSON.stringify({ id:'existing', demo:false }))
    ]);
    await migrate('002_release.sql');
    const { results } = await db.prepare('SELECT id_key FROM licenses').all();
    assert.deepEqual(results, [{ id_key:'existing' }]);
    const publicData = await (await request('portal')).json();
    assert.deepEqual(publicData.registry.records.map(r => r.id), ['existing']);
    assert.deepEqual(JSON.parse(await readFile('data/licenses.json', 'utf8')).records, []);
  });

  await t.test('only an active session can issue, edit or revoke licenses or edit documents', async () => {
    const license = {
      id:'user-001', license:'BAR-001', nickname:'Counsel', faction:'bar', role:'Адвокат',
      issuedAt:'2026-01-01', expiresAt:'2028-01-01', status:'active'
    };
    for (const [action,method] of [['records','POST'], ['records','PUT'], ['documents','PUT']]) {
      assert.equal((await request(action, method, {})).status, 401);
      assert.equal((await request(action, method, {}, password)).status, 401);
    }
    assert.equal((await request('login', 'POST', { password:'incorrect' })).status, 401);
    const token = await signIn();
    assert.equal((await request('records', 'POST', license, token)).status, 201);
    assert.equal((await request('records', 'PUT', { ...license, version:1, status:'revoked' }, token)).status, 200);
    const data = await (await request('portal')).json();
    assert.equal(data.registry.records.find(r => r.id === license.id).status, 'revoked');
    assert.equal((await request('logout', 'POST', {}, token)).status, 200);
    assert.equal((await request('documents', 'PUT', {}, token)).status, 401);
    const next = await signIn();
    await db.prepare('UPDATE admin_sessions SET expires_at = 0').run();
    assert.equal((await request('records', 'PUT', license, next)).status, 401);
  });

  await t.test('repeated wrong passwords trigger a temporary login limit', async () => {
    for (let i = 0; i < 8; i++) {
      assert.equal((await request('login', 'POST', { password:'incorrect' })).status, 401);
    }
    assert.equal((await request('login', 'POST', { password })).status, 429);
    await db.prepare('UPDATE login_attempts SET expires_at = 0').run();
    await signIn();
  });
});
