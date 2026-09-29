const app = document.getElementById('app');
const routes = new Set(['home', 'rules', 'criminal', 'powers', 'verify']);
let documents = null;
let licenses = null;

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
const quantity = (number, one, few, many) => {
  const lastTwo = number % 100;
  const last = number % 10;
  return `${number} ${lastTwo >= 11 && lastTwo <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many}`;
};
const icons = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z"/><path d="M8 7h8M8 11h6"/>',
  scale: '<path d="M12 3v17M5 20h14M4 7h16M6 7l-4 7h8L6 7ZM18 7l-4 7h8l-4-7Z"/>',
  shield: '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
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
  document.getElementById('top-nav').classList.remove('open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}

function intro(title, description = '', detail = '') {
  return `<header class="page-intro"><div><a class="back-link" href="#home">ISRP <span aria-hidden="true">/</span> Документы проекта</a><h1>${escapeHTML(title)}</h1>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div>${detail ? `<span class="page-detail">${escapeHTML(detail)}</span>` : ''}</header>`;
}

function homeView() {
  const links = [
    ['Правила сервера', 'Поведение игроков, ролевая игра и наказания.', `${documents.rules.length} раздел`, 'rules', 'book'],
    ['Криминальный кодекс', 'Состав преступлений, штрафы и сроки.', `${documents.criminal.length} разделов`, 'criminal', 'scale'],
    ['Полномочия служб', 'Что разрешено сотрудникам каждой фракции.', `${documents.powers.length} служб`, 'powers', 'shield']
  ];
  app.innerHTML = `<section class="home-heading"><div class="home-identity"><span class="home-region">UKR Israel</span><h1>ISRP</h1><p>Документы и реестр сотрудников</p></div><div class="home-emblem" aria-hidden="true"><span>✡</span><small>UKR / ISRAEL</small></div></section>
    <div class="home-layout"><section class="home-documents"><h2 class="section-heading">Документы проекта</h2><nav class="directory" aria-label="Документы проекта">${links.map(([title,description,detail,target,symbol]) => `<a class="directory-row" href="#${target}"><span class="directory-symbol">${icon(symbol)}</span><span class="directory-copy"><strong>${title}</strong><span>${description}</span></span><span class="directory-detail">${detail}</span>${icon('arrow')}</a>`).join('')}</nav></section>
    <section class="home-registry"><div class="registry-symbol">${icon('person')}</div><h2>Проверка игрока</h2><p>Найдите сотрудника по нику, ID или номеру лицензии.</p><form id="home-lookup"><label for="home-query">Ник, ID или лицензия</label><input class="input" id="home-query" placeholder="Введите данные игрока" required><button class="btn" type="submit">Проверить ${icon('arrow')}</button></form><span class="registry-demo">Реестр содержит тестовые записи</span></section></div>`;
  document.getElementById('home-lookup').addEventListener('submit',event => {
    event.preventDefault();
    const query = document.getElementById('home-query').value.trim();
    if (query) location.hash = `verify/${encodeURIComponent(query)}`;
  });
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
    target.scrollIntoView({behavior: 'smooth', block: 'start'});
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
    document.querySelector(link.getAttribute('href')).scrollIntoView({block:'start',behavior:'smooth'});
    document.querySelectorAll('.service-nav a').forEach(item => item.classList.toggle('selected', item === link));
  });
}

