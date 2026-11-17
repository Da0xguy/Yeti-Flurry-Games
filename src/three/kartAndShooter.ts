import * as THREE from 'three';
import { getYetiColorway } from '../data/gameCatalog';
import type { YetiColorId } from '../types';
import { buildYetiRig } from './yetiBuilder';

export interface YetiKartRigParts {
  root: THREE.Group;
  chassisPivot: THREE.Group;
  frontLeftHub: THREE.Group;
  frontRightHub: THREE.Group;
  wheels: THREE.Mesh[];
  boostFlames: THREE.Mesh[];
  steeringWheel: THREE.Mesh;
  driverHead: THREE.Group;
  nitroRing: THREE.Mesh;
}

export function buildYetiKartRig({
  colorwayId,
  hatId,
  scarfId,
  isPlayer,
}: {
  colorwayId: YetiColorId;
  hatId: string;
  scarfId: string;
  isPlayer: boolean;
}): YetiKartRigParts {
  const cw = getYetiColorway(colorwayId);
  const root = new THREE.Group();

  const chassisPivot = new THREE.Group();
  root.add(chassisPivot);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: cw.accentHex,
    roughness: 0.22,
    metalness: 0.35,
    clearcoat: 0.9,
    clearcoatRoughness: 0.14,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.55,
    metalness: 0.45,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.18,
    metalness: 0.88,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.85,
    metalness: 0.08,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#e0f2fe',
    emissive: isPlayer ? '#38bdf8' : '#fb923c',
    emissiveIntensity: 0.95,
    roughness: 0.15,
  });

  // Lower Skid Floor & Aerodynamic Nose Cone (facing +Z)
  const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 2.05), trimMat);
  floorPan.position.set(0, 0.24, 0);
  floorPan.castShadow = true;
  floorPan.receiveShadow = true;
  chassisPivot.add(floorPan);

  const mainShell = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.32, 1.55), bodyMat);
  mainShell.position.set(0, 0.42, -0.05);
  mainShell.castShadow = true;
  mainShell.receiveShadow = true;
  chassisPivot.add(mainShell);

  const noseHood = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.24, 0.65), bodyMat);
  noseHood.position.set(0, 0.39, 0.82);
  noseHood.rotation.x = 0.16;
  noseHood.castShadow = true;
  chassisPivot.add(noseHood);

  // Side Skirts
  [-0.58, 0.58].forEach((sx) => {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 1.1), bodyMat);
    skirt.position.set(sx, 0.36, -0.02);
    skirt.castShadow = true;
    chassisPivot.add(skirt);
  });

  // Front Bumper + Twin Headlights
  const frontBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.12, 10), chromeMat);
  frontBumper.rotation.z = Math.PI / 2;
  frontBumper.position.set(0, 0.28, 1.12);
  chassisPivot.add(frontBumper);

  [-0.28, 0.28].forEach((lx) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), glowMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(lx, 0.44, 1.04);
    chassisPivot.add(lamp);
  });

  // Rear Spoiler Wing & Rollbar
  const spoilerLeft = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.14), trimMat);
  spoilerLeft.position.set(-0.42, 0.72, -0.82);
  const spoilerRight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.14), trimMat);
  spoilerRight.position.set(0.42, 0.72, -0.82);
  const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.34), bodyMat);
  spoilerWing.position.set(0, 0.9, -0.85);
  spoilerWing.rotation.x = -0.14;
  spoilerWing.castShadow = true;
  chassisPivot.add(spoilerLeft, spoilerRight, spoilerWing);

  // Twin Exhaust Pipes + Nitro Boost Flame Cones
  const boostFlames: THREE.Mesh[] = [];
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.9,
  });
  [-0.24, 0.24].forEach((ex) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.34, 10), chromeMat);
    pipe.rotation.x = Math.PI / 2 - 0.18;
    pipe.position.set(ex, 0.45, -0.96);
    chassisPivot.add(pipe);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.65, 10), flameMat);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(ex, 0.48, -1.36);
    flame.visible = false;
    chassisPivot.add(flame);
    boostFlames.push(flame);
  });

  // Steering Column + Wheel
  const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 8), trimMat);
  steerCol.rotation.x = -0.58;
  steerCol.position.set(0, 0.66, 0.42);
  chassisPivot.add(steerCol);

  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.032, 8, 18), trimMat);
  steeringWheel.position.set(0, 0.81, 0.28);
  steeringWheel.rotation.x = -0.55;
  chassisPivot.add(steeringWheel);

  // Seated 3D Lofi Yeti Driver inside the cockpit!
  const driverRig = buildYetiRig({
    colorwayId,
    hatId,
    scarfId,
    isPlayer: false,
  });
  // Tuck legs inside cockpit and raise arms forward onto steering wheel
  driverRig.root.scale.setScalar(0.68);
  driverRig.root.position.set(0, 0.34, -0.06);
  driverRig.leftHipGroup.rotation.x = -1.25;
  driverRig.rightHipGroup.rotation.x = -1.25;
  driverRig.leftKneeGroup.rotation.x = 1.1;
  driverRig.rightKneeGroup.rotation.x = 1.1;
  driverRig.leftArmGroup.rotation.x = -0.95;
  driverRig.rightArmGroup.rotation.x = -0.95;
  driverRig.leftArmGroup.rotation.z = 0.25;
  driverRig.rightArmGroup.rotation.z = -0.25;
  driverRig.shieldMesh.visible = false;
  driverRig.boostRing.visible = false;
  chassisPivot.add(driverRig.root);

  // 4 Arctic Wheels (Front steerable hubs + Rear wide tires)
  const wheels: THREE.Mesh[] = [];
  const createWheel = (radius: number, width: number) => {
    const wGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    wGeo.rotateZ(Math.PI / 2);
    const wheel = new THREE.Mesh(wGeo, tireMat);
    wheel.castShadow = true;

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, width + 0.02, 12).rotateZ(Math.PI / 2),
      chromeMat
    );
    wheel.add(rim);
    wheels.push(wheel);
    return wheel;
  };

  const frontLeftHub = new THREE.Group();
  frontLeftHub.position.set(-0.68, 0.27, 0.68);
  frontLeftHub.add(createWheel(0.27, 0.22));
  chassisPivot.add(frontLeftHub);

  const frontRightHub = new THREE.Group();
  frontRightHub.position.set(0.68, 0.27, 0.68);
  frontRightHub.add(createWheel(0.27, 0.22));
  chassisPivot.add(frontRightHub);

  const rearLeft = createWheel(0.32, 0.28);
  rearLeft.position.set(-0.72, 0.32, -0.62);
  chassisPivot.add(rearLeft);

  const rearRight = createWheel(0.32, 0.28);
  rearRight.position.set(0.72, 0.32, -0.62);
  chassisPivot.add(rearRight);

  // Subtle player ground halo
  const nitroRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.32, 28),
    new THREE.MeshBasicMaterial({
      color: isPlayer ? '#38bdf8' : cw.accentHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isPlayer ? 0.55 : 0.25,
      depthWrite: false,
    })
  );
  nitroRing.rotation.x = -Math.PI / 2;
  nitroRing.position.y = 0.03;
  root.add(nitroRing);

  return {
    root,
    chassisPivot,
    frontLeftHub,
    frontRightHub,
    wheels,
    boostFlames,
    steeringWheel,
    driverHead: driverRig.headGroup,
    nitroRing,
  };
}

