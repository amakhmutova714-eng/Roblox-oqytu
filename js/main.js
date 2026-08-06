let DATA = null;
let currentLessonIndex = 0;
let allLessons = [];
const DONE_KEY = 'roblox_done_lessons';

function getDone() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY)) || []; } catch { return []; }
}
function setDone(id)   { const d = getDone(); if (!d.includes(id)) d.push(id); localStorage.setItem(DONE_KEY, JSON.stringify(d)); }
function unsetDone(id) { localStorage.setItem(DONE_KEY, JSON.stringify(getDone().filter(x => x !== id))); }

function icon(name, extra = '') {
  return `<svg data-lucide="${name}" ${extra}></svg>`;
}

async function loadData() {
  const res = await fetch('content/sabaqtar.json');
  DATA = await res.json();
  init();
}

function init() {
  buildNav();
  buildHero();
  buildStats();
  buildChapters();
  buildStudentGames();
  buildTestimonials(); // async, runs independently
  buildFAQ();
  buildLessonsPage();
  buildReference();
  buildAbout();
  buildFooter();

  allLessons = DATA.chapters.flatMap(ch =>
    ch.lessons.map(l => ({ ...l, chapterTitle: ch.title, chapterIcon: ch.icon }))
  );

  const hash = location.hash.replace('#', '');
  if (hash === 'sabaqtar') showPage('sabaqtar');
  else if (hash === 'aniqtama') showPage('aniqtama');
  else if (hash === 'turaly') showPage('turaly');
  else showPage('bas');

  lucide.createIcons();
}

/* ── NAV ─────────────────────────────────── */
function buildNav() {
  const n = DATA.site.nav;
  document.getElementById('nav-logo-text').textContent = DATA.site.title;
  document.getElementById('nav-home').innerHTML    = `${icon('home')} <span>${n.home}</span>`;
  document.getElementById('nav-lessons').innerHTML = `${icon('book-open')} <span>${n.lessons}</span>`;
  document.getElementById('nav-ref').innerHTML     = `${icon('zap')} <span>${n.reference}</span>`;
  document.getElementById('nav-about').innerHTML   = `${icon('info')} <span>${n.about}</span>`;
}

/* ── HERO ────────────────────────────────── */
function buildHero() {
  document.getElementById('hero-title').textContent = DATA.site.subtitle;
  document.getElementById('hero-desc').textContent  = DATA.site.description;
  document.getElementById('hero-cta').innerHTML     = `${icon('play')} ${DATA.site.cta}`;
}

