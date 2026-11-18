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
  weapon?: 'sword' | 'blaster';
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
  const hipX = 0;
  let hipY = -44;
  let torsoLean = 0.06;
  const headBob = Math.sin(animTime * 4) * 1.4;

  let lThigh = -0.24;
  let lShin = 0.26;
  let rThigh = 0.24;
  let rShin = 0.18;

  let lUpperArm = -0.42;
  let lForearm = -0.68;
  let rUpperArm = 0.52;
  let rForearm = -0.82;

  let wholeRotation = 0;
  let wholeOffsetY = 0;

  if (pose === 'idle') {
    const b = Math.sin(animTime * 4.2);
    hipY = -44 + b * 1.8;
    lUpperArm = -0.42 + b * 0.08;
    rUpperArm = 0.48 - b * 0.08;
    lForearm = -0.85;
    rForearm = -0.95;
  } else if (pose === 'run') {
    const c = animTime * 11.5;
    const s = Math.sin(c);
    const s2 = Math.cos(c);
    torsoLean = 0.24;
    hipY = -43 - Math.abs(s) * 4;
    lThigh = s * 0.85;
    lShin = Math.max(0.1, -s2 * 0.95 + 0.35);
    rThigh = -s * 0.85;
    rShin = Math.max(0.1, s2 * 0.95 + 0.35);
    lUpperArm = -s * 0.9;
    lForearm = -0.95;
    rUpperArm = s * 0.9;
    rForearm = -0.95;
  } else if (pose === 'jump') {
    torsoLean = 0.16;
    hipY = -42;
    lThigh = -0.75;
    lShin = 1.15;
    rThigh = 0.45;
    rShin = 0.85;
    lUpperArm = -2.2;
    lForearm = -0.4;
    rUpperArm = -1.8;
    rForearm = -0.4;
  } else if (pose === 'fall') {
    torsoLean = -0.04;
    hipY = -44;
    lThigh = -0.4;
    lShin = 0.5;
    rThigh = 0.45;
    rShin = 0.45;
    lUpperArm = -2.5;
    rUpperArm = 2.1;
  } else if (pose === 'guard') {
    torsoLean = -0.08;
    hipY = -40;
    lThigh = -0.35;
    lShin = 0.5;
    rThigh = 0.35;
    rShin = 0.4;
    lUpperArm = -1.2;
    lForearm = -1.45;
    rUpperArm = 0.85;
    rForearm = -1.75;
  } else if (pose === 'jab') {
    const thrust = Math.sin(Math.min(1, actionProgress) * Math.PI);
    torsoLean = 0.24 * thrust;
    hipY = -43;
    lThigh = -0.42;
    rThigh = 0.42;
    lUpperArm = lerp(-0.4, 0.2, thrust);
    lForearm = -1.2;
    rUpperArm = lerp(0.5, -1.55, thrust);
    rForearm = lerp(-1.2, 0.05, thrust);
  } else if (pose === 'heavy') {
    const swing = Math.sin(Math.min(1, actionProgress) * Math.PI);
    torsoLean = lerp(-0.15, 0.45, swing);
    hipY = -41;
    lThigh = -0.5;
    rThigh = lerp(0.3, 1.35, swing);
    rShin = lerp(0.4, 0.05, swing);
    rUpperArm = lerp(0.6, -2.1, swing);
    rForearm = -0.15;
    lUpperArm = -0.9;
  } else if (pose === 'grapple' || pose === 'suplex') {
    const p = actionProgress;
    if (pose === 'suplex') {
      wholeRotation = -Math.sin(p * Math.PI) * 1.45;
      wholeOffsetY = -Math.sin(p * Math.PI) * 26;
    }
    torsoLean = pose === 'grapple' ? 0.35 : -0.45;
    rUpperArm = -1.55;
    rForearm = -0.2;
    lUpperArm = -1.35;
    lForearm = -0.3;
  } else if (pose === 'finisher') {
    const p = actionProgress;
    torsoLean = 0.42;
    wholeOffsetY = -Math.sin(p * Math.PI) * 48;
    wholeRotation = p < 0.5 ? -0.3 : 0.35;
    lUpperArm = -2.4;
    rUpperArm = -2.2;
    lForearm = -0.2;
    rForearm = -0.2;
    lThigh = -0.6;
    rThigh = 0.6;
  } else if (pose === 'pin') {
    wholeOffsetY = -8;
    torsoLean = 1.1;
    hipY = -22;
    lThigh = 0.8;
    rThigh = 1.1;
    lUpperArm = 1.1;
    rUpperArm = 1.35;
  } else if (pose === 'hurt') {
    torsoLean = -0.35;
    hipY = -42;
    lUpperArm = -1.8;
    rUpperArm = 1.6;
    lThigh = -0.2;
    rThigh = 0.45;
  } else if (pose === 'down') {
    wholeRotation = -Math.PI / 2 + 0.08;
    wholeOffsetY = -12;
    hipY = -36;
    lThigh = -0.15;
    rThigh = 0.22;
    lUpperArm = -1.9;
    rUpperArm = 0.7;
  } else if (pose === 'slide') {
    wholeRotation = -0.98;
    wholeOffsetY = -18;
    hipY = -36;
    lThigh = 0.25;
    lShin = 0.1;
    rThigh = -0.35;
    rShin = 0.75;
    lUpperArm = -1.3;
    rUpperArm = 0.8;
  } else if (pose === 'victory' || pose === 'wave') {
    const b = Math.sin(animTime * 8);
    hipY = -44 - Math.abs(b) * 3;
    lUpperArm = -2.45 + b * 0.2;
    lForearm = -0.35;
    rUpperArm = pose === 'victory' ? -2.45 - b * 0.2 : -1.9 + b * 0.45;
    rForearm = -0.45;
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

  if (weapon) {
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
