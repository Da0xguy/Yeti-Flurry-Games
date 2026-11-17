import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Play, Users, ArrowRight, Droplets, Sparkles, Shield, Compass, Car, Crosshair, Snowflake } from 'lucide-react';
import type { GameModeId, MapId, WellImpactState, YetiObject } from '../types';
import { ARENA_MAPS, GAME_MODES } from '../data/gameCatalog';
import { buildArcticEnvironment } from '../three/arenaEnvironment';
import { animateYetiWalk, buildYetiRig } from '../three/yetiBuilder';

interface LandingHero3DProps {
  yeti: YetiObject | null;
  wellImpact: WellImpactState;
  onLaunchGame: () => void;
  onLaunchMode: (gameMode: GameModeId) => void;
  onLaunchTunnel: (mapId?: MapId) => void;
  onOpenMyYeti: () => void;
}

export const LandingHero3D: React.FC<LandingHero3DProps> = ({
  yeti,
  wellImpact,
  onLaunchGame,
  onLaunchMode,
  onLaunchTunnel,
  onOpenMyYeti,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

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

  const dropsIntoNextWell =
    wellImpact.totalDropsCollected % wellImpact.dropsPerWellMilestone;
  const wellPct = Math.min(
    100,
    Math.round((dropsIntoNextWell / wellImpact.dropsPerWellMilestone) * 100)
  );

  return (
    <div className="space-y-16 pb-8">
      {/* FULL-BLEED 3D HERO SECTION (Open landing layout — NO card box) */}
      <section className="relative overflow-hidden min-h-[590px] lg:min-h-[650px] flex items-center border-b border-slate-800/80">
        <div
          ref={mountRef}
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

        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-16">
          <div className="max-w-xl space-y-5">
            <p className="text-xs font-semibold tracking-wider text-sky-400">
              Lofi the Yeti · 3D Arcade Survival on Sui
            </p>

            <h1 className="title-3d-game text-5xl sm:text-6xl lg:text-[66px] leading-[1.02] text-balance">
              Yeti Flurry Rush
            </h1>

            <p className="text-base sm:text-lg leading-relaxed text-slate-200 max-w-lg">
              Launch into expanded 3D worlds: pick Survival Flurry, Arctic Kart Racing, or Frost Blaster Shooter, choose your 3D map, and bank Glacial Drops to fund real-world clean water wells.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={onLaunchGame}
                className="inline-flex items-center gap-2.5 rounded-lg bg-sky-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-current" />
                Launch 3D Game
              </button>

              <button
                type="button"
                onClick={() => onLaunchTunnel('glacier_well')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600/80 bg-[#09182c]/85 px-5 py-3.5 text-sm font-semibold text-white hover:border-sky-400 hover:text-sky-200 transition-colors whitespace-nowrap shrink-0"
              >
                <Users className="h-4 w-4 text-sky-400" />
                Join Live Tunnel
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-slate-300 tabular-nums">
              <span>3 Game Modes</span>
              <span aria-hidden="true">·</span>
              <span>3 Expanded 3D Maps</span>
              <span aria-hidden="true">·</span>
              <span>6 Yeti Colorways</span>
              <span aria-hidden="true">·</span>
              <span>{wellImpact.wellsFunded} Water Wells Funded</span>
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
        </div>
      </section>

      {/* BELOW THE FOLD: 3 GAME MODES + 3 EXPANDED MAPS */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-12">
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-sky-400">
                01. Three 3D Arcade Games · Pick Game Type Then Choose Map
              </p>
              <h2 className="font-display text-3xl text-white mt-1">
                Survival, Kart Racing & Frost Blaster Shooter
              </h2>
            </div>
            <button
              type="button"
              onClick={onLaunchGame}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              Open Game Launcher
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {GAME_MODES.map((gm) => {
              const Icon =
                gm.id === 'car_racing' ? Car : gm.id === 'shooting' ? Crosshair : Snowflake;
              return (
                <div
                  key={gm.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0D1C30] p-6 space-y-5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-sky-400">{gm.subtitle}</span>
                      <Icon className="h-4 w-4 text-sky-300" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-2xl text-white">{gm.name}</h3>
                    <p className="text-sm leading-relaxed text-slate-400">{gm.description}</p>
                    <p className="text-xs text-slate-300 pt-1">{gm.controlsSummary}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLaunchMode(gm.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-white hover:border-sky-400 hover:text-sky-200 transition-colors"
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
                    <h4 className="font-display text-lg text-white">{map.name}</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{map.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 02: CORE GAMEPLAY & TASKS */}
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-sky-400">
                02. In-Match Tasks & True Sui Ownership
              </p>
              <h2 className="font-display text-3xl text-white text-balance">
                Bank Drops, Smash Crates & Capture Shrine Beacons
              </h2>
            </div>

            <div className="space-y-5 border-t border-slate-800 pt-5">
              <div className="flex items-start gap-4">
                <Sparkles className="h-5 w-5 text-sky-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Live Arena Tasks & Frost Crate Loot
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Every match challenges you with dynamic tasks: carry Drops to the Central Well to bank 2x points and heal Hearts, smash 3D Frost Crates for power-ups, and hold Shrine Beacons.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Shield className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Custom Yeti Colorways & Non-P2W Cosmetics
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Style your furry 3D Lofi Yeti across 6 vibrant colorways, hats, scarves, and frost trails stored via Sui objects without pay-to-win stats.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Droplets className="h-5 w-5 text-teal-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Glacial Drops Power Real-World Water Wells
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Every Glacial Drop banked at the central well increments the community Lofi Well Impact Pool toward funding new clean water wells.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
            <div className="flex items-center gap-4">
              <img
                src="/src/assets/images/lofi_well_emblem_1794874871937.jpg"
                alt="Enchanted glacial water well overflowing with drops"
                referrerPolicy="no-referrer"
                className="h-24 w-24 rounded-xl object-cover border border-slate-800 shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-cyan-400">
                  Community Water Well Milestone
                </p>
                <h3 className="font-display text-2xl text-white mt-0.5">
                  Well #{wellImpact.wellsFunded + 1} Progress
                </h3>
                <p className="text-xs text-slate-400 mt-1 tabular-nums">
                  {wellImpact.wellsFunded} wells funded · {wellImpact.activeContributors} active Yetis
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 tabular-nums border-t border-slate-800 pt-4">
              <div>
                <span className="text-xs text-slate-400 block">Wells Funded</span>
                <span className="font-mono text-2xl font-bold text-cyan-300">
                  {wellImpact.wellsFunded}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Glacial Drops</span>
                <span className="font-mono text-2xl font-bold text-white">
                  {wellImpact.totalDropsCollected.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Progress</span>
                <span className="font-mono text-2xl font-bold text-sky-300">
                  {wellPct}%
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-300">Next milestone</span>
                <span className="font-mono text-cyan-300">
                  {dropsIntoNextWell} / {wellImpact.dropsPerWellMilestone} drops
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${wellPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
