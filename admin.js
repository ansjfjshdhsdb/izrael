let adminSession = null;

function adminView() {
  if (!writable) {
    app.innerHTML = intro('Управление сайтом') + `<section class="panel login"><div class="icon-tile">${icon('lock')}</div><h2>Режим чтения</h2><p>Для редактирования подключите базу D1 и задайте пароль администратора в настройках Cloudflare Pages.</p><a class="text-link" href="#verify">Открыть проверку игрока ${icon('arrow')}</a></section>`;
  } else if (adminSession && adminSession.expiresAt * 1000 > Date.now()) {
    dashboard();
  } else {
    app.innerHTML = intro('Управление сайтом') + `<section class="panel login"><div class="icon-tile">${icon('lock')}</div><h2>Вход администратора</h2><p>Войдите, чтобы выдавать лицензии игрокам и редактировать документы проекта.</p>
      <form class="stack" id="login"><label>Пароль<input name="password" type="password" required autocomplete="current-password"></label>
      <p class="form-message" role="status"></p><button class="btn primary">Войти ${icon('arrow')}</button></form></section>`;
    const form = document.getElementById('login');
    form.onsubmit = event => {
      event.preventDefault();
      runForm(form, async () => {
        const session = await adminRequest('login','POST', { password:form.elements.password.value });
        form.reset();
        if (!form.isConnected) return;
        adminSession = session;
        dashboard();
      });
    };
  }
}

async function adminRequest(action, method, body) {
  let response;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (action !== 'login' && adminSession) headers.Authorization = 'Bearer ' + adminSession.token;
    response = await fetch(`./api/${action}`, {
      method, headers,
      body: JSON.stringify(body)
    });
  } catch { throw Error('Нет связи с сервером. Проверьте подключение и повторите попытку.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && action !== 'login') {
      adminSession = null;
      if (route() === 'admin') adminView();
    }
    throw Error(data.error || 'Не удалось выполнить запрос.');
  }
  return response.json();
}

async function runForm(form, task) {
  const submit = form.querySelector('button[type="submit"],button:not([type])');
  if (submit.disabled) return;
  const message = form.querySelector('.form-message');
  submit.disabled = true;
  message.textContent = '';
  try { await task(); }
  catch (error) { message.textContent = error.message; }
  finally { submit.disabled = false; }
}

