import * as THREE from 'three';

const MAX_PARTICLES = 480;
const DUMMY = new THREE.Object3D();
const TMP_COLOR = new THREE.Color();

export class Particles {
  constructor(scene, settings, bus) {
    this.scene = scene;
    this.settings = settings;
    this.bus = bus;

    this.pool = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        vrx: 0, vry: 0,
        size: 0.1,
        life: 0,
        maxLife: 1,
        gravity: 9.8,
        grow: 0,
      });
    }
    this.cursor = 0;
    this._fireAccum = 0;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      DUMMY.scale.set(0, 0, 0);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
      TMP_COLOR.setHex(0xffffff);
      this.mesh.setColorAt(i, TMP_COLOR);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.scene.add(this.mesh);

    this.bus.on('fx:woodchip', ({ x, y, z }) => this.spawnBurst(x, y, z, 10, 0xc79558, 3.6, 0.11, 9.8));
    this.bus.on('fx:sawdust', ({ x, y, z }) => this.spawnBurst(x, y, z, 8, 0xe0c082, 2.5, 0.08, 6.2));
    this.bus.on('fx:dirt', ({ x, y, z }) => this.spawnBurst(x, y, z, 9, 0x6b4b2b, 2.8, 0.09, 9.5));
    this.bus.on('tree:felled', ({ tree }) => {
      this.spawnBurst(tree.x, 3.5, tree.z, 18, 0x357031, 4.8, 0.24, 5.2);
      this.spawnBurst(tree.x, 1.2, tree.z, 12, 0xb8844b, 4.0, 0.14, 9.8);
    });
  }

  _alloc() {
    const p = this.pool[this.cursor];
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    return { p, idx };
  }

  spawnBurst(x, y, z, count, colorHex, speed, size, gravity) {
    const scale = this.settings.preset.particleScale || 0.8;
    const n = Math.max(2, Math.round(count * scale));
    TMP_COLOR.setHex(colorHex);

    for (let i = 0; i < n; i++) {
      const { p, idx } = this._alloc();
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + (Math.random() - 0.5) * 0.4;
      p.z = z + (Math.random() - 0.5) * 0.4;
      p.vx = Math.cos(ang) * spd;
      p.vy = (0.4 + Math.random() * 0.8) * speed;
      p.vz = Math.sin(ang) * spd;
      p.rx = Math.random() * 6;
      p.ry = Math.random() * 6;
      p.rz = Math.random() * 6;
      p.vrx = (Math.random() - 0.5) * 10;
      p.vry = (Math.random() - 0.5) * 10;
      p.size = size * (0.65 + Math.random() * 0.7);
      p.maxLife = 0.45 + Math.random() * 0.55;
      p.life = p.maxLife;
      p.gravity = gravity;
      p.grow = 0;

      this.mesh.setColorAt(idx, TMP_COLOR);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  spawnSmoke(x, y, z) {
    const { p, idx } = this._alloc();
    p.active = true;
    p.x = x + (Math.random() - 0.5) * 0.5;
    p.y = y;
    p.z = z + (Math.random() - 0.5) * 0.5;
    p.vx = (Math.random() - 0.5) * 0.45 + 0.2;
    p.vy = 1.5 + Math.random() * 0.9;
    p.vz = (Math.random() - 0.5) * 0.45;
    p.rx = Math.random() * 3;
    p.ry = Math.random() * 3;
    p.rz = 0;
    p.vrx = 0.6;
    p.vry = 0.8;
    p.size = 0.24;
    p.maxLife = 2.4 + Math.random() * 1.4;
    p.life = p.maxLife;
    p.gravity = -0.15;
    p.grow = 0.28;

    TMP_COLOR.setHex(Math.random() < 0.2 ? 0xff9a38 : 0x7a7670);
    this.mesh.setColorAt(idx, TMP_COLOR);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt, campfires, playerPos) {
    // Emite fumaça e brasas suaves das fogueiras do acampamento
    this._fireAccum += dt;
    if (this._fireAccum >= 0.14 && campfires) {
      this._fireAccum = 0;
      for (let i = 0; i < campfires.length; i++) {
        const cf = campfires[i];
        if (playerPos && (cf.x - playerPos.x) ** 2 + (cf.z - playerPos.z) ** 2 > 220 * 220) continue;
        this.spawnSmoke(cf.x, 1.0, cf.z);
      }
    }

    let dirty = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        DUMMY.scale.set(0, 0, 0);
        DUMMY.updateMatrix();
        this.mesh.setMatrixAt(i, DUMMY.matrix);
        dirty = true;
        continue;
      }

      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rx += p.vrx * dt;
      p.ry += p.vry * dt;

      const t = p.life / p.maxLife;
      const sc = p.grow > 0
        ? (p.size + (1 - t) * p.grow) * Math.min(1, t * 2.2)
        : p.size * Math.min(1, t * 2.5);

      DUMMY.position.set(p.x, p.y, p.z);
      DUMMY.rotation.set(p.rx, p.ry, p.rz);
      DUMMY.scale.set(sc, sc, sc);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
      dirty = true;
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
