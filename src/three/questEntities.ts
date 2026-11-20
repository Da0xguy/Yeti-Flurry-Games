import * as THREE from 'three';
import { buildHealthBar3D, type HealthBar3D } from './kartAndShooter';

export type QuestMonsterKind = 'stalker' | 'brute' | 'wraith' | 'boss';

export interface QuestMonsterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  coreMesh: THREE.Mesh;
  auraRing: THREE.Mesh;
  orbitGroup?: THREE.Group;
  hpBar: HealthBar3D;
  kind: QuestMonsterKind;
}

let sharedMonsterShadowTex: THREE.CanvasTexture | null = null;
function getMonsterContactShadow(): THREE.CanvasTexture {
  if (sharedMonsterShadowTex) return sharedMonsterShadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.85)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedMonsterShadowTex = tex;
  return tex;
}

export function buildQuestMonsterMesh(
  kind: QuestMonsterKind,
  accentHex = '#38bdf8'
): QuestMonsterRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const scale =
    kind === 'boss' ? 2.35 : kind === 'brute' ? 1.72 : kind === 'wraith' ? 1.38 : 1.24;

  const armorHex =
    kind === 'boss'
      ? '#16133a'
      : kind === 'brute'
      ? '#1a2436'
      : kind === 'wraith'
      ? '#0f172a'
      : '#162544';

  const secondaryHex =
    kind === 'boss'
      ? '#312e81'
      : kind === 'brute'
      ? '#334155'
      : kind === 'wraith'
      ? '#1e1b4b'
      : '#1e3a5f';

  const glowHex =
    kind === 'boss'
      ? '#f59e0b'
      : kind === 'wraith'
      ? '#e879f9'
      : kind === 'brute'
      ? '#fb7185'
      : '#38bdf8';

  const armorMat = new THREE.MeshPhysicalMaterial({
    color: armorHex,
    roughness: kind === 'brute' ? 0.68 : 0.42,
    metalness: kind === 'boss' ? 0.62 : 0.38,
    clearcoat: kind === 'boss' ? 0.35 : 0.15,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: secondaryHex,
    roughness: 0.36,
    metalness: 0.52,
  });
  const boneMat = new THREE.MeshStandardMaterial({
    color: '#dbeafe',
    roughness: 0.34,
    metalness: 0.14,
  });
  const darkJointMat = new THREE.MeshStandardMaterial({
    color: '#070d18',
    roughness: 0.82,
    metalness: 0.12,
  });
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: glowHex,
    emissive: glowHex,
    emissiveIntensity: 0.88,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: glowHex });
  const trimMat = new THREE.MeshStandardMaterial({
    color: kind === 'boss' ? '#fbbf24' : accentHex,
    roughness: 0.25,
    metalness: 0.72,
  });

  const headGroup = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();

  // Ground contact shadow + pulsing threat ring
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45 * scale, 1.45 * scale),
    new THREE.MeshBasicMaterial({
      map: getMonsterContactShadow(),
      transparent: true,
      depthWrite: false,
      opacity: 0.82,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.46 * scale, 0.58 * scale, 32),
    new THREE.MeshBasicMaterial({
      color: glowHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: kind === 'boss' ? 0.72 : 0.42,
      depthWrite: false,
    })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.04;
  root.add(auraRing);

  let coreMesh: THREE.Mesh;
  let orbitGroup: THREE.Group | undefined;

  if (kind === 'wraith') {
    // Abyssal Frost Wraith: Sculpted tattered bell shroud + bone mask + orbiting ice runes
    const shroudProfile = [
      new THREE.Vector2(0.58, 0.16),
      new THREE.Vector2(0.46, 0.48),
      new THREE.Vector2(0.32, 0.92),
      new THREE.Vector2(0.38, 1.32),
      new THREE.Vector2(0.24, 1.56),
      new THREE.Vector2(0.0, 1.62),
    ];
    const robe = new THREE.Mesh(new THREE.LatheGeometry(shroudProfile, 14), armorMat);
    robe.castShadow = true;
    robe.receiveShadow = true;
    bodyPivot.add(robe);

    // Jagged ice hem shards around cloak base
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const hem = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 4), plateMat);
      hem.position.set(Math.cos(a) * 0.5, 0.16, Math.sin(a) * 0.5);
      hem.rotation.x = Math.PI;
      hem.rotation.z = Math.cos(a) * 0.18;
      bodyPivot.add(hem);
    }

    // Layered shoulder mantle & collar spikes
    const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.24, 10), plateMat);
    mantle.position.y = 1.42;
    mantle.castShadow = true;
    bodyPivot.add(mantle);

    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), crystalMat);
    coreMesh.scale.set(0.9, 1.35, 0.9);
    coreMesh.position.set(0, 1.18, 0.32);
    bodyPivot.add(coreMesh);

    // Deep hooded skull + bone mask
    headGroup.position.set(0, 1.72, 0.04);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), armorMat);
    hood.scale.set(0.96, 1.15, 1.08);
    hood.castShadow = true;
    const hoodCowl = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.48, 8), armorMat);
    hoodCowl.position.set(0, 0.18, -0.18);
    hoodCowl.rotation.x = -0.78;
    const mask = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), boneMat);
    mask.scale.set(0.82, 1.05, 0.72);
    mask.position.set(0, -0.02, 0.22);
    const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.1), darkJointMat);
    visorSlit.position.set(0, 0.04, 0.31);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), eyeGlowMat);
    eyeL.position.set(-0.075, 0.04, 0.35);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), eyeGlowMat);
    eyeR.position.set(0.075, 0.04, 0.35);
    headGroup.add(hood, hoodCowl, mask, visorSlit, eyeL, eyeR);
    bodyPivot.add(headGroup);

    // Orbiting Cryo Runes & Halo
    orbitGroup = new THREE.Group();
    orbitGroup.position.set(0, 1.56, -0.04);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 8, 28), trimMat);
    halo.rotation.x = 0.32;
    orbitGroup.add(halo);
    for (let s = 0; s < 4; s++) {
      const sa = (s / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), crystalMat);
      shard.scale.set(0.7, 1.5, 0.7);
      shard.position.set(Math.cos(sa) * 0.68, Math.sin(sa * 2) * 0.14, Math.sin(sa) * 0.68);
      orbitGroup.add(shard);
    }
    bodyPivot.add(orbitGroup);

    // Scythe-Claw Floating Arms
    const buildWraithArm = (side: -1 | 1, grp: THREE.Group) => {
      grp.position.set(side * 0.46, 1.38, 0.06);
      const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 6), plateMat);
      pauldron.rotation.z = side * -0.65;
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.48, 8), armorMat);
      forearm.position.set(side * 0.08, -0.22, 0.16);
      forearm.rotation.x = -0.65;
      const scythe = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 4), crystalMat);
      scythe.position.set(side * 0.1, -0.34, 0.45);
      scythe.rotation.x = Math.PI * 0.48;
      grp.add(pauldron, forearm, scythe);
    };
    buildWraithArm(-1, leftArm);
    buildWraithArm(1, rightArm);

    bodyPivot.add(leftArm, rightArm, leftLeg, rightLeg);
  } else {
    // Sculpted Bipedal Creature Silhouette (Stalker Predator / Brute Juggernaut / Dread Boss)
    const isBoss = kind === 'boss';
    const isBrute = kind === 'brute';

    // Articulated Armored Legs (Hip -> Thigh -> Knee Pad -> Greave -> Taloned Foot)
    const buildMonsterLeg = (side: -1 | 1, grp: THREE.Group) => {
      const hipX = side * (isBrute || isBoss ? 0.27 : 0.21);
      grp.position.set(hipX, 0.68, 0);

      const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), darkJointMat);
      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(isBrute ? 0.16 : 0.13, isBrute ? 0.14 : 0.11, 0.38, 10),
        armorMat
      );
      thigh.position.y = -0.18;
      thigh.castShadow = true;

      const kneeSpike = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 5), plateMat);
      kneeSpike.position.set(0, -0.36, 0.13);
      kneeSpike.rotation.x = Math.PI * 0.36;

      const greave = new THREE.Mesh(
        new THREE.CylinderGeometry(isBrute ? 0.15 : 0.12, isBrute ? 0.19 : 0.14, 0.34, 10),
        plateMat
      );
      greave.position.y = -0.5;
      greave.castShadow = true;

      const bootBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.36), darkJointMat);
      bootBase.position.set(0, -0.62, 0.08);
      bootBase.castShadow = true;

      const talonL = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), boneMat);
      talonL.rotation.x = Math.PI / 2;
      talonL.position.set(-0.07, -0.63, 0.28);
      const talonR = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), boneMat);
      talonR.rotation.x = Math.PI / 2;
      talonR.position.set(0.07, -0.63, 0.28);

      grp.add(hipJoint, thigh, kneeSpike, greave, bootBase, talonL, talonR);
    };
    buildMonsterLeg(-1, leftLeg);
    buildMonsterLeg(1, rightLeg);

    // Sculpted Tapered Armored Torso (LatheGeometry + Waist Belt + Rib Plates)
    const chestW = isBoss ? 1.15 : isBrute ? 1.12 : 0.88;
    const torsoProfile = [
      new THREE.Vector2(0.0, 0.62),
      new THREE.Vector2(0.24 * chestW, 0.66),
      new THREE.Vector2(0.22 * chestW, 0.84),
      new THREE.Vector2(0.39 * chestW, 1.16),
      new THREE.Vector2(0.44 * chestW, 1.42),
      new THREE.Vector2(0.32 * chestW, 1.56),
      new THREE.Vector2(0.0, 1.58),
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 12), armorMat);
    torso.scale.set(1.12, 1.0, 0.78);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyPivot.add(torso);

    // Armored Waist Belt & Buckle
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.31 * chestW, 0.32 * chestW, 0.14, 10), darkJointMat);
    belt.scale.set(1.08, 1, 0.82);
    belt.position.y = 0.72;
    const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), trimMat);
    buckle.position.set(0, 0.72, 0.28 * chestW);
    bodyPivot.add(belt, buckle);

    // Pectoral Armor Plates framing Glowing Furnace Core
    [-1, 1].forEach((side) => {
      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.26 * chestW, 0.28, 0.16), plateMat);
      pec.position.set(side * 0.2 * chestW, 1.24, 0.22 * chestW);
      pec.rotation.y = side * -0.25;
      pec.rotation.z = side * -0.14;
      pec.castShadow = true;
      bodyPivot.add(pec);
    });

    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(isBoss ? 0.2 : 0.16, 0), crystalMat);
    coreMesh.position.set(0, 1.2, 0.31 * chestW);
    bodyPivot.add(coreMesh);

    // Dorsal Frost Spines / Boss Crystal Wing-Blades
    if (isBoss) {
      for (const side of [-1, 1]) {
        for (let w = 0; w < 3; w++) {
          const pinion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.92 - w * 0.14, 0.05), crystalMat);
          pinion.position.set(side * (0.44 + w * 0.22), 1.48 - w * 0.16, -0.34 - w * 0.04);
          pinion.rotation.z = side * -(0.35 + w * 0.26);
          pinion.rotation.y = side * -0.28;
          pinion.castShadow = true;
          bodyPivot.add(pinion);
        }
      }
    } else {
      for (let b = 0; b < 3; b++) {
        const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.42, 4), crystalMat);
        dorsal.position.set(0, 1.38 - b * 0.22, -0.3);
        dorsal.rotation.x = -0.82;
        bodyPivot.add(dorsal);
      }
    }

    // Sculpted Armored Head / Helm + Glowing Eyes + Jaw + Swept Horns
    headGroup.position.set(0, 1.72, isBoss || isBrute ? 0.06 : 0.14);
    const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(isBoss ? 0.28 : 0.25, 0), armorMat);
    cranium.scale.set(0.95, 1.05, 1.12);
    cranium.castShadow = true;
    headGroup.add(cranium);

    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.36), plateMat);
    crest.position.set(0, 0.2, 0.02);
    headGroup.add(crest);

    // Glowing Visor Eyes + Brow Ridge
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.16), plateMat);
    brow.position.set(0, 0.09, 0.22);
    headGroup.add(brow);

    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.06), eyeGlowMat);
      eye.position.set(side * 0.095, 0.04, 0.25);
      eye.rotation.z = side * 0.24;
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeMat);
      glint.position.set(side * 0.095, 0.04, 0.28);
      headGroup.add(eye, glint);
    });

    // Armored Jaw & Fangs
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.24), plateMat);
    jaw.position.set(0, -0.14, 0.16);
    headGroup.add(jaw);
    [-0.08, 0.08].forEach((fx) => {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), boneMat);
      fang.position.set(fx, -0.06, 0.27);
      headGroup.add(fang);
    });

    // Swept Multi-Segment Horns (Boss gets dread crown horns)
    [-1, 1].forEach((side) => {
      const hornBase = new THREE.Mesh(
        new THREE.ConeGeometry(isBoss ? 0.08 : 0.065, isBoss ? 0.42 : 0.32, 6),
        isBoss ? trimMat : boneMat
      );
      hornBase.position.set(side * 0.22, 0.24, -0.02);
      hornBase.rotation.z = side * -0.55;
      hornBase.rotation.x = -0.22;
      headGroup.add(hornBase);

      if (isBoss) {
        const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 5), crystalMat);
        hornTip.position.set(side * 0.34, 0.44, 0.04);
        hornTip.rotation.z = side * 0.18;
        headGroup.add(hornTip);
      }
    });
    bodyPivot.add(headGroup);

    // Multi-Part Arms: Pauldron -> Upper Arm -> Gauntlet Forearm -> Claws + Boss/Brute Weapon
    const buildMonsterArm = (side: -1 | 1, grp: THREE.Group) => {
      grp.position.set(side * (0.48 * chestW + 0.08), 1.42, 0);

      // Layered Shoulder Pauldron + Spike
      const pauldron = new THREE.Mesh(
        new THREE.SphereGeometry(isBoss ? 0.25 : isBrute ? 0.22 : 0.17, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
        plateMat
      );
      pauldron.rotation.z = side * -0.45;
      pauldron.castShadow = true;
      grp.add(pauldron);

      const pSpike = new THREE.Mesh(new THREE.ConeGeometry(0.075, isBoss ? 0.38 : 0.26, 5), crystalMat);
      pSpike.position.set(side * 0.1, 0.22, 0);
      pSpike.rotation.z = side * -0.48;
      grp.add(pSpike);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.34, 8), darkJointMat);
      upperArm.position.y = -0.18;
      upperArm.castShadow = true;

      const gauntlet = new THREE.Mesh(
        new THREE.CylinderGeometry(isBrute || isBoss ? 0.145 : 0.115, isBrute || isBoss ? 0.12 : 0.095, 0.36, 8),
        armorMat
      );
      gauntlet.position.set(0, -0.44, 0.08);
      gauntlet.rotation.x = -0.35;
      gauntlet.castShadow = true;

      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.115, 0), plateMat);
      fist.position.set(0, -0.62, 0.16);
      grp.add(upperArm, gauntlet, fist);

      [-0.055, 0, 0.055].forEach((cx) => {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.2, 4), boneMat);
        claw.position.set(cx, -0.68, 0.24);
        claw.rotation.x = Math.PI * 0.72;
        grp.add(claw);
      });
    };
    buildMonsterArm(-1, leftArm);
    buildMonsterArm(1, rightArm);

    if (isBoss) {
      // Dread Frost Greataxe (Rune Haft + Twin Crescent Crystal Blades)
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 1.72, 10), trimMat);
      haft.rotation.x = Math.PI / 2;
      haft.position.set(0, -0.58, 0.56);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 8), darkJointMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, -0.58, 1.08);
      const axeBladeA = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.68, 0.42), crystalMat);
      axeBladeA.position.set(0, -0.58, 1.18);
      const axeEdge = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 4), boneMat);
      axeEdge.rotation.x = Math.PI / 2;
      axeEdge.scale.set(0.3, 1, 1.1);
      axeEdge.position.set(0, -0.58, 1.48);
      rightArm.add(haft, collar, axeBladeA, axeEdge);
    } else if (isBrute) {
      // Glacial Siege War-Maul
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 1.25, 8), trimMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, -0.58, 0.45);
      const maulBlock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.44), plateMat);
      maulBlock.position.set(0, -0.58, 0.94);
      const maulCore = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.2), crystalMat);
      maulCore.position.set(0, -0.58, 0.94);
      rightArm.add(handle, maulBlock, maulCore);
    }

    bodyPivot.add(leftLeg, rightLeg, leftArm, rightArm);
  }

  bodyPivot.scale.setScalar(scale);

  const hpBar = buildHealthBar3D(kind === 'boss' ? 2.45 : 1.35, 2.38 * scale);
  root.add(hpBar.group);

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    coreMesh,
    auraRing,
    orbitGroup,
    hpBar,
    kind,
  };
}

