import {
  OUTER_TRI,
  INNER_TRI,
  LOTS,
  RIVER_A,
  RIVER_B,
  RIVER_NORMAL,
  findLotAt,
  formatNumberBR,
} from '../world/SettlementMath.js';

export class TacticalMap {
  constructor(rootEl, constructions, simulation, player, bus) {
    this.root = rootEl;
    this.constructions = constructions;
    this.simulation = simulation;
    this.player = player;
    this.bus = bus;

    this.visible = false;
    this.selected = null; // { kind: 'lot'|'community', id }
    this.canvas = null;
    this.ctx = null;
    this._canvasAccum = 0;

    this._buildDOM();
  }

  _buildDOM() {
    this.root.innerHTML = `
      <div class="tmap-shell">
        <div class="tmap-header">
          <div>
            <h2>MAPA TÁTICO · AGRO VILA (1.525.000 m²)</h2>
            <p>Clique em qualquer um dos 30 sítios cercados ou obra da área comum para inspecionar, convocar mutirão ou teleportar.</p>
          </div>
          <div class="tmap-header-actions">
            <button type="button" class="btn-sec" data-act="speed">Velocidade: <span id="tmap-speed">1x</span></button>
            <button type="button" class="btn-sec" data-act="drone">Vista Aérea (Drone)</button>
            <button type="button" class="btn-prim" data-act="close">Fechar [M]</button>
          </div>
        </div>
        <div class="tmap-body">
          <div class="tmap-canvas-wrap">
            <canvas id="tmap-canvas" width="760" height="620"></canvas>
            <div class="tmap-legend">
              <span><i class="lg-mata"></i> Mata fechada (lote cercado)</span>
              <span><i class="lg-obra"></i> Em limpeza / construção</span>
              <span><i class="lg-casa"></i> Sítio com casa & lavoura</span>
              <span><i class="lg-comum"></i> Área comum limpa (25.000 m²)</span>
            </div>
          </div>
          <aside class="tmap-sidebar">
            <div id="tmap-inspector" class="tmap-inspector"></div>
            <div class="tmap-comm-list">
              <h3>OBRAS DA ÁREA COMUM</h3>
              <div id="tmap-comm-items"></div>
            </div>
          </aside>
        </div>
      </div>
    `;

    this.canvas = this.root.querySelector('#tmap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.inspectorEl = this.root.querySelector('#tmap-inspector');
    this.commItemsEl = this.root.querySelector('#tmap-comm-items');
    this.speedLabelEl = this.root.querySelector('#tmap-speed');

    this.root.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    this.root.querySelector('[data-act="speed"]').addEventListener('click', () => {
      this.simulation.cycleSpeed();
      this.render();
    });
    this.root.querySelector('[data-act="drone"]').addEventListener('click', () => {
      this.player.teleportTo(0, 420, 0, true);
      this.close();
    });

    this.canvas.addEventListener('click', (e) => this._onCanvasClick(e));
  }

  _toScreen(x, z) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const sc = 0.31;
    return {
      x: w * 0.5 + x * sc,
      y: h * 0.64 + z * sc,
    };
  }

