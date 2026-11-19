export const AREA_TOTAL = 1_525_000;
export const AREA_COMUM = 25_000;
export const TRI_H = 1550;
export const TRI_B = (2 * AREA_TOTAL) / TRI_H; // ≈ 1967.7419 m

export const OUTER_TRI = [
  { x: 0, z: (-2 * TRI_H) / 3 },          // 0: Norte (ponta)
  { x: TRI_B / 2, z: TRI_H / 3 },         // 1: Sudeste
  { x: -TRI_B / 2, z: TRI_H / 3 },        // 2: Sudoeste
];

const INNER_SCALE = Math.sqrt(AREA_COMUM / AREA_TOTAL);

export const INNER_TRI = OUTER_TRI.map((p) => ({
  x: p.x * INNER_SCALE,
  z: p.z * INNER_SCALE,
}));

export function lerp2D(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.z - q.x * p.z;
  }
  return Math.abs(s) / 2;
}

export function pointInTriangle(px, pz, tri) {
  const a = tri[0];
  const b = tri[1];
  const c = tri[2];
  const v0x = b.x - a.x;
  const v0z = b.z - a.z;
  const v1x = c.x - a.x;
  const v1z = c.z - a.z;
  const v2x = px - a.x;
  const v2z = pz - a.z;
  const den = v0x * v1z - v1x * v0z;
  const u = (v2x * v1z - v1x * v2z) / den;
  const v = (v0x * v2z - v2x * v0z) / den;
  return u >= -0.0005 && v >= -0.0005 && u + v <= 1.0005;
}

export function pointInConvexQuad(px, pz, q) {
  // q = [a, b, c, d] em ordem consistente
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < 4; i++) {
    const p1 = q[i];
    const p2 = q[(i + 1) % 4];
    const cross = (p2.x - p1.x) * (pz - p1.z) - (p2.z - p1.z) * (px - p1.x);
    if (cross > 0) pos++;
    else if (cross < 0) neg++;
    if (pos > 0 && neg > 0) return false;
  }
  return true;
}

export function outwardNormal(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  let nx = -dz / len;
  let nz = dx / len;
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  if (nx * mx + nz * mz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { x: nx, z: nz };
}

export function distToSegmentSq(px, pz, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  if (l2 === 0) return (px - a.x) ** 2 + (pz - a.z) ** 2;
  let t = ((px - a.x) * dx + (pz - a.z) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cz = a.z + t * dz;
  return (px - cx) ** 2 + (pz - cz) ** 2;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rio na lateral Oeste (fora da aresta 2->0)
export const RIVER_NORMAL = outwardNormal(OUTER_TRI[2], OUTER_TRI[0]);
export const RIVER_A = {
  x: OUTER_TRI[2].x + RIVER_NORMAL.x * 34,
  z: OUTER_TRI[2].z + RIVER_NORMAL.z * 34,
};
export const RIVER_B = {
  x: OUTER_TRI[0].x + RIVER_NORMAL.x * 34,
  z: OUTER_TRI[0].z + RIVER_NORMAL.z * 34,
};

const SIDES = [
  { name: 'SUL', i0: 2, i1: 1, start: 1 },
  { name: 'LESTE', i0: 1, i1: 0, start: 11 },
  { name: 'OESTE', i0: 0, i1: 2, start: 21 },
];

export const LOTS = [];

for (const side of SIDES) {
  for (let i = 0; i < 10; i++) {
    const t0 = i / 10;
    const t1 = (i + 1) / 10;
    const iA = lerp2D(INNER_TRI[side.i0], INNER_TRI[side.i1], t0);
    const iB = lerp2D(INNER_TRI[side.i0], INNER_TRI[side.i1], t1);
    const oA = lerp2D(OUTER_TRI[side.i0], OUTER_TRI[side.i1], t0);
    const oB = lerp2D(OUTER_TRI[side.i0], OUTER_TRI[side.i1], t1);

    const id = side.start + i;
    const gateCenter = lerp2D(iA, iB, 0.5);
    const edgeDx = iB.x - iA.x;
    const edgeDz = iB.z - iA.z;
    const edgeLen = Math.hypot(edgeDx, edgeDz) || 1;
    const tangent = { x: edgeDx / edgeLen, z: edgeDz / edgeLen };
    const normal = outwardNormal(iA, iB);

    // Porteira de 5.2 metros de largura no centro da frente do lote
    const gateHalf = 2.6;
    const gateLeft = {
      x: gateCenter.x - tangent.x * gateHalf,
      z: gateCenter.z - tangent.z * gateHalf,
    };
    const gateRight = {
      x: gateCenter.x + tangent.x * gateHalf,
      z: gateCenter.z + tangent.z * gateHalf,
    };

    // Casa da família dentro do lote cercado (a 26 m da porteira)
    const housePos = {
      x: gateCenter.x + normal.x * 26,
      z: gateCenter.z + normal.z * 26,
    };
    const doorPos = {
      x: gateCenter.x + normal.x * 20.5,
      z: gateCenter.z + normal.z * 20.5,
    };
    // Lavoura logo atrás da casa (a 52 m da porteira)
    const cropPos = {
      x: gateCenter.x + normal.x * 52,
      z: gateCenter.z + normal.z * 52,
    };
    // Posição inicial da barraca desta família na borda da Área Comum limpa
    const campPos = {
      x: gateCenter.x - normal.x * 16.5,
      z: gateCenter.z - normal.z * 16.5,
    };

    const yaw = Math.atan2(normal.x, normal.z);
    const quad = [iA, iB, oB, oA];
    const area = polygonArea(quad);

    LOTS.push({
      id,
      code: String(id).padStart(2, '0'),
      sector: side.name,
      area,
      iA,
      iB,
      oA,
      oB,
      quad,
      gateCenter,
      gateLeft,
      gateRight,
      tangent,
      normal,
      yaw,
      housePos,
      doorPos,
      cropPos,
      campPos,
      // Caixa delimitadora rápida para aceleração espacial
      minX: Math.min(iA.x, iB.x, oA.x, oB.x),
      maxX: Math.max(iA.x, iB.x, oA.x, oB.x),
      minZ: Math.min(iA.z, iB.z, oA.z, oB.z),
      maxZ: Math.max(iA.z, iB.z, oA.z, oB.z),
    });
  }
}

export function getLotById(id) {
  return LOTS[id - 1] || null;
}

export function findLotAt(x, z) {
  if (pointInTriangle(x, z, INNER_TRI)) return null;
  if (!pointInTriangle(x, z, OUTER_TRI)) return null;
  for (let i = 0; i < LOTS.length; i++) {
    const l = LOTS[i];
    if (x < l.minX || x > l.maxX || z < l.minZ || z > l.maxZ) continue;
    if (pointInConvexQuad(x, z, l.quad)) return l;
  }
  return null;
}

export function isInsideCommonArea(x, z) {
  return pointInTriangle(x, z, INNER_TRI);
}

export function isInsideSettlement(x, z) {
  return pointInTriangle(x, z, OUTER_TRI);
}

// Pontos aleatórios dentro de um lote (com margem das cercas)
export function samplePointInLot(lot, rnd, minDepth = 0.04, maxDepth = 0.94) {
  // Amostragem uniforme em trapézio usando raiz quadrada para compensar alargamento radial
  const u = minDepth + rnd() * (maxDepth - minDepth);
  const v = 0.06 + rnd() * 0.88;
  const pA = lerp2D(lot.iA, lot.oA, u);
  const pB = lerp2D(lot.iB, lot.oB, u);
  return lerp2D(pA, pB, v);
}

export function formatNumberBR(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