export function animateQuestMonster(
  rig: QuestMonsterRig,
  {
    speed,
    dt,
    elapsedTime,
    attacking,
  }: {
    speed: number;
    dt: number;
    elapsedTime: number;
    attacking?: boolean;
  }
): void {
  const moving = speed > 10;
  const stride = elapsedTime * (rig.kind === 'stalker' ? 13 : 9.2);
  rig.coreMesh.rotation.y += dt * 3.4;
  rig.auraRing.rotation.z += dt * 1.6;
  const pulse = 0.94 + Math.sin(elapsedTime * 5) * 0.07;
  rig.auraRing.scale.setScalar(pulse);

  if (rig.kind === 'wraith') {
    rig.bodyPivot.position.y = 0.22 + Math.sin(elapsedTime * 4.2) * 0.15;
    rig.leftArm.position.y = 1.38 + Math.sin(elapsedTime * 5) * 0.08;
    rig.rightArm.position.y = 1.38 + Math.cos(elapsedTime * 5) * 0.08;
    rig.leftArm.rotation.x = attacking ? -1.1 : Math.sin(elapsedTime * 3) * 0.18;
    rig.rightArm.rotation.x = attacking ? -1.1 : Math.cos(elapsedTime * 3) * 0.18;
    rig.headGroup.rotation.y = Math.sin(elapsedTime * 2.2) * 0.18;
    rig.bodyPivot.rotation.x = moving ? 0.14 : 0.04;
    if (rig.orbitGroup) {
      rig.orbitGroup.rotation.y += dt * 2.1;
      rig.orbitGroup.rotation.z = Math.sin(elapsedTime * 2) * 0.15;
    }
  } else {
    const legAmp = moving ? 0.68 : 0.04;
    rig.leftLeg.rotation.x = Math.sin(stride) * legAmp;
    rig.rightLeg.rotation.x = -Math.sin(stride) * legAmp;
    if (attacking) {
      const cleave = Math.sin(elapsedTime * 14) * 0.35;
      rig.leftArm.rotation.x = -1.35 + cleave;
      rig.rightArm.rotation.x = -1.45 - cleave;
      rig.bodyPivot.rotation.y = Math.sin(elapsedTime * 14) * 0.18;
    } else {
      rig.leftArm.rotation.x = -0.32 - Math.sin(stride) * legAmp * 0.72;
      rig.rightArm.rotation.x = -0.32 + Math.sin(stride) * legAmp * 0.72;
      rig.bodyPivot.rotation.y = moving ? Math.sin(stride) * 0.08 : Math.sin(elapsedTime * 1.8) * 0.06;
    }
    rig.headGroup.rotation.y = Math.sin(elapsedTime * 2.4) * 0.14;
    rig.bodyPivot.position.y = moving ? Math.abs(Math.sin(stride)) * 0.1 : Math.sin(elapsedTime * 2.8) * 0.025;
    rig.bodyPivot.rotation.x = moving ? (rig.kind === 'stalker' ? 0.16 : 0.1) : 0.02;
  }
}

