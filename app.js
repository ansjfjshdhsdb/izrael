const app = document.getElementById('app');
const pageNames = { home: 'Обзор', rules: 'Правила сервера', criminal: 'Криминальный кодекс', powers: 'Полномочия служб', verify: 'Проверка игрока', admin: 'Управление' };
const routes = new Set(Object.keys(pageNames));
let documents = null;
let licenses = null;
let writable = false;
let documentVersions = {};
let apiAvailable = true;

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
const quantity = (number, one, few, many) => {
  const lastTwo = number % 100;
  const last = number % 10;
  return `${number} ${lastTwo >= 11 && lastTwo <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many}`;
};
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  scan: '<path d="M3 8V4h5m8 0h5v4M3 16v4h5m8 0h5v-4"/><circle cx="12" cy="10" r="3"/><path d="M7 17a5 5 0 0 1 10 0"/>',
  settings: '<path d="M4 6h7m4 0h5M4 12h2m4 0h10M4 18h10m4 0h2"/><circle cx="13" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  northeast: '<path d="M6 18 18 6M7 6h11v11"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 3v4m10-4v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  edit: '<path d="m4 16 11-11 4 4L8 20l-5 1 1-5Zm9-9 4 4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z"/><path d="M8 7h8M8 11h6"/>',
  scale: '<path d="M12 3v17M5 20h14M4 7h16M6 7l-4 7h8L6 7ZM18 7l-4 7h8l-4-7Z"/>',
  shield: '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>'
};
const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
const route = () => {
  const value = location.hash.slice(1).split('/')[0];
  return routes.has(value) ? value : 'home';
};

function setNavigation(active) {
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    const selected = link.dataset.routeLink === active;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  toggleMenu(false);
  document.getElementById('page-name').textContent = pageNames[active];
  document.title = pageNames[active] + ' · ISRP';
}

function intro(title, description = '', detail = '') {
  return `<header class="page-intro"><div><h1>${escapeHTML(title)}</h1>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div>${detail ? `<span class="page-detail">${escapeHTML(detail)}</span>` : ''}</header>`;
}

function homeView() {
  const links = [
    ['rules', 'book', 'Правила сервера', 'Правила игры и санкции за нарушения.', quantity(documents.rules.length,'раздел','раздела','разделов')],
    ['criminal', 'scale', 'Криминальный кодекс', 'Статьи, штрафы и сроки наказаний.', quantity(documents.criminal.length,'раздел','раздела','разделов')],
    ['powers', 'shield', 'Полномочия служб', 'Права и ограничения сотрудников.', quantity(documents.powers.length,'служба','службы','служб')]
  ];
  app.innerHTML = `<section class="hero"><div class="hero-content"><span class="hero-label"><span></span>UKR ISRAEL ROLEPLAY</span>
    <h1>Правовой<br><em>портал</em></h1><p>Документы сервера и проверка лицензий<br class="wide-break"> игроков в одном месте.</p>
    <a class="btn primary" href="#verify">${icon('scan')}Проверить игрока${icon('arrow')}</a></div></section>
    <section class="home-section"><h2>Документы проекта</h2><div class="collection">${links.map(([target, symbol, title, desc, count]) => `<a class="collection-card ${target}" href="#${target}"><div class="card-top"><span class="icon-tile">${icon(symbol)}</span>${icon('northeast')}</div><h3>${title}</h3><p>${desc}</p><small>${count}</small></a>`).join('')}</div></section>
    <section class="home-section"><div class="section-head"><h2>Реестр лицензий</h2><form id="home-lookup" class="quick-search"><input type="search" id="home-query" aria-label="Ник, ID или номер лицензии" placeholder="Ник, ID или лицензия" required><button type="submit" aria-label="Проверить игрока">${icon('search')}</button></form></div>
    ${licenses.records.length ? `<div class="table-box">${licenseTable(licenses.records.slice(0,3))}</div>` : '<p class="empty-state">В реестре пока нет лицензий.</p>'}</section>`;
  document.getElementById('home-lookup').onsubmit = event => {
    event.preventDefault();
    const query = document.getElementById('home-query').value.trim();
    if (query) location.hash = 'verify/' + encodeURIComponent(query);
  };
}

function licenseState(record) {
  const today = new Date().toISOString().slice(0,10);
  if (record.status === 'revoked') return ['revoked', 'Аннулирована'];
  if (record.status === 'expired' || record.expiresAt < today) return ['expired', 'Истекла'];
  if (record.issuedAt > today) return ['pending', 'Срок не начался'];
  return record.demo ? ['demo', 'Демозапись'] : ['active', 'Действует'];
}

function statusBadge(record) {
  const [state, label] = licenseState(record);
  return `<span class="license-status ${state}">${label}</span>`;
}

