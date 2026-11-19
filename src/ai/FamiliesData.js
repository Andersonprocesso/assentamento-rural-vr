import { LOTS, mulberry32 } from '../world/SettlementMath.js';

const SURNAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira',
  'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima',
  'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins',
  'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes',
  'Barros', 'Freitas', 'Barbosa', 'Pinto', 'Moura',
  'Cavalcanti', 'Dias', 'Castro', 'Campos', 'Cardoso',
];

const MALE_NAMES = [
  'João', 'José', 'Antônio', 'Francisco', 'Carlos', 'Paulo', 'Pedro',
  'Lucas', 'Luiz', 'Marcos', 'Gabriel', 'Rafael', 'Daniel', 'Bruno',
  'Tiago', 'Mateus', 'Diego', 'Henrique', 'Sérgio', 'Sebastião',
  'Manoel', 'Raimundo', 'Geraldo', 'Valdir', 'Cláudio', 'Edson',
];

const FEMALE_NAMES = [
  'Maria', 'Ana', 'Francisca', 'Antônia', 'Adriana', 'Juliana', 'Márcia',
  'Fernanda', 'Patrícia', 'Aline', 'Sandra', 'Camila', 'Amanda', 'Bruna',
  'Jéssica', 'Letícia', 'Beatriz', 'Larissa', 'Sônia', 'Tereza',
  'Luzia', 'Rosa', 'Helena', 'Regina', 'Eliane', 'Cláudia',
];

const SHIRT_COLORS = [
  0x2e6b4f, 0x9c4a35, 0x3b5c85, 0xb88635, 0x6b4b7a,
  0x4f783a, 0xa85d3b, 0x346f78, 0x8c3b3b, 0x5d6e42,
  0xc4954b, 0x425b6e,
];

const PANTS_COLORS = [0x2a394a, 0x3d352e, 0x26332c, 0x453b2e, 0x2c3645];
const SKIN_TONES = [0xd6a77c, 0xc28e63, 0xa6724c, 0xe0b992, 0x8a5b3b];

// Distribuição: 22 famílias com 5 pessoas, 4 com 4 pessoas, 4 com 6 pessoas = 150 pessoas!
const FAMILY_SIZES = [
  5, 5, 5, 4, 5, 5, 6, 5, 5, 5,
  5, 4, 5, 5, 5, 6, 5, 5, 5, 4,
  5, 5, 6, 5, 5, 5, 5, 4, 6, 5,
];

export function generateFamilies() {
  const rnd = mulberry32(30052026);
  const families = [];
  const villagers = [];

  for (let i = 0; i < 30; i++) {
    const lot = LOTS[i];
    const surname = SURNAMES[i];
    const size = FAMILY_SIZES[i];
    const familyId = i + 1;
    const members = [];

    for (let m = 0; m < size; m++) {
      const isMale = m === 0 ? true : m === 1 ? false : rnd() > 0.48;
      let firstName;
      if (familyId === 1 && m === 0) {
        firstName = 'João'; // Homenagem ao João do assentamento original!
      } else if (familyId === 1 && m === 1) {
        firstName = 'Maria';
      } else {
        const pool = isMale ? MALE_NAMES : FEMALE_NAMES;
        firstName = pool[Math.floor(rnd() * pool.length)];
      }

      // Papéis dentro da família:
      // m=0 (pai/chefe): lenhador/construtor
      // m=1 (mãe/chefe): construtora/coletora
      // m=2 (jovem adulto): lenhador/agricultor
      // m=3 (jovem/avô): coletor/agricultor
      // m>=4: criança/estudante
      let role = 'construtor';
      let heightScale = 1.0;
      let isWorker = true;
      if (m === 0) {
        role = 'lenhador';
        heightScale = 1.02;
      } else if (m === 1) {
        role = 'construtor';
        heightScale = 0.94;
      } else if (m === 2) {
        role = i % 2 === 0 ? 'lenhador' : 'coletor';
        heightScale = 0.88;
      } else if (m === 3) {
        role = 'agricultor';
        heightScale = 0.82;
      } else {
        role = 'crianca';
        heightScale = 0.64;
        isWorker = false;
      }

      const angleOffset = (m / size) * Math.PI * 2;
      const startX = lot.campPos.x + Math.cos(angleOffset) * 3.2;
      const startZ = lot.campPos.z + Math.sin(angleOffset) * 3.2;

      const villager = {
        id: villagers.length,
        name: `${firstName} ${surname}`,
        firstName,
        familyId,
        lotId: lot.id,
        role,
        isWorker,
        heightScale,
        shirtColor: SHIRT_COLORS[(familyId * 3 + m) % SHIRT_COLORS.length],
        pantsColor: PANTS_COLORS[(familyId + m) % PANTS_COLORS.length],
        skinColor: SKIN_TONES[(familyId + (m % 2)) % SKIN_TONES.length],
        hasHat: isWorker && (m === 0 || rnd() > 0.4),

        // Estado espacial e IA
        x: startX,
        z: startZ,
        yaw: lot.yaw,
        speed: isWorker ? 3.4 + rnd() * 0.85 : 2.3 + rnd() * 0.6,
        state: isWorker ? 'DECIDE' : 'PLAY',
        timer: rnd() * 2.5,
        walkPhase: rnd() * Math.PI * 2,
        targetX: startX,
        targetZ: startZ,
        targetTreeId: -1,
        targetSiteId: null,
        carryingWood: false,
        carryAmount: 0,
        statusLabel: 'No acampamento',
      };

      members.push(villager);
      villagers.push(villager);
    }

    families.push({
      id: familyId,
      lotId: lot.id,
      code: lot.code,
      surname,
      name: `Família ${surname}`,
      size,
      members,
      treesCut: 0,
      status: 'Acampada na área comum',
    });
  }

  return { families, villagers };
}