export interface WaystoneRelicRig {
  root: THREE.Group;
  crystal: THREE.Mesh;
  haloRing: THREE.Mesh;
  groundRing: THREE.Mesh;
  beam: THREE.Mesh;
  groundMat: THREE.MeshBasicMaterial;
  crystalMat: THREE.MeshPhysicalMaterial;
  beamMat: THREE.MeshBasicMaterial;
}

export function buildWaystoneRelicMesh(accentHex = '#38bdf8'): WaystoneRelicRig {
  const root = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.78,
    metalness: 0.18,
  });
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.65,
    roughness: 0.12,
    clearcoat: 1.0,
  });

  // Stepped Stone Pedestal
  const baseStep = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.34, 8), stoneMat);
  baseStep.position.y = 0.17;
  baseStep.receiveShadow = true;
  baseStep.castShadow = true;

  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.64, 1.85, 6), stoneMat);
  obelisk.position.y = 1.15;
  obelisk.castShadow = true;
  obelisk.receiveShadow = true;

  // Floating Diamond Crystal
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.54, 0), crystalMat);
  crystal.scale.set(0.85, 1.45, 0.85);
  crystal.position.y = 2.72;
  crystal.castShadow = true;

  // Orbiting Rune Halo
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 8, 28), crystalMat);
  haloRing.position.y = 2.72;

  // Ground Capture Zone Ring
  const groundMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const groundRing = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.65, 40), groundMat);
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.05;

  // Vertical Sky Beacon Beam
  const beamMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.15, 11, 18, 1, true), beamMat);
  beam.position.y = 5.5;

  root.add(baseStep, obelisk, crystal, haloRing, groundRing, beam);
  return { root, crystal, haloRing, groundRing, beam, groundMat, crystalMat, beamMat };
}

