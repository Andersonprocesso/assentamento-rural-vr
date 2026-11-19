import * as THREE from 'three';
import {
  LOTS,
  OUTER_TRI,
  INNER_TRI,
  RIVER_A,
  RIVER_B,
  RIVER_NORMAL,
  pointInTriangle,
  distToSegmentSq,
  samplePointInLot,
  lerp2D,
  mulberry32,
} from './SettlementMath.js';

const CELL_SIZE = 45;
const DUMMY = new THREE.Object3D();
const TMP_COLOR = new THREE.Color();

export class Forest {
  constructor(scene, textures, settings, bus) {
    this.scene = scene;
    this.textures = textures;
    this.settings = settings;
    this.bus = bus;

    this.trees = []; // { id, x, z, scale, trunkH, crownR, rotY, lotId, hp, maxHp, state, fallAngle, fallDirX, fallDirZ, shake, colorHex, woodYield, thatchYield }
    this.grid = new Map(); // cellKey -> number[] (indices)
    this.fallingIndices = new Set();
    this.shakingIndices = new Set();

    this.totalTrees = 0;
    this.cutTrees = 0;

    this._buildForest();
  }

  _cellKey(cx, cz) {
    return `${cx},${cz}`;
  }

  _addToGrid(idx, x, z) {
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);
    const key = this._cellKey(cx, cz);
    let arr = this.grid.get(key);
    if (!arr) {
      arr = [];
      this.grid.set(key, arr);
    }
    arr.push(idx);
  }

  _isNearFenceOrGate(x, z) {
    // Mantém uma faixinha limpa de 3.2m nas divisas cercadas para a cerca aparecer bem
    for (let e = 0; e < 3; e++) {
      if (distToSegmentSq(x, z, INNER_TRI[e], INNER_TRI[(e + 1) % 3]) < 14) return true;
      if (distToSegmentSq(x, z, OUTER_TRI[e], OUTER_TRI[(e + 1) % 3]) < 12) return true;
    }
    // Evita árvores exatamente em cima das divisas radiais dos lotes (2.8m)
    for (let i = 0; i < LOTS.length; i++) {
      const lot = LOTS[i];
      if (distToSegmentSq(x, z, lot.iA, lot.oA) < 9) return true;
    }
    return false;
  }

  _buildForest() {
    const rnd = mulberry32(20261119);
    const density = this.settings.preset.treeDensity || 0.85;

    // Paleta realista de Mata Atlântica brasileira (com raros ipês amarelos/roxos)
    const canopyPalette = [
      0x1d4d24,
      0x255e2b,
      0x2e6b32,
      0x1a4220,
      0x377333,
      0x26522a,
      0x417a36,
      0x1e4a27,
    ];
    const rareIpeColors = [0xd4a82a, 0xc79222, 0x9b4f85];

    const addTree = (x, z, lotId, nearFront = false) => {
      const scale = nearFront
        ? 0.85 + rnd() * 0.65
        : 0.9 + rnd() * 0.95;
      const trunkH = 5.2 * scale;
      const crownR = 2.8 * scale;
      const rotY = rnd() * Math.PI * 2;
      const isIpe = rnd() < 0.032;
      const colorHex = isIpe
        ? rareIpeColors[Math.floor(rnd() * rareIpeColors.length)]
        : canopyPalette[Math.floor(rnd() * canopyPalette.length)];
      const maxHp = Math.round(75 + scale * 45);
      const id = this.trees.length;

      this.trees.push({
        id,
        x,
        z,
        scale,
        trunkH,
        crownR,
        rotY,
        lotId,
        hp: maxHp,
        maxHp,
        state: 'alive',
        fallAngle: 0,
        fallVel: 0,
        fallDirX: 1,
        fallDirZ: 0,
        shake: 0,
        colorHex,
        woodYield: Math.round(14 + scale * 12),
        thatchYield: Math.round(5 + scale * 5),
      });
      this._addToGrid(id, x, z);
    };

    // 1. MATA DENTRO DOS 30 LOTES CERCADOS
    // Mais densa na faixa frontal (0.02..0.28) onde o jogador e as famílias trabalham primeiro,
    // e distribuída por toda a profundidade (0.28..0.96) dos 50.000 m² de cada lote!
    const frontPerLot = Math.round(34 * density);
    const deepPerLot = Math.round(72 * density);

    for (const lot of LOTS) {
      // Faixa frontal do lote (muralha verde logo após a cerca da área comum!)
      let placed = 0;
      let tries = 0;
      while (placed < frontPerLot && tries < frontPerLot * 5) {
        tries++;
        const p = samplePointInLot(lot, rnd, 0.015, 0.22);
        if (this._isNearFenceOrGate(p.x, p.z)) continue;
        // Evita árvore colada demais a outra
        if (this._tooClose(p.x, p.z, 5.2)) continue;
        addTree(p.x, p.z, lot.id, true);
        placed++;
      }

      // Interior profundo do lote (floresta contínua até a cerca externa)
      placed = 0;
      tries = 0;
      while (placed < deepPerLot && tries < deepPerLot * 4) {
        tries++;
        const p = samplePointInLot(lot, rnd, 0.2, 0.97);
        if (this._isNearFenceOrGate(p.x, p.z)) continue;
        if (this._tooClose(p.x, p.z, 8.5)) continue;
        addTree(p.x, p.z, lot.id, false);
        placed++;
      }
    }

    // 2. MATA AO REDOR DO ASSENTAMENTO (fora do triângulo de 1.525.000 m² e mata ciliar do rio)
    const outerTrees = Math.round(520 * density);
    let placedOuter = 0;
    let triesOuter = 0;
    while (placedOuter < outerTrees && triesOuter < outerTrees * 6) {
      triesOuter++;
      const x = (rnd() - 0.5) * 3200;
      const z = -220 + (rnd() - 0.5) * 2600;
      if (pointInTriangle(x, z, OUTER_TRI)) continue;
      const distOrigin = Math.hypot(x, z);
      if (distOrigin > 1750) continue;
      // Evita cair dentro da água do rio
      if (distToSegmentSq(x, z, RIVER_A, RIVER_B) < 62 * 62) continue;
      addTree(x, z, 0, false);
      placedOuter++;
    }

    // Mata ciliar acompanhando a outra margem do rio
    const riverCount = Math.round(90 * density);
    for (let i = 0; i < riverCount; i++) {
      const p = lerp2D(RIVER_A, RIVER_B, i / Math.max(1, riverCount - 1));
      const offset = 86 + rnd() * 55;
      const jx = (rnd() - 0.5) * 20;
      const jz = (rnd() - 0.5) * 20;
      addTree(p.x + RIVER_NORMAL.x * offset + jx, p.z + RIVER_NORMAL.z * offset + jz, 0, false);
    }

    this.totalTrees = this.trees.length;

    // 3. CRIA INSTANCED MESHES (Troncos + Copa Inferior + Copa Superior)
    // Pivot na base (y = 0) para tombar perfeitamente ao cortar!
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 5.2, 7);
    trunkGeo.translate(0, 2.6, 0);

    const crownLowerGeo = new THREE.DodecahedronGeometry(2.75, 1);
    crownLowerGeo.scale(1.08, 0.85, 1.08);
    crownLowerGeo.translate(0, 5.7, 0);

    const crownUpperGeo = new THREE.DodecahedronGeometry(2.05, 1);
    crownUpperGeo.scale(1.0, 0.92, 1.0);
    crownUpperGeo.translate(0.35, 7.6, -0.25);

    const barkMat = this.textures.get('bark');
    const foliageMat = this.textures.get('foliage');

    this.trunkMesh = new THREE.InstancedMesh(trunkGeo, barkMat, this.totalTrees);
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = true;

    this.crownLowerMesh = new THREE.InstancedMesh(crownLowerGeo, foliageMat, this.totalTrees);
    this.crownLowerMesh.castShadow = true;
    this.crownLowerMesh.receiveShadow = true;

    this.crownUpperMesh = new THREE.InstancedMesh(crownUpperGeo, foliageMat, this.totalTrees);
    this.crownUpperMesh.castShadow = false;
    this.crownUpperMesh.receiveShadow = true;

    for (let i = 0; i < this.totalTrees; i++) {
      const t = this.trees[i];
      this._writeTreeMatrix(i, t);

      TMP_COLOR.setHex(t.colorHex);
      this.crownLowerMesh.setColorAt(i, TMP_COLOR);
      TMP_COLOR.offsetHSL(0.01, 0.03, 0.05);
      this.crownUpperMesh.setColorAt(i, TMP_COLOR);
    }

    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.crownLowerMesh.instanceMatrix.needsUpdate = true;
    this.crownUpperMesh.instanceMatrix.needsUpdate = true;
    if (this.crownLowerMesh.instanceColor) this.crownLowerMesh.instanceColor.needsUpdate = true;
    if (this.crownUpperMesh.instanceColor) this.crownUpperMesh.instanceColor.needsUpdate = true;

    this.scene.add(this.trunkMesh, this.crownLowerMesh, this.crownUpperMesh);

    // 4. ARBUSTOS DE SUB-BOSQUE E PEDRAS NATURAIS NA MATA (apenas fora da área comum)
    this._buildUnderbrush(rnd, density);
  }

  _buildUnderbrush(rnd, density) {
    const bushCount = Math.round(900 * density);
    const bushGeo = new THREE.DodecahedronGeometry(1.15, 0);
    bushGeo.scale(1.3, 0.72, 1.3);
    bushGeo.translate(0, 0.55, 0);

    const bushMesh = new THREE.InstancedMesh(bushGeo, this.textures.get('foliage'), bushCount);
    bushMesh.receiveShadow = true;

    let idx = 0;
    for (let i = 0; i < bushCount * 2 && idx < bushCount; i++) {
      const lot = LOTS[Math.floor(rnd() * LOTS.length)];
      const p = samplePointInLot(lot, rnd, 0.02, 0.45);
      if (this._isNearFenceOrGate(p.x, p.z)) continue;

      const sc = 0.65 + rnd() * 1.1;
      DUMMY.position.set(p.x, 0, p.z);
      DUMMY.rotation.set(0, rnd() * Math.PI * 2, 0);
      DUMMY.scale.set(sc, sc * (0.7 + rnd() * 0.5), sc);
      DUMMY.updateMatrix();
      bushMesh.setMatrixAt(idx, DUMMY.matrix);

      TMP_COLOR.setHex(rnd() > 0.5 ? 0x2c642a : 0x3f7531);
      bushMesh.setColorAt(idx, TMP_COLOR);
      idx++;
    }
    bushMesh.count = idx;
    bushMesh.instanceMatrix.needsUpdate = true;
    if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
    this.scene.add(bushMesh);
    this.bushMesh = bushMesh;

    // Pedras espalhadas na mata e perto do rio
    const rockCount = Math.round(240 * density);
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    rockGeo.scale(1.25, 0.65, 1.0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6c6e68,
      roughness: 0.92,
      metalness: 0.05,
    });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockMesh.receiveShadow = true;

    for (let i = 0; i < rockCount; i++) {
      const lot = LOTS[Math.floor(rnd() * LOTS.length)];
      const p = samplePointInLot(lot, rnd, 0.04, 0.55);
      const sc = 0.5 + rnd() * 1.5;
      DUMMY.position.set(p.x, sc * 0.22, p.z);
      DUMMY.rotation.set(rnd() * 0.5, rnd() * Math.PI * 2, rnd() * 0.5);
      DUMMY.scale.set(sc, sc * (0.6 + rnd() * 0.5), sc);
      DUMMY.updateMatrix();
      rockMesh.setMatrixAt(i, DUMMY.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(rockMesh);
    this.rockMesh = rockMesh;
  }

  _tooClose(x, z, minDist) {
    const minSq = minDist * minDist;
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const arr = this.grid.get(this._cellKey(cx + ox, cz + oz));
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          const t = this.trees[arr[k]];
          const dx = t.x - x;
          const dz = t.z - z;
          if (dx * dx + dz * dz < minSq) return true;
        }
      }
    }
    return false;
  }

  _writeTreeMatrix(idx, t) {
    if (t.state === 'stump') {
      // Toco baixo deixado no chão
      DUMMY.position.set(t.x, 0, t.z);
      DUMMY.rotation.set(0, t.rotY, 0);
      DUMMY.scale.set(t.scale * 1.05, t.scale * 0.14, t.scale * 1.05);
      DUMMY.updateMatrix();
      this.trunkMesh.setMatrixAt(idx, DUMMY.matrix);

      // Oculta as copas
      DUMMY.scale.set(0, 0, 0);
      DUMMY.updateMatrix();
      this.crownLowerMesh.setMatrixAt(idx, DUMMY.matrix);
      this.crownUpperMesh.setMatrixAt(idx, DUMMY.matrix);
      return;
    }

    const shakeAngle = t.shake > 0 ? Math.sin(t.shake * 42) * 0.065 * t.shake : 0;
    const tilt = t.fallAngle + shakeAngle;

    DUMMY.position.set(t.x, 0, t.z);
    // Inclina na direção da queda
    const yawFall = Math.atan2(t.fallDirX, t.fallDirZ);
    DUMMY.rotation.set(tilt, t.fallAngle > 0 ? yawFall : t.rotY, 0, 'YXZ');
    DUMMY.scale.set(t.scale, t.scale, t.scale);
    DUMMY.updateMatrix();

    this.trunkMesh.setMatrixAt(idx, DUMMY.matrix);
    this.crownLowerMesh.setMatrixAt(idx, DUMMY.matrix);
    this.crownUpperMesh.setMatrixAt(idx, DUMMY.matrix);
  }

  // Encontra árvore viva mais próxima de (x, z), opcionalmente restrita a um lote
  findNearestAliveTree(x, z, lotId = null, maxRadius = 260) {
    const cellRadius = Math.ceil(maxRadius / CELL_SIZE);
    const cx0 = Math.floor(x / CELL_SIZE);
    const cz0 = Math.floor(z / CELL_SIZE);
    let best = null;
    let bestDistSq = maxRadius * maxRadius;

    for (let r = 0; r <= cellRadius; r++) {
      for (let ox = -r; ox <= r; ox++) {
        for (let oz = -r; oz <= r; oz++) {
          if (r > 0 && Math.abs(ox) !== r && Math.abs(oz) !== r) continue;
          const arr = this.grid.get(this._cellKey(cx0 + ox, cz0 + oz));
          if (!arr) continue;
          for (let k = 0; k < arr.length; k++) {
            const t = this.trees[arr[k]];
            if (t.state !== 'alive') continue;
            if (lotId !== null && t.lotId !== lotId) continue;
            const dx = t.x - x;
            const dz = t.z - z;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              best = t;
            }
          }
        }
      }
      if (best && r * CELL_SIZE * r * CELL_SIZE > bestDistSq) break;
    }
    return best;
  }

  // Raycast rápido contra troncos vivos próximos do jogador (para cortar com o machado)
  raycastTree(origin, dir, maxDist = 7.5) {
    const cx0 = Math.floor(origin.x / CELL_SIZE);
    const cz0 = Math.floor(origin.z / CELL_SIZE);
    let bestTree = null;
    let bestDist = maxDist;
    let bestPoint = null;

    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const arr = this.grid.get(this._cellKey(cx0 + ox, cz0 + oz));
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          const t = this.trees[arr[k]];
          if (t.state !== 'alive') continue;

          // Interseção raio vs cilindro aproximado do tronco
          const vx = t.x - origin.x;
          const vz = t.z - origin.z;
          const proj = vx * dir.x + vz * dir.z;
          if (proj < 0.3 || proj > bestDist) continue;

          const px = origin.x + dir.x * proj;
          const py = origin.y + dir.y * proj;
          const pz = origin.z + dir.z * proj;
          if (py < 0 || py > t.trunkH + 1.5) continue;

          const hitR = 0.65 * t.scale + 0.35;
          const dSq = (px - t.x) ** 2 + (pz - t.z) ** 2;
          if (dSq <= hitR * hitR) {
            bestDist = proj;
            bestTree = t;
            bestPoint = new THREE.Vector3(px, Math.max(0.5, py), pz);
          }
        }
      }
    }

    if (!bestTree) return null;
    return { tree: bestTree, distance: bestDist, point: bestPoint };
  }

  damageTree(treeId, amount, dirX = 1, dirZ = 0, byPlayer = false) {
    const t = this.trees[treeId];
    if (!t || t.state !== 'alive') return null;

    t.hp -= amount;
    t.shake = 1.0;
    this.shakingIndices.add(treeId);

    if (t.hp <= 0) {
      t.state = 'falling';
      const len = Math.hypot(dirX, dirZ) || 1;
      t.fallDirX = dirX / len;
      t.fallDirZ = dirZ / len;
      t.fallAngle = 0.02;
      t.fallVel = 0.45;
      this.fallingIndices.add(treeId);
      this.cutTrees += 1;

      this.bus.emit('tree:felled', {
        tree: t,
        byPlayer,
        wood: t.woodYield,
        thatch: t.thatchYield,
      });

      return { felled: true, wood: t.woodYield, thatch: t.thatchYield, tree: t };
    }

    return { felled: false, hpRatio: t.hp / t.maxHp, tree: t };
  }

  update(dt) {
    let dirty = false;

    if (this.shakingIndices.size > 0) {
      for (const idx of this.shakingIndices) {
        const t = this.trees[idx];
        t.shake -= dt * 3.5;
        if (t.shake <= 0) {
          t.shake = 0;
          this.shakingIndices.delete(idx);
        }
        if (t.state === 'alive') {
          this._writeTreeMatrix(idx, t);
          dirty = true;
        }
      }
    }

    if (this.fallingIndices.size > 0) {
      for (const idx of this.fallingIndices) {
        const t = this.trees[idx];
        t.fallVel += dt * 3.1;
        t.fallAngle += t.fallVel * dt;
        if (t.fallAngle >= Math.PI * 0.48) {
          t.state = 'stump';
          this.fallingIndices.delete(idx);
        }
        this._writeTreeMatrix(idx, t);
        dirty = true;
      }
    }

    if (dirty) {
      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.crownLowerMesh.instanceMatrix.needsUpdate = true;
      this.crownUpperMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Retorna amostra de árvores vivas para desenhar a cobertura verde no minimapa
  getAliveRatio() {
    return this.totalTrees > 0 ? (this.totalTrees - this.cutTrees) / this.totalTrees : 1;
  }
}
