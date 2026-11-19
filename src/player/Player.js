import * as THREE from 'three';
import {
  isInsideCommonArea,
  findLotAt,
} from '../world/SettlementMath.js';
import { TOOLS } from './ViewModel.js';

const EYE_HEIGHT = 1.68;
const CROUCH_HEIGHT = 1.08;
const GRAVITY = 21.0;

export class Player {
  constructor(camera, input, settings, viewModel, forest, constructions, simulation, audio, bus) {
    this.camera = camera;
    this.input = input;
    this.settings = settings;
    this.viewModel = viewModel;
    this.forest = forest;
    this.constructions = constructions;
    this.simulation = simulation;
    this.audio = audio;
    this.bus = bus;

    // Começa no coração da Área Comum limpa olhando para o acampamento e a floresta cercada
    this.position = new THREE.Vector3(0, 0, 22);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.05;

    this.grounded = true;
    this.droneMode = false;
    this.droneReturnPos = new THREE.Vector3(0, 0, 22);

    this.activeToolIndex = 0;
    this.actionCooldown = 0;
    this.stepAccum = 0;
    this.bobTime = 0;
    this.currentTarget = null; // { kind, label, sublabel, progress, data }

    // Vetores pré-alocados
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._lookDir = new THREE.Vector3();
    this._rayOrigin = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this._wireKeys();
  }

  _wireKeys() {
    this.bus.on('input:key', ({ code }) => {
      if (!this.input.active) return;
      if (code === 'Digit1') this.selectTool(0);
      else if (code === 'Digit2') this.selectTool(1);
      else if (code === 'Digit3') this.selectTool(2);
      else if (code === 'Digit4') this.selectTool(3);
      else if (code === 'KeyV') this.toggleDroneMode();
      else if (code === 'KeyT') this.simulation.cycleSpeed();
    });
  }

  selectTool(idx) {
    const clamped = ((idx % TOOLS.length) + TOOLS.length) % TOOLS.length;
    this.activeToolIndex = clamped;
    this.viewModel.selectTool(clamped);
    this.bus.emit('player:tool', { index: clamped, tool: TOOLS[clamped] });
  }

  toggleDroneMode() {
    this.droneMode = !this.droneMode;
    if (this.droneMode) {
      this.droneReturnPos.copy(this.position);
      this.position.y = Math.max(this.position.y + 42, 65);
      this.pitch = -0.58;
      this.velocity.set(0, 0, 0);
      this.bus.emit('feed:log', { text: 'Modo Drone Aéreo ativado (V para voltar ao chão)', type: 'info' });
    } else {
      this.position.y = 0;
      this.pitch = -0.05;
      this.velocity.set(0, 0, 0);
    }
    this.bus.emit('player:mode', { drone: this.droneMode });
  }