export function animateWaystoneRelic(
  rig: WaystoneRelicRig,
  {
    charge,
    completed,
    dt,
    elapsedTime,
  }: {
    charge: number;
    completed: boolean;
    dt: number;
    elapsedTime: number;
  }
): void {
  const spin = completed ? 2.8 : 1.1 + charge * 3.0;
  rig.crystal.rotation.y += dt * spin;
  rig.crystal.position.y = 2.72 + Math.sin(elapsedTime * 3.4) * 0.18;
  rig.haloRing.rotation.x = Math.sin(elapsedTime * 1.9) * 0.55;
  rig.haloRing.rotation.y += dt * (spin * 0.8);

  if (completed) {
    rig.crystalMat.color.set('#34d399');
    rig.crystalMat.emissive.set('#10b981');
    rig.crystalMat.emissiveIntensity = 1.0;
    rig.groundMat.color.set('#34d399');
    rig.groundMat.opacity = 0.45;
    rig.beamMat.color.set('#34d399');
    rig.beamMat.opacity = 0.24;
    rig.groundRing.scale.setScalar(1);
  } else {
    const pulsing = 0.94 + Math.sin(elapsedTime * (3 + charge * 6)) * 0.06;
    rig.groundRing.scale.setScalar(pulsing);
    rig.groundMat.opacity = 0.42 + charge * 0.48;
    rig.beamMat.opacity = 0.1 + charge * 0.22;
    if (charge > 0.05) {
      rig.crystalMat.color.set('#fde047');
      rig.crystalMat.emissive.set('#f59e0b');
      rig.groundMat.color.set('#fde047');
      rig.beamMat.color.set('#fde047');
    }
  }
}

