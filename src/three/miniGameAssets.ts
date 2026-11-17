import * as THREE from 'three';
import type { MapId, YetiColorId } from '../types';
import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  ARENA_WORLD_SCALE,
  getRaceBoostPads,
  getRaceCheckpoints,
  getRacePointAtAngle,
  getYetiColorway,
} from '../data/gameCatalog';
import { buildYetiRig, type YetiRigParts } from './yetiBuilder';

export interface YetiKartParts {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelPivots: THREE.Group[];
  driverRig: YetiRigParts;
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
  shieldMesh: THREE.Mesh;
}

/**
 * Builds a 3D Arctic Hover-Kart with a seated 3D Lofi Yeti driver inside the cockpit,
 * spinning wheels, front steering pivots, and dual nitro exhaust flames.
 */
export function buildYetiKartRig(options: {
  colorwayId?: YetiColorId;
  hatId: string;
  scarfId: string;
  isPlayer: boolean;
}): YetiKartParts {
  const palette = getYetiColorway(options.colorwayId);
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: palette.skinHex,
    roughness: 0.25,
    metalness: 0.28,
    clearcoat: 0.9,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: palette.accentHex,
    emissive: palette.accentHex,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.4,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.78 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.65, roughness: 0.25 });

  // Lower snow-skid base + sculpted kart nose
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 1.95), darkMat);
  base.position.set(0, 0.24, 0);
  base.castShadow = true;
  chassisGroup.add(base);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.34, 1.65), bodyMat);
  hood.position.set(0, 0.44, 0.08);
  hood.castShadow = true;
  chassisGroup.add(hood);

  // Front aerodynamic nose bumper
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.22, 0.32), trimMat);
  nose.position.set(0, 0.32, 0.95);
  nose.castShadow = true;
  chassisGroup.add(nose);

  // Rear spoiler wing
  const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.14), darkMat);
  wingPostL.position.set(-0.36, 0.68, -0.78);
  const wingPostR = wingPostL.clone();
  wingPostR.position.x = 0.36;
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.09, 0.32), trimMat);
  spoiler.position.set(0, 0.88, -0.82);
  spoiler.castShadow = true;
  chassisGroup.add(wingPostL, wingPostR, spoiler);

  // Dual Rear Exhaust Pipes + Nitro Flames
  const pipeGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.35, 10);
  pipeGeo.rotateX(Math.PI / 2);
  const pipeL = new THREE.Mesh(pipeGeo, rimMat);
  pipeL.position.set(-0.26, 0.42, -0.95);
  const pipeR = pipeL.clone();
  pipeR.position.x = 0.26;
  chassisGroup.add(pipeL, pipeR);

  const flameMat = new THREE.MeshBasicMaterial({
    color: '#fde047',
    transparent: true,
    opacity: 0.9,
  });
  const flameGeo = new THREE.ConeGeometry(0.11, 0.55, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameLeft = new THREE.Mesh(flameGeo, flameMat);
  flameLeft.position.set(-0.26, 0.42, -1.28);
  flameLeft.visible = false;
  const flameRight = flameLeft.clone();
  flameRight.position.x = 0.26;
  flameRight.visible = false;
  chassisGroup.add(flameLeft, flameRight);

  // 4 Articulated Wheels (Front steer pivots + rear drive wheels)
  const wheels: THREE.Mesh[] = [];
  const frontWheelPivots: THREE.Group[] = [];
  const tireGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 12);
  hubGeo.rotateZ(Math.PI / 2);

  [
    { x: -0.66, z: 0.62, front: true },
    { x: 0.66, z: 0.62, front: true },
    { x: -0.7, z: -0.64, front: false },
    { x: 0.7, z: -0.64, front: false },
  ].forEach((w) => {
    const wheel = new THREE.Mesh(tireGeo, darkMat);
    wheel.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, rimMat);
    wheel.add(hub);
    wheels.push(wheel);

    if (w.front) {
      const pivot = new THREE.Group();
      pivot.position.set(w.x, 0.28, w.z);
      pivot.add(wheel);
      frontWheelPivots.push(pivot);
      chassisGroup.add(pivot);
    } else {
      wheel.position.set(w.x, 0.28, w.z);
      chassisGroup.add(wheel);
    }
  });

  // Seated 3D Lofi Yeti Driver inside Kart Cockpit
  const driverRig = buildYetiRig({
    colorwayId: options.colorwayId,
    hatId: options.hatId,
    scarfId: options.scarfId,
    isPlayer: options.isPlayer,
    scale: 0.72,
  });
  // Tuck legs inside kart cockpit so torso, arms, head & hat sit naturally in driver seat
  driverRig.leftHipGroup.visible = false;
  driverRig.rightHipGroup.visible = false;
  driverRig.root.position.set(0, -0.25, -0.08);
  // Arms grip forward steering wheel
  driverRig.leftArmGroup.rotation.x = -0.95;
  driverRig.leftElbowGroup.rotation.x = -0.45;
  driverRig.rightArmGroup.rotation.x = -0.95;
  driverRig.rightElbowGroup.rotation.x = -0.45;
  chassisGroup.add(driverRig.root);

  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.45, 1),
    new THREE.MeshPhysicalMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0.2,
      roughness: 0.08,
      depthWrite: false,
    })
  );
  shieldMesh.position.y = 0.9;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return {
    root,
    chassisGroup,
    wheels,
    frontWheelPivots,
    driverRig,
    flameLeft,
    flameRight,
    shieldMesh,
  };
}