export function animateYetiKart(
  rig: YetiKartRigParts,
  opts: {
    speed: number;
    steer: number;
    boosting: boolean;
    dt: number;
    elapsedTime: number;
  }
): void {
  const { speed, steer, boosting, dt, elapsedTime } = opts;

  // Spin wheels proportional to forward velocity
  const spinDelta = (speed / 25) * dt * 2.4;
  for (const w of rig.wheels) {
    w.rotation.x += spinDelta;
  }

  // Front wheel steering + cockpit steering wheel turn
  const steerAngle = THREE.MathUtils.clamp(-steer * 0.42, -0.46, 0.46);
  rig.frontLeftHub.rotation.y = THREE.MathUtils.damp(rig.frontLeftHub.rotation.y, steerAngle, 14, dt);
  rig.frontRightHub.rotation.y = THREE.MathUtils.damp(rig.frontRightHub.rotation.y, steerAngle, 14, dt);
  rig.steeringWheel.rotation.z = THREE.MathUtils.damp(rig.steeringWheel.rotation.z, -steerAngle * 1.4, 14, dt);

  // Chassis body roll into turns + subtle engine rumble
  const rollTarget = THREE.MathUtils.clamp(-steer * Math.min(1, Math.abs(speed) / 260) * 0.14, -0.14, 0.14);
  rig.chassisPivot.rotation.z = THREE.MathUtils.damp(rig.chassisPivot.rotation.z, rollTarget, 10, dt);
  rig.chassisPivot.position.y = Math.sin(elapsedTime * 26) * (Math.abs(speed) > 25 ? 0.012 : 0.004);
  rig.driverHead.rotation.y = THREE.MathUtils.damp(rig.driverHead.rotation.y, steerAngle * 0.45, 10, dt);

  // Boost flames flicker
  rig.boostFlames.forEach((f, idx) => {
    f.visible = boosting;
    if (boosting) {
      const flicker = 0.85 + Math.sin(elapsedTime * 42 + idx * 1.7) * 0.28;
      f.scale.set(1, flicker, 1);
    }
  });

  const ringMat = rig.nitroRing.material as THREE.MeshBasicMaterial;
  ringMat.color.set(boosting ? '#22d3ee' : '#38bdf8');
  ringMat.opacity = boosting ? 0.82 : 0.45;
}

