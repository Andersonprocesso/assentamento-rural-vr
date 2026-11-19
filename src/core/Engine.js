import * as THREE from 'three';

export class Engine {
  constructor(container, settings, bus) {
    this.container = container;
    this.settings = settings;
    this.bus = bus;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.viewScene = new THREE.Scene();

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, aspect, 0.15, 2800);
    this.viewCamera = new THREE.PerspectiveCamera(58, aspect, 0.03, 12);

    // Iluminação dedicada ao ViewModel (ferramentas na mão)
    const vmHemi = new THREE.HemisphereLight(0xfff3de, 0x3b4d37, 1.35);
    const vmKey = new THREE.DirectionalLight(0xffe5c2, 1.45);
    vmKey.position.set(1.5, 2.5, 1.8);
    const vmFill = new THREE.DirectionalLight(0x9ec5e6, 0.55);
    vmFill.position.set(-2.0, 1.0, -1.2);
    this.viewScene.add(vmHemi, vmKey, vmFill);

    this.applySettings();
    this.container.appendChild(this.renderer.domElement);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this.bus.on('settings:changed', () => this.applySettings());
  }

  applySettings() {
    const preset = this.settings.preset;
    const pr = Math.min(window.devicePixelRatio || 1, preset.pixelRatioMax);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h;
    this.viewCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(showViewModel = true) {
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
    if (showViewModel) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewScene, this.viewCamera);
    }
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
