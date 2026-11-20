import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GameModeId, MapId, YetiColorId } from '../types';
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
  animateQuestMonster,
  animateWeaponPod,
  buildQuestMonsterMesh,
  buildWeaponPodMesh,
} from '../three/questEntities';
import {
  drawArcticOutpostParallax,
  drawExtractionBunker,
  drawPowerUpIcon,
  drawRaidParallaxBuildings,
  drawRaidPlatformSupports,
  drawRunnerPlatformFoundations,
  drawStickmanCharacter,
  type StickmanPose,
} from '../lib/stickmanRenderer';

interface GameVideoPreviewProps {
  mode: GameModeId;
  mapId?: MapId;
  colorway?: YetiColorId;
  hatId?: string;
  scarfId?: string;
  className?: string;
}

const LOGICAL_W = 1200;
const LOGICAL_H = 675;
const RAID_FLOOR = 565;

type Preview3DMode = 'survival' | 'car_racing' | 'shooting';

interface Preview3DSubscriber {
  mode: Preview3DMode;
  mapId: MapId;
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
  private scenes = new Map<string, Preview3DSceneRig>();
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

  private getOrBuildScene(mode: Preview3DMode, mapId: MapId): Preview3DSceneRig | null {
    const cacheKey = `${mode}:${mapId}`;
    const existing = this.scenes.get(cacheKey);
    if (existing) return existing;
    if (!this.renderer) return null;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
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

      const bossRig = buildQuestMonsterMesh('wraith', '#e879f9');
      bossRig.hpBar.group.visible = false;
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
        animateQuestMonster(bossRig, { speed: 110, dt, elapsedTime: t + 1.2, attacking: Math.sin(t * 2.4) > 0.5 });

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

      const bossMonster = buildQuestMonsterMesh('boss', '#fb923c');
      bossMonster.hpBar.group.visible = false;
      scene.add(bossMonster.root);

      const stalkerMonster = buildQuestMonsterMesh('stalker', '#38bdf8');
      stalkerMonster.hpBar.group.visible = false;
      scene.add(stalkerMonster.root);

      const weaponPod = buildWeaponPodMesh('frost_spear');
      weaponPod.root.position.set(2.5, 0, -2.5);
      scene.add(weaponPod.root);

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

        // Sculpted Boss & Stalker pursuing the squad!
        const ba = ha - 0.95;
        const bx = Math.cos(ba) * 6.8;
        const bz = Math.sin(ba) * 6.8;
        bossMonster.root.position.set(bx, 0, bz);
        bossMonster.root.rotation.y = Math.atan2(hx - bx, hz - bz);
        animateQuestMonster(bossMonster, { speed: 110, dt, elapsedTime: t, attacking: Math.sin(t * 2) > 0.6 });

        const sa = ha + 1.5;
        const sx = Math.cos(sa) * 5.8;
        const sz = Math.sin(sa) * 5.8;
        stalkerMonster.root.position.set(sx, 0, sz);
        stalkerMonster.root.rotation.y = Math.atan2(hx - sx, hz - sz);
        animateQuestMonster(stalkerMonster, { speed: 145, dt, elapsedTime: t + 1.1 });

        animateWeaponPod(weaponPod, dt, t);

        drops.forEach((d) => {
          const a = t * 0.5 + d.offset;
          d.mesh.position.set(Math.cos(a) * 5.2, 0.72 + Math.sin(t * 3 + d.offset) * 0.2, Math.sin(a) * 5.2);
          d.mesh.rotation.y += dt * 2.2;
        });

        const sp = (t * 1.3) % 1;
        snowball.position.set(
          THREE.MathUtils.lerp(hx, bx, sp),
          1.25 + Math.sin(sp * Math.PI) * 1.1,
          THREE.MathUtils.lerp(hz, bz, sp)
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
    this.scenes.set(`${mode}:${mapId}`, rig);
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
        const rig = this.getOrBuildScene(sub.mode, sub.mapId);
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
    // === KILLER BEAN-STYLE SIDE-SCROLLING COMPOUND RAID & EXIT GATE ===
    const cycle = t % 6.8;
    const scroll = t * 180;

    drawRaidParallaxBuildings(ctx, scroll, LOGICAL_W, RAID_FLOOR, '#38bdf8', t);

    // Compound Steel Floor
    ctx.fillStyle = '#0f233c';
    ctx.fillRect(0, RAID_FLOOR, LOGICAL_W, LOGICAL_H - RAID_FLOOR);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, RAID_FLOOR, LOGICAL_W, 6);

    // Elevated Catwalks with Steel Support Trusses & Cargo Containers
    const catwalks = [
      { x: 170, y: 430, w: 260 },
      { x: 520, y: 350, w: 250 },
    ];
    drawRaidPlatformSupports(ctx, catwalks, RAID_FLOOR, '#38bdf8');

    // Explosive Fuel Barrel & Armored Extraction Gatehouse on Far Right
    const barrelBurst = cycle >= 3.9 && cycle < 4.55;
    if (!barrelBurst) {
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2.5;
      ctx.fillRect(635, RAID_FLOOR - 50, 34, 50);
      ctx.strokeRect(635, RAID_FLOOR - 50, 34, 50);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(635, RAID_FLOOR - 30, 34, 10);
    } else {
      const bp = (cycle - 3.9) / 0.65;
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 6 * (1 - bp);
      ctx.beginPath();
      ctx.arc(652, RAID_FLOOR - 25, 25 + bp * 115, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Armored Extraction Gatehouse Building
    drawExtractionBunker(ctx, 1045, RAID_FLOOR, false, t);

    drawPowerUpIcon(ctx, 'rage', 295, 396, t);

    // Choreographed Slow-Mo Dive + Dual-Pistol Gun-Fu
    let pX = 210;
    let pY = RAID_FLOOR;
    let pPose: StickmanPose = 'run';
    let pAct = 0;
    let e1Pose: StickmanPose = 'jab';
    let e1Hp = 100;
    let e2Pose: StickmanPose = 'guard';
    let e2Hp = 100;

    if (cycle < 1.8) {
      const u = cycle / 1.8;
      pX = 180 + u * 230;
      pPose = u > 0.55 ? 'jab' : 'run';
      pAct = (t * 4) % 1;
      e1Pose = u > 0.72 ? 'hurt' : 'jab';
      e1Hp = u > 0.72 ? 35 : 100;
    } else if (cycle < 3.6) {
      // Slow-Mo Gun-Fu Bullet-Time Dive!
      const u = (cycle - 1.8) / 1.8;
      pX = 410 + u * 275;
      pY = RAID_FLOOR - Math.sin(u * Math.PI) * 145;
      pPose = u < 0.7 ? 'slide' : 'heavy';
      pAct = u;
      e1Pose = 'down';
      e1Hp = 0;
      e2Pose = u > 0.65 ? 'hurt' : 'jab';
      e2Hp = u > 0.65 ? 40 : 100;
    } else if (cycle < 5.3) {
      // Blast barrel & finish syndicate guard
      const u = (cycle - 3.6) / 1.7;
      pX = 685 + u * 210;
      pPose = u < 0.45 ? 'jab' : 'run';
      pAct = (t * 5) % 1;
      e1Pose = 'down';
      e1Hp = 0;
      e2Pose = 'down';
      e2Hp = 0;
    } else {
      // Reach Extraction Exit Gate!
      const u = (cycle - 5.3) / 1.5;
      pX = 895 + u * 135;
      pPose = u > 0.65 ? 'victory' : 'run';
      e1Pose = 'down';
      e1Hp = 0;
      e2Pose = 'down';
      e2Hp = 0;
    }

    // Dual-pistol yellow tracer rounds
    const tracerX = pX + 55 + ((t * 920) % 420);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(tracerX, pY - 58, 28, 4.5);
    ctx.fillRect(tracerX - 65, pY - 46, 24, 4.5);

    // Syndicate Hitman Enemy 1 & 2
    drawStickmanCharacter(ctx, {
      x: 560,
      y: RAID_FLOOR,
      facing: -1,
      pose: e1Pose,
      animTime: t + 0.5,
      scale: 1.15,
      isLofiYeti: false,
      customStroke: '#fb7185',
      customAccent: '#f43f5e',
      hp: e1Hp,
      maxHp: 100,
      label: 'Syndicate Enforcer',
      weapon: 'pistols',
    });

    drawStickmanCharacter(ctx, {
      x: 840,
      y: RAID_FLOOR,
      facing: -1,
      pose: e2Pose,
      animTime: t + 1.4,
      scale: 1.2,
      isLofiYeti: false,
      customStroke: '#f97316',
      customAccent: '#facc15',
      hp: e2Hp,
      maxHp: 100,
      label: 'Vault Captain',
      weapon: 'pistols',
    });

    drawStickmanCharacter(ctx, {
      x: pX,
      y: pY,
      facing: 1,
      pose: pPose,
      animTime: t,
      actionProgress: pAct,
      scale: 1.24,
      isLofiYeti: true,
      colorwayId: colorway,
      hatId,
      scarfId,
      raged: cycle >= 1.8 && cycle < 3.6,
      hp: 100,
      maxHp: 100,
      label: 'Lofi Bean',
      weapon: 'pistols',
    });

    if (cycle >= 1.8 && cycle < 3.3) {
      ctx.font = '700 26px "Pixel Forge", Oxanium, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('SLOW-MO GUN-FU!', 600, 150);
    } else if (cycle >= 5.6) {
      ctx.font = '700 28px "Pixel Forge", Oxanium, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#34d399';
      ctx.fillText('STAGE CLEAR · EXIT REACHED!', 600, 150);
    }
  } else if (mode === 'stickman_brawl') {
    // Side-view station cutaway: rooms remain separate, but characters and floors read horizontally.
    const cycle = t % 7.2;

    // Station Deck Background & Horizontal Room Cutaway
    ctx.fillStyle = '#071324';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    const rooms = [
      { name: 'CAFETERIA', x: 55, y: 105, w: 285, h: 390, floor: '#11253e', accent: '#38bdf8' },
      { name: 'MEDBAY', x: 340, y: 105, w: 270, h: 390, floor: '#112c3c', accent: '#2dd4bf' },
      { name: 'REACTOR', x: 610, y: 105, w: 255, h: 390, floor: '#1b1d36', accent: '#c084fc' },
      { name: 'AIRLOCK EXIT', x: 865, y: 105, w: 260, h: 390, floor: '#0f2b33', accent: '#34d399' },
    ];

    // Corridors connecting rooms
    ctx.fillStyle = '#162d47';
    ctx.fillRect(330, 425, 20, 70);
    ctx.fillRect(600, 425, 20, 70);
    ctx.fillRect(855, 425, 20, 70);

    for (const r of rooms) {
      ctx.fillStyle = r.floor;
      ctx.strokeStyle = r.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.font = '700 18px Oxanium, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(r.name, r.x + 18, r.y + 32);
    }

    ctx.fillStyle = '#020617';
    ctx.fillRect(55, 495, 1070, 100);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(55, 495);
    ctx.lineTo(1125, 495);
    ctx.stroke();

    // Security Blast Door between Medbay & Airlock (unlocks after Clue collected!)
    const doorUnlocked = cycle >= 3.6;
    ctx.fillStyle = doorUnlocked ? 'rgba(52, 211, 153, 0.25)' : 'rgba(244, 63, 94, 0.65)';
    ctx.strokeStyle = doorUnlocked ? '#34d399' : '#fb7185';
    ctx.lineWidth = 3;
    ctx.fillRect(790, 248, 16, 92);
    ctx.strokeRect(790, 248, 16, 92);

    // Cafeteria Emergency Table, Medbay Bio-Tanks, Reactor Turbine & Airlock Escape Shuttle
    ctx.fillStyle = '#1e3a5f';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(245, 225, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(245, 225, 9, 0, Math.PI * 2);
    ctx.fill();

    // Medbay Cryo Tanks
    [482, 512].forEach((tx) => {
      ctx.fillStyle = 'rgba(45, 212, 191, 0.24)';
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(tx, 162, 22, 54, 8);
      ctx.fill();
      ctx.stroke();
    });

    // Reactor Turbine + Conduits
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(115, 502);
    ctx.lineTo(375, 502);
    ctx.stroke();
    ctx.fillStyle = '#2e1065';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(245, 502, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Floor Vent in Medbay
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.fillRect(605, 152, 48, 28);
    ctx.strokeRect(605, 152, 48, 28);

    // Glowing Clue Data Pad in Medbay
    if (cycle < 3.6) {
      const pulse = 18 + Math.sin(t * 7) * 4;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.beginPath();
      ctx.arc(620, 285, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.fillRect(608, 274, 24, 20);
      ctx.strokeRect(608, 274, 24, 20);
      ctx.font = '700 11px Oxanium, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.fillText('CLUE 3/3', 620, 260);
    }

    // Docked Escape Shuttle Craft inside Airlock Room
    ctx.fillStyle = doorUnlocked ? 'rgba(16, 185, 129, 0.26)' : 'rgba(51, 65, 85, 0.5)';
    ctx.strokeStyle = doorUnlocked ? '#34d399' : '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(985, 355, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f2744';
    ctx.beginPath();
    ctx.moveTo(1022, 355);
    ctx.lineTo(968, 326);
    ctx.lineTo(950, 342);
    ctx.lineTo(950, 368);
    ctx.lineTo(968, 384);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 13px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(doorUnlocked ? 'ESCAPE!' : 'LOCKED', 985, 420);

    // Animated Player & Red-Visor Imposter Stickman
    let pX = 240;
    let pY = 492;
    let pPose: StickmanPose = 'run';
    let iX = 630;
    let iY = 492;
    let iPose: StickmanPose = 'idle';

    if (cycle < 2.2) {
      const u = cycle / 2.2;
      pX = 210 + u * 375;
      pY = 492;
      pPose = 'run';
      iX = 628;
      iY = 492;
      iPose = 'idle';
    } else if (cycle < 3.8) {
      const u = (cycle - 2.2) / 1.6;
      pX = 585;
      pY = 492;
      pPose = u < 0.5 ? 'jab' : 'victory';
      iX = 628 - u * 40;
      iY = 492;
      iPose = 'run';
    } else {
      const u = (cycle - 3.8) / 3.4;
      pX = 585 + Math.min(1, u * 1.15) * 380;
      pY = 492;
      pPose = u > 0.85 ? 'victory' : 'run';
      iX = 590 + u * 165;
      iY = 492;
      iPose = 'run';
    }

    drawPowerUpIcon(ctx, 'shield', 235, 515, t);

    drawStickmanCharacter(ctx, {
      x: iX,
      y: iY,
      facing: pX >= iX ? 1 : -1,
      pose: iPose,
      animTime: t + 0.8,
      scale: 1.05,
      isLofiYeti: false,
      imposterVisor: true,
      customStroke: '#ef4444',
      customAccent: '#fb7185',
      hp: 100,
      maxHp: 100,
      label: 'Imposter!',
      weapon: 'sword',
    });

    drawStickmanCharacter(ctx, {
      x: pX,
      y: pY,
      facing: 1,
      pose: pPose,
      animTime: t,
      scale: 1.1,
      isLofiYeti: true,
      colorwayId: colorway,
      hatId,
      scarfId,
      hp: 100,
      maxHp: 100,
      label: 'Lofi Yeti',
      weapon: 'scanner',
    });

    ctx.font = '700 24px "Pixel Forge", Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = doorUnlocked ? '#34d399' : '#fde047';
    ctx.fillText(
      doorUnlocked ? 'AIRLOCK UNLOCKED · ESCAPE!' : 'FIND CLUES TO UNLOCK NEXT ROOM',
      600,
      68
    );
  } else {
    // 'stickman_run': Continuous Side-Scrolling Glacier Canyon Runner
    const scroll = t * 420;
    const platW = 680;
    const gapW = 140;
    const stride = platW + gapW;

    drawArcticOutpostParallax(ctx, scroll, LOGICAL_W, 388, '#38bdf8', t);

    const previewPlats: { x: number; y: number; w: number }[] = [];
    for (let i = -1; i < 4; i++) {
      const baseIdx = Math.floor(scroll / stride) + i;
      const px = baseIdx * stride - scroll;
      const py = 545 - ((Math.abs(baseIdx) % 2) * 32);
      previewPlats.push({ x: px, y: py, w: platW });
    }
    drawRunnerPlatformFoundations(ctx, previewPlats, LOGICAL_H, '#123154', '#38bdf8');

    for (const pl of previewPlats) {
      const px = pl.x;
      const py = pl.y;

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
  mapId = 'glacier_well',
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
        mapId,
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
  }, [mode, mapId, is2D, colorway, hatId, scarfId]);

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
