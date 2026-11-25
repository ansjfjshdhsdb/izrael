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
  return `<header class="page-intro"><div><a class="back-link" href="#home">На главную</a><h1>${escapeHTML(title)}</h1>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div>${detail ? `<span class="page-detail">${escapeHTML(detail)}</span>` : ''}</header>`;
}

const scenes = [
  {slug: 'boulevard', title: 'Городской бульвар'},
  {slug: 'winter', title: 'Зимняя площадь'},
  {slug: 'bridge', title: 'Ночной мост'}
];

function homeView() {
  const descriptions = [
    'Машины на стоянке у бульвара с пальмами.',
    'Полицейские машины и пожарная лестница на заснеженной площади.',
    'Освещённый мост, грузовик и высотка на ночной набережной.'
  ];
  app.innerHTML = `<section class="city-gallery" aria-label="Кадры UKR Israel" aria-roledescription="карусель">
      <div class="city-frame" data-scene="boulevard">
        ${scenes.map((scene,i) => `<img class="city-image${i === 0 ? ' selected' : ''}" src="./media/${scene.slug}.webp" alt="${descriptions[i]}" aria-hidden="${i !== 0}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`).join('')}
        <h1>UKR ISRAEL</h1>
        <img class="palm-layer" src="./media/boulevard-palms.webp" alt="">
      </div>
      <div class="gallery-foot">
        <span class="scene-title" aria-live="polite">${scenes[0].title}</span>
        <div class="scene-selector" role="group" aria-label="Выбрать кадр">${scenes.map((scene,i) => `<button type="button" aria-pressed="${i === 0}" aria-label="${scene.title}" title="${scene.title}"><img src="./media/${scene.slug}.webp" alt=""></button>`).join('')}</div>
      </div>
    </section>
    <section class="player-services" aria-label="Игрокам">
      <form id="home-lookup" class="quick-check">
        <h2><label for="home-query">Проверка<br> игрока</label></h2>
        <div class="pass-art" aria-hidden="true"><b>ISRP</b></div>
        <div class="check-field"><input id="home-query" type="search" maxlength="100" placeholder="Ник, ID или лицензия" required><button type="submit">Найти</button></div>
        <a id="attorney-link" href="#lawyers">Проверить адвоката</a>
      </form>
      <a class="doc-tile rules-tile" href="#rules">
        <small>${quantity(documents.rules.length,'раздел','раздела','разделов')}</small><strong>Правила<br> сервера</strong>
        <div class="book-art" aria-hidden="true"><b>ISRP</b></div>
      </a>
      <a class="doc-tile code-tile" href="#criminal">
        <small>${quantity(documents.criminal.length,'раздел','раздела','разделов')}</small><strong>Криминальный<br> кодекс</strong>
      </a>
      <a class="doc-tile powers-tile" href="#powers">
        <small>${quantity(documents.powers.length,'служба','службы','служб')}</small><strong>Полномочия<br> служб</strong>
      </a>
    </section>`;

  const gallery = app.querySelector('.city-gallery');
  const photos = [...gallery.querySelectorAll('.city-image')];
  const buttons = [...gallery.querySelectorAll('button')];
  let current = 0;
  function select(index) {
    current = (index + scenes.length) % scenes.length;
    gallery.querySelector('.city-frame').dataset.scene = scenes[current].slug;
    gallery.querySelector('.scene-title').textContent = scenes[current].title;
    buttons.forEach((button,i) => {
      const selected = current === i;
      button.setAttribute('aria-pressed', String(selected));
      photos[i].classList.toggle('selected', selected);
      photos[i].setAttribute('aria-hidden', String(!selected));
    });
  }
  buttons.forEach((button,i) => button.onclick = () => select(i));
  gallery.onkeydown = event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    select(current + (event.key === 'ArrowRight' ? 1 : -1));
    buttons[current].focus();
  };
  const frame = gallery.querySelector('.city-frame');
  let start = null;
  frame.onpointerdown = event => {
    if (event.isPrimary) start = [event.clientX,event.clientY];
  };
  frame.onpointercancel = () => { start = null; };
  frame.onpointerup = event => {
    if (!start) return;
    const dx = event.clientX - start[0];
    const dy = event.clientY - start[1];
    start = null;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) select(current + (dx < 0 ? 1 : -1));
  };
  const input = document.getElementById('home-query');
  const lawyerLink = document.getElementById('attorney-link');
  input.oninput = () => {
    const term = input.value.trim();
    lawyerLink.hash = term ? 'lawyers/' + encodeURIComponent(term) : 'lawyers';
  };
  document.getElementById('home-lookup').onsubmit = event => {
    event.preventDefault();
    const term = input.value.trim();
    if (term) location.hash = 'verify/' + encodeURIComponent(term);
    else input.focus();
  };
}

function docView(kind) {
  const isRules = kind === 'rules';
  const chapters = documents[kind];
  const total = chapters.reduce((sum, chapter) => sum + chapter.items.length, 0);
  app.innerHTML = `${intro(isRules ? 'Правила сервера' : 'Криминальный кодекс', isRules ? 'Нарушения и наказания по разделам.' : 'Статьи, штрафы и сроки наказаний.', `${quantity(chapters.length,'раздел','раздела','разделов')} · ${quantity(total,'пункт','пункта','пунктов')}`)}
    <div class="doc-layout"><nav class="doc-index" aria-label="Главы документа"><p>Содержание</p>${chapters.map((chapter) => `<a href="#chapter-${kind}-${chapter.number}"><span>${chapter.number}</span>${escapeHTML(chapter.title)}</a>`).join('')}</nav><div class="doc-main"><div class="mobile-chapter-picker"><select class="select" id="chapter-select" aria-label="Перейти к разделу"><option value="">Выберите раздел</option>${chapters.map(chapter => `<option value="${chapter.number}">${chapter.number}. ${escapeHTML(chapter.title)}</option>`).join('')}</select></div><div class="doc-toolbar"><label class="document-search"><input class="input" id="doc-search" type="search" placeholder="Номер или текст пункта" aria-label="Поиск по документу"></label><button class="btn btn-ghost expand-button" id="expand-all" type="button">Раскрыть все</button></div><div class="document-caption"><span id="doc-count"></span></div><div id="chapters"></div></div></div>`;
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
      return `<section class="power-row" id="service-${index}"><header class="service-heading"><h2>${escapeHTML(names[group.title] || group.title)}</h2></header><div class="service-content"><h3>Полномочия</h3><ul class="permissions-list">${allowed.map(item => `<li><span>${escapeHTML(item)}</span></li>`).join('')}</ul>${restricted.length ? `<div class="service-restrictions"><h3>Ограничения</h3>${restricted.map(item => `<p>${escapeHTML(item)}</p>`).join('')}</div>` : ''}</div></section>`;
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
  app.innerHTML = `${intro(lawyer ? 'Проверка адвоката' : 'Проверка игрока')}
    <div class="verify-layout"><section class="verify-card">
      <nav class="segmented" aria-label="Тип проверки"><a href="#verify" ${!lawyer ? 'aria-current="page"' : ''}>Все игроки</a><a href="#lawyers" ${lawyer ? 'aria-current="page"' : ''}>Адвокаты</a></nav>
      <form class="lookup-form" id="lookup-form"><label>Ник, ID или номер лицензии<input class="input" id="lookup-query" type="search" autocomplete="off" placeholder="Например, Demo_Judge" maxlength="100" required></label>
      ${lawyer ? '' : `<label>Организация<select class="select" id="lookup-faction"><option value="">Все организации</option>${licenses.factions.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.name)}</option>`).join('')}</select></label><label>Роль<select class="select" id="lookup-role"></select></label>`}
      <div class="lookup-actions"><button class="action primary" type="submit">Найти лицензию</button></div></form>
      <div id="lookup-results" class="result-wrap" aria-live="polite"></div></section>
      </div>`;
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
