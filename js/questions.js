// 题目：由可序列化的 spec 生成具体题目（干扰项每次重新随机），错题本只需保存 spec
const Q = (() => {
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const uniq = a => [...new Set(a)];
  const shuffle = a => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // ---------- 词库索引 ----------
  const WORDS = [], MAP = {};
  Data.UNITS.forEach(u => u.words.forEach(([w, p, e]) => {
    if (MAP[w]) return;
    const chars = Array.from(w), parsed = Pinyin.parseWord(p);
    if (chars.length !== parsed.length) { console.warn('字数和拼音数量不一致:', w, p); return; }
    const syl = parsed.map((s, i) => ({
      ...s, ...Pinyin.split(s.letters), ch: chars[i],
      whole: Pinyin.WHOLE.includes(s.letters), py: Pinyin.mark(s.letters, s.tone),
    }));
    const o = { w, p, e, unit: u.id, syl, py: syl.map(s => s.py).join(' ') };
    WORDS.push(o); MAP[w] = o;
  }));

  const LETTER = {};
  const KIND = { initial: [], final: [], whole: [] };
  [['initials', 'initial'], ['finals', 'final'], ['whole', 'whole']].forEach(([k, kind]) =>
    Data.LETTERS[k].forEach(([l, rep]) => { LETTER[l] = { l, rep, kind }; KIND[kind].push(l); }));

  const unitById = id => Data.UNITS.find(u => u.id === id);
  const unitWords = id => (unitById(id) ? WORDS.filter(w => w.unit === id) : WORDS);

  function letterTest(l) {
    const k = LETTER[l].kind;
    if (k === 'initial') return s => s.ini === l && !s.whole;
    if (k === 'final') return s => s.fin === l && !s.whole;
    return s => s.letters === l;
  }
  function examples(test, exclude, n = 3) {
    return shuffle(WORDS.filter(w => w !== exclude && w.syl.some(test))).slice(0, n);
  }
  // 和某个词有相同音节（其次相同声母）的其他词
  function wordExamples(W, n = 2) {
    const same = examples(s => W.syl.some(x => x.letters === s.letters), W, n);
    if (same.length >= n) return same;
    const more = examples(s => W.syl.some(x => x.ini && x.ini === s.ini), W, n * 2).filter(x => !same.includes(x));
    return same.concat(more).slice(0, n);
  }

  // ---------- 干扰项 ----------
  function letterChoices(correct, kind, n = 4) {
    const conf = kind === 'initial' ? Pinyin.CONF_I[correct] : kind === 'final' ? Pinyin.CONF_F[correct] : null;
    return shuffle(uniq([correct, ...(conf || []).filter(c => KIND[kind].includes(c)), ...shuffle(KIND[kind])]).slice(0, n));
  }
  function iniChoices(s) {
    return shuffle(uniq([s.ini, ...(Pinyin.CONF_I[s.ini] || []), ...shuffle(KIND.initial)]).slice(0, 4));
  }
  function finChoices(s) {
    return shuffle(uniq([s.fin, ...(Pinyin.CONF_F[s.fin] || []), ...shuffle(KIND.final)]).slice(0, 4));
  }
  // 从变体里尽量各类型（声调/声母/韵母）都挑一点
  function sylVariants(s, n = 3) {
    const vs = shuffle(Pinyin.variants(s));
    const byKind = ['ini', 'fin', 'tone'].map(k => vs.filter(v => v.kind === k));
    const out = [];
    for (let r = 0; out.length < n && r < 6; r++) {
      for (const list of byKind) {
        const v = list[r];
        if (!v) continue;
        const py = Pinyin.mark(v.letters, v.tone);
        if (py !== s.py && !out.includes(py)) out.push(py);
        if (out.length >= n) break;
      }
    }
    return out;
  }
  function pyVariants(W, n = 3) {
    const out = new Set();
    for (let k = 0; k < 80 && out.size < n; k++) {
      const i = rnd(W.syl.length);
      const vs = Pinyin.variants(W.syl[i]);
      if (!vs.length) continue;
      const nonTone = vs.filter(v => v.kind !== 'tone');
      const v = nonTone.length && Math.random() < 0.6 ? pick(nonTone) : pick(vs);
      const py = W.syl.map((s, j) => (j === i ? Pinyin.mark(v.letters, v.tone) : s.py)).join(' ');
      if (py !== W.py) out.add(py);
    }
    return [...out];
  }
  function otherWords(W, n = 3) {
    const pool = shuffle(WORDS.filter(x => x !== W && x.py !== W.py));
    const sameUnit = pool.filter(x => x.unit === W.unit && x.syl.length === W.syl.length);
    const sameLen = pool.filter(x => x.syl.length === W.syl.length);
    return uniq([...sameUnit, ...sameLen, ...pool]).slice(0, n);
  }

  // ---------- HTML 片段 ----------
  const pyspan = t => `<span class="py">${t}</span>`;
  function wordCard(W, hl = -1, { py = false, speak = true, cls = '' } = {}) {
    const chars = W.syl.map((s, i) =>
      `<span class="wc-c${i === hl ? ' hl' : ''}">${py ? `<i class="py">${s.py}</i>` : ''}<b class="zh">${s.ch}</b></span>`).join('');
    return `<div class="word-card ${cls}"><div class="wc-emoji">${W.e}</div><div class="wc-chars">${chars}</div>${
      speak ? `<button class="speak-btn" data-say="${W.w}" aria-label="朗读">🔊</button>` : ''}</div>`;
  }
  const bigSpeak = text => `<button class="big-speak" data-say="${text}"><span>🔊</span><small>再听一次</small></button>`;

  // ---------- spec -> 题目 ----------
  const TYPE_LABEL = {
    listenLetter: '听音认拼音', part: '找声母韵母', tone: '选声调', spell: '拼一拼', w2p: '看词选拼音',
    p2w: '看拼音选词', listenP: '听音选拼音', listenW: '听音选词语', build: '拼音拼装', write: '看词写拼音',
  };
  const keyOf = sp => [sp.t, sp.w || sp.l, sp.i ?? '', sp.part || ''].join('|');

  function make(spec) {
    if (!spec || !TYPE_LABEL[spec.t]) return null;
    const W = spec.w ? MAP[spec.w] : null;
    if (spec.w && !W) return null;
    const s = W && spec.i != null ? W.syl[spec.i] : null;
    if (spec.i != null && !s) return null;
    const q = { spec, key: keyOf(spec), t: spec.t, label: TYPE_LABEL[spec.t], word: W, kind: 'choice', optClass: 'py' };
    q.examples = W ? wordExamples(W) : [];
    const pyOpts = () => shuffle([W.py, ...pyVariants(W)]).map(v => ({ v, html: v }));

    switch (spec.t) {
      case 'listenLetter': {
        const L = LETTER[spec.l];
        if (!L) return null;
        q.prompt = `<div class="q-tip">听一听，选出你听到的拼音</div>${bigSpeak(L.rep)}`;
        q.autoSpeak = L.rep;
        q.options = letterChoices(L.l, L.kind).map(v => ({ v, html: v }));
        q.answer = L.l;
        q.answerHTML = pyspan(L.l) + `（读音像「${L.rep}」）`;
        q.examples = examples(letterTest(L.l), null, 3);
        q.say = L.rep;
        break;
      }
      case 'part': {
        const isIni = spec.part === 'initial';
        const ans = isIni ? s.ini : s.fin;
        if (!ans || s.whole || !KIND[isIni ? 'initial' : 'final'].includes(ans)) return null;
        q.prompt = wordCard(W, spec.i) + `<div class="q-ask">「<b class="zh">${s.ch}</b>」的<em>${isIni ? '声母' : '韵母'}</em>是？</div>`;
        q.options = letterChoices(ans, isIni ? 'initial' : 'final').map(v => ({ v, html: v }));
        q.answer = ans;
        q.answerHTML = `${pyspan(s.py)} 的${isIni ? '声母' : '韵母'}是 ${pyspan(ans)}`;
        q.examples = examples(isIni ? (x => x.ini === ans && !x.whole) : (x => x.fin === ans && !x.whole), W, 2);
        break;
      }
      case 'tone': {
        let opts = [1, 2, 3, 4].map(t => ({ v: String(t), html: Pinyin.mark(s.letters, t) }));
        if (s.tone === 5) { opts.splice(rnd(4), 1); opts.push({ v: '5', html: `${s.letters}<small>轻声</small>` }); }
        q.prompt = wordCard(W, spec.i) + `<div class="q-ask">「<b class="zh">${s.ch}</b>」${pyspan(s.letters)} 读第几声？</div>`;
        q.options = opts;
        q.answer = String(s.tone);
        q.answerHTML = `${pyspan(s.py)}（${Pinyin.TONE_NAMES[s.tone]}）`;
        q.optClass = 'py tones';
        break;
      }
      case 'spell': {
        if (!s.ini || s.whole) return null;
        q.prompt = `<div class="q-tip">拼一拼，选出正确的音节</div><div class="formula"><span class="py f-ini">${s.ini}</span>` +
          `<span class="op">+</span><span class="py f-fin">${Pinyin.mark(s.fin, s.tone)}</span><span class="op">→</span><span class="qmark">?</span></div>`;
        q.options = shuffle([s.py, ...sylVariants(s)]).map(v => ({ v, html: v }));
        q.answer = s.py;
        q.answerHTML = `${pyspan(s.ini)} + ${pyspan(Pinyin.mark(s.fin, s.tone))} → ${pyspan(s.py)}（${s.ch}）`;
        break;
      }
      case 'w2p':
        q.prompt = `<div class="q-tip">看一看，选出正确的拼音</div>` + wordCard(W, -1, { speak: false });
        q.options = pyOpts();
        q.answer = W.py;
        q.answerHTML = pyspan(W.py);
        break;
      case 'p2w':
        q.prompt = `<div class="q-tip">读一读，这个拼音是哪个词？</div><div class="big-py py">${W.py}</div>`;
        q.options = shuffle([W, ...otherWords(W)]).map(o => ({ v: o.w, html: `<span class="zh">${o.w}</span>` }));
        q.answer = W.w;
        q.optClass = 'zh';
        q.answerHTML = `<span class="zh">${W.w}</span> ${pyspan(W.py)}`;
        break;
      case 'listenP':
        q.prompt = `<div class="q-tip">听一听，选出正确的拼音</div>${bigSpeak(W.w)}`;
        q.autoSpeak = W.w;
        q.options = pyOpts();
        q.answer = W.py;
        q.answerHTML = `${pyspan(W.py)}（${W.w}）`;
        break;
      case 'listenW':
        q.prompt = `<div class="q-tip">听一听，选出你听到的词语</div>${bigSpeak(W.w)}`;
        q.autoSpeak = W.w;
        q.options = shuffle([W, ...otherWords(W)]).map(o => ({ v: o.w, html: `<span class="emo">${o.e}</span><span class="zh">${o.w}</span>` }));
        q.answer = W.w;
        q.optClass = 'zh with-emo';
        q.answerHTML = `<span class="zh">${W.w}</span> ${pyspan(W.py)}`;
        break;
      case 'build':
      case 'write':
        q.kind = spec.t;
        q.answerHTML = pyspan(W.py);
        break;
    }
    q.say = q.say || (W && W.w);
    return q;
  }

  // ---------- 出题 ----------
  function genSpec(t, unitId) {
    const unit = unitById(unitId);
    const words = unitWords(unitId);
    const letters = unit && unit.letters;
    const okFin = s => !s.whole && KIND.final.includes(s.fin);
    const fromSyl = (filter, extra = {}) => {
      for (let k = 0; k < 40; k++) {
        const W = pick(words);
        const idx = W.syl.map((_, i) => i).filter(i => filter(W.syl[i]));
        if (idx.length) return { t, w: W.w, i: pick(idx), ...extra };
      }
      return null;
    };
    switch (t) {
      case 'listenLetter':
        return { t, l: letters ? pick(letters) : pick([...KIND.initial, ...KIND.final]) };
      case 'part': {
        if (letters) {
          const l = pick(letters);
          const r = LETTER[l].kind === 'initial'
            ? fromSyl(s => s.ini === l && !s.whole, { part: 'initial' })
            : fromSyl(s => s.fin === l && okFin(s), { part: 'final' });
          if (r) return r;
          const r2 = fromSyl(s => !s.whole && (letters.includes(s.ini) || (letters.includes(s.fin) && okFin(s))));
          if (r2) {
            r2.part = letters.includes(MAP[r2.w].syl[r2.i].ini) ? 'initial' : 'final';
            return r2;
          }
        }
        return Math.random() < 0.5 ? fromSyl(s => s.ini && !s.whole, { part: 'initial' }) : fromSyl(okFin, { part: 'final' });
      }
      case 'tone': return fromSyl(() => true);
      case 'spell': return fromSyl(s => s.ini && !s.whole);
      default: return { t, w: pick(words).w };
    }
  }

  function planSpecs(unitId, plan) {
    const out = [], seen = new Set();
    for (const [t, n] of plan) {
      for (let k = 0; k < n; k++) {
        let sp = null;
        for (let tries = 0; tries < 8; tries++) {
          const c = genSpec(t, unitId) || genSpec('w2p', unitId);
          sp = c;
          if (!seen.has(keyOf(c))) break;
        }
        seen.add(keyOf(sp));
        out.push(sp);
      }
    }
    return out;
  }

  const levelSpecs = id => shuffle(planSpecs(id, unitById(id)?.letters
    ? [['listenLetter', 2], ['part', 2], ['spell', 2], ['tone', 2], ['w2p', 2]]
    : [['w2p', 3], ['p2w', 2], ['tone', 2], ['spell', 2], ['part', 1]]));
  const listenSpecs = id => shuffle(planSpecs(id, unitById(id)?.letters
    ? [['listenLetter', 3], ['listenP', 4], ['listenW', 3]]
    : [['listenP', 5], ['listenW', 5]]));
  const TIMED_TYPES = ['w2p', 'p2w', 'tone', 'spell', 'part'];
  const timedSpec = id => genSpec(pick(TIMED_TYPES), id) || genSpec('w2p', id);

  return {
    WORDS, MAP, LETTER, KIND, TYPE_LABEL,
    make, keyOf, genSpec, planSpecs, levelSpecs, listenSpecs, timedSpec,
    wordCard, examples, letterTest, iniChoices, finChoices, unitById, unitWords, shuffle, pick,
  };
})();
