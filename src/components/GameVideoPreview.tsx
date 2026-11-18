import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GameModeId, YetiColorId } from '../types';
import { ARENA_CENTER_X, ARENA_CENTER_Y, getRaceTrackWaypoints } from '../data/gameCatalog';
import { buildArcticEnvironment } from '../three/arenaEnvironment';
import { animateYetiWalk, buildYetiRig, type YetiRigParts } from '../three/yetiBuilder';
import {
  animateYetiKart,
  buildShooterTargetMesh,
  buildYetiKartRig,
  type ShooterTargetMesh,
  type YetiKartRigParts,
} from '../three/kartAndShooter';
import {
  drawPowerUpIcon,
  drawStickmanCharacter,
  type StickmanPose,
} from '../lib/stickmanRenderer';

interface GameVideoPreviewProps {
  mode: GameModeId;
  colorway?: YetiColorId;
  hatId?: string;
  scarfId?: string;
  className?: string;
}

const LOGICAL_W = 1200;
const LOGICAL_H = 675;
const RING_LEFT = 175;
const RING_RIGHT = 1025;
const RING_FLOOR = 535;
const BRAWL_FLOOR = 565;

const BRAWL_PLATFORMS = [
  { x: 170, y: 425, w: 230 },
  { x: 485, y: 335, w: 230 },
  { x: 800, y: 425, w: 230 },
];

type Preview3DMode = 'survival' | 'car_racing' | 'shooting';

interface Preview3DSubscriber {
  mode: Preview3DMode;
  canvas: HTMLCanvasElement;
  visible: boolean;
}

interface Preview3DSceneRig {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (t: number, dt: number) => void;
}

/**
 * Single shared offscreen WebGL2 renderer that renders real Three.js gameplay
 * scenes for the 3D Arena game cards (`survival`, `car_racing`, `shooting`)
 * and blits them at 30fps onto each card's 2D canvas without exhausting WebGL contexts.
 */
class Shared3DPreviewManager {
  private renderer: THREE.WebGLRenderer | null = null;
  private envTex: THREE.Texture | null = null;
  private isSoftwareGl = false;
  private failed = false;
  private subscribers = new Set<Preview3DSubscriber>();
  private scenes = new Map<Preview3DMode, Preview3DSceneRig>();
  private rafId = 0;
  private timeoutId = 0;
  private startMs = 0;
  private lastTickMs = 0;
  private colorway: YetiColorId = 'classic_lofi';
  private hatId = 'hat_goggles';
  private scarfId = 'scarf_lofi';

  setCustomization(colorway: YetiColorId, hatId: string, scarfId: string) {
    if (this.colorway === colorway && this.hatId === hatId && this.scarfId === scarfId) return;
    this.colorway = colorway;
    this.hatId = hatId;
    this.scarfId = scarfId;
    // Rebuild scenes with updated mascot appearance on next draw
    this.scenes.clear();
  }

  subscribe(sub: Preview3DSubscriber): () => void {
    this.subscribers.add(sub);
    this.ensureLoop();
    return () => {
      this.subscribers.delete(sub);
      if (this.subscribers.size === 0) {
        this.stopLoop();
      }
    };
  }

  isUnavailable(): boolean {
    return this.failed;
  }