export function animateKartRig(
  kart: YetiKartParts,
  opts: { speed: number; steer: number; boosting: boolean; dt: number; elapsedTime: number }
): void {
  const { speed, steer, boosting, dt, elapsedTime } = opts;
  const spin = (speed / 25) * dt * 2.8;
  for (const w of kart.wheels) {
    w.rotation.x += spin;
  }
  for (const fp of kart.frontWheelPivots) {
    fp.rotation.y = THREE.MathUtils.damp(fp.rotation.y, -steer * 0.42, 12, dt);
  }
  kart.chassisGroup.rotation.z = THREE.MathUtils.damp(
    kart.chassisGroup.rotation.z,
    steer * 0.14 * Math.min(1, Math.abs(speed) / 140),
    10,
    dt
  );
  kart.driverRig.headGroup.rotation.y = THREE.MathUtils.damp(
    kart.driverRig.headGroup.rotation.y,
    -steer * 0.35,
    10,
    dt
  );
  if (kart.driverRig.scarfTail) {
    kart.driverRig.scarfTail.rotation.x =
      0.5 + Math.min(0.65, Math.abs(speed) / 360) + Math.sin(elapsedTime * 14) * 0.14;
  }
  kart.flameLeft.visible = boosting;
  kart.flameRight.visible = boosting;
  if (boosting) {
    const fScale = 0.85 + Math.sin(elapsedTime * 36) * 0.3;
    kart.flameLeft.scale.set(1, 1, fScale);
    kart.flameRight.scale.set(1, 1, fScale);
  }
}

export interface RaceTrackHandles {
  group: THREE.Group;
  checkpointRings: THREE.Mesh[];
  update: (time: number, nextCheckpointIdx: number) => void;
}

/**
 * Builds the 3D Race Circuit ribbon, Start/Finish Checkered Gantry,
 * 8 Sequential Checkpoint Rings, and 4 Glowing Turbo Boost Pads.
 */
