import * as THREE from 'three';
import { LOTS, getLotById } from '../world/SettlementMath.js';
import { generateFamilies } from './FamiliesData.js';

const DUMMY = new THREE.Object3D();
const TMP_COLOR = new THREE.Color();

export const PHASES = [
  {
    id: 1,
    title: 'FASE 1 · ACAMPAMENTO NA CLAREIRA',
    objective: 'Cortar madeira na mata e erguer a Serraria & Galpão',
    check: (sim) => sim.constructions.getSiteById('serraria')?.completed,
  },
  {
    id: 2,
    title: 'FASE 2 · ÁGUA E ALIMENTO',
    objective: 'Construir o Poço/Caixa d\'Água e a Horta Comunitária',
    check: (sim) =>
      sim.constructions.getSiteById('poco')?.completed &&
      sim.constructions.getSiteById('horta')?.completed,
  },
  {
    id: 3,
    title: 'FASE 3 · PRIMEIRAS MORADIAS',
    objective: 'Ergue ao menos 10 casas nos sítios cercados',
    check: (sim) => sim.constructions.getStats().housesDone >= 10,
  },
  {
    id: 4,
    title: 'FASE 4 · VILA ESTRUTURADA',
    objective: 'Concluir a Escola, o Posto de Saúde e a Praça',
    check: (sim) =>
      sim.constructions.getSiteById('escola')?.completed &&
      sim.constructions.getSiteById('posto')?.completed &&
      sim.constructions.getSiteById('praca')?.completed,
  },
  {
    id: 5,
    title: 'FASE 5 · AGRO VILA PRÓSPERA',
    objective: 'Instalar todas as 30 famílias com casas e lavouras nos lotes',
    check: (sim) => sim.constructions.getStats().housesDone >= 30,
  },
];

export class Simulation {
  constructor(scene, textures, forest, constructions, bus) {
    this.scene = scene;
    this.textures = textures;
    this.forest = forest;
    this.constructions = constructions;
    this.bus = bus;

    const { families, villagers } = generateFamilies();
    this.families = families;
    this.villagers = villagers;

    // Estoque comunitário inicial (pouco material trazido no acampamento — precisam da floresta!)
    this.resources = {
      wood: 35,
      thatch: 20,
      clay: 25,
      food: 90,
    };

    this.simSpeed = 1; // 1x, 3x, 8x
    this.currentPhaseIndex = 0;
    this.operationComplete = false;
    this.mutiraoSiteId = null;
    this.mutiraoTimer = 0;
    this._foodAccum = 0;
    this._phaseCheckAccum = 0;

    this._buildVillagerMeshes();
    this._wireEvents();
  }

  _wireEvents() {
    this.bus.on('tree:felled', ({ tree, byPlayer, wood, thatch }) => {
      this.resources.wood += wood;
      this.resources.thatch += thatch;
      this.resources.clay += Math.round(thatch * 0.65);

      if (tree.lotId > 0) {
        const fam = this.families[tree.lotId - 1];
        if (fam) fam.treesCut += 1;
      }

      if (byPlayer) {
        this.bus.emit('feed:log', {
          text: `Você derrubou uma árvore (+${wood} Madeira, +${thatch} Palha)`,
          type: 'resource',
        });
      }
    });

    this.bus.on('site:completed', ({ site }) => {
      if (site.kind === 'community') {
        this.bus.emit('feed:log', {
          text: `OBRA CONCLUÍDA: ${site.name} na Área Comum!`,
          type: 'milestone',
        });
        // Atualiza próxima prioridade automática
        const next = this.constructions.getNextCommunitySite();
        if (next) this.constructions.prioritySiteId = next.id;
      } else if (site.kind === 'lot') {
        const fam = this.families[site.lotId - 1];
        if (fam) {
          fam.status = 'Morando e cultivando no sítio';
          this.bus.emit('feed:log', {
            text: `${fam.name} concluiu a casa no Sítio ${fam.code} e deixou a barraca!`,
            type: 'house',
          });
        }
      }
    });
  }

