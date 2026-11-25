const app = document.getElementById('app');
const routes = new Set(['home', 'rules', 'criminal', 'powers', 'verify', 'lawyers', 'admin']);
let documents = null;
let licenses = null;
let staticRegistry = false;

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
    const selected = link.dataset.routeLink === (active === 'lawyers' ? 'verify' : active);
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.getElementById('top-nav').classList.remove('open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}

function intro(title, description = '', detail = '') {
  return `<header class="page-intro"><div><a class="back-link" href="#home">ISRP <span aria-hidden="true">/</span> Главная</a><h1>${escapeHTML(title)}</h1>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div>${detail ? `<span class="page-detail">${escapeHTML(detail)}</span>` : ''}</header>`;
}

const scenes = [
  {slug: 'bridge', title: 'Ночной мост'},
  {slug: 'winter', title: 'Зимняя площадь'},
  {slug: 'boulevard', title: 'Городской бульвар'}
];

function homeView() {
  const docs = [
    {route:'rules',title:'Правила сервера',detail:quantity(documents.rules.length,'раздел','раздела','разделов'),symbol:'book'},
    {route:'criminal',title:'Криминальный кодекс',detail:quantity(documents.criminal.length,'раздел','раздела','разделов'),symbol:'scale'},
    {route:'powers',title:'Полномочия служб',detail:quantity(documents.powers.length,'служба','службы','служб'),symbol:'shield'}
  ];
  app.innerHTML = `<section class="front-grid" aria-label="Портал игрока">
      <div class="city-frame" aria-roledescription="карусель" aria-label="Кадры сервера">
        ${scenes.map((s,i) => `<img class="city-image${i === 0 ? ' selected' : ''}" src="./media/${s.slug}.webp" alt="" ${i ? '' : 'fetchpriority="high"'}>`).join('')}
        <div class="frame-caption"><span class="focus-mark" aria-hidden="true"></span><span id="scene-name" aria-live="polite">${scenes[0].title}</span></div>
        <div class="frame-foot"><h1>UKR <b>Israel</b></h1><div class="frame-controls"><button id="prev-scene" type="button" aria-label="Предыдущий кадр">←</button><span id="frame-count">01 / 03</span><button id="next-scene" type="button" aria-label="Следующий кадр">→</button></div></div>
      </div>
      <div class="registry-desk"><div class="desk-title">${icon('shield')}<a id="open-registry" href="#verify" aria-label="Открыть реестр">↗</a></div>
        <h2>Проверка игрока</h2><p>Найдите действующую лицензию или проверьте статус ранее выданной.</p>
        <form id="home-lookup"><fieldset class="desk-switch"><legend class="sr-only">Где искать</legend><label><input type="radio" name="scope" value="verify" checked><span>Все игроки</span></label><label><input type="radio" name="scope" value="lawyers"><span>Адвокаты</span></label></fieldset>
          <label class="desk-input">${icon('search')}<input id="home-query" type="search" maxlength="100" required placeholder="Ник, ID или номер лицензии" aria-label="Ник, ID или номер лицензии"></label>
          <button class="desk-submit" type="submit">Проверить ${icon('arrow')}</button></form>
      </div>
      <div class="contact-sheet" role="group" aria-label="Другие кадры сервера">${[1,2].map(i => `<button type="button" class="contact-thumb" data-scene="${i}"><img alt="" src="./media/${scenes[i].slug}.webp"><span>${scenes[i].title}</span></button>`).join('')}</div>
    </section>
    <section class="document-shelf"><h2>Правила и службы</h2><nav aria-label="Документы сервера">${docs.map(d => `<a href="#${d.route}"><span class="shelf-icon">${icon(d.symbol)}</span><span class="shelf-copy"><strong>${d.title}</strong><small>${d.detail}</small></span><span class="shelf-arrow" aria-hidden="true">↗</span></a>`).join('')}</nav></section>`;
  const frame = app.querySelector('.city-frame');
  const buttons = [...app.querySelectorAll('.contact-thumb')];
  const photos = [...frame.querySelectorAll('.city-image')];
  let current = 0;
  function select(index) {
    const next = (index + scenes.length) % scenes.length;
    const thumb = buttons.find(b => Number(b.dataset.scene) === next);
    if (!thumb) return;
    const previous = scenes[current];
    thumb.dataset.scene = current;
    thumb.querySelector('img').src = './media/' + previous.slug + '.webp';
    thumb.querySelector('span').textContent = previous.title;
    current = next;
    photos.forEach((photo,i) => photo.classList.toggle('selected',i === current));
    document.getElementById('frame-count').textContent = `0${current + 1} / 03`;
    document.getElementById('scene-name').textContent = scenes[current].title;
  }
  buttons.forEach(button => button.onclick = () => select(Number(button.dataset.scene)));
  document.getElementById('prev-scene').onclick = () => select(current - 1);
  document.getElementById('next-scene').onclick = () => select(current + 1);
  frame.onkeydown = e => {
    if (!['ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault(); select(current + (e.key === 'ArrowRight' ? 1 : -1));
  };
  let start = null;
  frame.onpointerdown = e => { if (e.isPrimary && !e.target.closest('button')) start = [e.clientX,e.clientY]; };
  frame.onpointercancel = () => { start = null; };
  frame.onpointerup = e => {
    if (!start) return;
    const dx = e.clientX - start[0], dy = e.clientY - start[1]; start = null;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)*1.4) select(current + (dx < 0 ? 1 : -1));
  };
  const form = document.getElementById('home-lookup');
  const input = document.getElementById('home-query');
  form.onchange = () => { document.getElementById('open-registry').href = '#' + form.elements.scope.value; };
  form.onsubmit = event => {
    event.preventDefault();
    const query = input.value.trim();
    if (query) location.hash = form.elements.scope.value + '/' + encodeURIComponent(query);
    else input.focus();
  };
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

async function readRegistry(initial = false) {
  if (staticRegistry) return licenses;
  const response = await fetch('./api/registry', {cache:'no-store'});
  if (initial && [404,405].includes(response.status)) {
    const seed = await fetch('./data/licenses.json');
    if (!seed.ok) throw Error();
    const data = await seed.json();
    staticRegistry = true;
    return data;
  }
  if (!response.ok) throw Error();
  return response.json();
}

function verifyView() {
  const lawyer = route() === 'lawyers';
  app.innerHTML = `${intro(lawyer ? 'Проверка адвоката' : 'Проверка игрока', lawyer ? 'Проверьте срок действия адвокатской лицензии игрока.' : 'Найдите лицензию по нику, ID записи или номеру документа.')}
    <div class="verify-layout"><section class="verify-card">
      <nav class="segmented" aria-label="Тип проверки"><a href="#verify" ${!lawyer ? 'aria-current="page"' : ''}>Все игроки</a><a href="#lawyers" ${lawyer ? 'aria-current="page"' : ''}>Адвокаты</a></nav>
      <form class="lookup-form" id="lookup-form"><label>Ник, ID или номер лицензии<input class="input" id="lookup-query" type="search" autocomplete="off" placeholder="Введите данные игрока" maxlength="100" required></label>
      ${lawyer ? '' : `<label>Организация<select class="select" id="lookup-faction"><option value="">Все организации</option>${licenses.factions.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.name)}</option>`).join('')}</select></label><label>Роль<select class="select" id="lookup-role"></select></label>`}
      <div class="lookup-actions"><button class="action primary" type="submit">${icon('search')} Найти лицензию</button></div></form>
      <div id="lookup-results" class="result-wrap" aria-live="polite"></div></section>
      <aside class="verify-help"><h2>${lawyer ? 'Адвокатская лицензия' : 'Как читать результат'}</h2><p>${lawyer ? 'Поиск в этой вкладке ограничен записями адвокатуры.' : 'В карточке указаны организация, роль игрока, номер лицензии и срок её действия.'}</p><p>${escapeHTML(licenses.notice)}</p>${lawyer ? '' : '<a class="text-link" href="#lawyers">Проверить адвоката ↗</a>'}</aside></div>`;
  const faction = document.getElementById('lookup-faction');
  const role = document.getElementById('lookup-role');
  const query = document.getElementById('lookup-query');
  const results = document.getElementById('lookup-results');
  const form = document.getElementById('lookup-form');
  function updateRoles() {
    if (!role) return;
    const available = licenses.factions.filter(f => !faction.value || f.id === faction.value);
    role.innerHTML = '<option value="">Все роли</option>' + [...new Set(available.flatMap(f => f.roles))].map(r => `<option>${escapeHTML(r)}</option>`).join('');
  }
  let requestId = 0;
  form.addEventListener('input', () => { requestId++; results.replaceChildren(); });
  faction?.addEventListener('change', updateRoles);
  updateRoles();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const term = normalize(query.value);
    if (!term) { query.focus(); return; }
    const current = ++requestId;
    results.textContent = 'Ищем лицензию…';
    try {
      const data = await readRegistry();
      if (requestId !== current || !results.isConnected) return;
      licenses = data;
      const organization = lawyer ? 'bar' : faction.value;
      const matches = data.records.filter(r =>
        [r.id, r.nickname, r.license].some(v => normalize(v).includes(term)) &&
        (!organization || r.faction === organization) && (!role?.value || r.role === role.value));
      results.innerHTML = matches.length ? `<h2 class="result-title">${quantity(matches.length,'запись','записи','записей')}</h2>${matches.map(renderLicense).join('')}` : '<p class="empty-state">Запись не найдена. Проверьте запрос и выбранные фильтры.</p>';
    } catch {
      if (current === requestId) results.textContent = 'Не удалось проверить реестр. Попробуйте ещё раз.';
    }
  });
  const encoded = location.hash.split('/').slice(1).join('/');
  if (encoded) {
    try { query.value = decodeURIComponent(encoded); } catch { query.value = encoded; }
    form.requestSubmit();
  }
}

function licenseState(record) {
  const today = new Date().toISOString().slice(0,10);
  if (record.status === 'revoked') return ['revoked', 'Аннулирована'];
  if (record.status === 'expired' || record.expiresAt < today) return ['expired', 'Срок истёк'];
  if (record.issuedAt > today) return ['pending', 'Ещё не действует'];
  return ['active', 'Действует'];
}

function renderLicense(record) {
  const faction = licenses.factions.find((item) => item.id === record.faction)?.name || record.faction;
  const [stateClass,status] = licenseState(record);
  return `<article class="result-card"><div class="result-top"><div><strong>${escapeHTML(record.nickname)}</strong><small>${escapeHTML(record.id)}</small></div><span class="license-status ${stateClass}">${record.demo ? 'Демо · ' : ''}${status}</span></div><div class="result-grid"><div><span>Фракция</span><strong>${escapeHTML(faction)}</strong></div><div><span>Роль</span><strong>${escapeHTML(record.role)}</strong></div><div><span>Лицензия</span><strong>${escapeHTML(record.license)}</strong></div><div><span>Срок действия</span><strong>${escapeHTML(record.issuedAt)} – ${escapeHTML(record.expiresAt)}</strong></div></div>${record.demo ? '<p class="demo-note">Демонстрационная запись. Не подтверждает полномочия реального игрока.</p>' : ''}</article>`;
}

function render() {
  const current = route();
  document.body.dataset.page = current;
  setNavigation(current);
  if (!documents || !licenses) return;
  if (current === 'home') homeView();
  if (current === 'rules' || current === 'criminal') docView(current);
  if (current === 'powers') powersView();
  if (current === 'verify' || current === 'lawyers') verifyView();
  if (current === 'admin') adminView();
  window.scrollTo({top: 0, behavior: 'auto'});
}

document.getElementById('menu-toggle').addEventListener('click', () => {
  const menu = document.getElementById('top-nav');
  const open = menu.classList.toggle('open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  document.getElementById('main').focus();
});
window.addEventListener('hashchange', render);

Promise.all([
  fetch('./data/documents.json').then((response) => { if (!response.ok) throw Error('documents'); return response.json(); }),
  readRegistry(true)
]).then(([docs, registry]) => { documents = docs; licenses = registry; render(); }).catch(() => {
  app.innerHTML = '<div class="empty-state">Данные не загрузились. Откройте сайт через локальный сервер или статический хостинг.</div>';
});
