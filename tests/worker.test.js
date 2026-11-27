import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Miniflare } from 'miniflare';

test('Cloudflare deployment serves the admin API and persists attorney licenses', async t => {
  const out = await mkdtemp(join(tmpdir(), 'isrp-worker-test-'));
  t.after(() => rm(out, { recursive:true, force:true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', out]);
  const password = randomUUID();
  const runtime = new Miniflare({
    modules:true, script:await readFile(join(out, 'worker.js'), 'utf8'), compatibilityDate:'2026-03-01',
    d1Databases:['DB'], bindings:{ ADMIN_PASSWORD:password }
  });
  t.after(() => runtime.dispose());
  function request(path, method = 'GET', body, cookie = '') {
    const headers = { Cookie:cookie, 'Content-Type':'application/json', 'X-ISRP-Request':'1' };
    return runtime.dispatchFetch('https://portal.example/api/' + path, {
      method, headers, body:body === undefined ? undefined : JSON.stringify(body)
    });
  }
  const state = await (await request('session')).json();
  assert.equal(state.configured, true);
  assert.equal(state.authenticated, false);
  assert.equal(state.canSetup, false);
  const res = await request('login', 'POST', { password });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await (await request('session','GET',undefined,cookie)).json()).authenticated, true);
  const record = { license:'BAR-1', nickname:'Counsel', faction:'bar', role:'Адвокат',
    issuedAt:'2026-01-01', expiresAt:'2029-01-01', status:'active' };
  assert.equal((await request('records','POST',record)).status, 401);
  const created = await request('records','POST',record,cookie);
  assert.equal(created.status, 201);
  const saved = await created.json();
  const path = 'records/' + saved.id;
  assert.equal((await request('records','POST',record,cookie)).status, 409);
  assert.equal((await request(path,'PUT',{ ...saved, status:'revoked' },cookie)).status, 200);
  assert.equal((await request(path,'PUT',saved,cookie)).status, 409);
  const publicData = await (await request('registry')).json();
  assert.equal(publicData.records[0].nickname, 'Counsel');
  assert.equal(publicData.records[0].status, 'revoked');
  assert.equal((await request('logout','POST',{},cookie)).status, 200);
  assert.equal((await (await request('session','GET',undefined,cookie)).json()).authenticated, false);
});