  _buildVillagerMeshes() {
    const N = this.villagers.length; // 150 moradores!
    const matNeutral = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 });

    const headGeo = new THREE.SphereGeometry(0.16, 7, 6);
    const hatGeo = new THREE.ConeGeometry(0.27, 0.16, 7);
    const torsoGeo = new THREE.BoxGeometry(0.42, 0.58, 0.24);
    const limbGeo = new THREE.BoxGeometry(0.13, 0.56, 0.13);
    limbGeo.translate(0, -0.28, 0);
    const legGeo = new THREE.BoxGeometry(0.15, 0.76, 0.16);
    legGeo.translate(0, -0.38, 0);
    const logGeo = new THREE.CylinderGeometry(0.11, 0.12, 1.75, 6);
    logGeo.rotateX(Math.PI / 2);

    this.mHead = new THREE.InstancedMesh(headGeo, matNeutral, N);
    this.mHat = new THREE.InstancedMesh(hatGeo, new THREE.MeshStandardMaterial({ color: 0xc9a86b, roughness: 0.92 }), N);
    this.mTorso = new THREE.InstancedMesh(torsoGeo, matNeutral, N);
    this.mArmL = new THREE.InstancedMesh(limbGeo, matNeutral, N);
    this.mArmR = new THREE.InstancedMesh(limbGeo, matNeutral, N);
    this.mLegL = new THREE.InstancedMesh(legGeo, matNeutral, N);
    this.mLegR = new THREE.InstancedMesh(legGeo, matNeutral, N);
    this.mLog = new THREE.InstancedMesh(logGeo, this.textures.get('bark'), N);

    for (const mesh of [this.mHead, this.mHat, this.mTorso, this.mArmL, this.mArmR, this.mLegL, this.mLegR, this.mLog]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }

    // Cores individuais de pele, camisa e calça
    for (let i = 0; i < N; i++) {
      const v = this.villagers[i];
      TMP_COLOR.setHex(v.skinColor);
      this.mHead.setColorAt(i, TMP_COLOR);
      this.mArmL.setColorAt(i, TMP_COLOR);
      this.mArmR.setColorAt(i, TMP_COLOR);

      TMP_COLOR.setHex(v.shirtColor);
      this.mTorso.setColorAt(i, TMP_COLOR);

      TMP_COLOR.setHex(v.pantsColor);
      this.mLegL.setColorAt(i, TMP_COLOR);
      this.mLegR.setColorAt(i, TMP_COLOR);
    }

    for (const mesh of [this.mHead, this.mTorso, this.mArmL, this.mArmR, this.mLegL, this.mLegR]) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    this._syncVillagerInstances();
  }

  setSpeed(speed) {
    this.simSpeed = speed;
    this.bus.emit('sim:speed', { speed });
  }

  cycleSpeed() {
    const next = this.simSpeed === 1 ? 3 : this.simSpeed === 3 ? 8 : 1;
    this.setSpeed(next);
  }

  callMutirao(siteId) {
    const site = this.constructions.getSiteById(siteId);
    if (!site || site.completed) return false;
    this.mutiraoSiteId = site.id;
    this.mutiraoTimer = 45; // 45s de simulação de foco intenso
    this.constructions.setPriority(site.id);

    // Redireciona parte dos construtores livres para o mutirão
    let assigned = 0;
    for (const v of this.villagers) {
      if (!v.isWorker) continue;
      if (v.state === 'BUILD_SITE' || v.state === 'CARRY_TO_SITE' || v.state === 'DECIDE') {
        if (assigned < 24) {
          v.targetSiteId = site.id;
          v.targetX = site.x + (Math.random() - 0.5) * 6;
          v.targetZ = site.z + (Math.random() - 0.5) * 6;
          v.state = 'CARRY_TO_SITE';
          v.statusLabel = `Mutirão: ${site.name}`;
          assigned++;
        }
      }
    }

    this.bus.emit('feed:log', {
      text: `MUTIRÃO CONVOCADO: ${assigned} moradores focados em ${site.name}!`,
      type: 'order',
    });
    return true;
  }

  _pickSiteForVillager(v) {
    // 1. Se houver mutirão ativo e o morador for construtor, ajuda no mutirão
    if (this.mutiraoSiteId && v.role === 'construtor') {
      const ms = this.constructions.getSiteById(this.mutiraoSiteId);
      if (ms && !ms.completed) return ms;
    }

    const ownLotSite = this.constructions.lotSites.get(v.lotId);
    const nextComm = this.constructions.getNextCommunitySite();

    // Se a Serraria ainda não está pronta, 55% das famílias ajudam na Serraria primeiro
    if (nextComm && nextComm.id === 'serraria' && (v.role === 'construtor' || v.familyId % 2 === 0)) {
      return nextComm;
    }

    // Balanceamento natural: construtores alternam entre obra comunitária e casa da própria família
    if (nextComm && v.role === 'construtor' && (v.familyId % 3 === 0 || (ownLotSite && ownLotSite.completed))) {
      return nextComm;
    }

    if (ownLotSite && !ownLotSite.completed) {
      return ownLotSite;
    }

    if (nextComm) return nextComm;

    // Caso todas obras comunitárias e a própria casa estejam prontas, ajuda um vizinho!
    for (const s of this.constructions.lotSites.values()) {
      if (!s.completed) return s;
    }
    return null;
  }

  update(dt, playerPos) {
    const sDt = dt * this.simSpeed;

    if (this.mutiraoTimer > 0) {
      this.mutiraoTimer -= sDt;
      if (this.mutiraoTimer <= 0) this.mutiraoSiteId = null;
    }

    // Bônus das obras comunitárias já concluídas!
    const hasSawmill = this.constructions.getSiteById('serraria')?.completed;
    const hasClinic = this.constructions.getSiteById('posto')?.completed;
    const hasGarden = this.constructions.getSiteById('horta')?.completed;
    const hasSchool = this.constructions.getSiteById('escola')?.completed;
    const hasWater = this.constructions.getSiteById('poco')?.completed;

    const workBonus = (hasSawmill ? 1.35 : 1.0) * (hasClinic ? 1.2 : 1.0);
    const moveBonus = hasClinic ? 1.15 : 1.0;

    // Produção passiva de alimentos (Horta + Casas com lavoura)
    this._foodAccum += sDt;
    if (this._foodAccum >= 2.0) {
      this._foodAccum = 0;
      const stats = this.constructions.getStats();
      const prod = (hasGarden ? 5 : 1) + stats.housesDone * 1.4 + (hasWater ? 2 : 0);
      this.resources.food = Math.min(9999, this.resources.food + prod);
    }

    // Atualiza IA de cada um dos 150 moradores
    for (let i = 0; i < this.villagers.length; i++) {
      const v = this.villagers[i];
      const lot = getLotById(v.lotId);
      const fam = this.families[v.familyId - 1];

      // Crianças brincam no acampamento, na casa da família (quando pronta) ou na Escola!
      if (!v.isWorker) {
        v.timer -= sDt;
        const dx = v.targetX - v.x;
        const dz = v.targetZ - v.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.6) {
          const step = Math.min(dist, v.speed * sDt);
          v.x += (dx / dist) * step;
          v.z += (dz / dist) * step;
          v.yaw = Math.atan2(dx, dz);
          v.walkPhase += sDt * 7.5;
        } else if (v.timer <= 0) {
          v.timer = 2.0 + Math.random() * 4.5;
          const ownSite = this.constructions.lotSites.get(v.lotId);
          if (hasSchool && Math.random() < 0.55) {
            v.targetX = (Math.random() - 0.5) * 20;
            v.targetZ = -52 + (Math.random() - 0.5) * 12;
            v.statusLabel = 'Estudando na Escola';
          } else if (ownSite && ownSite.completed) {
            v.targetX = lot.housePos.x + (Math.random() - 0.5) * 10;
            v.targetZ = lot.housePos.z + (Math.random() - 0.5) * 10;
            v.statusLabel = `Em casa no Sítio ${lot.code}`;
          } else {
            v.targetX = lot.campPos.x + (Math.random() - 0.5) * 12;
            v.targetZ = lot.campPos.z + (Math.random() - 0.5) * 12;
            v.statusLabel = 'Brincando no acampamento';
          }
        }
        continue;
      }

      // Trabalhadores (adultos e jovens das 30 famílias)
      if (v.state === 'DECIDE') {
        v.timer -= sDt;
        if (v.timer > 0) continue;

        const targetSite = this._pickSiteForVillager(v);
        if (!targetSite) {
          // Tudo construído! Vai trabalhar na lavoura do seu sítio
          v.state = 'FARM_LOT';
          v.targetX = lot.cropPos.x + (Math.random() - 0.5) * 12;
          v.targetZ = lot.cropPos.z + (Math.random() - 0.5) * 12;
          v.statusLabel = `Cultivando lavoura no Sítio ${lot.code}`;
          continue;
        }

        v.targetSiteId = targetSite.id;

        // Se precisamos de madeira ou o morador é lenhador/coletor, vai cortar árvore na mata do lote!
        const needHarvest =
          v.role === 'lenhador' ||
          v.role === 'coletor' ||
          this.resources.wood < 90 ||
          Math.random() < 0.45;

        if (needHarvest) {
          // Busca árvore viva dentro do lote da família (perto da área da casa primeiro para abrir clareira!)
          let tree = this.forest.findNearestAliveTree(lot.housePos.x, lot.housePos.z, lot.id, 380);
          if (!tree) {
            tree = this.forest.findNearestAliveTree(lot.housePos.x, lot.housePos.z, null, 450);
          }
          if (tree) {
            v.targetTreeId = tree.id;
            v.targetX = tree.x;
            v.targetZ = tree.z;
            v.state = 'WALK_TO_TREE';
            v.statusLabel = `Indo extrair madeira no Sítio ${lot.code}`;
            if (fam && fam.status === 'Acampada na área comum') {
              fam.status = 'Abrindo clareira e coletando madeira';
            }
            continue;
          }
        }

        // Vai direto construir a obra escolhida
        const ang = (v.id * 1.37) % (Math.PI * 2);
        const rad = Math.max(3.5, targetSite.radius * 0.72);
        v.targetX = targetSite.x + Math.cos(ang) * rad;
        v.targetZ = targetSite.z + Math.sin(ang) * rad;
        v.state = 'CARRY_TO_SITE';
        v.carryingWood = this.resources.wood > 10;
        v.statusLabel = `Construindo ${targetSite.name}`;
      } else if (v.state === 'WALK_TO_TREE') {
        const tree = this.forest.trees[v.targetTreeId];
        if (!tree || tree.state !== 'alive') {
          v.state = 'DECIDE';
          v.timer = 0.2;
          continue;
        }
        const dx = tree.x - v.x;
        const dz = tree.z - v.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 2.1) {
          v.yaw = Math.atan2(dx, dz);
          v.state = 'CHOP_TREE';
          v.timer = 0.45;
          v.statusLabel = `Cortando árvore na mata (Sítio ${lot.code})`;
        } else {
          const step = Math.min(dist, v.speed * moveBonus * sDt);
          v.x += (dx / dist) * step;
          v.z += (dz / dist) * step;
          v.yaw = Math.atan2(dx, dz);
          v.walkPhase += sDt * 7.2;
        }
      } else if (v.state === 'CHOP_TREE') {
        const tree = this.forest.trees[v.targetTreeId];
        if (!tree || tree.state !== 'alive') {
          v.carryingWood = true;
          v.state = 'DECIDE_DELIVER';
          continue;
        }
        v.walkPhase += sDt * 12.0; // movimento de machadada!
        v.timer -= sDt;
        if (v.timer <= 0) {
          v.timer = 0.55;
          const res = this.forest.damageTree(tree.id, 34 * workBonus, tree.x - v.x, tree.z - v.z, false);
          // Partículas visíveis se perto do jogador
          if (playerPos && (tree.x - playerPos.x) ** 2 + (tree.z - playerPos.z) ** 2 < 85 * 85) {
            this.bus.emit('fx:woodchip', { x: tree.x, y: 1.4, z: tree.z });
          }
          if (res && res.felled) {
            v.carryingWood = true;
            v.state = 'DECIDE_DELIVER';
          }
        }
      } else if (v.state === 'DECIDE_DELIVER') {
        const site = this.constructions.getSiteById(v.targetSiteId) || this._pickSiteForVillager(v);
        if (!site || site.completed) {
          v.carryingWood = false;
          v.state = 'DECIDE';
          v.timer = 0.4;
          continue;
        }
        v.targetSiteId = site.id;
        const ang = (v.id * 1.91) % (Math.PI * 2);
        const rad = Math.max(3.5, site.radius * 0.72);
        v.targetX = site.x + Math.cos(ang) * rad;
        v.targetZ = site.z + Math.sin(ang) * rad;
        v.state = 'CARRY_TO_SITE';
        v.statusLabel = `Levando tora para ${site.name}`;
      } else if (v.state === 'CARRY_TO_SITE') {
        const site = this.constructions.getSiteById(v.targetSiteId);
        if (!site || site.completed) {
          v.carryingWood = false;
          v.state = 'DECIDE';
          v.timer = 0.3;
          continue;
        }
        const dx = v.targetX - v.x;
        const dz = v.targetZ - v.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 1.2) {
          v.carryingWood = false;
          v.yaw = Math.atan2(site.x - v.x, site.z - v.z);
          v.state = 'BUILD_SITE';
          v.timer = 4.2; // trabalha alguns segundos na obra antes de buscar mais material
          v.statusLabel = `Erguendo ${site.name}`;
          if (fam && site.kind === 'lot' && site.lotId === fam.lotId) {
            fam.status = `Construindo casa (${Math.round(site.progress * 100)}%)`;
          }
        } else {
          const carryPenalty = v.carryingWood ? 0.84 : 1.0;
          const step = Math.min(dist, v.speed * moveBonus * carryPenalty * sDt);
          v.x += (dx / dist) * step;
          v.z += (dz / dist) * step;
          v.yaw = Math.atan2(dx, dz);
          v.walkPhase += sDt * 6.8;
        }
      } else if (v.state === 'BUILD_SITE') {
        const site = this.constructions.getSiteById(v.targetSiteId);
        if (!site || site.completed) {
          v.state = 'DECIDE';
          v.timer = 0.3;
          continue;
        }
        v.walkPhase += sDt * 11.0;
        const worked = this.constructions.contributeWork(site, 1.35 * workBonus * sDt, this.resources, false);
        if (fam && site.kind === 'lot' && site.lotId === fam.lotId) {
          fam.status = `Construindo casa (${Math.round(site.progress * 100)}%)`;
        }
        if (worked && Math.random() < 0.08 && playerPos) {
          if ((site.x - playerPos.x) ** 2 + (site.z - playerPos.z) ** 2 < 75 * 75) {
            this.bus.emit('fx:sawdust', { x: v.x, y: 1.5, z: v.z });
          }
        }
        v.timer -= sDt;
        if (v.timer <= 0 || !worked) {
          v.state = 'DECIDE';
          v.timer = 0.25 + Math.random() * 0.6;
        }
      } else if (v.state === 'FARM_LOT') {
        const dx = v.targetX - v.x;
        const dz = v.targetZ - v.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.0) {
          const step = Math.min(dist, v.speed * 0.85 * sDt);
          v.x += (dx / dist) * step;
          v.z += (dz / dist) * step;
          v.yaw = Math.atan2(dx, dz);
          v.walkPhase += sDt * 6.0;
        } else {
          v.walkPhase += sDt * 8.0;
          v.timer -= sDt;
          if (v.timer <= 0) {
            v.timer = 4 + Math.random() * 5;
            v.targetX = lot.cropPos.x + (Math.random() - 0.5) * 14;
            v.targetZ = lot.cropPos.z + (Math.random() - 0.5) * 14;
            this.resources.food = Math.min(9999, this.resources.food + 3);
          }
        }
      }
    }

    this._syncVillagerInstances();

    // Verifica progressão das fases da Operação Agro Vila
    this._phaseCheckAccum += dt;
    if (this._phaseCheckAccum >= 0.8 && !this.operationComplete) {
      this._phaseCheckAccum = 0;
      const phase = PHASES[this.currentPhaseIndex];
      if (phase && phase.check(this)) {
        this.bus.emit('phase:completed', { phase });
        if (this.currentPhaseIndex < PHASES.length - 1) {
          this.currentPhaseIndex += 1;
          this.bus.emit('phase:started', { phase: PHASES[this.currentPhaseIndex] });
        } else {
          this.operationComplete = true;
          this.bus.emit('operation:victory', { stats: this.constructions.getStats() });
        }
      }
    }
  }

  _syncVillagerInstances() {
    const N = this.villagers.length;
    for (let i = 0; i < N; i++) {
      const v = this.villagers[i];
      const sc = v.heightScale;
      const sinY = Math.sin(v.yaw);
      const cosY = Math.cos(v.yaw);
      const isWorking = v.state === 'CHOP_TREE' || v.state === 'BUILD_SITE';
      const isMoving = v.state === 'WALK_TO_TREE' || v.state === 'CARRY_TO_SITE' || v.state === 'PLAY' || v.state === 'FARM_LOT';
      const legSwing = isMoving ? Math.sin(v.walkPhase) * 0.65 : 0;
      const armSwing = isWorking
        ? -1.25 + Math.sin(v.walkPhase) * 0.95
        : v.carryingWood
          ? -1.55
          : -legSwing * 0.7;

      // Torso
      DUMMY.position.set(v.x, 1.06 * sc, v.z);
      DUMMY.rotation.set(0, v.yaw, 0);
      DUMMY.scale.set(sc, sc, sc);
      DUMMY.updateMatrix();
      this.mTorso.setMatrixAt(i, DUMMY.matrix);

      // Cabeça
      DUMMY.position.set(v.x, 1.54 * sc, v.z);
      DUMMY.rotation.set(0, v.yaw, 0);
      DUMMY.scale.set(sc, sc, sc);
      DUMMY.updateMatrix();
      this.mHead.setMatrixAt(i, DUMMY.matrix);

      // Chapéu de palha
      if (v.hasHat) {
        DUMMY.position.set(v.x, 1.72 * sc, v.z);
        DUMMY.rotation.set(0, v.yaw, 0);
        DUMMY.scale.set(sc, sc, sc);
      } else {
        DUMMY.scale.set(0, 0, 0);
      }
      DUMMY.updateMatrix();
      this.mHat.setMatrixAt(i, DUMMY.matrix);

      // Vetor lateral (direita do morador)
      const rx = cosY;
      const rz = -sinY;

      // Braço esquerdo
      DUMMY.position.set(v.x - rx * 0.28 * sc, 1.32 * sc, v.z - rz * 0.28 * sc);
      DUMMY.rotation.set(armSwing, v.yaw, 0, 'YXZ');
      DUMMY.scale.set(sc, sc, sc);
      DUMMY.updateMatrix();
      this.mArmL.setMatrixAt(i, DUMMY.matrix);

      // Braço direito
      DUMMY.position.set(v.x + rx * 0.28 * sc, 1.32 * sc, v.z + rz * 0.28 * sc);
      DUMMY.rotation.set(isWorking ? armSwing : -armSwing, v.yaw, 0, 'YXZ');
      DUMMY.scale.set(sc, sc, sc);
      DUMMY.updateMatrix();
      this.mArmR.setMatrixAt(i, DUMMY.matrix);

      // Perna esquerda
      DUMMY.position.set(v.x - rx * 0.11 * sc, 0.76 * sc, v.z - rz * 0.11 * sc);
      DUMMY.rotation.set(legSwing, v.yaw, 0, 'YXZ');
      DUMMY.scale.set(sc, sc, sc);
      DUMMY.updateMatrix();
      this.mLegL.setMatrixAt(i, DUMMY.matrix);

      // Perna direita
      DUMMY.position.set(v.x + rx * 0.11 * sc, 0.76 * sc, v.z + rz * 0.11 * sc);
      DUMMY.rotation.set(-legSwing, v.yaw, 0, 'YXZ');
      DUMMY.scale.set(sc, sc, sc);
      DUMMY.updateMatrix();
      this.mLegR.setMatrixAt(i, DUMMY.matrix);

      // Tora de madeira carregada no ombro!
      if (v.carryingWood) {
        DUMMY.position.set(v.x + rx * 0.24 * sc, 1.48 * sc, v.z + rz * 0.24 * sc);
        DUMMY.rotation.set(0.08, v.yaw, 0, 'YXZ');
        DUMMY.scale.set(sc, sc, sc);
      } else {
        DUMMY.scale.set(0, 0, 0);
      }
      DUMMY.updateMatrix();
      this.mLog.setMatrixAt(i, DUMMY.matrix);
    }

    this.mHead.instanceMatrix.needsUpdate = true;
    this.mHat.instanceMatrix.needsUpdate = true;
    this.mTorso.instanceMatrix.needsUpdate = true;
    this.mArmL.instanceMatrix.needsUpdate = true;
    this.mArmR.instanceMatrix.needsUpdate = true;
    this.mLegL.instanceMatrix.needsUpdate = true;
    this.mLegR.instanceMatrix.needsUpdate = true;
    this.mLog.instanceMatrix.needsUpdate = true;
  }

  getCurrentPhase() {
    return PHASES[this.currentPhaseIndex];
  }
}