function dashboard(notice = '', tab = 'records') {
  const records = licenses.records;
  const active = records.filter(r => licenseState(r)[0] === 'active');
  const metrics = [['Всего записей', records.length],['Действующие лицензии', active.length],['Адвокаты с лицензией', active.filter(r => r.role === 'Адвокат').length]];
  app.innerHTML = `${intro('Управление сайтом', 'Реестр игроков и документы проекта.')}<div class="dashboard-bar"><div class="admin-tabs">
    <button type="button" data-tab="records" aria-pressed="${tab === 'records'}">Игроки</button><button type="button" data-tab="documents" aria-pressed="${tab === 'documents'}">Документы</button></div><button class="text-link" id="logout">Выйти</button></div>
    <p role="status" class="notice"${notice ? '' : ' hidden'}>${escapeHTML(notice)}</p>
    ${tab === 'records' ? `<div class="metrics">${metrics.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
    <section><div class="section-head"><h2>Реестр игроков</h2><button class="btn primary" type="button" id="add">${icon('plus')}Добавить игрока</button></div>
    <label class="filter-search">${icon('search')}<input type="search" id="record-search" placeholder="Ник, ID или лицензия" aria-label="Поиск записи"></label><div id="admin-records" class="table-box"></div></section>` : '<section id="doc-editor"></section>'}`;
  document.getElementById('logout').onclick = async event => {
    event.currentTarget.disabled = true;
    try {
      await adminRequest('logout', 'POST', {});
      adminSession = null;
      if (route() === 'admin') adminView();
    } catch (error) {
      const message = app.querySelector('.notice');
      if (message) { message.hidden = false; message.textContent = error.message; }
      const button = document.getElementById('logout');
      if (button) button.disabled = false;
    }
  };
  document.querySelectorAll('[data-tab]').forEach(button => { button.onclick = () => dashboard('', button.dataset.tab); });
  if (tab === 'documents') { documentEditor(); return; }
  document.getElementById('add').onclick = () => recordEditor();
  const search = document.getElementById('record-search');
  const list = document.getElementById('admin-records');
  function showRows() {
    const query = normalize(search.value);
    const matches = records.filter(r => [r.id,r.nickname,r.license].some(v => normalize(v).includes(query)));
    list.innerHTML = matches.length ? licenseTable(matches, true) : '<p class="empty-state">Записей не найдено.</p>';
  }
  search.oninput = showRows;
  list.onclick = event => {
    const button = event.target.closest('[data-edit-id]');
    if (button) recordEditor(records.find(r => r.id === button.dataset.editId));
  };
  showRows();
}

async function afterSave(form, text, tab) {
  try { await loadPortal(); }
  catch {
    if (form.isConnected) {
      form.innerHTML = '<p class="notice">Изменения сохранены. Обновите страницу, чтобы загрузить реестр.</p>';
    }
    return;
  }
  if (form.isConnected) dashboard(text, tab);
}

function recordEditor(record) {
  const editing = Boolean(record);
  const today = new Date().toISOString().slice(0,10);
  const r = record || { id:'', nickname:'', license:'', issuedAt:today, expiresAt:'', faction:licenses.factions[0].id, status:'active' };
  const dialog = document.createElement('dialog');
  dialog.className = 'edit-dialog';
  dialog.setAttribute('aria-labelledby','dialog-title');
  const input = (label, name, type = 'text') => `<label>${label}<input name="${name}" type="${type}" value="${escapeHTML(r[name])}" ${editing && name === 'id' ? 'readonly' : ''} maxlength="100" required></label>`;
  dialog.innerHTML = `<div class="section-head"><h2 id="dialog-title">${editing ? 'Изменить лицензию' : 'Добавить игрока'}</h2><button class="icon-button close" type="button" aria-label="Закрыть">×</button></div>
    <form class="form-grid">${input('Ник игрока','nickname')}${input('ID игрока','id')}
    <label>Фракция<select name="faction">${licenses.factions.map(f => option(f.id, f.name)).join('')}</select></label>
    <label>Роль<select name="role"></select></label>${input('Номер лицензии','license')}
    <label>Статус<select name="status">${[['active','Действует'],['revoked','Аннулирована'],['expired','Истекла']].map(([v,l])=>option(v,l)).join('')}</select></label>
    ${input('Дата выдачи','issuedAt','date')}${input('Действует до','expiresAt','date')}
    <p class="form-message full" role="status"></p><div class="form-footer full"><button type="button" class="btn secondary cancel">Отмена</button><button type="submit" class="btn primary">Сохранить</button></div></form>`;
  app.append(dialog);
  const form = dialog.querySelector('form');
  const fields = form.elements;
  fields.faction.value = r.faction;
  fields.status.value = r.status;
  const updateRoles = () => { fields.role.innerHTML = licenses.factions.find(f => f.id === fields.faction.value).roles.map(v => option(v)).join(''); };
  fields.faction.onchange = updateRoles;
  updateRoles();
  if (editing) fields.role.value = r.role;
  fields.issuedAt.oninput = () => { fields.expiresAt.min = fields.issuedAt.value; };
  fields.issuedAt.oninput();
  dialog.querySelectorAll('.close,.cancel').forEach(b => { b.onclick = () => dialog.close(); });
  dialog.onclose = () => dialog.remove();
  form.onsubmit = e => {
    e.preventDefault();
    runForm(form, async () => {
      await adminRequest('records', editing ? 'PUT' : 'POST', { ...Object.fromEntries(new FormData(form)), version: r.version });
      await afterSave(form, editing ? 'Лицензия обновлена.' : 'Игрок добавлен. Лицензия доступна для проверки.', 'records');
    });
  };
  dialog.showModal();
}

function documentEditor() {
  const panel = document.getElementById('doc-editor');
  panel.className = 'panel';
  panel.innerHTML = `<h2>${icon('book')}Редактирование документа</h2><form class="form-grid">
    <label>Документ<select name="kind">${['rules','criminal','powers'].map(k=>option(k,pageNames[k])).join('')}</select></label>
    <label>Раздел<select name="section"></select></label><label class="full">Пункт<select name="clause"></select></label>
    <label class="full">Текст пункта<textarea name="content" rows="5" maxlength="3000" required></textarea></label>
    <p class="form-message full" role="status"></p><div class="full"><button type="submit" class="btn primary">Сохранить пункт</button></div></form>`;
  const form = panel.querySelector('form');
  const fields = form.elements;
  function showContent() {
    const item = documents[fields.kind.value][fields.section.value].items[fields.clause.value];
    fields.content.value = item.text || item;
  }
  function showItems() {
    const section = documents[fields.kind.value][fields.section.value];
    fields.clause.innerHTML = section.items.map((item, i) => option(i, `${item.number || i+1} · ${String(item.text || item).slice(0,75)}`)).join('');
    showContent();
  }
  function showSections() {
    fields.section.innerHTML = documents[fields.kind.value].map((s,i) => option(i, s.title)).join('');
    showItems();
  }
  fields.kind.onchange = showSections;
  fields.section.onchange = showItems;
  fields.clause.onchange = showContent;
  showSections();
  form.onsubmit = event => {
    event.preventDefault();
    runForm(form, async () => {
      const kind = fields.kind.value, section = Number(fields.section.value), item = Number(fields.clause.value);
      await adminRequest('documents','PUT', { kind, section, item, content: fields.content.value, version: documentVersions[[kind,section,item].join('/')] || 0 });
      await afterSave(form, 'Пункт обновлён в публичном документе.', 'documents');
    });
  };
}
