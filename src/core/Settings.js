const STORAGE_KEY = 'operacao_agro_vila_settings_v1';

export const QUALITY_PRESETS = {
  baixo: {
    label: 'Baixo',
    pixelRatioMax: 1.0,
    shadowMapSize: 1024,
    shadowDistance: 120,
    fogDensity: 0.0014,
    treeDensity: 0.6,
    particleScale: 0.45,
    textureSize: 256,
  },
  medio: {
    label: 'Médio',
    pixelRatioMax: 1.5,
    shadowMapSize: 2048,
    shadowDistance: 180,
    fogDensity: 0.00105,
    treeDensity: 0.85,
    particleScale: 0.8,
    textureSize: 512,
  },
  alto: {
    label: 'Alto',
    pixelRatioMax: 2.0,
    shadowMapSize: 2048,
    shadowDistance: 240,
    fogDensity: 0.00082,
    treeDensity: 1.0,
    particleScale: 1.0,
    textureSize: 512,
  },
};

export class Settings {
  constructor(bus) {
    this.bus = bus;
    this.quality = 'medio';
    this.sensitivity = 0.0021;
    this.fov = 72;
    this.masterVolume = 0.7;
    this.muted = false;
    this.load();
  }

  get preset() {
    return QUALITY_PRESETS[this.quality] || QUALITY_PRESETS.medio;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (QUALITY_PRESETS[parsed.quality]) this.quality = parsed.quality;
        if (typeof parsed.sensitivity === 'number' && parsed.sensitivity > 0.0003 && parsed.sensitivity < 0.01) {
          this.sensitivity = parsed.sensitivity;
        }
        if (typeof parsed.fov === 'number' && parsed.fov >= 55 && parsed.fov <= 100) {
          this.fov = parsed.fov;
        }
        if (typeof parsed.masterVolume === 'number' && parsed.masterVolume >= 0 && parsed.masterVolume <= 1) {
          this.masterVolume = parsed.masterVolume;
        }
        if (typeof parsed.muted === 'boolean') this.muted = parsed.muted;
      }
    } catch {
      // Ignora localStorage corrompido
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        quality: this.quality,
        sensitivity: this.sensitivity,
        fov: this.fov,
        masterVolume: this.masterVolume,
        muted: this.muted,
      }));
    } catch {
      // Ignora erro de quota/privacidade
    }
  }

  setQuality(key) {
    if (!QUALITY_PRESETS[key]) return;
    this.quality = key;
    this.save();
    this.bus.emit('settings:changed', { key: 'quality', value: key, preset: this.preset });
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.0005, Math.min(0.006, val));
    this.save();
    this.bus.emit('settings:changed', { key: 'sensitivity', value: this.sensitivity });
  }

  setFov(val) {
    this.fov = Math.max(58, Math.min(95, val));
    this.save();
    this.bus.emit('settings:changed', { key: 'fov', value: this.fov });
  }

  setVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this.save();
    this.bus.emit('settings:changed', { key: 'masterVolume', value: this.masterVolume });
  }

  setMuted(flag) {
    this.muted = !!flag;
    this.save();
    this.bus.emit('settings:changed', { key: 'muted', value: this.muted });
  }
}