export interface EscapePortalRig {
  root: THREE.Group;
  vortexTorus: THREE.Mesh;
  vortexDisc: THREE.Mesh;
  skyBeam: THREE.Mesh;
  groundRing: THREE.Mesh;
  vortexMat: THREE.MeshBasicMaterial;
  discMat: THREE.MeshBasicMaterial;
}

export function buildEscapePortalMesh(): EscapePortalRig {
  const root = new THREE.Group();

  const archMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.5,
    metalness: 0.45,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#d97706',
    emissiveIntensity: 0.4,
    roughness: 0.25,
    metalness: 0.72,
  });

  // Twin Carved Portal Pillars + Arch Lintels
  const pillarGeo = new THREE.BoxGeometry(0.75, 4.2, 0.75);
  const leftPillar = new THREE.Mesh(pillarGeo, archMat);
  leftPillar.position.set(-2.05, 2.1, 0);
  leftPillar.castShadow = true;

  const rightPillar = new THREE.Mesh(pillarGeo, archMat);
  rightPillar.position.set(2.05, 2.1, 0);
  rightPillar.castShadow = true;

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.65, 0.95), trimMat);
  lintel.position.set(0, 4.35, 0);
  lintel.castShadow = true;

  const vortexMat = new THREE.MeshBasicMaterial({
    color: '#34d399',
  });
  const vortexTorus = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.16, 12, 32), vortexMat);
  vortexTorus.position.set(0, 2.2, 0);

  const discMat = new THREE.MeshBasicMaterial({
    color: '#fde047',
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const vortexDisc = new THREE.Mesh(new THREE.CircleGeometry(1.48, 28), discMat);
  vortexDisc.position.set(0, 2.2, 0);

  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 3.9, 44),
    new THREE.MeshBasicMaterial({
      color: '#fde047',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.06;

  const skyBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.2, 16, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#34d399',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  skyBeam.position.y = 8;

  root.add(leftPillar, rightPillar, lintel, vortexTorus, vortexDisc, groundRing, skyBeam);
  return { root, vortexTorus, vortexDisc, skyBeam, groundRing, vortexMat, discMat };
}

export function animateEscapePortal(
  rig: EscapePortalRig,
  {
    open,
    extractProgress,
    dt,
    elapsedTime,
  }: {
    open: boolean;
    extractProgress: number;
    dt: number;
    elapsedTime: number;
  }
): void {
  rig.root.visible = open;
  if (!open) return;
  rig.vortexTorus.rotation.z += dt * (2.5 + extractProgress * 5);
  rig.vortexDisc.scale.setScalar(0.95 + Math.sin(elapsedTime * 6) * 0.06);
  rig.groundRing.scale.setScalar(1 + Math.sin(elapsedTime * 5) * 0.05);
  rig.skyBeam.rotation.y += dt * 1.4;
  rig.discMat.opacity = 0.42 + extractProgress * 0.48;
}

export type QuestWeaponKind =
  | 'ice_axe'
  | 'frost_spear'
  | 'cryo_cannon'
  | 'plasma_glaive'
  | 'rail_scatter';

export interface QuestWeaponSpec {
  kind: QuestWeaponKind;
  label: string;
  shortLabel: string;
  colorHex: string;
  ammo: number;
  durationMs: number;
  bannerText: string;
  weight: number;
}

export const QUEST_WEAPON_SPECS: Record<QuestWeaponKind, QuestWeaponSpec> = {
  ice_axe: {
    kind: 'ice_axe',
    label: 'Glacial Ice-Axe',
    shortLabel: 'Ice-Axe',
    colorHex: '#22d3ee',
    ammo: 16,
    durationMs: 25000,
    bannerText: 'GLACIAL ICE-AXE EQUIPPED (16x Frost Cleave + Slowing Thrown Axe)!',
    weight: 28,
  },
  frost_spear: {
    kind: 'frost_spear',
    label: 'Frost-Spear',
    shortLabel: 'Frost-Spear',
    colorHex: '#60a5fa',
    ammo: 18,
    durationMs: 25000,
    bannerText: 'FROST-SPEAR EQUIPPED (18x Piercing Cryo Lance — Hits 5 Foes)!',
    weight: 28,
  },
  cryo_cannon: {
    kind: 'cryo_cannon',
    label: 'Cryo Cannon',
    shortLabel: 'Cryo Cannon',
    colorHex: '#38bdf8',
    ammo: 14,
    durationMs: 26000,
    bannerText: 'CRYO CANNON EQUIPPED (14x Frost AoE Slow)!',
    weight: 16,
  },
  plasma_glaive: {
    kind: 'plasma_glaive',
    label: 'Plasma Glaive',
    shortLabel: 'Plasma Glaive',
    colorHex: '#e879f9',
    ammo: 16,
    durationMs: 26000,
    bannerText: 'PLASMA GLAIVE EQUIPPED (16x Piercing Discs + Heavy Cleave)!',
    weight: 14,
  },
  rail_scatter: {
    kind: 'rail_scatter',
    label: 'Tri-Rail Scattergun',
    shortLabel: 'Tri-Rail',
    colorHex: '#fbbf24',
    ammo: 18,
    durationMs: 26000,
    bannerText: 'TRI-RAIL SCATTERGUN EQUIPPED (18x 3-Bolt Spread)!',
    weight: 14,
  },
};

const QUEST_WEAPON_LIST = Object.values(QUEST_WEAPON_SPECS);
const QUEST_WEAPON_TOTAL_WEIGHT = QUEST_WEAPON_LIST.reduce((acc, w) => acc + w.weight, 0);

export function getQuestWeaponSpec(kind: QuestWeaponKind): QuestWeaponSpec {
  return QUEST_WEAPON_SPECS[kind];
}

export function pickRandomQuestWeapon(exclude?: QuestWeaponKind): QuestWeaponKind {
  const candidates = exclude
    ? QUEST_WEAPON_LIST.filter((w) => w.kind !== exclude)
    : QUEST_WEAPON_LIST;
  const total = candidates.reduce((acc, w) => acc + w.weight, 0) || QUEST_WEAPON_TOTAL_WEIGHT;
  let roll = Math.random() * total;
  for (const w of candidates) {
    roll -= w.weight;
    if (roll <= 0) return w.kind;
  }
  return candidates[0].kind;
}

export interface WeaponPodRig {
  root: THREE.Group;
  weaponPivot: THREE.Group;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
}

export function buildQuestWeaponModel(kind: QuestWeaponKind): THREE.Group {
  const model = new THREE.Group();
  const spec = getQuestWeaponSpec(kind);

  const frameMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.35,
    metalness: 0.72,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.62,
    metalness: 0.25,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.24,
    metalness: 0.82,
  });
  const glowMat = new THREE.MeshPhysicalMaterial({
    color: spec.colorHex,
    emissive: spec.colorHex,
    emissiveIntensity: 0.85,
    roughness: 0.14,
    clearcoat: 1.0,
  });

  if (kind === 'ice_axe') {
    // Glacial Ice-Axe: frost-wrapped haft, steel socket collar, beveled crystal blade & rear pick
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 1.32, 10), handleMat);
    const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.072, 0.14, 8), steelMat);
    pommel.position.y = -0.66;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.22, 8), frameMat);
    collar.position.y = 0.42;

    const bladeCore = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.09), glowMat);
    bladeCore.position.set(0.24, 0.44, 0);
    const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.05), glowMat);
    bladeEdge.position.set(0.44, 0.4, 0);
    bladeEdge.rotation.z = -0.14;
    const beardTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4), glowMat);
    beardTip.position.set(0.38, 0.14, 0);
    beardTip.rotation.z = Math.PI * 0.88;

    const rearPick = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34, 4), steelMat);
    rearPick.position.set(-0.23, 0.45, 0);
    rearPick.rotation.z = Math.PI / 2;

    const runeGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), glowMat);
    runeGem.position.set(0.06, 0.44, 0);

    model.add(haft, pommel, collar, bladeCore, bladeEdge, beardTip, rearPick, runeGem);
    model.rotation.z = -0.25;
  } else if (kind === 'frost_spear') {
    // Frost-Spear: long titanium shaft, fluted guard collar, faceted crystal spearhead & rear fins
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 1.58, 10), handleMat);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.065, 0.18, 8), steelMat);
    ferrule.position.y = 0.56;
    const guardRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16), frameMat);
    guardRing.rotation.x = Math.PI / 2;
    guardRing.position.y = 0.49;

    const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.56, 4), glowMat);
    spearHead.position.y = 0.9;
    const barbL = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 4), glowMat);
    barbL.position.set(-0.11, 0.66, 0);
    barbL.rotation.z = 2.65;
    const barbR = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 4), glowMat);
    barbR.position.set(0.11, 0.66, 0);
    barbR.rotation.z = -2.65;

    const finA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.03), glowMat);
    finA.position.y = -0.66;
    const finB = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.18), glowMat);
    finB.position.y = -0.66;

    model.add(shaft, ferrule, guardRing, spearHead, barbL, barbR, finA, finB);
    model.rotation.z = -0.42;
  } else if (kind === 'cryo_cannon') {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.25, 10), frameMat);
    barrel.rotation.z = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 10), glowMat);
    core.rotation.z = Math.PI / 2;
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16), glowMat);
    muzzle.rotation.y = Math.PI / 2;
    muzzle.position.x = 0.62;
    model.add(barrel, core, muzzle);
  } else if (kind === 'plasma_glaive') {
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), frameMat);
    hilt.rotation.z = Math.PI * 0.25;
    const blade = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.075, 8, 24, Math.PI * 1.2), glowMat);
    blade.position.set(0.22, 0.22, 0);
    model.add(hilt, blade);
  } else {
    // rail_scatter: Tri-barrel railgun
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.34), frameMat);
    [-0.12, 0, 0.12].forEach((zOff) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 6), glowMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0.22, 0.04, zOff);
      model.add(rail);
    });
    model.add(chassis);
  }

  return model;
}