  private initRenderer(): boolean {
    if (this.renderer) return true;
    if (this.failed || typeof document === 'undefined') return false;

    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) {
        this.failed = true;
        return false;
      }
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      this.isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      this.failed = true;
      return false;
    }

    try {
      const r = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.14;
      r.setSize(480, 270, false);
      r.shadowMap.enabled = !this.isSoftwareGl;
      r.shadowMap.type = THREE.PCFSoftShadowMap;

      const pmrem = new THREE.PMREMGenerator(r);
      this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();

      r.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.failed = true;
        this.stopLoop();
      });

      this.renderer = r;
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  private getOrBuildScene(mode: Preview3DMode): Preview3DSceneRig | null {
    const existing = this.scenes.get(mode);
    if (existing) return existing;
    if (!this.renderer) return null;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const mapId =
      mode === 'car_racing'
        ? 'glacier_well'
        : mode === 'shooting'
        ? 'aurora_summit'
        : 'volcanic_springs';

    const scene = new THREE.Scene();
    const bgHex =
      mapId === 'volcanic_springs' ? '#160b10' : mapId === 'aurora_summit' ? '#091128' : '#071324';
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, mode === 'car_racing' ? 0.011 : 0.016);
    if (this.envTex) scene.environment = this.envTex;

    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.25, 190);
    scene.add(new THREE.HemisphereLight('#bae6fd', '#0f2942', 0.88));
    const key = new THREE.DirectionalLight('#fff7ed', 1.6);
    key.position.set(14, 22, 16);
    scene.add(key);
    const rim = new THREE.DirectionalLight(
      mapId === 'volcanic_springs' ? '#fb923c' : '#38bdf8',
      1.0
    );
    rim.position.set(-14, 9, -12);
    scene.add(rim);

    const env = buildArcticEnvironment(maxAniso, this.isSoftwareGl, mapId, mode);
    scene.add(env.group);

    let updateFn: (t: number, dt: number) => void;

    if (mode === 'car_racing') {
      const waypoints = getRaceTrackWaypoints(mapId);
      const curvePts = waypoints.map(
        (wp) => new THREE.Vector3((wp.x - ARENA_CENTER_X) / 25, 0.05, (wp.y - ARENA_CENTER_Y) / 25)
      );
      const curve = new THREE.CatmullRomCurve3(curvePts, true, 'catmullrom', 0.5);

      const playerKart: YetiKartRigParts = buildYetiKartRig({
        colorwayId: this.colorway,
        hatId: this.hatId,
        scarfId: this.scarfId,
        isPlayer: true,
      });
      const rivalKartA: YetiKartRigParts = buildYetiKartRig({
        colorwayId: 'sunset_ember',
        hatId: 'hat_crown',
        scarfId: 'scarf_crimson',
        isPlayer: false,
      });
      const rivalKartB: YetiKartRigParts = buildYetiKartRig({
        colorwayId: 'glacier_mint',
        hatId: 'hat_beanie',
        scarfId: 'scarf_aurora',
        isPlayer: false,
      });
      scene.add(playerKart.root, rivalKartA.root, rivalKartB.root);

      const tempPos = new THREE.Vector3();
      const tempAhead = new THREE.Vector3();
      const tempRight = new THREE.Vector3();
      const upVec = new THREE.Vector3(0, 1, 0);

      updateFn = (t: number, dt: number) => {
        env.update(t, dt, 40, false, false);

        const placeKartOnTrack = (
          kart: YetiKartRigParts,
          uRaw: number,
          lateral: number,
          boosting: boolean
        ) => {
          const u = ((uRaw % 1) + 1) % 1;
          const uNext = (u + 0.012) % 1;
          curve.getPointAt(u, tempPos);
          curve.getPointAt(uNext, tempAhead);
          const dir = tempAhead.clone().sub(tempPos).normalize();
          tempRight.crossVectors(dir, upVec).normalize();

          const pos = tempPos.clone().addScaledVector(tempRight, lateral);
          kart.root.position.copy(pos);
          kart.root.rotation.y = Math.atan2(dir.x, dir.z);

          // Sample curvature for dynamic steer lean
          const uFurther = (u + 0.03) % 1;
          const pFar = curve.getPointAt(uFurther);
          const dirFar = pFar.sub(tempAhead).normalize();
          const crossY = dir.x * dirFar.z - dir.z * dirFar.x;

          animateYetiKart(kart, {
            speed: boosting ? 320 : 255,
            steer: THREE.MathUtils.clamp(crossY * 6.5, -1, 1),
            boosting,
            dt,
            elapsedTime: t,
          });
        };

        const mainU = t * 0.058;
        const boostPulse = Math.sin(t * 2.1) > 0.2;
        placeKartOnTrack(playerKart, mainU, Math.sin(t * 1.4) * 1.1, boostPulse);
        placeKartOnTrack(rivalKartA, mainU + 0.028, -1.6 + Math.cos(t * 1.1) * 0.6, false);
        placeKartOnTrack(rivalKartB, mainU - 0.022, 1.8, Math.sin(t * 1.9 + 1) > 0.4);

        // Smooth Beach-Buggy style chase camera behind player kart
        const u = ((mainU % 1) + 1) % 1;
        const pCamBase = curve.getPointAt(u);
        const pCamAhead = curve.getPointAt((u + 0.025) % 1);
        const fwd = pCamAhead.clone().sub(pCamBase).normalize();
        const camPos = playerKart.root.position
          .clone()
          .addScaledVector(fwd, -7.2)
          .add(new THREE.Vector3(0, 3.6, 0));
        camera.position.copy(camPos);
        camera.lookAt(
          playerKart.root.position.x + fwd.x * 4.5,
          playerKart.root.position.y + 1.0,
          playerKart.root.position.z + fwd.z * 4.5
        );
      };
    } else if (mode === 'shooting') {
      const heroRig: YetiRigParts = buildYetiRig({
        colorwayId: this.colorway,
        hatId: this.hatId,
        scarfId: this.scarfId,
        isPlayer: true,
        scale: 1.15,
        weapon: 'blaster',
      });
      scene.add(heroRig.root);

      const bossRig: YetiRigParts = buildYetiRig({
        colorwayId: 'golden_frost',
        hatId: 'hat_crown',
        scarfId: 'scarf_crimson',
        isPlayer: false,
        scale: 1.42,
        weapon: 'sword',
      });
      scene.add(bossRig.root);

      const targets: { obj: ShooterTargetMesh; angleOff: number; radius: number }[] = [
        { obj: buildShooterTargetMesh('drone', '#f43f5e'), angleOff: 0.2, radius: 7.4 },
        { obj: buildShooterTargetMesh('bullseye', '#38bdf8'), angleOff: 1.4, radius: 8.6 },
        { obj: buildShooterTargetMesh('drone', '#c084fc'), angleOff: 2.7, radius: 7.1 },
        { obj: buildShooterTargetMesh('bullseye', '#2dd4bf'), angleOff: 4.1, radius: 9.0 },
      ];
      targets.forEach((tg) => scene.add(tg.obj.group));

      // Luminous blaster bolts
      const bolts: { mesh: THREE.Mesh; phase: number; targetIdx: number }[] = [];
      const boltGeo = new THREE.SphereGeometry(0.18, 10, 10);
      const boltMat = new THREE.MeshBasicMaterial({ color: '#67e8f9' });
      for (let i = 0; i < 4; i++) {
        const mesh = new THREE.Mesh(boltGeo, boltMat);
        scene.add(mesh);
        bolts.push({ mesh, phase: i * 0.25, targetIdx: i });
      }

      updateFn = (t: number, dt: number) => {
        env.update(t, dt, 24, false, false);

        const strafeA = t * 0.82;
        const hx = Math.cos(strafeA) * 3.8;
        const hz = Math.sin(strafeA) * 3.8;
        heroRig.root.position.set(hx, 0, hz);

        // Aim toward active target 0
        const aimAngle = t * 0.55;
        const tx = Math.cos(aimAngle) * 7.8;
        const tz = Math.sin(aimAngle) * 7.8;
        heroRig.root.rotation.y = Math.atan2(tx - hx, tz - hz);
        animateYetiWalk(heroRig, {
          speed: 145,
          dt,
          elapsedTime: t,
          throwPulse: (t * 2.2) % 1 < 0.25 ? 1 : 0,
        });

        bossRig.root.position.set(-Math.cos(aimAngle) * 6.5, 0, -Math.sin(aimAngle) * 6.5);
        bossRig.root.rotation.y = Math.atan2(hx - bossRig.root.position.x, hz - bossRig.root.position.z);
        animateYetiWalk(bossRig, { speed: 120, dt, elapsedTime: t + 1.2 });

        targets.forEach((tg, i) => {
          const a = aimAngle + tg.angleOff;
          tg.obj.group.position.set(Math.cos(a) * tg.radius, Math.sin(t * 2.8 + i) * 0.25, Math.sin(a) * tg.radius);
          tg.obj.coreMesh.rotation.y += dt * 2.4;
          tg.obj.ringMesh.rotation.z += dt * 1.8;
          tg.obj.group.lookAt(hx, 1.1, hz);
        });

        bolts.forEach((b) => {
          const p = (t * 1.8 + b.phase) % 1;
          const tgPos = targets[b.targetIdx % targets.length].obj.group.position;
          b.mesh.position.set(
            THREE.MathUtils.lerp(hx, tgPos.x, p),
            1.35 + Math.sin(p * Math.PI) * 0.15,
            THREE.MathUtils.lerp(hz, tgPos.z, p)
          );
          const sc = p > 0.9 ? 1.8 : 1.0;
          b.mesh.scale.setScalar(sc);
        });

        const camOrb = aimAngle - 2.35;
        camera.position.set(
          hx + Math.cos(camOrb) * 8.2,
          4.2 + Math.sin(t * 0.5) * 0.4,
          hz + Math.sin(camOrb) * 8.2
        );
        camera.lookAt((hx + tx) * 0.5, 1.3, (hz + tz) * 0.5);
      };
    } else {
      // 'survival' in Volcanic Spring (contrasts nicely with Glacier Well hero!)
      const heroRig: YetiRigParts = buildYetiRig({
        colorwayId: this.colorway,
        hatId: this.hatId,
        scarfId: this.scarfId,
        isPlayer: true,
        scale: 1.16,
      });
      heroRig.shieldMesh.visible = true;
      scene.add(heroRig.root);

      const rivals = [
        { rig: buildYetiRig({ colorwayId: 'glacier_mint', hatId: 'hat_goggles', scarfId: 'scarf_aurora', isPlayer: false }), radius: 6.2, speed: 0.72, phase: 0.4 },
        { rig: buildYetiRig({ colorwayId: 'aurora_violet', hatId: 'hat_crown', scarfId: 'scarf_lofi', isPlayer: false }), radius: 7.4, speed: 0.58, phase: 2.9 },
      ];
      rivals.forEach((rv) => scene.add(rv.rig.root));

      const drops: { mesh: THREE.Mesh; offset: number }[] = [];
      const dropGeo = new THREE.OctahedronGeometry(0.35, 0);
      dropGeo.scale(0.85, 1.35, 0.85);
      const dropMat = new THREE.MeshPhysicalMaterial({
        color: '#38bdf8',
        emissive: '#0ea5e9',
        emissiveIntensity: 0.7,
        roughness: 0.1,
        clearcoat: 1,
      });
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(dropGeo, dropMat);
        scene.add(m);
        drops.push({ mesh: m, offset: (i / 6) * Math.PI * 2 });
      }

      const snowball = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 10),
        new THREE.MeshBasicMaterial({ color: '#e0f2fe' })
      );
      scene.add(snowball);

      updateFn = (t: number, dt: number) => {
        env.update(t, dt, 18, true, true);

        const ha = t * 0.85;
        const hx = Math.cos(ha) * 4.5;
        const hz = Math.sin(ha) * 4.5;
        const dhx = -Math.sin(ha) * 4.5 * 0.85;
        const dhz = Math.cos(ha) * 4.5 * 0.85;
        heroRig.root.position.set(hx, 0, hz);
        heroRig.root.rotation.y = Math.atan2(dhx, dhz);
        heroRig.shieldMesh.rotation.y += dt * 1.4;
        animateYetiWalk(heroRig, {
          speed: 175,
          dt,
          elapsedTime: t,
          dashing: Math.sin(t * 1.6) > 0.55,
          throwPulse: (t * 1.3) % 1 < 0.22 ? 1 : 0,
        });

        rivals.forEach((rv) => {
          const a = t * rv.speed + rv.phase;
          const rx = Math.cos(a) * rv.radius;
          const rz = Math.sin(a) * rv.radius;
          rv.rig.root.position.set(rx, 0, rz);
          rv.rig.root.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
          animateYetiWalk(rv.rig, { speed: 150, dt, elapsedTime: t + rv.phase });
        });

        drops.forEach((d) => {
          const a = t * 0.5 + d.offset;
          d.mesh.position.set(Math.cos(a) * 5.2, 0.72 + Math.sin(t * 3 + d.offset) * 0.2, Math.sin(a) * 5.2);
          d.mesh.rotation.y += dt * 2.2;
        });

        const sp = (t * 1.3) % 1;
        const rvTarget = rivals[0].rig.root.position;
        snowball.position.set(
          THREE.MathUtils.lerp(hx, rvTarget.x, sp),
          1.25 + Math.sin(sp * Math.PI) * 1.1,
          THREE.MathUtils.lerp(hz, rvTarget.z, sp)
        );

        const camA = ha - 2.2;
        camera.position.set(
          hx * 0.4 + Math.cos(camA) * 9.5,
          4.8 + Math.sin(t * 0.4) * 0.3,
          hz * 0.4 + Math.sin(camA) * 9.5
        );
        camera.lookAt(hx * 0.45, 1.1, hz * 0.45);
      };
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(scene, camera);
    }

    const rig: Preview3DSceneRig = { scene, camera, update: updateFn };
    this.scenes.set(mode, rig);
    return rig;
  }

  private ensureLoop() {
    if (this.rafId || this.timeoutId || this.subscribers.size === 0 || this.failed) return;
    if (!this.initRenderer()) return;
    this.startMs = performance.now();
    this.lastTickMs = this.startMs;

    const tick = () => {
      this.rafId = 0;
      this.timeoutId = 0;
      if (this.subscribers.size === 0 || !this.renderer) return;

      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.016, (now - this.lastTickMs) / 1000));
      const t = (now - this.startMs) / 1000;
      this.lastTickMs = now;

      let anyVisible = false;
      for (const sub of this.subscribers) {
        if (!sub.visible) continue;
        anyVisible = true;
        const rig = this.getOrBuildScene(sub.mode);
        if (!rig) continue;

        rig.update(t, dt);
        this.renderer.render(rig.scene, rig.camera);

        const ctx = sub.canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.renderer.domElement, 0, 0, sub.canvas.width, sub.canvas.height);
        }
      }

      const intervalMs = this.isSoftwareGl ? 140 : anyVisible ? 34 : 250;
      this.timeoutId = window.setTimeout(() => {
        this.rafId = requestAnimationFrame(tick);
      }, intervalMs);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop() {
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.timeoutId);
    this.rafId = 0;
    this.timeoutId = 0;
    this.scenes.clear();
    if (this.envTex) {
      this.envTex.dispose();
      this.envTex = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}

