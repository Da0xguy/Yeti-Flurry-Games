import * as THREE from 'three';
import { COSMETICS_CATALOG } from '../data/moveContracts';
import { getYetiColorway } from '../data/gameCatalog';
import type { YetiColorId, YetiEmoteKind } from '../types';

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
 * Generates procedural shaggy fur bump + roughness maps so the 3D Lofi coat
 * reads as soft layered fur under directional studio and arena lighting.
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
 * Builds a full 3D, multi-jointed Lofi the Yeti character (`THREE.Group`)
 * modeled after Lofi's tall shaggy silhouette (long articulated legs with 5-toed
 * blue feet, athletic furry torso, shaggy neck collar & hood framing his expressive
 * face, and 2-joint swinging arms with hands), grounded cleanly at y = 0.
 */
export function buildYetiRig(options: {
  colorwayId?: YetiColorId;
  hatId: string;
  scarfId: string;
  isPlayer: boolean;
  scale?: number;
}): YetiRigParts {
  const palette = getYetiColorway(options.colorwayId);
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

  // Subtle base ring indicating player vs rival colorway
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

  // PBR Materials (varied roughness & sheen across fur coat, skin, eyes, and cosmetics)
  const furMat = new THREE.MeshPhysicalMaterial({
    color: palette.furHex,
    roughness: 0.92,
    metalness: 0.0,
    bumpMap,
    bumpScale: 0.048,
    roughnessMap,
    sheen: 0.72,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(palette.accentHex).lerp(new THREE.Color('#ffffff'), 0.65),
  });

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: palette.skinHex,
    roughness: 0.44,
    metalness: 0.04,
    clearcoat: 0.16,
    clearcoatRoughness: 0.5,
  });

  const darkOutlineMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.6,
  });

  // Helper for jagged shaggy fur cuffs (ankles, wrists, neck)
  const addFurRuff = (parent: THREE.Object3D, y: number, radius: number, count: number, coneH: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.065, coneH, 6), furMat);
      tuft.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      tuft.rotation.x = Math.PI - 0.35 * Math.sin(a);
      tuft.rotation.z = 0.35 * Math.cos(a);
      parent.add(tuft);
    }
  };

  // 1. Articulated Bipedal Legs (Hip -> Thigh -> Knee -> Shin -> Ankle -> 5-Toed Foot)
  // Hip sits at y = 0.96; Thigh = 0.44; Shin = 0.42; Foot sole height = 0.10 => grounded at y = 0
  const buildLeg = (side: -1 | 1) => {
    const hipGroup = new THREE.Group();
    hipGroup.position.set(side * 0.2, 0.96, 0);

    const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), furMat);
    hipJoint.castShadow = true;
    hipGroup.add(hipJoint);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.142, 0.44, 14), furMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    hipGroup.add(thigh);

    const kneeGroup = new THREE.Group();
    kneeGroup.position.set(0, -0.44, 0);
    hipGroup.add(kneeGroup);

    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.138, 12, 10), furMat);
    kneeBall.castShadow = true;
    kneeGroup.add(kneeBall);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.16, 0.42, 14), furMat);
    shin.position.y = -0.21;
    shin.castShadow = true;
    shin.receiveShadow = true;
    kneeGroup.add(shin);

    addFurRuff(kneeGroup, -0.4, 0.145, 7, 0.14);

    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.42, 0.02);
    kneeGroup.add(footGroup);

    // Ankle plug + sculpted 5-toed Lofi foot resting flush at y = -0.10 (world y = 0)
    const soleGeo = new THREE.SphereGeometry(0.155, 14, 10);
    soleGeo.scale(1.05, 0.56, 1.48);
    const sole = new THREE.Mesh(soleGeo, skinMat);
    sole.position.set(0, -0.02, 0.07);
    sole.castShadow = true;
    footGroup.add(sole);

    // 5 rounded Lofi toes
    const toeGeo = new THREE.SphereGeometry(0.042, 8, 8);
    [-0.11, -0.055, 0, 0.055, 0.11].forEach((tx, idx) => {
      const toe = new THREE.Mesh(toeGeo, skinMat);
      const zCurve = 0.25 - Math.abs(idx - 2) * 0.025;
      toe.position.set(tx, -0.055, zCurve);
      toe.scale.set(0.95, 0.85, 1.2);
      footGroup.add(toe);
    });

    return { hipGroup, kneeGroup, footGroup };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  bodyPivot.add(leftLeg.hipGroup, rightLeg.hipGroup);

  // 2. Tall Athletic Shaggy Lofi Torso (LatheGeometry from hips y=0.88 to shoulders y=1.84)
  const torsoProfile = [
    new THREE.Vector2(0.0, 0.86),
    new THREE.Vector2(0.32, 0.92),
    new THREE.Vector2(0.36, 1.15),
    new THREE.Vector2(0.35, 1.44),
    new THREE.Vector2(0.37, 1.68),
    new THREE.Vector2(0.31, 1.84),
    new THREE.Vector2(0.21, 1.93),
    new THREE.Vector2(0.0, 1.95),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 24);
  const torsoMesh = new THREE.Mesh(torsoGeo, furMat);
  torsoMesh.scale.set(1.06, 1.0, 0.86);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  // Shaggy chest & neck fur collar tufts
  addFurRuff(bodyPivot, 1.92, 0.24, 9, 0.18);

  // 3. Articulated 2-Joint Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand)
  const buildArm = (side: -1 | 1) => {
    const shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(side * 0.41, 1.76, 0.0);

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), furMat);
    shoulderBall.castShadow = true;
    shoulderGroup.add(shoulderBall);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.34, 12), furMat);
    upperArm.position.set(side * 0.03, -0.17, 0);
    upperArm.rotation.z = side * 0.08;
    upperArm.castShadow = true;
    shoulderGroup.add(upperArm);

    const elbowGroup = new THREE.Group();
    elbowGroup.position.set(side * 0.05, -0.34, 0);
    shoulderGroup.add(elbowGroup);

    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), furMat);
    elbowGroup.add(elbowBall);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.32, 12), furMat);
    forearm.position.y = -0.16;
    forearm.castShadow = true;
    elbowGroup.add(forearm);

    addFurRuff(elbowGroup, -0.31, 0.12, 6, 0.12);

    // Sculpted cartoon Lofi hand peeking out of sleeve cuff
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.38, 0.02);
    elbowGroup.add(handGroup);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skinMat);
    palm.scale.set(0.9, 1.05, 1.15);
    palm.castShadow = true;
    handGroup.add(palm);

    [-0.045, 0, 0.045].forEach((fz, idx) => {
      const finger = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), skinMat);
      finger.scale.set(0.85, 1.45, 0.85);
      finger.position.set(fz, -0.095 - (idx === 1 ? 0.015 : 0), 0.03);
      handGroup.add(finger);
    });

    return { shoulderGroup, elbowGroup };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  bodyPivot.add(leftArm.shoulderGroup, rightArm.shoulderGroup);

  // 4. Expressive Lofi Head & Shaggy Fur Hood (y = 2.24, total height ~2.62)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.23, 0.02);
  bodyPivot.add(headGroup);

  // Outer shaggy fur hood
  const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 18), furMat);
  hoodBack.scale.set(1.04, 1.06, 0.96);
  hoodBack.castShadow = true;
  headGroup.add(hoodBack);

  // Side cheek ruffs framing the face opening
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

  // Crown fur tufts
  const crownTuft = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 7), furMat);
  crownTuft.position.set(0, 0.38, 0.02);
  crownTuft.rotation.x = -0.12;
  headGroup.add(crownTuft);

  // Sculpted Blue Lofi Face inside hood opening
  const faceSphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), skinMat);
  faceSphere.scale.set(0.95, 1.02, 0.65);
  faceSphere.position.set(0, -0.01, 0.21);
  faceSphere.castShadow = true;
  headGroup.add(faceSphere);

  // Glossy 3D Eyes + Iris + Catchlight + Chilled Eyebrows
  const scleraMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.06,
    clearcoat: 1.0,
  });
  const irisMat = new THREE.MeshStandardMaterial({
    color: palette.accentHex,
    roughness: 0.25,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#090d16' });
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

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

  // Relaxed Lofi Smile Arc
  const smileArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.02, 8, 16, Math.PI * 0.8),
    darkOutlineMat
  );
  smileArc.rotation.z = Math.PI + Math.PI * 0.1;
  smileArc.scale.set(1.25, 0.65, 0.7);
  smileArc.position.set(0, -0.075, 0.375);
  headGroup.add(smileArc);

  // 5. Wearable 3D Cosmetics (Hats on headGroup & Scarf around neck)
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
    shieldMesh,
    boostRing,
    throwAnim: 0,
    walkPhase: Math.random() * Math.PI * 2,
    moveBlend: 0,
    emoteBlend: 0,
    emoteTime: 0,
  };
}

