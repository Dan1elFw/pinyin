// 拼音工具：数字声调 <-> 声调符号、音节拆分/组合、易混淆变体生成
const Pinyin = (() => {
  const MARKS = { a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè', i: 'īíǐì', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
  const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  const WHOLE = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'];
  const TONE_NAMES = ['', '一声', '二声', '三声', '四声', '轻声'];
  const FINALS = ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün',
    'ang', 'eng', 'ing', 'ong', 'ia', 'iao', 'ian', 'iang', 'iong', 'ua', 'uo', 'uai', 'uan', 'uang', 'üan'];

  // 易混淆的声母 / 韵母，用来生成干扰项
  const CONF_I = {
    b: ['d', 'p'], p: ['q', 'b'], d: ['b', 't'], t: ['d', 'f'], n: ['l', 'm'], l: ['n', 'r'], m: ['n'], f: ['h', 't'],
    g: ['k'], k: ['g', 'h'], h: ['f', 'k'], j: ['q', 'x'], q: ['j', 'p'], x: ['s', 'sh'],
    zh: ['z', 'ch'], ch: ['c', 'zh'], sh: ['s', 'x'], r: ['l'], z: ['zh', 'c'], c: ['ch', 's'], s: ['sh', 'c'],
    y: ['w'], w: ['y'], '': ['y', 'w'],
  };
  const CONF_F = {
    a: ['o', 'e'], o: ['e', 'u'], e: ['o', 'a'], i: ['ü', 'ei'], u: ['ü', 'o'], 'ü': ['u', 'i'],
    ai: ['ei', 'ao'], ei: ['ai', 'ui'], ui: ['iu', 'ei'], ao: ['ou', 'iao'], ou: ['ao', 'iu'], iu: ['ui', 'ou'],
    ie: ['üe', 'ei'], 'üe': ['ie', 'ü'], er: ['e', 'ei'],
    an: ['ang', 'en'], en: ['eng', 'an'], in: ['ing', 'en'], un: ['ün', 'en'], 'ün': ['un', 'in'],
    ang: ['an', 'eng'], eng: ['en', 'ang'], ing: ['in', 'eng'], ong: ['eng', 'ang'],
    ia: ['ie', 'a'], iao: ['ao', 'iu'], ian: ['iang', 'an'], iang: ['ian', 'ang'], iong: ['ong', 'ing'],
    ua: ['a', 'uo'], uo: ['o', 'ua'], uai: ['ai', 'ui'], uan: ['uang', 'an'], uang: ['uan', 'ang'], 'üan': ['ian', 'uan'],
  };

  // "ping2" -> { letters: 'ping', tone: 2 }；0 或不写数字表示轻声(5)
  function parse(token) {
    const m = /^([a-zü]+)([0-5]?)$/.exec(token.trim().toLowerCase().replace(/v/g, 'ü'));
    if (!m) throw new Error('无法解析拼音: ' + token);
    return { letters: m[1], tone: m[2] === '' || m[2] === '0' ? 5 : +m[2] };
  }
  const parseWord = p => p.trim().split(/\s+/).map(parse);

  // 标调规则：有 a 标 a，没 a 找 o e，iu 并列标在后
  function markIndex(letters) {
    let i = letters.indexOf('a'); if (i >= 0) return i;
    i = letters.indexOf('e'); if (i >= 0) return i;
    i = letters.indexOf('ou'); if (i >= 0) return i;
    for (let k = letters.length - 1; k >= 0; k--) if ('iouü'.includes(letters[k])) return k;
    return -1;
  }
  function mark(letters, tone) {
    if (!tone || tone === 5) return letters;
    const i = markIndex(letters);
    if (i < 0) return letters;
    return letters.slice(0, i) + MARKS[letters[i]][tone - 1] + letters.slice(i + 1);
  }

  // 拆成声母 + 韵母。j q x y 后面的 u 其实是 ü（小ü见了jqx，去掉两点还读ü）
  function split(letters) {
    const ini = INITIALS.find(x => letters.startsWith(x) && letters.length > x.length) || '';
    let fin = letters.slice(ini.length);
    if (ini && 'jqxy'.includes(ini) && fin[0] === 'u') fin = 'ü' + fin.slice(1);
    return { ini, fin };
  }
  function compose(ini, fin) {
    if (ini && 'jqxy'.includes(ini) && fin[0] === 'ü') fin = 'u' + fin.slice(1);
    return ini + fin;
  }

  // 粗略的拼合规则检查，避免生成 "bü"、"gi" 这类不存在的音节做干扰项
  function isValid(ini, fin) {
    if (!FINALS.includes(fin)) return false;
    const iG = fin[0] === 'i', vG = fin[0] === 'ü', uG = fin[0] === 'u';
    if (ini === '') return ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'er'].includes(fin);
    if (ini === 'y') return ['i', 'a', 'e', 'ao', 'ou', 'an', 'ang', 'in', 'ing', 'ong', 'ü', 'üe', 'üan', 'ün'].includes(fin);
    if (ini === 'w') return ['u', 'a', 'o', 'ai', 'ei', 'an', 'en', 'ang', 'eng'].includes(fin);
    if (['j', 'q', 'x'].includes(ini)) return iG || vG;
    if (fin === 'er') return false;
    if (vG) return ['n', 'l'].includes(ini) && (fin === 'ü' || fin === 'üe');
    if (['g', 'k', 'h', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's'].includes(ini)) {
      if (iG) return fin === 'i' && !['g', 'k', 'h'].includes(ini);
      if (fin === 'o') return false;
      if (['z', 'c', 's', 'r'].includes(ini) && ['ua', 'uai', 'uang'].includes(fin)) return false;
      return true;
    }
    if (['b', 'p', 'm', 'f'].includes(ini)) {
      if (uG) return fin === 'u';
      if (fin === 'ong') return false;
      if (iG) return ini !== 'f' && !['ia', 'iang', 'iong'].includes(fin);
      if (fin === 'e') return ini === 'm';
      return true;
    }
    // d t n l
    if (['ua', 'uai', 'uang', 'o', 'ia', 'iong'].includes(fin)) return false;
    if (['iang', 'in'].includes(fin)) return ini === 'n' || ini === 'l';
    if (fin === 'ui') return ini === 'd' || ini === 't';
    return true;
  }

  // 一个音节的所有“看起来很像”的变体：换声调 / 换声母 / 换韵母
  function variants(s) {
    const out = [];
    const { ini, fin } = split(s.letters);
    const whole = WHOLE.includes(s.letters);
    for (const t of [1, 2, 3, 4]) if (t !== s.tone) out.push({ letters: s.letters, tone: t, kind: 'tone' });
    if (!whole || ['zhi', 'chi', 'shi', 'zi', 'ci', 'si', 'ri'].includes(s.letters)) {
      for (const ni of CONF_I[ini] || []) if (isValid(ni, fin)) out.push({ letters: compose(ni, fin), tone: s.tone, kind: 'ini' });
    }
    if (!whole) {
      for (const nf of CONF_F[fin] || []) if (isValid(ini, nf)) out.push({ letters: compose(ini, nf), tone: s.tone, kind: 'fin' });
    }
    return out;
  }

  return { parse, parseWord, mark, split, compose, isValid, variants, INITIALS, WHOLE, TONE_NAMES, CONF_I, CONF_F };
})();