export function buildRaceTrack3D(mapId: MapId): RaceTrackHandles {
  const group = new THREE.Group();
  const roadColor =
    mapId === 'volcanic_springs'
      ? '#1c1917'
      : mapId === 'aurora_summit'
      ? '#1e1b4b'
      : '#0f2942';
  const curbColor =
    mapId === 'volcanic_springs'
      ? '#fb923c'
      : mapId === 'aurora_summit'
      ? '#2dd4bf'
      : '#38bdf8';

  // Procedural closed asphalt/ice ribbon around the oval circuit
  const segs = 96;
  const trackHalfW = 2.65;
  const positions: number[] = [];
  const indices: number[] = [];
  const innerLinePts: THREE.Vector3[] = [];
  const outerLinePts: THREE.Vector3[] = [];

  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const p = getRacePointAtAngle(theta);
    const pNext = getRacePointAtAngle(theta + 0.01);
    const wx = (p.x - ARENA_CENTER_X) * ARENA_WORLD_SCALE;
    const wz = (p.y - ARENA_CENTER_Y) * ARENA_WORLD_SCALE;
    const nx = (pNext.x - ARENA_CENTER_X) * ARENA_WORLD_SCALE - wx;
    const nz = (pNext.y - ARENA_CENTER_Y) * ARENA_WORLD_SCALE - wz;
    const len = Math.hypot(nx, nz) || 1;
    const rx = -nz / len;
    const rz = nx / len;

    const ix = wx - rx * trackHalfW;
    const iz = wz - rz * trackHalfW;
    const ox = wx + rx * trackHalfW;
    const oz = wz + rz * trackHalfW;

    positions.push(ix, 0.038, iz, ox, 0.038, oz);
    innerLinePts.push(new THREE.Vector3(ix, 0.052, iz));
    outerLinePts.push(new THREE.Vector3(ox, 0.052, oz));

    if (i < segs) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();
  const roadMesh = new THREE.Mesh(
    roadGeo,
    new THREE.MeshStandardMaterial({
      color: roadColor,
      roughness: 0.72,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })
  );
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const curbMat = new THREE.LineBasicMaterial({ color: curbColor });
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(innerLinePts), curbMat));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outerLinePts), curbMat));

  // Start/Finish Arch at Checkpoint 0 (bottom straight)
  const cps = getRaceCheckpoints(8);
  const startPt = cps[0];
  const sx = (startPt.x - ARENA_CENTER_X) * ARENA_WORLD_SCALE;
  const sz = (startPt.y - ARENA_CENTER_Y) * ARENA_WORLD_SCALE;
  const gantry = new THREE.Group();
  gantry.position.set(sx, 0, sz);

  const pillarMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });
  const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.2, 10), pillarMat);
  pillarL.position.set(0, 1.6, -trackHalfW);
  const pillarR = pillarL.clone();
  pillarR.position.set(0, 1.6, trackHalfW);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.65, trackHalfW * 2 + 0.5),
    new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#d97706',
      emissiveIntensity: 0.45,
      roughness: 0.35,
    })
  );
  banner.position.set(0, 3.15, 0);
  gantry.add(pillarL, pillarR, banner);
  group.add(gantry);

  // 8 Glowing Checkpoint Rings
  const checkpointRings: THREE.Mesh[] = [];
  const cpGeo = new THREE.TorusGeometry(2.1, 0.09, 8, 28);
  cps.forEach((cp, idx) => {
    const mat = new THREE.MeshBasicMaterial({
      color: idx === 0 ? '#fbbf24' : '#38bdf8',
      transparent: true,
      opacity: 0.35,
    });
    const ring = new THREE.Mesh(cpGeo, mat);
    ring.position.set(
      (cp.x - ARENA_CENTER_X) * ARENA_WORLD_SCALE,
      1.65,
      (cp.y - ARENA_CENTER_Y) * ARENA_WORLD_SCALE
    );
    ring.rotation.y = -cp.angle;
    group.add(ring);
    checkpointRings.push(ring);
  });

  // 4 Golden Turbo Boost Pads
  const padGeo = new THREE.PlaneGeometry(1.75, 1.25);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  getRaceBoostPads().forEach((pad) => {
    const m = new THREE.Mesh(padGeo, padMat);
    m.position.set(
      (pad.x - ARENA_CENTER_X) * ARENA_WORLD_SCALE,
      0.055,
      (pad.y - ARENA_CENTER_Y) * ARENA_WORLD_SCALE
    );
    m.rotation.y = -pad.tangentAngle + Math.PI / 2;
    group.add(m);
  });

  return {
    group,
    checkpointRings,
    update(time, nextCheckpointIdx) {
      checkpointRings.forEach((ring, idx) => {
        const mat = ring.material as THREE.MeshBasicMaterial;
        const isNext = idx === nextCheckpointIdx;
        mat.color.set(isNext ? '#34d399' : idx === 0 ? '#fbbf24' : curbColor);
        mat.opacity = isNext ? 0.88 + Math.sin(time * 8) * 0.12 : 0.22;
        ring.scale.setScalar(isNext ? 1.12 + Math.sin(time * 6) * 0.06 : 0.92);
      });
    },
  };
}

/**
 * Builds a hovering 3D Cryo-Drone enemy target for the Shooting mini-game.
 */
export function buildFrostDroneRig(tier: 'scout' | 'heavy'): THREE.Group {
  const g = new THREE.Group();
  const isHeavy = tier === 'heavy';
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: isHeavy ? '#f43f5e' : '#38bdf8',
    emissive: isHeavy ? '#be123c' : '#0284c7',
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.35,
    clearcoat: 0.9,
  });
  const shellMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.65,
    roughness: 0.3,
  });

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(isHeavy ? 0.62 : 0.45, 0),
    coreMat
  );
  core.position.y = 1.15;
  core.castShadow = true;
  g.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(isHeavy ? 0.84 : 0.62, 0.075, 8, 20),
    shellMat
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.15;
  g.add(halo);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(isHeavy ? 0.2 : 0.15, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#fde047' })
  );
  eye.position.set(0, 1.15, isHeavy ? 0.52 : 0.38);
  g.add(eye);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(isHeavy ? 0.72 : 0.52, 16),
    new THREE.MeshBasicMaterial({
      color: '#020617',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  g.add(shadow);

  g.userData.core = core;
  g.userData.halo = halo;
  return g;
}

/**
 * Builds a sleek 3D Cryo-Blaster mounted to the Yeti's right hand during Shooting mode.
 */
export function buildCryoBlasterMesh(accentHex: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.2, 0.62),
    new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.65, roughness: 0.3 })
  );
  body.position.set(0, -0.34, 0.24);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.075, 0.42, 10),
    new THREE.MeshPhysicalMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.7,
      roughness: 0.1,
      clearcoat: 1.0,
    })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.32, 0.55);
  g.add(body, barrel);
  return g;
}
