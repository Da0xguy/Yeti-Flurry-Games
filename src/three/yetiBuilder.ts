import * as THREE from 'three';
import { COSMETICS_CATALOG } from '../data/moveContracts';
import { resolveCharacterPalette } from '../data/gameCatalog';
import type { CharacterId, CustomCharacterColors, YetiColorId, YetiEmoteKind } from '../types';

export interface YetiRigParts {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftElbowGroup: THREE.Group;
  rightElbowGroup: THREE.Group;
  leftHipGroup: THREE.Group;
  rightHipGroup: THREE.Group;
  leftKneeGroup: THREE.Group;
  rightKneeGroup: THREE.Group;
  leftFootGroup: THREE.Group;
  rightFootGroup: THREE.Group;
  scarfTail?: THREE.Mesh;
  tailGroup?: THREE.Group;
  ribbonGroup?: THREE.Group;
  weaponGroup?: THREE.Group;
  shieldMesh: THREE.Mesh;
  boostRing: THREE.Mesh;
  throwAnim: number;
  walkPhase: number;
  moveBlend: number;
  emoteBlend: number;
  emoteTime: number;
}

function getCosmeticHex(id: string, fallback: string): string {
  return COSMETICS_CATALOG.find((c) => c.id === id)?.colorHex || fallback;
}

interface FurTextureSet {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

let cachedFurTextures: FurTextureSet | null = null;
let sharedShadowTex: THREE.CanvasTexture | null = null;

/**
 * Generates procedural shaggy fur bump + roughness maps so character coats
 * read as soft layered fur or woven fabric under directional arena lighting.
 */
function getFurTextures(): FurTextureSet {
  if (cachedFurTextures) return cachedFurTextures;

  const size = 256;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#888888';
  bCtx.fillRect(0, 0, size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#d8d8d8';
  rCtx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 1500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 14;
    const w = 1.4 + rand() * 2.4;
    const shade = Math.floor(108 + rand() * 142);
    const tilt = (rand() - 0.5) * 3.5;

    bCtx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.lineWidth = w;
    bCtx.lineCap = 'round';
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + tilt, y + len);
    bCtx.stroke();

    const rVal = Math.floor(190 + rand() * 62);
    rCtx.strokeStyle = `rgb(${rVal},${rVal},${rVal})`;
    rCtx.lineWidth = w;
    rCtx.lineCap = 'round';
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + tilt, y + len);
    rCtx.stroke();
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  cachedFurTextures = { bumpMap, roughnessMap };
  return cachedFurTextures;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(3, 12, 24, 0.78)');
  grad.addColorStop(1, 'rgba(3, 12, 24, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a multi-jointed 3D playable hero rig (`THREE.Group`) supporting 5 distinct
 * character archetypes (`lofi_yeti`, `frost_fox`, `cryo_penguin`, `mecha_bot`,
 * `glacier_ronin`), wearable 3D outfits/clothes, hats, scarves, preset colorways,
 * and custom per-slot colors. Grounded cleanly at y = 0.
 */
export function buildYetiRig(options: {
  characterId?: CharacterId;
  colorwayId?: YetiColorId;
  customColors?: CustomCharacterColors;
  hatId: string;
  scarfId: string;
  outfitId?: string;
  isPlayer: boolean;
  scale?: number;
  weapon?: 'sword' | 'blaster';
}): YetiRigParts {
  const characterId: CharacterId = options.characterId || 'lofi_yeti';
  const outfitId = options.outfitId || 'outfit_none';
  const palette = resolveCharacterPalette(options.colorwayId, options.customColors);
  const { bumpMap, roughnessMap } = getFurTextures();

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  if (options.scale && options.scale !== 1) {
    root.scale.setScalar(options.scale);
  }

  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.65),
    new THREE.MeshBasicMaterial({
      map: sharedShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  // Subtle base ring indicating player vs rival accent
  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.72, 32),
    new THREE.MeshBasicMaterial({
      color: options.isPlayer ? palette.accentHex : palette.skinHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: options.isPlayer ? 0.9 : 0.44,
      depthWrite: false,
    })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.03;
  root.add(baseRing);

  const isMecha = characterId === 'mecha_bot';
  const isPenguin = characterId === 'cryo_penguin';
  const isFox = characterId === 'frost_fox';
  const isRonin = characterId === 'glacier_ronin';

  // Primary Coat / Armor Material
  const furMat = isMecha
    ? new THREE.MeshPhysicalMaterial({
        color: palette.furHex,
        roughness: 0.28,
        metalness: 0.72,
        clearcoat: 0.65,
        clearcoatRoughness: 0.2,
      })
    : isPenguin
    ? new THREE.MeshPhysicalMaterial({
        color: options.customColors?.furHex || (options.colorwayId && options.colorwayId !== 'classic_lofi' ? palette.furHex : '#1e293b'),
        roughness: 0.45,
        metalness: 0.06,
        clearcoat: 0.35,
      })
    : isRonin
    ? new THREE.MeshStandardMaterial({
        color: options.customColors?.furHex || (options.colorwayId && options.colorwayId !== 'classic_lofi' ? palette.furHex : '#1e293b'),
        roughness: 0.76,
        metalness: 0.1,
      })
    : new THREE.MeshPhysicalMaterial({
        color: isFox && !options.customColors?.furHex && (!options.colorwayId || options.colorwayId === 'classic_lofi')
          ? '#f1f5f9'
          : palette.furHex,
        roughness: 0.92,
        metalness: 0.0,
        bumpMap,
        bumpScale: isFox ? 0.025 : 0.048,
        roughnessMap,
        sheen: 0.72,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color(palette.accentHex).lerp(new THREE.Color('#ffffff'), 0.65),
      });

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: palette.skinHex,
    roughness: isMecha ? 0.22 : 0.44,
    metalness: isMecha ? 0.55 : 0.04,
    clearcoat: isMecha ? 0.85 : 0.16,
    clearcoatRoughness: 0.45,
  });

