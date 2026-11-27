async function adminRequest(endpoint, method = 'GET', payload) {
  const response = await fetch('./api/' + endpoint, {
    method, cache:'no-store', credentials:'same-origin',
    ...(payload ? {headers:{'Content-Type':'application/json','X-ISRP-Request':'1'}, body:JSON.stringify(payload)} : {})
  });
  const data = await response.json();
  if (!response.ok) {
    const error = Error(data.error || 'Не удалось выполнить запрос.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function adminIntro() { return intro('Панель управления'); }

async function adminView() {
  app.innerHTML = adminIntro() + '<p class="empty-state" role="status">Проверяем доступ…</p>';
  const placeholder = app.lastElementChild;
  if (staticRegistry) {
    placeholder.textContent = 'Управление записями доступно в серверной версии портала.';
    return;
  }
  try {
    const state = await adminRequest('session');
    if (!placeholder.isConnected) return;
    if (!state.authenticated) { renderLogin(state); return; }
    const fresh = await readRegistry();
    if (!placeholder.isConnected) return;
    licenses = fresh;
    renderDashboard();
  } catch { placeholder.textContent = 'Сервис управления временно недоступен. Обновите страницу.'; }
}

function renderLogin(state) {
  const setup = state.canSetup;
  app.innerHTML = adminIntro() + `<section class="access-card"><div class="access-form">
    <h2>${setup ? 'Создайте пароль' : 'Вход администратора'}</h2>
    ${state.configured || setup ? `
    <form id="login-form"><label>Пароль<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="${setup ? 'new-password' : 'current-password'}"></label>
    ${setup ? '<label>Повторите пароль<input name="confirm" type="password" autocomplete="new-password" required></label><small>От 12 до 256 символов.</small>' : ''}
    <p role="alert" class="form-error"></p><button class="action primary" type="submit">${setup ? 'Создать пароль и войти' : 'Войти'} </button></form>` : '<p>Первый вход настраивается владельцем в закрытом превью или на сервере.</p>'}
    </div></section>`;
  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const error = form.querySelector('[role="alert"]');
    error.textContent = '';
    if (setup && form.elements.password.value !== form.elements.confirm.value) {
      error.textContent = 'Пароли не совпадают.'; form.elements.confirm.focus(); return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await adminRequest(setup ? 'setup' : 'login', 'POST', {password:form.elements.password.value});
      if (form.isConnected) await adminView();
    } catch (e) { error.textContent = e.message; } finally { button.disabled = false; }
  });
}

function renderDashboard(message = '', saved = null) {
  const records = licenses.records;
  const real = records.filter(r => !r.demo);
  const active = real.filter(r => licenseState(r)[0] === 'active');
  const stats = [['Игроки', new Set(real.map(r => normalize(r.nickname))).size],
    ['Действующие лицензии',active.length], ['Адвокатские лицензии',active.filter(r => r.faction === 'bar').length]];
  app.innerHTML = `${adminIntro()}<div class="admin-stats">${stats.map(([label,count]) => `<div><span>${label}</span><strong>${count}</strong></div>`).join('')}</div>
    <section class="admin-panel"><div class="panel-heading"><div><h2>Записи реестра</h2><p>В статистике учитываются записи реальных игроков.</p></div><button id="add-record" class="action primary">Добавить игрока</button></div>
    <p class="save-notice" role="status">${escapeHTML(message)}${saved ? ` <a class="text-link" href="#${saved.faction === 'bar' ? 'lawyers' : 'verify'}/${encodeURIComponent(saved.id)}">Проверить запись</a>` : ''}</p>
    <label class="inline-field admin-search"><input type="search" id="admin-query" placeholder="Поиск по реестру" aria-label="Поиск по реестру"></label>
    <div class="records-list" id="admin-list"></div><div class="panel-bottom"><small id="admin-count"></small><button class="quiet" id="sign-out">Выйти из панели</button></div></section>`;
  const list = document.getElementById('admin-list');
  const search = document.getElementById('admin-query');
  function refreshList() {
    const term = normalize(search.value);
    const matches = records.filter(r => [r.nickname,r.license,r.id,r.role].some(v => normalize(v).includes(term)));
    list.innerHTML = matches.map(r => {
      const [cls,status] = licenseState(r);
      return `<button type="button" class="admin-row" data-record="${escapeHTML(r.id)}"><span><b>${escapeHTML(r.nickname)}</b><small>${escapeHTML(r.role)} · ${escapeHTML(r.license)}</small></span><span class="license-status ${cls}">${r.demo ? 'Демо · ' : ''}${status}</span><span class="edit-mark">Изменить</span></button>`;
    }).join('') || '<p class="empty-state">Записей по запросу нет.</p>';
    document.getElementById('admin-count').textContent = quantity(matches.length, 'запись', 'записи', 'записей');
  }
  refreshList(); search.oninput = refreshList;
  document.getElementById('add-record').onclick = () => openRecordDialog();
  list.onclick = event => {
    const button = event.target.closest('[data-record]');
    if (button) openRecordDialog(records.find(r => r.id === button.dataset.record));
  };
  document.getElementById('sign-out').onclick = async () => {
    try {
      await adminRequest('logout','POST',{});
      if (list.isConnected) await adminView();
    } catch { if (list.isConnected) app.querySelector('.save-notice').textContent = 'Не удалось выйти. Повторите попытку.'; }
  };
}

function openRecordDialog(record) {
  const dialog = document.createElement('dialog');
  dialog.className = 'record-dialog';
  dialog.setAttribute('aria-labelledby','editor-title');
  app.append(dialog);
  dialog.innerHTML = `<form><header><h2 id="editor-title">${record ? 'Редактировать лицензию' : 'Добавить игрока'}</h2><button type="button" aria-label="Закрыть" class="close-dialog">×</button></header>
    ${record ? `<p class="record-id">${escapeHTML(record.id)}${record.demo ? ' · Демонстрационная запись' : ''}</p>` : ''}
    <div class="editor-fields"><label>Ник игрока<input name="nickname" autocomplete="off" maxlength="80" required autofocus></label>
    <label>Номер лицензии<input name="license" maxlength="80" required></label>
    <label>Организация<select name="faction">${licenses.factions.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.name)}</option>`).join('')}</select></label>
    <label>Роль<select name="role"></select></label>
    <label>Дата выдачи<input type="date" name="issuedAt" required></label><label>Действует по<input type="date" name="expiresAt" required></label>
    <label>Статус<select name="status"><option value="active">Действует</option><option value="revoked">Аннулирована</option><option value="expired">Срок истёк</option></select></label></div>
    <p class="form-error" role="alert"></p><footer><button type="button" class="action subtle cancel-dialog">Отмена</button><button class="action primary" type="submit">Сохранить</button></footer></form>`;
  const form = dialog.querySelector('form');
  const fields = form.elements;
  function refreshRoles() {
    const faction = licenses.factions.find(f => f.id === fields.faction.value);
    fields.role.innerHTML = faction.roles.map(r => `<option>${escapeHTML(r)}</option>`).join('');
  }
  fields.faction.value = record?.faction || 'bar'; refreshRoles();
  fields.faction.onchange = refreshRoles;
  if (record) {
    for (const name of ['nickname','license','role','issuedAt','expiresAt','status']) fields[name].value = record[name];
  } else { fields.issuedAt.value = new Date().toISOString().slice(0,10); }
  const setMinDate = () => { fields.expiresAt.min = fields.issuedAt.value; };
  setMinDate(); fields.issuedAt.oninput = setMinDate;
  dialog.querySelector('.close-dialog').onclick = dialog.querySelector('.cancel-dialog').onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  dialog.showModal();
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector('[role="alert"]');
    error.textContent = ''; submit.disabled = true;
    const payload = Object.fromEntries(new FormData(form));
    if (record) payload.revision = record.revision;
    try {
      const saved = await adminRequest(record ? 'records/' + encodeURIComponent(record.id) : 'records', record ? 'PUT' : 'POST', payload);
      if (route() !== 'admin') return;
      licenses.records = [saved, ...licenses.records.filter(r => r.id !== saved.id)];
      dialog.close(); renderDashboard('Лицензия сохранена.', saved);
      app.querySelector('.save-notice a').focus();
    } catch (e) {
      error.textContent = e.message;
      if (e.status === 401 && dialog.isConnected) { dialog.close(); await adminView(); }
      if (e.status === 409 && record) {
        dialog.addEventListener('close', () => { if (route() === 'admin') adminView(); }, {once:true});
      }
    } finally { submit.disabled = false; }
  };
}