  _toWorld(sx, sy) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const sc = 0.31;
    return {
      x: (sx - w * 0.5) / sc,
      z: (sy - h * 0.64) / sc,
    };
  }

  _onCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const sy = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    const wp = this._toWorld(sx, sy);

    // Primeiro checa obras comunitárias na área comum
    for (const site of this.constructions.communitySites.values()) {
      if (Math.hypot(wp.x - site.x, wp.z - site.z) < 28) {
        this.selected = { kind: 'community', id: site.id };
        this.render();
        return;
      }
    }

    // Depois checa os 30 lotes cercados
    const lot = findLotAt(wp.x, wp.z);
    if (lot) {
      this.selected = { kind: 'lot', id: lot.id };
      this.render();
    }
  }

  open() {
    this.visible = true;
    this.root.classList.add('open');
    if (!this.selected) this.selected = { kind: 'lot', id: 1 };
    this.render();
    this.bus.emit('ui:map', { open: true });
  }

  close() {
    this.visible = false;
    this.root.classList.remove('open');
    this.bus.emit('ui:map', { open: false });
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  render() {
    if (!this.visible) return;
    if (this.speedLabelEl) this.speedLabelEl.textContent = `${this.simulation.simSpeed}x`;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#0e1b13';
    ctx.fillRect(0, 0, w, h);

    // Rio na lateral oeste
    const rA = this._toScreen(RIVER_A.x + RIVER_NORMAL.x * 38, RIVER_A.z + RIVER_NORMAL.z * 38);
    const rB = this._toScreen(RIVER_B.x + RIVER_NORMAL.x * 38, RIVER_B.z + RIVER_NORMAL.z * 38);
    ctx.strokeStyle = '#2d7da3';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(rA.x, rA.y);
    ctx.lineTo(rB.x, rB.y);
    ctx.stroke();

    // Os 30 lotes cercados
    for (const lot of LOTS) {
      const site = this.constructions.lotSites.get(lot.id);
      const isSel = this.selected && this.selected.kind === 'lot' && this.selected.id === lot.id;

      ctx.beginPath();
      lot.quad.forEach((p, idx) => {
        const sp = this._toScreen(p.x, p.z);
        if (idx === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      });
      ctx.closePath();

      if (site.completed) ctx.fillStyle = '#4f803c';
      else if (site.progress > 0.05) ctx.fillStyle = '#335d2f';
      else ctx.fillStyle = '#1b3d23';
      ctx.fill();

      ctx.strokeStyle = isSel ? '#ffd166' : 'rgba(218, 189, 132, 0.55)';
      ctx.lineWidth = isSel ? 2.6 : 1.1;
      ctx.stroke();

      // Número do lote
      const cx = (lot.iA.x + lot.iB.x + lot.oA.x + lot.oB.x) / 4;
      const cz = (lot.iA.z + lot.iB.z + lot.oA.z + lot.oB.z) / 4;
      const cp = this._toScreen(cx, cz);
      ctx.fillStyle = isSel ? '#ffe28a' : 'rgba(235, 242, 232, 0.72)';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lot.code, cp.x, cp.y);
    }

    // Área comum limpa
    ctx.beginPath();
    INNER_TRI.forEach((p, idx) => {
      const sp = this._toScreen(p.x, p.z);
      if (idx === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#8fa85e';
    ctx.fill();
    ctx.strokeStyle = '#f2c979';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Obras comunitárias
    for (const site of this.constructions.communitySites.values()) {
      const sp = this._toScreen(site.x, site.z);
      const isSel = this.selected && this.selected.kind === 'community' && this.selected.id === site.id;
      ctx.fillStyle = site.completed ? '#5de37c' : '#f4b942';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isSel ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isSel ? '#ffffff' : '#101a13';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.stroke();
    }

    // Moradores em movimento
    ctx.fillStyle = 'rgba(255, 248, 224, 0.78)';
    for (const v of this.simulation.villagers) {
      const sp = this._toScreen(v.x, v.z);
      ctx.fillRect(sp.x - 1, sp.y - 1, 2.2, 2.2);
    }

    // Jogador
    const pp = this._toScreen(this.player.position.x, this.player.position.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9382b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rosa dos ventos
    ctx.fillStyle = '#e6decb';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillText('NORTE (PONTA)', w * 0.5, 20);
    ctx.fillText('RIO', rA.x - 12, (rA.y + rB.y) * 0.5);

    this._renderSidebar();
  }

  updateLive(dt) {
    if (!this.visible) return;
    this._canvasAccum += dt;
    if (this._canvasAccum < 0.12) return;
    this._canvasAccum = 0;
    this._drawCanvasOnly();
  }

  _drawCanvasOnly() {
    if (this.speedLabelEl) this.speedLabelEl.textContent = `${this.simulation.simSpeed}x`;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#0e1b13';
    ctx.fillRect(0, 0, w, h);

    const rA = this._toScreen(RIVER_A.x + RIVER_NORMAL.x * 38, RIVER_A.z + RIVER_NORMAL.z * 38);
    const rB = this._toScreen(RIVER_B.x + RIVER_NORMAL.x * 38, RIVER_B.z + RIVER_NORMAL.z * 38);
    ctx.strokeStyle = '#2d7da3';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(rA.x, rA.y);
    ctx.lineTo(rB.x, rB.y);
    ctx.stroke();

    for (const lot of LOTS) {
      const site = this.constructions.lotSites.get(lot.id);
      const isSel = this.selected && this.selected.kind === 'lot' && this.selected.id === lot.id;

      ctx.beginPath();
      lot.quad.forEach((p, idx) => {
        const sp = this._toScreen(p.x, p.z);
        if (idx === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      });
      ctx.closePath();

      if (site.completed) ctx.fillStyle = '#4f803c';
      else if (site.progress > 0.05) ctx.fillStyle = '#335d2f';
      else ctx.fillStyle = '#1b3d23';
      ctx.fill();

      ctx.strokeStyle = isSel ? '#ffd166' : 'rgba(218, 189, 132, 0.55)';
      ctx.lineWidth = isSel ? 2.6 : 1.1;
      ctx.stroke();

      const cx = (lot.iA.x + lot.iB.x + lot.oA.x + lot.oB.x) / 4;
      const cz = (lot.iA.z + lot.iB.z + lot.oA.z + lot.oB.z) / 4;
      const cp = this._toScreen(cx, cz);
      ctx.fillStyle = isSel ? '#ffe28a' : 'rgba(235, 242, 232, 0.72)';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lot.code, cp.x, cp.y);
    }

    ctx.beginPath();
    INNER_TRI.forEach((p, idx) => {
      const sp = this._toScreen(p.x, p.z);
      if (idx === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#8fa85e';
    ctx.fill();
    ctx.strokeStyle = '#f2c979';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const site of this.constructions.communitySites.values()) {
      const sp = this._toScreen(site.x, site.z);
      const isSel = this.selected && this.selected.kind === 'community' && this.selected.id === site.id;
      ctx.fillStyle = site.completed ? '#5de37c' : '#f4b942';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isSel ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isSel ? '#ffffff' : '#101a13';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 248, 224, 0.78)';
    for (const v of this.simulation.villagers) {
      const sp = this._toScreen(v.x, v.z);
      ctx.fillRect(sp.x - 1, sp.y - 1, 2.2, 2.2);
    }

    const pp = this._toScreen(this.player.position.x, this.player.position.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9382b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#e6decb';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillText('NORTE (PONTA)', w * 0.5, 20);
    ctx.fillText('RIO', rA.x - 12, (rA.y + rB.y) * 0.5);
  }

  _renderSidebar() {
    // Lista rápida das 6 obras comunitárias
    let listHtml = '';
    for (const site of this.constructions.communitySites.values()) {
      const pct = Math.round(site.progress * 100);
      const isPrio = this.constructions.prioritySiteId === site.id && !site.completed;
      listHtml += `
        <button type="button" class="comm-row ${site.completed ? 'done' : ''} ${isPrio ? 'prio' : ''}" data-comm="${site.id}">
          <span>${site.name}${isPrio ? ' ★' : ''}</span>
          <strong>${site.completed ? 'PRONTO' : pct + '%'}</strong>
        </button>
      `;
    }
    this.commItemsEl.innerHTML = listHtml;
    this.commItemsEl.querySelectorAll('[data-comm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selected = { kind: 'community', id: btn.dataset.comm };
        this.render();
      });
    });

    // Ficha detalhada do item selecionado
    if (!this.selected) return;

    if (this.selected.kind === 'lot') {
      const lot = LOTS[this.selected.id - 1];
      const fam = this.simulation.families[lot.id - 1];
      const site = this.constructions.lotSites.get(lot.id);
      const pct = Math.round(site.progress * 100);

      const membersHtml = fam.members
        .map((m) => `<li><strong>${m.firstName}</strong> (${m.role}) — <span>${m.statusLabel}</span></li>`)
        .join('');

      this.inspectorEl.innerHTML = `
        <div class="insp-tag">SÍTIO ${lot.code} · SETOR ${lot.sector}</div>
        <h3>${fam.name} (${fam.size} pessoas)</h3>
        <p class="insp-meta">Área cercada: <strong>${formatNumberBR(lot.area)} m²</strong> (5 ha) · Árvores derrubadas: <strong>${fam.treesCut}</strong></p>
        <div class="insp-bar-wrap">
          <div class="insp-bar-label"><span>Casa & Paiol da Família</span><strong>${pct}%</strong></div>
          <div class="insp-bar"><div class="insp-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <ul class="insp-members">${membersHtml}</ul>
        <div class="insp-actions">
          ${!site.completed ? `<button type="button" class="btn-prim" id="insp-mutirao">Convocar Mutirão</button>` : ''}
          <button type="button" class="btn-sec" id="insp-tp">Ir até o Sítio ${lot.code}</button>
        </div>
      `;

      const mutBtn = this.inspectorEl.querySelector('#insp-mutirao');
      if (mutBtn) {
        mutBtn.addEventListener('click', () => {
          this.simulation.callMutirao(site.id);
          this.render();
        });
      }
      this.inspectorEl.querySelector('#insp-tp').addEventListener('click', () => {
        this.player.teleportTo(lot.gateCenter.x - lot.normal.x * 5, lot.gateCenter.z - lot.normal.z * 5, lot.yaw + Math.PI, false);
        this.close();
      });
    } else {
      const site = this.constructions.communitySites.get(this.selected.id);
      const pct = Math.round(site.progress * 100);
      this.inspectorEl.innerHTML = `
        <div class="insp-tag">OBRA COMUNITÁRIA · ÁREA COMUM</div>
        <h3>${site.name}</h3>
        <p class="insp-meta">${site.desc}</p>
        <p class="insp-meta">Custo total: <strong>${site.cost.wood}</strong> Madeira · <strong>${site.cost.thatch}</strong> Palha · <strong>${site.cost.clay}</strong> Barro</p>
        <div class="insp-bar-wrap">
          <div class="insp-bar-label"><span>Progresso da Construção</span><strong>${pct}%</strong></div>
          <div class="insp-bar"><div class="insp-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="insp-actions">
          ${!site.completed ? `<button type="button" class="btn-prim" id="insp-mutirao">Priorizar Mutirão ★</button>` : ''}
          <button type="button" class="btn-sec" id="insp-tp">Ir até a Obra</button>
        </div>
      `;
      const mutBtn = this.inspectorEl.querySelector('#insp-mutirao');
      if (mutBtn) {
        mutBtn.addEventListener('click', () => {
          this.simulation.callMutirao(site.id);
          this.render();
        });
      }
      this.inspectorEl.querySelector('#insp-tp').addEventListener('click', () => {
        this.player.teleportTo(site.x, site.z + site.radius + 4, 0, false);
        this.close();
      });
    }
  }
}
