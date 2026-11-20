import type { YetiColorId } from '../types';
import { getYetiColorway } from '../data/gameCatalog';

export type StickmanPose =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'guard'
  | 'jab'
  | 'heavy'
  | 'grapple'
  | 'suplex'
  | 'finisher'
  | 'pin'
  | 'hurt'
  | 'down'
  | 'slide'
  | 'victory'
  | 'wave';

export interface StickmanDrawOptions {
  x: number;
  y: number;
  facing: 1 | -1;
  pose: StickmanPose;
  animTime: number;
  actionProgress?: number;
  scale?: number;
  isLofiYeti?: boolean;
  colorwayId?: YetiColorId;
  hatId?: string;
  scarfId?: string;
  customStroke?: string;
  customAccent?: string;
  hasBelt?: boolean;
  shielded?: boolean;
  raged?: boolean;
  finisherReady?: boolean;
  weapon?: 'sword' | 'blaster' | 'pistols' | 'scanner';
  imposterVisor?: boolean;
  bossAura?: boolean;
  hp: number;
  maxHp: number;
  label?: string;
  flashHit?: boolean;
}

const LOFI_FACE_URL = '/src/assets/images/lofi_yeti_face_1794999269515.jpg';

let cachedLofiFaceCanvas: HTMLCanvasElement | null = null;
let faceLoadStarted = false;

