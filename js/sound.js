// 声音：优先播放 audio/ 里预先生成的录音，没有的再用浏览器中文朗读；另有 WebAudio 合成的小音效
const Sound = (() => {
  const synth = window.speechSynthesis;
  const files = new Set(window.AUDIO_FILES || []);
  const player = new Audio();
  let ctx = null, voice = null, warned = false, unlocked = false;
  let muted = Store.get('muted', false);

  // iPad/Safari 要求第一次播放发生在用户点击里，之后同一个 audio 元素就可以自由播放
  document.addEventListener('pointerdown', () => {
    if (unlocked) return;
    unlocked = true;
    if (!player.src) { player.muted = true; player.play().catch(() => {}).finally(() => { player.muted = false; }); }
  }, { capture: true });

  // 系统语音里优先挑更自然的（神经网络 / 增强版），避开机械的老语音
  function pickVoice() {
    const zh = synth.getVoices().filter(v => /^zh[-_]?(CN|Hans)?/i.test(v.lang) && !/HK|TW|yue/i.test(v.lang));
    const score = v => (/natural|neural|online|premium|enhanced|高品质|优化/i.test(v.name) ? 4 : 0)
      + (/zh[-_]CN/i.test(v.lang) ? 2 : 0) + (/xiaoxiao|tingting|婷婷|lili|莉莉|yaoyao|huihui/i.test(v.name) ? 1 : 0);
    voice = zh.sort((a, b) => score(b) - score(a))[0] || null;
  }
  if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

  function say(text) {
    if (synth) synth.cancel();
    if (files.has(text)) {
      player.pause();
      player.src = 'audio/' + encodeURIComponent(text) + '.mp3';
      player.play().catch(() => speak(text));
      return;
    }
    speak(text);
  }
  function speak(text) {
    if (!synth) { App.toast('这个浏览器不支持朗读 😢'); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (voice) u.voice = voice;
    u.rate = 0.9;
    synth.speak(u);
    if (!voice && !warned && synth.getVoices().length) {
      warned = true;
      App.toast('没有找到中文语音，朗读可能不准确');
    }
  }
  function stopSpeech() { if (synth) synth.cancel(); player.pause(); }

  function beep(freq, at, dur, type = 'sine', vol = 0.18) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t0 = ctx.currentTime + at;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function sfx(name) {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { return; }
    if (name === 'right') { beep(660, 0, 0.12); beep(990, 0.1, 0.22); }
    else if (name === 'wrong') { beep(240, 0, 0.18, 'triangle', 0.2); beep(180, 0.14, 0.25, 'triangle', 0.2); }
    else if (name === 'tap') beep(520, 0, 0.06, 'sine', 0.08);
    else if (name === 'win') [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.12, 0.25));
  }

  return {
    say, stopSpeech, sfx,
    get muted() { return muted; },
    toggleMute() { muted = !muted; Store.set('muted', muted); return muted; },
  };
})();