function licenseTable(records, editable = false) {
  return `<table class="records-table"><thead><tr><th>Игрок</th><th>Фракция</th><th>Статус</th><th><span class="sr-only">Действие</span></th></tr></thead>
    <tbody>${records.map(r => `<tr><td><div class="identity"><span class="avatar" aria-hidden="true">${escapeHTML(r.nickname.slice(0,2).toLocaleUpperCase('ru'))}</span><div><strong>${escapeHTML(r.nickname)}</strong><small>${escapeHTML(r.id)}${r.demo ? ' · Демо' : ''}</small></div></div></td><td>${escapeHTML(licenses.factions.find(f => f.id === r.faction)?.name || r.faction)}</td><td>${statusBadge(r)}</td><td>${editable ? `<button class="icon-button" type="button" data-edit-id="${escapeHTML(r.id)}" aria-label="Изменить запись ${escapeHTML(r.nickname)}">${icon('edit')}</button>` : `<a class="icon-button" href="#verify/${encodeURIComponent(r.id)}" aria-label="Проверить ${escapeHTML(r.nickname)}">${icon('arrow')}</a>`}</td></tr>`).join('')}</tbody></table>`;
}

function docView(kind) {
  const isRules = kind === 'rules';
  const chapters = documents[kind];
  const total = chapters.reduce((sum, chapter) => sum + chapter.items.length, 0);
  app.innerHTML = `${intro(isRules ? 'Правила сервера' : 'Криминальный кодекс', isRules ? 'Нарушения и наказания по разделам.' : 'Статьи, штрафы и сроки наказаний.', `${quantity(chapters.length,'раздел','раздела','разделов')} · ${quantity(total,'пункт','пункта','пунктов')}`)}
    <div class="doc-layout"><nav class="doc-index" aria-label="Главы документа"><p>${icon('book')} Содержание</p>${chapters.map((chapter) => `<a href="#chapter-${kind}-${chapter.number}"><span>${chapter.number}</span>${escapeHTML(chapter.title)}</a>`).join('')}</nav><div class="doc-main"><div class="mobile-chapter-picker"><select class="select" id="chapter-select" aria-label="Перейти к разделу"><option value="">Выберите раздел</option>${chapters.map(chapter => `<option value="${chapter.number}">${chapter.number}. ${escapeHTML(chapter.title)}</option>`).join('')}</select></div><div class="doc-toolbar"><label class="document-search">${icon('search')}<input class="input" id="doc-search" type="search" placeholder="Номер или текст пункта" aria-label="Поиск по документу"></label><button class="btn btn-ghost expand-button" id="expand-all" type="button">Раскрыть все</button></div><div class="document-caption"><span id="doc-count"></span><span>Нажмите на название, чтобы открыть раздел</span></div><div id="chapters"></div></div></div>`;
  const search = document.getElementById('doc-search');
  const list = document.getElementById('chapters');
  const count = document.getElementById('doc-count');
  function renderChapters() {
    document.getElementById('expand-all').textContent = 'Раскрыть все';
    const query = normalize(search.value);
    const filtered = chapters.map((chapter) => {
      const fullChapter = normalize(`${chapter.number} ${chapter.title}`).includes(query);
      return { ...chapter, items: query && !fullChapter ? chapter.items.filter((item) => normalize(`${item.number} ${item.text}`).includes(query)) : chapter.items };
    }).filter((chapter) => chapter.items.length);
    const total = filtered.reduce((sum, chapter) => sum + chapter.items.length, 0);
    count.textContent = quantity(total,'пункт','пункта','пунктов');
    list.innerHTML = filtered.length ? filtered.map((chapter, index) => `<section class="chapter ${query || index === 0 ? 'open' : ''}" id="chapter-${kind}-${chapter.number}"><button class="chapter-header" type="button" aria-expanded="${query || index === 0 ? 'true' : 'false'}"><span class="chapter-number">${chapter.number}</span><span class="chapter-title">${escapeHTML(chapter.title)}</span><span class="chapter-meta">${chapter.items.length} п.</span><span class="chevron" aria-hidden="true">⌄</span></button><div class="chapter-body" ${query || index === 0 ? '' : 'hidden'}>${chapter.items.map((item) => `<div class="clause"><span class="clause-number">${escapeHTML(item.number)}</span><span class="clause-text">${escapeHTML(item.text)}</span></div>`).join('')}</div></section>`).join('') : '<p class="empty-state">Пункт не найден. Проверьте номер или запрос.</p>';
  }
  search.addEventListener('input', renderChapters);
  document.getElementById('expand-all').addEventListener('click', event => {
    const expand = event.currentTarget.textContent === 'Раскрыть все';
    list.querySelectorAll('.chapter').forEach(chapter => {
      chapter.classList.toggle('open',expand);
      chapter.querySelector('.chapter-header').setAttribute('aria-expanded',String(expand));
      chapter.querySelector('.chapter-body').hidden = !expand;
    });
    event.currentTarget.textContent = expand ? 'Свернуть все' : 'Раскрыть все';
  });
  function openChapter(id) {
    if (search.value) { search.value = ''; renderChapters(); }
    const target = document.getElementById(id);
    if (!target) return;
    const button = target.querySelector('.chapter-header');
    if (button.getAttribute('aria-expanded') === 'false') button.click();
    target.scrollIntoView({block: 'start'});
  }
  document.getElementById('chapter-select').addEventListener('change',event => {
    if (event.target.value) openChapter(`chapter-${kind}-${event.target.value}`);
  });
  list.addEventListener('click', (event) => {
    const button = event.target.closest('.chapter-header');
    if (!button) return;
    const chapter = button.closest('.chapter');
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    chapter.classList.toggle('open', !expanded);
    chapter.querySelector('.chapter-body').hidden = expanded;
  });
  document.querySelector('.doc-index').addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    openChapter(link.getAttribute('href').slice(1));
    document.querySelectorAll('.doc-index a').forEach((item) => item.classList.toggle('selected', item === link));
  });
  renderChapters();
}

