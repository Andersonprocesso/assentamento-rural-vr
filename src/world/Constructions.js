import * as THREE from 'three';
import { LOTS } from './SettlementMath.js';

function makeSignTexture(title, subtitle, bg = '#2b2016', fg = '#f4ead7') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#c9a66b';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = fg;
  ctx.font = 'bold 42px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, subtitle ? 62 : 80);

  if (subtitle) {
    ctx.fillStyle = '#d4b483';
    ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(subtitle, 256, 114);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWoodSign(title, subtitle, width = 3.6, height = 1.1) {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4f3523, roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.5, 6), postMat);
  post.position.y = 1.25;
  group.add(post);

  const boardTex = makeSignTexture(title, subtitle);
  const boardMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    roughness: 0.85,
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.12), boardMat);
  board.position.y = 2.4;
  group.add(board);

  return group;
}

// Definição das 6 obras comunitárias da Agro Vila (na Área Comum limpa de 25.000 m²)
export const COMMUNITY_DEFS = [
  {
    id: 'serraria',
    name: 'Serraria & Galpão',
    desc: 'Processa madeira da floresta (+35% velocidade de obra)',
    x: 36,
    z: -24,
    w: 15,
    h: 5.0,
    d: 10,
    roofType: 'thatch',
    cost: { wood: 110, thatch: 45, clay: 35 },
    workNeeded: 100,
    order: 1,
  },
  {
    id: 'poco',
    name: 'Poço & Caixa d\'Água',
    desc: 'Abastece acampamento, hortas e famílias',
    x: -46,
    z: -8,
    w: 7,
    h: 8.2,
    d: 7,
    roofType: 'wood',
    isTower: true,
    cost: { wood: 85, thatch: 20, clay: 55 },
    workNeeded: 90,
    order: 2,
  },
  {
    id: 'horta',
    name: 'Horta Comunitária',
    desc: 'Estufas de bambu e canteiros para alimentar as 30 famílias',
    x: 0,
    z: 42,
    w: 18,
    h: 2.6,
    d: 14,
    isGarden: true,
    cost: { wood: 75, thatch: 60, clay: 40 },
    workNeeded: 95,
    order: 3,
  },
  {
    id: 'escola',
    name: 'Escola da Agro Vila',
    desc: 'Educação comunitária para os filhos das 30 famílias',
    x: 0,
    z: -62,
    w: 20,
    h: 5.8,
    d: 10,
    roofType: 'clay',
    cost: { wood: 210, thatch: 75, clay: 110 },
    workNeeded: 160,
    order: 4,
  },
  {
    id: 'posto',
    name: 'Posto de Saúde',
    desc: 'Cuidados médicos e mais vigor para os trabalhadores',
    x: -34,
    z: -32,
    w: 12,
    h: 4.5,
    d: 8.5,
    roofType: 'clay',
    isClinic: true,
    cost: { wood: 150, thatch: 50, clay: 95 },
    workNeeded: 130,
    order: 5,
  },
  {
    id: 'praca',
    name: 'Praça & Quadra',
    desc: 'Convivência, reuniões comunitárias e lazer',
    x: 26,
    z: 18,
    w: 18,
    h: 0.4,
    d: 26,
    isPlaza: true,
    cost: { wood: 120, thatch: 35, clay: 70 },
    workNeeded: 110,
    order: 6,
  },
];

export class Constructions {
  constructor(scene, textures, bus) {
    this.scene = scene;
    this.textures = textures;
    this.bus = bus;

    this.communitySites = new Map();
    this.lotSites = new Map(); // lotId -> site object
    this.allSites = [];
    this.prioritySiteId = 'serraria'; // obra priorizada para mutirão

    this._buildCommunitySites();
    this._buildLotSites();
  }

