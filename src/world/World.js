import * as THREE from 'three';
import {
  OUTER_TRI,
  INNER_TRI,
  LOTS,
  RIVER_A,
  RIVER_B,
  RIVER_NORMAL,
  lerp2D,
} from './SettlementMath.js';
import { createWoodSign } from './Constructions.js';

function createFlatPolygonMesh(pts, y, material) {
  const vertices = [];
  const uvs = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[0];
    const b = pts[i];
    const c = pts[i + 1];
    vertices.push(a.x, y, a.z, b.x, y, b.z, c.x, y, c.z);
    uvs.push(a.x * 0.02, a.z * 0.02, b.x * 0.02, b.z * 0.02, c.x * 0.02, c.z * 0.02);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, material);
  mesh.receiveShadow = true;
  return mesh;
}

function createBandMesh(a, b, width, outwardNormal, y, material) {
  const n = outwardNormal;
  const pts = [
    a,
    b,
    { x: b.x + n.x * width, z: b.z + n.z * width },
    { x: a.x + n.x * width, z: a.z + n.z * width },
  ];
  return createFlatPolygonMesh(pts, y, material);
}

export class World {
  constructor(scene, textures, bus) {
    this.scene = scene;
    this.textures = textures;
    this.bus = bus;

    this.tents = new Map(); // lotId -> THREE.Group (desmontada quando a casa fica pronta)
    this.campfires = []; // { x, z, light, flameMesh, phase }

    this._buildTerrain();
    this._buildRiver();
    this._buildFences();
    this._buildBoundaryMarkers();
    this._buildCamp();
  }

