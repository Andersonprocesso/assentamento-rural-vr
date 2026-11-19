import * as THREE from 'three';

export const TOOLS = [
  { id: 'axe', key: '1', name: 'Machado', action: 'Cortar árvore na mata' },
  { id: 'hammer', key: '2', name: 'Martelo', action: 'Construir Agro Vila / Casas' },
  { id: 'hoe', key: '3', name: 'Enxada', action: 'Plantar e colher alimentos' },
  { id: 'radio', key: '4', name: 'Rádio', action: 'Convocar mutirão na obra' },
];

export class ViewModel {
  constructor(viewScene) {
    this.viewScene = viewScene;
    this.root = new THREE.Group();
    this.viewScene.add(this.root);

    this.activeIndex = 0;
    this.swingTime = 0;
    this.swingDuration = 0.32;
    this.swayX = 0;
    this.swayY = 0;
    this.bobPhase = 0;
    this.switchAnim = 0;

    this.toolMeshes = [
      this._buildAxe(),
      this._buildHammer(),
      this._buildHoe(),
      this._buildRadio(),
    ];

    this.toolMeshes.forEach((m, i) => {
      m.visible = i === 0;
      this.root.add(m);
    });
  }

  _buildAxe() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7b502d, roughness: 0.8 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x7c8791, roughness: 0.32, metalness: 0.85 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xd8e0e6, roughness: 0.18, metalness: 0.92 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x3b2617, roughness: 0.95 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.78, 8), woodMat);
    handle.position.y = 0.08;
    g.add(handle);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.031, 0.2, 8), gripMat);
    grip.position.y = -0.22;
    g.add(grip);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.13, 0.22), steelMat);
    head.position.set(0, 0.4, -0.05);
    g.add(head);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.16, 0.08), edgeMat);
    blade.position.set(0, 0.4, -0.17);
    g.add(blade);

    g.position.set(0.32, -0.38, -0.58);
    g.rotation.set(0.18, -0.25, 0.1);
    return g;
  }

  _buildHammer() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8f6239, roughness: 0.78 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x5c646b, roughness: 0.38, metalness: 0.82 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.62, 8), woodMat);
    handle.position.y = 0.04;
    g.add(handle);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.22), ironMat);
    head.position.set(0, 0.34, -0.02);
    g.add(head);

    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.04, 8), ironMat);
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 0.34, -0.14);
    g.add(face);

    g.position.set(0.3, -0.36, -0.52);
    g.rotation.set(0.2, -0.22, 0.08);
    return g;
  }

  _buildHoe() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c5433, roughness: 0.82 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x677078, roughness: 0.42, metalness: 0.78 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.92, 8), woodMat);
    handle.position.y = 0.12;
    g.add(handle);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.17), steelMat);
    blade.position.set(0, 0.54, -0.09);
    blade.rotation.x = 0.32;
    g.add(blade);

    g.position.set(0.32, -0.44, -0.62);
    g.rotation.set(0.24, -0.2, 0.12);
    return g;
  }

  _buildRadio() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x262b28, roughness: 0.6, metalness: 0.25 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x3bd16f });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x4b5257, roughness: 0.35, metalness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.21, 0.055), bodyMat);
    g.add(body);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.055, 0.008), screenMat);
    screen.position.set(0, 0.045, 0.028);
    g.add(screen);

    this.radioLed = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), ledMat);
    this.radioLed.position.set(0.032, 0.088, 0.028);
    g.add(this.radioLed);

    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.24, 6), metalMat);
    ant.position.set(-0.035, 0.21, 0);
    g.add(ant);

    g.position.set(0.28, -0.26, -0.46);
    g.rotation.set(-0.15, -0.35, 0.06);
    return g;
  }

  selectTool(index) {
    const idx = ((index % TOOLS.length) + TOOLS.length) % TOOLS.length;
    if (idx === this.activeIndex) return;
    this.activeIndex = idx;
    this.toolMeshes.forEach((m, i) => {
      m.visible = i === idx;
    });
    this.switchAnim = 1.0;
  }

  triggerSwing() {
    this.swingTime = this.swingDuration;
  }

  update(dt, elapsed, moveSpeed, isSprinting, mouseDX, mouseDY) {
    // Sway suave ao girar a câmera
    const targetSwayX = THREE.MathUtils.clamp(-mouseDX * 0.0005, -0.045, 0.045);
    const targetSwayY = THREE.MathUtils.clamp(mouseDY * 0.0004, -0.035, 0.035);
    this.swayX += (targetSwayX - this.swayX) * Math.min(1, dt * 12);
    this.swayY += (targetSwayY - this.swayY) * Math.min(1, dt * 12);

    // Bobbing proporcional ao passo
    const moving = moveSpeed > 0.3;
    if (moving) {
      this.bobPhase += dt * (isSprinting ? 13 : 8.5);
    }
    const bobX = moving ? Math.cos(this.bobPhase) * (isSprinting ? 0.024 : 0.012) : 0;
    const bobY = moving ? Math.abs(Math.sin(this.bobPhase)) * (isSprinting ? 0.026 : 0.013) : Math.sin(elapsed * 2.1) * 0.004;

    // Animação de troca de ferramenta
    if (this.switchAnim > 0) {
      this.switchAnim = Math.max(0, this.switchAnim - dt * 4.5);
    }

    // Animação de golpe (machadada / martelada / enxadada / sinal de rádio)
    let swingPitch = 0;
    let swingZ = 0;
    let swingRoll = 0;
    if (this.swingTime > 0) {
      this.swingTime = Math.max(0, this.swingTime - dt);
      const t = 1 - this.swingTime / this.swingDuration;
      const curve = Math.sin(t * Math.PI);
      if (this.activeIndex === 3) {
        // Rádio: levanta na frente
        swingPitch = curve * 0.25;
        swingZ = -curve * 0.08;
      } else {
        // Ferramenta de impacto: golpe rápido para frente/baixo
        swingPitch = -curve * 1.15;
        swingZ = -curve * 0.14;
        swingRoll = curve * 0.35;
      }
    }

    const sprintTilt = isSprinting && moving && this.swingTime <= 0 ? -0.22 : 0;

    this.root.position.set(
      this.swayX + bobX,
      this.swayY - bobY - this.switchAnim * 0.25,
      swingZ
    );
    this.root.rotation.set(
      swingPitch + sprintTilt,
      this.swayX * 0.6,
      swingRoll
    );

    // LED piscando no rádio
    if (this.radioLed) {
      this.radioLed.visible = Math.sin(elapsed * 5.5) > -0.2;
    }
  }
}
