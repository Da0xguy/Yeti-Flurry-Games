import * as THREE from 'three';
import { buildHealthBar3D, type HealthBar3D } from './kartAndShooter';

export type QuestMonsterKind = 'stalker' | 'brute' | 'wraith' | 'boss';

export interface QuestMonsterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  coreMesh: THREE.Mesh;
  auraRing: THREE.Mesh;
  hpBar: HealthBar3D;
  kind: QuestMonsterKind;
}

export function buildQuestMonsterMesh(
  kind: QuestMonsterKind,
  accentHex = '#38bdf8'
): QuestMonsterRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const scale =
    kind === 'boss' ? 2.35 : kind === 'brute' ? 1.72 : kind === 'wraith' ? 1.36 : 1.22;

  const armorHex =
    kind === 'boss'
      ? '#1e1b4b'
      : kind === 'brute'
      ? '#1e293b'
      : kind === 'wraith'
      ? '#0f172a'
      : '#172554';

  const glowHex =
    kind === 'boss'
      ? '#f59e0b'
      : kind === 'wraith'
      ? '#e879f9'
      : kind === 'brute'
      ? '#fb7185'
      : '#f43f5e';

  const armorMat = new THREE.MeshStandardMaterial({
    color: armorHex,
    roughness: kind === 'brute' ? 0.78 : 0.48,
    metalness: kind === 'boss' ? 0.55 : 0.28,
  });
  const boneMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.35,
    metalness: 0.12,
  });
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: glowHex,
    emissive: glowHex,
    emissiveIntensity: 0.72,
    roughness: 0.14,
    clearcoat: 0.9,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: glowHex });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.32,
    metalness: 0.45,
  });

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();

  // Ground shadow / menace ring
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.42 * scale, 0.58 * scale, 24),
    new THREE.MeshBasicMaterial({
      color: glowHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: kind === 'boss' ? 0.68 : 0.36,
      depthWrite: false,
    })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.04;
  root.add(auraRing);

  let coreMesh: THREE.Mesh;

  if (kind === 'wraith') {
    // Floating hooded abyssal fiend
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.45, 7), armorMat);
    robe.position.y = 1.02;
    robe.castShadow = true;
    bodyPivot.add(robe);

    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), armorMat);
    hood.position.set(0, 1.72, 0.04);
    hood.castShadow = true;
    bodyPivot.add(hood);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    eyeL.position.set(-0.1, 1.74, 0.28);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    eyeR.position.set(0.1, 1.74, 0.28);
    bodyPivot.add(eyeL, eyeR);

    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), crystalMat);
    coreMesh.position.set(0, 1.28, 0.28);
    bodyPivot.add(coreMesh);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 22), trimMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 2.02;
    bodyPivot.add(halo);

    // Floating claw gauntlets
    const clawL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.44, 5), crystalMat);
    clawL.rotation.x = Math.PI / 2;
    leftArm.position.set(-0.56, 1.28, 0.16);
    leftArm.add(clawL);

    const clawR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.44, 5), crystalMat);
    clawR.rotation.x = Math.PI / 2;
    rightArm.position.set(0.56, 1.28, 0.16);
    rightArm.add(clawR);

    bodyPivot.add(leftArm, rightArm, leftLeg, rightLeg);
  } else {
    // Bipedal horned frost stalker, brute golem, or dread boss
    const legGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.56, 8);
    const legMeshL = new THREE.Mesh(legGeo, armorMat);
    legMeshL.position.y = -0.24;
    legMeshL.castShadow = true;
    leftLeg.position.set(-0.24, 0.52, 0);
    leftLeg.add(legMeshL);

    const legMeshR = new THREE.Mesh(legGeo, armorMat);
    legMeshR.position.y = -0.24;
    legMeshR.castShadow = true;
    rightLeg.position.set(0.24, 0.52, 0);
    rightLeg.add(legMeshR);

    const torsoW = kind === 'brute' || kind === 'boss' ? 0.92 : 0.72;
    const torsoH = kind === 'brute' ? 0.86 : 0.78;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, 0.58), armorMat);
    torso.position.y = 0.92;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyPivot.add(torso);

    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), crystalMat);
    coreMesh.position.set(0, 0.95, 0.31);
    bodyPivot.add(coreMesh);

    // Head + menacing visor eyes
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.46), armorMat);
    head.position.set(0, 1.5, 0.06);
    head.castShadow = true;
    bodyPivot.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06), eyeMat);
    visor.position.set(0, 1.52, 0.29);
    bodyPivot.add(visor);

    // Twin Horns / Boss Crown Spikes
    const hornGeo = new THREE.ConeGeometry(0.085, kind === 'boss' ? 0.52 : 0.36, 6);
    const hornL = new THREE.Mesh(hornGeo, kind === 'boss' ? crystalMat : boneMat);
    hornL.position.set(-0.22, 1.82, 0.04);
    hornL.rotation.z = 0.42;
    const hornR = new THREE.Mesh(hornGeo, kind === 'boss' ? crystalMat : boneMat);
    hornR.position.set(0.22, 1.82, 0.04);
    hornR.rotation.z = -0.42;
    bodyPivot.add(hornL, hornR);

    if (kind === 'boss' || kind === 'brute') {
      // Jagged Shoulder Spires + Dorsal Armor
      const spireGeo = new THREE.ConeGeometry(0.18, 0.56, 5);
      const spireL = new THREE.Mesh(spireGeo, crystalMat);
      spireL.position.set(-torsoW * 0.54, 1.42, 0);
      spireL.rotation.z = 0.52;
      const spireR = new THREE.Mesh(spireGeo, crystalMat);
      spireR.position.set(torsoW * 0.54, 1.42, 0);
      spireR.rotation.z = -0.52;
      bodyPivot.add(spireL, spireR);

      if (kind === 'boss') {
        for (let b = 0; b < 3; b++) {
          const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), crystalMat);
          dorsal.position.set(0, 1.28 - b * 0.24, -0.34);
          dorsal.rotation.x = -0.75;
          bodyPivot.add(dorsal);
        }
      }
    }

    // Arms + Claws + Heavy Weapons for Brute & Boss
    const armGeo = new THREE.BoxGeometry(0.22, 0.58, 0.22);
    const armMeshL = new THREE.Mesh(armGeo, armorMat);
    armMeshL.position.y = -0.22;
    armMeshL.castShadow = true;
    const clawTipL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 5), boneMat);
    clawTipL.position.set(0, -0.56, 0.06);
    clawTipL.rotation.x = Math.PI;
    leftArm.position.set(-(torsoW * 0.5 + 0.14), 1.18, 0);
    leftArm.add(armMeshL, clawTipL);

    const armMeshR = new THREE.Mesh(armGeo, armorMat);
    armMeshR.position.y = -0.22;
    armMeshR.castShadow = true;
    const clawTipR = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 5), boneMat);
    clawTipR.position.set(0, -0.56, 0.06);
    clawTipR.rotation.x = Math.PI;
    rightArm.position.set(torsoW * 0.5 + 0.14, 1.18, 0);
    rightArm.add(armMeshR, clawTipR);

    if (kind === 'boss') {
      // Dread Frost Greataxe on Right Arm
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.45, 8), trimMat);
      haft.rotation.x = Math.PI / 2;
      haft.position.set(0, -0.5, 0.45);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.44), crystalMat);
      blade.position.set(0, -0.5, 0.96);
      rightArm.add(haft, blade);
    } else if (kind === 'brute') {
      // Spiked War-Maul on Right Arm
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 8), boneMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, -0.48, 0.35);
      const headMaul = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.36), armorMat);
      headMaul.position.set(0, -0.48, 0.78);
      rightArm.add(handle, headMaul);
    }

    bodyPivot.add(leftLeg, rightLeg, leftArm, rightArm);
  }

  bodyPivot.scale.setScalar(scale);

  const hpBar = buildHealthBar3D(kind === 'boss' ? 2.35 : 1.25, 2.35 * scale);
  root.add(hpBar.group);

  return {
    root,
    bodyPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    coreMesh,
    auraRing,
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
  const stride = elapsedTime * (rig.kind === 'stalker' ? 13 : 9.5);
  rig.coreMesh.rotation.y += dt * 3.2;
  rig.auraRing.rotation.z += dt * 1.6;

  if (rig.kind === 'wraith') {
    rig.bodyPivot.position.y = 0.18 + Math.sin(elapsedTime * 4.2) * 0.14;
    rig.leftArm.position.y = 1.28 + Math.sin(elapsedTime * 5) * 0.09;
    rig.rightArm.position.y = 1.28 + Math.cos(elapsedTime * 5) * 0.09;
    rig.bodyPivot.rotation.x = moving ? 0.12 : 0;
  } else {
    const legAmp = moving ? 0.65 : 0.05;
    rig.leftLeg.rotation.x = Math.sin(stride) * legAmp;
    rig.rightLeg.rotation.x = -Math.sin(stride) * legAmp;
    if (attacking) {
      rig.leftArm.rotation.x = -1.25;
      rig.rightArm.rotation.x = -1.25;
    } else {
      rig.leftArm.rotation.x = -0.35 - Math.sin(stride) * legAmp * 0.7;
      rig.rightArm.rotation.x = -0.35 + Math.sin(stride) * legAmp * 0.7;
    }
    rig.bodyPivot.position.y = moving ? Math.abs(Math.sin(stride)) * 0.09 : 0;
    rig.bodyPivot.rotation.x = moving ? 0.09 : 0;
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