function verifyView() {
  app.innerHTML = `${intro('Проверка игрока', 'Поиск по нику, ID или номеру лицензии.', 'Реестр сотрудников')}
    <div class="verify-layout"><section class="verify-card"><div class="verify-form-heading">${icon('search')}<div><h2>Поиск в реестре</h2><p>Введите данные сотрудника для проверки лицензии.</p></div></div>
      <form class="lookup-form" id="lookup-form"><label>Ник, ID или номер лицензии<input class="input" id="lookup-query" type="search" autocomplete="off" placeholder="Например, ISRP-DEMO-001" required></label><label>Фракция<select class="select" id="lookup-faction"><option value="">Все фракции</option>${licenses.factions.map((f) => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.name)}</option>`).join('')}</select></label><label>Роль<select class="select" id="lookup-role"><option value="">Все роли</option></select></label><div class="lookup-actions"><button class="btn" type="submit">Найти</button></div></form>
      <div id="lookup-results" class="result-wrap" aria-live="polite"></div></section>
      <aside class="verify-help"><h2>Фракции в реестре</h2><ul class="registry-factions">${licenses.factions.map(f=>`<li>${icon('shield')}<span>${escapeHTML(f.name)}</span></li>`).join('')}</ul><p class="registry-notice">${escapeHTML(licenses.notice)}</p></aside></div>`;
  const factionSelect = document.getElementById('lookup-faction');
  const roleSelect = document.getElementById('lookup-role');
  function updateRoles() {
    const selected = factionSelect.value;
    const available = selected ? licenses.factions.filter((f) => f.id === selected) : licenses.factions;
    const roles = [...new Set(available.flatMap((f) => f.roles))];
    roleSelect.innerHTML = '<option value="">Все роли</option>' + roles.map((role) => `<option value="${escapeHTML(role)}">${escapeHTML(role)}</option>`).join('');
  }
  factionSelect.addEventListener('change', updateRoles);
  updateRoles();
  document.getElementById('lookup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = normalize(document.getElementById('lookup-query').value);
    if (!query) return;
    const faction = factionSelect.value;
    const role = roleSelect.value;
    const matches = licenses.records.filter((record) => [record.id,record.nickname,record.license].some((value) => normalize(value).includes(query)) && (!faction || record.faction === faction) && (!role || record.role === role));
    const results = document.getElementById('lookup-results');
    results.innerHTML = matches.length ? `<h2 class="result-title">Найдено: ${matches.length}</h2>${matches.map(renderLicense).join('')}` : '<p class="empty-state">Запись не найдена. Проверьте запрос и фильтры.</p>';
  });
  const encodedQuery = location.hash.slice(1).split('/').slice(1).join('/');
  if (encodedQuery) {
    let query = encodedQuery;
    try { query = decodeURIComponent(encodedQuery); } catch {}
    document.getElementById('lookup-query').value = query;
    document.getElementById('lookup-form').requestSubmit();
  }
}

function renderLicense(record) {
  const faction = licenses.factions.find((item) => item.id === record.faction)?.name || record.faction;
  const expired = record.status === 'expired' || (record.expiresAt && record.expiresAt < new Date().toISOString().slice(0,10));
  const status = record.status === 'revoked' ? 'Аннулирована' : expired ? 'Срок истёк' : record.demo ? 'Тестовая запись' : 'Действует';
  const stateClass = record.status === 'revoked' ? 'revoked' : expired ? 'expired' : '';
  return `<article class="result-card"><div class="result-top"><div><strong>${escapeHTML(record.nickname)}</strong><small>${escapeHTML(record.id)}</small></div><span class="license-status ${stateClass}">${status}</span></div><div class="result-grid"><div><span>Фракция</span><strong>${escapeHTML(faction)}</strong></div><div><span>Роль</span><strong>${escapeHTML(record.role)}</strong></div><div><span>Лицензия</span><strong>${escapeHTML(record.license)}</strong></div><div><span>Срок действия</span><strong>${escapeHTML(record.issuedAt)} – ${escapeHTML(record.expiresAt)}</strong></div></div>${record.demo ? '<p class="demo-note">Демонстрационная запись. Не подтверждает полномочия реального игрока.</p>' : ''}</article>`;
}

function render() {
  const current = route();
  setNavigation(current);
  if (!documents || !licenses) return;
  if (current === 'home') homeView();
  if (current === 'rules' || current === 'criminal') docView(current);
  if (current === 'powers') powersView();
  if (current === 'verify') verifyView();
  window.scrollTo({top: 0, behavior: 'auto'});
}

document.getElementById('menu-toggle').addEventListener('click', () => {
  const menu = document.getElementById('top-nav');
  const open = menu.classList.toggle('open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
});
window.addEventListener('hashchange', render);

Promise.all([
  fetch('./data/documents.json').then((response) => { if (!response.ok) throw Error('documents'); return response.json(); }),
  fetch('./data/licenses.json').then((response) => { if (!response.ok) throw Error('licenses'); return response.json(); })
]).then(([docs, registry]) => { documents = docs; licenses = registry; render(); }).catch(() => {
  app.innerHTML = '<div class="empty-state">Данные не загрузились. Откройте сайт через локальный сервер или статический хостинг.</div>';
});