/**
 * Animates a realistic bipedal humanoid walk/run/idle cycle with hip swing,
 * knee flexion, foot leveling, counter-swinging arms + bent elbows, torso
 * stride bob/twist, throw follow-through, flowing scarf flutter, and blended
 * skeletal 'wave' / 'dance' social emotes.
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

  // Base locomotion / idle targets
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

  // Blend in skeletal emote poses ('wave' | 'dance')
  if (eb > 0.005) {
    if (emote === 'wave') {
      const waveOsc = Math.sin(et * 11.5);
      const sway = Math.sin(et * 5.75);

      // Right arm raised high & waving cheerfully
      rArmX = THREE.MathUtils.lerp(rArmX, -0.38, eb);
      rArmZ = THREE.MathUtils.lerp(rArmZ, 2.42 + waveOsc * 0.26, eb);
      rElbowX = THREE.MathUtils.lerp(rElbowX, -0.34, eb);
      rElbowZ = THREE.MathUtils.lerp(rElbowZ, -0.22 + waveOsc * 0.38, eb);

      // Left arm playful hip balance
      lArmX = THREE.MathUtils.lerp(lArmX, -0.16, eb);
      lArmZ = THREE.MathUtils.lerp(lArmZ, -0.26, eb);
      lElbowX = THREE.MathUtils.lerp(lElbowX, -0.45, eb);

      // Friendly head tilt & chest bounce (keeps legs walking if moving!)
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

      // Alternating knee-bounce groove on legs (blends smoothly even if walking)
      lHipX = THREE.MathUtils.lerp(lHipX, -0.24 + Math.sin(beat) * 0.3, eb * stillFactor);
      rHipX = THREE.MathUtils.lerp(rHipX, -0.24 - Math.sin(beat) * 0.3, eb * stillFactor);
      lKneeX = THREE.MathUtils.lerp(lKneeX, 0.42 - Math.sin(beat) * 0.34, eb * stillFactor);
      rKneeX = THREE.MathUtils.lerp(rKneeX, 0.42 + Math.sin(beat) * 0.34, eb * stillFactor);

      // Alternating high Frost Groove arm pumps
      lArmZ = THREE.MathUtils.lerp(lArmZ, -1.72 - Math.sin(half) * 0.72, eb);
      lArmX = THREE.MathUtils.lerp(lArmX, -0.45 + Math.cos(beat) * 0.28, eb);
      lElbowX = THREE.MathUtils.lerp(lElbowX, -0.82 - Math.sin(beat) * 0.38, eb);
      lElbowZ = THREE.MathUtils.lerp(lElbowZ, -0.18 * Math.cos(half), eb);

      rArmZ = THREE.MathUtils.lerp(rArmZ, 1.72 - Math.sin(half) * 0.72, eb);
      rArmX = THREE.MathUtils.lerp(rArmX, -0.45 - Math.cos(beat) * 0.28, eb);
      rElbowX = THREE.MathUtils.lerp(rElbowX, -0.82 + Math.sin(beat) * 0.38, eb);
      rElbowZ = THREE.MathUtils.lerp(rElbowZ, 0.18 * Math.cos(half), eb);

      // Full-body rhythmic bounce, hip sway & twist
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
}