/* ── STATS ───────────────────────────────── */
function buildStats() {
  document.getElementById('stats-wrap').innerHTML = DATA.stats.map(s => `
    <div class="stat-item">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

/* ── STUDENT GAMES ───────────────────────── */
function buildStudentGames() {
  const games = DATA.studentGames;
  const grid = document.getElementById('student-games-grid');
  if (!games || games.length === 0) {
    grid.innerHTML = `
      <div class="sg-empty">
        <div class="sg-empty-icon">${icon('gamepad-2', 'style="width:40px;height:40px;color:var(--accent);opacity:0.5"')}</div>
        <div class="sg-empty-title">Бірінші болғың келе ме?</div>
        <div class="sg-empty-sub">Курсты аяқтаған бірінші оқушының ойыны осында жарияланады</div>
      </div>`;
    return;
  }
  grid.innerHTML = games.map(g => `
    <a class="sg-card ${g.isSlot ? 'sg-slot' : ''}" href="${g.link}" target="${g.link === '#' ? '_self' : '_blank'}">
      <div class="sg-thumb" style="background: linear-gradient(135deg, ${g.color}22, ${g.color}11);">
        <span>${g.emoji}</span>
        ${!g.isSlot ? `<div class="sg-play-btn">${icon('play')} Ойна</div>` : ''}
      </div>
      <div class="sg-info">
        <div class="sg-title">${g.title}</div>
        <div class="sg-author">${g.isSlot ? '' : '✦ ' + g.author}</div>
        <div class="sg-desc">${g.desc}</div>
      </div>
    </a>`).join('');
}

/* ── CHAPTERS ────────────────────────────── */
function buildChapters() {
  document.getElementById('chapters-grid').innerHTML = DATA.chapters.map(ch => `
    <a class="chapter-card" href="#sabaqtar" onclick="goToChapter('${ch.id}'); return false;">
      <div class="chapter-card-icon">${icon(ch.icon)}</div>
      <div class="chapter-number">${ch.number}-бөлім</div>
      <div class="chapter-title">${ch.title}</div>
      <div class="chapter-desc">${ch.description}</div>
      <div class="chapter-count">${icon('chevron-right')} ${ch.lessons.length} сабақ</div>
    </a>`).join('');
}

/* ── LESSONS SIDEBAR ─────────────────────── */
function buildLessonsPage() {
  const done = getDone();
  document.getElementById('sidebar').innerHTML = DATA.chapters.map((ch, ci) => `
    <div class="sidebar-chapter">
      <div class="sidebar-chapter-header ${ci === 0 ? 'open' : ''}" onclick="toggleChapter(this)">
        ${icon(ch.icon)}
        <span>${ch.number}. ${ch.title}</span>
        <span class="sidebar-ch-arrow">${icon('chevron-right')}</span>
      </div>
      <div class="sidebar-lessons ${ci === 0 ? 'open' : ''}">
        ${ch.lessons.map((l, li) => `
          <button class="sidebar-lesson-link ${done.includes(l.id) ? 'done' : ''}"
            onclick="showLesson(${ci}, ${li})"
            data-ci="${ci}" data-li="${li}" data-id="${l.id}">
            ${l.id}. ${l.title}
            <span class="lesson-done-icon">${icon('check-circle-2')}</span>
          </button>`).join('')}
      </div>
    </div>`).join('');
}

/* ── REFERENCE ───────────────────────────── */
function buildReference() {
  const ref = DATA.reference;

  document.getElementById('ref-title').textContent = 'Анықтама';
  document.getElementById('ref-sub').textContent   = 'Код, шаблон, AI промпт — барлығы осында';

  // Tab buttons (+ Code Request + Graduation Pack)
  document.getElementById('ref-tabs-bar').innerHTML = ref.tabs.map((tab, i) => `
    <button class="ref-tab-btn ${i === 0 ? 'active' : ''}"
      onclick="showRefTab('${tab.id}', this)">
      ${icon(tab.icon)} ${tab.title}
    </button>`).join('') + `
    <button class="ref-tab-btn ref-tab-req" onclick="showRefTab('code-req', this)">
      ${icon('send')} Код сұрау
    </button>
    <button class="ref-tab-btn ref-tab-grad" onclick="showRefTab('grad', this)">
      ${icon('lock-keyhole')} Graduation Pack
    </button>`;

  // Code request form
  document.getElementById('code-req-wrap').innerHTML = `
    <div class="code-req-wrap">
      <div class="code-req-header">
        <div class="code-req-icon">${icon('send')}</div>
        <h2>Код сұрау</h2>
        <p>Не жасау керегін жаз — Albina саған Lua кодын жазып береді</p>
      </div>
      <div class="code-req-form">
        <div class="form-group">
          <label for="req-name">Атың</label>
          <input type="text" id="req-name" placeholder="Айдар" autocomplete="off" />
        </div>
        <div class="form-group">
          <label for="req-title">Не код керек?</label>
          <input type="text" id="req-title" placeholder="Kill brick + respawn скрипт" autocomplete="off" />
        </div>
        <div class="form-group">
          <label for="req-desc">Сипаттама</label>
          <textarea id="req-desc" rows="4" placeholder="Ойыншы тиген кезде өліп, 3 секундта respawn болсын..."></textarea>
        </div>
        <button class="code-req-btn" onclick="submitCodeRequest()">
          ${icon('send')} WhatsApp арқылы жіберу
        </button>
      </div>
      <div class="code-req-note">
        ${icon('clock')} Сұрауды алғаннан кейін Albina 24 сағат ішінде жауап береді
      </div>
    </div>`;

  // Ready scripts
  const rTab = ref.tabs.find(t => t.id === 'ready');
  document.getElementById('scripts-grid').innerHTML = rTab.scripts.map(s => `
    <div class="script-card">
      <div class="script-card-header">
        <div class="script-num">${s.number}</div>
        <div class="script-card-title">${s.title}</div>
        <div class="script-card-where">${s.where}</div>
      </div>
      <div class="script-card-desc">${s.desc}</div>
      <div class="code-block-wrap">
        <div class="code-block-header">
          <span class="code-lang-tag">${icon('terminal')} Lua</span>
          <button class="copy-btn" onclick="copyCode(this)">${icon('copy')} Көшіру</button>
        </div>
        <pre><code class="language-lua">${escHtml(s.code)}</code></pre>
      </div>
    </div>`).join('');


  // AI prompts
  const aTab = ref.tabs.find(t => t.id === 'ai');
  document.getElementById('prompts-grid').innerHTML = aTab.prompts.map(p => `
    <div class="prompt-card">
      <div class="prompt-card-header">
        <div class="prompt-title">${p.title}</div>
        <div class="prompt-tag">${p.tag}</div>
      </div>
      <div class="prompt-text">"${p.text}"</div>
      <button class="prompt-copy-btn" onclick="copyPrompt(this, ${JSON.stringify(p.text)})">
        ${icon('copy')} Промпты көшіру
      </button>
    </div>`).join('');

  // Graduation Pack (blurred preview)
  const gp = DATA.graduationPack;
  document.getElementById('grad-scripts-grid').innerHTML = gp.scripts.map(s => `
    <div class="script-card">
      <div class="script-card-header">
        <div class="script-num grad-num">${s.number}</div>
        <div class="script-card-title">${s.title}</div>
        <div class="script-card-where">${s.where}</div>
      </div>
      <div class="script-card-desc">${s.desc}</div>
      <div class="code-block-wrap">
        <div class="code-block-header">
          <span class="code-lang-tag">${icon('terminal')} Lua</span>
          <button class="copy-btn">${icon('lock')} Жабық</button>
        </div>
        <pre><code class="language-lua">${escHtml(s.code)}</code></pre>
      </div>
    </div>`).join('');

  // Highlight after render
  setTimeout(() => { if (window.Prism) Prism.highlightAll(); }, 100);
}

function showRefTab(id, btn) {
  document.querySelectorAll('.ref-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.ref-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ref-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  lucide.createIcons();
}

/* ── TESTIMONIALS ────────────────────────── */
let reviewsData = [];
let selectedStars = 5;

function starsHTML(count, interactive = false) {
  return Array.from({length: 5}, (_, i) => {
    if (interactive) {
      return `<svg data-lucide="star" class="star-icon ${i < count ? 'star-filled' : 'star-empty'} review-star" data-star="${i + 1}" style="cursor:pointer;width:22px;height:22px;"></svg>`;
    }
    return `<svg data-lucide="star" class="star-icon ${i < count ? 'star-filled' : 'star-empty'}"></svg>`;
  }).join('');
}

function renderReviews() {
  const el = document.getElementById('reviews-list');
  if (!el) return;
  if (reviewsData.length === 0) {
    el.innerHTML = `
      <div class="testi-empty">
        <div class="testi-empty-icon">${icon('star', 'style="width:36px;height:36px;color:#fbbf24;opacity:0.7"')}</div>
        <div class="testi-empty-title">Бірінші пікір сенікі болсын!</div>
      </div>`;
    return;
  }
  el.innerHTML = `<div class="testi-grid">${reviewsData.map(t => `
    <div class="testi-card">
      <div class="testi-stars">${starsHTML(t.stars)}</div>
      <div class="testi-text">"${escHtml(t.text)}"</div>
      <div class="testi-author">— ${escHtml(t.author)}</div>
    </div>`).join('')}</div>`;
  lucide.createIcons();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function buildTestimonials() {
  const el = document.getElementById('testimonials-grid');
  el.innerHTML = `
    <div id="reviews-list"></div>
    <div class="review-form-wrap">
      <div class="review-form-header">
        <div class="review-form-icon">✍️</div>
        <div class="review-form-title">Өз пікіріңді жаз</div>
        <p class="review-form-sub">Сенің пікірің басқа оқушыларға көмектеседі</p>
      </div>
      <form id="review-form" class="review-form" onsubmit="submitReview(event)">
        <div class="review-form-field">
          <label>Атың</label>
          <input id="review-author" type="text" placeholder="Мысалы: Amir, 13 жас" maxlength="60" required />
        </div>
        <div class="review-form-field">
          <label>Баға</label>
          <div id="review-stars-picker" class="review-stars-picker">${starsHTML(5, true)}</div>
        </div>
        <div class="review-form-field">
          <label>Пікірің</label>
          <textarea id="review-text" placeholder="Курс туралы не ойлайсың?..." maxlength="500" minlength="10" rows="4" required></textarea>
          <div class="review-char-count"><span id="review-char">0</span>/500</div>
        </div>
        <button type="submit" class="review-submit-btn">✦ Пікір жіберу</button>
        <div id="review-msg" class="review-msg"></div>
      </form>
    </div>`;

  lucide.createIcons();
  initStarPicker();

  try {
    const res = await fetch('/api/reviews');
    if (res.ok) reviewsData = await res.json();
  } catch {}
  renderReviews();

  document.getElementById('review-text').addEventListener('input', function() {
    document.getElementById('review-char').textContent = this.value.length;
  });
}

function initStarPicker() {
  selectedStars = 5;
  const picker = document.getElementById('review-stars-picker');
  if (!picker) return;
  picker.addEventListener('mouseover', e => {
    const star = e.target.closest('.review-star');
    if (!star) return;
    const n = parseInt(star.dataset.star);
    picker.querySelectorAll('.review-star').forEach((s, i) => {
      s.classList.toggle('star-filled', i < n);
      s.classList.toggle('star-empty', i >= n);
    });
  });
  picker.addEventListener('mouseleave', () => {
    picker.querySelectorAll('.review-star').forEach((s, i) => {
      s.classList.toggle('star-filled', i < selectedStars);
      s.classList.toggle('star-empty', i >= selectedStars);
    });
  });
  picker.addEventListener('click', e => {
    const star = e.target.closest('.review-star');
    if (!star) return;
    selectedStars = parseInt(star.dataset.star);
  });
}

async function submitReview(e) {
  e.preventDefault();
  const author = document.getElementById('review-author').value.trim();
  const text   = document.getElementById('review-text').value.trim();
  const msg    = document.getElementById('review-msg');
  const btn    = document.querySelector('.review-submit-btn');

  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Жіберілуде...';

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, stars: selectedStars, text })
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || 'Қате орын алды';
      msg.className = 'review-msg error';
    } else {
      reviewsData.unshift(data);
      renderReviews();
      document.getElementById('review-form').reset();
      document.getElementById('review-char').textContent = '0';
      selectedStars = 5;
      initStarPicker();
      msg.textContent = 'Пікіріңіз жарияланды! Рахмет!';
      msg.className = 'review-msg success';
    }
  } catch {
    msg.textContent = 'Байланыс қатесі. Қайталап көр.';
    msg.className = 'review-msg error';
  }
  btn.disabled = false;
  btn.textContent = 'Пікір жіберу';
}

/* ── FAQ ─────────────────────────────────── */
function buildFAQ() {
  document.getElementById('faq-list').innerHTML = DATA.faq.map((item, i) => `
    <div class="faq-item" id="faq-${i}">
      <div class="faq-q" onclick="toggleFAQ(${i})">
        <span>${item.q}</span>
        ${icon('plus')}
      </div>
      <div class="faq-a">${item.a}</div>
    </div>`).join('');
}

function toggleFAQ(i) {
  const el = document.getElementById('faq-' + i);
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
  lucide.createIcons();
}

/* ── ABOUT / FOOTER ──────────────────────── */
function buildAbout() {
  const d = DATA.about;
  document.getElementById('about-text').textContent        = d.text;
  document.getElementById('about-author-name').textContent = d.author;
  document.getElementById('about-author-role').textContent = d.authorRole;

  document.getElementById('about-socials').innerHTML = d.socials.map(s => `
    <a class="social-btn" href="${s.url}" target="_blank" style="--sc:${s.color}">
      ${icon(s.icon)}
      <div class="social-btn-info">
        <span class="social-btn-label">${s.label}</span>
        <span class="social-btn-handle">${s.handle}</span>
      </div>
    </a>`).join('');
}
function buildFooter() {
  document.getElementById('footer-title').textContent = DATA.site.title;
}

/* ── PAGE NAV ────────────────────────────── */
function showPage(id) {
  if (id === 'sabaqtar' && !isLoggedIn()) {
    openAuthModal('login', true);
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const map = { bas: 'nav-home', sabaqtar: 'nav-lessons', aniqtama: 'nav-ref', turaly: 'nav-about' };
  const el = document.getElementById(map[id]);
  if (el) el.classList.add('active');
  if (id !== 'admin') location.hash = id === 'bas' ? '' : id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'admin') adminInitPage();
  lucide.createIcons();
}

function toggleChapter(el) {
  el.classList.toggle('open');
  el.nextElementSibling.classList.toggle('open');
  lucide.createIcons();
}

function goToChapter(chId) {
  showPage('sabaqtar');
  const ci = DATA.chapters.findIndex(ch => ch.id === chId);
  if (ci < 0) return;
  document.querySelectorAll('.sidebar-chapter-header')[ci].classList.add('open');
  document.querySelectorAll('.sidebar-lessons')[ci].classList.add('open');
  showLesson(ci, 0);
  lucide.createIcons();
}

/* ── TRACK LESSON VISIT ──────────────────── */
function trackLessonVisit(lessonId, lessonTitle) {
  const token = getAuthToken();
  if (!token) return;
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ lessonId, lessonTitle })
  }).catch(() => {});
}

/* ── SHOW LESSON ─────────────────────────── */
function showLesson(ci, li) {
  const chapter = DATA.chapters[ci];
  const lesson  = chapter.lessons[li];

  currentLessonIndex = DATA.chapters.slice(0, ci).reduce((s, c) => s + c.lessons.length, 0) + li;

  document.querySelectorAll('.sidebar-lesson-link').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-ci="${ci}"][data-li="${li}"]`);
  if (btn) btn.classList.add('active');

  document.getElementById('lesson-placeholder').style.display = 'none';
  const view = document.getElementById('lesson-view');
  view.style.display = 'block';

  document.getElementById('lv-badge').innerHTML  = `${icon(chapter.icon)} ${chapter.title}`;
  document.getElementById('lv-duration').innerHTML = `${icon('clock')} ${lesson.duration}`;
  document.getElementById('lv-title').textContent = lesson.title;
  document.getElementById('lv-desc').textContent  = lesson.description;

  // Video
  const vw = document.getElementById('lv-video');
  const isFreeLesson = lesson.id === '01';
  const canWatch     = isFreeLesson || isPremium();
  if (!canWatch) {
    vw.innerHTML = `
      <div class="video-locked">
        <div class="vl-icon">${icon('lock-keyhole', 'style="width:48px;height:48px;"')}</div>
        <div class="vl-title">Бұл видео тек Premium оқушыларға</div>
        <div class="vl-desc">Барлық 15 сабақтың видеосын көру үшін толық нұсқаны сатып ал</div>
        <div class="vl-price">3 490 ₸ <span>— бір рет төлем, мәңгілік</span></div>
        <a href="https://wa.me/77052506772?text=Сәлем!%20Roblox%20Studio%20курсын%20сатып%20алғым%20келеді%20(3%20490%20₸)"
           target="_blank" class="vl-btn">
          ${icon('message-circle')} WhatsApp арқылы сатып алу
        </a>
      </div>`;
  } else if (lesson.videoId && !lesson.videoId.startsWith('PLACEHOLDER')) {
    vw.innerHTML = `<iframe src="https://www.youtube.com/embed/${lesson.videoId}" allowfullscreen loading="lazy"></iframe>`;
  } else {
    vw.innerHTML = `<div class="video-placeholder"><div class="play-circle">${icon('play')}</div><span>Видео жақында қосылады</span></div>`;
  }

  // Steps
  document.getElementById('lv-steps').innerHTML = `
    <div class="steps-block">
      <div class="block-label">${icon('list-ordered')} Қадамдар</div>
      <ol class="steps-list">${lesson.steps.map(s => `<li>${s}</li>`).join('')}</ol>
    </div>`;

  // Code
  const codeEl = document.getElementById('lv-code');
  if (lesson.code) {
    codeEl.innerHTML = `
      <div class="code-block-wrap">
        <div class="code-block-header">
          <span class="code-lang-tag">${icon('terminal')} Lua</span>
          <button class="copy-btn" onclick="copyCode(this)">${icon('copy')} Көшіру</button>
        </div>
        <pre><code class="language-lua">${escHtml(lesson.code)}</code></pre>
      </div>`;
    if (window.Prism) Prism.highlightAllUnder(codeEl);
  } else {
    codeEl.innerHTML = '';
  }

  // Tips
  document.getElementById('lv-tips').innerHTML = `
    <div class="tips-block">
      <div class="block-label">${icon('lightbulb')} Кеңестер</div>
      <ul class="tips-list">${lesson.tips.map(t => `<li>${icon('lightbulb')} ${t}</li>`).join('')}</ul>
    </div>`;

  // Done
  const isDone = getDone().includes(lesson.id);
  document.getElementById('lv-done').innerHTML = `
    <button class="done-btn ${isDone ? 'marked' : ''}" onclick="toggleDone('${lesson.id}', this)">
      ${icon('check-circle-2')} ${isDone ? 'Орындалды ✓' : 'Орындалды деп белгіле'}
    </button>`;

  document.getElementById('btn-prev').disabled = currentLessonIndex === 0;
  document.getElementById('btn-next').disabled = currentLessonIndex === allLessons.length - 1;

  trackLessonVisit(lesson.id, lesson.title);
  updateProgress();
  // мобильде сабақ таңдалғанда жоғарыға scroll (lesson area жоғарыда)
  if (window.innerWidth <= 768) {
    document.querySelector('.lesson-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  lucide.createIcons();
}

/* ── DONE TRACKING ───────────────────────── */
function toggleDone(lessonId, btn) {
  const was = getDone().includes(lessonId);
  if (was) { unsetDone(lessonId); btn.classList.remove('marked'); btn.innerHTML = `${icon('check-circle-2')} Орындалды деп белгіле`; }
  else      { setDone(lessonId);  btn.classList.add('marked');    btn.innerHTML = `${icon('check-circle-2')} Орындалды ✓`; }
  const sb = document.querySelector(`[data-id="${lessonId}"]`);
  if (sb) sb.classList.toggle('done', !was);
  updateProgress();
  lucide.createIcons();
}

function updateProgress() {
  const done  = getDone();
  const total = allLessons.length;
  const count = allLessons.filter(l => done.includes(l.id)).length;
  const pct   = Math.round((count / total) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-count').textContent = `${count} / ${total}`;
  document.getElementById('progress-pct').textContent   = pct + '%';
}

function navigateLesson(dir) {
  const target = currentLessonIndex + dir;
  if (target < 0 || target >= allLessons.length) return;
  let n = 0;
  for (let ci = 0; ci < DATA.chapters.length; ci++) {
    for (let li = 0; li < DATA.chapters[ci].lessons.length; li++) {
      if (n++ === target) { showLesson(ci, li); return; }
    }
  }
}

/* ── COPY HELPERS ────────────────────────── */
function copyCode(btn) {
  const text = btn.closest('.code-block-wrap').querySelector('pre').textContent;
  navigator.clipboard.writeText(text).then(() => flashCopy(btn));
}

function copyPrompt(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `${icon('check')} Көшірілді`;
    lucide.createIcons();
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `${icon('copy')} Промпты көшіру`;
      lucide.createIcons();
    }, 2000);
  });
}

function flashCopy(btn) {
  btn.classList.add('copied');
  btn.innerHTML = `${icon('check')} Көшірілді`;
  lucide.createIcons();
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `${icon('copy')} Көшіру`;
    lucide.createIcons();
  }, 2000);
}

function submitCodeRequest() {
  const name  = (document.getElementById('req-name').value  || '').trim();
  const title = (document.getElementById('req-title').value || '').trim();
  const desc  = (document.getElementById('req-desc').value  || '').trim();
  if (!name || !title) {
    document.getElementById('req-name').classList.toggle('input-error', !name);
    document.getElementById('req-title').classList.toggle('input-error', !title);
    return;
  }
  const msg = `Код сұрауы\n——————————\nАты: ${name}\nНе керек: ${title}\nСипаттама: ${desc || '—'}`;
  window.open('https://wa.me/77052506772?text=' + encodeURIComponent(msg), '_blank');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', loadData);
