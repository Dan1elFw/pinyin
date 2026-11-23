// 本地存储：星星、最高分、错题本、设置
const Store = (() => {
  const P = 'pyg_';
  const GRADUATE = 2; // 错题连续答对几次后移出错题本

  function get(k, d) {
    try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function set(k, v) {
    try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* 隐私模式等情况下忽略 */ }
  }

  return {
    get, set, GRADUATE,
    stars: () => get('stars', {}),
    setStars(id, n) {
      const s = get('stars', {});
      if (!(s[id] >= n)) { s[id] = n; set('stars', s); }
    },
    best: id => get('best_' + id, 0),
    setBest(id, v) { set('best_' + id, v); },

    wrongs: () => get('wrong', {}),
    addWrong(spec, key) {
      const w = get('wrong', {});
      const it = w[key] || { spec, n: 0, streak: 0 };
      it.n++; it.streak = 0; it.ts = Date.now();
      w[key] = it; set('wrong', w);
    },
    // 答对一道错题本里的题：返回 null（不在错题本）/ {left} / {graduated:true}
    markRight(key) {
      const w = get('wrong', {});
      const it = w[key];
      if (!it) return null;
      it.streak++;
      if (it.streak >= GRADUATE) { delete w[key]; set('wrong', w); return { graduated: true }; }
      set('wrong', w);
      return { left: GRADUATE - it.streak };
    },
    removeWrong(key) { const w = get('wrong', {}); delete w[key]; set('wrong', w); },
    clearWrong() { set('wrong', {}); },
  };
})();
