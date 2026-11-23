// 页面切换与各个界面
const App = (() => {
  const $ = s => document.querySelector(s);
  const MODES = {
    level: { icon: '🗺️', title: '闯关练习' },
    listen: { icon: '👂', title: '听音选择' },
    build: { icon: '🧩', title: '拼音拼装' },
    write: { icon: '✏️', title: '看词写拼音' },
    timed: { icon: '⏱️', title: '限时挑战' },
  };
  const TIMED_SECONDS = 60;
  let mode = 'level', cardTab = 'initial';

  // ---------- 通用 ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 'home') renderHome();
    if (id === 'units') renderUnits();
    if (id === 'wrong') renderWrong();
    if (id === 'cards') renderCards();
    window.scrollTo(0, 0);
  }
  const current = () => document.querySelector('.screen.active')?.id;

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  // ---------- 首页 ----------
  function renderHome() {
    const stars = Store.stars();
    const got = Object.values(stars).reduce((a, b) => a + b, 0);
    const wrongN = Object.keys(Store.wrongs()).length;
    $('#home-stats').innerHTML = `<div class="stat"><b>⭐ ${got}</b><span>/ ${Data.UNITS.length * 3} 颗星</span></div>
      <div class="stat"><b>🏆 ${Store.best('all')}</b><span>挑战最高分</span></div>
      <div class="stat"><b>📒 ${wrongN}</b><span>道错题</span></div>`;
    const badge = $('#wrong-badge');
    badge.textContent = wrongN; badge.hidden = !wrongN;
    $('#sfx-toggle').textContent = Sound.muted ? '🔕' : '🔔';
  }

  // ---------- 单元选择 ----------
  function openUnits(m) { mode = m; show('units'); }
  function unitCard({ id, no, name, isPy, emo, side, locked }) {
    return `<button class="unit-card${locked ? ' locked' : ''}" data-u="${id}" ${locked ? 'disabled' : ''}>
      <span class="unit-no">${no}</span>
      <span class="unit-main"><span class="unit-name${isPy ? ' py' : ''}">${name}</span><span class="unit-emo">${emo}</span></span>
      <span class="unit-side">${locked ? '🔒' : side}</span></button>`;
  }
  function renderUnits() {
    const M = MODES[mode];
    $('#units-title').textContent = `${M.icon} ${M.title}`;
    const stars = Store.stars(), unlockAll = Store.get('unlockAll', false);
    let html = '';
    if (mode !== 'level') {
      const side = mode === 'timed' ? `🏆${Store.best('all')}` : '▶';
      html += unitCard({ id: 'all', no: '🎲', name: '全部混合', emo: '所有单元随机出题', side });
    }
    let group = '';
    Data.UNITS.forEach((u, i) => {
      if (u.group !== group) { group = u.group; html += `<h3 class="group-title">${group}</h3>`; }
      const locked = mode === 'level' && !unlockAll && i > 0 && !(stars[Data.UNITS[i - 1].id] >= 1);
      const side = mode === 'level' ? `<span class="stars">${starStr(stars[u.id] || 0)}</span>`
        : mode === 'timed' ? `🏆${Store.best(u.id)}` : '▶';
      html += unitCard({ id: u.id, no: i + 1, name: u.name, isPy: !!u.letters, emo: u.words.slice(0, 4).map(w => w[2]).join(''), side, locked });
    });
    if (mode === 'level') {
      html += `<label class="parent-toggle"><input type="checkbox" id="unlock-all" ${unlockAll ? 'checked' : ''}> 家长设置：解锁全部关卡</label>`;
    }
    $('#unit-list').innerHTML = html;
    $('#unit-list').querySelectorAll('.unit-card').forEach(b => b.onclick = () => startMode(mode, b.dataset.u));
    const ua = $('#unlock-all');
    if (ua) ua.onchange = () => { Store.set('unlockAll', ua.checked); renderUnits(); };
  }

  function startMode(m, unitId) {
    const unit = Q.unitById(unitId);
    const name = unit ? unit.name : '全部混合';
    const base = { mode: m, unitId, back: 'units' };
    if (m === 'level') Quiz.start({ ...base, title: `第${Data.UNITS.indexOf(unit) + 1}关 · ${name}`, build: () => Q.levelSpecs(unitId) });
    else if (m === 'listen') Quiz.start({ ...base, title: `听音选择 · ${name}`, build: () => Q.listenSpecs(unitId) });
    else if (m === 'build') Quiz.start({ ...base, title: `拼音拼装 · ${name}`, build: () => Q.planSpecs(unitId, [['build', 6]]) });
    else if (m === 'write') Quiz.start({ ...base, title: `写拼音 · ${name}`, build: () => Q.planSpecs(unitId, [['write', 6]]) });
    else if (m === 'timed') Quiz.start({ ...base, title: `限时挑战 · ${name}`, gen: () => Q.timedSpec(unitId), timed: TIMED_SECONDS });
  }

  // ---------- 拼音卡片 ----------
  const CARD_TABS = [['initial', '声母'], ['final', '韵母'], ['whole', '整体认读'], ['tone', '声调']];
  function renderCards() {
    $('#card-tabs').innerHTML = CARD_TABS.map(([k, n]) => `<button class="tab${k === cardTab ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('');
    $('#card-tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { cardTab = b.dataset.tab; renderCards(); });
    const grid = $('#card-grid');
    if (cardTab === 'tone') {
      grid.className = 'tone-grid';
      grid.innerHTML = Data.TONES.map(t => {
        const ex = Pinyin.parseWord(t.ex[1]).map(s => Pinyin.mark(s.letters, s.tone)).join(' ');
        return `<button class="tone-card t${t.tone}" data-say="${t.ex[0]}"><span class="tc-mark py">${t.mark}</span>
          <span class="tc-rhyme">${t.rhyme}</span><span class="tc-tip">${t.tip}</span>
          <span class="tc-ex"><span class="zh">${t.ex[0]}</span> <span class="py">${ex}</span> 🔊</span></button>`;
      }).join('');
      return;
    }
    grid.className = 'letter-grid';
    grid.innerHTML = Q.KIND[cardTab].map((l, i) => `<button class="letter-tile c${i % 6}" data-l="${l}"><span class="py">${l}</span></button>`).join('');
    grid.querySelectorAll('.letter-tile').forEach(b => b.onclick = () => openLetter(b.dataset.l));
  }
  function openLetter(l) {
    const L = Q.LETTER[l], test = Q.letterTest(l);
    const ex = Q.examples(test, null, 4);
    const kindName = { initial: '声母', final: '韵母', whole: '整体认读音节' }[L.kind];
    modal(`<div class="lc-kind">${kindName}</div><div class="lc-big py">${l}</div>
      <div class="lc-rep">${L.kind === 'whole' ? '读作' : '读音像'}「<span class="zh">${L.rep}</span>」</div>
      <button class="btn primary" data-say="${L.rep}">🔊 听一听</button>
      <div class="fb-ex-title">📚 词语举例</div>
      <div class="fb-ex">${ex.map(w => Q.wordCard(w, w.syl.findIndex(test), { py: true, cls: 'mini' })).join('') || '<p class="muted">暂无例词</p>'}</div>`);
    Sound.say(L.rep);
  }
  function modal(html) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-card pop"><button class="modal-close icon-btn" aria-label="关闭">✕</button>${html}</div>`;
    m.classList.add('show');
    m.querySelector('.modal-close').onclick = closeModal;
  }
  function closeModal() { $('#modal').classList.remove('show'); }

  // ---------- 错题本 ----------
  function renderWrong() {
    const items = Object.entries(Store.wrongs()).sort((a, b) => b[1].n - a[1].n || b[1].ts - a[1].ts);
    const box = $('#wrong-list');
    $('#wrong-actions').hidden = !items.length;
    $('#wrong-review').textContent = `开始复习（${Math.min(items.length, 10)} 题）`;
    if (!items.length) {
      box.innerHTML = '<div class="empty"><div class="empty-emo">🎉</div><p>错题本是空的，继续加油！</p><p class="muted">答错的题会自动收进来，复习时连续答对 2 次就会移出。</p></div>';
      return;
    }
    box.innerHTML = items.map(([key, it]) => {
      const q = Q.make(it.spec);
      if (!q) return '';
      const W = q.word;
      const main = W
        ? `<span class="wi-emo">${W.e}</span><span class="wi-word">${W.syl.map((s, i) => `<span class="wc-c${i === it.spec.i ? ' hl' : ''}"><i class="py">${s.py}</i><b class="zh">${s.ch}</b></span>`).join('')}</span>`
        : `<span class="wi-emo">🔤</span><span class="wi-letter py">${it.spec.l}</span>`;
      return `<div class="wrong-item">${main}
        <span class="wi-info"><span class="wi-type">${q.label}</span><span class="wi-n">错 ${it.n} 次 · 已连对 ${it.streak}/${Store.GRADUATE}</span></span>
        <button class="icon-btn small" data-say="${q.say}" aria-label="朗读">🔊</button>
        <button class="icon-btn small del" data-del="${encodeURIComponent(key)}" aria-label="删除">🗑</button></div>`;
    }).join('');
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { Store.removeWrong(decodeURIComponent(b.dataset.del)); renderWrong(); });
  }
  function startReview() {
    Quiz.start({
      mode: 'review', title: '📒 错题复习', back: 'wrong',
      build: () => Q.shuffle(Object.values(Store.wrongs()).map(it => it.spec)).slice(0, 10),
    });
  }

  // ---------- 成绩 ----------
  function showResult(S) {
    const o = S.opts;
    let head, stars = 0, extra = '', win = false;
    if (o.timed) {
      const best = Store.best(o.unitId);
      const isNew = S.score > best;
      if (isNew) Store.setBest(o.unitId, S.score);
      win = isNew && S.score > 0;
      head = `<div class="res-emo">${isNew ? '🏆' : '⏱️'}</div><div class="res-title">${isNew ? '新纪录！' : '时间到！'}</div>
        <div class="res-big">⭐ ${S.score} 分</div>
        <div class="res-sub">答对 ${S.correct} / ${S.answered} 题 · 最高连击 🔥${S.maxCombo} · 最高分 ${Math.max(best, S.score)}</div>`;
    } else {
      const pct = S.answered ? S.correct / S.answered : 0;
      stars = pct >= 1 ? 3 : pct >= 0.8 ? 2 : pct >= 0.6 ? 1 : 0;
      if (o.mode === 'level') Store.setStars(o.unitId, stars);
      win = stars >= 2;
      const titles = ['继续加油！', '不错哦！', '真棒！', '太完美了！'];
      head = `<div class="res-emo">${['💪', '😊', '😄', '🥳'][stars]}</div><div class="res-title">${titles[stars]}</div>
        <div class="res-stars">${[0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${i * 0.2}s">★</span>`).join('')}</div>
        <div class="res-sub">答对 ${S.correct} / ${S.answered} 题</div>`;
      if (o.mode === 'level' && stars >= 1) {
        const i = Data.UNITS.findIndex(u => u.id === o.unitId);
        if (Data.UNITS[i + 1]) extra = `<button class="btn green" id="res-next">下一关 →</button>`;
      }
    }
    const seen = new Set();
    const wrongs = S.wrongs.filter(q => !seen.has(q.key) && seen.add(q.key));
    const wrongHTML = wrongs.length ? `<div class="res-wrong"><div class="fb-ex-title">📒 这次的错题（已存入错题本）</div><div class="fb-ex">${
      wrongs.map(q => q.word ? Q.wordCard(q.word, q.spec.i ?? -1, { py: true, cls: 'mini' })
        : `<div class="word-card mini"><div class="wc-emoji">🔤</div><div class="wc-chars"><span class="py big">${q.spec.l}</span></div><button class="speak-btn" data-say="${q.say}">🔊</button></div>`).join('')}</div></div>` : '';
    $('#result-body').innerHTML = `<div class="res-card pop">${head}${wrongHTML}
      <div class="res-actions">${extra}<button class="btn primary" id="res-again">再来一次 🔁</button><button class="btn ghost" id="res-back">返回</button></div></div>`;
    show('result');
    $('#res-again').onclick = () => Quiz.start(o);
    $('#res-back').onclick = () => show(o.back);
    const nx = $('#res-next');
    if (nx) nx.onclick = () => { const i = Data.UNITS.findIndex(u => u.id === o.unitId); startMode('level', Data.UNITS[i + 1].id); };
    if (win) { Sound.sfx('win'); confetti(); }
  }
  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const bits = ['⭐', '🎉', '✨', '🌟', '🎈', '🍬'];
    box.innerHTML = Array.from({ length: 28 }, () =>
      `<span style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.5}s">${Q.pick(bits)}</span>`).join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  // ---------- 事件绑定 ----------
  function init() {
    document.addEventListener('click', e => {
      const say = e.target.closest('[data-say]');
      if (say) { Sound.say(say.dataset.say); say.classList.remove('ping'); void say.offsetWidth; say.classList.add('ping'); }
      const go = e.target.closest('[data-go]');
      if (go) {
        let target = go.dataset.go;
        if (target === 'back') { target = Quiz.backTarget(); Quiz.quit(); }
        show(target);
      }
    });
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      const m = b.dataset.mode;
      if (m === 'cards' || m === 'wrong') show(m); else openUnits(m);
    });
    $('#sfx-toggle').onclick = () => { $('#sfx-toggle').textContent = Sound.toggleMute() ? '🔕' : '🔔'; };
    $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
    $('#wrong-review').onclick = startReview;
    $('#wrong-clear').onclick = () => { if (confirm('确定要清空错题本吗？')) { Store.clearWrong(); renderWrong(); } };
    renderHome();
  }

  return { init, show, current, toast, showResult };
})();

document.addEventListener('DOMContentLoaded', App.init);
