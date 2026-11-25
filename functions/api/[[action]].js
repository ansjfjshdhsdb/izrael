import registry from '../../data/licenses.json';
import documents from '../../data/documents.json';
import { activeSession, login } from '../../server/admin-auth.js';

const json = (data, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const fail = (message, status) => json({ error: message }, status);
const key = value => value.trim().normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е');
const conflict = () => fail('Запись уже изменилась. Обновите страницу и проверьте актуальную версию перед сохранением.', 409);

async function loadPortal(env) {
  if (!env.DB) return json({ registry, documents, writable: false });
  const [entries, edits] = await env.DB.batch([
    env.DB.prepare("SELECT record, version FROM licenses WHERE json_type(record, '$.demo') IS NOT 'true' ORDER BY rowid DESC"),
    env.DB.prepare('SELECT item_key, content, version FROM document_edits')
  ]);
  const docs = structuredClone(documents);
  const versions = {};
  for (const { item_key, content, version } of edits.results) {
    const [kind, section, item] = item_key.split('/');
    if (!docs[kind]?.[section]?.items[item]) continue;
    if (kind === 'powers') docs[kind][section].items[item] = content;
    else docs[kind][section].items[item].text = content;
    versions[item_key] = version;
  }
  const records = entries.results.map(row => ({ ...JSON.parse(row.record), version: row.version }));
  return json({ registry: { ...registry, records }, documents: docs, versions, writable: Boolean(env.ADMIN_PASSWORD) });
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function saveRecord(db, input, creating) {
  const record = {};
  for (const field of ['id', 'nickname', 'license', 'faction', 'role', 'issuedAt', 'expiresAt', 'status']) {
    const value = input[field];
    if (typeof value !== 'string' || !value.trim() || value.length > 100) {
      return fail('Заполните все поля. Максимальная длина поля — 100 символов.', 400);
    }
    record[field] = value.trim();
  }
  if (!registry.factions.find(f => f.id === record.faction)?.roles.includes(record.role)) {
    return fail('Выберите роль выбранной фракции.', 400);
  }
  if (!validDate(record.issuedAt) || !validDate(record.expiresAt) || record.expiresAt < record.issuedAt) {
    return fail('Проверьте даты выдачи и окончания лицензии.', 400);
  }
  if (!['active', 'expired', 'revoked'].includes(record.status)) return fail('Неизвестный статус.', 400);
  const id = key(record.id);
  const license = key(record.license);
  try {
    if (creating) {
      await db.prepare('INSERT INTO licenses (id_key, license_key, record) VALUES (?, ?, ?)')
        .bind(id, license, JSON.stringify(record)).run();
    } else {
      if (!Number.isInteger(input.version) || input.version < 1) return conflict();
      const result = await db.prepare('UPDATE licenses SET license_key = ?, record = ?, version = version + 1 WHERE id_key = ? AND version = ?')
        .bind(license, JSON.stringify(record), id, input.version).run();
      if (!result.meta.changes) return conflict();
    }
  } catch (error) {
    if (String(error).includes('UNIQUE constraint')) return fail('Такой ID игрока или номер лицензии уже есть в реестре.', 409);
    throw error;
  }
  return json({ saved: true }, creating ? 201 : 200);
}

async function saveDocument(db, input) {
  const { kind, section, item, version } = input;
  if (!['rules', 'criminal', 'powers'].includes(kind) || !Number.isInteger(section) || !Number.isInteger(item)
    || !documents[kind][section]?.items[item] || !Number.isInteger(version) || version < 0) {
    return fail('Пункт документа не найден.', 400);
  }
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  if (!content || content.length > 3000) return fail('Текст пункта должен содержать от 1 до 3000 символов.', 400);
  const id = [kind, section, item].join('/');
  const statement = version === 0
    ? db.prepare('INSERT INTO document_edits (item_key, content) VALUES (?, ?) ON CONFLICT DO NOTHING').bind(id, content)
    : db.prepare('UPDATE document_edits SET content = ?, version = version + 1 WHERE item_key = ? AND version = ?').bind(content, id, version);
  const result = await statement.run();
  return result.meta.changes ? json({ saved: true }) : conflict();
}

export async function onRequest({ request, env, params }) {
  const action = params.action?.[0];
  try {
    if (action === 'portal' && request.method === 'GET') return await loadPortal(env);
    if (!['login', 'logout', 'records', 'documents'].includes(action)) return fail('Страница не найдена.', 404);
    if (!env.DB || !env.ADMIN_PASSWORD) return fail('Панель управления не подключена.', 503);
    if (action === 'login') return request.method === 'POST' ? await login(request, env, json) : fail('Метод недоступен.', 405);
    const session = await activeSession(request, env);
    if (!session) return fail('Войдите в панель управления.', 401);
    if (action === 'logout' && request.method === 'POST') {
      await env.DB.prepare('DELETE FROM admin_sessions WHERE session_key = ?').bind(session).run();
      return json({ signedOut:true });
    }
    if ((action === 'records' && ['POST', 'PUT'].includes(request.method)) ||
        (action === 'documents' && request.method === 'PUT')) {
      let input;
      try { input = await request.json(); } catch { return fail('Неверный формат запроса.', 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Неверный формат данных.', 400);
      return action === 'records' ? await saveRecord(env.DB, input, request.method === 'POST') : await saveDocument(env.DB, input);
    }
    return fail('Метод недоступен.', 405);
  } catch {
    return fail('База данных временно недоступна. Попробуйте ещё раз.', 503);
  }
}