  _buildTerrain() {
    // 1. Solo imenso de Mata Atlântica (toda a área de 1.525.000 m² + entorno florestal)
    const groundGeo = new THREE.PlaneGeometry(5400, 5400);
    const ground = new THREE.Mesh(groundGeo, this.textures.get('forestFloor'));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. APENAS a Área Comum central (25.000 m²) está limpa!
    const commonMesh = createFlatPolygonMesh(INNER_TRI, 0.03, this.textures.get('commonGround'));
    this.scene.add(commonMesh);

    // 3. Terreiro central do acampamento (terra batida ao redor da fogueira principal)
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(18, 28), this.textures.get('dirt'));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.045;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // 4. Anel de terra batida na borda interna da área comum (estrada de acesso às 30 porteiras)
    for (let e = 0; e < 3; e++) {
      const a = INNER_TRI[e];
      const b = INNER_TRI[(e + 1) % 3];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      let nx = -dz / len;
      let nz = dx / len;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      if (nx * mx + nz * mz > 0) {
        nx = -nx;
        nz = -nz;
      }
      const road = createBandMesh(a, b, 6.2, { x: nx, z: nz }, 0.04, this.textures.get('dirt'));
      this.scene.add(road);
    }
  }

  _buildRiver() {
    // Margem de areia/cascalho + rio correndo na lateral oeste
    const sandBank = createBandMesh(RIVER_A, RIVER_B, 86, RIVER_NORMAL, 0.025, this.textures.get('sand'));
    this.scene.add(sandBank);

    const waterMat = this.textures.get('riverWater');
    this.riverMat = waterMat;
    const waterMesh = createBandMesh(
      { x: RIVER_A.x + RIVER_NORMAL.x * 10, z: RIVER_A.z + RIVER_NORMAL.z * 10 },
      { x: RIVER_B.x + RIVER_NORMAL.x * 10, z: RIVER_B.z + RIVER_NORMAL.z * 10 },
      62,
      RIVER_NORMAL,
      0.06,
      waterMat
    );
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);
  }

  // TODAS AS CERCAS DOS 30 LOTES (já cercados desde o início do jogo!)
  _buildFences() {
    const postPositions = [];
    const wireVertices = [];

    const addFenceSegment = (a, b, spacing = 12) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) return;
      const steps = Math.max(1, Math.round(len / spacing));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        postPositions.push({
          x: a.x + dx * t,
          z: a.z + dz * t,
          tall: false,
        });
      }
      // 3 fios/travessas horizontais em alturas 0.45m, 0.90m, 1.35m
      for (const h of [0.45, 0.9, 1.35]) {
        wireVertices.push(a.x, h, a.z, b.x, h, b.z);
      }
    };

    // 1. Cercas frontais de cada um dos 30 lotes (deixando porteira aberta no meio!)
    for (const lot of LOTS) {
      addFenceSegment(lot.iA, lot.gateLeft, 6.5);
      addFenceSegment(lot.gateRight, lot.iB, 6.5);

      // Dois mourões grossos da porteira
      postPositions.push({ x: lot.gateLeft.x, z: lot.gateLeft.z, tall: true });
      postPositions.push({ x: lot.gateRight.x, z: lot.gateRight.z, tall: true });

      // Placa rústica de madeira ao lado da porteira identificando o Lote cercado
      const sign = createWoodSign(`SÍTIO ${lot.code}`, '50.000 m² · 5 ha', 2.4, 0.78);
      sign.position.set(
        lot.gateRight.x - lot.normal.x * 0.8 + lot.tangent.x * 1.4,
        0,
        lot.gateRight.z - lot.normal.z * 0.8 + lot.tangent.z * 1.4
      );
      sign.rotation.y = lot.yaw + Math.PI;
      this.scene.add(sign);
    }

    // 2. Divisas radiais entre os 30 lotes (30 linhas radiais do triângulo interno ao externo)
    for (const lot of LOTS) {
      addFenceSegment(lot.iA, lot.oA, 22);
    }

    // 3. Perímetro externo do triângulo completo de 1.525.000 m²
    for (let e = 0; e < 3; e++) {
      addFenceSegment(OUTER_TRI[e], OUTER_TRI[(e + 1) % 3], 24);
    }

    // Renderiza todos os mourões em UM ÚNICO InstancedMesh!
    const postGeo = new THREE.CylinderGeometry(0.11, 0.14, 1.55, 6);
    postGeo.translate(0, 0.775, 0);
    const postMesh = new THREE.InstancedMesh(postGeo, this.textures.get('woodDark'), postPositions.length);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < postPositions.length; i++) {
      const p = postPositions[i];
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, (i * 1.7) % Math.PI, 0);
      if (p.tall) {
        dummy.scale.set(1.65, 1.45, 1.65);
      } else {
        dummy.scale.set(1, 1, 1);
      }
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
    }
    postMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(postMesh);

    // Linhas de arame/madeira da cerca (LineSegments + travessas visíveis de longe)
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wireVertices, 3));
    const wireMat = new THREE.LineBasicMaterial({ color: 0xb59b79, transparent: true, opacity: 0.85 });
    const wireLines = new THREE.LineSegments(wireGeo, wireMat);
    this.scene.add(wireLines);

    // Travessa superior de madeira visível na frente dos 30 lotes (área comum)
    const railMat = this.textures.get('wood');
    const railGroup = new THREE.Group();
    for (const lot of LOTS) {
      for (const [pA, pB] of [[lot.iA, lot.gateLeft], [lot.gateRight, lot.iB]]) {
        const dx = pB.x - pA.x;
        const dz = pB.z - pA.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.4) continue;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, len), railMat);
        rail.position.set((pA.x + pB.x) / 2, 1.25, (pA.z + pB.z) / 2);
        rail.rotation.y = Math.atan2(dx, dz);
        rail.castShadow = true;
        railGroup.add(rail);
      }
    }
    this.scene.add(railGroup);
  }

  _buildBoundaryMarkers() {
    const labels = ['MARCO NORTE', 'MARCO SUDESTE', 'MARCO SUDOESTE'];
    const poleMat = this.textures.get('woodDark');
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xc9382b, roughness: 0.7, side: THREE.DoubleSide });

    OUTER_TRI.forEach((p, idx) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 16, 8), poleMat);
      pole.position.set(p.x, 8, p.z);
      this.scene.add(pole);

      const flag = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.12), flagMat);
      flag.position.set(p.x + 1.8, 14.8, p.z);
      this.scene.add(flag);

      const sign = createWoodSign(labels[idx], '1.525.000 m²', 5.4, 1.4);
      sign.position.set(p.x, 0, p.z);
      this.scene.add(sign);
    });
  }

  // ACAMPAMENTO INICIAL DAS 30 FAMÍLIAS NA ÁREA COMUM LIMPA
  _buildCamp() {
    // Placa central do assentamento
    const mainSign = createWoodSign('AGRO VILA · 30 FAMÍLIAS', '1.525.000 m² · ÁREA COMUM LIMPA', 6.4, 1.8);
    mainSign.position.set(0, 0, 12);
    this.scene.add(mainSign);

    const tentCanvas = this.textures.get('tentCanvas');
    const woodDark = this.textures.get('woodDark');
    const tentColors = [0xd6c8a8, 0xc9b48d, 0x8ea378, 0xc2936b, 0x7c98a3, 0xb8a378];

    // Uma barraca por família acampada, próxima à entrada do seu lote cercado!
    for (const lot of LOTS) {
      const tentGroup = new THREE.Group();
      tentGroup.position.set(lot.campPos.x, 0, lot.campPos.z);
      tentGroup.rotation.y = lot.yaw + Math.PI;

      const mat = tentCanvas.clone();
      mat.color = new THREE.Color(tentColors[lot.id % tentColors.length]);

      // Tenda em formato A-frame / prisma triangular grande (abriga família de ~5 pessoas)
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 2.55, 4.4, 3), mat);
      prism.rotation.x = Math.PI / 2;
      prism.rotation.z = Math.PI / 2;
      prism.scale.set(1.0, 1.0, 1.12);
      prism.position.y = 1.25;
      prism.castShadow = true;
      prism.receiveShadow = true;
      tentGroup.add(prism);

      // Lona frontal aberta + estacas
      const poleF = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 5), woodDark);
      poleF.position.set(0, 1.2, 2.25);
      const poleB = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 5), woodDark);
      poleB.position.set(0, 1.2, -2.25);
      tentGroup.add(poleF, poleB);

      // Caixote de suprimentos ao lado da barraca
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.7), this.textures.get('wood'));
      crate.position.set(2.4, 0.33, 1.1);
      crate.castShadow = true;
      tentGroup.add(crate);

      this.scene.add(tentGroup);
      this.tents.set(lot.id, tentGroup);
    }

    // 4 Fogueiras comunitárias no acampamento (centro + 3 setores)
    const fireSpots = [
      { x: 0, z: 0 },
      { x: 0, z: 24 },
      { x: 20, z: -14 },
      { x: -20, z: -14 },
    ];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x575753, roughness: 0.95 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a24 });

    fireSpots.forEach((fp, idx) => {
      const g = new THREE.Group();
      g.position.set(fp.x, 0, fp.z);

      // Pedras em círculo
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), rockMat);
        r.position.set(Math.cos(a) * 0.95, 0.14, Math.sin(a) * 0.95);
        g.add(r);
      }
      // Lenha cruzada
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.4, 6), woodDark);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 3) * Math.PI;
        log.position.y = 0.18;
        g.add(log);
      }
      // Chama estilizada
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.15, 6), flameMat);
      flame.position.y = 0.62;
      g.add(flame);

      // Bancos de tora ao redor da fogueira principal
      if (idx === 0) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 2.6, 7), this.textures.get('wood'));
          seat.rotation.z = Math.PI / 2;
          seat.rotation.y = a + Math.PI / 2;
          seat.position.set(Math.cos(a) * 3.4, 0.25, Math.sin(a) * 3.4);
          seat.castShadow = true;
          g.add(seat);
        }
      }

      // Luz quente da fogueira (apenas na central e secundárias para performance ótima)
      const light = new THREE.PointLight(0xff7d29, idx === 0 ? 12 : 7, 26, 1.7);
      light.position.set(0, 1.4, 0);
      g.add(light);

      this.scene.add(g);
      this.campfires.push({ x: fp.x, z: fp.z, light, flame, baseIntensity: idx === 0 ? 12 : 7, phase: idx * 2.1 });
    });

    // Quando a casa de uma família é concluída, desmonta a barraca provisória no acampamento!
    this.bus.on('site:completed', ({ site }) => {
      if (site.kind === 'lot') {
        const tent = this.tents.get(site.lotId);
        if (tent) tent.visible = false;
      }
    });
  }

  update(dt, elapsed, isNight) {
    // Anima a correnteza do rio
    if (this.riverMat && this.riverMat.map) {
      this.riverMat.map.offset.y -= dt * 0.22;
    }

    // Anima chamas e luz das fogueiras
    const nightBoost = isNight ? 1.85 : 0.9;
    for (let i = 0; i < this.campfires.length; i++) {
      const cf = this.campfires[i];
      const flicker = 0.85 + Math.sin(elapsed * 11.5 + cf.phase) * 0.14 + Math.sin(elapsed * 23 + cf.phase) * 0.08;
      cf.light.intensity = cf.baseIntensity * nightBoost * flicker;
      cf.flame.scale.set(0.9 + flicker * 0.14, 0.82 + flicker * 0.3, 0.9 + flicker * 0.14);
      cf.flame.rotation.y = elapsed * 2.2 + cf.phase;
    }
  }
}