export interface ShooterTargetMesh {
  group: THREE.Group;
  coreMesh: THREE.Object3D;
  ringMesh: THREE.Object3D;
  kind: 'drone' | 'bullseye';
}

export function buildShooterTargetMesh(
  kind: 'drone' | 'bullseye',
  accentHex: string
): ShooterTargetMesh {
  const group = new THREE.Group();

  if (kind === 'bullseye') {
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.11, 10, 26),
      new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        emissive: '#38bdf8',
        emissiveIntensity: 0.45,
        roughness: 0.25,
      })
    );
    outer.position.y = 1.25;

    const mid = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.09, 10, 22),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.65,
        roughness: 0.2,
      })
    );
    mid.position.y = 1.25;

    const bull = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#f59e0b',
        emissiveIntensity: 0.9,
        roughness: 0.15,
      })
    );
    bull.position.y = 1.25;

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.26, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5, metalness: 0.5 })
    );
    stand.position.y = 0.28;

    group.add(stand, outer, mid, bull);
    return { group, coreMesh: bull, ringMesh: outer, kind };
  }

  // Hovering Cryo Drone
  const coreMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.54, 0),
    new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      emissive: accentHex,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.25,
      clearcoat: 1.0,
    })
  );
  coreMesh.position.y = 1.15;
  coreMesh.castShadow = true;

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#f43f5e' })
  );
  eye.position.set(0, 1.15, 0.45);

  const ringMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.06, 8, 24),
    new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.25,
    })
  );
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 1.15;

  const shadowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.52, 20),
    new THREE.MeshBasicMaterial({
      color: '#f43f5e',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    })
  );
  shadowRing.rotation.x = -Math.PI / 2;
  shadowRing.position.y = 0.04;

  group.add(coreMesh, eye, ringMesh, shadowRing);
  return { group, coreMesh, ringMesh, kind };
}

export function buildAimReticle(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: '#22d3ee',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });

  const outer = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.66, 24), mat);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.06;

  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), mat);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.065;

  g.add(outer, inner);
  return g;
}