function powersView() {
  const names = {'СБС':'СБС','НПС':'НПС','СУД':'Суд','МЭРИЯ':'Мэрия','ПРОКУРАТУРА':'Прокуратура','МОССАД':'Моссад','АДМИНИСТРАЦИЯ':'Администрация'};
  app.innerHTML = `${intro('Полномочия служб', 'Права и ограничения органов ISRP.', `${documents.powers.length} служб`)}
    <nav class="service-nav" aria-label="Службы">${documents.powers.map((group,index) => `<a href="#service-${index}">${escapeHTML(names[group.title] || group.title)}</a>`).join('')}</nav>
    <div class="powers-list">${documents.powers.map((group,index) => {
      const allowed = group.items.filter(item => !item.startsWith('Не имеет права'));
      const restricted = group.items.filter(item => item.startsWith('Не имеет права'));
      return `<section class="power-row" id="service-${index}"><header class="service-heading"><span class="service-seal" aria-hidden="true">${escapeHTML(group.title.length <= 3 ? group.title : group.title.slice(0,1))}</span><h2>${escapeHTML(names[group.title] || group.title)}</h2><span class="service-context">Органы и службы ISRP</span></header><div class="service-content"><h3>Полномочия</h3><ul class="permissions-list">${allowed.map(item => `<li><span class="permission-mark" aria-hidden="true">✓</span><span>${escapeHTML(item)}</span></li>`).join('')}</ul>${restricted.length ? `<div class="service-restrictions"><h3>Ограничения</h3>${restricted.map(item => `<p>${escapeHTML(item)}</p>`).join('')}</div>` : ''}</div></section>`;
    }).join('')}</div>`;
  document.querySelector('.service-nav').addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    document.querySelector(link.getAttribute('href')).scrollIntoView({block:'start'});
    document.querySelectorAll('.service-nav a').forEach(item => item.classList.toggle('selected', item === link));
  });
}

