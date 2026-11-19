import { OUTER_TRI, INNER_TRI, LOTS, RIVER_A, RIVER_B, RIVER_NORMAL } from '../world/SettlementMath.js';

export class Minimap {
  constructor(canvas, constructions, simulation) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.constructions = constructions;
    this.simulation = simulation;
    this._accum = 0;

    // Escala do mundo para o minimapa (triângulo cabe em ~2200m x 1800m)
    this.scale = 0.082;
  }

  _toMap(x, z, w, h, zoom = 1) {
    const sc = this.scale * zoom;
    return {
      x: w * 0.5 + x * sc,
      y: h * 0.62 + z * sc,
    };
  }

  update(dt, player) {
    this._accum += dt;
    if (this._accum < 0.08) return; // ~12 FPS no minimapa (super leve)
    this._accum = 0;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Fundo de floresta externa
    ctx.fillStyle = '#0e1b13';
    ctx.fillRect(0, 0, w, h);

    // Rio na lateral oeste
    ctx.save();
    ctx.strokeStyle = '#2d7da3';
    ctx.lineWidth = 7;
    ctx.beginPath();
    const rA = this._toMap(RIVER_A.x + RIVER_NORMAL.x * 36, RIVER_A.z + RIVER_NORMAL.z * 36, w, h);
    const rB = this._toMap(RIVER_B.x + RIVER_NORMAL.x * 36, RIVER_B.z + RIVER_NORMAL.z * 36, w, h);
    ctx.moveTo(rA.x, rA.y);
    ctx.lineTo(rB.x, rB.y);
    ctx.stroke();
    ctx.restore();

    // Desenha os 30 lotes cercados
    for (let i = 0; i < LOTS.length; i++) {
      const lot = LOTS[i];
      const site = this.constructions.lotSites.get(lot.id);
      ctx.beginPath();
      lot.quad.forEach((p, idx) => {
        const mp = this._toMap(p.x, p.z, w, h);
        if (idx === 0) ctx.moveTo(mp.x, mp.y);
        else ctx.lineTo(mp.x, mp.y);
      });
      ctx.closePath();

      if (site && site.completed) {
        ctx.fillStyle = '#4e7a3b';
      } else if (site && site.progress > 0.05) {
        ctx.fillStyle = '#31572d';
      } else {
        ctx.fillStyle = '#1b3b22'; // mata nativa fechada
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(214, 184, 128, 0.38)'; // cercas dos 30 lotes!
      ctx.lineWidth = 0.85;
      ctx.stroke();
    }

    // Área comum central limpa (25.000 m²)
    ctx.beginPath();
    INNER_TRI.forEach((p, idx) => {
      const mp = this._toMap(p.x, p.z, w, h);
      if (idx === 0) ctx.moveTo(mp.x, mp.y);
      else ctx.lineTo(mp.x, mp.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#8fa85e';
    ctx.fill();
    ctx.strokeStyle = '#e5c17b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Contorno externo do triângulo de 1.525.000 m²
    ctx.beginPath();
    OUTER_TRI.forEach((p, idx) => {
      const mp = this._toMap(p.x, p.z, w, h);
      if (idx === 0) ctx.moveTo(mp.x, mp.y);
      else ctx.lineTo(mp.x, mp.y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#d4b47c';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Obras comunitárias
    for (const site of this.constructions.communitySites.values()) {
      const mp = this._toMap(site.x, site.z, w, h);
      ctx.fillStyle = site.completed ? '#65e07f' : '#f2b84b';
      ctx.fillRect(mp.x - 2, mp.y - 2, 4, 4);
    }

    // Casas concluídas nos sítios
    for (const site of this.constructions.lotSites.values()) {
      if (site.progress <= 0.05) continue;
      const mp = this._toMap(site.x, site.z, w, h);
      ctx.fillStyle = site.completed ? '#ffdf80' : '#d68942';
      ctx.fillRect(mp.x - 1.5, mp.y - 1.5, 3, 3);
    }

    // Amostra dos moradores trabalhando (pontos claros)
    ctx.fillStyle = 'rgba(255, 248, 220, 0.65)';
    const vs = this.simulation.villagers;
    for (let i = 0; i < vs.length; i += 2) {
      const v = vs[i];
      const mp = this._toMap(v.x, v.z, w, h);
      ctx.fillRect(mp.x - 0.7, mp.y - 0.7, 1.5, 1.5);
    }

    // Jogador + cone de visão
    const pp = this._toMap(player.position.x, player.position.z, w, h);
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    const ang = Math.atan2(fz, fx);

    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.fillStyle = 'rgba(255, 210, 90, 0.24)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 18, ang - 0.45, ang + 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1410';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}
