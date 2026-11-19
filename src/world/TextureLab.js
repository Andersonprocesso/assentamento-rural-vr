import * as THREE from 'three';

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finalizeTexture(canvas, repeatX, repeatY, isColor = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export class TextureLab {
  constructor(size = 512) {
    this.size = size;
    this.materials = new Map();
    this.textures = [];
    this._buildAll();
  }

  _track(tex) {
    this.textures.push(tex);
    return tex;
  }

  _buildAll() {
    const S = this.size;

    // 1. Solo de Mata Atlântica (serapilheira, folhas caídas, terra úmida, musgo)
    this.materials.set('forestFloor', this._createForestFloor(S));

    // 2. Área Comum limpa (grama rala + terra batida solar)
    this.materials.set('commonGround', this._createCommonGround(S));

    // 3. Terra batida (trilhas, clareiras dos lotes, praça)
    this.materials.set('dirt', this._createDirt(S));

    // 4. Casca de árvore tropical
    this.materials.set('bark', this._createBark(S));

    // 5. Madeira serrada / tora da floresta (mourões, galpão, casas)
    this.materials.set('wood', this._createWood(S, '#7d5636', '#4f331d'));
    this.materials.set('woodLight', this._createWood(S, '#b5885b', '#7b5532'));
    this.materials.set('woodDark', this._createWood(S, '#4f3523', '#2d1c11'));

    // 6. Parede de Pau-a-Pique / Barro artesanal (construções da Agro Vila)
    this.materials.set('mudWall', this._createMudWall(S));

    // 7. Telhado de barro artesanal
    this.materials.set('clayRoof', this._createClayRoof(S));

    // 8. Telhado de palha / sapê da floresta
    this.materials.set('thatch', this._createThatch(S));

    // 9. Lona de barraca de acampamento
    this.materials.set('tentCanvas', this._createTentCanvas(S));

    // 10. Solo de lavoura arada com fileiras verdes
    this.materials.set('cropField', this._createCropField(S));

    // 11. Água do rio
    this.materials.set('riverWater', this._createWater(S));

    // 12. Areia / cascalho da margem do rio
    this.materials.set('sand', this._createDirt(S, '#c7b08a', '#9c8460', 22));

    // 13. Folhagem de árvore (com detalhe orgânico em vez de cor chapada)
    this.materials.set('foliage', this._createFoliage(S));

    // 14. Metal / ferro rústico (arame da cerca, ferragens)
    this.materials.set('iron', new THREE.MeshStandardMaterial({
      color: 0x626b6e,
      roughness: 0.52,
      metalness: 0.72,
    }));

    // 15. Grama de quadra/campo
    this.materials.set('fieldGrass', this._createCommonGround(S, '#3d7d37', '#2c6128', 12));
  }

  get(name) {
    return this.materials.get(name);
  }

  _createForestFloor(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = '#23361c';
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    // Manchas de musgo e terra úmida
    for (let i = 0; i < 600; i++) {
      const x = hash2(i, 1) * S;
      const y = hash2(i, 2) * S;
      const r = 8 + hash2(i, 3) * 32;
      const tone = hash2(i, 4);
      ctx.fillStyle = tone < 0.35
        ? 'rgba(30, 52, 22, 0.42)'
        : tone < 0.7
          ? 'rgba(54, 42, 24, 0.38)'
          : 'rgba(42, 68, 28, 0.36)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Folhas secas e gravetos de serapilheira
    for (let i = 0; i < 2400; i++) {
      const x = hash2(i, 11) * S;
      const y = hash2(i, 12) * S;
      const w = 2 + hash2(i, 13) * 6;
      const h = 1.5 + hash2(i, 14) * 3;
      const ang = hash2(i, 15) * Math.PI;
      const k = hash2(i, 16);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = k < 0.4 ? '#4d3a21' : k < 0.75 ? '#3b5225' : '#6b4e2b';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();

      bctx.fillStyle = k > 0.5 ? '#b0b0b0' : '#555555';
      bctx.fillRect(x, y, 2, 2);
    }

    const map = this._track(finalizeTexture(c, 180, 180, true));
    const bumpMap = this._track(finalizeTexture(b, 180, 180, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.35,
      roughness: 0.94,
      metalness: 0.0,
    });
  }

  _createCommonGround(S, base = '#6f8f47', dark = '#557034', rep = 24) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 360; i++) {
      const x = hash2(i, 21) * S;
      const y = hash2(i, 22) * S;
      const r = 10 + hash2(i, 23) * 36;
      ctx.fillStyle = hash2(i, 24) > 0.45 ? 'rgba(138, 112, 74, 0.16)' : `${dark}55`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 3000; i++) {
      const x = hash2(i, 25) * S;
      const y = hash2(i, 26) * S;
      const k = hash2(i, 27);
      ctx.fillStyle = k < 0.45 ? '#87a857' : k < 0.8 ? '#587535' : '#9c8659';
      ctx.fillRect(x, y, 2, 4);
      bctx.fillStyle = k > 0.5 ? '#a8a8a8' : '#5c5c5c';
      bctx.fillRect(x, y, 2, 3);
    }

    const map = this._track(finalizeTexture(c, rep, rep, true));
    const bumpMap = this._track(finalizeTexture(b, rep, rep, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.22,
      roughness: 0.92,
      metalness: 0,
    });
  }

  _createDirt(S, base = '#9e754d', dark = '#755233', rep = 14) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 420; i++) {
      const x = hash2(i, 31) * S;
      const y = hash2(i, 32) * S;
      const r = 6 + hash2(i, 33) * 28;
      ctx.fillStyle = hash2(i, 34) > 0.5 ? `${dark}44` : 'rgba(210, 178, 134, 0.22)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 2400; i++) {
      const x = hash2(i, 35) * S;
      const y = hash2(i, 36) * S;
      const sz = 1 + hash2(i, 37) * 2.5;
      const bright = hash2(i, 38) > 0.5;
      ctx.fillStyle = bright ? 'rgba(225, 200, 165, 0.35)' : 'rgba(65, 42, 24, 0.35)';
      ctx.fillRect(x, y, sz, sz);
      bctx.fillStyle = bright ? '#b8b8b8' : '#4a4a4a';
      bctx.fillRect(x, y, sz, sz);
    }

    const map = this._track(finalizeTexture(c, rep, rep, true));
    const bumpMap = this._track(finalizeTexture(b, rep, rep, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.28,
      roughness: 0.95,
      metalness: 0,
    });
  }

  _createBark(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = '#4e3726';
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    // Sulcos verticais de casca
    for (let i = 0; i < 420; i++) {
      const x = hash2(i, 41) * S;
      const y = hash2(i, 42) * S;
      const w = 2 + hash2(i, 43) * 8;
      const h = 30 + hash2(i, 44) * 140;
      const k = hash2(i, 45);
      ctx.fillStyle = k < 0.4 ? '#342215' : k < 0.8 ? '#654932' : '#4d5c37';
      ctx.fillRect(x, y, w, h);
      bctx.fillStyle = k < 0.4 ? '#303030' : '#c8c8c8';
      bctx.fillRect(x, y, w, h);
    }

    const map = this._track(finalizeTexture(c, 2, 3, true));
    const bumpMap = this._track(finalizeTexture(b, 2, 3, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.45,
      roughness: 0.92,
      metalness: 0,
    });
  }

  _createWood(S, base, dark) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    const planks = 8;
    const ph = S / planks;
    for (let p = 0; p < planks; p++) {
      const y = p * ph;
      ctx.fillStyle = p % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, y, S, ph);
      // Junta entre tábuas
      ctx.fillStyle = dark;
      ctx.fillRect(0, y, S, 2);
      bctx.fillStyle = '#222222';
      bctx.fillRect(0, y, S, 3);
    }

    // Veios da madeira
    for (let i = 0; i < 650; i++) {
      const x = hash2(i, 51) * S;
      const y = hash2(i, 52) * S;
      const w = 30 + hash2(i, 53) * 120;
      ctx.fillStyle = hash2(i, 54) > 0.5 ? 'rgba(40,22,10,0.16)' : 'rgba(240,205,160,0.1)';
      ctx.fillRect(x, y, w, 1.8);
      bctx.fillStyle = hash2(i, 54) > 0.5 ? '#666666' : '#a0a0a0';
      bctx.fillRect(x, y, w, 1.5);
    }

    const map = this._track(finalizeTexture(c, 2, 2, true));
    const bumpMap = this._track(finalizeTexture(b, 2, 2, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.25,
      roughness: 0.84,
      metalness: 0,
    });
  }

  _createMudWall(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = '#d9c29c';
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    // Textura irregular de reboco artesanal / pau-a-pique
    for (let i = 0; i < 700; i++) {
      const x = hash2(i, 61) * S;
      const y = hash2(i, 62) * S;
      const r = 6 + hash2(i, 63) * 26;
      const k = hash2(i, 64);
      ctx.fillStyle = k < 0.5 ? 'rgba(166, 128, 86, 0.16)' : 'rgba(248, 236, 212, 0.18)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      bctx.fillStyle = k < 0.5 ? 'rgba(100,100,100,0.35)' : 'rgba(170,170,170,0.35)';
      bctx.beginPath();
      bctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      bctx.fill();
    }

    // Manchas de umidade perto da base
    const grad = ctx.createLinearGradient(0, S * 0.72, 0, S);
    grad.addColorStop(0, 'rgba(92, 66, 38, 0)');
    grad.addColorStop(1, 'rgba(92, 66, 38, 0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, S * 0.72, S, S * 0.28);

    const map = this._track(finalizeTexture(c, 2, 1, true));
    const bumpMap = this._track(finalizeTexture(b, 2, 1, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.3,
      roughness: 0.9,
      metalness: 0,
    });
  }

  _createClayRoof(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = '#9c432b';
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#777777';
    bctx.fillRect(0, 0, S, S);

    const cols = 16;
    const rows = 12;
    const cw = S / cols;
    const rh = S / rows;

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cw;
        const y = r * rh;
        const shade = (hash2(col, r) - 0.5) * 28;
        const rr = Math.min(255, Math.max(0, 158 + shade));
        const gg = Math.min(255, Math.max(0, 68 + shade * 0.5));
        const bb = Math.min(255, Math.max(0, 44 + shade * 0.4));
        ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        ctx.fillRect(x + 1, y + 1, cw - 2, rh - 2);
        ctx.fillStyle = 'rgba(30, 10, 5, 0.45)';
        ctx.fillRect(x, y + rh - 3, cw, 3);
        ctx.fillRect(x, y, 2, rh);

        bctx.fillStyle = '#d4d4d4';
        bctx.fillRect(x + 3, y + 2, cw - 6, rh - 5);
        bctx.fillStyle = '#2a2a2a';
        bctx.fillRect(x, y + rh - 3, cw, 3);
      }
    }

    const map = this._track(finalizeTexture(c, 3, 3, true));
    const bumpMap = this._track(finalizeTexture(b, 3, 3, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.4,
      roughness: 0.85,
      metalness: 0,
    });
  }

  _createThatch(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = '#a88c52';
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 3400; i++) {
      const x = hash2(i, 71) * S;
      const y = hash2(i, 72) * S;
      const len = 12 + hash2(i, 73) * 32;
      const k = hash2(i, 74);
      ctx.fillStyle = k < 0.35 ? '#7c6232' : k < 0.75 ? '#c4a664' : '#d6bd7c';
      ctx.fillRect(x, y, 2, len);
      bctx.fillStyle = k > 0.5 ? '#c4c4c4' : '#404040';
      bctx.fillRect(x, y, 2, len);
    }

    const map = this._track(finalizeTexture(c, 3, 3, true));
    const bumpMap = this._track(finalizeTexture(b, 3, 3, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.45,
      roughness: 0.94,
      metalness: 0,
    });
  }

  _createTentCanvas(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e6decb';
    ctx.fillRect(0, 0, S, S);

    // Trama de lona
    ctx.fillStyle = 'rgba(70, 58, 42, 0.08)';
    for (let y = 0; y < S; y += 4) ctx.fillRect(0, y, S, 1);
    for (let x = 0; x < S; x += 4) ctx.fillRect(x, 0, 1, S);

    // Manchas leves de uso em campo
    for (let i = 0; i < 120; i++) {
      const x = hash2(i, 81) * S;
      const y = hash2(i, 82) * S;
      const r = 10 + hash2(i, 83) * 30;
      ctx.fillStyle = 'rgba(115, 92, 62, 0.07)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const map = this._track(finalizeTexture(c, 2, 2, true));
    return new THREE.MeshStandardMaterial({
      map,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }

  _createCropField(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5e4028';
    ctx.fillRect(0, 0, S, S);

    const rows = 10;
    const rh = S / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      ctx.fillStyle = '#472f1c';
      ctx.fillRect(0, y, S, rh * 0.25);
      ctx.fillStyle = '#4f8230';
      ctx.fillRect(0, y + rh * 0.35, S, rh * 0.32);
      for (let i = 0; i < 40; i++) {
        const x = hash2(r * 40 + i, 91) * S;
        ctx.fillStyle = i % 2 ? '#78b043' : '#3d6e24';
        ctx.beginPath();
        ctx.arc(x, y + rh * 0.5, 4 + hash2(i, r) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const map = this._track(finalizeTexture(c, 3, 3, true));
    return new THREE.MeshStandardMaterial({
      map,
      roughness: 0.9,
      metalness: 0,
    });
  }

  _createWater(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1f5c78';
    ctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 450; i++) {
      const x = hash2(i, 101) * S;
      const y = hash2(i, 102) * S;
      const w = 16 + hash2(i, 103) * 56;
      ctx.fillStyle = hash2(i, 104) > 0.5 ? 'rgba(130, 200, 224, 0.16)' : 'rgba(12, 42, 58, 0.22)';
      ctx.fillRect(x, y, w, 3);
    }

    const map = this._track(finalizeTexture(c, 8, 36, true));
    return new THREE.MeshStandardMaterial({
      map,
      color: 0x3b86a8,
      roughness: 0.18,
      metalness: 0.25,
      transparent: true,
      opacity: 0.92,
    });
  }

  _createFoliage(S) {
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const b = makeCanvas(S);
    const bctx = b.getContext('2d');

    ctx.fillStyle = '#c8d6be';
    ctx.fillRect(0, 0, S, S);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, S, S);

    // Folhas sobrepostas em escala neutra (a cor final vem de instanceColor!)
    for (let i = 0; i < 1600; i++) {
      const x = hash2(i, 111) * S;
      const y = hash2(i, 112) * S;
      const r = 4 + hash2(i, 113) * 14;
      const v = 150 + Math.floor(hash2(i, 114) * 100);
      ctx.fillStyle = `rgb(${(v * 0.92) | 0}, ${v}, ${(v * 0.85) | 0})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      const bv = 60 + Math.floor(hash2(i, 115) * 160);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.beginPath();
      bctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
      bctx.fill();
    }

    const map = this._track(finalizeTexture(c, 2, 2, true));
    const bumpMap = this._track(finalizeTexture(b, 2, 2, false));
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.35,
      roughness: 0.86,
      metalness: 0,
    });
  }

  dispose() {
    for (const tex of this.textures) tex.dispose();
    for (const mat of this.materials.values()) mat.dispose();
  }
}
