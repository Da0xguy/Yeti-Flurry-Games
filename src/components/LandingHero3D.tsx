import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Play, Users, ArrowRight, Sparkles, Shield, Compass, Car, Crosshair, Snowflake, Swords, Trophy, Flame } from 'lucide-react';
import type { GameModeId, MapId, YetiObject } from '../types';
import { ARENA_MAPS, GAME_MODES, YETI_COLORWAYS } from '../data/gameCatalog';
import { buildArcticEnvironment } from '../three/arenaEnvironment';
import { animateYetiWalk, buildYetiRig } from '../three/yetiBuilder';

interface LandingHero3DProps {
  yeti: YetiObject | null;
  onLaunchGame: () => void;
  onLaunchMode: (gameMode: GameModeId) => void;
  onLaunchTunnel: (mapId?: MapId) => void;
  onOpenMyYeti: () => void;
}

const GAME_CARD_ART: Record<GameModeId, string> = {
  survival: '/src/assets/images/arcade_survival_card.svg',
  car_racing: '/src/assets/images/snow_drifter_card.svg',
  shooting: '/src/assets/images/frost_fire_card.svg',
  stickman_wrestling: '/src/assets/images/stickman_wrestling_card.svg',
  stickman_brawl: '/src/assets/images/stickman_brawl_card.svg',
  stickman_run: '/src/assets/images/stickman_run_card.svg',
};

