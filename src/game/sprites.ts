// ============ SPRITES v2 — PERSONAGENS MAIS DETALHADOS ============
// Aumento de resolução: pixels de 3→4unid, sprites de 22→26 unidades lógicas
// Novidades: rim-light 3D, motion blur por pose, detalhes de rosto ricos
import type { HeroDef } from './heroes';

const U = 4; // pixel lógico 4px — personagens 33% maiores, mais detalhe

export type Pose = 'idle' | 'walk' | 'attack' | 'cast';

function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w * U; c.height = h * U;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x * U), Math.round(y * U), Math.round(w * U), Math.round(h * U));
}
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// paleta cel-shaded MAIS DRAMÁTICA — contraste cartoon extremo (Awesomenauts)
function cel(hex: string): { l: string; b: string; d: string } {
  return { l: shade(hex, 72), b: hex, d: shade(hex, -72) };
}

// contorno GROSSO escuro (cartoon extremo — 2 pixels de espessura)
function applyOutline(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d')!;
  const w = c.width, h = c.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // checa pixels preenchidos a até 2 de distância (outline duplo)
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h ? d[(y * w + x) * 4 + 3] > 90 : false;
  const out = ctx.createImageData(w, h);
  const o = out.data;
  for (let i = 0; i < d.length; i++) o[i] = d[i];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    if (d[idx + 3] < 90) {
      // checa todos os vizinhos num raio de 2 pixels
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2 && !near; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= 2 && filled(x + dx, y + dy)) near = true;
        }
      }
      if (near) {
        o[idx] = 10; o[idx + 1] = 6; o[idx + 2] = 18; o[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

// rim-light: brilho sutil na borda oposta à luz (luz vem da esquerda-superior)
function rimLight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = shade(color, 70);
  ctx.globalAlpha = 0.3;
  ctx.fillRect((x + w - 0.5) * U, (y + 1) * U, 0.8 * U, (h - 2) * U); // borda direita
  ctx.fillRect((x + 1) * U, y * U, (w - 2) * U, 0.5 * U);              // topo
  ctx.globalAlpha = 1;
}

// =====================================================
//   HERÓI — sprite 30x28 lógicos (120x112 px)
//   PROPORÇÕES CARTOON 100% AWESOMENAUTS:
//   cabeça desproporcionalmente grande (~45% da altura),
//   corpo compacto e encorpado, pernas curtas e grossas,
//   olhos enormes e expressivos, contorno bem grosso.
// =====================================================
export function drawHeroSprite(
  look: HeroDef['look'], team: 0 | 1, frame: number, pose: Pose
): HTMLCanvasElement {
  const [c, ctx] = mkCanvas(30, 28);
  const teamCol = team === 0 ? '#3aa0ff' : '#ff4a4a';
  const ox = 10; // centro-X

  // --- animação 6 frames com overshoot (estilo cartoon) ---
  const f6 = frame % 6;
  const walkCycle = [0, 1.8, 1.2, 0, -1.8, -1.2][f6];
  let bob = 0, legL = 0, legR = 0, armSwing = 0, weaponRaise = 0;
  let castGlow = false, leanX = 0, squash = 0, headTilt = 0;

  if (pose === 'walk') {
    legL = walkCycle; legR = -walkCycle;
    bob = [0, -1.5, -2.8, 0, -1.5, -2.8][f6]; // bounce EXTREMO
    armSwing = walkCycle * 1.1;               // braços balançam mais
    squash = [1.2, 0, -1.2, 1.2, 0, -1.2][f6]; // squash enorme
    leanX = 1.2;                               // inclinação exagerada pra frente
    headTilt = [0, -1.2, 0, 0, 1.2, 0][f6];   // cabeça balança junto
  } else if (pose === 'idle') {
    bob = [0, -1, -2, -2, -1, 0][f6];
    squash = [0, -0.6, -1.2, -1.2, -0.6, 0][f6];
    headTilt = [0, 0.8, 0, 0, -0.8, 0][f6]; // olhando ao redor curioso
  } else if (pose === 'attack') {
    const seq = [-3, -5, 7, 6, 2.5, 0][f6]; // overshoot GIGANTE no golpe
    weaponRaise = seq;
    leanX = seq > 5 ? 4 : seq < -2 ? -2 : 0;
    bob = [0, 2, -3.5, -2, 0, 0][f6];
    squash = [-0.8, -1.5, 3, 2.5, 0.8, 0][f6]; // squash MAXIMO no impacto
    headTilt = seq > 5 ? 2 : 0;
  } else {
    castGlow = true;
    bob = [0, 1.5, -3.5, -6, -3.5, -2][f6];
    weaponRaise = [-1, -3.5, -7, -8, -7, -4.5][f6];
    squash = [1, 2, -1.5, -2.5, -1.5, -1][f6];
    headTilt = -1;
  }

  const bodyY = bob;
  const sq = squash;

  // ===== CORPO CARTOON (proporções Awesomenauts) =====
  // Pernas curtas e grossas na parte de baixo
  const legY = 20 + bodyY;
  const legC = cel(look.legs);
  // perna esquerda (mais grossa que antes)
  px(ctx, ox + 2 + leanX, legY, 3, 4.5 - Math.abs(legL), legC.b);
  px(ctx, ox + 2 + leanX, legY, 1.2, 4.5 - Math.abs(legL), legC.l);
  // perna direita
  px(ctx, ox + 8 + leanX, legY, 3, 4.5 - Math.abs(legR), legC.b);
  px(ctx, ox + 10 + leanX, legY, 1.2, 4.5 - Math.abs(legR), legC.d);
  // botas cartunescas (grandes)
  const bootDark = shade(look.legs, -50);
  const bootLight = shade(look.legs, 30);
  const blx = ox + 1.5 + leanX + (legL > 0 ? 1.5 : 0);
  const bly = legY + 4.5 - Math.abs(legL);
  px(ctx, blx, bly, 4, 2, bootDark);
  px(ctx, blx, bly - 0.5, 4, 0.6, shade(look.legs, -18));
  px(ctx, blx + 0.6, bly + 0.5, 3, 0.6, bootLight);
  px(ctx, blx + 2, bly, 0.6, 0.7, shade(look.trim, 40));
  const brx = ox + 7.5 + leanX + (legR > 0 ? 1.5 : 0);
  const bry = legY + 4.5 - Math.abs(legR);
  px(ctx, brx, bry, 4, 2, bootDark);
  px(ctx, brx, bry - 0.5, 4, 0.6, shade(look.legs, -18));
  px(ctx, brx + 0.6, bry + 0.5, 3, 0.6, bootLight);
  px(ctx, brx + 2, bry, 0.6, 0.7, shade(look.trim, 40));

  // torso compacto e encorpado (barrigudo, no estilo cartoon)
  const armC = cel(look.armor);
  const tw = 13 + sq;               // torso largo
  const th = 8 - sq * 0.5;          // torso achatado/alongado
  const tx0 = ox + leanX - sq / 2 + 0.5;
  const ty0 = 12 + bodyY + sq * 0.5;
  px(ctx, tx0, ty0, tw, th, armC.b);
  px(ctx, tx0, ty0, tw, 2.8, armC.l);
  px(ctx, tx0, ty0 + th - 2.8, tw, 2.8, armC.d);
  px(ctx, tx0, ty0, 1.2, th, armC.l);
  px(ctx, tx0 + tw - 1.2, ty0, 1.2, th, armC.d);
  // rebites
  const rivets = shade(look.trim, 65);
  px(ctx, tx0 + 1.2, ty0 + 0.5, 0.7, 0.7, rivets);
  px(ctx, tx0 + tw - 1.9, ty0 + 0.5, 0.7, 0.7, rivets);
  px(ctx, tx0 + 1.2, ty0 + th - 1.2, 0.7, 0.7, rivets);
  px(ctx, tx0 + tw - 1.9, ty0 + th - 1.2, 0.7, 0.7, rivets);
  // detalhe central + gema
  px(ctx, tx0 + tw / 2 - 1, ty0 + 1.8, 2, th - 3.6, look.trim);
  px(ctx, tx0 + tw / 2 - 1, ty0 + 1.8, 1, th - 3.6, shade(look.trim, 55));
  px(ctx, tx0 + tw / 2 - 0.9, ty0 + 2.2, 1.8, 1.8, shade(look.trim, 40));
  px(ctx, tx0 + tw / 2 - 0.6, ty0 + 2.4, 1.1, 1.1, shade(look.trim, 80));
  px(ctx, tx0 + tw / 2 - 0.4, ty0 + 2.5, 0.6, 0.6, '#ffffff');
  // cinto + fivela
  px(ctx, tx0 + 1, ty0 + 3, tw - 2, 1.8, shade(look.trim, 30));
  px(ctx, tx0 + 1, ty0 + 4.6, tw - 2, 0.7, shade(look.trim, -25));
  px(ctx, tx0 + tw / 2 - 1, ty0 + 3.1, 2, 1.5, shade(look.trim, 60));
  px(ctx, tx0 + tw / 2 - 0.5, ty0 + 3.5, 1, 0.5, shade(look.trim, 90));
  // ombreiras redondas (cartoon)
  const shoulderC = cel(look.armor);
  px(ctx, tx0 - 1.8, ty0 - 1.2, 5, 4.2, shoulderC.l);
  px(ctx, tx0 - 1, ty0 - 0.6, 4, 3, shoulderC.b);
  px(ctx, tx0 + tw - 3.2, ty0 - 1.2, 5, 4.2, shoulderC.l);
  px(ctx, tx0 + tw - 2.4, ty0 - 0.6, 4, 3, shoulderC.d);
  // rebites nas ombreiras
  px(ctx, tx0 - 0.8, ty0 - 0.3, 0.6, 0.6, rivets);
  px(ctx, tx0 + tw + 0.2, ty0 - 0.3, 0.6, 0.6, rivets);
  rimLight(ctx, tx0, ty0, tw, th, armC.b);

  // braços curtos proporcionalmente (cartoon)
  const skinC = cel(look.robot ? look.armor : look.skin);
  // manga (esquerda)
  px(ctx, ox - 2.5 + leanX - armSwing, 15.5 + bodyY, 3, 1.3, armC.d);
  // braço esquerdo curto
  px(ctx, ox - 2.5 + leanX - armSwing, 16 + bodyY, 3, 4.5, skinC.b);
  px(ctx, ox - 1.8 + leanX - armSwing, 16 + bodyY, 1.2, 4.5, skinC.l);
  // luva esquerda (dedos grossos)
  const gloveL = shade(look.trim, -15);
  px(ctx, ox - 3 + leanX - armSwing, 20.5 + bodyY, 4, 2.2, gloveL);
  px(ctx, ox - 2.6 + leanX - armSwing, 20.8 + bodyY, 0.8, 1.7, shade(gloveL, -30));
  px(ctx, ox - 1.4 + leanX - armSwing, 20.8 + bodyY, 0.8, 1.7, shade(gloveL, -30));
  px(ctx, ox - 0.2 + leanX - armSwing, 20.8 + bodyY, 0.8, 1.7, shade(gloveL, -30));
  // braço direito (arma) — mais curto
  const armY = pose === 'attack' ? 11 + bodyY - Math.max(0, weaponRaise) : pose === 'cast' ? 10 + bodyY : 16 + bodyY + armSwing;
  px(ctx, ox + 9.5 + leanX, armY - 0.6, 3, 1.3, armC.d);
  px(ctx, ox + 9.5 + leanX, armY, 3, 4.5, skinC.b);
  px(ctx, ox + 12 + leanX, armY, 1.2, 4.5, skinC.d);
  px(ctx, ox + 9 + leanX, armY + 4.5, 4, 2.2, gloveL);
  px(ctx, ox + 9.4 + leanX, armY + 4.8, 0.8, 1.7, shade(gloveL, -30));
  px(ctx, ox + 10.6 + leanX, armY + 4.8, 0.8, 1.7, shade(gloveL, -30));
  px(ctx, ox + 11.8 + leanX, armY + 4.8, 0.8, 1.7, shade(gloveL, -30));

  // ===== CABEÇA GIGANTE (50%+ da altura — cartoon extremo Awesomenauts) =====
  const headY = 2 + bodyY + sq * 0.7;
  const hx = ox + leanX + headTilt - 2;  // centralizada na nova largura
  const sk = cel(look.skin);
  const HW = 16;   // cabeça GIGANTE
  const HH = 13;   // muito alta
  // crânio GIGANTE com cel-shading extremo
  px(ctx, hx, headY, HW, HH, sk.b);
  px(ctx, hx, headY, HW, 4.5, sk.l);
  px(ctx, hx + HW - 5, headY + 3.5, 5, HH - 3.5, sk.d);
  px(ctx, hx + 1, headY + 2, HW - 2, 1.5, sk.l);
  // bochechas cartoon (sombra rosada no canto)
  px(ctx, hx + 2.5, headY + 8.5, 2, 1, shade(look.skin, -15));
  px(ctx, hx + 11.5, headY + 8.5, 2, 1, shade(look.skin, -15));
  // orelhas maiores (cartoon)
  px(ctx, hx - 1, headY + 5.5, 1.2, 3.5, sk.d);
  px(ctx, hx + HW - 0.2, headY + 5.5, 1.2, 3.5, sk.d);

  if (look.robot) {
    const armCol = cel(look.armor);
    px(ctx, hx, headY, HW, HH, armCol.b);
    px(ctx, hx, headY, HW, 4.5, armCol.l);
    px(ctx, hx + HW - 5, headY + 3.5, 5, HH - 3.5, armCol.d);
    const eyeCol = castGlow ? '#ffffa0' : '#ffe060';
    // olhos LED GIGANTESCOS
    px(ctx, hx + 3, headY + 5, 4, 3.5, eyeCol);
    px(ctx, hx + 10, headY + 5, 4, 3.5, eyeCol);
    px(ctx, hx + 3.8, headY + 5.3, 2.5, 1.8, '#ffffff');
    px(ctx, hx + 10.8, headY + 5.3, 2.5, 1.8, '#ffffff');
    // grade frontal
    px(ctx, hx + 1, headY - 0.5, HW - 2, 2.5, shade(look.armor, -30));
    // parafusos laterais
    px(ctx, hx + 0.5, headY + 2, 1, 1, shade(look.armor, -40));
    px(ctx, hx + HW - 1.5, headY + 2, 1, 1, shade(look.armor, -40));
  } else {
    // OLHOS ENORMES (estilo Awesomenauts) — o diferencial
    const blink = pose === 'idle' && f6 === 3;
    const eyeCol = castGlow ? '#80c0ff' : '#2a2a4a';
    // brancos GIGANTESCOS
    px(ctx, hx + 2.5, headY + 4.5, 5, 5, '#ffffff');
    px(ctx, hx + 9.5, headY + 4.5, 5, 5, '#ffffff');
    if (!blink) {
      // íris grandes
      px(ctx, hx + 3.3, headY + 5.3, 4, 3.5, eyeCol);
      px(ctx, hx + 10.3, headY + 5.3, 4, 3.5, eyeCol);
      // pupilas grandes
      px(ctx, hx + 4.2, headY + 6, 2.2, 2.2, '#0a0a18');
      px(ctx, hx + 11.2, headY + 6, 2.2, 2.2, '#0a0a18');
      // brilho duplo nos olhos
      px(ctx, hx + 3.8, headY + 5, 1.8, 1.8, '#ffffff');
      px(ctx, hx + 10.8, headY + 5, 1.8, 1.8, '#ffffff');
      px(ctx, hx + 5.2, headY + 6.8, 0.8, 0.8, '#ffffff');
      px(ctx, hx + 12.2, headY + 6.8, 0.8, 0.8, '#ffffff');
      // sobrancelhas GROSSEiras e expressivas
      if (pose === 'attack') {
        px(ctx, hx + 2, headY + 3.2, 5.5, 1, shade(look.hair, 20));
        px(ctx, hx + 9.5, headY + 3.2, 5.5, 1, shade(look.hair, 20));
      } else if (pose === 'cast') {
        px(ctx, hx + 2, headY + 3.5, 5.5, 0.8, shade(look.hair, 20));
        px(ctx, hx + 9.5, headY + 3.5, 5.5, 0.8, shade(look.hair, 20));
      } else {
        px(ctx, hx + 2.5, headY + 3.8, 5, 0.7, shade(look.hair, 10));
        px(ctx, hx + 10, headY + 3.8, 5, 0.7, shade(look.hair, 10));
      }
    } else {
      // piscando: linhas curvas
      px(ctx, hx + 3, headY + 6.5, 4, 1, '#2a2a4a');
      px(ctx, hx + 10, headY + 6.5, 4, 1, '#2a2a4a');
    }
    // nariz cartoon (pequena bolinha)
    px(ctx, hx + 7.5, headY + 8, 1.5, 1.5, shade(look.skin, -25));
    px(ctx, hx + 7.8, headY + 8.2, 0.6, 0.6, shade(look.skin, 20));
    // boca EXPRESSIVA e grande
    if (pose === 'attack') {
      // boca aberta gritando (D grande)
      px(ctx, hx + 5.5, headY + 10, 5, 2.5, '#2a1418');
      px(ctx, hx + 6.5, headY + 10.5, 3, 1.5, '#4a2020');
      // língua
      px(ctx, hx + 7, headY + 11.2, 2, 0.8, '#c04060');
    } else if (pose === 'cast') {
      px(ctx, hx + 5.5, headY + 10.2, 5, 1.2, shade(look.skin, -55));
    } else if (pose === 'walk') {
      // sorrisão cartoon
      px(ctx, hx + 5.5, headY + 10.2, 5, 0.8, shade(look.skin, -35));
      px(ctx, hx + 6.5, headY + 10.5, 3, 0.5, '#ffffff'); // dentes
    } else {
      // sorriso leve
      px(ctx, hx + 6, headY + 10.2, 4, 0.6, shade(look.skin, -30));
    }
    // cabelo (recalibrado para cabeça HW=16)
    const hs = look.hairStyle;
    if (hs === 'short') { px(ctx, hx, headY - 2, HW, 3.5, look.hair); px(ctx, hx - 0.5, headY, 2, 5, look.hair); px(ctx, hx + 14.5, headY, 2, 5, shade(look.hair, -20)); }
    if (hs === 'long') { px(ctx, hx, headY - 2, HW, 3.5, look.hair); px(ctx, hx - 1.5, headY, 2.5, 14, look.hair); px(ctx, hx + 15, headY, 2.5, 14, shade(look.hair, -25)); }
    if (hs === 'spike') { px(ctx, hx + 1, headY - 4, 3.5, 4, look.hair); px(ctx, hx + 7, headY - 6, 3.5, 6, look.hair); px(ctx, hx + 12, headY - 4, 2.5, 4, look.hair); px(ctx, hx, headY - 2, HW, 2, look.hair); }
    if (hs === 'twin') { px(ctx, hx, headY - 2, HW, 3.5, look.hair); px(ctx, hx - 2.5, headY, 3.5, 10, look.hair); px(ctx, hx + 15, headY, 3.5, 10, look.hair); }
    if (look.helmet) { px(ctx, hx - 0.5, headY - 3, HW + 1, 4.5, look.armor); px(ctx, hx - 1, headY, 2, 6, look.armor); px(ctx, hx + 15, headY, 2, 6, look.armor); px(ctx, hx, headY - 3, HW, 1, look.trim); }
    if (look.hood) { px(ctx, hx - 1, headY - 3, HW + 2, 5, look.cape ?? look.armor); px(ctx, hx - 1, headY, 2, 7, look.cape ?? look.armor); px(ctx, hx + 15, headY, 2, 7, look.cape ?? look.armor); }
    if (look.furry) { px(ctx, hx - 1.5, headY - 2, 3.5, 5, look.hair); px(ctx, hx + 14, headY - 2, 3.5, 5, look.hair); }
    rimLight(ctx, hx, headY, HW, HH, sk.b);
  }

  // Após a cabeça, o restante (arma) usa wx recalibrado
  if (false) {
    // boca — muda com a pose
    if (pose === 'attack') {
      // boca aberta em grito de ataque
      px(ctx, hx + 3.5, headY + 5.8, 3, 1, '#2a1418');
      px(ctx, hx + 4, headY + 6, 2, 0.6, '#4a2020');
    } else if (pose === 'cast') {
      // boca aberta canalizando
      px(ctx, hx + 3.5, headY + 5.9, 3, 0.8, shade(look.skin, -50));
    } else {
      // boca fechada — linha sutil
      px(ctx, hx + 4, headY + 5.9, 2, 0.4, shade(look.skin, -25));
    }
    // cabelo
    const hs = look.hairStyle;
    if (hs === 'short') { px(ctx, hx, headY - 1.5, 10, 2.5, look.hair); px(ctx, hx - 0.5, headY, 1.5, 3, look.hair); px(ctx, hx + 9, headY, 1.5, 3, shade(look.hair, -20)); }
    if (hs === 'long') { px(ctx, hx, headY - 1.5, 10, 2.5, look.hair); px(ctx, hx - 1.5, headY, 2, 10, look.hair); px(ctx, hx + 9.5, headY, 2, 10, shade(look.hair, -25)); }
    if (hs === 'spike') { px(ctx, hx + 1, headY - 3, 2.5, 3, look.hair); px(ctx, hx + 5, headY - 4, 2.5, 4, look.hair); px(ctx, hx + 7.5, headY - 2.5, 1.5, 3, look.hair); px(ctx, hx, headY - 1.5, 10, 1.5, look.hair); }
    if (hs === 'twin') { px(ctx, hx, headY - 1.5, 10, 2.5, look.hair); px(ctx, hx - 2, headY, 2.5, 7, look.hair); px(ctx, hx + 9.5, headY, 2.5, 7, look.hair); }
    if (look.helmet) { px(ctx, hx - 0.5, headY - 3, 11, 3.5, look.armor); px(ctx, hx - 1, headY, 1.5, 4, look.armor); px(ctx, hx + 9.5, headY, 1.5, 4, look.armor); px(ctx, hx, headY - 3, 10, 1, look.trim); }
    if (look.hood) { px(ctx, hx - 1, headY - 3, 12, 4, look.cape ?? look.armor); px(ctx, hx - 1, headY, 1.5, 5, look.cape ?? look.armor); px(ctx, hx + 9.5, headY, 1.5, 5, look.cape ?? look.armor); }
    if (look.furry) { px(ctx, hx - 1.5, headY - 1.5, 2.5, 3.5, look.hair); px(ctx, hx + 9, headY - 1.5, 2.5, 3.5, look.hair); }
    // rim-light na cabeça
    rimLight(ctx, hx, headY, 10, 7, sk.b);
  }

  // ===== ARMA (desenhada para o corpo cartoon) =====
  const wc = look.weaponColor, wx = ox + 8 + leanX;
  const wr = weaponRaise;
  const glow = castGlow ? '#fff0a0' : null;
  // base de ancoragem da arma (alinhada à mão direita em y ~16-21)
  const ayy = bodyY - wr;
  switch (look.weapon) {
    case 'greatsword':
      px(ctx, wx, 6 + ayy, 2.5, 15, wc);
      px(ctx, wx, 6 + ayy, 1.2, 15, shade(wc, 40));
      px(ctx, wx - 1.5, 17 + ayy, 5, 1.5, '#8a6a30');
      px(ctx, wx + 0.2, 18.5 + ayy, 1.5, 3, '#8a6a30');
      px(ctx, wx + 0.5, 2 + ayy, 1.2, 2, shade(wc, 60)); // ponta afiada
      if (glow) px(ctx, wx + 0.5, 6 + ayy, 1.5, 4, glow);
      break;
    case 'sword':
      px(ctx, wx, 8 + ayy, 2, 10, wc);
      px(ctx, wx, 8 + ayy, 0.8, 10, shade(wc, 45));
      px(ctx, wx - 1.2, 15.5 + ayy, 4.5, 1.5, '#8a6a30');
      px(ctx, wx + 0.6, 4 + ayy, 0.6, 2, shade(wc, 60)); // ponta
      if (glow) px(ctx, wx, 8 + ayy, 2, 2.5, glow);
      break;
    case 'axe':
      px(ctx, wx + 0.6, 5 + ayy, 1.5, 13, '#7a5a3a');
      px(ctx, wx - 1.5, 5 + ayy, 5, 4, wc);
      px(ctx, wx - 2, 6 + ayy, 6, 2, shade(wc, -30));
      px(ctx, wx - 1.5, 5 + ayy, 5, 1, shade(wc, 40));
      break;
    case 'bow':
      px(ctx, wx, 6 + bodyY, 1.5, 12, wc);
      px(ctx, wx + 1.5, 6 + bodyY, 1.5, 1.5, wc);
      px(ctx, wx + 1.5, 17 + bodyY, 1.5, 1.5, wc);
      px(ctx, wx + 2, 7.5 + bodyY, 0.8, 10, pose === 'attack' ? '#fff0c0' : '#e8e8f0');
      if (pose === 'attack') px(ctx, wx + 3, 11 + bodyY, 5, 0.8, '#f0e0a0');
      break;
    case 'staff':
      px(ctx, wx + 0.6, 4 + ayy, 1.5, 14, wc);
      px(ctx, wx - 0.5, 2 + ayy, 3.5, 3.5, look.trim);
      px(ctx, wx + 0.3, 2.5 + ayy, 2, 2, castGlow ? '#ffffe0' : '#fff0a0');
      if (castGlow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#fff0a0';
        ctx.beginPath(); ctx.arc((wx + 1) * U, (3 + ayy) * U, 9, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      break;
    case 'daggers':
      px(ctx, wx, 12 + ayy, 1.5, 6, wc); px(ctx, ox - 3 + leanX, 12 + bodyY, 1.5, 6, wc);
      px(ctx, wx - 0.5, 17 + ayy, 2.5, 1.2, '#5a4a30'); px(ctx, ox - 3.5 + leanX, 17 + bodyY, 2.5, 1.2, '#5a4a30');
      px(ctx, wx, 12 + ayy, 0.6, 6, shade(wc, 50));
      break;
    case 'blowgun':
      px(ctx, wx, 10 + bodyY, 6, 1.8, wc);
      px(ctx, wx + 5, 9.5 + bodyY, 1.5, 2.8, shade(wc, -30));
      px(ctx, wx, 10 + bodyY, 6, 0.6, shade(wc, 40));
      break;
    case 'fists':
      px(ctx, wx - 0.5, (pose === 'attack' ? 10 : 17) + bodyY, 4, 4, wc);
      px(ctx, ox - 3.5 + leanX, 17 + bodyY, 4, 4, wc);
      px(ctx, wx - 0.5, (pose === 'attack' ? 10 : 17) + bodyY, 4, 1.5, glow ?? shade(wc, 40));
      break;
  }

  // aura de conjuração
  if (castGlow) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.width / 2, c.height * 0.55, 0, c.width / 2, c.height * 0.55, c.width * 0.75);
    g.addColorStop(0, 'rgba(255,240,160,0.55)');
    g.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  // motion blur: no ataque, transluzência da posição anterior
  if (pose === 'attack' && (f6 === 2 || f6 === 3)) {
    ctx.globalAlpha = 0.18;
    ctx.save(); ctx.translate(-3 * U, 0);
    ctx.drawImage(c, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // outline
  applyOutline(c);

  // indicador de time
  ctx.fillStyle = teamCol;
  ctx.fillRect((ox + 0.5) * U, 27 * U, 10 * U, 2.5 * U);
  ctx.fillStyle = shade(teamCol, 65);
  ctx.fillRect((ox + 0.5) * U, 27 * U, 10 * U, U);

  return c;
}

// =====================================================
//   MINION — sprite 14x15 lógicos
// =====================================================
export function drawMinionSprite(team: 0 | 1, caster: boolean, frame: number, superM = false): HTMLCanvasElement {
  const [c, ctx] = mkCanvas(14, 15);
  const body = superM ? (team === 0 ? '#2a6adf' : '#df3a3a') : team === 0 ? '#4a7ac8' : '#c85a4a';
  const C = cel(body);
  const f6 = frame % 6;
  const cyc = [0, 1.6, 1, 0, -1.6, -1][f6];
  const bob = [0, -0.6, -1.2, -1.2, -0.6, 0][f6];
  // pernas
  px(ctx, 3.5, 10 + bob, 2.5, 4 - Math.abs(cyc), C.d);
  px(ctx, 8, 10 + bob, 2.5, 3 + Math.abs(cyc), C.d);
  px(ctx, 3, 14 + bob - Math.abs(cyc), 3.5, 1, shade(body, -45));
  px(ctx, 7.5, 13 + bob + Math.abs(cyc), 3.5, 1, shade(body, -45));
  // corpo redondo
  px(ctx, 2, 3 + bob, 10, 7, C.b);
  px(ctx, 2, 3 + bob, 10, 2, C.l);
  px(ctx, 1, 4 + bob, 1, 5, C.l);
  px(ctx, 11, 4 + bob, 1, 5, C.d);
  // olhos maiores
  px(ctx, 4.5, 5.5 + bob, 2, 2, '#ffe860');
  px(ctx, 8, 5.5 + bob, 2, 2, '#ffe860');
  px(ctx, 5, 6 + bob, 1, 1, '#ffffff');
  px(ctx, 8.5, 6 + bob, 1, 1, '#ffffff');
  if (caster) { px(ctx, 3, 1 + bob, 8, 2.5, shade(body, -30)); px(ctx, 6, 0 + bob, 2.5, 1.5, shade(body, -30)); }
  if (superM) { px(ctx, 2.5, 1 + bob, 2.5, 2.5, '#ffd040'); px(ctx, 9, 1 + bob, 2.5, 2.5, '#ffd040'); }
  if (caster) px(ctx, 12, 2.5 + bob, 2, 7, '#8a6a40');
  else px(ctx, 12, 6 + bob, 2.5, 2.5, C.d);
  rimLight(ctx, 2, 3 + bob, 10, 7, body);
  applyOutline(c);
  return c;
}

// =====================================================
//   MONSTROS — sprite 26x22 lógicos
// =====================================================
export function drawMonsterSprite(type: string, frame: number): HTMLCanvasElement {
  const f6 = frame % 6;
  const s = [0, 1, 0, -1, 0, 0][f6];
  const flap = [0, 2.5, 0, -1, 0, 1][f6];
  if (type === 'wyvern') {
    // Wyvern das Cinzas — dragão menor, cinza/laranja
    const [c, ctx] = mkCanvas(22, 20);
    const body = '#7a6a5a'; const wing = '#c05030';
    const BC = cel(body);
    px(ctx, 1, 3 + flap, 8, 6, wing); px(ctx, 14, 3 + flap, 8, 6, wing);
    px(ctx, 2, 4 + flap, 6, 1.2, shade(wing, 40)); px(ctx, 15, 4 + flap, 6, 1.2, shade(wing, 40));
    px(ctx, 6, 5, 10, 9, BC.b); px(ctx, 6, 5, 10, 2.5, BC.l); px(ctx, 6, 12, 10, 2.5, BC.d);
    px(ctx, 8, 1, 6, 5, shade(body, 15)); px(ctx, 8, 1, 6, 2, shade(body, 35));
    px(ctx, 9, 3, 1.5, 1.5, '#ff7030'); px(ctx, 12, 3, 1.5, 1.5, '#ff7030');
    px(ctx, 7, 0, 2, 2.5, shade(body, -25)); px(ctx, 14, 0, 2, 2.5, shade(body, -25));
    px(ctx, 16, 10, 4, 2, body); px(ctx, 19, 9, 3, 2, shade(body, -20));
    rimLight(ctx, 6, 5, 10, 9, body); applyOutline(c); return c;
  }
  if (type === 'riftherald') {
    // Arauto da Fenda — grande ser cristalino roxo
    const [c, ctx] = mkCanvas(28, 22);
    const body = '#7a4ab0'; const crystal = '#c080ff';
    const BC = cel(body);
    // corpo cristalino angular
    px(ctx, 5, 5, 18, 12, BC.b); px(ctx, 5, 5, 18, 3, BC.l); px(ctx, 5, 14, 18, 3, BC.d);
    // cristais pontudos nas costas
    px(ctx, 7, 1, 2, 5, crystal); px(ctx, 11, 0, 2.5, 6, crystal); px(ctx, 16, 0, 2.5, 6, crystal); px(ctx, 20, 1, 2, 5, crystal);
    px(ctx, 7, 1, 1, 5, shade(crystal, 40)); px(ctx, 11, 0, 1, 6, shade(crystal, 40));
    // cabeça
    px(ctx, 9, 6, 8, 7, shade(body, 15)); px(ctx, 9, 6, 8, 2, shade(body, 35));
    px(ctx, 11, 8, 2, 2, '#ffe060'); px(ctx, 14, 8, 2, 2, '#ffe060');
    px(ctx, 11.3, 8.3, 1, 1, '#fff'); px(ctx, 14.3, 8.3, 1, 1, '#fff');
    // pernas
    px(ctx, 7, 17, 3, 3 - s, BC.d); px(ctx, 18, 17, 3, 2 + s, BC.d);
    // brilho mágico
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2 + Math.sin(frame * 0.5) * 0.1;
    ctx.fillStyle = crystal;
    ctx.beginPath(); ctx.arc(14 * U, 11 * U, 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    rimLight(ctx, 5, 5, 18, 12, body); applyOutline(c); return c;
  }
  if (type === 'crab') {
    // Caranguejo Escúter — pequeno, verde/azul
    const [c, ctx] = mkCanvas(14, 12);
    const body = '#4a8a8a';
    const BC = cel(body);
    px(ctx, 2, 4, 10, 5, BC.b); px(ctx, 2, 4, 10, 1.5, BC.l); px(ctx, 2, 8, 10, 1.5, BC.d);
    // olhos em hastes
    px(ctx, 4, 2, 0.6, 2, BC.d); px(ctx, 9.5, 2, 0.6, 2, BC.d);
    px(ctx, 3.5, 1, 1.5, 1.5, '#ffe060'); px(ctx, 9, 1, 1.5, 1.5, '#ffe060');
    px(ctx, 4, 1.3, 0.7, 0.7, '#fff'); px(ctx, 9.3, 1.3, 0.7, 0.7, '#fff');
    // garras
    px(ctx, 0, 5, 2.5, 2.5, BC.b); px(ctx, 11.5, 5, 2.5, 2.5, BC.d);
    // pernas
    px(ctx, 3, 9, 1.5, 2 - s, BC.d); px(ctx, 9.5, 9, 1.5, 1.5 + s, BC.d);
    rimLight(ctx, 2, 4, 10, 5, body); applyOutline(c); return c;
  }
  if (type === 'dragon' || type === 'baron') {
    const [c, ctx] = mkCanvas(28, 24);
    const body = type === 'dragon' ? '#b0502a' : '#7a4ab0';
    const wing = type === 'dragon' ? '#e07840' : '#a070e0';
    const BC = cel(body);
    // asas
    px(ctx, 1, 3 + flap, 10, 7, wing);
    px(ctx, 17, 3 + flap, 10, 7, wing);
    px(ctx, 2, 4 + flap, 8, 1.5, shade(wing, 45));
    px(ctx, 18, 4 + flap, 8, 1.5, shade(wing, 45));
    // corpo
    px(ctx, 8, 7, 12, 11, BC.b);
    px(ctx, 8, 7, 12, 3, BC.l);
    px(ctx, 8, 15, 12, 3, BC.d);
    // escamas/detalhes
    px(ctx, 9, 9, 10, 1, shade(body, 20));
    px(ctx, 9, 11, 10, 1, shade(body, -20));
    // cabeça
    px(ctx, 10, 1, 8, 7, shade(body, 15));
    px(ctx, 10, 1, 8, 2.5, shade(body, 40));
    px(ctx, 11.5, 3.5, 2, 2, '#ffe060');
    px(ctx, 14.5, 3.5, 2, 2, '#ffe060');
    px(ctx, 12, 4, 1, 1, '#ffffff');
    px(ctx, 15, 4, 1, 1, '#ffffff');
    // chifres
    px(ctx, 9.5, 0, 2.5, 3.5, shade(body, -30));
    px(ctx, 16, 0, 2.5, 3.5, shade(body, -30));
    // cauda
    px(ctx, 20, 13, 6, 2.5, body);
    px(ctx, 25, 11, 3, 2.5, shade(body, -25));
    rimLight(ctx, 8, 7, 12, 11, body);
    applyOutline(c);
    return c;
  }
  if (type === 'wolves') {
    const [c, ctx] = mkCanvas(16, 14);
    const f = '#6a7484';
    const FC = cel(f);
    px(ctx, 2, 5, 11, 6, FC.b); px(ctx, 2, 5, 11, 1.5, FC.l);
    px(ctx, 11, 1.5, 5, 5, shade(f, 12));
    px(ctx, 12.5, 3, 1.5, 1.5, '#ffd040'); px(ctx, 12.8, 3.3, 0.8, 0.8, '#ffffff');
    px(ctx, 11, 0, 1.8, 2, f); px(ctx, 13.8, 0, 1.8, 2, f);
    px(ctx, 3.5, 11, 2, 3.5 - s, FC.d); px(ctx, 9, 11, 2, 2.5 + s, FC.d);
    px(ctx, 0, 3.5, 3, 2, shade(f, -20));
    rimLight(ctx, 2, 5, 11, 6, f);
    applyOutline(c);
    return c;
  }
  if (type === 'raptors') {
    const [c, ctx] = mkCanvas(14, 14);
    const f = '#c8783a';
    const FC = cel(f);
    px(ctx, 2.5, 3.5, 8, 7, FC.b); px(ctx, 2.5, 3.5, 8, 2, FC.l);
    px(ctx, 8.5, 0, 5, 5, shade(f, 14));
    px(ctx, 10, 2, 1.5, 1.5, '#301c10');
    px(ctx, 12.5, 2.5, 1.8, 1.2, '#f0c040');
    px(ctx, 0, 4.5, 3, 2.5, shade(f, -22));
    px(ctx, 4, 10.5, 1.8, 2.8 - s, '#f0c040'); px(ctx, 7.5, 10.5, 1.8, 2 + s, '#f0c040');
    rimLight(ctx, 2.5, 3.5, 8, 7, f);
    applyOutline(c);
    return c;
  }
  if (type === 'gromp') {
    const [c, ctx] = mkCanvas(16, 14);
    const f = '#5a8a5a';
    const FC = cel(f);
    px(ctx, 1, 4 - (s ? 1 : 0), 14, 9, FC.b);
    px(ctx, 1, 4 - (s ? 1 : 0), 14, 3, FC.l);
    px(ctx, 3.5, 1.5, 3, 3, shade(f, 18));
    px(ctx, 10, 1.5, 3, 3, shade(f, 18));
    px(ctx, 4.2, 2.2, 1.5, 1.5, '#1a2a1a');
    px(ctx, 10.5, 2.2, 1.5, 1.5, '#1a2a1a');
    px(ctx, 3.5, 10, 2.5, 3.5 - s, FC.d);
    px(ctx, 10.5, 10, 2.5, 3 + s, FC.d);
    rimLight(ctx, 1, 4 - (s ? 1 : 0), 14, 9, f);
    applyOutline(c);
    return c;
  }
  if (type === 'krugs') {
    const [c, ctx] = mkCanvas(16, 15);
    const f = '#9a8a70';
    const FC = cel(f);
    px(ctx, 2.5, 2.5, 11, 10, FC.b);
    px(ctx, 2.5, 2.5, 11, 3, FC.l);
    px(ctx, 3, 7, 3.5, 2.5, shade(f, -35));
    px(ctx, 9, 5, 3.5, 2.5, shade(f, -35));
    px(ctx, 4.5, 5.5, 1.8, 1.8, '#ffe060');
    px(ctx, 10, 5.5, 1.8, 1.8, '#ffe060');
    px(ctx, 2.5, 12.5, 3.5, 2.5 - s, FC.d);
    px(ctx, 10, 12.5, 3.5, 2 + s, FC.d);
    rimLight(ctx, 2.5, 2.5, 11, 10, f);
    applyOutline(c);
    return c;
  }
  // buff azul / vermelho
  const [c, ctx] = mkCanvas(20, 18);
  const f = type === 'blue' ? '#4a80d0' : '#c8503a';
  const FC = cel(f);
  px(ctx, 3, 4 - (s ? 1 : 0), 14, 11, FC.b);
  px(ctx, 3, 4 - (s ? 1 : 0), 14, 3, FC.l);
  px(ctx, 1, 6, 3.5, 6, FC.d); px(ctx, 16, 6, 3.5, 6, FC.d);
  px(ctx, 7, 7, 2.5, 2.5, '#fff0a0'); px(ctx, 11, 7, 2.5, 2.5, '#fff0a0');
  px(ctx, 7.5, 7.5, 1.2, 1.2, '#ffffff'); px(ctx, 11.5, 7.5, 1.2, 1.2, '#ffffff');
  px(ctx, 5.5, 0, 3, 4, shade(f, -25)); px(ctx, 11.5, 0, 3, 4, shade(f, -25));
  px(ctx, 4, 15, 4, 2.5 - s, FC.d); px(ctx, 12, 15, 4, 2 + s, FC.d);
  rimLight(ctx, 3, 4 - (s ? 1 : 0), 14, 11, f);
  applyOutline(c);
  return c;
}

// =====================================================
//   CACHE
// =====================================================
const cache = new Map<string, HTMLCanvasElement>();
export function getHeroSprite(look: HeroDef['look'], id: string, team: 0 | 1, frame: number, pose: Pose): HTMLCanvasElement {
  const k = `h:${id}:${team}:${frame}:${pose}`;
  let s = cache.get(k);
  if (!s) { s = drawHeroSprite(look, team, frame, pose); cache.set(k, s); }
  return s;
}
export function getMinionSprite(team: 0 | 1, caster: boolean, frame: number, superM: boolean): HTMLCanvasElement {
  const k = `m:${team}:${caster ? 1 : 0}:${frame}:${superM ? 1 : 0}`;
  let s = cache.get(k);
  if (!s) { s = drawMinionSprite(team, caster, frame, superM); cache.set(k, s); }
  return s;
}
export function getMonsterSprite(type: string, frame: number): HTMLCanvasElement {
  const k = `j:${type}:${frame}`;
  let s = cache.get(k);
  if (!s) { s = drawMonsterSprite(type, frame); cache.set(k, s); }
  return s;
}