const shared3DManager = new Shared3DPreviewManager();

/**
 * Draws the exact 2D Stickman gameplay video loops using the real `drawStickmanCharacter`
 * (`@lofitheyeti` X face sprite + normal articulated stickman bodies + weapons + belt)
 * and real `drawPowerUpIcon` sprites inside genuine 1200x675 game arenas.
 */
function render2DGameplayVideoFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: 'stickman_wrestling' | 'stickman_brawl' | 'stickman_run',
  t: number,
  colorway: YetiColorId,
  hatId: string,
  scarfId: string
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Uniform cover scale mapping 1200x675 logical gameplay arena cleanly into card viewport
  const scaleX = w / LOGICAL_W;
  const scaleY = h / LOGICAL_H;
  const scale = Math.max(scaleX, scaleY);
  const offX = (w - LOGICAL_W * scale) * 0.5;
  const offY = (h - LOGICAL_H * scale) * 0.5;
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  // Backdrop matching StickmanArcadeCanvas
  const isBrawl = mode === 'stickman_brawl';
  const isRun = mode === 'stickman_run';
  const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  if (isBrawl) {
    sky.addColorStop(0, '#071426');
    sky.addColorStop(1, '#102f44');
  } else if (isRun) {
    sky.addColorStop(0, '#061224');
    sky.addColorStop(1, '#0f2d4f');
  } else {
    sky.addColorStop(0, '#061224');
    sky.addColorStop(1, '#14294a');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Flowing Aurora ribbon
  ctx.save();
  ctx.strokeStyle = isBrawl ? '#2dd4bf' : '#38bdf8';
  ctx.globalAlpha = 0.17;
  ctx.lineWidth = 36;
  ctx.beginPath();
  const scrollOff = t * 55;
  ctx.moveTo(0, 120);
  for (let x = 0; x <= LOGICAL_W; x += 80) {
    ctx.lineTo(x, 115 + Math.sin((x + scrollOff) * 0.008) * 38);
  }
  ctx.stroke();
  ctx.restore();

  // Parallax Arctic Mountains
  ctx.fillStyle = isBrawl ? '#0c243b' : '#0c213c';
  ctx.beginPath();
  ctx.moveTo(0, LOGICAL_H);
  for (let x = 0; x <= LOGICAL_W + 140; x += 140) {
    const px = isRun ? (x + t * 90) * 0.011 : x * 0.011;
    ctx.lineTo(x, 235 + Math.sin(px + 1.4) * 58);
  }
  ctx.lineTo(LOGICAL_W, LOGICAL_H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isBrawl ? '#133a54' : '#13365e';
  ctx.beginPath();
  ctx.moveTo(0, LOGICAL_H);
  for (let x = 0; x <= LOGICAL_W + 110; x += 110) {
    const px = isRun ? (x + t * 180) * 0.014 : x * 0.014;
    ctx.lineTo(x, 325 + Math.cos(px) * 50);
  }
  ctx.lineTo(LOGICAL_W, LOGICAL_H);
  ctx.closePath();
  ctx.fill();

  // Ambient Falling Snowflakes
  ctx.fillStyle = isBrawl ? '#a7f3d0' : '#bae6fd';
  for (let i = 0; i < 26; i++) {
    const fx = ((i * 173 + t * (28 + (i % 4) * 14)) % (LOGICAL_W + 40)) - 20;
    const fy = ((i * 97 + t * (52 + (i % 3) * 18)) % (LOGICAL_H + 20)) - 10;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(fx, fy, 1.8 + (i % 3) * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (mode === 'stickman_wrestling') {
    const cycle = t % 7.2; // 7.2-second choreographed championship match loop
    const slamImpact = cycle >= 3.2 && cycle < 3.65;
    const ropeBendT = cycle >= 0.7 && cycle < 1.35 ? Math.sin(((cycle - 0.7) / 0.65) * Math.PI) * 30 : 0;

    if (slamImpact) {
      const shake = (1 - (cycle - 3.2) / 0.45) * 10;
      ctx.translate(Math.sin(t * 70) * shake, Math.cos(t * 65) * shake);
    }

    // Arena Spotlights
    ctx.save();
    ctx.fillStyle = 'rgba(186, 230, 253, 0.08)';
    ctx.beginPath();
    ctx.moveTo(260 + Math.sin(t * 1.1) * 35, 0);
    ctx.lineTo(440, RING_FLOOR);
    ctx.lineTo(760, RING_FLOOR);
    ctx.lineTo(540 + Math.sin(t * 1.1) * 35, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(940 - Math.sin(t * 1.1) * 35, 0);
    ctx.lineTo(440, RING_FLOOR);
    ctx.lineTo(760, RING_FLOOR);
    ctx.lineTo(660 - Math.sin(t * 1.1) * 35, 0);
    ctx.fill();
    ctx.restore();

    // Cheering Crowd Silhouettes
    ctx.fillStyle = '#050c18';
    for (let cx = 30; cx < LOGICAL_W; cx += 52) {
      const bounce = Math.abs(Math.sin(t * 5.2 + cx)) * 6;
      ctx.beginPath();
      ctx.arc(cx, 548 - bounce, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 16, 560 - bounce, 32, 115);
    }

    // Ring Posts & Turnbuckles
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 3;
    ctx.fillRect(RING_LEFT - 14, 330, 22, 210);
    ctx.strokeRect(RING_LEFT - 14, 330, 22, 210);
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(RING_RIGHT - 8, 330, 22, 210);
    ctx.strokeRect(RING_RIGHT - 8, 330, 22, 210);

    [355, 405, 455].forEach((ry) => {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(RING_LEFT - 2, ry - 9, 18, 18);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(RING_RIGHT - 16, ry - 9, 18, 18);
    });

    // Elastic Bending Ropes
    const ropeColors = ['#38bdf8', '#e2e8f0', '#f43f5e'];
    [355, 405, 455].forEach((ry, idx) => {
      ctx.strokeStyle = ropeColors[idx];
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(RING_LEFT + 8, ry);
      ctx.quadraticCurveTo(
        RING_LEFT - ropeBendT * 1.2 + (RING_RIGHT - RING_LEFT) * 0.25,
        ry,
        (RING_LEFT + RING_RIGHT) / 2,
        ry
      );
      ctx.quadraticCurveTo(
        RING_RIGHT + (RING_RIGHT - RING_LEFT) * -0.25,
        ry,
        RING_RIGHT - 8,
        ry
      );
      ctx.stroke();
    });

    // Ring Canvas & Apron
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(RING_LEFT - 28, RING_FLOOR, RING_RIGHT - RING_LEFT + 56, 22);
    ctx.fillStyle = '#123154';
    ctx.fillRect(RING_LEFT - 28, RING_FLOOR + 22, RING_RIGHT - RING_LEFT + 56, 75);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(RING_LEFT - 28, RING_FLOOR, RING_RIGHT - RING_LEFT + 56, 22);

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.font = '700 18px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOFI SLAM · SUI WRESTLING', LOGICAL_W / 2, RING_FLOOR + 62);

    // Choreographed Wrestler Poses
    let pX = 360;
    let pY = RING_FLOOR;
    let pFacing: 1 | -1 = 1;
    let pPose: StickmanPose = 'run';
    let pAct = 0;

    let eX = 760;
    let eY = RING_FLOOR;
    let eFacing: 1 | -1 = -1;
    let ePose: StickmanPose = 'guard';
    let eHp = 100;
    let eFlash = false;

    if (cycle < 0.85) {
      // Sprint left to hit ropes
      const u = cycle / 0.85;
      pX = 430 - Math.sin(u * Math.PI * 0.5) * 235;
      pFacing = -1;
      pPose = 'run';
      eX = 720 - u * 60;
      ePose = 'guard';
    } else if (cycle < 1.85) {
      // Rope rebound flying lariat!
      const u = (cycle - 0.85) / 1.0;
      pX = 195 + u * 395;
      pFacing = 1;
      pPose = u > 0.65 ? 'jab' : 'run';
      pAct = u > 0.65 ? (u - 0.65) / 0.35 : 0;
      eX = 660;
      ePose = u > 0.8 ? 'hurt' : 'guard';
      eFlash = u > 0.8;
      eHp = u > 0.8 ? 72 : 100;
    } else if (cycle < 3.25) {
      // Grapple & High-Angle Overhead Suplex Slam!
      const u = (cycle - 1.85) / 1.4;
      pX = 590;
      pFacing = 1;
      pPose = u < 0.25 ? 'grapple' : 'suplex';
      pAct = u < 0.25 ? u / 0.25 : (u - 0.25) / 0.75;
      const arc = u >= 0.25 ? Math.sin(((u - 0.25) / 0.75) * Math.PI) : 0;
      eX = 650 - (u >= 0.25 ? ((u - 0.25) / 0.75) * 140 : 0);
      eY = RING_FLOOR - arc * 135;
      ePose = 'hurt';
      eHp = 45;
    } else if (cycle < 5.4) {
      // Down on mat -> 1-2-3 Pinfall!
      pX = 510;
      pY = RING_FLOOR;
      pFacing = 1;
      pPose = 'pin';
      eX = 515;
      eY = RING_FLOOR;
      ePose = 'down';
      eHp = 18;
    } else {
      // Champion victory pose!
      pX = 560;
      pY = RING_FLOOR;
      pFacing = 1;
      pPose = 'victory';
      eX = 430;
      eY = RING_FLOOR;
      ePose = 'down';
      eHp = 0;
    }

    // Power-up orb on ring corner
    drawPowerUpIcon(ctx, 'rage', 900, RING_FLOOR - 24, t);

    drawStickmanCharacter(ctx, {
      x: eX,
      y: eY,
      facing: eFacing,
      pose: ePose,
      animTime: t + 0.7,
      scale: 1.24,
      isLofiYeti: true,
      colorwayId: 'sunset_ember',
      hp: eHp,
      maxHp: 115,
      label: 'Baron Basalt',
      flashHit: eFlash,
      weapon: 'sword',
    });

    drawStickmanCharacter(ctx, {
      x: pX,
      y: pY,
      facing: pFacing,
      pose: pPose,
      animTime: t,
      actionProgress: pAct,
      scale: 1.28,
      isLofiYeti: true,
      colorwayId: colorway,
      hatId,
      scarfId,
      hasBelt: true,
      finisherReady: cycle >= 1.4 && cycle < 3.4,
      hp: 100,
      maxHp: 100,
      label: 'Lofi Yeti',
      weapon: 'sword',
    });

    if (slamImpact) {
      // Impact shockwave burst
      const p = (cycle - 3.2) / 0.45;
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 5 * (1 - p);
      ctx.beginPath();
      ctx.ellipse(515, RING_FLOOR - 10, 40 + p * 120, 14 + p * 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '700 32px "Pixel Forge", Oxanium, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#040c18';
      ctx.fillText('LOFI SLAM!', 602, 178);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('LOFI SLAM!', 600, 176);
      ctx.restore();
    } else if (cycle >= 5.5) {
      ctx.save();
      ctx.font = '700 30px "Pixel Forge", Oxanium, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('1 · 2 · 3 PINFALL!', 600, 176);
      ctx.restore();
    }
  } else if (mode === 'stickman_brawl') {
    const cycle = t % 6.8;
    const finisherSplash = cycle >= 4.5 && cycle < 5.05;
    if (finisherSplash) {
      const shake = (1 - (cycle - 4.5) / 0.55) * 9;
      ctx.translate(Math.sin(t * 70) * shake, Math.cos(t * 60) * shake);
    }

    // Frozen Floor & Two-Tier Frost Ledges matching StickmanArcadeCanvas
    ctx.fillStyle = '#0e283e';
    ctx.fillRect(0, BRAWL_FLOOR, LOGICAL_W, LOGICAL_H - BRAWL_FLOOR);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(0, BRAWL_FLOOR, LOGICAL_W, 6);

    for (const pl of BRAWL_PLATFORMS) {
      ctx.fillStyle = '#16385d';
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(pl.x, pl.y, pl.w, 16, 8);
      ctx.fill();
      ctx.stroke();
    }

    // Power-up Orbs on ledges
    drawPowerUpIcon(ctx, 'shield', 285, 395, t);
    drawPowerUpIcon(ctx, 'gem', 600, 305, t);

    // Choreographed Multi-Ledge Combat
    let pX = 290;
    let pY = BRAWL_FLOOR;
    let pFacing: 1 | -1 = 1;
    let pPose: StickmanPose = 'run';
    let pAct = 0;

    let e1X = 720;
    let e1Y = BRAWL_FLOOR;
    let e1Pose: StickmanPose = 'guard';
    let e1Hp = 100;

    let e2X = 915;
    const e2Y = 425;
    let e2Pose: StickmanPose = 'idle';
    let e2Hp = 120;

    if (cycle < 1.3) {
      const u = cycle / 1.3;
      pX = 240 + u * 350;
      pPose = u > 0.7 ? 'heavy' : 'run';
      pAct = u > 0.7 ? (u - 0.7) / 0.3 : 0;
      e1X = 680 + (u > 0.8 ? (u - 0.8) * 180 : 0);
      e1Pose = u > 0.8 ? 'hurt' : 'jab';
      e1Hp = u > 0.8 ? 64 : 100;
    } else if (cycle < 2.7) {
      // Leap smoothly up onto middle ledge!
      const u = (cycle - 1.3) / 1.4;
      pX = 590 + u * 110;
      pY = BRAWL_FLOOR - Math.sin(u * Math.PI * 0.65) * 245;
      pY = Math.min(BRAWL_FLOOR, Math.max(335, pY));
      pPose = u < 0.75 ? 'jump' : 'run';
      e1X = 710;
      e1Pose = 'run';
      e1Hp = 64;
    } else if (cycle < 4.5) {
      // Dash across to right platform & unleash sword combo
      const u = (cycle - 2.7) / 1.8;
      pX = 700 + u * 135;
      pY = 335 + u * 90;
      pPose = u > 0.55 ? 'heavy' : 'run';
      pAct = u > 0.55 ? (u - 0.55) / 0.45 : 0;
      e2X = 925 + (u > 0.75 ? 45 : 0);
      e2Pose = u > 0.75 ? 'hurt' : 'jab';
      e2Hp = u > 0.75 ? 55 : 120;
      e1X = 640;
      e1Pose = 'run';
      e1Hp = 64;
    } else {
      // Avalanche Finisher Dive Slam!
      const u = (cycle - 4.5) / 2.3;
      pX = 760;
      pY = u < 0.25 ? 425 + (u / 0.25) * (BRAWL_FLOOR - 425) : BRAWL_FLOOR;
      pPose = u < 0.35 ? 'finisher' : 'victory';
      pAct = Math.min(1, u / 0.35);
      e1X = 610;
      e1Pose = 'down';
      e1Hp = 10;
      e2X = 955;
      e2Pose = 'hurt';
      e2Hp = 35;
    }

    // Snowball laser projectile flying right
    const ballX = ((t * 580) % 720) + 260;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(ballX, 460, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    drawStickmanCharacter(ctx, {
      x: e1X,
      y: e1Y,
      facing: -1,
      pose: e1Pose,
      animTime: t + 1,
      scale: 1.18,
      isLofiYeti: true,
      colorwayId: 'glacier_mint',
      hp: e1Hp,
      maxHp: 100,
      label: 'Frost Striker',
      weapon: 'sword',
    });

    drawStickmanCharacter(ctx, {
      x: e2X,
      y: e2Y,
      facing: -1,
      pose: e2Pose,
      animTime: t + 2.1,
      scale: 1.24,
      isLofiYeti: true,
      colorwayId: 'aurora_violet',
      hp: e2Hp,
      maxHp: 120,
      label: 'Glacier Warden',
      weapon: 'sword',
    });

    drawStickmanCharacter(ctx, {
      x: pX,
      y: pY,
      facing: pFacing,
      pose: pPose,
      animTime: t,
      actionProgress: pAct,
      scale: 1.26,
      isLofiYeti: true,
      colorwayId: colorway,
      hatId,
      scarfId,
      shielded: cycle >= 1.2 && cycle < 4.4,
      raged: cycle >= 3.2,
      hp: 100,
      maxHp: 100,
      label: 'Lofi Yeti',
      weapon: 'sword',
    });

    if (finisherSplash) {
      const p = (cycle - 4.5) / 0.55;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5 * (1 - p);
      ctx.beginPath();
      ctx.arc(760, BRAWL_FLOOR - 22, 40 + p * 165, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '700 28px "Pixel Forge", Oxanium, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2dd4bf';
      ctx.fillText('FROST FINISHER!', 600, 164);
    }
  } else {
    // 'stickman_run': Continuous Side-Scrolling Glacier Canyon Runner
    const scroll = t * 420;
    const platW = 680;
    const gapW = 140;
    const stride = platW + gapW;

    for (let i = -1; i < 4; i++) {
      const baseIdx = Math.floor(scroll / stride) + i;
      const px = baseIdx * stride - scroll;
      const py = 545 - ((Math.abs(baseIdx) % 2) * 32);
      ctx.fillStyle = '#123154';
      ctx.fillRect(px, py, platW, LOGICAL_H - py);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px, py, platW, 7);

      // Ice spike on platform middle
      const spikeX = px + 260;
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spikeX, py);
      ctx.lineTo(spikeX + 20, py - 48);
      ctx.lineTo(spikeX + 40, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shatterable Ice Crate on right half of segment
      const crateX = px + 490;
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 3;
      ctx.fillRect(crateX, py - 52, 48, 52);
      ctx.strokeRect(crateX, py - 52, 48, 52);
      ctx.beginPath();
      ctx.moveTo(crateX, py - 52);
      ctx.lineTo(crateX + 48, py);
      ctx.moveTo(crateX + 48, py - 52);
      ctx.lineTo(crateX, py);
      ctx.stroke();

      // Floating Glacial Drops & Gems above obstacles
      drawPowerUpIcon(ctx, 'drop', spikeX + 20, py - 108, t);
      drawPowerUpIcon(ctx, 'gem', px + 620, py - 84, t);
    }

    // Runner Y jumps cleanly over gaps/spikes and occasionally slides
    const runnerCycle = (scroll % stride) / stride;
    const isJumping = runnerCycle > 0.25 && runnerCycle < 0.56;
    const isSliding = runnerCycle > 0.65 && runnerCycle < 0.82;
    const jumpArc = isJumping ? Math.sin(((runnerCycle - 0.25) / 0.31) * Math.PI) * 145 : 0;
    const rX = 330;
    const rY = 540 - jumpArc;

    // Blaster bolt fired ahead into crates
    const shotX = rX + 60 + ((t * 680) % 520);
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.arc(shotX, rY - 52, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawStickmanCharacter(ctx, {
      x: rX,
      y: rY,
      facing: 1,
      pose: isJumping ? 'jump' : isSliding ? 'slide' : 'run',
      animTime: t,
      scale: 1.24,
      isLofiYeti: true,
      colorwayId: colorway,
      hatId,
      scarfId,
      hp: 100,
      maxHp: 100,
      label: 'Lofi Yeti',
      weapon: 'blaster',
    });
  }

  ctx.restore();
}

export const GameVideoPreview: React.FC<GameVideoPreviewProps> = ({
  mode,
  colorway = 'classic_lofi',
  hatId = 'hat_goggles',
  scarfId = 'scarf_lofi',
  className = 'h-44 w-full',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallback3D, setFallback3D] = useState(false);

  const is2D = mode === 'stickman_wrestling' || mode === 'stickman_brawl' || mode === 'stickman_run';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(320, Math.round((rect.width || 480) * dpr));
      const targetH = Math.max(180, Math.round((rect.height || 270) * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };
    resize();

    let isVisible = true;
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              isVisible = entries[0]?.isIntersecting ?? true;
              if (subRef) subRef.visible = isVisible;
            },
            { rootMargin: '140px' }
          )
        : null;
    observer?.observe(canvas);

    let subRef: Preview3DSubscriber | null = null;
    let rafId = 0;
    let disposed = false;

    if (!is2D) {
      shared3DManager.setCustomization(colorway, hatId, scarfId);
      subRef = {
        mode: mode as Preview3DMode,
        canvas,
        visible: isVisible,
      };
      const unsub = shared3DManager.subscribe(subRef);
      if (shared3DManager.isUnavailable()) {
        setFallback3D(true);
      }

      window.addEventListener('resize', resize);
      return () => {
        disposed = true;
        observer?.disconnect();
        unsub();
        window.removeEventListener('resize', resize);
      };
    }

    // Authentic 2D Stickman gameplay video loop
    const startMs = performance.now();
    const tick2D = (now: number) => {
      if (disposed) return;
      if (isVisible) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          render2DGameplayVideoFrame(
            ctx,
            canvas.width,
            canvas.height,
            mode as 'stickman_wrestling' | 'stickman_brawl' | 'stickman_run',
            (now - startMs) / 1000,
            colorway,
            hatId,
            scarfId
          );
        }
      }
      rafId = requestAnimationFrame(tick2D);
    };

    rafId = requestAnimationFrame(tick2D);
    window.addEventListener('resize', resize);
    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [mode, is2D, colorway, hatId, scarfId]);

  if (!is2D && fallback3D) {
    return (
      <img
        src="/src/assets/images/frost_arena_banner_1794874871724.jpg"
        alt={`${mode} 3D arena gameplay preview`}
        referrerPolicy="no-referrer"
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`${className} block`}
      aria-label={`Animated ${mode} gameplay video preview`}
    />
  );
};
