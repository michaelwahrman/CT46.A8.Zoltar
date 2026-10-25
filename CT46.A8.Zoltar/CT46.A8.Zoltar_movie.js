/* CT46.A8.Zoltar — MOVIE: record Zoltar as a video with its music, to show people who can't run it.
 *
 * "● Make movie" (bottom right, or key M): one press records the whole show, then downloads it:
 *   the intro from the very beginning (title fades in and rises, cards dealt into the spiral)
 *   -> the "Click to know your future!" button appears and beckons for a moment
 *   -> it is clicked automatically: the music swells, the card is chosen and flies to centre stage
 *   -> the fortune window opens and HOLDS (12 s by default, ?hold=20 for longer)
 *   -> the fortune closes, the card returns to the spiral, the button fades back in, a few seconds more
 *   -> recording stops and the file downloads  (≈ 35 s in all).
 * Key V starts / stops a free recording of whatever you do yourself.
 *
 * How (harness v4: no batch step, the result at the display's speed and resolution):
 *   every frame, right after Zoltar draws, the WebGL picture is copied into a recording canvas of the same pixel size,
 *   and the two HTML parts of the show — the button and the fortune window — are painted on top of it, with their
 *   live opacity and size (so their fades are in the movie). The help text, version label and the REC badge are not.
 *   That canvas is captured at 60 fps with MediaRecorder, together with the music (tapped from the music engine's
 *   output). Chrome / Edge write MP4 (H.264 + AAC); other browsers WebM (VP9 + Opus).
 */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const HOLD = Math.max(3, Math.min(120, parseFloat(qs.get('hold')) || 12));      // seconds the fortune stays up
  const FPS = 60;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 60000) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) throw new Error('timed out'); await wait(50); } };

  // ------------------------------------------------------------------ UI (never in the movie)
  const css = document.createElement('style');
  css.textContent = `
    #movieBtn { position: fixed; right: 12px; bottom: 28px; z-index: 6; font: 12px/1 Georgia, serif; letter-spacing: .06em;
      color: rgba(232,190,110,.8); background: rgba(20,10,6,.7); border: 1px solid rgba(201,151,74,.45); border-radius: 999px;
      padding: 6px 12px; cursor: pointer; }
    #movieBtn:hover { color: #f6dfa4; border-color: #c9974a; }
    #recBadge { position: fixed; right: 12px; top: 10px; z-index: 6; display: none; font: 600 12px/1 system-ui, sans-serif;
      color: #ff6b5a; background: rgba(30,0,0,.75); padding: 6px 10px; border-radius: 6px; }
    body.recording #movieBtn, body.recording #help, body.recording #ver { opacity: .25; }`;
  document.head.appendChild(css);
  const mb = document.createElement('button'); mb.id = 'movieBtn'; mb.type = 'button'; mb.textContent = '● Make movie';
  mb.title = 'Records the whole show — intro, a fortune, and the return — and downloads it as a video (key M). Key V = free recording.';
  const badge = document.createElement('div'); badge.id = 'recBadge';
  document.body.append(mb, badge);
  const help = document.getElementById('help');
  if (help) help.innerHTML += ' &middot; M make movie &middot; V record';

  // ------------------------------------------------------------------ recorder
  const rec = { on: false, canvas: document.createElement('canvas'), ctx: null, mr: null, chunks: [], t0: 0, tapped: null, scripted: false };
  rec.ctx = rec.canvas.getContext('2d');
  function pickType() {
    const T = ['video/mp4;codecs=avc1.640034,mp4a.40.2', 'video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return T.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  }
  function audioStream(Z) {
    const m = Z.music; m.ensure(true);
    if (!m.ctx || !m.engine || !m.engine.out) return null;
    if (!rec.tapped) { rec.tapped = m.ctx.createMediaStreamDestination(); m.engine.out.connect(rec.tapped); }
    return rec.tapped.stream;
  }
  function start(Z, name) {
    if (rec.on) return false;
    const type = pickType(); if (!type) { alert('This browser cannot record video. Use Chrome or Edge.'); return false; }
    const gl = document.querySelector('canvas');
    rec.canvas.width = gl.width; rec.canvas.height = gl.height;
    compose();                                                      // first frame before the stream starts
    const stream = rec.canvas.captureStream(FPS);
    const a = audioStream(Z); if (a) a.getAudioTracks().forEach(t => stream.addTrack(t));
    const px = rec.canvas.width * rec.canvas.height;
    const vbps = Math.round(Math.min(80e6, Math.max(12e6, px * FPS * 0.12)));
    rec.mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: vbps, audioBitsPerSecond: 192000 });
    rec.chunks = []; rec.type = type; rec.name = name;
    rec.info = `${rec.canvas.width}×${rec.canvas.height} · ${type.startsWith('video/mp4') ? 'MP4' : 'WebM'} · ${(vbps / 1e6).toFixed(0)} Mb/s${a ? ' · music' : ' · (no sound)'}`;
    rec.mr.ondataavailable = e => { if (e.data.size) rec.chunks.push(e.data); };
    rec.mr.onstop = () => {
      const blob = new Blob(rec.chunks, { type: rec.type.split(';')[0] });
      const d = new Date(), p = n => String(n).padStart(2, '0');
      const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob);
      a2.download = `${rec.name}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${rec.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
      document.body.appendChild(a2); a2.click(); setTimeout(() => { URL.revokeObjectURL(a2.href); a2.remove(); }, 180000);
      stream.getVideoTracks().forEach(t => t.stop());
      window.__zoltarMovie.lastBlob = blob;
    };
    rec.mr.start(1000); rec.on = true; rec.t0 = performance.now();
    document.body.classList.add('recording'); badge.style.display = 'block';
    return true;
  }
  function stop() {
    if (!rec.on) return; rec.on = false; rec.mr.stop(); rec.mr = null;
    document.body.classList.remove('recording'); badge.style.display = 'none';
    mb.textContent = '● Make movie';
  }
  setInterval(() => { if (rec.on) { const s = (performance.now() - rec.t0) / 1000; badge.textContent = `● REC ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')} · ${rec.info}${rec.scripted ? ' · movie in progress' : ''}`; } }, 250);

  // ------------------------------------------------------------------ painting the HTML parts into the movie
  const btnEl = document.getElementById('future'), fxEl = document.getElementById('fortune');
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawButton(c, s) {
    const op = +getComputedStyle(btnEl).opacity; if (op < 0.01) return;
    const r = btnEl.getBoundingClientRect(), x = r.left * s, y = r.top * s, w = r.width * s, h = r.height * s;
    const glow = 0.92 + 0.26 * (0.5 - 0.5 * Math.cos(performance.now() / 1000 / 2.8 * Math.PI * 2));   // the 'beckon' pulse
    c.save(); c.globalAlpha = op;
    c.shadowColor = `rgba(255,180,80,${0.35 * glow})`; c.shadowBlur = 18 * s;
    rr(c, x - 4 * s, y - 4 * s, w + 8 * s, h + 8 * s, (h + 8 * s) / 2); c.fillStyle = 'rgba(20,12,4,.9)'; c.fill();
    c.shadowBlur = 0; c.lineWidth = 1 * s; c.strokeStyle = 'rgba(201,151,74,.55)'; c.stroke();
    rr(c, x, y, w, h, h / 2);
    const g = c.createRadialGradient(x + w / 2, y + h * 0.4, 0, x + w / 2, y + h * 0.4, w * 0.6);
    g.addColorStop(0, 'rgba(70,44,14,.92)'); g.addColorStop(0.7, 'rgba(18,10,4,.94)'); g.addColorStop(1, 'rgba(18,10,4,.94)');
    c.fillStyle = g; c.fill(); c.lineWidth = 1.5 * s; c.strokeStyle = '#c9974a'; c.stroke();
    const cs = getComputedStyle(btnEl), fs = parseFloat(cs.fontSize) * s;
    c.font = `${fs}px Metamorphous, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = `rgba(255,190,90,${0.55 * glow})`; c.shadowBlur = 10 * s;
    c.fillStyle = `rgb(${Math.min(255, 246 * glow)},${Math.min(255, 223 * glow)},${Math.min(255, 164 * glow)})`;
    if ('letterSpacing' in c) c.letterSpacing = (0.04 * fs) + 'px';
    c.fillText(btnEl.textContent, x + w / 2, y + h / 2 + fs * 0.04);
    c.restore();
  }
  function wrap(c, text, maxW) {
    const words = text.split(/\s+/), lines = []; let cur = [];
    for (const w of words) { const t = cur.concat(w).join(' '); if (cur.length && c.measureText(t).width > maxW) { lines.push(cur); cur = [w]; } else cur.push(w); }
    if (cur.length) lines.push(cur); return lines;
  }
  function drawFortune(c, s) {
    const op = +getComputedStyle(fxEl).opacity; if (op < 0.01 || getComputedStyle(fxEl).visibility === 'hidden' && op < 0.01) return;
    const R = fxEl.getBoundingClientRect(), k = R.width / fxEl.offsetWidth;          // k: its current scale (opens with a slight zoom)
    const fs = parseFloat(getComputedStyle(fxEl).fontSize);
    c.save(); c.globalAlpha = op;
    // map CSS px of the un-scaled box to canvas pixels
    c.translate(R.left * s, R.top * s); c.scale(k * s, k * s);
    const W0 = fxEl.offsetWidth, H0 = fxEl.offsetHeight;
    // panel, shadows and the double gold frame
    c.shadowColor = 'rgba(0,0,0,.85)'; c.shadowBlur = 70; c.shadowOffsetY = 12;
    rr(c, -5.5, -5.5, W0 + 11, H0 + 11, 16); c.fillStyle = 'rgba(201,151,74,.6)'; c.fill();
    c.shadowColor = 'rgba(255,170,70,.33)'; c.shadowBlur = 44; c.shadowOffsetY = 0;
    rr(c, -4, -4, W0 + 8, H0 + 8, 15); c.fillStyle = 'rgba(18,8,4,.96)'; c.fill();
    c.shadowBlur = 0;
    rr(c, 0, 0, W0, H0, 12);
    const g = c.createRadialGradient(W0 / 2, H0 * 0.28, 0, W0 / 2, H0 * 0.28, Math.max(W0, H0) * 0.75);
    g.addColorStop(0, 'rgba(78,24,32,.98)'); g.addColorStop(0.62, 'rgba(30,9,14,.98)'); g.addColorStop(1, 'rgba(13,4,7,.99)');
    c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#c9974a'; c.stroke();
    const inner = fxEl.querySelector('.fx-in').getBoundingClientRect(), off = (el) => { const b = el.getBoundingClientRect(); return { x: (b.left - R.left) / k, y: (b.top - R.top) / k, w: b.width / k, h: b.height / k }; };
    const I = off(fxEl.querySelector('.fx-in'));
    rr(c, I.x, I.y, I.w, I.h, 8); c.lineWidth = 1; c.strokeStyle = 'rgba(201,151,74,.5)'; c.stroke();
    // diamond corner studs
    for (const [cx, cy] of [[0, 0], [W0, 0], [0, H0], [W0, H0]]) {
      c.save(); c.translate(cx, cy); c.rotate(Math.PI / 4); c.shadowColor = 'rgba(255,190,90,.5)'; c.shadowBlur = 8;
      c.fillStyle = '#23090f'; c.fillRect(-6.5, -6.5, 13, 13); c.lineWidth = 1.5; c.strokeStyle = '#e0b264'; c.strokeRect(-6.5, -6.5, 13, 13); c.restore();
    }
    c.textBaseline = 'alphabetic';
    // numeral
    const num = off(document.getElementById('fx-num'));
    c.font = `${0.8 * fs}px Metamorphous, Georgia, serif`; c.fillStyle = 'rgba(214,170,92,.75)'; c.textAlign = 'center';
    if ('letterSpacing' in c) c.letterSpacing = (0.3 * 0.8 * fs) + 'px';
    c.fillText(document.getElementById('fx-num').textContent, num.x + num.w / 2, num.y + 0.8 * fs * 0.85);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    // title (may wrap)
    const ti = off(document.getElementById('fx-title')), tfs = 1.5 * fs;
    c.font = `${tfs}px Metamorphous, Georgia, serif`; c.fillStyle = '#f6dc98'; c.shadowColor = 'rgba(255,190,90,.5)'; c.shadowBlur = 14;
    wrap(c, document.getElementById('fx-title').textContent, ti.w).forEach((ln, i) => c.fillText(ln.join(' '), ti.x + ti.w / 2, ti.y + tfs * (0.92 + 1.15 * i)));
    c.shadowBlur = 0;
    // gold rule with a centre dot
    const ru = off(fxEl.querySelector('.fx-rule')), lg = c.createLinearGradient(ru.x, 0, ru.x + ru.w, 0);
    lg.addColorStop(0, 'rgba(201,151,74,0)'); lg.addColorStop(0.2, '#c9974a'); lg.addColorStop(0.8, '#c9974a'); lg.addColorStop(1, 'rgba(201,151,74,0)');
    c.fillStyle = lg; c.fillRect(ru.x, ru.y + ru.h / 2 - 0.5, ru.w, 1);
    c.beginPath(); c.arc(ru.x + ru.w / 2, ru.y + ru.h / 2, 3, 0, Math.PI * 2); c.fillStyle = '#e0b264'; c.fill();
    // the fortune: justified, with a gold drop capital spanning two lines
    const tx = off(document.getElementById('fx-text')), text = document.getElementById('fx-text').textContent, lh = 1.62 * fs;
    c.font = `${fs}px Metamorphous, Georgia, serif`;
    const capFs = 3.1 * fs; c.font = `${capFs}px Metamorphous, Georgia, serif`;
    const cap = (text.match(/^[\u201c\u2018"'(\[]*\S/) || [text.charAt(0)])[0], capW = c.measureText(cap).width + 0.1 * fs;
    c.font = `${fs}px Metamorphous, Georgia, serif`;
    const rest = text.slice(cap.length), words = rest.split(/\s+/);
    const lines = []; let cur = [], li = 0;
    const widthFor = i => tx.w - (i < 2 ? capW : 0);
    for (const w of words) { const t = cur.concat(w).join(' '); if (cur.length && c.measureText(t).width > widthFor(li)) { lines.push(cur); cur = [w]; li++; } else cur.push(w); }
    if (cur.length) lines.push(cur);
    c.save(); c.font = `${capFs}px Metamorphous, Georgia, serif`; c.fillStyle = '#f0c870'; c.shadowColor = 'rgba(255,180,80,.55)'; c.shadowBlur = 12; c.textAlign = 'left';
    c.fillText(cap, tx.x, tx.y + capFs * 0.82); c.restore();
    c.fillStyle = '#ecdcb8'; c.textAlign = 'left';
    lines.forEach((ln, i) => {
      const x0 = tx.x + (i < 2 ? capW : 0), y = tx.y + lh * i + fs * 1.18, avail = widthFor(i);
      if (i === lines.length - 1 || ln.length < 2) { c.fillText(ln.join(' '), x0, y); return; }
      const ww = ln.map(w => c.measureText(w).width), gap = (avail - ww.reduce((a, b) => a + b, 0)) / (ln.length - 1);
      let x = x0; ln.forEach((w, j) => { c.fillText(w, x, y); x += ww[j] + gap; });
    });
    // foot
    const ft = off(fxEl.querySelector('.fx-foot'));
    c.font = `italic ${0.78 * fs}px Georgia, serif`; c.fillStyle = 'rgba(214,170,92,.6)'; c.textAlign = 'center';
    c.fillText(fxEl.querySelector('.fx-foot').textContent, ft.x + ft.w / 2, ft.y + 0.78 * fs * 0.95);
    c.restore();
  }
  function compose() {
    const gl = document.querySelector('canvas'), c = rec.ctx;
    if (rec.canvas.width !== gl.width || rec.canvas.height !== gl.height) { rec.canvas.width = gl.width; rec.canvas.height = gl.height; }
    const s = gl.width / gl.clientWidth;                     // device pixels per CSS pixel
    c.globalAlpha = 1; c.drawImage(gl, 0, 0);
    drawButton(c, s); drawFortune(c, s);
  }
  // called by Zoltar's frame loop right after it draws (the WebGL picture is still there at that moment)
  window.__zoltarAfterFrame = () => { if (rec.on) compose(); };

  // ------------------------------------------------------------------ the scripted movie
  async function makeMovie() {
    const Z = window.__zoltar; if (!Z || rec.on) return;
    const btn = btnEl;
    rec.scripted = true; mb.textContent = '■ Stop movie';
    try {
      Z.music.ensure(true);
      if (Z.music.ctx && Z.music.ctx.state !== 'running') await Z.music.ctx.resume();
      Z.replay();                                            // the intro from the very beginning
      await wait(80);
      if (!start(Z, 'CT46.A8.Zoltar_movie')) return;
      await until(() => !rec.on || (btn.classList.contains('shown') && +getComputedStyle(btn).opacity > 0.98), 60000);
      if (!rec.on) return;
      await wait(2500);                                      // the button beckons
      Z.knowYourFuture();
      await until(() => !rec.on || Z.fx.state === 'open', 30000); if (!rec.on) return;
      await wait(HOLD * 1000);                               // the fortune holds
      Z.closeFortune(true);
      await until(() => !rec.on || (Z.sel.state === 'none' && +getComputedStyle(btn).opacity > 0.98), 30000);
      await wait(3000);
    } catch (e) { console.warn('movie:', e); }
    finally { rec.scripted = false; stop(); }
  }
  mb.addEventListener('click', e => { e.stopPropagation(); mb.blur(); if (rec.on) stop(); else makeMovie(); });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); if (e.repeat) return;
    if (k === 'm') { if (rec.on) stop(); else makeMovie(); }
    else if (k === 'v') { if (rec.on) stop(); else if (window.__zoltar) { start(window.__zoltar, 'CT46.A8.Zoltar_recording'); mb.textContent = '■ Stop recording'; } }
  });
  window.__zoltarMovie = { makeMovie, start: n => start(window.__zoltar, n || 'test'), stop, rec, HOLD };
})();