  teleportTo(x, z, yaw = 0, drone = false) {
    this.droneMode = drone;
    this.position.set(x, drone ? 220 : 0, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = drone ? -0.82 : -0.06;
    this.bus.emit('player:mode', { drone: this.droneMode });
  }

  update(dt, elapsed) {
    const frame = this.input.consumeFrame();

    if (frame.wheel !== 0) {
      this.selectTool(this.activeToolIndex + (frame.wheel > 0 ? 1 : -1));
    }

    // Rotação de câmera pelo mouse
    const sens = this.settings.sensitivity;
    this.yaw -= frame.dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - frame.dy * sens, -1.42, 1.42);

    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let mx = 0;
    let mz = 0;
    if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp')) mz += 1;
    if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown')) mz -= 1;
    if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) mx += 1;
    if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft')) mx -= 1;

    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }

    const sprinting = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    const crouching = !this.droneMode && (this.input.isDown('ControlLeft') || this.input.isDown('KeyC'));

    if (this.droneMode) {
      // Voo livre de Drone Aéreo para inspecionar os 1.525.000 m²
      const speed = sprinting ? 145 : 58;
      let my = 0;
      if (this.input.isDown('Space') || this.input.isDown('KeyE')) my += 1;
      if (this.input.isDown('KeyQ') || this.input.isDown('ControlLeft')) my -= 1;

      this.position.addScaledVector(this._forward, mz * speed * dt);
      this.position.addScaledVector(this._right, mx * speed * dt);
      this.position.y = THREE.MathUtils.clamp(this.position.y + my * speed * 0.75 * dt, 10, 920);
      this.position.x = THREE.MathUtils.clamp(this.position.x, -1650, 1650);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -1550, 1450);

      this.camera.position.copy(this.position);
      this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(this._euler);
      this.currentTarget = null;
      return;
    }

    // Movimento em primeira pessoa no chão (com inércia estilo FPS)
    const maxSpeed = crouching ? 3.8 : sprinting ? 13.5 : 7.2;
    const targetVX = (this._forward.x * mz + this._right.x * mx) * maxSpeed;
    const targetVZ = (this._forward.z * mz + this._right.z * mx) * maxSpeed;
    const accel = this.grounded ? 14.0 : 4.0;

    this.velocity.x += (targetVX - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (targetVZ - this.velocity.z) * Math.min(1, accel * dt);

    if (this.grounded && this.input.isDown('Space')) {
      this.velocity.y = 7.4;
      this.grounded = false;
    }

    this.velocity.y -= GRAVITY * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -1550, 1550);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -1450, 1350);

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && horizSpeed > 0.6) {
      this.bobTime += dt * (sprinting ? 12.5 : 8.2);
      this.stepAccum += horizSpeed * dt;
      const stepStride = sprinting ? 2.8 : 2.15;
      if (this.stepAccum >= stepStride) {
        this.stepAccum = 0;
        const surface = isInsideCommonArea(this.position.x, this.position.z) ? 'grass' : 'forest';
        this.audio.playFootstep(surface, sprinting);
      }
    }

    const eyeH = crouching ? CROUCH_HEIGHT : EYE_HEIGHT;
    const bobOffset = this.grounded && horizSpeed > 0.6 ? Math.sin(this.bobTime) * (sprinting ? 0.065 : 0.036) : 0;

    this.camera.position.set(this.position.x, this.position.y + eyeH + bobOffset, this.position.z);
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);

    // Atualiza ViewModel da ferramenta na mão
    this.viewModel.update(dt, elapsed, horizSpeed, sprinting, frame.dx, frame.dy);

    // Detecta o que está na mira central
    this._updateTarget();

    // Executa ação da ferramenta (Clique Esquerdo)
    if (this.actionCooldown > 0) this.actionCooldown -= dt;
    if ((frame.leftPressed || this.input.leftDown) && this.actionCooldown <= 0) {
      this._performToolAction();
    }
  }

  _updateTarget() {
    this.camera.getWorldDirection(this._lookDir);
    this._rayOrigin.copy(this.camera.position);

    // 1. Checa árvore viva na mira (alcance 7.5 m)
    const treeHit = this.forest.raycastTree(this._rayOrigin, this._lookDir, 7.5);
    if (treeHit) {
      const t = treeHit.tree;
      const where = t.lotId > 0 ? `Sítio ${String(t.lotId).padStart(2, '0')}` : 'Mata Externa';
      this.currentTarget = {
        kind: 'tree',
        label: `Árvore da Floresta (${where})`,
        sublabel: this.activeToolIndex === 0
          ? `[CLIQUE ESQ] Cortar com Machado · +${t.woodYield} Madeira`
          : 'Selecione [1] Machado para derrubar',
        progress: t.hp / t.maxHp,
        data: treeHit,
      };
      return;
    }

    // 2. Checa obra comunitária ou casa de lote próxima à frente do jogador
    const probeX = this.position.x + this._lookDir.x * 6.5;
    const probeZ = this.position.z + this._lookDir.z * 6.5;
    const site = this.constructions.findSiteNearPoint(probeX, probeZ, 12) ||
                 this.constructions.findSiteNearPoint(this.position.x, this.position.z, 10);
    if (site) {
      const pct = Math.round(site.progress * 100);
      let sub;
      if (site.completed) {
        sub = this.activeToolIndex === 2
          ? '[CLIQUE ESQ] Cultivar e colher alimentos (+8 Alimento)'
          : 'Obra concluída ✓';
      } else if (this.activeToolIndex === 1) {
        sub = `[CLIQUE ESQ] Martelar para acelerar obra (${pct}%)`;
      } else if (this.activeToolIndex === 3) {
        sub = `[CLIQUE ESQ] Convocar Mutirão das famílias para esta obra!`;
      } else {
        sub = `Use [2] Martelo para construir ou [4] Rádio para Mutirão (${pct}%)`;
      }
      this.currentTarget = {
        kind: 'site',
        label: site.name,
        sublabel: sub,
        progress: site.progress,
        data: site,
      };
      return;
    }

    // 3. Checa morador próximo na mira
    let bestV = null;
    let bestD2 = 8.5 * 8.5;
    for (let i = 0; i < this.simulation.villagers.length; i++) {
      const v = this.simulation.villagers[i];
      const dx = v.x - this.position.x;
      const dz = v.z - this.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2 && d2 > 0.3) {
        const dist = Math.sqrt(d2);
        const dot = (dx * this._lookDir.x + dz * this._lookDir.z) / dist;
        if (dot > 0.92) {
          bestD2 = d2;
          bestV = v;
        }
      }
    }
    if (bestV) {
      const fam = this.simulation.families[bestV.familyId - 1];
      this.currentTarget = {
        kind: 'villager',
        label: `${bestV.name} · ${fam.name} (${fam.size} pessoas)`,
        sublabel: `Sítio ${fam.code} · ${bestV.statusLabel}`,
        progress: null,
        data: bestV,
      };
      return;
    }

    // 4. Contexto de enxada no solo de um lote ou horta
    if (this.activeToolIndex === 2) {
      const lot = findLotAt(this.position.x, this.position.z);
      if (lot) {
        this.currentTarget = {
          kind: 'soil',
          label: `Terra do Sítio ${lot.code}`,
          sublabel: '[CLIQUE ESQ] Limpar mato e plantar sementes (+6 Alimento)',
          progress: null,
          data: lot,
        };
        return;
      }
    }

    this.currentTarget = null;
  }

  _performToolAction() {
    this.viewModel.triggerSwing();
    this.actionCooldown = 0.36;

    const tool = TOOLS[this.activeToolIndex].id;
    const tgt = this.currentTarget;

    if (tool === 'axe') {
      if (tgt && tgt.kind === 'tree') {
        const { tree, point } = tgt.data;
        this.audio.playChop();
        this.bus.emit('fx:woodchip', { x: point.x, y: point.y, z: point.z });
        const res = this.forest.damageTree(tree.id, 42, this._lookDir.x, this._lookDir.z, true);
        if (res && res.felled) {
          this.audio.playTreeFall();
        }
      } else {
        this.audio.playFootstep('forest', false);
      }
    } else if (tool === 'hammer') {
      if (tgt && tgt.kind === 'site' && !tgt.data.completed) {
        const site = tgt.data;
        this.audio.playHammer();
        this.bus.emit('fx:sawdust', {
          x: this.position.x + this._lookDir.x * 2.5,
          y: 1.5,
          z: this.position.z + this._lookDir.z * 2.5,
        });
        this.constructions.contributeWork(site, 9.5, this.simulation.resources, true);
      } else {
        this.audio.playHammer();
      }
    } else if (tool === 'hoe') {
      this.audio.playHoe();
      const px = this.position.x + this._lookDir.x * 2.2;
      const pz = this.position.z + this._lookDir.z * 2.2;
      this.bus.emit('fx:dirt', { x: px, y: 0.25, z: pz });
      this.simulation.resources.food = Math.min(9999, this.simulation.resources.food + 6);
      this.simulation.resources.clay = Math.min(9999, this.simulation.resources.clay + 4);
      this.bus.emit('feed:log', { text: 'Você cultivou a terra (+6 Alimento, +4 Barro)', type: 'resource' });
    } else if (tool === 'radio') {
      this.audio.playRadio();
      if (tgt && tgt.kind === 'site' && !tgt.data.completed) {
        this.simulation.callMutirao(tgt.data.id);
      } else {
        const next = this.constructions.getNextCommunitySite();
        if (next) this.simulation.callMutirao(next.id);
      }
    }
  }

  getLocationLabel() {
    if (isInsideCommonArea(this.position.x, this.position.z)) {
      return 'ÁREA COMUM · ACAMPAMENTO / AGRO VILA (25.000 m²)';
    }
    const lot = findLotAt(this.position.x, this.position.z);
    if (lot) {
      const fam = this.simulation.families[lot.id - 1];
      return `SÍTIO ${lot.code} · ${fam.name.toUpperCase()} (${lot.sector} · 50.000 m²)`;
    }
    return 'FLORESTA AO REDOR · MATA NATIVA';
  }
}