const GamePreviewCanvas: React.FC<{ mode: GameModeId }> = ({ mode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const face = new Image();
    face.src = '/src/assets/images/lofi_yeti_face_1794999269515.jpg';
    faceRef.current = face;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let start = performance.now();
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };

    const drawYeti = (x: number, y: number, scale: number, facing: number, accent: string, sword = false) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * scale, scale);

      ctx.fillStyle = 'rgba(2, 8, 23, .48)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 24, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#e6f7ff';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.lineTo(-14, 8);
      ctx.moveTo(7, -9);
      ctx.lineTo(14, 8);
      ctx.moveTo(-8, -29);
      ctx.lineTo(-18, -12);
      ctx.moveTo(8, -29);
      ctx.lineTo(18, -14);
      ctx.stroke();

      ctx.fillStyle = '#dff4ff';
      roundedRect(-13, -58, 26, 34, 10);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -68, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.stroke();

      if (faceRef.current?.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, -68, 14, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(faceRef.current, -15, -83, 30, 30);
        ctx.restore();
      }

      if (sword) {
        ctx.strokeStyle = '#cfefff';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(17, -16);
        ctx.lineTo(38, -44);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    };

    const drawScene = (now: number) => {
      if (disposed) return;
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, mode === 'stickman_brawl' ? '#35151a' : '#07182d');
      gradient.addColorStop(1, mode === 'stickman_run' ? '#12395b' : '#10284a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      if (mode === 'stickman_brawl' || mode === 'stickman_wrestling') {
        ctx.fillStyle = '#07101f';
        ctx.fillRect(0, h * 0.72, w, h * 0.28);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.72);
        ctx.lineTo(w, h * 0.72);
        ctx.stroke();
        ctx.fillStyle = '#183b5d';
        ctx.fillRect(w * 0.18, h * 0.53, w * 0.24, 7);
        ctx.fillRect(w * 0.58, h * 0.44, w * 0.24, 7);

        const leftX = w * (0.32 + Math.sin(t * 1.7) * 0.025);
        const rightX = w * (0.68 - Math.sin(t * 1.7) * 0.025);
        drawYeti(leftX, h * 0.72, 1.15, 1, '#38bdf8', true);
        drawYeti(rightX, h * 0.72, 1.05, -1, '#a78bfa', true);

        const swing = (Math.sin(t * 2.1) + 1) * 0.5;
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.25 + swing * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.58, 18 + swing * 20, 0.2, 2.2);
        ctx.stroke();
      } else if (mode === 'stickman_run') {
        ctx.fillStyle = '#38bdf8';
        ctx.globalAlpha = 0.15;
        ctx.fillRect(0, h * 0.45, w, 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#112d4a';
        ctx.fillRect(0, h * 0.78, w, h * 0.22);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(0, h * 0.78, w, 4);
        const runnerX = w * (0.24 + ((t * 0.12) % 0.52));
        drawYeti(runnerX, h * 0.78 - Math.abs(Math.sin(t * 5)) * 12, 1.05, 1, '#38bdf8');
        for (let i = 0; i < 5; i++) {
          const x = ((i * w * 0.24 - t * 38) % (w + 60) + w + 60) % (w + 60) - 30;
          ctx.fillStyle = '#67e8f9';
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(x, h * 0.34);
          ctx.lineTo(x - 6, h * 0.42);
          ctx.lineTo(x + 6, h * 0.42);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (mode === 'car_racing') {
        const horizon = h * 0.42;
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        ctx.lineTo(w, horizon);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(w * 0.16, h);
        ctx.quadraticCurveTo(w * 0.5, horizon * 0.8, w * 0.84, h);
        ctx.stroke();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 16]);
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h);
        ctx.quadraticCurveTo(w * 0.5, horizon, w * 0.5, horizon);
        ctx.stroke();
        ctx.setLineDash([]);

        const roadOffset = Math.sin(t * 2) * 8;
        for (let i = 0; i < 3; i++) {
          const y = h * (0.62 + i * 0.11);
          ctx.fillStyle = i === 1 ? '#38bdf8' : '#a78bfa';
          roundedRect(w * (0.48 + roadOffset / 100 + i * 0.08) - 18, y, 36, 18, 5);
          ctx.fill();
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(w * (0.48 + roadOffset / 100 + i * 0.08) - 10, y - 7, 20, 7);
        }
      } else if (mode === 'shooting') {
        ctx.strokeStyle = 'rgba(56,189,248,.18)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        drawYeti(w * 0.24, h * 0.82, 1.1, 1, '#38bdf8');
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(w * 0.31, h * 0.62);
        ctx.lineTo(w * 0.31 + ((t * 180) % (w * 0.55)), h * 0.44);
        ctx.stroke();
        ctx.fillStyle = '#fb7185';
        for (let i = 0; i < 3; i++) {
          const x = w * (0.62 + i * 0.1);
          const y = h * (0.35 + Math.sin(t * 2 + i) * 0.08);
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#93c5fd';
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.62, h * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.62, h * 0.24 + Math.sin(t * 2) * 4, 0, Math.PI * 2);
        ctx.stroke();
        drawYeti(w * 0.5, h * 0.68, 1.2, 1, '#38bdf8');
        for (let i = 0; i < 6; i++) {
          const a = t * 0.7 + i * Math.PI / 3;
          ctx.fillStyle = i % 2 ? '#67e8f9' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(w * 0.5 + Math.cos(a) * h * 0.26, h * 0.62 + Math.sin(a) * h * 0.16, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      frame = requestAnimationFrame(drawScene);
    };

    resize();
    frame = requestAnimationFrame(drawScene);
    window.addEventListener('resize', resize);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="h-40 w-full" aria-label={`Animated ${mode} gameplay preview`} />;
};

export const LandingHero3D: React.FC<LandingHero3DProps> = ({
  yeti,
  onLaunchGame,
  onLaunchMode,
  onLaunchTunnel,
  onOpenMyYeti,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const { scrollYProgress } = useScroll({ target: pageRef, offset: ['start start', 'end end'] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const heroY = useTransform(smoothProgress, [0, 0.45], [0, -110]);
  const heroScale = useTransform(smoothProgress, [0, 0.45], [1, 1.08]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.32], [1, 0.25]);
  const selectorOpacity = useTransform(smoothProgress, [0.05, 0.2], [0, 1]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 1280, container.clientHeight || 680);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071324');
    scene.fog = new THREE.FogExp2('#071324', 0.015);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      44,
      (container.clientWidth || 1280) / (container.clientHeight || 680),
      0.2,
      160
    );
    camera.position.set(-2.4, 5.2, 11.4);

    // Three-point warm/cool Arctic lighting
    scene.add(new THREE.HemisphereLight('#bae6fd', '#0f2942', 0.82));

    const key = new THREE.DirectionalLight('#fff7ed', 1.55);
    key.position.set(12, 20, 14);
    key.castShadow = !isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 55;
    key.shadow.camera.left = -18;
    key.shadow.camera.right = 18;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -18;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const rim = new THREE.DirectionalLight('#38bdf8', 0.95);
    rim.position.set(-12, 8, -12);
    scene.add(rim);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const env = buildArcticEnvironment(maxAniso, isSoftwareGl, 'glacier_well');
    scene.add(env.group);

    // Realistic Multi-Colored 3D Lofi Yetis skating and battling around the well
    const heroRig = buildYetiRig({
      colorwayId: yeti?.colorway || 'classic_lofi',
      hatId: yeti?.equipped.hat || 'hat_goggles',
      scarfId: yeti?.equipped.scarf || 'scarf_lofi',
      isPlayer: true,
      scale: 1.15,
    });
    scene.add(heroRig.root);

    const rivalSpecs = [
      { colorwayId: 'glacier_mint' as const, hatId: 'hat_beanie', scarfId: 'scarf_aurora', radius: 4.7, speed: 0.54, phase: 0 },
      { colorwayId: 'sunset_ember' as const, hatId: 'hat_crown', scarfId: 'scarf_crimson', radius: 6.1, speed: 0.45, phase: 2.1 },
      { colorwayId: 'aurora_violet' as const, hatId: 'hat_goggles', scarfId: 'scarf_lofi', radius: 7.2, speed: 0.38, phase: 4.2 },
    ];
    const rivals = rivalSpecs.map((spec) => {
      const rig = buildYetiRig({
        colorwayId: spec.colorwayId,
        hatId: spec.hatId,
        scarfId: spec.scarfId,
        isPlayer: false,
      });
      scene.add(rig.root);
      return { rig, ...spec };
    });

    // Orbiting Glacial Drops & Frost Gems
    const dropGeo = new THREE.OctahedronGeometry(0.32, 0);
    dropGeo.scale(0.85, 1.35, 0.85);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.55,
      roughness: 0.12,
      clearcoat: 1.0,
    });
    const gemGeo = new THREE.OctahedronGeometry(0.34, 0);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: '#67e8f9',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.65,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
    });

    const floatingItems: { mesh: THREE.Mesh; radius: number; angleOffset: number; speed: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(i % 2 === 0 ? dropGeo : gemGeo, i % 2 === 0 ? dropMat : gemMat);
      m.castShadow = !isSoftwareGl;
      scene.add(m);
      floatingItems.push({
        mesh: m,
        radius: 2.7 + (i % 3) * 1.35,
        angleOffset: (i / 8) * Math.PI * 2,
        speed: 0.52 + (i % 2) * 0.25,
      });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      if (!container) return;
      const cw = container.clientWidth || 1280;
      const ch = container.clientHeight || 680;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      env.update(t, dt, 10.6, true);

      // Hero Lofi walks/skates in a smooth figure-8 with full bipedal walk cycle
      const hx = 3.2 + Math.sin(t * 0.78) * 2.2;
      const hz = 1.6 + Math.sin(t * 1.56) * 1.25;
      const dhx = Math.cos(t * 0.78) * 2.2 * 0.78;
      const dhz = Math.cos(t * 1.56) * 1.25 * 1.56;
      heroRig.root.position.set(hx, 0, hz);
      heroRig.root.rotation.y = Math.atan2(dhx, dhz);
      const heroSpeed = Math.hypot(dhx, dhz) * 65;
      animateYetiWalk(heroRig, {
        speed: heroSpeed,
        dt,
        elapsedTime: t,
        lateralTurn: -dhx * 0.025,
      });

      // Multi-colored rivals walking around the well
      for (const rv of rivals) {
        const a = t * rv.speed + rv.phase;
        const vx = -Math.sin(a) * rv.radius * rv.speed;
        const vz = Math.cos(a) * rv.radius * rv.speed;
        rv.rig.root.position.set(Math.cos(a) * rv.radius, 0, Math.sin(a) * rv.radius);
        rv.rig.root.rotation.y = Math.atan2(vx, vz);
        animateYetiWalk(rv.rig, {
          speed: Math.hypot(vx, vz) * 65,
          dt,
          elapsedTime: t + rv.phase,
        });
      }

      for (const fi of floatingItems) {
        const a = fi.angleOffset + t * fi.speed;
        fi.mesh.position.set(
          Math.cos(a) * fi.radius,
          0.65 + Math.sin(t * 3 + fi.angleOffset) * 0.2,
          Math.sin(a) * fi.radius
        );
        fi.mesh.rotation.y += dt * 2.1;
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, -2.3 + Math.sin(t * 0.28) * 1.0, 3, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 4.7 + Math.cos(t * 0.22) * 0.35, 3, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, 11.1, 3, dt);
      camera.lookAt(1.8, 1.05, 0.2);

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (isSoftwareGl) afterDraw(tick);
    else frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      envTex.dispose();
      renderer.dispose();
    };
  }, [yeti?.colorway, yeti?.equipped.hat, yeti?.equipped.scarf]);

  const modes2D = GAME_MODES.filter((g) => g.dimension === '2D');
  const modes3D = GAME_MODES.filter((g) => g.dimension === '3D');

  const getModeIcon = (id: GameModeId) => {
    switch (id) {
      case 'car_racing':
        return Car;
      case 'shooting':
        return Crosshair;
      case 'stickman_wrestling':
        return Trophy;
      case 'stickman_brawl':
        return Swords;
      case 'stickman_run':
        return Flame;
      default:
        return Snowflake;
    }
  };

  return (
    <motion.div ref={pageRef} className="space-y-16 pb-8">
      {/* FULL-BLEED 3D HERO SECTION */}
      <section className="relative overflow-hidden min-h-[590px] lg:min-h-[650px] flex items-center border-b border-slate-800/80">
        <motion.div
          ref={mountRef}
          style={{ y: heroY, scale: heroScale }}
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        />

        {webglUnavailable && (
          <img
            src="/src/assets/images/frost_arena_banner_1794874871724.jpg"
            alt="Frozen lake arena"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        )}

        <div
          className="absolute inset-0 bg-gradient-to-r from-[#071324]/92 via-[#071324]/58 to-transparent pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#081322] to-transparent pointer-events-none"
          aria-hidden="true"
        />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 mx-auto w-full max-w-[1200px] px-4 sm:px-6 pt-24 pb-16"
        >
          <div className="max-w-xl space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Lofi&apos;s frozen arcade
            </p>

            <motion.h1
              initial={{ opacity: 0, y: 28, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="title-3d-game text-5xl sm:text-6xl lg:text-[66px] leading-[1.02] text-balance"
            >
              Yeti Flurry Rush
            </motion.h1>

            <p className="max-w-sm text-lg font-medium leading-snug text-slate-100 sm:text-xl">
              Race. Brawl. Survive the storm.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={onLaunchGame}
                className="inline-flex items-center gap-2.5 rounded-lg bg-sky-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-current" />
                Launch Game Suite
              </button>

              <button
                type="button"
                onClick={() => onLaunchMode('stickman_wrestling')}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-400/60 bg-[#09182c]/85 px-5 py-3.5 text-sm font-semibold text-amber-200 hover:bg-amber-400 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
              >
                <Trophy className="h-4 w-4" />
                2D Stickman Wrestling
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-slate-300 tabular-nums">
              <span>6 games</span>
              <span aria-hidden="true">·</span>
              <span>3 frozen worlds</span>
              <span aria-hidden="true">·</span>
              <span>Live rooms</span>
              <span aria-hidden="true">·</span>
              <span>Live Mini-Map &amp; Life Bars</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onLaunchTunnel('glacier_well')}
                className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline underline-offset-4"
              >
                <Users className="h-3.5 w-3.5" />
                Join Live 3D Tunnel
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenMyYeti}
                className="text-sky-300 hover:text-sky-200 underline underline-offset-4"
              >
                {yeti ? `Customize ${yeti.name}` : 'Mint Starter Lofi Yeti'}
              </button>
            </div>
          </div>
        </motion.div>

      </section>

      <motion.div
        className="mx-auto -mt-8 w-full max-w-[1200px] px-4 sm:px-6"
        style={{ opacity: selectorOpacity }}
      >
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-sky-400/70" />
          Choose your chaos
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-sky-400/70" />
        </div>
      </motion.div>

      {/* BELOW THE FOLD: VISUAL GAME SELECTOR */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-14">
        {/* SECTION 01: 2D STICKMAN & WRESTLING GAMES WITH LOFI THE YETI */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-300">
                01. 2D Stickman Arcade · Featuring Lofi the Yeti Figure
              </p>
              <h2 className="font-display text-3xl text-white mt-1">
                Enter the 2D fight
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onLaunchMode('stickman_wrestling')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
            >
              Step Into The 2D Ring
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {modes2D.map((gm) => {
              const Icon = getModeIcon(gm.id);
              return (
                <div
                  key={gm.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1C30] space-y-5 transition-transform hover:-translate-y-1 hover:border-amber-400/60"
                >
                  <div className="relative h-40 overflow-hidden">
                    <GamePreviewCanvas mode={gm.id} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1C30] via-[#0D1C30]/35 to-transparent" />
                    <div className="absolute inset-x-5 bottom-4 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        2D Stickman · {gm.shortLabel}
                      </span>
                      <Icon className="h-5 w-5 text-amber-300 drop-shadow-lg" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="space-y-2 px-6">
                    <span className="text-xs font-semibold text-sky-400">{gm.subtitle}</span>
                    <h3 className="font-display text-xl text-white">{gm.name}</h3>
                    <p className="text-xs uppercase tracking-wider text-slate-300 pt-1">Fight · climb · conquer</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLaunchMode(gm.id)}
                    className="mx-6 mb-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400/95 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Play {gm.shortLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 02: 3D ARENA GAMES + 3 WORLDS */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-sky-400">
                02. 3D Arena Games · Pick Game Type Then Choose Map
              </p>
              <h2 className="font-display text-3xl text-white mt-1">
                Enter the 3D arena
              </h2>
            </div>
            <button
              type="button"
              onClick={onLaunchGame}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              Open 3D Game Launcher
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {modes3D.map((gm) => {
              const Icon = getModeIcon(gm.id);
              return (
                <div
                  key={gm.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1C30] space-y-5 transition-transform hover:-translate-y-1 hover:border-sky-500/60"
                >
                  <div className="relative h-40 overflow-hidden">
                    <GamePreviewCanvas mode={gm.id} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1C30] via-[#0D1C30]/35 to-transparent" />
                    <div className="absolute inset-x-5 bottom-4 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                        3D World · {gm.shortLabel}
                      </span>
                      <Icon className="h-5 w-5 text-white drop-shadow-lg" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="space-y-2 px-6">
                    <span className="text-xs font-semibold text-sky-400">{gm.subtitle}</span>
                    <h3 className="font-display text-xl text-white">{gm.name}</h3>
                    <p className="text-xs uppercase tracking-wider text-slate-300 pt-1">Survive · drift · blast</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLaunchMode(gm.id)}
                    className="mx-6 mb-6 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-white hover:border-sky-400 hover:text-sky-200 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Play {gm.shortLabel} · Choose Map
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ARENA_MAPS.map((map) => (
              <div
                key={map.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#0A1728] p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Compass className="h-3.5 w-3.5" style={{ color: map.accentHex }} />
                    <h4 className="font-display text-base text-white">{map.name}</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{map.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 03: LOFI STICKMAN & 3D ROSTER + SUI ARCADE PROGRESSION */}
        <div className="hidden grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-sky-400">
                03. Unified Lofi Arcade · 2D Stickman &amp; 3D Progression
              </p>
              <h2 className="font-display text-2xl sm:text-3xl text-white text-balance">
                One Lofi the Yeti Character Across 6 Games
              </h2>
            </div>

            <div className="space-y-5 border-t border-slate-800 pt-5">
              <div className="flex items-start gap-4">
                <Trophy className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Stickman Yeti Wrestling &amp; Frost Brawl Combat
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Grapple rival stickmen for overhead Suplex Slams, rebound off elastic ring ropes, charge your Avalanche Finisher, and score 1-2-3 Pinfall victories as 2D Stickman Lofi.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Sparkles className="h-5 w-5 text-sky-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Live Power-Ups, Life Bars &amp; Fullscreen Radar
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Collect Cryo Shields, Turbo Surge, Drop Magnets, Rage Multipliers, and Medkits while tracking checkpoints and rivals on the fullscreen mini-map.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Shield className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Custom Yeti Colorways &amp; Sui Object Progression
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Your chosen colorway, hat, and scarf carry seamlessly into both the 3D Yeti rig and the 2D Stickman Lofi figure with zero pay-to-win stats.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-amber-300">
                  Playable Mascot · 2D &amp; 3D Cross-Mode
                </p>
                <h3 className="font-display text-2xl text-white mt-0.5">
                  Lofi the Yeti Roster
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {yeti
                    ? `${yeti.name} · Level ${yeti.level} ${yeti.stage}`
                    : 'Mint a free starter Yeti to track high scores across all 6 games.'}
                </p>
              </div>
              <img
                src="/src/assets/images/lofi_yeti_face_1794999269515.jpg"
                alt="Lofi the Yeti mascot character"
                className="h-20 w-20 rounded-xl object-cover bg-[#061224] p-1 border border-slate-700 shrink-0"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 tabular-nums border-t border-slate-800 pt-4">
              <div>
                <span className="text-xs text-slate-400 block">2D Games</span>
                <span className="font-mono text-2xl font-bold text-amber-300">3</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">3D Arenas</span>
                <span className="font-mono text-2xl font-bold text-sky-300">3</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Colorways</span>
                <span className="font-mono text-2xl font-bold text-white">
                  {YETI_COLORWAYS.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
              {YETI_COLORWAYS.map((cw) => (
                <span
                  key={cw.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#081322] px-2.5 py-1 text-[11px] text-slate-200"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: cw.skinHex }}
                    aria-hidden="true"
                  />
                  {cw.name}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onLaunchMode('stickman_wrestling')}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                Play Stickman Wrestling
              </button>
              <button
                type="button"
                onClick={onOpenMyYeti}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-sky-400 hover:text-white transition-colors"
              >
                Customize Yeti
              </button>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};