function verifyView() {
  app.innerHTML = `${intro('Проверка игрока', 'Проверьте, кому выдана лицензия и действует ли она сейчас.', 'Кабинет адвоката')}
    <div class="verify-layout"><section class="panel"><h2>${icon('scan')}Поиск в реестре</h2>
      <form id="lookup-form" class="form-grid">
        <label class="full">Ник, ID или номер лицензии<input id="lookup-query" type="search" placeholder="Например, Demo_Judge" required></label>
        <label>Фракция<select id="lookup-faction"><option value="">Все фракции</option>${licenses.factions.map(f => option(f.id, f.name)).join('')}</select></label>
        <label>Роль<select id="lookup-role"></select></label>
        <div class="full"><button class="btn primary" type="submit">${icon('search')}Проверить</button></div>
      </form><div id="lookup-results" aria-live="polite"></div></section>
    <aside class="panel guide"><div class="icon-tile">${icon('scale')}</div><h2>Проверка адвоката</h2><p>Чтобы найти лицензию адвоката, выберите «Адвокатура» и введите ник, ID игрока или номер лицензии.</p>
      <button type="button" class="text-link" id="lawyer-filter">Выбрать адвокатуру ${icon('arrow')}</button><hr><p>Записи с пометкой «Демо» предназначены для знакомства с порталом.</p></aside></div>`;
  const form = document.getElementById('lookup-form');
  const queryInput = document.getElementById('lookup-query');
  const faction = document.getElementById('lookup-faction');
  const role = document.getElementById('lookup-role');
  const results = document.getElementById('lookup-results');
  function updateRoles() {
    const factions = licenses.factions.filter(f => !faction.value || faction.value === f.id);
    role.innerHTML = '<option value="">Все роли</option>' + [...new Set(factions.flatMap(f => f.roles))].map(r => option(r)).join('');
  }
  faction.onchange = updateRoles;
  updateRoles();
  document.getElementById('lawyer-filter').onclick = () => {
    faction.value = 'bar';
    updateRoles();
    role.value = 'Адвокат';
    queryInput.focus();
    results.replaceChildren();
  };
  let searchNumber = 0;
  form.onsubmit = async event => {
    event.preventDefault();
    const query = normalize(queryInput.value);
    if (!query) return;
    const search = ++searchNumber;
    results.textContent = 'Проверяем реестр…';
    try {
      if (apiAvailable) await loadPortal();
      if (search !== searchNumber || !form.isConnected) return;
      const matches = licenses.records.filter(r => [r.id,r.nickname,r.license].some(v => normalize(v).includes(query))
        && (!faction.value || r.faction === faction.value) && (!role.value || r.role === role.value));
      results.innerHTML = matches.length ? `<h3 class="result-title">Найдено записей · ${matches.length}</h3>${matches.map(renderLicense).join('')}`
        : '<p class="empty-state">Запись не найдена. Проверьте запрос и выбранные фильтры.</p>';
    } catch (error) { if (search === searchNumber) results.textContent = error.message; }
  };
  const encodedQuery = location.hash.slice(1).split('/').slice(1).join('/');
  if (encodedQuery) {
    try { queryInput.value = decodeURIComponent(encodedQuery); } catch { queryInput.value = encodedQuery; }
    form.requestSubmit();
  }
}

function option(value, label = value) {
  return `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`;
}

function renderLicense(record) {
  const faction = licenses.factions.find(f => f.id === record.faction)?.name || record.faction;
  const fields = [['Фракция',faction], ['Роль',record.role], ['Лицензия',record.license], ['Период действия', `${record.issuedAt} — ${record.expiresAt}`]];
  return `<article class="result-card"><div class="result-top"><div><strong>${escapeHTML(record.nickname)}</strong><small>${escapeHTML(record.id)}</small></div>${statusBadge(record)}</div>
    <dl class="result-grid">${fields.map(([label,value]) => `<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>
    ${record.demo ? '<p class="demo-note">Демо · Эта запись не подтверждает полномочия игрока.</p>' : ''}</article>`;
}

function render() {
  const current = route();
  setNavigation(current);
  if (!documents || !licenses) return;
  if (current === 'home') homeView();
  if (current === 'rules' || current === 'criminal') docView(current);
  if (current === 'powers') powersView();
  if (current === 'verify') verifyView();
  if (current === 'admin') adminView();
  app.setAttribute('aria-busy', 'false');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function toggleMenu(open) {
  document.body.classList.toggle('menu-open', open);
  document.getElementById('scrim').hidden = !open;
  const toggle = document.getElementById('menu-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
}

async function loadPortal() {
  const response = await fetch('./api/portal', { cache: 'no-store' });
  if (response.status === 404 || (response.ok && response.headers.get('content-type')?.includes('text/html'))) {
    // Preserve public documents and seed licenses on plain static hosts.
    const load = async name => {
      const res = await fetch(`./data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw Error('Не удалось загрузить данные портала.');
      return res.json();
    };
    [documents, licenses] = await Promise.all([load('documents'), load('licenses')]);
    apiAvailable = false;
    writable = false;
    return;
  }
  if (!response.ok) throw Error('Реестр временно недоступен. Повторите попытку.');
  const data = await response.json();
  documents = data.documents;
  licenses = data.registry;
  documentVersions = data.versions || {};
  writable = data.writable;
}

async function startPortal() {
  try { await loadPortal(); render(); }
  catch {
    app.innerHTML = '<div class="empty-state">Данные портала не загрузились. <button class="text-link" id="retry">Повторить</button></div>';
    document.getElementById('retry').onclick = startPortal;
    app.setAttribute('aria-busy', 'false');
  }
}
document.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon); });
const date = new Date();
document.getElementById('portal-date').innerHTML = icon('calendar') + new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
document.getElementById('menu-toggle').onclick = () => toggleMenu(!document.body.classList.contains('menu-open'));
document.getElementById('scrim').onclick = () => toggleMenu(false);
document.getElementById('sidebar').addEventListener('click', event => { if (event.target.closest('a')) toggleMenu(false); });
document.querySelector('.skip-link').onclick = event => { event.preventDefault(); document.getElementById('main').focus(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { toggleMenu(false); document.getElementById('menu-toggle').focus(); } });
matchMedia('(min-width: 981px)').addEventListener('change', event => { if (event.matches) toggleMenu(false); });
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', startPortal);