  _buildStakes(w, d) {
    const g = new THREE.Group();
    const stakeMat = this.textures.get('woodDark');
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe3b84f, roughness: 0.85 });
    const hw = w / 2 + 0.6;
    const hd = d / 2 + 0.6;
    const corners = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
    const stakeGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.35, 6);
    for (const [cx, cz] of corners) {
      const m = new THREE.Mesh(stakeGeo, stakeMat);
      m.position.set(cx, 0.67, cz);
      m.castShadow = true;
      g.add(m);
    }
    // Fita/corda de demarcação do canteiro
    const barX = new THREE.BoxGeometry(hw * 2, 0.06, 0.06);
    const barZ = new THREE.BoxGeometry(0.06, 0.06, hd * 2);
    const b1 = new THREE.Mesh(barX, ropeMat);
    b1.position.set(0, 1.05, -hd);
    const b2 = new THREE.Mesh(barX, ropeMat);
    b2.position.set(0, 1.05, hd);
    const b3 = new THREE.Mesh(barZ, ropeMat);
    b3.position.set(-hw, 1.05, 0);
    const b4 = new THREE.Mesh(barZ, ropeMat);
    b4.position.set(hw, 1.05, 0);
    g.add(b1, b2, b3, b4);

    // Chão de terra batida do canteiro
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 3.2, d + 3.2),
      this.textures.get('dirt')
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.05;
    pad.receiveShadow = true;
    g.add(pad);

    return g;
  }

  _buildBuildingStages(def) {
    const root = new THREE.Group();
    root.position.set(def.x, 0, def.z);

    // Estágio 0: Estacas + placa do canteiro
    const stage0 = this._buildStakes(def.w, def.d);
    const sign = createWoodSign(def.name.toUpperCase(), 'EM CONSTRUÇÃO', 4.2, 1.2);
    sign.position.set(0, 0, def.d / 2 + 2.2);
    stage0.add(sign);
    root.add(stage0);

    // Estágio 1 (25%+): Alicerce e pilares de toras da floresta
    const stage1 = new THREE.Group();
    stage1.visible = false;

    // Estágio 2 (60%+): Paredes de madeira/pau-a-pique ou estrutura intermediária
    const stage2 = new THREE.Group();
    stage2.visible = false;

    // Estágio 3 (100%): Telhado completo, detalhes e placa definitiva
    const stage3 = new THREE.Group();
    stage3.visible = false;

    const woodMat = this.textures.get('wood');
    const woodDark = this.textures.get('woodDark');
    const mudMat = this.textures.get('mudWall');
    const roofMat = def.roofType === 'clay'
      ? this.textures.get('clayRoof')
      : def.roofType === 'thatch'
        ? this.textures.get('thatch')
        : this.textures.get('woodLight');

    if (def.isTower) {
      // Poço & Caixa d'água elevada em toras de madeira
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.8, 12), mudMat);
      base.position.y = 0.4;
      base.castShadow = true;
      base.receiveShadow = true;
      stage1.add(base);

      const postGeo = new THREE.CylinderGeometry(0.22, 0.28, 6.4, 8);
      for (const [px, pz] of [[-1.7, -1.7], [1.7, -1.7], [1.7, 1.7], [-1.7, 1.7]]) {
        const p = new THREE.Mesh(postGeo, woodDark);
        p.position.set(px, 3.2, pz);
        p.castShadow = true;
        stage1.add(p);
      }

      const deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 4.4), woodMat);
      deck.position.y = 5.4;
      deck.castShadow = true;
      stage2.add(deck);

      const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 3.2, 14), woodMat);
      tank.position.y = 7.1;
      tank.castShadow = true;
      stage2.add(tank);

      const lid = new THREE.Mesh(new THREE.ConeGeometry(2.55, 1.5, 14), this.textures.get('thatch'));
      lid.position.y = 9.45;
      lid.castShadow = true;
      stage3.add(lid);

      const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 10), mudMat);
      well.position.set(3.2, 0.45, 2.2);
      stage3.add(well);
    } else if (def.isGarden) {
      // Horta comunitária com canteiros e estufas rústicas
      for (let r = 0; r < 4; r++) {
        const bed = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.35, 2.0), woodDark);
        bed.position.set(0, 0.2, -4.5 + r * 3.0);
        bed.receiveShadow = true;
        stage1.add(bed);
      }
      // Armações de bambu das duas estufas laterais
      for (const sx of [-6.5, 6.5]) {
        for (let z = -5; z <= 5; z += 2.5) {
          const arch = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.3, 0.16), woodMat);
          arch.position.set(sx, 1.15, z);
          stage2.add(arch);
        }
      }
      // Canteiros verdejantes + cobertura translúcida das estufas
      const cropMat = this.textures.get('cropField');
      for (let r = 0; r < 4; r++) {
        const soil = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.16, 1.7), cropMat);
        soil.position.set(0, 0.42, -4.5 + r * 3.0);
        stage3.add(soil);
      }
      const coverMat = new THREE.MeshStandardMaterial({
        color: 0xd9f2e6,
        transparent: true,
        opacity: 0.45,
        roughness: 0.4,
      });
      for (const sx of [-6.5, 6.5]) {
        const gh = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.35, 10.6), coverMat);
        gh.position.set(sx, 1.2, 0);
        stage3.add(gh);
      }
    } else if (def.isPlaza) {
      // Praça comunitária, quadra de esportes e bancos de madeira
      const court = new THREE.Mesh(
        new THREE.BoxGeometry(16, 0.14, 24),
        this.textures.get('fieldGrass')
      );
      court.position.y = 0.08;
      court.receiveShadow = true;
      stage1.add(court);

      const lineMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.9 });
      const midLine = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.04, 0.18), lineMat);
      midLine.position.y = 0.17;
      stage2.add(midLine);

      for (const gz of [-11.5, 11.5]) {
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.3, 6), lineMat);
        p1.position.set(-3.2, 1.15, gz);
        const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.3, 6), lineMat);
        p2.position.set(3.2, 1.15, gz);
        const top = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.14, 0.14), lineMat);
        top.position.set(0, 2.3, gz);
        stage3.add(p1, p2, top);
      }
      // Bancos de tora ao redor
      for (let i = -8; i <= 8; i += 8) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 3.0), woodMat);
        bench.position.set(-9.6, 0.25, i);
        bench.castShadow = true;
        stage3.add(bench);
      }
    } else {
      // Edifícios de madeira/barro (Serraria, Escola, Posto)
      const floor = new THREE.Mesh(new THREE.BoxGeometry(def.w + 0.4, 0.35, def.d + 0.4), woodDark);
      floor.position.y = 0.18;
      floor.receiveShadow = true;
      stage1.add(floor);

      // Pilares de tora nos cantos e meios
      const pillarGeo = new THREE.CylinderGeometry(0.2, 0.24, def.h, 7);
      for (const px of [-def.w / 2 + 0.3, 0, def.w / 2 - 0.3]) {
        for (const pz of [-def.d / 2 + 0.3, def.d / 2 - 0.3]) {
          const p = new THREE.Mesh(pillarGeo, woodDark);
          p.position.set(px, def.h / 2 + 0.2, pz);
          p.castShadow = true;
          stage1.add(p);
        }
      }

      // Paredes de pau-a-pique ou tábuas
      const wallMat = def.id === 'serraria' ? woodMat : mudMat;
      const body = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), wallMat);
      body.position.y = def.h / 2 + 0.2;
      body.castShadow = true;
      body.receiveShadow = true;
      stage2.add(body);

      // Porta e janelas
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.5, 0.18), woodDark);
      door.position.set(0, 1.45, def.d / 2 + 0.05);
      stage2.add(door);

      const winMat = new THREE.MeshStandardMaterial({ color: 0x7db3d1, roughness: 0.25, metalness: 0.2 });
      const winCount = Math.max(2, Math.floor(def.w / 5));
      for (let i = 0; i < winCount; i++) {
        const wx = -def.w / 2 + (def.w / (winCount + 1)) * (i + 1);
        if (Math.abs(wx) < 1.6) continue;
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.16), winMat);
        win.position.set(wx, def.h * 0.56, def.d / 2 + 0.06);
        stage2.add(win);
      }

      // Telhado de duas águas / piramidal com beiral
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(def.w, def.d) * 0.78, 2.8, 4),
        roofMat
      );
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(def.w / Math.max(def.w, def.d), 1, def.d / Math.max(def.w, def.d));
      roof.position.y = def.h + 1.55;
      roof.castShadow = true;
      roof.receiveShadow = true;
      stage3.add(roof);

      // Cruz verde no Posto de Saúde
      if (def.isClinic) {
        const crossMat = new THREE.MeshStandardMaterial({ color: 0x1e6b34, roughness: 0.6 });
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.18), crossMat);
        v.position.set(0, def.h - 0.9, def.d / 2 + 0.12);
        const h = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.18), crossMat);
        h.position.set(0, def.h - 0.9, def.d / 2 + 0.12);
        stage3.add(v, h);
      }
    }

    const doneSign = createWoodSign(def.name.toUpperCase(), 'CONCLUÍDO ✓', 4.2, 1.2);
    doneSign.position.set(0, 0, def.d / 2 + 2.2);
    stage3.add(doneSign);

    root.add(stage1, stage2, stage3);
    this.scene.add(root);

    return { root, stage0, stage1, stage2, stage3 };
  }

  _buildCommunitySites() {
    for (const def of COMMUNITY_DEFS) {
      const visuals = this._buildBuildingStages(def);
      const site = {
        id: def.id,
        kind: 'community',
        name: def.name,
        desc: def.desc,
        x: def.x,
        z: def.z,
        radius: Math.max(def.w, def.d) * 0.65 + 2.5,
        cost: { ...def.cost },
        delivered: { wood: 0, thatch: 0, clay: 0 },
        work: 0,
        workNeeded: def.workNeeded,
        progress: 0, // 0..1
        completed: false,
        stage: 0,
        order: def.order,
        visuals,
      };
      this.communitySites.set(def.id, site);
      this.allSites.push(site);
    }
  }

  _buildLotSites() {
    const woodMat = this.textures.get('wood');
    const woodDark = this.textures.get('woodDark');
    const mudMat = this.textures.get('mudWall');
    const clayRoof = this.textures.get('clayRoof');
    const thatchRoof = this.textures.get('thatch');
    const dirtMat = this.textures.get('dirt');
    const cropMat = this.textures.get('cropField');

    for (const lot of LOTS) {
      const root = new THREE.Group();
      root.position.set(lot.housePos.x, 0, lot.housePos.z);
      root.rotation.y = lot.yaw;

      // Estágio 0: oculto até começar a limpar o lote (> 4% progresso)
      const stage0 = new THREE.Group();
      stage0.visible = false;
      const clearing = new THREE.Mesh(new THREE.CircleGeometry(14.5, 16), dirtMat);
      clearing.rotation.x = -Math.PI / 2;
      clearing.position.y = 0.04;
      clearing.receiveShadow = true;
      stage0.add(clearing);

      // Estacas da casa da família
      for (const [cx, cz] of [[-3.4, -3.4], [3.4, -3.4], [3.4, 3.4], [-3.4, 3.4]]) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 5), woodDark);
        st.position.set(cx, 0.55, cz);
        stage0.add(st);
      }

      // Estágio 1 (25%+): Alicerce e pilares de tora
      const stage1 = new THREE.Group();
      stage1.visible = false;
      const base = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 6.4), woodDark);
      base.position.y = 0.15;
      base.receiveShadow = true;
      stage1.add(base);
      for (const [px, pz] of [[-3.0, -2.9], [3.0, -2.9], [3.0, 2.9], [-3.0, 2.9]]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.3, 6), woodDark);
        p.position.set(px, 1.65, pz);
        p.castShadow = true;
        stage1.add(p);
      }

      // Estágio 2 (60%+): Paredes de pau-a-pique/madeira
      const stage2 = new THREE.Group();
      stage2.visible = false;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.2, 6.0), lot.id % 3 === 0 ? woodMat : mudMat);
      wall.position.y = 1.7;
      wall.castShadow = true;
      wall.receiveShadow = true;
      stage2.add(wall);

      const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.16), woodDark);
      door.position.set(0, 1.15, -3.02); // voltada para a área comum (-Z local)
      stage2.add(door);

      const winMat = new THREE.MeshStandardMaterial({ color: 0x7cb0cf, roughness: 0.3 });
      for (const wx of [-1.9, 1.9]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.16), winMat);
        w.position.set(wx, 1.9, -3.02);
        stage2.add(w);
      }

      // Estágio 3 (100%): Telhado de barro ou sapê + paiol + lavoura crescendo atrás!
      const stage3 = new THREE.Group();
      stage3.visible = false;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(5.1, 2.35, 4),
        lot.id % 2 === 0 ? clayRoof : thatchRoof
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 4.4;
      roof.castShadow = true;
      roof.receiveShadow = true;
      stage3.add(roof);

      // Paiol rústico de madeira ao lado da casa
      const barn = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 3.0), woodMat);
      barn.position.set(5.3, 1.05, 0.5);
      barn.castShadow = true;
      stage3.add(barn);
      const barnRoof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.25, 3.5), woodDark);
      barnRoof.position.set(5.3, 2.2, 0.5);
      stage3.add(barnRoof);

      // Lavoura plantada atrás da casa (+Z local vai para o fundo do lote)
      const crop = new THREE.Mesh(new THREE.PlaneGeometry(18, 20), cropMat);
      crop.rotation.x = -Math.PI / 2;
      crop.position.set(0, 0.06, 20);
      crop.receiveShadow = true;
      stage3.add(crop);

      root.add(stage0, stage1, stage2, stage3);
      this.scene.add(root);

      const site = {
        id: `lote-${lot.id}`,
        kind: 'lot',
        lotId: lot.id,
        name: `Casa do Sítio ${lot.code}`,
        desc: `Moradia e paiol da Família ${lot.code}`,
        x: lot.housePos.x,
        z: lot.housePos.z,
        radius: 6.5,
        cost: { wood: 65, thatch: 28, clay: 30 },
        delivered: { wood: 0, thatch: 0, clay: 0 },
        work: 0,
        workNeeded: 75,
        progress: 0,
        completed: false,
        stage: -1,
        cropGrowth: 0,
        visuals: { root, stage0, stage1, stage2, stage3, crop },
      };

      this.lotSites.set(lot.id, site);
      this.allSites.push(site);
    }
  }

  getSiteById(id) {
    if (this.communitySites.has(id)) return this.communitySites.get(id);
    if (typeof id === 'string' && id.startsWith('lote-')) {
      return this.lotSites.get(parseInt(id.slice(5), 10)) || null;
    }
    return null;
  }

  getNextCommunitySite() {
    // Prioridade manual escolhida pelo jogador se ainda não concluída
    const prio = this.communitySites.get(this.prioritySiteId);
    if (prio && !prio.completed) return prio;
    for (const def of COMMUNITY_DEFS) {
      const s = this.communitySites.get(def.id);
      if (s && !s.completed) return s;
    }
    return null;
  }

  setPriority(siteId) {
    const s = this.getSiteById(siteId);
    if (s && !s.completed) {
      this.prioritySiteId = siteId;
      this.bus.emit('site:priority', { site: s });
      return true;
    }
    return false;
  }

  // Aplica trabalho e consome recursos proporcionais do estoque comunitário
  contributeWork(site, workAmount, resources, byPlayer = false) {
    if (!site || site.completed) return false;

    const totalCost = site.cost.wood + site.cost.thatch + site.cost.clay;
    const frac = Math.min(workAmount / site.workNeeded, 1 - site.progress);
    const needWood = site.cost.wood * frac;
    const needThatch = site.cost.thatch * frac;
    const needClay = site.cost.clay * frac;

    // Permite progresso parcial se tiver madeira (recurso principal) ou se jogador estiver ajudando
    if (!byPlayer && resources.wood < Math.max(0.5, needWood * 0.4)) {
      return false;
    }

    const usedW = Math.min(resources.wood, needWood);
    const usedT = Math.min(resources.thatch, needThatch);
    const usedC = Math.min(resources.clay, needClay);

    resources.wood -= usedW;
    resources.thatch -= usedT;
    resources.clay -= usedC;

    // Se jogador martela, contribui mesmo que falte um pouquinho de palha/barro
    const resourceRatio = totalCost > 0
      ? Math.min(1, (usedW + usedT + usedC) / Math.max(0.01, needWood + needThatch + needClay))
      : 1;
    const effectiveWork = byPlayer
      ? workAmount * (0.45 + 0.55 * resourceRatio)
      : workAmount * Math.max(0.35, resourceRatio);

    site.work = Math.min(site.workNeeded, site.work + effectiveWork);
    site.progress = Math.min(1, site.work / site.workNeeded);

    this._syncVisualStage(site);

    if (site.progress >= 1 && !site.completed) {
      site.completed = true;
      site.progress = 1;
      this._syncVisualStage(site);
      this.bus.emit('site:completed', { site, byPlayer });
    }
    return true;
  }

  _syncVisualStage(site) {
    const p = site.progress;
    const v = site.visuals;

    if (site.kind === 'lot') {
      v.stage0.visible = p > 0.03;
      v.stage1.visible = p >= 0.22;
      v.stage2.visible = p >= 0.56;
      v.stage3.visible = p >= 0.999;
    } else {
      // Obras comunitárias: oculta estacas quando completa
      v.stage0.visible = p < 0.999;
      v.stage1.visible = p >= 0.2;
      v.stage2.visible = p >= 0.55;
      v.stage3.visible = p >= 0.999;
    }
  }

  findSiteNearPoint(x, z, maxDist = 11) {
    let best = null;
    let bestSq = maxDist * maxDist;
    for (let i = 0; i < this.allSites.length; i++) {
      const s = this.allSites[i];
      const dx = s.x - x;
      const dz = s.z - z;
      const d2 = dx * dx + dz * dz;
      const limit = (s.radius + 4) ** 2;
      if (d2 < Math.min(bestSq, limit)) {
        bestSq = d2;
        best = s;
      }
    }
    return best;
  }

  getStats() {
    let commDone = 0;
    for (const s of this.communitySites.values()) {
      if (s.completed) commDone++;
    }
    let housesDone = 0;
    for (const s of this.lotSites.values()) {
      if (s.completed) housesDone++;
    }
    return {
      communityDone: commDone,
      communityTotal: this.communitySites.size,
      housesDone,
      housesTotal: this.lotSites.size,
    };
  }
}
