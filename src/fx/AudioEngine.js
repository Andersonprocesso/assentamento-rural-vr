export class AudioEngine {
  constructor(settings, bus) {
    this.settings = settings;
    this.bus = bus;
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.windGain = null;
    this.started = false;
    this._birdTimer = 3.5;

    this.bus.on('settings:changed', () => this._syncVolume());
    this.bus.on('site:completed', () => this.playMilestone());
    this.bus.on('phase:completed', () => this.playMilestone(true));
  }

  init() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this._syncVolume();

    // Buffer de ruído branco reutilizável para vento, passos, impactos e queda de árvores
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Vento contínuo na floresta
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.045;

    windSrc.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    windSrc.start();

    this.started = true;
  }

  _syncVolume() {
    if (!this.master || !this.ctx) return;
    const v = this.settings.muted ? 0 : this.settings.masterVolume;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.04);
  }

  update(dt, isNight) {
    if (!this.started || !this.ctx || this.ctx.state !== 'running') return;
    this._birdTimer -= dt;
    if (this._birdTimer <= 0) {
      this._birdTimer = isNight ? 5 + Math.random() * 7 : 3 + Math.random() * 5.5;
      if (isNight) {
        this._playCricket();
      } else {
        this._playBird();
      }
    }
  }

  _playBird() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = 1800 + Math.random() * 1400;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.18);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.032, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  _playCricket() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 3900 + Math.random() * 400;
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      g.gain.linearRampToValueAtTime(0.014, t + i * 0.06 + 0.01);
      g.gain.linearRampToValueAtTime(0.0001, t + i * 0.06 + 0.04);
    }
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  playFootstep(surface = 'dirt', running = false) {
    if (!this.started || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = surface === 'forest' ? 950 : surface === 'grass' ? 700 : 520;

    const g = this.ctx.createGain();
    const vol = running ? 0.12 : 0.075;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 1.2, 0.11);
  }

  playChop() {
    if (!this.started || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    // Pancada seca de madeira
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195 + Math.random() * 35, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.09);
    og.gain.setValueAtTime(0.32, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    osc.connect(og);
    og.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);

    // Estalo fibroso
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.master);
    src.start(t, Math.random(), 0.09);
  }

  playTreeFall() {
    if (!this.started || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    // Estalo do tronco rachando
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.9);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.26, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(t, 0.1, 1.1);

    // Baque grave ao tocar o solo
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(92, t + 0.65);
    thud.frequency.exponentialRampToValueAtTime(32, t + 1.0);
    tg.gain.setValueAtTime(0.0001, t + 0.62);
    tg.gain.linearRampToValueAtTime(0.32, t + 0.68);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.08);
    thud.connect(tg);
    tg.connect(this.master);
    thud.start(t + 0.62);
    thud.stop(t + 1.1);
  }

  playHammer() {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.065);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playHoe() {
    if (!this.started || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 620;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(t, Math.random(), 0.16);
  }

  playRadio() {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1040, t);
    osc.frequency.setValueAtTime(1380, t + 0.07);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playMilestone(major = false) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = major ? [392, 493.88, 587.33, 783.99] : [440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const st = t + idx * 0.095;
      osc.frequency.setValueAtTime(freq, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.13, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.36);
      osc.connect(g);
      g.connect(this.master);
      osc.start(st);
      osc.stop(st + 0.38);
    });
  }
}
