import { TOOLS } from '../player/ViewModel.js';
import { Minimap } from './Minimap.js';

const COMPASS_DIRS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

export class HUD {
  constructor(rootEl, sky, forest, constructions, simulation, player, bus) {
    this.root = rootEl;
    this.sky = sky;
    this.forest = forest;
    this.constructions = constructions;
    this.simulation = simulation;
    this.player = player;
    this.bus = bus;

    this.feedItems = [];
    this.bannerTimer = 0;
    this._uiAccum = 0;

    this._buildDOM();
    this._wireEvents();
  }

  _buildDOM() {
    this.root.innerHTML = `
      <div class="hud-top-left">
        <div class="minimap-box">
          <canvas id="hud-minimap" width="184" height="162"></canvas>
          <div class="minimap-caption">1.525.000 m² · 30 SÍTIOS CERCADOS</div>
        </div>
      </div>

      <div class="hud-top-center">
        <div class="compass-bar">
          <span id="hud-compass">N · 000°</span>
          <span class="sep">|</span>
          <span id="hud-clock">DIA 1 · 07:35</span>
          <span class="sep">|</span>
          <span id="hud-speed">1x</span>
        </div>
        <div id="hud-location" class="hud-location">ÁREA COMUM · ACAMPAMENTO / AGRO VILA (25.000 m²)</div>
        <div class="mission-box">
          <div id="hud-phase-title" class="mission-title">FASE 1 · ACAMPAMENTO NA CLAREIRA</div>
          <div id="hud-phase-obj" class="mission-obj">Cortar madeira na mata e erguer a Serraria & Galpão</div>
        </div>
      </div>

      <div class="hud-top-right">
        <div class="res-grid">
          <div class="res-card"><small>MADEIRA</small><strong id="res-wood">35</strong></div>
          <div class="res-card"><small>PALHA/CIPÓ</small><strong id="res-thatch">20</strong></div>
          <div class="res-card"><small>BARRO</small><strong id="res-clay">25</strong></div>
          <div class="res-card"><small>ALIMENTO</small><strong id="res-food">90</strong></div>
        </div>
        <div class="stats-strip">
          <span>Famílias: <strong>30</strong> (150 mor.)</span>
          <span>Casas: <strong id="stat-houses">0/30</strong></span>
          <span>Vila: <strong id="stat-comm">0/6</strong></span>
          <span>Árvores: <strong id="stat-trees">0</strong></span>
        </div>
        <div id="hud-feed" class="hud-feed"></div>
      </div>

      <div id="hud-crosshair" class="hud-crosshair">
        <span class="ch-dot"></span>
      </div>

      <div id="hud-prompt" class="hud-prompt">
        <div id="hud-prompt-title" class="prompt-title"></div>
        <div id="hud-prompt-sub" class="prompt-sub"></div>
        <div id="hud-prompt-bar" class="prompt-bar"><div id="hud-prompt-fill" class="prompt-fill"></div></div>
      </div>

      <div id="hud-banner" class="hud-banner">
        <div id="hud-banner-tag" class="banner-tag">MARCO DA OPERAÇÃO</div>
        <div id="hud-banner-text" class="banner-text"></div>
      </div>

      <div class="hud-bottom">
        <div id="hud-hotbar" class="hotbar">
          ${TOOLS.map((t, idx) => `
            <div class="hotbar-slot ${idx === 0 ? 'active' : ''}" data-slot="${idx}">
              <span class="slot-key">${t.key}</span>
              <span class="slot-name">${t.name}</span>
            </div>
          `).join('')}
        </div>
        <div class="hud-hints">
          <span><kbd>WASD</kbd> Mover</span>
          <span><kbd>Shift</kbd> Correr</span>
          <span><kbd>Clique</kbd> Usar ferramenta</span>
          <span><kbd>V</kbd> Drone Aéreo</span>
          <span><kbd>M</kbd> Mapa Tático</span>
          <span><kbd>T</kbd> Velocidade</span>
          <span><kbd>ESC</kbd> Pausa</span>
        </div>
      </div>
    `;

    this.minimap = new Minimap(
      this.root.querySelector('#hud-minimap'),
      this.constructions,
      this.simulation
    );

    this.els = {
      compass: this.root.querySelector('#hud-compass'),
      clock: this.root.querySelector('#hud-clock'),
      speed: this.root.querySelector('#hud-speed'),
      location: this.root.querySelector('#hud-location'),
      phaseTitle: this.root.querySelector('#hud-phase-title'),
      phaseObj: this.root.querySelector('#hud-phase-obj'),
      wood: this.root.querySelector('#res-wood'),
      thatch: this.root.querySelector('#res-thatch'),
      clay: this.root.querySelector('#res-clay'),
      food: this.root.querySelector('#res-food'),
      houses: this.root.querySelector('#stat-houses'),
      comm: this.root.querySelector('#stat-comm'),
      trees: this.root.querySelector('#stat-trees'),
      feed: this.root.querySelector('#hud-feed'),
      crosshair: this.root.querySelector('#hud-crosshair'),
      prompt: this.root.querySelector('#hud-prompt'),
      promptTitle: this.root.querySelector('#hud-prompt-title'),
      promptSub: this.root.querySelector('#hud-prompt-sub'),
      promptBar: this.root.querySelector('#hud-prompt-bar'),
      promptFill: this.root.querySelector('#hud-prompt-fill'),
      banner: this.root.querySelector('#hud-banner'),
      bannerTag: this.root.querySelector('#hud-banner-tag'),
      bannerText: this.root.querySelector('#hud-banner-text'),
      slots: Array.from(this.root.querySelectorAll('.hotbar-slot')),
    };
  }