  const bellyMat = new THREE.MeshStandardMaterial({
    color: isPenguin ? '#f8fafc' : palette.chinHex,
    roughness: 0.78,
  });

  const darkOutlineMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.6,
  });

  const accentGlowMat = new THREE.MeshStandardMaterial({
    color: palette.accentHex,
    emissive: palette.accentHex,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.2,
  });

  // Helper for jagged shaggy fur cuffs (ankles, wrists, neck) — Yeti / Fox only
  const addFurRuff = (parent: THREE.Object3D, y: number, radius: number, count: number, coneH: number) => {
    if (isMecha || isPenguin || isRonin) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.065, coneH, 6), furMat);
      tuft.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      tuft.rotation.x = Math.PI - 0.35 * Math.sin(a);
      tuft.rotation.z = 0.35 * Math.cos(a);
      parent.add(tuft);
    }
  };

  // Resolve wearable clothing material
  const defaultOutfitHex = getCosmeticHex(outfitId, palette.accentHex);
  const outfitMainHex = palette.outfitHex || defaultOutfitHex;
  const hasOutfit = outfitId !== 'outfit_none';

  const clothMat = new THREE.MeshPhysicalMaterial({
    color: outfitMainHex,
    roughness: outfitId === 'outfit_cyber' || outfitId === 'outfit_astronaut' ? 0.32 : 0.76,
    metalness: outfitId === 'outfit_cyber' ? 0.65 : outfitId === 'outfit_astronaut' ? 0.35 : 0.06,
    clearcoat: outfitId === 'outfit_jersey' || outfitId === 'outfit_cyber' ? 0.45 : 0.08,
  });

  const clothTrimMat = new THREE.MeshStandardMaterial({
    color: outfitId === 'outfit_parka' ? '#f8fafc' : palette.accentHex,
    roughness: outfitId === 'outfit_parka' ? 0.92 : 0.35,
    metalness: outfitId === 'outfit_cyber' ? 0.5 : 0.1,
  });

  // 1. Articulated Bipedal Legs (Hip -> Thigh -> Knee -> Shin -> Ankle -> Foot)
  const buildLeg = (side: -1 | 1) => {
    const hipGroup = new THREE.Group();
    const legSpread = isPenguin ? 0.18 : isFox ? 0.17 : 0.2;
    hipGroup.position.set(side * legSpread, 0.96, 0);

    const legR = isFox || isRonin ? 0.125 : isPenguin ? 0.135 : 0.155;
    const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(legR, 12, 10), furMat);
    hipJoint.castShadow = true;
    hipGroup.add(hipJoint);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(legR, legR * 0.9, 0.44, isMecha ? 8 : 14),
      furMat
    );
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    hipGroup.add(thigh);

    const kneeGroup = new THREE.Group();
    kneeGroup.position.set(0, -0.44, 0);
    hipGroup.add(kneeGroup);

    const kneeBall = new THREE.Mesh(
      new THREE.SphereGeometry(legR * 0.9, 10, 8),
      isMecha || isRonin ? skinMat : furMat
    );
    kneeBall.castShadow = true;
    kneeGroup.add(kneeBall);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(legR * 0.9, legR * 1.02, 0.42, isMecha ? 8 : 14),
      furMat
    );
    shin.position.y = -0.21;
    shin.castShadow = true;
    shin.receiveShadow = true;
    kneeGroup.add(shin);

    addFurRuff(kneeGroup, -0.4, legR, 7, 0.14);

    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.42, 0.02);
    kneeGroup.add(footGroup);

    if (isPenguin) {
      // Sculpted orange/gold webbed penguin flipper foot
      const penguinFootMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.45 });
      const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.38), penguinFootMat);
      flipper.position.set(0, -0.05, 0.1);
      flipper.castShadow = true;
      footGroup.add(flipper);
    } else if (isMecha) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.36), skinMat);
      boot.position.set(0, -0.03, 0.07);
      boot.castShadow = true;
      footGroup.add(boot);
    } else {
      const soleGeo = new THREE.SphereGeometry(0.155, 14, 10);
      soleGeo.scale(isFox ? 0.85 : 1.05, 0.56, 1.48);
      const sole = new THREE.Mesh(soleGeo, isFox ? darkOutlineMat : skinMat);
      sole.position.set(0, -0.02, 0.07);
      sole.castShadow = true;
      footGroup.add(sole);

      if (characterId === 'lofi_yeti') {
        const toeGeo = new THREE.SphereGeometry(0.042, 8, 8);
        [-0.11, -0.055, 0, 0.055, 0.11].forEach((tx, idx) => {
          const toe = new THREE.Mesh(toeGeo, skinMat);
          const zCurve = 0.25 - Math.abs(idx - 2) * 0.025;
          toe.position.set(tx, -0.055, zCurve);
          toe.scale.set(0.95, 0.85, 1.2);
          footGroup.add(toe);
        });
      }
    }

    return { hipGroup, kneeGroup, footGroup };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  bodyPivot.add(leftLeg.hipGroup, rightLeg.hipGroup);

  // 2. Character-Specific Torso Silhouette (y = 0.88..1.94)
  const torsoRadiusScale = isPenguin ? 1.16 : isFox || isRonin ? 0.88 : 1.06;
  const torsoProfile = isMecha
    ? [
        new THREE.Vector2(0.0, 0.86),
        new THREE.Vector2(0.28, 0.92),
        new THREE.Vector2(0.32, 1.24),
        new THREE.Vector2(0.39, 1.66),
        new THREE.Vector2(0.34, 1.86),
        new THREE.Vector2(0.18, 1.94),
        new THREE.Vector2(0.0, 1.95),
      ]
    : [
        new THREE.Vector2(0.0, 0.86),
        new THREE.Vector2(0.32, 0.92),
        new THREE.Vector2(0.36, 1.15),
        new THREE.Vector2(0.35, 1.44),
        new THREE.Vector2(0.37, 1.68),
        new THREE.Vector2(0.31, 1.84),
        new THREE.Vector2(0.21, 1.93),
        new THREE.Vector2(0.0, 1.95),
      ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, isMecha ? 8 : 24);
  const torsoMesh = new THREE.Mesh(torsoGeo, furMat);
  torsoMesh.scale.set(torsoRadiusScale, 1.0, isPenguin ? 1.0 : 0.86);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  if (isPenguin && !hasOutfit) {
    // Crisp white penguin belly bib
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 16), bellyMat);
    belly.scale.set(0.95, 1.32, 0.56);
    belly.position.set(0, 1.36, 0.19);
    bodyPivot.add(belly);
  } else if (isMecha && !hasOutfit) {
    // Glowing chest energy core on chassis
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8), accentGlowMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 1.48, 0.34);
    bodyPivot.add(core);
  }

  addFurRuff(bodyPivot, 1.92, 0.24, 9, 0.18);

  // 2b. Wearable 3D Clothes / Outfit Shell on Torso
  if (hasOutfit) {
    const outfitGroup = new THREE.Group();
    const oScaleX = torsoRadiusScale * 1.075;
    const oScaleZ = (isPenguin ? 1.0 : 0.86) * 1.09;

    if (outfitId === 'outfit_hoodie') {
      const hoodieProfile = [
        new THREE.Vector2(0.0, 0.9),
        new THREE.Vector2(0.36, 0.94),
        new THREE.Vector2(0.385, 1.24),
        new THREE.Vector2(0.39, 1.56),
        new THREE.Vector2(0.34, 1.84),
        new THREE.Vector2(0.24, 1.93),
        new THREE.Vector2(0.0, 1.94),
      ];
      const hoodieMesh = new THREE.Mesh(new THREE.LatheGeometry(hoodieProfile, 22), clothMat);
      hoodieMesh.scale.set(oScaleX, 1.0, oScaleZ);
      hoodieMesh.castShadow = true;
      outfitGroup.add(hoodieMesh);

      // Ribbed waistband hem
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.35 * oScaleX, 0.045, 8, 24), clothTrimMat);
      hem.rotation.x = Math.PI / 2;
      hem.scale.set(1, oScaleZ / oScaleX, 1);
      hem.position.y = 0.95;
      outfitGroup.add(hem);

      // Kangaroo front pocket + twin white drawstrings
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), clothTrimMat);
      pocket.position.set(0, 1.15, 0.34 * oScaleZ);
      outfitGroup.add(pocket);

      const cordMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.7 });
      [-0.075, 0.075].forEach((cx) => {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), cordMat);
        cord.position.set(cx, 1.67, 0.32 * oScaleZ);
        cord.rotation.x = -0.18;
        outfitGroup.add(cord);
      });
    } else if (outfitId === 'outfit_parka') {
      const parkaProfile = [
        new THREE.Vector2(0.0, 0.8),
        new THREE.Vector2(0.41, 0.84),
        new THREE.Vector2(0.39, 1.18),
        new THREE.Vector2(0.4, 1.56),
        new THREE.Vector2(0.35, 1.85),
        new THREE.Vector2(0.26, 1.96),
        new THREE.Vector2(0.0, 1.96),
      ];
      const parkaMesh = new THREE.Mesh(new THREE.LatheGeometry(parkaProfile, 22), clothMat);
      parkaMesh.scale.set(oScaleX, 1.0, oScaleZ);
      parkaMesh.castShadow = true;
      outfitGroup.add(parkaMesh);

      // Central zipper placket
      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.98, 0.05), darkOutlineMat);
      placket.position.set(0, 1.38, 0.36 * oScaleZ);
      outfitGroup.add(placket);

      // Fur collar trim + waist utility belt + brass buckle
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.075, 10, 22), clothTrimMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 1.9, 0.01);
      outfitGroup.add(collar);

      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.39 * oScaleX, 0.39 * oScaleX, 0.1, 20), darkOutlineMat);
      belt.scale.set(1, 1, oScaleZ / oScaleX);
      belt.position.y = 1.16;
      outfitGroup.add(belt);

      const buckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.12, 0.06),
        new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.75, roughness: 0.25 })
      );
      buckle.position.set(0, 1.16, 0.39 * oScaleZ);
      outfitGroup.add(buckle);
    } else if (outfitId === 'outfit_jersey') {
      const jerseyProfile = [
        new THREE.Vector2(0.0, 0.9),
        new THREE.Vector2(0.35, 0.93),
        new THREE.Vector2(0.37, 1.26),
        new THREE.Vector2(0.39, 1.62),
        new THREE.Vector2(0.34, 1.85),
        new THREE.Vector2(0.24, 1.92),
        new THREE.Vector2(0.0, 1.93),
      ];
      const jerseyMesh = new THREE.Mesh(new THREE.LatheGeometry(jerseyProfile, 22), clothMat);
      jerseyMesh.scale.set(oScaleX, 1.0, oScaleZ);
      jerseyMesh.castShadow = true;
      outfitGroup.add(jerseyMesh);

      const stripeMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });
      [-0.1, 0.1].forEach((sx) => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.88, 0.72 * oScaleZ), stripeMat);
        stripe.position.set(sx, 1.38, 0);
        outfitGroup.add(stripe);
      });

      const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), accentGlowMat);
      badge.rotation.x = Math.PI / 2;
      badge.position.set(0.16, 1.56, 0.36 * oScaleZ);
      outfitGroup.add(badge);
    } else if (outfitId === 'outfit_cyber') {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.76 * torsoRadiusScale, 0.88, 0.64), clothMat);
      plate.position.set(0, 1.42, 0);
      plate.castShadow = true;
      outfitGroup.add(plate);

      const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 18), accentGlowMat);
      coreRing.position.set(0, 1.5, 0.34);
      outfitGroup.add(coreRing);

      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.8 * torsoRadiusScale, 0.12, 0.68), darkOutlineMat);
      belt.position.set(0, 1.0, 0);
      outfitGroup.add(belt);
    } else if (outfitId === 'outfit_astronaut') {
      const evaMat = new THREE.MeshPhysicalMaterial({
        color: options.customColors?.outfitHex || '#e2e8f0',
        roughness: 0.38,
        metalness: 0.25,
        clearcoat: 0.5,
      });
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.76 * torsoRadiusScale, 0.86, 0.64), evaMat);
      vest.position.set(0, 1.4, 0);
      vest.castShadow = true;
      outfitGroup.add(vest);

      // Front Telemetry Console + Oxygen Thruster Pack
      const chestBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.08), darkOutlineMat);
      chestBox.position.set(0, 1.52, 0.34);
      outfitGroup.add(chestBox);

      const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.03), accentGlowMat);
      led.position.set(0, 1.54, 0.385);
      outfitGroup.add(led);

      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), evaMat);
      pack.position.set(0, 1.48, -0.38);
      pack.castShadow = true;
      outfitGroup.add(pack);
    }

    bodyPivot.add(outfitGroup);
  }

  // Character-Specific Tail (Fox fluffy curved tail / Penguin short tail)
  let tailGroup: THREE.Group | undefined;
  if (isFox) {
    tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.04, -0.28);
    const tailBase = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.68, 12), furMat);
    tailBase.position.set(0, 0.18, -0.26);
    tailBase.rotation.x = -0.95;
    tailBase.castShadow = true;
    const tailTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: palette.accentHex, roughness: 0.8 })
    );
    tailTip.position.set(0, 0.42, -0.58);
    tailTip.rotation.x = -0.95;
    tailGroup.add(tailBase, tailTip);
    bodyPivot.add(tailGroup);
  } else if (isPenguin) {
    tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.96, -0.32);
    const pTail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 8), furMat);
    pTail.rotation.x = -1.2;
    tailGroup.add(pTail);
    bodyPivot.add(tailGroup);
  }

  // 3. Articulated 2-Joint Arms (with outfit sleeve styling & character hands)
  const buildArm = (side: -1 | 1) => {
    const shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(side * (isPenguin ? 0.44 : 0.4), 1.74, 0.0);

    const armMat = hasOutfit ? clothMat : furMat;
    const shoulderBall = new THREE.Mesh(
      new THREE.SphereGeometry(outfitId === 'outfit_cyber' ? 0.17 : 0.145, 12, 10),
      outfitId === 'outfit_cyber' ? clothTrimMat : armMat
    );
    shoulderBall.castShadow = true;
    shoulderGroup.add(shoulderBall);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(isPenguin ? 0.11 : 0.125, isPenguin ? 0.095 : 0.115, 0.34, 12),
      armMat
    );
    upperArm.position.set(side * 0.03, -0.17, 0);
    upperArm.rotation.z = side * 0.08;
    upperArm.castShadow = true;
    shoulderGroup.add(upperArm);

    const elbowGroup = new THREE.Group();
    elbowGroup.position.set(side * 0.05, -0.34, 0);
    shoulderGroup.add(elbowGroup);

    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), armMat);
    elbowGroup.add(elbowBall);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, isPenguin ? 0.06 : 0.13, 0.32, 12),
      isPenguin ? furMat : armMat
    );
    forearm.position.y = -0.16;
    forearm.castShadow = true;
    elbowGroup.add(forearm);

    if (!hasOutfit) {
      addFurRuff(elbowGroup, -0.31, 0.12, 6, 0.12);
    }

    // Hand / Flipper / Claw
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.36, 0.02);
    elbowGroup.add(handGroup);

    if (isPenguin) {
      const flipperTip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), furMat);
      flipperTip.scale.set(0.6, 1.5, 0.9);
      handGroup.add(flipperTip);
    } else {
      const palm = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 10),
        isMecha || isFox ? darkOutlineMat : skinMat
      );
      palm.scale.set(0.9, 1.05, 1.15);
      palm.castShadow = true;
      handGroup.add(palm);

      [-0.04, 0, 0.04].forEach((fz, idx) => {
        const finger = new THREE.Mesh(
          new THREE.SphereGeometry(0.034, 8, 8),
          isMecha || isFox ? darkOutlineMat : skinMat
        );
        finger.scale.set(0.85, 1.4, 0.85);
        finger.position.set(fz, -0.09 - (idx === 1 ? 0.015 : 0), 0.03);
        handGroup.add(finger);
      });
    }

    return { shoulderGroup, elbowGroup };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  bodyPivot.add(leftArm.shoulderGroup, rightArm.shoulderGroup);

  // 4. Expressive Character-Specific Head (y = 2.23)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.23, 0.02);
  bodyPivot.add(headGroup);

  let ribbonGroup: THREE.Group | undefined;

  const scleraMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.06, clearcoat: 1.0 });
  const irisMat = new THREE.MeshStandardMaterial({ color: palette.accentHex, roughness: 0.25 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#090d16' });
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  if (characterId === 'frost_fox') {
    // Sleek Arctic Fox Head + Pointed Ears + Muzzle + Nose
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), furMat);
    skull.scale.set(1.04, 0.94, 0.98);
    skull.castShadow = true;
    headGroup.add(skull);

    // Sculpted Fox Muzzle & Dark Nose Tip
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 12), bellyMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.06, 0.31);
    headGroup.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), darkOutlineMat);
    nose.position.set(0, -0.04, 0.45);
    headGroup.add(nose);

    // Tall Pointed Fox Ears with Inner Trim
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.34, 6), furMat);
      ear.position.set(side * 0.2, 0.34, -0.02);
      ear.rotation.z = side * -0.22;
      ear.castShadow = true;
      headGroup.add(ear);

      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.22, 5), skinMat);
      inner.position.set(side * 0.2, 0.32, 0.045);
      inner.rotation.z = side * -0.22;
      headGroup.add(inner);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), irisMat);
      eye.scale.set(1.1, 0.85, 0.6);
      eye.position.set(side * 0.11, 0.05, 0.295);
      headGroup.add(eye);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), pupilMat);
      pupil.position.set(side * 0.11, 0.05, 0.325);
      headGroup.add(pupil);
    });
  } else if (characterId === 'cryo_penguin') {
    // Sleek Penguin Head + White Cheek Mask + Sculpted Beak + Crown Crest
    const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), furMat);
    pHead.scale.set(1.0, 1.0, 0.95);
    pHead.castShadow = true;
    headGroup.add(pHead);

    const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 14), bellyMat);
    facePatch.scale.set(1.0, 0.9, 0.55);
    facePatch.position.set(0, -0.03, 0.2);
    headGroup.add(facePatch);

    const beakMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.35 });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 6), beakMat);
    beak.rotation.x = Math.PI / 2 + 0.12;
    beak.position.set(0, -0.06, 0.36);
    headGroup.add(beak);

    [-0.1, 0.1].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), pupilMat);
      eye.position.set(ex, 0.06, 0.32);
      headGroup.add(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), glintMat);
      glint.position.set(ex + 0.014, 0.075, 0.355);
      headGroup.add(glint);
    });
  } else if (characterId === 'mecha_bot') {
    // Armored Robotics Helmet + Expressive Glowing LED Visor + Comms Antennae
    const chassisHead = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.54), furMat);
    chassisHead.castShadow = true;
    headGroup.add(chassisHead);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.06), darkOutlineMat);
    screen.position.set(0, 0.02, 0.26);
    headGroup.add(screen);

    [-0.11, 0.11].forEach((ex) => {
      const ledEye = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.04), accentGlowMat);
      ledEye.position.set(ex, 0.03, 0.285);
      headGroup.add(ledEye);
    });

    [-0.22, 0.22].forEach((ax) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.24, 6), skinMat);
      mast.position.set(ax, 0.34, -0.04);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), accentGlowMat);
      tip.position.set(ax, 0.46, -0.04);
      headGroup.add(mast, tip);
    });
  } else if (characterId === 'glacier_ronin') {
    // Hooded Arctic Shinobi Cowl + Face Mask + Glowing Cyber Slit Eyes + Headband Ribbons
    const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), furMat);
    cowl.scale.set(0.98, 1.05, 0.96);
    cowl.castShadow = true;
    headGroup.add(cowl);

    const visorBand = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.14), darkOutlineMat);
    visorBand.position.set(0, 0.04, 0.26);
    headGroup.add(visorBand);

    [-0.1, 0.1].forEach((ex, idx) => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.038, 0.04), accentGlowMat);
      eye.position.set(ex, 0.04, 0.325);
      eye.rotation.z = idx === 0 ? -0.14 : 0.14;
      headGroup.add(eye);
    });

    const headband = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.038, 8, 24), accentGlowMat);
    headband.rotation.x = Math.PI / 2;
    headband.position.set(0, 0.15, 0);
    headGroup.add(headband);

    ribbonGroup = new THREE.Group();
    ribbonGroup.position.set(0, 0.14, -0.32);
    [-0.08, 0.08].forEach((rx, idx) => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.02), accentGlowMat);
      rib.position.set(rx, -0.14, -0.1);
      rib.rotation.x = 0.45 + idx * 0.12;
      rib.rotation.z = rx * 1.4;
      ribbonGroup!.add(rib);
    });
    headGroup.add(ribbonGroup);
  } else {
    // Default Iconic Lofi Yeti Head & Shaggy Fur Hood
    const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 18), furMat);
    hoodBack.scale.set(1.04, 1.06, 0.96);
    hoodBack.castShadow = true;
    headGroup.add(hoodBack);

    [-1, 1].forEach((side) => {
      const cheekUpper = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 7), furMat);
      cheekUpper.position.set(side * 0.34, 0.02, 0.08);
      cheekUpper.rotation.z = side * -1.15;
      headGroup.add(cheekUpper);

      const cheekLower = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.19, 7), furMat);
      cheekLower.position.set(side * 0.31, -0.14, 0.1);
      cheekLower.rotation.z = side * -1.4;
      headGroup.add(cheekLower);
    });

    const crownTuft = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 7), furMat);
    crownTuft.position.set(0, 0.38, 0.02);
    crownTuft.rotation.x = -0.12;
    headGroup.add(crownTuft);

    const faceSphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), skinMat);
    faceSphere.scale.set(0.95, 1.02, 0.65);
    faceSphere.position.set(0, -0.01, 0.21);
    faceSphere.castShadow = true;
    headGroup.add(faceSphere);

    [-0.095, 0.095].forEach((ex, idx) => {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.064, 14, 12), scleraMat);
      sclera.scale.set(1.05, 1.02, 0.55);
      sclera.position.set(ex, 0.055, 0.355);
      headGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), irisMat);
      iris.scale.set(1, 1, 0.5);
      iris.position.set(ex, 0.055, 0.378);
      headGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), pupilMat);
      pupil.position.set(ex, 0.055, 0.388);
      headGroup.add(pupil);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), glintMat);
      glint.position.set(ex + 0.014, 0.072, 0.405);
      headGroup.add(glint);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.025), darkOutlineMat);
      brow.position.set(ex, 0.145, 0.365);
      brow.rotation.z = idx === 0 ? 0.12 : -0.12;
      headGroup.add(brow);
    });

    const smileArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.02, 8, 16, Math.PI * 0.8),
      darkOutlineMat
    );
    smileArc.rotation.z = Math.PI + Math.PI * 0.1;
    smileArc.scale.set(1.25, 0.65, 0.7);
    smileArc.position.set(0, -0.075, 0.375);
    headGroup.add(smileArc);
  }

  // 5. Wearable 3D Hats (on headGroup) & Scarves (around neck)
  if (options.hatId === 'hat_goggles') {
    const strapMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.365, 0.036, 8, 28), strapMat);
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, 0.21, -0.01);
    headGroup.add(strap);

    const frameMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.55,
      roughness: 0.28,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.35,
      roughness: 0.05,
      metalness: 0.25,
      clearcoat: 1.0,
    });
    [-0.11, 0.11].forEach((gx) => {
      const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.07, 14), frameMat);
      frame.rotation.x = Math.PI / 2;
      frame.position.set(gx, 0.22, 0.325);
      headGroup.add(frame);

      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.08, 14), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(gx, 0.22, 0.33);
      headGroup.add(lens);
    });
  } else if (options.hatId === 'hat_beanie') {
    const knitColor = getCosmeticHex('hat_beanie', '#f43f5e');
    const knitMat = new THREE.MeshStandardMaterial({ color: knitColor, roughness: 0.88 });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.355, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      knitMat
    );
    dome.position.set(0, 0.14, -0.01);
    dome.rotation.x = -0.18;
    headGroup.add(dome);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 10, 24), knitMat);
    cuff.rotation.x = Math.PI / 2 - 0.18;
    cuff.position.set(0, 0.18, -0.02);
    headGroup.add(cuff);

    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.95 })
    );
    pom.position.set(0, 0.52, -0.08);
    headGroup.add(pom);
  } else if (options.hatId === 'hat_ushanka') {
    const ushMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.82 });
    const furTrimMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.95 });
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.365, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      ushMat
    );
    cap.position.set(0, 0.15, -0.02);
    headGroup.add(cap);

    const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.12), furTrimMat);
    frontFlap.position.set(0, 0.24, 0.31);
    headGroup.add(frontFlap);

    [-0.36, 0.36].forEach((ex) => {
      const earFlap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.22), ushMat);
      earFlap.position.set(ex, 0.02, 0.0);
      earFlap.rotation.z = ex > 0 ? -0.12 : 0.12;
      headGroup.add(earFlap);
    });
  } else if (options.hatId === 'hat_visor') {
    const cyberFrame = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.032, 8, 24), darkOutlineMat);
    cyberFrame.rotation.x = Math.PI / 2;
    cyberFrame.position.set(0, 0.06, 0);
    headGroup.add(cyberFrame);

    const visorGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.14, 18, 1, true, -Math.PI * 0.36, Math.PI * 0.72),
      new THREE.MeshPhysicalMaterial({
        color: '#22d3ee',
        emissive: '#06b6d4',
        emissiveIntensity: 0.65,
        roughness: 0.08,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
      })
    );
    visorGlass.position.set(0, 0.06, 0.04);
    headGroup.add(visorGlass);
  } else if (options.hatId === 'hat_crown') {
    const crownMat = new THREE.MeshPhysicalMaterial({
      color: '#a5f3fc',
      emissive: '#06b6d4',
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.25,
      clearcoat: 1.0,
    });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.23, 0.09, 14), crownMat);
    band.position.set(0, 0.34, 0.01);
    headGroup.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.19, 5), crownMat);
      spike.position.set(Math.cos(a) * 0.22, 0.46, Math.sin(a) * 0.22 + 0.01);
      headGroup.add(spike);
    }
  }

  // Flowing Scarf Collar + Animated Tail
  const scarfHex = getCosmeticHex(options.scarfId, '#0EA5E9');
  const scarfMat = new THREE.MeshStandardMaterial({
    color: scarfHex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.075, 10, 24), scarfMat);
  scarfCollar.rotation.x = Math.PI / 2;
  scarfCollar.position.set(0, 1.9, 0.01);
  scarfCollar.castShadow = true;
  bodyPivot.add(scarfCollar);

  const scarfTailGeo = new THREE.BoxGeometry(0.14, 0.44, 0.055);
  scarfTailGeo.translate(0, -0.2, 0);
  const scarfTail = new THREE.Mesh(scarfTailGeo, scarfMat);
  scarfTail.position.set(0.18, 1.88, -0.26);
  scarfTail.rotation.x = 0.38;
  scarfTail.rotation.z = -0.18;
  scarfTail.castShadow = true;
  bodyPivot.add(scarfTail);

  // 6. Power-up Shield Bubble & Boost Ring
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.32, 1),
    new THREE.MeshPhysicalMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      depthWrite: false,
    })
  );
  shieldMesh.position.y = 1.3;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  const boostRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.84, 0.055, 8, 28),
    new THREE.MeshBasicMaterial({ color: palette.accentHex })
  );
  boostRing.rotation.x = Math.PI / 2;
  boostRing.position.y = 0.08;
  boostRing.visible = false;
  root.add(boostRing);

  let weaponGroup: THREE.Group | undefined;
  if (options.weapon) {
    weaponGroup = new THREE.Group();
    weaponGroup.position.set(0.52, 1.18, 0.18);
    weaponGroup.rotation.z = options.weapon === 'sword' ? -0.22 : -0.55;
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.38, 8),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.7 })
    );
    grip.position.y = -0.2;
    const blade = new THREE.Mesh(
      options.weapon === 'sword'
        ? new THREE.BoxGeometry(0.11, 0.9, 0.055)
        : new THREE.CylinderGeometry(0.1, 0.14, 0.62, 10),
      new THREE.MeshStandardMaterial({
        color: options.weapon === 'sword' ? '#e0f2fe' : '#38bdf8',
        emissive: options.weapon === 'sword' ? '#7dd3fc' : '#0369a1',
        emissiveIntensity: 0.45,
        metalness: 0.65,
        roughness: 0.2,
      })
    );
    blade.position.y = options.weapon === 'sword' ? 0.35 : 0.18;
    if (options.weapon === 'blaster') blade.rotation.z = Math.PI / 2;
    weaponGroup.add(grip, blade);
    root.add(weaponGroup);
  }

  return {
    root,
    bodyPivot,
    headGroup,
    leftArmGroup: leftArm.shoulderGroup,
    rightArmGroup: rightArm.shoulderGroup,
    leftElbowGroup: leftArm.elbowGroup,
    rightElbowGroup: rightArm.elbowGroup,
    leftHipGroup: leftLeg.hipGroup,
    rightHipGroup: rightLeg.hipGroup,
    leftKneeGroup: leftLeg.kneeGroup,
    rightKneeGroup: rightLeg.kneeGroup,
    leftFootGroup: leftLeg.footGroup,
    rightFootGroup: rightLeg.footGroup,
    scarfTail,
    tailGroup,
    ribbonGroup,
    weaponGroup,
    shieldMesh,
    boostRing,
    throwAnim: 0,
    walkPhase: Math.random() * Math.PI * 2,
    moveBlend: 0,
    emoteBlend: 0,
    emoteTime: 0,
  };
}

