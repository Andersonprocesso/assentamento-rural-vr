import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
uniform vec3 uBottomColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunGlow;
varying vec3 vWorldPos;

void main() {
  vec3 dir = normalize(vWorldPos);
  float h = clamp(dir.y, -1.0, 1.0);

  vec3 col;
  if (h >= 0.0) {
    float t = pow(h, 0.55);
    col = mix(uHorizonColor, uTopColor, t);
  } else {
    float t = pow(-h, 0.45);
    col = mix(uHorizonColor, uBottomColor, t);
  }

  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  float halo = pow(sunDot, 12.0) * 0.42 * uSunGlow;
  float core = smoothstep(0.9982, 0.9994, sunDot) * 2.2 * uSunGlow;
  col += uSunColor * (halo + core);

  // Névoa suave no horizonte
  float horizonBand = exp(-abs(h) * 9.0) * 0.18;
  col = mix(col, uHorizonColor * 1.08, horizonBand);

  gl_FragColor = vec4(col, 1.0);
}
`;

export class SkyLighting {
  constructor(scene, settings, bus) {
    this.scene = scene;
    this.settings = settings;
    this.bus = bus;

    // Hora do dia em horas (0..24), começa às 07:35 (manhã dourada de trabalho na mata)
    this.timeOfDay = 7.6;
    this.dayCount = 1;
    this.sunDir = new THREE.Vector3(0.65, 0.45, -0.55).normalize();

    // Cúpula atmosférica
    const skyGeo = new THREE.SphereGeometry(2350, 32, 20);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#21659c') },
        uHorizonColor: { value: new THREE.Color('#e8c89c') },
        uBottomColor: { value: new THREE.Color('#274330') },
        uSunDir: { value: this.sunDir.clone() },
        uSunColor: { value: new THREE.Color('#ffdfa3') },
        uSunGlow: { value: 1.0 },
      },
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);

    // Neblina exponencial atmosférica
    this.fog = new THREE.FogExp2(0xd8c9ae, this.settings.preset.fogDensity);
    this.scene.fog = this.fog;

    // Luz hemisférica
    this.hemiLight = new THREE.HemisphereLight(0xcfe4ff, 0x3b5235, 0.95);
    this.scene.add(this.hemiLight);

    // Luz solar principal com sombras dinâmicas que acompanham o jogador
    this.sunLight = new THREE.DirectionalLight(0xffe7c2, 2.35);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.04;
    this.sunLight.target = new THREE.Object3D();
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Luz de preenchimento suave oposta ao sol
    this.fillLight = new THREE.DirectionalLight(0x88b4db, 0.45);
    this.fillLight.position.set(-140, 90, 120);
    this.scene.add(this.fillLight);

    // Cores temporárias pré-alocadas (zero alocação por frame)
    this._cDayTop = new THREE.Color('#1f6ba8');
    this._cGoldTop = new THREE.Color('#244a75');
    this._cNightTop = new THREE.Color('#0c1829');

    this._cDayHor = new THREE.Color('#c8dce3');
    this._cGoldHor = new THREE.Color('#f0b67d');
    this._cNightHor = new THREE.Color('#1c2d42');

    this._cDaySun = new THREE.Color('#fff1d6');
    this._cGoldSun = new THREE.Color('#ff9d4d');
    this._cMoon = new THREE.Color('#8bb6e8');

    this._cFog = new THREE.Color();

    this.applySettings();
    this.bus.on('settings:changed', () => this.applySettings());
  }

  applySettings() {
    const p = this.settings.preset;
    this.fog.density = p.fogDensity;
    this.sunLight.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    const d = p.shadowDistance;
    const cam = this.sunLight.shadow.camera;
    cam.left = -d;
    cam.right = d;
    cam.top = d;
    cam.bottom = -d;
    cam.near = 10;
    cam.far = 620;
    cam.updateProjectionMatrix();
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  update(dt, simSpeed, focusPos) {
    // 1 dia de jogo ≈ 7 minutos em 1x (ciclo suave e agradável)
    const hoursPerSec = (24 / 420) * simSpeed;
    this.timeOfDay += dt * hoursPerSec;
    if (this.timeOfDay >= 24) {
      this.timeOfDay -= 24;
      this.dayCount += 1;
      this.bus.emit('day:new', { day: this.dayCount });
    }

    // Ângulo do sol (nasce às 6h, pino às 12h, põe-se às 18h)
    const phase = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(phase);
    const azim = Math.cos(phase);

    // Mantém iluminação utilizável mesmo à noite (lua azulada)
    const isDay = elev > -0.05;
    if (isDay) {
      this.sunDir.set(azim * 0.85, Math.max(0.12, elev), -0.45).normalize();
    } else {
      this.sunDir.set(-azim * 0.7, Math.max(0.28, -elev * 0.8), 0.45).normalize();
    }

    // Fator de ouro (nascer / pôr do sol) e fator diurno
    const dayAmt = THREE.MathUtils.clamp((elev + 0.12) / 0.42, 0, 1);
    const goldAmt = Math.exp(-Math.pow((elev - 0.14) / 0.24, 2)) * THREE.MathUtils.clamp((elev + 0.16) / 0.2, 0, 1);

    const topCol = this.skyMat.uniforms.uTopColor.value;
    const horCol = this.skyMat.uniforms.uHorizonColor.value;
    const sunCol = this.skyMat.uniforms.uSunColor.value;

    topCol.copy(this._cNightTop).lerp(this._cDayTop, dayAmt).lerp(this._cGoldTop, goldAmt * 0.75);
    horCol.copy(this._cNightHor).lerp(this._cDayHor, dayAmt).lerp(this._cGoldHor, goldAmt * 0.9);
    sunCol.copy(this._cMoon).lerp(this._cDaySun, dayAmt).lerp(this._cGoldSun, goldAmt * 0.85);

    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.uSunGlow.value = 0.45 + dayAmt * 0.75;

    this._cFog.copy(horCol).lerp(topCol, 0.18);
    this.fog.color.copy(this._cFog);

    this.sunLight.color.copy(sunCol);
    this.sunLight.intensity = 0.55 + dayAmt * 2.05 + goldAmt * 0.25;
    this.hemiLight.intensity = 0.48 + dayAmt * 0.65;
    this.fillLight.intensity = 0.22 + dayAmt * 0.3;

    // Centraliza o frustum de sombra perto do jogador (com snap para evitar shimmer)
    const fx = focusPos ? Math.round(focusPos.x / 4) * 4 : 0;
    const fz = focusPos ? Math.round(focusPos.z / 4) * 4 : 0;
    this.sunLight.target.position.set(fx, 0, fz);
    this.sunLight.position.set(
      fx + this.sunDir.x * 260,
      this.sunDir.y * 260,
      fz + this.sunDir.z * 260
    );

    if (focusPos) {
      this.skyMesh.position.set(focusPos.x, 0, focusPos.z);
    }
  }

  getFormattedTime() {
    const h = Math.floor(this.timeOfDay) % 24;
    const m = Math.floor((this.timeOfDay - Math.floor(this.timeOfDay)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  isNight() {
    return this.timeOfDay < 5.7 || this.timeOfDay > 18.6;
  }
}