  _wireEvents() {
    this.bus.on('player:tool', ({ index }) => {
      this.els.slots.forEach((el, i) => el.classList.toggle('active', i === index));
    });

    this.bus.on('player:mode', ({ drone }) => {
      this.els.crosshair.style.opacity = drone ? '0.25' : '1';
    });

    this.bus.on('feed:log', ({ text, type }) => {
      this.pushFeed(text, type);
    });

    this.bus.on('phase:completed', ({ phase }) => {
      this.showBanner('FASE CONCLUÍDA', phase.title);
    });

    this.bus.on('operation:victory', () => {
      this.showBanner('OPERAÇÃO AGRO VILA CONCLUÍDA!', 'Todas as 30 famílias instaladas e produzindo em 1.525.000 m²!');
    });

    this.bus.on('sim:speed', ({ speed }) => {
      this.els.speed.textContent = `${speed}x`;
      this.pushFeed(`Velocidade da simulação ajustada para ${speed}x`, 'info');
    });
  }

  pushFeed(text, type = 'info') {
    this.feedItems.unshift({ text, type, born: performance.now() });
    if (this.feedItems.length > 6) this.feedItems.length = 6;
    this._renderFeed();
  }

  _renderFeed() {
    this.els.feed.innerHTML = this.feedItems
      .map((item) => `<div class="feed-line feed-${item.type}">${item.text}</div>`)
      .join('');
  }

  showBanner(tag, text) {
    this.els.bannerTag.textContent = tag;
    this.els.bannerText.textContent = text;
    this.els.banner.classList.add('show');
    this.bannerTimer = 5.5;
  }

  setVisible(flag) {
    this.root.classList.toggle('visible', !!flag);
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.els.banner.classList.remove('show');
      }
    }

    this.minimap.update(dt, this.player);

    // Atualiza prompt da mira a cada frame para resposta instantânea
    const tgt = this.player.currentTarget;
    if (tgt && !this.player.droneMode) {
      this.els.prompt.classList.add('show');
      this.els.promptTitle.textContent = tgt.label;
      this.els.promptSub.textContent = tgt.sublabel;
      if (typeof tgt.progress === 'number') {
        this.els.promptBar.style.display = 'block';
        this.els.promptFill.style.width = `${Math.round(Math.max(0, Math.min(1, tgt.progress)) * 100)}%`;
      } else {
        this.els.promptBar.style.display = 'none';
      }
      this.els.crosshair.classList.add('hot');
    } else {
      this.els.prompt.classList.remove('show');
      this.els.crosshair.classList.remove('hot');
    }

    // Atualiza números e bússola a ~10Hz
    this._uiAccum += dt;
    if (this._uiAccum < 0.1) return;
    this._uiAccum = 0;

    // Bússola (yaw=0 olha para -Z = Norte)
    let deg = ((-this.player.yaw * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    const dirLabel = COMPASS_DIRS[Math.round(deg / 45) % 8];
    this.els.compass.textContent = `${dirLabel} · ${String(Math.round(deg)).padStart(3, '0')}°`;

    this.els.clock.textContent = `DIA ${this.sky.dayCount} · ${this.sky.getFormattedTime()}`;
    this.els.speed.textContent = `${this.simulation.simSpeed}x`;
    this.els.location.textContent = this.player.droneMode
      ? `DRONE AÉREO · ALTITUDE ${Math.round(this.player.position.y)} m · ${this.player.getLocationLabel()}`
      : this.player.getLocationLabel();

    const r = this.simulation.resources;
    this.els.wood.textContent = Math.floor(r.wood);
    this.els.thatch.textContent = Math.floor(r.thatch);
    this.els.clay.textContent = Math.floor(r.clay);
    this.els.food.textContent = Math.floor(r.food);

    const stats = this.constructions.getStats();
    this.els.houses.textContent = `${stats.housesDone}/${stats.housesTotal}`;
    this.els.comm.textContent = `${stats.communityDone}/${stats.communityTotal}`;
    this.els.trees.textContent = `${this.forest.cutTrees}`;

    const phase = this.simulation.getCurrentPhase();
    this.els.phaseTitle.textContent = this.simulation.operationComplete
      ? 'AGRO VILA CONSOLIDADA ✓'
      : phase.title;
    this.els.phaseObj.textContent = this.simulation.operationComplete
      ? '30 famílias morando, cultivando e prosperando nos 1.525.000 m²'
      : phase.objective;
  }
}