function getLofiFaceSprite(): HTMLCanvasElement | null {
  if (cachedLofiFaceCanvas) return cachedLofiFaceCanvas;
  if (faceLoadStarted || typeof window === 'undefined') return null;
  faceLoadStarted = true;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const w = img.naturalWidth || 256;
    const h = img.naturalHeight || 256;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.drawImage(img, 0, 0, w, h);

    // Flood-fill remove outer solid dark-navy (#061224) border up to the black ink outline
    const imgData = octx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let qHead = 0;
    let qTail = 0;

    const isOuterBg = (idx: number) => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Background is dark navy (~#061224): low red/green, higher blue, brightness low, NOT pure black ink
      const distSq = (r - 8) * (r - 8) + (g - 20) * (g - 20) + (b - 38) * (b - 38);
      return distSq < 2100 && r < 42 && g < 55 && b < 78;
    };

    const seed = (sx: number, sy: number) => {
      const p = sy * w + sx;
      if (!visited[p] && isOuterBg(p * 4)) {
        visited[p] = 1;
        queue[qTail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      seed(x, 0);
      seed(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      seed(0, y);
      seed(w - 1, y);
    }

    while (qHead < qTail) {
      const p = queue[qHead++];
      data[p * 4 + 3] = 0;
      const px = p % w;
      const py = (p - px) / w;
      if (px > 0) seed(px - 1, py);
      if (px < w - 1) seed(px + 1, py);
      if (py > 0) seed(px, py - 1);
      if (py < h - 1) seed(px, py + 1);
    }

    // Soften 1px fringe on pixels adjacent to transparent background
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const idx = p * 4;
        if (data[idx + 3] > 0 && isOuterBg(idx)) {
          data[idx + 3] = 40;
        }
      }
    }

    octx.putImageData(imgData, 0, 0);
    cachedLofiFaceCanvas = off;
  };
  img.src = LOFI_FACE_URL;
  return null;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function drawPowerUpIcon(
  ctx: CanvasRenderingContext2D,
  kind: 'drop' | 'gem' | 'medkit' | 'shield' | 'rage' | 'magnet',
  x: number,
  y: number,
  animTime: number
): void {
  const bob = Math.sin(animTime * 4.5 + x * 0.04) * 4;
  ctx.save();
  ctx.translate(x, y + bob);

  if (kind === 'drop') {
    const grad = ctx.createLinearGradient(0, -14, 0, 14);
    grad.addColorStop(0, '#bae6fd');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.bezierCurveTo(11, -1, 13, 12, 0, 14);
    ctx.bezierCurveTo(-13, 12, -11, -1, 0, -14);
    ctx.fill();
    ctx.stroke();

    // Gloss highlight
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-3.5, 2, 2.2, 4.5, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === 'gem') {
    const grad = ctx.createLinearGradient(-10, -14, 10, 14);
    grad.addColorStop(0, '#cffafe');
    grad.addColorStop(0.5, '#22d3ee');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, 15);
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Soft outer aura ring for Power-Up Orbs
  const auraColor =
    kind === 'medkit'
      ? 'rgba(34, 197, 94, 0.32)'
      : kind === 'shield'
      ? 'rgba(56, 189, 248, 0.34)'
      : kind === 'rage'
      ? 'rgba(251, 146, 60, 0.36)'
      : 'rgba(192, 132, 252, 0.34)';

  const pulse = 22 + Math.sin(animTime * 6) * 2.5;
  ctx.fillStyle = auraColor;
  ctx.beginPath();
  ctx.arc(0, 0, pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(7, 19, 36, 0.9)';
  ctx.strokeStyle =
    kind === 'medkit'
      ? '#4ade80'
      : kind === 'shield'
      ? '#38bdf8'
      : kind === 'rage'
      ? '#fb923c'
      : '#c084fc';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (kind === 'medkit') {
    // Crisp White First-Aid Box + Handle + Red/Green Medical Cross
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(-5, -11, 10, 4);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-11, -7, 22, 16, 3);
    ctx.fill();
    ctx.stroke();
    // Red/Emerald Cross graphic
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(-2.4, -4, 4.8, 10);
    ctx.fillRect(-5, -1.4, 10, 4.8);
  } else if (kind === 'shield') {
    // Crisp Blue Heraldic Shield Sprite
    const grad = ctx.createLinearGradient(-10, -11, 10, 12);
    grad.addColorStop(0, '#bae6fd');
    grad.addColorStop(0.5, '#38bdf8');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#f0f9ff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, -8);
    ctx.quadraticCurveTo(10, 5, 0, 12);
    ctx.quadraticCurveTo(-10, 5, -10, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner shield bevel shine
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.quadraticCurveTo(-7, 3, -7, -6);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'rage') {
    // Crisp Blazing Flame / Power Lightning Sprite
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(1, -13);
    ctx.quadraticCurveTo(11, -4, 9, 5);
    ctx.quadraticCurveTo(7, 12, 0, 12);
    ctx.quadraticCurveTo(-9, 12, -9, 3);
    ctx.quadraticCurveTo(-9, -4, -3, -8);
    ctx.quadraticCurveTo(-2, -3, 1, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(5, 2, 4, 7);
    ctx.quadraticCurveTo(0, 10, -4, 6);
    ctx.quadraticCurveTo(-4, 1, 0, -4);
    ctx.fill();
  } else if (kind === 'magnet') {
    // Crisp Classic U-Shaped Horseshoe Magnet with Silver Poles & Energy Arcs
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.arc(0, 2, 8.5, 0, Math.PI, false);
    ctx.moveTo(-8.5, 2);
    ctx.lineTo(-8.5, -5);
    ctx.moveTo(8.5, 2);
    ctx.lineTo(8.5, -5);
    ctx.stroke();

    // Silver metallic tips
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-11.4, -9, 5.8, 4.5);
    ctx.fillRect(5.6, -9, 5.8, 4.5);

    // Attraction spark arc
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -10, 5, Math.PI + 0.4, -0.4);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawStickmanCharacter(
  ctx: CanvasRenderingContext2D,
  opts: StickmanDrawOptions
): void {
  const {
    x,
    y,
    facing,
    pose,
    animTime,
    actionProgress = 0,
    scale = 1,
    isLofiYeti = false,
    colorwayId = 'classic_lofi',
    hatId = 'hat_goggles',
    customStroke = '#f97316',
    customAccent = '#fbbf24',
    hasBelt = false,
    shielded = false,
    raged = false,
    finisherReady = false,
    weapon,
    imposterVisor = false,
    bossAura = false,
    hp,
    maxHp,
    label,
    flashHit = false,
  } = opts;

  const colorway = getYetiColorway(colorwayId);
  // Classic normal stickman body below Lofi's iconic head!
  const bodyStroke = flashHit
    ? '#ffffff'
    : isLofiYeti
    ? '#f8fafc'
    : customStroke;
  const accentColor = isLofiYeti ? '#f8fafc' : customAccent;
  const lofiFace = isLofiYeti ? getLofiFaceSprite() : null;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);

  // Ground shadow
  ctx.save();
  ctx.fillStyle = 'rgba(2, 8, 23, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 0, pose === 'down' || pose === 'slide' ? 42 : 22, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Articulated normal stickman skeleton poses
  // Angle convention (when facing = 1, facing right +X):
  //   a1 = 0 points straight DOWN (0, +1); a1 > 0 swings FORWARD (+X); a1 < 0 swings BACKWARD (-X).
  //   Knees always bend BACKWARD (shin a2 <= 0); elbows bend FORWARD/UP (forearm a2 >= 0).
  const hipX = 0;
  let hipY = -44;
  let torsoLean = 0.08;
  const headBob = Math.sin(animTime * 4) * 1.4;

  let lThigh = 0.24;
  let lShin = -0.22;
  let rThigh = -0.22;
  let rShin = -0.18;

  let lUpperArm = 0.35;
  let lForearm = 0.72;
  let rUpperArm = -0.28;
  let rForearm = 0.85;

  let wholeRotation = 0;
  let wholeOffsetY = 0;

  if (pose === 'idle') {
    const b = Math.sin(animTime * 4.2);
    hipY = -44 + b * 1.6;
    lUpperArm = -0.22 + b * 0.06;
    rUpperArm = 0.36 - b * 0.06;
    lForearm = 0.82;
    rForearm = 0.92;
  } else if (pose === 'run') {
    const c = animTime * 12.2;
    const s = Math.sin(c);
    const cosC = Math.cos(c);
    torsoLean = 0.28;
    hipY = -43 - Math.abs(cosC) * 3.8;
    // Left leg: swings forward (+sin) with extended shin ready to plant; tucks heel backward (a2 < 0) on recovery
    lThigh = 0.08 + s * 0.82;
    lShin = -0.14 - Math.max(0, -cosC) * 1.08 - Math.max(0, -s) * 0.22;
    // Right leg: opposite phase (c + PI)
    rThigh = 0.08 - s * 0.82;
    rShin = -0.14 - Math.max(0, cosC) * 1.08 - Math.max(0, s) * 0.22;
    // Counter-swinging arms with elbows bent forward/upward (+a2)
    lUpperArm = -0.1 - s * 0.82;
    lForearm = 1.05 + Math.max(0, s) * 0.32;
    rUpperArm = -0.1 + s * 0.82;
    rForearm = 1.05 + Math.max(0, -s) * 0.32;
  } else if (pose === 'jump') {
    torsoLean = 0.2;
    hipY = -42;
    lThigh = 0.82;
    lShin = -1.15;
    rThigh = -0.35;
    rShin = -0.82;
    lUpperArm = 2.15;
    lForearm = 0.45;
    rUpperArm = 1.75;
    rForearm = 0.45;
  } else if (pose === 'fall') {
    torsoLean = 0.06;
    hipY = -44;
    lThigh = 0.42;
    lShin = -0.52;
    rThigh = -0.38;
    rShin = -0.45;
    lUpperArm = 2.35;
    lForearm = 0.35;
    rUpperArm = -1.75;
    rForearm = 0.45;
  } else if (pose === 'guard') {
    torsoLean = -0.05;
    hipY = -41;
    lThigh = 0.35;
    lShin = -0.45;
    rThigh = -0.32;
    rShin = -0.4;
    lUpperArm = 0.95;
    lForearm = 1.25;
    rUpperArm = 0.65;
    rForearm = 1.45;
  } else if (pose === 'jab') {
    const thrust = Math.sin(Math.min(1, actionProgress) * Math.PI);
    torsoLean = 0.22 * thrust + 0.08;
    hipY = -43;
    lThigh = -0.38;
    lShin = -0.2;
    rThigh = 0.45;
    rShin = -0.25;
    lUpperArm = lerp(0.35, -0.35, thrust);
    lForearm = 1.15;
    rUpperArm = lerp(0.55, 1.52, thrust);
    rForearm = lerp(0.95, 0.05, thrust);
  } else if (pose === 'heavy') {
    const swing = Math.sin(Math.min(1, actionProgress) * Math.PI);
    torsoLean = lerp(-0.12, 0.36, swing);
    hipY = -41;
    lThigh = -0.42;
    lShin = -0.25;
    rThigh = lerp(0.25, 1.42, swing);
    rShin = lerp(-0.45, -0.06, swing);
    rUpperArm = lerp(0.4, 1.85, swing);
    rForearm = 0.22;
    lUpperArm = -0.75;
    lForearm = 0.6;
  } else if (pose === 'grapple' || pose === 'suplex') {
    const p = actionProgress;
    if (pose === 'suplex') {
      wholeRotation = -Math.sin(p * Math.PI) * 1.45;
      wholeOffsetY = -Math.sin(p * Math.PI) * 26;
    }
    torsoLean = pose === 'grapple' ? 0.35 : -0.45;
    rUpperArm = 1.45;
    rForearm = 0.25;
    lUpperArm = 1.25;
    lForearm = 0.35;
  } else if (pose === 'finisher') {
    const p = actionProgress;
    torsoLean = 0.42;
    wholeOffsetY = -Math.sin(p * Math.PI) * 48;
    wholeRotation = p < 0.5 ? -0.25 : 0.35;
    lUpperArm = 2.25;
    rUpperArm = 2.05;
    lForearm = 0.25;
    rForearm = 0.25;
    lThigh = 0.65;
    lShin = -0.55;
    rThigh = -0.55;
    rShin = -0.45;
  } else if (pose === 'pin') {
    wholeOffsetY = -8;
    torsoLean = 1.1;
    hipY = -22;
    lThigh = 0.8;
    lShin = -0.4;
    rThigh = 1.1;
    rShin = -0.35;
    lUpperArm = 1.1;
    rUpperArm = 1.35;
  } else if (pose === 'hurt') {
    torsoLean = -0.35;
    hipY = -42;
    lUpperArm = -1.4;
    lForearm = 0.4;
    rUpperArm = 1.2;
    rForearm = 0.4;
    lThigh = 0.25;
    lShin = -0.35;
    rThigh = -0.42;
    rShin = -0.3;
  } else if (pose === 'down') {
    wholeRotation = -Math.PI / 2 + 0.08;
    wholeOffsetY = -12;
    hipY = -36;
    lThigh = -0.15;
    lShin = -0.15;
    rThigh = 0.22;
    rShin = -0.2;
    lUpperArm = 1.75;
    rUpperArm = -0.6;
  } else if (pose === 'slide') {
    wholeRotation = -0.92;
    wholeOffsetY = -18;
    hipY = -36;
    lThigh = 0.38;
    lShin = -0.14;
    rThigh = -0.28;
    rShin = -0.82;
    lUpperArm = 1.15;
    lForearm = 0.35;
    rUpperArm = -0.75;
    rForearm = 0.45;
  } else if (pose === 'victory' || pose === 'wave') {
    const b = Math.sin(animTime * 8);
    hipY = -44 - Math.abs(b) * 3;
    lUpperArm = 2.45 - b * 0.2;
    lForearm = 0.35;
    rUpperArm = pose === 'victory' ? 2.45 + b * 0.2 : 1.9 - b * 0.45;
    rForearm = 0.45;
  }

  ctx.save();
  ctx.translate(0, wholeOffsetY);
  ctx.rotate(wholeRotation);

  // Power-Up Aura Rings
  if (shielded) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -52, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  if (bossAura) {
    const auraPulse = 0.55 + Math.sin(animTime * 7) * 0.25;
    ctx.save();
    ctx.strokeStyle = `rgba(244, 63, 94, ${auraPulse})`;
    ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -54, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(0, -54, 60, -animTime * 2.5, -animTime * 2.5 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (raged || finisherReady) {
    const pulse = 0.65 + Math.sin(animTime * 10) * 0.25;
    ctx.save();
    ctx.strokeStyle = raged
      ? `rgba(251, 146, 60, ${pulse})`
      : `rgba(34, 211, 238, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, -52, 44, animTime * 2, animTime * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const spineLen = 35;
  const shoulderX = hipX + Math.sin(torsoLean) * spineLen;
  const shoulderY = hipY - Math.cos(torsoLean) * spineLen;
  const neckX = shoulderX + Math.sin(torsoLean) * 6;
  const neckY = shoulderY - Math.cos(torsoLean) * 6;
  const headX = neckX + Math.sin(torsoLean * 0.65) * 15;
  const headY = neckY - Math.cos(torsoLean * 0.65) * 16 + headBob * 0.4;

  const thighLen = 22;
  const shinLen = 22;
  const upperArmLen = 19;
  const forearmLen = 19;

  const limbPos = (sx: number, sy: number, a1: number, l1: number, a2: number, l2: number) => {
    const mx = sx + Math.sin(a1) * l1;
    const my = sy + Math.cos(a1) * l1;
    const ex = mx + Math.sin(a1 + a2) * l2;
    const ey = my + Math.cos(a1 + a2) * l2;
    return { mx, my, ex, ey };
  };

  const leftLeg = limbPos(hipX, hipY, lThigh, thighLen, lShin, shinLen);
  const rightLeg = limbPos(hipX, hipY, rThigh, thighLen, rShin, shinLen);
  const leftArm = limbPos(shoulderX, shoulderY, lUpperArm, upperArmLen, lForearm, forearmLen);
  const rightArm = limbPos(shoulderX, shoulderY, rUpperArm, upperArmLen, rForearm, forearmLen);

  const drawNormalStickLimb = (
    sx: number,
    sy: number,
    mx: number,
    my: number,
    ex: number,
    ey: number,
    width: number,
    mainColor: string,
    tipColor?: string
  ) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#071324';
    ctx.lineWidth = width + 3.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    if (tipColor && !isLofiYeti) {
      ctx.fillStyle = tipColor;
      ctx.strokeStyle = '#071324';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ex, ey, width * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

  // Back normal stickman limbs
  drawNormalStickLimb(hipX, hipY, leftLeg.mx, leftLeg.my, leftLeg.ex, leftLeg.ey, 5.5, bodyStroke, accentColor);
  drawNormalStickLimb(shoulderX, shoulderY, leftArm.mx, leftArm.my, leftArm.ex, leftArm.ey, 5, bodyStroke, accentColor);

  // Normal Stickman Torso Spine (clean generic stickman line — no suit clutter)
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#071324';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(neckX, neckY);
  ctx.stroke();

  ctx.strokeStyle = bodyStroke;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(neckX, neckY);
  ctx.stroke();

  // Wrestling Championship Belt (only when champion in wrestling mode)
  if (hasBelt) {
    ctx.save();
    ctx.translate(hipX + Math.sin(torsoLean) * 6, hipY - 3);
    ctx.rotate(torsoLean);
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-9, -3.5, 18, 6);
    ctx.strokeRect(-9, -3.5, 18, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -0.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Front normal stickman limbs
  drawNormalStickLimb(hipX, hipY, rightLeg.mx, rightLeg.my, rightLeg.ex, rightLeg.ey, 5.5, bodyStroke, accentColor);
  drawNormalStickLimb(shoulderX, shoulderY, rightArm.mx, rightArm.my, rightArm.ex, rightArm.ey, 5, bodyStroke, accentColor);

  if (weapon === 'pistols') {
    // Killer Bean style sleek twin handguns (back hand + front hand)
    const drawPistol = (px: number, py: number, rot: number, flash: boolean) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      // Grip
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.fillRect(-3, 0, 5, 10);
      ctx.strokeRect(-3, 0, 5, 10);
      // Slide / Barrel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-3, -6, 22, 6.5);
      ctx.strokeRect(-3, -6, 22, 6.5);
      // Frost neon barrel accent
      ctx.fillStyle = isLofiYeti ? '#38bdf8' : '#fb7185';
      ctx.fillRect(6, -4.2, 11, 2);
      if (flash) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(20, -3);
        ctx.lineTo(31, -8);
        ctx.lineTo(27, -3);
        ctx.lineTo(32, 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    const muzzleFlash = pose === 'jab' && actionProgress < 0.45;
    drawPistol(leftArm.ex, leftArm.ey, -0.05, muzzleFlash);
    drawPistol(rightArm.ex, rightArm.ey, pose === 'jab' ? 0 : 0.08, muzzleFlash);
  } else if (weapon === 'scanner') {
    // Compact glowing Clue Analyzer / Cryo Stun Device
    ctx.save();
    ctx.translate(rightArm.ex, rightArm.ey);
    ctx.rotate(-0.2);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-4, -8, 14, 11, 2.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5eead4';
    ctx.fillRect(-1, -5.5, 8, 4.5);
    ctx.restore();
  } else if (weapon) {
    ctx.save();
    ctx.translate(rightArm.ex, rightArm.ey);
    ctx.rotate(weapon === 'sword' ? (pose === 'heavy' || pose === 'finisher' ? -0.75 : -0.25) : -0.45);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.strokeStyle = weapon === 'sword' ? '#e0f2fe' : '#38bdf8';
    ctx.lineWidth = weapon === 'sword' ? 7 : 9;
    ctx.shadowColor = weapon === 'sword' ? '#38bdf8' : '#0ea5e9';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, weapon === 'sword' ? -48 : -34);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Strike arc effect
  if ((pose === 'jab' || pose === 'heavy' || pose === 'finisher') && actionProgress > 0.15 && actionProgress < 0.85) {
    ctx.save();
    ctx.strokeStyle = pose === 'finisher' ? '#fbbf24' : isLofiYeti ? '#38bdf8' : accentColor;
    ctx.lineWidth = pose === 'jab' ? 3 : 5;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    const punchTipX = pose === 'heavy' ? rightLeg.ex : rightArm.ex;
    const punchTipY = pose === 'heavy' ? rightLeg.ey : rightArm.ey;
    ctx.arc(punchTipX, punchTipY, pose === 'finisher' ? 24 : 13, -0.8, 0.9);
    ctx.stroke();
    ctx.restore();
  }

  // HEAD: Authentic Lofi the Yeti X Face Sprite OR Rival Stickman Head
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(torsoLean * 0.35);

  if (isLofiYeti) {
    if (lofiFace) {
      // Composite original Lofi the Yeti X mascot face cleanly onto normal stickman neck
      const headSize = 48;
      if (flashHit) {
        ctx.filter = 'brightness(1.8)';
      }
      ctx.drawImage(lofiFace, -headSize / 2, -headSize / 2 - 2, headSize, headSize);
      ctx.filter = 'none';
    } else {
      // Instant vector fallback matching @lofitheyeti chill face until image finishes decoding
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#071324';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -1, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = colorway.skinHex;
      ctx.beginPath();
      ctx.ellipse(1.5, 0.5, 13, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-5, -4, 4, 3);
      ctx.fillRect(5, -4, 4, 3);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(2, 3, 4.5, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }

    // Subtle Crown / Halo overlay if equipped
    if (hatId === 'hat_crown') {
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-9, -20);
      ctx.lineTo(-9, -29);
      ctx.lineTo(-3, -23);
      ctx.lineTo(1, -31);
      ctx.lineTo(5, -23);
      ctx.lineTo(10, -29);
      ctx.lineTo(10, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hatId === 'hat_halo') {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, -26, 12, 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (imposterVisor) {
    // Among Us-inspired menacing Imposter Visor Stickman Head
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = bodyStroke;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing cyan/crimson tactical visor
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#071324';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(0, -6, 15, 8.5, 4);
    ctx.fill();
    ctx.stroke();

    // Visor glare + red imposter pupil
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, -4.5, 6, 2);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(10, -1, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Rival Stickman Head
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = bodyStroke;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.fillRect(-13, -7, 26, 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(2, -1, 2.2, 0, Math.PI * 2);
    ctx.arc(9, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // head
  ctx.restore(); // whole body

  // Unflipped Floating Nameplate & Life Bar above character
  ctx.scale(facing, 1);
  const barY = -128;
  const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  const barW = 54;
  ctx.fillStyle = 'rgba(7, 19, 36, 0.85)';
  ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, 8);
  ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(-barW / 2, barY, barW * pct, 6);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-barW / 2 - 1, barY - 1, barW + 2, 8);

  if (label) {
    ctx.font = '700 11px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isLofiYeti ? '#bae6fd' : '#fed7aa';
    ctx.fillText(label, 0, barY - 5);
  }

  ctx.restore();
}

/**
 * Parallax cityscape & industrial syndicate compound towers for Shadow Bean Raid (2D)
 */
export function drawRaidParallaxBuildings(
  ctx: CanvasRenderingContext2D,
  scrollX: number,
  canvasW: number,
  floorY: number,
  accentHex: string,
  timeSec: number
): void {
  // Layer 1: Far City Skyline (0.22x parallax)
  const farSpan = 220;
  const farOffset = -((scrollX * 0.22) % farSpan);
  const farHeights = [235, 310, 195, 275, 335, 240];
  for (let i = -1; i < Math.ceil(canvasW / farSpan) + 2; i++) {
    const idx = Math.abs(Math.floor((scrollX * 0.22) / farSpan) + i) % farHeights.length;
    const bx = farOffset + i * farSpan;
    const bh = farHeights[idx];
    const bw = 154 + (idx % 3) * 22;
    const by = floorY - bh;

    ctx.fillStyle = '#071529';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);

    // Rooftop antenna / beacon
    if (idx % 2 === 0) {
      ctx.fillStyle = '#0f2744';
      ctx.fillRect(bx + bw * 0.2, by - 14, bw * 0.5, 14);
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.5, by - 14);
      ctx.lineTo(bx + bw * 0.5, by - 44);
      ctx.stroke();
      ctx.fillStyle = Math.sin(timeSec * 4 + idx) > 0 ? '#f43f5e' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(bx + bw * 0.5, by - 45, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lit tower window grid
    for (let wy = by + 18; wy < floorY - 38; wy += 24) {
      for (let wx = bx + 14; wx < bx + bw - 20; wx += 22) {
        const litHash = ((wx * 7 + wy * 13 + idx * 19) % 11);
        if (litHash < 4) {
          ctx.fillStyle = litHash === 0 ? 'rgba(251, 191, 36, 0.36)' : 'rgba(56, 189, 248, 0.28)';
          ctx.fillRect(wx, wy, 10, 12);
        } else {
          ctx.fillStyle = 'rgba(15, 39, 68, 0.65)';
          ctx.fillRect(wx, wy, 10, 12);
        }
      }
    }
  }

  // Layer 2: Midground Syndicate Compound Warehouses & Neon Signs (0.52x parallax)
  const midSpan = 380;
  const midOffset = -((scrollX * 0.52) % midSpan);
  const signLabels = ['SYNDICATE', 'VAULT 04', 'CRYO BAY', 'SECTOR X'];
  for (let i = -1; i < Math.ceil(canvasW / midSpan) + 2; i++) {
    const idx = Math.abs(Math.floor((scrollX * 0.52) / midSpan) + i);
    const bx = midOffset + i * midSpan;
    const bh = 165 + (idx % 3) * 38;
    const bw = 270;
    const by = floorY - bh;

    ctx.fillStyle = '#0c1f38';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    // Corrugated vertical siding ribs
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.55)';
    ctx.lineWidth = 1;
    for (let sx = bx + 18; sx < bx + bw; sx += 22) {
      ctx.beginPath();
      ctx.moveTo(sx, by + 6);
      ctx.lineTo(sx, floorY);
      ctx.stroke();
    }

    // Illuminated rooftop neon sign
    const signW = 128;
    const signX = bx + bw * 0.5 - signW * 0.5;
    ctx.fillStyle = '#091426';
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2;
    ctx.fillRect(signX, by - 26, signW, 22);
    ctx.strokeRect(signX, by - 26, signW, 22);
    ctx.font = '700 11px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = accentHex;
    ctx.fillText(signLabels[idx % signLabels.length], bx + bw * 0.5, by - 11);

    // Rolling shutter warehouse door + glowing doorway strip
    ctx.fillStyle = '#142d4c';
    ctx.fillRect(bx + 36, floorY - 84, 96, 84);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(bx + 36, floorY - 84, 96, 84);
    for (let ry = floorY - 72; ry < floorY; ry += 12) {
      ctx.beginPath();
      ctx.moveTo(bx + 36, ry);
      ctx.lineTo(bx + 132, ry);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(251, 191, 36, 0.42)';
    ctx.fillRect(bx + 158, floorY - 68, 72, 26);
    ctx.strokeStyle = '#fbbf24';
    ctx.strokeRect(bx + 158, floorY - 68, 72, 26);
  }
}

/**
 * Steel support trusses & shipping containers beneath catwalk platforms in Raid mode
 */
export function drawRaidPlatformSupports(
  ctx: CanvasRenderingContext2D,
  platforms: { x: number; y: number; w: number }[],
  floorY: number,
  trimHex: string
): void {
  for (let i = 0; i < platforms.length; i++) {
    const pl = platforms[i];
    const h = floorY - pl.y;
    if (h > 20) {
      // Steel vertical I-beams at ends
      ctx.fillStyle = '#0f2036';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      const beamPositions = [pl.x + 14, pl.x + pl.w - 26];
      for (const bx of beamPositions) {
        ctx.fillRect(bx, pl.y + 12, 12, h - 12);
        ctx.strokeRect(bx, pl.y + 12, 12, h - 12);
      }

      // Cross-brace truss lines
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pl.x + 26, pl.y + 14);
      ctx.lineTo(pl.x + pl.w - 26, floorY);
      ctx.moveTo(pl.x + pl.w - 26, pl.y + 14);
      ctx.lineTo(pl.x + 26, floorY);
      ctx.stroke();

      // Cargo Shipping Container tucked under wider catwalks
      if (i % 2 === 0 && pl.w >= 210) {
        const cx = pl.x + 42;
        const cw = Math.min(130, pl.w - 84);
        const ch = Math.min(72, h - 18);
        if (ch >= 38) {
          ctx.fillStyle = i % 4 === 0 ? '#163554' : '#3b1d2a';
          ctx.fillRect(cx, floorY - ch, cw, ch);
          ctx.strokeStyle = i % 4 === 0 ? '#38bdf8' : '#fb7185';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx, floorY - ch, cw, ch);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(cx + 8, floorY - ch + 10, cw - 16, 8);
        }
      }
    }

    // Platform Deck + Safety Railing Posts
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = trimHex;
    ctx.lineWidth = 3;
    ctx.fillRect(pl.x, pl.y, pl.w, 14);
    ctx.strokeRect(pl.x, pl.y, pl.w, 14);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pl.x + 4, pl.y - 16);
    ctx.lineTo(pl.x + pl.w - 4, pl.y - 16);
    for (let rx = pl.x + 6; rx <= pl.x + pl.w - 6; rx += 46) {
      ctx.moveTo(rx, pl.y);
      ctx.lineTo(rx, pl.y - 16);
    }
    ctx.stroke();
  }
}

/**
 * Armored Extraction Gatehouse building at the end of a Raid stage
 */
export function drawExtractionBunker(
  ctx: CanvasRenderingContext2D,
  endX: number,
  floorY: number,
  bossAlive: boolean,
  timeSec: number
): void {
  const bx = endX - 90;
  const bw = 180;
  const bh = 215;
  const by = floorY - bh;

  // Main fortified concrete bunker facade
  ctx.fillStyle = '#0d1b2e';
  ctx.strokeStyle = bossAlive ? '#fb7185' : '#34d399';
  ctx.lineWidth = 3;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);

  // Sloped armored roof fascia
  ctx.fillStyle = '#162c49';
  ctx.fillRect(bx - 12, by - 22, bw + 24, 24);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(bx - 12, by - 22, bw + 24, 24);

  // Roof Beacon Lamp
  const lampOn = Math.sin(timeSec * 6) > 0;
  ctx.fillStyle = bossAlive ? (lampOn ? '#f43f5e' : '#881337') : '#34d399';
  ctx.beginPath();
  ctx.arc(endX, by - 30, 8, 0, Math.PI * 2);
  ctx.fill();

  // Inner Glowing Extraction Portal Arch
  ctx.fillStyle = bossAlive ? 'rgba(244, 63, 94, 0.18)' : 'rgba(16, 185, 129, 0.28)';
  ctx.strokeStyle = bossAlive ? '#fb7185' : '#34d399';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(endX - 44, floorY - 148, 88, 148, [16, 16, 0, 0]);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 16px "Pixel Forge", Oxanium, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = bossAlive ? '#fda4af' : '#6ee7b7';
  ctx.fillText(bossAlive ? 'DEFEAT BOSS' : 'EXIT →', endX, by - 44);
}

/**
 * Built Interior Architecture for all 6 Frost Station Escape Rooms (1680x960 world)
 */
export function drawStationRoomArchitecture(
  ctx: CanvasRenderingContext2D,
  airlockOpen: boolean,
  timeSec: number
): void {
  // 1. MEDBAY (80,80,460,370): Bio-Stasis Tanks, Cryo-Scan Bed, Wall Med Cabinet
  // Bio-stasis cylinders (left wall)
  [116, 152].forEach((tx, idx) => {
    ctx.fillStyle = 'rgba(45, 212, 191, 0.22)';
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tx, 255, 26, 68, 10);
    ctx.fill();
    ctx.stroke();
    const bubbleY = 310 - ((timeSec * 28 + idx * 19) % 44);
    ctx.fillStyle = '#99f6e4';
    ctx.beginPath();
    ctx.arc(tx + 13, bubbleY, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  // Med Cabinet (north wall)
  ctx.fillStyle = '#0f2744';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillRect(345, 92, 115, 34);
  ctx.strokeRect(345, 92, 115, 34);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(398, 100, 8, 18);
  ctx.fillRect(393, 105, 18, 8);
  // Cryo-Scan Bed (south-center of Medbay, clear of clue 235,240 & vent 165,155)
  ctx.fillStyle = '#13314d';
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(225, 342, 136, 56, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(45, 212, 191, 0.35)';
  ctx.fillRect(245, 353, 96, 34);

  // 2. RESEARCH LAB (600,80,480,370): Server Racks, Specimen Table, Dual Terminals
  for (let sx = 635; sx <= 765; sx += 44) {
    ctx.fillStyle = '#091628';
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.fillRect(sx, 94, 34, 52);
    ctx.strokeRect(sx, 94, 34, 52);
    ctx.fillStyle = Math.sin(timeSec * 5 + sx) > 0 ? '#38bdf8' : '#22c55e';
    ctx.fillRect(sx + 7, 104, 6, 4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(sx + 18, 104, 6, 4);
  }
  // Lab workbench (bottom right of Lab)
  ctx.fillStyle = '#142b47';
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2.2;
  ctx.fillRect(720, 352, 210, 44);
  ctx.strokeRect(720, 352, 210, 44);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(745, 362, 42, 24);
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(855, 362, 48, 24);

  // 3. ELECTRICAL (1140,80,460,370): Breaker Cabinets, Twin Coils & Floor Conduits
  for (let bx = 1170; bx <= 1350; bx += 60) {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.fillRect(bx, 94, 46, 44);
    ctx.strokeRect(bx, 94, 46, 44);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(bx + 10, 106, 26, 6);
  }
  // Floor power conduit lines
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(1235, 330);
  ctx.lineTo(1505, 330);
  ctx.stroke();
  [1235, 1505].forEach((tx) => {
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(tx, 330, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(tx, 330, 8 + Math.sin(timeSec * 8) * 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4. CAFETERIA HUB (80,510,460,390): Galley Counter, Vending Machine, Dining Tables, Meeting Table
  ctx.fillStyle = '#122844';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillRect(98, 526, 155, 42);
  ctx.strokeRect(98, 526, 155, 42);
  // Vending machine
  ctx.fillStyle = '#0f304d';
  ctx.strokeStyle = '#22d3ee';
  ctx.fillRect(466, 526, 54, 48);
  ctx.strokeRect(466, 526, 54, 48);
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(476, 534, 24, 28);
  // Side dining tables
  [
    { x: 170, y: 635 },
    { x: 445, y: 785 },
  ].forEach((tb) => {
    ctx.fillStyle = '#1e3a5f';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tb.x, tb.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  // Emergency Meeting Table (positioned cleanly next to spawn 290,700)
  ctx.fillStyle = '#1e3a5f';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(372, 705, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(372, 705, 11, 0, Math.PI * 2);
  ctx.fill();

  // 5. REACTOR CORE (600,510,480,390): Conduits + Glowing Reactor Turbine + Fuel Pylons
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(640, 705);
  ctx.lineTo(1040, 705);
  ctx.moveTo(840, 540);
  ctx.lineTo(840, 865);
  ctx.stroke();

  ctx.fillStyle = '#2e1065';
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(840, 705, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e879f9';
  ctx.beginPath();
  ctx.arc(840, 705, 16 + Math.sin(timeSec * 6) * 3, 0, Math.PI * 2);
  ctx.fill();

  // 6. AIRLOCK EXIT (1140,510,460,390): Crew Suit Lockers + Docked Escape Shuttle Craft
  for (let lx = 1190; lx <= 1340; lx += 38) {
    ctx.fillStyle = '#142a44';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.8;
    ctx.fillRect(lx, 526, 30, 42);
    ctx.strokeRect(lx, 526, 30, 42);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(lx + 7, 536, 16, 10);
  }

  // Docked Escape Shuttle Craft
  const podX = 1410;
  const podY = 705;
  ctx.fillStyle = airlockOpen ? 'rgba(16, 185, 129, 0.22)' : 'rgba(51, 65, 85, 0.45)';
  ctx.strokeStyle = airlockOpen ? '#34d399' : '#64748b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(podX, podY, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Shuttle Wings & Hull
  ctx.fillStyle = '#0f2744';
  ctx.strokeStyle = airlockOpen ? '#6ee7b7' : '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(podX + 46, podY);
  ctx.lineTo(podX - 18, podY - 38);
  ctx.lineTo(podX - 42, podY - 18);
  ctx.lineTo(podX - 42, podY + 18);
  ctx.lineTo(podX - 18, podY + 38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cockpit visor
  ctx.fillStyle = airlockOpen ? '#34d399' : '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(podX + 12, podY, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '700 14px "Pixel Forge", Oxanium, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = airlockOpen ? '#6ee7b7' : '#cbd5e1';
  ctx.fillText(airlockOpen ? 'ESCAPE POD OPEN!' : 'SHUTTLE LOCKED', podX, podY - 74);
}

/**
 * Arctic Outpost Buildings, Domes & Radio Towers for Glacier Run Parallax
 */
export function drawArcticOutpostParallax(
  ctx: CanvasRenderingContext2D,
  scrollX: number,
  canvasW: number,
  horizonY: number,
  accentHex: string,
  timeSec: number
): void {
  const span = 440;
  const off = -((scrollX * 0.34) % span);
  for (let i = -1; i < Math.ceil(canvasW / span) + 2; i++) {
    const idx = Math.abs(Math.floor((scrollX * 0.34) / span) + i);
    const ox = off + i * span;
    if (idx % 2 === 0) {
      // Geodesic Arctic Research Dome + Radio Mast
      ctx.fillStyle = '#0f2847';
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + 95, horizonY, 54, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(ox + 72, horizonY - 24, 16, 12);
      ctx.fillRect(ox + 102, horizonY - 24, 16, 12);

      // Radio Mast
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ox + 168, horizonY);
      ctx.lineTo(ox + 168, horizonY - 82);
      ctx.stroke();
      ctx.fillStyle = Math.sin(timeSec * 5 + idx) > 0 ? '#f43f5e' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(ox + 168, horizonY - 84, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Timber & Steel Outpost Cabin
      ctx.fillStyle = '#112540';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.fillRect(ox + 45, horizonY - 58, 122, 58);
      ctx.strokeRect(ox + 45, horizonY - 58, 122, 58);
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.moveTo(ox + 34, horizonY - 58);
      ctx.lineTo(ox + 106, horizonY - 94);
      ctx.lineTo(ox + 178, horizonY - 58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.72)';
      ctx.fillRect(ox + 68, horizonY - 40, 24, 18);
      ctx.fillRect(ox + 114, horizonY - 40, 24, 18);
    }
  }
}

/**
 * BuiltCliff / Steel Bridge Truss Foundations beneath Glacier Run platforms
 */
export function drawRunnerPlatformFoundations(
  ctx: CanvasRenderingContext2D,
  platforms: { x: number; y: number; w: number }[],
  canvasH: number,
  floorFill: string,
  floorTrim: string
): void {
  for (const pl of platforms) {
    const h = canvasH - pl.y;
    ctx.fillStyle = floorFill;
    ctx.fillRect(pl.x, pl.y, pl.w, h);

    // Structural bridge girders / rock stratification stripes
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(pl.x, pl.y + 18, pl.w, 12);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 2;
    for (let sx = pl.x + 36; sx < pl.x + pl.w - 24; sx += 76) {
      ctx.fillStyle = 'rgba(7, 19, 36, 0.55)';
      ctx.fillRect(sx, pl.y + 30, 14, h - 30);
      ctx.strokeRect(sx, pl.y + 30, 14, h - 30);
    }

    ctx.fillStyle = floorTrim;
    ctx.fillRect(pl.x, pl.y, pl.w, 7);
  }
}

export function drawRaidObstacle2D(
  ctx: CanvasRenderingContext2D,
  obs: {
    x: number;
    y: number;
    targetY: number;
    w: number;
    h: number;
    kind: 'laser_barrier' | 'airdrop_crate' | 'cryo_mine';
    hp: number;
    maxHp: number;
    falling?: boolean;
  },
  timeSec: number
): void {
  if (obs.falling) {
    // Red target drop zone warning on surface below
    const blink = 0.45 + Math.sin(timeSec * 16) * 0.35;
    ctx.save();
    ctx.strokeStyle = `rgba(244, 63, 94, ${blink})`;
    ctx.fillStyle = `rgba(244, 63, 94, ${blink * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(obs.x, obs.targetY - 2, obs.w * 0.62, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 10px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fda4af';
    ctx.fillText('DROP!', obs.x, obs.targetY - 14);
    ctx.restore();
  }

  ctx.save();
  if (obs.kind === 'laser_barrier') {
    const left = obs.x - obs.w * 0.5;
    const top = obs.y - obs.h;
    // Steel pylon base & cap
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.fillRect(left, obs.y - 16, obs.w, 16);
    ctx.strokeRect(left, obs.y - 16, obs.w, 16);
    ctx.fillRect(left + 2, top, obs.w - 4, 14);
    ctx.strokeRect(left + 2, top, obs.w - 4, 14);

    // Pulsing crimson laser beams
    const pulse = 0.65 + Math.sin(timeSec * 14 + obs.x) * 0.3;
    ctx.strokeStyle = `rgba(244, 63, 94, ${pulse})`;
    ctx.lineWidth = 4;
    for (let bx = -6; bx <= 6; bx += 6) {
      ctx.beginPath();
      ctx.moveTo(obs.x + bx, top + 14);
      ctx.lineTo(obs.x + bx, obs.y - 16);
      ctx.stroke();
    }
    ctx.strokeStyle = '#fecdd3';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(obs.x, top + 14);
    ctx.lineTo(obs.x, obs.y - 16);
    ctx.stroke();
  } else if (obs.kind === 'airdrop_crate') {
    const left = obs.x - obs.w * 0.5;
    const top = obs.y - obs.h;
    if (obs.falling) {
      // Parachute shroud lines & canopy
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left + 6, top);
      ctx.lineTo(obs.x - 24, top - 34);
      ctx.moveTo(left + obs.w - 6, top);
      ctx.lineTo(obs.x + 24, top - 34);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(obs.x, top - 32, 26, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.fillRect(left, top, obs.w, obs.h);
    ctx.strokeRect(left, top, obs.w, obs.h);
    // Hazard diagonal brace
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + 4, top + 4);
    ctx.lineTo(left + obs.w - 4, obs.y - 4);
    ctx.moveTo(left + obs.w - 4, top + 4);
    ctx.lineTo(left + 4, obs.y - 4);
    ctx.stroke();
  } else {
    // Spiked cryo/shock floor mine
    const left = obs.x - obs.w * 0.5;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(obs.x, obs.y - 2, obs.w * 0.48, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = Math.sin(timeSec * 12 + obs.x) > 0 ? '#ef4444' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(obs.x, obs.y - 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(left + 4, obs.y - 4, obs.w - 8, 3);
  }

  if (obs.hp < obs.maxHp && obs.hp > 0) {
    const bw = 38;
    const pct = Math.max(0, obs.hp / obs.maxHp);
    ctx.fillStyle = 'rgba(4, 12, 24, 0.85)';
    ctx.fillRect(obs.x - bw / 2, obs.y - obs.h - 11, bw, 5);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(obs.x - bw / 2, obs.y - obs.h - 11, bw * pct, 5);
  }
  ctx.restore();
}

export function drawStationHazard2D(
  ctx: CanvasRenderingContext2D,
  hz: {
    x: number;
    y: number;
    radius: number;
    kind: 'cryo_spill' | 'shock_wire' | 'cargo_block' | 'sabotage_mine';
    hp: number;
    maxHp: number;
  },
  timeSec: number
): void {
  ctx.save();
  if (hz.kind === 'cryo_spill') {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(hz.x, hz.y, hz.radius, hz.radius * 0.65, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 9px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText('FROST SLOW', hz.x, hz.y + 3);
  } else if (hz.kind === 'shock_wire') {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = Math.sin(timeSec * 22 + hz.x) > 0 ? '#fde047' : '#fb923c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hz.x - 18, hz.y - 6);
    ctx.lineTo(hz.x - 4, hz.y + 6);
    ctx.lineTo(hz.x + 6, hz.y - 7);
    ctx.lineTo(hz.x + 18, hz.y + 5);
    ctx.stroke();
  } else if (hz.kind === 'cargo_block') {
    const s = hz.radius * 1.45;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2.5;
    ctx.fillRect(hz.x - s / 2, hz.y - s / 2, s, s);
    ctx.strokeRect(hz.x - s / 2, hz.y - s / 2, s, s);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hz.x - s / 2 + 4, hz.y - s / 2 + 4);
    ctx.lineTo(hz.x + s / 2 - 4, hz.y + s / 2 - 4);
    ctx.stroke();
    if (hz.hp < hz.maxHp) {
      ctx.fillStyle = '#040c18';
      ctx.fillRect(hz.x - 18, hz.y - s / 2 - 9, 36, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(hz.x - 18, hz.y - s / 2 - 9, 36 * Math.max(0, hz.hp / hz.maxHp), 4);
    }
  } else {
    // Sabotage mine
    const pulse = 1 + Math.sin(timeSec * 12 + hz.x) * 0.15;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, 14 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = Math.sin(timeSec * 16 + hz.x) > 0 ? '#ef4444' : '#fda4af';
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRunnerHazard2D(
  ctx: CanvasRenderingContext2D,
  hz: {
    x: number;
    y: number;
    w: number;
    h: number;
    kind: 'spike' | 'icicle' | 'crate' | 'falling_boulder' | 'sludge';
    targetY?: number;
    landed?: boolean;
  },
  timeSec: number
): void {
  ctx.save();
  if (hz.kind === 'spike') {
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hz.x, hz.y);
    ctx.lineTo(hz.x + hz.w * 0.5, hz.y - hz.h);
    ctx.lineTo(hz.x + hz.w, hz.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hz.kind === 'icicle') {
    ctx.fillStyle = '#fb7185';
    ctx.strokeStyle = '#ffe4e6';
    ctx.lineWidth = 2;
    ctx.fillRect(hz.x, hz.y - hz.h, hz.w, hz.h * 0.72);
    ctx.strokeRect(hz.x, hz.y - hz.h, hz.w, hz.h * 0.72);
    ctx.font = '700 10px Oxanium, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('SLIDE!', hz.x + hz.w / 2, hz.y - hz.h - 6);
  } else if (hz.kind === 'falling_boulder') {
    if (!hz.landed && hz.targetY !== undefined) {
      const blink = 0.5 + Math.sin(timeSec * 18) * 0.35;
      ctx.strokeStyle = `rgba(249, 115, 22, ${blink})`;
      ctx.fillStyle = `rgba(249, 115, 22, ${blink * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hz.x + hz.w / 2, hz.targetY - 2, hz.w * 0.65, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const cx = hz.x + hz.w * 0.5;
    const cy = hz.y - hz.h * 0.5;
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - hz.w * 0.45, cy);
    ctx.lineTo(cx - hz.w * 0.22, cy - hz.h * 0.48);
    ctx.lineTo(cx + hz.w * 0.3, cy - hz.h * 0.42);
    ctx.lineTo(cx + hz.w * 0.48, cy + hz.h * 0.12);
    ctx.lineTo(cx + hz.w * 0.16, cy + hz.h * 0.48);
    ctx.lineTo(cx - hz.w * 0.34, cy + hz.h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hz.kind === 'sludge') {
    ctx.fillStyle = 'rgba(14, 165, 233, 0.38)';
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(hz.x, hz.y - 11, hz.w, 11, 5);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 9px Oxanium, sans-serif';
    ctx.fillStyle = '#bae6fd';
    ctx.textAlign = 'center';
    ctx.fillText('FROST SLOW', hz.x + hz.w / 2, hz.y - 15);
  } else {
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 3;
    ctx.fillRect(hz.x, hz.y - hz.h, hz.w, hz.h);
    ctx.strokeRect(hz.x, hz.y - hz.h, hz.w, hz.h);
    ctx.beginPath();
    ctx.moveTo(hz.x, hz.y - hz.h);
    ctx.lineTo(hz.x + hz.w, hz.y);
    ctx.moveTo(hz.x + hz.w, hz.y - hz.h);
    ctx.lineTo(hz.x, hz.y);
    ctx.stroke();
  }
  ctx.restore();
}