export function buildHeldWeaponMesh(kind: QuestWeaponKind): THREE.Group {
  const held = buildQuestWeaponModel(kind);
  if (kind === 'ice_axe') {
    held.scale.setScalar(0.86);
    held.position.set(0.02, 0.26, 0.08);
    held.rotation.set(0.25, 0, 0.18);
  } else if (kind === 'frost_spear') {
    held.scale.setScalar(0.84);
    held.position.set(0, 0.32, 0.12);
    held.rotation.set(0.68, 0, 0.38);
  } else if (kind === 'cryo_cannon' || kind === 'rail_scatter') {
    held.scale.setScalar(0.72);
    held.position.set(0.05, 0.12, 0.22);
    held.rotation.set(0, -Math.PI / 2, 0.35);
  } else {
    held.scale.setScalar(0.82);
    held.position.set(0, 0.28, 0.1);
  }
  return held;
}

export function buildWeaponPodMesh(kind: QuestWeaponKind): WeaponPodRig {
  const root = new THREE.Group();
  const weaponPivot = new THREE.Group();
  weaponPivot.position.y = 1.28;
  root.add(weaponPivot);

  const spec = getQuestWeaponSpec(kind);
  const accent = spec.colorHex;

  const frameMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.35,
    metalness: 0.72,
  });

  // Pedestal Base + Ground Ring + Beacon Beam
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.82, 0.24, 8), frameMat);
  plinth.position.y = 0.12;
  root.add(plinth);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.18, 28),
    new THREE.MeshBasicMaterial({
      color: accent,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  root.add(ring);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.68, 7.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.position.y = 3.6;
  root.add(beam);

  weaponPivot.add(buildQuestWeaponModel(kind));

  return { root, weaponPivot, ring, beam };
}

export function animateWeaponPod(
  rig: WeaponPodRig,
  dt: number,
  elapsedTime: number
): void {
  rig.weaponPivot.rotation.y += dt * 2.4;
  rig.weaponPivot.position.y = 1.26 + Math.sin(elapsedTime * 3.8) * 0.16;
  rig.ring.scale.setScalar(0.94 + Math.sin(elapsedTime * 5.2) * 0.08);
  rig.beam.rotation.y += dt * 1.8;
}
