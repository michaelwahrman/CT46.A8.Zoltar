// CT46.A3.Zoltar - eerie occult music, synthesised live with the Web Audio API (no audio files).
//
// Layers (all in D Hungarian minor: D E F G# A Bb C# - a nod to Zoltar's Carpathian roots):
//   drone  - low detuned saws on D with a slowly breathing low-pass
//   choir  - formant-filtered "ooh" chords, slow chord changes
//   bells  - sparse FM bell / music-box notes drowned in reverb and echo
//   wind   - filtered noise, sweeping
//   gongs  - an occasional distant deep bong
// swell(at) - the "Click to know your future!" crescendo: everything grows, a rising noise sweep and
//             choir cluster build for `swellTime` seconds, then a gong strike at the peak and a slow settle.
//
// Works with a live AudioContext (call start(), it schedules itself) or an OfflineAudioContext
// (call build(); scheduleUntil(seconds); then render) - the latter is used by the automated check.
(function () {
'use strict';

const SCALE = [0, 2, 3, 6, 7, 8, 11];           // D Hungarian minor, semitones above D
const D2 = 73.416;
const hz = semis => D2 * Math.pow(2, semis / 12);
// chords as semitone offsets from D2 (voiced across D3..D5)
const CHORDS = [
  [12, 15, 19, 24],     // Dm
  [8, 12, 15, 20],      // Bb
  [5, 8, 12, 17],       // Gm (G Bb D)
  [7, 11, 14, 19],      // A  (A C# E)
  [12, 15, 18, 24],     // D F G# D  (the eerie one)
  [8, 12, 15, 20],      // Bb
  [6, 11, 14, 18],      // G# ... dim colour
  [7, 11, 14, 19],      // A
];

class ZoltarMusic {
  constructor(ctx, opts = {}) {
    this.ctx = ctx;
    this.opts = Object.assign({ volume: 0.5, swellTime: 3.2, chordSeconds: 8, seed: 7 }, opts);
    this.built = false;
    this.nextBell = 0; this.nextChord = 0; this.nextGong = 0; this.chordIdx = 0;
    this.rnd = mulberry32(this.opts.seed);
    this.timer = null;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -20; this.comp.ratio.value = 3; this.comp.attack.value = 0.02; this.comp.release.value = 0.4;
    // brick-wall-ish limiter so the swell + gong can never clip
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -4; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002; this.limiter.release.value = 0.25;
    this.out = c.createGain(); this.out.gain.value = 0.85;
    this.master.connect(this.comp).connect(this.limiter).connect(this.out).connect(c.destination);

    // reverb: generated dark impulse response
    this.reverb = c.createConvolver();
    this.reverb.buffer = makeImpulse(c, 5.5, 3.2, this.rnd);
    this.wet = c.createGain(); this.wet.gain.value = 0.9;
    this.reverb.connect(this.wet).connect(this.master);
    this.dry = c.createGain(); this.dry.gain.value = 0.55;
    this.dry.connect(this.master);
    this.send = c.createGain(); this.send.connect(this.reverb);

    // echo for the bells
    this.delay = c.createDelay(2); this.delay.delayTime.value = 0.62;
    const fb = c.createGain(); fb.gain.value = 0.42;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(this.send);

    // intensity bus: everything that "grows" on a swell
    this.intensity = c.createGain(); this.intensity.gain.value = 1;
    this.intensity.connect(this.dry); this.intensity.connect(this.send);

    this._drone();
    this._wind();
    this.choirBus = c.createGain(); this.choirBus.gain.value = 0.9; this.choirBus.connect(this.intensity);
    this.bellBus = c.createGain(); this.bellBus.gain.value = 0.55;
    this.bellBus.connect(this.dry); this.bellBus.connect(this.send); this.bellBus.connect(this.delay);
  }

  _drone() {
    const c = this.ctx, t = c.currentTime;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 4;
    this.droneFilter = lp;
    const g = c.createGain(); g.gain.value = 0.16;
    lp.connect(g).connect(this.intensity);
    for (const [f, det, type] of [[hz(-12), -7, 'sawtooth'], [hz(-12), 6, 'sawtooth'], [hz(0), 3, 'sawtooth'], [hz(7), -4, 'triangle'], [hz(-24), 0, 'sine']]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const og = c.createGain(); og.gain.value = type === 'sine' ? 0.9 : 0.35;
      o.connect(og).connect(lp); o.start(t);
    }
    // breathing filter
    const lfo = c.createOscillator(); lfo.frequency.value = 0.045;
    const lg = c.createGain(); lg.gain.value = 140;
    lfo.connect(lg).connect(lp.frequency); lfo.start(t);
    // slow tremor
    const trem = c.createOscillator(); trem.frequency.value = 0.21;
    const tg = c.createGain(); tg.gain.value = 0.05;
    trem.connect(tg).connect(g.gain); trem.start(t);
  }

  _wind() {
    const c = this.ctx, t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 4, this.rnd); n.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 2.5;
    const g = c.createGain(); g.gain.value = 0.05;
    n.connect(bp).connect(g).connect(this.intensity);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 380;
    lfo.connect(lg).connect(bp.frequency);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.13;
    const lg2 = c.createGain(); lg2.gain.value = 0.03;
    lfo2.connect(lg2).connect(g.gain);
    n.start(t); lfo.start(t); lfo2.start(t);
  }

  // one formant "ooh" voice
  _choirNote(freq, t, dur, level, bus) {
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0;
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 420; f1.Q.value = 6;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 820; f2.Q.value = 8;
    const f3 = c.createBiquadFilter(); f3.type = 'bandpass'; f3.frequency.value = 2600; f3.Q.value = 10;
    const g3 = c.createGain(); g3.gain.value = 0.25;
    const mix = c.createGain(); mix.gain.value = 3.2;
    f1.connect(mix); f2.connect(mix); f3.connect(g3).connect(mix);
    mix.connect(out).connect(bus || this.choirBus);
    const vib = c.createOscillator(); vib.frequency.value = 4.6 + this.rnd() * 0.8;
    const vg = c.createGain(); vg.gain.value = 6;
    vib.connect(vg);
    for (const d of [-9, 0, 8]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d;
      vg.connect(o.detune);
      o.connect(f1); o.connect(f2); o.connect(f3);
      o.start(t); o.stop(t + dur + 0.1);
    }
    vib.start(t); vib.stop(t + dur + 0.1);
    const atk = Math.min(3, dur * 0.4), rel = Math.min(4, dur * 0.5);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(level, t + atk);
    out.gain.setValueAtTime(level, t + dur - rel);
    out.gain.linearRampToValueAtTime(0, t + dur);
  }

  _bell(freq, t, level) {
    const c = this.ctx;
    const car = c.createOscillator(); car.frequency.value = freq;
    const mod = c.createOscillator(); mod.frequency.value = freq * 3.51;
    const mg = c.createGain();
    mg.gain.setValueAtTime(freq * 2.2, t); mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + 2.5);
    mod.connect(mg).connect(car.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    car.connect(g).connect(this.bellBus);
    car.start(t); mod.start(t); car.stop(t + 4.6); mod.stop(t + 4.6);
  }

  _gong(t, level, freq = 55) {
    const c = this.ctx;
    const out = c.createGain(); out.connect(this.dry); out.connect(this.send);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(level, t + 0.03);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 9);
    for (const [r, a] of [[1, 1], [1.48, 0.6], [2.31, 0.45], [2.97, 0.3], [4.12, 0.18]]) {
      const car = c.createOscillator(); car.frequency.value = freq * r;
      const mod = c.createOscillator(); mod.frequency.value = freq * r * 1.41;
      const mg = c.createGain(); mg.gain.setValueAtTime(freq * r * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + 6);
      mod.connect(mg).connect(car.frequency);
      const g = c.createGain(); g.gain.value = a * 0.35;
      car.connect(g).connect(out);
      car.start(t); mod.start(t); car.stop(t + 9.1); mod.stop(t + 9.1);
    }
    // metallic shimmer
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 3, this.rnd);
    const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3800; hp.Q.value = 1.2;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(level * 0.25, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    n.connect(hp).connect(ng).connect(out); n.start(t); n.stop(t + 3);
  }

  // schedule all timed events (chords, bells, gongs) up to time `until` (seconds, context clock)
  scheduleUntil(until) {
    const R = this.rnd, cs = this.opts.chordSeconds;
    if (!this.nextChord) { const t = this.ctx.currentTime + 0.05; this.nextChord = t; this.nextBell = t + 2.5; this.nextGong = t + 6; }
    while (this.nextChord < until) {
      const ch = CHORDS[this.chordIdx % CHORDS.length];
      ch.forEach((s, i) => this._choirNote(hz(s), this.nextChord + i * 0.35, cs + 2.5, 0.05 - i * 0.006));
      this.chordIdx++; this.nextChord += cs;
    }
    while (this.nextBell < until) {
      const deg = SCALE[(R() * SCALE.length) | 0];
      const oct = R() < 0.6 ? 24 : 36;
      this._bell(hz(deg + oct), this.nextBell, 0.07 + R() * 0.05);
      if (R() < 0.3) {   // occasional falling pair
        const d2 = SCALE[(R() * SCALE.length) | 0];
        this._bell(hz(d2 + 24), this.nextBell + 0.31, 0.05);
      }
      this.nextBell += 1.4 + R() * 3.2;
    }
    while (this.nextGong < until) {
      this._gong(this.nextGong, 0.12, 49 + R() * 8);
      this.nextGong += 14 + R() * 12;
    }
  }

  start() {
    this.build();
    const c = this.ctx, t = c.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.opts.volume, t + (this.opts.fadeIn || 4));
    if (!this.timer && typeof setInterval === 'function' && !(c instanceof (window.OfflineAudioContext || function () {}))) {
      this.timer = setInterval(() => this.scheduleUntil(c.currentTime + 1.0), 250);
    }
    this.scheduleUntil(c.currentTime + 1.0);
  }

  setMuted(m) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : this.opts.volume, t, 0.3);
  }

  // crescendo for "Click to know your future!"; returns the time of the peak (gong)
  swell(at) {
    const c = this.ctx, t = at ?? c.currentTime, T = this.opts.swellTime, peak = t + T;
    // everything grows
    const ig = this.intensity.gain;
    ig.cancelScheduledValues(t); ig.setValueAtTime(ig.value || 1, t);
    ig.linearRampToValueAtTime(2.4, peak); ig.setTargetAtTime(1, peak + 0.3, 2.2);
    const df = this.droneFilter.frequency;
    df.cancelScheduledValues(t); df.setValueAtTime(260, t);
    df.exponentialRampToValueAtTime(1500, peak); df.setTargetAtTime(260, peak + 0.2, 2.5);
    // rising noise sweep
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, T + 1, this.rnd);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(180, t); bp.frequency.exponentialRampToValueAtTime(5200, peak);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.22, peak - 0.05);
    ng.gain.exponentialRampToValueAtTime(0.0001, peak + 0.25);
    n.connect(bp).connect(ng); ng.connect(this.dry); ng.connect(this.send);
    n.start(t); n.stop(peak + 0.4);
    // choir cluster rising in pitch, with tremolo
    const cl = c.createGain(); cl.gain.value = 1; cl.connect(this.intensity);
    const trem = c.createOscillator(); trem.frequency.setValueAtTime(3, t); trem.frequency.linearRampToValueAtTime(11, peak);
    const tg = c.createGain(); tg.gain.value = 0.45; trem.connect(tg).connect(cl.gain);
    trem.start(t); trem.stop(peak + 0.5);
    [24, 27, 30, 31].forEach((s, i) => this._choirNote(hz(s), t + i * 0.12, T + 0.6, 0.045, cl));
    // the strike
    this._gong(peak, 0.42, 41.2);
    this._bell(hz(36), peak + 0.02, 0.18);
    this._bell(hz(43), peak + 0.05, 0.12);
    // low boom
    const o = c.createOscillator(); o.frequency.setValueAtTime(90, peak); o.frequency.exponentialRampToValueAtTime(32, peak + 1.4);
    const og = c.createGain(); og.gain.setValueAtTime(0.0001, peak); og.gain.exponentialRampToValueAtTime(0.5, peak + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, peak + 2.2);
    o.connect(og).connect(this.dry); o.start(peak); o.stop(peak + 2.3);
    return peak;
  }
}

function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function noiseBuffer(c, seconds, rnd) {
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  return b;
}
function makeImpulse(c, seconds, decay, rnd) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = 0; i < len; i++) {
      const x = (rnd() * 2 - 1) * Math.pow(1 - i / len, decay);
      y += 0.28 * (x - y);              // darken
      d[i] = y * (i < c.sampleRate * 0.012 ? i / (c.sampleRate * 0.012) : 1);
    }
  }
  return b;
}

window.ZoltarMusic = ZoltarMusic;
})();