export const buildCharacterRig = buildYetiRig;

/**
 * Animates a realistic bipedal humanoid walk/run/idle cycle with hip swing,
 * knee flexion, foot leveling, counter-swinging arms + bent elbows, torso
 * stride bob/twist, throw follow-through, flowing scarf/tail/ribbon flutter,
 * and blended skeletal 'wave' / 'dance' social emotes.
 */
export function animateYetiWalk(
  rig: YetiRigParts,
  opts: {
    speed: number;
    dt: number;
    elapsedTime: number;
    dashing?: boolean;
    throwPulse?: number;
    lateralTurn?: number;
    emote?: YetiEmoteKind;
  }
): void {
  const {
    speed,
    dt,
    elapsedTime,
    dashing = false,
    throwPulse = 0,
    lateralTurn = 0,
    emote = 'none',
  } = opts;

  const targetBlend = speed > 10 ? THREE.MathUtils.clamp(speed / 150, 0.25, dashing ? 1.35 : 1.1) : 0;
  rig.moveBlend = THREE.MathUtils.damp(rig.moveBlend, targetBlend, 11, dt);

  if (rig.moveBlend > 0.02) {
    const freq = 5.4 + rig.moveBlend * 5.2;
    rig.walkPhase += dt * freq;
  }

  const emoteActive = emote !== 'none' && !dashing && throwPulse <= 0;
  rig.emoteBlend = THREE.MathUtils.damp(rig.emoteBlend, emoteActive ? 1 : 0, emoteActive ? 11 : 9, dt);
  if (emoteActive) {
    rig.emoteTime += dt;
  } else if (rig.emoteBlend < 0.02) {
    rig.emoteTime = 0;
  }

  const m = rig.moveBlend;
  const lp = rig.walkPhase;
  const rp = rig.walkPhase + Math.PI;
  const eb = rig.emoteBlend;
  const et = rig.emoteTime;

  const hipSwing = 0.56 * m;
  let lHipX = Math.sin(lp) * hipSwing;
  let rHipX = Math.sin(rp) * hipSwing;
  let lKneeX = Math.max(0, Math.cos(lp)) * 0.82 * m;
  let rKneeX = Math.max(0, Math.cos(rp)) * 0.82 * m;

  const armSwing = 0.52 * m;
  const idleSway = Math.sin(elapsedTime * 2.1) * 0.04 * (1 - Math.min(1, m));
  let lArmX = -Math.sin(lp) * armSwing + idleSway;
  let lArmZ = -0.07 - 0.04 * m;
  let lElbowX = -0.18 - Math.max(0, -Math.sin(lp)) * 0.35 * m;
  let lElbowZ = 0;

  let rArmX = throwPulse > 0 ? -1.65 : -Math.sin(rp) * armSwing - idleSway;
  let rArmZ = throwPulse > 0 ? 0.14 : 0.07 + 0.04 * m;
  let rElbowX = throwPulse > 0 ? -0.3 : -0.18 - Math.max(0, -Math.sin(rp)) * 0.35 * m;
  let rElbowZ = 0;

  const walkBob = 0.055 * Math.abs(Math.sin(lp)) * m;
  const idleBreath = Math.sin(elapsedTime * 2.6) * 0.022 * (1 - Math.min(1, m));
  let bodyY = walkBob + idleBreath;
  let bodyRotY = Math.sin(lp) * 0.075 * m;
  let bodyRotX = dashing ? 0.24 : 0.07 * m;
  let bodyRotZ = THREE.MathUtils.clamp(Math.cos(lp) * 0.03 * m + lateralTurn, -0.16, 0.16);

  let headRotY = -bodyRotY * 0.65;
  let headRotX = dashing ? -0.14 : -0.03 * m;
  let headRotZ = 0;

  let scarfX = 0.34 + 0.38 * m + Math.sin(elapsedTime * 10) * 0.12;
  let scarfZ = -0.18;

  if (eb > 0.005) {
    if (emote === 'wave') {
      const waveOsc = Math.sin(et * 11.5);
      const sway = Math.sin(et * 5.75);

      rArmX = THREE.MathUtils.lerp(rArmX, -0.38, eb);
      rArmZ = THREE.MathUtils.lerp(rArmZ, 2.42 + waveOsc * 0.26, eb);
      rElbowX = THREE.MathUtils.lerp(rElbowX, -0.34, eb);
      rElbowZ = THREE.MathUtils.lerp(rElbowZ, -0.22 + waveOsc * 0.38, eb);

      lArmX = THREE.MathUtils.lerp(lArmX, -0.16, eb);
      lArmZ = THREE.MathUtils.lerp(lArmZ, -0.26, eb);
      lElbowX = THREE.MathUtils.lerp(lElbowX, -0.45, eb);

      bodyY = THREE.MathUtils.lerp(bodyY, bodyY + Math.abs(sway) * 0.04, eb);
      bodyRotZ = THREE.MathUtils.lerp(bodyRotZ, -0.08 + sway * 0.05, eb);
      headRotZ = THREE.MathUtils.lerp(headRotZ, -0.14 + sway * 0.08, eb);
      headRotY = THREE.MathUtils.lerp(headRotY, sway * 0.16, eb);
      headRotX = THREE.MathUtils.lerp(headRotX, -0.08, eb);
      scarfZ = THREE.MathUtils.lerp(scarfZ, -0.18 + sway * 0.15, eb);
    } else if (emote === 'dance') {
      const beat = et * 9.6;
      const half = et * 4.8;
      const stillFactor = 1 - Math.min(0.75, m * 0.75);

      lHipX = THREE.MathUtils.lerp(lHipX, -0.24 + Math.sin(beat) * 0.3, eb * stillFactor);
      rHipX = THREE.MathUtils.lerp(rHipX, -0.24 - Math.sin(beat) * 0.3, eb * stillFactor);
      lKneeX = THREE.MathUtils.lerp(lKneeX, 0.42 - Math.sin(beat) * 0.34, eb * stillFactor);
      rKneeX = THREE.MathUtils.lerp(rKneeX, 0.42 + Math.sin(beat) * 0.34, eb * stillFactor);

      lArmZ = THREE.MathUtils.lerp(lArmZ, -1.72 - Math.sin(half) * 0.72, eb);
      lArmX = THREE.MathUtils.lerp(lArmX, -0.45 + Math.cos(beat) * 0.28, eb);
      lElbowX = THREE.MathUtils.lerp(lElbowX, -0.82 - Math.sin(beat) * 0.38, eb);
      lElbowZ = THREE.MathUtils.lerp(lElbowZ, -0.18 * Math.cos(half), eb);

      rArmZ = THREE.MathUtils.lerp(rArmZ, 1.72 - Math.sin(half) * 0.72, eb);
      rArmX = THREE.MathUtils.lerp(rArmX, -0.45 - Math.cos(beat) * 0.28, eb);
      rElbowX = THREE.MathUtils.lerp(rElbowX, -0.82 + Math.sin(beat) * 0.38, eb);
      rElbowZ = THREE.MathUtils.lerp(rElbowZ, 0.18 * Math.cos(half), eb);

      bodyY = THREE.MathUtils.lerp(bodyY, Math.abs(Math.sin(beat)) * 0.12 - 0.03, eb);
      bodyRotY = THREE.MathUtils.lerp(bodyRotY, Math.sin(half) * 0.36, eb);
      bodyRotZ = THREE.MathUtils.lerp(bodyRotZ, Math.sin(half) * 0.17, eb);
      bodyRotX = THREE.MathUtils.lerp(bodyRotX, Math.cos(beat) * 0.09, eb);

      headRotX = THREE.MathUtils.lerp(headRotX, Math.sin(beat * 2) * 0.14, eb);
      headRotZ = THREE.MathUtils.lerp(headRotZ, -Math.sin(half) * 0.16, eb);
      headRotY = THREE.MathUtils.lerp(headRotY, -Math.sin(half) * 0.2, eb);

      scarfX = THREE.MathUtils.lerp(scarfX, 0.56 + Math.abs(Math.sin(beat)) * 0.36, eb);
      scarfZ = THREE.MathUtils.lerp(scarfZ, -0.18 + Math.sin(half) * 0.32, eb);
    }
  }

  rig.leftHipGroup.rotation.x = lHipX;
  rig.rightHipGroup.rotation.x = rHipX;
  rig.leftKneeGroup.rotation.x = lKneeX;
  rig.rightKneeGroup.rotation.x = rKneeX;
  rig.leftFootGroup.rotation.x = -lHipX * 0.35 - lKneeX * 0.45;
  rig.rightFootGroup.rotation.x = -rHipX * 0.35 - rKneeX * 0.45;

  rig.leftArmGroup.rotation.x = lArmX;
  rig.leftArmGroup.rotation.z = lArmZ;
  rig.leftElbowGroup.rotation.x = lElbowX;
  rig.leftElbowGroup.rotation.z = lElbowZ;

  rig.rightArmGroup.rotation.x = rArmX;
  rig.rightArmGroup.rotation.z = rArmZ;
  rig.rightElbowGroup.rotation.x = rElbowX;
  rig.rightElbowGroup.rotation.z = rElbowZ;

  rig.bodyPivot.position.y = bodyY;
  rig.bodyPivot.rotation.y = bodyRotY;
  rig.bodyPivot.rotation.x = bodyRotX;
  rig.bodyPivot.rotation.z = bodyRotZ;

  rig.headGroup.rotation.y = headRotY;
  rig.headGroup.rotation.x = headRotX;
  rig.headGroup.rotation.z = headRotZ;

  if (rig.scarfTail) {
    rig.scarfTail.rotation.x = scarfX;
    rig.scarfTail.rotation.z = scarfZ;
  }
  if (rig.tailGroup) {
    rig.tailGroup.rotation.y = Math.sin(elapsedTime * (4.5 + m * 6)) * (0.22 + m * 0.16);
    rig.tailGroup.rotation.x = Math.cos(elapsedTime * 3.5) * 0.08 - m * 0.14;
  }
  if (rig.ribbonGroup) {
    rig.ribbonGroup.rotation.x = 0.25 + m * 0.45 + Math.sin(elapsedTime * 11) * 0.14;
    rig.ribbonGroup.rotation.z = Math.cos(elapsedTime * 7) * 0.16;
  }
}
