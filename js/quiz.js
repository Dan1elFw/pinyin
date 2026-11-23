// 答题引擎：选择题 / 拼音拼装 / 软键盘写拼音，支持定量题目和限时模式
const Quiz = (() => {
  const $ = s => document.querySelector(s);
  let S = null, timer = null, keyHandler = null;

  document.addEventListener('keydown', e => {
    if (keyHandler && App.current() === 'quiz' && !e.metaKey && !e.ctrlKey && !e.altKey) keyHandler(e);
  });
  const setKeys = fn => { keyHandler = fn; };

  // opts: { mode, title, unitId, back, build?: () => specs[], gen?: () => spec, timed?: 秒 }
  function start(opts) {
    stop();
    const specs = opts.build ? opts.build().filter(sp => Q.make(sp)) : null;
    if (specs && !specs.length) { App.toast('这里还没有题目哦'); return; }
    S = { opts, specs, idx: 0, total: specs ? specs.length : 0, correct: 0, answered: 0,
      combo: 0, maxCombo: 0, score: 0, wrongs: [], ended: false, locked: false };
    $('#quiz-title').textContent = opts.title;
    $('#quiz').classList.toggle('timed', !!opts.timed);
    App.show('quiz');
    if (opts.timed) { S.endAt = Date.now() + opts.timed * 1000; timer = setInterval(tick, 100); tick(); }
    next();
  }
  function stop() {
    clearInterval(timer); timer = null;
    setKeys(null); Sound.stopSpeech(); hideFeedback();
  }
  function quit() { if (S) S.ended = true; stop(); }
  const backTarget = () => (S && S.opts.back) || 'home';

  function tick() {
    const left = Math.max(0, S.endAt - Date.now());
    $('#quiz-bar').style.width = (left / (S.opts.timed * 1000)) * 100 + '%';
    $('#quiz-bar').classList.toggle('hurry', left < 10000);
    updateScore(Math.ceil(left / 1000));
    if (left <= 0) finish();
  }
  function updateScore(sec) {
    const el = $('#quiz-score');
    if (S.opts.timed) {
      el.innerHTML = `<span>⏱ ${sec ?? ''}</span><span>⭐ ${S.score}</span>${S.combo >= 2 ? `<span class="combo">🔥×${S.combo}</span>` : ''}`;
    } else {
      el.innerHTML = `<span>${Math.min(S.idx + 1, S.total)}/${S.total}</span><span>✅ ${S.correct}</span>`;
      $('#quiz-bar').style.width = (S.idx / S.total) * 100 + '%';
    }
  }

  function next() {
    if (!S || S.ended) return;
    hideFeedback();
    if (S.specs && S.idx >= S.specs.length) return finish();
    let q = null;
    if (S.specs) q = Q.make(S.specs[S.idx]);
    else for (let k = 0; !q && k < 10; k++) q = Q.make(S.opts.gen());
    if (!q) return finish();
    S.q = q; S.locked = false;
    if (!S.opts.timed) updateScore();
    render(q);
  }

  function render(q) {
    const body = $('#quiz-body');
    body.className = 'quiz-body q-' + q.t;
    setKeys(null);
    if (q.kind === 'choice') renderChoice(q, body);
    else if (q.kind === 'build') renderBuild(q, body);
    else renderWrite(q, body);
    body.insertAdjacentHTML('afterbegin', `<div class="q-label">${q.label}</div>`);
    body.classList.remove('pop'); void body.offsetWidth; body.classList.add('pop');
    if (q.autoSpeak) setTimeout(() => { if (S && S.q === q) Sound.say(q.autoSpeak); }, 350);
  }

  // ---------- 选择题 ----------
  function renderChoice(q, body) {
    body.innerHTML = `<div class="q-prompt">${q.prompt}</div><div class="options ${q.optClass} n${q.options.length}">${
      q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-k">${i + 1}</span>${o.html}</button>`).join('')}</div>`;
    const btns = [...body.querySelectorAll('.opt')];
    const choose = i => {
      if (S.locked) return;
      const ok = q.options[i].v === q.answer;
      btns.forEach((b, j) => { b.disabled = true; if (q.options[j].v === q.answer) b.classList.add('right'); });
      if (!ok) btns[i].classList.add('wrong', 'shake');
      answer(ok);
    };
    btns.forEach((b, i) => b.addEventListener('click', () => choose(i)));
    setKeys(e => { const n = +e.key; if (n >= 1 && n <= q.options.length) choose(n - 1); });
  }

  // 声调按钮：把调号标在字母上（ā á ǎ à），比单独的 ˉˊˇˋ 更直观
  const toneTile = (t, base) => `<span class="tmark py">${t === 5 ? base : Pinyin.mark(base, t)}</span><small>${Pinyin.TONE_NAMES[t]}</small>`;

  // ---------- 拼音拼装 ----------
  function renderBuild(q, body) {
    const W = q.word;
    const st = W.syl.map(() => ({ ini: null, fin: null, tone: null }));
    const choices = W.syl.map(s => ({ ini: Q.iniChoices(s), fin: Q.finChoices(s) }));
    let cur = 0, checked = false;
    body.innerHTML = `<div class="q-prompt"><div class="q-tip">拼一拼：给每个字选声母、韵母和声调</div>${Q.wordCard(W)}</div>
      <div class="slots"></div><div class="tray"></div><div class="actions"><button class="btn primary check">检查 ✔</button></div>`;
    const slotsEl = body.querySelector('.slots'), trayEl = body.querySelector('.tray'), checkBtn = body.querySelector('.check');
    const done = x => x.ini !== null && x.fin !== null && x.tone !== null;
    const isRight = i => Pinyin.compose(st[i].ini, st[i].fin) === W.syl[i].letters && st[i].tone === W.syl[i].tone;
    const ph = '<span class="ph">□</span>';
    function preview(x) {
      if (x.ini !== null && x.fin !== null) {
        const l = Pinyin.compose(x.ini, x.fin);
        return x.tone ? Pinyin.mark(l, x.tone) : l;
      }
      if (x.ini === null && x.fin === null) return ph + ph;
      return (x.ini === null ? ph : x.ini) + (x.fin === null ? ph : Pinyin.mark(x.fin, x.tone));
    }
    function draw() {
      slotsEl.innerHTML = W.syl.map((s, i) => `<button class="slot${i === cur && !checked ? ' cur' : ''}${
        checked ? (isRight(i) ? ' right' : ' wrong') : ''}" data-i="${i}"><span class="slot-py py">${preview(st[i])}</span>${
        st[i].tone === 5 ? '<span class="slot-tag">轻声</span>' : ''}<span class="slot-ch zh">${s.ch}</span></button>`).join('');
      slotsEl.querySelectorAll('.slot').forEach(b => b.onclick = () => { if (!checked) { cur = +b.dataset.i; draw(); } });
      checkBtn.disabled = checked || !st.every(done);
      if (checked) { trayEl.innerHTML = ''; return; }
      const x = st[cur], c = choices[cur];
      const row = (label, field, items) => `<div class="tray-row"><span class="tray-label">${label}</span><div class="tiles">${
        items.map(([v, html]) => `<button class="tile${x[field] === v ? ' sel' : ''}" data-f="${field}" data-v="${v}">${html}</button>`).join('')}</div></div>`;
      trayEl.innerHTML =
        row('声母', 'ini', c.ini.map(v => [v, v === '' ? '<small>无声母</small>' : `<span class="py">${v}</span>`])) +
        row('韵母', 'fin', c.fin.map(v => [v, `<span class="py">${v}</span>`])) +
        row('声调', 'tone', [1, 2, 3, 4, 5].map(t => [t, toneTile(t, x.fin || 'a')]));
      trayEl.querySelectorAll('.tile').forEach(b => b.onclick = () => {
        const f = b.dataset.f;
        st[cur][f] = f === 'tone' ? +b.dataset.v : b.dataset.v;
        Sound.sfx('tap');
        if (done(st[cur])) {
          const nx = st.findIndex((y, i) => i > cur && !done(y));
          const any = st.findIndex(y => !done(y));
          if (nx >= 0) cur = nx; else if (any >= 0) cur = any;
        }
        draw();
      });
    }
    checkBtn.onclick = () => {
      if (checked || !st.every(done)) return;
      checked = true; draw();
      answer(W.syl.every((_, i) => isRight(i)));
    };
    draw();
  }

  // ---------- 看词写拼音（软键盘） ----------
  const KEY_ROWS = [['a', 'b', 'c', 'd', 'e', 'f', 'g'], ['h', 'i', 'j', 'k', 'l', 'm', 'n'], ['o', 'p', 'q', 'r', 's', 't'], ['u', 'ü', 'w', 'x', 'y', 'z']];
  function renderWrite(q, body) {
    const W = q.word, n = W.syl.length;
    const st = W.syl.map(() => ({ txt: '', tone: null }));
    let cur = 0, checked = false;
    body.innerHTML = `<div class="q-prompt"><div class="q-tip">看词写拼音：先拼字母，再点声调</div>${Q.wordCard(W)}</div>
      <div class="slots write"></div>
      <div class="kbd">${KEY_ROWS.map(r => `<div class="krow">${r.map(k => `<button class="key py" data-k="${k}">${k}</button>`).join('')}</div>`).join('')}
        <div class="krow tones">${[1, 2, 3, 4, 5].map(t => `<button class="key tone" data-t="${t}">${toneTile(t, 'a')}</button>`).join('')}</div>
        <div class="krow"><button class="key wide del" data-a="del">⌫ 删除</button><button class="key wide ok" data-a="ok">检查 ✔</button></div>
      </div>`;
    const slotsEl = body.querySelector('.slots');
    const isRight = i => st[i].txt === W.syl[i].letters && st[i].tone === W.syl[i].tone;
    function draw() {
      slotsEl.innerHTML = W.syl.map((s, i) => `<button class="slot four-line${i === cur && !checked ? ' cur' : ''}${
        checked ? (isRight(i) ? ' right' : ' wrong') : ''}" data-i="${i}"><span class="slot-py py">${
        Pinyin.mark(st[i].txt, st[i].tone) || '&nbsp;'}</span>${st[i].tone === 5 ? '<span class="slot-tag">轻声</span>' : ''}<span class="slot-ch zh">${s.ch}</span></button>`).join('');
      slotsEl.querySelectorAll('.slot').forEach(b => b.onclick = () => { if (!checked) { cur = +b.dataset.i; draw(); } });
    }
    function press(a) {
      if (checked || S.locked) return;
      const x = st[cur];
      if (a.k) {
        if (x.txt.length < 6) { x.txt += a.k; Sound.sfx('tap'); }
      } else if (a.t) {
        if (!x.txt) { App.toast('先拼字母，再标声调哦'); return; }
        x.tone = a.t; Sound.sfx('tap');
        if (cur < n - 1) cur++;
      } else if (a.a === 'del') {
        if (x.tone !== null) x.tone = null;
        else if (x.txt) x.txt = x.txt.slice(0, -1);
        else if (cur > 0) cur--;
      } else if (a.a === 'ok') {
        const empty = st.findIndex(y => !y.txt);
        if (empty >= 0) { cur = empty; draw(); App.toast('还有字没写拼音哦'); return; }
        const noTone = st.findIndex(y => y.tone === null);
        if (noTone >= 0) { cur = noTone; draw(); App.toast('别忘了标声调（轻声点「轻声」）'); return; }
        checked = true; draw();
        answer(W.syl.every((_, i) => isRight(i)));
        return;
      }
      draw();
    }
    body.querySelectorAll('.key').forEach(b => b.onclick = () => press({ k: b.dataset.k, t: b.dataset.t && +b.dataset.t, a: b.dataset.a }));
    setKeys(e => {
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) press({ k: k === 'v' ? 'ü' : k });
      else if (/^[1-4]$/.test(k)) press({ t: +k });
      else if (k === '5' || k === '0') press({ t: 5 });
      else if (k === 'backspace') { e.preventDefault(); press({ a: 'del' }); }
      else if (k === 'enter') press({ a: 'ok' });
    });
    draw();
  }

  // ---------- 判分与反馈 ----------
  function answer(ok) {
    if (S.locked) return;
    S.locked = true;
    const q = S.q;
    S.answered++;
    let grad = null;
    if (ok) {
      S.correct++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
      if (S.opts.timed) S.score += 10 + Math.min(S.combo - 1, 10) * 2;
      grad = Store.markRight(q.key);
      Sound.sfx('right');
    } else {
      S.combo = 0;
      S.wrongs.push(q);
      Store.addWrong(q.spec, q.key);
      Sound.sfx('wrong');
    }
    if (S.opts.timed) {
      updateScore(Math.ceil(Math.max(0, S.endAt - Date.now()) / 1000));
      flash(ok);
      setTimeout(() => { if (S && !S.ended && S.q === q) { S.idx++; next(); } }, ok ? 450 : 1200);
    } else {
      showFeedback(ok, q, grad);
    }
  }

  const PRAISE = ['太棒了！', '真厉害！', '答对啦！', '你真棒！', '完全正确！', '好聪明！'];
  function showFeedback(ok, q, grad) {
    const fb = $('#feedback');
    let note = '';
    if (!ok) note = '<div class="fb-note">已加入错题本 📒</div>';
    else if (grad) note = `<div class="fb-note">${grad.graduated ? '🎓 这道错题已经掌握，移出错题本啦！' : `再答对 ${grad.left} 次就能移出错题本`}</div>`;
    const words = [q.word, ...q.examples].filter(Boolean).filter((w, i, a) => a.indexOf(w) === i);
    const last = S.idx >= S.total - 1;
    fb.innerHTML = `<div class="fb-inner ${ok ? 'ok' : 'bad'}">
      <div class="fb-title">${ok ? '🎉 ' + Q.pick(PRAISE) : '🤔 再想想哦'}</div>
      <div class="fb-answer">${ok ? '答案' : '正确答案'}：${q.answerHTML}</div>${note}
      ${words.length ? `<div class="fb-ex-title">📚 词语举例</div><div class="fb-ex">${words.map(w => Q.wordCard(w, -1, { py: true, cls: 'mini' })).join('')}</div>` : ''}
      <button class="btn primary fb-next">${last ? '看成绩 🏁' : '下一题 →'}</button></div>`;
    fb.classList.add('show');
    const go = () => { S.idx++; next(); };
    fb.querySelector('.fb-next').onclick = go;
    setKeys(e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    if (q.say) setTimeout(() => { if (S && S.q === q) Sound.say(q.say); }, 300);
  }
  function hideFeedback() { $('#feedback').classList.remove('show'); }

  function flash(ok) {
    const f = $('#flash');
    f.textContent = ok ? '✓' : '✗';
    f.className = 'show ' + (ok ? 'ok' : 'bad');
    setTimeout(() => { f.className = ''; }, 380);
  }

  function finish() {
    if (!S || S.ended) return;
    S.ended = true;
    stop();
    App.showResult(S);
  }

  return { start, quit, backTarget };
})();
