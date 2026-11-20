import * as THREE from 'three';
import type { GameModeId, MapId } from '../types';
import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  getMapObstacles,
  getRaceTrackObstacles,
  getRaceTrackWaypoints,
  getRunnerRouteWaypoints,
} from '../data/gameCatalog';

function createMapFloorTexture(mapId: MapId, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 28, 256, 256, 256);
  if (mapId === 'volcanic_springs') {
    grad.addColorStop(0, '#31201d');
    grad.addColorStop(0.55, '#1f161a');
    grad.addColorStop(1, '#120d12');
  } else if (mapId === 'aurora_summit') {
    grad.addColorStop(0, '#134e5e');
    grad.addColorStop(0.52, '#1a2f5a');
    grad.addColorStop(1, '#121536');
  } else {
    grad.addColorStop(0, '#1a5a88');
    grad.addColorStop(0.55, '#0f395c');
    grad.addColorStop(1, '#09233b');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Surface cracks / magma veins / aurora runes
  const ringStroke =
    mapId === 'volcanic_springs'
      ? 'rgba(251, 146, 60, 0.24)'
      : mapId === 'aurora_summit'
      ? 'rgba(45, 212, 191, 0.25)'
      : 'rgba(125, 211, 252, 0.22)';

  ctx.strokeStyle = ringStroke;
  ctx.lineWidth = 2.2;
  [85, 162, 232].forEach((r) => {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Cracks / veins radiating outward
  ctx.strokeStyle =
    mapId === 'volcanic_springs'
      ? 'rgba(249, 115, 22, 0.28)'
      : mapId === 'aurora_summit'
      ? 'rgba(192, 132, 252, 0.18)'
      : 'rgba(186, 230, 253, 0.16)';
  ctx.lineWidth = mapId === 'volcanic_springs' ? 2.4 : 1.5;

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const midR = 135 + (i % 3) * 18;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * 42, 256 + Math.sin(a) * 42);
    ctx.lineTo(256 + Math.cos(a + 0.08) * midR, 256 + Math.sin(a + 0.08) * midR);
    ctx.lineTo(256 + Math.cos(a - 0.06) * 246, 256 + Math.sin(a - 0.06) * 246);
    ctx.stroke();
  }

  // Subtle crystalline frost / basalt speckle
  for (let i = 0; i < 420; i++) {
    const px = ((i * 73) % 512);
    const py = ((i * 151) % 512);
    ctx.fillStyle =
      mapId === 'volcanic_springs'
        ? i % 5 === 0
          ? 'rgba(251, 146, 60, 0.14)'
          : 'rgba(255, 255, 255, 0.03)'
        : 'rgba(224, 242, 254, 0.06)';
    ctx.fillRect(px, py, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildCenterWell(mapId: MapId): {
  wellGroup: THREE.Group;
  waterDisc: THREE.Mesh;
  depositRing: THREE.Mesh;
  floatingPrism?: THREE.Mesh;
  blessingBeamMat: THREE.ShaderMaterial;
  blessingHaloMat: THREE.ShaderMaterial;
  blessingMotesMat: THREE.ShaderMaterial;
  blessingGroup: THREE.Group;
} {
  const wellGroup = new THREE.Group();

  const stoneHex =
    mapId === 'volcanic_springs'
      ? '#292524'
      : mapId === 'aurora_summit'
      ? '#334155'
      : '#475569';
  const rimHex =
    mapId === 'volcanic_springs'
      ? '#78350f'
      : mapId === 'aurora_summit'
      ? '#a5f3fc'
      : '#f1f5f9';
  const waterHex =
    mapId === 'volcanic_springs'
      ? '#38bdf8'
      : mapId === 'aurora_summit'
      ? '#2dd4bf'
      : '#38bdf8';
  const emissiveHex =
    mapId === 'volcanic_springs'
      ? '#f97316'
      : mapId === 'aurora_summit'
      ? '#8b5cf6'
      : '#0284c7';

  const stoneMat = new THREE.MeshStandardMaterial({
    color: stoneHex,
    roughness: 0.86,
    metalness: 0.08,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: rimHex,
    roughness: mapId === 'aurora_summit' ? 0.22 : 0.88,
    metalness: mapId === 'aurora_summit' ? 0.15 : 0.0,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: mapId === 'volcanic_springs' ? '#451a03' : '#78350f',
    roughness: 0.8,
  });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: waterHex,
    emissive: emissiveHex,
    emissiveIntensity: 0.75,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const curb = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.34, 0.65, 12), stoneMat);
  curb.position.y = 0.325;
  curb.castShadow = true;
  curb.receiveShadow = true;
  wellGroup.add(curb);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.16, 8, 20), capMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.66;
  rim.castShadow = true;
  wellGroup.add(rim);

  const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(1.02, 24), waterMat);
  waterDisc.rotation.x = -Math.PI / 2;
  waterDisc.position.y = 0.58;
  wellGroup.add(waterDisc);

  [-0.95, 0.95].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.75, 8), woodMat);
    post.position.set(x, 1.35, 0);
    post.castShadow = true;
    wellGroup.add(post);
  });

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.0, 8), woodMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.98;
  wellGroup.add(bar);

  const pulley = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.04, 8, 16),
    new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.7, roughness: 0.3 })
  );
  pulley.rotation.y = Math.PI / 2;
  pulley.position.y = 1.98;
  wellGroup.add(pulley);

  const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 1.5), woodMat);
  roofLeft.position.set(-0.55, 2.38, 0);
  roofLeft.rotation.z = 0.48;
  roofLeft.castShadow = true;
  wellGroup.add(roofLeft);

  const roofRight = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 1.5), woodMat);
  roofRight.position.set(0.55, 2.38, 0);
  roofRight.rotation.z = -0.48;
  roofRight.castShadow = true;
  wellGroup.add(roofRight);

  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.42, 4), capMat);
  snowCap.rotation.y = Math.PI / 4;
  snowCap.position.y = 2.68;
  wellGroup.add(snowCap);

  // Deposit Zone Halo around the Central Well so players know where to bank Glacial Drops
  const depositRing = new THREE.Mesh(
    new THREE.RingGeometry(2.35, 2.62, 48),
    new THREE.MeshBasicMaterial({
      color: mapId === 'volcanic_springs' ? '#fb923c' : '#22d3ee',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  depositRing.rotation.x = -Math.PI / 2;
  depositRing.position.y = 0.028;
  wellGroup.add(depositRing);

  let floatingPrism: THREE.Mesh | undefined;
  if (mapId === 'aurora_summit') {
    floatingPrism = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshPhysicalMaterial({
        color: '#a5f3fc',
        emissive: '#2dd4bf',
        emissiveIntensity: 0.8,
        roughness: 0.08,
        clearcoat: 1.0,
      })
    );
    floatingPrism.position.y = 3.55;
    wellGroup.add(floatingPrism);
  }

  // Well Ritual 3D Visual Blessing Effect (Light Shaft Shader + Ground Aura + Rising Blessing Motes)
  const blessingGroup = new THREE.Group();
  blessingGroup.visible = false;
  wellGroup.add(blessingGroup);

  const blessingBeamMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uColorA: { value: new THREE.Color('#22d3ee') },
      uColorB: { value: new THREE.Color('#fde047') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;
      void main() {
        float spiral = 0.5 + 0.5 * sin(vUv.x * 18.8495 - uTime * 4.5 + vUv.y * 8.0);
        float ribbon = 0.5 + 0.5 * cos(vUv.x * 12.566 + uTime * 3.0 - vUv.y * 5.0);
        float vFade = smoothstep(0.0, 0.14, vUv.y) * pow(1.0 - vUv.y, 1.35);
        vec3 col = mix(uColorA, uColorB, 0.35 + 0.55 * spiral);
        float alpha = vFade * (0.28 + 0.52 * spiral * ribbon) * uStrength;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const blessingBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 2.25, 7.2, 32, 1, true),
    blessingBeamMat
  );
  blessingBeam.position.y = 3.6;
  blessingGroup.add(blessingBeam);

  const blessingHaloMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uColorInner: { value: new THREE.Color('#67e8f9') },
      uColorOuter: { value: new THREE.Color('#fbbf24') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uColorInner;
      uniform vec3 uColorOuter;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float angle = atan(c.y, c.x);
        float wave = sin(r * 14.0 - uTime * 5.5) * 0.5 + 0.5;
        float runes = 0.5 + 0.5 * sin(angle * 12.0 + uTime * 3.2);
        float ring = smoothstep(0.26, 0.42, r) * (1.0 - smoothstep(0.78, 1.0, r));
        vec3 col = mix(uColorInner, uColorOuter, wave * 0.7 + runes * 0.3);
        gl_FragColor = vec4(col, ring * (0.35 + 0.5 * wave) * uStrength);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const blessingHalo = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 7.8), blessingHaloMat);
  blessingHalo.rotation.x = -Math.PI / 2;
  blessingHalo.position.y = 0.036;
  blessingGroup.add(blessingHalo);

  const moteCount = 96;
  const mPos = new Float32Array(moteCount * 3);
  const mSeed = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const a = (i / moteCount) * Math.PI * 2;
    const rad = 0.9 + Math.random() * 2.3;
    mPos[i * 3] = Math.cos(a) * rad;
    mPos[i * 3 + 1] = Math.random() * 5.5;
    mPos[i * 3 + 2] = Math.sin(a) * rad;
    mSeed[i * 3] = a;
    mSeed[i * 3 + 1] = 0.8 + Math.random() * 1.1;
    mSeed[i * 3 + 2] = Math.random();
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute('aSeed', new THREE.BufferAttribute(mSeed, 3));

  const blessingMotesMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      attribute vec3 aSeed;
      varying float vMix;
      void main() {
        float ang = aSeed.x + uTime * 1.4 * aSeed.y;
        float h = mod(position.y + uTime * 2.2 * aSeed.y, 6.2);
        float rad = mix(2.4, 0.85, h / 6.2) + sin(uTime * 3.0 + aSeed.x) * 0.22;
        vec3 pos = vec3(cos(ang) * rad, h + 0.25, sin(ang) * rad);
        vMix = aSeed.z;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp((74.0 + aSeed.z * 48.0) / max(1.0, -mv.z), 3.0, 20.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uStrength;
      varying float vMix;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.05, d);
        vec3 col = mix(vec3(0.22, 0.92, 0.98), vec3(1.0, 0.88, 0.32), vMix);
        gl_FragColor = vec4(col, soft * uStrength);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const blessingMotes = new THREE.Points(mGeo, blessingMotesMat);
  blessingMotes.frustumCulled = false;
  blessingGroup.add(blessingMotes);

  return {
    wellGroup,
    waterDisc,
    depositRing,
    floatingPrism,
    blessingBeamMat,
    blessingHaloMat,
    blessingMotesMat,
    blessingGroup,
  };
}

export interface ArenaEnvironmentHandles {
  group: THREE.Group;
  ringWall: THREE.Mesh;
  ringFloor: THREE.Mesh;
  waterDisc: THREE.Mesh;
  depositRing: THREE.Mesh;
  skyColorHex: string;
  update: (
    time: number,
    dt: number,
    ringRadiusWorld: number,
    bankReady?: boolean,
    blessingActive?: boolean
  ) => void;
}

/**
 * Builds the 3D arena environment tailored to the selected MapId:
 * - glacier_well: Classic frozen lake, snowy hills, instanced pines & cyan crystals, snowfall
 * - volcanic_springs: Basalt caldera, magma ridges, obsidian spires, rising embers
 * - aurora_summit: Mirror crystal plateau, glowing prism spires, overhead Aurora ribbons, stardust
 */
export function buildArcticEnvironment(
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  mapId: MapId = 'glacier_well',
  gameMode: GameModeId = 'survival'
): ArenaEnvironmentHandles {
  const group = new THREE.Group();

  const isRacing = gameMode === 'car_racing';

  const skyColorHex =
    mapId === 'volcanic_springs'
      ? '#160b10'
      : mapId === 'aurora_summit'
      ? '#0a0f26'
      : '#071324';

  // Precompute race curve early so racing terrain sculpts cleanly around the long Beach-Buggy track
  const raceWaypoints = isRacing ? getRaceTrackWaypoints(mapId) : [];
  const raceCurvePts = raceWaypoints.map(
    (wp) => new THREE.Vector3((wp.x - ARENA_CENTER_X) / 25, 0.024, (wp.y - ARENA_CENTER_Y) / 25)
  );
  const raceCurve = isRacing
    ? new THREE.CatmullRomCurve3(raceCurvePts, true, 'catmullrom', 0.5)
    : null;
  const sampledTrackPts = raceCurve ? raceCurve.getPoints(180) : [];

  const distToTrackXZ = (wx: number, wz: number): number => {
    let minSq = Infinity;
    for (let i = 0; i < sampledTrackPts.length; i++) {
      const p = sampledTrackPts[i];
      const dx = wx - p.x;
      const dz = wz - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minSq) minSq = dSq;
    }
    return Math.sqrt(minSq);
  };

  // 1. Expanded Terrain (360x360 for Arena; 460x320 sculpted Beach-Buggy landscape for Racing)
  const terrainGeo = isRacing
    ? new THREE.PlaneGeometry(460, 320, 92, 68)
    : new THREE.PlaneGeometry(360, 360, 72, 72);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (isRacing) {
      const dTrack = distToTrackXZ(x, z);
      if (dTrack < 6.4) {
        pos.setY(i, -0.05);
      } else {
        const bank = Math.min(1, (dTrack - 6.4) / 14.0);
        const dune =
          mapId === 'volcanic_springs'
            ? Math.abs(Math.sin(x * 0.07) * Math.cos(z * 0.07)) * 4.8 + bank * 3.8
            : Math.sin(x * 0.065) * Math.cos(z * 0.065) * 3.2 +
              Math.sin((x + z) * 0.09) * 1.4 +
              bank * 2.6;
        pos.setY(i, Math.max(-0.04, dune * bank));
      }
    } else {
      const r = Math.hypot(x, z);
      if (r > 33.5) {
        const bank = Math.min(1, (r - 33.5) / 22.0);
        const ridge =
          mapId === 'volcanic_springs'
            ? Math.abs(Math.sin(x * 0.1) * Math.cos(z * 0.1)) * 4.4 + bank * 6.0
            : Math.sin(x * 0.09) * Math.cos(z * 0.09) * 3.0 + Math.sin(r * 0.15) * 1.3 + bank * 5.2;
        pos.setY(i, Math.max(0.05, ridge * bank));
      } else {
        pos.setY(i, -0.05);
      }
    }
  }
  terrainGeo.computeVertexNormals();

  const terrainColor = isRacing
    ? mapId === 'volcanic_springs'
      ? '#2d1e1b'
      : mapId === 'aurora_summit'
      ? '#475569'
      : '#dbeafe'
    : mapId === 'volcanic_springs'
    ? '#272026'
    : mapId === 'aurora_summit'
    ? '#94a3b8'
    : '#cbd5e1';

  const outerTerrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      color: terrainColor,
      roughness: isRacing ? 0.88 : 0.92,
      metalness: 0.04,
    })
  );
  outerTerrain.receiveShadow = true;
  group.add(outerTerrain);

  // 2. Playable Arena Disc (34 world units radius -> 68 units diameter!) — hidden in Racing for open Beach-Buggy terrain
  const floorTex = createMapFloorTexture(mapId, maxAnisotropy);
  const lakeDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34.0, 84),
    new THREE.MeshPhysicalMaterial({
      map: floorTex,
      roughness: mapId === 'volcanic_springs' ? 0.65 : mapId === 'aurora_summit' ? 0.14 : 0.24,
      metalness: mapId === 'volcanic_springs' ? 0.08 : 0.14,
      clearcoat: mapId === 'volcanic_springs' ? 0.05 : mapId === 'aurora_summit' ? 0.85 : 0.65,
      clearcoatRoughness: mapId === 'aurora_summit' ? 0.12 : 0.25,
    })
  );
  lakeDisc.rotation.x = -Math.PI / 2;
  lakeDisc.position.y = 0.0;
  lakeDisc.receiveShadow = true;
  lakeDisc.visible = !isRacing;
  group.add(lakeDisc);

  // 3. Central 3D Well Landmark + Well Ritual Blessing Effect (Survival & Shooter arenas)
  const {
    wellGroup,
    waterDisc,
    depositRing,
    floatingPrism,
    blessingBeamMat,
    blessingHaloMat,
    blessingMotesMat,
    blessingGroup,
  } = buildCenterWell(mapId);
  wellGroup.visible = !isRacing;
  group.add(wellGroup);

  // 3b. Unique In-Arena 3D Obstacles per Map (Glacial Icebergs / Basalt Pillars / Aurora Obelisks)
  const obstaclesGroup = new THREE.Group();
  const animatedObelisks: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
  const animatedEmbers: THREE.MeshStandardMaterial[] = [];

  const mapObstacles = getMapObstacles(mapId);
  mapObstacles.forEach((obs, idx) => {
    const wx = (obs.x - ARENA_CENTER_X) / 25;
    const wz = (obs.y - ARENA_CENTER_Y) / 25;
    const wr = obs.radius / 25;
    const og = new THREE.Group();
    og.position.set(wx, 0, wz);

    if (obs.kind === 'basalt_pillar') {
      const rockMat = new THREE.MeshStandardMaterial({
        color: '#2a2422',
        roughness: 0.88,
        metalness: 0.14,
      });
      const darkBaseMat = new THREE.MeshStandardMaterial({
        color: '#171312',
        roughness: 0.94,
      });
      const emberMat = new THREE.MeshStandardMaterial({
        color: '#fb923c',
        emissive: '#ea580c',
        emissiveIntensity: 0.9,
        roughness: 0.32,
      });
      animatedEmbers.push(emberMat);

      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.95, wr * 1.14, 0.42, 7),
        darkBaseMat
      );
      plinth.position.y = 0.21;
      plinth.castShadow = !isSoftwareGl;
      plinth.receiveShadow = true;

      const colH = obs.height * 1.48;
      // Clustered multi-column volcanic basalt rock formation
      const mainCol = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.56, wr * 0.74, colH, 6),
        rockMat
      );
      mainCol.position.set(0, colH * 0.5 + 0.16, 0);
      mainCol.rotation.y = idx * 0.5;
      mainCol.castShadow = !isSoftwareGl;
      mainCol.receiveShadow = true;

      const subColA = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.32, wr * 0.48, colH * 0.68, 6),
        darkBaseMat
      );
      subColA.position.set(-wr * 0.42, colH * 0.34 + 0.12, wr * 0.2);
      subColA.rotation.z = 0.12;
      subColA.castShadow = !isSoftwareGl;

      const subColB = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.28, wr * 0.42, colH * 0.52, 6),
        rockMat
      );
      subColB.position.set(wr * 0.44, colH * 0.26 + 0.12, -wr * 0.24);
      subColB.rotation.z = -0.15;
      subColB.castShadow = !isSoftwareGl;

      const magmaCollar = new THREE.Mesh(
        new THREE.TorusGeometry(wr * 0.74, 0.085, 6, 18),
        emberMat
      );
      magmaCollar.rotation.x = Math.PI / 2;
      magmaCollar.position.y = 0.46;

      const emberCrown = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.38, wr * 0.54, 0.18, 6),
        emberMat
      );
      emberCrown.position.y = colH + 0.18;

      const heatRing = new THREE.Mesh(
        new THREE.RingGeometry(wr * 0.98, wr * 1.14, 24),
        new THREE.MeshBasicMaterial({
          color: '#fb923c',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        })
      );
      heatRing.rotation.x = -Math.PI / 2;
      heatRing.position.y = 0.025;

      og.add(plinth, mainCol, subColA, subColB, magmaCollar, emberCrown, heatRing);
    } else if (obs.kind === 'aurora_obelisk') {
      const pedMat = new THREE.MeshStandardMaterial({
        color: '#1e1b4b',
        roughness: 0.55,
        metalness: 0.32,
      });
      const crystalObsMat = new THREE.MeshPhysicalMaterial({
        color: '#99f6e4',
        emissive: '#8b5cf6',
        emissiveIntensity: 0.65,
        roughness: 0.1,
        metalness: 0.15,
        clearcoat: 1.0,
      });
      const violetRingMat = new THREE.MeshStandardMaterial({
        color: '#c084fc',
        emissive: '#7c3aed',
        emissiveIntensity: 0.58,
        roughness: 0.25,
      });

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.78, wr * 1.02, 0.4, 8),
        pedMat
      );
      base.position.y = 0.2;
      base.castShadow = !isSoftwareGl;
      base.receiveShadow = true;

      // Four carved shrine buttress fins around pedestal
      for (let f = 0; f < 4; f++) {
        const ang = (f / 4) * Math.PI * 2 + Math.PI * 0.25;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(wr * 0.24, 1.15, wr * 0.38), pedMat);
        fin.position.set(Math.cos(ang) * wr * 0.68, 0.62, Math.sin(ang) * wr * 0.68);
        fin.rotation.y = -ang;
        fin.castShadow = !isSoftwareGl;
        og.add(fin);
      }

      const runeRing = new THREE.Mesh(
        new THREE.RingGeometry(wr * 0.94, wr * 1.1, 24),
        new THREE.MeshBasicMaterial({
          color: '#2dd4bf',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.58,
          depthWrite: false,
        })
      );
      runeRing.rotation.x = -Math.PI / 2;
      runeRing.position.y = 0.026;

      const crystalGeo = new THREE.OctahedronGeometry(wr * 0.56, 0);
      crystalGeo.scale(0.88, obs.height * 0.96, 0.88);
      const obeliskCrystal = new THREE.Mesh(crystalGeo, crystalObsMat);
      const baseY = 1.72;
      obeliskCrystal.position.y = baseY;
      obeliskCrystal.castShadow = !isSoftwareGl;
      animatedObelisks.push({ mesh: obeliskCrystal, baseY, phase: idx * 1.1 });

      const haloTorus = new THREE.Mesh(
        new THREE.TorusGeometry(wr * 0.78, 0.052, 6, 22),
        violetRingMat
      );
      haloTorus.rotation.x = Math.PI / 2;
      haloTorus.position.y = 0.52;

      og.add(base, runeRing, obeliskCrystal, haloTorus);
    } else {
      // glacier_well: Multi-spire faceted glacial iceberg massif with snowbank shelf
      const snowMat = new THREE.MeshStandardMaterial({
        color: '#e2e8f0',
        roughness: 0.88,
      });
      const glacierMat = new THREE.MeshPhysicalMaterial({
        color: '#7dd3fc',
        emissive: '#0284c7',
        emissiveIntensity: 0.3,
        roughness: 0.14,
        metalness: 0.08,
        clearcoat: 1.0,
      });

      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.88, wr * 1.08, 0.38, 8),
        snowMat
      );
      skirt.position.y = 0.19;
      skirt.castShadow = !isSoftwareGl;
      skirt.receiveShadow = true;

      const mainSpire = new THREE.Mesh(
        new THREE.ConeGeometry(wr * 0.66, obs.height * 1.62, 6),
        glacierMat
      );
      mainSpire.position.set(0, obs.height * 0.81 + 0.18, 0);
      mainSpire.rotation.y = idx * 0.8;
      mainSpire.castShadow = !isSoftwareGl;
      mainSpire.receiveShadow = true;

      const shardConfigs = [
        { x: wr * 0.36, z: wr * 0.18, s: 0.68, rz: -0.28, rx: 0.14 },
        { x: -wr * 0.34, z: -wr * 0.22, s: 0.56, rz: 0.26, rx: -0.18 },
        { x: -wr * 0.12, z: wr * 0.4, s: 0.48, rz: 0.12, rx: 0.28 },
      ];
      shardConfigs.forEach((sc) => {
        const shard = new THREE.Mesh(
          new THREE.ConeGeometry(wr * 0.42 * sc.s, obs.height * 1.12 * sc.s, 5),
          glacierMat
        );
        shard.position.set(sc.x, obs.height * 0.52 * sc.s + 0.18, sc.z);
        shard.rotation.set(sc.rx, idx, sc.rz);
        shard.castShadow = !isSoftwareGl;
        og.add(shard);
      });

      const frostHalo = new THREE.Mesh(
        new THREE.RingGeometry(wr * 0.98, wr * 1.12, 24),
        new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        })
      );
      frostHalo.rotation.x = -Math.PI / 2;
      frostHalo.position.y = 0.025;

      og.add(skirt, mainSpire, frostHalo);
    }

    obstaclesGroup.add(og);
  });
  obstaclesGroup.visible = !isRacing;
  group.add(obstaclesGroup);

  // 4. Instanced Perimeter / Trackside Props
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  const propCount = isRacing ? 140 : 96;
  const propGeo =
    mapId === 'volcanic_springs'
      ? new THREE.ConeGeometry(1.15, 4.2, 5)
      : mapId === 'aurora_summit'
      ? new THREE.CylinderGeometry(0.36, 0.85, 3.8, 6)
      : new THREE.ConeGeometry(1.08, 3.3, 7);
  propGeo.translate(0, 1.5, 0);

  const propMat =
    mapId === 'volcanic_springs'
      ? new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.82, metalness: 0.14 })
      : mapId === 'aurora_summit'
      ? new THREE.MeshPhysicalMaterial({
          color: '#38bdf8',
          emissive: '#0ea5e9',
          emissiveIntensity: 0.25,
          roughness: 0.18,
          clearcoat: 0.9,
        })
      : new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.88 });

  const perimeterProps = new THREE.InstancedMesh(propGeo, propMat, propCount);
  perimeterProps.castShadow = !isSoftwareGl;
  perimeterProps.receiveShadow = true;

  let placedProps = 0;
  if (isRacing) {
    for (let i = 0; i < 420 && placedProps < propCount; i++) {
      const rx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const rz = ((Math.sin(i * 78.233) * 19341.123) % 1 + 1) % 1;
      const px = (rx - 0.5) * 168;
      const pz = (rz - 0.5) * 108;
      if (distToTrackXZ(px, pz) < 6.4) continue;
      dummy.position.set(px, 0.15, pz);
      const sc = 1.05 + (placedProps % 5) * 0.24;
      dummy.scale.set(sc, sc * (0.95 + (placedProps % 3) * 0.2), sc);
      dummy.rotation.y = rx * Math.PI * 2;
      dummy.updateMatrix();
      perimeterProps.setMatrixAt(placedProps, dummy.matrix);

      if (mapId === 'volcanic_springs') {
        tint.setHSL(0.05, 0.24, 0.16 + (placedProps % 4) * 0.04);
      } else if (mapId === 'aurora_summit') {
        tint.setHSL(placedProps % 2 === 0 ? 0.5 : 0.75, 0.65, 0.48 + (placedProps % 3) * 0.06);
      } else {
        tint.setHSL(0.42 + (placedProps % 3) * 0.03, 0.36, 0.24 + (placedProps % 4) * 0.05);
      }
      perimeterProps.setColorAt(placedProps, tint);
      placedProps += 1;
    }
    perimeterProps.count = placedProps;
  } else {
    for (let i = 0; i < propCount; i++) {
      const angle = (i / propCount) * Math.PI * 2 + (i % 3) * 0.08;
      const dist = 37.0 + (i % 4) * 4.4;
      dummy.position.set(Math.cos(angle) * dist, 0.75, Math.sin(angle) * dist);
      const sc = 1.05 + (i % 5) * 0.22;
      dummy.scale.set(sc, sc * (0.95 + (i % 3) * 0.18), sc);
      dummy.rotation.y = angle;
      dummy.updateMatrix();
      perimeterProps.setMatrixAt(i, dummy.matrix);

      if (mapId === 'volcanic_springs') {
        tint.setHSL(0.05, 0.24, 0.16 + (i % 4) * 0.04);
      } else if (mapId === 'aurora_summit') {
        tint.setHSL(i % 2 === 0 ? 0.5 : 0.75, 0.65, 0.48 + (i % 3) * 0.06);
      } else {
        tint.setHSL(0.42 + (i % 3) * 0.03, 0.36, 0.24 + (i % 4) * 0.05);
      }
      perimeterProps.setColorAt(i, tint);
    }
  }
  perimeterProps.instanceMatrix.needsUpdate = true;
  if (perimeterProps.instanceColor) perimeterProps.instanceColor.needsUpdate = true;
  perimeterProps.computeBoundingSphere();
  group.add(perimeterProps);

  // 5. Instanced Rim Crystals (Cyan ice / Magma amber / Aurora violet)
  const crystalCount = isRacing ? 0 : 64;
  if (crystalCount > 0) {
    const crystalGeo = new THREE.ConeGeometry(0.45, 1.85, 5);
    crystalGeo.translate(0, 0.78, 0);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color:
        mapId === 'volcanic_springs'
          ? '#fb923c'
          : mapId === 'aurora_summit'
          ? '#2dd4bf'
          : '#38bdf8',
      emissive:
        mapId === 'volcanic_springs'
          ? '#ea580c'
          : mapId === 'aurora_summit'
          ? '#7c3aed'
          : '#0284c7',
      emissiveIntensity: 0.55,
      roughness: 0.14,
      metalness: 0.12,
      clearcoat: 1.0,
    });
    const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
    for (let i = 0; i < crystalCount; i++) {
      const a = (i / crystalCount) * Math.PI * 2;
      const r = 33.2 + (i % 3) * 1.1;
      dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const sc = 0.85 + (i % 4) * 0.25;
      dummy.scale.set(sc, sc, sc);
      dummy.rotation.set(i % 2 ? 0.18 : -0.15, a, 0.12);
      dummy.updateMatrix();
      crystals.setMatrixAt(i, dummy.matrix);
    }
    crystals.instanceMatrix.needsUpdate = true;
    crystals.computeBoundingSphere();
    group.add(crystals);
  }

  // 5b. Aurora Borealis Sky Curtain Shaders for Aurora Summit
  const shaderMaterialsToTick: THREE.ShaderMaterial[] = [];

  if (mapId === 'aurora_summit') {
    const createAuroraCurtain = (
      zPos: number,
      yPos: number,
      yaw: number,
      phaseOffset: number,
      width: number,
      height: number
    ) => {
      const geo = new THREE.PlaneGeometry(width, height, 64, 12);
      // Curve curtain into a sweeping panoramic arc behind & above the arena
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i);
        const normX = px / (width * 0.5);
        p.setZ(i, p.getZ(i) + normX * normX * 9.5);
      }
      geo.computeVertexNormals();

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: phaseOffset },
          uColorLow: { value: new THREE.Color('#2dd4bf') },
          uColorMid: { value: new THREE.Color('#38bdf8') },
          uColorHigh: { value: new THREE.Color('#a855f7') },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uPhase;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            vUv = uv;
            vec3 pos = position;
            float w1 = sin(uv.x * 7.5 + uTime * 0.55 + uPhase) * 1.8;
            float w2 = cos(uv.x * 13.0 - uTime * 0.4 + uPhase * 1.7) * 0.85;
            pos.z += w1 + w2;
            pos.y += sin(uv.x * 5.0 + uTime * 0.45 + uPhase) * 0.75;
            vWave = (w1 + w2) * 0.25 + 0.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uPhase;
          uniform vec3 uColorLow;
          uniform vec3 uColorMid;
          uniform vec3 uColorHigh;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            // Vertical curtain rays & undulating ribbons
            float warp = sin(vUv.x * 9.0 + uTime * 0.35 + uPhase) * 0.18;
            float rays1 = pow(0.5 + 0.5 * sin((vUv.x + warp) * 28.0 + uTime * 0.8 + uPhase), 2.2);
            float rays2 = pow(0.5 + 0.5 * sin((vUv.x - warp * 0.7) * 44.0 - uTime * 1.15), 3.0);
            float rays = mix(rays1, rays2, 0.45) * (0.65 + 0.35 * vWave);

            // Vertical & horizontal soft edge fade
            float edgeX = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
            float bottomGlow = smoothstep(0.0, 0.22, vUv.y);
            float topFade = pow(1.0 - smoothstep(0.25, 1.0, vUv.y), 1.45);
            float alpha = edgeX * bottomGlow * topFade * (0.28 + 0.58 * rays);

            vec3 col = mix(uColorLow, uColorMid, smoothstep(0.1, 0.55, vUv.y));
            col = mix(col, uColorHigh, smoothstep(0.45, 0.92, vUv.y));
            col += vec3(0.18, 0.32, 0.28) * rays2 * (1.0 - vUv.y);

            gl_FragColor = vec4(col, alpha * 0.82);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const curtain = new THREE.Mesh(geo, mat);
      curtain.position.set(0, yPos, zPos);
      curtain.rotation.y = yaw;
      group.add(curtain);
      shaderMaterialsToTick.push(mat);
    };

    createAuroraCurtain(-56, 22.5, 0.08, 0.0, 124, 22);
    createAuroraCurtain(-45, 25.5, -0.22, 2.3, 106, 18);
  }

  // 5c. Geothermal Caldera Glow Ring Shader for Volcanic Spring
  if (mapId === 'volcanic_springs' && !isRacing) {
    const magmaRingMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorInner: { value: new THREE.Color('#fb923c') },
        uColorOuter: { value: new THREE.Color('#dc2626') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        varying vec2 vUv;
        void main() {
          vec2 c = vUv - 0.5;
          float r = length(c) * 2.0;
          float angle = atan(c.y, c.x);
          float pulse = 0.5 + 0.5 * sin(angle * 10.0 + uTime * 2.2) * cos(angle * 6.0 - uTime * 1.5);
          float band = smoothstep(0.84, 0.94, r) * (1.0 - smoothstep(0.95, 1.0, r));
          vec3 col = mix(uColorOuter, uColorInner, pulse);
          gl_FragColor = vec4(col, band * (0.35 + 0.4 * pulse));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const magmaRing = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), magmaRingMat);
    magmaRing.rotation.x = -Math.PI / 2;
    magmaRing.position.y = 0.018;
    group.add(magmaRing);
    shaderMaterialsToTick.push(magmaRingMat);
  }

  // 5d. Long Beach-Buggy Racing Ribbon, Start/Finish Checkered Arch, 4 Checkpoint Gates & Boost Pads
  if (isRacing && raceCurve) {
    const wps = raceWaypoints;
    const roadSamples = 320;
    const roadHalfW = 3.25;
    const curbHalfW = 3.65;
    const roadPositions: number[] = [];
    const roadUvs: number[] = [];
    const roadIndices: number[] = [];
    const curbPositions: number[] = [];
    const curbIndices: number[] = [];

    for (let i = 0; i <= roadSamples; i++) {
      const t = i / roadSamples;
      const pt = raceCurve.getPointAt(t);
      const tan = raceCurve.getTangentAt(t).normalize();
      const perp = new THREE.Vector3(-tan.z, 0, tan.x);

      const left = pt.clone().addScaledVector(perp, roadHalfW);
      const right = pt.clone().addScaledVector(perp, -roadHalfW);
      roadPositions.push(left.x, 0.024, left.z, right.x, 0.024, right.z);
      roadUvs.push(0, t * 44, 1, t * 44);

      const cLeft = pt.clone().addScaledVector(perp, curbHalfW);
      const cRight = pt.clone().addScaledVector(perp, -curbHalfW);
      curbPositions.push(cLeft.x, 0.014, cLeft.z, cRight.x, 0.014, cRight.z);

      if (i < roadSamples) {
        const base = i * 2;
        roadIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        curbIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
    curbGeo.setIndex(curbIndices);
    curbGeo.computeVertexNormals();
    const curbMesh = new THREE.Mesh(
      curbGeo,
      new THREE.MeshStandardMaterial({
        color:
          mapId === 'volcanic_springs'
            ? '#ea580c'
            : mapId === 'aurora_summit'
            ? '#2dd4bf'
            : '#38bdf8',
        emissive:
          mapId === 'volcanic_springs'
            ? '#9a3412'
            : mapId === 'aurora_summit'
            ? '#0f766e'
            : '#0369a1',
        emissiveIntensity: 0.35,
        roughness: 0.6,
      })
    );
    curbMesh.receiveShadow = true;
    group.add(curbMesh);

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      color: mapId === 'volcanic_springs' ? '#1c1917' : mapId === 'aurora_summit' ? '#1e1b4b' : '#0c2742',
      roughness: 0.42,
      metalness: 0.18,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Glowing Center Racing Line
    const centerLinePts = raceCurve.getPoints(280).map((p) => new THREE.Vector3(p.x, 0.04, p.z));
    const centerLineGeo = new THREE.BufferGeometry().setFromPoints(centerLinePts);
    const centerLineMat = new THREE.LineBasicMaterial({
      color: mapId === 'volcanic_springs' ? '#fb923c' : mapId === 'aurora_summit' ? '#2dd4bf' : '#38bdf8',
      transparent: true,
      opacity: 0.72,
    });
    group.add(new THREE.LineLoop(centerLineGeo, centerLineMat));

    // Checkered Start / Finish Archway at Waypoint 0
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 256;
    checkerCanvas.height = 64;
    const cctx = checkerCanvas.getContext('2d')!;
    for (let cyi = 0; cyi < 4; cyi++) {
      for (let cxi = 0; cxi < 16; cxi++) {
        cctx.fillStyle = (cxi + cyi) % 2 === 0 ? '#f8fafc' : '#0f172a';
        cctx.fillRect(cxi * 16, cyi * 16, 16, 16);
      }
    }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    checkerTex.colorSpace = THREE.SRGBColorSpace;

    const startPt = raceCurve.getPointAt(0);
    const startTan = raceCurve.getTangentAt(0).normalize();
    const startYaw = Math.atan2(startTan.x, startTan.z);
    const gateGroup = new THREE.Group();
    gateGroup.position.set(startPt.x, 0, startPt.z);
    gateGroup.rotation.y = startYaw;

    const pillarMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.65, roughness: 0.25 });
    const neonHex = mapId === 'volcanic_springs' ? '#fb923c' : '#22d3ee';
    const bannerMat = new THREE.MeshStandardMaterial({
      map: checkerTex,
      emissive: neonHex,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    });
    [-3.45, 3.45].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 4.1, 10), pillarMat);
      pillar.position.set(px, 2.05, 0);
      pillar.castShadow = !isSoftwareGl;
      gateGroup.add(pillar);
    });
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.8, 0.36), bannerMat);
    crossbar.position.set(0, 3.85, 0);
    gateGroup.add(crossbar);

    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 0.95),
      new THREE.MeshBasicMaterial({ map: checkerTex, side: THREE.DoubleSide })
    );
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.y = 0.044;
    gateGroup.add(startLine);
    group.add(gateGroup);

    // 4 Sequential 3D Checkpoint Arches (amber/cyan beacons along the long track)
    const cpArchMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: '#fbbf24',
      emissiveIntensity: 0.72,
      roughness: 0.25,
    });
    const cpStripMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });

    wps.forEach((wp, idx) => {
      if (wp.isCheckpoint) {
        const prev = wps[(idx - 1 + wps.length) % wps.length];
        const next = wps[(idx + 1) % wps.length];
        const yaw = Math.atan2(next.x - prev.x, next.y - prev.y);
        const cpGate = new THREE.Group();
        cpGate.position.set((wp.x - ARENA_CENTER_X) / 25, 0, (wp.y - ARENA_CENTER_Y) / 25);
        cpGate.rotation.y = yaw;

        [-3.45, 3.45].forEach((px) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.7, 8), cpArchMat);
          post.position.set(px, 1.85, 0);
          post.castShadow = !isSoftwareGl;
          cpGate.add(post);
        });
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.38, 0.26), cpArchMat);
        topBeam.position.set(0, 3.55, 0);
        cpGate.add(topBeam);

        const floorStrip = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 0.55), cpStripMat);
        floorStrip.rotation.x = -Math.PI / 2;
        floorStrip.position.y = 0.044;
        cpGate.add(floorStrip);
        group.add(cpGate);
      }

      if (wp.hasBoostPad) {
        const next = wps[(idx + 1) % wps.length];
        const pad = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 3.1),
          new THREE.MeshBasicMaterial({
            color: '#22d3ee',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.86,
          })
        );
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = -Math.atan2(next.x - wp.x, next.y - wp.y);
        pad.position.set((wp.x - ARENA_CENTER_X) / 25, 0.045, (wp.y - ARENA_CENTER_Y) / 25);
        group.add(pad);
      }
    });

    // Real 3D Trackside Boulders & Chicane Cryo Pylons along the racing circuit
    const raceObsRockMat = new THREE.MeshStandardMaterial({
      color: mapId === 'volcanic_springs' ? '#292524' : '#334155',
      roughness: 0.9,
      metalness: 0.12,
    });
    const raceObsPylonMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      emissive: mapId === 'volcanic_springs' ? '#f97316' : '#f43f5e',
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.45,
    });
    const raceObsWarnMat = new THREE.MeshBasicMaterial({
      color: '#fbbf24',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });

    getRaceTrackObstacles(mapId).forEach((ro, rIdx) => {
      const wr = ro.radius / 25;
      const rg = new THREE.Group();
      rg.position.set((ro.x - ARENA_CENTER_X) / 25, 0, (ro.y - ARENA_CENTER_Y) / 25);

      const warnRing = new THREE.Mesh(
        new THREE.RingGeometry(wr * 0.88, wr * 1.06, 20),
        raceObsWarnMat
      );
      warnRing.rotation.x = -Math.PI / 2;
      warnRing.position.y = 0.046;
      rg.add(warnRing);

      if (ro.kind === 'rock') {
        const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(wr * 0.78, 0), raceObsRockMat);
        boulder.position.y = wr * 0.56;
        boulder.rotation.set(rIdx * 0.4, rIdx * 1.1, 0.2);
        boulder.scale.set(1.1, 0.92, 1.0);
        boulder.castShadow = !isSoftwareGl;
        boulder.receiveShadow = true;
        const sideBoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(wr * 0.42, 0), raceObsRockMat);
        sideBoulder.position.set(wr * 0.42, wr * 0.28, wr * 0.22);
        sideBoulder.castShadow = !isSoftwareGl;
        rg.add(boulder, sideBoulder);
      } else {
        const plinth = new THREE.Mesh(
          new THREE.CylinderGeometry(wr * 0.75, wr * 0.9, 0.35, 8),
          raceObsRockMat
        );
        plinth.position.y = 0.175;
        plinth.castShadow = !isSoftwareGl;
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(wr * 0.52, 1.85, 6),
          raceObsPylonMat
        );
        spire.position.y = 1.2;
        spire.castShadow = !isSoftwareGl;
        rg.add(plinth, spire);
      }

      group.add(rg);
    });
  }

  // Temple-run inspired relic gates give Survival its own forward-running route.
  if (gameMode === 'survival') {
    const route = getRunnerRouteWaypoints(mapId);
    const relicMat = new THREE.MeshStandardMaterial({
      color: mapId === 'volcanic_springs' ? '#7c2d12' : mapId === 'aurora_summit' ? '#5b21b6' : '#155e75',
      emissive: mapId === 'volcanic_springs' ? '#ea580c' : mapId === 'aurora_summit' ? '#7c3aed' : '#0891b2',
      emissiveIntensity: 0.42,
      roughness: 0.42,
      metalness: 0.3,
    });
    const relicGlow = new THREE.MeshBasicMaterial({
      color: mapId === 'volcanic_springs' ? '#fb923c' : mapId === 'aurora_summit' ? '#c084fc' : '#67e8f9',
      transparent: true,
      opacity: 0.8,
    });

    route.forEach((point, index) => {
      const next = route[Math.min(index + 1, route.length - 1)];
      const yaw = Math.atan2(next.x - point.x, next.y - point.y);
      const gate = new THREE.Group();
      gate.position.set((point.x - ARENA_CENTER_X) / 25, 0, (point.y - ARENA_CENTER_Y) / 25);
      gate.rotation.y = yaw;

      [-1.7, 1.7].forEach((offset) => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.5, 6), relicMat);
        pillar.position.set(offset, 1.25, 0);
        pillar.castShadow = !isSoftwareGl;
        gate.add(pillar);
      });

      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.28, 0.28), relicMat);
      lintel.position.y = 2.45;
      lintel.castShadow = !isSoftwareGl;
      gate.add(lintel);

      const marker = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 16), relicGlow);
      marker.rotation.x = Math.PI / 2;
      marker.position.y = 1.3;
      gate.add(marker);
      group.add(gate);
    });
  }

  // 6. Shrinking Boundary Ring (Blizzard / Heat Wall / Cryo Barrier)
  const wallHex =
    mapId === 'volcanic_springs'
      ? '#fb923c'
      : mapId === 'aurora_summit'
      ? '#2dd4bf'
      : '#38bdf8';

  const ringWall = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 2.3, 64, 1, true),
    new THREE.MeshBasicMaterial({
      color: wallHex,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ringWall.position.y = 1.15;
  group.add(ringWall);

  const ringFloor = new THREE.Mesh(
    new THREE.RingGeometry(0.97, 1.0, 64),
    new THREE.MeshBasicMaterial({
      color: wallHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    })
  );
  ringFloor.rotation.x = -Math.PI / 2;
  ringFloor.position.y = 0.032;
  group.add(ringFloor);

  // 7. GPU Shader-Driven Dynamic Environmental Particle Systems (scaled to larger arena & raceway)
  const mainParticleCount = mapId === 'glacier_well' ? 880 : mapId === 'volcanic_springs' ? 760 : 680;
  const pPos = new Float32Array(mainParticleCount * 3);
  const pSeed = new Float32Array(mainParticleCount * 3); // x: phase, y: speed, z: size/heat
  for (let i = 0; i < mainParticleCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * (isRacing ? 150 : 112);
    pPos[i * 3 + 1] = Math.random() * 19.5;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * (isRacing ? 104 : 96);
    pSeed[i * 3] = Math.random() * Math.PI * 2;
    pSeed[i * 3 + 1] = 0.65 + Math.random() * 0.85;
    pSeed[i * 3 + 2] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 3));

  const modeFloat = mapId === 'volcanic_springs' ? 1.0 : mapId === 'aurora_summit' ? 2.0 : 0.0;
  const particleMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: modeFloat },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uMode;
      attribute vec3 aSeed;
      varying float vHeat;
      varying float vFlicker;

      void main() {
        vec3 pos = position;
        float phase = aSeed.x;
        float spd = aSeed.y;
        float val = aSeed.z;

        if (uMode < 0.5) {
          float fallH = 19.5;
          pos.y = mod(pos.y - uTime * (2.6 * spd) + phase * 2.0, fallH);
          pos.x = mod(pos.x + uTime * (3.8 * spd) + sin(uTime * 1.6 + phase) * 1.4 + 56.0, 112.0) - 56.0;
          pos.z = mod(pos.z + uTime * (1.1 * spd) + cos(uTime * 1.3 + phase) * 0.9 + 48.0, 96.0) - 48.0;
          vFlicker = 0.72 + 0.28 * sin(uTime * 3.0 + phase * 4.0);
        } else if (uMode < 1.5) {
          float riseH = 19.5;
          pos.y = mod(pos.y + uTime * (2.1 * spd) + phase * 1.5, riseH) + 0.15;
          pos.x += sin(uTime * 1.9 + phase + pos.y * 0.35) * (1.5 + val * 1.0);
          pos.z += cos(uTime * 1.6 + phase * 1.3 + pos.y * 0.3) * (1.3 + val * 0.9);
          vFlicker = 0.55 + 0.45 * sin(uTime * 8.5 + phase * 10.0);
        } else {
          float driftH = 18.5;
          pos.y = mod(pos.y + sin(uTime * 0.45 + phase) * 0.8 + uTime * 0.38 * spd, driftH) + 0.25;
          pos.x += sin(uTime * 0.7 + phase * 2.0) * 1.8;
          pos.z += cos(uTime * 0.65 + phase * 1.7) * 1.6;
          vFlicker = 0.5 + 0.5 * sin(uTime * 4.2 + phase * 7.0);
        }

        vHeat = val;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        float baseSize = (uMode > 0.5 && uMode < 1.5) ? (68.0 + val * 62.0) : (52.0 + val * 56.0);
        gl_PointSize = clamp(baseSize / max(1.0, -mvPosition.z), 2.5, 22.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uMode;
      varying float vHeat;
      varying float vFlicker;

      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;

        float soft = smoothstep(0.5, 0.06, d);
        float core = smoothstep(0.24, 0.0, d);
        vec3 col;

        if (uMode < 0.5) {
          col = mix(vec3(0.56, 0.84, 0.99), vec3(0.95, 0.98, 1.0), core);
        } else if (uMode < 1.5) {
          vec3 emberOuter = mix(vec3(0.92, 0.25, 0.06), vec3(0.98, 0.58, 0.14), vHeat);
          col = mix(emberOuter, vec3(1.0, 0.94, 0.65), core * vFlicker);
        } else {
          vec3 auraA = vec3(0.18, 0.88, 0.78);
          vec3 auraB = vec3(0.72, 0.45, 0.98);
          col = mix(mix(auraA, auraB, vHeat), vec3(0.92, 0.99, 1.0), core * 0.7);
        }

        gl_FragColor = vec4(col, soft * vFlicker * 0.9);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const gpuParticles = new THREE.Points(pGeo, particleMat);
  gpuParticles.frustumCulled = false;
  group.add(gpuParticles);
  shaderMaterialsToTick.push(particleMat);

  // Low-altitude ground blowing frost wisps for Glacier Well
  if (mapId === 'glacier_well') {
    const gustCount = 320;
    const gPos = new Float32Array(gustCount * 3);
    const gSeed = new Float32Array(gustCount * 2);
    for (let i = 0; i < gustCount; i++) {
      gPos[i * 3] = (Math.random() - 0.5) * 78;
      gPos[i * 3 + 1] = 0.08 + Math.random() * 1.2;
      gPos[i * 3 + 2] = (Math.random() - 0.5) * 72;
      gSeed[i * 2] = Math.random() * Math.PI * 2;
      gSeed[i * 2 + 1] = 0.8 + Math.random() * 0.9;
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    gGeo.setAttribute('aSeed', new THREE.BufferAttribute(gSeed, 2));
    const gustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        attribute vec2 aSeed;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          pos.x = mod(pos.x + uTime * (7.2 * aSeed.y) + 39.0, 78.0) - 39.0;
          pos.z = mod(pos.z + sin(uTime * 1.8 + aSeed.x) * 1.6 + 36.0, 72.0) - 36.0;
          pos.y += abs(sin(uTime * 2.5 + aSeed.x)) * 0.25;
          float edgeFade = 1.0 - smoothstep(26.0, 38.0, length(pos.xz));
          vAlpha = edgeFade * (0.35 + 0.35 * sin(uTime * 3.0 + aSeed.x));
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = clamp(85.0 / max(1.0, -mvPosition.z), 3.0, 28.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          // Elongated horizontal wind streak shape
          float d = length(vec2(c.x * 0.65, c.y * 1.6));
          if (d > 0.5) discard;
          float soft = smoothstep(0.5, 0.04, d);
          gl_FragColor = vec4(0.84, 0.95, 1.0, soft * vAlpha * 0.55);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const gustPoints = new THREE.Points(gGeo, gustMat);
    gustPoints.frustumCulled = false;
    group.add(gustPoints);
    shaderMaterialsToTick.push(gustMat);
  }

  let blessingStrength = 0;

  return {
    group,
    ringWall,
    ringFloor,
    waterDisc,
    depositRing,
    skyColorHex,
    update(time, dt, ringRadiusWorld, bankReady, blessingActive = false) {
      ringWall.visible = gameMode === 'survival';
      ringFloor.visible = gameMode === 'survival';
      ringWall.scale.set(ringRadiusWorld, 1, ringRadiusWorld);
      ringFloor.scale.set(ringRadiusWorld, ringRadiusWorld, 1);

      blessingStrength = THREE.MathUtils.damp(blessingStrength, blessingActive ? 1 : 0, 5.5, dt);
      blessingGroup.visible = blessingStrength > 0.015;
      if (blessingGroup.visible) {
        blessingBeamMat.uniforms.uTime.value = time;
        blessingBeamMat.uniforms.uStrength.value = blessingStrength;
        blessingHaloMat.uniforms.uTime.value = time;
        blessingHaloMat.uniforms.uStrength.value = blessingStrength;
        blessingMotesMat.uniforms.uTime.value = time;
        blessingMotesMat.uniforms.uStrength.value = blessingStrength;
      }

      const wm = waterDisc.material as THREE.MeshPhysicalMaterial;
      wm.emissiveIntensity =
        (0.58 + Math.sin(time * 2.8) * 0.22) + blessingStrength * (0.95 + Math.sin(time * 7) * 0.25);

      const dm = depositRing.material as THREE.MeshBasicMaterial;
      if (blessingStrength > 0.2) {
        dm.color.set('#fde047');
        dm.opacity = 0.72 + Math.sin(time * 7) * 0.22;
        depositRing.scale.setScalar(1.06 + Math.sin(time * 6) * 0.08);
      } else if (bankReady) {
        dm.color.set('#34d399');
        dm.opacity = 0.65 + Math.sin(time * 6) * 0.25;
        depositRing.scale.setScalar(1 + Math.sin(time * 5) * 0.06);
      } else {
        dm.color.set(mapId === 'volcanic_springs' ? '#fb923c' : '#22d3ee');
        dm.opacity = 0.34;
        depositRing.scale.setScalar(1);
      }

      if (floatingPrism) {
        floatingPrism.rotation.y += dt * 1.4;
        floatingPrism.position.y = 3.55 + Math.sin(time * 2.4) * 0.2;
      }

      for (const ob of animatedObelisks) {
        ob.mesh.rotation.y += dt * 0.9;
        ob.mesh.position.y = ob.baseY + Math.sin(time * 2.2 + ob.phase) * 0.14;
      }

      for (let i = 0; i < animatedEmbers.length; i++) {
        animatedEmbers[i].emissiveIntensity = 0.65 + Math.sin(time * 3.4 + i) * 0.28;
      }

      for (const sm of shaderMaterialsToTick) {
        sm.uniforms.uTime.value = time;
      }
    },
  };
}
