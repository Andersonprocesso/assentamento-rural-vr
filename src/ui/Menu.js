import { QUALITY_PRESETS } from '../core/Settings.js';

export class Menu {
  constructor(rootEl, settings, simulation, player, bus) {
    this.root = rootEl;
    this.settings = settings;
    this.simulation = simulation;
    this.player = player;
    this.bus = bus;

    this.mode = 'title'; // 'title' | 'pause' | 'hidden'
    this._buildDOM();
  }

  _buildDOM() {
    this.root.innerHTML = `
      <div id="menu-title" class="menu-screen title-screen">
        <div class="title-card">
          <div class="title-kicker">ASSENTAMENTO RURAL · 1.525.000 m² · 63 ALQUEIRES PAULISTAS</div>
          <h1 class="title-logo">OPERAÇÃO<br><span>AGRO VILA</span></h1>
          <p class="title-story">
            Em meio a <strong>1.525.000 m² de mata nativa fechada</strong>, apenas a clareira central de <strong>25.000 m²</strong> está limpa.
            Os <strong>30 sítios de 50.000 m²</strong> já foram cercados e aguardam trabalho.
            <strong>30 famílias acampadas</strong> (150 moradores, maioria de 5 pessoas) começam agora a transformar a floresta em casas, escola, posto de saúde, serraria, hortas e lavouras.
          </p>
          <div class="title-actions">
            <button type="button" class="btn-start" id="btn-start-game">INICIAR OPERAÇÃO</button>
            <button type="button" class="btn-drone-start" id="btn-start-drone">ENTRAR NO MODO DRONE</button>
          </div>
          <div class="title-settings-row">
            <label>Qualidade Gráfica
              <select id="title-quality">
                ${Object.entries(QUALITY_PRESETS).map(([k, v]) => `<option value="${k}" ${this.settings.quality === k ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </label>
            <label>Volume
              <input id="title-volume" type="range" min="0" max="100" value="${Math.round(this.settings.masterVolume * 100)}">
            </label>
          </div>
          <div class="title-controls">
            <div><kbd>W A S D</kbd> Andar · <kbd>Shift</kbd> Correr · <kbd>Espaço</kbd> Pular</div>
            <div><kbd>1</kbd> Machado · <kbd>2</kbd> Martelo · <kbd>3</kbd> Enxada · <kbd>4</kbd> Rádio (Mutirão)</div>
            <div><kbd>V</kbd> Alternar Drone Aéreo · <kbd>M</kbd> Mapa Tático · <kbd>T</kbd> Velocidade (1x/3x/8x)</div>
          </div>
        </div>
      </div>

      <div id="menu-pause" class="menu-screen pause-screen">
        <div class="pause-card">
          <div class="title-kicker">OPERAÇÃO PAUSADA</div>
          <h2>AGRO VILA · 30 FAMÍLIAS</h2>
          <div class="pause-buttons">
            <button type="button" class="btn-start" id="btn-resume">RETOMAR OPERAÇÃO</button>
            <button type="button" class="btn-sec" id="btn-pause-map">ABRIR MAPA TÁTICO [M]</button>
            <button type="button" class="btn-sec" id="btn-pause-drone">ALTERNAR DRONE AÉREO [V]</button>
            <button type="button" class="btn-sec" id="btn-pause-center">VOLTAR AO ACAMPAMENTO CENTRAL</button>
          </div>
          <div class="pause-settings">
            <label>Qualidade
              <select id="pause-quality">
                ${Object.entries(QUALITY_PRESETS).map(([k, v]) => `<option value="${k}" ${this.settings.quality === k ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </label>
            <label>Sensibilidade do Mouse
              <input id="pause-sens" type="range" min="5" max="45" value="${Math.round(this.settings.sensitivity * 10000)}">
            </label>
            <label>Campo de Visão (FOV)
              <input id="pause-fov" type="range" min="60" max="92" value="${this.settings.fov}">
            </label>
            <label>Volume do Áudio
              <input id="pause-vol" type="range" min="0" max="100" value="${Math.round(this.settings.masterVolume * 100)}">
            </label>
            <label>Velocidade das Famílias
              <select id="pause-speed">
                <option value="1">1x (Tempo Real)</option>
                <option value="3">3x (Acelerado)</option>
                <option value="8">8x (Construção Rápida)</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    `;

    this.titleEl = this.root.querySelector('#menu-title');
    this.pauseEl = this.root.querySelector('#menu-pause');
    this.pauseSpeedEl = this.root.querySelector('#pause-speed');

    this.root.querySelector('#btn-start-game').addEventListener('click', () => {
      this.hide();
      this.bus.emit('game:start', { drone: false });
    });

    this.root.querySelector('#btn-start-drone').addEventListener('click', () => {
      this.hide();
      this.bus.emit('game:start', { drone: true });
    });

    this.root.querySelector('#btn-resume').addEventListener('click', () => {
      this.hide();
      this.bus.emit('game:resume');
    });

    this.root.querySelector('#btn-pause-map').addEventListener('click', () => {
      this.hide();
      this.bus.emit('ui:open-map');
    });

    this.root.querySelector('#btn-pause-drone').addEventListener('click', () => {
      this.player.toggleDroneMode();
      this.hide();
      this.bus.emit('game:resume');
    });

    this.root.querySelector('#btn-pause-center').addEventListener('click', () => {
      this.player.teleportTo(0, 22, 0, false);
      this.hide();
      this.bus.emit('game:resume');
    });

    const syncQuality = (val) => {
      this.settings.setQuality(val);
      this.root.querySelector('#title-quality').value = val;
      this.root.querySelector('#pause-quality').value = val;
    };
    this.root.querySelector('#title-quality').addEventListener('change', (e) => syncQuality(e.target.value));
    this.root.querySelector('#pause-quality').addEventListener('change', (e) => syncQuality(e.target.value));

    const syncVol = (val) => {
      this.settings.setVolume(Number(val) / 100);
      this.root.querySelector('#title-volume').value = val;
      this.root.querySelector('#pause-vol').value = val;
    };
    this.root.querySelector('#title-volume').addEventListener('input', (e) => syncVol(e.target.value));
    this.root.querySelector('#pause-vol').addEventListener('input', (e) => syncVol(e.target.value));

    this.root.querySelector('#pause-sens').addEventListener('input', (e) => {
      this.settings.setSensitivity(Number(e.target.value) / 10000);
    });
    this.root.querySelector('#pause-fov').addEventListener('input', (e) => {
      this.settings.setFov(Number(e.target.value));
    });
    this.pauseSpeedEl.addEventListener('change', (e) => {
      this.simulation.setSpeed(Number(e.target.value));
    });

    this.showTitle();
  }

  showTitle() {
    this.mode = 'title';
    this.titleEl.classList.add('active');
    this.pauseEl.classList.remove('active');
  }

  showPause() {
    this.mode = 'pause';
    this.pauseSpeedEl.value = String(this.simulation.simSpeed);
    this.titleEl.classList.remove('active');
    this.pauseEl.classList.add('active');
  }

  hide() {
    this.mode = 'hidden';
    this.titleEl.classList.remove('active');
    this.pauseEl.classList.remove('active');
  }
}
